'use strict';
// ===================== Bedienoberfläche im Spiel =====================
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
function toast(t, ms = 1800) { const el = $('#toast'); el.textContent = t; el.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => el.style.display = 'none', ms); }
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// --- Regeln, die auch der Client kennt ---
function uiHasReq(world, pid, req) {
  const roles = new Set(), types = new Set();
  for (const e of world.ents.values()) if (e.kind === 'bld' && e.owner === pid) { roles.add(e.def.role); types.add(e.type); }
  return req.filter(r => !roles.has(r) && !types.has(r));
}
function reqName(fac, r) { const d = DEFS[r] || DEFS[fac + '_' + r]; return d ? d.name : r; }
function uiCanBuild(world, pid, view, d) {
  if (d.role === 'superweapon' && !world.swEnabled) return 'Superwaffen sind deaktiviert';
  const fac = world.players[pid].fac;
  if ((d.q === 'bld' || d.q === 'def') && uiHasReq(world, pid, ['bauhof']).length) return 'Benötigt: ' + reqName(fac, 'bauhof');
  const miss = uiHasReq(world, pid, d.req);
  if (miss.length) return 'Benötigt: ' + miss.map(r => reqName(fac, r)).join(', ');
  if (d.sup) {
    for (const e of world.ents.values()) if (e.owner === pid && e.type === d.key) return 'Nur eine Super-Einheit gleichzeitig';
    if (view.q[d.q].some(it => it.type === d.key)) return 'Wird bereits gebaut';
  }
  return null;
}
function uiCanPlace(world, pid, d, tx, ty) {
  const m = world.map;
  if (tx < 0 || ty < 0 || tx + d.w > m.w || ty + d.h > m.h) return false;
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) { const t = m.ter[y * m.w + x]; if (t !== TER.LOW && t !== TER.HILL) return false; }
  let near = false;
  const x0 = tx * T, y0 = ty * T, x1 = (tx + d.w) * T, y1 = (ty + d.h) * T;
  for (const e of world.ents.values()) {
    if (e.kind === 'bld') {
      if (tx < e.tx + e.w && tx + d.w > e.tx && ty < e.ty + e.h && ty + d.h > e.ty) return false;
      if (e.owner === pid) { const gx = Math.max(0, e.tx - (tx + d.w), tx - (e.tx + e.w)), gy = Math.max(0, e.ty - (ty + d.h), ty - (e.ty + e.h)); if (Math.max(gx, gy) <= 5) near = true; }
    } else if (!e.air && e.x > x0 - 4 && e.x < x1 + 4 && e.y > y0 - 4 && e.y < y1 + 4) return false;
  }
  return near;
}
function fmtTime(s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function statLine(d) {
  const parts = [`❤ ${d.hp}`];
  if (d.weapon) { const w = d.weapon, best = Object.entries({ Infanterie: WCLS[w.c].inf, Fahrzeuge: WCLS[w.c].veh, Luft: w.air ? WCLS[w.c].air : 0, Gebäude: w.gnd === false ? 0 : WCLS[w.c].bld }).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).map(e => e[0]); parts.push(`⚔ ${w.dmg} · Reichw. ${w.rng}`); parts.push('stark gg. ' + best.slice(0, 2).join(', ')); if (w.air && w.gnd === false) parts.push('nur Luftziele'); else if (!w.air) parts.push('keine Luftziele'); }
  if (d.spd) parts.push(`➤ ${d.spd}`);
  if (d.pow) parts.push(`⚡ ${d.pow > 0 ? '+' : ''}${d.pow}`);
  if (d.charge) parts.push('Ladezeit ' + fmtTime(d.charge));
  return parts.join(' · ');
}

class HUD {
  constructor() {
    this.cv = $('#cv'); this.mini = $('#mini');
    this.tab = 'bld'; this.sel = new Set(); this.groups = {};
    this.cam = { x: 0, y: 0, z: 1, dpr: 1 };
    this.ptr = new Map(); this.mode = null; this.keys = {};
    this.ui = { pid: 0, sel: this.sel, placing: null, ghost: null, ghostOk: false, swTarget: null, mouseW: null, box: null, marker: null, showHp: true, swReady: new Set() };
    this.k = 1; this.amove = false; this.boxMode = false; this.edge = true; this.sellConfirm = 0; this.lastTap = { t: 0, id: 0 };
    this.bind();
  }
  get sideW() { return this.hidden ? 0 : $('#side').offsetWidth; }
  start(session) {
    this.s = session; this.world = session.world; this.pid = session.pid; this.ui.pid = this.pid;
    this.sel.clear(); this.ui.placing = null; this.ui.ghost = null; this.ui.swTarget = null; this.amove = false; this.groups = {};
    this.gridKey = ''; this.cmdKey = ''; this.readyFlash = {}; this.centered = false;
    this.resize();
    this.cam.z = this.k < 1 ? (IS_TOUCH ? 1.0 : 1.3) : (IS_TOUCH ? 0.8 : 1);
    this.centerBase();
    this.setTab('bld');
    $('#msgs').innerHTML = '';
  }
  // ---------- Kamera ----------
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cam.dpr = dpr; this.cv.width = Math.round(innerWidth * dpr); this.cv.height = Math.round(innerHeight * dpr);
  }
  viewW() { return (innerWidth - this.sideW) / this.cam.z; }
  viewH() { return innerHeight / (this.cam.z * this.k); }
  clampCam() {
    if (!this.world) return;
    const m = this.world.map, c = this.cam, vw = this.viewW(), vh = this.viewH(), pad = 64;
    c.x = Math.max(-pad, Math.min(m.w * T - vw + pad, c.x)); c.y = Math.max(-40 / (c.z * this.k) - (this.k < 1 ? 60 : 16), Math.min(m.h * T - vh + pad, c.y));
    if (m.w * T < vw) c.x = (m.w * T - vw) / 2;
  }
  lookAt(x, y) { this.cam.x = x - this.viewW() / 2; this.cam.y = y - this.viewH() / 2; this.clampCam(); }
  centerBase() {
    let t = null;
    for (const e of this.world.ents.values()) if (e.owner === this.pid) { if (e.kind === 'bld' && e.def.role === 'bauhof') { t = e; break; } if (!t) t = e; }
    if (t) this.lookAt(t.x, t.y); else { const p = this.world.players[this.pid]; }
  }
  toWorld(sx, sy) { return { x: this.cam.x + sx / this.cam.z, y: this.cam.y + sy / (this.cam.z * this.k) }; }
  zoomAt(sx, sy, f) {
    const w = this.toWorld(sx, sy);
    this.cam.z = Math.max(0.3, Math.min(2.2, this.cam.z * f));
    this.cam.x = w.x - sx / this.cam.z; this.cam.y = w.y - sy / (this.cam.z * this.k); this.clampCam();
  }
  frame(dt) {
    const k = this.keys, sp = 900 * dt / this.cam.z;
    if (k.ArrowLeft || k.a) this.cam.x -= sp; if (k.ArrowRight || k.d) this.cam.x += sp;
    if (k.ArrowUp || k.w) this.cam.y -= sp; if (k.ArrowDown || k.s) this.cam.y += sp;
    if (this.edge && this.mouseIn && this.lastMouse && !IS_TOUCH) {
      const m = this.lastMouse, E = 12, W = innerWidth - this.sideW;
      if (m.x < E) this.cam.x -= sp; else if (m.x > W - E && m.x < W) this.cam.x += sp;
      if (m.y < E) this.cam.y -= sp; else if (m.y > innerHeight - E) this.cam.y += sp;
    }
    this.clampCam();
    if (this.lastMouse && this.mouseIn) this.ui.mouseW = this.toWorld(this.lastMouse.x, this.lastMouse.y);
    if (this.ui.placing && this.ui.mouseW && !IS_TOUCH) this.setGhost(this.ui.mouseW);
  }
  // ---------- Eingabe ----------
  bind() {
    const cv = this.cv;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    $('#side').addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => this.move(e));
    cv.addEventListener('pointerup', e => this.up(e));
    cv.addEventListener('pointercancel', e => { this.ptr.delete(e.pointerId); if (!this.ptr.size) { this.mode = null; this.ui.box = null; } });
    cv.addEventListener('pointerleave', () => { this.mouseIn = false; });
    cv.addEventListener('pointerenter', () => { this.mouseIn = true; });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    addEventListener('resize', () => { this.resize(); this.clampCam(); });
    addEventListener('keydown', e => this.key(e, true));
    addEventListener('keyup', e => this.key(e, false));
    addEventListener('blur', () => { this.keys = {}; });
    // Minimap
    const mm = (e) => { const r = this.mini.getBoundingClientRect(), mi = this.miniInfo; if (!mi) return; const sx = (e.clientX - r.left) * this.mini.width / r.width, sy = (e.clientY - r.top) * this.mini.height / r.height; const wx = (sx - mi.ox) / mi.sc * T, wy = (sy - mi.oy) / mi.sc * T; if (e.button === 2 && this.ownSelUnits().length) { this.cmdMove({ x: wx, y: wy }); return; } this.lookAt(wx, wy); };
    this.mini.addEventListener('pointerdown', e => { this.miniDrag = true; this.mini.setPointerCapture(e.pointerId); mm(e); });
    this.mini.addEventListener('pointermove', e => { if (this.miniDrag && e.button !== 2) mm(e); });
    this.mini.addEventListener('pointerup', () => this.miniDrag = false);
    this.mini.addEventListener('contextmenu', e => e.preventDefault());
    $$('#tabs button').forEach(b => b.addEventListener('click', () => this.setTab(b.dataset.q)));
  }
  key(e, d) {
    if (!this.s || document.activeElement && document.activeElement.tagName === 'INPUT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.keys[k] = d;
    if (!d) return;
    if (k === 'Escape') { if (this.ui.placing || this.ui.swTarget || this.amove) this.cancelModes(); else if (this.sel.size) this.sel.clear(); else this.app.togglePause(); }
    else if (k === ' ' || k === 'h') { this.centerBase(); e.preventDefault(); }
    else if (k === 'q') this.selectArmy();
    else if (k === 'x') this.cmd({ c: 'stop', ids: [...this.sel] });
    else if (k === 'f') { this.amove = !this.amove; this.cmdKey = ''; }
    else if (/^[1-9]$/.test(k)) {
      if (e.ctrlKey || e.metaKey) { this.groups[k] = [...this.sel]; toast('Gruppe ' + k + ' gespeichert'); e.preventDefault(); }
      else if (this.groups[k]) { const ids = this.groups[k].filter(id => this.world.ents.has(id)); const now = performance.now(); if (this._lg === k && now - this._lgT < 400 && ids.length) { const e1 = this.world.ents.get(ids[0]); this.lookAt(e1.x, e1.y); } this._lg = k; this._lgT = now; this.sel.clear(); ids.forEach(i => this.sel.add(i)); }
    }
  }
  down(e) {
    this.cv.setPointerCapture(e.pointerId);
    this.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, type: e.pointerType, btn: e.button, shift: e.shiftKey });
    if (this.ptr.size === 2) {
      const [a, b] = [...this.ptr.values()];
      this.mode = 'pinch'; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, z: this.cam.z, w: this.toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
      this.ui.box = null;
    } else if (this.ptr.size === 1) this.mode = null;
  }
  move(e) {
    if (e.pointerType === 'mouse') { this.lastMouse = { x: e.clientX, y: e.clientY }; this.mouseIn = true; }
    const p = this.ptr.get(e.pointerId); if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (this.mode === 'pinch') {
      if (this.ptr.size < 2) return;
      const [a, b] = [...this.ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      this.cam.z = Math.max(0.3, Math.min(2.2, this.pinch.z * d / Math.max(20, this.pinch.d)));
      this.cam.x = this.pinch.w.x - cx / this.cam.z; this.cam.y = this.pinch.w.y - cy / (this.cam.z * this.k); this.clampCam();
      return;
    }
    if (!this.mode && Math.hypot(p.x - p.sx, p.y - p.sy) > (p.type === 'mouse' ? 6 : 12)) {
      if (p.type === 'mouse') this.mode = (p.btn === 0 && !this.ui.placing && !this.ui.swTarget) ? 'box' : 'pan';
      else this.mode = (this.boxMode && !this.ui.placing) ? 'box' : 'pan';
    }
    if (this.mode === 'pan') { this.cam.x -= (p.x - p.lx) / this.cam.z; this.cam.y -= (p.y - p.ly) / (this.cam.z * this.k); this.clampCam(); }
    else if (this.mode === 'box') this.ui.box = { x0: Math.min(p.sx, p.x), y0: Math.min(p.sy, p.y), x1: Math.max(p.sx, p.x), y1: Math.max(p.sy, p.y) };
    p.lx = p.x; p.ly = p.y;
  }
  up(e) {
    const p = this.ptr.get(e.pointerId); if (!p) return;
    this.ptr.delete(e.pointerId);
    if (this.mode === 'pinch') { if (!this.ptr.size) this.mode = null; return; }
    if (this.mode === 'box') { this.boxSelect(this.ui.box, p.shift || e.shiftKey); this.ui.box = null; if (this.boxMode && IS_TOUCH) { this.boxMode = false; this.cmdKey = ''; } }
    else if (!this.mode) this.tap(p.x, p.y, p.btn, e.shiftKey);
    this.mode = null;
  }
  pick(w) {
    let best = null, bd = 1e9; const tol = 10 / this.cam.z + 4;
    const fog = this.fog && this.fog.enabled ? this.fog : null;
    for (const e of this.world.ents.values()) {
      if (e.kind !== 'unit' || (fog && !fog.canSee(e))) continue;
      const ey = this.gy(e), d = Math.hypot(e.x - w.x, (ey - w.y) * this.k);
      if (d < e.def.size + tol && d < bd) { bd = d; best = e; }
    }
    if (best) return best;
    const up = this.k < 1 ? 45 : 0;
    for (const e of this.world.ents.values()) if (e.kind === 'bld' && (!fog || fog.canSee(e)) && w.x >= e.tx * T && w.x < (e.tx + e.w) * T && w.y >= e.ty * T - up && w.y < (e.ty + e.h) * T - (up ? 8 : 0)) return e;
    return null;
  }
  gy(e) { const r = this.app && this.app.rend; return r && r.groundY ? r.groundY(e) : (e.air ? e.y - 22 : e.y); }
  ownSelUnits() { const r = []; for (const id of this.sel) { const e = this.world.ents.get(id); if (e && e.kind === 'unit' && e.owner === this.pid) r.push(e); } return r; }
  ownSelBld() { if (this.sel.size !== 1) return null; const e = this.world.ents.get([...this.sel][0]); return e && e.kind === 'bld' && e.owner === this.pid ? e : null; }
  tap(sx, sy, btn, shift) {
    const w = this.toWorld(sx, sy), ui = this.ui;
    if (btn === 2) { if (ui.placing || ui.swTarget || this.amove) this.cancelModes(); else if (this.ownSelUnits().length) { const h = this.pick(w); if (h && !isAllied(this.world.players[h.owner], this.world.players[this.pid])) this.cmdAttack(h); else this.cmdMove(w); } else this.sel.clear(); this.cmdKey = ''; return; }
    if (ui.swTarget) { this.cmd({ c: 'sw', id: ui.swTarget.id, x: Math.round(w.x), y: Math.round(w.y) }); ui.swTarget = null; this.cmdKey = ''; return; }
    if (ui.placing) {
      const d = DEFS[ui.placing.type], tx = Math.floor(w.x / T - d.w / 2 + 0.5), ty = Math.floor(w.y / T - d.h / 2 + 0.5);
      const g = ui.ghost;
      const inGhost = g && Math.floor(w.x / T) >= g.tx && Math.floor(w.x / T) < g.tx + d.w && Math.floor(w.y / T) >= g.ty && Math.floor(w.y / T) < g.ty + d.h;
      if (IS_TOUCH && !inGhost) { this.setGhost(w); return; }
      if (!IS_TOUCH) this.setGhost(w);
      if (ui.ghostOk) { this.cmd({ c: 'place', q: ui.placing.q, tx: ui.ghost.tx, ty: ui.ghost.ty }); ui.placing = null; ui.ghost = null; this.cmdKey = ''; }
      else toast('Hier kann nicht gebaut werden – nahe an eigenen Gebäuden, auf freiem Land.');
      return;
    }
    const hit = this.pick(w), mine = this.ownSelUnits();
    const P = this.world.players;
    if (this.amove && mine.length) { this.cmdMove(w, true); this.amove = false; this.cmdKey = ''; return; }
    if (hit && hit.owner === this.pid) {
      if (mine.length && mine.some(u => u.def.harvester) && hit.def.role === 'refinery') { this.cmd({ c: 'dock', ids: mine.filter(u => u.def.harvester).map(u => u.id) }); this.mark(hit, '#ffd54f'); return; }
      const now = performance.now();
      if (this.lastTap.id === hit.id && now - this.lastTap.t < 380 && hit.kind === 'unit') { // Doppeltipp: gleicher Typ im Bild
        const vw = this.viewW(), vh = this.viewH();
        for (const e of this.world.ents.values()) if (e.owner === this.pid && e.type === hit.type && e.x > this.cam.x && e.x < this.cam.x + vw && e.y > this.cam.y && e.y < this.cam.y + vh) this.sel.add(e.id);
      } else {
        if (!shift || hit.kind === 'bld') this.sel.clear();
        if (this.sel.has(hit.id) && shift) this.sel.delete(hit.id); else this.sel.add(hit.id);
      }
      this.lastTap = { t: now, id: hit.id }; this.sellConfirm = 0; this.cmdKey = '';
      return;
    }
    if (hit && !isAllied(P[hit.owner], P[this.pid]) && mine.length) { this.cmdAttack(hit); return; }
    if (mine.length) { this.cmdMove(w); return; }
    const b = this.ownSelBld();
    if (b && ['barracks', 'factory', 'airfield'].includes(b.def.role)) { b.rally = { x: w.x, y: w.y }; this.cmd({ c: 'rally', id: b.id, x: Math.round(w.x), y: Math.round(w.y) }); this.mark(w, '#76ff03'); toast('Sammelpunkt gesetzt'); return; }
    if (hit) { this.sel.clear(); this.sel.add(hit.id); this.cmdKey = ''; return; } // fremde Einheit ansehen
    this.sel.clear(); this.cmdKey = '';
  }
  cmdMove(w, am) {
    const mine = this.ownSelUnits(), m = this.world.map;
    const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T), i = ty * m.w + tx;
    const harv = mine.filter(u => u.def.harvester);
    if (harv.length && i >= 0 && i < m.ra.length && m.ra[i] > 0) {
      this.cmd({ c: 'harvest', ids: harv.map(u => u.id), tx, ty });
      const rest = mine.filter(u => !u.def.harvester); if (rest.length) this.cmd({ c: 'move', ids: rest.map(u => u.id), x: Math.round(w.x), y: Math.round(w.y), am: !!am });
      this.mark(w, '#ffd54f'); return;
    }
    this.cmd({ c: 'move', ids: mine.map(u => u.id), x: Math.round(w.x), y: Math.round(w.y), am: !!am });
    this.mark(w, am ? '#ff9100' : '#76ff03');
  }
  cmdAttack(t) {
    const mine = this.ownSelUnits(), eng = mine.filter(u => u.def.engineer), rest = mine.filter(u => !u.def.engineer && !u.def.scout);
    if (eng.length && t.kind === 'bld') { this.cmd({ c: 'capture', ids: eng.map(u => u.id), t: t.id }); this.mark(t, '#69f0ae'); toast('Ingenieur übernimmt das Gebäude …'); }
    else if (eng.length) this.cmd({ c: 'move', ids: eng.map(u => u.id), x: Math.round(t.x), y: Math.round(t.y) });
    if (rest.length) { this.cmd({ c: 'attack', ids: rest.map(u => u.id), t: t.id }); this.mark(t, '#ff1744'); }
  }
  mark(w, col) { this.ui.marker = { x: w.x, y: w.y, s: performance.now() / 1000, col }; }
  cmd(c) { this.s.cmd(c); }
  boxSelect(b, add) {
    if (!b) return;
    const a = this.toWorld(b.x0, b.y0), z = this.toWorld(b.x1, b.y1);
    const found = [];
    for (const e of this.world.ents.values()) if (e.kind === 'unit' && e.owner === this.pid) { const ey = this.gy(e); if (e.x >= a.x && e.x <= z.x && ey >= a.y && ey <= z.y) found.push(e); }
    if (!found.length) return;
    const combat = found.filter(e => !e.def.harvester && !e.def.mcv);
    if (!add) this.sel.clear();
    (combat.length ? combat : found).forEach(e => this.sel.add(e.id));
    this.cmdKey = '';
  }
  selectArmy() { this.sel.clear(); for (const e of this.world.ents.values()) if (e.kind === 'unit' && e.owner === this.pid && e.def.weapon && !e.def.spy) this.sel.add(e.id); this.cmdKey = ''; }
  setGhost(w) {
    const ui = this.ui, d = DEFS[ui.placing.type];
    const tx = Math.floor(w.x / T - d.w / 2 + 0.5), ty = Math.floor(w.y / T - d.h / 2 + 0.5);
    if (ui.ghost && ui.ghost.tx === tx && ui.ghost.ty === ty && this._gT > performance.now() - 300) return;
    ui.ghost = { tx, ty }; this._gT = performance.now();
    ui.ghostOk = uiCanPlace(this.world, this.pid, d, tx, ty);
  }
  cancelModes() { this.ui.placing = null; this.ui.ghost = null; this.ui.swTarget = null; this.amove = false; this.cmdKey = ''; }

  // ---------- Seitenleiste ----------
  setTab(q) { this.tab = q; $$('#tabs button').forEach(b => b.classList.toggle('act', b.dataset.q === q)); this.gridKey = ''; this.refresh(); }
  buildGrid() {
    const fac = this.world.players[this.pid].fac, col = this.world.players[this.pid].color;
    const list = defsOf(fac, d => d.q === this.tab && d.role !== 'bauhof' && !d.noBuild && (d.role !== 'superweapon' || this.world.swEnabled));
    const g = $('#grid'); g.innerHTML = '';
    this.btns = list.map(d => {
      const b = document.createElement('div'); b.className = 'bb' + (d.sup ? ' sup' : '');
      b.style.backgroundImage = `url(${this.app && this.app.rend && this.app.rend.icon ? this.app.rend.icon(d.key, col) : iconFor(d.key, col)})`;
      b.innerHTML = `<div class="prog" style="width:0"></div><span class="cnt"></span><span class="cost">${d.cost}</span><div class="nm">${d.name}</div>`;
      let lp = null, fired = false;
      b.addEventListener('pointerdown', (e) => { fired = false; if (e.button === 2) return; lp = setTimeout(() => { fired = true; this.cancelBuild(d); }, 480); });
      b.addEventListener('pointerup', (e) => { clearTimeout(lp); if (e.button === 2) { this.cancelBuild(d); return; } if (!fired) this.clickBuild(d); });
      b.addEventListener('pointerleave', () => clearTimeout(lp));
      b.addEventListener('pointerenter', () => this.showInfo(d));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return { d, el: b, prog: b.querySelector('.prog'), cnt: b.querySelector('.cnt') };
    });
    this.btns.forEach(x => g.appendChild(x.el));
  }
  showInfo(d) {
    const why = uiCanBuild(this.world, this.pid, this.view || this.s.view(), d);
    $('#info').innerHTML = `<b>${d.name}</b> – $${d.cost}<br>${d.desc || ''}${d.desc ? '<br>' : ''}<span>${statLine(d)}</span>${why ? `<br><span style="color:#ff8a80">${why}</span>` : ''}`;
  }
  clickBuild(d) {
    const v = this.view, why = uiCanBuild(this.world, this.pid, v, d);
    this.showInfo(d);
    if (d.q === 'bld' || d.q === 'def') {
      const q = v.q[d.q];
      if (q[0] && q[0].type === d.key && q[0].st === 'ready') { this.ui.placing = { type: d.key, q: d.q }; this.ui.ghost = null; this.ui.swTarget = null; this.cmdKey = ''; toast(IS_TOUCH ? 'Tippe auf die Karte für die Position, dann nochmals zum Bestätigen' : 'Klicke auf die Karte, um zu bauen', 2600); return; }
      if (q.length) { toast(q[0].type === d.key ? 'Wird gebaut … (lange drücken = abbrechen)' : 'Es wird bereits etwas anderes gebaut'); return; }
    }
    if (why) { toast(why); return; }
    if (v.credits < 1 && d.cost > 0) toast('Nicht genug Credits – Bau wartet auf Geld');
    this.cmd({ c: 'build', type: d.key });
  }
  cancelBuild(d) {
    const q = this.view.q[d.q];
    for (let i = q.length - 1; i >= 0; i--) if (q[i].type === d.key) { this.cmd({ c: 'cancel', q: d.q, i }); if (this.ui.placing && this.ui.placing.type === d.key) this.cancelModes(); toast(d.name + ' abgebrochen'); return; }
  }
  refresh() {
    if (!this.s) return;
    const v = this.view = this.s.view(), w = this.world;
    if (!this.centered) { for (const e of w.ents.values()) if (e.owner === this.pid) { this.centered = true; this.centerBase(); break; } }
    // Auswahl bereinigen
    for (const id of [...this.sel]) if (!w.ents.has(id)) this.sel.delete(id);
    $('#credits').textContent = '$ ' + v.credits.toLocaleString('de-DE');
    const pw = $('#power'); pw.classList.toggle('low', v.powU > v.powP);
    const mx = Math.max(v.powP, v.powU, 1);
    $('#powfill').style.width = (Math.min(1, v.powP / mx) * 100) + '%';
    $('#powuse').style.left = (Math.min(1, v.powU / mx) * 100) + '%';
    $('#powtxt').textContent = `${v.powP}/${v.powU}`;
    // Superwaffen
    const swb = $('#swbar'), swk = v.sw.map(s => s.id + ':' + (s.t <= 0 ? 'r' : Math.ceil(s.t))).join(',');
    this.ui.swReady = new Set(v.sw.filter(s => s.t <= 0).map(s => s.id));
    if (swb._k !== swk) {
      swb._k = swk; swb.innerHTML = '';
      for (const s of v.sw) {
        const d = DEFS[s.type], b = document.createElement('button');
        b.className = s.t <= 0 ? 'ready' : 'charging';
        const ic = d.role === 'intel' ? '📡 ' : '☢ ';
        b.textContent = (s.t <= 0 ? ic : '') + (d.role === 'intel' ? (d.sw.t === 'scan' ? 'Scan' : 'Spion') : d.name.split('-')[0].split(' ')[0]) + ' ' + (s.t <= 0 ? 'BEREIT' : fmtTime(s.t));
        if (d.role === 'intel' && s.t <= 0) b.className = 'ready intel';
        b.onclick = () => { if (s.t > 0) { toast('Lädt noch ' + fmtTime(s.t)); return; } this.ui.swTarget = { id: s.id, type: s.type }; this.ui.placing = null; this.cmdKey = ''; toast('Ziel für ' + d.name + ' wählen'); };
        swb.appendChild(b);
      }
    }
    // Bauleiste
    const gk = this.tab + '|' + w.swEnabled;
    if (this.gridKey !== gk) { this.gridKey = gk; this.buildGrid(); }
    for (const b of this.btns) {
      const d = b.d, q = v.q[d.q], why = uiCanBuild(w, this.pid, v, d);
      const mineQ = q.filter(it => it.type === d.key), head = q[0];
      const isHead = head && head.type === d.key;
      b.el.classList.toggle('lock', !!why && !mineQ.length);
      b.el.classList.toggle('ready', !!(isHead && head.st === 'ready'));
      b.el.classList.toggle('busy', (d.q === 'bld' || d.q === 'def') && !!head && !isHead);
      b.prog.style.width = isHead && head.st !== 'ready' ? ((1 - head.prog) * 100) + '%' : mineQ.length ? '100%' : '0';
      b.cnt.textContent = d.kind === 'unit' && mineQ.length ? mineQ.length : '';
    }
    for (const qn of ['bld', 'def']) { const r = v.q[qn][0] && v.q[qn][0].st === 'ready'; const tb = $(`#tabs button[data-q="${qn}"]`); tb.classList.toggle('flash', !!r && this.tab !== qn); }
    this.refreshCmd();
  }
  refreshCmd() {
    const mine = this.ownSelUnits(), b = this.ownSelBld(), ui = this.ui;
    const key = [mine.length, mine.some(u => u.def.harvester), mine.length === 1 && mine[0].def.mcv, b ? b.id + ':' + (b.flags & 4) : '', ui.placing ? 1 : 0, ui.swTarget ? 1 : 0, this.amove, this.boxMode, this.sellConfirm].join('|');
    // Auswahl-Info
    let info = '';
    if (this.sel.size) {
      const cnt = {}; for (const id of this.sel) { const e = this.world.ents.get(id); if (e) cnt[e.def.name] = (cnt[e.def.name] || 0) + 1; }
      info = Object.entries(cnt).map(([n, c]) => (c > 1 ? c + '× ' : '') + n).join(', ');
      if (this.sel.size === 1) { const e = this.world.ents.get([...this.sel][0]); if (e) info += ` (${Math.ceil(e.hp)}/${e.def.hp})` + (e.owner !== this.pid ? ' – ' + this.world.players[e.owner].name : ''); }
    }
    $('#selinfo').textContent = info;
    if (key === this.cmdKey) return; this.cmdKey = key;
    const bar = $('#cmdbar'); bar.innerHTML = '';
    const add = (txt, fn, on) => { const el = document.createElement('button'); el.textContent = txt; if (on) el.classList.add('on'); el.onclick = (e) => { e.stopPropagation(); fn(); this.cmdKey = ''; this.refreshCmd(); }; bar.appendChild(el); };
    if (ui.placing) { add('✕ Platzieren abbrechen', () => this.cancelModes()); return; }
    if (ui.swTarget) { add('✕ Superwaffe abbrechen', () => this.cancelModes()); return; }
    if (IS_TOUCH) add('▭ Rahmen', () => { this.boxMode = !this.boxMode; }, this.boxMode);
    add('⚔ Armee', () => this.selectArmy());
    add('⌂ Basis', () => this.centerBase());
    if (mine.length) {
      add('✋ Stopp', () => this.cmd({ c: 'stop', ids: mine.map(u => u.id) }));
      add('➶ Angriff-Bewegen', () => { this.amove = !this.amove; if (this.amove) toast('Ziel tippen: Einheiten greifen unterwegs alles an'); }, this.amove);
      if (mine.some(u => u.def.harvester)) add('⛽ Abladen', () => this.cmd({ c: 'dock', ids: mine.filter(u => u.def.harvester).map(u => u.id) }));
      if (mine.length === 1 && mine[0].def.mcv) add('⚙ Entfalten', () => this.cmd({ c: 'deploy', id: mine[0].id }));
      add('✕', () => this.sel.clear());
    } else if (b) {
      add((b.flags & 4) ? '🔧 Reparatur aus' : '🔧 Reparieren', () => this.cmd({ c: 'repair', id: b.id }), b.flags & 4);
      if (this.sellConfirm === b.id) add('💰 Wirklich verkaufen?', () => { this.cmd({ c: 'sell', id: b.id }); this.sellConfirm = 0; this.sel.clear(); }, true);
      else add('💰 Verkaufen', () => { this.sellConfirm = b.id; });
      add('✕', () => this.sel.clear());
    }
  }
  addMsg(txt, col) {
    const box = $('#msgs'), d = document.createElement('div');
    d.textContent = txt; if (col) d.style.color = col;
    box.appendChild(d); while (box.children.length > 6) box.removeChild(box.firstChild);
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 1000); }, 6000);
  }
}
