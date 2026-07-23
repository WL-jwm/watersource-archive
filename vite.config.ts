import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 第三方库 — 按包名精确匹配
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') ||
                id.includes('scheduler') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            if (id.includes('xlsx') || id.includes('file-saver')) {
              return 'vendor-xlsx';
            }
            if (id.includes('docx')) {
              return 'vendor-docx';
            }
            if (id.includes('html2canvas')) {
              return 'vendor-html2canvas';
            }
            if (id.includes('@turf')) {
              return 'vendor-turf';
            }
            // 其他node_modules（zustand等）归入vendor-react避免循环依赖
            return 'vendor-react';
          }

          // 应用代码 — 按目录拆分
          // P2-1: 数据文件通过 dynamic import 按需加载，Vite 自动拆分为独立 chunk
          // 仅 hebeiDivisions.ts (26KB) 静态 import，打包入 index chunk
          // hebeiWaterSources.ts / waterSourceGeoData.ts / hebeiTownships.ts / sampleData.ts 动态 import

          // 计算引擎与导出工具（~80KB，按需加载）
          if (id.includes('src/lib/')) {
            return 'calc-tools';
          }

          // 页面组件和store留在主chunk（index.js）
          // src/pages/, src/stores/, src/components/ → 默认不return，归入index
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
