Saqlain Profile Chat (no LLM)

Overview

- Backend: FastAPI that ingests text/CV and uses TF-IDF retrieval (no external API or LLM).
- Frontend: simple static HTML/JS to ingest CV and ask questions.

Run locally

1. Create and activate a Python virtualenv and install requirements:

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r backend/requirements.txt
```

2. Run the backend (serves frontend on root):

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

3. Open http://localhost:8000 in your browser.

Ingest your CV

- Paste your CV text in the textarea and click "Ingest" or upload a text file.

Ask questions

- Type a question and click Ask. The server will return the top matching CV passages.

Deploying

Option A — Render (recommended for backend + frontend):

- Create a new Web Service on Render with the Dockerfile (choose "Docker" environment) and point to this repository.
- Set the service to listen on port 8000 (default). Render will build and run the container.

Option B — Docker (any host):

```bash
docker build -t saqlain-profile-app .
docker run -p 8000:8000 saqlain-profile-app
```

GitHub & Vercel

- Push this repository to GitHub, then deploy the backend on Render and the frontend on Vercel if you prefer separate hosting.

Notes

- This project uses TF-IDF retrieval for simplicity and privacy. No API keys are required.
- To improve retrieval quality, later switch to sentence-transformers embeddings and a vector DB (Chroma/FAISS).
