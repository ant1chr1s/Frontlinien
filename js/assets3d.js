'use strict';
// ===================== Fertige 3D-Modelle (Quaternius, Kenney – CC0) =====================
const ANIM_CHAR = { idle: 'Idle', move: 'Run_Gun', shoot: 'Idle_Shoot', moveShoot: 'Run_Shoot', death: 'Death' };
const ANIM_ROBOT = { idle: 'Idle', move: 'Walk', shoot: 'Attack', moveShoot: 'Walk', death: null };
const ANIM_ALIEN = { idle: 'Alien_Idle', move: 'Alien_Idle', shoot: 'Alien_Idle', moveShoot: 'Alien_Idle', death: null };
const ASSET_DEFS = {
  // ---- Allianz ----
  A_soldat: { file: 'soldier', weapon: 'AK', h: 22, team: ['Character_Main'], recolor: { Pants: 0x8a9aa3 }, anims: ANIM_CHAR },
  A_rakete: { file: 'soldier', weapon: 'RocketLauncher', h: 22, team: ['Character_Main'], recolor: { Pants: 0x8a9aa3 }, anims: ANIM_CHAR },
  A_sniper: { file: 'soldier', weapon: 'Sniper', h: 22, team: ['Character_Main'], recolor: { Pants: 0x5a6670 }, anims: ANIM_CHAR },
  A_ingenieur: { file: 'soldier', weapon: 'none', h: 21, team: ['Character_Main'], recolor: { Pants: 0xe0e0e0, Character_Main: 0xf9a825 }, anims: ANIM_CHAR },
  A_laserpanzer: { file: 'quadshell', w: 34, tint: 0.65, anims: Object.assign({}, ANIM_ROBOT, { move: 'Run' }) },
  A_ionwerfer: { file: 'trilobite', w: 40, tint: 0.65, anims: ANIM_ROBOT },
  A_jaeger: { file: 'eyedrone', w: 22, tint: 0.65, air: true, anims: { idle: 'Idle', move: 'Idle', shoot: 'Attack', moveShoot: 'Idle', death: null } },
  // ---- Dominion ----
  D_rekrut: { file: 'enemy', weapon: 'SMG', h: 22, team: ['Enemy_Red'], recolor: {}, anims: ANIM_CHAR },
  D_bazooka: { file: 'enemy', weapon: 'RocketLauncher', h: 22, team: ['Enemy_Red'], recolor: {}, anims: ANIM_CHAR },
  D_flammen: { file: 'hazmat', weapon: 'GrenadeLauncher', h: 23, team: ['Hazmat_Main'], recolor: {}, anims: ANIM_CHAR },
  D_ingenieur: { file: 'enemy', weapon: 'none', h: 21, team: ['Enemy_Red'], recolor: { Enemy_Pants: 0xf9a825 }, anims: ANIM_CHAR },
  D_panzer: { file: 'tank', w: 36, team: ['Tank_Main2'], recolor: { Tank_Main: 0x6b7445 } },
  D_koloss: { file: 'tank', w: 66, team: ['Tank_Main2'], recolor: { Tank_Main: 0x3d4045, Grey: 0x22252a } },
  // ---- Kollektiv ----
  K_drohne: { file: 'cyclop', h: 22, team: ['M_Alien_Body_Blue'], teamMix: 0.55, anims: ANIM_ALIEN, bob: 1 },
  K_spucker: { file: 'oculi', h: 22, team: ['M_Alien_Orange'], teamMix: 0.5, recolor: { M_Alien_Orange: 0x7cb342 }, anims: ANIM_ALIEN, bob: 1 },
  K_psioniker: { file: 'cyclop', h: 25, team: ['M_Alien_Body_Blue'], teamMix: 0.35, recolor: { M_Alien_Body_Blue: 0x8e24aa }, anims: ANIM_ALIEN, bob: 1 },
  K_ingenieur: { file: 'oculi', h: 17, team: ['M_Alien_Orange'], teamMix: 0.3, recolor: { M_Alien_Orange: 0xc6ff00 }, anims: ANIM_ALIEN, bob: 1 },
  K_titan: { file: 'scolitex', h: 50, team: ['M_Alien_Cyan'], teamMix: 0.6, anims: ANIM_ALIEN, bob: 0.5 },
  // ---- Dominion-Gebäude (Kenney City Kit Industrial) ----
  D_bauhof: { file: 'k_building_l', fit: 0.92, bld: true },
  D_power: { file: 'k_building_m', fit: 0.92, bld: true, smoke: true },
  D_refinery: { file: 'k_building_c', fit: 0.82, bld: true, back: true },
  D_barracks: { file: 'k_building_i', fit: 0.95, bld: true },
  D_factory: { file: 'k_building_q', fit: 0.92, bld: true },
  D_tech: { file: 'k_building_d', fit: 0.95, bld: true },
  D_schmiede: { file: 'k_building_e', fit: 0.92, bld: true, smoke: true },
  D_akademie: { file: 'k_building_a', fit: 0.95, bld: true },
  D_verdichter: { file: 'k_building_r', fit: 0.92, bld: true },
};
// Deko-Requisiten neben Gebäuden
const PROP_SETS = {
  A: [['crate_l', 9], ['crate_s', 7], ['barrel_s', 8]],
  D: [['container', 12], ['barrel_x', 7], ['crates_t', 7], ['sacktrench', 12], ['k_tank', 12]],
};
const ASSET_FILES = [...new Set(Object.values(ASSET_DEFS).map(d => d.file).concat(['satdish', 'td_crystal', 'td_dirt', 'td_rocks', 'pipes', 'streetlight', 'k_watertower', 'k_container'], ...Object.values(PROP_SETS).map(l => l.map(x => x[0]))))];

class AssetLib {
  constructor() { this.gltf = {}; this.tpl = {}; this.teamGeo = new Map(); this.teamMat = new Map(); this.ready = false; this.progress = 0; this.failed = false; this.lowQ = IS_TOUCH; }
  load(base, onProgress) {
    if (this._p) return this._p;
    if (typeof THREE_GLTFLoader === 'undefined') { this.failed = true; return Promise.resolve(false); }
    const loader = new THREE_GLTFLoader(); let done = 0;
    this._p = Promise.all(ASSET_FILES.map(f => new Promise((res) => {
      const ok = (g) => { this.gltf[f] = g; done++; this.progress = done / ASSET_FILES.length; onProgress && onProgress(this.progress); res(); };
      const fail = (err) => { console.warn('Modell fehlt:', f, err && err.message); done++; res(); };
      // Ersatzweg: Modell als JavaScript-Datei (für Hosts, die keine .glb ausliefern)
      const viaScript = () => {
        const sc = document.createElement('script'); sc.src = base.replace(/models\/$/, 'models-js/') + f + '.js';
        sc.onload = () => { try { const b64 = window.__GLB && window.__GLB[f]; const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); delete window.__GLB[f]; loader.parse(u.buffer, '', ok, fail); } catch (e) { fail(e); } };
        sc.onerror = fail; document.head.appendChild(sc);
      };
      if (this.useScripts) viaScript();
      else loader.load(base + f + '.glb', ok, undefined, () => { this.useScripts = true; viaScript(); });
    }))).then(() => { this.ready = true; return true; });
    return this._p;
  }
  has(type) { const d = ASSET_DEFS[type]; return !!(this.ready && d && this.gltf[d.file]); }
  // ---------- Vorlagen ----------
  template(type) {
    if (this.tpl[type]) return this.tpl[type];
    const d = ASSET_DEFS[type]; const g = this.gltf[d.file]; if (!g) return null;
    const t = this.prepare(g, d); this.tpl[type] = t; return t;
  }
  propTemplate(file) {
    const k = '#' + file; if (this.tpl[k]) return this.tpl[k];
    const g = this.gltf[file]; if (!g) return null;
    const t = this.prepare(g, { file }); this.tpl[k] = t; return t;
  }
  prepare(g, d) {
    const src = THREE_SkeletonUtils.clone(g.scene);
    // ungenutzte Waffen entfernen
    if (d.weapon) { const kill = []; src.traverse(o => { if (['AK', 'RocketLauncher', 'Sniper', 'SMG', 'GrenadeLauncher'].includes(o.name) && o.name !== d.weapon) kill.push(o); }); kill.forEach(o => o.parent.remove(o)); }
    src.updateMatrixWorld(true);
    const meshes = []; src.traverse(o => { if (o.isMesh && o.visible) meshes.push(o); });
    const textured = meshes.some(m => (Array.isArray(m.material) ? m.material : [m.material]).some(mt => mt.map));
    const skinned = meshes.some(m => m.isSkinnedMesh);
    let root = src, mesh = null, flags = null;
    if (!textured) {
      // alles zu EINEM Mesh mit Vertexfarben zusammenfassen (1 Zeichenaufruf je Einheit)
      const r = this.merge(src, meshes, d); root = r.root; mesh = r.mesh; flags = r.team;
    } else {
      for (const m of meshes) { m.castShadow = true; const mats = Array.isArray(m.material) ? m.material : [m.material]; m.material = mats.map(mt => this.convMat(mt)); if (m.material.length === 1) m.material = m.material[0]; }
    }
    // Normieren: Größe, Bodenhöhe, Mitte
    const holder = new THREE.Group(); holder.add(root);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    let s = 1;
    if (d.h) s = d.h / sz.y; else if (d.w) s = d.w / Math.max(sz.x, sz.z); else if (d.bld) s = 1; else s = 1;
    const inner = new THREE.Group(); holder.remove(root); inner.add(root);
    root.position.set(-c.x, -box.min.y, -c.z);
    inner.scale.setScalar(s);
    const outer = new THREE.Group(); outer.add(inner);
    // Blickrichtung: Modelle schauen nach +Z, das Spiel nach +X
    inner.rotation.y = d.rot != null ? d.rot : Math.PI / 2;
    if (d.bld || !d.anims) { if (d.bld || d.fit) inner.rotation.y = 0; }
    return { outer, inner, mesh, flags, skinned, textured, clips: g.animations, size: sz.clone().multiplyScalar(s), raw: sz.clone(), def: d };
  }
  convMat(mt) {
    if (!this.lowQ && mt.isMeshStandardMaterial) { const m = mt.clone(); m.metalness = Math.min(m.metalness, 0.4); m.roughness = Math.max(m.roughness, 0.45); return m; }
    const m = new THREE.MeshLambertMaterial({ map: mt.map || null, color: mt.color ? mt.color.clone() : 0xffffff, transparent: mt.transparent, alphaTest: mt.alphaTest || 0, side: mt.side });
    return m;
  }
  merge(src, meshes, d) {
    let body = meshes.find(m => m.isSkinnedMesh);
    const pos = [], nor = [], col = [], si = [], sw = [], idx = [], team = [];
    const tmpC = new THREE.Color(), v = new THREE.Vector3(), n = new THREE.Vector3(), M = new THREE.Matrix4(), NM = new THREE.Matrix3();
    const invBody = body ? body.matrixWorld.clone().invert() : src.matrixWorld.clone().invert();
    let base = 0;
    for (const m of meshes) {
      const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, cnt = P.count;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : cnt, materialIndex: 0 }];
      // Farbe je Vertex aus Material
      const vcol = new Float32Array(cnt * 3), vteam = new Float32Array(cnt);
      for (const gr of groups) {
        const mt = mats[gr.materialIndex] || mats[0], name = mt.name || '';
        tmpC.copy(mt.color || new THREE.Color(1, 1, 1));
        if (d.recolor && d.recolor[name] != null) tmpC.setHex(d.recolor[name]);
        const isTeam = d.team && d.team.includes(name) ? 1 : 0;
        for (let k = gr.start; k < gr.start + gr.count; k++) { const vi = g.index ? g.index.getX(k) : k; vcol[vi * 3] = tmpC.r; vcol[vi * 3 + 1] = tmpC.g; vcol[vi * 3 + 2] = tmpC.b; vteam[vi] = isTeam; }
      }
      let rigidBone = -1;
      if (!m.isSkinnedMesh) {
        M.multiplyMatrices(invBody, m.matrixWorld);
        if (body) {
          // starres Teil (Waffe, Kopf) an seinen Knochen binden – unabhängig von Ruhe- vs. Bindepose
          let p = m.parent; while (p && !(p.isBone && body.skeleton.bones.includes(p))) p = p.parent;
          rigidBone = p ? body.skeleton.bones.indexOf(p) : 0; if (rigidBone < 0) rigidBone = 0;
          const bone = body.skeleton.bones[rigidBone];
          const L = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(m.matrixWorld);           // Teil relativ zum Knochen
          const boneBind = new THREE.Matrix4().copy(body.skeleton.boneInverses[rigidBone]).invert();         // Knochen in Bindepose (Mesh-Raum)
          M.copy(body.bindMatrixInverse).multiply(boneBind).multiply(L);
        }
        NM.getNormalMatrix(M);
      }
      for (let i = 0; i < cnt; i++) {
        v.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i);
        if (!m.isSkinnedMesh) { v.applyMatrix4(M); n.applyMatrix3(NM).normalize(); }
        pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); col.push(vcol[i * 3], vcol[i * 3 + 1], vcol[i * 3 + 2]); team.push(vteam[i]);
        if (body) {
          if (m.isSkinnedMesh) { const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight; si.push(SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)); sw.push(SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)); }
          else { si.push(rigidBone, 0, 0, 0); sw.push(1, 0, 0, 0); }
        }
      }
      if (g.index) for (let k = 0; k < g.index.count; k++) idx.push(g.index.getX(k) + base); else for (let k = 0; k < cnt; k++) idx.push(k + base);
      base += cnt;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (body) { geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); }
    geo.setIndex(base > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const mat = this.charMat || (this.charMat = new THREE.MeshLambertMaterial({ vertexColors: true }));
    let mesh;
    if (body) {
      mesh = new THREE.SkinnedMesh(geo, mat); mesh.name = 'merged';
      const parent = body.parent; mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); mesh.scale.copy(body.scale);
      for (const m of meshes) m.parent && m.parent.remove(m);
      parent.add(mesh); src.updateMatrixWorld(true);
      mesh.bind(body.skeleton, body.bindMatrix);
    } else {
      mesh = new THREE.Mesh(geo, mat); mesh.name = 'merged';
      for (const m of meshes) m.parent && m.parent.remove(m);
      const r = new THREE.Group(); r.add(mesh); mesh.applyMatrix4(src.matrixWorld);
      mesh.castShadow = true; return { root: r, mesh, team: new Float32Array(team) };
    }
    mesh.castShadow = true; mesh.frustumCulled = false;
    return { root: src, mesh, team: new Float32Array(team) };
  }
  teamGeometry(tpl, teamHex, key) {
    const k = key + '|' + teamHex; let g = this.teamGeo.get(k); if (g) return g;
    const src = tpl.mesh.geometry; g = new THREE.BufferGeometry();
    for (const a in src.attributes) if (a !== 'color') g.setAttribute(a, src.attributes[a]);
    g.setIndex(src.index); g.boundingSphere = src.boundingSphere;
    const base = src.attributes.color.array, out = new Float32Array(base.length), tc = new THREE.Color(teamHex), mix = tpl.def.teamMix != null ? tpl.def.teamMix : 1;
    for (let i = 0; i < tpl.flags.length; i++) { const f = tpl.flags[i] * mix; out[i * 3] = base[i * 3] * (1 - f) + tc.r * f; out[i * 3 + 1] = base[i * 3 + 1] * (1 - f) + tc.g * f; out[i * 3 + 2] = base[i * 3 + 2] * (1 - f) + tc.b * f; }
    g.setAttribute('color', new THREE.BufferAttribute(out, 3));
    this.teamGeo.set(k, g); return g;
  }
  // ---------- Instanz ----------
  instance(type, teamHex) {
    const tpl = this.template(type); if (!tpl) return null;
    const obj = tpl.skinned ? THREE_SkeletonUtils.clone(tpl.outer) : tpl.outer.clone(true);
    if (tpl.mesh) { obj.traverse(o => { if (o.name === 'merged') { o.geometry = this.teamGeometry(tpl, teamHex, type); o.castShadow = true; o.frustumCulled = false; } }); }
    else if (tpl.textured && tpl.def.tint) {
      const k = type + '|' + teamHex; let cache = this.teamMat.get(k);
      obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; const mats = Array.isArray(o.material) ? o.material : [o.material]; const nm = mats.map(mt => { const key = k + mt.uuid; let c = this.teamMat.get(key); if (!c) { c = mt.clone(); c.color = new THREE.Color(1, 1, 1).lerp(new THREE.Color(teamHex), tpl.def.tint); this.teamMat.set(key, c); } return c; }); o.material = nm.length === 1 ? nm[0] : nm; } });
    } else obj.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    let mixer = null, actions = null;
    if (tpl.skinned && tpl.clips.length && tpl.def.anims) {
      mixer = new THREE.AnimationMixer(obj); actions = {};
      for (const [st, name] of Object.entries(tpl.def.anims)) { const clip = name && tpl.clips.find(c => c.name === name); if (clip) { const a = mixer.clipAction(clip); if (st === 'death') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } actions[st] = a; } }
      const idle = actions.idle || Object.values(actions)[0]; if (idle) { idle.play(); idle.time = Math.random() * idle.getClip().duration; }
    }
    return { obj, mixer, actions, tpl };
  }
  propInstance(file) {
    const tpl = this.propTemplate(file); if (!tpl) return null;
    const o = tpl.outer.clone(true); o.traverse(x => { if (x.isMesh) x.castShadow = true; }); return { obj: o, tpl };
  }
}
