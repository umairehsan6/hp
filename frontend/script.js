const askBtn = document.getElementById('askBtn');
const qInput = document.getElementById('question');
const answerEl = document.getElementById('answer');

async function askQuestion(q){
  if(!q || !q.trim()){
    answerEl.textContent = 'Please enter a question.';
    return;
  }
  const form = new FormData();
  form.append('question', q);
  form.append('top_k', '3');
  try{
    const res = await fetch('/chat', { method: 'POST', body: form });
    if(!res.ok){
      const err = await res.json();
      answerEl.textContent = err.detail || 'Error from server';
      return;
    }
    const data = await res.json();
    answerEl.innerHTML = data.answer.replace(/\n/g, '<br>');
  }catch(e){
    answerEl.textContent = 'Network error: '+e.message;
  }
}

askBtn.addEventListener('click', ()=> askQuestion(qInput.value));
qInput.addEventListener('keydown', e=>{ if(e.key==='Enter') askQuestion(qInput.value)});

// ingest form
const ingestForm = document.getElementById('ingestForm');
ingestForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const textarea = document.getElementById('rawtext');
  const fileInput = document.getElementById('fileInput');
  const form = new FormData();
  if(textarea.value && textarea.value.trim()) form.append('text', textarea.value);
  if(fileInput.files && fileInput.files[0]) form.append('file', fileInput.files[0]);
  try{
    const res = await fetch('/ingest', { method: 'POST', body: form });
    const data = await res.json();
    alert('Ingested: '+(data.chunks_added||0)+' chunks');
    textarea.value = '';
    fileInput.value = '';
  }catch(e){
    alert('Ingest failed: '+e.message);
  }
});
