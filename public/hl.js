// Highlights [emotion tags] and (sound cues) inside any element marked data-hl, so people see how to use them.
(function () {
  const SPLIT = /(\[[^\]\n]{1,40}\]|\([^)\n]{1,40}\))/;
  function run(root) {
    (root || document).querySelectorAll('[data-hl]').forEach((el) => {
      const txt = el.textContent;
      if (!/[\[(]/.test(txt)) return;
      const frag = document.createDocumentFragment();
      txt.split(SPLIT).forEach((part) => {
        if (!part) return;
        if (part[0] === '[' || part[0] === '(') {
          const s = document.createElement('span');
          s.className = 'tok ' + (part[0] === '[' ? 'tok-sq' : 'tok-rd');
          s.textContent = part;
          frag.appendChild(s);
        } else frag.appendChild(document.createTextNode(part));
      });
      el.textContent = '';
      el.appendChild(frag);
    });
  }
  window.hlRun = run;
  document.addEventListener('langchange', () => run());
  if (document.readyState !== 'loading') run(); else document.addEventListener('DOMContentLoaded', () => run());
})();
