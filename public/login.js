// Sign-up and login page. Modes: signup, login, forgot, newpass, check.
const $ = (id) => document.getElementById(id);
let mode = 'signup';
let msgKey = null, msgVars = null, msgErr = false;
let sentTo = '';
let busy = false;

function show(el, on) { el.hidden = !on; }

function setMsg(key, isErr, vars) {
  msgKey = key; msgVars = vars || null; msgErr = !!isErr;
  $('msg').textContent = key ? t(key, vars) : '';
  $('msg').className = 'amsg' + (isErr ? ' err' : '');
}

function render() {
  const m = mode;
  show($('tabs'), m === 'signup' || m === 'login');
  $('tabSignup').setAttribute('aria-selected', m === 'signup');
  $('tabLogin').setAttribute('aria-selected', m === 'login');
  show($('form'), true);
  show($('emailBox'), m === 'signup' || m === 'login' || m === 'forgot');
  show($('passBox'), m === 'signup' || m === 'login' || m === 'newpass');
  show($('hint'), m === 'signup' || m === 'newpass');
  show($('forgot'), m === 'login');
  show($('submit'), m !== 'check');
  show($('back'), m === 'forgot' || m === 'newpass' || m === 'check');
  $('pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  const titles = { signup: 'auth.title.signup', login: 'auth.title.login', forgot: 'auth.reset.title', newpass: 'auth.newpass.title', check: 'auth.check.title' };
  const subs = { signup: 'auth.sub.signup', login: 'auth.sub.login', forgot: 'auth.reset.sub' };
  $('title').textContent = t(titles[m]);
  $('sub').textContent = m === 'check' ? t('auth.check.body', { email: sentTo }) : (subs[m] ? t(subs[m]) : '');
  show($('sub'), !!$('sub').textContent);
  const labels = { signup: 'auth.submit.signup', login: 'auth.submit.login', forgot: 'auth.reset.send', newpass: 'auth.newpass.submit' };
  $('submit').textContent = labels[m] ? t(labels[m]) : '';
}

function go(next) { mode = next; setMsg(null); render(); }

$('tabSignup').onclick = () => go('signup');
$('tabLogin').onclick = () => go('login');
$('forgot').onclick = () => go('forgot');
$('back').onclick = () => go('login');

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (busy) return;
  const email = $('email').value.trim();
  const pass = $('pass').value;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (mode !== 'newpass' && !emailOk) return setMsg('auth.err.email', true);
  if ((mode === 'signup' || mode === 'newpass') && pass.length < 8) return setMsg('auth.err.weak', true);
  if (mode === 'login' && !pass) return setMsg('auth.err.invalid', true);
  busy = true; $('submit').disabled = true; setMsg(null);
  try {
    if (mode === 'signup') {
      const r = await Auth.signUp(email, pass);
      if (r.loggedIn) return location.replace('/app');
      sentTo = email; go('check');
    } else if (mode === 'login') {
      await Auth.signIn(email, pass);
      location.replace('/app');
    } else if (mode === 'forgot') {
      await Auth.recover(email);
      setMsg('auth.reset.sent', false, { email });
    } else if (mode === 'newpass') {
      await Auth.setPassword(pass);
      setMsg('auth.newpass.done');
      setTimeout(() => location.replace('/app'), 900);
    }
  } catch (e) {
    setMsg(Auth.errKey(e), true);
  } finally {
    busy = false; $('submit').disabled = false;
  }
});

document.addEventListener('langchange', () => { render(); if (msgKey) setMsg(msgKey, msgErr, msgVars); });

(async function init() {
  initLang();
  const cfg = await Auth.config().catch(() => ({}));
  if (!cfg.authOn) return location.replace('/app');
  const h = Auth.takeHash();
  if (h && h.error) setMsg('auth.err.generic', true);
  if (h && h.type === 'recovery') { mode = 'newpass'; render(); return; }
  if (await Auth.session()) return location.replace('/app');
  if (new URLSearchParams(location.search).get('mode') === 'login') mode = 'login';
  render();
})();
