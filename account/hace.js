// HunterAceDev site account: one sign-in for every game on hunteracedev.com.
//
// Loaded by the home page, the account page and each game. Because every game lives on the same domain, they all read
// the same sign-in from this browser's storage: sign in once, and each game knows who you are.
//
// What it does in a game (the game's page loads this file with data-game="..."):
//   - signed out: sends the player to the sign-in prompt first ("Sign in" or "Skip"), once per visit;
//   - keeps a guest's progress and each account's progress apart in this browser (a new account starts fresh);
//   - Bulwark and Tin Hats: copies the game's save to the account and back, so progress follows the player.
// The game's own code is not changed: it reads and writes its usual save, and this file swaps what is in it.
(function () {
  'use strict';

  // ================================================================================================================
  // THE SWITCH. Everything in this file is OFF until `enabled` is true and `api` is the address of the deployed
  // backend (no slash at the end), for example  api: 'https://steel-tide-api.YOURNAME.workers.dev'
  // While it is off: no Sign in button, no prompt before a game, no network request, nothing changes anywhere.
  var CONFIG = { enabled: false, api: '' };
  // ================================================================================================================

  var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage full or blocked */ } } };
  var SS = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  // local testing only: a test backend named in this browser's storage switches it on (never on the real site)
  if (local && LS.get('hace.devApi')) CONFIG = { enabled: true, api: LS.get('hace.devApi') };

  // Each game: where it lives, which storage entries hold its save, whether the save is copied to the account (cloud),
  // and the colours and type its sign-in prompt wears.
  var GAMES = {
    'steel-tide': {
      name: 'Steel Tide', path: '/steel-tide/', keys: ['steelTide.save.v1'], cloud: false,
      // Credits, cosmetics and unlocks live on the server for an account. Its local copy starts from the player's own
      // settings with an empty wallet and record.
      fresh: function (v) { try { var d = JSON.parse(v['steelTide.save.v1'] || 'null'); if (!d) return {}; delete d.stats; delete d.econ; return { 'steelTide.save.v1': JSON.stringify(d) }; } catch (e) { return {}; } },
      theme: { bg: '#061019', panel: '#0d1b28', edge: '#27455e', ink: '#e6eef4', dim: '#8fa3b3', accent: '#5aa9ff', accentInk: '#04121f', radius: '4px', font: "'Segoe UI', system-ui, sans-serif", head: "600 1.5em 'Segoe UI', system-ui, sans-serif", caps: 'uppercase', track: '.14em' },
    },
    bulwark: {
      name: 'Bulwark', path: '/bulwark/', keys: ['bulwark-save-v1'], cloud: true,
      theme: { bg: '#16414c', panel: '#2b2438', edge: '#150f1c', ink: '#fff8e8', dim: '#cdbfdc', accent: '#ffd24a', accentInk: '#3a2a05', radius: '14px', font: "'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif", head: "400 1.7em 'Lilita One', 'Trebuchet MS', system-ui, sans-serif", caps: 'none', track: '.3px', chunky: true, fonts: 'https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@700;800&display=swap' },
    },
    'tin-hats': {
      name: 'Tin Hats', path: '/tin-hats/', keys: ['tinhats.save', 'tinhats.tips'], cloud: true,
      theme: { bg: '#14150f', panel: '#1f2118', edge: '#4a4a36', ink: '#e4dcc0', dim: '#a39a7c', accent: '#c9bd9b', accentInk: '#14150f', radius: '2px', font: "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif", head: "700 1.35em 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif", caps: 'uppercase', track: '.22em' },
    },
  };

  var SESSION = 'hace.session.v1';
  function session() { try { var s = JSON.parse(LS.get(SESSION) || 'null'); return s && s.token && s.id ? s : null; } catch (e) { return null; } }
  function setSession(s) { LS.set(SESSION, s ? JSON.stringify({ token: s.token, email: s.email, id: s.id }) : null); if (s) LS.set('hace.known', '1'); }
  function hash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h) + ':' + str.length; }

  // ---- the backend --------------------------------------------------------------------------------------------------
  function call(path, body, method, keepalive) {
    if (!CONFIG.enabled) return Promise.resolve({ ok: false, error: 'off' });
    var s = session(), headers = { 'Content-Type': 'application/json' }; if (s) headers.Authorization = 'Bearer ' + s.token;
    return fetch(CONFIG.api + path, { method: method || (body ? 'POST' : 'GET'), headers: headers, body: body ? JSON.stringify(body) : undefined, keepalive: !!keepalive })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { d.ok = r.ok; d.status = r.status; if (r.status === 401 && s) setSession(null); return d; }); })
      .catch(function () { return { ok: false, error: 'offline', message: 'The server cannot be reached.' }; });
  }

  // ---- profiles: whose progress is in a game's save right now ------------------------------------------------------------
  // 'guest' or an account id. Everyone else's progress for that game waits in a stash in this browser.
  function slotOf(game) { return LS.get('hace.slot.' + game) || 'guest'; }
  function readKeys(game) { var o = {}; GAMES[game].keys.forEach(function (k) { o[k] = LS.get(k); }); return o; }
  function writeKeys(game, vals) { GAMES[game].keys.forEach(function (k) { LS.set(k, vals && typeof vals[k] === 'string' ? vals[k] : null); }); }
  function stashOf(game, slot) { try { return JSON.parse(LS.get('hace.stash.' + game + '.' + slot) || 'null'); } catch (e) { return null; } }
  // put `to`'s progress into the game's save (vals when given, else what was stashed for them, else a fresh start)
  function swap(game, to, vals) {
    var from = slotOf(game), cur = readKeys(game);
    if (from !== to) LS.set('hace.stash.' + game + '.' + from, JSON.stringify(cur));
    if (!vals) vals = from === to ? cur : stashOf(game, to);
    if (!vals) vals = to !== 'guest' && GAMES[game].fresh ? GAMES[game].fresh(cur) : {};
    writeKeys(game, vals); LS.set('hace.slot.' + game, to); LS.set('hace.stash.' + game + '.' + to, null);
  }
  function ensureSlot(game, who) { if (slotOf(game) !== who) swap(game, who); }
  function meta(game, id) { try { var m = JSON.parse(LS.get('hace.sync.' + game) || 'null'); return m && m.id === id ? m : null; } catch (e) { return null; } }
  function setMeta(game, m) { LS.set('hace.sync.' + game, JSON.stringify(m)); }

  // ---- cloud saves ------------------------------------------------------------------------------------------------------
  function push(game, keepalive) {
    var s = session(); if (!s || slotOf(game) !== s.id) return Promise.resolve(false);
    var data = JSON.stringify(readKeys(game)), h = hash(data), m = meta(game, s.id);
    if (m && m.hash === h) return Promise.resolve(true);
    return call('/save/' + game, { data: data }, 'POST', keepalive).then(function (r) {
      if (r.ok) setMeta(game, { id: s.id, rev: r.rev, hash: h, at: Date.now() });
      else { var old = meta(game, s.id) || { id: s.id, rev: 0, hash: '' }; if (!old.dirtyAt) { old.dirtyAt = Date.now(); setMeta(game, old); } } // not sent: it goes next time
      return !!r.ok;
    });
  }
  // Bring this account's progress into the game's save before the game starts. Resolves 'ok', or 'offline' when the server
  // cannot be reached and this browser holds no copy of the account's progress (the game then runs on the guest save).
  function pull(game) {
    var s = session(); if (!s) return Promise.resolve('signed-out');
    return call('/save/' + game).then(function (r) {
      var mine = slotOf(game) === s.id, have = mine ? readKeys(game) : stashOf(game, s.id), m = meta(game, s.id);
      if (!r.ok) { if (r.status === 401) return 'signed-out'; if (have) { ensureSlot(game, s.id); return 'ok'; } return 'offline'; }
      var haveData = have ? JSON.stringify(have) : '', dirty = !!have && (!m || m.hash !== hash(haveData));
      if (r.save) {
        var theirs = null; try { theirs = JSON.parse(r.save.data); } catch (e) { theirs = null; }
        var newer = !m || r.save.rev > m.rev, keepMine = have && (!newer || (dirty && m && m.dirtyAt && m.dirtyAt > r.save.updated * 1000));
        if (theirs && !keepMine) { swap(game, s.id, theirs); setMeta(game, { id: s.id, rev: r.save.rev, hash: hash(JSON.stringify(readKeys(game))), at: Date.now() }); return 'ok'; }
      }
      swap(game, s.id, have || null);                 // this account's own copy, or a fresh start: never the guest's progress
      if (have) return push(game).then(function () { return 'ok'; });
      return 'ok';
    });
  }
  function startSync(game) {
    var tick = function (last) { push(game, last); };
    setInterval(function () { tick(false); }, 15000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) tick(true); });
    addEventListener('pagehide', function () { tick(true); });
  }

  // ---- account actions -----------------------------------------------------------------------------------------------------
  function toGuest() { Object.keys(GAMES).forEach(function (g) { ensureSlot(g, 'guest'); }); }
  function signOut() { var s = session(); toGuest(); if (!s) return Promise.resolve(); return call('/signout', {}).then(function () { setSession(null); }); }
  function deleteAccount() {
    var s = session(); if (!s) return Promise.resolve({ ok: false });
    return call('/account/delete', {}).then(function (r) { if (r.ok) { toGuest(); Object.keys(GAMES).forEach(function (g) { LS.set('hace.stash.' + g + '.' + s.id, null); LS.set('hace.sync.' + g, null); }); setSession(null); } return r; });
  }
  function verify(email, code) { return call('/auth/verify', { email: email, code: code }).then(function (r) { if (r.ok && r.token) setSession({ token: r.token, email: r.me.email, id: r.me.id }); return r; }); }

  // ---- the gate: runs as a game's page starts, before the game reads its save ---------------------------------------------
  function go(mode, game) {
    try { document.documentElement.style.visibility = 'hidden'; } catch (e) { /* ignore */ }
    location.replace('/account/?mode=' + mode + '&game=' + game + '&back=' + encodeURIComponent(location.pathname + location.search + location.hash));
  }
  function gate(game) {
    var G = GAMES[game]; if (!CONFIG.enabled || !G) return;
    var s = session();
    if (!s) {
      if (!SS.get('hace.skip')) return go('gate', game);             // ask once per visit
      ensureSlot(game, 'guest'); return;
    }
    if (!G.cloud) { ensureSlot(game, s.id); return; }
    if (SS.get('hace.pulled.' + game) !== s.id) return go('sync', game);   // fetch the account's progress first
    if (slotOf(game) === s.id) startSync(game);                       // (not when the server could not be reached and the guest save is in use)
  }

  window.HACE = {
    get enabled() { return CONFIG.enabled; }, get api() { return CONFIG.enabled ? CONFIG.api : ''; }, games: GAMES,
    session: session, clear: function () { setSession(null); }, call: call, verify: verify, signOut: signOut, deleteAccount: deleteAccount, pull: pull, push: push,
    requestCode: function (email) { return call('/auth/request', { email: email }); },
    me: function () { return call('/me'); },
    skip: function () { SS.set('hace.skip', '1'); }, pulled: function (game) { var s = session(); SS.set('hace.pulled.' + game, s ? s.id : ''); },
    get known() { return !!LS.get('hace.known'); },
    hasGuestProgress: function () { return Object.keys(GAMES).some(function (g) { var v = slotOf(g) === 'guest' ? readKeys(g) : stashOf(g, 'guest'); return !!v && GAMES[g].keys.some(function (k) { return !!v[k]; }); }); },
  };
  var me = document.currentScript, game = me && me.getAttribute('data-game');
  if (game) gate(game);
})();
