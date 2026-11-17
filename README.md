# Frontlinien – Echtzeit-Strategie

Ein Command-&-Conquer-artiges Strategiespiel in 3D (2D umschaltbar) für den Browser (iPhone, Android, Windows – alle können miteinander spielen).

## Neu in dieser Version
- **Kampagne:** 3 × 15 Missionen mit Story (Allianz „Operation Morgenrot“, Dominion „Eiserner Sturm“, Kollektiv „Das Erwachen“). Fortschritt wird im Browser gespeichert.
- **Kartennebel** (im Gefecht abschaltbar) und Aufklärung: Satellitenzentrale (Allianz), Spionageflugzeug (Dominion), Späherdrohne (Kollektiv).
- **Ingenieure** erobern feindliche Gebäude.
- **Zwischensequenzen:** 15 animierte Story-Sequenzen (Intro, Wendepunkte, Finale je Fraktion) – live mit Sprecherstimme oder als MP4-Video (`assets/videos`).
- **Musik & Ansager:** Synth-Musik im 90er-Stil, Ansagen mit Akzent je Fraktion (Lautstärke im Hauptmenü und im Spielmenü).

## Online stellen (GitHub Pages)
1. Auf github.com ein neues Repository anlegen, z. B. `frontlinien`.
2. Den **Inhalt** dieses Ordners hochladen (index.html muss im Hauptverzeichnis liegen).
3. Settings → Pages → Branch `main` / Ordner `/ (root)` → Save.
4. Nach ca. 1 Minute läuft das Spiel unter `https://<name>.github.io/frontlinien/`.

## Als App installieren
- iPhone/iPad: Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
- Android: Link in Chrome öffnen → Menü → „App installieren“.
- Windows: Link in Edge/Chrome öffnen → Install-Symbol in der Adressleiste.

## Online spielen
„Online-Spiel erstellen“ → Raum-Code/Link an Freunde schicken → Freunde öffnen den Link oder tippen den Code unter „Online beitreten“ ein. Der Ersteller ist der Host (sein Gerät berechnet das Spiel).
Hinweis: Verbindungen laufen direkt zwischen den Geräten (WebRTC). In sehr restriktiven Netzen (manche Mobilfunk-/Firmennetze) kann das scheitern – dann WLAN nutzen.

## Mitwirkende
3D-Modelle: Quaternius (Toon Shooter Game Kit, Sci-Fi Essentials Kit, Modular Sci-Fi MegaKit) und Kenney (City Kit Industrial, Tower Defense Kit), alle unter CC0. three.js (MIT), PeerJS (MIT).
