# 页面加载速度优化 — 后续实施步骤

本文档记录 watersource-archive 平台尚未实施的性能优化方向，供后续迭代参考。

---

## 现状基线（截至 S14.0.0, commit 933fbd9）

| 指标 | 当前值 |
|------|--------|
| 构建时间 | 6.22s |
| 初始 modulepreload | 1.02MB（vendor-react 879KB + calc-tools 141KB） |
| 总构建产物 | 3.7MB（19 个 chunk） |
| 单元测试 | 1197/1197 |

---

## 1. 数据类 chunk 懒加载

### 问题

`hebeiTownships.js`（265KB）和 `waterSourceGeoData.js`（130KB）是静态数据模块，但被 App 启动时静态导入（通过 `waterSourceStore` 的初始化逻辑），导致它们始终随首屏加载，即使页面可能不需要这些数据。

### 目标

将数据加载改为按需触发，仅在用户访问地图页或保护区计算页时加载。

### 实施步骤

**步骤 1：确认静态导入链**
- 在 `waterSourceStore.ts` 中找到 `loadData` 或 `initWaterSources` 方法
- 确认 `hebeiWaterSources` 和 `waterSourceGeoData` 的导入方式（静态 vs 动态）

**步骤 2：改为动态导入**
```ts
// 改前（静态导入，随首屏加载）
import { hebeiWaterSources } from '@/data/hebeiWaterSources';

// 改后（按需加载，仅在首次调用时触发）
const loadHebeiData = async () => {
  const { hebeiWaterSources } = await import('@/data/hebeiWaterSources');
  return hebeiWaterSources;
};
```

**步骤 3：触发时机**
- 在 MapView 页面加载时触发数据加载
- 在 ProtectionZoneCalc 页面加载时触发
- 可添加预加载（prefetch）到常用页面，而非 modulepreload

**预期效果**
- 首屏体积减少约 395KB（265KB + 130KB）
- 地图页加载时会有短暂数据加载延迟（可添加 loading 状态）

---

## 2. 地图相关 vendor 懒加载

### 问题

MapView 页面（20KB）是独立 chunk，但由于 MapView 使用了 leaflet，而 `vendor-leaflet.js`（153KB）是 mapDrawTools 的依赖，目前 leaflet 是在 MapView 页面加载时动态导入的（通过 `mapDrawTools` 的 chunk 分离）。已基本优化，可进一步确认。

### 确认方法

```bash
# 检查 leaflet 是否在 modulepreload 中
grep "modulepreload" dist/index.html | grep "leaflet"

# 如果返回空，则 leaflet 已正确懒加载
```

### 可能的优化

- 确认 MapView 页面是否使用了 `await import('leaflet')` 而非静态导入
- 如果 MapView 页面本身被频繁访问，可考虑将其从 lazy 改为 preload（trade-off）

---

## 3. 图片资源优化

### 问题

项目中可能包含未压缩的图片或 SVG 图标，影响加载速度。

### 实施步骤

**步骤 1：检查图片资源**
```bash
find src -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.svg" | head -20
```

**步骤 2：SVG 优化**
- 使用 `svgo` 压缩 SVG 文件
- 将小图标内联为 JSX 组件，避免额外网络请求

**步骤 3：图片懒加载**
- 对非首屏图片使用 `loading="lazy"` 属性
- 考虑使用 WebP 格式替代 PNG/JPEG

---

## 4. 字体优化

### 问题

当前在 `index.html` 中通过 Google Fonts 加载 `Noto Sans SC` 字体，导致额外的网络请求和渲染阻塞。

### 优化方案

**方案 A：自托管字体（推荐）**
- 下载 Noto Sans SC 字体文件（woff2 格式）
- 放入 `public/fonts/` 目录
- 使用 `@font-face` 声明，设置 `font-display: swap`

**方案 B：系统字体兜底**
- 移除 Google Fonts 加载
- 使用系统字体栈：`font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;`

**预期效果**
- 消除 Google Fonts 的网络请求延迟（尤其对国内用户）
- 约 50-100ms 的 FCP 提升

---

## 5. 预加载常用页面

### 问题

当前所有页面都通过 lazy loading 加载，导致页面切换时有短暂延迟。

### 优化方案

在用户空闲时预加载高频页面：

**步骤 1：确定高频页面**
- Dashboard（首页，访问频率最高）
- WaterSourceManager（水源地管理）
- MapView（地图）

**步骤 2：添加 prefetch 策略**

在现有 `preload.ts` 的 `preloadPage` 函数基础上，增加空闲时预加载：

```ts
// 在 App 初始化后，空闲时预加载高频页面
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    preloadPage('/dashboard');
    preloadPage('/sources');
  });
}

// 鼠标悬停/进入时预加载（已在 Layout 中实现）
```

---

## 6. 构建产物进一步瘦身

### 问题

各 vendor chunk 大小仍有优化空间：

| chunk | 大小 | 内容 |
|-------|------|------|
| `vendor-react.js` | 879KB | React + 未匹配的 node_modules |
| `vendor-docx.js` | 344KB | docx 库 |
| `vendor-html2canvas.js` | 198KB | html2canvas |

### 优化方案

**vendor-react 瘦身（影响最大）**
- 将 `zustand`、`react-router-dom` 等拆分为独立 vendor 或放入 calc-tools
- 当前 `vendor-react` 包含所有未匹配的 node_modules，部分依赖可能不需要在首屏加载

**检查方法**
```bash
# 查看 vendor-react 的构成
grep -oP "from\"./node_modules/[^/]+" dist/assets/vendor-react-aejGxeqO.js | sort -u
```

**docx 懒加载确认**
- `vendor-docx.js` 已通过动态导入（`await import('docx')`）按需加载，首屏不加载
- 无需进一步优化

---

## 7. CSS 优化

### 问题

Tailwind CSS 生成的 `index.css`（74KB）包含所有工具类，部分可能未使用。

### 优化方案

**确认 Tailwind 的 content 配置**
```js
// tailwind.config.js — 确保 content 路径精确覆盖使用的文件
content: ['./src/**/*.{ts,tsx}', './index.html'],
```

**进一步瘦身**
- 当前 Tailwind 3.4 已内置 JIT 模式，默认只生成使用到的类
- 74KB 的 CSS 对于 260+ 源文件的项目属于正常范围
- 可考虑使用 `purge` 或 `safelist` 精确控制

---

## 实施优先级建议

| 优先级 | 优化项 | 预期收益 | 工作量 |
|--------|--------|---------|-------|
| P0 | 数据类 chunk 懒加载 | 首屏 -395KB | 中 |
| P1 | 字体优化 | FCP 提升 50-100ms | 低 |
| P2 | 高频页面预加载 | 页面切换体验 | 低 |
| P3 | vendor-react 瘦身 | 首屏 -100~200KB | 高 |
| P4 | 图片优化 | 视情况 | 中 |
| P5 | CSS 优化 | 边际收益 | 低 |

---

## 验证方法

每次优化后使用以下命令验证效果：

```bash
# 1. 构建并查看 modulepreload 列表
grep "modulepreload" dist/index.html

# 2. 统计各 chunk 大小
ls -lh dist/assets/ | sort -k5 -rh | head -15

# 3. 总体积
du -sh dist/

# 4. 构建时间
time npx vite build 2>&1 | tail -3

# 5. 全量回归
npx vitest run && npx tsc --noEmit
```