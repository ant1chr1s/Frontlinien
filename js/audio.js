'use strict';
// ===================== Audio: 90er-Synth-Musik, Ansager, Effekte =====================
const SND = {
  ctx: null, ok: false, vol: { music: 0.6, voice: 0.9, sfx: 0.6 },
  voices: [], fac: 'A', track: null, lastSay: {}, sfxT: {},

  init() {
    for (const k in this.vol) { const v = lsGetA('vol.' + k); if (v != null) this.vol[k] = +v; }
    const unlock = () => { this.start(); };
    ['pointerdown', 'keydown', 'touchend'].forEach(e => addEventListener(e, unlock, { capture: true, passive: true }));
    if ('speechSynthesis' in window) {
      const load = () => { this.voices = speechSynthesis.getVoices() || []; };
      load(); try { speechSynthesis.addEventListener('voiceschanged', load); } catch (e) { speechSynthesis.onvoiceschanged = load; }
    }
  },
  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.connect(c.destination);
      this.mus = c.createGain(); this.mus.connect(this.comp);
      this.sfx = c.createGain(); this.sfx.connect(this.comp);
      // Echo für Leads
      this.dly = c.createDelay(1); this.fb = c.createGain(); this.fb.gain.value = 0.32; this.dlyOut = c.createGain(); this.dlyOut.gain.value = 0.35;
      this.dly.connect(this.fb); this.fb.connect(this.dly); this.dly.connect(this.dlyOut); this.dlyOut.connect(this.mus);
      // Rauschen
      const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
      this.applyVol(); this.ok = true;
      setInterval(() => this.sched(), 25);
      if (this.want) this.play(this.want);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
    // iOS: Sprachausgabe einmalig durch Nutzergeste freischalten
    if (!this.speechUnlocked && 'speechSynthesis' in window) { this.speechUnlocked = true; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { } }
  },
  setVol(k, v) { this.vol[k] = v; lsSetA('vol.' + k, v); this.applyVol(); },
  applyVol() { if (!this.ctx) return; const t = this.ctx.currentTime; this.mus.gain.setTargetAtTime(this.vol.music * 0.42 * (this.duck ? 0.45 : 1), t, 0.08); this.sfx.gain.setTargetAtTime(this.vol.sfx * 0.5, t, 0.05); },

  // ---------- Musik ----------
  play(name) {
    this.want = name;
    if (!this.ok) return;
    if (this.track && this.track.name === name) return;
    const def = TRACKS[name]; if (!def) { this.track = null; return; }
    this.track = buildTrack(name, def); this.track.next = this.ctx.currentTime + 0.15; this.track.step = 0;
  },
  stop() { this.want = null; this.track = null; },
  sched() {
    const tr = this.track; if (!tr || !this.ctx || this.vol.music <= 0) { if (tr) tr.next = this.ctx.currentTime + 0.1; return; }
    const ahead = this.ctx.currentTime + 0.14;
    if (tr.next < this.ctx.currentTime - 0.5) tr.next = this.ctx.currentTime + 0.05;
    while (tr.next < ahead) { this.playStep(tr, tr.step, tr.next); tr.next += tr.dt; tr.step++; }
  },
  playStep(tr, step, t) {
    const D = tr.def, bar = Math.floor(step / 16), s = step % 16;
    const sec = tr.form[bar % tr.form.length];
    const chord = D.prog[bar % D.prog.length], root = D.root + chord[0], minor = chord[1];
    const ch = [root, root + (minor ? 3 : 4), root + 7];
    // Schlagzeug
    if (sec.drums) {
      if (D.kick[s] === 'x') this.kick(t);
      if (D.snare[s] === 'x') this.snare(t, 1); else if (D.snare[s] === 'o') this.snare(t, 0.35);
      if (D.hat[s] === 'x') this.hat(t, 0.04, 0.22); else if (D.hat[s] === 'o') this.hat(t, 0.16, 0.18);
      if (s === 0 && bar % 8 === 0) this.crash(t);
    }
    if (sec.bass && D.bass[s] !== '.') { const n = D.bass[s] === 'o' ? root : D.bass[s] === '5' ? root + 7 : root - 12; this.bass(t, n, tr.dt * (D.bassLen || 1.6)); }
    if (sec.pad && s === 0) this.pad(t, ch, tr.dt * 16);
    if (sec.arp && s % 2 === 0) this.arp(t, ch[(s / 2) % 3] + 12 + (s >= 8 ? 12 : 0), tr.dt * 1.6);
    if (sec.lead) { const n = tr.mel[(bar % 4) * 16 + s]; if (n != null) this.lead(t, n, tr.dt * (tr.melLen[(bar % 4) * 16 + s] || 2), D.leadWave); }
  },
  f(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  env(g, t, a, peak, dec, end) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
  kick(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(1.0, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + 0.34);
  },
  noise(t, dur, type, freq, q, vol, dest) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.mus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  snare(t, v) {
    this.noise(t, 0.17, 'bandpass', 1900, 0.8, 0.55 * v);
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    g.gain.setValueAtTime(0.4 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + 0.12);
  },
  hat(t, dur, v) { this.noise(t, dur, 'highpass', 7500, 0.7, v); },
  crash(t) { this.noise(t, 1.2, 'highpass', 5000, 0.5, 0.18); },
  bass(t, n, dur) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = this.f(n); o2.frequency.value = this.f(n - 12);
    f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.mus); o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  },
  pad(t, ch, dur) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.045, t + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.02);
    f.connect(g); g.connect(this.mus);
    for (const n of ch) for (const det of [-9, 9]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.f(n + 12); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur * 1.05); }
  },
  arp(t, n, dur) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'square'; o.frequency.value = this.f(n); f.type = 'lowpass'; f.frequency.value = 2600;
    this.env(g, t, 0.004, 0.05, dur); o.connect(f); f.connect(g); g.connect(this.mus); g.connect(this.dly); o.start(t); o.stop(t + dur + 0.05);
  },
  lead(t, n, dur, wave) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(3800, t); f.frequency.exponentialRampToValueAtTime(1500, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.012); g.gain.setValueAtTime(0.08, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(this.mus); g.connect(this.dly);
    for (const det of [-7, 7]) { const o = c.createOscillator(); o.type = wave || 'square'; o.frequency.value = this.f(n); o.detune.value = det; const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = 5.5; vg.gain.value = 6; v.connect(vg); vg.connect(o.detune); o.connect(f); o.start(t); v.start(t + 0.15); o.stop(t + dur + 0.02); v.stop(t + dur + 0.02); }
  },

  // ---------- Effekte ----------
  fx(kind, x, y) {
    if (!this.ok || this.vol.sfx <= 0 || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime, gap = { shot: 0.07, boom: 0.12, big: 0.5, click: 0.05, blip: 0.3, place: 0.2 }[kind] || 0.1;
    if (now - (this.sfxT[kind] || 0) < gap) return; this.sfxT[kind] = now;
    const t = now + 0.01, c = this.ctx;
    if (kind === 'shot') this.noise(t, 0.06, 'bandpass', 2500 + Math.random() * 1500, 1.2, 0.12, this.sfx);
    else if (kind === 'boom' || kind === 'big') {
      const big = kind === 'big';
      this.noise(t, big ? 2.2 : 0.6, 'lowpass', big ? 500 : 900, 0.8, big ? 1.0 : 0.5, this.sfx);
      const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(big ? 90 : 120, t); o.frequency.exponentialRampToValueAtTime(30, t + (big ? 1.5 : 0.4));
      g.gain.setValueAtTime(big ? 0.9 : 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + (big ? 1.8 : 0.45)); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 2);
    } else if (kind === 'click' || kind === 'blip' || kind === 'place') {
      const o = c.createOscillator(), g = c.createGain(); o.type = kind === 'place' ? 'triangle' : 'square';
      const f0 = kind === 'click' ? 1200 : kind === 'blip' ? 880 : 180; o.frequency.setValueAtTime(f0, t); if (kind === 'blip') o.frequency.setValueAtTime(f0 * 1.5, t + 0.06);
      if (kind === 'place') o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
      g.gain.setValueAtTime(kind === 'place' ? 0.5 : 0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'place' ? 0.3 : 0.12)); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.35);
    }
  },

  // ---------- Ansager ----------
  pickVoice(langs) {
    const vs = this.voices.length ? this.voices : (window.speechSynthesis ? speechSynthesis.getVoices() : []);
    for (const l of langs) { const c = vs.filter(v => (v.lang || '').replace('_', '-').toLowerCase().startsWith(l)); if (c.length) return c.find(v => /male|daniel|yuri|maxim|arthur|oliver|george|google/i.test(v.name)) || c.find(v => v.localService) || c[0]; }
    return null;
  },
  say(key, prio) {
    if (!('speechSynthesis' in window) || this.vol.voice <= 0) return;
    const P = PHRASES[key]; if (!P) return;
    const now = performance.now();
    if (now - (this.lastSay[key] || 0) < (P.gap || 8) * 1000) return;
    if (speechSynthesis.speaking && !prio) return;
    this.lastSay[key] = now;
    if (prio) speechSynthesis.cancel();
    const fac = this.fac, A = ACCENT[fac];
    let v = this.pickVoice(A.langs), text = P.de, lang = 'de-DE';
    if (v) { lang = v.lang; text = A.text(P); }
    else { v = this.pickVoice(['de']); }
    const u = new SpeechSynthesisUtterance(text);
    if (v) u.voice = v; u.lang = lang; u.pitch = A.pitch; u.rate = A.rate; u.volume = Math.min(1, this.vol.voice);
    u.onstart = () => { this.duck = true; this.applyVol(); };
    u.onend = u.onerror = () => { this.duck = false; this.applyVol(); };
    try { speechSynthesis.speak(u); } catch (e) { }
  },
};
function lsGetA(k) { try { return localStorage.getItem('frontlinien.' + k); } catch (e) { return null; } }
function lsSetA(k, v) { try { localStorage.setItem('frontlinien.' + k, v); } catch (e) { } }

// Allianz: britisches Englisch liest deutsche Lautschrift · Dominion: russische Stimme liest kyrillische Umschrift · Kollektiv: tiefe, verzerrte deutsche Stimme
const ACCENT = {
  A: { langs: ['en-gb', 'en'], pitch: 1.0, rate: 0.95, text: P => P.en },
  D: { langs: ['ru'], pitch: 0.8, rate: 0.92, text: P => P.ru },
  K: { langs: ['de'], pitch: 0.1, rate: 0.78, text: P => P.de.replace(/\./g, '…') },
};
const PHRASES = {
  start: { de: 'Kampfbereit.', en: 'Kampf, buh-right.', ru: 'Кампф-берайт.' },
  built: { de: 'Bau abgeschlossen.', en: 'Bow, ap-guh-shlossen.', ru: 'Бау абгешлоссен.', gap: 3 },
  unit: { de: 'Einheit bereit.', en: 'Ine-hite, buh-right.', ru: 'Айнхайт берайт.', gap: 6 },
  lowpow: { de: 'Energielevel niedrig.', en: 'Ennair-ghee-level, nee-drig.', ru: 'Энерги-левель нидрих.', gap: 25 },
  nocash: { de: 'Unzureichende Mittel.', en: 'Oon-tsoo-rye-khen-duh mittel.', ru: 'Унцурайхенде миттель.', gap: 25 },
  attack: { de: 'Unsere Basis wird angegriffen!', en: 'Oonzeruh bahzis veert an-guh-griffen!', ru: 'Унзере базис вирд ангегриффен!', gap: 20 },
  unitlost: { de: 'Einheit verloren.', en: 'Ine-hite, fair-lohren.', ru: 'Айнхайт ферлорен.', gap: 12 },
  bldlost: { de: 'Gebäude zerstört.', en: 'Guh-boy-duh, tsair-shturt.', ru: 'Гебойде церштёрт.', gap: 8 },
  swready: { de: 'Superwaffe bereit.', en: 'Zooper-vaffuh, buh-right.', ru: 'Зупервафе берайт.', gap: 15 },
  intelready: { de: 'Aufklärung bereit.', en: 'Owf-klair-oong, buh-right.', ru: 'Ауфклэрунг берайт.', gap: 15 },
  swbuilt: { de: 'Warnung! Feindliche Superwaffe entdeckt.', en: 'Varnoong! Fynd-likh-uh zooper-vaffuh, ent-deckt.', ru: 'Варнунг! Файндлихе зупервафе энтдект.', gap: 10 },
  swfire: { de: 'Warnung! Superwaffe abgefeuert!', en: 'Varnoong! Zooper-vaffuh, ap-guh-foyert!', ru: 'Варнунг! Зупервафе абгефойерт!', gap: 6 },
  captured: { de: 'Gebäude erobert.', en: 'Guh-boy-duh, air-oh-bert.', ru: 'Гебойде эроберт.', gap: 4 },
  caplost: { de: 'Gebäude an den Feind verloren.', en: 'Guh-boy-duh an dane fynd fair-lohren.', ru: 'Гебойде ан ден файнд ферлорен.', gap: 4 },
  wave: { de: 'Feindliche Angriffswelle im Anmarsch!', en: 'Fynd-likh-uh an-griffs-velluh im an-marsh!', ru: 'Файндлихе ангриффсвелле им анмарш!', gap: 10 },
  newcon: { de: 'Neue Bauoptionen.', en: 'Noy-uh bow-op-tsee-ohnen.', ru: 'Нойе бау-опционен.', gap: 20 },
  win: { de: 'Sieg!', en: 'Zeeg!', ru: 'Зиг!', gap: 1 },
  lose: { de: 'Niederlage.', en: 'Nee-der-lah-guh.', ru: 'Нидерлаге.', gap: 1 },
  mwin: { de: 'Mission erfüllt.', en: 'Mission, air-fullt.', ru: 'Миссион эрфюльт.', gap: 1 },
  mlose: { de: 'Mission gescheitert.', en: 'Mission, guh-shy-tert.', ru: 'Миссион гешайтерт.', gap: 1 },
};

// ---------- Musikstücke im Stil der 90er ----------
// prog: [Halbtonabstand zum Grundton, moll?] je Takt
const TRACKS = {
  menu: { bpm: 104, root: 45, prog: [[0, 1], [-4, 0], [-9, 0], [-2, 0]], kick: 'x.......x.......', snare: '....x.......x..o', hat: '..x...x...x...x.', bass: 'x.....o.x.....o.', bassLen: 3, leadWave: 'triangle', rhythm: 'x...x.x.....x...', form: 'IAAB BAAB', seed: 3 },
  A: { bpm: 132, root: 43, prog: [[0, 0], [5, 0], [-3, 1], [7, 0]], kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.ox', bass: 'x.ox.ox.x.ox.o5.', leadWave: 'sawtooth', rhythm: 'x..x..x.x...x.x.', form: 'IIAABBAB', seed: 11 },
  D: { bpm: 122, root: 40, prog: [[0, 1], [0, 1], [1, 0], [-2, 0]], kick: 'x..x..x.x..x..x.', snare: '....x.......x.x.', hat: 'x.x.x.x.x.x.x.x.', bass: 'xxoxxxoxxxoxxo5o', bassLen: 0.9, leadWave: 'square', rhythm: 'x.x.x...x..xx...', form: 'IIAABBAB', seed: 27 },
  K: { bpm: 116, root: 41, prog: [[0, 1], [1, 0], [0, 1], [-1, 0]], kick: 'x.....x...x.....', snare: '....x.......x...', hat: '.xx..xx..xx..x.x', bass: 'x..o..x..o..x.o.', bassLen: 2, leadWave: 'triangle', rhythm: 'x.....x.x.......', form: 'IAABAB', seed: 41 },
};
function buildTrack(name, D) {
  const rng = mulberry32A(D.seed), mel = new Array(64).fill(null), melLen = new Array(64).fill(0);
  const scale = D.prog.some(c => c[1]) ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  for (let b = 0; b < 4; b++) {
    const ch = D.prog[b % D.prog.length], r = D.root + 24 + ch[0], tones = [0, ch[1] ? 3 : 4, 7, 12];
    let last = -1;
    for (let s = 0; s < 16; s++) {
      if (D.rhythm[s] !== 'x' || (b === 3 && s > 10)) continue;
      let n;
      if (s === 0 || rng() < 0.6) n = r + tones[(rng() * tones.length) | 0];
      else n = D.root + 24 + scale[(rng() * scale.length) | 0] + (rng() < 0.3 ? 12 : 0);
      if (n === last) n += 2; last = n;
      mel[b * 16 + s] = n;
      let len = 1; while (s + len < 16 && D.rhythm[s + len] !== 'x') len++;
      melLen[b * 16 + s] = Math.min(len, 6);
    }
  }
  // Form: I=Intro (Drums+Bass), A=+Pad/Arp, B=+Lead, ' '=Break (Pad+Arp)
  const sec = { I: { drums: 1, bass: 1 }, A: { drums: 1, bass: 1, pad: 1, arp: 1 }, B: { drums: 1, bass: 1, pad: 1, arp: 1, lead: 1 }, ' ': { pad: 1, arp: 1 } };
  const form = []; for (const ch of D.form) for (let i = 0; i < 4; i++) form.push(sec[ch]);
  return { name, def: D, dt: 60 / D.bpm / 4, mel, melLen, form };
}
function mulberry32A(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- Spielereignisse → Ansagen ----------
const AudioDirector = {
  reset(world, pid) { this.w = world; this.pid = pid; this.prev = null; this.t = 0; SND.fac = world.players[pid].fac; },
  view(v, dt) {
    if (!v) return;
    const pv = this.prev; this.prev = { low: v.low, sw: (v.sw || []).map(s => [s.id, s.t <= 0, s.type]), credits: v.credits, blocked: false };
    if (!pv) return;
    if (v.low && !pv.low) SND.say('lowpow');
    for (const [id, rdy, type] of this.prev.sw) { const o = pv.sw.find(x => x[0] === id); if (rdy && o && !o[1]) SND.say(DEFS[type] && DEFS[type].role === 'intel' ? 'intelready' : 'swready'); }
    // zu wenig Geld: Bauschlange wartet
    const qs = v.q || {}; let waiting = false;
    for (const k in qs) { const it = qs[k] && qs[k][0]; if (it && it.st !== 'ready' && v.credits < 30) waiting = true; }
    if (waiting) { this.t += dt; if (this.t > 1.5) { SND.say('nocash'); this.t = 0; } } else this.t = 0;
  },
  event(ev, inView) {
    const pid = this.pid, w = this.w; if (!w) return;
    const mine = (p) => p === pid, ally = (p) => p != null && w.players[p] && isAllied(w.players[pid], w.players[p]);
    switch (ev.k) {
      case 'ready': if (mine(ev.p)) { SND.say('built'); SND.fx('blip'); } break;
      case 'unit': if (mine(ev.p)) { SND.say('unit'); } break;
      case 'att': if (mine(ev.p)) SND.say('attack'); break;
      case 'd':
        if (ev.o === pid) { if (ev.b) SND.say('bldlost'); else if (ev.u) SND.say('unitlost'); }
        if (inView(ev.x, ev.y)) SND.fx(ev.b ? 'big' : 'boom');
        break;
      case 'capture': if (mine(ev.p)) SND.say('captured', true); else if (mine(ev.from)) SND.say('caplost', true); break;
      case 'swbuilt': if (!ally(ev.o)) SND.say('swbuilt'); break;
      case 'swfire': if (!ally(ev.o)) SND.say('swfire', true); break;
      case 'wave': if (mine(ev.p)) SND.say('wave'); break;
      case 'nuke': case 'ion': SND.fx('big'); break;
      case 'place': SND.fx('place'); break;
      case 's': if (inView(ev.a[0], ev.a[1])) SND.fx('shot'); break;
    }
  },
};
