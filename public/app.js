// Tool page logic (same API as the first version, new look, 5 languages).
const $ = (id) => document.getElementById(id);
const LINE = /^\s*([^:：\n]{1,30}?)\s*[:：]\s*(.+)$/;
const COLORS = ['var(--indigo)', 'var(--teal)', 'var(--amber)', 'var(--rose)'];
let voices = [], config = { maxChars: 3000, maxSpeakers: 4, requiresCode: false };
const choice = {};
let lastKey = '';
let edited = false;          // true once the visitor changes the example script
let statusKey = null;
let plan = 'free';
let trialChars = null;       // free-trial characters left (null when not using accounts)        // remembers which message is showing so it can be re-translated

// KEEP IN SYNC with parseScript() in server.js (same rules, same character count).
// Text before any "Name:" (or a text with no names) is read by one narrator voice.
const NARRATOR = 'Narrator';
function looksLikeName(s) {
  return !/[!?,;"“”]/.test(s) && s.split(/\s+/).length <= 3;
}
function parse(text) {
  const turns = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LINE);
    if (m && looksLikeName(m[1].trim())) {
      turns.push({ speaker: m[1].trim(), text: m[2].trim() });
    } else if (!turns.length) {
      turns.push({ speaker: NARRATOR, text: line, implicit: true });
    } else {
      const last = turns[turns.length - 1];
      last.text += (last.implicit ? '\n' : ' ') + line;
    }
  }
  return turns;
}

function exampleScript() {
  return [1, 2, 3].map((n) => t('demo.s' + n) + ': ' + t('demo.t' + n)).join('\n');
}

function setStatus(key, isErr, raw) {
  statusKey = key || null;
  $('status').textContent = raw || (key ? t(key, { n: config.maxSpeakers }) : '');
  $('status').className = isErr ? 'err' : '';
}

async function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (config.authOn) {
    const s = await Auth.session();
    if (!s) { location.replace('/login'); throw new Error('login'); }
    h.Authorization = 'Bearer ' + s.access_token;
  } else {
    const code = $('code').value;
    if (code) h['x-access-code'] = code;
  }
  return h;
}

// Turns a server answer into a message in the visitor's language.
function errText(j, fallback) {
  if (j && j.code === 'auth_required' && config.authOn) { Auth.signOut().then(() => location.replace('/login')); }
  if (j && j.code && T.en['err.' + j.code]) return t('err.' + j.code);
  return (j && j.error) || fallback;
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
    const r = await fetch('/api/me', { headers: await headers() });
    const j = await r.json();
    if (!r.ok) throw new Error(errText(j, 'Could not load your account.'));
    plan = j.plan || 'free';
    $('manage').hidden = plan === 'free' || !config.payOn;
    trialChars = j.trialChars;
    $('who').textContent = j.email || '';
    $('who').hidden = !j.email;
    renderTrial();
    refresh();
  } catch (e) {
    if (e.message !== 'login') setStatus(null, true, e.message);
  }
}

function refresh() {
  const turns = parse($('script').value);
  const chars = turns.reduce((n, x) => n + x.text.length, 0);
  $('count').textContent = chars;
  const limit = trialChars === null ? config.maxChars : Math.min(config.maxChars, trialChars);
  $('max').textContent = limit;
  $('meta').className = 'meta' + (chars > limit ? ' over' : '');
  const names = [...new Set(turns.map((x) => x.speaker))];
  const key = names.join('|') + '#' + voices.length + '#' + currentLang;
  if (key !== lastKey) { lastKey = key; renderSpeakers(names); }
  const ok = turns.length && voices.length && chars <= limit && names.length <= config.maxSpeakers;
  $('go').disabled = !ok;
  if (names.length > config.maxSpeakers) setStatus('app.maxspeakers', true);
  else if (statusKey === 'app.maxspeakers') setStatus('');
}

function renderSpeakers(names) {
  const box = $('speakers');
  box.textContent = '';
  if (!names.length) {
    const d = document.createElement('div');
    d.className = 'meta';
    d.textContent = t('app.speakers.empty');
    box.appendChild(d);
    return;
  }
  names.forEach((name, i) => {
    if (!choice[name] && voices.length) choice[name] = voices[i % voices.length].id;
    const row = document.createElement('div');
    row.className = 'vrow';
    const who = document.createElement('span');
    who.className = 'who';
    who.style.setProperty('--c', COLORS[i % COLORS.length]);
    const dot = document.createElement('i');
    const nm = document.createElement('span');
    nm.textContent = name === NARRATOR ? t('app.narrator') : name;
    who.append(dot, nm);
    const sel = document.createElement('select');
    sel.className = 'field';
    voices.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.id;
      o.textContent = v.name + (v.labels && v.labels.accent ? ' · ' + v.labels.accent : '');
      sel.appendChild(o);
    });
    sel.value = choice[name] || '';
    sel.onchange = () => { choice[name] = sel.value; };
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pbtn';
    btn.textContent = '▶ ' + t('app.preview');
    btn.onclick = () => {
      const v = voices.find((x) => x.id === sel.value);
      if (v && v.preview) new Audio(v.preview).play();
    };
    row.append(who, sel, btn);
    box.appendChild(row);
  });
}

async function loadVoices() {
  setStatus('app.loading');
  try {
    const r = await fetch('/api/voices', { headers: await headers() });
    const j = await r.json();
    if (!r.ok) throw new Error(errText(j, 'Could not load voices.'));
    voices = j.voices;
    setStatus('');
    lastKey = '';
    refresh();
  } catch (e) {
    if (e.message !== 'login') setStatus(null, true, e.message);
  }
}

async function generate() {
  const turns = parse($('script').value);
  const names = [...new Set(turns.map((x) => x.speaker))];
  const map = {};
  names.forEach((n) => (map[n] = choice[n]));
  $('go').disabled = true;
  $('result').hidden = true;
  setStatus('app.generating');
  try {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ script: $('script').value, voices: map }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(errText(j, 'Something went wrong.'));
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    $('player').src = url;
    $('dl').href = url;
    $('result').hidden = false;
    setStatus('app.done');
    if (config.authOn) loadMe();
  } catch (e) {
    if (e.message !== 'login') setStatus(null, true, e.message);
    if (config.authOn) loadMe();
  } finally {
    refresh();
  }
}

$('script').addEventListener('input', () => { edited = true; refresh(); });
$('go').addEventListener('click', generate);
$('code').addEventListener('change', loadVoices);

document.addEventListener('langchange', () => {
  if (!edited) $('script').value = exampleScript();
  if (statusKey) setStatus(statusKey, $('status').className === 'err');
  renderTrial();
  lastKey = '';
  refresh();
});

const PLAN_KEYS = ['starter', 'creator', 'pro', 'business'];

// A plan picked on the pricing page is remembered for a day, so it survives sign-up and the email link.
function rememberPlan() {
  try {
    const q = new URLSearchParams(location.search).get('plan');
    if (q && PLAN_KEYS.includes(q)) {
      localStorage.setItem('suvoz_plan', JSON.stringify({ plan: q, t: Date.now() }));
      history.replaceState(null, '', location.pathname + location.hash);
    }
  } catch (e) {}
}

async function goPay(plan) {
  setStatus('app.pay.go');
  try {
    const r = await fetch('/api/checkout', { method: 'POST', headers: await headers(), body: JSON.stringify({ plan, lang: currentLang }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.url) throw new Error(errText(j, 'Could not start the payment.'));
    location.href = j.url;
  } catch (e) {
    if (e.message !== 'login') setStatus(null, true, e.message);
  }
}

async function startPendingPlan() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem('suvoz_plan') || 'null'); localStorage.removeItem('suvoz_plan'); } catch (e) {}
  if (!p || !PLAN_KEYS.includes(p.plan) || Date.now() - p.t > 24 * 3600 * 1000) return;
  if (plan !== 'free') return;
  await goPay(p.plan);
}

async function afterPayment() {
  if (new URLSearchParams(location.search).get('paid') !== '1') return false;
  history.replaceState(null, '', location.pathname);
  setStatus('app.paid');
  for (let i = 0; i < 8 && plan === 'free'; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    await loadMe();
  }
  if (plan !== 'free') setStatus(null);
  return true;
}

// First visit: ask for name and age once, then carry on.
async function ensureProfile() {
  let prof = null;
  try { prof = await Auth.profile(); } catch (e) {}
  if (!prof || prof.age) return;
  const d = $('profileDlg'), f = $('profileForm'), err = $('pErr');
  if (!d.showModal) return;
  if (prof.full_name || prof.name) f.name.value = String(prof.full_name || prof.name).slice(0, 80);   // Google already gives us a name
  d.addEventListener('cancel', (e) => e.preventDefault());   // it can not be closed without answering
  await new Promise((done) => {
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const name = f.name.value.trim(), age = parseInt(f.age.value, 10);
      if (!name || !(age >= 1 && age <= 120)) { err.textContent = t('profile.err'); err.hidden = false; return; }
      $('pSend').disabled = true;
      try { await Auth.saveProfile({ full_name: name, age }); d.close(); done(); }
      catch (x) { err.textContent = t('auth.err.generic'); err.hidden = false; $('pSend').disabled = false; }
    });
    d.showModal();
  });
}

(async function init() {
  initLang();
  rememberPlan();
  try { config = await (await fetch('/api/config')).json(); } catch (e) {}
  $('max').textContent = config.maxChars;
  if (config.authOn) {
    if (/type=recovery/.test(location.hash)) return location.replace('/login' + location.hash);
    Auth.takeHash();   // the email confirmation link brings the login in the address
    if (!(await Auth.session())) return location.replace('/login');
    await ensureProfile();
    $('logout').hidden = false;
    $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
    $('manage').onclick = async () => {
      try {
        const r = await fetch('/api/portal', { method: 'POST', headers: await headers(), body: JSON.stringify({ lang: currentLang }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) throw new Error(errText(j, 'Could not open your plan page.'));
        location.href = j.url;
      } catch (e) { if (e.message !== 'login') setStatus(null, true, e.message); }
    };
    await loadMe();
    loadVoices();
    if (!(await afterPayment())) await startPendingPlan();
  } else if (config.requiresCode) {
    $('codeBox').hidden = false;
    setStatus('app.entercode');
  } else {
    loadVoices();
  }
  refresh();
})();
