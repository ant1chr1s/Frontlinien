'use strict';
// ===================== Grafik =====================
const _shadeCache = new Map();
function shade(hex, amt) {
  const k = hex + amt; let r = _shadeCache.get(k); if (r) return r;
  let c = parseInt(hex.slice(1), 16), R = c >> 16, G = (c >> 8) & 255, B = c & 255;
  if (amt >= 0) { R += (255 - R) * amt; G += (255 - G) * amt; B += (255 - B) * amt; } else { R *= 1 + amt; G *= 1 + amt; B *= 1 + amt; }
  r = '#' + ((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1); _shadeCache.set(k, r); return r;
}
function rgba(hex, a) { const c = parseInt(hex.slice(1), 16); return `rgba(${c >> 16},${(c >> 8) & 255},${c & 255},${a})`; }
function hash2(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }

// ---------- Gelände ----------
const TERH = [0.0, 0.52, 0.72, 1.0, 0.27];
class TerrainCache {
  constructor(map) { this.map = map; this.CH = 16; this.PX = 16; this.chunks = new Map(); this.noise = this.makeNoise(); }
  makeNoise() { const n = 128, a = new Float32Array(n * n), r = mulberry32(99); for (let i = 0; i < n * n; i++) a[i] = r(); const out = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += a[((y + dy + n) % n) * n + (x + dx + n) % n]; out[y * n + x] = s / 25; } return out; }
  hAt(fx, fy) {
    const m = this.map; fx -= 0.5; fy -= 0.5;
    let x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0;
    const g = (x, y) => { x = Math.max(0, Math.min(m.w - 1, x)); y = Math.max(0, Math.min(m.h - 1, y)); return TERH[m.ter[y * m.w + x]]; };
    const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  build(cx, cy) {
    const C = this.CH, P = this.PX, S = C * P, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = img.data, N = this.noise;
    const H = new Float32Array((S + 2) * (S + 2));
    for (let py = -1; py <= S; py++) for (let px = -1; px <= S; px++) H[(py + 1) * (S + 2) + px + 1] = this.hAt(cx * C + (px + 0.5) / P, cy * C + (py + 0.5) / P);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const wx = cx * S + px, wy = cy * S + py;
      const h0 = H[(py + 1) * (S + 2) + px + 1];
      const n1 = N[((wy >> 1) & 127) * 128 + ((wx >> 1) & 127)], n2 = N[((wy >> 3) & 127) * 128 + ((wx >> 3) & 127)], n3 = hash2(wx, wy);
      const h = h0 + (n1 - 0.5) * 0.05;
      const sl = (H[py * (S + 2) + px] - H[(py + 2) * (S + 2) + px + 2]) * 9;
      let r, g, b;
      if (h < 0.17) { r = 22; g = 58; b = 100; }
      else if (h < 0.31) { const t = (h - 0.17) / 0.14; r = 22 + t * 30; g = 58 + t * 45; b = 100 + t * 40; }
      else if (h < 0.4) { r = 70; g = 125; b = 150; }
      else if (h < 0.455) { r = 186; g = 172; b = 120; }
      else if (h < 0.6) { const v = n2 * 30; r = 66 + v * 0.6; g = 104 + v; b = 44 + v * 0.3; if (n3 > 0.985) { r += 30; g += 30; } }
      else if (h < 0.8) { const t = (h - 0.6) / 0.2; r = 110 + t * 30 + n2 * 20; g = 112 + t * 15 + n2 * 15; b = 64 + t * 10; }
      else { const t = Math.min(1, (h - 0.8) / 0.2); r = 104 + t * 40 + n2 * 30; g = 97 + t * 36 + n2 * 26; b = 90 + t * 34 + n2 * 24; if (n3 > 0.9) { r -= 25; g -= 25; b -= 25; } }
      const v = (n3 - 0.5) * 10;
      const L = h > 0.45 ? Math.max(0.65, Math.min(1.35, 1 + sl * (h > 0.75 ? 0.7 : 0.8))) : 1 + Math.sin((wx + wy * 0.5) * 0.25 + n1 * 6) * 0.04;
      const o = (py * S + px) * 4;
      d[o] = Math.max(0, Math.min(255, r * L + v)); d[o + 1] = Math.max(0, Math.min(255, g * L + v)); d[o + 2] = Math.max(0, Math.min(255, b * L + v)); d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  get(cx, cy) { const k = cy * 1000 + cx; let c = this.chunks.get(k); if (!c) { c = this.build(cx, cy); this.chunks.set(k, c); } return c; }
  miniImage() {
    const m = this.map, cv = document.createElement('canvas'); cv.width = m.w; cv.height = m.h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(m.w, m.h), cols = [[30, 70, 115], [70, 108, 46], [128, 122, 72], [120, 114, 108], [75, 130, 155]];
    for (let i = 0; i < m.w * m.h; i++) { const c = cols[m.ter[i]]; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0); return cv;
  }
}

// ---------- Ressourcen-Sprites ----------
const RES_SPR = {};
function resSprite(type, lvl) {
  const k = type * 10 + lvl; if (RES_SPR[k]) return RES_SPR[k];
  const cv = document.createElement('canvas'); cv.width = cv.height = 40; const c = cv.getContext('2d'), R = RES[type], rnd = mulberry32(k * 31 + 7);
  const n = 1 + Math.round(lvl * 1.4);
  for (let i = 0; i < n; i++) {
    const x = 8 + rnd() * 24, y = 10 + rnd() * 22, s = 3 + rnd() * 3 + lvl;
    if (type === 1) { c.fillStyle = R.dark; c.beginPath(); c.ellipse(x + 1, y + 1, s, s * 0.75, 0, 0, 7); c.fill(); c.fillStyle = R.color; c.beginPath(); c.ellipse(x, y, s, s * 0.75, rnd(), 0, 7); c.fill(); c.fillStyle = '#fff3c4'; c.fillRect(x - s * 0.4, y - s * 0.4, 2, 2); }
    else {
      if (type === 3) { c.fillStyle = rgba(R.color, 0.25); c.beginPath(); c.arc(x, y, s * 2, 0, 7); c.fill(); }
      const hw = type === 2 ? 1.05 : 0.7, hh = type === 2 ? 1.2 : 1.8;
      c.fillStyle = R.dark; c.beginPath(); c.moveTo(x, y - s * hh); c.lineTo(x + s * hw, y); c.lineTo(x, y + s * 0.5); c.lineTo(x - s * hw, y); c.closePath(); c.fill();
      c.fillStyle = R.color; c.beginPath(); c.moveTo(x, y - s * hh); c.lineTo(x + s * hw * 0.7, y - 0.2); c.lineTo(x, y + s * 0.3); c.closePath(); c.fill();
    }
  }
  RES_SPR[k] = cv; return cv;
}

// ---------- Gebäude ----------
function drawWall(c, d, col, x, y, flags, armsOnly) {
  const m = (flags | 0) >> 8 & 15, cx = x + T / 2, cy = y + T / 2, f = d.fac, th = 14;
  const base = f === 'A' ? '#b5bcbf' : f === 'D' ? '#55585a' : '#5b3a6b', top = f === 'A' ? '#dfe5e8' : f === 'D' ? '#7a7d80' : '#8e5aa6', edge = f === 'A' ? '#7d8589' : f === 'D' ? '#2c2e30' : '#331d3d';
  const arm = (dx, dy, cl, w) => { c.fillStyle = cl; if (dx) c.fillRect(dx > 0 ? cx : x, cy - w / 2, T / 2, w); else c.fillRect(cx - w / 2, dy > 0 ? cy : y, w, T / 2); };
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(cx - 9 + 3, cy - 9 + 4, 18, 18);
  for (const [bit, dx, dy] of [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]) if (m & bit) { arm(dx, dy, edge, th + 2); arm(dx, dy, base, th - 2); arm(dx, dy, top, 4); }
  if (d.role === 'gate') {
    const hor = (m & 10) || !(m & 5), op = (flags | 0) & 64;
    c.fillStyle = edge; if (hor) c.fillRect(x, cy - 9, T, 18); else c.fillRect(cx - 9, y, 18, T);
    if (!op) { c.fillStyle = f === 'K' ? '#b388ff' : f === 'D' ? '#8d6e63' : '#90a4ae'; if (hor) c.fillRect(x + 2, cy - 6, T - 4, 12); else c.fillRect(cx - 6, y + 2, 12, T - 4); c.fillStyle = col; if (hor) c.fillRect(x + 4, cy - 2, T - 8, 4); else c.fillRect(cx - 2, y + 4, 4, T - 8); }
    else { c.fillStyle = '#222'; if (hor) c.fillRect(x + 3, cy - 6, T - 6, 12); else c.fillRect(cx - 6, y + 3, 12, T - 6); }
    c.fillStyle = base; if (hor) { c.fillRect(x - 1, cy - 10, 6, 20); c.fillRect(x + T - 5, cy - 10, 6, 20); } else { c.fillRect(cx - 10, y - 1, 20, 6); c.fillRect(cx - 10, y + T - 5, 20, 6); }
    return;
  }
  if (armsOnly) { c.fillStyle = edge; c.fillRect(cx - 13, cy - 13, 26, 26); c.fillStyle = base; c.fillRect(cx - 11, cy - 11, 22, 22); return; }
  if (m === 5 || m === 10) { c.fillStyle = col; if (m === 5) c.fillRect(cx - 1, y + 4, 2, T - 8); else c.fillRect(x + 4, cy - 1, T - 8, 2); return; }
  c.fillStyle = edge; if (f === 'K') { c.beginPath(); c.arc(cx, cy, 10, 0, 7); c.fill(); } else c.fillRect(cx - 9, cy - 9, 18, 18);
  c.fillStyle = base; if (f === 'K') { c.beginPath(); c.arc(cx, cy, 8, 0, 7); c.fill(); } else c.fillRect(cx - 7, cy - 7, 14, 14);
  c.fillStyle = col; c.fillRect(cx - 4, cy - 4, 8, 8);
}
function drawBld(c, d, col, x, y, tm, face, hp, flags) {
  const F = flags && typeof flags === 'object' ? flags.raw | 0 : flags | 0;
  if (d.role === 'wall' || d.role === 'gate') { drawWall(c, d, col, x, y, F); return; }
  if (F & 128) drawWall(c, d, col, x, y, F, true);
  const W = d.w * T, H = d.h * T, cx = x + W / 2, cy = y + H / 2, s = Math.min(W, H), st = d.fac;
  const dk = shade(col, -0.45), lt = shade(col, 0.35);
  // Schatten
  c.fillStyle = 'rgba(0,0,0,0.3)'; if (st === 'K') { c.beginPath(); c.ellipse(cx + 4, cy + 5, W / 2 - 1, H / 2 - 1, 0, 0, 7); c.fill(); } else c.fillRect(x + 4, y + 5, W - 2, H - 2);
  // Grundplatte
  if (st === 'A') {
    c.fillStyle = '#9aa7ad'; rr(c, x + 1, y + 1, W - 2, H - 2, 6); c.fill();
    c.fillStyle = '#cfd8dc'; rr(c, x + 3, y + 3, W - 6, H - 8, 5); c.fill();
    c.fillStyle = col; c.fillRect(x + 4, y + H - 7, W - 8, 3);
  } else if (st === 'D') {
    c.fillStyle = '#2f2f2f'; oct(c, x + 1, y + 1, W - 2, H - 2, 6); c.fill();
    c.fillStyle = '#555'; oct(c, x + 3, y + 3, W - 6, H - 7, 5); c.fill();
    c.fillStyle = dk; c.fillRect(x + 3, y + 3, W - 6, 4);
    c.fillStyle = col; c.fillRect(x + 5, y + H - 8, W - 10, 3);
    c.fillStyle = '#888'; for (const [a, b] of [[x + 6, y + 6], [x + W - 6, y + 6], [x + 6, y + H - 6], [x + W - 6, y + H - 6]]) { c.beginPath(); c.arc(a, b, 1.4, 0, 7); c.fill(); }
  } else {
    c.fillStyle = '#2a1d30'; c.beginPath(); c.ellipse(cx, cy, W / 2 - 1, H / 2 - 1, 0, 0, 7); c.fill();
    c.fillStyle = '#4a3352'; c.beginPath(); c.ellipse(cx, cy - 1, W / 2 - 3, H / 2 - 4, 0, 0, 7); c.fill();
    c.strokeStyle = rgba(col, 0.7); c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 5; i++) { const a = i * 1.257 + 0.3; c.moveTo(cx + Math.cos(a) * s * 0.15, cy + Math.sin(a) * s * 0.15); c.quadraticCurveTo(cx + Math.cos(a + 0.4) * s * 0.3, cy + Math.sin(a + 0.4) * s * 0.3, cx + Math.cos(a) * (W / 2 - 4), cy + Math.sin(a) * (H / 2 - 5)); }
    c.stroke();
  }
  const role = d.role, k = d.key.slice(2), pulse = 0.5 + 0.5 * Math.sin(tm * 3);
  const glow = (gx, gy, r, gc) => { c.fillStyle = rgba(gc, 0.25 + 0.2 * pulse); c.beginPath(); c.arc(gx, gy, r * 1.6, 0, 7); c.fill(); c.fillStyle = gc; c.beginPath(); c.arc(gx, gy, r, 0, 7); c.fill(); };
  const dome = (gx, gy, r, c1) => { const g = c.createRadialGradient(gx - r * 0.4, gy - r * 0.4, r * 0.1, gx, gy, r); g.addColorStop(0, '#fff'); g.addColorStop(0.4, c1); g.addColorStop(1, shade(c1, -0.5)); c.fillStyle = g; c.beginPath(); c.arc(gx, gy, r, 0, 7); c.fill(); };
  const box = (bx, by, bw, bh, c1) => { c.fillStyle = shade(c1, -0.35); c.fillRect(bx, by + 2, bw, bh); c.fillStyle = c1; c.fillRect(bx, by, bw, bh - 2); c.fillStyle = shade(c1, 0.25); c.fillRect(bx, by, bw, 2); };
  const chimney = (gx, gy, r) => { c.fillStyle = '#3a3a3a'; c.beginPath(); c.arc(gx, gy, r, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(gx, gy, r * 0.6, 0, 7); c.fill(); const sm = (tm * 0.7 + gx * 0.01) % 1; c.fillStyle = `rgba(120,120,120,${0.5 * (1 - sm)})`; c.beginPath(); c.arc(gx + sm * 8, gy - sm * 16, r * (0.8 + sm), 0, 7); c.fill(); };
  const door = (bx, by, bw, bh) => { c.fillStyle = '#222'; c.fillRect(bx, by, bw, bh); c.strokeStyle = st === 'D' ? '#d4a017' : st === 'A' ? '#90a4ae' : rgba(col, 0.8); c.lineWidth = 1; for (let i = 2; i < bh; i += 3) { c.beginPath(); c.moveTo(bx, by + i); c.lineTo(bx + bw, by + i); c.stroke(); } };
  const pad = (gx, gy, r) => { c.fillStyle = '#333'; c.beginPath(); c.arc(gx, gy, r, 0, 7); c.fill(); c.strokeStyle = st === 'K' ? col : '#ffeb3b'; c.lineWidth = 2; c.beginPath(); c.arc(gx, gy, r * 0.75, 0, 7); c.stroke(); c.fillStyle = '#fff'; c.font = `bold ${r * 0.9}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(st === 'K' ? '◎' : 'H', gx, gy + 1); };
  const dish = (gx, gy, r, a) => { c.fillStyle = '#eceff1'; c.beginPath(); c.ellipse(gx, gy, r, r * 0.6, a, 0, 7); c.fill(); c.fillStyle = '#90a4ae'; c.beginPath(); c.ellipse(gx, gy, r * 0.6, r * 0.35, a, 0, 7); c.fill(); c.strokeStyle = '#455a64'; c.lineWidth = 2; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(a - 1.2) * r, gy + Math.sin(a - 1.2) * r); c.stroke(); };
  const orb = (gx, gy, r) => { glow(gx, gy, r, col); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(gx - r * 0.3, gy - r * 0.3, r * 0.3, 0, 7); c.fill(); };
  const spire = (gx, gy, r, gc) => { c.fillStyle = shade(gc, -0.4); c.beginPath(); c.moveTo(gx, gy - r * 1.6); c.lineTo(gx + r * 0.7, gy); c.lineTo(gx, gy + r * 0.6); c.lineTo(gx - r * 0.7, gy); c.closePath(); c.fill(); c.fillStyle = gc; c.beginPath(); c.moveTo(gx, gy - r * 1.6); c.lineTo(gx + r * 0.45, gy - 0.1 * r); c.lineTo(gx, gy + r * 0.3); c.closePath(); c.fill(); };
  const egg = (gx, gy, r) => { c.fillStyle = '#6d4c41'; c.beginPath(); c.ellipse(gx, gy, r * 0.75, r, 0, 0, 7); c.fill(); c.fillStyle = rgba(col, 0.4 + 0.4 * pulse); c.beginPath(); c.ellipse(gx, gy, r * 0.45, r * 0.65, 0, 0, 7); c.fill(); };
  const pipe = (x1, y1, x2, y2, w, c1) => { c.strokeStyle = c1; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.lineCap = 'butt'; };
  const turret = (wcls) => {
    const tr = s * 0.32;
    if (st === 'A') { c.fillStyle = '#b0bec5'; c.beginPath(); c.arc(cx, cy, tr + 3, 0, 7); c.fill(); }
    else if (st === 'D') { c.fillStyle = '#444'; c.fillRect(cx - tr - 3, cy - tr - 3, tr * 2 + 6, tr * 2 + 6); }
    c.save(); c.translate(cx, cy); c.rotate(face);
    if (wcls === 'flak') { c.fillStyle = '#333'; c.fillRect(0, -5, tr + 9, 3); c.fillRect(0, 2, tr + 9, 3); c.fillRect(0, -1.5, tr + 7, 3); }
    else if (wcls === 'cannon' || wcls === 'acid') { c.fillStyle = wcls === 'acid' ? '#558b2f' : '#2b2b2b'; c.fillRect(0, -3, tr + 12, 6); }
    else if (wcls === 'laser') { c.fillStyle = '#37474f'; c.fillRect(0, -2.5, tr + 10, 5); c.fillStyle = '#80d8ff'; c.fillRect(tr + 8, -2, 3, 4); }
    else if (wcls === 'flame') { c.fillStyle = '#3e2723'; c.fillRect(0, -3, tr + 6, 6); c.fillStyle = '#ff7043'; c.fillRect(tr + 5, -2, 3, 4); }
    else if (wcls === 'psi') { }
    else { c.fillStyle = '#333'; c.fillRect(0, -3.5, tr + 7, 2.5); c.fillRect(0, 1, tr + 7, 2.5); }
    c.fillStyle = st === 'K' ? '#5d3f63' : col; c.beginPath(); c.arc(0, 0, tr, 0, 7); c.fill();
    c.fillStyle = shade(st === 'K' ? '#5d3f63' : col, 0.3); c.beginPath(); c.arc(-tr * 0.3, -tr * 0.3, tr * 0.4, 0, 7); c.fill();
    c.restore();
    if (wcls === 'psi') orb(cx, cy, tr * 0.6);
  };
  switch (role) {
    case 'bauhof':
      if (st === 'A') { dome(cx, cy - 3, s * 0.28, '#e3f2fd'); box(x + 8, y + H - 26, 22, 14, col); pipe(cx, cy, x + W - 8, y + 8, 3, '#ffb300'); pipe(x + W - 8, y + 8, x + W - 8, y + 22, 1.5, '#555'); }
      else if (st === 'D') { box(cx - 16, cy - 20, 32, 30, '#6b6b6b'); box(cx - 10, cy - 14, 20, 14, col); pipe(cx + 12, cy - 18, cx + 12, cy - 34, 2, '#999'); c.fillStyle = '#f44336'; c.beginPath(); c.arc(cx + 12, cy - 34, 2 * pulse + 1, 0, 7); c.fill(); chimney(x + 12, y + H - 14, 5); }
      else { orb(cx, cy - 2, s * 0.17); for (let i = 0; i < 6; i++) { const a = i * 1.047 + tm * 0.3; pipe(cx + Math.cos(a) * s * 0.2, cy + Math.sin(a) * s * 0.2, cx + Math.cos(a) * s * 0.38, cy + Math.sin(a) * s * 0.36, 3, '#6a4a75'); } }
      break;
    case 'power':
      if (st === 'A') { dome(cx - 9, cy - 4, 9, '#b3e5fc'); dome(cx + 9, cy - 4, 9, '#b3e5fc'); glow(cx, cy + 9, 3, '#4fc3f7'); }
      else if (st === 'D') { box(cx - 18, cy - 8, 36, 18, '#6b6b6b'); chimney(cx - 9, cy - 10, 5); chimney(cx + 9, cy - 10, 5); }
      else { spire(cx, cy + 6, 11, col); glow(cx, cy - 4, 3, '#fff'); }
      break;
    case 'refinery':
      if (st === 'A') { dome(x + 22, y + 22, 13, '#cfd8dc'); dome(x + W - 22, y + 22, 13, '#cfd8dc'); box(cx - 14, y + H - 30, 28, 16, col); }
      else if (st === 'D') { c.fillStyle = '#5d4037'; c.beginPath(); c.arc(x + 24, y + 24, 15, 0, 7); c.fill(); c.fillStyle = '#ff6f00'; c.beginPath(); c.arc(x + 24, y + 24, 9, 0, 7); c.fill(); box(x + W - 40, y + 10, 30, 26, '#6b6b6b'); chimney(x + W - 18, y + 16, 5); }
      else { c.fillStyle = '#3d2b46'; c.beginPath(); c.ellipse(cx, cy - 6, 26, 18, 0, 0, 7); c.fill(); c.fillStyle = rgba(col, 0.5 + 0.3 * pulse); c.beginPath(); c.ellipse(cx, cy - 6, 16, 10, 0, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + T, y + H - 12, T, 10); c.fillStyle = '#ffeb3b'; c.fillRect(x + T + 2, y + H - 4, T - 4, 2);
      break;
    case 'barracks':
      if (st === 'A') { box(x + 6, y + 8, W - 12, H - 22, '#eceff1'); c.fillStyle = col; c.fillRect(x + 6, y + 8, W - 12, 4); pipe(x + W - 10, y + 10, x + W - 10, y - 6, 1.5, '#555'); c.fillStyle = col; c.fillRect(x + W - 10, y - 6, 10, 6); }
      else if (st === 'D') { c.fillStyle = '#556b2f'; c.beginPath(); c.moveTo(x + 6, y + H - 10); c.lineTo(cx, y + 6); c.lineTo(x + W - 6, y + H - 10); c.closePath(); c.fill(); c.fillStyle = col; star(c, cx, cy + 4, 7); }
      else { egg(cx - 9, cy, 9); egg(cx + 9, cy + 2, 8); }
      break;
    case 'factory':
      if (st === 'A') { box(x + 6, y + 6, W - 12, H - 22, '#eceff1'); dome(x + W - 22, y + 22, 11, col); door(cx - 20, y + H - 26, 40, 14); }
      else if (st === 'D') { box(x + 5, y + 5, W - 10, H - 20, '#6b6b6b'); chimney(x + 18, y + 18, 6); chimney(x + 34, y + 16, 5); door(cx - 20, y + H - 26, 40, 15); }
      else { c.fillStyle = '#3d2b46'; c.beginPath(); c.ellipse(cx, cy - 8, 32, 22, 0, 0, 7); c.fill(); c.fillStyle = rgba(col, 0.35 + 0.3 * pulse); c.beginPath(); c.ellipse(cx, cy - 8, 20, 12, 0, 0, 7); c.fill(); door(cx - 16, y + H - 22, 32, 10); }
      break;
    case 'airfield':
      pad(x + 26, cy, 18); c.fillStyle = '#444'; c.fillRect(x + 52, y + 10, 36, H - 22); c.fillStyle = '#ffeb3b'; for (let i = 0; i < 4; i++) c.fillRect(x + 68, y + 16 + i * 18, 4, 9);
      if (st === 'K') { c.fillStyle = rgba(col, 0.5); c.beginPath(); c.ellipse(x + 70, cy, 14, 30, 0, 0, 7); c.fill(); }
      break;
    case 'tech':
      if (st === 'A') { box(x + 6, y + 14, W - 12, H - 26, '#eceff1'); dish(cx, cy - 6, 12, Math.sin(tm * 0.5) * 0.6); }
      else if (st === 'D') { box(x + 6, y + 8, W - 12, H - 20, '#6b6b6b'); for (let i = 0; i < 3; i++) { c.fillStyle = ['#76ff03', '#ffea00', '#ff3d00'][i]; c.fillRect(x + 14 + i * 13, y + 14, 6, 18); } }
      else { c.fillStyle = '#7b1fa2'; c.beginPath(); c.arc(cx, cy - 2, 16, 0, 7); c.fill(); c.strokeStyle = '#ce93d8'; c.lineWidth = 1.5; c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(cx - 12, cy - 2 + i * 5); c.bezierCurveTo(cx - 4, cy - 8 + i * 5, cx + 4, cy + 4 + i * 5, cx + 12, cy - 2 + i * 5); } c.stroke(); glow(cx, cy - 2, 3 + pulse * 2, col); }
      break;
    case 'tower': turret(d.weapon.c); break;
    case 'special':
      switch (k) {
        case 'hangar': box(x + 6, y + 6, W - 12, H - 18, '#eceff1'); door(x + 12, y + H - 24, W - 24, 12); c.fillStyle = col; c.fillRect(x + 10, y + 10, W - 20, 5); break;
        case 'schild': dome(cx, cy - 2, 16, '#80deea'); c.strokeStyle = `rgba(128,222,234,${0.3 + 0.5 * pulse})`; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy - 2, 22 + pulse * 3, 0, 7); c.stroke(); break;
        case 'repbucht': pad(cx, cy - 2, 18); pipe(x + 6, y + 6, cx, cy - 2, 3, '#ffb300'); break;
        case 'handel': box(cx - 12, y + 6, 24, H - 18, '#b0bec5'); glow(cx, y + 14, 4, '#ffd54f'); c.fillStyle = '#ffd54f'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', cx, cy + 8); break;
        case 'schmiede': box(x + 6, y + 10, W - 12, H - 22, '#5d4037'); chimney(x + 16, y + 16, 6); chimney(x + W - 16, y + 16, 6); c.fillStyle = `rgba(255,111,0,${0.5 + 0.5 * pulse})`; c.fillRect(cx - 8, cy + 4, 16, 8); break;
        case 'akademie': box(x + 6, y + 8, W - 12, H - 20, '#6b6b6b'); c.fillStyle = '#ffd600'; star(c, cx, cy - 2, 11); break;
        case 'propaganda': c.fillStyle = '#424242'; c.fillRect(cx - 4, y + 4, 8, H - 12); for (const sy of [y + 12, y + 30]) { c.fillStyle = col; c.beginPath(); c.moveTo(cx + 4, sy); c.lineTo(cx + 16, sy - 6); c.lineTo(cx + 16, sy + 6); c.fill(); c.beginPath(); c.moveTo(cx - 4, sy); c.lineTo(cx - 16, sy - 6); c.lineTo(cx - 16, sy + 6); c.fill(); } break;
        case 'verdichter': box(x + 6, y + 6, W - 12, H - 18, '#6b6b6b'); c.fillStyle = '#d4a62a'; c.fillRect(cx - 10, cy - 6 + pulse * 6, 20, 6); c.fillStyle = '#333'; c.fillRect(cx - 12, cy + 8, 24, 4); break;
        case 'brutkammer': egg(cx, cy, 16); for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.78; pipe(cx + Math.cos(a) * 12, cy + Math.sin(a) * 14, cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, 3, '#5d3f63'); } break;
        case 'becken': c.fillStyle = '#004d40'; c.beginPath(); c.ellipse(cx, cy - 2, 22, 16, 0, 0, 7); c.fill(); c.fillStyle = `rgba(100,255,218,${0.5 + 0.3 * pulse})`; c.beginPath(); c.ellipse(cx, cy - 2, 17, 11, 0, 0, 7); c.fill(); break;
        case 'verstaerker': pipe(cx, cy + 10, cx, y + 4, 4, '#6a4a75'); for (let i = 0; i < 3; i++) { c.strokeStyle = rgba(col, 0.8 - i * 0.25); c.lineWidth = 2; c.beginPath(); c.arc(cx, y + 8, 6 + i * 6 + pulse * 3, 0, 7); c.stroke(); } break;
        case 'konverter': c.fillStyle = '#33691e'; c.beginPath(); c.arc(cx, cy, 18, 0, 7); c.fill(); c.fillStyle = `rgba(178,255,89,${0.5 + 0.4 * pulse})`; c.beginPath(); c.arc(cx, cy, 12, 0, 7); c.fill(); for (let i = 0; i < 3; i++) { c.fillStyle = '#ccff90'; c.beginPath(); c.arc(cx - 6 + i * 6, cy + 4 - ((tm * 10 + i * 5) % 12), 2, 0, 7); c.fill(); } break;
      }
      break;
    case 'superweapon': {
      const ready = flags && flags.ready;
      switch (k) {
        case 'atom': c.fillStyle = '#333'; c.beginPath(); c.arc(cx, cy, 30, 0, 7); c.fill(); c.fillStyle = '#ffd600'; c.beginPath(); c.arc(cx, cy, 24, 0, 7); c.fill(); c.fillStyle = '#111'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 20, i * 2.094 - 0.5, i * 2.094 + 0.5); c.closePath(); c.fill(); } c.fillStyle = '#ffd600'; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill(); chimney(x + 12, y + H - 12, 5); break;
        case 'wall': for (const [a, b] of [[x + 16, y + 16], [x + W - 16, y + 16], [x + 16, y + H - 16], [x + W - 16, y + H - 16]]) { box(a - 7, b - 9, 14, 18, '#6b6b6b'); glow(a, b - 6, 3, '#ff1744'); } c.fillStyle = `rgba(255,215,0,${0.4 + 0.4 * pulse})`; c.beginPath(); c.arc(cx, cy, 12, 0, 7); c.fill(); break;
        case 'ionen': box(x + 8, y + H - 30, W - 16, 22, '#eceff1'); dish(cx, cy - 8, 30, -0.4); glow(cx + 8, cy - 18, 3 + pulse * 2, '#80d8ff'); break;
        case 'luftbruecke': pad(x + 30, cy, 22); box(x + W - 38, y + 10, 30, H - 22, '#eceff1'); c.fillStyle = col; c.beginPath(); c.arc(x + W - 23, cy - 10, 10, Math.PI, 0); c.fill(); pipe(x + W - 33, cy - 10, x + W - 23, cy + 6, 1, '#333'); pipe(x + W - 13, cy - 10, x + W - 23, cy + 6, 1, '#333'); break;
        case 'sturm': spire(cx, cy + 16, 22, '#ea80fc'); if (pulse > 0.7) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx, cy - 18); c.lineTo(cx + 8, cy - 8); c.lineTo(cx - 3, cy - 2); c.lineTo(cx + 6, cy + 8); c.stroke(); } break;
        case 'emp': for (let i = 0; i < 4; i++) { c.strokeStyle = rgba('#40c4ff', 0.9 - i * 0.18); c.lineWidth = 3; c.beginPath(); c.ellipse(cx, cy - i * 6 + 8, 30 - i * 5, 12 - i * 2, 0, 0, 7); c.stroke(); } glow(cx, cy - 18, 4 + pulse * 2, '#40c4ff'); break;
      }
      if (ready) { c.strokeStyle = `rgba(255,23,68,${0.5 + 0.5 * pulse})`; c.lineWidth = 3; c.strokeRect(x + 2, y + 2, W - 4, H - 4); }
      break;
    }
  }
  if (flags && flags.inv) { c.strokeStyle = `rgba(255,215,0,${0.6 + 0.3 * pulse})`; c.lineWidth = 3; c.strokeRect(x, y, W, H); }
  if (flags && flags.stun) { c.strokeStyle = `rgba(64,196,255,${0.5 + 0.4 * pulse})`; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(x + Math.random() * W, y + Math.random() * H); c.lineTo(x + Math.random() * W, y + Math.random() * H); } c.stroke(); }
  if (flags && flags.rep) { c.fillStyle = '#69f0ae'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('🔧', cx, y + 10 + pulse * 3); }
  // Schaden: Rauch
  if (hp < 0.5) { const n = hp < 0.25 ? 3 : 1; for (let i = 0; i < n; i++) { const ph = (tm * 0.8 + i * 0.33 + (x % 7) * 0.1) % 1; c.fillStyle = `rgba(40,40,40,${0.6 * (1 - ph)})`; c.beginPath(); c.arc(x + W * (0.3 + i * 0.2) + ph * 6, y + H * 0.4 - ph * 22, 4 + ph * 7, 0, 7); c.fill(); } if (hp < 0.25) { c.fillStyle = `rgba(255,120,0,${0.5 + 0.4 * Math.random()})`; c.beginPath(); c.arc(x + W * 0.4, y + H * 0.5, 4, 0, 7); c.fill(); } }
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function oct(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.lineTo(x + w, y + r); c.lineTo(x + w, y + h - r); c.lineTo(x + w - r, y + h); c.lineTo(x + r, y + h); c.lineTo(x, y + h - r); c.lineTo(x, y + r); c.closePath(); }
function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.fill(); }

// ---------- Einheiten ----------
function drawUnit(c, d, col, x, y, face, tm, flags, alt) {
  const s = d.size, st = d.fac, dk = shade(col, -0.4), lt = shade(col, 0.4);
  if (d.cat === 'air') {
    const h = alt || 22;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x + 6, y + h * 0.6, s * 0.9, s * 0.5, 0, 0, 7); c.fill();
    y -= h;
  }
  c.save(); c.translate(x, y); c.rotate(face);
  const usc = d.sup ? 1.1 : d.cat === 'inf' ? 1.5 : 1.15; c.scale(usc, usc);
  const k = d.key.slice(2);
  if (d.cat === 'inf') {
    if (d.sup) { // Titan
      const step = Math.sin(tm * 4) * 4;
      c.fillStyle = '#3e2a47'; c.beginPath(); c.ellipse(-4, -9 + step, 7, 5, 0, 0, 7); c.ellipse(-4, 9 - step, 7, 5, 0, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, s * 0.75, s, 0, 0, 7); c.fill();
      c.fillStyle = '#5d3f63'; c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.75, 0, 0, 7); c.fill();
      c.fillStyle = `rgba(234,128,252,${0.6 + 0.3 * Math.sin(tm * 5)})`; c.beginPath(); c.arc(4, 0, 6, 0, 7); c.fill();
      c.fillStyle = '#ea80fc'; c.fillRect(6, -s + 2, 10, 4); c.fillRect(6, s - 6, 10, 4);
    } else if (st === 'K') {
      c.strokeStyle = '#2a1d30'; c.lineWidth = 1.5; c.beginPath(); for (const sy of [-1, 1]) { c.moveTo(-2, 0); c.lineTo(-4, sy * 6); c.moveTo(2, 0); c.lineTo(3, sy * 6); } c.stroke();
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 5, 3.6, 0, 0, 7); c.fill();
      c.fillStyle = k === 'psioniker' ? '#ea80fc' : k === 'spucker' ? '#b2ff59' : lt; c.beginPath(); c.arc(4, 0, 2.4, 0, 7); c.fill();
    } else {
      c.fillStyle = '#222'; c.fillRect(1, k === 'rakete' || k === 'bazooka' ? -4 : 1, k === 'sniper' ? 10 : 7, 2);
      if (k === 'rakete' || k === 'bazooka') { c.fillStyle = '#555'; c.fillRect(-2, -5, 10, 3); }
      if (k === 'flammen') { c.fillStyle = '#795548'; c.fillRect(-6, -3, 4, 6); }
      c.fillStyle = col; c.beginPath(); c.arc(0, 0, 4.2, 0, 7); c.fill();
      c.fillStyle = st === 'A' ? '#e0e0e0' : '#4e5b31'; c.beginPath(); c.arc(0.5, 0, 2.6, 0, 7); c.fill();
    }
  } else if (d.cat === 'veh') {
    if (st === 'K' && !d.harvester && !d.mcv) {
      c.fillStyle = rgba(col, 0.25 + 0.15 * Math.sin(tm * 6)); c.beginPath(); c.ellipse(0, 0, s + 3, s * 0.8 + 2, 0, 0, 7); c.fill();
      c.fillStyle = '#3d2b46'; c.beginPath(); c.ellipse(0, 0, s, s * 0.7, 0, 0, 7); c.fill();
      c.fillStyle = col; c.beginPath(); c.ellipse(1, 0, s * 0.65, s * 0.45, 0, 0, 7); c.fill();
      if (k === 'plasma') { c.fillStyle = '#ea80fc'; c.fillRect(2, -2, s + 6, 4); }
      else if (k === 'stachelkaefer') { c.fillStyle = '#ddd'; for (let i = -1; i <= 1; i++) c.fillRect(2, i * 4 - 1, s, 2); }
      else { c.fillStyle = '#80d8ff'; c.fillRect(s * 0.4, -1.5, s * 0.8, 3); }
    } else {
      const L = s * 1.15, Wd = s * 0.8;
      // Ketten / Räder
      c.fillStyle = '#1b1b1b';
      if (k === 'buggy') { for (const [a, b] of [[-L * 0.6, -Wd], [L * 0.5, -Wd], [-L * 0.6, Wd - 4], [L * 0.5, Wd - 4]]) c.fillRect(a, b, 6, 4); }
      else { c.fillRect(-L, -Wd, L * 2, 4); c.fillRect(-L, Wd - 4, L * 2, 4); const tr = (tm * 20) % 4; c.fillStyle = '#444'; for (let i = -L + tr; i < L; i += 4) { c.fillRect(i, -Wd, 1, 4); c.fillRect(i, Wd - 4, 1, 4); } }
      const body = st === 'A' ? '#cfd8dc' : st === 'D' ? '#5a5a4a' : '#4a3352';
      c.fillStyle = body;
      if (st === 'A') { rr(c, -L + 1, -Wd + 3, L * 2 - 2, Wd * 2 - 6, 4); c.fill(); } else c.fillRect(-L + 1, -Wd + 3, L * 2 - 2, Wd * 2 - 6);
      c.fillStyle = col; c.fillRect(-L + 2, -Wd + 3, 4, Wd * 2 - 6);
      if (d.harvester) {
        c.fillStyle = shade(body, -0.25); c.fillRect(-L + 7, -Wd + 4, L * 1.1, Wd * 2 - 8);
        if (flags & 8) { c.fillStyle = '#d4a62a'; c.fillRect(-L + 9, -Wd + 6, L * 0.9, Wd * 2 - 12); }
        c.fillStyle = col; c.fillRect(L * 0.3, -Wd + 4, L * 0.6, Wd * 2 - 8);
        if (flags & 16) { c.fillStyle = `rgba(255,235,59,${0.5 + 0.5 * Math.sin(tm * 20)})`; c.fillRect(L - 2, -Wd + 2, 4, Wd * 2 - 4); }
      } else if (d.mcv) {
        c.fillStyle = col; c.fillRect(-L + 8, -Wd + 5, L * 1.2, Wd * 2 - 10); c.fillStyle = '#ffb300'; c.fillRect(-2, -2, L, 4); c.fillStyle = '#333'; c.fillRect(L * 0.5, -Wd + 4, L * 0.4, Wd * 2 - 8);
      } else {
        // Turm
        const tr = d.sup ? s * 0.45 : s * 0.42;
        if (k === 'katjuscha' || k === 'ionwerfer') { c.fillStyle = '#333'; c.save(); c.rotate(-0.0); for (let i = -1; i <= 1; i++) c.fillRect(-L * 0.6, i * 4 - 1.5, L * 1.6, 3); c.restore(); }
        else if (k === 'flakpanzer') { c.fillStyle = '#222'; c.fillRect(0, -4, s + 4, 2.5); c.fillRect(0, 1.5, s + 4, 2.5); }
        else if (d.sup) { c.fillStyle = '#222'; c.fillRect(0, -7, s + 10, 5); c.fillRect(0, 2, s + 10, 5); c.fillStyle = '#555'; c.fillRect(-L * 0.8, -Wd + 6, 8, Wd * 2 - 12); }
        else if (k === 'buggy') { c.fillStyle = '#222'; c.fillRect(0, -1, s, 2); }
        else { c.fillStyle = k === 'laserpanzer' ? '#455a64' : '#222'; c.fillRect(0, -2.5, s + 5, 5); if (k === 'laserpanzer') { c.fillStyle = '#80d8ff'; c.fillRect(s + 3, -2, 3, 4); } }
        c.fillStyle = shade(body, 0.15); c.beginPath(); c.arc(0, 0, tr, 0, 7); c.fill();
        c.fillStyle = col; c.beginPath(); c.arc(0, 0, tr * 0.55, 0, 7); c.fill();
      }
    }
  } else { // Luft
    const body = st === 'A' ? '#cfd8dc' : st === 'D' ? '#5a5a4a' : '#4a3352';
    if (d.sup) { // Himmelsfestung
      c.fillStyle = body; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.047; c.lineTo(Math.cos(a) * s, Math.sin(a) * s * 0.8); } c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(0, 0, s * 0.45, 0, 7); c.fill();
      c.fillStyle = '#80d8ff'; c.beginPath(); c.arc(s * 0.2, 0, s * 0.2, 0, 7); c.fill();
      for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.785, rx = Math.cos(a) * s * 0.85, ry = Math.sin(a) * s * 0.7; c.strokeStyle = 'rgba(200,200,200,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(rx, ry, 8, tm * 15, tm * 15 + 2); c.stroke(); c.beginPath(); c.arc(rx, ry, 8, tm * 15 + 3.14, tm * 15 + 5.14); c.stroke(); }
    } else if (k === 'heli' || k === 'gunship') {
      c.fillStyle = body; c.beginPath(); c.ellipse(2, 0, s * 0.7, s * 0.4, 0, 0, 7); c.fill(); c.fillRect(-s * 1.1, -1.5, s * 0.8, 3);
      c.fillStyle = col; c.beginPath(); c.ellipse(4, 0, s * 0.35, s * 0.25, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(30,30,30,0.6)'; c.lineWidth = 2; const ra = tm * 25; c.beginPath(); c.moveTo(Math.cos(ra) * s * 1.2, Math.sin(ra) * s * 1.2); c.lineTo(-Math.cos(ra) * s * 1.2, -Math.sin(ra) * s * 1.2); c.moveTo(Math.cos(ra + 1.57) * s * 1.2, Math.sin(ra + 1.57) * s * 1.2); c.lineTo(-Math.cos(ra + 1.57) * s * 1.2, -Math.sin(ra + 1.57) * s * 1.2); c.stroke();
    } else if (st === 'K') {
      const fl = Math.sin(tm * (k === 'brut' ? 6 : 14)) * 0.35;
      c.fillStyle = col; c.beginPath(); c.moveTo(s * 0.5, 0); c.quadraticCurveTo(-s * 0.2, -s * (1.3 + fl), -s * 0.7, -s * 0.3); c.lineTo(-s * 0.4, 0); c.lineTo(-s * 0.7, s * 0.3); c.quadraticCurveTo(-s * 0.2, s * (1.3 + fl), s * 0.5, 0); c.fill();
      c.fillStyle = '#3d2b46'; c.beginPath(); c.ellipse(0, 0, s * 0.55, s * 0.28, 0, 0, 7); c.fill();
      c.fillStyle = k === 'brut' ? '#ffab40' : '#ea80fc'; c.beginPath(); c.arc(s * 0.35, 0, 2, 0, 7); c.fill();
    } else {
      c.fillStyle = body; c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.6, -s * 0.85); c.lineTo(-s * 0.35, 0); c.lineTo(-s * 0.6, s * 0.85); c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(s * 0.7, 0); c.lineTo(-s * 0.3, -s * 0.3); c.lineTo(-s * 0.3, s * 0.3); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,170,60,0.8)'; c.beginPath(); c.arc(-s * 0.45, 0, 2 + Math.random() * 1.5, 0, 7); c.fill();
    }
  }
  c.restore();
  if (flags & 2) { c.strokeStyle = 'rgba(255,215,0,0.85)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, s + 4, 0, 7); c.stroke(); }
  if (flags & 1) { c.strokeStyle = 'rgba(64,196,255,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + 2, y); c.lineTo(x - 2, y + 2); c.lineTo(x + s, y + s); c.stroke(); }
}

// ---------- Icons für die Bauleiste ----------
const ICONS = {};
function iconFor(type, col) {
  const k = type + col; if (ICONS[k]) return ICONS[k];
  const d = DEFS[type], cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#2b3a2b'); g.addColorStop(1, '#1a221a'); c.fillStyle = g; c.fillRect(0, 0, 128, 96);
  if (d.kind === 'bld') {
    const W = d.w * T, H = d.h * T, sc = Math.min(110 / W, 80 / H, 2.2);
    c.save(); c.translate(64 - W * sc / 2, 50 - H * sc / 2); c.scale(sc, sc); drawBld(c, d, col, 0, 0, 0.5, 0.3, 1, null); c.restore();
  } else {
    const sc = d.sup ? 1.7 : d.cat === 'inf' ? 4 : 2.6;
    c.save(); c.translate(64, d.cat === 'air' ? 60 : 50); c.scale(sc, sc); drawUnit(c, d, col, 0, 0, -0.5, 0.3, 0, d.cat === 'air' ? 6 : 0); c.restore();
  }
  ICONS[k] = cv.toDataURL(); return ICONS[k];
}

// ---------- Effekte ----------
class FX {
  constructor() { this.list = []; this.texts = []; }
  add(ev, now, localPid) {
    const L = this.list;
    switch (ev.k) {
      case 's': { const [x1, y1, x2, y2] = ev.a, w = WCLS[ev.c]; L.push({ t: 'shot', x1, y1: y1 - (ev.sa ? 22 : 0), x2, y2: y2 - (ev.ta ? 22 : 0), c: ev.c, fx: w.fx, col: w.col, s: now, d: Math.max(ev.t, w.fx === 'beam' ? 0.14 : w.fx === 'flame' ? 0.35 : 0.08), big: ev.big }); break; }
      case 'b': L.push({ t: 'boom', x: ev.x, y: ev.y, r: Math.max(10, ev.r), c: ev.c, s: now, d: ev.c === 'ion' ? 1.2 : 0.5 }); break;
      case 'd': L.push({ t: 'boom', x: ev.x, y: ev.y - (ev.a ? 22 : 0), r: Math.max(14, ev.r * 1.2), s: now, d: ev.b ? 1.3 : 0.7, big: ev.b }); if (ev.b) for (let i = 0; i < 6; i++) L.push({ t: 'boom', x: ev.x + (Math.random() - 0.5) * ev.r * 1.6, y: ev.y + (Math.random() - 0.5) * ev.r * 1.6, r: 14 + Math.random() * 14, s: now + Math.random() * 0.6, d: 0.6 }); break;
      case 'nukeL': L.push({ t: 'missile', x1: ev.sx, y1: ev.sy, x2: ev.x, y2: ev.y, s: now, d: ev.t }); L.push({ t: 'target', x: ev.x, y: ev.y, r: 5.5 * T, s: now, d: ev.t, col: '#ff1744' }); break;
      case 'nuke': L.push({ t: 'nuke', x: ev.x, y: ev.y, r: ev.r, s: now, d: 4 }); break;
      case 'ion': L.push({ t: 'ion', x: ev.x, y: ev.y, r: ev.r, s: now, d: 2.4 }); break;
      case 'storm': L.push({ t: 'storm', x: ev.x, y: ev.y, r: ev.r, s: now, d: ev.t }); break;
      case 'emp': L.push({ t: 'ring', x: ev.x, y: ev.y, r: ev.r, s: now, d: 1.2, col: '#40c4ff' }); break;
      case 'shield': L.push({ t: 'ring', x: ev.x, y: ev.y, r: ev.r, s: now, d: 1.0, col: '#ffd700' }); break;
      case 'drop': L.push({ t: 'plane', x: ev.x, y: ev.y, s: now, d: 3 }); break;
      case 'place': L.push({ t: 'ring', x: ev.x, y: ev.y, r: ev.w * T * 0.8, s: now, d: 0.6, col: '#d7ccc8' }); break;
      case 'cash': if (ev.p === localPid) this.texts.push({ x: ev.x, y: ev.y, txt: '+' + ev.v, s: now, d: 1.5, col: '#ffd54f' }); break;
      case 'sell': if (ev.p === localPid) this.texts.push({ x: ev.x, y: ev.y, txt: '+' + ev.v, s: now, d: 1.5, col: '#69f0ae' }); L.push({ t: 'ring', x: ev.x, y: ev.y, r: 40, s: now, d: 0.6, col: '#d7ccc8' }); break;
    }
    if (L.length > 1500) L.splice(0, L.length - 1500);
  }
  draw(c, now) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const f = L[i], p = (now - f.s) / f.d;
      if (p > 1) { L.splice(i, 1); continue; }
      if (p < 0) continue;
      switch (f.t) {
        case 'shot': {
          if (f.fx === 'beam') { c.strokeStyle = f.col; c.globalAlpha = 1 - p; c.lineWidth = f.big ? 5 : 2.5; c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = f.big ? 2 : 1; c.stroke(); c.globalAlpha = 1; break; }
          if (f.fx === 'flame') { for (let j = 0; j < 4; j++) { const q = Math.min(1, p + j * 0.12); c.fillStyle = `rgba(255,${120 + j * 30},0,${0.7 * (1 - q)})`; c.beginPath(); c.arc(f.x1 + (f.x2 - f.x1) * q, f.y1 + (f.y2 - f.y1) * q, 3 + q * 6, 0, 7); c.fill(); } break; }
          let x = f.x1 + (f.x2 - f.x1) * p, y = f.y1 + (f.y2 - f.y1) * p;
          if (f.fx === 'arc' || f.fx === 'bomb') y -= Math.sin(p * Math.PI) * (f.fx === 'arc' ? 60 : 8);
          if (f.fx === 'bullet') { c.strokeStyle = f.col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x - (f.x2 - f.x1) * 0.08, y - (f.y2 - f.y1) * 0.08); c.stroke(); }
          else if (f.fx === 'rocket') { c.fillStyle = 'rgba(200,200,200,0.4)'; c.beginPath(); c.arc(x - (f.x2 - f.x1) * 0.06, y - (f.y2 - f.y1) * 0.06, 3, 0, 7); c.fill(); c.fillStyle = f.col; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); }
          else { c.fillStyle = f.col; c.beginPath(); c.arc(x, y, f.fx === 'arc' ? 4 : f.big ? 4 : 2.6, 0, 7); c.fill(); }
          break;
        }
        case 'boom': {
          const r = f.r * (0.4 + p * 0.8);
          c.fillStyle = `rgba(255,${200 - p * 150},${60 - p * 60},${0.85 * (1 - p)})`; c.beginPath(); c.arc(f.x, f.y, r, 0, 7); c.fill();
          if (f.c === 'ion') { c.fillStyle = `rgba(128,216,255,${0.7 * (1 - p)})`; c.beginPath(); c.arc(f.x, f.y, r * 1.2, 0, 7); c.fill(); }
          c.fillStyle = `rgba(60,60,60,${0.5 * (1 - p)})`; c.beginPath(); c.arc(f.x + 3, f.y - p * 10, r * 0.7, 0, 7); c.fill();
          break;
        }
        case 'ring': c.strokeStyle = rgba(f.col, 1 - p); c.lineWidth = 4 * (1 - p) + 1; c.beginPath(); c.arc(f.x, f.y, f.r * (0.3 + 0.7 * p), 0, 7); c.stroke(); break;
        case 'target': { const a = 0.5 + 0.5 * Math.sin(now * 10); c.strokeStyle = rgba(f.col, a); c.lineWidth = 3; c.setLineDash([12, 8]); c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.stroke(); c.setLineDash([]); break; }
        case 'missile': { const x = f.x1 + (f.x2 - f.x1) * p, y = f.y1 + (f.y2 - f.y1) * p - Math.sin(p * Math.PI) * 400; c.fillStyle = '#eee'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.fillStyle = 'rgba(255,140,0,0.8)'; c.beginPath(); c.arc(x, y + 6, 4 + Math.random() * 3, 0, 7); c.fill(); break; }
        case 'nuke': {
          if (p < 0.12) { c.fillStyle = `rgba(255,255,240,${1 - p * 6})`; c.beginPath(); c.arc(f.x, f.y, f.r * 2.5, 0, 7); c.fill(); }
          c.strokeStyle = `rgba(255,220,180,${1 - p})`; c.lineWidth = 8 * (1 - p); c.beginPath(); c.arc(f.x, f.y, f.r * (0.2 + p * 1.3), 0, 7); c.stroke();
          const g = c.createRadialGradient(f.x, f.y - p * 60, 0, f.x, f.y - p * 60, f.r * 0.8); g.addColorStop(0, `rgba(255,240,180,${1 - p})`); g.addColorStop(0.5, `rgba(255,110,0,${0.8 * (1 - p)})`); g.addColorStop(1, 'rgba(80,30,0,0)');
          c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y - p * 60, f.r * 0.8, 0, 7); c.fill();
          break;
        }
        case 'ion': {
          const a = p < 0.65 ? p / 0.65 : 1 - (p - 0.65) / 0.35;
          c.fillStyle = `rgba(128,216,255,${0.5 * a})`; c.fillRect(f.x - 14 * a, f.y - 2000, 28 * a, 2000);
          c.fillStyle = `rgba(255,255,255,${0.9 * a})`; c.fillRect(f.x - 5 * a, f.y - 2000, 10 * a, 2000);
          c.strokeStyle = `rgba(128,216,255,${a})`; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, f.r * (1 - p * 0.5), 0, 7); c.stroke();
          break;
        }
        case 'storm': {
          const a = Math.min(1, p * 8, (1 - p) * 8);
          const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); g.addColorStop(0, `rgba(200,80,255,${0.35 * a})`); g.addColorStop(1, `rgba(80,0,120,${0.12 * a})`);
          c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.fill();
          c.strokeStyle = `rgba(240,200,255,${0.8 * a})`; c.lineWidth = 2;
          for (let j = 0; j < 3; j++) { if (Math.random() < 0.5) continue; const a0 = Math.random() * 6.28, r0 = Math.random() * f.r; let x = f.x + Math.cos(a0) * r0, y = f.y + Math.sin(a0) * r0; c.beginPath(); c.moveTo(x, y - 60); for (let q = 0; q < 4; q++) { c.lineTo(x + (Math.random() - 0.5) * 20, y - 60 + q * 20); } c.lineTo(x, y); c.stroke(); }
          for (let j = 0; j < 3; j++) { const ang = now * (1 + j * 0.3) + j * 2; c.strokeStyle = `rgba(234,128,252,${0.4 * a})`; c.beginPath(); c.arc(f.x, f.y, f.r * (0.3 + j * 0.25), ang, ang + 1.5); c.stroke(); }
          break;
        }
        case 'plane': { const x = f.x - 900 + p * 1800, y = f.y - 200 + p * 100; c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x + 40, y + 160, 40, 14, 0, 0, 7); c.fill(); c.fillStyle = '#90a4ae'; c.beginPath(); c.moveTo(x + 40, y); c.lineTo(x - 30, y - 40); c.lineTo(x - 20, y); c.lineTo(x - 30, y + 40); c.closePath(); c.fill(); if (p > 0.4 && p < 0.7) for (let j = 0; j < 6; j++) { c.fillStyle = '#eceff1'; c.beginPath(); c.arc(f.x + (j - 3) * 22, f.y - 80 + (p - 0.4) * 250, 7, Math.PI, 0); c.fill(); } break; }
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i], p = (now - t.s) / t.d; if (p > 1) { this.texts.splice(i, 1); continue; }
      c.fillStyle = rgba(t.col, 1 - p); c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText(t.txt, t.x, t.y - 20 - p * 25);
    }
  }
}

// ---------- Haupt-Renderer ----------
class Renderer {
  constructor(canvas) { this.cv = canvas; this.c = canvas.getContext('2d'); this.fx = new FX(); }
  setWorld(world) { this.w = world; this.terrain = new TerrainCache(world.map); this.mini = this.terrain.miniImage(); }
  draw(cam, ui, alpha, now) {
    const c = this.c, w = this.w, dpr = cam.dpr, z = cam.z, vw = this.cv.width / dpr / z, vh = this.cv.height / dpr / z;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b0f0b'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(z * dpr, 0, 0, z * dpr, -cam.x * z * dpr, -cam.y * z * dpr);
    c.imageSmoothingEnabled = true;
    const tc = this.terrain, CS = tc.CH * T;
    const cx0 = Math.max(0, Math.floor(cam.x / CS)), cy0 = Math.max(0, Math.floor(cam.y / CS));
    const cx1 = Math.min(Math.ceil(w.map.w / tc.CH) - 1, Math.floor((cam.x + vw) / CS)), cy1 = Math.min(Math.ceil(w.map.h / tc.CH) - 1, Math.floor((cam.y + vh) / CS));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) c.drawImage(tc.get(cx, cy), cx * CS, cy * CS, CS + 0.5, CS + 0.5);
    // Ressourcen
    const m = w.map, tx0 = Math.max(0, Math.floor(cam.x / T)), ty0 = Math.max(0, Math.floor(cam.y / T)), tx1 = Math.min(m.w - 1, Math.ceil((cam.x + vw) / T)), ty1 = Math.min(m.h - 1, Math.ceil((cam.y + vh) / T));
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const i = y * m.w + x; if (!m.ra[i]) continue;
      const rt = m.rt[i], lvl = Math.min(3, Math.floor(m.ra[i] / RES[rt].amt * 4));
      c.drawImage(resSprite(rt, lvl), x * T, y * T - 2, 34, 34);
    }
    // Gitter für Bauplatz
    if (ui.placing) {
      const d = DEFS[ui.placing.type];
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
      c.beginPath(); for (let x = tx0; x <= tx1; x++) { c.moveTo(x * T, ty0 * T); c.lineTo(x * T, (ty1 + 1) * T); } for (let y = ty0; y <= ty1; y++) { c.moveTo(tx0 * T, y * T); c.lineTo((tx1 + 1) * T, y * T); } c.stroke();
    }
    const now2 = now;
    const ents = []; for (const e of w.ents.values()) ents.push(e);
    const inView = (e, pad) => e.x > cam.x - pad && e.x < cam.x + vw + pad && e.y > cam.y - pad && e.y < cam.y + vh + pad;
    const P = w.players, fog = this.fog && this.fog.enabled ? this.fog : null;
    const seen = (e) => !fog || fog.canSee(e);
    // Gebäude
    for (const e of ents) if (e.kind === 'bld' && inView(e, 120) && seen(e)) {
      const fl = { raw: e.flags | 0, inv: e.flags & 2, stun: e.flags & 1, rep: e.flags & 4, ready: e.def.role === 'superweapon' && e.owner === ui.pid && ui.swReady && ui.swReady.has(e.id) };
      drawBld(c, e.def, P[e.owner].color, e.tx * T, e.ty * T, now2 + e.id, e.face, e.hp / maxHp(e), fl);
    }
    // Bodeneinheiten
    const sel = ui.sel;
    for (const e of ents) if (e.kind === 'unit' && !e.air && inView(e, 60) && seen(e)) {
      const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
      if (sel.has(e.id)) { c.strokeStyle = '#76ff03'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y + 2, e.def.size + 3, (e.def.size + 3) * 0.7, 0, 0, 7); c.stroke(); }
      drawUnit(c, e.def, P[e.owner].color, x, y, e.face, now2 + e.id * 0.37, e.flags);
    }
    this.fxGround = true;
    // Luft
    for (const e of ents) if (e.kind === 'unit' && e.air && inView(e, 80) && seen(e)) {
      const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
      const alt = 20 + Math.sin(now2 * 2 + e.id) * 2 + (e.def.sup ? 14 : 0);
      if (sel.has(e.id)) { c.strokeStyle = '#76ff03'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x + 6, y + alt * 0.6, e.def.size + 3, (e.def.size + 3) * 0.6, 0, 0, 7); c.stroke(); }
      drawUnit(c, e.def, P[e.owner].color, x, y, e.face, now2 + e.id * 0.37, e.flags, alt);
    }
    this.fx.draw(c, now);
    if (fog) { c.imageSmoothingEnabled = true; c.drawImage(fog.canvas(), 0, 0, w.map.w * T, w.map.h * T); }
    if (ui.missionTarget) { const t = w.ents.get(ui.missionTarget); if (t && seen(t)) { c.strokeStyle = `rgba(255,214,0,${0.6 + 0.4 * Math.sin(now * 5)})`; c.lineWidth = 3; c.setLineDash([14, 8]); c.beginPath(); c.arc(t.x, t.y, Math.max(t.w, t.h) * T * 0.8 + 6, 0, 7); c.stroke(); c.setLineDash([]); } }
    // Lebensbalken
    for (const e of ents) {
      if (!seen(e)) continue;
      const s = sel.has(e.id), dmg = e.hp < maxHp(e);
      if (!s && !(dmg && ui.showHp)) continue;
      if (!inView(e, 60)) continue;
      let x, y, bw;
      if (e.kind === 'bld') { x = e.tx * T + 4; y = e.ty * T - 6; bw = e.w * T - 8; }
      else { const ex = e.px + (e.x - e.px) * alpha, ey = e.py + (e.y - e.py) * alpha - (e.air ? 22 : 0); bw = Math.max(16, e.def.size * 2); x = ex - bw / 2; y = ey - e.def.size - 8; }
      const f = Math.max(0, e.hp / maxHp(e));
      c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(x - 1, y - 1, bw + 2, 5);
      c.fillStyle = f > 0.6 ? '#76ff03' : f > 0.3 ? '#ffd600' : '#ff1744'; c.fillRect(x, y, bw * f, 3);
      if (e.def.harvester && s && e.carry !== undefined) { c.fillStyle = '#ffd54f'; c.fillRect(x, y + 4, bw * Math.min(1, (e.carry || 0) / HARV_CAP), 2); }
    }
    // Sammelpunkt
    if (sel.size === 1) { const e = w.ents.get([...sel][0]); if (e && e.kind === 'bld' && e.rally && e.owner === ui.pid) { c.strokeStyle = 'rgba(118,255,3,0.6)'; c.setLineDash([6, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.rally.x, e.rally.y); c.stroke(); c.setLineDash([]); c.fillStyle = '#76ff03'; c.beginPath(); c.arc(e.rally.x, e.rally.y, 5, 0, 7); c.fill(); } }
    // Reichweite gewählter Spezialgebäude
    for (const id of sel) { const e = w.ents.get(id); if (!e || !e.def.eff) continue; const ef = e.def.eff, r = (ef.bldShield || ef.repair || ef.dmgAura || {}).r; if (r) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([8, 6]); c.beginPath(); c.arc(e.x, e.y, r * T, 0, 7); c.stroke(); c.setLineDash([]); } if (e.def.weapon) { c.strokeStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(e.x, e.y, e.def.weapon.rng * T, 0, 7); c.stroke(); } }
    // Platzierung
    if (ui.placing && ui.ghost) {
      const d = DEFS[ui.placing.type], g = ui.ghost, ok = ui.ghostOk;
      if (ui.ghostTiles && ui.ghostTiles.length > 1) { c.globalAlpha = 0.55; for (const [x, y] of ui.ghostTiles.slice(1)) { drawWall(c, d, P[ui.pid].color, x * T, y * T, 0); c.fillStyle = 'rgba(118,255,3,0.25)'; c.fillRect(x * T, y * T, T, T); } c.globalAlpha = 1; }
      c.globalAlpha = 0.55; drawBld(c, d, P[ui.pid].color, g.tx * T, g.ty * T, now2, 0.5, 1, null); c.globalAlpha = 1;
      c.fillStyle = ok ? 'rgba(118,255,3,0.25)' : 'rgba(255,23,68,0.35)'; c.fillRect(g.tx * T, g.ty * T, d.w * T, d.h * T);
      c.strokeStyle = ok ? '#76ff03' : '#ff1744'; c.lineWidth = 2; c.strokeRect(g.tx * T, g.ty * T, d.w * T, d.h * T);
      if (d.weapon) { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc((g.tx + 0.5) * T, (g.ty + 0.5) * T, d.weapon.rng * T, 0, 7); c.stroke(); }
    }
    if (ui.swTarget && ui.mouseW) { const d = DEFS[ui.swTarget.type], r = (d.sw.r || 3) * T; c.strokeStyle = 'rgba(255,23,68,0.9)'; c.lineWidth = 2; c.setLineDash([10, 6]); c.beginPath(); c.arc(ui.mouseW.x, ui.mouseW.y, r, 0, 7); c.stroke(); c.setLineDash([]); c.beginPath(); c.moveTo(ui.mouseW.x - 12, ui.mouseW.y); c.lineTo(ui.mouseW.x + 12, ui.mouseW.y); c.moveTo(ui.mouseW.x, ui.mouseW.y - 12); c.lineTo(ui.mouseW.x, ui.mouseW.y + 12); c.stroke(); }
    // Auswahlrahmen
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ui.box) { const b = ui.box; c.strokeStyle = '#76ff03'; c.lineWidth = 1; c.fillStyle = 'rgba(118,255,3,0.08)'; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    if (ui.marker) { const mk = ui.marker, p = (now - mk.s) / 0.5; if (p < 1) { const sx = (mk.x - cam.x) * z, sy = (mk.y - cam.y) * z; c.strokeStyle = mk.col; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, 14 * (1 - p) + 3, 0, 7); c.stroke(); } }
  }
  drawMini(mc, cam, pid, vwW, vwH) {
    const c = mc.getContext('2d'), w = this.w, m = w.map, S = mc.width, sc = S / Math.max(m.w, m.h);
    c.fillStyle = '#000'; c.fillRect(0, 0, S, mc.height);
    const ox = (S - m.w * sc) / 2, oy = (mc.height - m.h * sc) / 2;
    c.imageSmoothingEnabled = false; c.drawImage(this.mini, ox, oy, m.w * sc, m.h * sc);
    for (let i = 0; i < m.w * m.h; i += 1) if (m.ra[i]) { c.fillStyle = RES[m.rt[i]].color; c.fillRect(ox + (i % m.w) * sc, oy + ((i / m.w) | 0) * sc, Math.max(1, sc), Math.max(1, sc)); }
    const fog = this.fog && this.fog.enabled ? this.fog : null;
    for (const e of w.ents.values()) {
      if (fog && !fog.canSee(e)) continue;
      c.fillStyle = w.players[e.owner].color;
      if (e.kind === 'bld') c.fillRect(ox + e.tx * sc, oy + e.ty * sc, Math.max(2, e.w * sc), Math.max(2, e.h * sc));
      else c.fillRect(ox + e.x / T * sc - 1, oy + e.y / T * sc - 1, 2, 2);
    }
    if (fog) { c.imageSmoothingEnabled = true; c.drawImage(fog.canvas(), ox, oy, m.w * sc, m.h * sc); }
    c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(ox + cam.x / T * sc, oy + cam.y / T * sc, vwW / T * sc, vwH / T * sc);
    return { ox, oy, sc };
  }
}
