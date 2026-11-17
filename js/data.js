'use strict';
// ===================== Grunddaten =====================
const T = 32;            // Welt-Pixel pro Kachel
const TICK = 0.05;       // 20 Simulationsschritte pro Sekunde
const TER = { WATER: 0, LOW: 1, HILL: 2, MOUNT: 3, SHALLOW: 4 };

const RES = [null,
  { key: 'erz', name: 'Erz', value: 25, color: '#d4a62a', dark: '#7a5a10', amt: 40 },
  { key: 'kristall', name: 'Kristall', value: 50, color: '#4fc3f7', dark: '#0d5f8a', amt: 25 },
  { key: 'aetherit', name: 'Ätherit', value: 100, color: '#c070ff', dark: '#5a1d8a', amt: 14 }];
const HARV_CAP = 20;

const PCOLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00acc1', '#ec407a', '#8d6e63', '#eceff1'];
const PCOLOR_NAMES = ['Rot', 'Blau', 'Grün', 'Gelb', 'Lila', 'Orange', 'Türkis', 'Pink', 'Braun', 'Weiß'];

// Waffenklassen: Schadensfaktor gegen Panzerungsklasse
const WCLS = {
  mg:     { inf: 1.0, veh: 0.25, air: 0.6, bld: 0.15, col: '#ffe082', fx: 'bullet', spd: 1100 },
  cannon: { inf: 0.35, veh: 1.0, air: 0.0, bld: 0.75, col: '#ffb74d', fx: 'shell', spd: 650 },
  rocket: { inf: 0.4, veh: 0.9, air: 1.0, bld: 0.5, col: '#ff8a65', fx: 'rocket', spd: 480 },
  flak:   { inf: 0.0, veh: 0.0, air: 1.2, bld: 0.0, col: '#fff59d', fx: 'flak', spd: 900 },
  flame:  { inf: 1.6, veh: 0.45, air: 0.0, bld: 0.8, col: '#ff7043', fx: 'flame', spd: 400 },
  arty:   { inf: 0.8, veh: 0.6, air: 0.0, bld: 1.1, col: '#ffcc80', fx: 'arc', spd: 330 },
  laser:  { inf: 0.7, veh: 1.0, air: 0.8, bld: 0.7, col: '#80d8ff', fx: 'beam', spd: 0 },
  bomb:   { inf: 0.8, veh: 1.0, air: 0.0, bld: 1.5, col: '#ffab40', fx: 'bomb', spd: 250 },
  psi:    { inf: 1.3, veh: 0.6, air: 0.6, bld: 0.5, col: '#ea80fc', fx: 'beam', spd: 0 },
  acid:   { inf: 0.5, veh: 1.2, air: 0.0, bld: 0.6, col: '#b2ff59', fx: 'glob', spd: 450 },
};

const FACTIONS = {
  A: { key: 'A', name: 'Allianz', desc: 'Hightech-Streitkräfte mit Schilden, Lasern und überlegener Luftwaffe. Super-Einheit: Himmelsfestung (Luft).', style: 'A' },
  D: { key: 'D', name: 'Dominion', desc: 'Schwere Panzer, Flammenwerfer und rohe Gewalt. Super-Einheit: Koloss (Fahrzeug).', style: 'D' },
  K: { key: 'K', name: 'Kollektiv', desc: 'Organische Psi-Schwärme, die sich regenerieren. Super-Einheit: Titan (Infanterie).', style: 'K' },
};

const DEFS = {};
const TYPE_LIST = [];
function def(key, d) { d.key = key; d.idx = TYPE_LIST.length; DEFS[key] = d; TYPE_LIST.push(key); return d; }

// ---------- Standardgebäude (generisch, je Fraktion eigenes Aussehen) ----------
const GENERIC = {
  bauhof:   { w: 3, h: 3, hp: 3000, cost: 0, time: 0, pow: 20, req: [], q: null },
  power:    { w: 2, h: 2, hp: 800, cost: 300, time: 8, pow: 100, req: ['bauhof'], q: 'bld' },
  refinery: { w: 3, h: 3, hp: 1500, cost: 2000, time: 16, pow: -30, req: ['power'], q: 'bld' },
  barracks: { w: 2, h: 2, hp: 1000, cost: 300, time: 8, pow: -20, req: ['power'], q: 'bld' },
  factory:  { w: 3, h: 3, hp: 2000, cost: 2000, time: 18, pow: -30, req: ['refinery'], q: 'bld' },
  airfield: { w: 3, h: 3, hp: 1200, cost: 1200, time: 14, pow: -40, req: ['factory'], q: 'bld' },
  tech:     { w: 2, h: 2, hp: 1200, cost: 1500, time: 18, pow: -100, req: ['factory', 'barracks'], q: 'bld' },
};
const GENERIC_ROLES = Object.keys(GENERIC);
const GEN_NAMES = {
  A: { bauhof: 'Bauhof', power: 'Fusionsreaktor', refinery: 'Raffinerie', barracks: 'Kaserne', factory: 'Waffenfabrik', airfield: 'Flugfeld', tech: 'Forschungszentrum' },
  D: { bauhof: 'Kommandozentrale', power: 'Kohlekraftwerk', refinery: 'Erzschmelze', barracks: 'Rekrutierungslager', factory: 'Panzerwerk', airfield: 'Luftwaffenbasis', tech: 'Militärlabor' },
  K: { bauhof: 'Nexus', power: 'Energiekristall', refinery: 'Assimilator', barracks: 'Brutstätte', factory: 'Formwerk', airfield: 'Nest', tech: 'Evolutionskammer' },
};
for (const f of 'ADK') for (const r of GENERIC_ROLES) {
  const g = GENERIC[r];
  def(f + '_' + r, Object.assign({ kind: 'bld', fac: f, role: r, generic: true, name: GEN_NAMES[f][r] }, g, { req: g.req.slice() }));
}

// ---------- Verteidigung ----------
function tower(f, key, name, w, hp, cost, req, pow, desc) {
  def(f + '_' + key, { kind: 'bld', fac: f, role: 'tower', name, w: 1, h: 1, hp, cost, time: cost / 70, pow, req, q: 'def', weapon: w, desc });
}
tower('A', 'wacht', 'Wachturm', { c: 'mg', dmg: 20, rng: 6, rof: 0.4, gnd: true }, 800, 500, ['barracks'], -10, 'Gegen Infanterie');
tower('A', 'laser', 'Laserturm', { c: 'laser', dmg: 95, rng: 6.5, rof: 1.5, gnd: true }, 1000, 900, ['factory'], -25, 'Gegen Fahrzeuge');
tower('A', 'sam', 'SAM-Stellung', { c: 'flak', dmg: 55, rng: 8.5, rof: 0.7, air: true, gnd: false }, 700, 700, ['refinery'], -20, 'Gegen Luft');
tower('D', 'bunker', 'Flammenbunker', { c: 'flame', dmg: 34, rng: 4.5, rof: 0.5, gnd: true, spl: 0.7 }, 1300, 500, ['barracks'], -10, 'Gegen Infanterie');
tower('D', 'geschuetz', 'Geschützturm', { c: 'cannon', dmg: 105, rng: 6.5, rof: 1.8, gnd: true }, 1300, 900, ['factory'], -25, 'Gegen Fahrzeuge');
tower('D', 'flak', 'Flakgeschütz', { c: 'flak', dmg: 45, rng: 8, rof: 0.55, air: true, gnd: false }, 850, 700, ['refinery'], -20, 'Gegen Luft');
tower('K', 'stachel', 'Stachelturm', { c: 'psi', dmg: 22, rng: 6, rof: 0.45, gnd: true }, 800, 500, ['barracks'], -10, 'Gegen Infanterie');
tower('K', 'saeure', 'Säurekanone', { c: 'acid', dmg: 100, rng: 6, rof: 1.6, gnd: true }, 1000, 900, ['factory'], -25, 'Gegen Fahrzeuge');
tower('K', 'sporen', 'Sporenwerfer', { c: 'flak', dmg: 50, rng: 8.5, rof: 0.75, air: true, gnd: false }, 700, 700, ['refinery'], -20, 'Gegen Luft');

// ---------- Spezialgebäude (4 je Fraktion) ----------
function special(f, key, name, cost, eff, desc) {
  def(f + '_' + key, { kind: 'bld', fac: f, role: 'special', name, w: 2, h: 2, hp: 1500, cost, time: cost / 90, pow: -60, req: ['tech'], q: 'bld', eff, desc });
}
special('A', 'hangar', 'Orbitalhangar', 2500, { unlock: 'A_festung', prod: { air: 1.5 } }, 'Ermöglicht die Himmelsfestung, Luftproduktion +50 %');
special('A', 'schild', 'Schildgenerator', 2000, { bldShield: { r: 7, mult: 0.5 } }, 'Gebäude im Umkreis erleiden 50 % weniger Schaden');
special('A', 'repbucht', 'Reparaturbucht', 1500, { repair: { r: 5, hps: 30, cats: ['veh', 'air'] } }, 'Repariert Fahrzeuge und Flieger im Umkreis');
special('A', 'handel', 'Handelszentrum', 2000, { income: 9 }, 'Erzeugt dauerhaft Credits');
special('D', 'schmiede', 'Schwerindustrie-Schmiede', 2500, { unlock: 'D_koloss', prod: { veh: 1.5 } }, 'Ermöglicht den Koloss, Fahrzeugproduktion +50 %');
special('D', 'akademie', 'Kriegsakademie', 2000, { dmg: { inf: 1.25, veh: 1.1 } }, 'Infanterie +25 %, Fahrzeuge +10 % Schaden');
special('D', 'propaganda', 'Propagandaturm', 1500, { dmgAura: { r: 8, mult: 1.25 } }, 'Eigene Einheiten im Umkreis +25 % Schaden');
special('D', 'verdichter', 'Erzverdichter', 2000, { harvest: 1.3 }, 'Ernte bringt 30 % mehr Credits');
special('K', 'brutkammer', 'Titanen-Brutkammer', 2500, { unlock: 'K_titan', prod: { inf: 1.5 } }, 'Ermöglicht den Titan, Infanterieproduktion +50 %');
special('K', 'becken', 'Regenerationsbecken', 1500, { repair: { r: 6, hps: 25, cats: ['inf', 'veh', 'air'] } }, 'Heilt alle Einheiten im Umkreis');
special('K', 'verstaerker', 'Psi-Verstärker', 2000, { speed: 1.2 }, 'Alle Einheiten bewegen sich 20 % schneller');
special('K', 'konverter', 'Biomasse-Konverter', 2000, { income: 11 }, 'Erzeugt dauerhaft Credits');

// ---------- Superwaffen (2 je Fraktion, abschaltbar) ----------
function superweapon(f, key, name, cost, sw, charge, desc) {
  def(f + '_' + key, { kind: 'bld', fac: f, role: 'superweapon', name, w: 3, h: 3, hp: 2500, cost, time: cost / 100, pow: -200, req: ['tech'], q: 'bld', sw, charge, desc });
}
superweapon('A', 'ionen', 'Ionenkanonen-Uplink', 4000, { t: 'ion', r: 2.6, dmg: 3200 }, 300, 'Präziser Orbitalschlag mit gewaltigem Schaden');
superweapon('A', 'luftbruecke', 'Luftlande-Kommando', 3000, { t: 'drop', units: ['A_soldat', 'A_soldat', 'A_soldat', 'A_soldat', 'A_rakete', 'A_rakete', 'A_rakete', 'A_sniper', 'A_laserpanzer', 'A_laserpanzer'] }, 220, 'Wirft eine Kampfgruppe am Zielort ab');
superweapon('D', 'atom', 'Atomsilo', 5000, { t: 'nuke', r: 5.5, dmg: 2600 }, 420, 'Atomrakete mit riesigem Explosionsradius');
superweapon('D', 'wall', 'Eiserner-Wall-Projektor', 3500, { t: 'shield', r: 3.5, dur: 20 }, 240, 'Eigene Einheiten und Gebäude 20 s unverwundbar');
superweapon('K', 'sturm', 'Psi-Sturm-Kristall', 4500, { t: 'storm', r: 4.5, dps: 110, dur: 14 }, 360, 'Verheerender Sturm, der alles Feindliche zermürbt');
superweapon('K', 'emp', 'EMP-Resonator', 3000, { t: 'emp', r: 6, dur: 16 }, 220, 'Legt feindliche Einheiten und Türme lahm');

// ---------- Aufklärung (je Fraktion anders) ----------
def('A_satellit', { kind: 'bld', fac: 'A', role: 'intel', name: 'Satellitenzentrale', w: 2, h: 2, hp: 1200, cost: 1500, time: 16, pow: -60, req: ['refinery'], q: 'bld', sw: { t: 'scan', r: 14, dur: 25 }, charge: 50, desc: 'Satelliten-Scan: deckt einen großen Kartenbereich für 25 s auf' });
def('D_aufklaerung', { kind: 'bld', fac: 'D', role: 'intel', name: 'Aufklärungszentrale', w: 2, h: 2, hp: 1200, cost: 1500, time: 16, pow: -50, req: ['refinery'], q: 'bld', sw: { t: 'spyplane', r: 10 }, charge: 60, desc: 'Schickt ein Spionageflugzeug, das den Zielbereich überfliegt und aufdeckt' });

// ---------- Einheiten ----------
function unit(f, key, d) { d.kind = 'unit'; d.fac = f; d.q = d.cat; if (!d.req) d.req = []; d.time = d.time || Math.max(4, d.cost / 85); return def(f + '_' + key, d); }
const BY = { inf: 'barracks', veh: 'factory', air: 'airfield' };
// Allianz
unit('A', 'soldat', { name: 'Soldat', cat: 'inf', hp: 120, spd: 1.6, cost: 100, size: 6, weapon: { c: 'mg', dmg: 12, rng: 4.5, rof: 0.6, gnd: true, air: true }, desc: 'Standard-Infanterie' });
unit('A', 'rakete', { name: 'Raketenschütze', cat: 'inf', hp: 110, spd: 1.4, cost: 250, size: 6, weapon: { c: 'rocket', dmg: 45, rng: 5.5, rof: 1.8, gnd: true, air: true }, desc: 'Gegen Fahrzeuge und Luft' });
unit('A', 'sniper', { name: 'Scharfschütze', cat: 'inf', hp: 90, spd: 1.5, cost: 500, size: 6, req: ['tech'], weapon: { c: 'mg', dmg: 95, rng: 8, rof: 2.4, gnd: true }, desc: 'Tödlich gegen Infanterie, große Reichweite' });
unit('A', 'ernter', { name: 'Erntesammler', cat: 'veh', hp: 900, spd: 1.5, cost: 1400, size: 13, harvester: true, req: ['refinery'], desc: 'Sammelt Ressourcen' });
unit('A', 'buggy', { name: 'Späher-Buggy', cat: 'veh', hp: 320, spd: 3.3, cost: 400, size: 10, weapon: { c: 'mg', dmg: 15, rng: 5, rof: 0.4, gnd: true, air: true }, desc: 'Schnell, gegen Infanterie' });
unit('A', 'laserpanzer', { name: 'Laserpanzer', cat: 'veh', hp: 650, spd: 2.0, cost: 850, size: 13, weapon: { c: 'laser', dmg: 70, rng: 5.5, rof: 1.6, gnd: true }, desc: 'Kampfpanzer mit Laser' });
unit('A', 'ionwerfer', { name: 'Ionenwerfer', cat: 'veh', hp: 350, spd: 1.6, cost: 1000, size: 12, req: ['tech'], weapon: { c: 'arty', dmg: 115, rng: 11, rof: 4, gnd: true, spl: 1.3, min: 2.5 }, desc: 'Artillerie mit großer Reichweite' });
unit('A', 'ingenieur', { name: 'Ingenieur', cat: 'inf', hp: 100, spd: 1.6, cost: 500, size: 6, engineer: true, sight: 5, desc: 'Erobert feindliche Gebäude (Gebäude antippen)' });
unit('A', 'mcv', { name: 'Bau-Fahrzeug', cat: 'veh', hp: 1500, spd: 1.1, cost: 3000, size: 15, mcv: true, req: ['tech'], desc: 'Entfaltet sich zu einem neuen Bauhof' });
unit('A', 'jaeger', { name: 'Jäger', cat: 'air', hp: 280, spd: 4.6, cost: 1000, size: 12, weapon: { c: 'rocket', dmg: 55, rng: 5, rof: 1.4, gnd: true, air: true }, desc: 'Vielseitiger Luftkampf' });
unit('A', 'gunship', { name: 'Falke-Gunship', cat: 'air', hp: 520, spd: 3, cost: 1300, size: 14, weapon: { c: 'cannon', dmg: 48, rng: 5, rof: 1, gnd: true }, desc: 'Bodenangriff aus der Luft' });
unit('A', 'festung', { name: 'Himmelsfestung', cat: 'air', hp: 3600, spd: 1.4, cost: 5000, time: 55, size: 30, sup: true, req: ['A_hangar'], weapon: { c: 'laser', dmg: 125, rng: 7, rof: 1.1, gnd: true, air: true, spl: 0.9 }, desc: 'SUPER-EINHEIT: fliegende Laserfestung' });
// Dominion
unit('D', 'rekrut', { name: 'Wehrpflichtiger', cat: 'inf', hp: 130, spd: 1.5, cost: 100, size: 6, weapon: { c: 'mg', dmg: 11, rng: 4.5, rof: 0.6, gnd: true, air: true }, desc: 'Günstige Infanterie' });
unit('D', 'flammen', { name: 'Flammenwerfer', cat: 'inf', hp: 160, spd: 1.4, cost: 300, size: 6, weapon: { c: 'flame', dmg: 30, rng: 3, rof: 0.5, gnd: true, spl: 0.6 }, desc: 'Verbrennt Infanterie und Gebäude' });
unit('D', 'bazooka', { name: 'Bazooka-Trupp', cat: 'inf', hp: 120, spd: 1.3, cost: 250, size: 6, weapon: { c: 'rocket', dmg: 48, rng: 5.5, rof: 1.9, gnd: true, air: true }, desc: 'Gegen Fahrzeuge und Luft' });
unit('D', 'ernter', { name: 'Erzlaster', cat: 'veh', hp: 1100, spd: 1.25, cost: 1400, size: 14, harvester: true, req: ['refinery'], desc: 'Sammelt Ressourcen' });
unit('D', 'panzer', { name: 'Kampfpanzer', cat: 'veh', hp: 820, spd: 1.7, cost: 900, size: 14, weapon: { c: 'cannon', dmg: 75, rng: 5.5, rof: 1.7, gnd: true }, desc: 'Robuster Panzer' });
unit('D', 'flakpanzer', { name: 'Flakpanzer', cat: 'veh', hp: 520, spd: 2.2, cost: 700, size: 12, weapon: { c: 'flak', dmg: 40, rng: 7, rof: 0.6, air: true, gnd: false }, desc: 'Luftabwehr' });
unit('D', 'katjuscha', { name: 'Raketenartillerie', cat: 'veh', hp: 400, spd: 1.6, cost: 1100, size: 13, req: ['tech'], weapon: { c: 'arty', dmg: 65, rng: 10, rof: 3, gnd: true, spl: 1.8, min: 2.5 }, desc: 'Flächenbeschuss auf Distanz' });
unit('D', 'ingenieur', { name: 'Pionier', cat: 'inf', hp: 110, spd: 1.5, cost: 500, size: 6, engineer: true, sight: 5, desc: 'Erobert feindliche Gebäude (Gebäude antippen)' });
unit('D', 'spion', { name: 'Spionageflugzeug', cat: 'air', hp: 300, spd: 7, cost: 0, size: 13, spy: true, noBuild: true, sight: 11, desc: 'Aufklärer' });
unit('D', 'mcv', { name: 'Bau-Fahrzeug', cat: 'veh', hp: 1700, spd: 1.0, cost: 3000, size: 15, mcv: true, req: ['tech'], desc: 'Entfaltet sich zu einer neuen Kommandozentrale' });
unit('D', 'heli', { name: 'Kampfhubschrauber', cat: 'air', hp: 620, spd: 2.8, cost: 1200, size: 14, weapon: { c: 'rocket', dmg: 52, rng: 5, rof: 1.2, gnd: true }, desc: 'Bodenangriff' });
unit('D', 'abfang', { name: 'Abfangjäger', cat: 'air', hp: 330, spd: 4.8, cost: 900, size: 12, weapon: { c: 'rocket', dmg: 55, rng: 6, rof: 1.2, air: true, gnd: false }, desc: 'Jagt feindliche Flieger' });
unit('D', 'koloss', { name: 'Koloss', cat: 'veh', hp: 6200, spd: 0.9, cost: 5000, time: 55, size: 26, sup: true, req: ['D_schmiede'], weapon: { c: 'cannon', dmg: 165, rng: 6.5, rof: 1.5, gnd: true, air: true, spl: 0.8 }, desc: 'SUPER-EINHEIT: gigantischer Doppelrohr-Panzer' });
// Kollektiv
unit('K', 'drohne', { name: 'Drohnenkrieger', cat: 'inf', hp: 110, spd: 1.8, cost: 110, size: 6, weapon: { c: 'psi', dmg: 11, rng: 4.5, rof: 0.55, gnd: true, air: true }, desc: 'Schnelle Grundeinheit' });
unit('K', 'spucker', { name: 'Säurespucker', cat: 'inf', hp: 140, spd: 1.5, cost: 300, size: 7, weapon: { c: 'acid', dmg: 42, rng: 4, rof: 1.4, gnd: true }, desc: 'Zersetzt Fahrzeuge' });
unit('K', 'psioniker', { name: 'Psioniker', cat: 'inf', hp: 120, spd: 1.3, cost: 600, size: 6, req: ['tech'], weapon: { c: 'psi', dmg: 36, rng: 6, rof: 2, gnd: true, air: true, spl: 1.2 }, desc: 'Psi-Flächenangriff' });
unit('K', 'ernter', { name: 'Absorber', cat: 'veh', hp: 1000, spd: 1.6, cost: 1400, size: 13, harvester: true, req: ['refinery'], desc: 'Sammelt Ressourcen' });
unit('K', 'gleiter', { name: 'Schwebegleiter', cat: 'veh', hp: 420, spd: 3.0, cost: 600, size: 11, weapon: { c: 'laser', dmg: 36, rng: 5, rof: 0.9, gnd: true }, desc: 'Schnelles Angriffsfahrzeug' });
unit('K', 'stachelkaefer', { name: 'Stachelkäfer', cat: 'veh', hp: 520, spd: 2.0, cost: 700, size: 12, weapon: { c: 'flak', dmg: 38, rng: 7, rof: 0.6, air: true, gnd: false }, desc: 'Luftabwehr' });
unit('K', 'plasma', { name: 'Plasmawerfer', cat: 'veh', hp: 420, spd: 1.5, cost: 1100, size: 13, req: ['tech'], weapon: { c: 'arty', dmg: 100, rng: 10.5, rof: 3.8, gnd: true, spl: 1.5, min: 2.5 }, desc: 'Artillerie' });
unit('K', 'ingenieur', { name: 'Assimilierer', cat: 'inf', hp: 100, spd: 1.7, cost: 500, size: 6, engineer: true, sight: 5, desc: 'Übernimmt feindliche Gebäude (Gebäude antippen)' });
unit('K', 'spaeher', { name: 'Späherdrohne', cat: 'air', hp: 160, spd: 5.5, cost: 400, size: 9, scout: true, sight: 15, desc: 'Schnelle Aufklärungsdrohne mit großer Sichtweite, unbewaffnet' });
unit('K', 'mcv', { name: 'Keimling', cat: 'veh', hp: 1500, spd: 1.2, cost: 3000, size: 15, mcv: true, req: ['tech'], desc: 'Wächst zu einem neuen Nexus heran' });
unit('K', 'schwarm', { name: 'Schwarmflieger', cat: 'air', hp: 230, spd: 5, cost: 700, size: 10, weapon: { c: 'psi', dmg: 26, rng: 4.5, rof: 0.8, gnd: true, air: true }, desc: 'Schneller Allzweckflieger' });
unit('K', 'brut', { name: 'Brutträger', cat: 'air', hp: 720, spd: 2.4, cost: 1400, size: 16, weapon: { c: 'bomb', dmg: 170, rng: 1.5, rof: 3, gnd: true, spl: 1.5 }, desc: 'Bombardiert Bodenziele' });
unit('K', 'titan', { name: 'Titan', cat: 'inf', hp: 5200, spd: 1.0, cost: 5000, time: 55, size: 20, sup: true, req: ['K_brutkammer'], weapon: { c: 'psi', dmg: 145, rng: 5.5, rof: 1.5, gnd: true, air: true, spl: 1.5 }, desc: 'SUPER-EINHEIT: riesiger Psi-Krieger' });

for (const k of TYPE_LIST) {
  const d = DEFS[k];
  if (d.kind === 'unit') { d.armor = d.cat; d.req = d.req.concat([BY[d.cat]]); }
  else d.armor = 'bld';
}

// Hilfsfunktionen
function defsOf(fac, pred) { return TYPE_LIST.map(k => DEFS[k]).filter(d => d.fac === fac && pred(d)); }
function facDef(fac, role) { return DEFS[fac + '_' + role]; }
function isAllied(pa, pb) { return pa === pb || (pa && pb && pa.team > 0 && pa.team === pb.team); }

if (typeof module !== 'undefined') module.exports = {};
