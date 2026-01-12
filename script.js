const askBtn = document.getElementById('askBtn');
const qInput = document.getElementById('question');
const answerEl = document.getElementById('answer');
const spinner = document.getElementById('spinner');
const resultsEl = document.getElementById('results');

// -----------------------------
// CONFIG: Your ngrok URL
// Only the /chat endpoint is needed for frontend
const API_URL = 'https://3f41e6f02666.ngrok-free.app/chat';

// -----------------------------
// Ask question to backend
async function askQuestion(q) {
    if (!q || !q.trim()) {
        answerEl.textContent = 'Please enter a question.';
        return;
    }

    answerEl.textContent = '';
    resultsEl.innerHTML = '';
    if (spinner) { spinner.style.display = 'inline-block'; }

    const form = new FormData();
    form.append('question', q);
    form.append('top_k', '5');

    try {
        const res = await fetch(API_URL, { method: 'POST', body: form });
        const text = await res.text(); // parse as text first
        let data;
        try { data = JSON.parse(text); } // try parse JSON
        catch { throw new Error('Backend returned non-JSON response: ' + text); }

        if (spinner) { spinner.style.display = 'none'; }

        const ans = data.answer && data.answer.trim() ? data.answer : 'No relevant passages found.';
        answerEl.innerHTML = ans.replace(/\n/g, '<br>');

        // render result cards
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
        if (spinner) { spinner.style.display = 'none'; }
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
