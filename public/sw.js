// Service Worker for Spotify Fan Website
const CACHE_NAME = 'spotify-fan-v2'; // Updated version to force cache refresh
const urlsToCache = [
    '/',
    '/styles.css?v=1.1',
    '/script.js?v=1.1',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing new version v2');
    // Force activation of new service worker
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('🗄️ Service Worker: Caching resources with v1.1');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating new version v2');
    event.waitUntil(
        // Delete old caches
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    // For development, bypass cache for API calls and versioned files
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('localhost:5500') && 
        (event.request.url.includes('script.js') || event.request.url.includes('styles.css'))) {
        console.log('🌐 Service Worker: Bypassing cache for:', event.request.url);
        event.respondWith(fetch(event.request));
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});