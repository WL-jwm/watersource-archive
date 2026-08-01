#!/usr/bin/env python3
"""Integrate backup components into Layout.tsx"""
import sys

LAYOUT_PATH = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src\components\layout\Layout.tsx"

with open(LAYOUT_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    # 1. Add imports at the end
    (
        "import { preloadPage } from '@/lib/preload';\n\nexport default Layout;",
        "import { preloadPage } from '@/lib/preload';\nimport BackupBanner from '@/components/BackupBanner';\nimport BackupSettingsModal from '@/components/BackupSettingsModal';\nimport { tryAutoBackup } from '@/lib/backupManager';\n\nexport default Layout;",
        "Added imports"
    ),
    # 2. Add backupModalOpen state
    (
        "      return false;\n    }\n  });\n",
        "      return false;\n    }\n  });\n  const [backupModalOpen, setBackupModalOpen] = React.useState(false);\n",
        "Added backupModalOpen state"
    ),
    # 3. Add auto-backup effect
    (
        "  // 全局IDB初始化（应用启动时仅执行一次）\n  useEffect(() => {\n    initDB();\n  }, []);",
        "  // 全局IDB初始化（应用启动时仅执行一次）\n  useEffect(() => {\n    initDB();\n  }, []);\n\n  // N4: 自动备份检测（启动后延迟5秒检查）\n  useEffect(() => {\n    const timer = setTimeout(() => {\n      tryAutoBackup().catch(() => {});\n    }, 5000);\n    return () => clearTimeout(timer);\n  }, []);",
        "Added auto-backup effect"
    ),
    # 4. Add BackupBanner before PWA banner
    (
        "      {/* P4-9: PWA安装提示横幅 */}",
        "      {/* N4: 备份提醒横幅 */}\n      <BackupBanner />\n\n      {/* P4-9: PWA安装提示横幅 */}",
        "Added BackupBanner"
    ),
    # 5. Add backup button after audit log link
    (
        "            {!sidebarCollapsed && '审计日志'}\n          </a>",
        "            {!sidebarCollapsed && '审计日志'}\n          </a>\n          {/* N4: 数据备份入口 */}\n          <button\n            onClick={() => setBackupModalOpen(true)}\n            className=\"w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary rounded-md transition-colors\"\n            title=\"数据备份与恢复\"\n          >\n            <svg className=\"w-4 h-4 shrink-0\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">\n              <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4\" />\n            </svg>\n            {!sidebarCollapsed && '数据备份'}\n          </button>",
        "Added backup button in sidebar"
    ),
    # 6. Add BackupSettingsModal before closing div
    (
        "      {/* G2: 移动端底部导航栏 */}\n      <MobileBottomNav />\n    </div>",
        "      {/* G2: 移动端底部导航栏 */}\n      <MobileBottomNav />\n      {/* N4: 备份设置弹窗 */}\n      <BackupSettingsModal open={backupModalOpen} onClose={() => setBackupModalOpen(false)} />\n    </div>",
        "Added BackupSettingsModal"
    ),
]

for old, new, label in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f"[OK] {label}")
    else:
        print(f"[FAIL] {label}")
        sys.exit(1)

with open(LAYOUT_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n[DONE] Layout.tsx backup integration complete")
