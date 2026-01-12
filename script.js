const askBtn = document.getElementById('askBtn');
const qInput = document.getElementById('question');
const answerEl = document.getElementById('answer');
const spinner = document.getElementById('spinner');
const resultsEl = document.getElementById('results');

// API URL — points to your local backend via ngrok
const API_URL = 'https://52fbfbae5308.ngrok-free.app'; // replace with your ngrok URL if it changes

async function askQuestion(q){
  if(!q || !q.trim()){
    answerEl.textContent = 'Please enter a question.';
    return;
  }

  answerEl.textContent = '';
  resultsEl.innerHTML = '';
  if(spinner) { spinner.classList.add('spin'); spinner.setAttribute('aria-hidden','false'); }

  const form = new FormData();
  form.append('question', q);
  form.append('top_k', '5');

  try {
    const res = await fetch(`${API_URL}/chat`, { method: 'POST', body: form });
    if(!res.ok){
      const err = await res.json();
      if(spinner) { spinner.classList.remove('spin'); spinner.setAttribute('aria-hidden','true'); }
      answerEl.textContent = err.detail || 'Error from server';
      return;
    }

    const data = await res.json();
    if(spinner) { spinner.classList.remove('spin'); spinner.setAttribute('aria-hidden','true'); }

    const ans = data.answer && data.answer.trim() ? data.answer : 'No relevant passages found.';
    answerEl.innerHTML = ans.replace(/\n/g, '<br>');

    // Render result cards
    resultsEl.innerHTML = '';
    (data.results || []).forEach(r => {
      const card = document.createElement('div'); 
      card.className = 'result-card';

      const main = document.createElement('div'); 
      main.className = 'result-main';
      main.innerHTML = (r.text || '').replace(/\n/g, '<br>');

      const meta = document.createElement('div'); 
      meta.className = 'result-meta';
      meta.textContent = `source: ${r.meta?.source || 'unknown'} • chunk ${r.meta?.chunk_index ?? 0}`;
      main.appendChild(meta);

      const score = document.createElement('div'); 
      score.className = 'result-score';
      score.textContent = r.score ? r.score.toFixed(3) : '';

      card.appendChild(main);
      card.appendChild(score);
      resultsEl.appendChild(card);
    });

  } catch(e) {
    if(spinner) { spinner.classList.remove('spin'); spinner.setAttribute('aria-hidden','true'); }
    answerEl.textContent = 'Network error: ' + e.message;
  }
}

// Event listeners
askBtn.addEventListener('click', () => askQuestion(qInput.value));
qInput.addEventListener('keydown', e => {
  if(e.key === 'Enter'){
    e.preventDefault();
    askQuestion(qInput.value);
  }
});
