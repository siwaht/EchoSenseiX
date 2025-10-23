// Service Worker for offline caching and performance optimization
const CACHE_NAME = 'echosenseix-v1';
const RUNTIME_CACHE = 'runtime-cache-v1';
const API_CACHE = 'api-cache-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, falling back to cache
  networkFirst: async (request) => {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  },
  
  // Cache first, falling back to network
  cacheFirst: async (request) => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      throw error;
    }
  },
  
  // Stale while revalidate
  staleWhileRevalidate: async (request) => {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        const cache = caches.open(RUNTIME_CACHE);
        cache.then(c => c.put(request, networkResponse.clone()));
      }
      return networkResponse;
    });
    
    return cachedResponse || fetchPromise;
  },
  
  // Network only (no caching)
  networkOnly: async (request) => {
    return fetch(request);
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[ServiceWorker] Skip waiting');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && 
                   cacheName !== RUNTIME_CACHE && 
                   cacheName !== API_CACHE;
          })
          .map((cacheName) => {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // API requests - use network first strategy with timeout
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      Promise.race([
        CACHE_STRATEGIES.networkFirst(request),
        new Promise((resolve, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 5000)
        )
      ]).catch(() => {
        // If network fails, try cache
        return caches.match(request).then(response => {
          if (response) {
            console.log('[ServiceWorker] Serving from cache due to network failure:', url.pathname);
            return response;
          }
          // Return offline fallback for API
          return new Response(
            JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        });
      })
    );
    return;
  }
  
  // Static assets (JS, CSS) - use cache first strategy
  if (url.pathname.match(/\.(js|css|woff2?|ttf|otf|eot)$/)) {
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request));
    return;
  }
  
  // Images - use stale while revalidate
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)) {
    event.respondWith(CACHE_STRATEGIES.staleWhileRevalidate(request));
    return;
  }
  
  // HTML pages - use network first
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      CACHE_STRATEGIES.networkFirst(request).catch(() => {
        // Return cached index.html as fallback for offline
        return caches.match('/index.html');
      })
    );
    return;
  }
  
  // Default - use stale while revalidate
  event.respondWith(CACHE_STRATEGIES.staleWhileRevalidate(request));
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-api-calls') {
    event.waitUntil(syncApiCalls());
  }
});

// Function to sync offline API calls
async function syncApiCalls() {
  // This would sync any queued API calls when back online
  console.log('[ServiceWorker] Syncing offline API calls');
  // Implementation would depend on your offline queue mechanism
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('[ServiceWorker] All caches cleared');
      })
    );
  }
  
  if (event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.urls || [];
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(urlsToCache);
      })
    );
  }
});

// Periodic background sync for keeping data fresh
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  console.log('[ServiceWorker] Updating cache in background');
  // Refresh critical API endpoints
  const criticalEndpoints = [
    '/api/agents',
    '/api/user',
    '/api/dashboard/stats'
  ];
  
  const cache = await caches.open(API_CACHE);
  for (const endpoint of criticalEndpoints) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        await cache.put(endpoint, response);
      }
    } catch (error) {
      console.log(`[ServiceWorker] Failed to update ${endpoint}:`, error);
    }
  }
}
