from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import uvicorn
import pickle
import uuid
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

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
_vectorizer: TfidfVectorizer | None = None


def save_db():
    with open(DB_FILE, 'wb') as f:
        pickle.dump(_db, f)
    if _vectorizer is not None:
        with open(VECT_FILE, 'wb') as f:
            pickle.dump(_vectorizer, f)


def load_db():
    global _db, _vectorizer
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'rb') as f:
            _db = pickle.load(f)
    if os.path.exists(VECT_FILE):
        with open(VECT_FILE, 'rb') as f:
            _vectorizer = pickle.load(f)


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


@app.post('/ingest')
async def ingest_text(file: UploadFile | None = File(None), text: str | None = Form(None)):
    """Ingest a plain text file or raw text into the vector DB (TF-IDF)."""
    content = None
    filename = None
    if file is not None:
        filename = file.filename
        content = (await file.read()).decode(errors='ignore')
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

    # append to DB
    _db['chunks'].extend(new_entries)

    # rebuild TF-IDF matrix
    texts = [d['text'] for d in _db['chunks']]
    global _vectorizer
    _vectorizer = TfidfVectorizer(stop_words='english', max_features=20000)
    if texts:
        matrix = _vectorizer.fit_transform(texts)
        _db['matrix'] = matrix
    else:
        _db['matrix'] = None

    save_db()
    return {"status": "ok", "chunks_added": len(new_entries)}


@app.post('/chat')
async def chat(question: str = Form(...), top_k: int = Form(3)):
    """Return top-k relevant chunks for a question. No LLM used — answers are extracted from CV passages."""
    if _vectorizer is None or _db['matrix'] is None or len(_db['chunks']) == 0:
        raise HTTPException(status_code=400, detail="No documents ingested yet. Call /ingest first.")

    q_vec = _vectorizer.transform([question])
    sim = cosine_similarity(q_vec, _db['matrix'])[0]
    idx = np.argsort(sim)[::-1][:top_k]
    results = []
    for i in idx:
        results.append({
            "score": float(sim[i]),
            "text": _db['chunks'][i]['text'],
            "meta": _db['chunks'][i]['meta']
        })

    # Simple synthesized answer: return joined top passages with minimal rewording
    answer = "\n\n".join([r['text'] for r in results])
    return JSONResponse({"answer": answer, "results": results})


@app.get('/')
def read_index():
    static_index = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'index.html')
    return FileResponse(static_index)


if __name__ == '__main__':
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
