/* Service Worker — Régulation Ambulancier Pro
   Stratégie : network-first pour index.html (toujours la version la plus
   récente quand le réseau est dispo), cache-first pour les assets statiques
   (Tailwind, Alpine.js, icônes), pass-through pour les API live (OSRM,
   Photon, adresse gouv) qui ne doivent jamais être mises en cache. */

const CACHE = 'ambulancier-v2';
const ASSETS = [
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const url = e.request.url;

    const isNavigation = e.request.mode === 'navigate' || url.endsWith('/index.html') || url.endsWith('/');
    const isAsset = ASSETS.some(a => url.startsWith(a) || url.endsWith(a.replace('./', '/')));

    if (isNavigation) {
        // Toujours essayer le réseau en premier pour avoir la dernière version
        // du fichier ; si hors-ligne, on retombe sur la version en cache.
        e.respondWith(
            fetch(e.request).then(res => {
                caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                return res;
            }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
        );
    } else if (isAsset) {
        e.respondWith(
            caches.match(e.request).then(r => r || fetch(e.request).then(res => {
                caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                return res;
            }))
        );
    } else {
        // API live (OSRM, Photon, api-adresse.gouv...) : jamais de cache.
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    }
});
