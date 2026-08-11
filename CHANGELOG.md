# 变更日志

## [P4.0.0] - 2026-08-11

### 按需数据切分（P4）

- **P4.1**: 全省水源地数据按城市切分 — 新增 `src/data/cities/` 13 个独立 chunk（每城市含水源地信息 + geo 坐标），`cityDataRegistry` 动态 import 加载
- **P4.2**: store 初始化策略改造 — `initDB` 首次只加载默认城市（石家庄），数据页首屏数据加载 208KB→18.56KB（-91%），其余城市空闲后台补齐
- **P4.3**: `preloadRemainingCities` — 后台逐个加载未加载城市，保证全量数据语义（搜索/地图/空间分析不受影响）
- **P4.4**: 数据完整性测试 — 新增 `cityDataRegistry.test.ts`（6 tests），验证切分合并后与全量静态数据一致
- **P4.5**: 存量代码清理 — 移除不再使用的 `loadStaticData`，修复 `importJSON` 中 unreachable code
- **P4.6**: Home 页数据源统一 — Home 改为复用 `waterSourceStore`（sources + getStats），空闲 `requestIdleCallback` 触发 `initDB`，不再单独加载 79KB+129KB 全量静态数据；新增 `homeCitySources` 转换工具（扁平记录→按级别分组）
- **P4.7**: dataSourceRegistry 按需改造 — `StaticDataSourceAdapter` 改用 `cityDataRegistry` 按城市动态加载，消除全量 `hebeiWaterSources`+`waterSourceGeoData` 打包（构建产物移除 208KB 两个大 chunk）
- **P4.8**: IDB 二次访问缓存优化 — `initDB` 增加已加载短路（`loaded && sources.length > 0` 直接复用内存，避免多页面重复全量读取）；二次访问 `water_sources`/`cities` 并行读取
- **P4.9**: papaparse 独立分 chunk — 仅被数据导入（report-export 按需页）使用的 papaparse 从 `vendor-react` 拆出为独立 `vendor-papaparse`（19.49KB，gzip 7.24KB），并从首屏 modulepreload 排除；vendor-react 457KB→437.53KB（gzip 155→148.30KB）

- **P5**: calc-tools 按需拆分 — 对 38 个“纯懒加载引用”（不被首屏可达）的 src/lib 文件不强制归 calc-tools，return undefined 让 Vite 按动态 import 边界自动归入对应懒加载页 chunk；calc-tools 166KB→55.20KB（gzip 19.54KB，首屏 -110KB/-67%）；依赖分析基于 main.tsx 静态可达集 + 反向引用图

- **P5.1**: file-saver 独立分 chunk — file-saver 原被归入 vendor-xlsx（432KB），审计日志/备份等“仅存文件”场景会连带加载整个 Excel 库；拆出独立 vendor-filesaver（2.98KB，gzip 1.46KB）并从 modulepreload 排除；AuditLog 页连带加载 432KB→2.98KB，vendor-xlsx 432→429KB 且仅被真正用 xlsx 的 chunk 依赖

### 测试
- 单元测试 1220/1220 通过（71 文件，+16），tsc 0 错误，ESLint 0 问题

## [S14.0.0] - 2026-08-06

### 平台工程化（S14）

- **S14.1**: 未使用变量治理 — 127 个文件的 import/变量清理
- **S14.2**: 显式 `any` 类型清零 — 26 处 `no-explicit-any` 全部消除（289→256 warnings）
- **S14.3**: 构建优化 — 移除 visualizer 插件，构建时间 11.89s→6.61s（-44%）
- **S14.4**: 错误处理增强 — 新增 `ErrorLogViewer` 组件，支持 IDB 错误日志浏览/筛选/清理
- **S14.5**: 测试覆盖 — 引擎测试覆盖 60/63
- **S14.6**: 项目文档 — 新增 CHANGELOG.md

## [S13.0.0] - 2026-08-06

### 报告智能化（S13）

- **S13.1**: 空间分析结果持久化 — `spatialAnalysisStore` + IDB v5（`spatial_analyses` store）
- **S13.2**: 历史对比引擎 — `spatialHistoryCompareEngine`，风险/距离/敏感目标/上游变化检测
- **S13.3**: 报告模板化 — `reportTemplateEngine`，三套模板（简洁/标准/详细），10 个可自定义章节
- **S13.4**: 报告导出增强 — `reportExportEngine`，支持 HTML 预览/PDF 下载/docx 生成
- **S13.5**: 批量导出集成 — `batchSpatialReportExport`，ZIP 打包下载
- **S13.6**: 面板升级 — `SpatialAnalysisTools` 新增历史记录 Tab，自动保存分析结果

### 测试
- 单元测试 1197/1197 通过（67 文件），tsc 0 错误，ESLint 0 问题

## [S12.0.0] - 2026-08-06

### 空间分析阶段（S12）— 12 项功能，5 个 Batch

- **S12.1**: 邻近水源地检索 — `spatialProximityEngine`（bearing/16 方位/距离排序）
- **S12.2**: 多边形精确求交 — `zoneOverlapEngine`（Sutherland-Hodgman 裁剪+鞋带公式）
- **S12.3**: 环评风险矩阵 — `riskMatrixEngine`（红/黄/绿线分级+环评结论）
- **S12.4**: 空间密度聚类 — `spatialDensityEngine`（网格密度+贪心聚类+最近邻指数）
- **S12.5**: 敏感目标筛查 — `sensitiveScreeningEngine`（8 类敏感目标+环评建议）
- **S12.6**: 空间关系矩阵 — `spatialRelationMatrixEngine`（项目×水源地关联矩阵）
- **S12.7**: 汇水上游判断 — `upstreamAnalysisEngine`（流向 8 方位+方位角）
- **S12.8**: 空间分析报告 — `spatialAnalysisReportEngine`（综合报告生成）
- **S12.9**: 地图空间查询 — `SpatialQueryPanel` + `MapView` 集成
- **S12.10**: 多项目批量评估 — `multiProjectAssessmentEngine`（综合评分+排序）
- **S12.11**: 历史对比（移入 S13）
- **S12.12**: 空间数据导入 — `spatialDataImportEngine`（GeoJSON/KML/CSV）

### 关键指标
- 单元测试 1171/1171 通过（64 文件），tsc 0 错误，build 11.9s
- 路由页面 14 个，DB_VERSION 5

## [S11.0.0] - 2026-08-05

### 数据治理阶段（S11）
- S11.1-S11.12: 数据同步、错误日志、回收站、标签系统、批量编辑、自定义字段、导出模板、时间线、定时备份、数据质量仪表盘

## [S10.0.0] - 2026-07-01

### 前期阶段（S0-S10）
- S0: 项目初始化与基础架构
- S1-S5: 水源地管理、区划、保护区计算、叠加分析
- S6-S10: 合规检查、报告生成、导出、错误处理、项目分析