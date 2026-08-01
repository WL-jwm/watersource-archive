import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
    }),
  ],
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
            // 其余node_modules归入vendor-react（zustand依赖react，拆分会致循环依赖）
            return 'vendor-react';
          }

          // 应用代码 — 按目录拆分
          // P2-1: 数据文件通过 dynamic import 按需加载，Vite 自动拆分为独立 chunk
          // 仅 hebeiDivisions.ts (26KB) 静态 import，打包入 index chunk
          // hebeiWaterSources.ts / waterSourceGeoData.ts / hebeiTownships.ts / sampleData.ts 动态 import

          // 计算引擎与导出工具
          // P-Perf: 拆分为核心引擎(calc-tools)和报告导出工具(report-export)
          // 报告导出工具仅在生成报告时按需加载
          if (id.includes('src/lib/')) {
            if (id.includes('batchReportPackager') ||
                id.includes('zoneReportGenerator') ||
                id.includes('reportPdfExporter') ||
                id.includes('zoneExcelExporter') ||
                id.includes('dataExchange') ||
                id.includes('zoneGISExporter')) {
              return 'report-export';
            }
            return 'calc-tools';
          }

          // 页面组件和store留在主chunk（index.js）
          // src/pages/, src/stores/, src/components/ → 默认不return，归入index
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
