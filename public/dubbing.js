// Dubbing page.
const $ = (id) => document.getElementById(id);
const DUB_LANGS = [['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['it','Italiano'],['pt','Português'],['ru','Русский'],['ar','العربية'],['zh','中文'],['ja','日本語'],['ko','한국어'],['hi','हिन्दी'],['tr','Türkçe'],['uz','Oʻzbekcha'],['tg','Тоҷикӣ'],['fa','فارسی'],['kk','Қазақша'],['az','Azərbaycanca'],['pl','Polski'],['nl','Nederlands'],['uk','Українська'],['id','Bahasa Indonesia'],['vi','Tiếng Việt'],['th','ไทย'],['he','עברית']];
let acct = null, file = null, seconds = 0, busy = false, timer = null, statusKey = null, statusRaw = null, statusErr = false;
const blobs = {}, texts = {};

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
  statusKey = key || null; statusRaw = raw || null; statusErr = !!isErr;
  $('status').textContent = raw || (key ? t(key) : '');
  $('status').className = isErr ? 'err' : '';
}
async function api(path, method, body, extra) {
  const h = { ...(await headers()), ...(extra || {}) };
  const r = await fetch(path, { method: method || 'GET', headers: h, body });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { await Auth.signOut(); location.replace('/login'); throw new Error('login'); }
  if (!r.ok) throw new Error(errText(j, t('err.dub_failed')));
  return j;
}
const fmtMin = (x) => String(Math.max(0.1, Math.round(x * 10) / 10));
function cost(sec, kind) { return Math.max(1, Math.ceil(sec * acct.rates[kind] * 15)) / 900; }

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

function renderForm() {
  if (!acct) return;
  $('paidBox').hidden = acct.canDub;
  $('dubBox').hidden = !acct.canDub;
  $('mineBox').hidden = !acct.canDub;
  $('stdD').textContent = t('dub.std.d', { r: String(acct.rates.standard) });
  $('premD').textContent = t('dub.prem.d', { r: String(acct.rates.premium) });
  const kind = document.querySelector('input[name=q]:checked').value;
  $('costInfo').textContent = file && seconds ? t('dub.cost', { a: fmtMin(seconds / 60), c: fmtMin(cost(seconds, kind)) }) : '';
  $('fileInfo').textContent = file ? file.name : '';
  $('go').disabled = busy || !file;
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

async function audioUrl(id) {
  if (blobs[id]) return blobs[id];
  const r = await fetch('/api/history/audio?id=' + encodeURIComponent(id), { headers: await headers() });
  if (!r.ok) throw new Error(t('hist.err.audio'));
  blobs[id] = URL.createObjectURL(await r.blob());
  return blobs[id];
}
async function loadTexts() {
  try {
    const j = await api('/api/history');
    (j.items || []).forEach((it) => { texts[it.id] = it.script; });
  } catch (e) {}
}

function renderJobs() {
  const box = $('jobs');
  box.textContent = '';
  if (!acct || !acct.jobs.length) {
    const p = document.createElement('p'); p.className = 'meta'; p.textContent = t('dub.none'); box.appendChild(p);
    return;
  }
  acct.jobs.forEach((j) => {
    const el = document.createElement('div'); el.className = 'job';
    const head = document.createElement('div'); head.className = 'jh';
    const lang = (DUB_LANGS.find((x) => x[0] === j.target) || [j.target, j.target])[1];
    const a = document.createElement('span'); a.textContent = lang + ' · ' + t('dub.' + (j.kind === 'premium' ? 'prem' : 'std')) + ' · ' + fmtMin(j.seconds / 60) + ' ' + t('hist.min', { m: '' }).trim();
    const b = document.createElement('span');
    b.textContent = t('dub.st.' + j.status);
    if (j.status === 'failed') b.style.color = 'var(--err)';
    head.append(a, b);
    el.appendChild(head);
    if (j.status === 'done' && j.historyId) {
      const au = document.createElement('audio'); au.controls = true; au.preload = 'none';
      audioUrl(j.historyId).then((u) => { au.src = u; }).catch(() => {});
      el.appendChild(au);
      if (texts[j.historyId]) {
        const tx = document.createElement('div'); tx.className = 'jtext'; tx.dir = 'auto'; tx.textContent = texts[j.historyId]; el.appendChild(tx);
      }
      const act = document.createElement('div'); act.className = 'hact';
      const dl = document.createElement('button'); dl.type = 'button'; dl.className = 'pbtn'; dl.textContent = t('hist.download');
      dl.onclick = async () => {
        try { const x = document.createElement('a'); x.href = await audioUrl(j.historyId); x.download = 'suvoz-dub-' + j.target + '.mp3'; document.body.appendChild(x); x.click(); x.remove(); } catch (e) {}
      };
      act.appendChild(dl);
      el.appendChild(act);
    }
    box.appendChild(el);
  });
}

async function refresh() {
  try {
    acct = await api('/api/dub');
    if (acct.jobs.some((j) => j.status === 'done' && !texts[j.historyId])) await loadTexts();
    renderTrial(acct.left, acct.plan);
    renderForm();
    renderJobs();
    clearTimeout(timer);
    if (acct.jobs.some((j) => j.status === 'processing')) timer = setTimeout(refresh, 6000);
  } catch (e) { if (e.message !== 'login') setStatus(null, true, e.message); }
}

$('pick').onclick = () => $('file').click();
$('file').onchange = async () => {
  const f = $('file').files[0];
  file = null; seconds = 0; setStatus(null); renderForm();
  if (!f) return;
  if (f.size > acct.maxMB * 1048576) { setStatus('err.dub_big', true); return; }
  try { seconds = await readDuration(f); } catch (e) { setStatus('err.dub_bad', true); return; }
  if (seconds < 10 || seconds > acct.maxSeconds) { seconds = 0; setStatus('err.dub_length', true); return; }
  file = f; renderForm();
};
document.querySelectorAll('input[name=q]').forEach((r) => { r.onchange = renderForm; });
DUB_LANGS.forEach(([c, n]) => { const o = document.createElement('option'); o.value = c; o.textContent = n; $('lang').appendChild(o); });
try { $('lang').value = ({ en: 'es', ru: 'en', ar: 'en', tg: 'ru', uz: 'ru' })[currentLang] || 'es'; } catch (e) {}

$('go').onclick = async () => {
  if (busy || !file) return;
  busy = true; renderForm(); Busy.start($('go'), 'dub'); setStatus('dub.working');
  try {
    const kind = document.querySelector('input[name=q]:checked').value;
    await api('/api/dub-start', 'POST', file, {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Duration': String(seconds), 'X-Quality': kind, 'X-Target': $('lang').value,
    });
    setStatus('dub.started');
    file = null; seconds = 0; $('file').value = '';
    await refresh();
  } catch (e) { if (e.message !== 'login') setStatus(null, true, e.message === 'Failed to fetch' ? t('err.dub_failed') : e.message); }
  finally { busy = false; Busy.stop($('go')); renderForm(); }
};

document.addEventListener('langchange', () => {
  renderForm(); renderJobs(); renderTrial(acct && acct.left, acct && acct.plan);
  if (statusKey) setStatus(statusKey, statusErr); else if (statusRaw) setStatus(null, statusErr, statusRaw);
});

(async function init() {
  initLang();
  let config = {};
  try { config = await getConfig(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  if (!config.dubOn) return location.replace('/app');
  if (!(await Auth.session())) return location.replace('/login');
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  try { const me = await api('/api/me'); $('who').textContent = me.email || ''; $('who').hidden = !me.email; } catch (e) {}
  refresh();
})();
