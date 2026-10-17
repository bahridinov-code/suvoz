// Round profile button in the top right: email, plan, minutes, and the account links. Loaded on every page where people can be logged in.
(function () {
  if (typeof T === 'undefined' || typeof Auth === 'undefined') return;
  Object.assign(T.en, {
    'prof.menu': 'Account menu', 'prof.plan': 'Plan', 'prof.total': 'In your plan', 'prof.left': 'Minutes left', 'prof.min': 'min',
    'prof.account': 'Account', 'prof.plans': 'Plans', 'prof.history': 'My history', 'prof.manage': 'Manage plan', 'prof.logout': 'Log out', 'prof.trial': 'Free trial',
  });
  Object.assign(T.ar, {
    'prof.menu': 'قائمة الحساب', 'prof.plan': 'الخطة', 'prof.total': 'في خطتك', 'prof.left': 'الدقائق المتبقية', 'prof.min': 'د',
    'prof.account': 'الحساب', 'prof.plans': 'الخطط', 'prof.history': 'سجلّي', 'prof.manage': 'إدارة الخطة', 'prof.logout': 'تسجيل الخروج', 'prof.trial': 'تجربة مجانية',
  });
  Object.assign(T.ru, {
    'prof.menu': 'Меню аккаунта', 'prof.plan': 'Тариф', 'prof.total': 'В вашем тарифе', 'prof.left': 'Осталось минут', 'prof.min': 'мин',
    'prof.account': 'Аккаунт', 'prof.plans': 'Тарифы', 'prof.history': 'Моя история', 'prof.manage': 'Управление тарифом', 'prof.logout': 'Выйти', 'prof.trial': 'Бесплатный пробный период',
  });
  Object.assign(T.tg, {
    'prof.menu': 'Менюи ҳисоб', 'prof.plan': 'Нақша', 'prof.total': 'Дар нақшаи шумо', 'prof.left': 'Дақиқаҳои боқимонда', 'prof.min': 'дақ',
    'prof.account': 'Ҳисоб', 'prof.plans': 'Нақшаҳо', 'prof.history': 'Таърихи ман', 'prof.manage': 'Идораи нақша', 'prof.logout': 'Баромадан', 'prof.trial': 'Санҷиши ройгон',
  });
  Object.assign(T.uz, {
    'prof.menu': 'Hisob menyusi', 'prof.plan': 'Tarif', 'prof.total': 'Tarifingizda', 'prof.left': 'Qolgan daqiqalar', 'prof.min': 'daq',
    'prof.account': 'Hisob', 'prof.plans': 'Tariflar', 'prof.history': 'Mening tarixim', 'prof.manage': 'Tarifni boshqarish', 'prof.logout': 'Chiqish', 'prof.trial': 'Bepul sinov',
  });

  const TOTAL = { free: 1800, starter: 27000, creator: 108000, pro: 360000, business: 2700000 };   // characters; 900 = 1 minute
  const PLAN_KEY = { free: 'price.free.n', starter: 'price.s.n', creator: 'price.c.n', pro: 'price.p.n', business: 'price.b.n' };
  const COLORS = ['#3b3fe0', '#0e9f9a', '#d9822b', '#d14f7a', '#7a4fd1', '#2d7fd1'];
  const ICON = {
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    plans: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    manage: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
    logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9"/>',
  };
  const svg = (k) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>';

  let cfg = {}, token = '', me = { email: '', plan: 'free', left: null };
  let btn, panel, built = false;

  const planName = (p) => { const k = PLAN_KEY[p]; const v = k ? t(k) : ''; return v && v !== k ? v : (p ? p[0].toUpperCase() + p.slice(1) : ''); };
  const mins = (chars) => { const m = Math.max(0, chars) / 900; return String(Math.round(m * 10) / 10); };
  function colorFor(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; }

  function item(kind, label, href, onClick) {
    const el = document.createElement(href ? 'a' : 'button');
    el.className = 'prof-item' + (kind === 'logout' ? ' out' : '');
    if (href) el.href = href; else el.type = 'button';
    el.innerHTML = svg(kind) + '<span></span>';
    el.lastChild.textContent = label;
    if (onClick) el.addEventListener('click', onClick);
    return el;
  }

  function render() {
    if (!built) return;
    const initial = (me.email || '?')[0].toUpperCase();
    const col = colorFor(me.email || '');
    btn.textContent = initial;
    btn.style.setProperty('--av', col);
    btn.setAttribute('aria-label', t('prof.menu'));
    panel.textContent = '';

    const head = document.createElement('div'); head.className = 'prof-head';
    const big = document.createElement('span'); big.className = 'prof-av'; big.textContent = initial; big.style.setProperty('--av', col);
    const mail = document.createElement('span'); mail.className = 'prof-mail'; mail.dir = 'ltr'; mail.textContent = me.email || '';
    head.append(big, mail);

    const box = document.createElement('div'); box.className = 'prof-use';
    const total = TOTAL[me.plan] || TOTAL.free;
    const left = me.left == null ? null : Math.min(me.left, total);
    const r1 = document.createElement('div'); r1.className = 'prof-row';
    const l1 = document.createElement('span'); l1.textContent = t('prof.plan');
    const chip = document.createElement('b'); chip.className = 'prof-chip' + (me.plan === 'free' ? ' free' : ''); chip.textContent = me.plan === 'free' ? t('prof.trial') : planName(me.plan);
    r1.append(l1, chip);
    box.append(r1);
    if (left != null) {
      const pct = Math.max(0, Math.min(100, (left / total) * 100));
      const bar = document.createElement('div'); bar.className = 'prof-bar' + (pct < 8 ? ' low' : pct < 20 ? ' mid' : '');
      const fill = document.createElement('i'); fill.style.width = pct.toFixed(1) + '%'; bar.append(fill);
      const r2 = document.createElement('div'); r2.className = 'prof-row big';
      const l2 = document.createElement('span'); l2.textContent = t('prof.left');
      const v2 = document.createElement('b'); v2.textContent = mins(left) + ' ' + t('prof.min');
      r2.append(l2, v2);
      const r3 = document.createElement('div'); r3.className = 'prof-row small';
      const l3 = document.createElement('span'); l3.textContent = t('prof.total');
      const v3 = document.createElement('span'); v3.textContent = mins(total) + ' ' + t('prof.min');
      r3.append(l3, v3);
      box.append(r2, bar, r3);
    }

    const list = document.createElement('div'); list.className = 'prof-list';
    list.append(item('account', t('prof.account'), '/account'));
    list.append(item('plans', t('prof.plans'), '/#pricing'));
    if (cfg.historyOn) list.append(item('history', t('prof.history'), '/history'));
    if (me.plan !== 'free' && cfg.payOn) list.append(item('manage', t('prof.manage'), null, openPortal));
    const hr = document.createElement('hr');
    list.append(hr, item('logout', t('prof.logout'), null, async () => { try { await Auth.signOut(); } catch (e) {} location.replace('/'); }));

    panel.append(head, box, list);
  }

  async function openPortal() {
    try {
      const r = await fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ lang: currentLang }) });
      const j = await r.json().catch(() => ({}));
      if (j.url) location.href = j.url;
    } catch (e) {}
  }

  async function refresh() {
    try {
      const s = await Auth.session();
      if (!s) return;
      token = s.access_token;
      const r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) return;
      const j = await r.json();
      me = { email: j.email || me.email, plan: j.plan || 'free', left: typeof j.trialChars === 'number' ? j.trialChars : me.left };
      render();
    } catch (e) {}
  }

  function setOpen(on) {
    panel.hidden = !on;
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) refresh();
  }

  function build(right) {
    const wrap = document.createElement('div'); wrap.className = 'prof';
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'prof-btn'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    panel = document.createElement('div'); panel.className = 'prof-panel'; panel.hidden = true;
    wrap.append(btn, panel);
    right.appendChild(wrap);
    built = true;
    document.body.classList.add('has-profile');
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(panel.hidden); });
    document.addEventListener('click', (e) => { if (!panel.hidden && !wrap.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); } });
    document.addEventListener('langchange', render);
    render();
  }

  async function init() {
    const right = document.querySelector('.top-right');
    if (!right) return;
    try { cfg = await (await fetch('/api/config')).json(); } catch (e) { return; }
    if (!cfg.authOn) return;
    let s = null;
    for (let i = 0; i < 6 && !s; i++) {      // right after Google sign-in the page may still be saving the login
      s = await Auth.session();
      if (!s) await new Promise((r) => setTimeout(r, 500));
    }
    if (!s) return;
    token = s.access_token;
    build(right);
    refresh();
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
