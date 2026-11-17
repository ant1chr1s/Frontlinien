'use strict';
// ===================== Kartennebel (Darstellung beim jeweiligen Spieler) =====================
function sightOf(e) {
  const d = e.def;
  if (d.sight) return d.sight;
  if (d.role === 'wall' || d.role === 'gate') return 2.5;
  if (e.kind === 'bld') return d.role === 'bauhof' ? 10 : d.weapon ? d.weapon.rng + 1.5 : 6;
  return Math.max(5, (d.weapon ? d.weapon.rng : 3) + 2) + (d.cat === 'air' ? 2 : 0);
}
class Fog {
  constructor(map, pid, players, enabled) {
    this.map = map; this.w = map.w; this.h = map.h; this.pid = pid; this.players = players; this.enabled = enabled !== false;
    this.exp = new Uint8Array(this.w * this.h); this.vis = new Uint8Array(this.w * this.h);
    this.tex = new Uint8Array(this.w * this.h); this.reveals = []; this.t = -1; this.ver = 0; this.circles = {};
  }
  allied(o) { return isAllied(this.players[this.pid], this.players[o]); }
  circle(r) {
    const k = Math.round(r * 2); let c = this.circles[k]; if (c) return c; c = [];
    const R = k / 2; for (let y = -Math.ceil(R); y <= Math.ceil(R); y++) for (let x = -Math.ceil(R); x <= Math.ceil(R); x++) if (x * x + y * y <= R * R + 0.5) c.push(x, y);
    return (this.circles[k] = c);
  }
  stamp(cx, cy, r) {
    const c = this.circle(r), W = this.w, H = this.h, v = this.vis;
    for (let i = 0; i < c.length; i += 2) { const x = cx + c[i], y = cy + c[i + 1]; if (x >= 0 && y >= 0 && x < W && y < H) v[y * W + x] = 1; }
  }
  onEvent(ev, time) { if (ev.k === 'reveal' && this.allied(ev.p)) this.reveals.push({ x: ev.x, y: ev.y, r: ev.r / T, until: time + ev.t }); }
  update(world, force) {
    if (!this.enabled) return;
    const tm = world.time; if (!force && Math.abs(tm - this.t) < 0.2) return; this.t = tm;
    this.vis.fill(0);
    for (const e of world.ents.values()) {
      if (!this.allied(e.owner)) continue;
      const r = sightOf(e);
      if (e.kind === 'bld') this.stamp(e.tx + (e.w >> 1), e.ty + (e.h >> 1), r + e.w / 2);
      else this.stamp(Math.floor(e.x / T), Math.floor(e.y / T), r);
    }
    this.reveals = this.reveals.filter(r => r.until > tm);
    for (const r of this.reveals) this.stamp(Math.floor(r.x / T), Math.floor(r.y / T), r.r);
    const N = this.w * this.h, ex = this.exp, vi = this.vis, tx = this.tex;
    for (let i = 0; i < N; i++) { if (vi[i]) ex[i] = 1; tx[i] = vi[i] ? 255 : ex[i] ? 120 : 0; }
    this.ver++;
  }
  visTile(tx, ty) { return !this.enabled || (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.vis[ty * this.w + tx] === 1); }
  visAt(x, y) { return this.visTile(Math.floor(x / T), Math.floor(y / T)); }
  expAt(x, y) { if (!this.enabled) return true; const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.exp[ty * this.w + tx] === 1; }
  canSee(e) {
    if (!this.enabled || this.allied(e.owner)) return true;
    if (e.kind === 'bld') { for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) if (this.exp[y * this.w + x]) return true; return false; }
    return this.visAt(e.x, e.y);
  }
  revealAll() { this.enabled = false; }
  // Bild für 2D/Minimap
  canvas() {
    if (!this._cv) { this._cv = document.createElement('canvas'); this._cv.width = this.w; this._cv.height = this.h; this._img = this._cv.getContext('2d').createImageData(this.w, this.h); }
    if (this._cver !== this.ver) {
      this._cver = this.ver; const d = this._img.data;
      for (let i = 0; i < this.w * this.h; i++) { d[i * 4] = 0; d[i * 4 + 1] = 0; d[i * 4 + 2] = 0; d[i * 4 + 3] = this.tex[i] === 255 ? 0 : this.tex[i] ? 120 : 255; }
      this._cv.getContext('2d').putImageData(this._img, 0, 0);
    }
    return this._cv;
  }
}
