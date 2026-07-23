import React, { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import { getReportStats } from '@/utils/helpers';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    reports,
    selectedReportId,
    selectedSourceId,
    activeTab,
    sidebarCollapsed,
    toggleSidebar,
    setSelectedReportId,
    setSelectedSourceId,
    setActiveTab,
    searchQuery,
    setSearchQuery,
  } = useAppStore();
  const { initDB, loaded, sources } = useWaterSourceStore();
  const stats = getReportStats(reports);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = React.useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => {
    try {
      const saved = localStorage.getItem('ws-dark-mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // 全局IDB初始化（应用启动时仅执行一次）
  useEffect(() => {
    initDB();
  }, []);

  // P4-9: 网络状态监听 + PWA安装提示
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA安装提示事件
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowInstallBanner(false);
  };

  // P4-10: 暗色模式切换
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('ws-dark-mode', String(darkMode));
    } catch {
      /* localStorage may be unavailable */
    }
  }, [darkMode]);

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'basic', label: '基本信息' },
    { id: 'wells', label: '水井信息' },
    { id: 'hydrogeology', label: '水文地质' },
    { id: 'waterquality', label: '水质监测' },
    { id: 'protection', label: '保护区划分' },
    { id: 'pollution', label: '污染源' },
  ];

  const selectedReport = reports.find((r) => r.id === selectedReportId);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      {/* P4-9: PWA安装提示横幅 */}
      {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-indigo-600 text-white px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>安装水源地档案应用到桌面，离线使用</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              className="px-3 py-1 bg-white text-indigo-600 rounded font-medium text-xs hover:bg-indigo-50"
            >
              安装
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="text-white/70 hover:text-white text-xs"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col bg-surface border-r border-surface-border shadow-sidebar transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-[280px]'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-surface-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            WS
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-text-primary truncate">水源地档案管理</h1>
              <p className="text-xs text-text-tertiary truncate">保护区划分技术报告</p>
            </div>
          )}
        </div>

        {/* Stats */}
        {!sidebarCollapsed && (
          <div className="px-3 py-3 border-b border-surface-border shrink-0">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-accent-500">{stats.reportCount}</div>
                <div className="text-[10px] text-text-tertiary">报告</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-accent-500">{stats.sourceCount}</div>
                <div className="text-[10px] text-text-tertiary">水源地</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-accent-500">{stats.wellCount}</div>
                <div className="text-[10px] text-text-tertiary">水井</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation: Reports + Divisions */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Report list section */}
          {!sidebarCollapsed && (
            <div className="px-4 py-1.5">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                报告列表
              </span>
            </div>
          )}
          {!sidebarCollapsed && reports.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              暂无报告数据
              <br />
              点击"导入数据"添加
            </div>
          )}
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => {
                setSelectedReportId(report.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 transition-colors duration-150 hover:bg-surface-tertiary ${
                selectedReportId === report.id ? 'bg-accent-50 border-r-2 border-accent-500' : ''
              }`}
              title={report.reportName}
            >
              <div
                className={`text-sm font-medium text-text-primary truncate ${sidebarCollapsed ? 'hidden' : ''}`}
              >
                {report.reportName.replace(/（[^）]*）/, '')}
              </div>
              {!sidebarCollapsed && (
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">{report.region}</span>
                  <span className="badge-info text-[10px]">
                    {report.waterSources.length}个水源地
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="px-3 py-2 border-t border-surface-border shrink-0 space-y-1">
          {/* 功能导航 */}
          <a
            href="#/map"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary rounded-md transition-colors"
            title="GIS地图"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {!sidebarCollapsed && 'GIS地图'}
          </a>
          <a
            href="#/dashboard"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary rounded-md transition-colors"
            title="统计仪表盘"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {!sidebarCollapsed && '统计仪表盘'}
          </a>
          <a
            href="#/zone-calc"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary rounded-md transition-colors"
            title="保护区划分计算"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            {!sidebarCollapsed && '保护区划分'}
          </a>
          <a
            href="#/analysis"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary rounded-md transition-colors"
            title="项目空间分析"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
            </svg>
            {!sidebarCollapsed && '项目分析'}
          </a>
          <a
            href="#/divisions"
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary rounded-md transition-colors"
            title="行政区划总览"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {!sidebarCollapsed && '行政区划'}
          </a>
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary rounded-md transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
            {!sidebarCollapsed && '收起侧栏'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-surface border-b border-surface-border flex items-center px-4 gap-4 shrink-0">
          {/* Mobile menu button */}
          <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm min-w-0">
            <a
              href="#/"
              className="text-text-secondary truncate hover:text-text-primary transition-colors"
            >
              全部报告
            </a>
            {selectedReport && (
              <>
                <svg
                  className="w-4 h-4 text-text-tertiary shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span className="text-text-primary truncate font-medium">
                  {selectedReport.reportName.replace(/（[^）]*）/, '')}
                </span>
              </>
            )}
          </nav>

          {/* Search - 移动端隐藏搜索框 */}
          <div className="ml-auto flex items-center gap-2">
            <a
              href="#/map"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-accent-500 hover:bg-accent-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>GIS</span>
            </a>
            <a
              href="#/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-accent-500 hover:bg-accent-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <span>统计</span>
            </a>
            <a
              href="#/divisions"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-accent-500 hover:bg-accent-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>行政区划</span>
            </a>
            <a
              href="#/manage"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-accent-500 hover:bg-accent-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
              <span>管理</span>
            </a>
            <a
              href="#/zone-calc"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-accent-500 hover:bg-accent-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>保护区</span>
            </a>
            <a
              href="#/analysis"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-accent-500 hover:bg-accent-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3"
                />
              </svg>
              <span>项目分析</span>
            </a>
            <a
              href="#/versions"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-accent-500 hover:bg-accent-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>版本</span>
            </a>
            {/* P4-4: 打印按钮 */}
            <button
              onClick={() => window.print()}
              className="no-print hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="打印当前页面"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              <span>打印</span>
            </button>
            {/* P4-9: 离线状态指示器 */}
            <div
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-full ${
                isOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}
              title={isOnline ? '在线' : '离线模式'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
              />
              {isOnline ? '在线' : '离线'}
            </div>
            {/* P4-10: 暗色模式切换 */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:bg-surface-tertiary transition-colors"
              title={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
            >
              {darkMode ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>
            <div className="relative hidden sm:block">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchOpen(false);
                }}
                placeholder="搜索水源地名称/城市..."
                className="input pl-9 w-48 lg:w-64"
              />
              {searchOpen && searchQuery.trim().length > 0 && loaded && (
                <div className="absolute right-0 top-full mt-1 w-80 max-h-80 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  {(() => {
                    const q = searchQuery.trim().toLowerCase();
                    const matched = sources
                      .filter(
                        (s) =>
                          s.name.toLowerCase().includes(q) ||
                          s.cityName.toLowerCase().includes(q) ||
                          (s.county && s.county.toLowerCase().includes(q)),
                      )
                      .slice(0, 15);
                    return matched.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center">
                        未找到匹配的水源地
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100">
                          找到 {matched.length} 个水源地
                        </div>
                        {matched.map((s) => (
                          <a
                            key={s.id}
                            href={`#/zone-calc?source=${encodeURIComponent(s.name)}`}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{
                                background:
                                  s.level === 'municipal'
                                    ? '#2F5496'
                                    : s.level === 'county'
                                      ? '#548235'
                                      : '#BF8F00',
                              }}
                            >
                              {s.level === 'municipal' ? '市' : s.level === 'county' ? '县' : '乡'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{s.name}</div>
                              <div className="text-[10px] text-gray-400 truncate">
                                {s.cityName} · {s.county || '-'} · {s.type}
                              </div>
                            </div>
                            <div
                              className="flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100">
                                计算
                              </span>
                              <a
                                href={`#/analysis?lng=${s.lng}&lat=${s.lat}&name=${encodeURIComponent(s.name)}`}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-600 cursor-pointer hover:bg-green-100"
                              >
                                分析
                              </a>
                            </div>
                          </a>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
          {/* D2: 撤销/重做工具栏 */}
          <UndoRedoToolbar />
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto pb-14 md:pb-0">{children}</main>
      </div>

      {/* 全局行政区划选择器浮动按钮 */}
      <DivisionSelector />
      {/* G2: 移动端底部导航栏 */}
      <MobileBottomNav />
    </div>
  );
};

// 内联DivisionSelector避免循环导入
import DivisionSelector from '@/components/DivisionSelector';
import UndoRedoToolbar from '@/components/UndoRedoToolbar';
import { MobileBottomNav } from '@/lib/mobileEnhanced';

export default Layout;
