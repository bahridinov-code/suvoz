// Text translation page.
const $ = (id) => document.getElementById(id);
const TR_LANGS = [['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['it','Italiano'],['pt','Português'],['ru','Русский'],['ar','العربية'],['zh','中文'],['ja','日本語'],['ko','한국어'],['hi','हिन्दी'],['tr','Türkçe'],['uz','Oʻzbekcha'],['tg','Тоҷикӣ'],['fa','فارسی'],['kk','Қазақша'],['ky','Кыргызча'],['tk','Türkmençe'],['az','Azərbaycanca'],['pl','Polski'],['nl','Nederlands'],['uk','Українська'],['id','Bahasa Indonesia'],['vi','Tiếng Việt'],['th','ไทย'],['he','עברית']];
let ratio = 0.25, maxChars = 10000, busy = false, trialChars = null, plan = 'free', statusKey = null;

async function headers() {
  const s = await Auth.session();
  if (!s) { location.replace('/login'); throw new Error('login'); }
  return { Authorization: 'Bearer ' + s.access_token };
}
function errText(j, fallback) {
  if (j && j.code && T.en['err.' + j.code]) return t('err.' + j.code);
  return (j && j.error) || fallback;
}
function setStatus(key, isErr, raw) {
  statusKey = key || null;
  $('status').textContent = raw || (key ? t(key) : '');
  $('status').className = isErr ? 'err' : '';
}
function mins(n) { return String(Math.max(0.01, Math.round(n * 100) / 100)); }

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
    const r = await fetch('/api/me', { headers: await headers() });
    const j = await r.json();
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (!r.ok) return;
    plan = j.plan || 'free';
    trialChars = j.trialChars;
    $('who').textContent = j.email || '';
    $('who').hidden = !j.email;
    renderTrial();
  } catch (e) {}
}

function renderCount() {
  const n = $('src').value.trim().length;
  const over = n > maxChars;
  $('count').textContent = n ? t('tr.count', { n: String(n), max: String(maxChars), c: mins(Math.max(1, Math.ceil(n * ratio)) / 900) }) : '';
  $('count').className = 'meta' + (over ? ' err' : '');
  $('go').disabled = busy || !n || over;
}

$('src').oninput = () => { setStatus(null); renderCount(); };

$('go').onclick = async () => {
  if (busy) return;
  busy = true; renderCount(); $('result').hidden = true; Busy.start($('go'), 'tr');
  setStatus('tr.working');
  try {
    const h = await headers();
    h['Content-Type'] = 'application/json';
    const r = await fetch('/api/translate', { method: 'POST', headers: h, body: JSON.stringify({ text: $('src').value, target: $('lang').value }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (!r.ok) throw new Error(errText(j, t('err.tr_failed')));
    $('out').value = j.text || '';
    $('result').hidden = false;
    setStatus(null);
    loadMe();
  } catch (e) {
    if (e.message !== 'login') setStatus(null, true, e.message === 'Failed to fetch' ? t('err.tr_failed') : e.message);
  } finally {
    busy = false; Busy.stop($('go')); renderCount();
  }
};

$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('out').value); }
  catch (e) { $('out').select(); document.execCommand('copy'); }
  const b = $('copy'); b.textContent = t('stt.copied');
  setTimeout(() => { b.textContent = t('stt.copy'); }, 1500);
};
$('save').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([$('out').value], { type: 'text/plain;charset=utf-8' }));
  a.download = 'suvoz-translation.txt';
  document.body.appendChild(a); a.click(); a.remove();
};
$('use').onclick = () => {
  try { sessionStorage.setItem('suvoz_reuse', $('out').value); } catch (e) {}
  location.href = '/dialogue';
};

TR_LANGS.forEach(([c, n]) => { const o = document.createElement('option'); o.value = c; o.textContent = n; $('lang').appendChild(o); });
try { $('lang').value = ({ en: 'es', ru: 'en', ar: 'en', tg: 'ru', uz: 'ru' })[currentLang] || 'es'; } catch (e) {}

document.addEventListener('langchange', () => {
  renderCount(); renderTrial();
  if (statusKey) setStatus(statusKey, $('status').className === 'err');
});

(async function init() {
  initLang();
  let config = {};
  try { config = await (await fetch('/api/config')).json(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  if (!config.translateOn) return location.replace('/app');
  if (config.translateRatio) ratio = config.translateRatio;
  if (config.translateMax) maxChars = config.translateMax;
  if (!(await Auth.session())) return location.replace('/login');
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  try {
    const pre = sessionStorage.getItem('suvoz_translate');
    if (pre) { $('src').value = pre; sessionStorage.removeItem('suvoz_translate'); }
  } catch (e) {}
  renderCount();
  loadMe();
})();
