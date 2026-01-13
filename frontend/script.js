const askBtn = document.getElementById('askBtn');
const qInput = document.getElementById('question');
const answerArea = document.getElementById('answerArea');
const chunksList = document.getElementById('chunksList');
const statusEl = document.getElementById('status');
const spinner = document.getElementById('spinner');

const ingestBtn = document.getElementById('ingestBtn');
const clearBtn = document.getElementById('clearBtn');

// Helper to highlight terms
function highlightText(text, query) {
  if (!query) return text;
  const terms = query.split(/\s+/).filter(t => t.length > 2);
  let highlighted = text;
  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlighted = highlighted.replace(regex, '<span class="highlight">$1</span>');
  });
  return highlighted.replace(/\n/g, '<br>');
}

async function askQuestion(q) {
  if (!q || !q.trim()) return;

  // Clear previous state
  answerArea.innerHTML = '';
  chunksList.innerHTML = '';
  spinner.style.display = 'block';

  const form = new FormData();
  form.append('question', q);
  form.append('top_k', '20'); // User requested ALL (fetching max relevant chunks)

  try {
    const res = await fetch('/api/chat', { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error');
    }
    const data = await res.json();
    spinner.style.display = 'none';

    // 1. Render AI Answer (Main Area)
    if (data.answer) {
      let formatted = data.answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      answerArea.innerHTML = `
            <div class="answer-box">
                <div class="answer-label">AI Response</div>
                <div>${formatted}</div>
            </div>
        `;
    } else {
      answerArea.innerHTML = `<div style="color:#ef4444">No response generated.</div>`;
    }

    // 2. Render Retrieved Chunks (Sidebar)
    if (data.results && data.results.length > 0) {
      data.results.forEach((r, idx) => {
        const div = document.createElement('div');
        div.className = 'chunk-card';
        div.innerHTML = `
                <div class="chunk-header">
                    <span>#${idx + 1} ${r.meta?.source || 'doc'}</span>
                    <span class="chunk-score">${(r.score * 100).toFixed(1)}%</span>
                </div>
                <div>${highlightText(r.text, q)}</div>
            `;
        chunksList.appendChild(div);
      });
    } else {
      chunksList.innerHTML = `<div style="color:#71717a; font-size:0.85rem;">No relevant chunks found.</div>`;
    }

  } catch (e) {
    spinner.style.display = 'none';
    answerArea.innerHTML = `<div style="color:#ef4444">Error: ${e.message}</div>`;
  }
}

// Event Listeners
askBtn.addEventListener('click', () => askQuestion(qInput.value));
qInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); askQuestion(qInput.value); } });

// Ingest Logic
const ingestForm = document.getElementById('ingestForm');
ingestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const textarea = document.getElementById('rawtext');
  const fileInput = document.getElementById('fileInput');
  const form = new FormData();

  if (textarea.value.trim()) form.append('text', textarea.value);
  if (fileInput.files[0]) form.append('file', fileInput.files[0]);

  if (!form.has('text') && !form.has('file')) return alert("Select a file or paste text.");

  ingestBtn.disabled = true;
  ingestBtn.textContent = 'Ingesting...';

  try {
    const res = await fetch('/api/ingest', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();
    alert(`Ingested ${d.chunks_added} chunks.`);
    textarea.value = '';
    fileInput.value = '';
    refreshStatus();
  } catch (e) { alert(e.message); }
  finally { ingestBtn.disabled = false; ingestBtn.textContent = 'Ingest Document'; }
});

// Clear DB Logic
clearBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear the entire database?')) return;
  try {
    const res = await fetch('/api/ingest', { method: 'DELETE' });
    if (res.ok) {
      alert('Database cleared.');
      refreshStatus();
      chunksList.innerHTML = '';
      answerArea.innerHTML = '';
    }
  } catch (e) { alert('Error clearing DB'); }
});

// Status Check
async function refreshStatus() {
  try {
    const r = await fetch('/api/status');
    const s = await r.json();
    if (s.ingested) {
      statusEl.textContent = 'Online (Data Ready)';
      statusEl.style.color = '#60a5fa';
      statusEl.style.borderColor = 'rgba(59,130,246,0.3)';
    } else {
      statusEl.textContent = 'Empty Database';
      statusEl.style.color = '#fbbf24'; // amber
      statusEl.style.borderColor = 'rgba(251,191,36,0.3)';
    }
  } catch (e) { statusEl.textContent = 'Offline'; }
}

refreshStatus();
