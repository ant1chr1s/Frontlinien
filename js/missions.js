'use strict';
// ===================== Kampagne: Story & Missionen =====================
const STORY = {
  intro: 'Im Jahr 2061 geht ein Meteoritenschwarm über der Erde nieder. In den Einschlagskratern wächst ein unbekannter Kristall: Ätherit – eine Energiequelle, die jedes Kraftwerk der Welt in den Schatten stellt. Binnen eines Jahres zerfällt die alte Ordnung. Die westliche Technokratie der Allianz und das eiserne Imperium des Dominion beanspruchen die Krater für sich. Doch tief im Kristall regt sich etwas, das niemand erwartet hat …',
  A: { title: 'Operation Morgenrot', hero: 'General Eleanor Whitmore', text: 'Die Allianz ist ein Bündnis aus Forschungsstaaten mit Hauptquartier in London. Sie setzt auf Präzision, Schilde und Luftüberlegenheit. Unter dem Kommando von General Eleanor Whitmore sollst du die Ätherit-Krater sichern, bevor das Dominion sie in Waffen verwandelt.' },
  D: { title: 'Eiserner Sturm', hero: 'Marschall Viktor Orlow', text: 'Das Dominion ist aus den Trümmern des Ostens entstanden: ein Imperium aus Stahl, Kohle und Disziplin. Marschall Viktor Orlow glaubt, dass nur rohe Stärke die Menschheit durch das Ätherit-Zeitalter führen kann. Du bist sein neuester Feldkommandant.' },
  K: { title: 'Das Erwachen', hero: 'Die Stimme des Schwarms', text: 'Das Kollektiv ist kein Volk, sondern ein Bewusstsein. Es schlief im Inneren der Meteoriten – und das Ätherit ist sein Körper. Die Menschen graben es aus, verbrennen es, töten es. Du bist ein neu erwachter Knoten des Schwarms. Wachse. Lerne. Überlebe.' },
};

// Einheiten-Rollen je Fraktion
const SLOTS = {
  A: { inf: 'soldat', at: 'rakete', elite: 'sniper', tank: 'laserpanzer', light: 'buggy', arty: 'ionwerfer', eng: 'ingenieur', air: 'jaeger', gun: 'gunship', sup: 'festung', harv: 'ernter' },
  D: { inf: 'rekrut', at: 'bazooka', elite: 'flammen', tank: 'panzer', light: 'flakpanzer', arty: 'katjuscha', eng: 'ingenieur', air: 'heli', gun: 'heli', sup: 'koloss', harv: 'ernter' },
  K: { inf: 'drohne', at: 'spucker', elite: 'psioniker', tank: 'gleiter', light: 'stachelkaefer', arty: 'plasma', eng: 'ingenieur', air: 'schwarm', gun: 'brut', sup: 'titan', harv: 'ernter' },
};
const BASES = {
  none: [], hq: ['bauhof'],
  outpost: ['bauhof', 'power', 'barracks', 't0', 't1'],
  small: ['bauhof', 'power', 'refinery', 'barracks'],
  medium: ['bauhof', 'power', 'power', 'refinery', 'barracks', 'factory', 't0', 't1', 't2'],
  base: ['bauhof', 'power', 'power', 'power', 'refinery', 'refinery', 'barracks', 'factory', 'airfield', 'tech', 't0', 't1', 't2', 't0', 't1'],
  fortress: ['bauhof', 'power', 'power', 'power', 'power', 'power', 'refinery', 'refinery', 'barracks', 'factory', 'airfield', 'tech', 'sp0', 'sp1', 'sp2', 't0', 't1', 't2', 't0', 't1', 't2', 't0', 't1', 't2', 't1', 't0', 't1'],
};
const ARMY = {
  tiny: [['inf', 4], ['at', 2]],
  small: [['inf', 6], ['at', 3], ['tank', 2]],
  medium: [['inf', 8], ['at', 4], ['tank', 4], ['arty', 1]],
  large: [['inf', 10], ['at', 6], ['tank', 6], ['arty', 2], ['light', 2]],
  huge: [['inf', 12], ['at', 8], ['elite', 4], ['tank', 8], ['arty', 3], ['light', 3], ['air', 2]],
};
const ENEMY_NAMES = { A: 'Allianz-Kommando', D: 'Dominion-Armee', K: 'Kollektiv-Schwarm' };

// Kurzschreibweise: m(id, Titel, Karte, Spieler, Gegner[], Ziel, Briefing, Extras)
function m(id, title, map, player, enemies, goal, brief, extra = {}) { return Object.assign({ id, title, map, player, enemies, goal, brief, fog: true }, extra); }
const E = (fac, ai, mode, base, army, extra = {}) => Object.assign({ fac, ai, mode, base, army }, extra);
const P = (base, army, credits, extra = {}) => Object.assign({ base, army, credits }, extra);
const W = (first, every, size, grow, mix, from = 0) => ({ first, every, size, grow, mix, from });

const CAMPAIGN = {
  A: [
    m('A1', 'Landung bei Dover', { id: 'flussduell' }, P('small', ARMY.small, 4000), [E('D', 'leicht', 'defend', 'outpost', ARMY.tiny)], { type: 'destroy' },
      'Whitmore: „Das Dominion hat jenseits des Flusses einen Vorposten errichtet – direkt neben einem frischen Ätherit-Krater. Das ist Ihr erster Einsatz, Kommandant. Zeigen Sie mir, dass London sich auf Sie verlassen kann. Zerstören Sie den Vorposten."', { tech: 1, sw: false }),
    m('A2', 'Die erste Raffinerie', { id: 'gebirgspass' }, P('hq', ARMY.tiny, 6000), [E('D', 'leicht', 'normal', 'small', ARMY.tiny)], { type: 'destroy' },
      'Whitmore: „Ohne Ätherit keine Armee. Bauen Sie eine Raffinerie, sichern Sie das Erz im Tal und vertreiben Sie dann die Dominion-Kolonne hinter dem Pass. Achten Sie auf Ihre Energie."', { tech: 1, sw: false }),
    m('A3', 'Halten an der Furt', { id: 'flussduell' }, P('medium', ARMY.small, 3000), [E('D', 'leicht', 'waves', 'small', [])], { type: 'survive', time: 360 },
      'Whitmore: „Orlow will die Furt um jeden Preis. Unsere Verstärkung braucht sechs Minuten. Bis dahin halten Sie die Stellung – jede einzelne Welle wird härter sein als die letzte."', { tech: 1, sw: false, waves: W(45, 50, 4, 2, ['inf', 'inf', 'at', 'tank']) }),
    m('A4', 'Schlüsselübergabe', { id: 'viertaeler' }, P('none', [['eng', 3], ['inf', 8], ['at', 4], ['tank', 3]], 0), [E('D', 'mittel', 'defend', 'outpost', ARMY.small)], { type: 'capture', role: 'bauhof' },
      'Whitmore: „Diese Kommandozentrale enthält die Codes für das gesamte Kraternetz des Dominion. Ich will sie intakt. Bringen Sie einen Ingenieur hinein – und lassen Sie das Gebäude um Himmels willen stehen."', { tech: 1, sw: false }),
    m('A5', 'Kristallnebel', { id: 'kraterring', players: 2 }, P('small', ARMY.small, 5000), [E('K', 'leicht', 'normal', 'small', ARMY.tiny)], { type: 'destroy' },
      'Whitmore: „Unsere Bergleute melden … Lebewesen. Sie kommen aus dem Kristall selbst. Wir nennen sie das Kollektiv. Was immer sie sind – sie greifen an. Säubern Sie den Krater."', { tech: 1, sw: false }),
    m('A6', 'Das Radarloch', { id: 'dreilaendereck', players: 2 }, P('small', ARMY.medium, 5000), [E('D', 'mittel', 'defend', 'medium', ARMY.small, { extra: ['intel'] })], { type: 'target', key: 'aufklaerung' },
      'Whitmore: „Das Dominion sieht jede unserer Bewegungen – dank einer neuen Aufklärungszentrale. Nehmen Sie ihnen die Augen. Die Zentrale muss fallen, der Rest ist zweitrangig."', { tech: 2, sw: false }),
    m('A7', 'Nachtwache', { id: 'dreilaendereck', players: 2 }, P('medium', ARMY.medium, 4000), [E('K', 'mittel', 'waves', 'small', [])], { type: 'survive', time: 480 },
      'Whitmore: „Das Kollektiv schläft nie. Ihre Forschungsstation liegt mitten in seinem Jagdgebiet. Halten Sie acht Minuten durch, bis die Wissenschaftler evakuiert sind."', { tech: 2, sw: false, waves: W(40, 45, 5, 2, ['inf', 'at', 'tank', 'inf', 'air']) }),
    m('A8', 'Doppelfront', { id: 'viertaeler', players: 3 }, P('small', ARMY.medium, 6000), [E('D', 'mittel', 'normal', 'small', ARMY.small), E('K', 'mittel', 'normal', 'small', ARMY.small, { team: 3 })], { type: 'destroy' },
      'Whitmore: „Dominion im Norden, Kollektiv im Osten. Sie bekämpfen sich gegenseitig – nutzen Sie das. Am Ende darf nur noch die Flagge der Allianz wehen."', { tech: 2 }),
    m('A9', 'Der Überläufer', { id: 'gebirgspass' }, P('small', [['eng', 3], ['inf', 6], ['tank', 4]], 5000), [E('D', 'schwer', 'defend', 'base', ARMY.medium)], { type: 'capture', role: 'tech' },
      'Whitmore: „Ein Wissenschaftler des Dominion will überlaufen – mitsamt dem Militärlabor, in dem er arbeitet. Erobern Sie das Labor mit einem Ingenieur, bevor Orlow ihn findet."', { tech: 2 }),
    m('A10', 'Inselsprung', { id: 'inselreich', players: 3 }, P('small', ARMY.medium, 7000), [E('D', 'mittel', 'normal', 'small', ARMY.small), E('D', 'schwer', 'normal', 'small', ARMY.small)], { type: 'destroy' },
      'Whitmore: „Das Inselreich ist der Schlüssel zum Kanal. Zwei Dominion-Divisionen haben sich eingegraben. Die Landbrücken sind schmal – nutzen Sie die Luftwaffe."', { tech: 3 }),
    m('A11', 'Belagerung von London', { id: 'kraterring', players: 3 }, P('base', ARMY.large, 6000), [E('D', 'schwer', 'waves', 'medium', []), E('K', 'schwer', 'waves', 'medium', [])], { type: 'survive', time: 600 },
      'Whitmore: „Das ist kein Manöver mehr. Dominion und Kollektiv rücken gleichzeitig auf London vor. Halten Sie zehn Minuten, bis die Schildgeneratoren der Stadt online sind. Gott schütze die Allianz."', { tech: 3, waves: W(45, 42, 5, 2, ['inf', 'at', 'tank', 'arty', 'air', 'elite']) }),
    m('A12', 'Atomschatten', { id: 'steppe', players: 2 }, P('medium', ARMY.large, 6000), [E('D', 'schwer', 'defend', 'fortress', ARMY.medium, { extra: ['sw:atom'] })], { type: 'target', key: 'atom' },
      'Whitmore: „Orlow hat ein Atomsilo gebaut. Es ist auf London gerichtet. Ich wiederhole: auf London. Zerstören Sie das Silo. Alles andere ist egal."', { tech: 3 }),
    m('A13', 'Allianz der Not', { id: 'viertaeler' }, P('small', ARMY.medium, 7000), [E('K', 'schwer', 'normal', 'medium', ARMY.small), E('K', 'schwer', 'normal', 'medium', ARMY.small)], { type: 'destroy' },
      'Whitmore: „Ich hätte nie gedacht, dass ich das sage – aber das Dominion kämpft heute an unserer Seite. Das Kollektiv ist zu stark geworden. Vernichten Sie die beiden Brutnester."', { tech: 3, allies: [E('D', 'mittel', 'normal', 'small', ARMY.small)] }),
    m('A14', 'Der Kraterring', { id: 'kraterring', players: 2 }, P('medium', ARMY.large, 8000), [E('K', 'brutal', 'defend', 'fortress', ARMY.large)], { type: 'destroy' },
      'Whitmore: „Im Zentrum des Kraterrings schlägt das Herz des Schwarms. Es ist die stärkste Festung, die wir je gesehen haben. Brechen Sie den Ring auf."', { tech: 3 }),
    m('A15', 'Morgenrot', { id: 'steppe', players: 4 }, P('small', ARMY.large, 10000), [E('K', 'brutal', 'normal', 'medium', ARMY.medium), E('D', 'schwer', 'normal', 'medium', ARMY.medium, { team: 3 }), E('D', 'schwer', 'normal', 'medium', ARMY.medium, { team: 3 })], { type: 'destroy' },
      'Whitmore: „Orlow hat das Bündnis gebrochen, und der Schwarm erwacht vollständig. Das ist die letzte Schlacht um das Ätherit. Wenn die Sonne aufgeht, Kommandant, soll sie über einer freien Welt aufgehen."', { tech: 3 }),
  ],
  D: [
    m('D1', 'Grenzzwischenfall', { id: 'flussduell' }, P('small', ARMY.small, 4000), [E('A', 'leicht', 'defend', 'outpost', ARMY.tiny)], { type: 'destroy' },
      'Orlow: „Die Allianz hat einen Messposten auf unserer Seite des Flusses gebaut. Eine Provokation, Genosse Kommandant. Beantworten Sie sie mit Stahl."', { tech: 1, sw: false }),
    m('D2', 'Erz für das Vaterland', { id: 'gebirgspass' }, P('hq', ARMY.tiny, 6000), [E('A', 'leicht', 'normal', 'small', ARMY.tiny)], { type: 'destroy' },
      'Orlow: „Das Vaterland braucht Erz. Viel Erz. Bauen Sie Schmelzen, bauen Sie Panzer – und jagen Sie die Allianz aus dem Tal."', { tech: 1, sw: false }),
    m('D3', 'Die Stahlwerke', { id: 'flussduell' }, P('medium', ARMY.small, 3000), [E('A', 'leicht', 'waves', 'small', [])], { type: 'survive', time: 360 },
      'Orlow: „Die Stahlwerke von Nowaja Kusnezk dürfen nicht fallen. Die Allianz greift in Wellen an. Halten Sie sechs Minuten. Ein Schritt zurück ist Verrat."', { tech: 1, sw: false, waves: W(45, 50, 4, 2, ['inf', 'inf', 'at', 'tank']) }),
    m('D4', 'Diebe in der Nacht', { id: 'viertaeler' }, P('none', [['eng', 3], ['inf', 8], ['at', 4], ['tank', 3]], 0), [E('A', 'mittel', 'defend', 'outpost', ARMY.small, { extra: ['refinery'] })], { type: 'capture', role: 'refinery' },
      'Orlow: „Die Raffinerien der Allianz trennen Ätherit doppelt so rein wie unsere. Stehlen Sie eine. Ihre Pioniere wissen, was zu tun ist."', { tech: 1, sw: false }),
    m('D5', 'Das Erwachen', { id: 'kraterring', players: 2 }, P('small', ARMY.small, 5000), [E('K', 'leicht', 'normal', 'small', ARMY.tiny)], { type: 'destroy' },
      'Orlow: „Die Bergleute in Krater 7 sind tot. Etwas ist aus dem Kristall gekrochen. Verbrennen Sie es. Verbrennen Sie alles."', { tech: 1, sw: false }),
    m('D6', 'Schild und Schwert', { id: 'dreilaendereck', players: 2 }, P('small', ARMY.medium, 5000), [E('A', 'mittel', 'defend', 'medium', ARMY.small, { extra: ['sp:schild'] })], { type: 'target', key: 'schild' },
      'Orlow: „Hinter ihrem Schildgenerator lacht die Allianz über unsere Artillerie. Lassen Sie sie verstummen. Der Generator zuerst."', { tech: 2, sw: false }),
    m('D7', 'Eiserner Wall', { id: 'dreilaendereck', players: 2 }, P('medium', ARMY.medium, 4000), [E('K', 'mittel', 'waves', 'small', [])], { type: 'survive', time: 480 },
      'Orlow: „Der Schwarm wälzt sich auf die Kohlegruben zu. Acht Minuten, bis die Bahn die Arbeiter evakuiert hat. Ihre Bunker sind der eiserne Wall."', { tech: 2, sw: false, waves: W(40, 45, 5, 2, ['inf', 'at', 'tank', 'inf', 'air']) }),
    m('D8', 'Zwei Fronten', { id: 'viertaeler', players: 3 }, P('small', ARMY.medium, 6000), [E('A', 'mittel', 'normal', 'small', ARMY.small), E('K', 'mittel', 'normal', 'small', ARMY.small, { team: 3 })], { type: 'destroy' },
      'Orlow: „Allianz und Kollektiv – zwei Feinde, eine Lösung. Ich will auf dieser Karte keine andere Farbe mehr sehen als unsere."', { tech: 2 }),
    m('D9', 'Die Ionen-Gefahr', { id: 'steppe', players: 2 }, P('medium', ARMY.large, 6000), [E('A', 'schwer', 'defend', 'fortress', ARMY.medium, { extra: ['sw:ionen'] })], { type: 'target', key: 'ionen' },
      'Orlow: „Die Allianz kann jetzt Blitze vom Himmel werfen. Ein Ionenkanonen-Uplink, gut bewacht. Zerstören Sie ihn, bevor er unsere Fabriken trifft."', { tech: 3 }),
    m('D10', 'Brückenkopf', { id: 'inselreich', players: 3 }, P('small', ARMY.medium, 7000), [E('A', 'mittel', 'normal', 'small', ARMY.small), E('A', 'schwer', 'normal', 'small', ARMY.small)], { type: 'destroy' },
      'Orlow: „Die Inseln sind die Tür nach Westen. Treten Sie sie ein."', { tech: 3 }),
    m('D11', 'Moskaus Schild', { id: 'kraterring', players: 3 }, P('base', ARMY.large, 6000), [E('A', 'schwer', 'waves', 'medium', []), E('K', 'schwer', 'waves', 'medium', [])], { type: 'survive', time: 600 },
      'Orlow: „Sie kommen. Alle. Allianz-Bomber am Himmel, Schwarmwesen unter der Erde. Zehn Minuten, dann ist der Eiserne Wall über Moskau aktiv. Halten Sie stand – oder sterben Sie dabei."', { tech: 3, waves: W(45, 42, 5, 2, ['inf', 'at', 'tank', 'arty', 'air', 'elite']) }),
    m('D12', 'Operation Kranich', { id: 'gebirgspass' }, P('medium', [['eng', 4], ['inf', 8], ['at', 4], ['tank', 6], ['arty', 2]], 6000), [E('A', 'schwer', 'defend', 'fortress', ARMY.medium)], { type: 'capture', role: 'bauhof' },
      'Orlow: „Whitmores Hauptquartier im Gebirge. Wenn wir es übernehmen, gehört uns ihre gesamte Technik. Ihre Pioniere gehen mit der dritten Welle hinein."', { tech: 3 }),
    m('D13', 'Unheilige Allianz', { id: 'viertaeler' }, P('small', ARMY.medium, 7000), [E('K', 'schwer', 'normal', 'medium', ARMY.small), E('K', 'schwer', 'normal', 'medium', ARMY.small)], { type: 'destroy' },
      'Orlow: „Die Allianz kämpft heute neben uns. Ein Waffenstillstand – nicht mehr. Wenn die Nester brennen, sehen wir weiter."', { tech: 3, allies: [E('A', 'mittel', 'normal', 'small', ARMY.small)] }),
    m('D14', 'Die Brutstätte', { id: 'kraterring', players: 2 }, P('medium', ARMY.large, 8000), [E('K', 'brutal', 'defend', 'fortress', ARMY.large)], { type: 'destroy' },
      'Orlow: „Das Herz des Schwarms. Jeder Panzer, den das Dominion besitzt, steht hinter Ihnen. Brennen Sie es nieder."', { tech: 3 }),
    m('D15', 'Eiserner Sturm', { id: 'steppe', players: 4 }, P('small', ARMY.large, 10000), [E('A', 'brutal', 'normal', 'medium', ARMY.medium), E('K', 'schwer', 'normal', 'medium', ARMY.medium, { team: 3 }), E('K', 'schwer', 'normal', 'medium', ARMY.medium, { team: 3 })], { type: 'destroy' },
      'Orlow: „Das Bündnis ist vorbei. Heute endet der Krieg – so oder so. Entfesseln Sie den Eisernen Sturm."', { tech: 3 }),
  ],
  K: [
    m('K1', 'Erste Regung', { id: 'flussduell' }, P('small', ARMY.small, 4000), [E('D', 'leicht', 'defend', 'outpost', ARMY.tiny)], { type: 'destroy' },
      'Der Schwarm: „Wir erwachen. Etwas Kaltes bohrt in unserem Körper. Kleine, warme Wesen. Sie nennen sich Dominion. Entferne sie."', { tech: 1, sw: false }),
    m('K2', 'Wachstum', { id: 'gebirgspass' }, P('hq', ARMY.tiny, 6000), [E('A', 'leicht', 'normal', 'small', ARMY.tiny)], { type: 'destroy' },
      'Der Schwarm: „Ein Knoten allein ist schwach. Wachse. Assimiliere den Kristall. Dann treibe die Fremden aus dem Tal."', { tech: 1, sw: false }),
    m('K3', 'Der Schwarm hält', { id: 'flussduell' }, P('medium', ARMY.small, 3000), [E('D', 'leicht', 'waves', 'small', [])], { type: 'survive', time: 360 },
      'Der Schwarm: „Sie kommen mit Feuer. Die Brut im Inneren braucht noch sechs Zyklen. Schütze sie."', { tech: 1, sw: false, waves: W(45, 50, 4, 2, ['inf', 'inf', 'at', 'tank']) }),
    m('K4', 'Assimilation', { id: 'viertaeler' }, P('none', [['eng', 3], ['inf', 8], ['at', 4], ['tank', 3]], 0), [E('D', 'mittel', 'defend', 'outpost', ARMY.small)], { type: 'capture', role: 'bauhof' },
      'Der Schwarm: „Ihre Bauten sind primitiv, aber nützlich. Ein Assimilierer soll ihre Kommandozentrale in uns aufnehmen. Wir lernen von ihr."', { tech: 1, sw: false }),
    m('K5', 'Lichter am Himmel', { id: 'kraterring', players: 2 }, P('small', ARMY.small, 5000), [E('A', 'leicht', 'normal', 'small', ARMY.tiny)], { type: 'destroy' },
      'Der Schwarm: „Andere Fremde. Sie fliegen. Sie sehen viel. Mache sie blind – und dann stumm."', { tech: 1, sw: false }),
    m('K6', 'Das Auge des Feindes', { id: 'dreilaendereck', players: 2 }, P('small', ARMY.medium, 5000), [E('A', 'mittel', 'defend', 'medium', ARMY.small, { extra: ['intel'] })], { type: 'target', key: 'satellit' },
      'Der Schwarm: „Ein Turm spricht mit den Sternen und zeigt ihnen unsere Nester. Zerbrich das Auge."', { tech: 2, sw: false }),
    m('K7', 'Die Ernte', { id: 'dreilaendereck', players: 2 }, P('medium', ARMY.medium, 4000), [E('A', 'mittel', 'waves', 'small', [])], { type: 'survive', time: 480 },
      'Der Schwarm: „Die Kristalle reifen. Acht Zyklen noch, dann gehört die Ernte uns. Die Allianz wird versuchen, sie zu verbrennen."', { tech: 2, sw: false, waves: W(40, 45, 5, 2, ['inf', 'at', 'tank', 'inf', 'air']) }),
    m('K8', 'Zwei Feinde, ein Hunger', { id: 'viertaeler', players: 3 }, P('small', ARMY.medium, 6000), [E('A', 'mittel', 'normal', 'small', ARMY.small), E('D', 'mittel', 'normal', 'small', ARMY.small, { team: 3 })], { type: 'destroy' },
      'Der Schwarm: „Sie bekämpfen einander. Dumm. Wir sind eins. Verschlinge beide."', { tech: 2 }),
    m('K9', 'Fremde Gedanken', { id: 'gebirgspass' }, P('small', [['eng', 3], ['inf', 6], ['tank', 4]], 5000), [E('A', 'schwer', 'defend', 'base', ARMY.medium)], { type: 'capture', role: 'tech' },
      'Der Schwarm: „In ihrem Forschungszentrum liegt Wissen über uns. Nimm es in dich auf. Dann wissen wir, was sie wissen."', { tech: 2 }),
    m('K10', 'Ozean aus Glas', { id: 'inselreich', players: 3 }, P('small', ARMY.medium, 7000), [E('A', 'mittel', 'normal', 'small', ARMY.small), E('D', 'schwer', 'normal', 'small', ARMY.small)], { type: 'destroy' },
      'Der Schwarm: „Das Wasser trennt die Inseln. Uns trennt nichts. Fliege, schwimme, wachse."', { tech: 3 }),
    m('K11', 'Belagerung des Nests', { id: 'kraterring', players: 3 }, P('base', ARMY.large, 6000), [E('A', 'schwer', 'waves', 'medium', []), E('D', 'schwer', 'waves', 'medium', [])], { type: 'survive', time: 600 },
      'Der Schwarm: „Sie haben sich verbündet. Gegen uns. Das große Nest muss zehn Zyklen überdauern, bis die Königin erwacht."', { tech: 3, waves: W(45, 42, 5, 2, ['inf', 'at', 'tank', 'arty', 'air', 'elite']) }),
    m('K12', 'Der eiserne Riese', { id: 'steppe', players: 2 }, P('medium', ARMY.large, 6000), [E('D', 'schwer', 'defend', 'fortress', ARMY.medium, { extra: ['sw:atom'] })], { type: 'target', key: 'atom' },
      'Der Schwarm: „Das Dominion hat eine Waffe gebaut, die Sonnen erzeugt. Sie wird unser Herz verbrennen. Zerstöre das Silo."', { tech: 3 }),
    m('K13', 'Verrat', { id: 'viertaeler', players: 3 }, P('small', ARMY.medium, 7000), [E('A', 'schwer', 'normal', 'medium', ARMY.small), E('D', 'schwer', 'normal', 'medium', ARMY.small)], { type: 'destroy' },
      'Der Schwarm: „Ein Teil von uns hat sich abgespalten und den Fremden gedient. Sie haben ihn benutzt. Hole ihn zurück – und strafe die Fremden."', { tech: 3, allies: [E('K', 'mittel', 'normal', 'small', ARMY.small)] }),
    m('K14', 'Herz der Allianz', { id: 'kraterring', players: 2 }, P('medium', ARMY.large, 8000), [E('A', 'brutal', 'defend', 'fortress', ARMY.large)], { type: 'destroy' },
      'Der Schwarm: „Ihre stärkste Festung. Schilde, Licht, Stahl. Es spielt keine Rolle. Wir sind viele."', { tech: 3 }),
    m('K15', 'Ein Bewusstsein', { id: 'steppe', players: 4 }, P('small', ARMY.large, 10000), [E('A', 'brutal', 'normal', 'medium', ARMY.medium), E('D', 'schwer', 'normal', 'medium', ARMY.medium, { team: 3 }), E('D', 'schwer', 'normal', 'medium', ARMY.medium, { team: 3 })], { type: 'destroy' },
      'Der Schwarm: „Am Ende wird es nur noch eine Stimme geben. Unsere."', { tech: 3 }),
  ],
};
for (const f in CAMPAIGN) CAMPAIGN[f].forEach((mi, i) => { mi.fac = f; mi.idx = i; });

// ---------- Missionsaufbau ----------
const TECH = { 1: ['power', 'refinery', 'barracks', 'factory', 'tower', 'bauhof', 'wall', 'gate'], 2: ['power', 'refinery', 'barracks', 'factory', 'tower', 'bauhof', 'wall', 'gate', 'airfield', 'tech', 'intel', 'special'] };
function missionAllowed(g, pid, d) {
  const M = g.mission; if (!M || !M.tech || M.tech >= 3 || pid !== 0) return true;
  const ok = TECH[M.tech];
  if (d.kind === 'unit') return (d.req || []).every(r => ok.includes(r) || (DEFS[r] && ok.includes(DEFS[r].role)));
  return ok.includes(d.role);
}
// Startpunkte: Spieler auf Start 0, Verbündete daneben, Gegner möglichst weit weg
function missionStarts(map, pl) {
  const st = map.starts, order = [0], used = new Set([0]);
  const d = (a, b) => Math.hypot(st[a].x - st[b].x, st[a].y - st[b].y);
  pl.forEach((p, i) => {
    if (i === 0) return;
    let best = -1, bv = -1e9;
    for (let k = 0; k < st.length; k++) {
      if (used.has(k)) continue;
      const v = p.team === pl[0].team ? -d(k, 0) : Math.min(...order.filter((_, j) => pl[j].team !== p.team).map(o => d(k, o)).concat([1e6])) + d(k, 0) * 0.5;
      if (v > bv) { bv = v; best = k; }
    }
    if (best < 0) best = i % st.length;
    used.add(best); order.push(best);
  });
  return order;
}
function placeNear(g, pid, d, cx, cy, minR = 0, dirX = 0, dirY = 0) {
  for (let r = minR; r < 22; r++) {
    const cand = [];
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
      const tx = x - (d.w >> 1), ty = y - (d.h >> 1);
      if (!g.canPlace(pid, d, tx, ty, true)) continue;
      let ok = true; const mg = d.role === 'tower' ? 0 : 1;
      for (let yy = ty - mg; yy < ty + d.h + mg && ok; yy++) for (let xx = tx - mg; xx < tx + d.w + mg; xx++) { if (xx < 0 || yy < 0 || xx >= g.W || yy >= g.H || g.blk[g.idx(xx, yy)] || (d.role !== 'tower' && g.map.ra[g.idx(xx, yy)])) { ok = false; break; } }
      if (ok) cand.push([tx, ty, (x - cx) * dirX + (y - cy) * dirY]);
    }
    if (cand.length) { cand.sort((a, b) => b[2] - a[2]); return g.placeBuilding(pid, d, cand[0][0], cand[0][1], true); }
  }
  return null;
}
function buildBase(g, pid, base, extra) {
  const p = g.P(pid), s = p.start, f = p.fac;
  const cx = g.W / 2 - s.x, cy = g.H / 2 - s.y, L = Math.hypot(cx, cy) || 1, dx = cx / L, dy = cy / L;
  const towers = defsOf(f, d => d.role === 'tower'), specials = defsOf(f, d => d.role === 'special'), sws = defsOf(f, d => d.role === 'superweapon');
  const list = (BASES[base] || []).concat(extra || []);
  let tAng = 0;
  for (const it of list) {
    let d = null;
    if (it[0] === 't' && /^t\d$/.test(it)) {
      d = towers[+it[1]]; const a = Math.atan2(dy, dx) + (tAng++ % 2 ? 1 : -1) * (0.25 + 0.3 * Math.floor(tAng / 2)), r = 8 + (tAng % 3);
      placeNear(g, pid, d, Math.round(s.x + Math.cos(a) * r), Math.round(s.y + Math.sin(a) * r), 0, dx, dy); continue;
    }
    if (/^sp\d$/.test(it)) d = specials[+it[2]];
    else if (it.startsWith('sp:')) d = DEFS[f + '_' + it.slice(3)];
    else if (it.startsWith('sw:')) d = DEFS[f + '_' + it.slice(3)];
    else if (it === 'intel') d = defsOf(f, x => x.role === 'intel')[0];
    else d = DEFS[f + '_' + it];
    if (!d) continue;
    if (it === 'bauhof') { const tx = s.x - 1, ty = s.y - 1; if (g.canPlace(pid, d, tx, ty, true)) { g.placeBuilding(pid, d, tx, ty, true); continue; } }
    placeNear(g, pid, d, s.x, s.y, it === 'bauhof' ? 0 : 3, -dx * 0.3, -dy * 0.3);
  }
}
function spawnArmy(g, pid, army, at) {
  const p = g.P(pid), s = at || p.start, f = p.fac;
  const cx = g.W / 2 - s.x, cy = g.H / 2 - s.y, L = Math.hypot(cx, cy) || 1;
  const bx = (s.x + cx / L * 5) * T, by = (s.y + cy / L * 5) * T;
  let n = 0;
  for (const [slot, cnt] of army) {
    const d = DEFS[f + '_' + SLOTS[f][slot]]; if (!d) continue;
    for (let i = 0; i < cnt; i++) {
      const a = n * 2.4, r = 14 + Math.sqrt(n) * 14; n++;
      let x = bx + Math.cos(a) * r, y = by + Math.sin(a) * r;
      if (!d.air) { const t = g.nearestPassable(g.tileOf(x), g.tileOf(y), g.tileOf(bx), g.tileOf(by)); if (!t) continue; x = (t[0] + 0.5) * T; y = (t[1] + 0.5) * T; }
      const u = g.spawnUnit(pid, d, x, y); u.home = { x, y };
      if (d.harvester) u.hs = 'seek';
    }
  }
}
function missionSetup(g) {
  const M = g.mission, ps = M._players;
  ps.forEach((pd, i) => {
    const p = g.P(i);
    buildBase(g, i, pd.base, pd.extra);
    spawnArmy(g, i, pd.army || []);
    if (pd.base === 'none' && i === 0) M.allDead = true;
    if (pd.ai) p.credits = { leicht: 3000, mittel: 5000, schwer: 8000, brutal: 12000 }[pd.ai] || 5000;
  });
  // Ziel festlegen
  const goal = M.goal;
  if (goal.type === 'capture' || goal.type === 'target') {
    const owner = goal.owner != null ? goal.owner : 1;
    let t = null;
    for (const e of g.ents.values()) if (e.kind === 'bld' && e.owner === owner && (goal.role ? e.def.role === goal.role : e.type.slice(2) === goal.key)) { t = e; break; }
    if (!t) { const f = g.P(owner).fac, d = goal.role ? DEFS[f + '_' + goal.role] : DEFS[f + '_' + goal.key]; if (d) t = placeNear(g, owner, d, g.P(owner).start.x, g.P(owner).start.y, 2); }
    M.targetId = t ? t.id : 0;
    if (t) g.emit({ k: 'reveal', p: 0, x: t.x, y: t.y, r: 4 * T, t: 6 });
  }
  g.recalcAll();
  M.nextWave = M.waves ? M.waves.first : 0; M.waveN = 0;
}
function missionTick(g, dt) {
  const M = g.mission, Wv = M.waves; if (!Wv || g.over) return;
  if (g.tick % 40 === 0) {
    let tgt = null; for (const e of g.ents.values()) if (e.owner === 0 && e.kind === 'bld') { tgt = e; if (e.def.generic) break; }
    if (tgt) { const byO = {}; for (const u of g.ents.values()) if (u.wave && !u.order && !u.tgt) (byO[u.owner] = byO[u.owner] || []).push(u.id); for (const o in byO) g.command(+o, { c: 'move', ids: byO[o], x: tgt.x, y: tgt.y, am: true }); }
  }
  if (g.time >= M.nextWave) {
    M.waveN++; M.nextWave = g.time + Wv.every;
    const size = Wv.size + Wv.grow * (M.waveN - 1);
    const enemies = g.players.filter(p => p.alive && !g.allied(0, p.id));
    if (!enemies.length) return;
    const me = g.P(0); let tgt = null; for (const e of g.ents.values()) if (e.owner === 0 && e.kind === 'bld') { tgt = e; if (e.def.role === 'bauhof') break; }
    if (!tgt) return;
    enemies.forEach((en, k) => {
      const per = Math.ceil(size / enemies.length), mix = Wv.mix, ids = [];
      const s = en.start;
      for (let i = 0; i < per; i++) {
        const slot = mix[(i + M.waveN + k) % mix.length], d = DEFS[en.fac + '_' + SLOTS[en.fac][slot]]; if (!d) continue;
        const a = i * 2.1, r = 2 + Math.sqrt(i) * 1.2;
        const t = d.air ? [Math.round(s.x + Math.cos(a) * r), Math.round(s.y + Math.sin(a) * r)] : g.nearestPassable(Math.round(s.x + Math.cos(a) * (r + 5)), Math.round(s.y + Math.sin(a) * (r + 5)), s.x, s.y);
        if (!t) continue;
        const u = g.spawnUnit(en.id, d, (t[0] + 0.5) * T, (t[1] + 0.5) * T); u.wave = true; ids.push(u.id);
      }
      g.command(en.id, { c: 'move', ids, x: tgt.x, y: tgt.y, am: true });
    });
    g.msg(`Angriffswelle ${M.waveN} im Anmarsch!`, 0, '#ff8a80');
    g.emit({ k: 'wave', p: 0, n: M.waveN });
  }
}
function missionCheck(g) {
  const M = g.mission, me = g.P(0);
  for (const p of g.players) {
    if (!p.alive) continue;
    let has = false;
    for (const e of g.ents.values()) if (e.owner === p.id && ((e.kind === 'bld' && e.def.generic) || (p.id === 0 && M.allDead))) { has = true; break; }
    if (!has) g.eliminate(p);
  }
  let res = null, why = '';
  if (!me.alive) { res = 'lose'; why = M.allDead ? 'Alle Einheiten wurden vernichtet.' : 'Deine Basis wurde zerstört.'; }
  else if (M.goal.type === 'destroy') { if (!g.players.some(p => p.alive && !g.allied(0, p.id))) res = 'win'; }
  else if (M.goal.type === 'survive') { if (g.time >= M.goal.time || !g.players.some(p => p.alive && !g.allied(0, p.id))) res = 'win'; }
  else if (M.goal.type === 'capture') { const t = g.ents.get(M.targetId); if (!t) { res = 'lose'; why = 'Das Zielgebäude wurde zerstört statt erobert.'; } else if (g.allied(0, t.owner)) res = 'win'; }
  else if (M.goal.type === 'target') { if (!g.ents.has(M.targetId)) res = 'win'; }
  if (res) { g.over = true; g.missionResult = res; g.missionWhy = why; g.winnerTeam = res === 'win' ? (me.team > 0 ? 't' + me.team : 'p0') : 'enemy'; g.emit({ k: 'over', w: g.winnerTeam }); }
}
function missionGoalText(M) {
  const g = M.goal, t = M._tgtName || 'Zielgebäude';
  switch (g.type) {
    case 'destroy': return 'Zerstöre alle Standardgebäude der Gegner.';
    case 'survive': return `Halte deine Basis ${fmtTime(g.time)} lang.`;
    case 'capture': return `Erobere „${t}“ mit einem Ingenieur. Es darf nicht zerstört werden.`;
    case 'target': return `Zerstöre „${t}“.`;
  }
  return '';
}
function missionStatus(g) {
  const M = g.mission; if (!M) return '';
  let s = '🎯 ' + missionGoalText(M);
  if (M.goal.type === 'survive') s += ` · Noch ${fmtTime(Math.max(0, M.goal.time - g.time))}`;
  if (M.waves && !g.over) s += ` · Nächste Welle: ${fmtTime(Math.max(0, M.nextWave - g.time))}`;
  return s;
}
// Spiel-Setup aus Missionsdaten
function missionToSetup(M, playerName, diff = 0) {
  const LV = ['leicht', 'mittel', 'schwer', 'brutal'], sh = (l) => LV[Math.max(0, Math.min(3, LV.indexOf(l) + diff))];
  const pl = [{ name: playerName, fac: M.fac, team: 1, color: 1, base: M.player.base, army: M.player.army }];
  (M.allies || []).forEach((a, i) => pl.push({ name: 'Verbündete: ' + ENEMY_NAMES[a.fac], fac: a.fac, team: 1, color: 2 + i, ai: a.ai, aiMode: a.mode, base: a.base, army: a.army, extra: a.extra }));
  M.enemies.forEach((e, i) => pl.push({ name: ENEMY_NAMES[e.fac] + (M.enemies.length > 1 ? ' ' + (i + 1) : ''), fac: e.fac, team: e.team || 2, color: [0, 5, 4, 7][i % 4], ai: sh(e.ai), aiMode: e.mode, base: e.base, army: e.army, extra: e.extra }));
  const map = Object.assign({ seed: 1234, players: pl.length, water: 1, mount: 1 }, M.map);
  const mission = Object.assign({}, M, { _players: pl });
  const d = M.goal.role ? DEFS[(M.enemies[0].fac) + '_' + M.goal.role] : M.goal.key ? DEFS[(M.enemies[0].fac) + '_' + M.goal.key] : null;
  if (d) mission._tgtName = d.name;
  if (M.waves && diff) mission.waves = Object.assign({}, M.waves, { size: Math.max(2, M.waves.size + diff * 2), grow: Math.max(1, M.waves.grow + diff) });
  return { map, sw: M.sw !== false, fog: M.fog !== false, credits: M.player.credits, mission, players: pl.map(p => ({ name: p.name, fac: p.fac, team: p.team, color: PCOLORS[p.color], ai: p.ai || null, aiMode: p.aiMode })) };
}
