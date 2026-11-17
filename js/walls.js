'use strict';
// ===================== Mauern, Tore, Türme in der Mauer =====================
// Gemeinsame Platzierungslogik für Spiel-Engine und Netzwerk-Spiegel (Mirror)
function wallOcc(world) {
  const W = world.map.w, m = new Map();
  for (const e of world.ents.values()) if (e.kind === 'bld') for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) m.set(y * W + x, e);
  return m;
}
function wallTileFree(world, occ, x, y) {
  const m = world.map; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  const i = y * m.w + x, t = m.ter[i]; if ((t !== TER.LOW && t !== TER.HILL) || occ.has(i)) return false;
  for (const e of world.ents.values()) if (e.kind === 'unit' && !e.air && e.x > x * T - 4 && e.x < (x + 1) * T + 4 && e.y > y * T - 4 && e.y < (y + 1) * T + 4) return false;
  return true;
}
function wallNear(world, pid, tx, ty) {
  for (const b of world.ents.values()) {
    if (b.kind !== 'bld' || b.owner !== pid) continue;
    const gx = Math.max(0, b.tx - (tx + 1), tx - (b.tx + b.w)), gy = Math.max(0, b.ty - (ty + 1), ty - (b.ty + b.h));
    if (Math.max(gx, gy) <= 5) return true;
  }
  return false;
}
// Liefert null, wenn die normale Platzierung gilt, sonst { ok, tiles, rep, inWall, why }
function wallPlan(world, pid, d, tx, ty) {
  const role = d.role; if (role !== 'wall' && role !== 'gate' && role !== 'tower') return null;
  const occ = wallOcc(world), W = world.map.w;
  const here = occ.get(ty * W + tx);
  const ownWall = here && here.owner === pid && here.def.role === 'wall';
  if (role === 'gate') return ownWall ? { ok: true, tiles: [[tx, ty]], rep: [here] } : { ok: false, why: 'Tore können nur in eine eigene Mauer gebaut werden.' };
  if (role === 'tower') return ownWall ? { ok: true, tiles: [[tx, ty]], rep: [here], inWall: true } : null;
  // Mauer
  if (!wallTileFree(world, occ, tx, ty) || !wallNear(world, pid, tx, ty)) return { ok: false, why: 'Hier kann keine Mauer gebaut werden – freies Land nahe der eigenen Basis.' };
  const tiles = [[tx, ty]];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const seg = [];
    for (let k = 1; k <= WALL_TILE; k++) {
      const x = tx + dx * k, y = ty + dy * k;
      if (x < 0 || y < 0 || x >= W || y >= world.map.h) break;
      const o = occ.get(y * W + x);
      if (o) { if (o.owner === pid && isWallish(o) && k >= 2) tiles.push(...seg); break; }
      if (!wallTileFree(world, occ, x, y)) break;
      seg.push([x, y]);
    }
  }
  return { ok: true, tiles, rep: [] };
}
// Verbindungsmaske (N=1, O=2, S=4, W=8) für Darstellung
function wallMaskOf(world, occ, e) {
  const W = world.map.w; let m = 0;
  [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, bit]) => { const o = occ.get((e.ty + dy) * W + e.tx + dx); if (o && o.owner === e.owner && isWallish(o)) m |= bit; });
  return m;
}
