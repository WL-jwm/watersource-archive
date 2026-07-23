/**
 * watersource-archive Service Worker
 *
 * 缓存策略：
 * 1. HTML → Network First（优先网络，离线时回退缓存）
 * 2. JS/CSS/字体 → Stale While Revalidate（先用缓存，后台更新）
 * 3. 地图瓦片 → 不缓存（体积过大，且依赖在线服务）
 * 4. 行政区划JSON → Cache First（静态数据）
 */

const CACHE_VERSION = 'ws-archive-v2'; // G1: 升级缓存版本
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 预缓存的核心资源（构建后由注册脚本补充实际文件名）
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './data/hebeiAdminBoundaries.json',
];

// 不缓存的路径前缀
const NEVER_CACHE = [
  'tile.openstreetmap.org',
  'tile.osm.org',
  'a.tile',
  'b.tile',
  'c.tile',
  'mts.googleapis.com',
  'ecn.t0.tiles',
  'server.arcgisonline.com',
];

// ===== Install：预缓存 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] 预缓存部分失败:', err);
      });
    })
  );
  // 立即激活
  self.skipWaiting();
});

// ===== Activate：清理旧缓存 =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('ws-archive-') && name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ===== Fetch：缓存策略 =====
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 仅处理GET请求
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 跳过地图瓦片
  if (NEVER_CACHE.some(prefix => url.hostname.includes(prefix) || url.pathname.includes(prefix))) {
    return;
  }

  // 跳过Chrome扩展和非http(s)请求
  if (!url.protocol.startsWith('http')) return;

  // HTML → Network First
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // JS/CSS/字体 → Stale While Revalidate
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // JSON数据 → Cache First
  if (request.destination === 'json' || url.pathname.endsWith('.json')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 图片 → Cache First
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 其他 → 尝试网络，失败时回退缓存
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ===== 缓存策略实现 =====

/** Network First：优先网络，离线回退缓存 */
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // 网络失败，尝试缓存
    const cached = await caches.match(request);
    if (cached) return cached;
    // HTML回退到index.html
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/** Stale While Revalidate：先用缓存响应，后台更新 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cached);

  return cached || fetchPromise;
}

/** Cache First：优先缓存，无缓存时请求网络 */
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

// ===== 消息通信：手动更新缓存 =====
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      Promise.all(names.map((n) => caches.delete(n))).then(() => {
        event.ports[0]?.postMessage({ status: 'cleared' });
      });
    });
  }
});
