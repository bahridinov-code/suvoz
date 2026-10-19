// Email links can land on the home page; pass them on to where they belong.
if (/access_token=|error_code=/.test(location.hash)) {
  location.replace((/type=recovery/.test(location.hash) ? '/login' : '/app') + location.hash);
}

// Landing page: language setup + the waveform in the hero card.
function buildWave() {
  const wave = document.getElementById('wave');
  if (!wave) return;
  const narrow = window.innerWidth <= 560;
  const per = narrow ? 5 : 7;          // bar width + gap
  const gapW = narrow ? 9 : 14;        // pause between speakers
  const width = wave.clientWidth || 600;
  const total = Math.max(18, Math.floor((width - gapW * 2) / per));
  const lens = [1, 2, 3].map((n) => t('demo.t' + n).length);
  const sum = lens.reduce((a, b) => a + b, 0);
  const counts = lens.map((l) => Math.max(5, Math.round((l / sum) * total)));
  const who = ['a', 'b', 'a'];
  wave.textContent = '';
  let idx = 0;
  counts.forEach((n, seg) => {
    for (let i = 0; i < n; i++) {
      const env = Math.sin((Math.PI * (i + 0.5)) / n) * 0.55 + 0.45;       // soft start and end
      const wob = Math.abs(Math.sin(i * 1.7 + seg * 2.3) * Math.cos(i * 0.61 + seg));
      const h = Math.max(12, Math.min(100, (22 + wob * 78) * env));
      const s = document.createElement('span');
      s.className = who[seg];
      s.style.setProperty('--h', h.toFixed(0));
      s.style.setProperty('--i', idx++);
      wave.appendChild(s);
    }
    if (seg < counts.length - 1) {
      const g = document.createElement('span');
      g.className = 'gap';
      g.style.width = gapW + 'px';
      wave.appendChild(g);
    }
  });
}

document.getElementById('year').textContent = new Date().getFullYear();
document.addEventListener('langchange', buildWave);
initLang();
let rz;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(buildWave, 150); });

// If the visitor is already logged in, do not show "Log in" again: show the way back to the tools and a log-out button.
(async function () {
  const root = document.documentElement;
  const nav = (inn) => {
    const login = document.querySelector('.top-right a.login');
    if (login) login.hidden = inn;
    document.querySelectorAll('a[data-i18n="nav.signup"], a[data-i18n="nav.tools"], a[data-i18n="hero.cta1"]').forEach((a) => {
      if (!a.dataset.h0) a.dataset.h0 = a.getAttribute('href') || '';
      a.href = inn ? '/app' : a.dataset.h0;
      if (a.dataset.i18n === 'nav.signup' || a.dataset.i18n === 'nav.tools') a.dataset.i18n = inn ? 'nav.tools' : 'nav.signup';
    });
    applyLang(currentLang);
  };
  // Logged in on this browser: switch the top buttons right away (no waiting for the network), then check quietly.
  const cached = Auth.peek && Auth.peek();
  if (cached && cached.access_token) { nav(true); root.classList.remove('pre'); }
  try {
    const c = await getConfig();
    if (!c.authOn) { if (cached) nav(false); root.classList.remove('in', 'pre'); root.classList.add('out'); return; }
    const s = await Auth.session();
    if (!s) { if (cached) nav(false); root.classList.remove('in', 'pre'); root.classList.add('out'); return; }
    if (!cached) nav(true);
    root.classList.remove('pre');
    // Show which plan the visitor has now.
    try {
      const me = await (await fetch('/api/me', { headers: { Authorization: 'Bearer ' + s.access_token } })).json();
      if (me.hadPlan) document.querySelectorAll('#pricing').forEach((x) => x.classList.add('no-first')); if (me.hadPlan) document.dispatchEvent(new Event('nofirst'));   // first-month discount is for first plan only
      const keys = ['free', 'starter', 'creator', 'pro', 'business'];
      const idx = keys.indexOf(me.plan || 'free');
      const cards = document.querySelectorAll('#pricing .plan');
      if (idx >= 0 && cards[idx]) {
        const paid = idx > 0;
        if (paid && cards[0]) cards[0].hidden = true;   // the Free card is only for people without a plan
        cards.forEach((card, i) => {
          const a = card.querySelector('a.btn');
          if (!a || i > 4) return;
          if (i === idx) {
            card.classList.add('current');
            const span = document.createElement('span');
            span.className = 'btn small ghost cur'; span.dataset.i18n = 'price.current';
            a.replaceWith(span);
          } else if (paid && i > 0) {
            a.dataset.i18n = 'price.change'; a.dataset.plan = keys[i]; a.href = '/plans?plan=' + keys[i]; a.onclick = null;   // changing a plan happens on the Plans page
          }
        });
      }
    } catch (e) {}
    applyLang(currentLang);
  } catch (e) {}
})();

// ---- Home page life: tool cards, reveal on scroll ----
document.documentElement.classList.add('js');
const HOME_ICONS = {
  dialogue: '<path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M19 9h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v3l-3-3h-4"/>',
  story: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5c2.5-1.5 5.5-1.5 8 0V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/>',
  sound: '<path d="M4 10v4"/><path d="M8 7v10"/><path d="M12 4v16"/><path d="M16 8v8"/><path d="M20 11v2"/>',
  stt: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  translate: '<path d="M4 6h9"/><path d="M8.5 4v2c0 4-2 7-5 8"/><path d="M6 10c1 2 3 4 6 5"/><path d="M13 20l4-9 4 9"/><path d="M14.5 17h5"/>',
  design: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>',
  clone: '<circle cx="9" cy="9" r="4"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M17 6.5a4 4 0 0 1 0 5"/><path d="M19.5 4a7.5 7.5 0 0 1 0 10"/>',
  dub: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4-2.5z"/>',
};
const HOME_TOOLS = [
  { id: 'dialogue', c: 'indigo' }, { id: 'story', c: 'teal' }, { id: 'sound', c: 'amber', hl: true }, { id: 'stt', c: 'rose' },
  { id: 'translate', c: 'teal' }, { id: 'design', c: 'indigo' }, { id: 'clone', c: 'teal' }, { id: 'dub', c: 'gray', soon: true },
];
function buildHomeTiles() {
  const box = document.getElementById('homeTiles');
  if (!box) return;
  box.textContent = '';
  HOME_TOOLS.forEach((x, i) => {
    const el = document.createElement(x.soon ? 'div' : 'a');
    el.className = 'tile rv c-' + x.c + (x.soon ? ' soon' : '');
    el.style.setProperty('--d', (i % 4) * 0.07 + 's');
    if (!x.soon) el.href = '/app';
    const ic = document.createElement('span'); ic.className = 'ticon';
    ic.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + HOME_ICONS[x.id] + '</svg>';
    const b = document.createElement('span'); b.className = 'tbody';
    const h = document.createElement('strong'); h.textContent = t('hub.' + x.id);
    const p = document.createElement('span'); p.textContent = t('hub.' + x.id + '.d'); p.dataset.hl = '1';
    b.append(h, p); el.append(ic, b);
    if (x.soon) { const s = document.createElement('em'); s.className = 'badge'; s.textContent = t('hub.soon'); el.append(s); }
    box.appendChild(el);
  });
  if (window.hlRun) hlRun(box);
  observeReveal(box);
}
let revealIO = null;
function observeReveal(root) {
  if (!('IntersectionObserver' in window)) { (root || document).querySelectorAll('.rv').forEach((e) => e.classList.add('in')); return; }
  revealIO = revealIO || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const el = e.target; el.classList.add('in'); revealIO.unobserve(el); setTimeout(() => el.classList.remove('rv', 'in'), 1100); } }), { threshold: 0.12 });
  (root || document).querySelectorAll('.rv:not(.in)').forEach((e) => revealIO.observe(e));
}
document.querySelectorAll('main section.wrap > *, .step, .feat, .plan, .faq details, .final').forEach((e, i) => {
  if (!e.classList.contains('rv')) { e.classList.add('rv'); e.style.setProperty('--d', (i % 4) * 0.06 + 's'); }
});
buildHomeTiles();
observeReveal(document);
document.addEventListener('langchange', buildHomeTiles);
