from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
from pypdf import PdfReader
import io
import uvicorn
import pickle
import uuid
import numpy as np
from dotenv import load_dotenv

load_dotenv()
from sentence_transformers import SentenceTransformer
import google.generativeai as genai

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
VECT_FILE = os.path.join(DATA_DIR, 'vectorizer.pkl')
DB_FILE = os.path.join(DATA_DIR, 'db.pkl')

os.makedirs(DATA_DIR, exist_ok=True)

app = FastAPI(title="Saqlain Profile Chat (no-LLM)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory DB structure persisted to disk
# {"chunks": [ {"id": str, "text": str, "meta": {}}, ... ], "matrix": np.ndarray or None }
_db = {"chunks": [], "matrix": None}
_vectorizer = None

# initialize sentence-transformers model
_embed_model: SentenceTransformer | None = None
_genai_configured = False


def save_db():
    with open(DB_FILE, 'wb') as f:
        pickle.dump(_db, f)
    # persist embeddings separately to avoid pickle issues with numpy arrays inside dict
    emb_file = os.path.join(DATA_DIR, 'embeddings.pkl')
    if 'embeddings' in _db and _db['embeddings'] is not None:
        with open(emb_file, 'wb') as ef:
            pickle.dump(_db['embeddings'], ef)


def load_db():
    global _db, _vectorizer
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'rb') as f:
            _db = pickle.load(f)
    if os.path.exists(VECT_FILE):
        with open(VECT_FILE, 'rb') as f:
            _vectorizer = pickle.load(f)
    # load persisted embeddings if present
    emb_file = os.path.join(DATA_DIR, 'embeddings.pkl')
    if os.path.exists(emb_file):
        with open(emb_file, 'rb') as ef:
            _db['embeddings'] = pickle.load(ef)
    else:
        _db.setdefault('embeddings', [])


def init_embed_model():
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer('all-MiniLM-L6-v2')

def init_genai():
    global _genai_configured
    if not _genai_configured:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("WARNING: GEMINI_API_KEY not found in env. Generative answers will fail.")
            return
        genai.configure(api_key=api_key)
        _genai_configured = True


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50):
    text = text.replace('\r', ' ')
    chunks = []
    i = 0
    L = len(text)
    while i < L:
        chunk = text[i:i+chunk_size]
        chunks.append(chunk.strip())
        i += chunk_size - overlap
    return [c for c in chunks if c]


@app.on_event("startup")
def startup_event():
    load_db()
    init_embed_model()
    # init_qa_model() # Lazy load on first request to save startup time
    # Auto-ingest CV if not already ingested
    if not _db.get('chunks'):
        cv_path = os.path.join(os.path.dirname(__file__), '..', 'SAQLAIN-HAMDANI (5).pdf')
        if os.path.exists(cv_path):
            try:
                from pypdf import PdfReader
                with open(cv_path, 'rb') as f:
                    reader = PdfReader(io.BytesIO(f.read()))
                    pages = [p.extract_text() or '' for p in reader.pages]
                    content = '\n\n'.join(pages)
                chunks = chunk_text(content)
                new_entries = []
                for i, c in enumerate(chunks):
                    new_entries.append({
                        "id": str(uuid.uuid4()),
                        "text": c,
                        "meta": {"source": "SAQLAIN-HAMDANI (5).pdf", "chunk_index": i}
                    })
                _db['chunks'].extend(new_entries)
                docs = [d['text'] for d in new_entries]
                embeddings = _embed_model.encode(docs, show_progress_bar=False)
                if _db.get('embeddings') is None:
                    _db['embeddings'] = []
                for emb in embeddings:
                    _db['embeddings'].append(np.array(emb, dtype=np.float32))
                save_db()
                print(f'[Auto-ingest] Loaded CV from {cv_path}: {len(new_entries)} chunks')
            except Exception as e:
                print(f'[Auto-ingest] Failed to load CV: {e}')


@app.post('/api/ingest')
async def ingest_text(file: UploadFile | None = File(None), text: str | None = Form(None)):
    """Ingest a plain text file or raw text into the vector DB (TF-IDF)."""
    content = None
    filename = None
    if file is not None:
        filename = file.filename
        data = await file.read()
        # If PDF, extract text pages
        if filename.lower().endswith('.pdf'):
            try:
                reader = PdfReader(io.BytesIO(data))
                pages = [p.extract_text() or '' for p in reader.pages]
                content = '\n\n'.join(pages)
            except Exception:
                # fallback to decode
                content = data.decode(errors='ignore')
        else:
            content = data.decode(errors='ignore')
    elif text is not None:
        content = text
        filename = "raw_text"
    else:
        raise HTTPException(status_code=400, detail="Provide either a file or text field.")

    chunks = chunk_text(content)
    new_entries = []
    for i, c in enumerate(chunks):
        new_entries.append({
            "id": str(uuid.uuid4()),
            "text": c,
            "meta": {"source": filename, "chunk_index": i}
        })

    # append to local DB
    _db['chunks'].extend(new_entries)

    # embed chunks and store embeddings in-memory and persist
    init_embed_model()
    docs = [d['text'] for d in new_entries]
    embeddings = _embed_model.encode(docs, show_progress_bar=False)
    # ensure embeddings list exists
    if _db.get('embeddings') is None:
        _db['embeddings'] = []
    for emb in embeddings:
        _db['embeddings'].append(np.array(emb, dtype=np.float32))

    save_db()
    return {"status": "ok", "chunks_added": len(new_entries)}


@app.delete('/api/ingest')
def clear_db():
    global _db, _embed_model
    _db = {"chunks": [], "matrix": None, "embeddings": []}
    # Clear persistence files
    if os.path.exists(DB_FILE): os.remove(DB_FILE)
    if os.path.exists(os.path.join(DATA_DIR, 'embeddings.pkl')): 
        os.remove(os.path.join(DATA_DIR, 'embeddings.pkl'))
    
    # We might want to keep the vectorizer/model loaded, but reset data
    save_db()
    return {"status": "ok", "message": "Database cleared"}


@app.post('/api/chat')
async def chat(question: str = Form(...), top_k: int = Form(3)):
    """Return top-k relevant chunks for a question. No LLM used — answers are extracted from CV passages."""
    # Simple embedding-based retrieval (cosine similarity)
    init_embed_model()
    if not _db.get('chunks') or not _db.get('embeddings'):
        raise HTTPException(status_code=400, detail="No documents ingested yet. Call /ingest first.")
    q_emb = _embed_model.encode([question], show_progress_bar=False)[0].astype(np.float32)
    # stack embeddings
    emb_matrix = np.vstack(_db['embeddings'])
    # normalize
    def norm(x):
        return x / (np.linalg.norm(x) + 1e-10)
    qn = norm(q_emb)
    embs_n = emb_matrix / (np.linalg.norm(emb_matrix, axis=1, keepdims=True) + 1e-10)
    sims = embs_n.dot(qn)
    idx = np.argsort(sims)[::-1][:top_k]
    results = []
    for i in idx:
        results.append({"score": float(sims[i]), "text": _db['chunks'][i]['text'], "meta": _db['chunks'][i]['meta']})
    answer = "\n\n".join([r['text'] for r in results])
    
    # GENERATIVE STEP
    try:
        init_genai()
        if _genai_configured:
            # FEED ALL RETRIEVED CHUNKS TO API (Maximizing Context)
            # We use the full 'results' list which comes from top_k (we will boost top_k in UI/Default)
            context = "\n".join([f"- [Score: {r['score']:.2f}] {r['text']}" for r in results])
            
            prompt = f"""You are a helpful assistant answering questions about Saqlain's profile based STRICTLY on the visual text chunks provided below.
            
CONTEXT CHUNKS (Retrieved from Vector DB):
{context}

QUESTION: {question}

ANSWER (Concise, friendly, and cite sources if fields are distinct):"""
            
            model = genai.GenerativeModel('gemini-2.5-flash')
            response = model.generate_content(prompt)
            
            if response.text:
                answer = response.text
    except Exception as e:
        print(f"Gemini generation failed: {e}")
        pass

    return JSONResponse({"answer": answer, "results": results})


@app.get('/')
def read_index():
    static_index = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'index.html')
    return FileResponse(static_index)


# Mount static files (must be after other routes if it overlaps, but here we mount to root)
# Alternatively, we can mount everything in frontend to /
@app.get('/api/status')
def status():
    """Return ingestion status for frontend to show whether a CV/text has been ingested."""
    chunks = len(_db.get('chunks') or [])
    return JSONResponse({"ingested": chunks > 0, "chunks": chunks})


app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), '..', 'frontend')), name="static")


if __name__ == '__main__':
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
