#!/usr/bin/env python3
"""Add crypto modal button and component to WaterSourceManager"""

PATH = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src\pages\WaterSourceManager.tsx"

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add crypto button after code validation button
old_btn = """            编码校验
          </button>"""
new_btn = """            编码校验
          </button>

          <button
            onClick={() => setShowCryptoModal(true)}
            className="text-xs px-3 py-1.5 rounded border border-teal-200 text-teal-600 hover:bg-teal-50"
          >
            加密导出
          </button>"""
if old_btn in content:
    content = content.replace(old_btn, new_btn, 1)
    print("[OK] Added crypto button")
else:
    print("[FAIL] code validation button not found")
    exit(1)

# 2. Add CryptoExportModal after CodeValidationPanel
old_panel = """      <CodeValidationPanel
        open={showCodeValidation}
        sources={sources}
        onClose={() => setShowCodeValidation(false)}
      />"""
new_panel = """      <CodeValidationPanel
        open={showCodeValidation}
        sources={sources}
        onClose={() => setShowCodeValidation(false)}
      />
      <CryptoExportModal
        open={showCryptoModal}
        onClose={() => setShowCryptoModal(false)}
      />"""
if old_panel in content:
    content = content.replace(old_panel, new_panel, 1)
    print("[OK] Added CryptoExportModal")
else:
    print("[FAIL] CodeValidationPanel not found")
    exit(1)

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n[DONE] Crypto integration added to WaterSourceManager")
