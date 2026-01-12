# Saqlain Profile Chatbot — Deployment Guide

## Overview
- **Frontend**: Static HTML/CSS/JS deployed on Vercel.
- **Backend**: FastAPI server on Render, serves `/ingest`, `/chat`, `/status` endpoints.
- **No external LLMs**: Uses local sentence-transformers embeddings + cosine similarity retrieval.

---

## Deploy Backend to Render

### Prerequisites
- Render account (https://render.com)
- GitHub repo connected to Render (https://github.com/saqlainhamdnai/saqlain-profile)

### Steps
1. **Create a new Web Service on Render**:
   - Go to https://dashboard.render.com/
   - Click "New +" → "Web Service"
   - Connect your GitHub repo: `saqlainhamdnai/saqlain-profile`
   - Specify root directory: `saqlain-profile-app`

2. **Configure the service**:
   - **Name**: `saqlain-profile-backend`
   - **Environment**: Python 3.10+
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `web: cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
     (Or use the Procfile method: select "Use Procfile" during setup)
   - **Plan**: Free tier (adequate for low traffic)

3. **Environment Variables** (optional):
   - None required for this app (embeddings are local, no API keys).

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for build + deployment (typically 2-3 minutes)
   - Copy your backend URL: e.g., `https://saqlain-profile-backend.onrender.com`

---

## Deploy Frontend to Vercel

### Prerequisites
- Vercel account (https://vercel.com)
- GitHub repo connected to Vercel

### Steps
1. **Import Project**:
   - Go to https://vercel.com/dashboard
   - Click "Add New" → "Project"
   - Select your GitHub repo: `saqlainhamdnai/saqlain-profile`

2. **Configure**:
   - **Root Directory**: `saqlain-profile-app`
   - **Build Command**: Leave blank (static frontend, no build needed)
   - **Output Directory**: `frontend`
   - **Install Command**: `echo 'No install needed'`

3. **Environment Variables**:
   - Add `REACT_APP_API_URL` (optional for advanced): `https://saqlain-profile-backend.onrender.com`
     - Update `frontend/script.js` to use this if needed, or hardcode the Render backend URL.

4. **Deploy**:
   - Click "Deploy"
   - Wait for deployment (typically < 1 minute)
   - Copy your frontend URL: e.g., `https://saqlain-profile.vercel.app`

---

## Update Frontend to Point to Deployed Backend

Once your backend is deployed on Render, update the frontend to call it:

1. Open `frontend/script.js`
2. Replace `fetch('/chat'...)` and `fetch('/ingest'...)` and `fetch('/status'...)` with:
   ```javascript
   const API_URL = 'https://saqlain-profile-backend.onrender.com'; // Replace with your Render URL
   fetch(`${API_URL}/chat', ...)
   ```
   
   Or, if using CORS and environment variables, set `REACT_APP_API_URL` in Vercel and reference it in JS.

3. Alternatively, use **Vercel rewrite rules** in `vercel.json`:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://saqlain-profile-backend.onrender.com/:path*"
       }
     ]
   }
   ```
   Then call `fetch('/api/chat'...)` in the frontend.

---

## Local Testing (Before Deploy)

1. **Start the backend**:
   ```bash
   cd saqlain-profile-app/backend
   python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

2. **Open the frontend**:
   - Open `saqlain-profile-app/frontend/index.html` in your browser (or use `python -m http.server 5500` to serve it locally)
   - Navigate to http://127.0.0.1:5500/frontend/index.html

3. **Test**:
   - Ask a question: "Where did Saqlain study?"
   - Check that the backend returns passages from the ingested CV
   - Verify `/status` shows `{"ingested": true, "chunks": 7}`

---

## Production Checklist

- [ ] Backend deployed to Render and accessible at its URL
- [ ] Frontend deployed to Vercel
- [ ] Frontend script.js updated to call Render backend (CORS-enabled)
- [ ] Test query from deployed frontend → backend
- [ ] Verify `/status` endpoint confirms CV is ingested
- [ ] Monitor backend logs on Render for errors

---

## Troubleshooting

**Frontend can't reach backend**:
- Check CORS headers in `backend/main.py` (should allow `*` or Vercel domain)
- Verify Render URL is correct in frontend script
- Check browser console for network errors

**Backend starts but CV doesn't auto-ingest**:
- The auto-ingest path assumes local Downloads folder; on Render, use relative path or env var
- Alternatively, manually trigger ingestion by calling `POST /ingest` with your CV file

**Model download slow on first startup**:
- First boot of Render will download the sentence-transformers model (~400MB)
- This is one-time; subsequent boots are fast
- Consider increasing Render instance type if timeouts occur

---

## Next Steps
- Push this file (`DEPLOYMENT.md`) and the config files to GitHub
- Follow the steps above to deploy on Render + Vercel
- Share your frontend URL with visitors!
