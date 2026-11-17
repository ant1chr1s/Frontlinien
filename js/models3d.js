'use strict';
// ===================== Detaillierte 3D-Modelle =====================
const _G = {};
function geo(k, f) { return _G[k] || (_G[k] = f()); }
const FAC_COL = {
  A: { base: 0xdfe6ea, dark: 0x8fa0a8, light: 0xf2f5f7, trim: 0x9aa7ad, roof: 0xa9b4ba, glass: 0xffffff },
  D: { base: 0x8a8a78, dark: 0x45453b, light: 0x9d9d8a, trim: 0x5f5f52, roof: 0x6a6a5c, glass: 0xffffff },
  K: { base: 0x9468a6, dark: 0x553a62, light: 0xb48cc4, trim: 0x6e4c7c, roof: 0x7a5488, glass: 0xffffff },
};
const SKIN = [0xe8c39e, 0xc99a6e, 0x8d5a3b, 0xf1d2b6];

class MB {
  constructor(team, fac) { this.team = team; this.fac = fac; this.fc = FAC_COL[fac] || FAC_COL.A; this.parts = { main: [], glow: [], tur: [], rot: [] }; this.grp = 'main'; this.halos = []; this.smoke = []; this.inTur = false; this.tex = 'paint'; this.top = null; this.ts = 32; this.anim = [0, 0]; }
  col(c) { if (c === 'team') return this.team; if (c === 'teamD') return new THREE.Color(this.team).multiplyScalar(0.55).getHex(); if (c === 'teamL') return new THREE.Color(this.team).lerp(new THREE.Color(0xffffff), 0.35).getHex(); if (typeof c === 'string') return this.fc[c]; return c; }
  T(tex, top, ts) { this.tex = tex; this.top = top || null; if (ts) this.ts = ts; return this; }
  add(g, c, m) {
    if (this.grp === 'glow') { const e = m.elements, sc = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])); const cc = new THREE.Color(this.col(c)); this.halos.push([e[12], e[13], e[14], Math.min(46, sc * 3.2 + 3), cc.r, cc.g, cc.b, this.inTur ? 1 : 0]); }
    this.parts[this.grp].push({ g, c: this.col(c), m, tex: this.tex, top: this.top, ts: this.ts, anim: this.anim.slice() }); return this; }
  mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz)); }
  box(w, h, d, x, y, z, c, ry = 0, rz = 0, rx = 0) { return this.add(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), c, this.mat(x, y, z, rx, ry, rz, w, h, d)); }
  wedge(w, h, d, x, y, z, c, ry = 0) { return this.add(geo('wedge', () => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 6); return g; }), c, this.mat(x, y, z, 0, ry, 0, w, h, d)); }
  cyl(rt, rb, h, x, y, z, c, seg = 12, rx = 0, rz = 0, ry = 0) { return this.add(geo('cyl' + (rt / rb).toFixed(3) + '_' + seg, () => new THREE.CylinderGeometry(rt / rb, 1, 1, seg)), c, this.mat(x, y, z, rx, ry, rz, rb, h, rb)); }
  sph(r, x, y, z, c, sx = 1, sy = 1, sz = 1, seg = 12) { return this.add(geo('sph' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.6 | 0))), c, this.mat(x, y, z, 0, 0, 0, r * sx, r * sy, r * sz)); }
  sphR(r, x, y, z, c, rx, ry, rz, sx = 1, sy = 1, sz = 1, seg = 10) { return this.add(geo('sph' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(6, seg * 0.6 | 0))), c, this.mat(x, y, z, rx, ry, rz, r * sx, r * sy, r * sz)); }
  dome(r, x, y, z, c, sy = 1) { return this.add(geo('dome', () => new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2)), c, this.mat(x, y, z, 0, 0, 0, r, r * sy, r)); }
  cone(r, h, x, y, z, c, seg = 8, rx = 0, rz = 0, ry = 0) { return this.add(geo('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg)), c, this.mat(x, y, z, rx, ry, rz, r, h, r)); }
  torus(R, r, x, y, z, c, rx = Math.PI / 2) { return this.add(geo('tor' + (r / R).toFixed(2), () => new THREE.TorusGeometry(1, r / R, 6, 24)), c, this.mat(x, y, z, rx, 0, 0, R, R, R)); }
  oct(r, h, x, y, z, c, ry = 0.6) { return this.add(geo('oct', () => new THREE.OctahedronGeometry(1)), c, this.mat(x, y, z, 0, ry, 0, r, h, r)); }
  build() {
    const out = {}, tmp = new THREE.Color(), nrm = new THREE.Vector3();
    for (const k in this.parts) {
      const ps = this.parts[k]; if (!ps.length) continue;
      let n = 0; const gs = ps.map(p => { const g = (p.g.index ? p.g.toNonIndexed() : p.g.clone()); g.applyMatrix4(p.m); n += g.attributes.position.count; return [g, p]; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), cell = new Float32Array(n * 2), an = new Float32Array(n * 2); let o = 0;
      for (const [g, p] of gs) {
        const P = g.attributes.position.array, N = g.attributes.normal.array, cnt = g.attributes.position.count;
        pos.set(P, o * 3); nor.set(N, o * 3); tmp.setHex(p.c);
        const cs = tileCell(p.tex), ct = tileCell(p.top || p.tex);
        for (let i = 0; i < cnt; i++) {
          const j = o + i, x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = Math.abs(N[i * 3]), ny = Math.abs(N[i * 3 + 1]), nz = Math.abs(N[i * 3 + 2]);
          col[j * 3] = tmp.r; col[j * 3 + 1] = tmp.g; col[j * 3 + 2] = tmp.b;
          let u, v;
          if (ny >= nx && ny >= nz) { u = x; v = z; } else if (nx >= nz) { u = z; v = y; } else { u = x; v = y; }
          uv[j * 2] = u / p.ts + 0.001; uv[j * 2 + 1] = v / p.ts + 0.001;
          const c2 = ny > 0.55 ? ct : cs; cell[j * 2] = c2[0]; cell[j * 2 + 1] = c2[1];
          an[j * 2] = p.anim[0]; an[j * 2 + 1] = p.anim[1];
        }
        o += cnt; g.dispose();
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); bg.setAttribute('cell', new THREE.BufferAttribute(cell, 2)); bg.setAttribute('anim', new THREE.BufferAttribute(an, 2));
      bg.computeBoundingSphere();
      out[k] = bg;
    }
    out.halos = this.halos; out.smoke = this.smoke;
    return out;
  }
}

// ---------- Mensch / Kreatur ----------
function human(b, o) {
  // o: {uni, uniTex, vest, helmet, skin, weapon, scale}
  const s = o.scale || 1, S = (v) => v * s;
  b.T(o.uniTex || 'paint', null, 6 * s);
  b.anim = [1, S(7)]; b.box(S(2.2), S(6.5), S(2.0), 0, S(3.6), S(-1.3), o.uni); b.box(S(2.8), S(1.4), S(2.3), S(0.4), S(0.7), S(-1.3), 0x2a2420);
  b.anim = [-1, S(7)]; b.box(S(2.2), S(6.5), S(2.0), 0, S(3.6), S(1.3), o.uni); b.box(S(2.8), S(1.4), S(2.3), S(0.4), S(0.7), S(1.3), 0x2a2420);
  b.anim = [0, 0];
  b.box(S(2.8), S(6), S(4.6), 0, S(10), 0, o.uni);                 // Rumpf
  b.T('paint', null, 6 * s); b.box(S(3.1), S(4.2), S(4.9), S(0.1), S(10.5), 0, o.vest);   // Weste (Teamfarbe)
  b.box(S(1.6), S(1.4), S(3.4), S(-2.2), S(10.6), 0, 0x3d3a2e);       // Rucksack
  b.box(S(1.8), S(4.0), S(3.0), S(-2.6), S(10.6), 0, o.pack || 0x4e4a3a);
  b.T(o.uniTex || 'paint', null, 6 * s);
  b.box(S(4.6), S(1.5), S(1.5), S(1.8), S(10.9), S(-2.7), o.uni, 0, -0.4); b.box(S(4.2), S(1.5), S(1.5), S(2.3), S(10.4), S(2.6), o.uni, 0.35, -0.5); // Arme
  b.T('paint', null, 6 * s);
  b.sph(S(1.75), S(0.3), S(14.6), 0, o.skin, 1, 1.05, 1, 10);           // Kopf
  b.add(geo('dome', () => new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2)), o.helmet, b.mat(S(0.1), S(15.0), 0, 0, 0, 0, S(2.1), S(1.8), S(2.1)));
  b.box(S(0.3), S(0.4), S(2.4), S(1.95), S(14.7), 0, 0x111111);       // Visier/Augen
  const w = o.weapon || 'rifle';
  if (w === 'rifle') { b.box(S(8), S(0.9), S(0.9), S(4.2), S(10.6), S(1.2), 0x1f1f1f); b.box(S(2), S(1.8), S(0.8), S(2.2), S(9.9), S(1.2), 0x3b2a1a); }
  else if (w === 'sniper') { b.box(S(12), S(0.8), S(0.8), S(5.6), S(10.7), S(1.2), 0x1f1f1f); b.cyl(S(0.6), S(0.6), S(3), S(3), S(11.6), S(1.2), 0x111111, 6, 0, Math.PI / 2); }
  else if (w === 'rocket') { b.cyl(S(1.1), S(1.1), S(11), S(1.5), S(13.2), S(-2.2), 0x4b5320, 8, 0, Math.PI / 2); b.cyl(S(1.4), S(1.1), S(1.4), S(7.4), S(13.2), S(-2.2), 0x222222, 8, 0, Math.PI / 2); }
  else if (w === 'flame') { b.box(S(7), S(1.1), S(1.1), S(3.8), S(10.2), S(1.2), 0x333333); b.cyl(S(1.3), S(1.3), S(5), S(-2.7), S(10.6), S(-1.1), 0xb71c1c, 8); b.cyl(S(1.3), S(1.3), S(5), S(-2.7), S(10.6), S(1.1), 0xb71c1c, 8); b.grp = 'glow'; b.sph(S(0.6), S(7.4), S(10.2), S(1.2), 0xff6d00); b.grp = 'main'; }
}
function bug(b, o) {
  const s = o.scale || 1, S = (v) => v * s;
  b.T('organic', null, 8 * s);
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
    b.anim = [((i % 2) ? 3 : -3) * side, 0];
    const x = S(-2.5 + i * 2.5);
    b.box(S(1), S(1), S(5), x, S(3.6), side * S(3.3), 'dark', 0, 0, side * 0.55);
    b.box(S(0.9), S(4), S(0.9), x + S(0.3), S(1.8), side * S(5.6), 'dark', 0, 0, side * -0.3);
  }
  b.anim = [0, 0];
  b.sph(S(4.2), S(-4), S(5.6), 0, o.body, 1.3, 0.75, 0.9);   // Hinterleib
  b.sph(S(2.8), S(0.6), S(5.4), 0, 'teamL', 1.0, 0.8, 0.9);   // Brust
  b.sph(S(2.1), S(3.8), S(5.6), 0, o.body, 1, 0.85, 0.9);     // Kopf
  b.cone(S(0.5), S(2.6), S(5.6), S(4.6), S(-1), 0x2a1d30, 6, 0, -1.7, 0.4); b.cone(S(0.5), S(2.6), S(5.6), S(4.6), S(1), 0x2a1d30, 6, 0, -1.7, -0.4);
  for (let i = 0; i < 4; i++) b.cone(S(0.6), S(2.2), S(-5 + i * 1.5), S(8.6), 0, 0x2a1d30, 5);
  b.grp = 'glow'; b.sph(S(0.55), S(5.3), S(6.3), S(-0.9), o.eye); b.sph(S(0.55), S(5.3), S(6.3), S(0.9), o.eye); b.grp = 'main';
}

// ---------- Gebäude ----------
function wallParts(b, fac, mask, mode, open) {
  // mode: 'wall' | 'gate' | 'tower' (Mauerstücke unter einem Turm)
  const tex = fac === 'K' ? 'organic' : 'concrete', col = fac === 'A' ? 0xc4c9c6 : fac === 'D' ? 0x707276 : 0x6a3d7a, H = mode === 'tower' ? 16 : 22, th = fac === 'D' ? 11 : 10;
  const dirs = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]];
  for (const [bit, dx, dz] of dirs) {
    if (!(mask & bit)) continue;
    const w = dx ? 17 : th, dd = dz ? 17 : th, x = dx * 8, z = dz * 8;
    if (fac === 'K') { b.T('organic', 'organic', 14); b.sph(1, x, H * 0.45, z, col, w / 2 + 1, H * 0.55, dd / 2 + 1, 10); }
    else { b.T(tex, tex, 16); b.box(w, H, dd, x, H / 2, z, col); b.T('paint'); b.box(dx ? w : th + 1, 1.6, dz ? dd : th + 1, x, H - 1, z, fac === 'D' ? 0x3a3a3a : 0x9ea4a1);
      if (fac === 'D') { b.T('hazard', 'hazard', 8); b.box(dx ? w : th + 0.4, 2, dz ? dd : th + 0.4, x, 4, z, 0xffffff); b.T('paint'); }
      if (fac === 'A') b.box(dx ? w : th + 0.6, 1.4, dz ? dd : th + 0.6, x, H * 0.55, z, 'team'); }
  }
  if (mode === 'tower') { b.T(tex, tex, 16); if (fac === 'K') b.sph(1, 0, 6, 0, col, 15, 9, 15, 12); else b.box(28, 10, 28, 0, 5, 0, col); b.T('paint'); return; }
  if (mode === 'gate') {
    const hor = (mask & 10) || !(mask & 5);
    for (const sgn of [-1, 1]) { const x = hor ? sgn * 13 : 0, z = hor ? 0 : sgn * 13;
      if (fac === 'K') { b.T('organic', 'organic', 10); b.cone(5, 30, x, 15, z, col, 7); } else { b.T(tex, tex, 12); b.box(7, 30, 14, x, 15, z, col, hor ? 0 : Math.PI / 2); b.T('paint'); b.box(7.4, 2, 14.4, x, 26, z, 'team', hor ? 0 : Math.PI / 2); }
      b.grp = 'glow'; b.sph(1.4, x, 31, z, open ? 0x76ff03 : 0xff1744); b.grp = 'main'; }
    const dy = open ? -7 : 10, dc = fac === 'K' ? 0xb388ff : fac === 'D' ? 0x6d5a4a : 0x90a4ae;
    b.T(fac === 'K' ? 'organic' : 'shutter', fac === 'K' ? 'organic' : 'shutter', 10); b.box(hor ? 20 : 4, 18, hor ? 4 : 20, 0, dy, 0, dc);
    b.T('paint'); b.box(hor ? 20.4 : 4.4, 2.5, hor ? 4.4 : 20.4, 0, dy + 4, 0, 'team');
    b.T('concrete', 'concrete', 12); b.box(hor ? 32 : 16, 1.2, hor ? 16 : 32, 0, 0.6, 0, 0x5a5a5a);
    return;
  }
  // Pfeiler (nur an Enden und Ecken)
  if (mask === 5 || mask === 10) return;
  if (fac === 'K') { b.T('organic', 'organic', 12); b.sph(1, 0, 10, 0, col, 9, 13, 9, 12); b.cone(4, 14, 0, 26, 0, 'light', 7); b.grp = 'glow'; b.sph(2, 0, 18, 6, 'team'); b.grp = 'main'; }
  else { b.T(tex, tex, 12); b.box(15, 28, 15, 0, 14, 0, col); b.T('paint'); b.box(16, 2.4, 16, 0, 22, 0, 'team'); b.box(17, 2, 17, 0, 28.5, 0, fac === 'D' ? 0x3a3a3a : 0xe0e4e2);
    if (fac === 'D') for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) b.cone(1.6, 5, x, 32, z, 0x444444, 5); }
}
function modelBld(d, team, opts) {
  if (d.role === 'wall' || d.role === 'gate') { const b = new MB(team, d.fac); wallParts(b, d.fac, (opts && opts.mask) | 0, d.role, opts && opts.open); return b.build(); }
  const b = new MB(team, d.fac), st = d.fac, W = d.w * T - 4, D = d.h * T - 4, s = Math.min(W, D), k = d.key.slice(2);
  const rnd = mulberry32(d.idx * 131 + 7);
  const y0 = 6;
  // Fundament
  if (st === 'A') { b.T('concrete', 'concrete', 24); b.box(W, 20, D, 0, -5, 0, 0xb9bdb8); b.T('paint'); b.box(W - 2, 1, 2, 0, 5.4, D / 2 - 1.5, 'team'); b.box(2, 1, D - 2, W / 2 - 1.5, 5.4, 0, 'team'); }
  else if (st === 'D') { b.T('concrete', 'concrete', 24); b.box(W, 20, D, 0, -5, 0, 0x8c8c82); b.T('hazard', 'hazard', 14); b.box(W - 1, 1.2, 3, 0, 5.4, D / 2 - 2, 0xffffff); b.box(W - 1, 1.2, 3, 0, 5.4, -D / 2 + 2, 0xffffff); }
  else { b.T('organic', 'organic', 30); b.sph(1, 0, 0, 0, 'dark', W / 2, 10, D / 2, 16); for (let i = 0; i < 6; i++) { const a = rnd() * 6.28; b.sph(3 + rnd() * 4, Math.cos(a) * W * 0.42, 3, Math.sin(a) * D * 0.42, 'trim', 1, 0.6, 1, 8); } }
  if (opts && opts.baseOnly) return b.build();
  // Bausteine
  const office = (w, h, dd, x, y, z, c = 'base') => { b.T(st === 'D' ? 'concrete' : 'window', st === 'D' ? 'roof' : 'roof', st === 'D' ? 24 : 18); b.box(w, h, dd, x, y + h / 2, z, c); b.T('paint'); b.box(w + 1.2, 1.4, dd + 1.2, x, y + h + 0.7, z, 'trim'); };
  const hall = (w, h, dd, x, y, z, c = 'base') => { b.T('corrug', 'roof', 22); b.box(w, h, dd, x, y + h / 2, z, c); b.T('paint'); b.box(w + 1, 1.5, dd + 1, x, y + h + 0.75, z, 'trim'); };
  const brick = (w, h, dd, x, y, z) => { b.T('brick', 'roof', 20); b.box(w, h, dd, x, y + h / 2, z, 0xb08070); };
  const vents = (cx, cy, cz, aw, ad, n) => { for (let i = 0; i < n; i++) { const vx = cx + (rnd() - 0.5) * aw, vz = cz + (rnd() - 0.5) * ad, sz = 4 + rnd() * 4; b.T('vent', 'vent', 8); b.box(sz, 3 + rnd() * 2, sz * 0.8, vx, cy + 1.5, vz, 0xbdbdbd); } b.T('paint'); };
  const antenna = (x, y, z, h) => { b.T('paint'); b.cyl(0.5, 0.7, h, x, y + h / 2, z, 0x9e9e9e, 6); b.grp = 'glow'; b.sph(1.2, x, y + h, z, 0xff1744); b.grp = 'main'; };
  const chimney = (x, z, r = 5, h = 30) => { b.T('brick', 'concrete', 14); b.cyl(r * 0.85, r, h, x, y0 + h / 2, z, 0x8a6a5a, 12); b.T('paint'); b.cyl(r * 0.9, r * 0.9, 2, x, y0 + h - 2, z, 0xffffff); b.cyl(r * 0.92, r * 0.92, 1.5, x, y0 + h - 5, z, 0xd32f2f); b.cyl(r * 0.6, r * 0.6, 1, x, y0 + h + 0.2, z, 0x111111); b.smoke.push([x, y0 + h + 2, z, r]); };
  const glowOrb = (r, x, y, z, c = 'team') => { b.grp = 'glow'; b.sph(r, x, y, z, c); b.grp = 'main'; };
  const door = (w, h, z, x = 0) => { b.T('shutter', 'shutter', 12); b.box(w, h, 1.5, x, y0 + h / 2, z, 0xc8c8c8); b.T('hazard', 'hazard', 8); b.box(w + 3, 1.6, 1.8, x, y0 + h + 0.8, z, 0xffffff); b.T('paint'); };
  const pad = (r, x, z) => { b.T('concrete', 'concrete', 20); b.cyl(r, r + 1, 2, x, y0 + 1, z, 0x5a5a5a, 24); b.T('paint'); b.torus(r * 0.78, 0.9, x, y0 + 2.1, z, st === 'K' ? 'team' : 0xffeb3b); b.box(r * 0.16, 0.5, r * 0.8, x - r * 0.25, y0 + 2.2, z, 0xffffff); b.box(r * 0.16, 0.5, r * 0.8, x + r * 0.25, y0 + 2.2, z, 0xffffff); b.box(r * 0.5, 0.5, r * 0.16, x, y0 + 2.2, z, 0xffffff); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.grp = 'glow'; b.sph(0.9, x + Math.cos(a) * (r - 1), y0 + 2.4, z + Math.sin(a) * (r - 1), 0x80d8ff); b.grp = 'main'; } };
  const dish = (r, x, y, z, tilt = 0.5) => { b.T('paint'); b.cyl(2, 3, y - y0, x, (y + y0) / 2, z, 0x78909c, 8); b.add(geo('dish', () => new THREE.SphereGeometry(1, 18, 6, 0, Math.PI * 2, 0, 1.0)), 0xf0f0f0, b.mat(x, y + r * 0.55, z, Math.PI + tilt, 0, 0, r, r, r)); b.cyl(0.6, 0.6, r * 0.9, x, y + r * 0.6, z - r * 0.2, 0x555555, 6, -tilt); };
  const tank = (r, h, x, z, c = 0xd7dde0) => { b.T('panel', 'paint', 16); b.cyl(r, r, h, x, y0 + h / 2, z, c, 18); b.T('paint'); b.dome(r, x, y0 + h, z, c, 0.4); b.cyl(r + 0.4, r + 0.4, 1.4, x, y0 + h * 0.66, z, 'team', 18); };
  const pipe = (x1, y1, z1, x2, y2, z2, r = 1.2, c = 0x9e9e9e) => { const v = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1), L = v.length(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); b.add(geo('cyl1.000_8', () => new THREE.CylinderGeometry(1, 1, 1, 8)), c, new THREE.Matrix4().compose(new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2), q, new THREE.Vector3(r, L, r))); };
  const pod = (r, x, y, z, c = 'base', sy = 0.8) => { b.T('organic', 'organic', 14); b.sph(r, x, y, z, c, 1, sy, 1, 14); b.T('paint'); };
  const spike = (r, h, x, y, z, ang, tilt = 0.45) => { b.T('organic', 'organic', 10); b.cone(r, h, x, y + h / 2, z, 'light', 7, 0, -tilt, -ang); };
  switch (d.role) {
    case 'bauhof':
      if (st === 'A') { b.T('panel', 'paint', 20); b.dome(s * 0.3, -6, y0, -8, 0xeef4f7); b.T('paint'); b.torus(s * 0.3, 1.2, -6, y0 + 1, -8, 'team'); office(28, 18, 22, s * 0.24, y0, s * 0.18); vents(s * 0.24, y0 + 19.5, s * 0.18, 18, 12, 3); b.T('panel', null, 10); b.box(4, 46, 4, s * 0.34, y0 + 23, -s * 0.34, 0xffb300); b.box(44, 3.5, 3.5, s * 0.12, y0 + 46, -s * 0.34, 0xffb300); b.box(1, 16, 1, -s * 0.08, y0 + 38, -s * 0.34, 0x333333); b.box(5, 4, 5, -s * 0.08, y0 + 29, -s * 0.34, 0x555555); antenna(-6, y0 + s * 0.3, -8, 10); }
      else if (st === 'D') { office(38, 28, 34, -2, y0, -6, 0x9a9a88); b.T('paint'); b.box(39, 5, 35, -2, y0 + 20, -6, 'team'); office(26, 12, 22, -2, y0 + 30, -6, 0x8a8a78); b.T('vent', 'vent', 8); b.box(12, 6, 10, 6, y0 + 45, -10, 0xaaaaaa); antenna(10, y0 + 43, -14, 26); chimney(-s * 0.33, s * 0.3, 6, 30); hall(22, 14, 18, s * 0.26, y0, s * 0.28, 0x8a8a78); door(14, 10, s * 0.28 + 9.3, s * 0.26); }
      else { pod(s * 0.33, 0, y0 + 4, 0, 'base', 0.72); glowOrb(10, 0, y0 + 28, 0); b.T('organic', null, 10); b.torus(12, 2, 0, y0 + 22, 0, 'trim'); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; spike(4, 34, Math.cos(a) * s * 0.34, y0 + 4, Math.sin(a) * s * 0.34, a, 0.5); } for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.6; pod(6, Math.cos(a) * s * 0.4, y0 + 2, Math.sin(a) * s * 0.4, 'light', 0.7); } }
      break;
    case 'power':
      if (st === 'A') { for (const x of [-13, 13]) { b.T('panel', 'paint', 14); b.cyl(9, 12, 28, x, y0 + 14, -3, 0xcfe8f5, 18); b.T('paint'); b.torus(9.6, 1, x, y0 + 21, -3, 'team'); b.grp = 'glow'; b.cyl(7, 7, 0.6, x, y0 + 28.4, -3, 0x4fc3f7, 18); b.grp = 'main'; } office(18, 8, 10, 0, y0, 13, 0xdfe6ea); }
      else if (st === 'D') { hall(44, 16, 30, 0, y0, 5, 0x8a8a78); b.T('paint'); b.box(44.5, 3, 30.5, 0, y0 + 12, 5, 'team'); chimney(-11, -9, 6, 36); chimney(11, -9, 6, 36); pipe(-20, y0 + 8, -12, 20, y0 + 8, -12, 1.5); }
      else { b.T('organic', 'organic', 14); b.oct(12, 28, 0, y0 + 26, 0, 'team'); b.oct(5, 11, -12, y0 + 10, 8, 'light'); b.oct(5, 11, 12, y0 + 10, -6, 'light'); b.oct(4, 9, 10, y0 + 8, 11, 'team'); glowOrb(4, 0, y0 + 26, 0, 0xffffff); pod(10, 0, y0, 0, 'base', 0.5); }
      break;
    case 'refinery':
      if (st === 'A') { tank(13, 30, -24, -18); tank(13, 30, 24, -18); office(40, 14, 22, 0, y0, 14); pipe(-24, y0 + 22, -18, 24, y0 + 22, -18, 2); vents(0, y0 + 15, 14, 30, 14, 3); }
      else if (st === 'D') { b.T('brick', 'concrete', 16); b.cyl(16, 19, 22, -20, y0 + 11, -16, 0x8a5a4a, 16); b.grp = 'glow'; b.cyl(11, 11, 1, -20, y0 + 22.5, -16, 0xff6f00, 16); b.grp = 'main'; hall(32, 28, 26, 22, y0, -14, 0x8a8a78); b.T('paint'); b.box(32.5, 3, 26.5, 22, y0 + 20, -14, 'team'); chimney(30, -24, 5, 42); pipe(-6, y0 + 16, -16, 6, y0 + 16, -16, 2.2); }
      else { pod(30, 0, y0 + 4, -10, 'base', 0.6); glowOrb(12, 0, y0 + 20, -10); pod(9, -27, y0 + 4, 16, 'light', 0.8); for (let i = 0; i < 5; i++) spike(2.5, 16, -24 + i * 12, y0 + 2, -32, Math.PI * 1.5, 0.3); }
      b.T('hazard', 'hazard', 10); b.box(T + 4, 0.8, 12, 0, y0 - 2.4, D / 2 - 6, 0xffffff); b.T('concrete', 'concrete', 16); b.box(T - 4, 1, 8, 0, y0 - 2.1, D / 2 - 6, 0x666666);
      break;
    case 'barracks':
      if (st === 'A') { office(W - 12, 18, D - 18, 0, y0, -2); vents(0, y0 + 19.5, -2, W - 20, D - 26, 2); b.T('paint'); b.cyl(0.6, 0.6, 34, W / 2 - 7, y0 + 17, -D / 2 + 7, 0x777777, 6); b.box(13, 8, 0.6, W / 2 - 0.5, y0 + 30, -D / 2 + 7, 'team'); door(12, 10, (D - 18) / 2 - 1.2); }
      else if (st === 'D') { b.T('camo', 'camo', 18); b.cone(s * 0.5, 30, 0, y0 + 15, 0, 0x7a8a50, 4, 0, 0, Math.PI / 4); brick(12, 10, 8, s * 0.3, y0, s * 0.32); b.T('paint'); b.box(8, 8, 0.6, 0, y0 + 10, s * 0.35, 'team'); for (let i = 0; i < 3; i++) { b.T('camo', null, 8); b.box(4, 3, 6, -s * 0.36 + i * 5, y0 + 1.5, s * 0.36, 0x9a8a60); } }
      else { pod(12, -10, y0 + 10, 0, 0x8d6e63, 1.3); pod(11, 11, y0 + 9, 4, 0x8d6e63, 1.25); glowOrb(4, -10, y0 + 16, 8); glowOrb(3.5, 11, y0 + 14, 11); spike(2, 12, -2, y0, -14, -Math.PI / 2, 0.4); }
      break;
    case 'factory':
      if (st === 'A') { hall(W - 14, 28, D - 26, 0, y0, -6, 0xe6ecef); b.T('panel', 'paint', 16); b.dome(13, W / 2 - 24, y0 + 29.5, -22, 'team'); door(46, 20, (D - 26) / 2 - 5.5); office(20, 10, 14, -W / 2 + 18, y0 + 29.5, -20, 0xdfe6ea); vents(10, y0 + 30, -10, 20, 20, 3); }
      else if (st === 'D') { hall(W - 10, 32, D - 24, 0, y0, -6, 0x8a8a78); b.T('paint'); b.box(W - 9, 3, D - 23, 0, y0 + 26, -6, 'team'); chimney(-24, -24, 6, 46); chimney(-8, -26, 5, 38); door(46, 22, (D - 24) / 2 - 5.5); vents(16, y0 + 34, -12, 20, 20, 3); }
      else { pod(36, 0, y0 + 4, -8, 'base', 0.7); glowOrb(13, 0, y0 + 22, -8); b.T('organic', null, 10); b.torus(18, 3, 0, y0 + 6, 20, 'trim', 0); b.grp = 'glow'; b.cyl(14, 14, 0.5, 0, y0 + 6, 21.6, 'team', 18, Math.PI / 2); b.grp = 'main'; for (let i = 0; i < 4; i++) spike(3, 22, -30 + i * 20, y0 + 2, -34, -Math.PI / 2, 0.4); }
      break;
    case 'airfield':
      pad(20, -22, -4); b.T('concrete', 'concrete', 20); b.box(38, 1.4, D - 16, 24, y0 + 0.7, 0, 0x6d6d6d); b.T('paint'); for (let i = 0; i < 4; i++) b.box(3.5, 1.6, 9, 24, y0 + 0.9, -30 + i * 20, 0xffeb3b); for (const z of [-D / 2 + 10, D / 2 - 10]) for (const x of [7, 41]) { b.grp = 'glow'; b.sph(1, x, y0 + 2, z, 0x76ff03); b.grp = 'main'; }
      if (st === 'K') { pod(9, -34, y0 + 14, 32, 'base', 1.6); glowOrb(4, -34, y0 + 30, 32); }
      else { office(12, 30, 12, -34, y0, 32, st === 'A' ? 0xdfe6ea : 0x9a9a88); b.T('window', 'roof', 8); b.box(16, 6, 16, -34, y0 + 34, 32, 0xffffff); b.T('paint'); b.box(17, 1.2, 17, -34, y0 + 37.6, 32, 'team'); antenna(-34, y0 + 38, 32, 10); }
      break;
    case 'tech':
      if (st === 'A') { office(W - 12, 16, D - 20, 0, y0, 6); dish(16, 0, y0 + 30, -6); }
      else if (st === 'D') { office(W - 12, 22, D - 16, 0, y0, 0, 0x9a9a88); b.T('paint'); b.box(W - 11, 2, D - 15, 0, y0 + 18, 0, 'team'); b.grp = 'glow'; [0x76ff03, 0xffea00, 0xff3d00].forEach((c, i) => b.cyl(3, 3, 14, -12 + i * 12, y0 + 30, -4, c, 10)); b.grp = 'main'; b.T('tech', 'tech', 16); b.box(W - 14, 6, 2, 0, y0 + 12, (D - 16) / 2 + 0.6, 0xffffff); }
      else { b.T('organic', 'organic', 10); b.sph(17, 0, y0 + 17, 0, 0x9c4dcc, 1, 0.9, 1, 16); glowOrb(5, 0, y0 + 34, 0); b.cyl(4, 7, 14, 0, y0 + 4, 0, 'light', 10); for (let i = 0; i < 3; i++) spike(2, 14, Math.cos(i * 2.1) * 14, y0 + 20, Math.sin(i * 2.1) * 14, i * 2.1, 0.7); }
      break;
    case 'tower': {
      if (opts && opts.inWall) wallParts(b, st, opts.mask | 0, 'tower');
      if (st === 'A') { b.T('panel', 'paint', 12); b.cyl(12, 14, 14, 0, 7, 0, 0xcfd8dc, 16); b.T('paint'); b.cyl(14.3, 14.3, 1.5, 0, 3, 0, 'team', 16); }
      else if (st === 'D') { b.T('concrete', 'concrete', 12); b.box(28, 16, 28, 0, 6, 0, 0x8c8c82); b.T('hazard', 'hazard', 8); b.box(28.4, 2, 28.4, 0, 12, 0, 0xffffff); for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { b.T('camo', null, 8); b.box(6, 4, 6, x, 16, z, 0x9a8a60); } }
      else { pod(14, 0, 4, 0, 'light', 0.7); for (let i = 0; i < 4; i++) spike(2, 10, Math.cos(i * 1.57) * 11, 2, Math.sin(i * 1.57) * 11, i * 1.57, 0.6); }
      b.grp = 'tur'; b.inTur = true; const c = d.weapon.c;
      if (c === 'psi') { b.T('organic', null, 8); b.cone(4, 10, 0, -2, 0, 'light', 6); b.grp = 'glow'; b.sph(7, 0, 6, 0, 'team'); }
      else {
        b.T(st === 'D' ? 'camo' : st === 'A' ? 'panel' : 'organic', 'paint', 10);
        if (st === 'D') { b.box(18, 10, 18, 0, 0, 0, 'team'); b.box(10, 3, 10, -2, 6, 0, 0x6b6b5e); } else if (st === 'A') { b.sph(9, 0, 0, 0, 'team', 1, 0.75, 1, 16); b.box(6, 3, 8, -3, 6, 0, 0xcfd8dc); } else b.sph(9, 0, 0, 0, 'light', 1, 0.8, 1, 14);
        b.T('paint');
        if (c === 'flak') { for (const z of [-4, 0, 4]) b.cyl(1.2, 1.2, 20, 10, 6, z, 0x262626, 8, 0, -1.1); }
        else if (c === 'cannon' || c === 'acid') { b.cyl(2.2, 2.4, 24, 14, 0, 0, c === 'acid' ? 0x689f38 : 0x2b2b2b, 10, 0, -Math.PI / 2); b.cyl(3, 3, 4, 25, 0, 0, 0x1a1a1a, 10, 0, -Math.PI / 2); }
        else if (c === 'laser') { b.T('panel', null, 6); b.box(20, 4, 4, 12, 0, 0, 0x546e7a); b.grp = 'glow'; b.cyl(2, 2, 2, 22.5, 0, 0, 0x80d8ff, 10, 0, -Math.PI / 2); }
        else if (c === 'flame') { b.box(14, 5, 5, 9, 0, 0, 0x3e2723); b.grp = 'glow'; b.box(2, 4, 4, 16, 0, 0, 0xff7043); }
        else { b.cyl(0.9, 0.9, 16, 10, 1, -2.5, 0x262626, 6, 0, -Math.PI / 2); b.cyl(0.9, 0.9, 16, 10, 1, 2.5, 0x262626, 6, 0, -Math.PI / 2); b.box(6, 5, 7, 3, 0, 0, 0x37474f); }
      }
      b.grp = 'main'; b.inTur = false;
      break;
    }
    case 'intel':
      if (st === 'A') { office(W - 14, 14, D - 18, 0, y0, 6); dish(20, -4, y0 + 34, -6, 0.9); antenna(W / 2 - 10, y0 + 15, D / 2 - 14, 18); }
      else { hall(W - 10, 16, D - 14, 0, y0, 4, 0x8a8a78); b.T('paint'); b.cyl(1.2, 1.2, 30, 10, y0 + 30, -10, 0x9e9e9e, 6); b.torus(9, 1, 10, y0 + 38, -10, 0xd32f2f, 0.3); b.box(W - 9, 2, D - 13, 0, y0 + 12, 4, 'team'); antenna(-12, y0 + 16, -8, 16); }
      break;
    case 'special':
      switch (k) {
        case 'hangar': hall(W - 8, 26, D - 12, 0, y0, -2, 0xe6ecef); b.T('paint'); b.box(W - 7, 3, D - 11, 0, y0 + 22, -2, 'team'); door(W - 22, 18, (D - 12) / 2 - 1.5); break;
        case 'schild': b.T('panel', 'paint', 12); b.dome(17, 0, y0, 0, 0x80deea); b.grp = 'glow'; b.torus(22, 0.8, 0, y0 + 4, 0, 0x80deea); b.torus(14, 0.8, 0, y0 + 14, 0, 0x80deea); b.grp = 'main'; for (const a of [0.7, 2.3, 3.9, 5.5]) { b.T('panel', null, 8); b.box(4, 12, 4, Math.cos(a) * 25, y0 + 6, Math.sin(a) * 25, 0xcfd8dc); } break;
        case 'repbucht': pad(18, 0, 2); b.T('panel', null, 10); b.box(3, 30, 3, -24, y0 + 15, -24, 0xffb300); b.box(28, 3, 3, -12, y0 + 30, -24, 0xffb300); b.box(1, 10, 1, 0, y0 + 24, -24, 0x333333); break;
        case 'handel': office(22, 46, 22, 0, y0, 0, 0xdfe6ea); b.T('paint'); b.box(23, 3, 23, 0, y0 + 30, 0, 'team'); glowOrb(5, 0, y0 + 54, 0, 0xffd54f); antenna(8, y0 + 48, 8, 8); break;
        case 'schmiede': hall(W - 10, 22, D - 14, 0, y0, 0, 0x8a6a5a); chimney(-16, -14, 6, 36); chimney(16, -14, 6, 36); b.grp = 'glow'; b.box(18, 8, 2, 0, y0 + 8, (D - 14) / 2 + 0.6, 0xff6f00); b.grp = 'main'; break;
        case 'akademie': brick(W - 10, 20, D - 14, 0, y0, 0); b.T('roof', 'roof', 14); b.wedge(W - 8, 10, D - 12, 0, y0 + 25, 0, 0x6a4a3a); b.grp = 'glow'; b.cone(6, 3, 0, y0 + 32, (D - 14) / 2 - 2, 0xffd600, 5, Math.PI / 2); b.grp = 'main'; b.T('paint'); b.box(14, 6, 0.6, 0, y0 + 12, (D - 14) / 2 + 0.4, 'team'); break;
        case 'propaganda': b.T('panel', null, 10); b.box(8, 62, 8, 0, y0 + 31, 0, 0x5a5a50); b.T('paint'); for (const y of [36, 50]) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; b.cone(5, 12, Math.cos(a) * 9, y0 + y, Math.sin(a) * 9, 'team', 10, 0, -Math.PI / 2, -a); } b.box(4, 12, 16, 0, y0 + 62, 0, 'team'); antenna(0, y0 + 68, 0, 10); break;
        case 'verdichter': hall(W - 10, 22, D - 12, 0, y0, 0, 0x8a8a78); b.T('panel', null, 10); b.box(20, 8, 20, 0, y0 + 27, 0, 0xd4a62a); b.T('paint'); b.cyl(3, 3, 14, 0, y0 + 37, 0, 0x9e9e9e, 8); break;
        case 'brutkammer': pod(16, 0, y0 + 18, 0, 0x8d6e63, 1.25); glowOrb(9, 0, y0 + 22, 7); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; spike(3, 28, Math.cos(a) * 18, y0, Math.sin(a) * 18, a, 0.25); } break;
        case 'becken': b.T('organic', 'organic', 14); b.cyl(24, 27, 6, 0, y0 + 3, 0, 0x00695c, 24); b.grp = 'glow'; b.cyl(20, 20, 1, 0, y0 + 6.3, 0, 0x64ffda, 24); b.grp = 'main'; for (let i = 0; i < 5; i++) { const a = i * 1.26; spike(2, 12, Math.cos(a) * 25, y0, Math.sin(a) * 25, a, 0.4); } break;
        case 'verstaerker': b.T('organic', null, 10); b.cyl(3, 5, 48, 0, y0 + 24, 0, 'light', 10); b.grp = 'glow'; b.torus(12, 1, 0, y0 + 36, 0, 'team'); b.torus(8, 1, 0, y0 + 44, 0, 'team'); b.sph(4, 0, y0 + 50, 0, 'team'); b.grp = 'main'; pod(10, 0, y0, 0, 'base', 0.5); break;
        case 'konverter': b.T('organic', 'organic', 12); b.cyl(18, 21, 18, 0, y0 + 9, 0, 0x33691e, 20); b.grp = 'glow'; b.cyl(14, 14, 1, 0, y0 + 18.6, 0, 0xb2ff59, 20); b.grp = 'main'; for (let i = 0; i < 3; i++) pod(5, Math.cos(i * 2.1) * 22, y0 + 3, Math.sin(i * 2.1) * 22, 'light'); break;
      }
      break;
    case 'superweapon':
      switch (k) {
        case 'atom': b.T('concrete', 'concrete', 16); b.cyl(36, 40, 10, 0, y0 + 5, 0, 0x7a7a72, 28); b.T('hazard', 'hazard', 10); b.cyl(29, 29, 1.5, 0, y0 + 10.5, 0, 0xffffff, 28); b.T('paint'); b.cyl(22, 22, 2, 0, y0 + 11.5, 0, 0x5a5a5a, 28); for (let i = 0; i < 3; i++) b.box(9, 2.2, 16, Math.cos(i * 2.09) * 11, y0 + 12.5, Math.sin(i * 2.09) * 11, 0xffd600, -i * 2.09 + Math.PI / 2); chimney(-38, 38, 5, 26); office(16, 12, 14, 36, y0, -36, 0x9a9a88); break;
        case 'wall': for (const [x, z] of [[-30, -30], [30, -30], [-30, 30], [30, 30]]) { b.T('panel', 'paint', 10); b.box(14, 36, 14, x, y0 + 18, z, 0x8a8a78); b.T('hazard', 'hazard', 8); b.box(14.5, 3, 14.5, x, y0 + 30, z, 0xffffff); b.grp = 'glow'; b.sph(4, x, y0 + 39, z, 0xff1744); b.grp = 'main'; } b.grp = 'glow'; b.sph(12, 0, y0 + 10, 0, 0xffd700, 1, 0.6, 1); b.grp = 'main'; break;
        case 'ionen': office(W - 20, 20, 30, 0, y0, 26); b.T('paint'); b.box(W - 19, 3, 31, 0, y0 + 15, 26, 'team'); dish(34, 0, y0 + 42, -14, 0.7); glowOrb(4, 0, y0 + 66, -26, 0x80d8ff); break;
        case 'luftbruecke': pad(26, -18, 0); office(30, 30, W - 30, 34, y0, 0); b.T('paint'); b.box(31, 3, W - 29, 34, y0 + 22, 0, 'team'); b.dome(10, 34, y0 + 31.4, 0, 'team', 0.8); antenna(34, y0 + 40, 14, 14); break;
        case 'sturm': b.T('organic', 'organic', 14); b.oct(24, 62, 0, y0 + 52, 0, 0xea80fc); b.oct(10, 22, -26, y0 + 16, 18, 'light'); b.oct(10, 22, 26, y0 + 16, -18, 'light'); b.oct(8, 18, 24, y0 + 12, 26, 'team'); b.grp = 'glow'; b.sph(7, 0, y0 + 52, 0, 0xffffff); b.grp = 'main'; pod(20, 0, y0, 0, 'base', 0.4); break;
        case 'emp': b.T('organic', null, 12); b.cyl(10, 12, 52, 0, y0 + 26, 0, 'light', 14); b.grp = 'glow'; for (let i = 0; i < 4; i++) b.torus(34 - i * 6, 1.6, 0, y0 + 12 + i * 12, 0, 0x40c4ff); b.sph(6, 0, y0 + 58, 0, 0x40c4ff); b.grp = 'main'; pod(16, 0, y0, 0, 'base', 0.4); break;
      }
      break;
  }
  return b.build();
}

// ---------- Einheiten (zeigen nach +x) ----------
function modelUnit(d, team) {
  const b = new MB(team, d.fac), st = d.fac, s = d.size, k = d.key.slice(2);
  const skin = SKIN[(d.idx * 7) % SKIN.length];
  if (d.cat === 'inf') {
    if (d.sup) { // Titan: riesiger Psi-Krieger
      human(b, { scale: 2.6, uni: 0x5a3c66, uniTex: 'organic', vest: 'team', helmet: 0x3e2a48, skin: 0x9a74a8, weapon: 'none', pack: 0x3e2a48 });
      b.grp = 'glow'; b.sph(3, 4, 27, 0, 0xea80fc); b.sph(1.4, 5.2, 38.5, -1.4, 0xffffff); b.sph(1.4, 5.2, 38.5, 1.4, 0xffffff); b.sph(2.4, 12, 28, -7, 0xea80fc); b.sph(2.4, 12, 27, 7, 0xea80fc); b.grp = 'main';
      for (let i = 0; i < 5; i++) { b.T('organic', null, 8); b.cone(1.6, 9, -4 - i * 1.2, 30 + i * 2.2, 0, 0x3e2a48, 6, 0, 0.8); }
      return b.build();
    }
    if (st === 'K' && k === 'ingenieur') { bug(b, { scale: 0.85, body: 'light', eye: 0x76ff03 }); b.grp = 'glow'; b.sph(1.4, -2, 9, 0, 0x76ff03); b.grp = 'main'; return b.build(); }
    if (st === 'K') {
      bug(b, { scale: k === 'psioniker' ? 1.05 : k === 'spucker' ? 1.1 : 0.95, body: 'base', eye: k === 'psioniker' ? 0xea80fc : k === 'spucker' ? 0xb2ff59 : 0xffd740 });
      if (k === 'spucker') { b.T('organic', null, 6); b.sph(2.6, -4, 9.5, 0, 0x7cb342, 1.2, 0.9, 1); }
      if (k === 'psioniker') { b.grp = 'glow'; b.torus(3, 0.4, 0.6, 11, 0, 0xea80fc); b.grp = 'main'; }
      return b.build();
    }
    const A = st === 'A';
    if (k === 'ingenieur') {
      human(b, { uni: A ? 0xeceff1 : 0xf9a825, uniTex: 'paint', vest: 'team', helmet: 0xfdd835, skin, weapon: 'none', pack: 0x8d6e63 });
      b.box(4, 3, 2.5, 3.5, 7.5, 2.4, 0xc62828); b.box(1, 6, 1, 3.8, 10, -2.4, 0x9e9e9e); return b.build();
    }
    human(b, { uni: A ? 0x90a4ae : 0x6b7445, uniTex: A ? 'panel' : 'camo', vest: 'team', helmet: A ? 0xeceff1 : 0x4e5b31, skin, weapon: k === 'rakete' || k === 'bazooka' ? 'rocket' : k === 'sniper' ? 'sniper' : k === 'flammen' ? 'flame' : 'rifle', pack: A ? 0x607d8b : 0x4e4a3a });
    if (A) { b.grp = 'glow'; b.box(0.3, 0.5, 2.2, 2.05, 14.8, 0, 0x40c4ff); b.grp = 'main'; }
    return b.build();
  }
  if (d.cat === 'veh') {
    if (st === 'K' && !d.harvester && !d.mcv) {
      b.T('organic', 'organic', 10);
      b.sph(s, 0, 9, 0, 'base', 1.2, 0.45, 0.78, 16); b.sph(s * 0.62, 1, 13.5, 0, 'team', 1.15, 0.5, 0.8, 14);
      for (let i = 0; i < 4; i++) b.cone(1.4, 6, -s * 0.6 + i * s * 0.35, 16, 0, 'dark', 6, 0, 0.6);
      b.grp = 'glow'; b.cyl(s * 0.75, s * 0.75, 0.6, 0, 3.6, 0, 'team', 18); b.sph(1.3, s * 1.05, 10, -3, 0xffd740); b.sph(1.3, s * 1.05, 10, 3, 0xffd740); b.grp = 'main';
      if (k === 'plasma') { b.T('organic', null, 8); b.cyl(2.8, 3.4, s * 1.7, s * 0.4, 19, 0, 'light', 10, 0, -1.15); b.grp = 'glow'; b.sph(3.2, s * 1.15, 26, 0, 0xea80fc); b.grp = 'main'; }
      else if (k === 'stachelkaefer') { for (const z of [-4.5, 0, 4.5]) for (const x of [0, 4]) b.cone(1.5, s * 1.1, s * 0.2 + x, 19, z, 0xe0e0e0, 6, 0, -0.85); }
      else { b.T('panel', null, 6); b.box(s * 0.9, 2.2, 2.2, s * 0.85, 12, 0, 0x546e7a); b.grp = 'glow'; b.sph(1.6, s * 1.3, 12, 0, 0x80d8ff); b.grp = 'main'; }
      return b.build();
    }
    const L = s * 1.15, Wd = s * 0.8, A = st === 'A', K = st === 'K';
    const hullTex = A ? 'panel' : K ? 'organic' : 'camo', hullCol = A ? 0xdfe6ea : K ? 0x7a5488 : 0x9a9a70;
    const tracked = !(k === 'buggy' || d.harvester || d.mcv);
    if (tracked) {
      for (const z of [-Wd + 2.2, Wd - 2.2]) {
        b.T('tread', 'tread', 6); b.box(L * 2, 6.5, 4.4, 0, 3.4, z, 0x8a8a8a); b.T('paint');
        for (let i = 0; i < 5; i++) b.cyl(2.4, 2.4, 4.8, -L * 0.75 + i * L * 0.375, 3.2, z, 0x3a3a3a, 10, Math.PI / 2);
        b.T(hullTex, null, 10); b.box(L * 2.04, 2.4, 5, 0, 7.4, z, hullCol);   // Kettenschürze
      }
    } else {
      const wl = d.harvester || d.mcv ? [-L * 0.65, 0, L * 0.6] : [-L * 0.6, L * 0.55];
      for (const x of wl) for (const z of [-Wd + 1.6, Wd - 1.6]) { b.T('tread', 'paint', 4); b.cyl(3.6, 3.6, 2.8, x, 3.6, z, 0x2a2a2a, 12, Math.PI / 2); b.T('paint'); b.cyl(1.6, 1.6, 3.0, x, 3.6, z, 0xb0b0b0, 8, Math.PI / 2); }
    }
    const hh = d.sup ? 11 : 6.5, hy = 6.8 + hh / 2, top = 6.8 + hh;
    b.T(hullTex, hullTex, 10);
    b.box(L * 1.75, hh, Wd * 2 - 5, -L * 0.1, hy, 0, hullCol);
    b.wedge(L * 0.45, hh * 0.9, Wd * 2 - 5, L * 0.85, hy - hh * 0.05, 0, hullCol, 0); // schräge Front
    b.T('paint'); b.box(3, 1, Wd * 2 - 5, -L * 0.85, top + 0.4, 0, 'team'); b.box(L * 1.2, 1.2, 0.6, -L * 0.1, hy, Wd - 2.2, 'team'); b.box(L * 1.2, 1.2, 0.6, -L * 0.1, hy, -Wd + 2.2, 'team');
    b.grp = 'glow'; b.box(0.6, 1.4, 1.8, L * 1.03, hy, -Wd + 3.5, 0xfff8e1); b.box(0.6, 1.4, 1.8, L * 1.03, hy, Wd - 3.5, 0xfff8e1); b.box(0.5, 1.2, 1.4, -L * 0.98, hy, -Wd + 3.5, 0xff1744); b.box(0.5, 1.2, 1.4, -L * 0.98, hy, Wd - 3.5, 0xff1744); b.grp = 'main';
    b.cyl(0.9, 0.9, 5, -L * 0.75, top + 2, Wd - 3.5, 0x333333, 6); // Auspuff
    if (d.harvester) {
      b.T('window', 'roof', 6); b.box(L * 0.5, 8, Wd * 2 - 6, L * 0.62, top + 4, 0, A ? 0xeceff1 : K ? 0x9a74a8 : 0xa0a088);
      b.T('corrug', 'paint', 10); b.box(L * 1.15, 9, Wd * 2 - 6, -L * 0.42, top + 4.5, 0, 'team');
      b.T('paint'); b.box(L * 1.05, 1, Wd * 2 - 8, -L * 0.42, top + 9.2, 0, 0x7a6a30);
      b.T('tread', null, 4); b.box(3, 6, Wd * 2, L + 1.5, 6, 0, 0x777777);
    } else if (d.mcv) {
      b.T('window', 'roof', 6); b.box(L * 0.45, 9, Wd * 2 - 6, L * 0.66, top + 4.5, 0, 0xeceff1);
      b.T(hullTex, 'paint', 10); b.box(L * 1.2, 14, Wd * 2 - 6, -L * 0.33, top + 7, 0, 'team');
      b.T('hazard', null, 6); b.box(3, 20, 3, L * 0.3, top + 10, Wd - 4, 0xffffff); b.box(L * 1.1, 2.5, 2.5, L * 0.0, top + 20, Wd - 4, 0xffffff);
      b.T('vent', 'vent', 6); b.box(8, 4, 8, -L * 0.5, top + 16, -3, 0xbbbbbb);
    } else {
      const tr = s * 0.42, ty = top + 3;
      b.T(hullTex, 'paint', 8);
      if (A) { b.sph(tr * 1.1, 0, ty - 1, 0, 0xeceff1, 1.2, 0.55, 1, 14); }
      else if (K) { b.sph(tr * 1.1, 0, ty, 0, 'light', 1.2, 0.6, 1, 12); }
      else { b.box(tr * 2.4, 5.5, tr * 1.9, -1, ty, 0, hullCol); b.box(tr * 0.9, 4, tr * 1.6, -tr * 1.5, ty, 0, hullCol); }
      b.T('paint'); b.cyl(tr * 0.45, tr * 0.5, 1.6, -tr * 0.3, ty + 3.4, tr * 0.35, 0x555555, 10); b.cyl(tr * 0.4, tr * 0.4, 0.8, -tr * 0.3, ty + 4.3, 0, 'team', 10);
      b.cyl(0.25, 0.25, 12, -tr * 1.2, ty + 8, -tr * 0.6, 0x333333, 4); // Antenne
      if (k === 'katjuscha' || k === 'ionwerfer') { for (const z of [-4, 0, 4]) for (const yy of [0, 3]) b.cyl(1.3, 1.3, L * 1.5, 0, ty + 6 + yy, z, 0x3b3b3b, 8, 0, -Math.PI / 2 + 0.45); if (k === 'ionwerfer') { b.grp = 'glow'; b.box(2, 2, 10, L * 0.6, ty + 10, 0, 0x80d8ff); b.grp = 'main'; } }
      else if (k === 'flakpanzer') { for (const z of [-3, 3]) b.cyl(1.1, 1.1, s + 8, s * 0.45, ty + 6, z, 0x222222, 8, 0, -Math.PI / 2 + 0.6); b.box(5, 6, 9, 0, ty + 2, 0, 0x5a5a4a); }
      else if (d.sup) { for (const z of [-5, 5]) { b.cyl(2.2, 2.4, s + 16, (s + 16) / 2, ty + 1, z, 0x222222, 10, 0, -Math.PI / 2); b.cyl(3.2, 3.2, 4, s + 16, ty + 1, z, 0x111111, 10, 0, -Math.PI / 2); } b.T('camo', null, 8); b.box(12, 8, 18, -L * 0.6, ty + 2, 0, 0x6b6b4e); for (const z of [-6, 0, 6]) b.cyl(1.4, 1.4, 6, -L * 0.6, ty + 7, z, 0x333333, 6, 0, -Math.PI / 2 + 0.5); }
      else if (k === 'buggy') { b.cyl(0.6, 0.6, s, s * 0.5, ty + 1, 0, 0x222222, 6, 0, -Math.PI / 2); b.T('paint'); b.box(4, 0.5, 6, -2, ty + 2.5, 0, 0x555555); }
      else { b.cyl(1.4, 1.6, s + 6, (s + 6) / 2, ty, 0, k === 'laserpanzer' ? 0x546e7a : 0x2b2b2b, 10, 0, -Math.PI / 2); b.cyl(2.2, 2.2, 3, s + 5, ty, 0, 0x1a1a1a, 10, 0, -Math.PI / 2); if (k === 'laserpanzer') { b.grp = 'glow'; b.cyl(1.4, 1.4, 1, s + 7, ty, 0, 0x80d8ff, 10, 0, -Math.PI / 2); b.grp = 'main'; } }
    }
    return b.build();
  }
  // ---------- Luft ----------
  const A = st === 'A', bodyC = A ? 0xe6ecef : st === 'D' ? 0x7a7a5c : 0x7a5488, bodyT = A ? 'panel' : st === 'D' ? 'camo' : 'organic';
  if (d.sup) {
    b.T('panel', 'panel', 14); b.cyl(s, s * 0.9, 9, 0, 0, 0, 0xe6ecef, 6); b.T('window', 'paint', 8); b.cyl(s * 0.55, s * 0.6, 7, 0, 7, 0, 0xffffff, 12); b.T('paint'); b.cyl(s * 0.58, s * 0.58, 1.2, 0, 11, 0, 'team', 12);
    b.grp = 'glow'; b.sph(s * 0.2, s * 0.3, 12, 0, 0x80d8ff); b.cyl(s * 0.3, s * 0.3, 0.6, 0, -4.6, 0, 0x80d8ff, 12); b.grp = 'main';
    b.grp = 'rot'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78, rx = Math.cos(a) * s, rz = Math.sin(a) * s; b.box(20, 0.8, 2.5, rx, 6, rz, 0x333333); b.box(2.5, 0.8, 20, rx, 6, rz, 0x333333); } b.grp = 'main';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; b.T('panel', null, 6); b.cyl(2.5, 2.5, 7, Math.cos(a) * s, 2.5, Math.sin(a) * s, 0x90a4ae, 8); b.T('paint'); b.torus(10.5, 0.6, Math.cos(a) * s, 6, Math.sin(a) * s, 'team'); }
    for (const z of [-s * 0.5, s * 0.5]) b.cyl(1.6, 1.6, 12, s * 0.9, -2, z, 0x37474f, 8, 0, -Math.PI / 2);
    return b.build();
  }
  if (k === 'heli' || k === 'gunship') {
    b.T(bodyT, bodyT, 8); b.sph(s * 0.7, 2, 0, 0, bodyC, 1, 0.55, 0.6, 14); b.box(s * 1.2, 2.4, 2.2, -s * 0.95, 1, 0, bodyC); b.box(2, 7, 1, -s * 1.5, 3.5, 0, 'team'); b.box(4, 1, 6, -s * 1.45, 1.5, 0, bodyC);
    b.T('window', null, 4); b.sphR(s * 0.36, s * 0.5, 2, 0, 0x99c8ff, 0, 0, 0, 1, 0.6, 0.8);
    b.T('paint'); b.box(s * 1.1, 0.8, 0.8, 1, -4.4, -s * 0.45, 0x333333); b.box(s * 1.1, 0.8, 0.8, 1, -4.4, s * 0.45, 0x333333);
    b.box(2.4, 1.6, s * 1.5, 1, -1.5, 0, 0x444444); for (const z of [-s * 0.7, s * 0.7]) b.cyl(1.2, 1.2, 6, 2, -2.5, z, 0x2a2a2a, 8, 0, -Math.PI / 2);
    b.grp = 'rot'; b.box(s * 2.8, 0.5, 1.6, 0, 6.5, 0, 0x2a2a2a); b.box(1.6, 0.5, s * 2.8, 0, 6.5, 0, 0x2a2a2a); b.grp = 'main'; b.cyl(1, 1, 3, 0, 5, 0, 0x333333, 6);
    return b.build();
  }
  if (k === 'spaeher') { b.T('organic', 'organic', 6); b.sph(s * 0.5, 0, 0, 0, bodyC, 1, 0.6, 0.6, 12); b.grp = 'glow'; b.sph(s * 0.32, s * 0.4, 0.5, 0, 0x76ff03); b.grp = 'main'; b.grp = 'rot'; b.box(s * 2.2, 0.4, 1.4, 0, 3, 0, 'team'); b.box(1.4, 0.4, s * 2.2, 0, 3, 0, 'team'); b.grp = 'main'; return b.build(); }
  if (st === 'K') {
    b.T('organic', 'organic', 8);
    b.sph(s * 0.6, 0, 0, 0, bodyC, 1, 0.42, 0.5, 14); b.sph(s * 0.3, s * 0.55, 0.5, 0, 'light', 1, 0.8, 0.9);
    b.add(geo('wing', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.scale(1, 0.05, 1); return g; }), 'team', b.mat(-s * 0.1, 1, -s * 0.75, 0, 0.3, 0, s * 0.6, 1, s * 0.9));
    b.add(geo('wing', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.scale(1, 0.05, 1); return g; }), 'team', b.mat(-s * 0.1, 1, s * 0.75, 0, -0.3, 0, s * 0.6, 1, s * 0.9));
    b.grp = 'glow'; b.sph(1.8, s * 0.8, 1, -1.2, k === 'brut' ? 0xffab40 : 0xea80fc); b.sph(1.8, s * 0.8, 1, 1.2, k === 'brut' ? 0xffab40 : 0xea80fc); if (k === 'brut') b.sph(s * 0.25, -s * 0.2, -3, 0, 0xffab40); b.grp = 'main';
    return b.build();
  }
  // Jets
  b.T(bodyT, bodyT, 8);
  b.cyl(s * 0.22, s * 0.28, s * 1.7, -s * 0.15, 0, 0, bodyC, 10, 0, -Math.PI / 2);
  b.cone(s * 0.22, s * 0.55, s * 0.98, 0, 0, bodyC, 10, 0, -Math.PI / 2);
  b.T('window', null, 3); b.sphR(s * 0.17, s * 0.45, s * 0.18, 0, 0x99c8ff, 0, 0, 0, 1.8, 0.7, 0.8);
  b.T(bodyT, bodyT, 8);
  b.add(geo('wing', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.scale(1, 0.05, 1); return g; }), bodyC, b.mat(-s * 0.2, 0, -s * 0.55, 0, 0.5, 0, s * 0.6, 1, s * 0.7));
  b.add(geo('wing', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.scale(1, 0.05, 1); return g; }), bodyC, b.mat(-s * 0.2, 0, s * 0.55, 0, -0.5, 0, s * 0.6, 1, s * 0.7));
  b.T('paint'); b.box(s * 0.35, s * 0.4, 0.8, -s * 0.85, s * 0.28, 0, 'team'); b.box(s * 0.5, 0.6, s * 0.9, -s * 0.85, 0.2, 0, bodyC);
  b.box(s * 0.5, 0.7, 1.2, -s * 0.1, -0.6, -s * 0.9, 'team'); b.box(s * 0.5, 0.7, 1.2, -s * 0.1, -0.6, s * 0.9, 'team');
  for (const z of [-s * 0.45, s * 0.45]) b.cyl(0.8, 0.8, s * 0.6, s * 0.05, -1.4, z, 0x37474f, 6, 0, -Math.PI / 2);
  b.grp = 'glow'; b.cyl(s * 0.2, s * 0.2, 0.6, -s * 1.02, 0, 0, 0xffab40, 10, 0, -Math.PI / 2); b.grp = 'main';
  return b.build();
}

// ---------- Umgebung ----------
function modelTree(kind) {
  const b = new MB(0xffffff, 'A');
  if (kind === 'pine') { b.T('bark', null, 6); b.cyl(1.2, 1.8, 10, 0, 5, 0, 0x6d4c33, 6); b.T('paint'); b.cone(9, 14, 0, 14, 0, 0x2e5d32, 7); b.cone(7.4, 12, 0, 21, 0, 0x33693a, 7); b.cone(5.2, 10, 0, 27, 0, 0x3a7442, 7); }
  else if (kind === 'oak') { b.T('bark', null, 6); b.cyl(1.4, 2.2, 12, 0, 6, 0, 0x6d4c33, 6); b.T('paint'); b.add(geo('ico', () => new THREE.IcosahedronGeometry(1, 0)), 0x4d7d34, b.mat(0, 17, 0, 0.3, 0.2, 0, 9, 7, 9)); b.add(geo('ico', () => new THREE.IcosahedronGeometry(1, 0)), 0x5a8a3c, b.mat(4, 21, 2, 0.8, 0.5, 0, 6, 5, 6)); b.add(geo('ico', () => new THREE.IcosahedronGeometry(1, 0)), 0x467531, b.mat(-4, 20, -3, 0.1, 1.2, 0, 6, 5, 6)); }
  else if (kind === 'bush') { b.T('paint'); b.add(geo('ico', () => new THREE.IcosahedronGeometry(1, 0)), 0x4a7a35, b.mat(0, 2.5, 0, 0, 0, 0, 5, 3.5, 5)); b.add(geo('ico', () => new THREE.IcosahedronGeometry(1, 0)), 0x568a3c, b.mat(3, 2, 1, 0.5, 0.3, 0, 3.5, 2.6, 3.5)); }
  else if (kind === 'rock') { b.T('rock', 'rock', 10); b.add(geo('dod', () => new THREE.DodecahedronGeometry(1, 0)), 0x9a948c, b.mat(0, 2, 0, 0.3, 0.2, 0.1, 6, 4, 5)); b.add(geo('dod', () => new THREE.DodecahedronGeometry(1, 0)), 0x8a847c, b.mat(4, 1, 3, 0.9, 0.5, 0, 3, 2.5, 3)); }
  else if (kind === 'grass') { b.T('paint'); for (let i = 0; i < 3; i++) b.cone(0.9, 4.5, Math.cos(i * 2.1) * 1.2, 2.2, Math.sin(i * 2.1) * 1.2, 0x5f9a3c, 3, 0, Math.cos(i * 2.1) * 0.3); }
  else if (kind === 'flower') { b.T('paint'); b.cone(0.8, 3.5, 0, 1.75, 0, 0x5f9a3c, 3); b.sph(0.9, 0, 3.8, 0, 0xffffff, 1, 0.6, 1, 6); }
  return b.build().main;
}
