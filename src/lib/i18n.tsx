/**
 * G3: 国际化框架 (i18n)
 *
 * 轻量级 i18n 实现，不引入 i18next 等重量级库
 * 支持中/英双语，按需扩展
 *
 * 使用方式：
 *   const { t, locale } = useI18n();
 *   t('app.title') // → "河北省水源地保护区档案管理平台"
 */

import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react';

// ===== 类型定义 =====
export type Locale = 'zh' | 'en';

type TranslationDict = Record<string, string>;

// ===== 翻译字典 =====
export const translations: Record<Locale, TranslationDict> = {
  zh: {
    // 应用
    'app.title': '河北省水源地保护区档案管理平台',
    'app.shortName': '水源地档案',
    // 导航
    'nav.home': '首页',
    'nav.map': '地图展示',
    'nav.dashboard': '统计仪表盘',
    'nav.manage': '水源地管理',
    'nav.zoneCalc': '保护区计算',
    'nav.analysis': '项目分析',
    'nav.versions': '版本历史',
    'nav.reportDetail': '报告详情',
    'nav.divisions': '行政区划',
    // 操作
    'action.add': '新增',
    'action.edit': '编辑',
    'action.delete': '删除',
    'action.save': '保存',
    'action.cancel': '取消',
    'action.export': '导出',
    'action.import': '导入',
    'action.search': '搜索',
    'action.filter': '筛选',
    'action.reset': '重置',
    'action.confirm': '确认',
    'action.batchReport': '批量报告',
    'action.dataExchange': '数据交换',
    // 水源地属性
    'field.name': '水源地名称',
    'field.city': '城市',
    'field.level': '级别',
    'field.type': '水源类型',
    'field.subType': '细分类型',
    'field.county': '县区',
    'field.status': '状态',
    'field.population': '服务人口',
    'field.river': '河流',
    'field.lng': '经度',
    'field.lat': '纬度',
    // 级别
    'level.municipal': '市级',
    'level.county': '县级',
    'level.township': '乡镇级',
    // 水源类型
    'type.surface': '地表水',
    'type.groundwater': '地下水',
    // 保护区
    'zone.primary': '一级保护区',
    'zone.secondary': '二级保护区',
    'zone.quasi': '准保护区',
    'zone.area': '面积',
    'zone.radius': '半径',
    'zone.method': '计算方法',
    // 统计
    'stat.total': '总计',
    'stat.pass': '通过',
    'stat.warning': '警告',
    'stat.error': '错误',
    // 状态
    'status.loading': '加载中...',
    'status.noData': '暂无数据',
    'status.success': '操作成功',
    'status.failed': '操作失败',
    // 环评结论
    'ea.conform': '符合',
    'ea.basicConform': '基本符合',
    'ea.needAdjust': '需调整',
    'ea.notConform': '不符合',
    'ea.confidence': '置信度',
    // N8: Layout 侧边栏
    'layout.sidebarTitle': '水源地档案管理',
    'layout.sidebarSubtitle': '保护区划分技术报告',
    'layout.statReports': '报告',
    'layout.statSources': '水源地',
    'layout.statWells': '水井',
    'layout.reportList': '报告列表',
    'layout.noReports': '暂无报告数据',
    'layout.noReportsHint': '点击"导入数据"添加',
    'layout.collapseSidebar': '收起侧栏',
    'layout.allReports': '全部报告',
    // N8: Layout 功能导航
    'nav.gis': 'GIS地图',
    'nav.dashboardFull': '统计仪表盘',
    'nav.zoneCalcFull': '保护区划分',
    'nav.audit': '审计日志',
    'nav.backup': '数据备份',
    'nav.divisionsFull': '行政区划',
    'nav.manageShort': '管理',
    'nav.zoneShort': '保护区',
    'nav.versionsShort': '版本',
    // N8: 操作按钮
    'action.print': '打印',
    'action.install': '安装',
    'action.close': '关闭',
    'action.importData': '导入数据',
    // N8: PWA安装提示
    'pwa.installHint': '安装水源地档案应用到桌面，离线使用',
    // N8: 页面加载
    'page.loading': '页面加载中...',
    // N8: Home 页面
    'home.title': '河北省饮用水水源地保护区档案管理平台',
    'home.subtitle': '集中式饮用水水源地保护区划分技术报告管理系统',
    'home.totalReports': '报告总数',
    'home.totalSources': '水源地总数',
    'home.totalCities': '覆盖城市',
    'home.totalZones': '保护区计算',
    'home.quickActions': '快捷操作',
    'home.recentReports': '最近报告',
    'home.cityDistribution': '城市分布',
    'home.noReports': '暂无报告',
    'home.importData': '导入数据',
    'home.newReport': '新建报告',
    'home.viewMap': '查看地图',
    'home.zoneCalc': '保护区计算',
  },
  en: {
    // App
    'app.title': 'Hebei Water Source Protection Zone Archive Platform',
    'app.shortName': 'WaterSource',
    // Navigation
    'nav.home': 'Home',
    'nav.map': 'Map',
    'nav.dashboard': 'Dashboard',
    'nav.manage': 'Water Sources',
    'nav.zoneCalc': 'Zone Calculator',
    'nav.analysis': 'Analysis',
    'nav.versions': 'Versions',
    'nav.reportDetail': 'Report',
    'nav.divisions': 'Divisions',
    // Actions
    'action.add': 'Add',
    'action.edit': 'Edit',
    'action.delete': 'Delete',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.reset': 'Reset',
    'action.confirm': 'Confirm',
    'action.batchReport': 'Batch Report',
    'action.dataExchange': 'Data Exchange',
    // Fields
    'field.name': 'Source Name',
    'field.city': 'City',
    'field.level': 'Level',
    'field.type': 'Source Type',
    'field.subType': 'Sub Type',
    'field.county': 'County',
    'field.status': 'Status',
    'field.population': 'Population',
    'field.river': 'River',
    'field.lng': 'Longitude',
    'field.lat': 'Latitude',
    // Levels
    'level.municipal': 'Municipal',
    'level.county': 'County',
    'level.township': 'Township',
    // Types
    'type.surface': 'Surface Water',
    'type.groundwater': 'Groundwater',
    // Zones
    'zone.primary': 'Primary Zone',
    'zone.secondary': 'Secondary Zone',
    'zone.quasi': 'Quasi-Protection Zone',
    'zone.area': 'Area',
    'zone.radius': 'Radius',
    'zone.method': 'Method',
    // Stats
    'stat.total': 'Total',
    'stat.pass': 'Pass',
    'stat.warning': 'Warning',
    'stat.error': 'Error',
    // Status
    'status.loading': 'Loading...',
    'status.noData': 'No Data',
    'status.success': 'Success',
    'status.failed': 'Failed',
    // EA Conclusion
    'ea.conform': 'Conform',
    'ea.basicConform': 'Basically Conform',
    'ea.needAdjust': 'Need Adjustment',
    'ea.notConform': 'Not Conform',
    'ea.confidence': 'Confidence',
    // N8: Layout sidebar
    'layout.sidebarTitle': 'Water Source Archive',
    'layout.sidebarSubtitle': 'Protection Zone Technical Reports',
    'layout.statReports': 'Reports',
    'layout.statSources': 'Sources',
    'layout.statWells': 'Wells',
    'layout.reportList': 'Report List',
    'layout.noReports': 'No report data',
    'layout.noReportsHint': 'Click "Import Data" to add',
    'layout.collapseSidebar': 'Collapse',
    'layout.allReports': 'All Reports',
    // N8: Layout navigation
    'nav.gis': 'GIS Map',
    'nav.dashboardFull': 'Dashboard',
    'nav.zoneCalcFull': 'Zone Calculator',
    'nav.audit': 'Audit Log',
    'nav.backup': 'Backup',
    'nav.divisionsFull': 'Divisions',
    'nav.manageShort': 'Manage',
    'nav.zoneShort': 'Zones',
    'nav.versionsShort': 'Versions',
    // N8: Actions
    'action.print': 'Print',
    'action.install': 'Install',
    'action.close': 'Close',
    'action.importData': 'Import Data',
    // N8: PWA install
    'pwa.installHint': 'Install Water Source Archive app for offline use',
    // N8: Page loading
    'page.loading': 'Loading...',
    // N8: Home page
    'home.title': 'Hebei Drinking Water Source Protection Zone Archive Platform',
    'home.subtitle': 'Centralized Drinking Water Source Protection Zone Delineation Report Management System',
    'home.totalReports': 'Total Reports',
    'home.totalSources': 'Total Sources',
    'home.totalCities': 'Cities Covered',
    'home.totalZones': 'Zone Calculations',
    'home.quickActions': 'Quick Actions',
    'home.recentReports': 'Recent Reports',
    'home.cityDistribution': 'City Distribution',
    'home.noReports': 'No reports yet',
    'home.importData': 'Import Data',
    'home.newReport': 'New Report',
    'home.viewMap': 'View Map',
    'home.zoneCalc': 'Zone Calculator',
  },
};

// ===== Context =====
interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'ws-archive-locale';

// ===== Provider =====
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === 'zh' || saved === 'en') return saved;
    }
    return 'zh'; // 默认中文
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = translations[locale];
      let text = dict[key] || translations.zh[key] || key;

      // 参数替换
      if (params) {
        for (const [param, value] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
        }
      }

      return text;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

// ===== Hook =====
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // 如果在 Provider 外使用，返回默认中文
    return {
      locale: 'zh',
      t: (key: string) => translations.zh[key] || key,
      setLocale: () => {},
    };
  }
  return ctx;
}

// ===== 语言切换组件 =====
export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        onClick={() => setLocale('zh')}
        className={`px-2 py-0.5 rounded ${locale === 'zh' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
      >
        中文
      </button>
      <button
        onClick={() => setLocale('en')}
        className={`px-2 py-0.5 rounded ${locale === 'en' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
      >
        EN
      </button>
    </div>
  );
}
