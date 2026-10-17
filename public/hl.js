// Highlights [emotion tags] and (sound cues) inside any element marked data-hl, so people see how to use them.
(function () {
  const SPLIT = /(\*[^*\n]{1,80}\*|\[[^\]\n]{1,40}\]|\([^)\n]{1,40}\))/;
  function run(root) {
    (root || document).querySelectorAll('[data-hl]').forEach((el) => {
      const txt = el.textContent;
      if (el.dataset.hlDone === txt) return;          // already highlighted; a new language resets the text first
      if (!/[\[(*]/.test(txt)) return;
      const frag = document.createDocumentFragment();
      txt.split(SPLIT).forEach((part) => {
        if (!part) return;
        if (part[0] === '*' && part.length > 2) {
          const m = document.createElement('mark');
          m.className = 'kw';
          m.textContent = part.slice(1, -1);
          frag.appendChild(m);
        } else if (part[0] === '[' || part[0] === '(') {
          const s = document.createElement('span');
          s.className = 'tok ' + (part[0] === '[' ? 'tok-sq' : 'tok-rd');
          s.textContent = part;
          frag.appendChild(s);
        } else frag.appendChild(document.createTextNode(part));
      });
      el.textContent = '';
      el.appendChild(frag);
      el.dataset.hlDone = el.textContent;
    });
  }
  window.hlRun = run;
  document.addEventListener('langchange', () => run());
  if (document.readyState !== 'loading') run(); else document.addEventListener('DOMContentLoaded', () => run());
})();
