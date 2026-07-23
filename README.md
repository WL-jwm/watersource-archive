# 水源地保护区档案管理与环评辅助平台

> 河北省饮用水水源地数字化档案管理、保护区划分计算与建设项目环评辅助工具

基于 React 18 + TypeScript + Vite 构建的专业级环保业务平台，覆盖水源地建档、保护区划分计算、空间分析、数据版本管理、报告生成等全流程，内置河北省全部地市水源地基础数据，支持离线运行与 PWA 安装。

## 目录

- [功能总览](#功能总览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [核心模块](#核心模块)
- [数据架构](#数据架构)
- [质量保障](#质量保障)
- [部署方式](#部署方式)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 功能总览

### P0-P1 基础档案管理

| 功能 | 说明 |
|------|------|
| 水源地档案管理 | 新增/编辑/删除水源地记录，支持结构化表单录入 |
| 六大维度信息 | 基本信息、水井信息、水文地质、水质监测、保护区划分、污染源调查 |
| 报告导入导出 | JSON 格式报告数据导入/导出，支持搜索与批量操作 |
| 水质标准评价 | GB/T 14848-2017 标准，45 项指标标准指数法评价，达标率统计 |
| 行政区划总览 | 河北省全部地市/县区行政区划浏览，支持自定义行政区划 |

### P2-P3 保护区划分计算

| 功能 | 说明 |
|------|------|
| 经验值法 | 根据 HJ 338-2018 规范，按水源地类型直接设定保护区半径 |
| 解析法（Cooper-Jacob） | 基于水文地质参数（K、S、T、M、I、n）计算时间 capture zone |
| 批量计算 | 多水源地批量保护区划分，结果自动持久化到 IndexedDB |
| 拐点坐标生成 | 圆形/矩形保护区边界拐点经纬度自动生成，支持 16/32/64 点 |
| 参数智能推荐 | 根据含水层类型和已有参数自动推荐计算参数范围 |
| 计算结果导出 | Excel 多 Sheet 导出（参数表/面积表/拐点坐标表/边界描述表） |

### P4 空间分析与 GIS

| 功能 | 说明 |
|------|------|
| 交互式地图 | Leaflet 地图展示水源地分布、保护区范围、行政区划边界 |
| 建设项目环评分析 | 输入项目坐标与占地范围，一键分析是否涉及水源保护区 |
| 行政区划裁剪 | 保护区与行政区划边界求交集，输出实际管控面积 |
| 缓冲分析 | 保护区边界与敏感目标（学校/医院/居民区等）距离分析 |
| GIS 坐标导出 | GeoJSON / KML / Shapefile 格式导出，兼容 ArcGIS / QGIS |
| 参数敏感性分析 | 关键参数变化对保护区面积的影响曲线 |
| 水源地编码规范化 | HJ/T 415-2008 编码规则，批量生成与校验 |

### P5 数据管理增强

| 功能 | 说明 |
|------|------|
| Excel/CSV 导入 | 拖拽上传，自动列名映射，表格预览 + 校验高亮 |
| 数据校验引擎 | 必填字段、类型格式、坐标范围、重复检测 |
| 多格式导出 | Excel / CSV / JSON 三格式导出，支持筛选后导出 |
| 数据看板 | 按城市/类型/级别多维统计，SVG 可视化图表 |

### P6 版本管理与历史回溯

| 功能 | 说明 |
|------|------|
| 版本快照 | 手动/自动创建数据版本快照，基于 IndexedDB 存储 |
| 版本对比 | 两个版本间差异明细（新增/修改/删除） |
| 版本回滚 | 一键回滚到任意历史版本 |
| 变更日志 | 自动记录数据变更操作（增/删/改）及时间戳 |

### 通用功能

| 功能 | 说明 |
|------|------|
| 暗色模式 | CSS 变量方案，明暗主题一键切换 |
| 响应式设计 | 桌面/平板/手机自适应布局 |
| PWA 支持 | 可安装到桌面/主屏幕，支持离线 Service Worker |
| 离线运行 | 构建产物支持 `file://` 直接打开，无需服务器 |
| 错误边界 | 全局 ErrorBoundary，ChunkLoadError 自动恢复 |

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| UI 框架 | React | 18.3 |
| 构建工具 | Vite | 5.4 |
| 类型系统 | TypeScript | 5.5 |
| 样式方案 | Tailwind CSS | 3.4 |
| 状态管理 | Zustand | 4.5 |
| 路由 | React Router (HashRouter) | 6.26 |
| 地图 | Leaflet | 1.9 |
| 地理计算 | Turf.js | 7.3 |
| 图表 | Recharts | 3.9 |
| Excel 处理 | SheetJS (xlsx) | 0.18 |
| CSV 解析 | PapaParse | 5.5 |
| Word 报告 | docx | 9.7 |
| 截图导出 | html2canvas | 1.4 |
| 本地存储 | IndexedDB + localStorage | - |
| 测试框架 | Vitest + Testing Library | 4.1 / 16.3 |
| 代码质量 | ESLint 9 + Prettier 3 + husky 9 | - |
| CI/CD | GitHub Actions + lint-staged | - |

---

## 快速开始

### 环境要求

- Node.js >= 16
- npm >= 8

### 安装与运行

```bash
# 克隆仓库
git clone git@github.com:WL-jwm/watersource-archive.git
cd watersource-archive

# 安装依赖
npm install

# 开发模式（http://localhost:5173）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | TypeScript 编译 + Vite 构建 |
| `npm run test` | 运行全部测试（157 项） |
| `npm run lint` | ESLint 代码检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化全部源码 |
| `npm run format:check` | Prettier 格式检查（不修改文件） |
| `npm run ci` | 本地完整 CI 验证（tsc + lint + prettier + test + build） |

---

## 项目结构

```
watersource-archive/
├── src/
│   ├── components/                  # 通用组件
│   │   ├── ErrorBoundary.tsx        # 全局错误边界
│   │   ├── SourceFormModal.tsx      # 水源地新增/编辑模态框
│   │   ├── DataImportPanel.tsx      # 数据导入预览面板
│   │   ├── DivisionSelector.tsx     # 行政区划选择器
│   │   └── layout/
│   │       └── Layout.tsx           # 主布局（侧边栏 + 头部 + 内容区）
│   │
│   ├── pages/                       # 页面组件
│   │   ├── Home.tsx                 # 首页（报告列表 + 统计概览）
│   │   ├── Dashboard.tsx            # 数据看板（多维统计 + SVG 图表）
│   │   ├── MapView.tsx              # 交互式地图（Leaflet）
│   │   ├── WaterSourceManager.tsx   # 水源地数据管理（CRUD + 导入导出）
│   │   ├── ProtectionZoneCalc.tsx   # 保护区划分计算
│   │   ├── ProjectAnalysis.tsx      # 建设项目环评分析
│   │   ├── DivisionOverview.tsx     # 行政区划总览
│   │   ├── VersionHistory.tsx       # 版本历史管理
│   │   └── ReportDetail.tsx         # 报告详情（6 个 Tab）
│   │
│   ├── lib/                         # 核心计算引擎
│   │   ├── zoneCalcEngine.ts        # 保护区划分计算（经验值法 + Cooper-Jacob）
│   │   ├── zoneCoordGenerator.ts    # 拐点坐标生成器
│   │   ├── zoneClipEngine.ts        # 行政区划裁剪
│   │   ├── bufferAnalysisEngine.ts  # 缓冲分析
│   │   ├── spatialAnalysis.ts       # 空间分析（Haversine 距离 + 保护区关系判定）
│   │   ├── sensitivityEngine.ts     # 参数敏感性分析
│   │   ├── waterSourceCoder.ts      # 水源地编码规范化
│   │   ├── dataImportEngine.ts      # 数据导入引擎（Excel/CSV 解析）
│   │   ├── dataValidator.ts         # 数据校验引擎
│   │   ├── dataVersionEngine.ts     # 版本管理引擎
│   │   ├── zoneExcelExporter.ts     # Excel 多 Sheet 导出
│   │   ├── zoneGISExporter.ts       # GIS 坐标导出（GeoJSON/KML/Shapefile）
│   │   ├── zoneReportGenerator.ts   # Word 报告生成
│   │   └── idb.ts                   # IndexedDB 轻量封装
│   │
│   ├── stores/                      # Zustand 状态管理
│   │   ├── waterSourceStore.ts      # 水源地数据（IDB 驱动）
│   │   ├── appStore.ts              # 报告数据（localStorage）
│   │   └── divisionStore.ts         # 行政区划（localStorage）
│   │
│   ├── data/                        # 静态数据
│   │   ├── hebeiWaterSources.ts     # 河北省水源地基础数据
│   │   ├── hebeiDivisions.ts        # 河北省行政区划
│   │   ├── hebeiTownships.ts        # 乡镇级行政区划
│   │   ├── waterSourceGeoData.ts    # 水源地地理坐标数据
│   │   └── sampleData.ts            # 示例数据
│   │
│   ├── types/                       # TypeScript 类型定义
│   │   ├── index.ts                 # 核心业务类型
│   │   └── division.ts              # 行政区划类型
│   │
│   ├── __tests__/                   # 测试文件（12 个文件，157 项测试）
│   │   ├── setup.ts                 # 测试全局设置
│   │   └── *.test.ts(x)             # 引擎 + 组件测试
│   │
│   ├── utils/helpers.ts             # 工具函数
│   ├── App.tsx                      # 路由配置
│   ├── main.tsx                     # 入口
│   └── index.css                    # 全局样式 + 暗色模式
│
├── public/                          # 静态资源
│   ├── sw.js                        # PWA Service Worker
│   ├── manifest.json                # PWA Manifest
│   ├── icons/                       # PWA 图标
│   └── data/                        # 行政边界 GeoJSON
│
├── .github/
│   ├── workflows/ci.yml             # GitHub Actions CI 工作流
│   └── pull_request_template.md     # PR 模板
│
├── scripts/
│   ├── ci.sh                        # 本地 CI 验证脚本
│   ├── build-deploy.sh              # 构建部署脚本
│   └── build.bat                    # Windows 构建脚本
│
├── deploy/                          # 部署配置
│   └── nginx.conf.example           # Nginx 配置示例
│
├── eslint.config.js                 # ESLint 9 Flat Config
├── .prettierrc                      # Prettier 配置
├── .lintstagedrc                    # lint-staged 配置
├── .husky/pre-commit                # Git pre-commit Hook
├── vitest.config.ts                 # Vitest 测试配置
├── vite.config.ts                   # Vite 构建配置
├── tailwind.config.ts               # Tailwind CSS 配置
├── tsconfig.json                    # TypeScript 配置
└── package.json
```

---

## 核心模块

### 保护区划分计算引擎（zoneCalcEngine）

依据 **HJ 338-2018《饮用水水源保护区划分技术规范》**，支持两种计算方法：

- **经验值法**：按水源地类型（地下水/河流/湖库）直接设定一级/二级保护区半径
- **解析法（Cooper-Jacob）**：基于含水层参数计算 capture zone
  - 输入：渗透系数 K、储水系数 S、导水系数 T、含水层厚度 M、水力梯度 I、有效孔隙率 n
  - 输出：一级/二级保护区半径、面积、边界描述、拐点坐标

计算结果可导出为 Excel（4 Sheet：参数表 / 面积表 / 拐点坐标表 / 边界描述表）和 Word 技术报告。

### 空间分析模块

- **建设项目环评分析**：输入项目坐标和占地范围，自动判定是否落在水源保护区内，输出涉及清单和最近距离
- **行政区划裁剪**：保护区理论边界与行政区划求交集，计算实际管控面积
- **缓冲分析**：保护区边界与敏感目标距离分析，支持学校/医院/居民区/工业企业等类型

### 数据导入导出

- **导入**：支持 `.xlsx` / `.xls` / `.csv` / `.json`，自动列名映射，表格预览 + 校验高亮
- **导出**：Excel / CSV / JSON 三格式，支持筛选后导出
- **GIS 导出**：GeoJSON / KML / Shapefile，兼容 ArcGIS / QGIS / Google Earth

### 版本管理

基于 IndexedDB 的数据版本管理引擎，支持：
- 手动/自动创建版本快照
- 两版本间差异对比（新增/修改/删除明细）
- 一键回滚到任意历史版本
- 自动变更日志记录

---

## 数据架构

```
┌─────────────────────────────────────────────────┐
│                   React UI 层                     │
│         (9 个页面 + 5 个通用组件)                   │
├─────────────────────────────────────────────────┤
│              Zustand Store 层                     │
│   waterSourceStore │ appStore │ divisionStore    │
├───────────────────┬─────────────────────────────┤
│   IndexedDB       │      localStorage            │
│  (水源地数据 +     │  (报告数据 +                 │
│   版本快照 +       │   自定义行政区划 +            │
│   变更日志)        │   UI偏好)                    │
├───────────────────┴─────────────────────────────┤
│              静态数据层（动态 import）              │
│  hebeiWaterSources │ hebeiTownships │ sampleData │
│  waterSourceGeoData (4 个独立 chunk，按需加载)      │
└─────────────────────────────────────────────────┘
```

- **IndexedDB**：水源地主数据、版本快照、变更日志（大数据量场景）
- **localStorage**：报告数据、自定义行政区划、UI 偏好（小数据量场景）
- **动态 import**：静态数据按需加载，首屏 JS 从 ~1332KB 降至 ~692KB（gzip ~198KB，-48%）

---

## 质量保障

### 代码质量

| 指标 | 状态 |
|------|------|
| TypeScript 编译 | 0 errors |
| ESLint 检查 | 0 errors, 167 warnings |
| Prettier 格式 | All files formatted |
| 单元测试 | 157/157 passed（12 个测试文件） |
| 构建时间 | ~4s |

### CI/CD Pipeline

每次 `git push` 自动触发 GitHub Actions，依次执行：

1. `tsc` — TypeScript 类型检查
2. `eslint` — 代码规范检查
3. `prettier --check` — 格式验证
4. `vitest run` — 全部单元测试
5. `vite build` — 生产构建
6. 构建产物 Artifact 上传

### Git Hooks

- **pre-commit**：husky + lint-staged，提交前自动执行 ESLint + Prettier

### 本地 CI

```bash
npm run ci    # 一键执行完整 CI 验证
```

---

## 部署方式

### 方式一：静态文件部署（推荐）

```bash
npm run build
# 将 dist/ 目录部署到任意静态文件服务器
```

Nginx 配置示例见 `deploy/nginx.conf.example`。

### 方式二：离线运行

构建产物使用 HashRouter，支持 `file://` 协议直接打开：

```bash
npm run build
# 直接在浏览器中打开 dist/index.html
```

### 方式三：PWA 安装

部署后，在 Chrome/Edge 中访问，地址栏右侧出现安装图标，点击即可安装到桌面。

---

## 贡献指南

### 开发环境准备

```bash
# 1. 克隆仓库
git clone git@github.com:WL-jwm/watersource-archive.git
cd watersource-archive

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

### 开发工作流

#### 1. 创建分支

```bash
# 从 master 创建功能分支
 git checkout -b feat/your-feature-name
```

分支命名规范：

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat/` | 新功能 | `feat/zone-compare` |
| `fix/` | Bug 修复 | `fix/map-marker-offset` |
| `docs/` | 文档更新 | `docs/api-guide` |
| `refactor/` | 代码重构 | `refactor/store-cleanup` |
| `test/` | 测试补充 | `test/buffer-engine` |

#### 2. 编写代码

遵循项目既有规范：

- **TypeScript**：所有代码必须通过 `tsc` 编译，禁止 `any`（类型定义文件除外）
- **ESLint**：提交前自动检查，不允许新增 error
- **Prettier**：提交前自动格式化，统一缩进 2 空格、单引号、无分号
- **组件**：函数式组件 + Hooks，避免 class 组件（ErrorBoundary 除外）
- **状态管理**：新增状态使用 Zustand store，数据持久化按场景选择 IndexedDB 或 localStorage
- **样式**：使用 Tailwind CSS 类名，暗色模式通过 CSS 变量切换
- **动态加载**：大型静态数据使用动态 `import()` 按需加载，避免膨胀首屏体积

#### 3. 编写测试

新增功能需配套测试，测试文件放在 `src/__tests__/` 目录：

```bash
# 运行全部测试
npm run test

# 运行单个测试文件
npx vitest run src/__tests__/your-test.test.ts

# 监听模式（开发时实时反馈）
npx vitest
```

测试规范：

- 引擎库：纯函数测试，覆盖正常输入 + 边界情况 + 异常输入
- 组件：使用 `@testing-library/react`，测试渲染 + 交互 + 回调
- Mock：`setup.ts` 已配置 `matchMedia` / `localStorage` / 浏览器 API mock
- 命名：`describe('模块名')` → `it('should 行为描述')`

#### 4. 提交代码

```bash
git add -A
git commit -m "feat: 简明描述本次变更"
```

提交信息规范（Conventional Commits）：

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat:` | 新功能 | `feat: 新增保护区对比功能` |
| `fix:` | Bug 修复 | `fix: 修复地图标记偏移问题` |
| `docs:` | 文档变更 | `docs: 更新 README 部署说明` |
| `refactor:` | 重构 | `refactor: 抽离公共计算逻辑` |
| `test:` | 测试 | `test: 补充缓冲分析边界测试` |
| `chore:` | 构建/工具 | `chore: 升级 Vite 到 5.4` |

> pre-commit hook 会自动执行 ESLint + Prettier，如果检查不通过提交会被拦截。

#### 5. 提交 Pull Request

推送分支后，在 GitHub 上创建 Pull Request，PR 模板包含以下检查清单：

- [ ] TypeScript 编译通过（`npx tsc --noEmit`）
- [ ] ESLint 检查通过（`npm run lint`）
- [ ] Prettier 格式通过（`npm run format:check`）
- [ ] 全部测试通过（`npm run test`）
- [ ] 生产构建成功（`npm run build`）

也可使用一键验证：

```bash
npm run ci    # 本地完整 CI 验证
```

#### 6. 代码审查与合并

- PR 需通过 CI 全部检查（GitHub Actions 自动运行）
- 审查通过后合并到 `master` 分支
- 合并后删除功能分支

### 项目约定

#### 目录约定

| 新增内容 | 放置位置 |
|---------|---------|
| 页面 | `src/pages/` |
| 通用组件 | `src/components/` |
| 计算引擎/工具库 | `src/lib/` |
| Zustand Store | `src/stores/` |
| 类型定义 | `src/types/` |
| 静态数据 | `src/data/` |
| 测试文件 | `src/__tests__/` |

#### 命名约定

- **文件**：组件用 PascalCase（`SourceFormModal.tsx`），引擎/工具用 camelCase（`zoneCalcEngine.ts`）
- **组件**：PascalCase（`WaterSourceManager`）
- **函数**：camelCase（`calculateZoneRadius`）
- **类型/接口**：PascalCase（`ZoneResult`、`WaterSourceRecord`）
- **常量**：UPPER_SNAKE_CASE（`STORAGE_KEY`）

#### 路由约定

使用 HashRouter，新增页面在 `src/App.tsx` 中注册路由。路由路径使用 kebab-case：

```tsx
<Route path="/your-page" element={<YourPage />} />
```

---

## 许可证

本项目为内部业务工具，未开源授权。未经许可不得复制、传播或用于商业用途。
