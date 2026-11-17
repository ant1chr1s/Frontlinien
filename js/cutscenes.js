'use strict';
// ===================== Zwischensequenzen der Kampagne =====================
// Jede Sequenz besteht aus Einstellungen (shots). Gezeichnet wird deterministisch aus der Zeit t,
// damit dieselbe Sequenz live im Spiel und als MP4 identisch aussieht.
const CS_COL = { A: '#4fc3f7', D: '#ef5350', K: '#ce93d8', N: '#e0e0e0', X: '#ffd54f' };
const SPEAKERS = {
  erz: { name: 'Erzähler', col: '#e0e0e0', pitch: 0.95, rate: 0.95 },
  whit: { name: 'General Eleanor Whitmore', col: '#4fc3f7', pitch: 1.15, rate: 1.0, female: true },
  orlow: { name: 'Marschall Viktor Orlow', col: '#ef5350', pitch: 0.55, rate: 0.9 },
  stimme: { name: 'Die Stimme des Schwarms', col: '#ce93d8', pitch: 0.1, rate: 0.75 },
  funk: { name: 'Funkspruch', col: '#ffd54f', pitch: 1.05, rate: 1.1 },
  hq: { name: 'Hauptquartier', col: '#80cbc4', pitch: 0.9, rate: 1.05 },
};
const S = (type, dur, p, who, txt) => ({ type, dur, p: p || {}, who, txt });

const CUTSCENES = {
  // ---------------- Allianz ----------------
  A_intro: { fac: 'A', title: 'Operation Morgenrot', before: 'A1', shots: [
    S('space', 7, { meteors: 9, seed: 1 }, 'erz', 'Im Jahr 2061 geht ein Meteoritenschwarm über der Erde nieder.'),
    S('crater', 7, { seed: 2, col: '#4dd0e1' }, 'erz', 'In den Kratern wächst Ätherit – ein Kristall voller Energie. Die alte Weltordnung zerbricht am Streit darum.'),
    S('city', 7, { style: 'west', seed: 3, lights: 1 }, 'erz', 'London. Die Forschungsstaaten der Allianz rüsten sich für den Krieg.'),
    S('portrait', 8, { who: 'whit', fac: 'A' }, 'whit', 'Kommandant, das Dominion marschiert auf die Krater zu. Wir müssen sie zuerst erreichen.'),
    S('army', 7, { fac: 'A', seed: 5, sky: 'dawn' }, 'whit', 'Ab heute gilt Operation Morgenrot. Wir bringen das Licht zurück in diese Welt.'),
    S('title', 5, { fac: 'A', big: 'OPERATION MORGENROT', sub: 'Eine Kampagne der Allianz' }),
  ] },
  A_mid1: { fac: 'A', title: 'Das Erwachen', before: 'A5', shots: [
    S('crater', 6, { seed: 7, col: '#4dd0e1', humans: 1, pulse: 1 }, 'funk', 'Basis, hier Bohrtrupp Sieben. Der Kristall … er pulsiert. Wie ein Herzschlag.'),
    S('radio', 3, { seed: 8 }, 'funk', 'Er bewegt sich! Er – …'),
    S('swarm', 7, { seed: 9, eyes: 1 }, 'erz', 'Im Ätherit hat etwas geschlafen. Jetzt ist es erwacht.'),
    S('portrait', 8, { who: 'whit', fac: 'A', alarm: 1 }, 'whit', 'Lebewesen aus dem Kristall. Was immer sie sind – sie greifen an. Säubern Sie den Krater, Kommandant.'),
    S('battle', 7, { a: 'A', b: 'K', seed: 10 }),
  ] },
  A_mid2: { fac: 'A', title: 'Belagerung', before: 'A11', shots: [
    S('map', 7, { target: 'west', arrows: ['D', 'K'], seed: 11 }, 'hq', 'Dominion-Verbände im Osten. Schwarmbewegungen im Süden. Beide Kurse führen nach London.'),
    S('city', 7, { style: 'west', seed: 12, attack: 1 }, 'erz', 'Zum ersten Mal seit einem Jahrhundert fallen Bomben auf die Hauptstadt.'),
    S('portrait', 8, { who: 'whit', fac: 'A', alarm: 1 }, 'whit', 'Die Schildgeneratoren brauchen zehn Minuten. Halten Sie die Linie – egal, was kommt.'),
    S('battle', 7, { a: 'A', b: 'D', seed: 13, night: 1 }),
  ] },
  A_mid3: { fac: 'A', title: 'Allianz der Not', before: 'A13', shots: [
    S('portrait', 8, { who: 'orlow', fac: 'D' }, 'orlow', 'Whitmore. Der Schwarm hat meine Ostfront gefressen. Ich biete einen Waffenstillstand an.'),
    S('portrait', 7, { who: 'whit', fac: 'A' }, 'whit', 'Ich traue Ihnen nicht, Orlow. Aber ich traue dem Schwarm noch weniger. Einverstanden.'),
    S('army', 7, { fac: 'A', fac2: 'D', seed: 15, sky: 'dusk' }, 'erz', 'Zum ersten Mal rollen blaue und rote Panzer Seite an Seite.'),
    S('swarm', 6, { seed: 16, nest: 1 }, 'erz', 'Ihr Ziel: die Brutnester im Tal der vier Flüsse.'),
  ] },
  A_end: { fac: 'A', title: 'Morgenrot', after: 'A15', shots: [
    S('battle', 7, { a: 'A', b: 'K', seed: 17, big: 1 }, 'erz', 'Die letzte Schlacht um das Ätherit dauerte drei Tage.'),
    S('crater', 6, { seed: 18, col: '#4dd0e1', dying: 1 }, 'erz', 'Dann erlosch das Leuchten in den Kratern.'),
    S('sunrise', 8, { fac: 'A', seed: 19 }, 'whit', 'Sehen Sie, Kommandant? Die Sonne geht auf. Über einer freien Welt.'),
    S('portrait', 7, { who: 'whit', fac: 'A', calm: 1 }, 'whit', 'London dankt Ihnen. Und ich … ich danke Ihnen auch.'),
    S('title', 6, { fac: 'A', big: 'OPERATION MORGENROT', sub: 'Kampagne abgeschlossen' }),
  ] },
  // ---------------- Dominion ----------------
  D_intro: { fac: 'D', title: 'Eiserner Sturm', before: 'D1', shots: [
    S('space', 7, { meteors: 9, seed: 21 }, 'erz', 'Im Jahr 2061 fällt Feuer vom Himmel.'),
    S('crater', 7, { seed: 22, col: '#ff8a65' }, 'erz', 'Aus der Asche wächst Ätherit. Wer es besitzt, besitzt die Zukunft.'),
    S('city', 7, { style: 'east', seed: 23, lights: 1 }, 'erz', 'Im Osten erhebt sich das Dominion – ein Imperium aus Stahl, Kohle und Disziplin.'),
    S('portrait', 8, { who: 'orlow', fac: 'D' }, 'orlow', 'Die Allianz glaubt, das Ätherit gehöre den Klugen. Es gehört den Starken.'),
    S('army', 7, { fac: 'D', seed: 25, sky: 'storm' }, 'orlow', 'Genosse Kommandant: Entfesseln Sie den Sturm.'),
    S('title', 5, { fac: 'D', big: 'EISERNER STURM', sub: 'Eine Kampagne des Dominion' }),
  ] },
  D_mid1: { fac: 'D', title: 'Das Erwachen', before: 'D5', shots: [
    S('crater', 6, { seed: 27, col: '#ff8a65', humans: 1, pulse: 1 }, 'funk', 'Krater Sieben an Zentrale. Die Bohrer stecken fest. Irgendetwas … hält sie fest.'),
    S('radio', 3, { seed: 28 }, 'funk', 'Es kommt heraus! Feuer! Feuer!'),
    S('swarm', 7, { seed: 29, eyes: 1 }, 'erz', 'Die Bergleute von Krater Sieben kehrten nie zurück.'),
    S('portrait', 8, { who: 'orlow', fac: 'D', alarm: 1 }, 'orlow', 'Ich will keine Erklärungen. Ich will Flammenwerfer. Verbrennen Sie es. Verbrennen Sie alles.'),
    S('battle', 7, { a: 'D', b: 'K', seed: 30 }),
  ] },
  D_mid2: { fac: 'D', title: 'Moskaus Schild', before: 'D11', shots: [
    S('map', 7, { target: 'east', arrows: ['A', 'K'], seed: 31 }, 'hq', 'Allianz-Bomber über der Westgrenze. Schwarmtunnel unter der Steppe. Ziel: die Hauptstadt.'),
    S('city', 7, { style: 'east', seed: 32, attack: 1 }, 'erz', 'Die Glocken der Hauptstadt läuten Sturm.'),
    S('portrait', 8, { who: 'orlow', fac: 'D', alarm: 1 }, 'orlow', 'Zehn Minuten, bis der Eiserne Wall steht. Wer zurückweicht, braucht nicht zurückzukommen.'),
    S('battle', 7, { a: 'D', b: 'A', seed: 33, night: 1 }),
  ] },
  D_mid3: { fac: 'D', title: 'Unheilige Allianz', before: 'D13', shots: [
    S('portrait', 7, { who: 'whit', fac: 'A' }, 'whit', 'Orlow. Wir haben beide zu viele Männer an den Schwarm verloren. Ein Waffenstillstand – bis die Nester brennen.'),
    S('portrait', 8, { who: 'orlow', fac: 'D' }, 'orlow', 'Ein Waffenstillstand. Nicht mehr. Und danach, Whitmore, sprechen wieder die Kanonen.'),
    S('army', 7, { fac: 'D', fac2: 'A', seed: 35, sky: 'dusk' }, 'erz', 'Rot und Blau marschieren gemeinsam – misstrauisch, mit dem Finger am Abzug.'),
    S('swarm', 6, { seed: 36, nest: 1 }, 'erz', 'Vor ihnen: die Brutnester des Kollektivs.'),
  ] },
  D_end: { fac: 'D', title: 'Eiserner Sturm', after: 'D15', shots: [
    S('battle', 7, { a: 'D', b: 'A', seed: 37, big: 1 }, 'erz', 'Als der Waffenstillstand zerbrach, stand das Dominion bereit.'),
    S('nuke', 7, { seed: 38 }, 'erz', 'Der Eiserne Sturm fegte über die Ebenen.'),
    S('sunrise', 8, { fac: 'D', seed: 39 }, 'orlow', 'Sehen Sie diesen roten Morgen, Kommandant? Er gehört uns. Die ganze Welt gehört uns.'),
    S('portrait', 7, { who: 'orlow', fac: 'D', calm: 1 }, 'orlow', 'Das Vaterland wird Ihren Namen nicht vergessen. Ruhen Sie sich aus. Morgen bauen wir ein Imperium.'),
    S('title', 6, { fac: 'D', big: 'EISERNER STURM', sub: 'Kampagne abgeschlossen' }),
  ] },
  // ---------------- Kollektiv ----------------
  K_intro: { fac: 'K', title: 'Das Erwachen', before: 'K1', shots: [
    S('space', 7, { meteors: 6, seed: 41, inside: 1 }, 'stimme', 'Wir reisten lange. Durch Kälte. Durch Dunkelheit.'),
    S('crater', 7, { seed: 42, col: '#ba68c8', pulse: 1 }, 'stimme', 'Wir fielen auf eine warme Welt. Wir schliefen. Wir wuchsen.'),
    S('crater', 6, { seed: 43, col: '#ba68c8', humans: 1, drills: 1 }, 'stimme', 'Dann kamen die kleinen, warmen Wesen. Sie bohren in unseren Körper. Sie verbrennen ihn.'),
    S('portrait', 8, { who: 'stimme', fac: 'K' }, 'stimme', 'Erwache, Knoten. Wachse. Lerne. Überlebe.'),
    S('swarm', 6, { seed: 45, eyes: 1, nest: 1 }),
    S('title', 5, { fac: 'K', big: 'DAS ERWACHEN', sub: 'Eine Kampagne des Kollektivs' }),
  ] },
  K_mid1: { fac: 'K', title: 'Lichter am Himmel', before: 'K5', shots: [
    S('city', 6, { style: 'west', seed: 47, lights: 1, alien: 1 }, 'stimme', 'Andere Fremde. Sie bauen Türme aus Licht.'),
    S('army', 7, { fac: 'A', seed: 48, sky: 'night', jets: 1 }, 'stimme', 'Sie fliegen. Sie sehen viel. Zu viel.'),
    S('portrait', 8, { who: 'stimme', fac: 'K' }, 'stimme', 'Ein Auge, das fliegt, ist ein Auge, das fällt. Mache sie blind – und dann stumm.'),
    S('battle', 6, { a: 'K', b: 'A', seed: 50 }),
  ] },
  K_mid2: { fac: 'K', title: 'Belagerung des Nests', before: 'K11', shots: [
    S('map', 7, { target: 'nest', arrows: ['A', 'D'], seed: 51 }, 'stimme', 'Sie haben sich verbündet. Blau und Rot. Gegen uns.'),
    S('swarm', 7, { seed: 52, nest: 1, attack: 1 }, 'stimme', 'Feuer fällt auf das große Nest. Die Königin schläft noch.'),
    S('portrait', 8, { who: 'stimme', fac: 'K', alarm: 1 }, 'stimme', 'Zehn Zyklen. Halte zehn Zyklen. Dann erwacht sie – und mit ihr unser ganzer Körper.'),
    S('battle', 7, { a: 'K', b: 'D', seed: 54, night: 1 }),
  ] },
  K_mid3: { fac: 'K', title: 'Verrat', before: 'K13', shots: [
    S('crater', 6, { seed: 55, col: '#ba68c8', humans: 1, cage: 1 }, 'stimme', 'Ein Teil von uns wurde getrennt. Gefangen. Benutzt.'),
    S('radio', 3, { seed: 56, alien: 1 }, 'stimme', '… hörst … du … uns …'),
    S('portrait', 8, { who: 'stimme', fac: 'K', alarm: 1 }, 'stimme', 'Die Fremden zwingen ihn, gegen uns zu kämpfen. Hole ihn zurück. Und strafe sie.'),
    S('army', 6, { fac: 'K', seed: 58, sky: 'night' }),
  ] },
  K_end: { fac: 'K', title: 'Ein Bewusstsein', after: 'K15', shots: [
    S('battle', 7, { a: 'K', b: 'A', seed: 59, big: 1 }, 'stimme', 'Sie kämpften tapfer. Für kleine Wesen.'),
    S('swarm', 6, { seed: 60, nest: 1, eyes: 1 }, 'stimme', 'Nun sind ihre Städte still. Ihre Türme gehören uns.'),
    S('sunrise', 8, { fac: 'K', seed: 61 }, 'stimme', 'Die warme Welt glüht in unserer Farbe.'),
    S('portrait', 7, { who: 'stimme', fac: 'K', calm: 1 }, 'stimme', 'Es gibt keine Stimmen mehr. Nur noch eine. Unsere.'),
    S('title', 6, { fac: 'K', big: 'EIN BEWUSSTSEIN', sub: 'Kampagne abgeschlossen' }),
  ] },
};
for (const id in CUTSCENES) { const c = CUTSCENES[id]; c.id = id; let t = 0; for (const s of c.shots) { s.t0 = t; t += s.dur; } c.dur = t; }
function cutsceneFor(missionId, when) { for (const id in CUTSCENES) { const c = CUTSCENES[id]; if ((when === 'before' ? c.before : c.after) === missionId) return c; } return null; }

// ---------- Hilfen ----------
function csRng(seed) { let a = seed * 2654435761 >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ease = (x) => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
function grad(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function glow(ctx, x, y, r, col, a = 1) { if (r <= 0) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }
function stars(ctx, w, h, seed, n, drift = 0) { const r = csRng(seed); for (let i = 0; i < n; i++) { const x = (r() * w + drift * (0.3 + r())) % w, y = r() * h, s = r() * 1.6 + 0.3; ctx.globalAlpha = 0.4 + r() * 0.6; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, s, s); } ctx.globalAlpha = 1; }
function ridge(ctx, w, h, y, seed, col, amp, freq = 6) {
  const r = csRng(seed), ph = [r() * 6, r() * 6, r() * 6];
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) { const u = x / w; ctx.lineTo(x, y - amp * (0.5 * Math.sin(u * freq + ph[0]) + 0.3 * Math.sin(u * freq * 2.3 + ph[1]) + 0.2 * Math.sin(u * freq * 5.1 + ph[2]))); }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
}
function tank(ctx, x, y, s, dir, col, rim) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(-30, -8, 60, 12, 6); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-34, -8); ctx.lineTo(30, -8); ctx.lineTo(36, -16); ctx.lineTo(-28, -20); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(12, -18); ctx.lineTo(16, -28); ctx.lineTo(-10, -30); ctx.closePath(); ctx.fill();
  ctx.fillRect(12, -27, 34, 4);
  if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-28, -20); ctx.lineTo(36, -16); ctx.moveTo(-10, -30); ctx.lineTo(16, -28); ctx.lineTo(46, -27); ctx.stroke(); }
  ctx.restore();
}
function walker(ctx, x, y, s, dir, col, t, rim) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const a = Math.sin(t * 8 + i * 2.1) * 6; ctx.beginPath(); ctx.moveTo(-12 + i * 12, -14); ctx.lineTo(-18 + i * 12 + a, -6); ctx.lineTo(-14 + i * 12 + a, 4); ctx.stroke(); }
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -18, 24, 11, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(24, -22, 9, 7, 0.3, 0, Math.PI * 2); ctx.fill();
  glow(ctx, 28, -24, 9, rim || '#e1bee7', 0.9);
  ctx.restore();
}
function soldier(ctx, x, y, s, ph, col, dir = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const a = Math.sin(ph) * 5;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-a, 0); ctx.moveTo(0, -10); ctx.lineTo(a, 0); ctx.stroke();
  ctx.fillRect(-3, -22, 6, 13); ctx.beginPath(); ctx.arc(0, -26, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(0, -19, 12, 2); ctx.restore();
}
function jet(ctx, x, y, s, dir, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-20, -4); ctx.lineTo(-26, -12); ctx.lineTo(-30, -12); ctx.lineTo(-28, 0); ctx.lineTo(-30, 4); ctx.lineTo(-20, 4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-12, 16); ctx.lineTo(-16, 16); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
  glow(ctx, -30, 0, 10, '#ffb74d', 0.9); ctx.restore();
}
function boom(ctx, x, y, r, age) { // age 0..1
  if (age < 0 || age > 1) return;
  glow(ctx, x, y, r * 3 * (1 - age), '#fff3e0', (1 - age) * 0.8);
  const fr = r * (0.4 + age * 0.9);
  ctx.globalAlpha = (1 - age) * 0.95; ctx.fillStyle = grad(ctx, x, y - fr, x, y + fr, [[0, '#fff59d'], [0.4, '#ff9800'], [1, '#bf360c']]);
  ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.05 + x * 0.01, d = fr * 0.55 * (0.6 + age); ctx.moveTo(x + Math.cos(a) * d + fr * 0.55, y - age * r * 0.6 + Math.sin(a) * d * 0.7); ctx.arc(x + Math.cos(a) * d, y - age * r * 0.6 + Math.sin(a) * d * 0.7, fr * 0.55, 0, Math.PI * 2); } ctx.fill();
  ctx.strokeStyle = '#ffcc80'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 7; k++) { const a = -0.3 - k * 0.4, d0 = r * age * 2.2; ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); ctx.lineTo(x + Math.cos(a) * (d0 + 8), y + Math.sin(a) * (d0 + 8)); } ctx.stroke();
  ctx.globalAlpha = Math.min(1, age * 1.6) * (1 - age) * 0.8; ctx.fillStyle = '#3e3a36';
  ctx.beginPath(); ctx.arc(x, y - age * r * 1.4, fr * 1.15, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}
function smoke(ctx, x, y, t, seed, h, col = '40,36,34') {
  const r = csRng(seed); for (let i = 0; i < 9; i++) { const ph = (t * 0.12 + i / 9 + r() * 0.1) % 1, py = y - ph * h, px = x + Math.sin(ph * 5 + i) * 18 * ph + ph * 30; ctx.fillStyle = `rgba(${col},${0.35 * (1 - ph)})`; ctx.beginPath(); ctx.arc(px, py, 10 + ph * 40, 0, Math.PI * 2); ctx.fill(); }
}
function crystal(ctx, x, y, s, col, a) {
  ctx.save(); ctx.translate(x, y); glow(ctx, 0, -s * 0.6, s * 2.2, col, 0.45 * a);
  ctx.fillStyle = grad(ctx, -s * 0.3, -s * 1.6, s * 0.3, 0, [[0, '#ffffff'], [0.3, col], [1, '#1a1030']]);
  ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.35, -s * 0.4); ctx.lineTo(s * 0.2, 0); ctx.lineTo(-s * 0.2, 0); ctx.lineTo(-s * 0.35, -s * 0.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function explosionsFor(shot) { // deterministische Explosionen je Einstellung (auch für Ton)
  if (shot._ex) return shot._ex;
  const r = csRng(shot.p.seed || 1), ex = [];
  const n = shot.type === 'battle' ? (shot.p.big ? 16 : 10) : shot.type === 'city' && shot.p.attack ? 8 : shot.type === 'swarm' && shot.p.attack ? 6 : 0;
  for (let i = 0; i < n; i++) ex.push({ t: 0.4 + (i / n) * (shot.dur - 1.2) + r() * 0.5, x: 0.08 + r() * 0.84, y: 0.55 + r() * 0.2, r: 0.03 + r() * 0.05 });
  return (shot._ex = ex);
}
function shotSfx(shot) {
  const s = explosionsFor(shot).map(e => [e.t, e.r > 0.065 ? 'big' : 'boom']);
  if (shot.type === 'nuke') s.push([2.2, 'big'], [2.6, 'big']);
  if (shot.type === 'radio') s.push([0.05, 'static']);
  if (shot.type === 'space') { const r = csRng(shot.p.seed); for (let i = 0; i < (shot.p.meteors || 6); i++) { const t0 = r() * shot.dur * 0.8; r(); r(); if (i % 3 === 0) s.push([t0 + 1.4, 'boom']); } }
  if (shot.type === 'title') s.push([0.1, 'big']);
  return s;
}

// ---------- Szenen ----------
const SCN = {
  space(ctx, w, h, t, p, sh) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#02030a'], [1, '#0a0f24']]); ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h, p.seed, 260, t * 6);
    glow(ctx, w * 0.8, h * 0.2, h * 0.5, 'rgba(120,80,200,0.25)');
    const R = w * 1.1, cx = w * 0.5, cy = h + R * 0.72 - t * h * 0.01;
    glow(ctx, cx, cy, R * 1.08, 'rgba(80,170,255,0.55)');
    ctx.fillStyle = grad(ctx, 0, cy - R, 0, cy - R + h * 0.4, [[0, '#2a6fb0'], [0.15, '#123b6b'], [1, '#04101f']]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    // Landmassen-Andeutung
    const r0 = csRng(p.seed + 5); ctx.fillStyle = 'rgba(40,90,60,0.5)'; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (r0() - 0.5) * 0.9 + t * 0.004; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97, 40 + r0() * 90, 8 + r0() * 14, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill(); }
    const r = csRng(p.seed);
    for (let i = 0; i < (p.meteors || 6); i++) {
      const t0 = r() * sh.dur * 0.8, sx = w * (0.55 + r() * 0.6), sy = -h * 0.1 + r() * h * 0.3, ex = w * (0.15 + r() * 0.6);
      const k = (t - t0) / 1.5; if (k < 0 || k > 1.3) continue;
      const q = Math.min(1, k), x = sx + (ex - sx) * q, y = sy + (h * 0.78 - sy) * q;
      if (k <= 1) { ctx.strokeStyle = grad(ctx, x, y, x + (sx - ex) * 0.25, y - (h * 0.78 - sy) * 0.25, [[0, p.inside ? 'rgba(220,160,255,0.95)' : 'rgba(255,220,150,0.95)'], [1, 'rgba(255,120,40,0)']]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (sx - ex) * 0.25, y - (h * 0.78 - sy) * 0.25); ctx.stroke(); glow(ctx, x, y, 22, p.inside ? '#e1bee7' : '#fff3e0'); }
      else glow(ctx, x, y, 60 * (1.3 - k) / 0.3, 'rgba(255,170,90,0.9)');
    }
  },
  crater(ctx, w, h, t, p, sh) {
    const col = p.col || '#4dd0e1', dying = p.dying ? ease(t / sh.dur) : 0;
    ctx.fillStyle = grad(ctx, 0, 0, 0, h * 0.6, [[0, '#070912'], [1, '#2b2140']]); ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h * 0.5, p.seed, 120);
    ridge(ctx, w, h, h * 0.5, p.seed + 1, '#16121f', h * 0.08, 4);
    ctx.fillStyle = '#1d1a24'; ctx.fillRect(0, h * 0.55, w, h);
    const cx = w * 0.5, cy = h * 0.68;
    ctx.fillStyle = '#0c0a12'; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.36, h * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a3348'; ctx.lineWidth = 6; ctx.stroke();
    const pulse = p.pulse ? 0.5 + 0.5 * Math.sin(t * 3.2) ** 2 : 0.8;
    const a = (0.5 + pulse * 0.5) * (1 - dying * 0.95);
    glow(ctx, cx, cy, w * 0.35, hexA(col.length === 7 ? col : '#4dd0e1', 0.5), a);
    const r = csRng(p.seed + 3);
    for (let i = 0; i < 26; i++) { const u = r() * 2 - 1, v = r() * 2 - 1; if (u * u + v * v > 1) continue; crystal(ctx, cx + u * w * 0.3, cy + v * h * 0.1, 18 + r() * 34, col, a); }
    // Teilchen
    for (let i = 0; i < 40; i++) { const ph = (t * 0.15 + r()) % 1, x = cx + (r() - 0.5) * w * 0.55; ctx.fillStyle = hexA(col, (1 - ph) * 0.8 * a); ctx.fillRect(x + Math.sin(ph * 9 + i) * 10, cy - ph * h * 0.5, 2, 2); }
    if (p.humans) {
      for (let i = 0; i < 6; i++) soldier(ctx, w * (0.16 + i * 0.03) + Math.sin(i) * 8, h * 0.83 + (i % 2) * 8, 1.6, t * 2 + i, '#0a0a0a');
      // Bohrturm
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 5; const bx = w * 0.72, by = h * 0.62; ctx.beginPath(); ctx.moveTo(bx - 40, by + 60); ctx.lineTo(bx, by - 120); ctx.lineTo(bx + 40, by + 60); ctx.moveTo(bx - 28, by); ctx.lineTo(bx + 28, by); ctx.moveTo(bx, by - 120); ctx.lineTo(bx, by + 40 + (p.drills ? Math.sin(t * 10) * 4 : 0)); ctx.stroke();
      glow(ctx, bx, by - 120, 14, '#ff5252', 0.5 + 0.5 * Math.sin(t * 4));
    }
    if (p.cage) { ctx.strokeStyle = '#222'; ctx.lineWidth = 4; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(cx - 90 + i * 22, cy - 150); ctx.lineTo(cx - 90 + i * 22, cy + 10); ctx.stroke(); } ctx.strokeRect(cx - 95, cy - 155, 190, 165); }
    if (p.pulse && t > sh.dur - 2.5) { const k = (t - (sh.dur - 2.5)) / 2.5; ctx.save(); ctx.translate(cx, cy - 10); ctx.fillStyle = hexA(col, k); ctx.beginPath(); ctx.ellipse(0, 0, 70 * k, 26 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(10,0,20,${k})`; ctx.beginPath(); ctx.ellipse(0, 0, 9 * k, 22 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  },
  city(ctx, w, h, t, p, sh) {
    const east = p.style === 'east', att = p.attack;
    ctx.fillStyle = grad(ctx, 0, 0, 0, h, att ? [[0, '#1a0805'], [0.6, '#5a1e0a'], [1, '#c2410c']] : [[0, '#050a18'], [0.7, '#14244a'], [1, '#2c3e70']]); ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h * 0.5, p.seed, att ? 30 : 150);
    if (p.alien) glow(ctx, w * 0.5, h * 0.2, h * 0.4, 'rgba(206,147,216,0.35)');
    // Suchscheinwerfer
    if (p.lights || att) for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + Math.sin(t * 0.6 + i * 1.7) * 0.5, x = w * (0.15 + i * 0.23); ctx.fillStyle = grad(ctx, x, h * 0.8, x + Math.cos(a) * h, h * 0.8 + Math.sin(a) * h, [[0, 'rgba(255,250,220,0.35)'], [1, 'rgba(255,250,220,0)']]); ctx.beginPath(); ctx.moveTo(x, h * 0.8); ctx.lineTo(x + Math.cos(a - 0.03) * h * 1.2, h * 0.8 + Math.sin(a - 0.03) * h * 1.2); ctx.lineTo(x + Math.cos(a + 0.03) * h * 1.2, h * 0.8 + Math.sin(a + 0.03) * h * 1.2); ctx.fill(); }
    const r = csRng(p.seed), drift = t * 4;
    for (const [layer, base, colr, hmax] of [[0, 0.62, '#0b1020', 0.28], [1, 0.72, '#05070e', 0.38]]) {
      let x = -drift * (layer + 1) % 60 - 60;
      while (x < w + 60) {
        const bw = 30 + r() * 70, bh = h * (0.08 + r() * hmax), y = h * base + h * 0.2 - bh;
        ctx.fillStyle = colr; ctx.fillRect(x, y, bw, h - y);
        if (east && r() < 0.18) { ctx.beginPath(); ctx.ellipse(x + bw / 2, y - 14, bw * 0.32, 22, 0, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + bw / 2 - 4, y - 34); ctx.lineTo(x + bw / 2, y - 60); ctx.lineTo(x + bw / 2 + 4, y - 34); ctx.fill(); }
        if (!east && layer === 1 && r() < 0.06) { ctx.fillRect(x + bw / 2 - 12, y - h * 0.22, 24, h * 0.22); ctx.beginPath(); ctx.moveTo(x + bw / 2 - 14, y - h * 0.22); ctx.lineTo(x + bw / 2, y - h * 0.3); ctx.lineTo(x + bw / 2 + 14, y - h * 0.22); ctx.fill(); glow(ctx, x + bw / 2, y - h * 0.18, 14, 'rgba(255,240,180,0.9)'); }
        for (let wy = y + 8; wy < h * 0.95; wy += 12) for (let wx = x + 5; wx < x + bw - 6; wx += 10) if (r() < (att ? 0.15 : 0.3)) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,214,120,0.8)' : 'rgba(170,210,255,0.6)'; ctx.fillRect(wx, wy, 4, 5); }
        x += bw + 4;
      }
    }
    if (att) {
      for (let i = 0; i < 5; i++) { const ph = ((t * 0.25 + i * 0.2) % 1); jet(ctx, w * (1.1 - ph * 1.3), h * (0.15 + i * 0.05), 0.9, -1, '#0a0a0a'); }
      for (let i = 0; i < 12; i++) { const ph = (t * 1.3 + i * 0.37) % 1, x = w * ((i * 0.083) % 1); ctx.strokeStyle = `rgba(255,220,120,${1 - ph})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, h * (0.9 - ph * 0.7)); ctx.lineTo(x + 6, h * (0.86 - ph * 0.7)); ctx.stroke(); }
      for (const e of explosionsFor(sh)) boom(ctx, e.x * w, e.y * h, e.r * w, (t - e.t) / 1.6);
      smoke(ctx, w * 0.3, h * 0.75, t, p.seed, h * 0.6); smoke(ctx, w * 0.7, h * 0.78, t, p.seed + 1, h * 0.6);
    }
    ctx.fillStyle = '#020306'; ctx.fillRect(0, h * 0.94, w, h);
  },
  army(ctx, w, h, t, p, sh) {
    const sk = { dawn: [['#1b2a4a'], ['#e65100'], ['#ffcc80']], dusk: [['#120c24'], ['#7b1fa2'], ['#ff7043']], storm: [['#0b0b10'], ['#37282a'], ['#8d3b2f']], night: [['#02030a'], ['#0c1430'], ['#1d2b55']] }[p.sky || 'dawn'];
    ctx.fillStyle = grad(ctx, 0, 0, 0, h * 0.75, [[0, sk[0][0]], [0.6, sk[1][0]], [1, sk[2][0]]]); ctx.fillRect(0, 0, w, h);
    if (p.sky === 'night') stars(ctx, w, h * 0.6, p.seed, 180);
    if (p.sky === 'dawn' || p.sky === 'dusk') glow(ctx, w * 0.7, h * 0.66, h * 0.5, 'rgba(255,200,120,0.7)');
    if (p.sky === 'storm') for (let i = 0; i < 3; i++) { const k = (t * 0.7 + i * 0.33) % 1; if (k < 0.04) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 0, w, h); } }
    ridge(ctx, w, h, h * 0.62, p.seed, 'rgba(10,10,20,0.6)', h * 0.06, 3);
    ridge(ctx, w, h, h * 0.7, p.seed + 1, p.sky === 'night' ? '#151a2a' : '#3a2a22', h * 0.03, 8);
    const c1 = CS_COL[p.fac], c2 = CS_COL[p.fac2 || p.fac];
    const units = (fac, col, row, dir, off) => {
      for (let i = 0; i < 9; i++) {
        const x = ((i * 0.16 + t * 0.035 * dir + off) % 1.4 + 1.4) % 1.4 * w - w * 0.2, y = h * (0.8 + row * 0.12);
        const s = 2.0 + row * 1.0;
        if (fac === 'K') walker(ctx, x, y, s, dir, '#08060c', t + i, col);
        else if (i % 3 === 2) { for (let j = 0; j < 3; j++) soldier(ctx, x + j * 14 * s, y, s * 1.1, t * 7 + j + i, '#08080c', dir); }
        else tank(ctx, x, y, s, dir, '#08080c', col);
      }
      // Fahne
      const fs2 = 1 + row * 0.5, fx = ((0.3 + t * 0.035 * dir + off) % 1.4 + 1.4) % 1.4 * w - w * 0.2, fy = h * (0.8 + row * 0.12) - 120 * fs2;
      ctx.strokeStyle = '#08080c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + 115 * fs2); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx, fy); for (let k = 0; k <= 12; k++) ctx.lineTo(fx - dir * k * 6 * fs2, fy + Math.sin(t * 6 + k * 0.7) * 4); for (let k = 12; k >= 0; k--) ctx.lineTo(fx - dir * k * 6 * fs2, fy + 38 * fs2 + Math.sin(t * 6 + k * 0.7) * 4); ctx.fill();
    };
    units(p.fac, c1, 0, 1, 0);
    units(p.fac2 || p.fac, c2, 1, 1, 0.07);
    if (p.jets) for (let i = 0; i < 4; i++) { const ph = (t * 0.18 + i * 0.12) % 1.2; jet(ctx, w * (ph * 1.2 - 0.1), h * (0.18 + i * 0.06), 1.2, 1, '#0a0a10'); }
    ctx.fillStyle = 'rgba(160,120,90,0.12)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(w * ((i * 0.2 + t * 0.03) % 1.2), h * 0.88, 120, 18, 0, 0, Math.PI * 2); ctx.fill(); }
  },
  battle(ctx, w, h, t, p, sh) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, h * 0.7, p.night ? [[0, '#020208'], [1, '#1b1420']] : [[0, '#3b2a24'], [1, '#a15a2a']]); ctx.fillRect(0, 0, w, h);
    smoke(ctx, w * 0.2, h * 0.6, t, p.seed, h * 0.6); smoke(ctx, w * 0.55, h * 0.6, t, p.seed + 2, h * 0.7); smoke(ctx, w * 0.85, h * 0.6, t, p.seed + 3, h * 0.5);
    ridge(ctx, w, h, h * 0.62, p.seed, '#2a1e18', h * 0.04, 5);
    ctx.fillStyle = grad(ctx, 0, h * 0.64, 0, h, p.night ? [[0, '#231c26'], [1, '#0d0a10']] : [[0, '#7a5236'], [1, '#2e1f16']]); ctx.fillRect(0, h * 0.64, w, h);
    const ca = CS_COL[p.a], cb = CS_COL[p.b];
    // Leuchtspur
    for (let i = 0; i < 26; i++) { const ph = (t * 1.6 + i * 0.27) % 1, y = h * (0.7 + (i % 5) * 0.035); const left = i % 2 === 0; const x0 = left ? w * 0.12 : w * 0.88, x1 = left ? w * 0.88 : w * 0.12; const x = x0 + (x1 - x0) * ph; ctx.strokeStyle = left ? ca : cb; ctx.globalAlpha = 0.9; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - ph * 20); ctx.lineTo(x + (left ? -24 : 24), y - ph * 20); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) { const x = w * (0.05 + i * 0.07) + Math.sin(t + i) * 6, y = h * (0.74 + (i % 3) * 0.08); if (p.a === 'K') walker(ctx, x, y, 2.4, 1, '#0a0806', t + i, ca); else tank(ctx, x, y, 2.2, 1, '#0a0806', ca); }
    for (let i = 0; i < 6; i++) { const x = w * (0.95 - i * 0.07) + Math.sin(t + i) * 6, y = h * (0.74 + (i % 3) * 0.08); if (p.b === 'K') walker(ctx, x, y, 2.4, -1, '#0a0806', t + i, cb); else tank(ctx, x, y, 2.2, -1, '#0a0806', cb); }
    for (const e of explosionsFor(sh)) boom(ctx, e.x * w, e.y * h, e.r * w, (t - e.t) / 1.5);
  },
  portrait(ctx, w, h, t, p, sh) {
    const col = CS_COL[p.fac], who = p.who;
    ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#04070c'], [1, '#0c1520']]); ctx.fillRect(0, 0, w, h);
    // Lagezentrum im Hintergrund
    const r = csRng(9); for (let i = 0; i < 18; i++) { const x = r() * w, y = h * (0.15 + r() * 0.4), bw = 60 + r() * 120, bh = 40 + r() * 60; ctx.fillStyle = hexA(col, 0.06 + 0.05 * Math.sin(t * 2 + i)); ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = hexA(col, 0.18); ctx.strokeRect(x, y, bw, bh); }
    if (p.alarm) { ctx.fillStyle = `rgba(255,30,30,${0.12 + 0.1 * Math.sin(t * 6)})`; ctx.fillRect(0, 0, w, h); }
    const cx = w * 0.5, cy = h * 0.68, s = h * 0.0034, talk = sh.txt && t < sh.dur - 0.8 ? Math.abs(Math.sin(t * 11) * Math.sin(t * 3.7)) : 0;
    glow(ctx, cx, cy - 40 * s, 220 * s, hexA(col, 0.35));
    ctx.save(); ctx.translate(cx, cy + Math.sin(t * 0.8) * 2 * s); ctx.scale(s, s);
    if (who === 'stimme') {
      // Wesen des Schwarms
      ctx.strokeStyle = '#4a148c'; ctx.lineWidth = 8;
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo((i - 3.5) * 22, 30); ctx.quadraticCurveTo((i - 3.5) * 40 + Math.sin(t * 2 + i) * 30, 110, (i - 3.5) * 60, 160); ctx.stroke(); }
      ctx.fillStyle = grad(ctx, 0, -160, 0, 60, [[0, '#6a1b9a'], [1, '#1a0526']]);
      ctx.beginPath(); ctx.moveTo(0, -170); ctx.bezierCurveTo(110, -150, 95, 20, 30, 60); ctx.lineTo(-30, 60); ctx.bezierCurveTo(-95, 20, -110, -150, 0, -170); ctx.fill();
      ctx.strokeStyle = 'rgba(225,190,231,0.35)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 24, -140); ctx.quadraticCurveTo(-50 + i * 20, -60, -40 + i * 16, 40); ctx.stroke(); }
      const eyes = [[-34, -50, 13], [34, -50, 13], [0, -92, 10], [-58, -96, 7], [58, -96, 7], [0, -20, 6]];
      for (const [ex, ey, er] of eyes) { const op = 0.6 + 0.4 * Math.sin(t * 2.5 + ex) + talk * 0.4; glow(ctx, ex, ey, er * 4, '#ea80fc', Math.min(1, op)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#4a0072'; ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.25, er * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    } else {
      const fem = who === 'whit', uni = who === 'whit' ? '#24364d' : '#3a3f2c', skin = who === 'whit' ? '#e6b89c' : '#d4a184';
      // Schultern & Uniform
      ctx.fillStyle = uni; ctx.beginPath(); ctx.moveTo(-170, 160); ctx.quadraticCurveTo(-160, 40, -60, 30); ctx.lineTo(60, 30); ctx.quadraticCurveTo(160, 40, 170, 160); ctx.fill();
      ctx.fillStyle = '#c9a227'; ctx.fillRect(-150, 48, 70, 10); ctx.fillRect(80, 48, 70, 10);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-40, 30); ctx.lineTo(0, 100); ctx.lineTo(40, 30); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#c62828', '#1565c0', '#fbc02d'][i]; ctx.fillRect(-120 + i * 16, 80, 12, 18); }
      // Hals & Kopf
      ctx.fillStyle = skin; ctx.fillRect(-22, 0, 44, 40);
      ctx.fillStyle = grad(ctx, -60, -120, 60, 30, [[0, skin], [1, '#8d5b45']]);
      ctx.beginPath(); ctx.moveTo(0, -128); ctx.bezierCurveTo(fem ? 62 : 72, -126, fem ? 62 : 74, -20, fem ? 26 : 36, 18); ctx.lineTo(fem ? -26 : -36, 18); ctx.bezierCurveTo(fem ? -62 : -74, -20, fem ? -62 : -72, -126, 0, -128); ctx.fill();
      if (fem) { ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.ellipse(0, -96, 66, 38, 0, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(52, -62, 18, 0, Math.PI * 2); ctx.fill(); }
      // Augen
      const blink = (t % 3.7) < 0.12 ? 0.15 : 1;
      for (const ex of [-24, 24]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, -58, 10, 5 * blink, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = fem ? '#1e88e5' : '#4e342e'; ctx.beginPath(); ctx.arc(ex, -58, 3.5 * blink, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#3e2723'; ctx.lineWidth = fem ? 3 : 6; ctx.beginPath(); ctx.moveTo(ex - 14, -72 - (p.alarm ? (ex < 0 ? -3 : 3) : 0)); ctx.lineTo(ex + 14, -72 + (p.alarm ? (ex < 0 ? -3 : 3) : 0)); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(80,40,30,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -55); ctx.lineTo(-6, -24); ctx.lineTo(4, -22); ctx.stroke();
      // Mund
      ctx.fillStyle = '#5a1f1a'; ctx.beginPath(); ctx.ellipse(0, -2, 15, 2 + talk * 8, 0, 0, Math.PI * 2); ctx.fill();
      if (!fem) { ctx.fillStyle = '#4e342e'; ctx.beginPath(); ctx.moveTo(-34, -6); ctx.quadraticCurveTo(0, -24, 34, -6); ctx.quadraticCurveTo(0, -14, -34, -6); ctx.fill(); }
      // Mütze
      ctx.fillStyle = uni; ctx.beginPath(); ctx.ellipse(0, -124, fem ? 70 : 86, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(fem ? -62 : -74, -116, fem ? 124 : 148, 12);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, -100, fem ? 58 : 66, 12, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(0, -126, 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Funk-Rahmen
    ctx.strokeStyle = hexA(col, 0.8); ctx.lineWidth = 3; const m = h * 0.14, L = 40;
    for (const [x, y, dx, dy] of [[m, m * 0.9, 1, 1], [w - m, m * 0.9, -1, 1], [m, h - m * 0.9, 1, -1], [w - m, h - m * 0.9, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke(); }
    ctx.fillStyle = hexA(col, 0.9); ctx.font = `bold ${Math.round(h * 0.024)}px monospace`; ctx.textAlign = 'left';
    ctx.fillText('● ÜBERTRAGUNG  ' + (SPEAKERS[who] ? SPEAKERS[who].name.toUpperCase() : ''), m + 12, m * 0.9 + 26);
    ctx.textAlign = 'right'; ctx.fillText('KANAL ' + (7 + (p.fac.charCodeAt(0) % 5)) + ' · VERSCHLÜSSELT', w - m - 12, m * 0.9 + 26);
  },
  radio(ctx, w, h, t, p, sh) {
    const r = csRng((p.seed * 1000 + Math.floor(t * 20)) | 0);
    ctx.fillStyle = '#050705'; ctx.fillRect(0, 0, w, h);
    const cell = 8; for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) { const v = r() * 70 | 0; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, cell, cell); }
    ctx.strokeStyle = p.alien ? '#ea80fc' : '#69f0ae'; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 0; x <= w; x += 6) { const y = h * 0.5 + Math.sin(x * 0.05 + t * 30) * h * 0.08 * r() + (r() - 0.5) * h * 0.06; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.fillStyle = 'rgba(255,82,82,0.9)'; ctx.font = `bold ${Math.round(h * 0.05)}px monospace`; ctx.textAlign = 'center'; if ((t * 3 | 0) % 2 === 0) ctx.fillText('SIGNAL VERLOREN', w / 2, h * 0.3);
  },
  swarm(ctx, w, h, t, p, sh) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#0d0212'], [1, '#2a0838']]); ctx.fillRect(0, 0, w, h);
    const r = csRng(p.seed);
    for (let i = 0; i < 22; i++) { const x = r() * w, y = r() * h, len = 120 + r() * 300, a0 = r() * 6.28; ctx.strokeStyle = `rgba(170,60,200,${0.15 + 0.15 * Math.sin(t * 2 + i)})`; ctx.lineWidth = 2 + r() * 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + Math.cos(a0) * len * 0.4, y + Math.sin(a0) * len * 0.4 + Math.sin(t + i) * 20, x + Math.cos(a0 + 1) * len * 0.7, y + Math.sin(a0 + 1) * len * 0.7, x + Math.cos(a0 + 0.5) * len, y + Math.sin(a0 + 0.5) * len); ctx.stroke(); }
    if (p.nest) { for (let i = 0; i < 7; i++) { const x = w * (0.1 + i * 0.13), hh = h * (0.25 + r() * 0.25); ctx.fillStyle = grad(ctx, x, h - hh, x, h, [[0, '#4a148c'], [1, '#12021a']]); ctx.beginPath(); ctx.moveTo(x - 60, h); ctx.quadraticCurveTo(x - 30, h - hh, x, h - hh - 20); ctx.quadraticCurveTo(x + 30, h - hh, x + 60, h); ctx.fill(); glow(ctx, x, h - hh + 10, 30, '#ea80fc', 0.5 + 0.4 * Math.sin(t * 3 + i)); } }
    if (p.eyes) { for (let i = 0; i < 14; i++) { const x = r() * w, y = h * (0.2 + r() * 0.5), s = 6 + r() * 14, open = ease((t - 0.3 - i * 0.25) * 2); if (open <= 0) continue; glow(ctx, x, y, s * 5, '#ea80fc', 0.6 * open); ctx.fillStyle = '#fde7ff'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.6 * open, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2a0038'; ctx.beginPath(); ctx.ellipse(x + Math.sin(t + i) * s * 0.3, y, s * 0.2, s * 0.5 * open, 0, 0, Math.PI * 2); ctx.fill(); } }
    for (let i = 0; i < 10; i++) { const ph = (t * 0.1 + i * 0.1) % 1; walker(ctx, w * (1.1 - ph * 1.3), h * (0.86 + (i % 3) * 0.04), 1.3, -1, '#0a020e', t + i, '#ea80fc'); }
    if (p.attack) for (const e of explosionsFor(sh)) boom(ctx, e.x * w, e.y * h * 0.9, e.r * w, (t - e.t) / 1.5);
  },
  map(ctx, w, h, t, p, sh) {
    ctx.fillStyle = '#04140c'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,255,160,0.12)'; ctx.lineWidth = 1; for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const r = csRng(p.seed);
    ctx.strokeStyle = 'rgba(105,240,174,0.55)'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); const cx = w * (0.2 + k * 0.3), cy = h * (0.3 + r() * 0.4); for (let a = 0; a <= 6.3; a += 0.3) { const rr = 90 + r() * 70; const x = cx + Math.cos(a) * rr * 1.4, y = cy + Math.sin(a) * rr; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.stroke(); }
    const tx = w * 0.5, ty = h * 0.5; const pr = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.strokeStyle = `rgba(255,213,79,${0.6 + 0.4 * pr})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, 26 + pr * 10, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd54f'; ctx.font = `bold ${Math.round(h * 0.03)}px monospace`; ctx.textAlign = 'center'; ctx.fillText(p.target === 'west' ? 'LONDON' : p.target === 'east' ? 'HAUPTSTADT' : 'GROSSES NEST', tx, ty - 50);
    (p.arrows || []).forEach((f, i) => {
      const a0 = i === 0 ? -0.3 : 2.4, sx = tx + Math.cos(a0) * w * 0.45, sy = ty + Math.sin(a0) * h * 0.45, k = ease(t / (sh.dur * 0.8));
      const ex = sx + (tx - sx) * k * 0.85, ey = sy + (ty - sy) * k * 0.85;
      ctx.strokeStyle = CS_COL[f]; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      const an = Math.atan2(ty - sy, tx - sx); ctx.fillStyle = CS_COL[f]; ctx.beginPath(); ctx.moveTo(ex + Math.cos(an) * 26, ey + Math.sin(an) * 26); ctx.lineTo(ex + Math.cos(an + 2.4) * 22, ey + Math.sin(an + 2.4) * 22); ctx.lineTo(ex + Math.cos(an - 2.4) * 22, ey + Math.sin(an - 2.4) * 22); ctx.fill();
      ctx.font = `bold ${Math.round(h * 0.026)}px monospace`; ctx.fillText(FACTIONS[f].name.toUpperCase(), sx, sy - 20);
      for (let j = 0; j < 8; j++) { const q = (k * 0.85 - j * 0.04); if (q < 0) continue; ctx.fillRect(sx + (tx - sx) * q + (r() - 0.5) * 40, sy + (ty - sy) * q + (r() - 0.5) * 40, 5, 5); }
    });
    // Sweep
    const sa = t * 1.5; ctx.fillStyle = 'rgba(105,240,174,0.08)'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.arc(tx, ty, w, sa, sa + 0.35); ctx.fill();
  },
  nuke(ctx, w, h, t, p, sh) {
    const k = t - 2.2;
    ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#1a0f0a'], [1, '#6b3a1e']]); ctx.fillRect(0, 0, w, h);
    ridge(ctx, w, h, h * 0.78, p.seed, '#120a06', h * 0.03, 6);
    if (k < 0) { const y = h * 0.1 + (h * 0.68) * (t / 2.2); ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.5, y - 60); ctx.lineTo(w * 0.5, y); ctx.stroke(); glow(ctx, w * 0.5, y, 20, '#fff'); return; }
    if (k < 0.5) { ctx.fillStyle = `rgba(255,255,255,${1 - k * 2})`; ctx.fillRect(0, 0, w, h); }
    const g = ease(k / 3.5), cx = w * 0.5, base = h * 0.78;
    ctx.fillStyle = grad(ctx, cx, base - h * 0.6 * g, cx, base, [[0, '#ffcc80'], [0.4, '#ff7043'], [1, '#4e342e']]);
    ctx.fillRect(cx - 30 - g * 20, base - h * 0.45 * g, 60 + g * 40, h * 0.45 * g);
    ctx.beginPath(); ctx.ellipse(cx, base - h * 0.48 * g, w * 0.18 * g + 20, h * 0.14 * g + 10, 0, 0, Math.PI * 2); ctx.fill();
    glow(ctx, cx, base - h * 0.45 * g, w * 0.4 * g + 40, 'rgba(255,200,120,0.6)');
    ctx.fillStyle = 'rgba(120,80,60,0.6)'; ctx.beginPath(); ctx.ellipse(cx, base, w * 0.5 * g, 24 * g + 2, 0, 0, Math.PI * 2); ctx.fill();
  },
  sunrise(ctx, w, h, t, p, sh) {
    const k = ease(t / sh.dur), fac = p.fac;
    const pal = fac === 'A' ? [['#0d1b3a', '#ff8a65', '#ffe0b2'], '#4fc3f7'] : fac === 'D' ? [['#1a0505', '#b71c1c', '#ff8a65'], '#ef5350'] : [['#0d0212', '#6a1b9a', '#f8bbd0'], '#ce93d8'];
    ctx.fillStyle = grad(ctx, 0, 0, 0, h * 0.75, [[0, pal[0][0]], [0.6, pal[0][1]], [1, pal[0][2]]]); ctx.fillRect(0, 0, w, h);
    const sy = h * (0.85 - k * 0.25); glow(ctx, w * 0.5, sy, h * 0.6, hexA(fac === 'K' ? '#f8bbd0' : '#ffe082', 0.8)); ctx.fillStyle = fac === 'K' ? '#fce4ec' : '#fff8e1'; ctx.beginPath(); ctx.arc(w * 0.5, sy, h * 0.08, 0, Math.PI * 2); ctx.fill();
    if (fac === 'K') { const r = csRng(p.seed); for (let i = 0; i < 30; i++) crystal(ctx, r() * w, h * (0.8 + r() * 0.15), 20 + r() * 50, '#ce93d8', 0.8); }
    ridge(ctx, w, h, h * 0.78, p.seed, '#0a0608', h * 0.03, 4);
    if (fac !== 'K') {
      const fx = w * 0.3, fy = h * 0.5; ctx.strokeStyle = '#0a0608'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(fx, h * 0.8); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.moveTo(fx, fy); for (let i = 0; i <= 14; i++) ctx.lineTo(fx + i * 9, fy + Math.sin(t * 3 + i * 0.6) * 6); for (let i = 14; i >= 0; i--) ctx.lineTo(fx + i * 9, fy + 70 + Math.sin(t * 3 + i * 0.6) * 6); ctx.fill();
      for (let i = 0; i < 5; i++) soldier(ctx, w * (0.55 + i * 0.06), h * 0.8, 2.2, 0, '#0a0608');
      tank(ctx, w * 0.82, h * 0.82, 2, -1, '#0a0608');
    }
  },
  title(ctx, w, h, t, p, sh) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const col = CS_COL[p.fac], k = ease(t / 1.2);
    glow(ctx, w / 2, h * 0.45, w * 0.5 * k, hexA(col, 0.4));
    // Emblem
    ctx.save(); ctx.translate(w / 2, h * 0.3); ctx.scale(k, k); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.fillStyle = hexA(col, 0.25);
    if (p.fac === 'A') { ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(42, -30); ctx.lineTo(36, 20); ctx.lineTo(0, 50); ctx.lineTo(-36, 20); ctx.lineTo(-42, -30); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); }
    else if (p.fac === 'D') { ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.lineTo(Math.cos(a) * 50, Math.sin(a) * 50); ctx.lineTo(Math.cos(a + 0.26) * 40, Math.sin(a + 0.26) * 40); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); }
    else { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 50, Math.sin(a) * 50); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 12, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // Chrom-Schrift der 90er
    const fs = Math.round(Math.min(w * 0.075, h * 0.12)); ctx.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`; ctx.textAlign = 'center';
    ctx.globalAlpha = k; ctx.fillStyle = grad(ctx, 0, h * 0.55 - fs, 0, h * 0.55, [[0, '#ffffff'], [0.45, '#b0bec5'], [0.5, '#37474f'], [0.55, col], [1, '#ffffff']]);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeText(p.big, w / 2, h * 0.58); ctx.fillText(p.big, w / 2, h * 0.58);
    const fx = w * (0.2 + 0.6 * ease((t - 0.6) / 2)); glow(ctx, fx, h * 0.58 - fs * 0.4, fs * 1.2, 'rgba(255,255,255,0.7)', Math.max(0, 1 - Math.abs(t - 1.6)));
    ctx.font = `${Math.round(fs * 0.32)}px sans-serif`; ctx.fillStyle = '#cfd8dc'; ctx.fillText(p.sub || '', w / 2, h * 0.68); ctx.globalAlpha = 1;
  },
};

// ---------- Gesamtbild einer Sequenz zum Zeitpunkt T ----------
function csFind(cs, T) { for (let i = cs.shots.length - 1; i >= 0; i--) if (T >= cs.shots[i].t0) return i; return 0; }
function drawCutscene(ctx, w, h, cs, T, opts = {}) {
  const i = csFind(cs, T), sh = cs.shots[i], t = T - sh.t0;
  const bar = Math.round(h * 0.07), bot = Math.round(h * 0.16), ih = h - bar - bot;
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.beginPath(); ctx.rect(0, bar, w, ih); ctx.clip(); ctx.translate(0, bar);
  // langsame Kamerafahrt
  const z = 1 + 0.06 * (t / sh.dur), px = (i % 2 ? -1 : 1) * 12 * (t / sh.dur);
  if (sh.type !== 'title' && sh.type !== 'radio') { ctx.translate(w / 2 + px, ih / 2); ctx.scale(z, z); ctx.translate(-w / 2, -ih / 2); }
  // Kamerawackeln bei Explosionen
  let shake = 0; for (const e of explosionsFor(sh)) { const a = t - e.t; if (a > 0 && a < 0.4) shake = Math.max(shake, (0.4 - a) * e.r * 120); }
  if (sh.type === 'nuke' && t > 2.2 && t < 3.2) shake = (3.2 - t) * 14;
  if (shake) ctx.translate(Math.sin(T * 91) * shake, Math.cos(T * 77) * shake);
  try { (SCN[sh.type] || SCN.title)(ctx, w, ih, t, sh.p, sh); } catch (e) { }
  ctx.restore();
  // Abblenden
  const fin = Math.min(1, t / 0.45), fout = Math.min(1, (sh.dur - t) / 0.45), a = 1 - Math.min(fin, fout);
  if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, bar, w, ih); }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bot, w, bot);
  // Scanlines + Vignette (90er-FMV)
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = bar; y < h - bot; y += 3) ctx.fillRect(0, y, w, 1);
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.65); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, bar, w, ih);
  // Untertitel
  if (sh.txt) {
    const sp = SPEAKERS[sh.who] || SPEAKERS.erz, fs = Math.max(14, Math.round(h * 0.034)), la = Math.min(1, t / 0.5) * Math.min(1, (sh.dur - t) / 0.4);
    ctx.globalAlpha = Math.max(0, la); ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(fs * 0.8)}px sans-serif`; ctx.fillStyle = sp.col; ctx.fillText(sp.name, w / 2, h - bot + fs * 1.1);
    ctx.font = `${fs}px sans-serif`; ctx.fillStyle = '#fff';
    const lines = []; let cur = ''; for (const wd of sh.txt.split(' ')) { const nx = cur ? cur + ' ' + wd : wd; if (ctx.measureText(nx).width > w * 0.86 && cur) { lines.push(cur); cur = wd; } else cur = nx; } if (cur) lines.push(cur);
    lines.slice(0, 3).forEach((l, k) => ctx.fillText(l, w / 2, h - bot + fs * 2.3 + k * fs * 1.2));
    ctx.globalAlpha = 1;
  }
  // Kapitel-Titel oben
  if (T < 4 && i === 0) { ctx.globalAlpha = Math.min(1, T / 0.6) * Math.min(1, (4 - T) / 0.8); ctx.fillStyle = CS_COL[cs.fac]; ctx.font = `bold ${Math.round(h * 0.03)}px sans-serif`; ctx.textAlign = 'left'; ctx.fillText(cs.title.toUpperCase(), w * 0.04, bar * 0.62); ctx.globalAlpha = 1; }
  if (opts.skipHint) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `${Math.round(h * 0.022)}px sans-serif`; ctx.textAlign = 'right'; ctx.fillText(opts.skipHint, w * 0.97, bar * 0.62); }
}

// ---------- Abspieler im Spiel ----------
const CutscenePlayer = {
  mode() { return lsGetA('csMode') || 'live'; },
  play(cs, done) {
    if (!cs) { done && done(); return; }
    this.done = done; this.cs = cs;
    const el = document.getElementById('cutscene'), cv = document.getElementById('csCanvas'), vid = document.getElementById('csVideo');
    el.classList.remove('hidden');
    SND.start();
    const finish = () => this.stop();
    document.getElementById('csSkip').onclick = finish;
    if (this.mode() === 'video') {
      cv.classList.add('hidden'); vid.classList.remove('hidden');
      vid.src = 'assets/videos/' + cs.id + '.mp4'; vid.currentTime = 0;
      SND.stop();
      vid.onended = finish;
      vid.onerror = () => { vid.classList.add('hidden'); this.live(cs); };
      const pr = vid.play(); if (pr && pr.catch) pr.catch(() => { vid.classList.add('hidden'); this.live(cs); });
      return;
    }
    vid.classList.add('hidden'); this.live(cs);
  },
  live(cs) {
    const cv = document.getElementById('csCanvas'); cv.classList.remove('hidden');
    const ctx = cv.getContext('2d');
    SND.play('cs_' + cs.fac);
    const t0 = performance.now(); let lastShot = -1, sfxDone = new Set(), lastT = 0;
    const step = () => {
      if (this.cs !== cs) return;
      const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const T = (performance.now() - t0) / 1000;
      if (T >= cs.dur) { this.stop(); return; }
      // 16:9-Bild mittig
      const vw = Math.min(W, H * 16 / 9), vh = vw * 9 / 16;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate((W - vw) / 2, (H - vh) / 2); drawCutscene(ctx, vw, vh, cs, T, { skipHint: '' }); ctx.restore();
      const i = csFind(cs, T), sh = cs.shots[i];
      if (i !== lastShot) { lastShot = i; if (sh.txt) SND.sayText(sh.txt, SPEAKERS[sh.who] || SPEAKERS.erz); }
      for (const [st, kind] of shotSfx(sh)) { const key = i + ':' + st; if (!sfxDone.has(key) && T - sh.t0 >= st) { sfxDone.add(key); SND.fx(kind === 'static' ? 'boom' : kind); } }
      lastT = T; this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
  stop() {
    if (!this.cs) return;
    this.cs = null; cancelAnimationFrame(this.raf);
    try { speechSynthesis.cancel(); } catch (e) { }
    const vid = document.getElementById('csVideo'); try { vid.pause(); } catch (e) { }
    document.getElementById('cutscene').classList.add('hidden');
    const d = this.done; this.done = null; d && d();
  },
};
