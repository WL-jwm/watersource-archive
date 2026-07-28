/**
 * 路由预加载工具
 *
 * 方案A：用户鼠标悬停(onMouseEnter)或触摸(onTouchStart)导航链接时，
 * 提前发起 dynamic import() 下载目标页面 chunk。
 * 点击导航时 chunk 已在浏览器缓存中，渲染零延迟。
 *
 * 原理：import() 返回的 Promise 会被浏览器缓存，
 * React.lazy 接收同一个 Promise 时直接 resolve，不会重复下载。
 */

// ===== 页面导入函数注册表 =====
// 路由 path → lazy import 函数
// App.tsx 的 React.lazy 和 preloadPage 共享同一份 import 函数
// 类型放宽为 any，因为各页面 props 不同，React.lazy 内部会做类型推导

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pageImporters: Record<string, () => Promise<{ default: any }>> = {
  '/': () => import('@/pages/Home'),
  '/map': () => import('@/pages/MapView'),
  '/dashboard': () => import('@/pages/Dashboard'),
  '/manage': () => import('@/pages/WaterSourceManager'),
  '/zone-calc': () => import('@/pages/ProtectionZoneCalc'),
  '/analysis': () => import('@/pages/ProjectAnalysis'),
  '/versions': () => import('@/pages/VersionHistory'),
  '/divisions': () => import('@/pages/DivisionOverview'),
  '/audit': () => import('@/pages/AuditLog'),
};

// 已经发起的 import Promise 缓存，避免重复下载
const preloadCache = new Map<string, Promise<unknown>>();

// requestIdleCallback 兼容（Safari < 17 无此 API）
type IdleCallback = (deadline: { timeRemaining: () => number }) => void;
const ric: (cb: IdleCallback) => void =
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb: IdleCallback) => setTimeout(() => cb({ timeRemaining: () => 50 }), 1);

// 已标记为待预加载的路径（等待 idle 时执行）
const pendingPreload = new Set<string>();

// idle 回调是否已注册
let idleScheduled = false;

/**
 * 执行待预加载队列
 */
function flushPending() {
  idleScheduled = false;
  for (const path of pendingPreload) {
    pendingPreload.delete(path);
    const importer = pageImporters[path];
    if (importer && !preloadCache.has(path)) {
      preloadCache.set(path, importer());
    }
  }
}

/**
 * 预加载指定路由的页面 chunk
 *
 * 调用时机：
 * - onMouseEnter（桌面端鼠标悬停）
 * - onTouchStart（移动端手指触碰）
 *
 * 使用 requestIdleCallback 确保不阻塞当前页面交互。
 * 同一路径只下载一次，重复调用直接返回缓存的 Promise。
 *
 * @param path 路由路径，如 '/zone-calc'、'/map'
 */
export function preloadPage(path: string): void {
  // 路径不在注册表中（如 /report/:id 动态路由），跳过
  if (!pageImporters[path]) return;

  // 已缓存或已发起，跳过
  if (preloadCache.has(path) || pendingPreload.has(path)) return;

  pendingPreload.add(path);

  // 在浏览器空闲时执行 import()
  if (!idleScheduled) {
    idleScheduled = true;
    ric(flushPending);
  }
}

/**
 * 获取页面的 import Promise（供 React.lazy 使用）
 *
 * React.lazy 接收的函数和 preloadPage 共享同一个 import 调用，
 * 确保预加载的 chunk 不会被重复下载。
 *
 * @param path 路由路径
 */
export function getPageImporter(path: string): () => Promise<{ default: any }> {
  const importer = pageImporters[path];
  if (!importer) {
    throw new Error(`[preload] 未注册的页面路径: ${path}`);
  }
  // 如果已经预加载过，返回缓存的 Promise 包装为函数
  if (preloadCache.has(path)) {
    const cached = preloadCache.get(path)!;
    return () => cached as Promise<{ default: any }>;
  }
  return importer;
}
