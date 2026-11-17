'use strict';
// ===================== Karten =====================
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function newMap(w, h) {
  return { w, h, ter: new Uint8Array(w * h).fill(TER.LOW), rt: new Uint8Array(w * h), ra: new Uint16Array(w * h), starts: [] };
}
function inMap(m, x, y) { return x >= 0 && y >= 0 && x < m.w && y < m.h; }
function setT(m, x, y, t) { if (inMap(m, x, y)) { m.ter[y * m.w + x] = t; if (t === TER.WATER || t === TER.MOUNT) { m.rt[y * m.w + x] = 0; m.ra[y * m.w + x] = 0; } } }
function circle(m, cx, cy, r, t, rng, rough) {
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
    const d = Math.hypot(x - cx, y - cy) + (rng && rough ? (rng() - 0.5) * rough : 0);
    if (d <= r) setT(m, x, y, t);
  }
}
function line(m, x0, y0, x1, y1, th, t, rng, rough) {
  const L = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= L; i += 0.5) {
    const x = x0 + (x1 - x0) * i / L, y = y0 + (y1 - y0) * i / L;
    circle(m, x, y, th / 2 + (rng && rough ? (rng() - 0.5) * rough : 0), t);
  }
}
function resField(m, cx, cy, r, type, rng, dens = 0.8) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (!inMap(m, x, y)) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d > r) continue;
    const i = y * m.w + x, t = m.ter[i];
    if (t !== TER.LOW && t !== TER.HILL) continue;
    if (rng() < dens * (1 - 0.4 * d / (r + 0.01))) { m.rt[i] = type; m.ra[i] = Math.round(RES[type].amt * (0.6 + 0.4 * (1 - d / (r + 1)))); }
  }
}
function clearStart(m, sx, sy, r = 7) {
  for (let y = sy - r; y <= sy + r; y++) for (let x = sx - r; x <= sx + r; x++) {
    if (!inMap(m, x, y)) continue;
    if (Math.hypot(x - sx, y - sy) <= r) { const i = y * m.w + x; m.ter[i] = TER.LOW; m.rt[i] = 0; m.ra[i] = 0; }
  }
}
// Startausstattung: Erzfeld + Kristallfeld nahe der Basis
function baseKit(m, sx, sy, rng) {
  const cx = m.w / 2, cy = m.h / 2;
  let a = Math.atan2(cy - sy, cx - sx);
  const ex = sx + Math.cos(a + 0.75) * 10, ey = sy + Math.sin(a + 0.75) * 10;
  const kx = sx + Math.cos(a - 0.85) * 12, ky = sy + Math.sin(a - 0.85) * 12;
  clearStart(m, Math.round(ex), Math.round(ey), 4);
  clearStart(m, Math.round(kx), Math.round(ky), 3);
  resField(m, ex, ey, 3.6, 1, rng, 0.95);
  resField(m, kx, ky, 2.4, 2, rng, 0.9);
}
function addStart(m, x, y) { m.starts.push({ x: Math.round(x), y: Math.round(y) }); }
function finishMap(m, rng) {
  for (const s of m.starts) clearStart(m, s.x, s.y, 7);
  for (const s of m.starts) baseKit(m, s.x, s.y, rng);
  for (const s of m.starts) { // Platz für den Bauhof freihalten
    for (let y = s.y - 3; y <= s.y + 3; y++) for (let x = s.x - 3; x <= s.x + 3; x++) if (inMap(m, x, y)) { const i = y * m.w + x; m.rt[i] = 0; m.ra[i] = 0; m.ter[i] = TER.LOW; }
  }
  ensureConnected(m);
  // Ränder: eine Reihe Berge als Begrenzung? nein, Karte ist offen.
  return m;
}
function groundOk(t) { return t === TER.LOW || t === TER.HILL || t === TER.SHALLOW; }
function floodFrom(m, sx, sy) {
  const seen = new Uint8Array(m.w * m.h), st = [sy * m.w + sx]; seen[st[0]] = 1;
  while (st.length) {
    const i = st.pop(), x = i % m.w, y = (i / m.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (!inMap(m, nx, ny)) continue;
      const j = ny * m.w + nx; if (seen[j] || !groundOk(m.ter[j])) continue; seen[j] = 1; st.push(j);
    }
  }
  return seen;
}
function ensureConnected(m) {
  const s0 = m.starts[0];
  for (let k = 0; k < 4; k++) {
    const seen = floodFrom(m, s0.x, s0.y);
    let ok = true;
    for (let i = 1; i < m.starts.length; i++) {
      const s = m.starts[i];
      if (!seen[s.y * m.w + s.x]) {
        ok = false;
        // Korridor graben: Wasser -> Furt, Berg -> Hügel
        const L = Math.hypot(s.x - s0.x, s.y - s0.y);
        for (let t = 0; t <= L; t += 0.5) {
          const x = s0.x + (s.x - s0.x) * t / L, y = s0.y + (s.y - s0.y) * t / L;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const xx = Math.round(x) + ox, yy = Math.round(y) + oy; if (!inMap(m, xx, yy)) continue;
            const j = yy * m.w + xx;
            if (m.ter[j] === TER.WATER) m.ter[j] = TER.SHALLOW; else if (m.ter[j] === TER.MOUNT) m.ter[j] = TER.HILL;
          }
        }
      }
    }
    if (ok) break;
  }
}
function scatter(m, rng, n, t, rmin, rmax, avoid) {
  for (let i = 0; i < n; i++) {
    const x = rng() * m.w, y = rng() * m.h;
    if (avoid && m.starts.some(s => Math.hypot(s.x - x, s.y - y) < avoid)) continue;
    circle(m, x, y, rmin + rng() * (rmax - rmin), t, rng, 1.2);
  }
}
// rotationssymmetrische Platzierung um die Kartenmitte
function sym(m, n, rot0, fn) {
  const cx = m.w / 2, cy = m.h / 2;
  for (let k = 0; k < n; k++) {
    const a0 = rot0 + k * Math.PI * 2 / n;
    fn((r, da) => [cx + Math.cos(a0 + (da || 0)) * r, cy + Math.sin(a0 + (da || 0)) * r], k);
  }
}

// ---------- 10 vorgefertigte Karten ----------
const MAPS = [
  { id: 'flussduell', name: 'Flussduell', players: 2, size: '64×64', desc: 'Ein Fluss trennt zwei Basen, zwei Furten führen hinüber.', build(rng) {
    const m = newMap(64, 64);
    line(m, 0, 32, 64, 32, 5, TER.WATER, rng, 1.5);
    for (const fx of [14, 50]) for (let x = fx - 2; x <= fx + 2; x++) for (let y = 27; y <= 37; y++) if (m.ter[y * 64 + x] === TER.WATER) m.ter[y * 64 + x] = TER.SHALLOW;
    for (const [x, y] of [[22, 20], [42, 44], [8, 46], [56, 18], [32, 22], [32, 42]]) circle(m, x, y, 2.5, TER.HILL, rng, 1);
    circle(m, 4, 4, 3, TER.MOUNT, rng, 1); circle(m, 60, 60, 3, TER.MOUNT, rng, 1);
    addStart(m, 32, 9); addStart(m, 32, 55);
    resField(m, 14, 24, 2.2, 3, rng); resField(m, 50, 40, 2.2, 3, rng);
    resField(m, 4, 24, 2.5, 2, rng); resField(m, 60, 40, 2.5, 2, rng);
    return finishMap(m, rng);
  } },
  { id: 'gebirgspass', name: 'Gebirgspass', players: 2, size: '84×60', desc: 'Ein Gebirgskamm mit drei engen Pässen.', build(rng) {
    const m = newMap(84, 60);
    line(m, 42, 0, 42, 60, 5, TER.MOUNT, rng, 2);
    for (const py of [10, 30, 50]) for (let y = py - 2; y <= py + 2; y++) for (let x = 38; x <= 46; x++) setT(m, x, y, TER.HILL);
    circle(m, 20, 6, 4, TER.WATER, rng, 1.5); circle(m, 64, 54, 4, TER.WATER, rng, 1.5);
    circle(m, 22, 50, 3, TER.MOUNT, rng, 1.5); circle(m, 62, 10, 3, TER.MOUNT, rng, 1.5);
    addStart(m, 10, 30); addStart(m, 74, 30);
    resField(m, 34, 30, 2, 3, rng); resField(m, 50, 30, 2, 3, rng);
    resField(m, 30, 12, 2.5, 2, rng); resField(m, 54, 48, 2.5, 2, rng);
    resField(m, 28, 48, 3, 1, rng); resField(m, 56, 12, 3, 1, rng);
    return finishMap(m, rng);
  } },
  { id: 'dreilaendereck', name: 'Dreiländereck', players: 3, size: '84×84', desc: 'Drei Reiche um einen zentralen See.', build(rng) {
    const m = newMap(84, 84);
    circle(m, 42, 42, 9, TER.WATER, rng, 2);
    sym(m, 3, -Math.PI / 2 + Math.PI / 3, (p) => { const [a, b] = p(16); const [c, d] = p(26); line(m, a, b, c, d, 3, TER.MOUNT, rng, 1); const [e, f] = p(31); const [g, h] = p(42); line(m, e, f, g, h, 3, TER.MOUNT, rng, 1); });
    sym(m, 3, -Math.PI / 2, (p) => { const [x, y] = p(33); addStart(m, x, y); const [rx, ry] = p(13, 0.5); resField(m, rx, ry, 2.2, 3, rng); const [hx, hy] = p(22, -0.4); circle(m, hx, hy, 2.5, TER.HILL, rng, 1); });
    return finishMap(m, rng);
  } },
  { id: 'viertaeler', name: 'Vier Täler', players: 4, size: '90×90', desc: 'Vier Täler, getrennt durch ein Bergkreuz mit Durchgängen.', build(rng) {
    const m = newMap(90, 90);
    line(m, 45, 4, 45, 86, 4, TER.MOUNT, rng, 1.5); line(m, 4, 45, 86, 45, 4, TER.MOUNT, rng, 1.5);
    for (const [x, y] of [[45, 22], [45, 68], [22, 45], [68, 45]]) circle(m, x, y, 3.2, TER.HILL);
    circle(m, 45, 45, 5, TER.HILL);
    resField(m, 45, 45, 3, 3, rng);
    addStart(m, 14, 14); addStart(m, 76, 14); addStart(m, 76, 76); addStart(m, 14, 76);
    for (const [x, y] of [[30, 30], [60, 30], [60, 60], [30, 60]]) { circle(m, x, y, 2.5, TER.HILL, rng, 1); resField(m, x + (x < 45 ? 4 : -4), y + (y < 45 ? -6 : 6), 2, 2, rng); }
    return finishMap(m, rng);
  } },
  { id: 'inselreich', name: 'Inselreich', players: 4, size: '100×100', desc: 'Inseln, verbunden durch flache Landbrücken.', build(rng) {
    const m = newMap(100, 100); m.ter.fill(TER.WATER);
    const isl = [[20, 20], [80, 20], [80, 80], [20, 80]];
    for (const [x, y] of isl) circle(m, x, y, 16, TER.LOW, rng, 3);
    circle(m, 50, 50, 11, TER.LOW, rng, 3); circle(m, 50, 50, 4, TER.HILL);
    for (const [x, y] of isl) line(m, x, y, 50, 50, 3, TER.SHALLOW);
    line(m, 20, 20, 80, 20, 3, TER.SHALLOW); line(m, 20, 80, 80, 80, 3, TER.SHALLOW);
    for (const [x, y] of isl) { circle(m, x, y, 13, TER.LOW); addStart(m, x, y); }
    resField(m, 50, 44, 2.5, 3, rng); resField(m, 50, 56, 2.5, 3, rng); resField(m, 44, 50, 2, 2, rng); resField(m, 56, 50, 2, 2, rng);
    return finishMap(m, rng);
  } },
  { id: 'kraterring', name: 'Kraterring', players: 5, size: '100×100', desc: 'Ein Krater voller Ätherit, umgeben von Bergen mit fünf Zugängen.', build(rng) {
    const m = newMap(100, 100);
    for (let a = 0; a < Math.PI * 2; a += 0.02) circle(m, 50 + Math.cos(a) * 17, 50 + Math.sin(a) * 17, 2, TER.MOUNT);
    sym(m, 5, -Math.PI / 2 + Math.PI / 5, (p) => { const [x, y] = p(17); circle(m, x, y, 3.2, TER.HILL); const [lx, ly] = p(36); circle(m, lx, ly, 3, TER.WATER, rng, 1.5); });
    resField(m, 50, 50, 6, 3, rng, 0.6); circle(m, 50, 50, 1.5, TER.HILL);
    sym(m, 5, -Math.PI / 2, (p) => { const [x, y] = p(39); addStart(m, x, y); const [hx, hy] = p(26, 0.3); circle(m, hx, hy, 2, TER.HILL); });
    return finishMap(m, rng);
  } },
  { id: 'steppe', name: 'Weite Steppe', players: 6, size: '110×110', desc: 'Offenes Gelände mit Hügeln und Tümpeln – ideal für Panzerschlachten.', build(rng) {
    const m = newMap(110, 110);
    scatter(m, rng, 26, TER.HILL, 2, 4.5, 9); scatter(m, rng, 8, TER.WATER, 1.5, 3, 12); scatter(m, rng, 7, TER.MOUNT, 1.2, 2.4, 12);
    sym(m, 6, -Math.PI / 2, (p) => { const [x, y] = p(43); addStart(m, x, y); const [rx, ry] = p(22, Math.PI / 6); resField(m, rx, ry, 2.2, 3, rng); const [kx, ky] = p(34, Math.PI / 6); resField(m, kx, ky, 2.5, 2, rng); });
    resField(m, 55, 55, 3, 3, rng);
    return finishMap(m, rng);
  } },
  { id: 'seenplatte', name: 'Seenplatte', players: 8, size: '124×124', desc: 'Acht Basen zwischen unzähligen Seen.', build(rng) {
    const m = newMap(124, 124);
    sym(m, 8, -Math.PI / 2 + Math.PI / 8, (p) => { const [x, y] = p(48); circle(m, x, y, 5, TER.WATER, rng, 2); const [a, b] = p(30); circle(m, a, b, 4, TER.WATER, rng, 2); const [c, d] = p(18); circle(m, c, d, 2.4, TER.MOUNT, rng, 1); });
    circle(m, 62, 62, 6, TER.HILL, rng, 1.5);
    sym(m, 8, -Math.PI / 2, (p) => { const [x, y] = p(52); addStart(m, x, y); const [rx, ry] = p(30, 0.2); resField(m, rx, ry, 2, 3, rng); });
    resField(m, 62, 62, 3.5, 3, rng);
    return finishMap(m, rng);
  } },
  { id: 'kontinente', name: 'Zwei Kontinente', players: 8, size: '128×128', desc: 'Zwei Kontinente, getrennt durch einen breiten Strom mit drei Furten. Ideal für 4 gegen 4.', build(rng) {
    const m = newMap(128, 128);
    line(m, 64, 0, 64, 128, 9, TER.WATER, rng, 2);
    for (const fy of [22, 64, 106]) for (let y = fy - 3; y <= fy + 3; y++) for (let x = 54; x <= 74; x++) if (m.ter[y * 128 + x] === TER.WATER) m.ter[y * 128 + x] = TER.SHALLOW;
    scatter(m, rng, 16, TER.HILL, 2, 4, 10); scatter(m, rng, 8, TER.MOUNT, 1.5, 3, 12);
    for (const y of [16, 48, 80, 112]) { addStart(m, 14, y); addStart(m, 114, y); }
    for (const fy of [22, 64, 106]) { resField(m, 52, fy, 2, 3, rng); resField(m, 76, fy, 2, 3, rng); }
    return finishMap(m, rng);
  } },
  { id: 'weltenbrand', name: 'Weltenbrand', players: 10, size: '150×150', desc: 'Die riesige Schlacht für bis zu zehn Kommandanten.', build(rng) {
    const m = newMap(150, 150);
    for (let a = 0; a < Math.PI * 2; a += 0.02) if (Math.sin(a * 5) < 0.6) circle(m, 75 + Math.cos(a) * 22, 75 + Math.sin(a) * 22, 1.8, TER.MOUNT);
    resField(m, 75, 75, 7, 3, rng, 0.5); circle(m, 75, 75, 2, TER.HILL);
    sym(m, 10, -Math.PI / 2 + Math.PI / 10, (p) => { const [x, y] = p(60); circle(m, x, y, 3.5, TER.WATER, rng, 2); const [a, b] = p(40); circle(m, a, b, 3, TER.HILL, rng, 1); const [c, d] = p(68); circle(m, c, d, 2.5, TER.MOUNT, rng, 1); });
    sym(m, 10, -Math.PI / 2, (p) => { const [x, y] = p(62); addStart(m, x, y); const [rx, ry] = p(36, 0.15); resField(m, rx, ry, 2, 3, rng); });
    return finishMap(m, rng);
  } },
];

// ---------- Zufallskarte ----------
function valueNoise(w, h, rng, scale) {
  const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2, g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    out[y * w + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  return out;
}
const RANDOM_SIZES = { 2: 70, 3: 80, 4: 90, 5: 98, 6: 106, 7: 114, 8: 122, 9: 134, 10: 146 };
function randomMap(opt, rng) {
  const P = opt.players, S = RANDOM_SIZES[P] || 100;
  const m = newMap(S, S);
  const n1 = valueNoise(S, S, rng, 16), n2 = valueNoise(S, S, rng, 7), n3 = valueNoise(S, S, rng, 3);
  const wl = [0.2, 0.3, 0.4][opt.water], ml = [0.85, 0.78, 0.71][opt.mount];
  for (let i = 0; i < S * S; i++) {
    const h = n1[i] * 0.6 + n2[i] * 0.3 + n3[i] * 0.1;
    m.ter[i] = h < wl ? TER.WATER : h > ml ? TER.MOUNT : h > ml - 0.09 ? TER.HILL : TER.LOW;
  }
  const rot = rng() * Math.PI * 2, R = S * 0.39;
  sym(m, P, rot, (p) => { const [x, y] = p(R); addStart(m, x, y); });
  // Ätherit in der Mitte & zwischen Spielern
  resField(m, S / 2, S / 2, 3, 3, rng);
  sym(m, P, rot + Math.PI / P, (p) => { const [x, y] = p(R * 0.55); clearStart(m, Math.round(x), Math.round(y), 2); resField(m, x, y, 2, rng() < 0.5 ? 3 : 2, rng); });
  for (let i = 0; i < P * 2; i++) { const x = rng() * S, y = rng() * S; if (m.starts.some(s => Math.hypot(s.x - x, s.y - y) < 12)) continue; resField(m, x, y, 2 + rng() * 1.5, 1 + ((rng() * 2) | 0), rng, 0.7); }
  return finishMap(m, rng);
}

function buildMap(spec) {
  const rng = mulberry32(spec.seed >>> 0);
  let m;
  if (spec.id === 'random') { m = randomMap(spec, rng); m.name = 'Zufallskarte #' + spec.seed; }
  else { const d = MAPS.find(x => x.id === spec.id) || MAPS[0]; m = d.build(rng); m.name = d.name; }
  return m;
}
function mapMaxPlayers(spec) { return spec.id === 'random' ? spec.players : (MAPS.find(x => x.id === spec.id) || MAPS[0]).players; }
