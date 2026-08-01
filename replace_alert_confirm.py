"""
批量替换 alert/confirm → toast/useConfirm
处理全部 33 处调用（22 alert + 11 confirm）
"""
import re
import os

BASE = r'F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src'

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def has_crlf(content):
    return '\r\n' in content

def ensure_eol(content):
    """Preserve line ending style"""
    if has_crlf(content):
        return content.replace('\n', '\r\n').replace('\r\r\n', '\r\n')
    return content

def process_file(path, transformer):
    """Read, transform, write back preserving line endings"""
    full_path = os.path.join(BASE, path) if not path.startswith(BASE) else path
    content = read_file(full_path)
    original = content
    content = transformer(content)
    if content != original:
        write_file(full_path, content)
        print(f'  OK: {path}')
    else:
        print(f'  SKIP (no changes): {path}')

# ──────────────────────────────────────
# 1. BackupSettingsModal.tsx — 2 alerts
# ──────────────────────────────────────
def fix_backup_settings(content):
    # Add import
    content = content.replace(
        "import { encryptAndDownload } from '@/lib/cryptoExport';",
        "import { encryptAndDownload } from '@/lib/cryptoExport';\nimport { useToast } from '@/hooks/useToast';"
    )
    # Add hook
    content = content.replace(
        "  const fileInputRef = useRef<HTMLInputElement>(null);",
        "  const toast = useToast();\n  const fileInputRef = useRef<HTMLInputElement>(null);"
    )
    # Replace alerts
    content = content.replace(
        "alert('两次输入的密码不一致');",
        "toast.warning('两次输入的密码不一致');"
    )
    content = content.replace(
        "alert(`加密备份失败：${err instanceof Error ? err.message : String(err)}`);",
        "toast.error(`加密备份失败：${err instanceof Error ? err.message : String(err)}`);"
    )
    return content

# ──────────────────────────────────────
# 2. BatchReportModal.tsx — 1 alert
# ──────────────────────────────────────
def fix_batch_report(content):
    # Find import section to add toast import
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    # Need to find the component function and add hook
    # Look for the component definition
    content = content.replace(
        "const BatchReportModal: React.FC",
        "const BatchReportModal: React.FC"
    )
    # Add hook after first useState or similar
    # Let's find a good insertion point
    content = content.replace(
        "  const [generating,",
        "  const toast = useToast();\n  const [generating,"
    )
    content = content.replace(
        "alert(`批量报告生成失败：${err instanceof Error ? err.message : String(err)}`);",
        "toast.error(`批量报告生成失败：${err instanceof Error ? err.message : String(err)}`);"
    )
    return content

# ──────────────────────────────────────
# 3. GisExportMenu.tsx — 1 alert
# ──────────────────────────────────────
def fix_gis_export(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    content = content.replace(
        "  const handle",
        "  const toast = useToast();\n  const handle",
        1  # only first occurrence
    )
    content = content.replace(
        "alert('无已保存的计算结果');",
        "toast.warning('无已保存的计算结果');"
    )
    return content

# ──────────────────────────────────────
# 4. MapFigureExport.tsx — 3 alerts
# ──────────────────────────────────────
def fix_map_figure(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    # Add hook - find the component props definition
    content = content.replace(
        "  const {",
        "  const toast = useToast();\n  const {",
        1
    )
    content = content.replace(
        "alert('该水源地无拐点坐标数据');",
        "toast.warning('该水源地无拐点坐标数据');"
    )
    content = content.replace(
        "alert('请允许弹出窗口以生成图件');",
        "toast.warning('请允许弹出窗口以生成图件');"
    )
    content = content.replace(
        "alert('图件生成失败: ' + (err as Error).message);",
        "toast.error('图件生成失败: ' + (err as Error).message);"
    )
    return content

# ──────────────────────────────────────
# 5. PreciseCalcPanel.tsx — 1 alert
# ──────────────────────────────────────
def fix_precise_calc(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    content = content.replace(
        "  const handle",
        "  const toast = useToast();\n  const handle",
        1
    )
    content = content.replace(
        "alert('请输入水源地名称');",
        "toast.warning('请输入水源地名称');"
    )
    return content

# ──────────────────────────────────────
# 6. VertexPrintTable.tsx — 1 alert
# ──────────────────────────────────────
def fix_vertex_print(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    content = content.replace(
        "  const handle",
        "  const toast = useToast();\n  const handle",
        1
    )
    content = content.replace(
        "alert('请允许弹出窗口以进行打印预览');",
        "toast.warning('请允许弹出窗口以进行打印预览');"
    )
    return content

# ──────────────────────────────────────
# 7. ZoneClipPanel.tsx — 2 alerts
# ──────────────────────────────────────
def fix_zone_clip(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    content = content.replace(
        "  const handle",
        "  const toast = useToast();\n  const handle",
        1
    )
    content = content.replace(
        "alert('无已保存的计算结果');",
        "toast.warning('无已保存的计算结果');"
    )
    content = content.replace(
        "alert('裁剪计算失败: ' + (e as Error).message);",
        "toast.error('裁剪计算失败: ' + (e as Error).message);"
    )
    return content

# ──────────────────────────────────────
# 8. ZoneSchemeCompare.tsx — 2 alerts
# ──────────────────────────────────────
def fix_zone_compare(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    content = content.replace(
        "  const handle",
        "  const toast = useToast();\n  const handle",
        1
    )
    content = content.replace(
        "alert('请选择两个方案');",
        "toast.warning('请选择两个方案');"
    )
    content = content.replace(
        "alert('请选择不同的方案进行对比');",
        "toast.warning('请选择不同的方案进行对比');"
    )
    return content

# ──────────────────────────────────────
# 9. WaterQualityTrendPanel.tsx — 3 alerts
# ──────────────────────────────────────
def fix_water_quality_trend(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    content = content.replace(
        "  const [periods,",
        "  const toast = useToast();\n  const [periods,"
    )
    content = content.replace(
        "alert('请填写监测期次标签和日期');",
        "toast.warning('请填写监测期次标签和日期');"
    )
    content = content.replace(
        "alert('请至少填写一个指标监测值');",
        "toast.warning('请至少填写一个指标监测值');"
    )
    content = content.replace(
        "alert('至少需要2期监测数据');",
        "toast.warning('至少需要2期监测数据');"
    )
    return content

# ──────────────────────────────────────
# 10. useMapExport.ts — 2 alerts (hook file, use toast import)
# ──────────────────────────────────────
def fix_use_map_export(content):
    # Add import at top after existing imports
    content = content.replace(
        "export function",
        "import { toast } from '@/stores/toastStore';\n\nexport function",
        1
    )
    content = content.replace(
        "alert('地图导出失败');",
        "toast.error('地图导出失败');"
    )
    content = content.replace(
        "alert('地图导出失败：' + (err as Error).message);",
        "toast.error('地图导出失败：' + (err as Error).message);"
    )
    return content

# ──────────────────────────────────────
# 11. batchReportPackager.ts — 1 alert (lib file)
# ──────────────────────────────────────
def fix_batch_report_packager(content):
    # Add import after first import line
    lines = content.split('\n')
    # Find last import line
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import = i
    lines.insert(last_import + 1, "import { toast } from '@/stores/toastStore';")
    content = '\n'.join(lines)
    content = content.replace(
        "alert('没有匹配的城市数据');",
        "toast.warning('没有匹配的城市数据');"
    )
    return content

# ──────────────────────────────────────
# 12. reportPdfExporter.ts — 1 alert (lib file)
# ──────────────────────────────────────
def fix_report_pdf(content):
    lines = content.split('\n')
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import = i
    lines.insert(last_import + 1, "import { toast } from '@/stores/toastStore';")
    content = '\n'.join(lines)
    content = content.replace(
        "alert('没有可生成报告的计算结果');",
        "toast.warning('没有可生成报告的计算结果');"
    )
    return content

# ──────────────────────────────────────
# 13. zoneExcelExporter.ts — 1 alert (lib file)
# ──────────────────────────────────────
def fix_zone_excel(content):
    lines = content.split('\n')
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import = i
    lines.insert(last_import + 1, "import { toast } from '@/stores/toastStore';")
    content = '\n'.join(lines)
    content = content.replace(
        "alert('没有可导出的计算结果');",
        "toast.warning('没有可导出的计算结果');"
    )
    return content

# ──────────────────────────────────────
# 14. zoneReportGenerator.ts — 1 alert (lib file)
# ──────────────────────────────────────
def fix_zone_report(content):
    lines = content.split('\n')
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import = i
    lines.insert(last_import + 1, "import { toast } from '@/stores/toastStore';")
    content = '\n'.join(lines)
    content = content.replace(
        "if (!returnBlob) alert('没有可生成报告的计算结果');",
        "if (!returnBlob) toast.warning('没有可生成报告的计算结果');"
    )
    return content

# ──────────────────────────────────────
# 15. Home.tsx — 2 alerts + 1 confirm (page)
# ──────────────────────────────────────
def fix_home(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport { useConfirm } from '@/hooks/useConfirm';\nimport React"
    )
    # Add hooks inside component
    content = content.replace(
        "  const navigate",
        "  const toast = useToast();\n  const confirm = useConfirm();\n  const navigate",
        1
    )
    content = content.replace(
        "alert('导入失败，请检查文件格式');",
        "toast.error('导入失败，请检查文件格式');"
    )
    content = content.replace(
        "alert('示例数据已全部加载');",
        "toast.success('示例数据已全部加载');"
    )
    # Replace confirm — need to make the function async
    content = content.replace(
        "if (window.confirm(`确定删除报告\"${name.replace(/（[^）]*）/, '')}\"？此操作不可恢复。`)) {",
        "if (await confirm({ message: `确定删除报告\"${name.replace(/（[^）]*）/, '')}\"？此操作不可恢复。`, danger: true })) {"
    )
    # Make the containing function async
    content = content.replace(
        "  const handleDeleteReport = (name: string) => {",
        "  const handleDeleteReport = async (name: string) => {"
    )
    return content

# ──────────────────────────────────────
# 16. ProjectAnalysis.tsx — 5 alerts (page)
# ──────────────────────────────────────
def fix_project_analysis(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport React"
    )
    content = content.replace(
        "  const [projectName,",
        "  const toast = useToast();\n  const [projectName,"
    )
    content = content.replace("alert('请输入项目名称');", "toast.warning('请输入项目名称');")
    content = content.replace("alert('请输入有效的经纬度');", "toast.warning('请输入有效的经纬度');")
    content = content.replace("alert('经纬度不在河北省范围内（经度113~120，纬度35~43）');", "toast.warning('经纬度不在河北省范围内（经度113~120，纬度35~43）');")
    content = content.replace("alert('暂无保护区计算结果，请先在\"保护区划分\"页面进行计算');", "toast.warning('暂无保护区计算结果，请先在\"保护区划分\"页面进行计算');")
    content = content.replace("alert('请填写完整信息');", "toast.warning('请填写完整信息');")
    return content

# ──────────────────────────────────────
# 17. WaterSourceManager.tsx — 3 alerts + 2 confirms (page)
# ──────────────────────────────────────
def fix_water_source_mgr(content):
    content = content.replace(
        "import React",
        "import { useToast } from '@/hooks/useToast';\nimport { useConfirm } from '@/hooks/useConfirm';\nimport React"
    )
    # Add hooks - find good insertion point
    content = content.replace(
        "  const [searchQuery,",
        "  const toast = useToast();\n  const confirm = useConfirm();\n  const [searchQuery,"
    )
    # Replace alerts
    content = content.replace(
        "alert(`成功导入 ${count} 条水源地记录`);",
        "toast.success(`成功导入 ${count} 条水源地记录`);"
    )
    content = content.replace(
        "alert('导入失败，请检查文件格式');",
        "toast.error('导入失败，请检查文件格式');"
    )
    content = content.replace(
        "alert(`成功导入 ${imported} 条水源地记录（共 ${result.meta.parsedRows} 行解析成功）`);",
        "toast.success(`成功导入 ${imported} 条水源地记录（共 ${result.meta.parsedRows} 行解析成功）`);"
    )
    # Replace confirms — need async
    content = content.replace(
        "const handleReset = () => {",
        "const handleReset = async () => {"
    )
    content = content.replace(
        "if (!window.confirm('确定重置为默认数据？所有手动修改将丢失。')) return;",
        "if (!await confirm({ message: '确定重置为默认数据？所有手动修改将丢失。', danger: true })) return;"
    )
    content = content.replace(
        "const handleDelete = (source",
        "const handleDelete = async (source"
    )
    content = content.replace(
        "if (!window.confirm(`确定删除\"${source.name}\"？`)) return;",
        "if (!await confirm({ message: `确定删除\"${source.name}\"？`, danger: true })) return;"
    )
    return content

# ──────────────────────────────────────
# 18. ProtectionZoneCalc.tsx — 1 confirm (page)
# ──────────────────────────────────────
def fix_protection_zone(content):
    content = content.replace(
        "import React",
        "import { useConfirm } from '@/hooks/useConfirm';\nimport React"
    )
    # Add hook
    content = content.replace(
        "  const [zoneResults,",
        "  const confirm = useConfirm();\n  const [zoneResults,"
    )
    # Replace confirm
    content = content.replace(
        "if (confirm(`确定清空全部${zoneResults.length}条保存的计算结果？`)) {",
        "if (await confirm({ message: `确定清空全部${zoneResults.length}条保存的计算结果？`, danger: true })) {"
    )
    # Make the function async
    content = content.replace(
        "  const handleClearAll = () => {",
        "  const handleClearAll = async () => {"
    )
    return content

# ──────────────────────────────────────
# 19. AuditLog.tsx — 1 confirm (page)
# ──────────────────────────────────────
def fix_audit_log(content):
    content = content.replace(
        "import React",
        "import { useConfirm } from '@/hooks/useConfirm';\nimport React"
    )
    content = content.replace(
        "  const [logs,",
        "  const confirm = useConfirm();\n  const [logs,"
    )
    content = content.replace(
        "if (confirm('确定清空全部审计日志？此操作不可恢复。')) {",
        "if (await confirm({ message: '确定清空全部审计日志？此操作不可恢复。', danger: true })) {"
    )
    content = content.replace(
        "  const handleClear = () => {",
        "  const handleClear = async () => {"
    )
    return content

# ──────────────────────────────────────
# 20. VersionHistory.tsx — 2 confirms (page)
# ──────────────────────────────────────
def fix_version_history(content):
    content = content.replace(
        "import React",
        "import { useConfirm } from '@/hooks/useConfirm';\nimport React"
    )
    content = content.replace(
        "  const [versions,",
        "  const confirm = useConfirm();\n  const [versions,"
    )
    # Replace confirms
    content = content.replace(
        "!window.confirm(`确定回滚到版本\"${v.name}\"？\\n当前数据将被替换。建议先创建当前版本的快照。`)",
        "!await confirm({ message: `确定回滚到版本\"${v.name}\"？\\n当前数据将被替换。建议先创建当前版本的快照。`, danger: true })"
    )
    content = content.replace(
        "if (!window.confirm(`确定删除版本\"${v.name}\"？此操作不可恢复。`)) return;",
        "if (!await confirm({ message: `确定删除版本\"${v.name}\"？此操作不可恢复。`, danger: true })) return;"
    )
    # Make functions async
    content = content.replace(
        "  const handleRollback = (v:",
        "  const handleRollback = async (v:"
    )
    content = content.replace(
        "  const handleDelete = (v:",
        "  const handleDelete = async (v:"
    )
    return content

# ──────────────────────────────────────
# 21. DataSourceManager.tsx — 3 confirms (component)
# ──────────────────────────────────────
def fix_data_source(content):
    content = content.replace(
        "import React",
        "import { useConfirm } from '@/hooks/useConfirm';\nimport React"
    )
    content = content.replace(
        "  const [sources,",
        "  const confirm = useConfirm();\n  const [sources,"
    )
    # Replace confirms
    content = content.replace(
        "if (window.confirm('重置为默认数据源配置？这将清除所有自定义数据源。')) {",
        "if (await confirm({ message: '重置为默认数据源配置？这将清除所有自定义数据源。', danger: true })) {"
    )
    content = content.replace(
        "const handleReset = () => {",
        "const handleReset = async () => {"
    )
    content = content.replace(
        "!window.confirm('删除内置数据源可能导致应用无法正常工作，确定继续？')",
        "!await confirm({ message: '删除内置数据源可能导致应用无法正常工作，确定继续？', danger: true })"
    )
    content = content.replace(
        "if (source.type !== 'static' && !window.confirm(`删除数据源「${source.name}」？`))",
        "if (source.type !== 'static' && !await confirm({ message: `删除数据源「${source.name}」？`, danger: true }))"
    )
    # Make delete function async
    content = content.replace(
        "const handleDelete = (source",
        "const handleDelete = async (source"
    )
    return content

# ──────────────────────────────────────
# 22. QuickCalcPanel.tsx — 1 confirm (component)
# ──────────────────────────────────────
def fix_quick_calc(content):
    content = content.replace(
        "import React",
        "import { useConfirm } from '@/hooks/useConfirm';\nimport React"
    )
    content = content.replace(
        "  const handleCalc",
        "  const confirm = useConfirm();\n  const handleCalc",
        1
    )
    content = content.replace(
        "!window.confirm(`确定对全部 ${sources.length} 个地下水水源地进行保护区计算？`)",
        "!await confirm({ message: `确定对全部 ${sources.length} 个地下水水源地进行保护区计算？` })"
    )
    # Make function async
    content = content.replace(
        "  const handleCalc = () => {",
        "  const handleCalc = async () => {"
    )
    return content

# ──────────────────────────────────────
# Execute all replacements
# ──────────────────────────────────────
print('=== Replacing alert/confirm calls ===\n')

files = [
    ('components/BackupSettingsModal.tsx', fix_backup_settings),
    ('components/BatchReportModal.tsx', fix_batch_report),
    ('components/protection-zone/GisExportMenu.tsx', fix_gis_export),
    ('components/protection-zone/MapFigureExport.tsx', fix_map_figure),
    ('components/protection-zone/PreciseCalcPanel.tsx', fix_precise_calc),
    ('components/protection-zone/VertexPrintTable.tsx', fix_vertex_print),
    ('components/protection-zone/ZoneClipPanel.tsx', fix_zone_clip),
    ('components/protection-zone/ZoneSchemeCompare.tsx', fix_zone_compare),
    ('components/WaterQualityTrendPanel.tsx', fix_water_quality_trend),
    ('hooks/useMapExport.ts', fix_use_map_export),
    ('lib/batchReportPackager.ts', fix_batch_report_packager),
    ('lib/reportPdfExporter.ts', fix_report_pdf),
    ('lib/zoneExcelExporter.ts', fix_zone_excel),
    ('lib/zoneReportGenerator.ts', fix_zone_report),
    ('pages/Home.tsx', fix_home),
    ('pages/ProjectAnalysis.tsx', fix_project_analysis),
    ('pages/WaterSourceManager.tsx', fix_water_source_mgr),
    ('pages/ProtectionZoneCalc.tsx', fix_protection_zone),
    ('pages/AuditLog.tsx', fix_audit_log),
    ('pages/VersionHistory.tsx', fix_version_history),
    ('components/DataSourceManager.tsx', fix_data_source),
    ('components/protection-zone/QuickCalcPanel.tsx', fix_quick_calc),
]

for path, transformer in files:
    process_file(path, transformer)

print('\n=== Done ===')
