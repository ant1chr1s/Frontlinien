'use strict';
// ===================== 3D-Grafik (Three.js) =====================
const CAM_ANG = 38 * Math.PI / 180, CSIN = Math.sin(CAM_ANG), CCOS = Math.cos(CAM_ANG);
const AIR_H = 64;
const TER_H3 = [-16, 0, 26, 78, -6];
// Kartennebel für alle Materialien (über Weltposition)
const FOG_U = { fogTexR: { value: null }, uFogMap: { value: null }, uCamW: { value: null } };
function injectFog(sh) {
  if (!FOG_U.uFogMap.value) return;
  if (!sh.vertexShader.includes('#include <project_vertex>') || !sh.fragmentShader.includes('#include <dithering_fragment>')) return;
  sh.uniforms.fogTexR = FOG_U.fogTexR; sh.uniforms.uFogMap = FOG_U.uFogMap; sh.uniforms.uCamW = FOG_U.uCamW;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFW;\nuniform mat4 uCamW;').replace('#include <project_vertex>', '#include <project_vertex>\nvFW = (uCamW * mvPosition).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFW;\nuniform sampler2D fogTexR;\nuniform vec4 uFogMap;')
    .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (uFogMap.z > 0.5) { float fv = texture2D(fogTexR, vec2(vFW.x * uFogMap.x, vFW.z * uFogMap.y)).r; gl_FragColor.rgb *= fv < 0.47 ? fv * 1.15 : 0.55 + (fv - 0.47) * 0.85; }');
}
function webglOk() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))) && typeof THREE !== 'undefined'; } catch (e) { return false; } }

// ---------- 3D-Effekte ----------
class FX3D {
  constructor(r) { this.r = r; this.list = []; this.texts = []; this.over = []; this.pool = {}; }
  get(kind) {
    const p = this.pool[kind] || (this.pool[kind] = []);
    let m = p.pop();
    if (!m) {
      const g = kind === 'sph' ? geo('fxs', () => new THREE.IcosahedronGeometry(1, 1)) : kind === 'cyl' ? geo('fxc', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); g.translate(0, 0.5, 0); return g; }) : geo('fxr', () => new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2));
      m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.userData.kind = kind; this.r.scene.add(m);
    }
    m.visible = true; m.material.blending = THREE.NormalBlending; m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    return m;
  }
  free(m) { m.visible = false; this.pool[m.userData.kind].push(m); }
  addFx(o) { this.list.push(o); if (this.list.length > 900) { const x = this.list.shift(); (x.meshes || []).forEach(m => this.free(m)); } }
  add(ev, now, localPid) {
    const r = this.r, H = (x, y) => r.heightAt(x, y), fg = r.fog && r.fog.enabled ? r.fog : null;
    if (fg) {
      if (ev.k === 's' && !fg.visAt(ev.a[0], ev.a[1]) && !fg.visAt(ev.a[2], ev.a[3])) return;
      if ((ev.k === 'b' || ev.k === 'd' || ev.k === 'place' || ev.k === 'capture') && !fg.visAt(ev.x, ev.y)) return;
    }
    switch (ev.k) {
      case 's': {
        const [x1, y1, x2, y2] = ev.a, w = WCLS[ev.c];
        const h1 = H(x1, y1) + (ev.sa ? AIR_H : (ev.big ? 26 : 10)), h2 = H(x2, y2) + (ev.ta ? AIR_H : 6);
        const col = new THREE.Color(w.col);
        this.r.muzzle(x1, h1, y1, w.fx, ev.big, col);
        if (w.fx === 'beam') { const m = this.get('cyl'); m.material.color.copy(col); m.material.blending = THREE.AdditiveBlending; this.orient(m, x1, h1, y1, x2, h2, y2, ev.big ? 1.8 : 0.75); this.addFx({ t: 'beam', meshes: [m], s: now, d: 0.16 }); }
        else if (w.fx === 'flame') { const ms = [0, 1, 2].map(() => { const m = this.get('sph'); m.material.color.setHex(0xff7a1a); m.material.blending = THREE.AdditiveBlending; return m; }); this.addFx({ t: 'flame', meshes: ms, s: now, d: 0.4, a: [x1, h1, y1, x2, h2, y2] }); }
        else { const m = this.get('sph'); m.material.color.copy(col); m.material.blending = THREE.AdditiveBlending; const sz = w.fx === 'bullet' ? 1.3 : w.fx === 'arc' || w.fx === 'bomb' ? 3.6 : ev.big ? 4 : 2.4; m.scale.setScalar(sz); this.addFx({ t: 'proj', meshes: [m], s: now, d: Math.max(0.06, ev.t), a: [x1, h1, y1, x2, h2, y2], arc: w.fx === 'arc' ? 90 : w.fx === 'bomb' ? 6 : 0, trail: w.fx === 'rocket' || w.fx === 'arc' ? (ev.c === 'arty' && ev.big ? 2 : 1) : 0 }); }
        break;
      }
      case 'b': this.boom(ev.x, ev.y, Math.max(10, ev.r), now, ev.c === 'ion' ? 0x80d8ff : 0xffa040, 0.5, ev.c === 'ion' ? 1.4 : 1); this.r.burst(ev.x, ev.y, H(ev.x, ev.y), Math.max(8, Math.min(60, ev.r)), ev.r > 60); break;
      case 'd': { const h = ev.a ? AIR_H : 0; if (!ev.a) this.r.addScorch(ev.x, ev.y, Math.max(10, ev.r * (ev.b ? 1.3 : 0.9))); this.r.burst(ev.x, ev.y, H(ev.x, ev.y) + h, Math.max(12, Math.min(50, ev.r)), ev.b ? 2 : 1); this.boom(ev.x, ev.y, Math.max(14, ev.r * 1.2), now, 0xff8a30, ev.b ? 1.2 : 0.7, 1, h); if (ev.b) for (let i = 0; i < 6; i++) this.boom(ev.x + (Math.random() - 0.5) * ev.r * 1.6, ev.y + (Math.random() - 0.5) * ev.r * 1.6, 14 + Math.random() * 16, now + Math.random() * 0.6, 0xffb040, 0.6, 1); break; }
      case 'nukeL': { const m = this.get('sph'); m.material.color.setHex(0xeeeeee); m.scale.set(5, 5, 5); this.addFx({ t: 'proj', meshes: [m], s: now, d: ev.t, a: [ev.sx, H(ev.sx, ev.sy) + 20, ev.sy, ev.x, H(ev.x, ev.y), ev.y], arc: 700 }); this.over.push({ t: 'target', x: ev.x, y: ev.y, r: 5.5 * T, s: now, d: ev.t, col: '#ff1744' }); break; }
      case 'nuke': { this.r.addScorch(ev.x, ev.y, ev.r * 0.9); for (let i = 0; i < 6; i++) this.r.burst(ev.x + (Math.random() - 0.5) * ev.r, ev.y + (Math.random() - 0.5) * ev.r, H(ev.x, ev.y), 60, 2); this.boom(ev.x, ev.y, ev.r * 0.9, now, 0xfff0b0, 3.5, 1); this.ring(ev.x, ev.y, ev.r * 1.5, now, 0xffd7a0, 2.5); const m = this.get('sph'); m.material.color.setHex(0xff6a00); m.material.blending = THREE.AdditiveBlending; this.addFx({ t: 'mush', meshes: [m], s: now, d: 4, x: ev.x, y: ev.y, r: ev.r }); this.over.push({ t: 'flash', s: now, d: 0.6 }); break; }
      case 'ion': { const m = this.get('cyl'); m.material.color.setHex(0xb3e5fc); m.material.blending = THREE.AdditiveBlending; m.position.set(ev.x, H(ev.x, ev.y), ev.y); this.addFx({ t: 'ion', meshes: [m], s: now, d: 2.4 }); this.ring(ev.x, ev.y, ev.r, now, 0x80d8ff, 2.4, true); break; }
      case 'storm': { const m = this.get('cyl'); m.material.color.setHex(0xb050ff); m.position.set(ev.x, H(ev.x, ev.y) - 5, ev.y); m.scale.set(ev.r, 90, ev.r); this.addFx({ t: 'storm', meshes: [m], s: now, d: ev.t }); this.over.push({ t: 'storm', x: ev.x, y: ev.y, r: ev.r, s: now, d: ev.t }); break; }
      case 'emp': this.ring(ev.x, ev.y, ev.r, now, 0x40c4ff, 1.2); break;
      case 'shield': this.ring(ev.x, ev.y, ev.r, now, 0xffd700, 1.0); break;
      case 'drop': this.over.push({ t: 'plane', x: ev.x, y: ev.y, s: now, d: 3 }); break;
      case 'place': this.ring(ev.x, ev.y, ev.w * T * 0.8, now, 0xd7ccc8, 0.6); break;
      case 'cash': if (ev.p === localPid) this.texts.push({ x: ev.x, y: ev.y, txt: '+' + ev.v, s: now, d: 1.5, col: '#ffd54f' }); break;
      case 'sell': if (ev.p === localPid) this.texts.push({ x: ev.x, y: ev.y, txt: '+' + ev.v, s: now, d: 1.5, col: '#69f0ae' }); this.ring(ev.x, ev.y, 40, now, 0xd7ccc8, 0.6); break;
    }
  }
  orient(m, x1, y1, z1, x2, y2, z2, rad) {
    const v = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1), L = v.length() || 1;
    m.position.set(x1, y1, z1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); m.scale.set(rad, L, rad);
  }
  boom(x, y, r, now, col, d, mul, h = 0) {
    const m = this.get('sph'); m.material.color.setHex(col); m.material.blending = THREE.AdditiveBlending; m.visible = false;
    const sm = this.get('sph'); sm.material.color.setHex(0x333333); sm.visible = false;
    this.addFx({ t: 'boom', meshes: [m, sm], s: now, d: d * (mul || 1), x, y, r, h: this.r.heightAt(x, y) + h + 4 });
  }
  ring(x, y, r, now, col, d, pulse) { const m = this.get('ring'); m.material.color.setHex(col); m.material.blending = THREE.AdditiveBlending; m.position.set(x, this.r.heightAt(x, y) + 3, y); this.addFx({ t: 'ring', meshes: [m], s: now, d, r, pulse }); }
  update(now) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const f = L[i], p = (now - f.s) / f.d;
      if (p > 1) { f.meshes.forEach(m => this.free(m)); L.splice(i, 1); continue; }
      if (p < 0) continue;
      const m = f.meshes[0];
      switch (f.t) {
        case 'beam': m.material.opacity = 1 - p; break;
        case 'proj': { const a = f.a; m.position.set(a[0] + (a[3] - a[0]) * p, a[1] + (a[4] - a[1]) * p + Math.sin(p * Math.PI) * f.arc, a[2] + (a[5] - a[2]) * p); m.material.opacity = 1; if (f.trail && Math.random() < 0.85) this.r.trail(m.position.x, m.position.y, m.position.z, f.trail === 2); break; }
        case 'flame': f.meshes.forEach((mm, j) => { const q = Math.min(1, p + j * 0.15), a = f.a; mm.position.set(a[0] + (a[3] - a[0]) * q, a[1] + (a[4] - a[1]) * q + q * 4, a[2] + (a[5] - a[2]) * q); mm.scale.setScalar(2 + q * 6); mm.material.opacity = 0.75 * (1 - q); }); break;
        case 'boom': { const r = f.r * (0.35 + p * 0.75); m.visible = true; m.position.set(f.x, f.h, f.y); m.scale.setScalar(r); m.material.opacity = 0.9 * (1 - p); m.material.color.setRGB(1, 0.85 - p * 0.6, 0.35 - p * 0.35); const sm = f.meshes[1]; sm.visible = true; sm.position.set(f.x + 3, f.h + p * 30, f.y); sm.scale.setScalar(r * 0.75); sm.material.opacity = 0.45 * (1 - p); break; }
        case 'ring': { const s = f.r * (f.pulse ? (1 - p * 0.5) : (0.3 + 0.7 * p)); m.scale.set(s, 1, s); m.material.opacity = 1 - p; break; }
        case 'ion': { const a = p < 0.65 ? p / 0.65 : 1 - (p - 0.65) / 0.35; m.scale.set(16 * a + 0.1, 2500, 16 * a + 0.1); m.material.opacity = 0.85 * a; break; }
        case 'storm': { m.material.opacity = 0.22 * Math.min(1, p * 8, (1 - p) * 8); m.rotation.y = now; break; }
        case 'mush': { m.position.set(f.x, this.r.heightAt(f.x, f.y) + 20 + p * 120, f.y); m.scale.set(f.r * 0.45 * (0.5 + p), f.r * 0.3 * (0.5 + p), f.r * 0.45 * (0.5 + p)); m.material.opacity = 0.9 * (1 - p); m.material.color.setRGB(1, 0.5 - p * 0.3, 0.1); break; }
      }
    }
  }
}

// ---------- Haupt-Renderer 3D ----------
class Renderer3D {
  constructor(glCanvas, ovCanvas) {
    this.glc = glCanvas; this.ov = ovCanvas; this.c = ovCanvas.getContext('2d');
    this.three = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    FOG_U.uFogMap.value = new THREE.Vector4(1, 1, 0, 0); FOG_U.uCamW.value = new THREE.Matrix4();
    { const d = new Uint8Array(4).fill(255); FOG_U.fogTexR.value = new THREE.DataTexture(d, 1, 1); FOG_U.fogTexR.value.needsUpdate = true; }
    THREE.Material.prototype.onBeforeCompile = function (sh) { injectFog(sh); };
    this.three.toneMapping = THREE.ACESFilmicToneMapping; this.three.toneMappingExposure = 1.0;
    this.isGL2 = this.three.capabilities.isWebGL2;
    this.atlas = makeAtlas(); this.detail = makeDetail();
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0b0f0b);
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, 1, 9000);
    this.amb = new THREE.HemisphereLight(0xdde8ff, 0x4a3f2c, 1.05); this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight(0xffefd2, 3.4); this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.sunDir = new THREE.Vector3(-0.55, 1, 0.35).normalize();
    this.matLit = atlasMaterial(this.atlas, this.isGL2);
    this.matDeco = atlasMaterial(this.atlas, this.isGL2);
    this.matGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.matGhost = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false });
    this.noAnim = () => this.setAnim(0, 0);
    this.fx = new FX3D(this);
    const mob = IS_TOUCH;
    this.pSmoke = new Particles(this.scene, mob ? 1400 : 3200, false, true);
    this.pFire = new Particles(this.scene, mob ? 1000 : 2400, true, true);
    this.pDebris = new Particles(this.scene, mob ? 400 : 900, false, false);
    this.halo = new Halos(this.scene, mob ? 1500 : 3000);
    this.lastNow = 0;
    this.r2 = new Renderer(document.createElement('canvas'));
    this.setShadows(lsGet('shadows', IS_TOUCH ? '0' : '1') === '1');
    this.models = new Map(); this.objs = new Map(); this.root = null; this.dying = [];
    this.assets = new AssetLib();
    this.assets.load('assets/models/', (p) => { this.assetProgress = p; }).then(ok => { if (!ok) return; this.icons = new Map(); this.rebuild = true; this.onAssets && this.onAssets(); });
  }
  setShadows(on) {
    this.shadows = on; this.three.shadowMap.enabled = on; this.three.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = on; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 1.5;
    this.matLit.needsUpdate = true; this.matDeco.needsUpdate = true; if (this.terrain) this.terrain.material.needsUpdate = true;
  }
  // Höhenfeld (Kachelecken)
  buildHeights(m) {
    const W = m.w + 1, Hh = m.h + 1, hg = new Float32Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0, mount = 0;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const tx = Math.max(0, Math.min(m.w - 1, x + dx)), ty = Math.max(0, Math.min(m.h - 1, y + dy)); const t = m.ter[ty * m.w + tx]; s += TER_H3[t]; n++; if (t === TER.MOUNT) mount++; }
      let h = s / n; if (mount === 4) h += 10 + hash2(x, y) * 60; else if (mount === 0) h += (hash2(x * 3, y * 7) - 0.5) * 1.5;
      hg[y * W + x] = h;
    }
    this.hg = hg; this.hw = W; this.hh = Hh;
  }
  heightAt(px, py) {
    if (!this.hg) return 0;
    const gx = Math.max(0, Math.min(this.hw - 1.001, px / T)), gy = Math.max(0, Math.min(this.hh - 1.001, py / T));
    const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0, W = this.hw, g = this.hg;
    const a = g[y0 * W + x0], b = g[y0 * W + x0 + 1], c = g[(y0 + 1) * W + x0], d = g[(y0 + 1) * W + x0 + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  groundY(e) { const h = (e.kind === 'unit' && e.air ? AIR_H : 6) + this.heightAt(e.x, e.y); return e.y - h * CCOS / CSIN; }
  setWorld(w) {
    this.w = w; this.r2.setWorld(w);
    if (this.root) { this.scene.remove(this.root); this.root.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); if (o.material && o.userData.own) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.objs = new Map(); this.models = new Map();
    for (const kind in this.fx.pool) this.fx.pool[kind].forEach(m => { m.visible = false; });
    this.fx.list.forEach(f => f.meshes.forEach(m => this.fx.free(m))); this.fx.list = []; this.fx.over = []; this.fx.texts = [];
    const m = w.map; this.buildHeights(m);
    this.fogData = new Uint8Array(m.w * m.h * 4); this.fogVer = -1;
    const ft = new THREE.DataTexture(this.fogData, m.w, m.h, THREE.RGBAFormat); ft.magFilter = THREE.LinearFilter; ft.minFilter = THREE.LinearFilter; ft.needsUpdate = true;
    if (FOG_U.fogTexR.value) FOG_U.fogTexR.value.dispose(); FOG_U.fogTexR.value = ft;
    FOG_U.uFogMap.value.set(1 / (m.w * T), 1 / (m.h * T), 0, 0);
    // Gelände-Textur aus dem 2D-Generator, mit Rand (B Kacheln) rundherum
    const B = 16, EW = m.w + 2 * B, EH = m.h + 2 * B;
    const tc = this.r2.terrain, ppt = Math.max(4, Math.min(16, Math.floor(2600 / Math.max(EW, EH))));
    const cv = document.createElement('canvas'); cv.width = EW * ppt; cv.height = EH * ppt; const cx = cv.getContext('2d');
    cx.fillStyle = '#466a2c'; cx.fillRect(0, 0, cv.width, cv.height);
    { const r = mulberry32(5); for (let i = 0; i < EW * EH * 0.6; i++) { const v = 0.85 + r() * 0.3; cx.fillStyle = `rgba(${70 * v | 0},${108 * v | 0},${44 * v | 0},0.7)`; cx.fillRect(r() * cv.width, r() * cv.height, ppt * 2, ppt * 2); } }
    const CS = tc.CH * ppt;
    for (let y = 0; y < Math.ceil(m.h / tc.CH); y++) for (let x = 0; x < Math.ceil(m.w / tc.CH); x++) cx.drawImage(tc.get(x, y), B * ppt + x * CS, B * ppt + y * CS, CS, CS);
    tc.chunks.clear();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true;
    const W = EW + 1, Hh = EH + 1, pos = new Float32Array(W * Hh * 3), uv = new Float32Array(W * Hh * 2), idx = [];
    const sn = (x, y) => Math.sin(x * 0.21 + Math.sin(y * 0.13) * 2) * 0.5 + Math.sin(y * 0.17 + x * 0.05) * 0.5;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, gx = x - B, gy = y - B;
      const dx = Math.max(0, -gx, gx - m.w), dy = Math.max(0, -gy, gy - m.h), dd = Math.max(dx, dy);
      const ix = Math.max(0, Math.min(m.w, gx)), iy = Math.max(0, Math.min(m.h, gy));
      let h = this.hg[iy * this.hw + ix];
      if (dd > 0) { const t = Math.min(1, dd / 5), mt = 6 + dd * 5 + (sn(gx, gy) + 1) * 22 + hash2(gx + 999, gy + 999) * 10; h = Math.max(h, 0) * (1 - t) + mt * t; }
      pos[i * 3] = gx * T; pos[i * 3 + 1] = h; pos[i * 3 + 2] = gy * T; uv[i * 2] = x / EW; uv[i * 2 + 1] = 1 - y / EH;
    }
    for (let y = 0; y < Hh - 1; y++) for (let x = 0; x < W - 1; x++) { const a = y * W + x, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    this.terrain = new THREE.Mesh(g, terrainMaterial(tex, this.detail)); this.terrain.receiveShadow = true; this.terrain.userData.own = true; this.root.add(this.terrain);
    this.border = { B, W, pos };
    // Wasser
    const wg = new THREE.PlaneGeometry(m.w * T, m.h * T).rotateX(-Math.PI / 2);
    if (!this.waterNormal) this.waterNormal = this.makeWaterNormal();
    this.water = new THREE.Mesh(wg, new THREE.MeshPhongMaterial({ color: 0x1f5f8f, transparent: true, opacity: 0.62, shininess: 120, specular: 0xaaddff, normalMap: this.waterNormal, normalScale: new THREE.Vector2(0.6, 0.6) }));
    this.waterNormal.repeat.set(m.w / 6, m.h / 6);
    this.water.position.set(m.w * T / 2, -3, m.h * T / 2); this.water.userData.own = true; this.root.add(this.water);
    // Ressourcen
    this.resTiles = []; for (let i = 0; i < m.w * m.h; i++) if (m.ra[i] > 0) this.resTiles.push(i);
    this.resMesh = {};
    const rg = { 1: new THREE.DodecahedronGeometry(1, 0), 2: new THREE.OctahedronGeometry(1, 0), 3: new THREE.OctahedronGeometry(1, 0) };
    const rm = { 1: new THREE.MeshLambertMaterial({ color: 0xd4a62a }), 2: new THREE.MeshLambertMaterial({ color: 0x4fc3f7, emissive: 0x0d3f5a }), 3: new THREE.MeshLambertMaterial({ color: 0xc070ff, emissive: 0x5a1d8a }) };
    for (const t of [1, 2, 3]) { const n = this.resTiles.filter(i => m.rt[i] === t).length * 3 + 1; const im = new THREE.InstancedMesh(rg[t], rm[t], n); im.userData.own = true; im.castShadow = true; im.frustumCulled = false; this.root.add(im); this.resMesh[t] = im; }
    this.resKey = -1; this.updRes(true);
    // Schattenkreise (instanziert)
    this.blobs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }), 2500);
    this.blobs.frustumCulled = false; this.blobs.userData.own = true; this.root.add(this.blobs);
    this.scorch = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x14100c, transparent: true, opacity: 0.55, depthWrite: false }), 160);
    this.scorch.count = 0; this.scorch.frustumCulled = false; this.scorch.userData.own = true; this.root.add(this.scorch); this.scorchN = 0;
    this.tracks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a2418, transparent: true, opacity: 0.26, depthWrite: false }), 2400);
    this.tracks.count = 0; this.tracks.frustumCulled = false; this.tracks.userData.own = true; this.root.add(this.tracks); this.trackN = 0;
    for (const p of [this.pSmoke, this.pFire, this.pDebris]) p.clear();
    this.buildDeco();
    this.ghost = null;
  }
  updRes(force) {
    const m = this.w.map; let key = 0; for (const i of this.resTiles) key += m.ra[i] * (i % 7 + 1);
    if (!force && key === this.resKey) return; this.resKey = key;
    const cnt = { 1: 0, 2: 0, 3: 0 }, M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const i of this.resTiles) {
      const a = m.ra[i]; if (!a) continue; const t = m.rt[i]; if (!t) continue;
      const x = i % m.w, y = (i / m.w) | 0, f = Math.min(1, a / RES[t].amt), n = f > 0.66 ? 3 : f > 0.33 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const hx = (x + 0.2 + hash2(x * 5 + j, y) * 0.6) * T, hy = (y + 0.2 + hash2(x, y * 5 + j) * 0.6) * T, s = (t === 1 ? 4 : 3) + f * 3 + hash2(x + j, y + j) * 1.5;
        e.set(t === 1 ? hash2(j, x) * 3 : (hash2(x, j) - 0.5) * 0.5, hash2(y, j) * 6, t === 1 ? hash2(y, x) * 3 : (hash2(j, y) - 0.5) * 0.5); q.setFromEuler(e);
        sc.set(s, t === 1 ? s * 0.7 : s * (t === 3 ? 1.8 : 1.5), s);
        v.set(hx, this.heightAt(hx, hy) + sc.y * 0.4, hy);
        M.compose(v, q, sc); this.resMesh[t].setMatrixAt(cnt[t]++, M);
      }
    }
    for (const t of [1, 2, 3]) { const im = this.resMesh[t]; im.count = cnt[t]; im.instanceMatrix.needsUpdate = true; }
  }
  model(type, color) {
    const k = type + color; let md = this.models.get(k);
    if (!md) { const d = DEFS[type], team = new THREE.Color(color).getHex(); md = d.kind === 'bld' ? modelBld(d, team) : modelUnit(d, team); this.models.set(k, md); }
    return md;
  }
  makeObj(e) {
    const col = this.w.players[e.owner].color;
    if (this.assets.has(e.type)) { const o = this.makeAssetObj(e, col); if (o) return o; }
    const md = this.model(e.type, col), g = new THREE.Group();
    const add = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.castShadow = this.shadows && mat !== this.matGlow; m.receiveShadow = e.kind === 'bld' && this.shadows; m.name = name; g.add(m); return m; };
    const o = { g: null, tur: null, rot: null, type: e.type, owner: e.owner, kind: e.kind, walk: Math.random() * 6, move: 0 };
    if (md.main) { const mm = add(md.main, this.matLit, 'main'); if (e.kind === 'unit' && e.def.cat === 'inf') mm.onBeforeRender = () => this.setAnim(o.walk, o.move); else mm.onBeforeRender = this.noAnim; }
    if (md.glow) add(md.glow, this.matGlow, 'glow');
    let tur = null, rot = null;
    if (md.tur) { tur = new THREE.Group(); tur.position.y = 20; const m = new THREE.Mesh(md.tur, this.matLit); m.castShadow = this.shadows; m.onBeforeRender = this.noAnim; tur.add(m); g.add(tur); }
    if (md.rot) { rot = new THREE.Mesh(md.rot, this.matLit); rot.onBeforeRender = this.noAnim; g.add(rot); }
    // Turm-Glühteile drehen mit
    if (tur && md.glow && e.def.role === 'tower') { const gm = g.children.find(c => c.name === 'glow'); g.remove(gm); tur.add(gm); }
    if (e.kind === 'bld') this.addProps(e, g, col);
    this.root.add(g);
    o.g = g; o.tur = tur; o.rot = rot; o.md = md; o.td = 0;
    return o;
  }
  makeAssetObj(e, col) {
    const inst = this.assets.instance(e.type, col); if (!inst) return null;
    const g = new THREE.Group(), d = e.def, def = inst.tpl.def;
    const o = { g, tur: null, rot: null, type: e.type, owner: e.owner, kind: e.kind, walk: Math.random() * 6, move: 0, td: 0, asset: true, mixer: inst.mixer, actions: inst.actions, anim: 'idle', md: { halos: [], smoke: [] }, bob: def.bob || 0 };
    if (e.kind === 'bld') {
      const fk = 'F' + e.type + col; let fm = this.models.get(fk);
      if (!fm) { fm = modelBld(d, new THREE.Color(col).getHex(), { baseOnly: true }); this.models.set(fk, fm); }
      if (fm.main) { const m = new THREE.Mesh(fm.main, this.matLit); m.receiveShadow = this.shadows; m.castShadow = this.shadows; m.onBeforeRender = this.noAnim; g.add(m); }
      const W = d.w * T - 4, D = d.h * T - 4, raw = inst.tpl.raw, fit = def.fit || 0.9;
      const sc = Math.min(W * fit / raw.x, D * fit / raw.z);
      inst.obj.children[0].scale.setScalar(sc); inst.obj.position.y = 6;
      if (def.smoke) o.md.smoke = [[W * 0.18, 6 + raw.y * sc * 0.95, -D * 0.15, 6], [-W * 0.2, 6 + raw.y * sc * 0.8, -D * 0.2, 5]];
      g.add(inst.obj);
      this.addProps(e, g, col);
    } else g.add(inst.obj);
    inst.obj.traverse(x => { if (x.isMesh) { x.castShadow = this.shadows; x.receiveShadow = false; } });
    this.root.add(g);
    return o;
  }
  addProps(e, g, col) {
    if (!this.assets.ready || e.def.role === 'tower' || e.def.role === 'superweapon') return;
    const set = PROP_SETS[e.def.fac]; if (!set) return;
    const r = mulberry32(e.id * 977 + 13), W = e.def.w * T, D = e.def.h * T;
    const corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]].sort(() => r() - 0.5);
    const n = e.def.w >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const [file, size] = set[(r() * set.length) | 0], p = this.assets.propInstance(file); if (!p) continue;
      const raw = p.tpl.raw, s = size / Math.max(raw.x, raw.z, 0.01);
      p.obj.children[0].scale.setScalar(s);
      const [cx, cz] = corners[i]; p.obj.position.set(cx * (W / 2 - size * 0.45), 4, cz * (D / 2 - size * 0.45)); p.obj.rotation.y = r() * 6.28;
      g.add(p.obj);
    }
    if (e.def.fac === 'A' && e.def.role === 'tech') { const p = this.assets.propInstance('satdish'); if (p) { const raw = p.tpl.raw; p.obj.children[0].scale.setScalar(40 / raw.y); p.obj.position.set(W * 0.28, 4, -D * 0.25); g.add(p.obj); } }
  }
  icon(type, color) {
    const k = type + color; this.icons = this.icons || new Map(); if (this.icons.has(k)) return this.icons.get(k);
    try {
      if (!this.ir) {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
        this.ir = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.ir.outputColorSpace = THREE.SRGBColorSpace; this.ir.toneMapping = THREE.ACESFilmicToneMapping;
        this.iscene = new THREE.Scene(); this.iscene.add(new THREE.HemisphereLight(0xdde8ff, 0x4a3f2c, 1.3)); const sl = new THREE.DirectionalLight(0xffefd2, 3.2); sl.position.set(-1, 2, 1.5); this.iscene.add(sl);
        this.icam = new THREE.OrthographicCamera(-1, 1, 0.75, -0.75, 0.1, 5000);
      }
      const g = new THREE.Group(), d = DEFS[type];
      if (this.assets.has(type) && d.kind === 'unit') {
        const inst = this.assets.instance(type, color); g.add(inst.obj);
        if (inst.mixer && inst.actions && inst.actions.idle) { inst.actions.idle.time = 0.3; inst.mixer.update(0.01); }
      } else {
        const fake = { id: 1, type, def: d, kind: d.kind, owner: 0 };
        if (this.assets.has(type) && d.kind === 'bld') {
          const fm = modelBld(d, new THREE.Color(color).getHex(), { baseOnly: true }); if (fm.main) g.add(new THREE.Mesh(fm.main, this.matLit));
          const inst = this.assets.instance(type, color), raw = inst.tpl.raw, sc = Math.min((d.w * T - 4) * (inst.tpl.def.fit || 0.9) / raw.x, (d.h * T - 4) * (inst.tpl.def.fit || 0.9) / raw.z);
          inst.obj.children[0].scale.setScalar(sc); inst.obj.position.y = 6; g.add(inst.obj);
        } else {
          const md = this.model(type, color);
          for (const p of ['main', 'glow', 'tur', 'rot']) if (md[p]) { const m = new THREE.Mesh(md[p], p === 'glow' ? this.matGlow : this.matLit); if (p === 'tur') m.position.y = 20; m.onBeforeRender = this.noAnim; g.add(m); }
        }
        g.traverse(m => { if (m.isMesh && m.material === this.matLit) m.onBeforeRender = this.noAnim; });
      }
      if (d.kind === 'unit') g.rotation.y = 0.6; if (d.kind === 'unit' && d.cat === 'inf' && !d.sup && !this.assets.has(type)) g.scale.setScalar(1.6);
      this.iscene.add(g);
      const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const r = Math.max(sz.x, sz.z, sz.y * 1.3) * 0.62 + 2;
      const cam = this.icam; cam.left = -r * 1.15; cam.right = r * 1.15; cam.top = r * 0.86; cam.bottom = -r * 0.86; cam.updateProjectionMatrix();
      cam.position.set(c.x + r * 1.2, c.y + r * 1.5, c.z + r * 2.2); cam.lookAt(c);
      this.ir.setClearColor(0x1e2b1e, 1); this.ir.render(this.iscene, cam);
      this.iscene.remove(g);
      const url = this.ir.domElement.toDataURL(); this.icons.set(k, url); return url;
    } catch (e) { return iconFor(type, color); }
  }
  // ---------- Partikel-Helfer ----------
  burst(x, y, h, r, big) {
    const R = (a, b) => a + Math.random() * (b - a), f = this.pFire, sm = this.pSmoke, db = this.pDebris, k = big === 2 ? 3 : big ? 1.6 : 1;
    const nf = Math.round(Math.min(40, 4 + r * 0.35) * k * (IS_TOUCH ? 0.6 : 1));
    for (let i = 0; i < nf; i++) { const a = R(0, 6.28), sp = R(10, 40) * (r / 20); f.emit(x + R(-r, r) * 0.3, h + R(2, r * 0.5), y + R(-r, r) * 0.3, Math.cos(a) * sp, R(10, 50), Math.sin(a) * sp, R(0.3, 0.65), r * R(0.4, 0.7), r * R(0.8, 1.2), [1, 0.78, 0.35, 0.8], [0.9, 0.2, 0.02, 0], -20, 2.5); }
    for (let i = 0; i < Math.round(nf * 0.7); i++) { const a = R(0, 6.28), sp = R(5, 20); sm.emit(x + R(-r, r) * 0.4, h + R(4, r * 0.6), y + R(-r, r) * 0.4, Math.cos(a) * sp, R(15, 40), Math.sin(a) * sp, R(1.4, 3.2), r * R(0.5, 0.8), r * R(1.6, 2.4), [0.22, 0.2, 0.18, 0.6], [0.4, 0.38, 0.35, 0], -6, 0.8); }
    for (let i = 0; i < Math.round(nf * 0.5); i++) { const a = R(0, 6.28), sp = R(30, 90) * (r / 22); db.emit(x, h + 4, y, Math.cos(a) * sp, R(60, 150), Math.sin(a) * sp, R(1.2, 2.2), R(2, 4), R(2, 3.5), [0.16, 0.13, 0.1, 1], [0.12, 0.1, 0.08, 1], 260, 0.3, h - 2); }
    for (let i = 0; i < Math.round(nf * 0.4); i++) { const a = R(0, 6.28), sp = R(60, 160); f.emit(x, h + 6, y, Math.cos(a) * sp, R(40, 140), Math.sin(a) * sp, R(0.3, 0.7), 2.2, 1.2, [1, 0.9, 0.5, 1], [1, 0.5, 0.1, 0], 300, 0.5, h - 2); }
  }
  muzzle(x, h, y, fx, big, col) {
    const R = (a, b) => a + Math.random() * (b - a);
    if (fx === 'beam') { this.pFire.emit(x, h, y, 0, 0, 0, 0.1, big ? 14 : 8, big ? 18 : 10, [col.r, col.g, col.b, 0.9], [col.r, col.g, col.b, 0]); return; }
    this.pFire.emit(x, h, y, 0, 0, 0, 0.07, big ? 18 : fx === 'bullet' ? 7 : 12, big ? 24 : fx === 'bullet' ? 9 : 16, [1, 0.95, 0.6, 1], [1, 0.5, 0.1, 0]);
    if (fx !== 'bullet') for (let i = 0; i < 2; i++) this.pSmoke.emit(x, h, y, R(-8, 8), R(8, 20), R(-8, 8), R(0.6, 1.1), 5, 16, [0.6, 0.58, 0.55, 0.4], [0.6, 0.58, 0.55, 0], -4, 1);
  }
  trail(x, h, y, purple) { this.pSmoke.emit(x, h, y, 0, 4, 0, 0.7, 3, 10, purple ? [0.8, 0.5, 1, 0.4] : [0.75, 0.75, 0.75, 0.45], [0.6, 0.6, 0.6, 0], -4, 1); }
  addTrack(x, y, face, side) {
    const M = new THREE.Matrix4(), nx = -Math.sin(face) * side, ny = Math.cos(face) * side;
    M.compose(new THREE.Vector3(x + nx, this.heightAt(x, y) + 0.35, y + ny), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -face), new THREE.Vector3(4, 1, 2.6));
    this.tracks.setMatrixAt(this.trackN % 2400, M); this.trackN++; this.tracks.count = Math.min(2400, this.trackN); this.tracks.instanceMatrix.needsUpdate = true;
  }
  setAnim(walk, move) { const sh = this.matLit.userData.sh; if (sh) { sh.uniforms.uWalk.value = walk; sh.uniforms.uMove.value = move; } }
  makeWaterNormal() {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'), img = c.createImageData(S, S), r = mulberry32(17);
    const hgt = new Float32Array(S * S); for (let k = 0; k < 40; k++) { const fx = 1 + ((r() * 6) | 0), fy = 1 + ((r() * 6) | 0), ph = r() * 6.28, a = 1 / (fx + fy); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hgt[y * S + x] += Math.sin((x * fx + y * fy) / S * 6.2832 + ph) * a; }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x, dx = hgt[y * S + (x + 1) % S] - hgt[y * S + (x + S - 1) % S], dy = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x]; img.data[i * 4] = 128 + dx * 160; img.data[i * 4 + 1] = 128 + dy * 160; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  addScorch(x, y, r) {
    if (!this.scorch) return; const M = new THREE.Matrix4();
    M.compose(new THREE.Vector3(x, this.heightAt(x, y) + 0.4 + (this.scorchN % 7) * 0.05, y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), new THREE.Vector3(r, 1, r * (0.7 + Math.random() * 0.3)));
    this.scorch.setMatrixAt(this.scorchN % 160, M); this.scorchN++; this.scorch.count = Math.min(160, this.scorchN); this.scorch.instanceMatrix.needsUpdate = true;
  }
  // ---------- Umgebung: Bäume, Felsen, Gras ----------
  buildDeco() {
    const m = this.w.map, r = mulberry32(m.w * 31 + m.h), L = { pine: [], oak: [], bush: [], rock: [], grass: [], flower: [] }, mob = IS_TOUCH ? 0.55 : 1;
    const starts = m.starts || [];
    const at = (i, dx, dy) => { const x = i % m.w + dx, y = ((i / m.w) | 0) + dy; return x < 0 || y < 0 || x >= m.w || y >= m.h ? -1 : m.ter[y * m.w + x]; };
    const put = (kind, tx, ty, sc = 1, jitter = 0.8) => { const x = (tx + 0.5 + (r() - 0.5) * jitter) * T, y = (ty + 0.5 + (r() - 0.5) * jitter) * T; L[kind].push([x, y, sc * (0.75 + r() * 0.5), r() * 6.28, tx >= 0 && ty >= 0 && tx < m.w && ty < m.h ? ty * m.w + tx : -1, 0.85 + r() * 0.3]); };
    for (let i = 0; i < m.w * m.h; i++) {
      const t = m.ter[i], tx = i % m.w, ty = (i / m.w) | 0;
      const nearStart = starts.some(s => Math.abs(s.x - tx) < 10 && Math.abs(s.y - ty) < 10);
      if (t === TER.MOUNT) {
        const edge = [at(i, 1, 0), at(i, -1, 0), at(i, 0, 1), at(i, 0, -1)].some(v => v !== TER.MOUNT && v !== -1);
        if (r() < 0.45) put('rock', tx, ty, 1 + r() * 1.2);
        if (edge && r() < 0.5) put('pine', tx, ty, 1.1); else if (r() < 0.12) put('pine', tx, ty, 0.9);
      } else if (t === TER.HILL) {
        if (m.ra[i]) continue;
        if (r() < 0.07) put('rock', tx, ty, 0.6 + r() * 0.5); if (r() < 0.06 * mob) put('bush', tx, ty); if (r() < 0.35 * mob) put('grass', tx, ty, 1.2);
      } else if (t === TER.LOW) {
        if (m.ra[i]) continue;
        const nearRes = [at(i, 1, 0), at(i, -1, 0)].length && (m.ra[i + 1] || m.ra[i - 1] || m.ra[i + m.w] || m.ra[i - m.w]);
        const shore = [at(i, 1, 0), at(i, -1, 0), at(i, 0, 1), at(i, 0, -1)].some(v => v === TER.WATER);
        if (!nearStart && !nearRes && r() < (shore ? 0.03 : 0.022)) put(r() < 0.55 ? 'oak' : 'pine', tx, ty);
        if (!nearStart && r() < 0.035 * mob) put('bush', tx, ty);
        if (r() < 0.55 * mob) put('grass', tx, ty); if (r() < 0.3 * mob) put('grass', tx, ty);
        if (r() < 0.06 * mob) put('flower', tx, ty, 1, 0.9);
        if (r() < 0.006) put('rock', tx, ty, 0.5);
      }
    }
    // Wald und Felsen am Kartenrand
    const B = this.border.B, Wb = this.border.W, P = this.border.pos;
    for (let ty = -B; ty < m.h + B; ty++) for (let tx = -B; tx < m.w + B; tx++) {
      if (tx >= 0 && ty >= 0 && tx < m.w && ty < m.h) continue;
      const dd = Math.max(-tx, tx - m.w + 1, -ty, ty - m.h + 1);
      if (dd < 1) continue;
      const hh = P[((ty + B) * Wb + tx + B) * 3 + 1];
      if (hh > 70) { if (r() < 0.2) put('rock', tx, ty, 1.5); if (r() < 0.12) put('pine', tx, ty, 1.1); }
      else { if (r() < 0.32 * mob) put(r() < 0.6 ? 'pine' : 'oak', tx, ty, 1 + r() * 0.3); if (r() < 0.05) put('rock', tx, ty, 1.1); }
    }
    this.deco = [];
    const tints = { pine: [0.8, 1.15], oak: [0.75, 1.2], bush: [0.8, 1.2], rock: [0.85, 1.1], grass: [0.75, 1.25], flower: [1, 1] };
    const flowerCols = [0xfff176, 0xffffff, 0xe1bee7, 0xff8a80, 0x90caf9];
    const CH = 16 * T;
    for (const kind in L) {
      const all = L[kind]; if (!all.length) continue;
      const geom = modelTree(kind), groups = new Map();
      all.forEach((e, j) => { e[6] = j; const key = Math.floor(e[0] / CH) + ',' + Math.floor(e[1] / CH); let g = groups.get(key); if (!g) groups.set(key, g = []); g.push(e); });
      for (const [key, list] of groups) {
        const [gx, gy] = key.split(',').map(Number);
        const im = new THREE.InstancedMesh(geom, this.matDeco, list.length);
        im.frustumCulled = false; im.castShadow = this.shadows && (kind === 'pine' || kind === 'oak' || kind === 'rock'); im.onBeforeRender = this.noAnim;
        const mats = new Float32Array(list.length * 16), M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
        list.forEach((e, j) => {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), e[3]); sc.setScalar(e[2]); v.set(e[0], this.heightAt(e[0], e[1]) + this.borderH(e[0], e[1]) - 0.5, e[1]);
          M.compose(v, q, sc); M.toArray(mats, j * 16);
          const [lo, hi] = tints[kind], f = lo + (hi - lo) * hash2(e[6], kind.length);
          if (kind === 'flower') col.setHex(flowerCols[e[6] % flowerCols.length]); else col.setRGB(f, f * (kind === 'oak' ? 1 + (hash2(e[6], 3) - 0.5) * 0.2 : 1), f * 0.95);
          im.setColorAt(j, col);
        });
        this.root.add(im);
        this.deco.push({ im, list, mats, cols: im.instanceColor.array.slice(), x0: gx * CH, y0: gy * CH, x1: (gx + 1) * CH, y1: (gy + 1) * CH });
      }
    }
    this.decoKey = ''; this.updDeco();
  }
  borderH(x, y) { // Höhe außerhalb der Karte
    const m = this.w.map, tx = x / T, ty = y / T; if (tx >= 0 && ty >= 0 && tx <= m.w && ty <= m.h) return 0;
    const B = this.border.B, W = this.border.W, gx = Math.max(-B, Math.min(m.w + B, Math.round(tx))), gy = Math.max(-B, Math.min(m.h + B, Math.round(ty)));
    return this.border.pos[((gy + B) * W + gx + B) * 3 + 1] - this.heightAt(x, y);
  }
  updDeco() {
    const blocked = new Set(); let key = '';
    for (const e of this.w.ents.values()) if (e.kind === 'bld') { key += e.id + ','; for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) blocked.add(y * this.w.map.w + x); }
    if (key === this.decoKey) return; this.decoKey = key;
    for (const dc of this.deco) {
      const { im, list, mats, cols } = dc; let n = 0;
      for (let j = 0; j < list.length; j++) { if (list[j][4] >= 0 && blocked.has(list[j][4])) continue; im.instanceMatrix.array.set(mats.subarray(j * 16, j * 16 + 16), n * 16); im.instanceColor.array.set(cols.subarray(j * 3, j * 3 + 3), n * 3); n++; }
      im.count = n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    }
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2), w = innerWidth, h = innerHeight;
    if (this._sz !== w + 'x' + h + 'x' + dpr) { this._sz = w + 'x' + h + 'x' + dpr; this.three.setPixelRatio(dpr); this.three.setSize(w, h, false); }
  }
  toScreen(x, y, h, cam) { return [(x - cam.x) * cam.z, ((y - cam.y) * CSIN - h * CCOS) * cam.z]; }
  draw(cam, ui, alpha, now) {
    this.resize();
    const w = this.w, z = cam.z, Wc = innerWidth, Hc = innerHeight;
    // Kamera: oben links = (cam.x, cam.y) am Boden
    const cmr = this.camera; cmr.left = 0; cmr.right = Wc / z; cmr.top = 0; cmr.bottom = -Hc / z; cmr.updateProjectionMatrix();
    const D = 4000; cmr.position.set(cam.x, D * CSIN, cam.y + D * CCOS); cmr.up.set(0, 1, 0); cmr.lookAt(cam.x, 0, cam.y);
    const vw = (Wc - 0) / z, vh = Hc / (z * CSIN), cxw = cam.x + vw / 2, cyw = cam.y + vh / 2;
    cmr.updateMatrixWorld(); FOG_U.uCamW.value.copy(cmr.matrixWorld);
    const fog = this.fog && this.fog.enabled ? this.fog : null;
    FOG_U.uFogMap.value.z = fog ? 1 : 0;
    if (fog && fog.ver !== this.fogVer) { this.fogVer = fog.ver; const D2 = this.fogData, t = fog.tex; for (let i = 0; i < t.length; i++) { D2[i * 4] = D2[i * 4 + 1] = D2[i * 4 + 2] = t[i]; D2[i * 4 + 3] = 255; } FOG_U.fogTexR.value.needsUpdate = true; }
    // Sonne/Schatten folgt dem Blickfeld
    this.sun.target.position.set(cxw, 0, cyw); this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 1500);
    if (this.shadows) { const r = Math.max(vw, vh) * 0.62 + 100, sc = this.sun.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 10; sc.far = 3500; sc.updateProjectionMatrix(); }
    this.water.position.y = -3 + Math.sin(now * 0.8) * 0.6;
    if (((now * 2) | 0) !== this._rt) { this._rt = (now * 2) | 0; this.updRes(); this.updDeco(); }
    if (this.waterNormal) { this.waterNormal.offset.set(now * 0.02, now * 0.013); }
    for (const dc of this.deco) dc.im.visible = dc.x1 > cam.x - 80 && dc.x0 < cam.x + vw + 80 && dc.y1 > cam.y - 80 && dc.y0 < cam.y + vh + 240;
    const dt = Math.min(0.1, Math.max(0, now - (this.lastNow || now))); this.lastNow = now;
    if (this.rebuild) { this.rebuild = false; for (const o of this.objs.values()) this.root.remove(o.g); this.objs.clear(); }
    // Objekte abgleichen
    const seen = new Set(), P = w.players, pad = 160;
    let nb = 0; const M = new THREE.Matrix4(), q0 = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const e of w.ents.values()) {
      seen.add(e.id);
      let o = this.objs.get(e.id);
      if (!o || o.type !== e.type || o.owner !== e.owner) { if (o) this.root.remove(o.g); o = this.makeObj(e); this.objs.set(e.id, o); }
      const x = e.kind === 'unit' ? e.px + (e.x - e.px) * alpha : e.x, y = e.kind === 'unit' ? e.py + (e.y - e.py) * alpha : e.y;
      const vis = x > cam.x - pad && x < cam.x + vw + pad && y > cam.y - pad && y < cam.y + vh + pad * 2 && (!fog || fog.canSee(e));
      o.g.visible = vis; if (!vis) continue;
      const gh = this.heightAt(x, y);
      if (e.kind === 'bld') {
        o.g.position.set(x, gh, y);
        if (o.tur) o.tur.rotation.y = -e.face;
      } else {
        const air = e.air, hy = air ? gh + AIR_H + (e.def.sup ? 18 : 0) + Math.sin(now * 2 + e.id) * 2 : gh;
        o.g.position.set(x, hy, y);
        // weiches Drehen
        const tgt = -e.face; let cur = o.g.rotation.y; let dlt = ((tgt - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI; o.g.rotation.y = cur + dlt * 0.25;
        const usc = o.asset ? 1 : e.def.cat === 'inf' && !e.def.sup ? 1.25 : e.def.sup ? 1.0 : 1.3; o.g.scale.setScalar(usc);
        const sp = Math.hypot(e.x - e.px, e.y - e.py); o.move += ((sp > 0.3 ? 1 : 0) - o.move) * 0.2; o.walk += sp * 0.22 + (sp > 0.3 ? 0.05 : 0);
        if (o.mixer) {
          const moving = sp > 0.3, firing = (e.flags & 32) !== 0;
          const st = moving ? (firing ? 'moveShoot' : 'move') : (firing ? 'shoot' : 'idle');
          if (st !== o.anim) { const cur = o.actions[o.anim], nxt = o.actions[st] || o.actions.idle; if (nxt && nxt !== cur) { nxt.reset().play(); if (cur) cur.crossFadeTo(nxt, 0.18, false); } o.anim = st; }
          o.mixer.update(dt);
        }
        if (o.bob && sp > 0.3) o.g.position.y += Math.abs(Math.sin(o.walk * 1.4)) * 3 * o.bob;
        if (o.rot) o.rot.rotation.y = now * 22;
        if (air && e.def.cat === 'air' && !e.def.sup && !o.rot) o.g.rotation.z = Math.sin(now * 3 + e.id) * 0.08;
        if (!this.shadows) { if (nb < 2500) { const r = e.def.size * (air ? 0.9 : 1.1) * usc; v.set(x + (air ? 14 : 0), gh + 0.6, y + (air ? 10 : 0)); sc.set(r, 1, r * 0.8); M.compose(v, q0, sc); this.blobs.setMatrixAt(nb++, M); } }
      }
    }
    for (const [id, o] of this.objs) if (!seen.has(id)) {
      this.objs.delete(id);
      if (o.actions && o.actions.death && o.g.visible) { const cur = o.actions[o.anim]; const da = o.actions.death; da.reset().play(); if (cur && cur !== da) cur.crossFadeTo(da, 0.15, false); this.dying.push({ o, t: 1.8 }); }
      else this.root.remove(o.g);
    }
    for (let i = this.dying.length - 1; i >= 0; i--) { const dd = this.dying[i]; dd.t -= dt; dd.o.mixer.update(dt); if (dd.t < 0.6) dd.o.g.position.y -= dt * 20; if (dd.t <= 0) { this.root.remove(dd.o.g); this.dying.splice(i, 1); } }
    // ---- Dauer-Effekte: Rauch, Feuer, Staub, Spuren, Leuchten ----
    const Rn = Math.random, hl = this.halo, mobK = IS_TOUCH ? 0.5 : 1; hl.begin();
    const pulse = 0.85 + 0.15 * Math.sin(now * 4);
    for (const e of w.ents.values()) {
      const o = this.objs.get(e.id); if (!o || !o.g.visible) continue;
      const gp = o.g.position, md = o.md;
      if (e.kind === 'bld' && fog && !fog.allied(e.owner) && !fog.visAt(e.x, e.y)) continue;
      if (e.kind === 'bld') {
        const hpF = e.hp / e.def.hp, Wb = e.w * T, Hb = e.h * T;
        if (hpF < 0.55 && Rn() < dt * 7 * mobK) this.pSmoke.emit(gp.x + (Rn() - 0.5) * Wb * 0.6, gp.y + 22 + Rn() * 14, gp.z + (Rn() - 0.5) * Hb * 0.6, (Rn() - 0.5) * 6, 22 + Rn() * 14, (Rn() - 0.5) * 6, 2.5 + Rn() * 1.5, 8, 30, hpF < 0.3 ? [0.12, 0.11, 0.1, 0.7] : [0.3, 0.29, 0.27, 0.55], [0.35, 0.34, 0.32, 0], -3, 0.4);
        if (hpF < 0.3 && Rn() < dt * 14 * mobK) this.pFire.emit(gp.x + (Rn() - 0.5) * Wb * 0.5, gp.y + 10 + Rn() * 12, gp.z + (Rn() - 0.5) * Hb * 0.5, 0, 18 + Rn() * 14, 0, 0.5 + Rn() * 0.4, 9, 16, [1, 0.8, 0.3, 0.95], [1, 0.25, 0.02, 0], -12, 1);
        if (md.smoke && !(e.flags & 1)) for (const sp of md.smoke) if (Rn() < dt * 2.5 * mobK) this.pSmoke.emit(gp.x + sp[0], gp.y + sp[1], gp.z + sp[2], 4 + Rn() * 3, 16 + Rn() * 8, -2 + Rn() * 3, 3 + Rn(), sp[3] * 1.1, sp[3] * 4, [0.55, 0.54, 0.52, 0.35], [0.7, 0.7, 0.7, 0], -2, 0.3);
        if (md.halos) { const tr = o.tur ? o.tur.rotation.y : 0, cs = Math.cos(tr), sn = Math.sin(tr); for (const h of md.halos) { let hx = h[0], hz = h[2], hy = h[1]; if (h[7]) { const rx = hx * cs + hz * sn, rz = -hx * sn + hz * cs; hx = rx; hz = rz; hy += 20; } hl.add(gp.x + hx, gp.y + hy, gp.z + hz, h[3], h[4], h[5], h[6], 0.4 * pulse); } }
      } else {
        const d = e.def, sp = Math.hypot(e.x - e.px, e.y - e.py), f = e.face;
        if (d.cat === 'veh' && !e.air && sp > 0.3) {
          const back = d.size * 1.2;
          if (Rn() < dt * 7 * mobK) this.pSmoke.emit(gp.x - Math.cos(f) * back, gp.y + 3, gp.z - Math.sin(f) * back, (Rn() - 0.5) * 8, 6 + Rn() * 6, (Rn() - 0.5) * 8, 0.9 + Rn() * 0.5, 5, 16, d.fac === 'K' ? [0.7, 0.5, 0.9, 0.25] : [0.58, 0.5, 0.38, 0.32], [0.6, 0.52, 0.4, 0], -2, 1);
          const tracked = !(d.fac === 'K' && !d.harvester && !d.mcv) && !['buggy'].includes(d.key.slice(2)) && !d.harvester && !d.mcv;
          if (tracked) { o.td += sp; if (o.td > 7) { o.td = 0; const sc = o.g.scale.x; this.addTrack(gp.x, gp.z, f, d.size * 0.8 * sc); this.addTrack(gp.x, gp.z, f, -d.size * 0.8 * sc); } }
        }
        if (d.harvester && (e.flags & 16) && Rn() < dt * 10 * mobK) { this.pSmoke.emit(gp.x + Math.cos(f) * d.size * 1.4, gp.y + 3, gp.z + Math.sin(f) * d.size * 1.4, (Rn() - 0.5) * 10, 10, (Rn() - 0.5) * 10, 0.8, 4, 12, [0.75, 0.62, 0.3, 0.4], [0.7, 0.6, 0.3, 0], -2, 1); this.pFire.emit(gp.x + Math.cos(f) * d.size * 1.3, gp.y + 5, gp.z + Math.sin(f) * d.size * 1.3, (Rn() - 0.5) * 30, 30 + Rn() * 30, (Rn() - 0.5) * 30, 0.4, 2.2, 1.5, [1, 0.85, 0.3, 1], [1, 0.6, 0.1, 0], 160); }
        if (e.air && d.cat === 'air' && !o.rot && sp > 0.3 && Rn() < dt * 6 * mobK) this.pSmoke.emit(gp.x - Math.cos(f) * d.size, gp.y, gp.z - Math.sin(f) * d.size, 0, 0, 0, 0.6, 2, 6, [0.85, 0.85, 0.85, 0.3], [0.9, 0.9, 0.9, 0]);
        if (md.halos && md.halos.length) { const ry = o.g.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry), sc = o.g.scale.x; for (const h of md.halos) { const hx = (h[0] * cs + h[2] * sn) * sc, hz = (-h[0] * sn + h[2] * cs) * sc; hl.add(gp.x + hx, gp.y + h[1] * sc, gp.z + hz, h[3] * sc * 0.9, h[4], h[5], h[6], 0.38 * pulse); } }
      }
    }
    hl.end();
    const psc = z * this.three.getPixelRatio();
    for (const p of [this.pSmoke, this.pFire, this.pDebris]) { p.mat.uniforms.uScale.value = psc; p.update(dt); }
    hl.mat.uniforms.uScale.value = psc;
    if (this.terrain && this.terrain.material.userData.sh) this.terrain.material.userData.sh.uniforms.uTime.value = now;
    this.blobs.count = nb; this.blobs.instanceMatrix.needsUpdate = true;
    // Platzierungsvorschau
    if (ui.placing && ui.ghost) {
      const k = ui.placing.type + P[ui.pid].color;
      if (!this.ghost || this.ghost.userData.k !== k) { if (this.ghost) this.root.remove(this.ghost); const md = this.model(ui.placing.type, P[ui.pid].color); this.ghost = new THREE.Group(); this.ghost.userData.k = k; for (const p of ['main', 'tur', 'glow']) if (md[p]) { const mm = new THREE.Mesh(md[p], this.matGhost); if (p === 'tur') mm.position.y = 20; this.ghost.add(mm); } this.root.add(this.ghost); }
      const d = DEFS[ui.placing.type], gx = (ui.ghost.tx + d.w / 2) * T, gy = (ui.ghost.ty + d.h / 2) * T;
      this.ghost.visible = true; this.ghost.position.set(gx, this.heightAt(gx, gy) + 1, gy);
    } else if (this.ghost) this.ghost.visible = false;
    this.fx.update(now);
    this.three.render(this.scene, cmr);
    this.overlay(cam, ui, alpha, now);
  }
  overlay(cam, ui, alpha, now) {
    const c = this.c, w = this.w, z = cam.z, dpr = cam.dpr, P = w.players, sel = ui.sel;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.ov.width, this.ov.height);
    // Bodenkoordinaten-Transform (Kreise werden zu Ellipsen)
    const ground = () => c.setTransform(z * dpr, 0, 0, z * CSIN * dpr, -cam.x * z * dpr, -cam.y * z * CSIN * dpr);
    const scr = () => c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vw = innerWidth / z, vh = innerHeight / (z * CSIN);
    const inView = (e, p) => e.x > cam.x - p && e.x < cam.x + vw + p && e.y > cam.y - p && e.y < cam.y + vh + p * 2;
    const hOf = (x, y) => this.heightAt(x, y);
    const fogO = this.fog && this.fog.enabled ? this.fog : null;
    ground();
    if (ui.placing) {
      const tx0 = Math.max(0, Math.floor(cam.x / T)), ty0 = Math.max(0, Math.floor(cam.y / T)), tx1 = Math.min(w.map.w, Math.ceil((cam.x + vw) / T)), ty1 = Math.min(w.map.h, Math.ceil((cam.y + vh) / T));
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1 / z; c.beginPath();
      for (let x = tx0; x <= tx1; x++) { c.moveTo(x * T, ty0 * T); c.lineTo(x * T, ty1 * T); } for (let y = ty0; y <= ty1; y++) { c.moveTo(tx0 * T, y * T); c.lineTo(tx1 * T, y * T); } c.stroke();
      if (ui.ghost) { const d = DEFS[ui.placing.type], g = ui.ghost, ok = ui.ghostOk; c.fillStyle = ok ? 'rgba(118,255,3,0.22)' : 'rgba(255,23,68,0.35)'; c.fillRect(g.tx * T, g.ty * T, d.w * T, d.h * T); c.strokeStyle = ok ? '#76ff03' : '#ff1744'; c.lineWidth = 2 / z; c.strokeRect(g.tx * T, g.ty * T, d.w * T, d.h * T); if (d.weapon) { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc((g.tx + 0.5) * T, (g.ty + 0.5) * T, d.weapon.rng * T, 0, 7); c.stroke(); } }
    }
    // Auswahlringe (am Boden, leicht nach oben verschoben für Höhe)
    for (const id of sel) {
      const e = w.ents.get(id); if (!e || !inView(e, 80) || (fogO && !fogO.canSee(e))) continue;
      const x = e.kind === 'unit' ? e.px + (e.x - e.px) * alpha : e.x, y0 = e.kind === 'unit' ? e.py + (e.y - e.py) * alpha : e.y;
      const y = y0 - hOf(x, y0) * CCOS / CSIN;
      c.strokeStyle = e.owner === ui.pid ? '#76ff03' : '#ff5252'; c.lineWidth = 2 / z; c.beginPath();
      if (e.kind === 'bld') c.strokeRect(e.tx * T, e.ty * T - hOf(x, y0) * CCOS / CSIN, e.w * T, e.h * T);
      else c.arc(x, y, e.def.size * 1.5 + 3, 0, 7);
      c.stroke();
      if (e.kind === 'bld' && e.owner === ui.pid) { const ef = e.def.eff || {}, r = (ef.bldShield || ef.repair || ef.dmgAura || {}).r; if (r) { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.setLineDash([8, 6]); c.beginPath(); c.arc(e.x, e.y, r * T, 0, 7); c.stroke(); c.setLineDash([]); } if (e.def.weapon) { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(e.x, e.y, e.def.weapon.rng * T, 0, 7); c.stroke(); } if (e.rally) { c.strokeStyle = 'rgba(118,255,3,0.7)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.rally.x, e.rally.y); c.stroke(); c.setLineDash([]); c.fillStyle = '#76ff03'; c.beginPath(); c.arc(e.rally.x, e.rally.y, 6, 0, 7); c.fill(); } }
    }
    // Overlay-Effekte am Boden
    for (let i = this.fx.over.length - 1; i >= 0; i--) {
      const f = this.fx.over[i], p = (now - f.s) / f.d; if (p > 1) { this.fx.over.splice(i, 1); continue; }
      if (f.t === 'target') { c.strokeStyle = `rgba(255,23,68,${0.5 + 0.5 * Math.sin(now * 10)})`; c.lineWidth = 3 / z; c.setLineDash([12, 8]); c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.stroke(); c.setLineDash([]); }
    }
    if (ui.missionTarget) { const t = w.ents.get(ui.missionTarget); if (t && (!fogO || fogO.canSee(t))) { c.strokeStyle = `rgba(255,214,0,${0.6 + 0.4 * Math.sin(now * 5)})`; c.lineWidth = 3 / z; c.setLineDash([14, 8]); c.beginPath(); c.arc(t.x, t.y, Math.max(t.w, t.h) * T * 0.8 + 6, 0, 7); c.stroke(); c.setLineDash([]); } }
    if (ui.swTarget && ui.mouseW) { const d = DEFS[ui.swTarget.type], r = (d.sw.r || 3) * T; c.strokeStyle = 'rgba(255,23,68,0.9)'; c.lineWidth = 2 / z; c.setLineDash([10, 6]); c.beginPath(); c.arc(ui.mouseW.x, ui.mouseW.y, r, 0, 7); c.stroke(); c.setLineDash([]); }
    scr();
    // Lebensbalken, Status
    for (const e of w.ents.values()) {
      if (!inView(e, 60)) continue;
      if (fogO && !fogO.canSee(e)) continue;
      const s = sel.has(e.id), dmg = e.hp < e.def.hp, fl = e.flags | 0;
      const x = e.kind === 'unit' ? e.px + (e.x - e.px) * alpha : e.x, y = e.kind === 'unit' ? e.py + (e.y - e.py) * alpha : e.y;
      if (e.kind === 'bld') {
        const top = 40 + (e.def.role === 'superweapon' ? 30 : 0);
        const [sx, sy] = this.toScreen(e.tx * T + 4, e.ty * T, hOf(x, y) + top, cam);
        if (s || (dmg && ui.showHp)) this.bar(c, sx, sy, (e.w * T - 8) * z, e.hp / e.def.hp);
        if (fl & 4) { c.fillStyle = '#69f0ae'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; const [mx, my] = this.toScreen(x, y, hOf(x, y) + 50, cam); c.fillText('🔧', mx, my); }
        if (e.def.role === 'superweapon' && e.owner === ui.pid && ui.swReady && ui.swReady.has(e.id)) { const [mx, my] = this.toScreen(x, y, hOf(x, y) + 80, cam); c.fillStyle = `rgba(255,23,68,${0.6 + 0.4 * Math.sin(now * 6)})`; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText('BEREIT', mx, my); }
      } else {
        const h = hOf(x, y) + (e.air ? AIR_H : 0) + e.def.size * 1.6 + 10;
        const [sx, sy] = this.toScreen(x, y, h, cam), bw = Math.max(16, e.def.size * 2.2) * Math.max(0.7, z);
        if (s || (dmg && ui.showHp)) this.bar(c, sx - bw / 2, sy, bw, e.hp / e.def.hp, e.def.harvester && s ? (fl & 8 ? 1 : 0) : -1);
      }
      if (fl & 3) { const [sx, sy] = this.toScreen(x, y, hOf(x, y) + (e.air ? AIR_H : 0) + 6, cam); const r = (e.kind === 'bld' ? e.w * T * 0.6 : e.def.size * 1.6) * z; c.strokeStyle = fl & 2 ? `rgba(255,215,0,${0.6 + 0.3 * Math.sin(now * 5)})` : 'rgba(64,196,255,0.85)'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(sx, sy, r, r * 0.75, 0, 0, 7); c.stroke(); }
    }
    // Bildschirm-Effekte
    for (let i = this.fx.over.length - 1; i >= 0; i--) {
      const f = this.fx.over[i], p = (now - f.s) / f.d;
      if (f.t === 'flash') { c.fillStyle = `rgba(255,250,230,${0.85 * (1 - p)})`; c.fillRect(0, 0, innerWidth, innerHeight); }
      else if (f.t === 'storm') { const a = Math.min(1, p * 8, (1 - p) * 8); c.strokeStyle = `rgba(240,200,255,${0.85 * a})`; c.lineWidth = 2; for (let j = 0; j < 3; j++) { if (Math.random() < 0.45) continue; const a0 = Math.random() * 6.28, r0 = Math.random() * f.r, gx = f.x + Math.cos(a0) * r0, gy = f.y + Math.sin(a0) * r0; const [sx, sy] = this.toScreen(gx, gy, hOf(gx, gy), cam); c.beginPath(); c.moveTo(sx, sy - 110 * z); for (let q = 1; q < 5; q++) c.lineTo(sx + (Math.random() - 0.5) * 24 * z, sy - 110 * z + q * 27 * z); c.lineTo(sx, sy); c.stroke(); } }
      else if (f.t === 'plane') { const gx = f.x - 900 + p * 1800, gy = f.y - 120 + p * 60; const [sx, sy] = this.toScreen(gx, gy, 260, cam); const [hx, hy] = this.toScreen(gx + 40, gy, 0, cam); c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(hx, hy, 40 * z, 14 * z, 0, 0, 7); c.fill(); c.fillStyle = '#90a4ae'; c.beginPath(); c.moveTo(sx + 44 * z, sy); c.lineTo(sx - 30 * z, sy - 44 * z); c.lineTo(sx - 18 * z, sy); c.lineTo(sx - 30 * z, sy + 44 * z); c.closePath(); c.fill(); if (p > 0.4 && p < 0.75) for (let j = 0; j < 6; j++) { const px = f.x + (j - 3) * 24, [ux, uy] = this.toScreen(px, f.y, 240 * (1 - (p - 0.4) / 0.35), cam); c.fillStyle = '#eceff1'; c.beginPath(); c.arc(ux, uy, 8 * z, Math.PI, 0); c.fill(); c.strokeStyle = '#555'; c.lineWidth = 1; c.beginPath(); c.moveTo(ux - 8 * z, uy); c.lineTo(ux, uy + 10 * z); c.lineTo(ux + 8 * z, uy); c.stroke(); } }
    }
    for (let i = this.fx.texts.length - 1; i >= 0; i--) {
      const t = this.fx.texts[i], p = (now - t.s) / t.d; if (p > 1) { this.fx.texts.splice(i, 1); continue; }
      const [sx, sy] = this.toScreen(t.x, t.y, hOf(t.x, t.y) + 30, cam);
      c.fillStyle = rgba(t.col, 1 - p); c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText(t.txt, sx, sy - p * 28);
    }
    if (ui.box) { const b = ui.box; c.strokeStyle = '#76ff03'; c.lineWidth = 1; c.fillStyle = 'rgba(118,255,3,0.08)'; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    if (ui.marker) { const mk = ui.marker, p = (now - mk.s) / 0.5; if (p < 1) { const [sx, sy] = this.toScreen(mk.x, mk.y, hOf(mk.x, mk.y), cam); c.strokeStyle = mk.col; c.lineWidth = 2; c.beginPath(); c.ellipse(sx, sy, 16 * (1 - p) + 3, (16 * (1 - p) + 3) * CSIN, 0, 0, 7); c.stroke(); } }
  }
  bar(c, x, y, bw, f, cargo) {
    f = Math.max(0, f);
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(x - 1, y - 1, bw + 2, 5);
    c.fillStyle = f > 0.6 ? '#76ff03' : f > 0.3 ? '#ffd600' : '#ff1744'; c.fillRect(x, y, bw * f, 3);
    if (cargo >= 0) { c.fillStyle = '#ffd54f'; c.fillRect(x, y + 4, bw * cargo, 2); }
  }
  drawMini(mc, cam, pid, vwW, vwH) { this.r2.w = this.w; this.r2.fog = this.fog; return this.r2.drawMini(mc, cam, pid, vwW, vwH); }
}
