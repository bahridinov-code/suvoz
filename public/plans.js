// Plans page: see your plan, upgrade or switch, cancel or resume, update payment details.
const $ = (id) => document.getElementById(id);
const ORDER = ['starter', 'creator', 'pro', 'business'];
const KEY = { starter: 's', creator: 'c', pro: 'p', business: 'b' };
const MINUTES = { free: 2, starter: 30, creator: 120, pro: 400, business: 3000 };
const PRICE = { starter: [9, 4.5], creator: [29, 16.99], pro: [79, 49.99], business: [499, 0] };
let state = null, token = '', busy = false;

const money = (n) => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
const planName = (p) => (p === 'free' ? t('pl.trial') : t('price.' + KEY[p] + '.n'));
const MONTHS = {
  tg: ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
};
function fmtDate(sec) {
  if (!sec) return t('pl.date');
  const d = new Date(sec * 1000);
  if (MONTHS[currentLang]) {
    const m = MONTHS[currentLang][d.getMonth()];
    return currentLang === 'tg' ? d.getDate() + ' ' + m + 'и ' + d.getFullYear() : d.getFullYear() + '-yil ' + d.getDate() + '-' + m;
  }
  const loc = { en: 'en-US', ar: 'ar', ru: 'ru-RU' }[currentLang] || 'en-US';
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
}
const mins = (chars) => String(Math.round((Math.max(0, chars) / 900) * 10) / 10);
function setMsg(key, vars, err) { const m = $('msg'); m.textContent = key ? t(key, vars) : ''; m.className = 'amsg' + (err ? ' err' : ''); }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

async function headers() {
  const s = await Auth.session();
  if (!s) { location.replace('/login'); throw new Error('login'); }
  token = s.access_token;
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
}
async function api(method, path, body) {
  const r = await fetch(path, { method, headers: await headers(), body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

function confirmDialog(titleKey, descKey, vars) {
  return new Promise((resolve) => {
    const d = $('dlg');
    $('dT').textContent = t(titleKey, vars);
    $('dD').textContent = t(descKey, vars);
    const done = (v) => { d.close(); $('dYes').onclick = $('dNo').onclick = null; resolve(v); };
    $('dYes').onclick = () => done(true);
    $('dNo').onclick = () => done(false);
    d.addEventListener('cancel', () => resolve(false), { once: true });
    d.showModal();
  });
}

function renderCurrent() {
  const box = $('curCard');
  box.textContent = '';
  if (!state || state.payOn === false) { box.hidden = true; return; }
  box.hidden = false;
  const paid = state.active && state.plan !== 'free';
  const total = (MINUTES[state.plan] || MINUTES.free) * 900;
  const left = Math.min(state.left == null ? 0 : state.left, total);

  const info = el('div', 'cur-info');
  info.append(el('small', '', t('pl.yours')), el('h2', '', planName(state.plan)));
  if (paid) {
    if (state.cancelAtPeriodEnd) info.append(el('p', 'cur-warn', t('pl.ends', { d: fmtDate(state.periodEnd) })));
    else if (state.pendingPlan) info.append(el('p', '', t('pl.switching', { p: planName(state.pendingPlan), d: fmtDate(state.periodEnd) })));
    else info.append(el('p', '', t('pl.renews', { d: fmtDate(state.periodEnd) })));
  }
  const use = el('div', 'cur-use');
  use.append(el('b', '', t('pl.left', { m: mins(left), t: String(total / 900) })));
  const pct = total ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
  const bar = el('div', 'prof-bar' + (pct < 8 ? ' low' : pct < 20 ? ' mid' : ''));
  const fill = document.createElement('i'); fill.style.width = pct.toFixed(1) + '%'; bar.append(fill);
  use.append(bar);
  box.append(info, use);

  if (paid) {
    const acts = el('div', 'cur-actions');
    const pay = el('button', 'pbtn', t('pl.pay')); pay.type = 'button'; pay.onclick = openPayment;
    const c = el('button', 'pbtn' + (state.cancelAtPeriodEnd ? '' : ' danger'), t(state.cancelAtPeriodEnd ? 'pl.resume' : 'pl.cancel')); c.type = 'button';
    c.onclick = () => (state.cancelAtPeriodEnd ? doResume() : doCancel());
    acts.append(pay, c);
    box.append(acts);
  }
}

function renderGrid() {
  const grid = $('grid');
  grid.textContent = '';
  if (!state || state.payOn === false) return;
  const paid = state.active && state.plan !== 'free';
  const isNew = !state.exists;
  $('note').hidden = !paid;
  ORDER.forEach((p) => {
    const k = KEY[p];
    const card = el('div', 'plan' + (p === 'creator' ? ' hot' : '') + (paid && state.plan === p ? ' current' : ''));
    if (p === 'creator') card.append(el('span', 'pop', t('price.pop')));
    card.append(el('h3', '', t('price.' + k + '.n')));
    const amt = el('div', 'amt');
    const [reg, first] = PRICE[p];
    if (isNew && first) { const s = document.createElement('s'); s.textContent = money(reg); amt.append(s, document.createTextNode(' ' + money(first))); }
    else amt.append(document.createTextNode(money(reg)));
    amt.append(el('small', '', t('price.mo')));
    card.append(amt);
    if (isNew && first) card.append(el('p', 'disc', t('price.off.' + k)));
    card.append(el('p', 'pm', t('price.' + k + '.m')), el('p', '', t('price.' + k + '.d')));
    let btn;
    if (!paid) { btn = el('button', 'btn small', t('pl.buy')); btn.onclick = () => doBuy(p); }
    else if (state.plan === p) { btn = el('span', 'btn small ghost cur', t('pl.cur')); }
    else {
      const up = ORDER.indexOf(p) > ORDER.indexOf(state.plan);
      btn = el('button', 'btn small' + (up ? '' : ' outline'), t(up ? 'pl.up' : 'pl.down'));
      if (state.cancelAtPeriodEnd) { btn.disabled = true; btn.title = t('pl.cancelling'); }
      else btn.onclick = () => doChange(p, up);
    }
    if (btn.tagName === 'BUTTON') btn.type = 'button';
    card.append(btn);
    grid.append(card);
  });
  const x = el('div', 'plan');
  x.append(el('h3', '', t('price.x.n')), el('div', 'amt', t('price.x.big')), el('p', 'pm', t('price.x.m')), el('p', '', t('price.x.d')));
  const a = el('a', 'btn small ghost', t('price.cta.sales')); a.href = 'mailto:sales@suvoz.io';
  x.append(a);
  grid.append(x);
}

function render() {
  renderCurrent();
  renderGrid();
  document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
}

async function load() {
  try {
    const r = await api('GET', '/api/plan');
    if (r.status === 503) { state = { payOn: false }; setMsg('pl.soon'); }
    else if (!r.ok) throw new Error('load');
    else state = r.j;
  } catch (e) { if (e.message !== 'login') setMsg('pl.err', null, true); }
  render();
}

async function run(fn) {
  if (busy) return;
  busy = true; setMsg(null);
  try { await fn(); } catch (e) { if (e.message !== 'login') setMsg('pl.err', null, true); }
  busy = false;
}
const errKey = (r) => (r.j && r.j.code === 'pay_failed' ? 'pl.err.pay' : 'pl.err');

function doBuy(plan) {
  return run(async () => {
    const r = await api('POST', '/api/checkout', { plan, lang: currentLang });
    if (r.ok && r.j.url) { location.href = r.j.url; return; }
    if (r.j && r.j.code === 'already_subscribed') return load();
    setMsg('pl.err', null, true);
  });
}
function doChange(plan, up) {
  return run(async () => {
    const vars = { p: planName(plan), d: fmtDate(state.periodEnd) };
    if (!(await confirmDialog(up ? 'pl.c.up.t' : 'pl.c.down.t', up ? 'pl.c.up.d' : 'pl.c.down.d', vars))) return;
    const r = await api('POST', '/api/plan-change', { plan });
    if (!r.ok) return setMsg(errKey(r), null, true);
    await load();
    setMsg(r.j.mode === 'upgrade' ? 'pl.ok.up' : 'pl.ok.down', { p: planName(plan), d: fmtDate(r.j.periodEnd || state.periodEnd) });
  });
}
function doCancel() {
  return run(async () => {
    if (!(await confirmDialog('pl.c.cancel.t', 'pl.c.cancel.d', { d: fmtDate(state.periodEnd) }))) return;
    const r = await api('POST', '/api/plan-cancel');
    if (!r.ok) return setMsg('pl.err', null, true);
    await load();
    setMsg('pl.ok.cancel', { d: fmtDate(r.j.periodEnd || state.periodEnd) });
  });
}
function doResume() {
  return run(async () => {
    if (!(await confirmDialog('pl.c.resume.t', 'pl.c.resume.d', { d: fmtDate(state.periodEnd) }))) return;
    const r = await api('POST', '/api/plan-resume');
    if (!r.ok) return setMsg('pl.err', null, true);
    await load();
    setMsg('pl.ok.resume');
  });
}
function openPayment() {
  return run(async () => {
    const r = await api('POST', '/api/portal', { flow: 'payment', lang: currentLang });
    if (r.ok && r.j.url) { location.href = r.j.url; return; }
    setMsg('pl.err', null, true);
  });
}

document.addEventListener('langchange', render);
(async function init() {
  initLang();
  let cfg = {};
  try { cfg = await (await fetch('/api/config')).json(); } catch (e) {}
  if (!cfg.authOn) return location.replace('/');
  Auth.takeHash();
  if (!(await Auth.session())) return location.replace('/login');
  await load();
})();
