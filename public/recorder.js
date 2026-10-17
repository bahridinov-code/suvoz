// Record from the microphone and hand the result to the page like an uploaded file.
// Recorder.init({ pickBtn, maxSeconds, onStart(), onDone(file, seconds), onError(key) })
const Recorder = (function () {
  const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  let btn, bar, timeEl, stopBtn, preview, rec, stream, chunks, timer, startedAt, cfg, previewUrl;

  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  function release() { if (stream) stream.getTracks().forEach((x) => x.stop()); stream = null; clearInterval(timer); }
  function clear() {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    if (preview) { preview.hidden = true; preview.removeAttribute('src'); }
    if (btn && !(rec && rec.state === 'recording')) btn.textContent = t('rec.start');
  }
  function labels() {
    if (!btn) return;
    btn.textContent = t(previewUrl ? 'rec.again' : 'rec.start');
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
    rec.onerror = () => { release(); bar.hidden = true; btn.hidden = false; cfg.onError('rec.fail'); };
    rec.onstop = () => {
      const seconds = (performance.now() - startedAt) / 1000;
      release(); bar.hidden = true; btn.hidden = false; cfg.pickBtn.disabled = false;
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
    btn.hidden = true; bar.hidden = false; cfg.pickBtn.disabled = true; timeEl.textContent = '0:00';
    timer = setInterval(() => {
      const s2 = (performance.now() - startedAt) / 1000;
      timeEl.textContent = fmt(s2);
      if (s2 >= cfg.maxSeconds) { cfg.onError('rec.max'); stop(); }
    }, 250);
  }
  function stop() { if (rec && rec.state === 'recording') rec.stop(); }

  function init(c) {
    cfg = c;
    if (!supported()) return;
    const host = c.pickBtn.parentNode;
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pbtn rec-btn'; btn.onclick = start;
    bar = document.createElement('div'); bar.className = 'rec-bar'; bar.hidden = true;
    bar.innerHTML = '<i class="rec-dot"></i><span></span><b class="rec-time">0:00</b>';
    timeEl = bar.querySelector('b');
    stopBtn = document.createElement('button'); stopBtn.type = 'button'; stopBtn.className = 'pbtn'; stopBtn.onclick = stop;
    bar.append(stopBtn);
    preview = document.createElement('audio'); preview.controls = true; preview.hidden = true; preview.className = 'rec-prev';
    c.pickBtn.after(btn, bar);
    const info = host.querySelector('.meta');
    (info || bar).after(preview);
    labels();
    document.addEventListener('langchange', labels);
  }
  return { init, clear };
})();
