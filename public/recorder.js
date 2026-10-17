// Record from the microphone and hand the result to the page like an uploaded file.
// Recorder.init({ pickBtn, maxSeconds, onStart(), onDone(file, seconds), onError(key) })
const Recorder = (function () {
  const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  let btn, btnLabel, bar, timeEl, stopBtn, preview, rec, stream, chunks, timer, startedAt, cfg, previewUrl;

  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function release() { if (stream) stream.getTracks().forEach((x) => x.stop()); stream = null; clearInterval(timer); }
  function clear() {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    if (preview) { preview.hidden = true; preview.removeAttribute('src'); }
    if (btnLabel && !(rec && rec.state === 'recording')) btnLabel.textContent = t('rec.start');
  }
  function labels() {
    if (!btn) return;
    btnLabel.textContent = t(previewUrl ? 'rec.again' : 'rec.start');
    stopBtn.textContent = t('rec.stop');
    bar.querySelector('span').textContent = t('rec.live');
  }
  async function start() {
    clear();
    let s;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { cfg.onError(e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') ? 'rec.nomic' : 'rec.denied'); return; }
    stream = s; chunks = [];
    const type = TYPES.find((x) => MediaRecorder.isTypeSupported(x)) || '';
    try { rec = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s); }
    catch (e) { release(); cfg.onError('rec.fail'); return; }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = () => { release(); bar.hidden = true; btn.hidden = false; cfg.pickBtn.hidden = false; cfg.onError('rec.fail'); };
    rec.onstop = () => {
      const seconds = (performance.now() - startedAt) / 1000;
      release(); bar.hidden = true; btn.hidden = false; cfg.pickBtn.hidden = false;
      const mime = rec.mimeType || type || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size || seconds < 0.5) return cfg.onError('rec.fail');
      const ext = /mp4/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : 'webm';
      const file = new File([blob], t('rec.name') + '.' + ext, { type: mime });
      previewUrl = URL.createObjectURL(blob);
      preview.src = previewUrl; preview.hidden = false; labels();
      cfg.onDone(file, seconds);
    };
    cfg.onStart();
    startedAt = performance.now();
    rec.start(1000);
    btn.hidden = true; bar.hidden = false; cfg.pickBtn.hidden = true; timeEl.textContent = '0:00';
    timer = setInterval(() => {
      const s2 = (performance.now() - startedAt) / 1000;
      timeEl.textContent = fmt(s2);
      if (s2 >= cfg.maxSeconds) { cfg.onError('rec.max'); stop(); }
    }, 250);
  }
  function stop() { if (rec && rec.state === 'recording') rec.stop(); }

  function init(c) {
    cfg = c;
    const z = c.pickBtn.closest('.src'), inp = document.getElementById('file');
    if (z && inp) drop(z, inp);
    if (!supported()) return;
    const host = c.pickBtn.closest('.panel') || c.pickBtn.parentNode;
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'srcbtn rec-btn'; btn.onclick = start;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span></span>';
    btnLabel = btn.querySelector('span');
    bar = document.createElement('div'); bar.className = 'rec-bar'; bar.hidden = true;
    bar.innerHTML = '<i class="rec-dot"></i><span></span><b class="rec-time">0:00</b>';
    timeEl = bar.querySelector('b');
    stopBtn = document.createElement('button'); stopBtn.type = 'button'; stopBtn.className = 'pbtn rec-stop'; stopBtn.onclick = stop;
    bar.append(stopBtn);
    preview = document.createElement('audio'); preview.controls = true; preview.hidden = true; preview.className = 'rec-prev';
    c.pickBtn.after(btn, bar);
    const info = host.querySelector('.meta');
    (info || bar).after(preview);
    labels();
    document.addEventListener('langchange', labels);
  }
  // Drop a file on the box instead of clicking.
  function drop(zone, input) {
    ['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, () => zone.classList.remove('drag')));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    });
  }
  return { init, clear };
})();
