// Start page: pick what you want to create.
const $ = (id) => document.getElementById(id);
let trialChars = null, plan = 'free';

// Tools that work today, then ones that are coming.
const ICONS = {
  dialogue: '<path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M19 9h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v3l-3-3h-4"/>',
  story: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5c2.5-1.5 5.5-1.5 8 0V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0z"/><path d="M12 5.5V19"/>',
  sound: '<path d="M4 10v4"/><path d="M8 7v10"/><path d="M12 4v16"/><path d="M16 8v8"/><path d="M20 11v2"/>',
  stt: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  translate: '<path d="M4 6h9"/><path d="M8.5 4v2c0 4-2 7-5 8"/><path d="M6 10c1 2 3 4 6 5"/><path d="M13 20l4-9 4 9"/><path d="M14.5 17h5"/>',
  design: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/>',
  clone: '<circle cx="9" cy="9" r="4"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M17 6.5a4 4 0 0 1 0 5"/><path d="M19.5 4a7.5 7.5 0 0 1 0 10"/>',
  dub: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4-2.5z"/>',
};
const TOOLS = [
  { id: 'dialogue', color: 'indigo', href: '/dialogue', ex: 'hub.ex.dialogue' },
  { id: 'story', color: 'teal', href: '/dialogue', ex: 'hub.ex.story' },
  { id: 'sound', color: 'amber', href: '/dialogue', ex: 'hub.ex.sound' },
  { id: 'stt', color: 'rose', href: '/transcribe' },
  { id: 'history', color: 'gray', href: '/history', needsHistory: true },
  { id: 'translate', soon: true }, { id: 'design', soon: true }, { id: 'clone', soon: true }, { id: 'dub', soon: true },
];
let historyOn = true;

function tile(x) {
  const el = document.createElement(x.soon ? 'div' : 'a');
  el.className = 'tile' + (x.soon ? ' soon' : '') + ' c-' + (x.color || 'gray');
  if (!x.soon) {
    el.href = x.href;
    if (x.ex) el.onclick = () => { try { sessionStorage.setItem('suvoz_reuse', t(x.ex)); } catch (e) {} };
  }
  const ic = document.createElement('span');
  ic.className = 'ticon';
  ic.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[x.id] + '</svg>';
  const b = document.createElement('span');
  b.className = 'tbody';
  const h = document.createElement('strong');
  h.textContent = t('hub.' + x.id);
  const p = document.createElement('span');
  p.textContent = t('hub.' + x.id + '.d');
  b.append(h, p);
  el.append(ic, b);
  if (x.soon) {
    const s = document.createElement('em');
    s.className = 'badge';
    s.textContent = t('hub.soon');
    el.append(s);
  }
  return el;
}
function render() {
  const box = $('tiles');
  box.textContent = '';
  TOOLS.filter((x) => !x.needsHistory || historyOn).forEach((x) => box.appendChild(tile(x)));
  renderTrial();
}

function renderTrial() {
  const el = $('trial');
  if (trialChars === null) { el.hidden = true; return; }
  el.hidden = false;
  const out = trialChars <= 0;
  el.className = 'pill' + (out ? ' out' : '');
  const m = Math.round((trialChars / 900) * 10) / 10;
  const pk = { starter: 's', creator: 'c', pro: 'p', business: 'b' }[plan];
  if (pk) el.textContent = out ? t('err.credits_over') : t('app.plan', { plan: t('price.' + pk + '.n'), m: String(m) });
  else el.textContent = out ? t('app.trial.over') : t('app.trial', { m: String(m) });
}
async function loadMe() {
  try {
    const s = await Auth.session();
    if (!s) return;
    const r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + s.access_token } });
    const j = await r.json();
    if (!r.ok) return;
    plan = j.plan || 'free';
    trialChars = j.trialChars;
    $('who').textContent = j.email || '';
    $('who').hidden = !j.email;
    renderTrial();
  } catch (e) {}
}

document.addEventListener('langchange', render);

(async function init() {
  initLang();
  // Old links like /app?paid=1 or /app?plan=pro belong to the creation page.
  if (/[?&](plan|paid)=/.test(location.search)) return location.replace('/dialogue' + location.search + location.hash);
  let config = {};
  try { config = await (await fetch('/api/config')).json(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  historyOn = !!config.historyOn;
  $('historyLink').hidden = !historyOn;
  if (!(await Auth.session())) return location.replace('/login');
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  render();
  loadMe();
})();
