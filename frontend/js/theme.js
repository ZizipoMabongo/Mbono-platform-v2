// Theme switcher: three bright green themes, remembered in the browser. Colours are defined in css/theme.css.
(() => {
  const T = [['fresh', 'Fresh green', 'linear-gradient(135deg,#078754,#22e39a)'], ['meadow', 'Meadow', 'linear-gradient(135deg,#2a7d28,#a3e635)'], ['night', 'Emerald night', 'linear-gradient(135deg,#06291d,#34f0a1)']];
  const st = document.createElement('style');
  st.textContent = '#mbtheme{position:fixed;left:1rem;bottom:1rem;z-index:45;display:flex;gap:.45rem;align-items:center;background:var(--card,#f1fdf6);border:1px solid var(--line,#9fe0bd);border-radius:99px;padding:.35rem .6rem;box-shadow:0 6px 18px rgba(5,85,58,.25);font:600 .72rem system-ui,sans-serif;color:var(--mut,#2f6a50)}#mbtheme button{width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}#mbtheme button.on{border-color:var(--ink,#06301f);box-shadow:0 0 0 2px var(--card,#fff)}';
  document.head.append(st);
  const root = document.createElement('div'); root.id = 'mbtheme'; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Theme');
  const set = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('mbono_theme', t); } catch (e) {} root.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); };
  root.innerHTML = 'Theme' + T.map(t => `<button data-t="${t[0]}" title="${t[1]}" aria-label="${t[1]}" style="background:${t[2]}"></button>`).join('');
  root.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(b.dataset.t); });
  document.body.append(root); set(document.documentElement.dataset.theme || 'fresh');
})();
