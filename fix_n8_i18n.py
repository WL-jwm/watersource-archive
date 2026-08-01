#!/usr/bin/env python3
"""Wire up Layout.tsx to use i18n t() function for all visible strings"""

PATH = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src\components\layout\Layout.tsx"

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add useI18n import
old_import = "import { preloadPage } from '@/lib/preload';"
new_import = "import { preloadPage } from '@/lib/preload';\nimport { useI18n } from '@/lib/i18n';"
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("[OK] Added useI18n import")
else:
    print("[FAIL] preloadPage import not found")
    exit(1)

# 2. Add t() hook after darkMode state
old_state = "  const [backupModalOpen, setBackupModalOpen] = React.useState(false);"
new_state = "  const [backupModalOpen, setBackupModalOpen] = React.useState(false);\n  const { t } = useI18n();"
if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("[OK] Added useI18n hook")
else:
    print("[FAIL] backupModalOpen state not found")
    exit(1)

# 3. Replace sidebar header
replacements = [
    # Sidebar header
    ('<h1 className="text-sm font-semibold text-text-primary truncate">水源地档案管理</h1>',
     '<h1 className="text-sm font-semibold text-text-primary truncate">{t(\'layout.sidebarTitle\')}</h1>'),
    ('<p className="text-xs text-text-tertiary truncate">保护区划分技术报告</p>',
     '<p className="text-xs text-text-tertiary truncate">{t(\'layout.sidebarSubtitle\')}</p>'),
    # Stats labels
    ('<div className="text-[10px] text-text-tertiary">报告</div>',
     '<div className="text-[10px] text-text-tertiary">{t(\'layout.statReports\')}</div>'),
    ('<div className="text-[10px] text-text-tertiary">水源地</div>',
     '<div className="text-[10px] text-text-tertiary">{t(\'layout.statSources\')}</div>'),
    ('<div className="text-[10px] text-text-tertiary">水井</div>',
     '<div className="text-[10px] text-text-tertiary">{t(\'layout.statWells\')}</div>'),
    # Report list section title
    ('报告列表',
     "{t('layout.reportList')}"),
    # No reports
    ('暂无报告数据',
     "{t('layout.noReports')}"),
    ('点击"导入数据"添加',
     "{t('layout.noReportsHint')}"),
    # Collapse sidebar
    ("{!sidebarCollapsed && '收起侧栏'}",
     "{!sidebarCollapsed && t('layout.collapseSidebar')}"),
    # Breadcrumb
    ('全部报告',
     "{t('layout.allReports')}"),
    # Sidebar nav titles and labels
    ('title="GIS地图"', 'title={t(\'nav.gis\')}'),
    ("{!sidebarCollapsed && 'GIS地图'}",
     "{!sidebarCollapsed && t('nav.gis')}"),
    ('title="统计仪表盘"', 'title={t(\'nav.dashboardFull\')}'),
    ("{!sidebarCollapsed && '统计仪表盘'}",
     "{!sidebarCollapsed && t('nav.dashboardFull')}"),
    ('title="保护区划分计算"', 'title={t(\'nav.zoneCalcFull\')}'),
    ("{!sidebarCollapsed && '保护区划分'}",
     "{!sidebarCollapsed && t('nav.zoneCalcFull')}"),
    ('title="项目空间分析"', 'title={t(\'nav.analysis\')}'),
    ("{!sidebarCollapsed && '项目分析'}",
     "{!sidebarCollapsed && t('nav.analysis')}"),
    ('title="审计日志"', 'title={t(\'nav.audit\')}'),
    ("{!sidebarCollapsed && '审计日志'}",
     "{!sidebarCollapsed && t('nav.audit')}"),
    ('title="数据备份与恢复"', 'title={t(\'nav.backup\')}'),
    ("{!sidebarCollapsed && '数据备份'}",
     "{!sidebarCollapsed && t('nav.backup')}"),
    ('title="行政区划总览"', 'title={t(\'nav.divisionsFull\')}'),
    ("{!sidebarCollapsed && '行政区划'}",
     "{!sidebarCollapsed && t('nav.divisionsFull')}"),
    # Header nav links
    ('<span>行政区划</span>', '<span>{t(\'nav.divisionsFull\')}</span>'),
    ('<span>管理</span>', '<span>{t(\'nav.manageShort\')}</span>'),
    ('<span>保护区</span>', '<span>{t(\'nav.zoneShort\')}</span>'),
    ('<span>项目分析</span>', '<span>{t(\'nav.analysis\')}</span>'),
    ('<span>版本</span>', '<span>{t(\'nav.versionsShort\')}</span>'),
    # PWA install banner
    ('安装水源地档案应用到桌面，离线使用',
     "{t('pwa.installHint')}"),
    # Install/Close buttons
    ('>\n              安装\n            </button>', '>\n              {t(\'action.install\')}\n            </button>'),
    ('>\n              关闭\n            </button>', '>\n              {t(\'action.close\')}\n            </button>'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"[OK] Replaced: {old[:40]}...")
    else:
        print(f"[SKIP] Not found: {old[:40]}...")

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n[DONE] Layout.tsx i18n integration complete")
