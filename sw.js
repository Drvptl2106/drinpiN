/*
  sw.js — the "service worker" that makes the app open without internet.

  On first visit it stores a copy of every app file. After that, the app
  opens instantly from that copy, and quietly fetches fresh copies in the
  background so the next opening has any updates.

  If you change the app and want everyone to get it right away, change the
  version number below (e.g. v2 -> v3).
*/
var CACHE = 'drinpin-v2';
var APP_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './storage.js',
  './stores.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Save a copy of every app file.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(APP_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Throw away copies from older versions.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Answer requests for app files from the saved copy, refreshing it in the background.
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      // ignoreSearch: a shared link opens "index.html?url=…", which should still use the saved index.html.
      return cache.match(request, { ignoreSearch: true }).then(function (saved) {
        var fresh = fetch(request).then(function (response) {
          if (response.ok && !new URL(request.url).search) cache.put(request, response.clone());
          return response;
        });
        if (saved) {
          fresh.catch(function () {}); // offline: the saved copy is enough
          return saved;
        }
        return fresh.catch(function () {
          return request.mode === 'navigate' ? cache.match('./index.html') : Response.error();
        });
      });
    })
  );
});
