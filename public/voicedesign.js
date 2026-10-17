// Voice design page.
const $ = (id) => document.getElementById(id);
const EXAMPLES = [
  'A calm old man with a deep voice and a British accent, speaking slowly.',
  'A cheerful young woman, energetic and friendly, with a clear American accent.',
  'A mysterious storyteller with a low, whispery voice and a dramatic pace.',
];
let acct = null, busy = false, lastDesc = '', statusKey = null, statusRaw = null, statusErr = false;

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
  $('designBox').hidden = !acct.canDesign;
  $('mineBox').hidden = !acct.canDesign;
  $('costNote').textContent = t('vd.cost', { c: String(Math.round(acct.cost * 100) / 100) });
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

function previewCard(p, i) {
  const card = document.createElement('div'); card.className = 'vcard';
  const a = document.createElement('audio'); a.controls = true; a.src = 'data:' + p.type + ';base64,' + p.audio;
  const row = document.createElement('div'); row.className = 'vrow2';
  const name = document.createElement('input'); name.className = 'field'; name.maxLength = 40; name.dir = 'auto';
  name.placeholder = t('vd.name'); name.setAttribute('aria-label', t('vd.name'));
  const save = document.createElement('button'); save.type = 'button'; save.className = 'pbtn'; save.textContent = t('vd.save');
  save.onclick = async () => {
    const nm = name.value.trim();
    if (!nm) { name.focus(); return; }
    save.disabled = true;
    try {
      await call('/api/voice-save', 'POST', { id: p.id, name: nm, description: lastDesc });
      save.textContent = '✓'; name.disabled = true;
      setStatus('vd.saved');
      await loadVoices();
    } catch (e) { save.disabled = false; if (e.message !== 'login') setStatus(null, true, e.message); }
  };
  row.append(name, save);
  card.append(a, row);
  return card;
}

function updateGo() { $('go').disabled = busy || $('desc').value.trim().length < 20; }
$('desc').oninput = () => { $('dcount').textContent = String($('desc').value.length); updateGo(); };
EXAMPLES.forEach((x) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = x;
  b.onclick = () => { $('desc').value = x; $('desc').oninput(); };
  $('chips').appendChild(b);
});
$('go').onclick = async () => {
  if (busy) return;
  busy = true; updateGo(); Busy.start($('go'), 'design'); $('previews').hidden = true; setStatus('vd.working');
  try {
    const j = await call('/api/voice-design', 'POST', { description: $('desc').value });
    lastDesc = j.description || $('desc').value.trim();
    const list = $('plist'); list.textContent = '';
    j.previews.forEach((p, i) => list.appendChild(previewCard(p, i)));
    $('previews').hidden = false;
    setStatus(null);
    loadMe();
  } catch (e) { if (e.message !== 'login') setStatus(null, true, e.message === 'Failed to fetch' ? t('err.design_failed') : e.message); }
  finally { busy = false; Busy.stop($('go')); updateGo(); }
};

document.addEventListener('langchange', () => {
  renderMine();
  if (statusKey) setStatus(statusKey, statusErr); else if (statusRaw) setStatus(null, statusErr, statusRaw);
});

(async function init() {
  initLang();
  let config = {};
  try { config = await (await fetch('/api/config')).json(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  if (!config.designOn) return location.replace('/app');
  if (!(await Auth.session())) return location.replace('/login');
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  loadMe();
  loadVoices();
})();
