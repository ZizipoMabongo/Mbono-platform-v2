// Background watermark video on every page. It drifts across the whole page at low opacity.
// To change it, replace img/hero/hero.mp4 (and hero.webm, used by browsers without H.264).
window.addEventListener('load', () => {
  if (document.querySelector('.mbwm')) return; // another script already added it
  const st = document.createElement('style');
  st.textContent = '.mbwm{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:var(--wm-op,.1);mix-blend-mode:var(--wm-blend,multiply);pointer-events:none;z-index:4}@media (prefers-reduced-motion:reduce){.mbwm{display:none}}';
  const v = document.createElement('video');
  v.className = 'mbwm'; v.muted = v.loop = v.playsInline = v.autoplay = true; v.setAttribute('aria-hidden', 'true');
  v.innerHTML = '<source src="img/hero/hero.mp4" type="video/mp4"><source src="img/hero/hero.webm" type="video/webm">';
  document.head.append(st); document.body.append(v); v.play().catch(() => {});
});
