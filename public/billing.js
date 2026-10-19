// Monthly / yearly switch for the pricing cards (home page and plans page).
// Yearly price = monthly x 12 less 10%, rounded to whole dollars. Must match yearCents in server.js.
const YEARLY = {
  starter: { y: 97, full: 108, save: 11 },
  creator: { y: 313, full: 348, save: 35 },
  pro: { y: 853, full: 948, save: 95 },
  business: { y: 5389, full: 5988, save: 599 },
};
const MONTHLY = { starter: 9, creator: 29, pro: 79, business: 499 };
const Billing = {
  mode: 'month',
  // The switch. onChange(mode) runs when the visitor presses a side.
  make(onChange) {
    const box = document.createElement('div');
    box.className = 'bill'; box.dataset.mode = this.mode; box.setAttribute('role', 'group');
    const knob = document.createElement('i'); knob.className = 'knob';
    const mk = (mode, key, badge) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.mode = mode;
      const s = document.createElement('span'); s.dataset.i18n = key; s.textContent = t(key); b.append(s);
      if (badge) { const e = document.createElement('em'); e.dataset.i18n = badge; e.textContent = t(badge); b.append(e); }
      b.onclick = () => { if (Billing.mode === mode) return; Billing.mode = mode; Billing.paint(box); onChange(mode); };
      return b;
    };
    box.append(knob, mk('month', 'price.monthly'), mk('year', 'price.yearly', 'price.save10'));
    this.paint(box);
    return box;
  },
  paint(box) {
    box.dataset.mode = this.mode;
    box.querySelectorAll('button').forEach((b) => { const on = b.dataset.mode === this.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  },
  usd: (n) => '$' + (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2 })),
  perMonth: (key) => Billing.usd(Math.round((YEARLY[key].y / 12) * 100) / 100),
};

// ---- Home page cards ----
(function home() {
  const mount = document.getElementById('homeBill');
  if (!mount) return;
  const KEYS = ['starter', 'creator', 'pro', 'business'];
  const cards = Array.from(document.querySelectorAll('#pricing .plans .plan')).slice(1, 5);
  const saved = cards.map((c) => ({ amt: c.querySelector('.amt').innerHTML, disc: (c.querySelector('.disc') || {}).outerHTML || '' }));
  const note = document.querySelector('#pricing .pnote');
  const year = () => Billing.mode === 'year';
  const nofirst = () => document.getElementById('pricing').classList.contains('no-first');
  document.addEventListener('nofirst', () => { paint(); if (typeof applyLang === 'function') applyLang(currentLang); });
  function paint() {
    cards.forEach((c, i) => {
      const k = KEYS[i], y = YEARLY[k];
      c.querySelectorAll('.disc, .perm').forEach((e) => e.remove());
      const amt = c.querySelector('.amt');
      const buy = c.querySelector('a.btn[href^="/app?plan="]');
      if (buy) buy.href = '/app?plan=' + k + (year() ? '&interval=year' : '');
      if (!year()) {
        if (nofirst()) {   // already had a plan: full price, no first-month discount
          amt.textContent = Billing.usd(MONTHLY[k]);
          const sm = document.createElement('small'); sm.dataset.i18n = 'price.mo'; sm.textContent = t('price.mo'); amt.append(sm);
        } else {
          amt.innerHTML = saved[i].amt;
          if (saved[i].disc) amt.insertAdjacentHTML('afterend', saved[i].disc);
        }
      } else {
        amt.textContent = '';
        const s = document.createElement('s'); s.textContent = Billing.usd(y.full);
        const sm = document.createElement('small'); sm.dataset.i18n = 'price.yr'; sm.textContent = t('price.yr');
        amt.append(s, document.createTextNode(' ' + Billing.usd(y.y)), sm);
        const perm = document.createElement('p'); perm.className = 'perm'; perm.dataset.n = Billing.perMonth(k); perm.textContent = t('price.perm', { n: perm.dataset.n });
        const d = document.createElement('p'); d.className = 'disc'; d.dataset.save = Billing.usd(y.save); d.textContent = t('price.save', { n: d.dataset.save });
        amt.after(d, perm);
      }
      c.classList.toggle('yr', year());
    });
    if (note) { note.dataset.i18n = year() ? 'price.note.y' : 'price.note'; note.textContent = t(note.dataset.i18n); }
  }
  // buttons of people who already pay open the Plans page on the right plan and billing type
  function links() {
    document.querySelectorAll('#pricing a.btn[data-plan]').forEach((a) => { a.href = '/plans?plan=' + a.dataset.plan + (year() ? '&interval=year' : ''); });
  }
  const sw = Billing.make(() => { paint(); links(); if (typeof applyLang === 'function') applyLang(currentLang); });
  mount.append(sw);
  // after a language change the texts with numbers are rebuilt
  document.addEventListener('langchange', () => {
    links();
    document.querySelectorAll('#pricing .disc[data-save]').forEach((e) => { e.textContent = t('price.save', { n: e.dataset.save }); });
    document.querySelectorAll('#pricing .perm[data-n]').forEach((e) => { e.textContent = t('price.perm', { n: e.dataset.n }); });
  });
})();
