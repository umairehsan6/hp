const askBtn = document.getElementById('askBtn');
const qInput = document.getElementById('question');
const answerEl = document.getElementById('answer');
const statusEl = document.getElementById('status');
const ingestBtn = document.getElementById('ingestBtn');
const spinner = document.getElementById('spinner');
const resultsEl = document.getElementById('results');
const ingestForm = document.getElementById('ingestForm');

// -----------------------------
// CONFIG: Your ngrok URL
// Update this every time you start ngrok
const API_URL = 'https://3f41e6f02666.ngrok-free.app/chat';

// -----------------------------
// Utility: show/hide CV ingest form depending on backend status
async function checkBackend() {
    try {
        const r = await fetch(`${API_URL}/status`);
        if (!r.ok) throw new Error('Backend unavailable');
        const s = await r.json();
        statusEl.textContent = s.ingested ? `CV ingested — ${s.chunks} chunks` : 'No CV ingested';

        if (s.ingested) {
            document.getElementById('fileInput').disabled = true;
            document.getElementById('rawtext').disabled = true;
            ingestBtn.disabled = true;
            ingestBtn.textContent = 'Ingested';
        }
        ingestForm.style.display = 'block'; // show ingest form only if backend reachable
    } catch (e) {
        statusEl.textContent = 'Backend unreachable';
        ingestForm.style.display = 'none'; // hide ingest form if backend unreachable
    }
}

// -----------------------------
// Ask question to backend
async function askQuestion(q) {
    if (!q || !q.trim()) {
        answerEl.textContent = 'Please enter a question.';
        return;
    }

    answerEl.textContent = '';
    resultsEl.innerHTML = '';
    if (spinner) { spinner.classList.add('spin'); spinner.setAttribute('aria-hidden', 'false'); }

    const form = new FormData();
    form.append('question', q);
    form.append('top_k', '5');

    try {
        const res = await fetch(`${API_URL}/chat`, { method: 'POST', body: form });
        const text = await res.text(); // parse as text first
        let data;
        try { data = JSON.parse(text); } // try parse JSON
        catch { throw new Error('Backend returned non-JSON response: ' + text); }

        if (spinner) { spinner.classList.remove('spin'); spinner.setAttribute('aria-hidden', 'true'); }

        const ans = data.answer && data.answer.trim() ? data.answer : 'No relevant passages found.';
        answerEl.innerHTML = ans.replace(/\n/g, '<br>');

        resultsEl.innerHTML = '';
        (data.results || []).forEach(r => {
            const card = document.createElement('div'); card.className = 'result-card';
            const main = document.createElement('div'); main.className = 'result-main';
            main.innerHTML = (r.text || '').replace(/\n/g, '<br>');
            const meta = document.createElement('div'); meta.className = 'result-meta';
            meta.textContent = `source: ${r.meta?.source || 'unknown'} • chunk ${r.meta?.chunk_index ?? 0}`;
            main.appendChild(meta);
            const score = document.createElement('div'); score.className = 'result-score';
            score.textContent = (r.score ? r.score.toFixed(3) : '');
            card.appendChild(main);
            card.appendChild(score);
            resultsEl.appendChild(card);
        });

    } catch (e) {
        if (spinner) { spinner.classList.remove('spin'); spinner.setAttribute('aria-hidden', 'true'); }
        answerEl.textContent = 'Network error: ' + e.message;
    }
}

// -----------------------------
// Event listeners
askBtn.addEventListener('click', () => askQuestion(qInput.value));
qInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        askQuestion(qInput.value);
    }
});

// -----------------------------
// Ingest form submission
ingestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = document.getElementById('rawtext');
    const fileInput = document.getElementById('fileInput');
    const form = new FormData();
    if (textarea.value && textarea.value.trim()) form.append('text', textarea.value);
    if (fileInput.files && fileInput.files[0]) form.append('file', fileInput.files[0]);

    ingestBtn.disabled = true;
    ingestBtn.textContent = 'Ingesting...';

    try {
        const res = await fetch(`${API_URL}/ingest`, { method: 'POST', body: form });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } // parse JSON
        catch { throw new Error('Backend returned non-JSON response: ' + text); }

        alert('Ingested: ' + (data.chunks_added || 0) + ' chunks');
        textarea.value = '';
        fileInput.value = '';
        await checkBackend();
    } catch (e) {
        alert('Ingest failed: ' + e.message);
    } finally {
        ingestBtn.disabled = false;
        ingestBtn.textContent = 'Ingest';
    }
});

// -----------------------------
// Initial check
checkBackend();
