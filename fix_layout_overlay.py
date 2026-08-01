"""Add overlay nav item to Layout.tsx sidebar"""

path = 'src/components/layout/Layout.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = "            {!sidebarCollapsed && t('nav.analysis')}\n          </a>\n          <a\n            href=\"#/audit\""

new = (
    "            {!sidebarCollapsed && t('nav.analysis')}\n"
    "          </a>\n"
    "          <a\n"
    "            href=\"#/overlay\"\n"
    "              onMouseEnter={() => preloadPage('/overlay')}\n"
    "            className=\"w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary rounded-md transition-colors\"\n"
    "            title={t('nav.overlayFull')}\n"
    "          >\n"
    "            <svg className=\"w-4 h-4 shrink-0\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">\n"
    "              <path\n"
    "                strokeLinecap=\"round\"\n"
    "                strokeLinejoin=\"round\"\n"
    "                strokeWidth={2}\n"
    "                d=\"M3 7h18M3 12h18M3 17h18\"\n"
    "              />\n"
    "              <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M7 3v18M17 3v18\" />\n"
    "            </svg>\n"
    "            {!sidebarCollapsed && t('nav.overlay')}\n"
    "          </a>\n"
    "          <a\n"
    "            href=\"#/audit\""
)

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK: overlay nav added to sidebar")
else:
    print("ERROR: pattern not found")
