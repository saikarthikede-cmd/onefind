// One Find service worker: caches every app file so the app works fully offline.
// Bump VERSION on every release so phones pick up the new files.
const VERSION = 'onefind-1.1.0';
const FILES = [
  "./",
  "css/app.css",
  "fonts/pixelify-sans-600.woff2",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "index.html",
  "js/app.js",
  "js/core/agenda.js",
  "js/core/backup.js",
  "js/core/crypto.js",
  "js/core/dates.js",
  "js/core/db.js",
  "js/core/ics.js",
  "js/core/keys.js",
  "js/core/store.js",
  "js/core/util.js",
  "js/screens/actions.js",
  "js/screens/bills.js",
  "js/screens/gate.js",
  "js/screens/habits.js",
  "js/screens/money.js",
  "js/screens/more.js",
  "js/screens/notes.js",
  "js/screens/people.js",
  "js/screens/places.js",
  "js/screens/settings.js",
  "js/screens/tasks.js",
  "js/screens/today.js",
  "js/screens/vault.js",
  "js/ui/icons.js",
  "js/ui/kit.js",
  "js/ui/pip.js",
  "js/vendor/preact-htm.js",
  "manifest.webmanifest"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('onefind-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() =>
        req.mode === 'navigate' ? cache.match('./') : Response.error()
      ))
    )
  );
});
