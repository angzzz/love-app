// Service Worker —— 离线缓存支持（v7：network-first 策略）
// 华为等国产内核兼容：在线时 SW 完全透明转发，不干预页面加载
// 只有网络失败时才回退缓存，彻底避免 SW 卡死页面

const CACHE_NAME = 'love-app-v13'
const CACHE_FILES = [
  '/',
  '/css/app.css',
  '/js/store.js',
  '/js/config.js',
  '/js/lunar.js',
  '/js/date.js',
  '/js/app.js'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_FILES)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // 只处理同源 GET 请求，其他一律放行
  if (e.request.method !== 'GET') return
  let url
  try { url = new URL(e.request.url) } catch (err) { return }
  if (url.origin !== location.origin) return

  // 网络优先：成功则更新缓存并返回；失败则回退缓存，最后兜底 '/' 缓存
  e.respondWith(
    fetch(e.request).then(resp => {
      // 后台静默更新缓存（导航请求不能 clone 太晚，这里 resp 直接返回，copy 进缓存）
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const copy = resp.clone()
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {})
      }
      return resp
    }).catch(() => {
      return caches.match(e.request).then(cached => {
        if (cached) return cached
        // 导航请求兜底：返回首页缓存
        if (e.request.mode === 'navigate') {
          return caches.match('/').then(h => h || new Response(
            '<meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;text-align:center;">当前离线且无缓存<br>请联网后重试</body>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          ))
        }
        return new Response('', { status: 504, statusText: 'offline' })
      })
    })
  )
})
