'use strict';
// ===================== CPU-Gegner =====================
const AI_LEVELS = {
  leicht: { name: 'Leicht', think: 2.6, income: 0.7, build: 0.75, wave: 6, grow: 2, delay: 420, towers: 2, sw: false, maxRef: 1, extra: 0 },
  mittel: { name: 'Mittel', think: 1.5, income: 1.0, build: 1.0, wave: 9, grow: 3, delay: 270, towers: 4, sw: true, maxRef: 2, extra: 1 },
  schwer: { name: 'Schwer', think: 0.8, income: 1.3, build: 1.2, wave: 12, grow: 4, delay: 180, towers: 6, sw: true, maxRef: 3, extra: 2 },
  brutal: { name: 'Brutal', think: 0.45, income: 1.7, build: 1.4, wave: 15, grow: 5, delay: 120, towers: 9, sw: true, maxRef: 4, extra: 3 },
};

class AI {
  constructor(g, pid, lvl) {
    this.g = g; this.pid = pid; this.L = AI_LEVELS[lvl] || AI_LEVELS.mittel;
    this.t = 1 + (pid % 5) * 0.3; this.wave = this.L.wave; this.attackers = []; this.target = 0; this.place = 0;
    this.towerN = 0; this.swDelay = 20 + Math.random() * 40; this.mode = 'normal';
  }
  get p() { return this.g.P(this.pid); }
  update(dt) { this.t -= dt; if (this.t > 0) return; this.t = this.L.think; if (this.p.alive && !this.g.over) this.think(); }
  enemies() { return this.g.players.filter(o => o.alive && !this.g.allied(this.pid, o.id)); }
  think() {
    const g = this.g, p = this.p, pid = this.pid;
    const blds = g.ownBlds(pid), units = g.ownUnits(pid);
    const cnt = (role) => blds.filter(b => b.def.role === role).length;
    const bh = blds.find(b => b.def.role === 'bauhof');
    this.base = bh ? { x: bh.tx + 1, y: bh.ty + 1 } : (blds[0] ? { x: blds[0].tx, y: blds[0].ty } : p.start);
    const en = this.enemies();
    if (!en.length) return;
    // nächster Gegner
    en.sort((a, b) => Math.hypot(a.start.x - this.base.x, a.start.y - this.base.y) - Math.hypot(b.start.x - this.base.x, b.start.y - this.base.y));
    this.foe = en[0];
    const dx = this.foe.start.x - this.base.x, dy = this.foe.start.y - this.base.y, dl = Math.hypot(dx, dy) || 1;
    this.dir = { x: dx / dl, y: dy / dl };

    // ---- Gebäude ----
    const bq = p.q.bld;
    if (bq.length && bq[0].st === 'ready') this.placeReady('bld');
    else if (!bq.length && bh) { const nx = this.nextStructure(cnt, blds); if (nx) g.enqueue(pid, nx); }
    // ---- Verteidigung ----
    const dq = p.q.def, towers = cnt('tower');
    if (dq.length && dq[0].st === 'ready') this.placeReady('def');
    else if (!dq.length && bh && towers < this.L.towers + (this.mode === 'normal' ? 0 : 4) && g.time > (this.mode === 'normal' ? 70 : 20) && p.credits > 900 && cnt('refinery') > 0) {
      const tw = defsOf(p.fac, d => d.role === 'tower' && g.canBuild(pid, d));
      if (tw.length) {
        const air = this.enemyAir();
        let pick = tw[this.towerN % tw.length];
        if (air > 3 && Math.random() < 0.5) pick = tw.find(d => d.weapon.gnd === false) || pick;
        this.towerN++; g.enqueue(pid, pick.key);
      }
    }
    // ---- Reparieren ----
    if (p.credits > 1500) for (const b of blds) if (!b.rep && b.hp < maxHp(b) * 0.6 && g.time - b.lastHit > 6) g.command(pid, { c: 'repair', id: b.id });
    // ---- Bau-Fahrzeug, falls Bauhof verloren ----
    if (!bh) {
      const mcv = units.find(u => u.def.mcv);
      if (mcv) { if (!mcv.order && !mcv.path) { if (!g.deploy(mcv)) { const s = p.start; g.command(pid, { c: 'move', ids: [mcv.id], x: (s.x + (Math.random() * 8 - 4)) * T, y: (s.y + (Math.random() * 8 - 4)) * T }); } } }
      else if (!p.q.veh.some(it => DEFS[it.type].mcv)) g.enqueue(pid, p.fac + '_mcv');
    }
    // ---- Ernter ----
    const harv = units.filter(u => u.def.harvester).length, refs = cnt('refinery');
    const wantH = Math.min(refs * (this.L.extra >= 1 ? 2 : 1) + (this.L.extra >= 2 ? 1 : 0), 8);
    if (refs && harv < wantH && !p.q.veh.some(it => DEFS[it.type].harvester)) { p.q.veh.unshift({ type: p.fac + '_ernter', prog: 0, paid: 0, st: 'build' }); }
    // ---- Einheiten ----
    const reserve = bq.length ? 400 : 0;
    const capped = this.mode !== 'normal' && units.length > 22 + 8 * this.L.extra;
    for (const cat of ['inf', 'veh', 'air']) {
      if (capped || !cnt(BY[cat]) || p.q[cat].length >= 2 || p.credits < reserve + 150) continue;
      const pick = this.pickUnit(cat); if (pick) g.enqueue(pid, pick);
    }
    this.army(units, blds);
    this.superweapons(blds);
  }
  enemyAir() { let n = 0; for (const e of this.g.ents.values()) if (e.kind === 'unit' && e.air && !this.g.allied(this.pid, e.owner)) n++; return n; }
  nextStructure(cnt, blds) {
    const g = this.g, p = this.p, f = p.fac;
    const margin = p.powP - p.powU;
    if (margin < 30 && g.canBuild(this.pid, DEFS[f + '_power'])) return f + '_power';
    const plan = [['power', 1], ['refinery', 1], ['barracks', 1], ['factory', 1], ['power', 2], ['refinery', Math.min(2, this.L.maxRef)], ['airfield', 1], ['tech', 1], ['power', 3]];
    for (const [r, n] of plan) if (cnt(r) < n && g.canBuild(this.pid, DEFS[f + '_' + r])) return f + '_' + r;
    if (margin < 120) return f + '_power';
    const specials = defsOf(f, d => d.role === 'special' && !blds.some(b => b.type === d.key) && g.canBuild(this.pid, d));
    const sws = this.L.sw ? defsOf(f, d => d.role === 'superweapon' && !blds.some(b => b.type === d.key) && g.canBuild(this.pid, d)) : [];
    // zuerst die Super-Einheit freischalten, dann gemischt
    const unlock = specials.find(d => d.eff.unlock);
    if (unlock && p.credits > 1500) return unlock.key;
    if (cnt('refinery') < this.L.maxRef && p.credits > 2500) return f + '_refinery';
    const opts = specials.concat(sws);
    if (opts.length && p.credits > 2000) return opts[(Math.random() * opts.length) | 0].key;
    if (this.L.extra >= 1 && cnt('factory') < 1 + this.L.extra && p.credits > 4000) return f + '_factory';
    if (this.L.extra >= 2 && cnt('barracks') < this.L.extra && p.credits > 3000) return f + '_barracks';
    return null;
  }
  pickUnit(cat) {
    const g = this.g, p = this.p;
    const av = defsOf(p.fac, d => d.kind === 'unit' && d.cat === cat && !d.harvester && !d.mcv && !d.engineer && !d.scout && !d.spy && g.canBuild(this.pid, d));
    if (!av.length) return null;
    const sup = av.find(d => d.sup); if (sup && p.credits > 2500) return sup.key;
    const air = this.enemyAir();
    const w = av.filter(d => !d.sup).map(d => {
      let x = 1;
      if (d.weapon && d.weapon.gnd === false) x = air > 2 ? 2.5 : 0.15;
      if (d.weapon && d.weapon.air && air > 4) x *= 1.5;
      if (d.weapon && d.weapon.c === 'arty') x *= 0.6;
      if (cat === 'inf' && d.cost <= 110) x *= 1.6;
      return x;
    });
    const list = av.filter(d => !d.sup); if (!list.length) return null;
    let s = w.reduce((a, b) => a + b, 0) * Math.random();
    for (let i = 0; i < list.length; i++) { s -= w[i]; if (s <= 0) return list[i].key; }
    return list[0].key;
  }
  placeReady(qn) {
    const g = this.g, p = this.p, d = DEFS[p.q[qn][0].type];
    const spot = this.findSpot(d);
    if (spot) g.command(this.pid, { c: 'place', q: qn, tx: spot[0], ty: spot[1] });
    else if (++this.place > 6) { g.cancel(this.pid, qn, 0); this.place = 0; }
  }
  findSpot(d) {
    const g = this.g; let c = this.base;
    if (d.role === 'refinery') {
      const ri = g.findRes(g.idx(Math.max(0, Math.min(g.W - 1, c.x)), Math.max(0, Math.min(g.H - 1, c.y))), 22);
      if (ri >= 0) { const rx = ri % g.W, ry = (ri / g.W) | 0; c = { x: Math.round(rx + (c.x - rx) * 0.45), y: Math.round(ry + (c.y - ry) * 0.45) }; }
    } else if (d.role === 'tower') {
      const ang = Math.atan2(this.dir.y, this.dir.x) + (Math.random() - 0.5) * 2.2;
      const r = 6 + Math.random() * 3;
      c = { x: Math.round(c.x + Math.cos(ang) * r), y: Math.round(c.y + Math.sin(ang) * r) };
    }
    const found = [];
    for (let r = 0; r < 18 && found.length < 6; r++) {
      for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
        if (Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) !== r) continue;
        const tx = x - (d.w >> 1), ty = y - (d.h >> 1);
        if (!this.margin(tx, ty, d)) continue;
        if (g.canPlace(this.pid, d, tx, ty)) found.push([tx, ty]);
      }
    }
    return found.length ? found[(Math.random() * Math.min(3, found.length)) | 0] : null;
  }
  margin(tx, ty, d) {
    const g = this.g, m = d.role === 'tower' ? 0 : 1;
    for (let y = ty - m; y < ty + d.h + m; y++) for (let x = tx - m; x < tx + d.w + m; x++) {
      if (x < 0 || y < 0 || x >= g.W || y >= g.H) return false;
      if (g.blk[g.idx(x, y)]) return false;
      if (g.map.ra[g.idx(x, y)] > 0 && d.role !== 'tower') return false;
    }
    return true;
  }
  army(units, blds) {
    const g = this.g, pid = this.pid;
    const army = units.filter(u => u.def.weapon && !u.def.harvester && !u.wave);
    // Ingenieure: bei Angriffen feindliche Gebäude erobern
    const engs = units.filter(u => u.def.engineer);
    if (this.L.extra >= 1 && engs.length < 2 && g.time > this.L.delay * 0.7 && !this.p.q.inf.some(it => DEFS[it.type].engineer) && g.countRole(pid, 'barracks')) g.enqueue(pid, this.p.fac + '_ingenieur');
    const tB = g.ents.get(this.target);
    if (tB && tB.kind === 'bld' && this.attackers.length > 4) for (const e of engs) if (!e.order) g.command(pid, { c: 'capture', ids: [e.id], t: tB.id });
    const atkSet = new Set(this.attackers);
    this.attackers = this.attackers.filter(id => g.ents.has(id));
    // Verteidigung
    const hit = blds.filter(b => g.time - b.lastHit < 4 && b.hitBy != null && !g.allied(pid, b.hitBy));
    if (hit.length) {
      const h = hit[0];
      const def = army.filter(u => !atkSet.has(u.id) && Math.hypot(u.x - h.x, u.y - h.y) < 30 * T && !(u.order && u.order.am));
      if (def.length) g.command(pid, { c: 'move', ids: def.map(u => u.id), x: h.x, y: h.y + T * 2, am: true });
    }
    // Sammelpunkt
    const rx = (this.base.x + this.dir.x * 9 + 0.5) * T, ry = (this.base.y + this.dir.y * 9 + 0.5) * T;
    const idle = army.filter(u => !atkSet.has(u.id) && !u.order && !u.tgt && Math.hypot(u.x - rx, u.y - ry) > 7 * T);
    if (idle.length && !hit.length) g.command(pid, { c: 'move', ids: idle.map(u => u.id), x: rx, y: ry, am: true });
    // Angriff
    if (this.attackers.length) {
      if (this.attackers.length < 3) { this.attackers = []; return; }
      let tgt = g.ents.get(this.target);
      const att = this.attackers.map(id => g.ents.get(id));
      if (!tgt) {
        const cx = att.reduce((s, u) => s + u.x, 0) / att.length, cy = att.reduce((s, u) => s + u.y, 0) / att.length;
        tgt = this.pickTarget(cx, cy); this.target = tgt ? tgt.id : 0;
        if (tgt) g.command(pid, { c: 'move', ids: this.attackers, x: tgt.x, y: tgt.y, am: true });
        else this.attackers = [];
      } else {
        const lazy = att.filter(u => !u.order && !u.tgt);
        if (lazy.length) g.command(pid, { c: 'move', ids: lazy.map(u => u.id), x: tgt.x, y: tgt.y, am: true });
      }
    } else if (this.mode === 'normal' && army.length >= this.wave && g.time > this.L.delay) {
      const tgt = this.pickTarget(this.base.x * T, this.base.y * T);
      if (tgt) {
        this.attackers = army.map(u => u.id); this.target = tgt.id;
        g.command(pid, { c: 'move', ids: this.attackers, x: tgt.x, y: tgt.y, am: true });
        this.wave = Math.min(45, this.wave + this.L.grow);
      }
    }
  }
  pickTarget(x, y) {
    const g = this.g; let best = null, bd = 1e12;
    const foeId = this.foe ? this.foe.id : -1;
    for (const e of g.ents.values()) {
      if (e.kind !== 'bld' || g.allied(this.pid, e.owner) || e.def.role === 'wall' || e.def.role === 'gate') continue;
      let d = Math.hypot(e.x - x, e.y - y);
      if (e.owner !== foeId) d *= 1.6;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  superweapons(blds) {
    if (!this.L.sw || !this.g.swEnabled) return;
    const g = this.g;
    for (const b of blds) {
      if (b.def.role !== 'superweapon' || b.swt > 0) continue;
      if (this.mode === 'defend' && b.def.sw.t !== 'shield' && g.time < 600) continue;
      if (g.time < this.swDelay + 300) continue;
      const t = b.def.sw.t;
      let pos = null;
      if (t === 'shield') {
        if (this.attackers.length > 4) { const att = this.attackers.map(id => g.ents.get(id)).filter(Boolean); pos = { x: att.reduce((s, u) => s + u.x, 0) / att.length, y: att.reduce((s, u) => s + u.y, 0) / att.length }; }
      } else {
        // dichteste gegnerische Ansammlung
        const en = [...g.ents.values()].filter(e => e.kind === 'bld' && !g.allied(this.pid, e.owner));
        let bs = -1;
        for (let i = 0; i < en.length; i += Math.max(1, (en.length / 40) | 0)) {
          const a = en[i]; let s = 0;
          for (const o of en) if (Math.hypot(o.x - a.x, o.y - a.y) < 5 * T) s += o.def.generic ? 2 : 1;
          if (s > bs) { bs = s; pos = { x: a.x, y: a.y }; }
        }
        if (pos && t === 'drop') { pos = { x: pos.x - this.dir.x * 5 * T, y: pos.y - this.dir.y * 5 * T }; }
      }
      if (pos) g.command(this.pid, { c: 'sw', id: b.id, x: pos.x, y: pos.y });
    }
  }
}
