// Burns the captions into the video, inside the browser (nothing big is uploaded).
// Best path: the browser's own encoders (WebCodecs) + our MP4 writer.
// Fallback for browsers without them: record the canvas while the video plays.
(function (root) {
  'use strict';

  const FPS = 30;

  function outSize(w, h) {
    const k = Math.min(1, 1920 / Math.max(w, h), 1080 / Math.min(w, h));
    const even = (x) => Math.max(2, Math.round((x * k) / 2) * 2);
    return { w: even(w), h: even(h) };
  }
  function once(el, ev) { return new Promise((ok, no) => { const f = () => { el.removeEventListener(ev, f); el.removeEventListener('error', g); ok(); }; const g = () => { el.removeEventListener(ev, f); el.removeEventListener('error', g); no(new Error('video')); }; el.addEventListener(ev, f); el.addEventListener('error', g); }); }

  async function loadVideo(url, muted) {
    const v = document.createElement('video');
    v.muted = muted; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.src = url;
    if (v.readyState < 2) await once(v, 'loadeddata');
    return v;
  }

  async function pickVideoConfig(w, h) {
    if (typeof VideoEncoder === 'undefined') return null;
    const bitrate = Math.round(Math.min(12e6, Math.max(2.5e6, w * h * FPS * 0.11)));
    const tries = [
      { codec: 'avc1.640028', kind: 'avc', avc: { format: 'avc' } },
      { codec: 'avc1.4d0028', kind: 'avc', avc: { format: 'avc' } },
      { codec: 'avc1.42e028', kind: 'avc', avc: { format: 'avc' } },
      { codec: 'vp09.00.40.08', kind: 'vp9' },
    ];
    for (const c of tries) {
      const cfg = { codec: c.codec, width: w, height: h, bitrate, framerate: FPS, latencyMode: 'quality' };
      if (c.avc) cfg.avc = c.avc;
      try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, kind: c.kind }; } catch (e) {}
    }
    return null;
  }
  async function pickAudioConfig(rate, ch) {
    if (typeof AudioEncoder === 'undefined') return null;
    const tries = [{ codec: 'mp4a.40.2', kind: 'aac', rate }, { codec: 'opus', kind: 'opus', rate: 48000 }];
    for (const c of tries) {
      const cfg = { codec: c.codec, sampleRate: c.rate, numberOfChannels: ch, bitrate: 128000 };
      try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, kind: c.kind }; } catch (e) {}
    }
    return null;
  }
  async function resample(buf, rate, ch) {
    if (buf.sampleRate === rate && buf.numberOfChannels === ch) return buf;
    const oc = new OfflineAudioContext(ch, Math.ceil(buf.duration * rate), rate);
    const s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start();
    return oc.startRendering();
  }

  // ---------- path 1: WebCodecs ----------
  async function viaCodecs(o, vcfg) {
    const { file, project, audio, onProgress, signal } = o;
    const url = URL.createObjectURL(file);
    const v = await loadVideo(url, true);
    const size = outSize(v.videoWidth, v.videoHeight);
    const W = size.w, H = size.h;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false });
    const ch = audio ? Math.min(2, audio.numberOfChannels) : 0;
    const acfg = audio ? await pickAudioConfig(audio.sampleRate === 44100 || audio.sampleRate === 48000 ? audio.sampleRate : 48000, ch) : null;

    const mux = new Mp4Mux({ video: { codec: vcfg.kind, width: W, height: H }, audio: acfg ? { codec: acfg.kind, sampleRate: acfg.cfg.sampleRate, channels: ch } : null });
    let failed = null;
    const venc = new VideoEncoder({ output: (c, m) => mux.addVideo(c, m), error: (e) => { failed = e; } });
    venc.configure({ ...vcfg.cfg, width: W, height: H });

    // Sound first (fast): turn the decoded sound into AAC/Opus.
    if (acfg) {
      const buf = await resample(audio, acfg.cfg.sampleRate, ch);
      const aenc = new AudioEncoder({ output: (c, m) => mux.addAudio(c, m), error: (e) => { failed = e; } });
      aenc.configure(acfg.cfg);
      const step = 4096, total = buf.length;
      for (let i = 0; i < total; i += step) {
        const n = Math.min(step, total - i);
        const data = new Float32Array(n * ch);
        for (let c = 0; c < ch; c++) data.set(buf.getChannelData(c).subarray(i, i + n), c * n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: buf.sampleRate, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round((i / buf.sampleRate) * 1e6), data });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush(); aenc.close();
    }

    const dur = v.duration;
    const draw = (t) => {
      ctx.drawImage(v, 0, 0, W, H);
      Captions.draw(ctx, W, H, t, project);
    };
    let n = 0, last = -1;
    // Draws the frame now and hands it to the encoder (the encoder works in the background).
    const take = (t) => {
      if (failed) throw failed;
      const ts = Math.round(t * 1e6);
      if (ts <= last) return;
      last = ts;
      draw(t);
      const f = new VideoFrame(canvas, { timestamp: ts, duration: Math.round(1e6 / FPS) });
      venc.encode(f, { keyFrame: n % (FPS * 2) === 0 });
      f.close(); n++;
      onProgress(Math.min(0.99, t / dur));
    };
    const drain = async (limit) => { while (venc.encodeQueueSize > limit) { if (failed) throw failed; await new Promise((r) => setTimeout(r, 4)); } };

    try {
      if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
        // Play the video and take every frame it shows. If the encoder falls behind, pause until it catches up.
        await new Promise((ok, no) => {
          let done = false, waiting = false;
          const finish = (err) => { if (done) return; done = true; v.pause(); err ? no(err) : ok(); };
          const onFrame = (now, meta) => {
            if (done) return;
            if (signal.aborted) return finish(new Error('cancel'));
            try { take(meta.mediaTime); } catch (e) { return finish(e); }
            v.requestVideoFrameCallback(onFrame);
            if (!waiting && venc.encodeQueueSize > 10) {
              waiting = true; v.pause();
              drain(2).then(() => { waiting = false; if (!done && !v.ended) v.play().catch(finish); }, finish);
            }
          };
          v.requestVideoFrameCallback(onFrame);
          v.onended = () => finish();
          v.onerror = () => finish(new Error('video'));
          v.play().catch(finish);
        });
      } else {
        // Step through the video frame by frame.
        const frames = Math.ceil(dur * FPS);
        for (let i = 0; i < frames; i++) {
          if (signal.aborted) throw new Error('cancel');
          const t = i / FPS;
          if (Math.abs(v.currentTime - t) > 0.001) { v.currentTime = t; await once(v, 'seeked'); }
          take(t);
          await drain(6);
        }
      }
      await venc.flush();
      if (failed) throw failed;
    } finally {
      try { venc.close(); } catch (e) {}
      v.pause(); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url);
    }
    onProgress(1);
    return { blob: new Blob([mux.finish()], { type: 'video/mp4' }), ext: 'mp4' };
  }

  // ---------- path 2: record while playing ----------
  async function viaRecorder(o) {
    const { file, project, onProgress, signal } = o;
    if (typeof MediaRecorder === 'undefined') throw new Error('unsupported');
    const url = URL.createObjectURL(file);
    const v = await loadVideo(url, false);
    const size = outSize(v.videoWidth, v.videoHeight);
    const canvas = document.createElement('canvas'); canvas.width = size.w; canvas.height = size.h;
    const ctx = canvas.getContext('2d', { alpha: false });
    const stream = canvas.captureStream(FPS);
    let ac = null;
    try {
      ac = new AudioContext();
      const src = ac.createMediaElementSource(v);
      const dest = ac.createMediaStreamDestination();
      src.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    } catch (e) {}
    const types = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const mime = types.find((x) => MediaRecorder.isTypeSupported(x)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : { videoBitsPerSecond: 8e6 });
    const parts = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
    const draw = () => { ctx.drawImage(v, 0, 0, size.w, size.h); Captions.draw(ctx, size.w, size.h, v.currentTime, project); onProgress(Math.min(0.99, v.currentTime / v.duration)); };
    let live = true;
    const loop = () => { if (!live) return; draw(); requestAnimationFrame(loop); };
    try {
      if (ac && ac.state === 'suspended') await ac.resume();
      draw();
      rec.start(1000);
      loop();
      await new Promise((ok, no) => {
        v.onended = ok;
        const chk = setInterval(() => { if (signal.aborted) { clearInterval(chk); no(new Error('cancel')); } }, 200);
        v.addEventListener('ended', () => clearInterval(chk));
        v.play().catch(no);
      });
      draw();
      await new Promise((ok) => { rec.onstop = ok; rec.stop(); });
    } finally {
      live = false;
      if (rec.state !== 'inactive') try { rec.stop(); } catch (e) {}
      v.pause(); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url);
      if (ac) ac.close().catch(() => {});
    }
    onProgress(1);
    const type = rec.mimeType || mime || 'video/webm';
    return { blob: new Blob(parts, { type }), ext: /mp4/.test(type) ? 'mp4' : 'webm' };
  }

  // o: { file, project, audio (AudioBuffer or null), onProgress(0..1), signal }
  async function run(o) {
    await Captions.ready();
    const purl = URL.createObjectURL(o.file);
    const probe = await loadVideo(purl, true);
    const size = outSize(probe.videoWidth, probe.videoHeight);
    probe.removeAttribute('src'); probe.load(); URL.revokeObjectURL(purl);
    const vcfg = typeof VideoFrame !== 'undefined' ? await pickVideoConfig(size.w, size.h) : null;
    if (vcfg) {
      try { return await viaCodecs(o, vcfg); }
      catch (e) { if (e.message === 'cancel') throw e; console.warn('codecs export failed, recording instead', e); }
    }
    return viaRecorder(o);
  }

  root.SubExport = { run, outSize };
})(window);
