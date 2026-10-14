// Tiny login client for Supabase. No libraries: plain fetch calls to Supabase's auth API.
const Auth = (() => {
  const KEY = 'suvoz_session';
  let cfg = null;

  async function config() {
    if (!cfg) cfg = await (await fetch('/api/config')).json();
    return cfg;
  }
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };
  const now = () => Math.floor(Date.now() / 1000);

  function emailFrom(token) {
    try {
      const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(p)))).email || '';
    } catch (e) { return ''; }
  }

  async function call(path, body, token, method) {
    const c = await config();
    const headers = { apikey: c.supabaseKey, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const m = method || 'POST';
    const r = await fetch(c.supabaseUrl + path, { method: m, headers, body: m === 'GET' ? undefined : JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error(j.msg || j.error_description || j.message || 'error');
      err.status = r.status;
      err.code = j.error_code || j.code || '';
      throw err;
    }
    return j;
  }

  function store(j) {
    const s = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || now() + (j.expires_in || 3600),
      email: (j.user && j.user.email) || emailFrom(j.access_token),
    };
    save(s);
    return s;
  }

  // Links in confirmation and reset emails bring the visitor back with the login in the address (#access_token=...).
  function takeHash() {
    if (!location.hash || location.hash.length < 2) return null;
    const h = new URLSearchParams(location.hash.slice(1));
    const out = { type: h.get('type') || '', error: h.get('error') || '' };
    if (h.get('access_token')) {
      store({
        access_token: h.get('access_token'),
        refresh_token: h.get('refresh_token'),
        expires_at: parseInt(h.get('expires_at') || '0', 10) || undefined,
        expires_in: parseInt(h.get('expires_in') || '3600', 10),
      });
    } else if (!out.error) {
      return null;
    }
    history.replaceState(null, '', location.pathname + location.search);
    return out;
  }

  async function session() {
    let s = load();
    if (!s || !s.access_token) return null;
    if (s.expires_at - 60 < now()) {
      try {
        s = store(await call('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token }));
      } catch (e) { clear(); return null; }
    }
    return s;
  }

  return {
    config, session, takeHash, emailFrom,
    async signUp(email, password) {
      const j = await call('/auth/v1/signup?redirect_to=' + encodeURIComponent(location.origin + '/app'), { email, password });
      if (j.access_token) { store(j); return { loggedIn: true }; }
      const u = j.user || j;
      if (u && Array.isArray(u.identities) && u.identities.length === 0) { const e = new Error('exists'); e.code = 'user_already_exists'; throw e; }
      return { loggedIn: false };
    },
    async signIn(email, password) {
      store(await call('/auth/v1/token?grant_type=password', { email, password }));
    },
    // Login with a code sent by email. New emails get an account too.
    async sendCode(email) {
      await call('/auth/v1/otp', { email, create_user: true });
    },
    async verifyCode(email, token) {
      let last = null;
      for (const type of ['email', 'signup', 'magiclink']) {   // Supabase uses a different type for new and old accounts
        try { store(await call('/auth/v1/verify', { type, email, token })); return; } catch (e) { last = e; if (e.status === 429) break; }
      }
      throw last;
    },
    // The signed-in person's saved details (name and age live in user_metadata).
    async profile() {
      const s = await session();
      if (!s) return null;
      const j = await call('/auth/v1/user', null, s.access_token, 'GET').catch(() => null);
      return (j && j.user_metadata) || {};
    },
    async saveProfile(data) {
      const s = await session();
      if (!s) throw new Error('no session');
      await call('/auth/v1/user', { data }, s.access_token, 'PUT');
    },
    async recover(email) {
      await call('/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + '/login'), { email });
    },
    async setPassword(password) {
      const s = await session();
      if (!s) throw new Error('no session');
      await call('/auth/v1/user', { password }, s.access_token, 'PUT');
    },
    async signOut() {
      const s = load();
      clear();
      if (s) { try { await call('/auth/v1/logout', {}, s.access_token); } catch (e) {} }
    },
    // Turns a Supabase error into one of our translated messages.
    errKey(e) {
      const msg = String((e && e.message) || '').toLowerCase();
      const code = (e && e.code) || '';
      if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'auth.err.invalid';
      if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'auth.err.unconfirmed';
      if (code === 'user_already_exists' || msg.includes('already registered')) return 'auth.err.exists';
      if (code === 'weak_password' || msg.includes('password should')) return 'auth.err.weak';
      if (code.startsWith('over_') || (e && e.status === 429)) return 'auth.err.rate';
      if (code === 'email_address_invalid' || msg.includes('invalid email')) return 'auth.err.email';
      return 'auth.err.generic';
    },
  };
})();
