// Offline support: always try the network, fall back to the cached app shell.
// Bump VERSION when files change so old caches are cleared.
const VERSION = 'supplemental-v13';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'manifest.webmanifest',
  'vendor/argon2.umd.min.js',
  'js/app.js',
  'js/state.js',
  'js/vault.js',
  'js/crypto.js',
  'js/model.js',
  'js/demo.js',
  'js/ui.js',
  'js/home.js',
  'js/day.js',
  'js/items.js',
  'js/settings.js',
  'js/themes.js',
  'js/weekly.js',
  'js/backup.js',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('supplemental-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first, so a new version shows up on the next launch; the cache is the offline fallback.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
