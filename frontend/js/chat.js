// Chatbot widget: vacancies, applying, CV upload, interviews, application status and data questions.
(() => {
  const st = document.createElement('style');
  st.textContent = `#mbchat{position:fixed;right:1.1rem;bottom:1.1rem;z-index:45;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
  .cb{display:flex;align-items:center;gap:.5rem;background:var(--brand,#14573f);color:var(--btnink,#fff);border:0;border-radius:99px;padding:.8rem 1.1rem;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 8px 22px rgba(15,74,51,.4)}.cb:hover{filter:brightness(1.1)}
  .cw{width:340px;max-width:calc(100vw - 2rem);height:480px;max-height:calc(100vh - 2rem);background:var(--card,#fff);border-radius:18px;box-shadow:0 16px 44px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line,#d6e2d9)}
  .ch{display:flex;justify-content:space-between;align-items:center;background:var(--brand,#14573f);color:var(--btnink,#fff);padding:.8rem 1rem}.ch button{background:none;border:0;color:inherit;font-size:1.4rem;line-height:1;cursor:pointer}
  .cm{flex:1;overflow:auto;padding:.8rem;display:flex;flex-direction:column;gap:.5rem;background:var(--bg,#f6f9f7)}
  .cm div{max-width:86%;padding:.55rem .75rem;border-radius:14px;white-space:pre-wrap}.cm .bot{background:var(--card,#fff);color:var(--ink,#16231d);border:1px solid var(--line,#d6e2d9);align-self:flex-start}.cm .me{background:var(--brand,#14573f);color:var(--btnink,#fff);align-self:flex-end}
  .cq{display:flex;gap:.35rem;flex-wrap:wrap;padding:.5rem .7rem 0;background:var(--bg,#f6f9f7)}.cq button{background:var(--sage,#e6efe7);border:0;border-radius:99px;padding:.25rem .6rem;font:inherit;font-size:.78rem;color:var(--chipink,#0f4a33);cursor:pointer}
  #cf{display:flex;gap:.4rem;padding:.6rem;background:var(--bg,#f6f9f7)}#cf input{flex:1;border:1px solid var(--sage2,#cfdfd2);border-radius:10px;padding:.5rem .65rem;font:inherit;background:var(--field,#fff);color:var(--ink,#16231d)}#cf button{background:var(--brand,#14573f);color:var(--btnink,#fff);border:0;border-radius:10px;padding:0 .9rem;font:inherit;font-weight:700;cursor:pointer}`;
  document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'mbchat'; document.body.appendChild(root);
  const QUICK = ['What vacancies are open?', 'Where is my application?', 'How do I upload my CV?', 'How do I apply?'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let open = false, busy = false, msgs = [{ r: 'bot', t: 'Hi! I can help with vacancies, applying, your CV and your application status. What would you like to know?' }];
  function draw() {
    root.innerHTML = open ? `<div class="cw" role="dialog" aria-label="Chat with Mbono"><div class="ch"><b>Ask Mbono</b><button data-x aria-label="Close chat">×</button></div>
      <div class="cm" id="cm">${msgs.map(m => `<div class="${m.r}">${esc(m.t)}</div>`).join('')}</div>
      <div class="cq">${QUICK.map(q => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <form id="cf"><input id="ci" placeholder="Type your question" maxlength="500" autocomplete="off"><button>Send</button></form></div>`
      : '<button class="cb" data-o aria-label="Open chat"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>Ask Mbono</button>';
    const m = root.querySelector('#cm'); if (m) m.scrollTop = m.scrollHeight;
    const i = root.querySelector('#ci'); if (i) i.focus();
  }
  async function send(q) {
    if (!q || busy) return; busy = true; msgs.push({ r: 'me', t: q }, { r: 'bot', t: '…' }); draw();
    let t = null; try { t = localStorage.getItem('mbono_token'); } catch (e) {}
    try {
      const r = await fetch(API + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify({ message: q }) });
      const j = await r.json().catch(() => ({})); msgs[msgs.length - 1].t = r.ok ? j.reply : (j.error || 'Sorry, something went wrong.');
    } catch (e) { msgs[msgs.length - 1].t = 'Sorry, I could not reach the server.'; }
    busy = false; draw();
  }
  root.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.o !== undefined) { open = true; draw(); } if (t.dataset.x !== undefined) { open = false; draw(); } if (t.dataset.q) send(t.dataset.q); });
  root.addEventListener('submit', e => { e.preventDefault(); const i = root.querySelector('#ci'), v = i.value.trim(); i.value = ''; send(v); });
  draw();
})();
