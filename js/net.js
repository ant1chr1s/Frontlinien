'use strict';
// ===================== Online (PeerJS / WebRTC) =====================
const NET_PREFIX = 'frontlinien-rts-v1-';
function randCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += a[(Math.random() * a.length) | 0]; return s; }
function peerAvailable() { return typeof Peer !== 'undefined'; }
// PeerJS-JSON-Kanäle erlauben nur ~16 KB pro Nachricht -> große Nachrichten stückeln
const CHUNK = 5000;
let _chunkId = 1;
function packMsg(msg) {
  const s = JSON.stringify(msg);
  if (s.length <= CHUNK) return [msg];
  const id = _chunkId++, n = Math.ceil(s.length / CHUNK), out = [];
  for (let i = 0; i < n; i++) out.push({ t: '~', id, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) });
  return out;
}
function makeUnpacker(cb) {
  const bufs = new Map();
  return (d) => {
    if (!d || d.t !== '~') { cb(d); return; }
    let b = bufs.get(d.id); if (!b) { b = { n: d.n, got: 0, parts: [] }; bufs.set(d.id, b); }
    if (b.parts[d.i] === undefined) { b.parts[d.i] = d.d; b.got++; }
    if (b.got === b.n) { bufs.delete(d.id); try { cb(JSON.parse(b.parts.join(''))); } catch (e) { console.error(e); } }
  };
}
function connSend(c, parts) { if (c && c.open) for (const p of parts) try { c.send(p); } catch (e) { console.error(e); } }
const PEER_OPTS = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };

class NetHost {
  constructor(onReady, onError) {
    this.conns = new Map(); // peerId -> conn
    this.seen = new Map();
    this.handlers = {}; this.onReady = onReady; this.onError = onError;
    this.init();
  }
  init() {
    this.code = randCode();
    this.peer = new Peer(NET_PREFIX + this.code, PEER_OPTS);
    this.peer.on('open', () => this.onReady && this.onReady(this.code));
    this.peer.on('error', (e) => {
      if (e.type === 'unavailable-id') { try { this.peer.destroy(); } catch (x) { } this.init(); return; }
      this.onError && this.onError(e);
    });
    this.peer.on('connection', (conn) => {
      conn.on('open', () => { this.conns.set(conn.peer, conn); this.handlers.join && this.handlers.join(conn.peer); });
      conn.on('data', makeUnpacker((d) => { this.seen.set(conn.peer, performance.now()); if (d && d.t === 'ping') return; this.handlers.data && this.handlers.data(conn.peer, d); }));
      conn.on('close', () => { this.conns.delete(conn.peer); this.handlers.leave && this.handlers.leave(conn.peer); });
      conn.on('error', () => { });
    });
  }
  on(k, fn) { this.handlers[k] = fn; }
  // Verbindungen ohne Lebenszeichen trennen
  reap(ms) {
    const now = performance.now();
    for (const [peer, c] of this.conns) { const t = this.seen.get(peer) || now; if (!this.seen.has(peer)) this.seen.set(peer, now); if (now - t > ms) { this.conns.delete(peer); try { c.close(); } catch (e) { } this.handlers.leave && this.handlers.leave(peer); } }
  }
  send(peerId, msg) { connSend(this.conns.get(peerId), packMsg(msg)); }
  broadcast(msg) { const parts = packMsg(msg); for (const c of this.conns.values()) connSend(c, parts); }
  close() { try { this.peer.destroy(); } catch (e) { } }
}

class NetClient {
  constructor(code, onOpen, onError) {
    this.handlers = {};
    this.peer = new Peer(PEER_OPTS);
    let opened = false;
    const to = setTimeout(() => { if (!opened) onError && onError({ type: 'timeout' }); }, 15000);
    this.peer.on('open', () => {
      this.conn = this.peer.connect(NET_PREFIX + code.toUpperCase().trim(), { reliable: true, serialization: 'json' });
      this.conn.on('open', () => { opened = true; clearTimeout(to); onOpen && onOpen(); });
      this.conn.on('data', makeUnpacker((d) => this.handlers.data && this.handlers.data(d)));
      this.conn.on('close', () => this.handlers.close && this.handlers.close());
      this.conn.on('error', () => { });
    });
    this.peer.on('error', (e) => { clearTimeout(to); if (!opened) onError && onError(e); else this.handlers.close && this.handlers.close(); });
  }
  get id() { return this.peer.id; }
  on(k, fn) { this.handlers[k] = fn; }
  send(msg) { connSend(this.conn, packMsg(msg)); }
  close() { try { this.peer.destroy(); } catch (e) { } }
}

// ---------- Client-Spiegel der Welt ----------
class Mirror {
  constructor(start) {
    this.map = decodeMap(start.mapData);
    this.players = start.players.map((p, i) => ({ id: i, name: p.name, fac: p.fac, team: p.team, color: p.color, alive: true }));
    this.ents = new Map(); this.time = 0; this.views = []; this.over = false; this.winnerTeam = null; this.swEnabled = start.sw !== false; this.fogOn = start.fog !== false;
    this.events = [];
  }
  apply(s) {
    for (const e of this.ents.values()) { e.px = e.x; e.py = e.y; }
    for (const a of s.u) {
      const d = DEFS[TYPE_LIST[a[1]]]; let e = this.ents.get(a[0]);
      if (!e || e.def !== d) {
        e = { id: a[0], def: d, type: d.key, kind: d.kind, owner: a[2], rally: null };
        if (d.kind === 'unit') { e.x = e.px = a[3]; e.y = e.py = a[4]; e.air = d.cat === 'air'; }
        this.ents.set(e.id, e);
      }
      e.owner = a[2];
      if (d.kind === 'unit') { e.x = a[3]; e.y = a[4]; }
      else { e.tx = a[3]; e.ty = a[4]; e.w = d.w; e.h = d.h; e.x = e.px = (a[3] + d.w / 2) * T; e.y = e.py = (a[4] + d.h / 2) * T; }
      e.hp = a[5]; e.face = a[6] / 20; e.flags = a[7]; e.carry = (a[7] & 8) ? HARV_CAP : 0;
    }
    for (const id of s.rm) this.ents.delete(id);
    const r = s.r; for (let i = 0; i < r.length; i += 3) { this.map.ra[r[i]] = r[i + 1]; this.map.rt[r[i]] = r[i + 2]; }
    this.views = s.pl.map(v => ({
      credits: v.credits, powP: v.powP, powU: v.powU, low: v.low, alive: v.alive, unlock: v.unlock,
      q: Object.fromEntries(QUEUES.map(k => [k, (v.q[k] || []).map(([ti, prog, rd]) => ({ type: TYPE_LIST[ti], prog, st: rd ? 'ready' : 'build' }))])),
      sw: v.sw.map(([id, ti, t]) => ({ id, type: TYPE_LIST[ti], t })),
    }));
    s.alive.forEach((a, i) => this.players[i].alive = !!a);
    this.time = s.tm; this.over = !!s.over; this.winnerTeam = s.win;
    for (const ev of s.ev) this.events.push(ev);
  }
  playerView(pid) { return this.views[pid] || { credits: 0, powP: 0, powU: 0, q: { bld: [], def: [], inf: [], veh: [], air: [] }, sw: [], alive: true, unlock: {} }; }
  isWinner(pid) { const p = this.players[pid]; return this.over && this.winnerTeam === (p.team > 0 ? 't' + p.team : 'p' + p.id); }
}
