// Offline-Cache: Spiel funktioniert gegen CPU auch ohne Internet
const CACHE = 'frontlinien-v6';
const FILES = ['./', './index.html', './style.css', './manifest.json', './icon-192.png', './icon-512.png', './lib/peerjs.min.js', './lib/three.min.js', './js/render3d.js', './js/tex3d.js', './js/models3d.js', './js/particles3d.js', './js/assets3d.js', './lib/gltf-loader.js',
  './js/data.js', './js/maps.js', './js/engine.js', './js/ai.js', './js/render.js', './js/net.js', './js/ui.js', './js/fog.js', './js/missions.js', './js/audio.js', './js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Netz zuerst (damit Updates ankommen), sonst Cache
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
