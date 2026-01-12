const askBtn = document.getElementById('askBtn');
const qInput = document.getElementById('question');
const answerEl = document.getElementById('answer');
const statusEl = document.getElementById('status');
const ingestBtn = document.getElementById('ingestBtn');
const spinner = document.getElementById('spinner');
const resultsEl = document.getElementById('results');

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
  try{
    const res = await fetch('/api/chat', { method: 'POST', body: form });
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

    // render result cards
    resultsEl.innerHTML = '';
    (data.results || []).forEach(r=>{
      const card = document.createElement('div'); card.className='result-card';
      const main = document.createElement('div'); main.className='result-main';
      main.innerHTML = (r.text||'').replace(/\n/g,'<br>');
      const meta = document.createElement('div'); meta.className='result-meta';
      meta.textContent = `source: ${r.meta && r.meta.source ? r.meta.source : 'unknown'} • chunk ${r.meta && r.meta.chunk_index !== undefined ? r.meta.chunk_index : 0}`;
      main.appendChild(meta);
      const score = document.createElement('div'); score.className='result-score';
      score.textContent = (r.score ? (r.score.toFixed(3)) : '');
      card.appendChild(main);
      card.appendChild(score);
      resultsEl.appendChild(card);
    });

  }catch(e){
    if(spinner) { spinner.classList.remove('spin'); spinner.setAttribute('aria-hidden','true'); }
    answerEl.textContent = 'Network error: '+e.message;
  }
}

askBtn.addEventListener('click', ()=> askQuestion(qInput.value));
qInput.addEventListener('keydown', e=>{ if(e.key==='Enter') { e.preventDefault(); askQuestion(qInput.value); } });

// ingest form
const ingestForm = document.getElementById('ingestForm');
ingestForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const textarea = document.getElementById('rawtext');
  const fileInput = document.getElementById('fileInput');
  const form = new FormData();
  if(textarea.value && textarea.value.trim()) form.append('text', textarea.value);
  if(fileInput.files && fileInput.files[0]) form.append('file', fileInput.files[0]);
  ingestBtn.disabled = true;
  ingestBtn.textContent = 'Ingesting...';
  try{
    const res = await fetch('/api/ingest', { method: 'POST', body: form });
    if(!res.ok) throw new Error('Server error');
    const data = await res.json();
    alert('Ingested: '+(data.chunks_added||0)+' chunks');
    textarea.value = '';
    fileInput.value = '';
    await refreshStatus();
  }catch(e){
    alert('Ingest failed: '+e.message);
  } finally{
    ingestBtn.disabled = false;
    ingestBtn.textContent = 'Ingest';
  }
});

async function refreshStatus(){
  try{
    const r = await fetch('/api/status');
    if(!r.ok) { statusEl.textContent='Unavailable'; return }
    const s = await r.json();
    statusEl.textContent = s.ingested ? `CV ingested — ${s.chunks} chunks` : 'No CV ingested';
    if(s.ingested){
      // disable ingest controls
      document.getElementById('fileInput').disabled = true;
      document.getElementById('rawtext').disabled = true;
      ingestBtn.disabled = true;
      ingestBtn.textContent = 'Ingested';
    }
  }catch(e){ statusEl.textContent='Error' }
}

// initial status check
refreshStatus();
