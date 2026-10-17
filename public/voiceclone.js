// Voice cloning page.
const $ = (id) => document.getElementById(id);
const MIN_SECONDS = 20, MAX_SECONDS = 300, MAX_BYTES = 15 * 1024 * 1024;
let acct = null, busy = false, file = null, seconds = 0, statusKey = null, statusRaw = null, statusErr = false;

async function headers() {
  const s = await Auth.session();
  if (!s) { location.replace('/login'); throw new Error('login'); }
  return { Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' };
}
function errText(j, fallback) {
  if (j && j.code && T.en['err.' + j.code]) return t('err.' + j.code);
  return (j && j.error) || fallback;
}
function setStatus(key, isErr, raw) {
  statusKey = key || null; statusRaw = raw || null; statusErr = !!isErr;
  $('status').textContent = raw || (key ? t(key) : '');
  $('status').className = isErr ? 'err' : '';
}
async function call(path, method, body) {
  const r = await fetch(path, { method, headers: await headers(), body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { await Auth.signOut(); location.replace('/login'); throw new Error('login'); }
  if (!r.ok) throw new Error(errText(j, t('err.design_failed')));
  return j;
}

function renderTrial(left, plan) {
  const el = $('trial');
  if (left == null) { el.hidden = true; return; }
  el.hidden = false;
  const out = left <= 0;
  el.className = 'pill' + (out ? ' out' : '');
  const m = Math.round((left / 900) * 10) / 10;
  const pk = { starter: 's', creator: 'c', pro: 'p', business: 'b' }[plan];
  if (pk) el.textContent = out ? t('err.credits_over') : t('app.plan', { plan: t('price.' + pk + '.n'), m: String(m) });
  else el.textContent = out ? t('app.trial.over') : t('app.trial', { m: String(m) });
}
async function loadMe() {
  try {
    const me = await call('/api/me', 'GET');
    $('who').textContent = me.email || ''; $('who').hidden = !me.email;
    renderTrial(me.trialChars, me.plan);
  } catch (e) {}
}

function renderMine() {
  if (!acct) return;
  $('paidBox').hidden = acct.canDesign;
  $('cloneBox').hidden = !acct.canDesign;
  $('mineBox').hidden = !acct.canDesign;
  $('mineTitle').textContent = t('vd.mine', { n: String(acct.voices.length), m: String(acct.max) });
  const box = $('mlist');
  box.textContent = '';
  if (!acct.voices.length) {
    const p = document.createElement('p'); p.className = 'meta'; p.textContent = t('vd.none'); box.appendChild(p);
    return;
  }
  acct.voices.forEach((v) => {
    const row = document.createElement('div'); row.className = 'mitem';
    const mt = document.createElement('div'); mt.className = 'mt';
    const n = document.createElement('strong'); n.textContent = v.name; n.dir = 'auto';
    const d = document.createElement('span'); d.textContent = v.kind === 'clone' ? t('vc.tag') : (v.description.length > 90 ? v.description.slice(0, 90) + '…' : v.description); d.dir = 'auto';
    mt.append(n, d);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pbtn'; b.textContent = t('hist.delete');
    b.onclick = async () => {
      if (!b.dataset.sure) {
        b.dataset.sure = '1'; b.textContent = t('hist.sure'); b.classList.add('danger');
        setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = t('hist.delete'); b.classList.remove('danger'); } }, 4000);
        return;
      }
      b.disabled = true;
      try { await call('/api/my-voices?id=' + encodeURIComponent(v.id), 'DELETE'); await loadVoices(); }
      catch (e) { b.disabled = false; if (e.message !== 'login') setStatus(null, true, e.message); }
    };
    row.append(mt, b);
    box.appendChild(row);
  });
}
async function loadVoices() {
  try { acct = await call('/api/my-voices', 'GET'); renderMine(); }
  catch (e) { if (e.message !== 'login') setStatus(null, true, e.message); }
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
function updateGo() { $('go').disabled = busy || !file || !$('consent').checked || !$('vname').value.trim(); }
function renderInfo() {
  $('fileInfo').textContent = file ? file.name + ' — ' + t('vc.len', { s: String(Math.round(seconds)) }) : '';
}
$('pick').onclick = () => $('file').click();
$('file').onchange = async () => {
  const f = $('file').files[0];
  file = null; seconds = 0; renderInfo(); updateGo(); setStatus(null); Recorder.clear();
  if (!f) return;
  if (f.size > MAX_BYTES) { setStatus('err.clone_big', true); return; }
  try { seconds = await readDuration(f); } catch (e) { setStatus('err.clone_bad', true); return; }
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) { seconds = 0; setStatus('err.clone_short', true); return; }
  file = f; renderInfo(); updateGo();
};
Recorder.init({
  pickBtn: $('pick'), maxSeconds: MAX_SECONDS,
  onStart() { file = null; seconds = 0; $('file').value = ''; renderInfo(); updateGo(); setStatus(null); },
  onDone(f, secs) {
    if (f.size > MAX_BYTES) { setStatus('err.clone_big', true); return; }
    if (secs < MIN_SECONDS) { setStatus('err.clone_short', true); return; }
    file = f; seconds = secs; renderInfo(); updateGo();
  },
  onError(key) { setStatus(key, true); },
});
$('consent').onchange = updateGo;
$('vname').oninput = updateGo;
$('go').onclick = async () => {
  if (busy || !file) return;
  busy = true; updateGo(); Busy.start($('go'), 'clone'); setStatus('vc.working');
  try {
    const h = await headers();
    h['Content-Type'] = file.type || 'application/octet-stream';
    h['X-Duration'] = String(seconds);
    h['X-Consent'] = $('consent').checked ? 'yes' : 'no';
    h['X-Voice-Name'] = encodeURIComponent($('vname').value.trim());
    const r = await fetch('/api/voice-clone', { method: 'POST', headers: h, body: file });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (!r.ok) throw new Error(errText(j, t('err.clone_failed')));
    setStatus('vc.done');
    file = null; seconds = 0; $('file').value = ''; Recorder.clear(); $('vname').value = ''; $('consent').checked = false; renderInfo();
    await loadVoices();
  } catch (e) { if (e.message !== 'login') setStatus(null, true, e.message === 'Failed to fetch' ? t('err.clone_failed') : e.message); }
  finally { busy = false; Busy.stop($('go')); updateGo(); }
};

document.addEventListener('langchange', () => {
  renderMine(); renderInfo();
  if (statusKey) setStatus(statusKey, statusErr); else if (statusRaw) setStatus(null, statusErr, statusRaw);
});

(async function init() {
  initLang();
  let config = {};
  try { config = await getConfig(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  if (!config.designOn) return location.replace('/app');
  if (!(await Auth.session())) return location.replace('/login');
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  loadMe();
  loadVoices();
})();
