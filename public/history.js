// History page: the user's finished audios (kept 30 days).
const $ = (id) => document.getElementById(id);
let items = [], days = 30, loaded = false, failed = false;
const blobs = {};   // id -> object URL, so an audio is only fetched once

async function headers() {
  const s = await Auth.session();
  if (!s) { location.replace('/login'); throw new Error('login'); }
  return { Authorization: 'Bearer ' + s.access_token };
}

function when(iso) {
  const d = new Date(iso);
  try { return d.toLocaleString(currentLang, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch (e) { return d.toLocaleString(); }
}

async function audioUrl(id) {
  if (blobs[id]) return blobs[id];
  const r = await fetch('/api/history/audio?id=' + encodeURIComponent(id), { headers: await headers() });
  if (!r.ok) throw new Error(t('hist.err.audio'));
  blobs[id] = URL.createObjectURL(await r.blob());
  return blobs[id];
}

function setStatus(msg, isErr) {
  $('status').textContent = msg || '';
  $('status').className = isErr ? 'err' : '';
}

function button(key, onclick, cls) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls || 'pbtn';
  b.textContent = t(key);
  b.onclick = () => onclick(b);
  return b;
}

function card(it) {
  const box = document.createElement('div');
  box.className = 'panel hitem';

  const head = document.createElement('div');
  head.className = 'hhead';
  const date = document.createElement('span');
  date.textContent = when(it.created_at);
  const len = document.createElement('span');
  len.textContent = t('hist.min', { m: String(Math.max(0.1, Math.round((it.chars / 900) * 10) / 10)) });
  head.append(date, len);

  const txt = document.createElement('p');
  txt.className = 'htext';
  txt.dir = 'auto';
  txt.textContent = it.script.length > 260 ? it.script.slice(0, 260) + '…' : it.script;

  const player = document.createElement('audio');
  player.controls = true;
  player.hidden = true;

  const err = document.createElement('div');
  err.className = 'herr';

  const actions = document.createElement('div');
  actions.className = 'hact';
  actions.append(
    button('hist.play', async () => {
      err.textContent = '';
      try { player.src = await audioUrl(it.id); player.hidden = false; player.play().catch(() => {}); }
      catch (e) { if (e.message !== 'login') err.textContent = e.message; }
    }),
    button('hist.download', async () => {
      err.textContent = '';
      try {
        const a = document.createElement('a');
        a.href = await audioUrl(it.id);
        a.download = 'suvoz-' + it.created_at.slice(0, 10) + '.mp3';
        document.body.appendChild(a); a.click(); a.remove();
      } catch (e) { if (e.message !== 'login') err.textContent = e.message; }
    }),
    button('hist.reuse', () => {
      try { sessionStorage.setItem('suvoz_reuse', it.script); } catch (e) {}
      location.href = '/dialogue';
    }),
    button('hist.delete', async (b) => {
      if (!b.dataset.sure) {   // first tap asks, second tap deletes
        b.dataset.sure = '1';
        b.textContent = t('hist.sure');
        b.classList.add('danger');
        setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = t('hist.delete'); b.classList.remove('danger'); } }, 4000);
        return;
      }
      b.disabled = true;
      try {
        const r = await fetch('/api/history?id=' + encodeURIComponent(it.id), { method: 'DELETE', headers: await headers() });
        if (!r.ok) throw new Error(t('hist.err'));
        if (blobs[it.id]) { URL.revokeObjectURL(blobs[it.id]); delete blobs[it.id]; }
        items = items.filter((x) => x.id !== it.id);
        render();
      } catch (e) { b.disabled = false; if (e.message !== 'login') err.textContent = e.message; }
    }, 'pbtn')
  );

  box.append(head, txt, player, actions, err);
  return box;
}

function render() {
  $('sub').textContent = t('hist.sub', { d: String(days) });
  const list = $('list');
  list.textContent = '';
  if (!loaded && !failed) { setStatus(t('hist.loading')); return; }
  if (failed) { setStatus(t('hist.err'), true); return; }
  setStatus('');
  if (!items.length) {
    const d = document.createElement('p');
    d.className = 'meta';
    d.textContent = t('hist.empty');
    list.appendChild(d);
    return;
  }
  items.forEach((it) => list.appendChild(card(it)));
}

async function load() {
  try {
    const r = await fetch('/api/history', { headers: await headers() });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { await Auth.signOut(); return location.replace('/login'); }
    if (!r.ok) throw new Error('load');
    if (j.enabled === false) { failed = true; setStatus(t('hist.off'), true); return; }
    items = j.items || [];
    days = j.days || 30;
    loaded = true;
  } catch (e) {
    if (e.message === 'login') return;
    failed = true;
  }
  render();
}

document.addEventListener('langchange', render);

(async function init() {
  initLang();
  let config = {};
  try { config = await (await fetch('/api/config')).json(); } catch (e) {}
  if (!config.authOn) return location.replace('/dialogue');
  if (!(await Auth.session())) return location.replace('/login');
  $('logout').hidden = false;
  $('logout').onclick = async () => { await Auth.signOut(); location.replace('/'); };
  render();
  load();
})();
