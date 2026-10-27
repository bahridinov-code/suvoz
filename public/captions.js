// Caption engine for the subtitles page.
// Splits words into short lines and draws them on a canvas with one of 10 animated styles.
// The same drawing is used for the live preview and for the exported video.
(function (root) {
  'use strict';

  const FALLBACK = 'Inter, "Noto Sans Arabic", system-ui, sans-serif';
  const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

  // Fonts people can choose for their own styles. Inter is on our site; the others come from Google Fonts when first used.
  const FONTS = [
    { key: 'inter', name: 'Inter', fam: 'Inter', weights: [500, 600, 700, 800, 900] },
    { key: 'montserrat', name: 'Montserrat', fam: 'Montserrat', g: 'Montserrat:wght@500;600;700;800;900', weights: [500, 600, 700, 800, 900] },
    { key: 'oswald', name: 'Oswald', fam: 'Oswald', g: 'Oswald:wght@500;600;700', weights: [500, 600, 700] },
    { key: 'rubik', name: 'Rubik', fam: 'Rubik', g: 'Rubik:wght@500;600;700;800;900', weights: [500, 600, 700, 800, 900] },
    { key: 'unbounded', name: 'Unbounded', fam: 'Unbounded', g: 'Unbounded:wght@500;600;700;800;900', weights: [500, 600, 700, 800, 900] },
    { key: 'russo', name: 'Russo One', fam: 'Russo One', g: 'Russo+One', weights: [400] },
    { key: 'comfortaa', name: 'Comfortaa', fam: 'Comfortaa', g: 'Comfortaa:wght@600;700', weights: [600, 700] },
    { key: 'bebas', name: 'Bebas Neue', fam: 'Bebas Neue', g: 'Bebas+Neue', weights: [400] },
    { key: 'anton', name: 'Anton', fam: 'Anton', g: 'Anton', weights: [400] },
    { key: 'bangers', name: 'Bangers', fam: 'Bangers', g: 'Bangers', weights: [400] },
  ];
  const fontOf = (key) => FONTS.find((f) => f.key === key) || FONTS[0];
  const family = (tpl) => { const f = fontOf(tpl.font); return f.key === 'inter' ? FALLBACK : '"' + f.fam + '", ' + FALLBACK; };
  const weightOf = (tpl) => { const ws = fontOf(tpl.font).weights; return ws.reduce((a, b) => (Math.abs(b - tpl.weight) < Math.abs(a - tpl.weight) ? b : a), ws[0]); };
  const fontCss = (tpl, fs) => weightOf(tpl) + ' ' + fs + 'px ' + family(tpl);

  // Each style: how many words per caption, look and animation. "accent" is the highlight colour people can change.
  const TEMPLATES = [
    { id: 'bold', name: 'Bold Pop', maxWords: 3, maxChars: 18, lines: 2, weight: 900, upper: true, scale: 1, gap: 0.22, accent: '#FFE600' },
    { id: 'box', name: 'Highlight Box', maxWords: 3, maxChars: 18, lines: 2, weight: 800, upper: true, scale: 0.95, gap: 0.3, accent: '#22C55E' },
    { id: 'karaoke', name: 'Karaoke', maxWords: 7, maxChars: 32, lines: 2, weight: 800, upper: false, scale: 0.72, gap: 0.05, accent: '#FFD60A' },
    { id: 'neon', name: 'Neon', maxWords: 4, maxChars: 22, lines: 2, weight: 800, upper: true, scale: 0.9, gap: 0.15, accent: '#FF3DF2' },
    { id: 'oneword', name: 'One Word', maxWords: 1, maxChars: 14, lines: 1, weight: 900, upper: true, scale: 1.45, gap: 0, accent: '#FFE600' },
    { id: 'comic', name: 'Retro 3D', maxWords: 3, maxChars: 16, lines: 2, weight: 900, upper: true, scale: 1, gap: 0.25, accent: '#FF4D6D' },
    { id: 'gradient', name: 'Sunset', maxWords: 3, maxChars: 18, lines: 2, weight: 900, upper: true, scale: 1, gap: 0.18, accent: '#FF8A00' },
    { id: 'pill', name: 'Bubble', maxWords: 5, maxChars: 26, lines: 2, weight: 700, upper: false, scale: 0.75, gap: 0.08, accent: '#7FE3DD' },
    { id: 'type', name: 'Typewriter', maxWords: 6, maxChars: 28, lines: 2, weight: 700, upper: false, scale: 0.78, gap: 0.05, accent: '#FFFFFF' },
    { id: 'clean', name: 'Clean', maxWords: 8, maxChars: 36, lines: 2, weight: 600, upper: false, scale: 0.66, gap: 0.03, accent: '#FFFFFF' },
  ];
  // Colours of each style: text, outline (and its thickness as a share of the letter size), shadow strength, background.
  const PAINT = {
    bold: { text: '#FFFFFF', outline: '#000000', outlineW: 0.17, shadow: 0.45, bg: '#000000', bgAlpha: 0 },
    box: { text: '#FFFFFF', outline: '#000000', outlineW: 0.1, shadow: 0.85, bg: '#000000', bgAlpha: 0 },
    karaoke: { text: '#FFFFFF', outline: '#000000', outlineW: 0.14, shadow: 0, bg: '#000000', bgAlpha: 0 },
    neon: { text: '#FFFFFF', outline: '#00E5FF', outlineW: 0.09, shadow: 0.9, bg: '#000000', bgAlpha: 0 },
    oneword: { text: '#FFFFFF', outline: '#000000', outlineW: 0.15, shadow: 0.5, bg: '#000000', bgAlpha: 0 },
    comic: { text: '#FFF7D6', outline: '#111111', outlineW: 0.08, shadow: 0, bg: '#3B3FE0', bgAlpha: 1 },
    gradient: { text: '#FFFFFF', outline: '#140A1E', outlineW: 0.13, shadow: 0.4, bg: '#000000', bgAlpha: 0 },
    pill: { text: '#FFFFFF', outline: '#000000', outlineW: 0, shadow: 0, bg: '#0C0C14', bgAlpha: 0.72 },
    type: { text: '#FFFFFF', outline: '#000000', outlineW: 0.1, shadow: 0.5, bg: '#000000', bgAlpha: 0 },
    clean: { text: '#FFFFFF', outline: '#000000', outlineW: 0, shadow: 0.35, bg: '#000000', bgAlpha: 0.38 },
  };
  TEMPLATES.forEach((x) => Object.assign(x, PAINT[x.id], { anim: x.id, font: 'inter' }));

  // People's own styles (and the one being edited) live here next to the built-in ones.
  const custom = new Map();
  const num = (x, a, b, d) => { x = Number(x); return isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
  const hex = (x, d) => (/^#[0-9a-f]{6}$/i.test(String(x || '')) ? String(x).toUpperCase() : d);
  // Turns saved settings into a full style, filling anything missing from the style it is based on.
  function makeStyle(id, name, st) {
    st = st || {};
    const b = TEMPLATES.find((x) => x.id === st.base) || TEMPLATES[0];
    const mw = Math.round(num(st.maxWords, 1, 10, b.maxWords));
    return {
      ...b, id, name: String(name || b.name).slice(0, 40), custom: true, base: b.id, anim: b.id,
      maxWords: mw, lines: mw === 1 ? 1 : 2,
      maxChars: mw === 1 ? 16 : Math.round(num(b.maxChars * mw / Math.max(1, b.maxWords), 10, 48, b.maxChars)),
      font: fontOf(st.font).key, weight: Math.round(num(st.weight, 400, 900, b.weight) / 100) * 100,
      upper: st.upper == null ? b.upper : !!st.upper, scale: b.scale * num(st.scale, 0.5, 2, 1),
      accent: hex(st.accent, b.accent), text: hex(st.text, b.text), outline: hex(st.outline, b.outline),
      outlineW: num(st.outlineW, 0, 0.3, b.outlineW), shadow: num(st.shadow, 0, 1, b.shadow),
      bg: hex(st.bg, b.bg), bgAlpha: num(st.bgAlpha, 0, 1, b.bgAlpha),
    };
  }
  // The settings to save for a style (the reverse of makeStyle).
  function settingsOf(tpl) {
    const b = TEMPLATES.find((x) => x.id === tpl.anim) || TEMPLATES[0];
    return { base: b.id, font: tpl.font, weight: tpl.weight, maxWords: tpl.maxWords, upper: tpl.upper, scale: Math.round((tpl.scale / b.scale) * 100) / 100,
      accent: tpl.accent, text: tpl.text, outline: tpl.outline, outlineW: tpl.outlineW, shadow: tpl.shadow, bg: tpl.bg, bgAlpha: tpl.bgAlpha };
  }
  function setCustom(id, name, st) { const x = makeStyle(id, name, st); custom.set(id, x); return x; }
  function removeCustom(id) { custom.delete(id); }
  const byId = (id) => custom.get(id) || TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
  const has = (id) => custom.has(id) || TEMPLATES.some((x) => x.id === id);

  // ---------- grouping ----------
  function group(words, tpl) {
    const out = [];
    let cur = null, chars = 0;
    const flush = () => { if (cur && cur.w.length) { cur.s = cur.w[0].s; cur.e = cur.w[cur.w.length - 1].e; out.push(cur); } cur = null; chars = 0; };
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!w || !w.t) continue;
      const len = w.t.length;
      const prev = cur && cur.w[cur.w.length - 1];
      if (cur && (cur.w.length >= tpl.maxWords || chars + 1 + len > tpl.maxChars || (prev && w.s - prev.e > 0.7))) flush();
      if (!cur) cur = { w: [], i0: i };
      cur.w.push(w);
      chars += (cur.w.length > 1 ? 1 : 0) + len;
      if (/[.!?…。！？]["»”)]?$/.test(w.t)) flush();
      else if (/[,;:،]$/.test(w.t) && cur.w.length >= 2 && tpl.maxWords > 2) flush();
    }
    flush();
    return out;
  }

  // ---------- small helpers ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  function easeBack(x) { x = clamp(x, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // Which caption is on screen at time t (stays a little after the last word, until the next one starts).
  function activeIndex(groups, t) {
    let lo = 0, hi = groups.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (groups[mid].s <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    if (idx < 0) return -1;
    const g = groups[idx], next = groups[idx + 1];
    const until = Math.min(g.e + 0.6, next ? next.s : Infinity);
    return t < until ? idx : -1;
  }

  // ---------- layout ----------
  function layout(ctx, g, tpl, fs, W, upper) {
    ctx.font = fontCss(tpl, fs);
    const space = ctx.measureText(' ').width + fs * (tpl.gap || 0);
    const maxW = W * 0.86;
    const items = g.w.map((w) => { const text = upper ? w.t.toLocaleUpperCase() : w.t; return { w, text, width: ctx.measureText(text).width }; });
    const lines = [[]];
    let lineW = 0;
    for (const it of items) {
      const line = lines[lines.length - 1];
      const add = (line.length ? space : 0) + it.width;
      if (line.length && lineW + add > maxW) { lines.push([it]); lineW = it.width; }
      else { line.push(it); lineW += add; }
    }
    return { lines, space };
  }

  // ---------- drawing ----------
  // project: { groups, template, pos (0..1), size (multiplier), upper (null = style default), color (null = style default), watermark }
  function draw(ctx, W, H, t, project) {
    const tpl = byId(project.template);
    const groups = project.groups || [];
    if (project.watermark) drawWatermark(ctx, W, H);
    const gi = activeIndex(groups, t);
    if (gi < 0) return;
    const g = groups[gi];
    const accent = project.color || tpl.accent;
    const upper = project.upper == null ? tpl.upper : !!project.upper;
    let fs = Math.round(Math.min(W, H) * 0.1 * (project.size || 1) * tpl.scale);

    let L = layout(ctx, g, tpl, fs, W, upper);
    // Too many lines for this style: shrink until it fits.
    for (let k = 0; k < 6 && L.lines.length > tpl.lines; k++) { fs = Math.round(fs * 0.88); L = layout(ctx, g, tpl, fs, W, upper); }
    const lineH = fs * 1.22;
    const blockH = L.lines.length * lineH;
    const cy = H * clamp(project.pos == null ? 0.72 : project.pos, 0.08, 0.92);
    const top = cy - blockH / 2;
    const rtl = RTL.test(g.w.map((w) => w.t).join(''));
    const age = t - g.s;

    // Positions of every word.
    const placed = [];
    L.lines.forEach((line, li) => {
      const lw = line.reduce((a, it, i) => a + it.width + (i ? L.space : 0), 0);
      let x = rtl ? W / 2 + lw / 2 : W / 2 - lw / 2;
      const y = top + li * lineH + lineH / 2;
      line.forEach((it) => {
        const cx = rtl ? x - it.width / 2 : x + it.width / 2;
        placed.push({ ...it, cx, cy: y, li });
        x += (rtl ? -1 : 1) * (it.width + L.space);
      });
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = fontCss(tpl, fs);

    // Whole caption pops in for the punchy styles.
    const pop = { bold: 1, comic: 1, box: 1, gradient: 1, neon: 1 }[tpl.anim] ? 0.85 + 0.15 * easeBack(age / 0.22) : 1;
    if (pop !== 1) { ctx.translate(W / 2, cy); ctx.scale(pop, pop); ctx.translate(-W / 2, -cy); }

    if (tpl.anim === 'pill' && tpl.bgAlpha > 0) {
      L.lines.forEach((line, li) => {
        const lw = line.reduce((a, it, i) => a + it.width + (i ? L.space : 0), 0);
        const y = top + li * lineH;
        ctx.fillStyle = rgba(tpl.bg, tpl.bgAlpha);
        roundRect(ctx, W / 2 - lw / 2 - fs * 0.45, y + lineH * 0.06, lw + fs * 0.9, lineH * 0.9, fs * 0.45);
        ctx.fill();
      });
    }
    if (tpl.anim !== 'pill' && tpl.anim !== 'comic' && tpl.bgAlpha > 0) {
      ctx.fillStyle = rgba(tpl.bg, tpl.bgAlpha);
      const maxLw = Math.max(...L.lines.map((line) => line.reduce((a, it, i) => a + it.width + (i ? L.space : 0), 0)));
      roundRect(ctx, W / 2 - maxLw / 2 - fs * 0.5, top - fs * 0.12, maxLw + fs, blockH + fs * 0.24, fs * 0.28);
      ctx.fill();
    }

    placed.forEach((p, k) => {
      const w = p.w;
      const state = t >= w.e ? 'past' : t >= w.s ? 'now' : 'next';
      const prog = clamp((t - w.s) / Math.max(0.05, w.e - w.s), 0, 1);
      const since = t - w.s;
      STYLES[tpl.anim](ctx, p, { state, prog, since, accent, fs, k, rtl, W, H, t, tpl, text: tpl.text, line: tpl.outlineW > 0 ? tpl.outline : null, lw: fs * tpl.outlineW, sh: tpl.shadow > 0 ? 'rgba(0,0,0,' + tpl.shadow + ')' : null });
    });
    ctx.restore();
  }

  function word(ctx, p, o) {
    // o: { fill, stroke, strokeW, shadow, blur, ox, oy, scale, alpha, rot, dy }
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(p.cx, p.cy + (o.dy || 0));
    if (o.rot) ctx.rotate(o.rot);
    if (o.scale && o.scale !== 1) ctx.scale(o.scale, o.scale);
    if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 0; ctx.shadowOffsetX = o.ox || 0; ctx.shadowOffsetY = o.oy || 0; }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW; ctx.strokeText(p.text, 0, 0); ctx.shadowColor = 'transparent'; }
    ctx.fillStyle = o.fill;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }

  // s.text = text colour, s.line / s.lw = outline colour and width, s.sh = shadow colour, s.accent = highlight.
  const STYLES = {
    bold(ctx, p, s) {
      const on = s.state === 'now';
      word(ctx, p, { fill: on ? s.accent : s.text, stroke: s.line, strokeW: s.lw, shadow: s.sh, blur: s.fs * 0.12, oy: s.fs * 0.05,
        scale: on ? 1 + 0.1 * easeBack(s.since / 0.16) : 1 });
    },
    box(ctx, p, s) {
      const on = s.state === 'now';
      if (on) {
        const k = 0.75 + 0.25 * easeBack(s.since / 0.15);
        const w = (p.width + s.fs * 0.42) * k, h = s.fs * 1.18 * k;
        ctx.save();
        ctx.fillStyle = s.accent;
        ctx.translate(p.cx, p.cy);
        ctx.rotate(-0.025);
        roundRect(ctx, -w / 2, -h / 2, w, h, s.fs * 0.22);
        ctx.fill();
        ctx.restore();
      }
      word(ctx, p, { fill: s.text, shadow: on ? 'rgba(0,0,0,.25)' : s.sh, blur: s.fs * 0.18, oy: s.fs * 0.04, stroke: on ? null : (s.line ? rgba(s.tpl.outline, 0.65) : null), strokeW: s.lw });
    },
    karaoke(ctx, p, s) {
      word(ctx, p, { fill: s.text, stroke: s.line, strokeW: s.lw, shadow: s.sh, blur: s.fs * 0.12 });
      const part = s.state === 'past' ? 1 : s.state === 'now' ? s.prog : 0;
      if (part <= 0) return;
      ctx.save();
      ctx.beginPath();
      const left = p.cx - p.width / 2 - s.fs * 0.1, width = (p.width + s.fs * 0.2) * part;
      if (s.rtl) ctx.rect(p.cx + p.width / 2 + s.fs * 0.1 - width, p.cy - s.fs, width, s.fs * 2);
      else ctx.rect(left, p.cy - s.fs, width, s.fs * 2);
      ctx.clip();
      word(ctx, p, { fill: s.accent, stroke: s.line, strokeW: s.lw });
      ctx.restore();
    },
    neon(ctx, p, s) {
      const on = s.state === 'now';
      const glow = on ? s.accent : s.tpl.outline;
      const k = Math.max(0.15, s.tpl.shadow);
      word(ctx, p, { fill: s.text, shadow: glow, blur: s.fs * (on ? 1 : 0.6) * k, stroke: s.line ? glow : null, strokeW: s.lw, scale: on ? 1.06 : 1 });
      word(ctx, p, { fill: s.text, shadow: glow, blur: s.fs * 0.4 * k, scale: on ? 1.06 : 1 });
    },
    oneword(ctx, p, s) {
      const colors = s.tpl.custom ? [s.text, s.accent] : [s.text, s.accent, '#4ADE80'];
      const k = 1.35 - 0.35 * easeOut(s.since / 0.14);
      word(ctx, p, { fill: colors[(p.w.s * 7 | 0) % colors.length], stroke: s.line, strokeW: s.lw, shadow: s.sh, blur: s.fs * 0.1, oy: s.fs * 0.06, scale: Math.max(1, k) });
    },
    comic(ctx, p, s) {
      const on = s.state === 'now';
      const rot = (s.k % 2 ? 1 : -1) * 0.045;
      const sc = on ? 1 + 0.12 * easeBack(s.since / 0.15) : 1;
      const d = s.fs * 0.045;
      if (s.tpl.bgAlpha > 0) for (let i = 6; i >= 1; i--) word(ctx, p, { fill: on ? s.accent : rgba(s.tpl.bg, s.tpl.bgAlpha), rot, scale: sc, dy: d * i * 0.6 });
      word(ctx, p, { fill: on && s.tpl.bgAlpha === 0 ? s.accent : s.text, stroke: s.line, strokeW: s.lw, rot, scale: sc });
    },
    gradient(ctx, p, s) {
      const on = s.state === 'now';
      const g = ctx.createLinearGradient(0, -s.fs * 0.5, 0, s.fs * 0.5);
      g.addColorStop(0, '#FFE259'); g.addColorStop(0.55, s.accent); g.addColorStop(1, '#FF2E63');
      const bounce = on ? -Math.sin(clamp(s.since / 0.25, 0, 1) * Math.PI) * s.fs * 0.14 : 0;
      word(ctx, p, { fill: on ? g : s.text, stroke: s.line ? rgba(s.tpl.outline, 0.9) : null, strokeW: s.lw, shadow: s.sh, blur: s.fs * 0.12, oy: s.fs * 0.05, dy: bounce });
    },
    pill(ctx, p, s) {
      const on = s.state === 'now';
      word(ctx, p, { fill: on ? s.accent : s.state === 'past' ? s.text : rgba(s.text, 0.72), stroke: s.line, strokeW: s.lw, shadow: s.sh, blur: s.fs * 0.1, scale: on ? 1.05 : 1 });
    },
    type(ctx, p, s) {
      if (s.state === 'next') return;
      const a = easeOut(s.since / 0.12);
      word(ctx, p, { fill: s.state === 'now' ? s.accent : s.text, stroke: s.line ? rgba(s.tpl.outline, 0.8) : null, strokeW: s.lw, shadow: s.sh, blur: s.fs * 0.15, alpha: a, dy: (1 - a) * s.fs * 0.3 });
    },
    clean(ctx, p, s) {
      word(ctx, p, { fill: s.state === 'next' ? rgba(s.text, 0.62) : (s.tpl.custom ? s.accent : s.accent), stroke: s.line, strokeW: s.lw, shadow: s.sh, blur: s.fs * 0.1 });
    },
  };

  function drawWatermark(ctx, W, H) {
    const fs = Math.round(Math.min(W, H) * 0.032);
    ctx.save();
    ctx.font = '700 ' + fs + 'px ' + FALLBACK;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = fs * 0.4;
    ctx.fillText('Made with suvoz.io', W - fs * 0.9, H - fs * 0.9);
    ctx.restore();
  }

  // ---------- SRT ----------
  function srtTime(x) {
    const ms = Math.max(0, Math.round(x * 1000));
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
    const p = (n, l) => String(n).padStart(l, '0');
    return p(h, 2) + ':' + p(m, 2) + ':' + p(s, 2) + ',' + p(r, 3);
  }
  function srt(groups) {
    return groups.map((g, i) => {
      const next = groups[i + 1];
      const end = Math.min(g.e + 0.4, next ? next.s : g.e + 0.4);
      return (i + 1) + '\n' + srtTime(g.s) + ' --> ' + srtTime(Math.max(end, g.s + 0.3)) + '\n' + g.w.map((w) => w.t).join(' ') + '\n';
    }).join('\n');
  }

  // Fonts must be ready before the canvas can use them.
  function ready() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const w = [600, 700, 800, 900];
    return Promise.all(w.map((x) => document.fonts.load(x + ' 40px Inter', 'AaЖжЎў'))).then(() => document.fonts.load('700 40px "Noto Sans Arabic"', 'ع').catch(() => {})).catch(() => {});
  }
  // Loads a Google font the first time a style uses it. Never fails: if it cannot load, Inter is used.
  const loading = new Map();
  function ensureFont(key) {
    const f = fontOf(key);
    if (!f.g || typeof document === 'undefined') return Promise.resolve();
    if (loading.has(f.key)) return loading.get(f.key);
    const p = new Promise((ok) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + f.g + '&display=swap';
      link.onload = () => { Promise.all(f.weights.map((w) => document.fonts.load(w + ' 40px "' + f.fam + '"', 'AaЖж'))).then(ok, ok); };
      link.onerror = () => ok();
      document.head.appendChild(link);
      setTimeout(ok, 6000);
    });
    loading.set(f.key, p);
    return p;
  }

  root.Captions = { TEMPLATES, FONTS, PAINT, byId, has, group, draw, srt, ready, ensureFont, activeIndex, makeStyle, settingsOf, setCustom, removeCustom };
})(window);
