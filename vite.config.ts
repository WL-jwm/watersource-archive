import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
  plugins: [
    react(),
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
            if (id.includes('jspdf')) {
              return 'vendor-jspdf';
            }
            if (id.includes('jszip')) {
              return 'vendor-jszip';
            }
            // papaparse：仅被数据导入（report-export 按需页）使用，
            // 独立分 chunk 避免打入首屏 vendor-react
            if (id.includes('papaparse')) {
              return 'vendor-papaparse';
            }
            // 其余node_modules归入vendor-react
            return 'vendor-react';
          }

          // ===== 应用代码 — 按依赖关系精细拆分 =====
          //
          // S10.1: Modulepreload 消减
          // 核心问题：calc-tools 是 src/lib/ 的 catch-all，包含导入 turf/xlsx/docx/leaflet 的文件
          // 由于 waterSourceStore(index) → zoneCalcEngine(calc-tools) 形成静态依赖链
          // 导致 calc-tools 被 modulepreload，连带所有 vendor chunk 预加载
          //
          // 修复策略：将导入 heavy vendor 的 lib 文件从 calc-tools 中分离
          // calc-tools 仅保留不依赖 heavy vendor 的核心引擎/工具
          //
          // S10.1-fix: toastStore 移入 calc-tools 打破循环依赖
          // report-export 文件（batchReportPackager/zoneReportGenerator 等）值导入 toast
          // from toastStore(index chunk) → 形成循环依赖 → Rollup 在 index 中注入
          // 对 report-export 的静态导入 → vendor-xlsx/vendor-docx 被 modulepreload
          // 将 toastStore 移入 calc-tools 后：report-export → calc-tools（非循环）

          if (id.includes('src/stores/toastStore')) {
            return 'calc-tools';
          }

          if (id.includes('src/lib/')) {
            // 报告导出工具 — 导入 xlsx/docx，仅在生成报告时按需加载
            if (id.includes('batchReportPackager') ||
                id.includes('zoneReportGenerator') ||
                id.includes('reportPdfExporter') ||
                id.includes('zoneExcelExporter') ||
                id.includes('dataExchange') ||          // imports xlsx
                id.includes('zoneGISExporter') ||
                id.includes('dataImportEngine') ||      // imports xlsx
                id.includes('overlayReportGenerator') ||// imports docx
                id.includes('importTemplate') ||        // imports xlsx
                id.includes('exportTemplateEngine')     // imports xlsx
            ) {
              return 'report-export';
            }

            // 叠加分析引擎 — 导入 @turf/turf，仅在叠加分析页面加载
            if (id.includes('multiSourceOverlayEngine') ||
                id.includes('zoneClipEngine')
            ) {
              return 'overlay-engine';
            }

            // 地图绘制工具 — 导入 leaflet，仅在地图页面加载
            if (id.includes('mapDrawTools')) {
              return 'map-tools';
            }

            // 其余 src/lib/ 文件（zoneCalcEngine, idb, undoManager, auditTrail 等）
            // 不依赖 heavy vendor，安全地留在 calc-tools
            // 按需释放：纯懒加载引用（不被首屏可达）的 lib 文件不强制归 calc-tools，
            // return undefined 让 Vite 按动态 import 边界自动归入对应懒加载页 chunk，
            // 减小首屏 calc-tools（P5：calc-tools 按需拆分）
            // 依赖分析（main.tsx 静态可达 + 反向引用图）：以下文件无任何首屏引用者
            const ondemandLibs = ['backupEngine','batchEditEngine','bufferAnalysisEngine','complianceChecker','conflictDetector','coordTransform','customFieldEngine','dataQualityEngine','dataSourceRegistry','dataValidator','eaConclusionEngine','homeCitySources','mergeStrategy','multiProjectAssessmentEngine','paramRecommenderV2','reportExportEngine','riskMatrixEngine','searchFilterEngine','sensitiveScreeningEngine','sensitivityEngine','spatialAnalysis','spatialAnalysisReportEngine','spatialDataImportEngine','spatialDensityEngine','spatialProximityEngine','spatialQueryEngine','spatialRelationMatrixEngine','syncEngine','tagEngine','timelineEngine','upstreamAnalysisEngine','useLoading','waterQualityTrend','waterSourceCoder','wellFieldCalcEngine','zoneCompareEngine','zoneCoordGenerator','zoneOverlapEngine'];
            const lf = id.split('/').pop()!.replace(/\.tsx?$/, '');
            if (ondemandLibs.includes(lf)) {
              return undefined;
            }

            return 'calc-tools';
          }

          // 页面组件和 store — 不返回，让 Vite 自动拆分
          // Vite 会根据导入关系将仅被 lazy 页面使用的 store/component
          // 自动分配到对应页面 chunk，而非强制归入 index
          // src/pages/, src/stores/, src/components/ → Vite 默认拆分
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // 禁用自动 modulepreload，避免 vendor-xlsx(423KB) 被预加载到每个页面
    // 改用手动在 index.html 中 preload 关键 chunk
    // 选择性 modulepreload：排除 vendor-xlsx(423KB) 避免被预加载到每个页面
    // 其他 chunk（vendor-react、calc-tools）保持正常 preload 确保首屏性能
    modulePreload: {
      resolveDependencies: (_filename, deps) => {
        return deps.filter((dep) => !dep.includes('vendor-xlsx') && !dep.includes('vendor-jspdf') && !dep.includes('vendor-jszip') && !dep.includes('vendor-papaparse'));
      },
    },
  },
});
