// Makes a button feel alive while a tool is working: moving light, sound bars and changing words.
const Busy = (function () {
  const live = new Map();
  const words = (kind) => ((typeof BUSY_TEXTS !== 'undefined' && (BUSY_TEXTS[currentLang] || BUSY_TEXTS.en)[kind]) || ['…']);
  function paint(btn, label, first) {
    let s = btn.querySelector('.bl');
    if (!s) {
      btn.textContent = '';
      const eq = document.createElement('i'); eq.className = 'eq'; eq.setAttribute('aria-hidden', 'true');
      eq.innerHTML = '<b></b><b></b><b></b><b></b>';
      s = document.createElement('span'); s.className = 'bl';
      btn.append(eq, s);
    }
    if (!first) { s.classList.add('out'); setTimeout(() => { s.textContent = label; s.classList.remove('out'); }, 180); }
    else s.textContent = label;
  }
  function start(btn, kind) {
    if (!btn) return;
    stop(btn, true);
    let i = 0;
    btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true');
    paint(btn, words(kind)[0], true);
    const id = setInterval(() => { const w = words(kind); i = Math.min(i + 1, w.length - 1); paint(btn, w[i], false); }, 2600);
    live.set(btn, id);
  }
  function stop(btn, quiet) {
    if (!btn) return;
    const id = live.get(btn);
    if (id) { clearInterval(id); live.delete(btn); }
    if (btn.classList.contains('busy')) {
      btn.classList.remove('busy'); btn.removeAttribute('aria-busy');
      if (!quiet && btn.dataset.i18n) btn.textContent = t(btn.dataset.i18n);
    }
  }
  return { start, stop };
})();
