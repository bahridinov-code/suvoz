// Suvoz server. No dependencies: uses only what comes with Node.js 20+.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
// Prices in US cents. firstOff = amount taken off the first month only (new customers).
const PLANS = {
  starter:  { name: 'Suvoz Starter',  cents: 900,   firstOff: 450 },
  creator:  { name: 'Suvoz Creator',  cents: 2900,  firstOff: 1201 },
  pro:      { name: 'Suvoz Pro',      cents: 7900,  firstOff: 2901 },
  business: { name: 'Suvoz Business', cents: 49900, firstOff: 0 },
};

const PUBLIC_DIR = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const PAGES = { '/': 'index.html', '/app': 'app.html', '/login': 'login.html', '/terms': 'terms.html', '/privacy': 'privacy.html', '/refunds': 'refunds.html' };

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
// continue the previous turn.
function parseScript(text) {
  const turns = [];
  const LINE = /^\s*([^:：\n]{1,30}?)\s*[:：]\s*(.+)$/;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LINE);
    if (m) turns.push({ speaker: m[1].trim(), text: m[2].trim() });
    else if (turns.length) turns[turns.length - 1].text += ' ' + line;
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
  const speakers = [...new Set(turns.map((t) => t.speaker))];
  if (speakers.length > MAX_SPEAKERS) {
    return sendJson(res, 400, { error: `Too many speakers (max ${MAX_SPEAKERS}).` });
  }
  const chars = turns.reduce((n, t) => n + t.text.length, 0);
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
      const r = await fetch(
        `${BASE}/v1/text-to-speech/${voiceMap[t.speaker]}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({ text: t.text, model_id: MODEL_ID }),
        }
      );
      if (!r.ok) {
        const errBody = await r.text().catch(() => '');
        console.error('ElevenLabs error', r.status, errBody.slice(0, 300));
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
    const audio = Buffer.concat(parts);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Cache-Control': 'no-store',
    });
    res.end(audio);
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
  return r.json();
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
  if (RESEND_KEY) {
    try {
      const r = await fetch(RESEND_BASE + '/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: MAIL_FROM, to: [SALES_TO], reply_to: email,
          subject: 'Suvoz sales: ' + name,
          html: '<p><b>Name:</b> ' + escHtml(name) + '<br><b>Email:</b> ' + escHtml(email) + '</p><p style="white-space:pre-wrap">' + escHtml(message) + '</p>',
        }),
      });
      mailed = r.ok;
      if (!r.ok) console.error('resend ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 200));
    } catch (e) { console.error('resend ' + e.message); }
  }
  if (!saved && !mailed) return sendJson(res, 500, { error: 'failed' });
  sendJson(res, 200, { ok: true });
}

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
    const s = await stripe('POST', '/v1/billing_portal/sessions', { customer: info.customer, return_url: SITE_URL + '/app' });
    return sendJson(res, 200, { url: s.url });
  } catch (e) {
    console.error(e.message);
    return sendJson(res, 502, { error: 'Could not open your plan page. Please try again.' });
  }
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
        } else console.error('webhook: subscription without Suvoz metadata', subId);
      }
    } else if (ev.type === 'customer.subscription.deleted') {
      await admin('end_plan', { p_sub: obj.id });
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
      });
    }
    if (req.method === 'GET' && p === '/api/voices') return await handleVoices(req, res);
    if (req.method === 'POST' && p === '/api/generate') return await handleGenerate(req, res);
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
