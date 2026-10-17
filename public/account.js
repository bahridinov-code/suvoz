// Account page (delete account).
const $ = (id) => document.getElementById(id);
let busy = false, statusKey = null;
async function headers() {
  const s = await Auth.session();
  if (!s) { location.replace('/login'); throw new Error('login'); }
  return { Authorization: 'Bearer ' + s.access_token };
}
function setStatus(key, isErr, raw) {
  statusKey = key || null;
  $('status').textContent = raw || (key ? t(key) : '');
  $('status').className = isErr ? 'err' : '';
}
function refresh() { $('del').disabled = busy || $('confirm').value.trim() !== 'DELETE'; }
$('confirm').oninput = () => { setStatus(null); refresh(); };

$('del').onclick = async () => {
  if (busy || $('confirm').value.trim() !== 'DELETE') return;
  busy = true; refresh(); setStatus('acct.working');
  try {
    const h = await headers();
    h['Content-Type'] = 'application/json';
    const r = await fetch('/api/account-delete', { method: 'POST', headers: h, body: JSON.stringify({ confirm: 'DELETE' }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (!r.ok) throw new Error(j.code && T.en['err.' + j.code] ? t('err.' + j.code) : (j.error || t('err.del_failed')));
    try { await Auth.signOut(); } catch (e) {}
    setStatus('acct.done');
    setTimeout(() => location.replace('/'), 2500);
  } catch (e) {
    if (e.message !== 'login') setStatus(null, true, e.message === 'Failed to fetch' ? t('err.del_failed') : e.message);
    busy = false; refresh();
  }
};

document.addEventListener('langchange', () => { if (statusKey) setStatus(statusKey, $('status').className === 'err'); });

(async function init() {
  initLang();
  let config = {};
  try { config = await getConfig(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  if (!(await Auth.session())) return location.replace('/login');
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  try {
    const r = await fetch('/api/me', { headers: await headers() });
    const j = await r.json();
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    $('mail').textContent = j.email || '';
    $('who').textContent = j.email || ''; $('who').hidden = !j.email;
  } catch (e) {}
  refresh();
})();
