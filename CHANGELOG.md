# 变更日志

## [P8.11.2] - 2026-08-14

### 归档页新增「待核实坐标」在线管理

- 归档水源地档案页新增 Tab「待核实坐标」，专门管理 52 条待补坐标水源地
- 支持**在线填写精确井位坐标**（经度/纬度/备注），点「保存核实」标记已核实；可取消核实
- 参考坐标（空间档案资料包高德近似值）自动预填入输入框，方便核对
- 已核实状态持久化到 localStorage（`watersource-wait-coords`，新 store `waitCoordStore.ts`），刷新不丢失
- 支持按已核实/未核实筛选、关键词搜索，已核实行高亮

### 测试
- tsc 0 错误、ESLint 0 问题

## [P8.11.1] - 2026-08-14

### 归档水源地档案页合并空间档案资料包

- 归档档案库由 24 条扩展为 **85 条**：U盘收集报告库 24 + 空间档案资料包 61（按名称去重，跳过与现有强重复者）
- 归档页新增**来源筛选**（收集报告库 / 空间档案资料包）与**来源徽标**，坐标列显示定位坐标（高德行政中心近似值标注）
- 85 条分类：待补坐标 52、已接入 3、已收录 7、部分收录 23
- `ArchiveSource` 接口新增 `source`（来源）与 `lng/lat`（定位坐标）字段

### 测试
- tsc 0 错误、ESLint 0 问题

## [P8.11.0] - 2026-08-14

### 水源地空间档案资料包接入（全部）

- 从「水源地空间档案_完整资料包」接入，地图新增两个独立图层：
  - **资料包点位**：63 个水源地高德定位（青色圆点），弹窗显示名称/城市/坐标/定位方式/精度（乡镇级为行政中心近似值，标注待核实）
  - **资料包边界**：14 个已空间化保护区面（橙色虚线），弹窗显示名称/城市/保护范围/来源（原有/补全）
- 匹配分析：63 个水源地中平台缺失 41 个（可新增）、部分收录 19 个、平台已有 3 个；14 个保护区面全部可作精确边界参考
- 新增数据文件：`src/data/archiveGeoWells.ts`（63 定位）、`src/data/archiveGeoBoundaries.ts`（14 面）
- 地图开关新增「资料包点位」「资料包边界」按钮；坐标 WGS84（资料包标注），保留近似/待核实标记

### 测试
- tsc 0 错误、ESLint 0 问题、构建成功

## [P8.10.0] - 2026-08-14

### 归档水源地档案批量录入

- 将 U盘「收集报告」库 ws_sources 中 24 条有实质名称的水源地整理为平台**归档水源地档案**模块（新增路由 /archive-sources 与侧边栏入口）
- 档案分类：**待补坐标 13**、已接入（水井/归档边界）3、已收录 5、部分收录 3
- 新增数据文件 `src/data/archiveSources.ts`（名称/地区/水源类型/坐标状态/档案状态/批复文号/平台收录情况/核验状态），批复文号等元数据一并收录
- 页面支持按状态统计卡片筛选 + 关键词搜索，各状态配色区分
- 无坐标水源地以档案形式录入，不污染统一点位库；待补坐标后可经「归档水源地新增模板」接入地图图层

### 测试
- tsc 0 错误、ESLint 0 问题

## [P8.9.0] - 2026-08-14

### 归档水源地数据接入（独立图层）

- 从 U盘「收集报告」归档成果（eia_gw_params.db）接入水源保护区精确数据，作为**独立图层**展示（保留待核验标记，与现有 KMZ 边界可对比）：
  - **水井图层**：6 口精确井位（丽阳村取水井 1 口、献县水源地 1#~5# 井群 5 口），棕色圆点，弹窗显示井名/水源地/地区/水质类型/坐标/出水量/待核验标记
  - **归档边界图层**：3 个精确保护区多边形（丽阳村一级 6 拐点、丽阳村准保护区 4 拐点、献县一级 4 拐点，拐点闭合），紫色虚线，弹窗显示水源地/级别/拐点数/待核验标记
- 新增数据文件：`src/data/archiveWells.ts`、`src/data/archiveBoundaries.ts`（由 ws_wells / ws_corners 自动生成）
- 地图右上角新增「水井」「归档边界」开关按钮，可独立开关

### 测试
- tsc 0 错误，构建成功

## [P8.8.1] - 2026-08-14

### 存疑项归类批量修正

- 对 245 个「不含井号却归为井」的存疑边界名称，结合点位水源类型 + 关键词规则自动预判，并按预判结果批量修正 kind
- 修正结果：**176 环**由「井」改为「保护区范围」（廊坊 95、唐山 18、张家口 15、邢台 12、保定 10 等）
- 修正后边界 kind 分布：保护区范围 746 环、井 512 环
- 规则：点位精确/包含匹配地表水→保护区范围；名称含「水库/备用水源/集中式/水源地」→保护区范围；含「井」→保持井；未命中→待人工（58 个名称留存人工核定）
- 内联离线数据已重建；统计表、按名称核对表、245 项预判清单均已同步更新

### 测试
- zoneBoundaryData（1258 环校验）/zoneBoundarySource/actualBoundaryAvoidance 测试通过，tsc 0 错误，build 成功

## [P8.8.0] - 2026-08-14

### 保护区范围与井字段区分

- **边界数据加 kind 字段**：zone-boundaries 每条要素新增 `kind`（`井` / `保护区范围`），按名称聚合保护区级别判定——含二级/准/核心/缓冲区 → `保护区范围`，仅一级保护区 → `井`（1258 环：保护区范围 570、井 688）
- **点位数据加 kind 字段**：waterSourceGeo.json 与 data/cities/*.ts 的 cityGeo 每条新增 `kind`，按水源类型判定——地下水 → `井`，地表水 → `保护区范围`（1002 条：保护区范围 60、井 942）
- **类型联动**：`ZoneBoundary`、`WaterSourceRecord`、`GeoSource` 均新增 `kind` 字段，store 构建记录时从 geo 带出 kind
- **地图可视化区分**：实际保护区边界图层按 kind 着色（井=棕色，保护区范围=蓝绿色系）；边界与点位弹窗均显示「要素类型」字段；图例新增「井（单井保护区）」项
- **数据重建**：内联离线数据 zoneBoundaryInlineData.ts 重新生成（含 kind）；public/zone-boundaries/*.json、waterSourceGeo.json、13 个城市 cityGeo 均已同步；原始数据已备份（scripts/backup_kind/）

### 测试
- 边界/点位相关测试通过（zoneBoundaryData 1258 环校验、zoneBoundarySource、actualBoundaryAvoidance、waterSourceStore 缓存/预加载），tsc 0 错误，ESLint 0 问题

## [P8.7.0] - 2026-08-14

### 地图交互增强（三项）

1. **筛选联动地图居中**：切换级别（市级/县级/乡镇级）、类型（地表水/地下水）或城市时，地图自动 fitBounds 到当前筛选结果范围并带动画居中；恢复「全部」时回到全省视图。解决了此前切换级别/地区时保护区显示与地图视图不联动的问题。
2. **管理页一键跳转 GIS 地图**：水源地管理列表操作列新增「地图」按钮（该水源地有坐标时显示），点击后跳转 GIS 地图界面并自动定位到该水源地、放大到 12 级并弹出信息窗（通过 /map?focus=名称 传参）。
3. **卫星图底图**：地图右上角新增「标准 / 卫星」底图切换按钮；卫星底图使用高德影像瓦片并叠加注记层，支持随时来回切换。

### 测试
- 单元测试全量通过（1266），tsc 0 错误，ESLint 0 问题，build 成功（4m8s）

## [P8.6.0] - 2026-08-14

### 离线单机版（file:// 拷贝即用）

- **内联边界数据**：新增 src/data/zoneBoundaryInlineData.ts（gen_zone_inline 自动生成，13 城 1258 环全部内联）
- **统一数据源**：新增 zoneBoundarySource.ts，file:// 协议下用内联数据（避免 fetch 本地 JSON 被浏览器拦截），http/https 仍走 fetch；模块级缓存
- **加载改造**：useActualZoneLayer、actualBoundaryAvoidance 均委托统一数据源，http 部署首屏不受影响（内联数据为独立 chunk，仅 file:// 动态加载）
- **用途**：把 dist 拷到共享盘/每台电脑，双击 index.html 即可离线使用全部功能（含地图边界、实际边界避让分析）
- **新增测试**：zoneBoundarySource.test.ts（4 tests）验证内联数据覆盖全部城市、非空、总环数 1258、结构合法

### 测试
- 单元测试全量通过（1266），tsc 0 错误，ESLint 0 问题，build 成功

## [P8.5.0] - 2026-08-13

### 实际保护区边界数据 清洗（public/zone-boundaries）

- **数据清洗**：对平台实际保护区边界数据（public/zone-boundaries，1262 个多边形环）执行保守清洗
  - 剔除空名称要素 1 条
  - 尾随空格命名规范化（name.strip）7 条
  - 去除完全重复环（同 name+level+ring）3 条（后孟营水源地三个级别各 1）
  - 清洗后 1262 → 1258 环，已更新 index.json
- **噪声命名保留**：命名不规范（地名简写/含机构词）106 条保留不删，仅生成待核验清单，避免误删真实井位数据
- **交付物**：清洗版 GeoJSON（河北省水源保护区范围_清洗版.geojson，1258 要素，城市字段补全）+ 数据清洗报告 Excel（清洗说明/待核验命名/城市分布对比 3 Sheet）；原始数据已备份（public/zone-boundaries-backup-20260813/ 与 GeoJSON 原始备份）
- 数据测试（zoneBoundaryData 5 tests）保持通过

### 测试
- 单元测试全量通过，tsc 0 错误，ESLint 0 问题

## [P8.4.1] - 2026-08-13

### 实际边界避让分析 — Excel 报告导出

- ActualBoundaryTab 新增「导出 Excel 报告」按钮，使用 SheetJS(xlsx) 前端生成多 Sheet 报告：
  - Sheet「项目信息」：项目名称/经纬度/半径/检查数/需避让数/最近距离/已取消剔除数/是否涉及/导出时间
  - Sheet「需避让清单」：需避让保护区（名称/城市/级别/关系/距边界/面积/审计状态）
  - Sheet「全部检查」：全量检查结果（含未涉及与已取消，便于复核）
- 文件名以项目名自动命名并去除非法字符

### 测试
- tsc 0 错误，ESLint 0 问题，全量测试通过

## [P8.4.0] - 2026-08-13

### 实际边界避让分析（真实保护区边界，对接开发区规划避让）

- **避让引擎**：新增 src/lib/actualBoundaryAvoidance.ts，基于真实保护区边界多边形（zone-boundaries/KMZ）用 turf 精确判断项目点与边界的包含/相交/距离，区别于计算圈层的圆形近似
  - checkPointAgainstBoundary 纯函数：booleanPointInPolygon + pointToPolygonDistance，输出 isInside/isInvolved/edgeDistanceM/areaKm2，并叠加审计状态
  - runBoundaryAvoidance：按需加载城市边界 + 全量判断；已取消保护区剔除出避让判定、已调整标注需核验
  - NEAR_THRESHOLD_M=100m 临近阈值
- **UI**：空间分析工具箱新增「实际边界避让」Tab（src/components/spatial/ActualBoundaryTab.tsx）
  - 输入：项目名称/经度/纬度/项目半径(可选)/城市范围(全省或指定)
  - 输出：检查保护区数 / 需避让数 / 最近边界距离 / 已取消剔除数 统计卡片
  - 需避让列表（在保护区内/触及边界 + 审计标记）+ 安全提示（最近边界 + 是否临近）
- **数据加载**：复用 public/zone-boundaries 按需 fetch，模块级缓存
- **新增测试**：actualBoundaryAvoidance.test.ts（9 tests）验证内/外判断、缓冲涉及、审计匹配、面积、距离量级

### 测试
- 单元测试全量通过，tsc 0 错误，ESLint 0 问题

## [P8.3.0] - 2026-08-13

### 缺失保护区清单 UI（P8.1/8.2 深化）

- **missingZonesStore**：新增缺失清单 Store（Zustand + localStorage），管理"官方新增但 KMZ 缺失"保护区（MISSING_ZONES）的"已补充"标记，支持逐项切换与重置
- **管理页 Tab 化**：ZoneAuditManager 改造为双 Tab（审计规则 / 缺失清单），页面标题改为"保护区数据核验"
  - 「缺失清单」Tab：缺失项总数 / 已补充 / 待补充 统计卡片 + 表格（城市/名称/批复/说明）+ 每项"标记已补充"按钮（已补充行变绿变灰）+ 顶部待补充数量角标
  - 「审计规则」Tab 保留原全部功能
- **新增测试**：missingZonesStore.test.ts（5 tests）验证初始状态/标记持久化/取消标记/重置/清单完整性

### 测试
- 单元测试全量通过，tsc 0 错误，ESLint 0 问题

## [P8.2.0] - 2026-08-13

### 保护区审计规则 可视化管理（P8.1 深化）

- **zoneAuditStore**：新增审计规则 Store（Zustand + localStorage 持久化），生效规则集可由用户维护；首次使用以内置默认规则初始化，提供新增/编辑/删除/恢复默认
- **审计规则管理页**：新增 src/pages/ZoneAuditManager.tsx（路由 /zone-audit），表格展示规则 + 统计卡片（规则总数/已取消/已调整）+ 新增/编辑弹窗 + 删除/恢复默认（带确认）
- **动态规则接入**：useActualZoneLayer 改为从 store 读取生效规则集（auditZoneStatusWithRules 纯函数），规则修改后地图图层即时生效，无需改代码；zoneAuditMeta.auditZoneStatus 委托该纯函数保持兼容
- **路由与入口**：App.tsx 注册 /zone-audit 路由、Layout 侧边栏新增"保护区审计规则"入口、preload.ts 注册路由供预加载与 PAGE_KEYS 校验
- **新增测试**：zoneAuditStore.test.ts（7 tests）验证默认加载/持久化/CRUD/恢复默认/动态匹配；zoneAuditMeta.test.ts 保持通过

### 测试
- 单元测试全量通过，tsc 0 错误，ESLint 0 问题

## [P8.1.0] - 2026-08-13

### 实际保护区边界 审计标记（已取消/已调整）

- **审计元数据**：新增 src/data/zoneAuditMeta.ts，基于 KMZ 与省政府批复差异比对结论，定义已取消/已调整保护区规则（ZONE_AUDIT_RULES）与官方新增 KMZ 缺失清单（MISSING_ZONES）
- **已取消标记**：满城区(保定)、南大港(沧州)、定州经开区应急备用(定州) 等已被省政府批复取消的保护区，渲染为灰色实线，弹窗提示"已取消，叠加分析请排除"
- **已调整标记**：羊角铺(邯郸)、陡河(唐山)、桃林口(秦皇岛)、腰站堡(张家口)、泊头(沧州)、栾城(石家庄) 等已调整保护区，渲染为橙色虚线，弹窗提示"KMZ 为调整前范围，需核对最新批复"
- **useActualZoneLayer 增强**：渲染时按城市+名称匹配审计规则，命中要素应用特殊样式并附加审计弹窗
- **MapLegend 图例**：实际保护区范围下新增"已取消(过期)""已调整(需核验)"图例项
- **新增测试**：zoneAuditMeta.test.ts（6 tests）验证规则城市合法、关键词/状态完整、已取消/已调整命中、跨城市不误伤、缺失清单完整

### 测试
- 单元测试全量通过，tsc 0 错误，ESLint 0 问题

## [P8.0.0] - 2026-08-13

### 实际保护区范围边界图层（GIS 真实边界）

- **数据接入**：解析用户提供的 2021 年 KMZ 文件（河北省全省水源地保护区范围，县级以上），提取 1153 个保护区要素（一级 917 / 二级 149 / 准保护 85 / 核心区 1 / 缓冲区 1），按城市归属映射（名称关键字 + 坐标邻近法兜底）归属全省 13 城，生成 GeoJSON（河北省水源保护区范围.geojson）与逐城数据文件
- **按需加载**：public/zone-boundaries/<城市>.json + index.json，运行时按需 fetch，避免增大 JS bundle（dist 打包 3.6MB 静态资源，不进首屏 JS）
- **新增 useActualZoneLayer Hook**：按当前选中城市 fetch 边界数据并渲染 L.polygon 多边形（模块级缓存避免重复请求）
- **MapView 集成**：新增 showActualZones 状态 + actualZoneLayerRef，切换时清理旧图层
- **MapFilters 新增开关**：蓝色「实际范围」按钮切换真实边界图层显示
- **MapLegend 新增图例**：一级蓝 #2563EB / 二级绿 #10B981 / 准保护紫 #7C3AED，与计算圈层红色系区分
- **数据完整性测试**：新增 zoneBoundaryData.test.ts（5 tests）验证文件存在、index 计数一致、要素结构合法、坐标在河北合理范围、环闭合；要素逐环点断言数据量大，放宽超时至 60s
- **数据交付物**：河北省水源保护区KMZ 目录下 GeoJSON（1153 要素）+ 汇总 Excel（按城市/按水源地/全部要素 3 Sheet）

### 测试
- 单元测试全量通过，tsc 0 错误，ESLint 0 问题

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

### 测试
- 单元测试 1220/1220 通过（71 文件，+16），tsc 0 错误，ESLint 0 问题


## [P5.0.0] - 2026-08-11

### 首屏 chunk 深度拆分（P5）

- **P5**: calc-tools 按需拆分 — 对 38 个“纯懒加载引用”（不被首屏可达）的 src/lib 文件不强制归 calc-tools，return undefined 让 Vite 按动态 import 边界自动归入对应懒加载页 chunk；calc-tools 166KB→55.20KB（gzip 19.54KB，首屏 -110KB/-67%）；依赖分析基于 main.tsx 静态可达集 + 反向引用图
- **P5.1**: file-saver 独立分 chunk — file-saver 原被归入 vendor-xlsx（432KB），审计日志/备份等“仅存文件”场景会连带加载整个 Excel 库；拆出独立 vendor-filesaver（2.98KB，gzip 1.46KB）并从 modulepreload 排除；AuditLog 页连带加载 432KB→2.98KB，vendor-xlsx 432→429KB 且仅被真正用 xlsx 的 chunk 依赖
- **P5.2**: Service Worker 预缓存首屏资源 — 新增 `scripts/gen-sw-precache.cjs`，`vite build` 后扫描 index.html 将首屏 JS/CSS（index/vendor-react/calc-tools + CSS）自动注入 `dist/sw.js` 预缓存清单；`public/sw.js` 保持纯净模板，每次构建注入最新 hash；二次访问近乎零网络加载、支持离线，懒加载 chunk 仍走 runtime 缓存

### 优化效果汇总

本次首屏 chunk 深度拆分（P4.9 / P5 / P5.1）的累计效果（实测构建产物）：

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| 首屏 JS（raw） | ~723KB | 586.19KB | **-137KB（-19%）** |
| 首屏 JS（gzip 传输） | ~234KB | 185.93KB | **-48KB（-21%）** |
| vendor-react | 457KB | 427.32KB | 拆出 papaparse（19KB） |
| calc-tools | 166KB | 58.41KB | **-108KB（-65%）** |

- **首屏** 仅保留 vendor-react（react 生态核心，不可再拆）+ calc-tools 两个 chunk，且 calc-tools 已大幅瘦身
- **按需化**：papaparse（19.03KB）、file-saver（2.91KB）拆为独立小 chunk，不进首屏、仅在使用页加载
- **连带加载消除**：AuditLog/备份等“仅存文件”页不再连带 419KB vendor-xlsx（该页 432KB→2.91KB，-99%）；vendor-xlsx 仅被真正用 xlsx 的 chunk 依赖

### 测试
- 单元测试 1220/1220 通过（71 文件），tsc 0 错误，ESLint 0 问题



## [P6.0.0] - 2026-08-11

### 高频页面预加载修复（P6）

- **P6**: 修正 `HIGH_FREQ_PAGES` 无效路径 — 高频列表原含 `/sources`、`/calc` 两个非真实路由（App.tsx 中不存在），会被 `preloadPage` 静默跳过，导致高频预加载实际只覆盖 3 个页面；修正为真实高频路由 `['/manage','/zone-calc','/map','/analysis','/overlay']`，并导出 `PAGE_KEYS` 供测试锁定防复发
- 新增 `preload.test.ts`（7 tests）：校验 PAGE_KEYS 覆盖全部静态路由、HIGH_FREQ_PAGES 均为有效路径、未注册路径安全跳过
- **P6.1**: 统计页数据补齐体验优化 — 进入 Dashboard 统计页主动触发 initDB + `preloadRemainingCities`（修复仅显示默认城市石家庄的不完整统计）；store 新增 `preloadingCities` 状态，补齐中统计卡片显示"正在加载其余城市数据"提示；新增 `waterSourceStorePreload.test.ts`（3 tests）；清理 Dashboard/CodeStatsPanel 6 个未使用 import
- **P6.2**: 修复 IDB 连接被关闭导致的按城市补齐失败 — 根因：`dataVersionEngine.ensureVersionStores` 为创建版本 store 调用 `db.close()` 关闭了 idb.ts 全局连接，且 `onclose` 为异步派发，导致异步 `preloadRemainingCities` 的 `dbPutBatch` 拿到已关闭连接报 "database connection is closing"，全省仅剩石家庄数据；修复：getDB 用 `transaction()` 同步校验连接有效性（关闭时重建）+ 绑定 onclose 清空缓存；同时修复 Dashboard 水源地总数卡片硬编码"13个地级市"文案为动态值；实测覆盖城市 1→13、已编码水源地 90→992

### 测试
- 单元测试 1230/1230 通过（73 文件，+10），tsc 0 错误，ESLint 0 问题


## [P7.0.0] - 2026-08-11

### index.js 入口瘦身（P7）

- **P7**: 复查 index chunk 构成 — 确认 hebeiWaterSources（196KB）仅被 `import type` 引用、已 tree-shake，不在首屏（排除误判）；hebeiDivisions（38KB）为首屏区划选择器功能依赖保留；将 BackupSettingsModal（弹窗，初始关闭）lazy 化，index.js 100.5KB→90.66KB（gzip 24→21.87KB），弹窗独立为 8.08KB 按需 chunk（gzip 3.03KB）
- 顺带清理 Layout.tsx 既存 7 个 unused vars（ESLint 清零）

### 测试
- 单元测试 1227/1227 通过（72 文件），tsc 0 错误，ESLint 0 问题

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