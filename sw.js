/* Service Worker for MavMD */
const CACHE_NAME = 'mavmd-pwa-v5';

const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './example.md',
    './js/main.js',
    './js/config.js',
    './js/prefs.js',
    './js/pwa.js',
    './js/storage.js',
    './js/fs.js',
    './js/panels.js',
    './js/markdown.js',
    './js/urlshare.js',
    './js/images.js',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css',
    'https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // 外部資源用 no-cors 快取，本機資源照常
            return Promise.all(ASSETS.map((url) => {
                const isExternal = /^https?:\/\//.test(url) &&
                    !url.startsWith(self.location.origin);
                return cache.add(new Request(url, isExternal ? { mode: 'no-cors' } : {})).catch(() => { });
            }));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('./index.html'))
        );
        return;
    }
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => { }))
    );
});