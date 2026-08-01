#!/usr/bin/env python3
"""Edit WaterSourceManager.tsx for N2 code validation integration"""

PATH = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src\pages\WaterSourceManager.tsx"

with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add showCodeValidation state
old_state = "  const [showFormModal, setShowFormModal] = useState(false);\n  const [editTarget, setEditTarget] = useState<WaterSourceRecord | null>(null);"
new_state = "  const [showFormModal, setShowFormModal] = useState(false);\n  const [editTarget, setEditTarget] = useState<WaterSourceRecord | null>(null);\n  const [showCodeValidation, setShowCodeValidation] = useState(false);"
if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("[OK] Added showCodeValidation state")
else:
    print("[FAIL] state not found")
    exit(1)

# 2. Add code validation button after data source manager button
old_btn = """            数据源管理
          </button>"""
new_btn = """            数据源管理
          </button>

          <button
            onClick={() => setShowCodeValidation(true)}
            className="text-xs px-3 py-1.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            编码校验
          </button>"""
if old_btn in content:
    content = content.replace(old_btn, new_btn, 1)
    print("[OK] Added code validation button")
else:
    print("[FAIL] data source button not found")
    exit(1)

# 3. Add allSources prop and CodeValidationPanel
old_modal = """      <SourceFormModal
        open={showFormModal}
        source={editTarget}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
      />"""
new_modal = """      <SourceFormModal
        open={showFormModal}
        source={editTarget}
        allSources={sources}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
      />
      <CodeValidationPanel
        open={showCodeValidation}
        sources={sources}
        onClose={() => setShowCodeValidation(false)}
      />"""
if old_modal in content:
    content = content.replace(old_modal, new_modal, 1)
    print("[OK] Added allSources prop and CodeValidationPanel")
else:
    print("[FAIL] SourceFormModal not found")
    exit(1)

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n[DONE] WaterSourceManager.tsx N2 integration complete")
