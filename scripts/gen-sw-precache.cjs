/**
 * gen-sw-precache.js
 *
 * 在 `vite build` 之后运行：扫描 dist/index.html 的首屏资源引用
 * （script src / modulepreload / stylesheet），将带 hash 的构建产物
 * 自动注入 dist/sw.js 的 PRECACHE_URLS，使 Service Worker 首次安装时
 * 预缓存首屏核心 JS/CSS，实现二次访问近乎零网络加载与离线可用。
 *
 * 说明：
 * - public/sw.js 保持为「模板」（不含任何 assets 清单）。
 * - 每次构建后，dist/sw.js 由 public 复制而来，本脚本只改 dist/sw.js，
 *   不影响源模板，下次构建自动用最新的 hash 清单重新注入。
 * - 懒加载 chunk 不走预缓存，由 sw.js 的 runtime 缓存策略按需缓存。
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const swPath = path.join(distDir, 'sw.js');
const htmlPath = path.join(distDir, 'index.html');

// ---- 1. 解析 index.html 的首屏资源 ----
const html = fs.readFileSync(htmlPath, 'utf8');
const firstScreen = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
  const p = m[1];
  if (p.startsWith('./assets/')) {
    firstScreen.add(p);
  } else if (p.startsWith('assets/')) {
    firstScreen.add('./' + p);
  }
}
const sorted = [...firstScreen].sort();
if (sorted.length === 0) {
  console.error('未在 index.html 中发现任何首屏 assets，中止');
  process.exit(1);
}

// ---- 2. 生成 PRECACHE_URLS 块（基础项 + 首屏资源） ----
const entries = [
  "  './',",
  "  './index.html',",
  "  './manifest.json',",
  "  './data/hebeiAdminBoundaries.json',",
  ...sorted.map((a) => `  '${a}',`),
];
const precacheBlock = `const PRECACHE_URLS = [\n${entries.join('\n')}\n];`;

// ---- 3. 替换 dist/sw.js 中的 PRECACHE_URLS ----
let sw = fs.readFileSync(swPath, 'utf8');
const re = /const PRECACHE_URLS = \[[\s\S]*?\];/;
if (!re.test(sw)) {
  console.error('未在 dist/sw.js 中找到 PRECACHE_URLS 块');
  process.exit(1);
}
sw = sw.replace(re, precacheBlock);
fs.writeFileSync(swPath, sw);

console.log(`SW precache 已更新：注入 ${sorted.length} 个首屏资源`);
sorted.forEach((a) => console.log('  ', a));
