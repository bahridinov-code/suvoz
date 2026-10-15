// Suvoz server. No dependencies: uses only what comes with Node.js 20+.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mailer = require('./email');

// ---- Settings (all come from environment variables) ----
const API_KEY = process.env.ELEVENLABS_API_KEY || '';
const MODEL_ID = process.env.ELEVEN_MODEL || 'eleven_v4';
const BASE = (process.env.ELEVEN_BASE || 'https://api.elevenlabs.io').replace(/\/$/, '');
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const MAX_CHARS = parseInt(process.env.MAX_CHARS_PER_REQUEST || '3000', 10);
const DAILY_CHAR_LIMIT = parseInt(process.env.DAILY_CHAR_LIMIT || '50000', 10);
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';   // the public key, safe in the browser
const AUTH_ON = !!(SUPABASE_URL && SUPABASE_KEY);
const MAX_TURNS = 60;
const HISTORY_DAYS = 30;                       // how long finished audios are kept
const MAX_SPEAKERS = 4;
const PORT = process.env.PORT || 3000;

// ---- Stripe (payments). All optional: without STRIPE_SECRET_KEY the Subscribe button says "opening soon". ----
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_BASE = (process.env.STRIPE_BASE || 'https://api.stripe.com').replace(/\/$/, '');
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || '';   // server only. Never put this in the browser.
const SITE_URL = (process.env.SITE_URL || 'https://suvoz.io').replace(/\/$/, '');
const RESEND_KEY = process.env.RESEND_API_KEY || '';          // lets the server send emails (sales messages)
const MAIL_FROM = process.env.MAIL_FROM || 'Suvoz <support@suvoz.io>';
const RESEND_BASE = (process.env.RESEND_BASE || 'https://api.resend.com').replace(/\/$/, '');
const SALES_TO = process.env.SALES_TO || 'sales@suvoz.io';
const PAY_ON = !!(STRIPE_KEY && STRIPE_WEBHOOK_SECRET && SUPABASE_SECRET && SUPABASE_URL);
const HISTORY_ON = !!(AUTH_ON && SUPABASE_SECRET);   // saves each user's audios (needs supabase-history.sql)
// Prices in US cents. firstOff = amount taken off the first month only (new customers).
const PLANS = {
  starter:  { name: 'Suvoz Starter',  minutes: 30,   cents: 900,   firstOff: 450 },
  creator:  { name: 'Suvoz Creator',  minutes: 120,  cents: 2900,  firstOff: 1201 },
  pro:      { name: 'Suvoz Pro',      minutes: 400,  cents: 7900,  firstOff: 2901 },
  business: { name: 'Suvoz Business', minutes: 3000, cents: 49900, firstOff: 0 },
};

const PUBLIC_DIR = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const PAGES = { '/': 'index.html', '/app': 'app.html', '/login': 'login.html', '/terms': 'terms.html', '/privacy': 'privacy.html', '/refunds': 'refunds.html', '/history': 'history.html' };

// Serves files from /public only. Blocks anything outside that folder.
function serveStatic(req, res, pathname) {
  const rel = PAGES[pathname] || decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !type) return false;
  let data;
  try { data = fs.readFileSync(file); } catch (e) { return false; }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(data);
  return true;
}

// ---- Helpers ----
function sendJson(res, status, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// Behind a host like Render, the last X-Forwarded-For entry is the real visitor
// as seen by the host's proxy (earlier entries can be faked by the visitor).
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket.remoteAddress || 'unknown';
}

function codeOk(req) {
  if (!ACCESS_CODE) return true;
  const given = Buffer.from(String(req.headers['x-access-code'] || ''));
  const want = Buffer.from(ACCESS_CODE);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

// ---- Login check (Supabase) ----
// The browser sends its login token. We ask Supabase who it belongs to (cached for a minute).
const tokenCache = new Map();
async function getUser(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer\s+([\w.\-]{20,4000})$/);
  if (!m) return null;
  const token = m[1];
  const hit = tokenCache.get(token);
  if (hit && hit.exp > Date.now()) return { user: hit.user, token };
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user || !user.id || !user.email_confirmed_at) return null;
    if (tokenCache.size > 2000) tokenCache.clear();
    tokenCache.set(token, { user, exp: Date.now() + 60 * 1000 });
    return { user, token };
  } catch (e) {
    console.error('supabase user check failed', e.message);
    return null;
  }
}

async function rpc(token, fn, args) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) throw new Error('rpc ' + fn + ' ' + r.status);
  return r.json();
}

// Returns { token } when allowed. Otherwise sends the error and returns null.
async function gate(req, res) {
  if (AUTH_ON) {
    const a = await getUser(req);
    if (!a) { sendJson(res, 401, { code: 'auth_required', error: 'Please log in.' }); return null; }
    return a;
  }
  if (!codeOk(req)) { sendJson(res, 401, { code: 'bad_code', error: 'Wrong or missing access code.' }); return null; }
  return {};
}

function readJson(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(new Error('bad json'));
      }
    });
    req.on('error', reject);
  });
}

// ---- Daily character budget (protects your wallet) ----
const today = () => new Date().toISOString().slice(0, 10);
let budget = { day: today(), used: 0 };
function budgetUsed() {
  if (budget.day !== today()) budget = { day: today(), used: 0 };
  return budget.used;
}

// ---- Simple per-visitor rate limit: 12 generations per 10 minutes ----
const hits = new Map();
function rateLimited(ip) {
  if (hits.size > 5000) hits.clear();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (arr.length >= 12) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

// Script format: one line per turn, "Name: text". Lines without a name
// continue the previous turn. Text that comes before any name (or a text with
// no names at all) is read by one narrator voice.
// KEEP IN SYNC with parse() in public/app.js (same rules, same character count).
const NARRATOR = 'Narrator';
// "Sound: door slams, 3s" is a sound effect (not a speaker). 15 characters of balance per second.
const SFX_WORDS = new Set(['sound', 'sfx', 'effect', 'звук', 'эффект', 'صوت', 'مؤثر', 'садо', 'овоз', 'tovush', 'ovoz', 'effekt']);
const SFX_MAX_SECONDS = 10, SFX_DEFAULT_SECONDS = 3, SFX_CHARS_PER_SECOND = 15;
function looksLikeName(s) {
  return !/[!?,;"“”]/.test(s) && s.split(/\s+/).length <= 3;
}
function parseSfx(rest) {
  let text = rest.trim(), seconds = SFX_DEFAULT_SECONDS;
  const m = text.match(/^(.*?)[\s,;]+(\d+(?:[.,]\d+)?)\s*(?:seconds|second|secs|sec|sek|s|секунды|секунда|секунд|сек|с|ثانية|ثواني|ثوان|ث)\.?$/i);
  if (m && m[1].trim()) { text = m[1].trim(); seconds = parseFloat(m[2].replace(',', '.')); }
  seconds = Math.round(Math.min(SFX_MAX_SECONDS, Math.max(0.5, seconds || SFX_DEFAULT_SECONDS)) * 10) / 10;
  return { text: text.slice(0, 200), seconds };
}
function turnChars(t) {
  return t.sfx ? Math.ceil(t.seconds * SFX_CHARS_PER_SECOND) : t.text.length;
}
function parseScript(text) {
  const turns = [];
  const LINE = /^\s*([^:：\n]{1,30}?)\s*[:：]\s*(.+)$/;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LINE);
    const name = m ? m[1].trim() : '';
    if (m && SFX_WORDS.has(name.toLowerCase())) {
      const e = parseSfx(m[2]);
      turns.push({ speaker: '', sfx: true, text: e.text, seconds: e.seconds });
    } else if (m && looksLikeName(name)) {
      turns.push({ speaker: name, text: m[2].trim() });
    } else if (!turns.length || turns[turns.length - 1].sfx) {
      turns.push({ speaker: NARRATOR, text: line, implicit: true });
    } else {
      const last = turns[turns.length - 1];
      last.text += (last.implicit ? '\n' : ' ') + line;
    }
  }
  return turns;
}

// ---- Routes ----
let voiceCache = { at: 0, data: null };

async function handleVoices(req, res) {
  if (!(await gate(req, res))) return;
  if (!API_KEY) return sendJson(res, 500, { error: 'Server is missing ELEVENLABS_API_KEY.' });
  try {
    if (!voiceCache.data || Date.now() - voiceCache.at > 10 * 60 * 1000) {
      const r = await fetch(`${BASE}/v1/voices`, { headers: { 'xi-api-key': API_KEY } });
      if (!r.ok) throw new Error('ElevenLabs voices error ' + r.status);
      const j = await r.json();
      voiceCache = {
        at: Date.now(),
        data: (j.voices || []).map((v) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category || '',
          preview: v.preview_url || '',
          labels: v.labels || {},
        })),
      };
    }
    sendJson(res, 200, { voices: voiceCache.data });
  } catch (e) {
    console.error(e.message);
    sendJson(res, 502, { error: 'Could not load voices.' });
  }
}


// ---- Joining audio pieces ----
// Voice pieces and sound-effect pieces can differ (mono/stereo, headers), and some browsers stop
// playing at the join. When a sound effect is present we re-encode everything into one clean MP3.
const { spawn } = require('child_process');
const os = require('os');
const fsp = require('fs/promises');
const pathMod = require('path');
let FFMPEG = 'ffmpeg';
try { FFMPEG = require('ffmpeg-static') || 'ffmpeg'; } catch (e) {}
async function joinMp3(parts) {
  if (parts.length < 2) return parts[0];
  const dir = await fsp.mkdtemp(pathMod.join(os.tmpdir(), 'suvoz-'));
  try {
    const files = [];
    for (let i = 0; i < parts.length; i++) {
      const f = pathMod.join(dir, 'p' + i + '.mp3');
      await fsp.writeFile(f, parts[i]);
      files.push(f);
    }
    const out = pathMod.join(dir, 'out.mp3');
    const args = ['-y', '-v', 'error'];
    files.forEach((f) => args.push('-i', f));
    const labels = files.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono[a${i}];`).join('');
    const ins = files.map((_, i) => `[a${i}]`).join('');
    args.push('-filter_complex', `${labels}${ins}concat=n=${files.length}:v=0:a=1[o]`, '-map', '[o]', '-c:a', 'libmp3lame', '-b:a', '128k', out);
    await new Promise((resolve, reject) => {
      const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', (d) => { err += d; });
      p.on('error', reject);
      p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg ' + c + ' ' + err.slice(0, 200)))));
    });
    return await fsp.readFile(out);
  } finally {
    fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleGenerate(req, res) {
  const who = await gate(req, res);
  if (!who) return;
  if (!API_KEY) return sendJson(res, 500, { error: 'Server is missing ELEVENLABS_API_KEY.' });
  if (rateLimited(clientIp(req))) {
    return sendJson(res, 429, { error: 'Too many requests. Please try again in a few minutes.' });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, { error: 'Invalid request.' });
  }

  const script = String((body && body.script) || '');
  const voiceMap = (body && body.voices) || {};
  const turns = parseScript(script);

  if (!turns.length) {
    return sendJson(res, 400, { error: 'Write the script as lines like "Anna: Hello there".' });
  }
  if (turns.length > MAX_TURNS) {
    return sendJson(res, 400, { error: `Too many lines (max ${MAX_TURNS}).` });
  }
  const speakers = [...new Set(turns.filter((t) => !t.sfx).map((t) => t.speaker))];
  if (speakers.length > MAX_SPEAKERS) {
    return sendJson(res, 400, { error: `Too many speakers (max ${MAX_SPEAKERS}).` });
  }
  const chars = turns.reduce((n, t) => n + turnChars(t), 0);
  if (chars > MAX_CHARS) {
    return sendJson(res, 400, { error: `Script is too long (${chars} characters, max ${MAX_CHARS}).` });
  }
  for (const s of speakers) {
    const v = voiceMap[s];
    if (typeof v !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(v)) {
      return sendJson(res, 400, { error: `Pick a voice for "${s}".` });
    }
  }
  if (budgetUsed() + chars > DAILY_CHAR_LIMIT) {
    return sendJson(res, 429, { code: 'daily_limit', error: 'Daily limit reached. Please try again tomorrow.' });
  }
  if (AUTH_ON) {
    // Paid minutes first, otherwise the free trial.
    try {
      const left = await rpc(who.token, 'credits_use', { n: chars });
      if (left < 0) {
        const me = await rpc(who.token, 'credits_left');
        if (me && me.plan !== 'free') return sendJson(res, 402, { code: 'credits_over', error: 'You have used all your minutes.' });
        return sendJson(res, 402, { code: 'trial_over', error: 'Your free trial is used up.' });
      }
    } catch (e) {
      console.error(e.message);
      return sendJson(res, 502, { error: 'Could not check your minutes. Please try again.' });
    }
  }

  try {
    const parts = [];
    for (const t of turns) {
      const headers = { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' };
      const r = t.sfx
        ? await fetch(`${BASE}/v1/sound-generation?output_format=mp3_44100_128`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: t.text, duration_seconds: t.seconds }),
          })
        : await fetch(`${BASE}/v1/text-to-speech/${voiceMap[t.speaker]}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: t.text, model_id: MODEL_ID }),
          });
      if (!r.ok) {
        const errBody = await r.text().catch(() => '');
        console.error('ElevenLabs error', t.sfx ? '(sound effect)' : '', r.status, errBody.slice(0, 300));
        if (t.sfx && (r.status === 400 || r.status === 422)) {
          return sendJson(res, 400, { code: 'sound_failed', error: 'That sound could not be created. Try describing it differently.' });
        }
        const msg =
          r.status === 401
            ? 'Server API key was rejected by ElevenLabs.'
            : r.status === 402 || r.status === 403
            ? 'The ElevenLabs plan does not allow this request (check plan or credits).'
            : r.status === 429
            ? 'ElevenLabs is busy. Please try again in a moment.'
            : 'Audio generation failed. Please try again.';
        return sendJson(res, 502, { error: msg });
      }
      parts.push(Buffer.from(await r.arrayBuffer()));
    }
    budgetUsed();
    budget.used += chars;
    let audio;
    if (turns.some((t) => t.sfx)) {
      try { audio = await joinMp3(parts); }
      catch (e) { console.error('join failed, using plain join:', e.message); audio = Buffer.concat(parts); }
    } else audio = Buffer.concat(parts);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Cache-Control': 'no-store',
    });
    res.end(audio);
    // Save a copy in the user's history. Never blocks or breaks the answer.
    if (HISTORY_ON && who.user && who.user.id) {
      saveHistory(who.user.id, script, chars, audio).catch((e) => console.error('history save failed:', e.message));
    }
  } catch (e) {
    console.error(e.message);
    sendJson(res, 502, { error: 'Audio generation failed. Please try again.' });
  }
}


// ---- Stripe + Supabase admin helpers ----
function formEncode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
async function stripe(method, pathname, params) {
  const r = await fetch(STRIPE_BASE + pathname, {
    method,
    headers: { Authorization: 'Bearer ' + STRIPE_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : formEncode(params || {}).join('&'),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('stripe ' + pathname + ' ' + r.status + ' ' + ((j.error && j.error.message) || '')); e.stripe = j.error || {}; throw e; }
  return j;
}
async function admin(fn, args) {
  const headers = { apikey: SUPABASE_SECRET, 'Content-Type': 'application/json' };
  if (SUPABASE_SECRET.startsWith('eyJ')) headers.Authorization = 'Bearer ' + SUPABASE_SECRET;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args || {}) });
  if (!r.ok) throw new Error('admin ' + fn + ' ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 200));
  const txt = await r.text();          // functions that return nothing may answer with an empty body
  return txt ? JSON.parse(txt) : null;
}

// ---- History (saved audios) ----
function sbAdminHeaders(extra) {
  const h = { apikey: SUPABASE_SECRET, ...(extra || {}) };
  if (SUPABASE_SECRET.startsWith('eyJ')) h.Authorization = 'Bearer ' + SUPABASE_SECRET;
  return h;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function storageDelete(paths) {
  if (!paths.length) return;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/audio`, {
    method: 'DELETE',
    headers: sbAdminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!r.ok) throw new Error('storage delete ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 200));
}
async function saveHistory(userId, script, chars, audio) {
  const id = crypto.randomUUID();
  const file = `${userId}/${id}.mp3`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/audio/${file}`, {
    method: 'POST',
    headers: sbAdminHeaders({ 'Content-Type': 'audio/mpeg' }),
    body: audio,
  });
  if (!up.ok) throw new Error('storage upload ' + up.status + ' ' + (await up.text().catch(() => '')).slice(0, 200));
  try {
    await admin('history_add', { p_id: id, p_user: userId, p_script: script.slice(0, 12000), p_chars: chars, p_size: audio.length, p_path: file });
  } catch (e) {
    await storageDelete([file]).catch(() => {});   // do not leave a file without a row
    throw e;
  }
}
async function handleHistoryList(req, res) {
  const who = await gate(req, res);
  if (!who) return;
  if (!HISTORY_ON) return sendJson(res, 200, { enabled: false, items: [] });
  try {
    const rows = await admin('history_list', { p_user: who.user.id, p_limit: 100 });
    sendJson(res, 200, { enabled: true, days: HISTORY_DAYS, items: rows });
  } catch (e) {
    console.error(e.message);
    sendJson(res, 502, { error: 'Could not load your history.' });
  }
}
async function handleHistoryAudio(req, res, url) {
  const who = await gate(req, res);
  if (!who) return;
  const id = url.searchParams.get('id') || '';
  if (!HISTORY_ON || !UUID_RE.test(id)) return sendJson(res, 404, { error: 'Not found.' });
  try {
    const file = await admin('history_path', { p_user: who.user.id, p_id: id });   // only the owner gets a path
    if (!file) return sendJson(res, 404, { error: 'Not found.' });
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/audio/${file}`, { headers: sbAdminHeaders() });
    if (!r.ok) throw new Error('storage read ' + r.status);
    const audio = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'no-store' });
    res.end(audio);
  } catch (e) {
    console.error(e.message);
    sendJson(res, 502, { error: 'Could not load this audio.' });
  }
}
async function handleHistoryDelete(req, res, url) {
  const who = await gate(req, res);
  if (!who) return;
  const id = url.searchParams.get('id') || '';
  if (!HISTORY_ON || !UUID_RE.test(id)) return sendJson(res, 404, { error: 'Not found.' });
  try {
    const file = await admin('history_delete', { p_user: who.user.id, p_id: id });   // removes the row, returns the file name
    if (file) await storageDelete([file]).catch((e) => console.error(e.message));
    sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error(e.message);
    sendJson(res, 502, { error: 'Could not delete this item.' });
  }
}
// Removes audios older than HISTORY_DAYS (files first, then the rows).
async function expireHistory() {
  for (let i = 0; i < 5; i++) {
    const rows = await admin('history_expired', { p_days: HISTORY_DAYS, p_limit: 200 });
    if (!rows.length) return;
    await storageDelete(rows.map((r) => r.audio_path));
    await admin('history_purge', { p_ids: rows.map((r) => r.id) });
    console.log('history: removed', rows.length, 'old items');
    if (rows.length < 200) return;
  }
}

function readRaw(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
// Checks that a webhook really comes from Stripe.
function verifyStripe(raw, header) {
  const parts = Object.fromEntries(String(header || '').split(',').map((x) => x.trim().split('=')));
  const t = parts.t, sig = parts.v1;
  if (!t || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const want = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(t + '.' + raw.toString('utf8')).digest('hex');
  const a = Buffer.from(want), b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}


// ---- Talk to sales form: saved in Supabase, and emailed to SALES_TO when RESEND_API_KEY is set ----
const leadHits = new Map();
function leadLimited(ip) {
  if (leadHits.size > 2000) leadHits.clear();
  const now = Date.now();
  const arr = (leadHits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (arr.length >= 5) { leadHits.set(ip, arr); return true; }
  arr.push(now); leadHits.set(ip, arr); return false;
}
const escHtml = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function handleSales(req, res) {
  let b;
  try { b = JSON.parse((await readRaw(req, 20 * 1024)).toString('utf8')); } catch (e) { return sendJson(res, 400, { error: 'bad_request' }); }
  if (b.website) return sendJson(res, 200, { ok: true });            // hidden field: only bots fill it
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().slice(0, 200);
  const message = String(b.message || '').trim().slice(0, 4000);
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: 'invalid' });
  if (leadLimited(clientIp(req))) return sendJson(res, 429, { error: 'slow_down' });
  if (!SUPABASE_SECRET || !SUPABASE_URL) return sendJson(res, 503, { error: 'sales_off' });
  let saved = false, mailed = false;
  try { await admin('add_lead', { p_name: name, p_email: email, p_message: message }); saved = true; } catch (e) { console.error(e.message); }
  mailed = await sendMail({
    to: SALES_TO, replyTo: email, subject: 'Suvoz sales: ' + name,
    html: '<p><b>Name:</b> ' + escHtml(name) + '<br><b>Email:</b> ' + escHtml(email) + '</p><p style="white-space:pre-wrap">' + escHtml(message) + '</p>',
    text: 'Name: ' + name + '\nEmail: ' + email + '\n\n' + message,
  });
  if (!saved && !mailed) return sendJson(res, 500, { error: 'failed' });
  sendJson(res, 200, { ok: true });
}

// Stripe's own pages only speak some languages. Russian and English are covered; for Arabic, Tajik and Uzbek we use English.
const stripeLocale = (lang) => (lang === 'ru' ? 'ru' : 'en');
async function handleCheckout(req, res) {
  const who = await getUser(req);
  if (!who) return sendJson(res, 401, { code: 'auth_required', error: 'Please log in.' });
  if (!PAY_ON) return sendJson(res, 503, { code: 'pay_off', error: 'Payments open soon.' });
  let body;
  try { body = await readJson(req); } catch (e) { return sendJson(res, 400, { error: 'Bad request.' }); }
  const plan = PLANS[String(body.plan || '')];
  if (!plan) return sendJson(res, 400, { error: 'Unknown plan.' });
  try {
    const info = await admin('sub_info', { p_user: who.user.id });
    if (info.active) return sendJson(res, 409, { code: 'already_subscribed', error: 'You already have a plan.' });
    const params = {
      mode: 'subscription',
      locale: stripeLocale(String(body.lang || '')),
      success_url: SITE_URL + '/app?paid=1',
      cancel_url: SITE_URL + '/#pricing',
      client_reference_id: who.user.id,
      line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: plan.cents, recurring: { interval: 'month' }, product_data: { name: plan.name } } } },
      subscription_data: { metadata: { user_id: who.user.id, plan: String(body.plan) } },
      metadata: { user_id: who.user.id, plan: String(body.plan) },
    };
    if (info.customer) params.customer = info.customer; else params.customer_email = who.user.email;
    if (!info.exists && plan.firstOff > 0) {
      const id = 'suvoz-first-' + body.plan + '-' + plan.firstOff;
      try { await stripe('POST', '/v1/coupons', { id, amount_off: plan.firstOff, currency: 'usd', duration: 'once', name: 'First month' }); }
      catch (e) { if (!(e.stripe && e.stripe.code === 'resource_already_exists')) throw e; }
      params.discounts = { 0: { coupon: id } };
    }
    const s = await stripe('POST', '/v1/checkout/sessions', params);
    return sendJson(res, 200, { url: s.url });
  } catch (e) {
    console.error(e.message);
    return sendJson(res, 502, { error: 'Could not start the payment. Please try again.' });
  }
}

async function handlePortal(req, res) {
  const who = await getUser(req);
  if (!who) return sendJson(res, 401, { code: 'auth_required', error: 'Please log in.' });
  if (!PAY_ON) return sendJson(res, 503, { code: 'pay_off', error: 'Payments open soon.' });
  try {
    const info = await admin('sub_info', { p_user: who.user.id });
    if (!info.customer) return sendJson(res, 404, { error: 'No plan found.' });
    let body = {};
    try { body = await readJson(req); } catch (e) {}
    const s = await stripe('POST', '/v1/billing_portal/sessions', { customer: info.customer, return_url: SITE_URL + '/app', locale: stripeLocale(String((body && body.lang) || '')) });
    return sendJson(res, 200, { url: s.url });
  } catch (e) {
    console.error(e.message);
    return sendJson(res, 502, { error: 'Could not open your plan page. Please try again.' });
  }
}

// Sends one email through Resend. Never throws: a failed email must not break a payment.
async function sendMail({ to, subject, html, text, replyTo }) {
  if (!RESEND_KEY || !to) return false;
  try {
    const r = await fetch(RESEND_BASE + '/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text, reply_to: replyTo || undefined }),
    });
    if (!r.ok) console.error('resend ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 200));
    return r.ok;
  } catch (e) { console.error('resend ' + e.message); return false; }
}
async function customerEmail(id) {
  try { return ((await stripe('GET', '/v1/customers/' + encodeURIComponent(id))).email) || ''; } catch (e) { console.error(e.message); return ''; }
}

async function handleStripeWebhook(req, res) {
  let raw;
  try { raw = await readRaw(req); } catch (e) { return sendJson(res, 400, { error: 'Bad request.' }); }
  if (!PAY_ON || !verifyStripe(raw, req.headers['stripe-signature'])) return sendJson(res, 400, { error: 'Bad signature.' });
  let ev;
  try { ev = JSON.parse(raw.toString('utf8')); } catch (e) { return sendJson(res, 400, { error: 'Bad json.' }); }
  try {
    const obj = ev.data && ev.data.object;
    if (ev.type === 'invoice.paid') {
      const subId = obj.subscription || (obj.parent && obj.parent.subscription_details && obj.parent.subscription_details.subscription);
      const line = obj.lines && obj.lines.data && obj.lines.data[0];
      if (subId && line && line.period) {
        const sub = await stripe('GET', '/v1/subscriptions/' + encodeURIComponent(subId));
        const m = sub.metadata || {};
        if (m.user_id && PLANS[m.plan]) {
          const end = new Date((line.period.end + 86400) * 1000).toISOString();   // one day of grace for late renewals
          await admin('activate_plan', { p_user: m.user_id, p_plan: m.plan, p_customer: sub.customer, p_sub: subId, p_period_end: end });
          if (obj.amount_paid > 0) {
            const to = obj.customer_email || (await customerEmail(sub.customer));
            const mail = mailer.receiptEmail({
              planName: PLANS[m.plan].name, minutes: PLANS[m.plan].minutes, amount: obj.amount_paid, currency: obj.currency,
              renewal: obj.billing_reason === 'subscription_cycle', until: mailer.dateText(line.period.end),
            });
            await sendMail({ to, subject: mail.subject, html: mail.html, text: mail.text });
          }
        } else console.error('webhook: subscription without Suvoz metadata', subId);
      }
    } else if (ev.type === 'customer.subscription.deleted') {
      await admin('end_plan', { p_sub: obj.id });
    } else if (ev.type === 'customer.subscription.updated') {
      // Customer pressed cancel (the plan stays active until the period ends): send one confirmation email.
      const prev = (ev.data && ev.data.previous_attributes) || {};
      const cancelling = ('cancel_at_period_end' in prev && !prev.cancel_at_period_end && obj.cancel_at_period_end) || ('cancel_at' in prev && !prev.cancel_at && obj.cancel_at);
      const plan = obj.metadata && PLANS[obj.metadata.plan];
      if (cancelling && plan) {
        const item = obj.items && obj.items.data && obj.items.data[0];
        const endTs = obj.cancel_at || (item && item.current_period_end) || obj.current_period_end;
        const to = await customerEmail(obj.customer);
        if (endTs) {
          const mail = mailer.cancelEmail({ planName: plan.name, until: mailer.dateText(endTs) });
          await sendMail({ to, subject: mail.subject, html: mail.html, text: mail.text });
        }
      }
    }
    return sendJson(res, 200, { received: true });
  } catch (e) {
    console.error(e.message);
    return sendJson(res, 500, { error: 'Could not process.' });   // Stripe will try again
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && p === '/api/me') {
      if (!AUTH_ON) return sendJson(res, 200, { auth: false });
      const a = await getUser(req);
      if (!a) return sendJson(res, 401, { code: 'auth_required', error: 'Please log in.' });
      try {
        const me = await rpc(a.token, 'credits_left');
        return sendJson(res, 200, { auth: true, email: a.user.email, plan: me.plan, trialChars: me.left });
      } catch (e) {
        console.error(e.message);
        return sendJson(res, 502, { error: 'Could not load your account.' });
      }
    }
    if (req.method === 'GET' && p === '/api/config') {
      return sendJson(res, 200, {
        authOn: AUTH_ON,
        supabaseUrl: AUTH_ON ? SUPABASE_URL : '',
        supabaseKey: AUTH_ON ? SUPABASE_KEY : '',
        requiresCode: !AUTH_ON && !!ACCESS_CODE,
        maxChars: MAX_CHARS,
        maxSpeakers: MAX_SPEAKERS,
        configured: !!API_KEY,
        payOn: PAY_ON,
        historyOn: HISTORY_ON,
      });
    }
    if (req.method === 'GET' && p === '/api/voices') return await handleVoices(req, res);
    if (req.method === 'POST' && p === '/api/generate') return await handleGenerate(req, res);
    if (p === '/api/history') {
      if (req.method === 'GET') return await handleHistoryList(req, res);
      if (req.method === 'DELETE') return await handleHistoryDelete(req, res, new URL(req.url, 'http://localhost'));
    }
    if (req.method === 'GET' && p === '/api/history/audio') return await handleHistoryAudio(req, res, new URL(req.url, 'http://localhost'));
    if (req.method === 'POST' && p === '/api/sales') return await handleSales(req, res);
    if (req.method === 'POST' && p === '/api/checkout') return await handleCheckout(req, res);
    if (req.method === 'POST' && p === '/api/portal') return await handlePortal(req, res);
    if (req.method === 'POST' && p === '/api/stripe-webhook') return await handleStripeWebhook(req, res);
    if (req.method === 'GET' && !p.startsWith('/api/') && serveStatic(req, res, p)) return;
    sendJson(res, 404, { error: 'Not found.' });
  } catch (e) {
    console.error(e.message);
    if (!res.headersSent) sendJson(res, 500, { error: 'Server error.' });
    else res.end();
  }
});

server.listen(PORT, () => console.log(`Suvoz running on port ${PORT}`));
if (HISTORY_ON) {
  const sweep = () => expireHistory().catch((e) => console.error('history cleanup failed:', e.message));
  setTimeout(sweep, parseInt(process.env.HISTORY_SWEEP_FIRST_MS || '60000', 10));
  setInterval(sweep, 6 * 60 * 60 * 1000);
}
