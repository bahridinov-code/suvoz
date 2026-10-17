// Speech to text page.
const $ = (id) => document.getElementById(id);
const MAX_BYTES = 60 * 1024 * 1024, MAX_SECONDS = 30 * 60, CHARS_PER_SECOND = 3.75;
let file = null, seconds = 0, busy = false, trialChars = null, plan = 'free', statusKey = null;

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

function readDuration(f) {
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(f);
    const a = document.createElement('audio');
    a.preload = 'metadata';
    const done = (fn) => (v) => { URL.revokeObjectURL(u); fn(v); };
    a.onloadedmetadata = () => (isFinite(a.duration) && a.duration > 0 ? done(ok)(a.duration) : done(no)());
    a.onerror = () => done(no)();
    a.src = u;
  });
}

function renderInfo() {
  const el = $('fileInfo');
  if (!file || !seconds) { el.textContent = ''; return; }
  const cost = Math.max(1, Math.ceil(seconds * CHARS_PER_SECOND)) / 900;
  el.textContent = file.name + ' — ' + t('stt.cost', { a: mins(seconds / 60), c: mins(cost) });
}

function formatText(segments) {
  const speakers = new Set(segments.map((s) => s.speaker));
  if (speakers.size <= 1) return segments.map((s) => s.text).join('\n\n');
  return segments.map((s) => t('stt.speaker', { n: String(s.speaker) }) + ': ' + s.text).join('\n');
}
let lastSegments = null;
function showResult() {
  if (!lastSegments) return;
  $('out').value = formatText(lastSegments);
}

$('pick').onclick = () => $('file').click();
$('file').onchange = async () => {
  const f = $('file').files[0];
  file = null; seconds = 0; $('go').disabled = true; $('result').hidden = true; lastSegments = null;
  setStatus(null); renderInfo(); Recorder.clear();
  if (!f) return;
  if (f.size > MAX_BYTES) { setStatus('err.stt_big', true); return; }
  try { seconds = await readDuration(f); } catch (e) { setStatus('err.stt_bad', true); return; }
  if (seconds > MAX_SECONDS) { seconds = 0; setStatus('err.stt_long', true); return; }
  file = f;
  renderInfo();
  $('go').disabled = false;
};
Recorder.init({
  pickBtn: $('pick'), maxSeconds: MAX_SECONDS,
  onStart() { file = null; seconds = 0; $('file').value = ''; $('go').disabled = true; $('result').hidden = true; lastSegments = null; setStatus(null); renderInfo(); },
  onDone(f, secs) {
    if (f.size > MAX_BYTES) { setStatus('err.stt_big', true); return; }
    file = f; seconds = secs; renderInfo(); $('go').disabled = false;
  },
  onError(key) { setStatus(key, true); },
});

$('go').onclick = async () => {
  if (!file || busy) return;
  busy = true; $('go').disabled = true; $('result').hidden = true;
  setStatus('stt.working');
  try {
    const h = await headers();
    h['Content-Type'] = file.type || 'application/octet-stream';
    h['X-Duration'] = String(seconds);
    const r = await fetch('/api/transcribe', { method: 'POST', headers: h, body: file });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (!r.ok) throw new Error(errText(j, t('err.stt_failed')));
    lastSegments = j.segments || [];
    showResult();
    $('result').hidden = false;
    setStatus(null);
    loadMe();
  } catch (e) {
    if (e.message !== 'login') setStatus(null, true, e.message === 'Failed to fetch' ? t('err.stt_failed') : e.message);
  } finally {
    busy = false; $('go').disabled = !file;
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
  a.download = 'suvoz-text.txt';
  document.body.appendChild(a); a.click(); a.remove();
};
$('tr').onclick = () => {
  try { sessionStorage.setItem('suvoz_translate', $('out').value); } catch (e) {}
  location.href = '/translate';
};
$('use').onclick = () => {
  try { sessionStorage.setItem('suvoz_reuse', $('out').value); } catch (e) {}
  location.href = '/dialogue';
};

document.addEventListener('langchange', () => {
  renderInfo(); renderTrial();
  if (statusKey) setStatus(statusKey, $('status').className === 'err');
  if (lastSegments && !$('result').hidden) showResult();
});

(async function init() {
  initLang();
  let config = {};
  try { config = await (await fetch('/api/config')).json(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  if (!(await Auth.session())) return location.replace('/login');
  $('tr').hidden = !config.translateOn;
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  loadMe();
})();
