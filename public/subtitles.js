// AI subtitles page: upload a video, get word-by-word captions, pick a style, export the video.
const $ = (id) => document.getElementById(id);
const MAX_SECONDS = 5 * 60, MAX_BYTES = 1024 * 1024 * 1024, CHARS_PER_SECOND = 3.75;
const SUB_LANGS = [['', null], ['en', 'English'], ['ru', 'Русский'], ['uz', 'Oʻzbekcha'], ['tg', 'Тоҷикӣ'], ['ar', 'العربية'], ['kk', 'Қазақша'], ['ky', 'Кыргызча'], ['tr', 'Türkçe'], ['es', 'Español'], ['pt', 'Português'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['hi', 'हिन्दी'], ['ur', 'اردو'], ['fa', 'فارسی'], ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어']];

let file = null, seconds = 0, busy = false, plan = 'free', trialChars = null, statusKey = null, statusVars = null;
let audio = null;            // decoded sound of the video, kept for the export
let project = null;          // { words, template, pos, size, upper, color }
let exporting = null;        // AbortController while exporting
let videoUrl = null;

// ---------- small helpers ----------
async function headers() {
  const s = await Auth.session();
  if (!s) { location.replace('/login'); throw new Error('login'); }
  return { Authorization: 'Bearer ' + s.access_token };
}
function errText(j, fallback) {
  if (j && j.code && T.en['err.' + j.code]) return t('err.' + j.code);
  return (j && j.error) || fallback;
}
function setStatus(key, isErr, raw, vars) {
  statusKey = key || null; statusVars = vars || null;
  $('status').textContent = raw || (key ? t(key, vars) : '');
  $('status').className = isErr ? 'err' : '';
}
function bar(p) {
  const b = $('bar');
  if (p == null) { b.hidden = true; return; }
  b.hidden = false;
  b.firstElementChild.style.width = Math.round(p * 100) + '%';
}
const mins = (n) => String(Math.max(0.01, Math.round(n * 100) / 100));
const fmt = (x) => { const s = Math.max(0, Math.floor(x)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const keyFor = (f) => 'suvoz_subs_' + f.name + '_' + f.size;

// ---------- account ----------
function renderTrial() {
  const el = $('trial');
  if (trialChars === null) { el.hidden = true; return; }
  el.hidden = false;
  const out = trialChars <= 0;
  el.className = 'pill' + (out ? ' out' : '');
  const m = Math.round((trialChars / 900) * 10) / 10;
  const pk = { starter: 's', creator: 'c', pro: 'p', business: 'b' }[plan];
  if (pk) el.textContent = out ? t('err.credits_over') : t('app.plan', { plan: t('price.' + pk + '.n'), m: String(m) });
  else el.textContent = out ? t('app.trial.over') : t('app.trial', { m: String(m) });
}
async function loadMe() {
  try {
    const r = await fetch('/api/me', { headers: await headers() });
    const j = await r.json();
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (!r.ok) return;
    plan = j.plan || 'free';
    trialChars = j.trialChars;
    $('who').textContent = j.email || '';
    $('who').hidden = !j.email;
    renderTrial();
    $('wmNote').hidden = plan !== 'free';
  } catch (e) {}
}

// ---------- step 1: choose a video ----------
function fillLangs() {
  const sel = $('lang'), cur = sel.value;
  sel.textContent = '';
  for (const [code, name] of SUB_LANGS) {
    const o = document.createElement('option');
    o.value = code; o.textContent = name || t('subs.lang.auto');
    sel.appendChild(o);
  }
  sel.value = cur || '';
}
function renderInfo() {
  const el = $('fileInfo');
  if (!file || !seconds) { el.textContent = ''; return; }
  const cost = Math.max(1, Math.ceil(seconds * CHARS_PER_SECOND)) / 900;
  el.textContent = file.name + ' — ' + t('subs.cost', { a: fmt(seconds), c: mins(cost) });
}
function readDuration(f) {
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (fn) => (x) => { URL.revokeObjectURL(u); fn(x); };
    v.onloadedmetadata = () => (isFinite(v.duration) && v.duration > 0 && v.videoWidth ? done(ok)(v.duration) : done(no)());
    v.onerror = () => done(no)();
    v.src = u;
  });
}
$('pick').onclick = () => $('file').click();
$('file').onchange = async () => {
  const f = $('file').files[0];
  file = null; seconds = 0; audio = null; $('go').disabled = true;
  setStatus(null); renderInfo();
  if (!f) return;
  if (f.size > MAX_BYTES) { setStatus('subs.err.big', true); return; }
  try { seconds = await readDuration(f); } catch (e) { setStatus('subs.err.bad', true); return; }
  if (seconds > MAX_SECONDS + 1) { seconds = 0; setStatus('subs.err.long', true); return; }
  file = f;
  renderInfo();
  // Same video as before? Use the saved subtitles, no new charge.
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(f)) || 'null');
    if (saved && Array.isArray(saved.words) && saved.words.length) {
      project = saved;
      openEditor();
      setStatus('subs.restored');
      return;
    }
  } catch (e) {}
  $('go').disabled = false;
};

// Decode the sound (kept for the export) and make a small 16 kHz mono WAV to send for transcription.
async function decodeAudio(f) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  try {
    const raw = await f.arrayBuffer();
    return await new Promise((ok, no) => {
      const p = ac.decodeAudioData(raw, ok, no);
      if (p && p.then) p.then(ok, no);
    });
  } finally { ac.close && ac.close().catch(() => {}); }
}
async function toWav(buf) {
  const rate = 16000;
  const oc = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * rate)), rate);
  const s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start();
  const out = await oc.startRendering();
  const pcm = out.getChannelData(0);
  const dv = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) { const x = Math.max(-1, Math.min(1, pcm[i])); dv.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([dv.buffer], { type: 'audio/wav' });
}

$('go').onclick = async () => {
  if (!file || busy) return;
  busy = true; $('go').disabled = true; Busy.start($('go'), 'stt');
  setStatus('subs.reading');
  try {
    try { audio = await decodeAudio(file); } catch (e) { throw new Error(t('subs.err.nosound')); }
    const wav = await toWav(audio);
    setStatus('subs.working');
    const h = await headers();
    h['Content-Type'] = 'audio/wav';
    h['X-Duration'] = String(seconds);
    h['X-Words'] = '1';
    if ($('lang').value) h['X-Lang'] = $('lang').value;
    const r = await fetch('/api/transcribe', { method: 'POST', headers: h, body: wav });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (!r.ok) throw new Error(errText(j, t('err.stt_failed')));
    const words = (j.words || []).filter((w) => w && w.t);
    if (!words.length) throw new Error(t('err.stt_empty'));
    project = { words, template: 'bold', pos: 0.72, size: 1, upper: null, color: null, lang: j.language || '' };
    save();
    openEditor();
    setStatus(null);
    loadMe();
  } catch (e) {
    if (e.message !== 'login') setStatus(null, true, e.message === 'Failed to fetch' ? t('err.stt_failed') : e.message);
  } finally {
    busy = false; Busy.stop($('go')); $('go').disabled = !file || !$('step2').hidden;
  }
};

function save() {
  if (!file || !project) return;
  try { localStorage.setItem(keyFor(file), JSON.stringify(project)); } catch (e) {}
}

// ---------- step 2: editor ----------
let groups = [];
function regroup() {
  groups = Captions.group(project.words, Captions.byId(project.template));
}
function view() {
  return { groups, template: project.template, pos: project.pos, size: project.size, upper: project.upper, color: project.color, watermark: plan === 'free' };
}

function openEditor() {
  $('step1').hidden = true;
  $('step2').hidden = false;
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(file);
  $('video').src = videoUrl;
  regroup();
  renderTemplates();
  syncControls();
  renderLines();
  Captions.ensureFont(Captions.byId(project.template).font);
  Captions.ready().then(() => { sizeOverlay(); paint(); });
  startLoop();
}

// Overlay canvas sits exactly on the picture.
function sizeOverlay() {
  const v = $('video'), c = $('overlay');
  if (!v.videoWidth) return;
  const box = v.getBoundingClientRect();
  const ar = v.videoWidth / v.videoHeight;
  let w = box.width, h = box.width / ar;
  if (h > box.height) { h = box.height; w = h * ar; }
  c.style.width = w + 'px'; c.style.height = h + 'px';
  c.style.left = (box.width - w) / 2 + 'px'; c.style.top = (box.height - h) / 2 + 'px';
  const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
  c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
}
function paint() {
  const c = $('overlay');
  if (!c.width || !project) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  Captions.draw(ctx, c.width, c.height, $('video').currentTime, view());
}
let loopOn = false;
function startLoop() {
  if (loopOn) return;
  loopOn = true;
  const tick = () => {
    if ($('step2').hidden) { loopOn = false; return; }
    paint();
    if (!$('tabStyle').hidden) paintThumbs();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
$('video').addEventListener('loadedmetadata', () => { sizeOverlay(); paint(); });
window.addEventListener('resize', () => { sizeOverlay(); paint(); });

// Template picker with small animated previews.
const SAMPLE = [{ t: 'Make', s: 0, e: 0.45 }, { t: 'your', s: 0.45, e: 0.8 }, { t: 'videos', s: 0.8, e: 1.35 }, { t: 'pop!', s: 1.35, e: 2 }];
function tile(tp) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tpl' + (tp.id === project.template ? ' on' : '');
  b.dataset.id = tp.id;
  b.setAttribute('aria-pressed', tp.id === project.template ? 'true' : 'false');
  const c = document.createElement('canvas');
  c.width = 240; c.height = 300;
  const name = document.createElement('span');
  name.textContent = tp.name;
  name.dir = 'auto';
  b.append(c, name);
  b.onclick = () => pickTemplate(tp.id);
  return b;
}
function renderTemplates() {
  const box = $('tpls');
  box.textContent = '';
  for (const tp of Captions.TEMPLATES) box.appendChild(tile(tp));
  const mine = $('myTpls');
  mine.textContent = '';
  for (const st of myStyles) if (Captions.has('c_' + st.id)) mine.appendChild(tile(Captions.byId('c_' + st.id)));
  $('mySection').hidden = !myStyles.length;
  markPicked();
}
function markPicked() {
  document.querySelectorAll('#tabStyle .tpl').forEach((x) => { const on = x.dataset.id === project.template; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  $('editStyle').hidden = !/^c_/.test(project.template);
}
function pickTemplate(id) {
  project.template = id;
  project.color = null;
  regroup(); save(); syncControls(); renderLines(); markPicked();
  Captions.ensureFont(Captions.byId(id).font);
  paint();
}
function paintThumbs() {
  const now = (performance.now() / 1000) % 2.6;
  document.querySelectorAll('#tabStyle .tpl').forEach((b) => {
    const c = b.querySelector('canvas');
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, '#2b2f77'); g.addColorStop(1, '#0f1020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    const tp = Captions.byId(b.dataset.id);
    const gs = Captions.group(SAMPLE, tp);
    Captions.draw(ctx, c.width, c.height, now, { groups: gs, template: tp.id, pos: 0.55, size: 1.5, upper: null, color: b.dataset.id === project.template ? project.color : null });
  });
}

// ---------- people's own styles ----------
let myStyles = [], canMake = false, ed = null;
async function loadStyles() {
  try {
    const r = await fetch('/api/sub-styles', { headers: await headers() });
    if (!r.ok) return;
    const j = await r.json();
    canMake = !!j.canMake;
    myStyles = j.styles || [];
    for (const st of myStyles) Captions.setCustom('c_' + st.id, st.name, st.settings);
    if (project && /^c_/.test(project.template) && !Captions.has(project.template)) project.template = 'bold';
    if (project && !$('step2').hidden) { regroup(); renderTemplates(); syncControls(); renderLines(); Captions.ensureFont(Captions.byId(project.template).font); }
  } catch (e) {}
}
function fillEditorLists() {
  const base = $('edBase'), font = $('edFont');
  if (!base.options.length) {
    for (const tp of Captions.TEMPLATES) { const o = document.createElement('option'); o.value = tp.id; o.textContent = tp.name; base.appendChild(o); }
    for (const f of Captions.FONTS) { const o = document.createElement('option'); o.value = f.key; o.textContent = f.name; font.appendChild(o); }
  }
}
function fillWeights(fontKey, want) {
  const sel = $('edWeight');
  const f = Captions.FONTS.find((x) => x.key === fontKey) || Captions.FONTS[0];
  sel.textContent = '';
  for (const w of f.weights) { const o = document.createElement('option'); o.value = w; o.textContent = String(w); sel.appendChild(o); }
  const best = f.weights.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a), f.weights[0]);
  sel.value = String(best);
}
function showEditorFields(st, name) {
  fillEditorLists();
  $('edName').value = name;
  $('edBase').value = st.base;
  $('edFont').value = st.font;
  fillWeights(st.font, st.weight);
  $('edWords').value = st.maxWords; $('edWordsN').textContent = String(st.maxWords);
  $('edUpper').checked = !!st.upper;
  $('edText').value = st.text.toLowerCase(); $('edAccent').value = st.accent.toLowerCase();
  $('edOutline').value = st.outline.toLowerCase(); $('edBg').value = st.bg.toLowerCase();
  $('edOutlineW').value = st.outlineW; $('edShadow').value = st.shadow; $('edBgA').value = st.bgAlpha; $('edScale').value = st.scale;
}
function readEditor() {
  return {
    base: $('edBase').value, font: $('edFont').value, weight: Number($('edWeight').value), maxWords: Number($('edWords').value),
    upper: $('edUpper').checked, scale: Number($('edScale').value),
    text: $('edText').value, accent: $('edAccent').value, outline: $('edOutline').value, bg: $('edBg').value,
    outlineW: Number($('edOutlineW').value), shadow: Number($('edShadow').value), bgAlpha: Number($('edBgA').value),
  };
}
function editNote(key, withPlans) {
  $('edNote').hidden = !key;
  $('edNoteText').textContent = key ? t(key) : '';
  $('edPlans').hidden = !withPlans;
}
function openStyleEditor(existingId) {
  const from = Captions.byId(project.template);
  const st = Captions.settingsOf(from);
  if (project.color) st.accent = project.color.toUpperCase();
  if (project.upper != null) st.upper = !!project.upper;
  ed = { id: existingId || null, prev: { template: project.template, color: project.color, upper: project.upper } };
  project.color = null; project.upper = null;
  const name = existingId ? from.name : t('subs.ed.defname');
  showEditorFields(st, name);
  Captions.setCustom('__draft', name, st);
  project.template = '__draft';
  regroup();
  $('tabEdit').hidden = false; $('tabStyle').hidden = true; $('tabText').hidden = true;
  document.querySelector('.subs-tabs').hidden = true; $('mainActions').hidden = true;
  $('edDelete').hidden = !existingId;
  editNote(canMake ? null : 'subs.ed.paid', !canMake);
  paint();
}
function closeStyleEditor() {
  Captions.removeCustom('__draft');
  ed = null;
  $('tabEdit').hidden = true; $('tabStyle').hidden = false;
  document.querySelector('.subs-tabs').hidden = false; $('mainActions').hidden = false;
  document.querySelectorAll('.subs-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'style'));
  regroup(); renderTemplates(); syncControls(); renderLines(); paint();
}
function editorChanged() {
  if (!ed) return;
  const st = readEditor();
  $('edWordsN').textContent = String(st.maxWords);
  Captions.setCustom('__draft', $('edName').value, st);
  regroup();
  Captions.ensureFont(st.font);
  paint();
}
['edBase', 'edWeight', 'edWords', 'edUpper', 'edText', 'edAccent', 'edOutline', 'edBg', 'edOutlineW', 'edShadow', 'edBgA', 'edScale'].forEach((id) => { $(id).addEventListener('input', editorChanged); $(id).addEventListener('change', editorChanged); });
$('edFont').onchange = () => { fillWeights($('edFont').value, Number($('edWeight').value)); editorChanged(); };
$('makeStyle').onclick = () => openStyleEditor(null);
$('editStyle').onclick = () => { if (/^c_/.test(project.template)) openStyleEditor(project.template.slice(2)); };
$('edCancel').onclick = () => { if (!ed) return; Object.assign(project, ed.prev); closeStyleEditor(); };
$('edSave').onclick = async () => {
  if (!ed) return;
  const name = $('edName').value.trim();
  if (!name) { editNote('subs.ed.noname'); $('edName').focus(); return; }
  const settings = readEditor();
  $('edSave').disabled = true;
  try {
    const h = await headers(); h['Content-Type'] = 'application/json';
    const r = await fetch('/api/sub-styles', { method: 'POST', headers: h, body: JSON.stringify({ id: ed.id, name, settings }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 402) { editNote('subs.ed.paid', true); return; }
    if (r.status === 409) { editNote('subs.ed.limit'); return; }
    if (!r.ok || !j.id) { editNote('subs.ed.err'); return; }
    Captions.setCustom('c_' + j.id, name, settings);
    const i = myStyles.findIndex((x) => x.id === j.id);
    if (i >= 0) myStyles[i] = { id: j.id, name, settings }; else myStyles.unshift({ id: j.id, name, settings });
    project.template = 'c_' + j.id;
    save();
    closeStyleEditor();
    setStatus('subs.ed.saved');
  } catch (e) {
    if (e.message !== 'login') editNote('subs.ed.err');
  } finally { $('edSave').disabled = false; }
};
$('edDelete').onclick = async () => {
  if (!ed || !ed.id || !confirm(t('subs.ed.delq'))) return;
  try {
    const r = await fetch('/api/sub-styles?id=' + encodeURIComponent(ed.id), { method: 'DELETE', headers: await headers() });
    if (!r.ok) { editNote('subs.ed.err'); return; }
    Captions.removeCustom('c_' + ed.id);
    myStyles = myStyles.filter((x) => x.id !== ed.id);
    project.template = 'bold'; project.color = null; project.upper = null;
    save();
    closeStyleEditor();
    setStatus('subs.ed.deleted');
  } catch (e) { if (e.message !== 'login') editNote('subs.ed.err'); }
};

function syncControls() {
  const tp = Captions.byId(project.template);
  $('pos').value = project.pos;
  $('size').value = project.size;
  $('upper').checked = project.upper == null ? tp.upper : !!project.upper;
  $('color').value = (project.color || tp.accent).toLowerCase();
  document.querySelectorAll('#posSeg button').forEach((b) => b.classList.toggle('on', Math.abs(Number(b.dataset.pos) - project.pos) < 0.02));
}
$('pos').oninput = () => { project.pos = Number($('pos').value); syncControls(); paint(); };
$('pos').onchange = save;
document.querySelectorAll('#posSeg button').forEach((b) => { b.onclick = () => { project.pos = Number(b.dataset.pos); syncControls(); paint(); save(); }; });
$('size').oninput = () => { project.size = Number($('size').value); paint(); };
$('size').onchange = save;
$('upper').onchange = () => { project.upper = $('upper').checked; save(); paint(); };
$('color').oninput = () => { project.color = $('color').value; paint(); };
$('color').onchange = save;
$('colorReset').onclick = () => { project.color = null; syncControls(); save(); paint(); };

// Tabs.
document.querySelectorAll('.subs-tabs button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.subs-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    $('tabStyle').hidden = b.dataset.tab !== 'style';
    $('tabEdit').hidden = true;
    $('tabText').hidden = b.dataset.tab !== 'text';
  };
});

// Text editing: one field per caption. Changing the words keeps the caption's time.
function renderLines() {
  const box = $('lines');
  box.textContent = '';
  groups.forEach((g, gi) => {
    const row = document.createElement('div');
    row.className = 'subs-line';
    const tm = document.createElement('button');
    tm.type = 'button'; tm.className = 'tm'; tm.textContent = fmt(g.s);
    tm.onclick = () => { const v = $('video'); v.currentTime = g.s + 0.01; paint(); };
    const inp = document.createElement('input');
    inp.className = 'field'; inp.dir = 'auto'; inp.value = g.w.map((w) => w.t).join(' ');
    inp.onfocus = () => { const v = $('video'); if (v.paused) { v.currentTime = g.s + 0.01; paint(); } };
    inp.onchange = () => editGroup(gi, inp.value);
    row.append(tm, inp);
    box.appendChild(row);
  });
}
function editGroup(gi, text) {
  const g = groups[gi];
  if (!g) return;
  const parts = text.split(/\s+/).filter(Boolean);
  const start = project.words.indexOf(g.w[0]);
  if (start < 0) return;
  let fresh;
  if (parts.length === g.w.length) fresh = g.w.map((w, i) => ({ ...w, t: parts[i] }));
  else {
    const span = g.e - g.s, step = parts.length ? span / parts.length : 0;
    fresh = parts.map((p, i) => ({ t: p, s: g.s + i * step, e: g.s + (i + 1) * step }));
  }
  project.words.splice(start, g.w.length, ...fresh);
  regroup(); save(); renderLines(); paint();
}


// ---------- copy a style from a picture (AI) ----------
let aiOn = false, aiBusy = false;
function frameFrom(file) {
  // A picture as it is, or one frame from the middle of a video, made smaller (max 1280 px).
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file);
    const done = (src, w, h) => {
      const k = Math.min(1, 1280 / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? ok({ blob: b, w: c.width, h: c.height }) : no(new Error('frame'))), 'image/jpeg', 0.88);
    };
    if (/^video\//.test(file.type)) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadedmetadata = () => { v.currentTime = Math.min(v.duration * 0.4, Math.max(0, v.duration - 0.1)); };
      v.onseeked = () => done(v, v.videoWidth, v.videoHeight);
      v.onerror = () => { URL.revokeObjectURL(url); no(new Error('frame')); };
      v.src = url;
    } else {
      const im = new Image();
      im.onload = () => done(im, im.naturalWidth, im.naturalHeight);
      im.onerror = () => { URL.revokeObjectURL(url); no(new Error('frame')); };
      im.src = url;
    }
  });
}
$('aiPick').onclick = () => { if (!aiBusy) $('aiFile').click(); };
$('aiFile').onchange = async () => {
  const f = $('aiFile').files[0];
  $('aiFile').value = '';
  if (!f || !ed || aiBusy) return;
  if (!canMake) { editNote('subs.ed.paid', true); return; }
  aiBusy = true; $('aiPick').disabled = true;
  editNote('subs.ai.working');
  try {
    const fr = await frameFrom(f);
    const h = await headers();
    h['Content-Type'] = 'image/jpeg'; h['X-Img-W'] = String(fr.w); h['X-Img-H'] = String(fr.h);
    const r = await fetch('/api/sub-style-ai', { method: 'POST', headers: h, body: fr.blob });
    const j = await r.json().catch(() => ({}));
    if (r.status === 402) { editNote('subs.ed.paid', true); return; }
    if (r.status === 422) { editNote('subs.ai.none'); return; }
    if (r.status === 429) { editNote('subs.ai.many'); return; }
    if (!r.ok || !j.settings) { editNote('subs.ai.err'); return; }
    showEditorFields({ ...readEditor(), ...j.settings }, j.name || $('edName').value);
    if (j.pos != null) { project.pos = j.pos; syncControls(); }
    editorChanged();
    editNote('subs.ai.done');
  } catch (e) {
    if (e.message !== 'login') editNote('subs.ai.err');
  } finally { aiBusy = false; $('aiPick').disabled = false; }
};

// ---------- export ----------
$('srt').onclick = () => {
  const blob = new Blob([Captions.srt(groups)], { type: 'application/x-subrip;charset=utf-8' });
  download(blob, baseName() + '.srt');
};
function baseName() { return (file ? file.name.replace(/\.[^.]+$/, '') : 'video') + '-suvoz'; }
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
$('export').onclick = async () => {
  if (exporting || !project) return;
  exporting = new AbortController();
  $('video').pause();
  $('export').disabled = true; $('cancel').hidden = false;
  setStatus('subs.exporting', false, null, { p: '0' });
  bar(0);
  try {
    if (!audio) { try { audio = await decodeAudio(file); } catch (e) { audio = null; } }
    await Captions.ensureFont(Captions.byId(project.template).font);
    const out = await SubExport.run({
      file, project: view(), audio, signal: exporting.signal,
      onProgress: (p) => { bar(p); setStatus('subs.exporting', false, null, { p: String(Math.round(p * 100)) }); },
    });
    download(out.blob, baseName() + '.' + out.ext);
    setStatus(out.ext === 'mp4' ? 'subs.done' : 'subs.done.webm');
  } catch (e) {
    console.error(e);
    if (e.message === 'cancel') setStatus('subs.cancelled');
    else setStatus('subs.err.export', true);
  } finally {
    exporting = null; bar(null);
    $('export').disabled = false; $('cancel').hidden = true;
  }
};
$('cancel').onclick = () => { if (exporting) exporting.abort(); };
$('again').onclick = () => {
  if (exporting) return;
  $('video').pause();
  $('step2').hidden = true; $('step1').hidden = false;
  file = null; seconds = 0; audio = null; project = null; groups = [];
  $('file').value = ''; renderInfo(); setStatus(null); $('go').disabled = true;
};
window.addEventListener('beforeunload', (e) => { if (exporting) { e.preventDefault(); e.returnValue = ''; } });

document.addEventListener('langchange', () => {
  fillLangs(); renderInfo(); renderTrial();
  if (statusKey) setStatus(statusKey, $('status').className === 'err', null, statusVars);
});

(async function init() {
  initLang();
  fillLangs();
  let config = {};
  try { config = await getConfig(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  if (!(await Auth.session())) return location.replace('/login');
  aiOn = !!config.styleAiOn;
  $('aiBox').hidden = !aiOn;
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  loadMe();
  loadStyles();
})();
