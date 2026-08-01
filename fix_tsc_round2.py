"""
第二轮精确修复：
1. ProtectionZoneCalc — 添加 confirm hook + inline onClick 改 async
2. DataSourceManager — 添加 confirm hook + inline onClick/onRemove 改 async
3. AuditLog — 添加 confirm hook
4. Home.tsx — handleDelete 改 async
5. QuickCalcPanel — handleCalcAll 改 async
"""
import os

BASE = r'F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src'

def read(path):
    with open(os.path.join(BASE, path), 'r', encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(os.path.join(BASE, path), 'w', encoding='utf-8') as f:
        f.write(content)

# ── 1. ProtectionZoneCalc.tsx ──
f = 'pages/ProtectionZoneCalc.tsx'
c = read(f)
# Add confirm hook after first useState
c = c.replace(
    "  const [results, setResults] = useState<CalcResult[]>([]);",
    "  const confirm = useConfirm();\n  const [results, setResults] = useState<CalcResult[]>([]);"
)
# Make inline onClick async
c = c.replace(
    "onClick={() => {\n                    if (await confirm({ message: `确定清空全部${zoneResults.length}条保存的计算结果？`, danger: true })) {",
    "onClick={async () => {\n                    if (await confirm({ message: `确定清空全部${zoneResults.length}条保存的计算结果？`, danger: true })) {"
)
write(f, c)
print('OK: ProtectionZoneCalc')

# ── 2. DataSourceManager.tsx ──
f = 'components/DataSourceManager.tsx'
c = read(f)
# Add confirm hook inside DataSourceManager component (line 41 area)
c = c.replace(
    "const DataSourceManager: React.FC<DataSourceManagerProps> = ({ onClose }) => {\n  const [sources,",
    "const DataSourceManager: React.FC<DataSourceManagerProps> = ({ onClose }) => {\n  const confirm = useConfirm();\n  const [sources,"
)
# Make reset button onClick async
c = c.replace(
    "onClick={() => {\n              if (await confirm({ message: '重置为默认数据源配置？这将清除所有自定义数据源。', danger: true })) {",
    "onClick={async () => {\n              if (await confirm({ message: '重置为默认数据源配置？这将清除所有自定义数据源。', danger: true })) {"
)
# Make onRemove async
c = c.replace(
    "onRemove={() => {\n                  if (",
    "onRemove={async () => {\n                  if ("
)
write(f, c)
print('OK: DataSourceManager')

# ── 3. AuditLog.tsx ──
f = 'pages/AuditLog.tsx'
c = read(f)
# Add confirm hook — file uses `export default function AuditLogPage() {`
c = c.replace(
    "export default function AuditLogPage() {\n  const [logs,",
    "export default function AuditLogPage() {\n  const confirm = useConfirm();\n  const [logs,"
)
write(f, c)
print('OK: AuditLog')

# ── 4. Home.tsx ──
f = 'pages/Home.tsx'
c = read(f)
# Make handleDelete async
c = c.replace(
    "const handleDelete = (id: string, name: string) => {",
    "const handleDelete = async (id: string, name: string) => {"
)
write(f, c)
print('OK: Home')

# ── 5. QuickCalcPanel.tsx ──
f = 'components/protection-zone/QuickCalcPanel.tsx'
c = read(f)
# Make handleCalcAll async
c = c.replace(
    "const handleCalcAll = () => {",
    "const handleCalcAll = async () => {"
)
write(f, c)
print('OK: QuickCalcPanel')

print('\n=== Round 2 fixes applied ===')
