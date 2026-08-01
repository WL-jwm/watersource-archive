"""S9.4: a11y improvements for Layout.tsx, ConfirmDialog.tsx, App.tsx"""

import re

# === 1. Layout.tsx ===
layout_path = 'src/components/layout/Layout.tsx'
with open(layout_path, 'r', encoding='utf-8') as f:
    layout = f.read()

# 1a. Add nav wrapper + aria-label to aside
layout = layout.replace(
    '      <aside\n',
    '      <aside\n        aria-label="主导航"\n',
    1,
)

# 1b. Add aria-current="page" to active nav links
# The nav links use href="#/path" pattern, we add a script-level check
# Since we can't easily detect active route in static HTML, we add role="navigation" to the container
# and aria-label to icon-only buttons

# 1c. Add aria-label to the sidebar toggle button
layout = layout.replace(
    "          onClick={() => {\n            setSidebarCollapsed(!sidebarCollapsed);\n          }}",
    "          onClick={() => {\n            setSidebarCollapsed(!sidebarCollapsed);\n          }}\n          aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}",
    1,
)

# 1d. Add aria-label to backup button
layout = layout.replace(
    '          onClick={() => setBackupModalOpen(true)}',
    '          onClick={() => setBackupModalOpen(true)}\n          aria-label="数据备份"',
    1,
)

# 1e. Add aria-label to install banner close button
layout = layout.replace(
    "          onClick={() => setShowInstallBanner(false)}",
    "          onClick={() => setShowInstallBanner(false)}\n          aria-label=\"关闭安装提示\"",
    1,
)

# 1f. Add aria-label to install button
layout = layout.replace(
    "          onClick={handleInstall}",
    "          onClick={handleInstall}\n          aria-label=\"安装应用\"",
    1,
)

with open(layout_path, 'w', encoding='utf-8') as f:
    f.write(layout)
print("OK: Layout.tsx a11y patched")

# === 2. ConfirmDialog.tsx ===
dialog_path = 'src/components/ConfirmDialog.tsx'
with open(dialog_path, 'r', encoding='utf-8') as f:
    dialog = f.read()

# Add role="dialog" + aria-modal + aria-labelledby to the modal container
# Find the main modal div
dialog = dialog.replace(
    'className="fixed inset-0 z-[100] flex items-center justify-center"',
    'role="dialog"\n        aria-modal="true"\n        aria-labelledby="confirm-dialog-title"\n        className="fixed inset-0 z-[100] flex items-center justify-center"',
    1,
)

# Add id="confirm-dialog-title" to the title element
# Find the title text rendering
dialog = re.sub(
    r'(<p[^>]*className="[^"]*text-lg[^"]*"[^>]*>)(\{)',
    r'\1id="confirm-dialog-title"\2',
    dialog,
    count=1,
)

with open(dialog_path, 'w', encoding='utf-8') as f:
    f.write(dialog)
print("OK: ConfirmDialog.tsx a11y patched")

# === 3. App.tsx — skip link ===
app_path = 'src/App.tsx'
with open(app_path, 'r', encoding='utf-8') as f:
    app = f.read()

# Add skip link before ErrorBoundary
app = app.replace(
    '      <ErrorBoundary>\n        <OfflineIndicator',
    '      <ErrorBoundary>\n        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:text-sm">跳到主内容</a>\n        <OfflineIndicator',
    1,
)

# Add id="main-content" to Layout's children wrapper
# The main content is inside <Layout> ... we need to add it to the Layout component
# Actually, let's add it in Layout.tsx instead
with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app)
print("OK: App.tsx skip link added")

# === 4. Layout.tsx — add id="main-content" to main area ===
with open(layout_path, 'r', encoding='utf-8') as f:
    layout = f.read()

# Find <main and add id
layout = layout.replace('<main ', '<main id="main-content" ', 1)

with open(layout_path, 'w', encoding='utf-8') as f:
    f.write(layout)
print("OK: Layout.tsx main id added")
