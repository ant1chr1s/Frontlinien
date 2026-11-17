'use strict';
// ===================== Prozedurale Texturen für 3D =====================
const ATLAS_N = 4, ATLAS_CELL = 256;
const TILES = ['paint', 'panel', 'concrete', 'window', 'corrug', 'hazard', 'organic', 'tread', 'camo', 'brick', 'vent', 'roof', 'shutter', 'tech', 'rock', 'bark'];
const TILE_IDX = Object.fromEntries(TILES.map((t, i) => [t, i]));
function tileCell(name) { const i = TILE_IDX[name] ?? 0; return [(i % ATLAS_N) / ATLAS_N, 1 - (((i / ATLAS_N) | 0) + 1) / ATLAS_N]; }

function makeAtlas() {
  const S = ATLAS_CELL, cv = document.createElement('canvas'); cv.width = cv.height = S * ATLAS_N;
  const c = cv.getContext('2d');
  const noise = (x0, y0, amt, n, sz = 2, base = 200) => { const r = mulberry32(x0 * 7 + y0 * 13 + n); for (let i = 0; i < n; i++) { const v = base + (r() - 0.5) * amt; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(x0 + r() * S, y0 + r() * S, sz, sz); } };
  const fill = (x0, y0, v) => { c.fillStyle = typeof v === 'number' ? `rgb(${v},${v},${v})` : v; c.fillRect(x0, y0, S, S); };
  TILES.forEach((t, i) => {
    const x0 = (i % ATLAS_N) * S, y0 = ((i / ATLAS_N) | 0) * S, r = mulberry32(i * 977 + 3);
    c.save(); c.beginPath(); c.rect(x0, y0, S, S); c.clip();
    switch (t) {
      case 'paint': fill(x0, y0, 236); noise(x0, y0, 30, 2500, 2, 236); c.fillStyle = 'rgba(0,0,0,0.06)'; for (let k = 0; k < 8; k++) { c.beginPath(); c.ellipse(x0 + r() * S, y0 + r() * S, 20 + r() * 40, 8 + r() * 20, r() * 3, 0, 7); c.fill(); } break;
      case 'panel': fill(x0, y0, 225); noise(x0, y0, 26, 3000, 2, 225);
        c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 3; c.strokeRect(x0 + 2, y0 + 2, S - 4, S - 4); c.beginPath(); c.moveTo(x0, y0 + S / 2); c.lineTo(x0 + S, y0 + S / 2); c.moveTo(x0 + S / 2, y0); c.lineTo(x0 + S / 2, y0 + S / 2); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.strokeRect(x0 + 5, y0 + 5, S - 10, S - 10);
        c.fillStyle = 'rgba(30,30,30,0.6)'; for (const [a, b] of [[12, 12], [S - 12, 12], [12, S - 12], [S - 12, S - 12], [S / 2 - 10, S / 2 + 12], [S / 2 + 10, S / 2 + 12]]) { c.beginPath(); c.arc(x0 + a, y0 + b, 3, 0, 7); c.fill(); }
        c.fillStyle = 'rgba(80,60,40,0.12)'; for (let k = 0; k < 6; k++) c.fillRect(x0 + r() * S, y0 + r() * S * 0.3 + S * 0.7, 4 + r() * 6, 20 + r() * 40); break;
      case 'concrete': fill(x0, y0, 205); noise(x0, y0, 60, 9000, 2, 205); c.strokeStyle = 'rgba(60,60,60,0.5)'; c.lineWidth = 2; c.strokeRect(x0 + 1, y0 + 1, S - 2, S / 2 - 1); c.strokeRect(x0 + 1, y0 + S / 2, S - 2, S / 2 - 1);
        c.strokeStyle = 'rgba(40,40,40,0.4)'; c.lineWidth = 1; for (let k = 0; k < 4; k++) { let x = x0 + r() * S, y = y0 + r() * S; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 6; q++) { x += (r() - 0.5) * 30; y += r() * 18; c.lineTo(x, y); } c.stroke(); }
        c.fillStyle = 'rgba(70,60,50,0.15)'; for (let k = 0; k < 10; k++) { c.beginPath(); c.arc(x0 + r() * S, y0 + r() * S, 6 + r() * 20, 0, 7); c.fill(); } break;
      case 'window': fill(x0, y0, 215); noise(x0, y0, 20, 1500, 2, 215);
        for (let wy = 0; wy < 2; wy++) for (let wx = 0; wx < 2; wx++) {
          const x = x0 + 22 + wx * 128, y = y0 + 26 + wy * 128, w = 84, h = 76;
          c.fillStyle = '#3a3f44'; c.fillRect(x - 5, y - 5, w + 10, h + 10);
          const g = c.createLinearGradient(x, y, x + w, y + h); const lit = r() < 0.35;
          g.addColorStop(0, lit ? '#ffe9a8' : '#3d6e8f'); g.addColorStop(0.5, lit ? '#f8c66a' : '#1d3c55'); g.addColorStop(1, lit ? '#d9a347' : '#10263a');
          c.fillStyle = g; c.fillRect(x, y, w, h);
          c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(x, y + h * 0.6); c.lineTo(x + w * 0.5, y); c.lineTo(x + w * 0.7, y); c.lineTo(x, y + h); c.fill();
          c.fillStyle = '#2b2f33'; c.fillRect(x + w / 2 - 2, y, 4, h); c.fillRect(x, y + h / 2 - 2, w, 4);
          c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x - 5, y + h + 5, w + 10, 4);
        } break;
      case 'corrug': fill(x0, y0, 210); for (let x = 0; x < S; x += 16) { const g = c.createLinearGradient(x0 + x, 0, x0 + x + 16, 0); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = g; c.fillRect(x0 + x, y0, 16, S); } noise(x0, y0, 50, 1500, 2, 200); c.fillStyle = 'rgba(120,70,30,0.18)'; for (let k = 0; k < 8; k++) c.fillRect(x0 + r() * S, y0 + S * 0.6 + r() * S * 0.4, 6, 30 + r() * 40); break;
      case 'hazard': fill(x0, y0, '#e8b818'); c.fillStyle = '#1a1a1a'; for (let k = -S; k < S * 2; k += 64) { c.beginPath(); c.moveTo(x0 + k, y0); c.lineTo(x0 + k + 32, y0); c.lineTo(x0 + k + 32 - S, y0 + S); c.lineTo(x0 + k - S, y0 + S); c.fill(); } noise(x0, y0, 60, 2500, 2, 128); break;
      case 'organic': fill(x0, y0, 200);
        for (let k = 0; k < 70; k++) { const x = x0 + r() * S, y = y0 + r() * S, rr = 8 + r() * 22; const g = c.createRadialGradient(x, y, 1, x, y, rr); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.8, 'rgba(0,0,0,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.4)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill(); }
        c.strokeStyle = 'rgba(40,0,40,0.45)'; c.lineWidth = 2; for (let k = 0; k < 10; k++) { let x = x0 + r() * S, y = y0 + r() * S; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 8; q++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); } break;
      case 'tread': fill(x0, y0, 70); for (let y = 0; y < S; y += 21) { c.fillStyle = '#2a2a2a'; c.fillRect(x0, y0 + y, S, 12); c.fillStyle = '#8a8a8a'; c.fillRect(x0, y0 + y, S, 3); } noise(x0, y0, 40, 1500, 2, 80); break;
      case 'camo': fill(x0, y0, 225); for (let k = 0; k < 40; k++) { const v = [150, 185, 110][k % 3]; c.fillStyle = `rgb(${v},${v},${v})`; c.beginPath(); const x = x0 + r() * S, y = y0 + r() * S; c.moveTo(x, y); for (let q = 0; q < 7; q++) c.lineTo(x + (r() - 0.5) * 70, y + (r() - 0.5) * 50); c.fill(); } noise(x0, y0, 30, 2000, 2, 200); break;
      case 'brick': fill(x0, y0, 120); for (let y = 0; y < S; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < S; x += 64) { const v = 185 + (r() - 0.5) * 50; c.fillStyle = `rgb(${v},${v * 0.92},${v * 0.86})`; c.fillRect(x0 + x + 3, y0 + y + 3, 58, 26); } noise(x0, y0, 40, 2500, 2, 170); break;
      case 'vent': fill(x0, y0, 160); for (let y = 10; y < S; y += 18) { c.fillStyle = '#2a2a2a'; c.fillRect(x0 + 14, y0 + y, S - 28, 9); c.fillStyle = '#d0d0d0'; c.fillRect(x0 + 14, y0 + y + 9, S - 28, 3); } c.strokeStyle = '#444'; c.lineWidth = 6; c.strokeRect(x0 + 6, y0 + 6, S - 12, S - 12); break;
      case 'roof': fill(x0, y0, 150); noise(x0, y0, 50, 6000, 2, 150); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; for (let y = 0; y < S; y += 64) { c.beginPath(); c.moveTo(x0, y0 + y); c.lineTo(x0 + S, y0 + y); c.stroke(); } c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 5; k++) c.fillRect(x0 + r() * S, y0 + r() * S, 18, 18); break;
      case 'shutter': fill(x0, y0, 140); for (let y = 0; y < S; y += 14) { c.fillStyle = '#5a5a5a'; c.fillRect(x0, y0 + y, S, 10); c.fillStyle = '#9a9a9a'; c.fillRect(x0, y0 + y, S, 2); } noise(x0, y0, 30, 1200, 2, 120); break;
      case 'tech': fill(x0, y0, 120); for (let k = 0; k < 26; k++) { const v = 90 + r() * 120; c.fillStyle = `rgb(${v},${v},${v})`; const w = 10 + r() * 50, h = 8 + r() * 40; const x = x0 + r() * (S - w), y = y0 + r() * (S - h); c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.strokeRect(x, y, w, h); }
        for (let k = 0; k < 14; k++) { c.fillStyle = ['#76ff03', '#ff1744', '#40c4ff', '#ffd600'][k % 4]; c.fillRect(x0 + r() * S, y0 + r() * S, 5, 5); } break;
      case 'rock': fill(x0, y0, 170); for (let k = 0; k < 60; k++) { const v = 120 + r() * 110; c.fillStyle = `rgb(${v},${v},${v})`; c.beginPath(); const x = x0 + r() * S, y = y0 + r() * S; c.moveTo(x, y); for (let q = 0; q < 5; q++) c.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 40); c.fill(); } noise(x0, y0, 60, 6000, 2, 170); break;
      case 'bark': fill(x0, y0, 150); for (let x = 0; x < S; x += 6) { const v = 90 + r() * 110; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(x0 + x, y0, 3 + r() * 3, S); } break;
    }
    c.restore();
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Detailtextur für Gelände: R=Gras, G=Fels, B=Sand
function makeDetail() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
  const img = c.createImageData(S, S), d = img.data, r = mulberry32(42);
  const L = (n) => { const a = new Float32Array(S * S); for (let o = 0; o < n; o++) { const f = 1 << (o + 2), g = new Float32Array((f + 1) * (f + 1)); for (let i = 0; i < g.length; i++) g[i] = r(); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const fx = x / S * f, fy = y / S * f, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy; const i0 = iy * (f + 1) + ix; const v = g[i0] * (1 - tx) * (1 - ty) + g[(i0 + 1) % g.length] * tx * (1 - ty) + g[(i0 + f + 1) % g.length] * (1 - tx) * ty + g[(i0 + f + 2) % g.length] * tx * ty; a[y * S + x] += v / (1 << o); } } return a; };
  const n1 = L(5), n2 = L(4);
  for (let i = 0; i < S * S; i++) {
    const w = r();
    const grass = 0.55 + (n1[i] - 1) * 0.35 + (w - 0.5) * 0.35;
    const rock = 0.5 + (n2[i] - 1) * 0.6 + (w - 0.5) * 0.15 + (Math.abs(Math.sin((i % S) * 0.05 + n2[i] * 6)) < 0.08 ? -0.25 : 0);
    const sand = 0.6 + (w - 0.5) * 0.25 + (n1[i] - 1) * 0.15;
    d[i * 4] = Math.max(0, Math.min(255, grass * 255)); d[i * 4 + 1] = Math.max(0, Math.min(255, rock * 255)); d[i * 4 + 2] = Math.max(0, Math.min(255, sand * 255)); d[i * 4 + 3] = 255;
  }
  // Grashalme
  c.putImageData(img, 0, 0);
  const id2 = c.getImageData(0, 0, S, S), d2 = id2.data;
  for (let k = 0; k < 9000; k++) { const x = (r() * S) | 0, y = (r() * S) | 0, len = 3 + r() * 6, v = r() < 0.5 ? 0.6 : 1.35; for (let q = 0; q < len; q++) { const yy = (y - q + S) % S, xx = (x + ((q * 0.3) | 0)) % S, o = (yy * S + xx) * 4; d2[o] = Math.min(255, d2[o] * v); } }
  c.putImageData(id2, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

// Lambert-Material mit Atlas (Kacheln wiederholt) + Laufanimation
function atlasMaterial(atlas, isGL2, opts = {}) {
  const m = new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true, map: atlas }, opts));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWalk = { value: 0 }; sh.uniforms.uMove = { value: 0 };
    m.userData.sh = sh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 cell;\nattribute vec2 anim;\nvarying vec2 vCell;\nuniform float uWalk;\nuniform float uMove;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCell = cell;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (anim.x != 0.0) {
          float sgn = anim.x > 0.0 ? 1.0 : -1.0;
          float kind = abs(anim.x);
          float a = sin(uWalk) * sgn * uMove * (kind > 1.5 ? 0.45 : 0.6);
          vec3 p = transformed - vec3(0.0, anim.y, 0.0);
          float cs = cos(a), sn = sin(a);
          if (kind > 2.5) { transformed = vec3(p.x * cs - p.z * sn, p.y, p.x * sn + p.z * cs) + vec3(0.0, anim.y, 0.0); }
          else { transformed = vec3(p.x * cs - p.y * sn, p.x * sn + p.y * cs, p.z) + vec3(0.0, anim.y, 0.0); }
        }`);
    const samp = isGL2 ? 'textureGrad(map, auv, dFdx(vMapUv) * cs2, dFdy(vMapUv) * cs2)' : 'texture2D(map, auv)';
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCell;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        float cs2 = ${(1 / ATLAS_N).toFixed(4)} * 0.92;
        vec2 auv = vCell + (fract(vMapUv) * 0.92 + 0.04) * ${(1 / ATLAS_N).toFixed(4)};
        vec4 sampledDiffuseColor = ${samp};
        diffuseColor *= sampledDiffuseColor;
      #endif`);
    if (typeof injectFog === 'function') injectFog(sh);
  };
  return m;
}

// Geländematerial mit Detailtextur und Felsen an Steilhängen
function terrainMaterial(map, detail) {
  const m = new THREE.MeshLambertMaterial({ map, vertexColors: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail }; sh.uniforms.uTime = { value: 0 }; m.userData.sh = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying float vNY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;\nvNY = normal.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nuniform float uTime;\nvarying vec3 vWP;\nvarying float vNY;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 dt = texture2D(detailMap, vWP.xz / 110.0).rgb;
        vec3 dt2 = texture2D(detailMap, vWP.xz / 31.0).rgb;
        float steep = 1.0 - smoothstep(0.62, 0.9, vNY);
        float high = smoothstep(30.0, 60.0, vWP.y);
        float rw = clamp(max(steep, high), 0.0, 1.0);
        float sw = 1.0 - smoothstep(-4.0, 0.5, vWP.y);
        float d = mix(dt.r * 0.6 + dt2.r * 0.4, dt.g * 0.7 + dt2.g * 0.3, rw);
        d = mix(d, dt.b, sw * 0.7);
        vec3 rockCol = vec3(0.47, 0.43, 0.39);
        diffuseColor.rgb = mix(diffuseColor.rgb, rockCol, steep * 0.75);
        diffuseColor.rgb *= 0.48 + d * 0.85;
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.78);
        float cl = smoothstep(0.42, 0.72, texture2D(detailMap, vWP.xz / 2600.0 + vec2(uTime * 0.005, uTime * 0.003), 6.0).g);
        diffuseColor.rgb *= 1.0 - 0.2 * cl;`);
    if (typeof injectFog === 'function') injectFog(sh);
  };
  return m;
}
