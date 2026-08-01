"""
精确修复 tsc 错误：
1. BatchReportModal — 添加 useToast import + hook
2. MapFigureExport — 修复 toast hook 位置
3. ZoneClipPanel — 添加 toast hook
4. WaterSourceManager — 添加 toast + confirm hook
5. DataSourceManager — 添加 confirm hook + async 函数
6. Home.tsx — async 函数
7. ProtectionZoneCalc — async 函数
8. QuickCalcPanel — async 函数
9. AuditLog — async 函数 + confirm 类型
"""
import os

BASE = r'F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src'

def read(path):
    with open(os.path.join(BASE, path), 'r', encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(os.path.join(BASE, path), 'w', encoding='utf-8') as f:
        f.write(content)

# ── 1. BatchReportModal.tsx ──
# Need: add import, add hook
f = 'components/BatchReportModal.tsx'
c = read(f)
# Add import after first import
c = c.replace(
    "import { useState, useMemo } from 'react';",
    "import { useState, useMemo } from 'react';\nimport { useToast } from '@/hooks/useToast';"
)
# Add hook after function declaration
c = c.replace(
    "export default function BatchReportModal({ open, onClose, results, sources }: Props) {\n  const [format,",
    "export default function BatchReportModal({ open, onClose, results, sources }: Props) {\n  const toast = useToast();\n  const [format,"
)
write(f, c)
print('OK: BatchReportModal')

# ── 2. MapFigureExport.tsx ──
# toast was placed inside a handler function, need to move to component level
f = 'components/protection-zone/MapFigureExport.tsx'
c = read(f)
# Remove misplaced toast hook
c = c.replace("  const toast = useToast();\n", "")
# Add at component level (after props destructure)
c = c.replace(
    "const MapFigureExport: React.FC<MapFigureExportProps> = ({ zoneResults, sources }) => {",
    "const MapFigureExport: React.FC<MapFigureExportProps> = ({ zoneResults, sources }) => {\n  const toast = useToast();"
)
write(f, c)
print('OK: MapFigureExport')

# ── 3. ZoneClipPanel.tsx ──
f = 'components/protection-zone/ZoneClipPanel.tsx'
c = read(f)
c = c.replace(
    "const ZoneClipPanel: React.FC<ZoneClipPanelProps> = ({ zoneResults, sources }) => {\n  const [clipLoading,",
    "const ZoneClipPanel: React.FC<ZoneClipPanelProps> = ({ zoneResults, sources }) => {\n  const toast = useToast();\n  const [clipLoading,"
)
write(f, c)
print('OK: ZoneClipPanel')

# ── 4. WaterSourceManager.tsx ──
f = 'pages/WaterSourceManager.tsx'
c = read(f)
# Find the component opening and add hooks
c = c.replace(
    "const WaterSourceManager: React.FC = () => {\n  const {",
    "const WaterSourceManager: React.FC = () => {\n  const toast = useToast();\n  const confirm = useConfirm();\n  const {",
    1
)
write(f, c)
print('OK: WaterSourceManager')

# ── 5. DataSourceManager.tsx ──
f = 'components/DataSourceManager.tsx'
c = read(f)
# Check if confirm hook was added
if 'const confirm = useConfirm();' not in c:
    # Find component definition
    import re
    # Add hook after first const inside component
    c = c.replace(
        "  const [sources,",
        "  const confirm = useConfirm();\n  const [sources,",
        1
    )
# Make handleReset async
c = c.replace("const handleReset = () => {", "const handleReset = async () => {")
# Make handleDelete async
c = c.replace("const handleDelete = (source", "const handleDelete = async (source")
write(f, c)
print('OK: DataSourceManager')

# ── 6. Home.tsx ──
f = 'pages/Home.tsx'
c = read(f)
# Check if toast/confirm hooks exist
if 'const toast = useToast();' not in c:
    # Find the component definition
    c = c.replace(
        "  const navigate",
        "  const toast = useToast();\n  const confirm = useConfirm();\n  const navigate",
        1
    )
# Make handleDeleteReport async
c = c.replace("const handleDeleteReport = (name: string) => {", "const handleDeleteReport = async (name: string) => {")
write(f, c)
print('OK: Home')

# ── 7. ProtectionZoneCalc.tsx ──
f = 'pages/ProtectionZoneCalc.tsx'
c = read(f)
# Check if confirm hook exists
if 'const confirm = useConfirm();' not in c:
    c = c.replace(
        "  const [zoneResults,",
        "  const confirm = useConfirm();\n  const [zoneResults,",
        1
    )
# Make handleClearAll async
c = c.replace("const handleClearAll = () => {", "const handleClearAll = async () => {")
write(f, c)
print('OK: ProtectionZoneCalc')

# ── 8. QuickCalcPanel.tsx ──
f = 'components/protection-zone/QuickCalcPanel.tsx'
c = read(f)
# Check if confirm hook exists
if 'const confirm = useConfirm();' not in c:
    # Find first const inside component
    c = c.replace(
        "  const handleCalc",
        "  const confirm = useConfirm();\n  const handleCalc",
        1
    )
# Make handleCalc async — find the right pattern
c = c.replace(
    "  const handleCalc = () => {",
    "  const handleCalc = async () => {"
)
write(f, c)
print('OK: QuickCalcPanel')

# ── 9. AuditLog.tsx ──
f = 'pages/AuditLog.tsx'
c = read(f)
# Check if confirm hook exists
if 'const confirm = useConfirm();' not in c:
    c = c.replace(
        "  const [logs,",
        "  const confirm = useConfirm();\n  const [logs,",
        1
    )
# Make handleClear async
c = c.replace("const handleClear = () => {", "const handleClear = async () => {")
write(f, c)
print('OK: AuditLog')

# ── 10. VersionHistory.tsx ──
f = 'pages/VersionHistory.tsx'
c = read(f)
# Check if confirm hook exists
if 'const confirm = useConfirm();' not in c:
    c = c.replace(
        "  const [versions,",
        "  const confirm = useConfirm();\n  const [versions,",
        1
    )
# Make handleRollback async
c = c.replace("  const handleRollback = (v:", "  const handleRollback = async (v:")
# Make handleDelete async
c = c.replace("  const handleDelete = (v:", "  const handleDelete = async (v:")
write(f, c)
print('OK: VersionHistory')

print('\n=== All fixes applied ===')
