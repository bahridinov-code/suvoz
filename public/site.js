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
  try {
    const c = await (await fetch('/api/config')).json();
    if (!c.authOn) return;
    const s = await Auth.session();
    if (!s) return;
    const login = document.querySelector('.top-right a.login');
    if (login) login.hidden = true;
    document.querySelectorAll('a[data-i18n="nav.try"], a[data-i18n="hero.cta1"]').forEach((a) => { a.dataset.i18n = 'nav.tools'; a.href = '/app'; });
    const right = document.querySelector('.top-right');
    if (right && !document.getElementById('logout')) {
      const b = document.createElement('button');
      b.id = 'logout'; b.type = 'button'; b.className = 'pbtn'; b.dataset.i18n = 'app.logout';
      b.onclick = async () => { await Auth.signOut(); location.reload(); };
      right.appendChild(b);
    }
    applyLang(currentLang);
  } catch (e) {}
})();
