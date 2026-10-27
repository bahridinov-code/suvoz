// Tiny MP4 writer for the subtitles export.
// Takes encoded video (H.264 or VP9) and audio (AAC or Opus) from the browser's encoders
// and puts them in one .mp4 file. Works in the browser and in Node (for tests).
(function (root) {
  'use strict';

  function u8(n) { return [n & 255]; }
  function u16(n) { return [(n >> 8) & 255, n & 255]; }
  function u24(n) { return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function str(s) { const a = []; for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 255); return a; }
  function zeros(n) { return new Array(n).fill(0); }
  function bytes(x) {
    if (!x) return [];
    if (x instanceof ArrayBuffer) return Array.from(new Uint8Array(x));
    if (ArrayBuffer.isView(x)) return Array.from(new Uint8Array(x.buffer, x.byteOffset, x.byteLength));
    return Array.from(x);
  }
  function flat(parts) {
    let out = [];
    for (const p of parts) { if (Array.isArray(p)) { for (let i = 0; i < p.length; i++) out.push(p[i]); } }
    return out;
  }
  function box(type, ...parts) {
    const body = flat(parts);
    return flat([u32(body.length + 8), str(type), body]);
  }
  function fullBox(type, version, flags, ...parts) { return box(type, u8(version), u24(flags), ...parts); }
  const MATRIX = flat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);

  // Descriptor length for the audio "esds" box (always written in 4 bytes).
  function descLen(n) { return [0x80 | ((n >> 21) & 0x7f), 0x80 | ((n >> 14) & 0x7f), 0x80 | ((n >> 7) & 0x7f), n & 0x7f]; }
  function desc(tag, body) { return flat([u8(tag), descLen(body.length), body]); }

  class Mp4Mux {
    // opts: { video: { codec: 'avc' | 'vp9', width, height }, audio: { codec: 'aac' | 'opus', sampleRate, channels } | null }
    constructor(opts) {
      this.v = opts.video ? { ...opts.video, samples: [], desc: null, color: null } : null;
      this.a = opts.audio ? { ...opts.audio, samples: [], desc: null } : null;
    }
    // chunk: EncodedVideoChunk (or { data, timestamp, duration, type }) ; meta: the encoder's metadata
    addVideo(chunk, meta) {
      if (!this.v) return;
      if (meta && meta.decoderConfig) {
        if (meta.decoderConfig.description) this.v.desc = bytes(meta.decoderConfig.description);
        if (meta.decoderConfig.colorSpace) this.v.color = meta.decoderConfig.colorSpace;
      }
      this.v.samples.push(sampleOf(chunk));
    }
    addAudio(chunk, meta) {
      if (!this.a) return;
      if (meta && meta.decoderConfig && meta.decoderConfig.description) this.a.desc = bytes(meta.decoderConfig.description);
      this.a.samples.push(sampleOf(chunk));
    }
    finish() {
      const tracks = [];
      if (this.v && this.v.samples.length) tracks.push(this.prepTrack(this.v, 'video', 90000));
      if (this.a && this.a.samples.length) tracks.push(this.prepTrack(this.a, 'audio', this.a.sampleRate));
      if (!tracks.length) throw new Error('nothing to write');
      tracks.forEach((t, i) => { t.id = i + 1; });

      // Samples are written to "mdat" in time order, so video and sound sit close together.
      const order = [];
      tracks.forEach((t) => t.samples.forEach((s, i) => order.push({ t, i, time: s.timestamp })));
      order.sort((x, y) => x.time - y.time || x.t.id - y.t.id);

      const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
      // Build moov once with placeholder offsets to learn its size, then again with the real ones.
      const fakeOffsets = (t) => t.samples.map(() => 0);
      tracks.forEach((t) => { t.offsets = fakeOffsets(t); });
      const moovSize = this.moov(tracks).length;
      let pos = ftyp.length + moovSize + 8;
      let mdatLen = 0;
      for (const o of order) { o.t.offsets[o.i] = pos; pos += o.t.samples[o.i].data.length; mdatLen += o.t.samples[o.i].data.length; }
      const moov = this.moov(tracks);
      if (moov.length !== moovSize) throw new Error('moov size changed');

      const out = new Uint8Array(ftyp.length + moov.length + 8 + mdatLen);
      let p = 0;
      out.set(ftyp, p); p += ftyp.length;
      out.set(moov, p); p += moov.length;
      out.set(u32(mdatLen + 8), p); p += 4;
      out.set(str('mdat'), p); p += 4;
      for (const o of order) { const d = o.t.samples[o.i].data; out.set(d, p); p += d.length; }
      return out;
    }

    prepTrack(src, kind, timescale) {
      const s = src.samples.slice().sort((x, y) => x.timestamp - y.timestamp);
      const t0 = s[0].timestamp;
      const ticks = s.map((x) => Math.round(((x.timestamp - t0) * timescale) / 1e6));
      const durs = s.map((x, i) => {
        if (i < s.length - 1) return Math.max(1, ticks[i + 1] - ticks[i]);
        if (x.duration) return Math.max(1, Math.round((x.duration * timescale) / 1e6));
        return i > 0 ? Math.max(1, ticks[i] - ticks[i - 1]) : Math.round(timescale / 30);
      });
      const total = durs.reduce((a, b) => a + b, 0);
      return { kind, src, timescale, samples: s, durs, total };
    }

    moov(tracks) {
      const movieMs = Math.max(...tracks.map((t) => Math.round((t.total * 1000) / t.timescale)));
      const mvhd = fullBox('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieMs), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(tracks.length + 1));
      return box('moov', mvhd, ...tracks.map((t) => this.trak(t, movieMs)));
    }

    trak(t, movieMs) {
      const isV = t.kind === 'video';
      const w = isV ? t.src.width : 0, h = isV ? t.src.height : 0;
      const tkhd = fullBox('tkhd', 0, 3, u32(0), u32(0), u32(t.id), u32(0), u32(Math.round((t.total * 1000) / t.timescale)), zeros(8), u16(0), u16(0), u16(isV ? 0 : 0x0100), u16(0), MATRIX, u32(w << 16), u32(h << 16));
      const mdhd = fullBox('mdhd', 0, 0, u32(0), u32(0), u32(t.timescale), u32(t.total), u16(0x55c4), u16(0));
      const hdlr = fullBox('hdlr', 0, 0, u32(0), str(isV ? 'vide' : 'soun'), zeros(12), str(isV ? 'VideoHandler' : 'SoundHandler'), [0]);
      const mhd = isV ? fullBox('vmhd', 0, 1, zeros(8)) : fullBox('smhd', 0, 0, zeros(4));
      const dinf = box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1)));
      const stbl = box('stbl', this.stsd(t), this.stts(t), isV ? this.stss(t) : [], fullBox('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
        fullBox('stsz', 0, 0, u32(0), u32(t.samples.length), flat(t.samples.map((s) => u32(s.data.length)))),
        fullBox('stco', 0, 0, u32(t.offsets.length), flat(t.offsets.map((o) => u32(o)))));
      return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', mhd, dinf, stbl)));
    }

    stts(t) {
      const runs = [];
      for (const d of t.durs) { const last = runs[runs.length - 1]; if (last && last[1] === d) last[0]++; else runs.push([1, d]); }
      return fullBox('stts', 0, 0, u32(runs.length), flat(runs.map((r) => flat([u32(r[0]), u32(r[1])]))));
    }
    stss(t) {
      const keys = [];
      t.samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
      if (!keys.length) keys.push(1);
      return fullBox('stss', 0, 0, u32(keys.length), flat(keys.map((k) => u32(k))));
    }

    stsd(t) {
      if (t.kind === 'video') {
        const v = t.src;
        const visual = (type, extra) => box(type, zeros(6), u16(1), zeros(16), u16(v.width), u16(v.height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xffff), extra);
        let entry;
        if (v.codec === 'avc') {
          if (!v.desc) throw new Error('missing avcC');
          entry = visual('avc1', box('avcC', v.desc));
        } else {
          const c = v.color || {};
          const prim = { bt709: 1, bt470bg: 5, smpte170m: 6 }[c.primaries] || 1;
          const tr = { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13 }[c.transfer] || 1;
          const mx = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6 }[c.matrix] || 1;
          const vpcC = fullBox('vpcC', 1, 0, u8(0), u8(10), u8((8 << 4) | (1 << 1) | (c.fullRange ? 1 : 0)), u8(prim), u8(tr), u8(mx), u16(0));
          entry = visual('vp09', vpcC);
        }
        return fullBox('stsd', 0, 0, u32(1), entry);
      }
      const a = t.src;
      const audio = (type, extra) => box(type, zeros(6), u16(1), zeros(8), u16(a.channels), u16(16), u16(0), u16(0), u32((a.sampleRate & 0xffff) << 16 >>> 0), extra);
      let entry;
      if (a.codec === 'aac') {
        const asc = a.desc && a.desc.length ? a.desc : ascFor(a.sampleRate, a.channels);
        const dsi = desc(0x05, asc);
        const dcd = desc(0x04, flat([u8(0x40), u8(0x15), u24(0), u32(0), u32(0), dsi]));
        const esd = desc(0x03, flat([u16(1), u8(0), dcd, desc(0x06, [0x02])]));
        entry = audio('mp4a', fullBox('esds', 0, 0, esd));
      } else {
        let pre = 3840;
        if (a.desc && a.desc.length >= 19 && String.fromCharCode(...a.desc.slice(0, 8)) === 'OpusHead') pre = a.desc[10] | (a.desc[11] << 8);
        const dOps = box('dOps', u8(0), u8(a.channels), u16(pre), u32(a.sampleRate), u16(0), u8(0));
        entry = audio('Opus', dOps);
      }
      return fullBox('stsd', 0, 0, u32(1), entry);
    }
  }

  function sampleOf(chunk) {
    let data;
    if (chunk.copyTo) { data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); }
    else data = chunk.data instanceof Uint8Array ? chunk.data : new Uint8Array(chunk.data);
    return { data, timestamp: chunk.timestamp || 0, duration: chunk.duration || 0, key: chunk.type === 'key' };
  }
  function ascFor(rate, ch) {
    const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    let i = rates.indexOf(rate); if (i < 0) i = 3;
    return [(2 << 3) | (i >> 1), ((i & 1) << 7) | (ch << 3)];
  }

  root.Mp4Mux = Mp4Mux;
  if (typeof module !== 'undefined' && module.exports) module.exports = Mp4Mux;
})(typeof window !== 'undefined' ? window : globalThis);
