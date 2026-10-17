// Send feedback: bug, idea, question or anything else. Needs a login so we know who to answer.
const $ = (id) => document.getElementById(id);
let email = '', busy = false, sent = false;
const from = (new URLSearchParams(location.search).get('from') || '').slice(0, 120);

function setStatus(key, err) { const s = $('status'); s.textContent = key ? t(key) : ''; s.className = 'amsg' + (err ? ' err' : ''); }
function texts() {
  $('reply').textContent = email ? t('fb.reply', { e: email }) : '';
  $('thanksD').textContent = t('fb.thanks.d', { e: email });
}
async function submit(ev) {
  ev.preventDefault();
  if (busy) return;
  const message = $('msg').value.trim();
  if (message.length < 5) return setStatus('fb.short', true);
  const s = await Auth.session();
  if (!s) return location.replace('/login');
  busy = true; setStatus(null); $('send').disabled = true; Busy.start($('send'), 'send');
  try {
    const kind = document.querySelector('input[name=kind]:checked').value;
    const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ kind, message, page: from, lang: currentLang }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (r.status === 429) setStatus('fb.slow', true);
    else if (!r.ok) setStatus('fb.err', true);
    else { $('form').hidden = true; $('thanks').hidden = false; sent = true; texts(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  } catch (x) { setStatus('fb.err', true); }
  busy = false; Busy.stop($('send')); $('send').disabled = false;
}
$('form').addEventListener('submit', submit);
$('msg').addEventListener('input', () => setStatus(null));
$('again').onclick = () => { $('msg').value = ''; $('thanks').hidden = true; $('form').hidden = false; sent = false; $('msg').focus(); };
document.addEventListener('langchange', texts);
(async function init() {
  initLang();
  let cfg = {};
  try { cfg = await (await fetch('/api/config')).json(); } catch (x) {}
  if (!cfg.authOn) return location.replace('/');
  Auth.takeHash();
  const s = await Auth.session();
  if (!s) return location.replace('/login');
  try {
    const r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + s.access_token } });
    if (r.ok) email = (await r.json()).email || '';
  } catch (x) {}
  texts();
})();
