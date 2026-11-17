'use strict';
// ===================== Spiel-Simulation =====================
const QUEUES = ['bld', 'def', 'inf', 'veh', 'air'];
const WCLS_KEYS = Object.keys(WCLS);
const CELL = 128;

class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length; if (n) { let i = 0; while (true) { let l = 2 * i + 1, r = l + 1, m = i; let mk = lk; if (l < n && k[l] < mk) { m = l; mk = k[l]; } if (r < n && k[r] < mk) { m = r; } if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; } k[i] = lk; v[i] = lv; } return top; }
  get size() { return this.k.length; }
  clear() { this.k.length = 0; this.v.length = 0; }
}

class Game {
  constructor(setup) {
    this.setup = setup;
    this.map = setup.mapData ? decodeMap(setup.mapData) : buildMap(setup.map);
    const m = this.map; this.W = m.w; this.H = m.h;
    this.blk = new Int32Array(m.w * m.h);
    this.ents = new Map(); this.nextId = 1; this.time = 0; this.tick = 0;
    this.events = []; this.netEvents = []; this.net = false; this.resChanged = new Set();
    this.projs = []; this.timed = []; this.storms = []; this.pathQ = [];
    this.over = false; this.winnerTeam = null;
    this.swEnabled = setup.sw !== false;
    this.cw = Math.ceil(m.w * T / CELL); this.ch = Math.ceil(m.h * T / CELL);
    this.grid = Array.from({ length: this.cw * this.ch }, () => []);
    this.bgrid = Array.from({ length: this.cw * this.ch }, () => []);
    // A*-Puffer
    const N = m.w * m.h; this._g = new Float32Array(N); this._came = new Int32Array(N); this._stamp = new Uint32Array(N); this._closed = new Uint32Array(N); this._gen = 1; this._heap = new Heap();
    this.players = setup.players.map((p, i) => ({
      id: i, name: p.name, fac: p.fac, team: p.team | 0, color: p.color, ai: p.ai || null, human: !p.ai,
      credits: setup.credits || 6000, alive: true, powP: 0, powU: 0, low: false,
      q: { bld: [], def: [], inf: [], veh: [], air: [] },
      mods: null, harvMult: 1, stats: { kills: 0, lost: 0, built: 0, earned: 0 }, start: null,
    }));
    for (const p of this.players) { if (p.ai) p.harvMult = AI_LEVELS[p.ai].income; this.calcMods(p); }
    // Startpositionen
    this.mission = setup.mission || null;
    const order = setup.startOrder || (this.mission ? missionStarts(m, this.mission._players) : this.players.map((_, i) => i));
    if (this.mission) {
      this.players.forEach((p, i) => { const s = m.starts[order[i] % m.starts.length]; p.start = { x: s.x, y: s.y }; });
      missionSetup(this);
    } else this.players.forEach((p, i) => {
      const s = m.starts[order[i] % m.starts.length]; p.start = { x: s.x, y: s.y };
      const bh = DEFS[p.fac + '_bauhof'];
      this.placeBuilding(p.id, bh, s.x - 1, s.y - 1, true);
      const inf = defsOf(p.fac, d => d.kind === 'unit' && d.cat === 'inf' && d.cost <= 110)[0];
      for (let k = 0; k < 4; k++) this.spawnUnit(p.id, inf, (s.x + (k % 2 ? 2.5 : -1.5)) * T, (s.y + 2.6 + (k > 1 ? 0.8 : 0)) * T);
    });
    this.recalcAll();
    this.ais = this.players.filter(p => p.ai).map(p => { const a = new AI(this, p.id, p.ai); a.mode = setup.players[p.id].aiMode || 'normal'; return a; });
  }

  // ---------- Hilfen ----------
  idx(x, y) { return y * this.W + x; }
  tileOf(px) { return Math.floor(px / T); }
  passable(i) { const t = this.map.ter[i]; return (t === TER.LOW || t === TER.HILL || t === TER.SHALLOW) && this.blk[i] === 0; }
  passXY(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H && this.passable(y * this.W + x); }
  emit(ev) { this.events.push(ev); if (this.net) this.netEvents.push(ev); }
  msg(txt, p = -1, col) { this.emit({ k: 'msg', p, txt, col }); }
  P(id) { return this.players[id]; }
  allied(a, b) { return isAllied(this.players[a], this.players[b]); }
  rad(e) { return e.kind === 'bld' ? Math.min(e.w, e.h) * T / 2 : e.def.size; }
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  ownBlds(pid) { const r = []; for (const e of this.ents.values()) if (e.kind === 'bld' && e.owner === pid) r.push(e); return r; }
  ownUnits(pid) { const r = []; for (const e of this.ents.values()) if (e.kind === 'unit' && e.owner === pid) r.push(e); return r; }
  hasReq(pid, req) {
    const blds = this.ownBlds(pid);
    return req.every(r => blds.some(b => b.def.role === r || b.type === r));
  }
  countRole(pid, role) { let n = 0; for (const e of this.ents.values()) if (e.kind === 'bld' && e.owner === pid && e.def.role === role && !(e.stun > this.time)) n++; return n; }

  // ---------- Erzeugen ----------
  spawnUnit(pid, d, x, y) {
    const e = { id: this.nextId++, kind: 'unit', def: d, type: d.key, owner: pid, x, y, px: x, py: y, hp: d.hp, face: Math.PI / 2,
      order: null, path: null, pi: 0, tgt: 0, cool: 0, stun: 0, inv: 0, home: { x, y }, air: d.cat === 'air', acq: (this.nextId % 10) * 0.05,
      hs: d.harvester ? 'seek' : null, carry: 0, cval: 0, ht: 0, htile: -1, field: -1, stuckT: 0, lp: { x, y }, rp: 0, need: null };
    this.ents.set(e.id, e);
    return e;
  }
  placeBuilding(pid, d, tx, ty, free) {
    const e = { id: this.nextId++, kind: 'bld', def: d, type: d.key, owner: pid, tx, ty, w: d.w, h: d.h,
      x: (tx + d.w / 2) * T, y: (ty + d.h / 2) * T, hp: d.hp, face: Math.PI / 2, cool: 0, tgt: 0, stun: 0, inv: 0, rep: false, rally: null, lastHit: -99, acq: 0 };
    e.px = e.x; e.py = e.y;
    if (d.sw) e.swt = d.charge;
    for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) this.blk[this.idx(x, y)] = e.id;
    this.ents.set(e.id, e);
    const p = this.P(pid);
    if (!free) p.stats.built++;
    if (d.role === 'refinery') {
      const hd = DEFS[p.fac + '_ernter'];
      const dock = this.dockTile(e);
      const u = this.spawnUnit(pid, hd, (dock.x + 0.5) * T, (dock.y + 0.5) * T);
      u.field = -1; u.hs = 'seek';
    }
    if (d.role === 'superweapon') { this.msg(`${p.name} hat ${d.name} errichtet!`, -1, '#ff5252'); this.emit({ k: 'swbuilt', o: pid }); }
    this.recalcPower(p);
    this.bgridDirty = true;
    return e;
  }
  dockTile(b) {
    const cand = [[b.tx + 1, b.ty + b.h], [b.tx, b.ty + b.h], [b.tx + 2, b.ty + b.h], [b.tx + b.w, b.ty + 1], [b.tx - 1, b.ty + 1], [b.tx + 1, b.ty - 1]];
    for (const [x, y] of cand) if (this.passXY(x, y)) return { x, y };
    return { x: b.tx + 1, y: b.ty + b.h };
  }
  canPlace(pid, d, tx, ty, ignoreRange, ignoreUnit) {
    if (tx < 0 || ty < 0 || tx + d.w > this.W || ty + d.h > this.H) return false;
    for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
      const i = this.idx(x, y), t = this.map.ter[i];
      if ((t !== TER.LOW && t !== TER.HILL) || this.blk[i]) return false;
    }
    // keine Bodeneinheiten im Weg
    const x0 = tx * T, y0 = ty * T, x1 = (tx + d.w) * T, y1 = (ty + d.h) * T;
    for (const e of this.ents.values()) {
      if (e.kind !== 'unit' || e.air || e === ignoreUnit) continue;
      if (e.x > x0 - 4 && e.x < x1 + 4 && e.y > y0 - 4 && e.y < y1 + 4) return false;
    }
    if (ignoreRange) return true;
    for (const b of this.ents.values()) {
      if (b.kind !== 'bld' || b.owner !== pid) continue;
      const gx = Math.max(0, b.tx - (tx + d.w), tx - (b.tx + b.w)), gy = Math.max(0, b.ty - (ty + d.h), ty - (b.ty + b.h));
      if (Math.max(gx, gy) <= 5) return true;
    }
    return false;
  }

  // ---------- Modifikatoren & Energie ----------
  recalcPower(p) {
    let pp = 0, pu = 0;
    for (const b of this.ents.values()) if (b.kind === 'bld' && b.owner === p.id) { const v = b.def.pow || 0; if (v > 0) pp += b.stun > this.time ? 0 : v * Math.max(0.35, b.hp / b.def.hp); else pu -= v; }
    p.powP = Math.round(pp); p.powU = pu; p.low = pu > pp;
  }
  calcMods(p) {
    const m = { prod: { inf: 1, veh: 1, air: 1 }, dmg: { inf: 1, veh: 1, air: 1 }, speed: 1, harvest: 1, income: 0, unlock: {}, shields: [], repairs: [], auras: [] };
    for (const b of this.ents.values()) {
      if (b.kind !== 'bld' || b.owner !== p.id || !b.def.eff) continue;
      const f = b.def.eff;
      if (f.unlock) m.unlock[f.unlock] = true;
      if (f.prod) for (const k in f.prod) m.prod[k] = Math.max(m.prod[k], f.prod[k]);
      if (f.dmg) for (const k in f.dmg) m.dmg[k] = Math.max(m.dmg[k], f.dmg[k]);
      if (f.speed) m.speed = Math.max(m.speed, f.speed);
      if (f.harvest) m.harvest = Math.max(m.harvest, f.harvest);
      if (f.income && !p.low) m.income += f.income;
      if (f.bldShield) m.shields.push({ x: b.x, y: b.y, r: f.bldShield.r * T, mult: f.bldShield.mult });
      if (f.repair) m.repairs.push({ x: b.x, y: b.y, r: f.repair.r * T, hps: f.repair.hps, cats: f.repair.cats });
      if (f.dmgAura) m.auras.push({ x: b.x, y: b.y, r: f.dmgAura.r * T, mult: f.dmgAura.mult });
    }
    p.mods = m;
  }
  recalcAll() { for (const p of this.players) { this.recalcPower(p); this.calcMods(p); } }

  // ---------- Befehle ----------
  command(pid, c) {
    const p = this.P(pid); if (!p || !p.alive || this.over) return;
    const own = (ids) => (ids || []).map(i => this.ents.get(i)).filter(e => e && e.owner === pid);
    switch (c.c) {
      case 'build': return this.enqueue(pid, c.type);
      case 'cancel': return this.cancel(pid, c.q, c.i | 0);
      case 'place': return this.cmdPlace(pid, c.q, c.tx | 0, c.ty | 0);
      case 'move': return this.orderMove(own(c.ids), c.x, c.y, !!c.am);
      case 'attack': { const t = this.ents.get(c.t); if (!t) return; for (const u of own(c.ids)) if (u.kind === 'unit' && this.canHit(u, t)) { u.order = { t: 'attack', id: t.id }; u.tgt = t.id; u.path = null; if (u.hs) u.hs = 'idle'; } return; }
      case 'stop': for (const u of own(c.ids)) if (u.kind === 'unit') { u.order = null; u.path = null; u.tgt = 0; u.home = { x: u.x, y: u.y }; if (u.hs) u.hs = 'idle'; } return;
      case 'harvest': { for (const u of own(c.ids)) if (u.def.harvester) { const i = this.idx(c.tx | 0, c.ty | 0); u.field = i; u.hs = 'seek'; u.order = null; } return; }
      case 'dock': { for (const u of own(c.ids)) if (u.def.harvester) { u.hs = 'ret'; u.order = null; } return; }
      case 'deploy': { const u = own([c.id])[0]; if (u && u.def.mcv) this.deploy(u); return; }
      case 'sell': { const b = own([c.id])[0]; if (b && b.kind === 'bld') this.sell(b); return; }
      case 'repair': { const b = own([c.id])[0]; if (b && b.kind === 'bld') b.rep = !b.rep; return; }
      case 'rally': { const b = own([c.id])[0]; if (b && b.kind === 'bld') b.rally = { x: +c.x, y: +c.y }; return; }
      case 'sw': { const b = own([c.id])[0]; if (b && b.def.sw) this.fireSW(b, +c.x, +c.y); return; }
      case 'capture': { const t = this.ents.get(c.t); if (!t || t.kind !== 'bld' || this.allied(pid, t.owner)) return; for (const u of own(c.ids)) if (u.def.engineer) { u.order = { t: 'capture', id: t.id }; u.path = null; u.ptk = -99; } return; }
      case 'surrender': this.eliminate(p, true); return;
    }
  }
  canBuild(pid, d) {
    const p = this.P(pid);
    if (!d || d.fac !== p.fac || d.role === 'bauhof') return false;
    if (d.role === 'superweapon' && !this.swEnabled) return false;
    if (d.noBuild) return false;
    if (this.mission && !missionAllowed(this, pid, d)) return false;
    if (d.sup) { if (!p.mods.unlock[d.key]) return false; for (const e of this.ents.values()) if (e.owner === pid && e.type === d.key) return false; if (p.q[d.q].some(it => it.type === d.key)) return false; }
    if (d.q === 'bld' || d.q === 'def') { if (!this.countRole(pid, 'bauhof') && !this.ownBlds(pid).some(b => b.def.role === 'bauhof')) return false; }
    return this.hasReq(pid, d.req);
  }
  enqueue(pid, type) {
    const d = DEFS[type], p = this.P(pid);
    if (!this.canBuild(pid, d)) return false;
    const q = p.q[d.q];
    if ((d.q === 'bld' || d.q === 'def') && q.length >= 1) return false;
    if (q.length >= 12) return false;
    q.push({ type, prog: 0, paid: 0, st: 'build' });
    return true;
  }
  cancel(pid, qn, i) {
    const p = this.P(pid), q = p.q[qn]; if (!q || !q[i]) return;
    p.credits += q[i].paid; q.splice(i, 1);
  }
  cmdPlace(pid, qn, tx, ty) {
    const p = this.P(pid), q = p.q[qn]; if (!q || !q[0] || q[0].st !== 'ready') return false;
    const d = DEFS[q[0].type];
    if (!this.canPlace(pid, d, tx, ty)) return false;
    q.shift();
    this.placeBuilding(pid, d, tx, ty);
    this.emit({ k: 'place', x: (tx + d.w / 2) * T, y: (ty + d.h / 2) * T, w: d.w });
    return true;
  }
  orderMove(units, x, y, am) {
    units = units.filter(u => u.kind === 'unit');
    if (!units.length) return;
    // Formation: Spirale von Zielpunkten
    const n = units.length, sp = T * 0.9;
    const offs = [[0, 0]];
    for (let r = 1; offs.length < n; r++) for (let k = 0; k < 8 * r && offs.length < n; k++) { const a = k / (8 * r) * Math.PI * 2; offs.push([Math.cos(a) * r * sp, Math.sin(a) * r * sp]); }
    // nach Abstand sortieren, damit Nahe auch nahe Plätze bekommen
    const cx = units.reduce((s, u) => s + u.x, 0) / n, cy = units.reduce((s, u) => s + u.y, 0) / n;
    const ang = Math.atan2(y - cy, x - cx);
    units.sort((a, b) => ((a.x - cx) * Math.cos(ang) + (a.y - cy) * Math.sin(ang)) - ((b.x - cx) * Math.cos(ang) + (b.y - cy) * Math.sin(ang))).reverse();
    units.forEach((u, i) => {
      let gx = x + offs[i][0] * (u.air ? 1.4 : 1), gy = y + offs[i][1] * (u.air ? 1.4 : 1);
      gx = Math.max(4, Math.min(this.W * T - 4, gx)); gy = Math.max(4, Math.min(this.H * T - 4, gy));
      u.order = { t: 'move', x: gx, y: gy, am }; u.tgt = 0;
      if (u.hs) u.hs = 'idle';
      if (!u.air) this.reqPath(u, gx, gy); else u.path = null;
    });
  }
  reqPath(u, x, y) { u.need = { x, y }; u.path = null; if (!u.inQ) { u.inQ = true; this.pathQ.push(u.id); } }

  // ---------- Wegfindung (A*) ----------
  nearestPassable(tx, ty, fx, fy) {
    if (this.passXY(tx, ty)) return [tx, ty];
    let best = null, bd = 1e9;
    for (let r = 1; r <= 8 && !best; r++) for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r || !this.passXY(x, y)) continue;
      const d = Math.hypot(x - fx, y - fy) * 0.1 + r; if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  findPath(sx, sy, gx, gy, maxN = 7000) {
    const W = this.W, H = this.H;
    const goal = this.nearestPassable(gx, gy, sx, sy); if (!goal) return null;
    [gx, gy] = goal;
    if (!this.passXY(sx, sy)) { const s = this.nearestPassable(sx, sy, gx, gy); if (!s) return null; [sx, sy] = s; }
    const gen = ++this._gen, g = this._g, came = this._came, st = this._stamp, cl = this._closed, heap = this._heap; heap.clear();
    const s = sy * W + sx, goalI = gy * W + gx;
    st[s] = gen; g[s] = 0; came[s] = -1; heap.push(0, s);
    const hfn = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
    let best = s, bestH = hfn(sx, sy), n = 0;
    const ter = this.map.ter;
    while (heap.size) {
      const cur = heap.pop();
      if (cl[cur] === gen) continue; cl[cur] = gen;
      if (cur === goalI) { best = cur; break; }
      if (++n > maxN) break;
      const cx = cur % W, cy = (cur / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx; if (!this.passable(ni) || cl[ni] === gen) continue;
        if (dx && dy && (!this.passable(cy * W + nx) || !this.passable(ny * W + cx))) continue;
        const t = ter[ni], tc = t === TER.HILL ? 1.35 : t === TER.SHALLOW ? 1.6 : 1;
        const ng = g[cur] + (dx && dy ? 1.414 : 1) * tc;
        if (st[ni] !== gen || ng < g[ni]) {
          st[ni] = gen; g[ni] = ng; came[ni] = cur;
          const h = hfn(nx, ny); heap.push(ng + h * 1.05, ni);
          if (h < bestH) { bestH = h; best = ni; }
        }
      }
    }
    const path = []; let c = best;
    while (c !== -1 && c !== s) { path.push(c); c = came[c]; }
    path.reverse();
    return this.smooth(sx, sy, path);
  }
  los(x0, y0, x1, y1) {
    const L = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 3;
    for (let i = 1; i <= L; i++) {
      const fx = x0 + 0.5 + (x1 - x0) * i / L, fy = y0 + 0.5 + (y1 - y0) * i / L;
      for (const [ox, oy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) if (!this.passXY(Math.floor(fx + ox), Math.floor(fy + oy))) return false;
      if (this.map.ter[Math.floor(fy) * this.W + Math.floor(fx)] !== this.map.ter[y0 * this.W + x0]) return false;
    }
    return true;
  }
  smooth(sx, sy, path) {
    if (path.length < 3) return path;
    const W = this.W, out = []; let cx = sx, cy = sy, i = 0;
    while (i < path.length) {
      let j = Math.min(path.length - 1, i + 10);
      for (; j > i; j--) { const px = path[j] % W, py = (path[j] / W) | 0; if (this.los(cx, cy, px, py)) break; }
      out.push(path[j]); cx = path[j] % W; cy = (path[j] / W) | 0; i = j + 1;
    }
    return out;
  }

  // ---------- Kampf ----------
  canHit(u, t) {
    const w = u.def.weapon; if (!w || !t || t.owner === u.owner) return false;
    if (this.allied(u.owner, t.owner)) return false;
    if (t.kind === 'unit' && t.air) return !!w.air;
    return w.gnd !== false;
  }
  rangeOf(e) {
    let r = e.def.weapon.rng * T;
    if (e.kind === 'unit' && !e.air) { const tt = this.map.ter[this.idx(this.tileOf(e.x), this.tileOf(e.y))]; if (tt === TER.HILL) r *= 1.25; }
    return r;
  }
  inRange(e, t) {
    const d = this.dist(e, t) - this.rad(t), w = e.def.weapon;
    if (w.min && d < w.min * T) return false;
    return d <= this.rangeOf(e);
  }
  acquire(e, extra) {
    const w = e.def.weapon; if (!w) return 0;
    const R = this.rangeOf(e) + (extra || 0);
    let best = 0, bs = 1e9;
    const x0 = Math.max(0, Math.floor((e.x - R - 96) / CELL)), x1 = Math.min(this.cw - 1, Math.floor((e.x + R + 96) / CELL));
    const y0 = Math.max(0, Math.floor((e.y - R - 96) / CELL)), y1 = Math.min(this.ch - 1, Math.floor((e.y + R + 96) / CELL));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const ci = cy * this.cw + cx;
      for (const arr of [this.grid[ci], this.bgrid[ci]]) for (const o of arr) {
        if (o.hp <= 0 || !this.canHit(e, o)) continue;
        const d = this.dist(e, o) - this.rad(o);
        if (d > R) continue;
        if (w.min && d < w.min * T) continue;
        let s = d;
        if (o.kind === 'bld') s += o.def.weapon ? T : 4 * T;
        else if (o.def.weapon) s -= T;
        if (s < bs) { bs = s; best = o.id; }
      }
    }
    return best;
  }
  dmgMult(e) {
    const p = this.P(e.owner); let m = 1;
    if (e.kind === 'unit') { m *= p.mods.dmg[e.def.cat] || 1; for (const a of p.mods.auras) if (Math.hypot(a.x - e.x, a.y - e.y) < a.r) { m *= a.mult; break; } }
    return m;
  }
  fire(e, t) {
    const w = e.def.weapon, wc = WCLS[w.c];
    e.cool = w.rof;
    e.face = Math.atan2(t.y - e.y, t.x - e.x);
    const dmg = w.dmg * this.dmgMult(e);
    const tx = t.x + (w.spl ? (Math.random() - 0.5) * T * 0.6 : 0), ty = t.y + (w.spl ? (Math.random() - 0.5) * T * 0.6 : 0);
    const d = Math.hypot(tx - e.x, ty - e.y);
    const tt = wc.spd ? d / wc.spd : 0;
    this.emit({ k: 's', a: [e.x | 0, e.y | 0, tx | 0, ty | 0], c: w.c, t: +tt.toFixed(2), sa: e.air ? 1 : 0, ta: t.air ? 1 : 0, big: e.def.sup ? 1 : 0 });
    const pr = { tx, ty, tid: t.id, t: tt, dmg, c: w.c, spl: (w.spl || 0) * T, owner: e.owner, air: !!t.air };
    if (tt <= 0) this.impact(pr); else this.projs.push(pr);
  }
  impact(pr) {
    if (pr.spl > 0) {
      this.emit({ k: 'b', x: pr.tx | 0, y: pr.ty | 0, r: pr.spl | 0, c: pr.c });
      this.areaDamage(pr.tx, pr.ty, pr.spl, pr.dmg, pr.c, pr.owner, pr.air, true);
    } else {
      const t = this.ents.get(pr.tid);
      if (t && Math.hypot(t.x - pr.tx, t.y - pr.ty) < this.rad(t) + 40) this.damage(t, pr.dmg, pr.c, pr.owner);
      if (WCLS[pr.c].fx !== 'bullet' && WCLS[pr.c].fx !== 'beam') this.emit({ k: 'b', x: pr.tx | 0, y: pr.ty | 0, r: 8, c: pr.c });
    }
  }
  areaDamage(x, y, r, dmg, c, owner, airOnly, enemiesOnly, falloff) {
    const hit = [];
    for (const o of this.ents.values()) {
      if (enemiesOnly && this.allied(owner, o.owner)) continue;
      if (o.kind === 'unit' && !!o.air !== !!airOnly && c !== 'nuke' && c !== 'ion') continue;
      const d = Math.hypot(o.x - x, o.y - y) - this.rad(o) * 0.7;
      if (d <= r) hit.push([o, d]);
    }
    for (const [o, d] of hit) this.damage(o, dmg * (falloff ? Math.max(0.3, 1 - Math.max(0, d) / r * 0.7) : 1), c, owner);
  }
  damage(t, amt, c, by) {
    if (t.hp <= 0 || t.inv > this.time) return;
    let m = WCLS[c] ? WCLS[c][t.def.armor] : 1;
    if (t.kind === 'bld') { for (const s of this.P(t.owner).mods.shields) if (Math.hypot(s.x - t.x, s.y - t.y) < s.r) { m *= s.mult; break; } t.lastHit = this.time; t.hitBy = by; }
    else { t.lastHit = this.time; t.hitBy = by; }
    t.hp -= amt * m;
    if (t.kind === 'bld' && by != null && by >= 0 && !this.allied(by, t.owner)) { const o = this.P(t.owner); if (!(o.lastAtt > this.time - 20)) { o.lastAtt = this.time; this.emit({ k: 'att', p: t.owner, x: t.x | 0, y: t.y | 0 }); } }
    if (t.hp <= 0) this.kill(t, by);
  }
  kill(t, by, quiet) {
    if (!this.ents.has(t.id)) return;
    this.ents.delete(t.id);
    t.hp = 0;
    if (t.kind === 'bld') {
      for (let y = t.ty; y < t.ty + t.h; y++) for (let x = t.tx; x < t.tx + t.w; x++) if (this.blk[this.idx(x, y)] === t.id) this.blk[this.idx(x, y)] = 0;
      this.recalcPower(this.P(t.owner)); this.calcMods(this.P(t.owner)); this.bgridDirty = true;
    }
    if (!quiet) this.emit({ k: 'd', o: t.owner, u: t.kind === 'unit' && !t.wave ? 1 : 0, x: t.x | 0, y: t.y | 0, r: (t.kind === 'bld' ? Math.max(t.w, t.h) * T / 2 : t.def.size) | 0, b: t.kind === 'bld' ? 1 : 0, a: t.air ? 1 : 0 });
    this.P(t.owner).stats.lost++;
    if (by != null && by >= 0 && by !== t.owner) this.P(by).stats.kills++;
  }
  sell(b) {
    const p = this.P(b.owner);
    const refund = Math.round((b.def.cost || 2500) * 0.5 * b.hp / b.def.hp);
    p.credits += refund;
    this.emit({ k: 'sell', x: b.x | 0, y: b.y | 0, p: b.owner, v: refund });
    this.kill(b, null, true);
    this.P(b.owner).stats.lost--;
  }
  deploy(u) {
    const d = DEFS[this.P(u.owner).fac + '_bauhof'];
    const tx = this.tileOf(u.x) - 1, ty = this.tileOf(u.y) - 1;
    if (!this.canPlace(u.owner, d, tx, ty, true, u)) { this.msg('Hier kann nicht entfaltet werden.', u.owner); return false; }
    this.ents.delete(u.id);
    this.placeBuilding(u.owner, d, tx, ty, true);
    this.emit({ k: 'place', x: (tx + 1.5) * T, y: (ty + 1.5) * T, w: 3 });
    return true;
  }

  // ---------- Superwaffen ----------
  fireSW(b, x, y) {
    if ((b.def.role === 'superweapon' && !this.swEnabled) || b.swt > 0 || b.stun > this.time) return;
    const s = b.def.sw, p = this.P(b.owner);
    b.swt = b.def.charge;
    x = Math.max(0, Math.min(this.W * T, x)); y = Math.max(0, Math.min(this.H * T, y));
    if (b.def.role === 'superweapon') this.msg(`WARNUNG: ${p.name} setzt ${b.def.name} ein!`, -1, '#ff5252');
    if (b.def.role === 'superweapon') this.emit({ k: 'swfire', o: b.owner, t: s.t });
    const R = (s.r || 0) * T;
    switch (s.t) {
      case 'ion':
        this.emit({ k: 'ion', x, y, r: R });
        this.timed.push({ at: this.time + 1.6, fn: () => { this.emit({ k: 'b', x, y, r: R, c: 'ion' }); this.areaDamage(x, y, R, s.dmg, 'ion', b.owner, false, false, false); } });
        break;
      case 'nuke':
        this.emit({ k: 'nukeL', sx: b.x, sy: b.y, x, y, t: 4 });
        this.timed.push({ at: this.time + 4, fn: () => { this.emit({ k: 'nuke', x, y, r: R }); this.areaDamage(x, y, R, s.dmg, 'nuke', b.owner, false, false, true); } });
        break;
      case 'drop':
        this.emit({ k: 'drop', x, y });
        this.timed.push({ at: this.time + 2.5, fn: () => {
          const tx = this.tileOf(x), ty = this.tileOf(y); let n = 0;
          for (let r = 0; r < 8 && n < s.units.length; r++) for (let yy = ty - r; yy <= ty + r && n < s.units.length; yy++) for (let xx = tx - r; xx <= tx + r && n < s.units.length; xx++) {
            if (Math.max(Math.abs(xx - tx), Math.abs(yy - ty)) !== r || !this.passXY(xx, yy)) continue;
            const u = this.spawnUnit(b.owner, DEFS[s.units[n++]], (xx + 0.5) * T, (yy + 0.5) * T); u.home = { x: u.x, y: u.y };
          }
        } });
        break;
      case 'shield':
        this.emit({ k: 'shield', x, y, r: R, t: s.dur });
        for (const o of this.ents.values()) if (o.owner === b.owner && Math.hypot(o.x - x, o.y - y) < R + this.rad(o)) o.inv = this.time + s.dur;
        break;
      case 'storm':
        this.emit({ k: 'storm', x, y, r: R, t: s.dur });
        this.storms.push({ x, y, r: R, dps: s.dps, until: this.time + s.dur, owner: b.owner });
        break;
      case 'scan':
        this.emit({ k: 'reveal', p: b.owner, x, y, r: R, t: s.dur });
        this.msg('Satelliten-Scan läuft …', b.owner, '#80d8ff');
        break;
      case 'spyplane': {
        const u = this.spawnUnit(b.owner, DEFS[this.P(b.owner).fac + '_spion'], b.x, b.y);
        u.order = { t: 'spy', x, y, hx: b.x, hy: b.y, ph: 0, tm: 0 };
        this.msg('Spionageflugzeug gestartet.', b.owner, '#ffd54f');
        break;
      }
      case 'emp':
        this.emit({ k: 'emp', x, y, r: R });
        for (const o of this.ents.values()) if (!this.allied(o.owner, b.owner) && Math.hypot(o.x - x, o.y - y) < R + this.rad(o)) { o.stun = this.time + s.dur; if (o.kind === 'unit') o.path = o.path; }
        for (const p2 of this.players) this.recalcPower(p2);
        break;
    }
  }

  // ---------- Simulationsschritt ----------
  step() {
    if (this.over) return;
    const dt = TICK; this.time += dt; this.tick++;
    for (const e of this.ents.values()) { e.px = e.x; e.py = e.y; }
    // Raster
    for (const c of this.grid) c.length = 0;
    for (const e of this.ents.values()) if (e.kind === 'unit') { const ci = Math.min(this.ch - 1, (e.y / CELL) | 0) * this.cw + Math.min(this.cw - 1, (e.x / CELL) | 0); this.grid[ci].push(e); }
    if (this.bgridDirty !== false) {
      for (const c of this.bgrid) c.length = 0;
      for (const e of this.ents.values()) if (e.kind === 'bld') { const ci = Math.min(this.ch - 1, (e.y / CELL) | 0) * this.cw + Math.min(this.cw - 1, (e.x / CELL) | 0); this.bgrid[ci].push(e); }
      this.bgridDirty = false;
    }
    // Spieler
    const slow = this.tick % 20 === 0;
    for (const p of this.players) {
      if (!p.alive) continue;
      if (slow) { this.recalcPower(p); this.calcMods(p); }
      p.credits += p.mods.income * dt;
      this.production(p, dt);
    }
    // Wege
    let budget = 30;
    while (this.pathQ.length && budget-- > 0) {
      const u = this.ents.get(this.pathQ.shift()); if (!u) continue; u.inQ = false;
      if (!u.need) continue;
      const pth = this.findPath(this.tileOf(u.x), this.tileOf(u.y), this.tileOf(u.need.x), this.tileOf(u.need.y));
      u.path = pth || []; u.pi = 0; u.need = null; u.stuckT = 0; u.lp = { x: u.x, y: u.y };
    }
    // Einheiten
    for (const e of this.ents.values()) {
      if (e.kind === 'unit') this.updUnit(e, dt); else this.updBld(e, dt);
    }
    this.separate();
    // Projektile
    for (let i = this.projs.length - 1; i >= 0; i--) { const pr = this.projs[i]; pr.t -= dt; if (pr.t <= 0) { this.projs.splice(i, 1); this.impact(pr); } }
    // Zeiteffekte
    for (let i = this.timed.length - 1; i >= 0; i--) if (this.timed[i].at <= this.time) { const t = this.timed[i]; this.timed.splice(i, 1); t.fn(); }
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const s = this.storms[i]; if (s.until <= this.time) { this.storms.splice(i, 1); continue; }
      if (this.tick % 5 === 0) for (const o of Array.from(this.ents.values())) if (!this.allied(o.owner, s.owner) && Math.hypot(o.x - s.x, o.y - s.y) < s.r + this.rad(o) * 0.5) this.damage(o, s.dps * 0.25 * (o.air ? 0.7 : 1), 'storm', s.owner);
    }
    for (const ai of this.ais) ai.update(dt);
    if (this.mission) { missionTick(this, dt); if (slow) missionCheck(this); }
    else if (slow) this.checkVictory();
    const tm = this.time;
    for (const e of this.ents.values()) e.flags = (e.stun > tm ? 1 : 0) | (e.inv > tm ? 2 : 0) | (e.rep ? 4 : 0) | (e.carry > 0 ? 8 : 0) | (e.hs === 'mine' ? 16 : 0) | (e.def.weapon && e.cool > e.def.weapon.rof - 0.4 ? 32 : 0);
  }
  production(p, dt) {
    for (const qn of QUEUES) {
      const q = p.q[qn]; if (!q.length) continue;
      const it = q[0]; if (it.st === 'ready') continue;
      const d = DEFS[it.type];
      let speed = 1;
      if (qn === 'bld' || qn === 'def') { if (!this.countRole(p.id, 'bauhof')) continue; }
      else { const n = this.countRole(p.id, BY[qn]); if (!n) continue; speed = (1 + 0.5 * (n - 1)) * (p.mods.prod[qn] || 1); }
      if (p.low) speed *= 0.5;
      if (p.ai) speed *= AI_LEVELS[p.ai].build;
      const dp = Math.min(1 - it.prog, dt * speed / d.time), cost = dp * d.cost;
      if (p.credits < cost) continue;
      p.credits -= cost; it.paid += cost; it.prog += dp;
      if (it.prog >= 0.9999) {
        if (d.kind === 'bld') { it.st = 'ready'; this.emit({ k: 'ready', p: p.id, type: d.key }); }
        else { q.shift(); this.produceUnit(p, d); }
      }
    }
  }
  produceUnit(p, d) {
    const fs = this.ownBlds(p.id).filter(b => b.def.role === BY[d.cat] && !(b.stun > this.time));
    if (!fs.length) return;
    const f = fs.find(b => b.primary) || fs[(this.tick / 7 | 0) % fs.length];
    let x, y;
    if (d.cat === 'air') { x = f.x; y = f.y; }
    else {
      let spot = null;
      for (let r = 0; r < 6 && !spot; r++) for (let xx = f.tx - r; xx < f.tx + f.w + r && !spot; xx++) for (const yy of [f.ty + f.h + r, f.ty - 1 - r]) if (!spot && this.passXY(xx, yy)) spot = [xx, yy];
      if (!spot) spot = this.nearestPassable(f.tx, f.ty + f.h, f.tx, f.ty) || [f.tx, f.ty + f.h];
      x = (spot[0] + 0.5) * T; y = (spot[1] + 0.5) * T;
    }
    const u = this.spawnUnit(p.id, d, x, y);
    this.emit({ k: 'unit', p: p.id, type: d.key });
    if (d.harvester) { u.hs = 'seek'; return; }
    const r = f.rally || { x: x + (Math.random() - 0.5) * T * 2, y: y + T * 1.5 + (d.cat === 'air' ? T * 2 : 0) };
    this.orderMove([u], r.x, r.y, true);
    u.home = { x: r.x, y: r.y };
  }

  updBld(b, dt) {
    const d = b.def;
    if (b.rep && b.hp < d.hp) {
      const p = this.P(b.owner), heal = d.hp * 0.05 * dt, cost = heal / d.hp * (d.cost || 2500) * 0.35;
      if (p.credits >= cost) { p.credits -= cost; b.hp = Math.min(d.hp, b.hp + heal); } else b.rep = false;
      if (b.hp >= d.hp) b.rep = false;
    }
    if (d.sw && b.swt > 0 && !(b.stun > this.time) && !this.P(b.owner).low) b.swt = Math.max(0, b.swt - dt);
    if (d.eff && d.eff.repair && this.tick % 4 === 0) {
      const f = d.eff.repair, R = f.r * T;
      for (const o of this.ents.values()) if (o.kind === 'unit' && o.owner === b.owner && o.hp < o.def.hp && f.cats.includes(o.def.cat) && Math.hypot(o.x - b.x, o.y - b.y) < R) o.hp = Math.min(o.def.hp, o.hp + f.hps * dt * 4);
    }
    if (!d.weapon || b.stun > this.time) return;
    b.cool -= dt;
    let t = b.tgt ? this.ents.get(b.tgt) : null;
    if (t && (!this.inRange(b, t) || !this.canHit(b, t))) { t = null; b.tgt = 0; }
    if (!t) { b.acq -= dt; if (b.acq <= 0) { b.acq = 0.4; b.tgt = this.acquire(b); t = b.tgt ? this.ents.get(b.tgt) : null; } }
    if (t) { b.face = Math.atan2(t.y - b.y, t.x - b.x); if (b.cool <= 0) this.fire(b, t); }
  }

  updUnit(u, dt) {
    const d = u.def;
    if (u.stun > this.time) return;
    u.cool -= dt;
    if (d.harvester) { this.updHarv(u, dt); this.moveAlong(u, dt); return; }
    if (d.mcv) { this.moveAlong(u, dt); return; }
    if (d.spy) { this.updSpy(u, dt); return; }
    if (d.engineer || d.scout) {
      const o = u.order;
      if (o && o.t === 'capture') {
        const t = this.ents.get(o.id);
        if (!t || this.allied(u.owner, t.owner)) { u.order = null; u.path = null; return; }
        if (this.dist(u, t) - this.rad(t) < T * 0.9) { this.capture(t, u); return; }
        if (!u.need && (!u.path || this.tick - (u.ptk || 0) > 40)) { u.ptk = this.tick; this.reqPath(u, t.x, t.y); }
        this.moveAlong(u, dt); return;
      }
      if (o && o.t === 'move') { if (u.air) { if (this.flyTo(u, o.x, o.y, dt)) { u.order = null; u.home = { x: o.x, y: o.y }; } return; } if (u.path && u.pi >= u.path.length && !u.need) { u.order = null; u.home = { x: u.x, y: u.y }; return; } this.moveAlong(u, dt); }
      else if (u.air) u.face += dt * 0.4;
      return;
    }
    const o = u.order;
    let t = u.tgt ? this.ents.get(u.tgt) : null;
    if (u.tgt && !t) { u.tgt = 0; if (o && o.t === 'attack') { u.order = null; u.home = { x: u.x, y: u.y }; } else if (o && o.t === 'move' && o.am) this.reqPath(u, o.x, o.y); }
    const explicit = o && o.t === 'attack';
    const passive = o && o.t === 'move' && !o.am;
    // Ziel suchen
    if (!t && !passive && d.weapon) {
      u.acq -= dt;
      if (u.acq <= 0) { u.acq = 0.5; const id = this.acquire(u, o ? T * 1.5 : T * 2.5); if (id) { u.tgt = id; t = this.ents.get(id); } }
    }
    if (t && !explicit && !passive) {
      // Leine: Idle-Einheiten nicht zu weit jagen lassen
      if (!o && Math.hypot(u.x - u.home.x, u.y - u.home.y) > this.rangeOf(u) + 6 * T) { u.tgt = 0; t = null; this.goTo(u, u.home.x, u.home.y); }
      else if (o && o.am && this.dist(u, t) - this.rad(t) > this.rangeOf(u) + 5 * T) { u.tgt = 0; t = null; this.reqPath(u, o.x, o.y); }
    }
    if (t && !passive) {
      if (this.inRange(u, t)) {
        if (!u.air) { u.path = null; } else { this.hover(u, t, dt); }
        u.face = Math.atan2(t.y - u.y, t.x - u.x);
        if (u.cool <= 0) this.fire(u, t);
        return;
      } else {
        if (u.air) { this.flyTo(u, t.x, t.y, dt); return; }
        if (!u.path || u.need === null && (this.tick - (u.ptk || 0)) > 30) {
          if (!u.need && (!u.path || (this.tick - (u.ptk || 0)) > 30)) { u.ptk = this.tick; this.reqPath(u, t.x, t.y); }
        }
        this.moveAlong(u, dt);
        return;
      }
    }
    // Bewegen
    if (o && o.t === 'move') {
      if (u.air) { if (this.flyTo(u, o.x, o.y, dt)) { u.order = null; u.home = { x: o.x, y: o.y }; } return; }
      if (u.path && u.pi >= u.path.length && !u.need) { u.order = null; u.home = { x: u.x, y: u.y }; return; }
      this.moveAlong(u, dt);
    } else if (o && o.t === 'return') { if (u.air ? this.flyTo(u, o.x, o.y, dt) : (u.path && u.pi >= u.path.length && !u.need)) u.order = null; else if (!u.air) this.moveAlong(u, dt); }
    else if (!o && u.air) { u.face += dt * 0.3; }
  }
  updSpy(u, dt) {
    const o = u.order; if (!o) { this.kill(u, null, true); return; }
    if (o.ph === 0) { if (this.flyTo(u, o.x, o.y, dt)) { o.ph = 1; o.tm = 0; } }
    else if (o.ph === 1) { o.tm += dt; const a = o.tm * 1.4; this.flyTo(u, o.x + Math.cos(a) * T * 5, o.y + Math.sin(a) * T * 5, dt); if (o.tm > 7) o.ph = 2; }
    else if (this.flyTo(u, o.hx, o.hy, dt)) { this.ents.delete(u.id); }
  }
  capture(b, u) {
    const from = b.owner, to = u.owner, pf = this.P(from), pt = this.P(to);
    this.ents.delete(u.id);
    b.owner = to; b.rep = false; b.rally = null; b.tgt = 0; b.lastHit = -99;
    this.emit({ k: 'capture', x: b.x | 0, y: b.y | 0, p: to, from, type: b.type });
    this.msg(`${b.def.name} erobert!`, to, '#69f0ae');
    this.msg(`${b.def.name} wurde vom Feind übernommen!`, from, '#ff5252');
    for (const p of [pf, pt]) { this.recalcPower(p); this.calcMods(p); }
    this.bgridDirty = true;
  }
  goTo(u, x, y) { u.order = { t: 'return', x, y }; if (!u.air) this.reqPath(u, x, y); }
  speedOf(u) {
    let s = u.def.spd * T * this.P(u.owner).mods.speed;
    if (!u.air) { const t = this.map.ter[this.idx(this.tileOf(u.x), this.tileOf(u.y))]; if (t === TER.HILL) s *= 0.75; else if (t === TER.SHALLOW) s *= 0.6; }
    return s;
  }
  flyTo(u, x, y, dt) {
    const dx = x - u.x, dy = y - u.y, dd = Math.hypot(dx, dy), s = this.speedOf(u) * dt;
    if (dd <= s) { u.x = x; u.y = y; return true; }
    u.x += dx / dd * s; u.y += dy / dd * s; u.face = Math.atan2(dy, dx);
    return false;
  }
  hover(u, t, dt) {
    const dd = this.dist(u, t);
    if (dd < T * 1.2 && u.def.weapon.rng > 2) { const a = Math.atan2(u.y - t.y, u.x - t.x) + 0.6; u.x += Math.cos(a) * this.speedOf(u) * dt * 0.5; u.y += Math.sin(a) * this.speedOf(u) * dt * 0.5; }
    else if (u.def.weapon.rng <= 2) this.flyTo(u, t.x, t.y, dt); // Bomber überfliegen das Ziel
  }
  moveAlong(u, dt) {
    if (!u.path || u.pi >= u.path.length) return;
    const W = this.W, wi = u.path[u.pi];
    if (!this.passable(wi)) { if (u.order) this.reqPath(u, u.order.x !== undefined ? u.order.x : u.x, u.order.y !== undefined ? u.order.y : u.y); else u.path = null; return; }
    const isLast = u.pi === u.path.length - 1;
    let wx = (wi % W + 0.5) * T, wy = (((wi / W) | 0) + 0.5) * T;
    if (isLast && u.order && u.order.x !== undefined && this.tileOf(u.order.x) === wi % W && this.tileOf(u.order.y) === ((wi / W) | 0)) { wx = u.order.x; wy = u.order.y; }
    const dx = wx - u.x, dy = wy - u.y, dd = Math.hypot(dx, dy), s = this.speedOf(u) * dt;
    if (dd <= Math.max(s, 3)) { u.x = wx; u.y = wy; u.pi++; }
    else { u.x += dx / dd * s; u.y += dy / dd * s; u.face = Math.atan2(dy, dx); }
    // Festgefahren?
    u.stuckT += dt;
    if (u.stuckT > 1.5) {
      const moved = Math.hypot(u.x - u.lp.x, u.y - u.lp.y);
      u.stuckT = 0; u.lp = { x: u.x, y: u.y };
      if (moved < T * 0.4) {
        u.rp++;
        if (u.rp > 3) { u.path = null; u.rp = 0; if (u.order && u.order.t !== 'attack') { u.order = null; u.home = { x: u.x, y: u.y }; } }
        else if (u.order && u.order.x !== undefined) this.reqPath(u, u.order.x, u.order.y);
        else if (u.need === null && u.path) { const last = u.path[u.path.length - 1]; this.reqPath(u, (last % W + 0.5) * T, (((last / W) | 0) + 0.5) * T); }
      } else u.rp = 0;
    }
  }
  separate() {
    for (const cell of this.grid) {
      for (let i = 0; i < cell.length; i++) {
        const a = cell[i]; if (a.hp <= 0) continue;
        for (let j = i + 1; j < cell.length; j++) {
          const b = cell[j]; if (a.air !== b.air) continue;
          const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy, R = (a.def.size + b.def.size) * 0.75;
          if (dd >= R * R) continue;
          const d = Math.sqrt(dd) || 0.01, push = (R - d) * 0.25, nx = dx / d || 0.7, ny = dy / d || 0.7;
          this.nudge(a, -nx * push, -ny * push); this.nudge(b, nx * push, ny * push);
        }
      }
    }
  }
  nudge(u, dx, dy) {
    const nx = u.x + dx, ny = u.y + dy;
    if (u.air) { u.x = Math.max(2, Math.min(this.W * T - 2, nx)); u.y = Math.max(2, Math.min(this.H * T - 2, ny)); return; }
    if (this.passXY(this.tileOf(nx), this.tileOf(ny))) { u.x = nx; u.y = ny; }
  }

  // ---------- Ernter ----------
  findRes(fromTile, maxR) {
    const W = this.W, fx = fromTile % W, fy = (fromTile / W) | 0, ra = this.map.ra;
    for (let r = 0; r <= maxR; r++) {
      let best = -1, bd = 1e9;
      for (let y = fy - r; y <= fy + r; y++) {
        if (y < 0 || y >= this.H) continue;
        const step = (y === fy - r || y === fy + r) ? 1 : 2 * r || 1;
        for (let x = fx - r; x <= fx + r; x += step) {
          if (x < 0 || x >= W) continue;
          const i = y * W + x;
          if (ra[i] > 0 && this.blk[i] === 0) { const d = Math.hypot(x - fx, y - fy) - this.map.rt[i] * 0.4; if (d < bd) { bd = d; best = i; } }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  updHarv(u, dt) {
    const W = this.W, p = this.P(u.owner);
    const myTile = this.idx(this.tileOf(u.x), this.tileOf(u.y));
    if (u.order && u.order.t === 'move') { if (u.path && u.pi >= u.path.length && !u.need) { u.order = null; } return; }
    switch (u.hs) {
      case 'seek': {
        if (u.carry >= HARV_CAP) { u.hs = 'ret'; break; }
        u.ht -= dt; if (u.ht > 0) break;
        const from = u.field >= 0 ? u.field : myTile;
        const i = this.findRes(from, u.field >= 0 ? 10 : 30);
        if (i < 0) { if (u.field >= 0) { u.field = -1; break; } u.ht = 4; if (u.carry > 0) u.hs = 'ret'; break; }
        u.htile = i; u.field = i; u.hs = 'go'; this.reqPath(u, (i % W + 0.5) * T, (((i / W) | 0) + 0.5) * T);
        break;
      }
      case 'go': {
        const hx = (u.htile % W + 0.5) * T, hy = (((u.htile / W) | 0) + 0.5) * T;
        if (Math.hypot(u.x - hx, u.y - hy) < T * 0.7) { u.hs = 'mine'; u.ht = 0; u.path = null; break; }
        if (this.map.ra[u.htile] === 0) { u.hs = 'seek'; break; }
        if (u.path && u.pi >= u.path.length && !u.need) { // angekommen, aber nicht auf dem Feld
          if (Math.hypot(u.x - hx, u.y - hy) < T * 1.6) { u.hs = 'mine'; u.ht = 0; } else { u.hs = 'seek'; u.ht = 0.5; u.field = myTile; }
        }
        break;
      }
      case 'mine': {
        u.ht += dt;
        if (u.ht < 0.45) break;
        u.ht = 0;
        const i = u.htile, ra = this.map.ra, rt = this.map.rt;
        if (ra[i] > 0) {
          ra[i]--; u.carry++; u.cval += RES[rt[i]].value; this.resChanged.add(i);
          u.face += 0.3;
          if (ra[i] === 0) { rt[i] = 0; }
        }
        if (u.carry >= HARV_CAP) { u.hs = 'ret'; break; }
        if (ra[i] === 0) {
          const n = this.findRes(i, 3);
          if (n >= 0) { u.htile = n; u.hs = 'go'; this.reqPath(u, (n % W + 0.5) * T, (((n / W) | 0) + 0.5) * T); }
          else { u.hs = 'seek'; u.field = -1; }
        }
        break;
      }
      case 'ret': {
        const refs = this.ownBlds(u.owner).filter(b => b.def.role === 'refinery');
        if (!refs.length) { u.hs = 'idle'; break; }
        refs.sort((a, b) => this.dist(a, u) - this.dist(b, u));
        u.dock = refs[0].id;
        const dk = this.dockTile(refs[0]);
        u.dx = (dk.x + 0.5) * T; u.dy = (dk.y + 0.5) * T;
        this.reqPath(u, u.dx, u.dy); u.hs = 'retgo'; u.ht = 0;
        break;
      }
      case 'retgo': {
        const r = this.ents.get(u.dock); if (!r) { u.hs = 'ret'; break; }
        if (Math.hypot(u.x - u.dx, u.y - u.dy) < T * 0.8 || (this.dist(u, r) < this.rad(r) + T * 1.4 && u.path && u.pi >= u.path.length)) { u.hs = 'unl'; u.ht = 0; u.path = null; break; }
        if (u.path && u.pi >= u.path.length && !u.need) { u.ht += 1; if (u.ht > 3) u.hs = 'ret'; else this.reqPath(u, u.dx, u.dy); }
        break;
      }
      case 'unl': {
        u.ht += dt;
        if (u.ht >= 1.4) {
          const v = Math.round(u.cval * p.mods.harvest * p.harvMult);
          p.credits += v; p.stats.earned += v;
          this.emit({ k: 'cash', x: u.x | 0, y: u.y | 0, p: u.owner, v });
          u.carry = 0; u.cval = 0; u.hs = 'seek'; u.ht = 0;
        }
        break;
      }
      case 'idle': default:
        if (!u.order && (!u.path || u.pi >= u.path.length) && this.tick % 40 === u.id % 40 && !(u.manual > this.time)) { u.hs = u.carry >= HARV_CAP ? 'ret' : 'seek'; }
        break;
    }
  }

  // ---------- Sieg / Niederlage ----------
  eliminate(p, surrender) {
    if (!p.alive) return;
    p.alive = false;
    for (const e of Array.from(this.ents.values())) if (e.owner === p.id) this.kill(e, null);
    for (const k of QUEUES) p.q[k] = [];
    this.msg(`${p.name} wurde ${surrender ? 'zur Aufgabe gezwungen' : 'besiegt'}!`, -1, p.color);
    this.emit({ k: 'elim', p: p.id });
  }
  checkVictory() {
    for (const p of this.players) {
      if (!p.alive) continue;
      let has = false;
      for (const e of this.ents.values()) if (e.owner === p.id && e.kind === 'bld' && e.def.generic) { has = true; break; }
      if (!has) this.eliminate(p);
    }
    const teams = new Set(this.players.filter(p => p.alive).map(p => p.team > 0 ? 't' + p.team : 'p' + p.id));
    if (teams.size <= 1) {
      this.over = true; this.winnerTeam = teams.size ? [...teams][0] : null;
      this.emit({ k: 'over', w: this.winnerTeam });
    }
  }
  makeAI(pid, lvl) {
    const p = this.P(pid); if (!p || p.ai) return;
    p.ai = lvl; p.human = false; this.ais.push(new AI(this, pid, lvl));
  }
  isWinner(pid) { const p = this.P(pid); return this.over && this.winnerTeam === (p.team > 0 ? 't' + p.team : 'p' + p.id); }

  // ---------- Sicht für UI/Netz ----------
  playerView(pid) {
    const p = this.P(pid); const q = {};
    for (const k of QUEUES) q[k] = p.q[k].map(it => ({ type: it.type, prog: it.prog, st: it.st }));
    const sw = [];
    for (const e of this.ents.values()) if (e.owner === pid && e.def.sw && (e.def.role !== 'superweapon' || this.swEnabled)) sw.push({ id: e.id, type: e.type, t: e.swt });
    return { credits: Math.floor(p.credits), powP: p.powP, powU: p.powU, low: p.low, q, sw, alive: p.alive, unlock: p.mods.unlock };
  }
  packEnt(e) {
    const fl = e.flags | 0;
    const f = Math.round(((e.face % 6.2832) + 6.2832) % 6.2832 * 20);
    if (e.kind === 'unit') return [e.id, e.def.idx, e.owner, Math.round(e.x), Math.round(e.y), Math.ceil(e.hp), f, fl];
    return [e.id, e.def.idx, e.owner, e.tx, e.ty, Math.ceil(e.hp), f, fl];
  }
  netPack(full) {
    if (!this._last || full) this._last = new Map();
    const u = [], rm = [];
    for (const e of this.ents.values()) {
      const a = this.packEnt(e), s = a.join(',');
      if (this._last.get(e.id) !== s) { u.push(a); this._last.set(e.id, s); }
    }
    for (const id of this._last.keys()) if (!this.ents.has(id)) { rm.push(id); this._last.delete(id); }
    const r = [];
    for (const i of this.resChanged) r.push(i, this.map.ra[i], this.map.rt[i]);
    this.resChanged.clear();
    const ev = this.netEvents; this.netEvents = [];
    const pl = this.players.map(p => { const v = this.playerView(p.id); v.q = Object.fromEntries(QUEUES.map(k => [k, v.q[k].map(it => [DEFS[it.type].idx, +it.prog.toFixed(3), it.st === 'ready' ? 1 : 0])])); v.sw = v.sw.map(s => [s.id, DEFS[s.type].idx, Math.ceil(s.t)]); return v; });
    return { t: 'snap', tm: +this.time.toFixed(2), u, rm, r, ev, pl, alive: this.players.map(p => p.alive ? 1 : 0), over: this.over ? 1 : 0, win: this.winnerTeam };
  }
}

// Karten für Netzwerk kodieren
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
function unb64(s, Ctor) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return Ctor === Uint16Array ? new Uint16Array(u.buffer) : u; }
function encodeMap(m) { return { w: m.w, h: m.h, name: m.name, ter: b64(m.ter), rt: b64(m.rt), ra: b64(new Uint8Array(m.ra.buffer.slice(0))), starts: m.starts }; }
function decodeMap(d) { return { w: d.w, h: d.h, name: d.name, ter: unb64(d.ter), rt: unb64(d.rt), ra: unb64(d.ra, Uint16Array), starts: d.starts }; }
