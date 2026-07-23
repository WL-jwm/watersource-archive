# 水源地保护区档案管理平台 (WaterSource Archive)

水源地保护区划分技术报告的数字化档案管理平台，支持建档、查阅、调用水源地类型、范围、拐点坐标、水文地质条件、成井条件与结构等信息。

## 快速开始

### 环境要求
- Node.js >= 16
- npm >= 8

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 目录结构

```
watersource-archive/
├── src/
│   ├── components/
│   │   └── layout/
│   │       └── Layout.tsx          # 主布局（侧边栏+头部+内容区）
│   ├── pages/
│   │   ├── Home.tsx                # 首页（报告列表、统计概览）
│   │   └── ReportDetail.tsx        # 报告详情+水源地详情（6个Tab）
│   ├── stores/
│   │   └── appStore.ts             # Zustand全局状态管理
│   ├── data/
│   │   └── sampleData.ts           # 示例数据（万全区水源地）
│   ├── types/
│   │   └── index.ts                # TypeScript类型定义
│   ├── utils/
│   │   └── helpers.ts              # 工具函数
│   ├── App.tsx                     # 路由配置
│   ├── main.tsx                    # 入口
│   └── index.css                   # 全局样式+组件样式
├── dist/                           # 构建产物（HashRouter，可直接file://打开）
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

## 技术栈

- **React 18** - UI框架
- **Vite 5** - 构建工具
- **Tailwind CSS 3** - 样式方案
- **React Router v6** - 客户端路由（HashRouter模式）
- **Zustand** - 状态管理
- **TypeScript** - 类型安全
- **localStorage** - 数据持久化

## 功能特性

- **报告管理**：导入/导出JSON格式数据，支持搜索、删除
- **水源地档案**：基本信息、水井信息、水文地质条件、水质监测、保护区划分、污染源调查六大模块
- **水质监测**：45项指标标准指数评价，支持排序/筛选，达标率统计
- **保护区划分**：一级/二级保护区面积、边界描述、拐点坐标表、Canvas坐标可视化
- **成井信息**：井号、坐标、井深、井径、管材、滤水段、涌水量等完整参数
- **响应式设计**：桌面/平板/手机自适应
- **离线运行**：dist目录可直接file://打开，无需服务器

## 数据模型

基于《饮用水水源保护区划分技术报告》标准结构，覆盖：
- 报告元数据（名称/版本/批复/委托单位/编制单位）
- 水源地基本信息（代码/类型/供水量/服务人口）
- 水井信息（编号/坐标/井深/成井结构/涌水量）
- 水文地质条件（含水层/渗透系数/导水系数/补径排条件）
- 水质监测（GB/T 14848-2017标准指数评价）
- 保护区划分（HJ 338-2018，面积/拐点坐标/边界描述）
- 污染源调查（类别/描述/影响评估/风险等级/防治措施）
