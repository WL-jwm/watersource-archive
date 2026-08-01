"""
D1: ProtectionZoneCalc.tsx 大文件拆分脚本 (v2)
将 2377 行的主文件拆分为 5 个独立模块（calcRecommendations.ts 已存在）
"""
import os

SRC = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src\pages\ProtectionZoneCalc.tsx"
OUT_DIR = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src\components\protection-zone"

with open(SRC, 'r', encoding='utf-8') as f:
    lines = f.readlines()

total = len(lines)
print(f"Total lines: {total}")

def extract(start, end):
    """1-based, inclusive"""
    return ''.join(lines[start-1:end])

# ===== QuickCalcPanel: 271-403 =====
quick_code = extract(271, 403)
# const QuickCalcPanel -> export default function QuickCalcPanel
quick_code = quick_code.replace(
    'const QuickCalcPanel: React.FC<{',
    'function QuickCalcPanel({'
)
# Fix the closing - change }; to } and add export default
# The component ends with:
#   );
# };
# We need:  );
# }
# export default QuickCalcPanel;
quick_code = quick_code.rstrip()
if quick_code.endswith('};'):
    quick_code = quick_code[:-2] + '}'
quick_code += '\n\nexport default QuickCalcPanel;\n'

quick_imports = """/** 快速批量计算面板 */

import React, { useState } from 'react';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import type { CalcResult } from '@/lib/zoneCalcEngine';
import { calcProtectionZones, inferDefaultParams } from '@/lib/zoneCalcEngine';

"""

with open(f"{OUT_DIR}/QuickCalcPanel.tsx", 'w', encoding='utf-8') as f:
    f.write(quick_imports)
    f.write(quick_code)
print("QuickCalcPanel.tsx written")

# ===== PreciseCalcPanel: 406-1098 =====
precise_code = extract(406, 1098)
# const PreciseCalcPanel -> function PreciseCalcPanel
precise_code = precise_code.replace(
    'const PreciseCalcPanel: React.FC<{\n  onResult: (result: CalcResult, customParams?: ZoneCalcRecord[\'customParams\']) => void;\n}> = ({ onResult }) => {',
    'function PreciseCalcPanel({ onResult }: {\n  onResult: (result: CalcResult, customParams?: ZoneCalcRecord[\'customParams\']) => void;\n}) {'
)
# Fix closing };
precise_code = precise_code.rstrip()
if precise_code.endswith('};'):
    precise_code = precise_code[:-2] + '}'
precise_code += '\n\nexport default PreciseCalcPanel;\n'

precise_imports = """/** 精确计算面板（手动输入水文地质参数，解析法） */

import React, { useState } from 'react';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { CalcParams, CalcResult } from '@/lib/zoneCalcEngine';
import { calcProtectionZones, inferDefaultParams } from '@/lib/zoneCalcEngine';
import {
  type RecommendedParams,
  PARAM_RECOMMENDATIONS,
  REGIONAL_PARAMS,
  getSmartRecommendation,
} from './calcRecommendations';

"""

with open(f"{OUT_DIR}/PreciseCalcPanel.tsx", 'w', encoding='utf-8') as f:
    f.write(precise_imports)
    f.write(precise_code)
print("PreciseCalcPanel.tsx written")

# ===== ResultCard: 1099-1201 =====
result_code = extract(1099, 1201)
# const ResultCard: React.FC<{ result: CalcResult; index: number }> = ({ result, index }) => (
# -> function ResultCard({ result, index }: { result: CalcResult; index: number }) {
# But ResultCard is an arrow function returning JSX directly, need to convert
result_code = result_code.replace(
    'const ResultCard: React.FC<{ result: CalcResult; index: number }> = ({ result, index }) => (',
    'function ResultCard({ result, index }: { result: CalcResult; index: number }) {'
)
# The arrow function body is ( ... ); which becomes { return ( ... ); }
# Find the last ); and change to );
result_code = result_code.rstrip()
if result_code.endswith(');'):
    # Change the trailing ); to ); } 
    # Actually the pattern is:
    #   );
    # );
    # We need to change the final ); to );
    # }
    pass
# ResultCard ends with:
#   );
# );
# Convert to:
#   );
# }
result_code = result_code.rstrip()
# Find last occurrence of ');' and replace with ');\n}'
idx = result_code.rfind(');')
if idx >= 0:
    result_code = result_code[:idx] + ');\n}'
result_code += '\n\nexport default ResultCard;\n'

result_imports = """/** 计算结果卡片 */

import React from 'react';
import type { CalcResult } from '@/lib/zoneCalcEngine';

"""

with open(f"{OUT_DIR}/ResultCard.tsx", 'w', encoding='utf-8') as f:
    f.write(result_imports)
    f.write(result_code)
print("ResultCard.tsx written")

# ===== ComparePanel: 1202-1601 =====
compare_code = extract(1202, 1601)
# const ComparePanel: React.FC<{ results: CalcResult[] }> = ({ results }) => {
# -> function ComparePanel({ results }: { results: CalcResult[] }) {
compare_code = compare_code.replace(
    'const ComparePanel: React.FC<{ results: CalcResult[] }> = ({ results }) => {',
    'function ComparePanel({ results }: { results: CalcResult[] }) {'
)
compare_code = compare_code.rstrip()
if compare_code.endswith('};'):
    compare_code = compare_code[:-2] + '}'
compare_code += '\n\nexport default ComparePanel;\n'

compare_imports = """/** 方案对比面板 */

import React, { useState } from 'react';
import type { CalcResult } from '@/lib/zoneCalcEngine';

"""

with open(f"{OUT_DIR}/ComparePanel.tsx", 'w', encoding='utf-8') as f:
    f.write(compare_imports)
    f.write(compare_code)
print("ComparePanel.tsx written")

# ===== 重写主文件 =====
# 主文件从 line 1602 开始（包含注释行），但实际函数从 1604 开始
# 取 1602-2377（包含注释）
main_code = extract(1602, total)
# const ProtectionZoneCalc: React.FC = () => {
# -> function ProtectionZoneCalc() {
main_code = main_code.replace(
    'const ProtectionZoneCalc: React.FC = () => {',
    'function ProtectionZoneCalc() {'
)
# Fix closing
main_code = main_code.rstrip()
if main_code.endswith('};'):
    main_code = main_code[:-2] + '}'
# Remove the existing "export default ProtectionZoneCalc;" at the end
main_code = main_code.replace('export default ProtectionZoneCalc;', '')
main_code = main_code.rstrip()
main_code += '\n\nexport default ProtectionZoneCalc;\n'

main_imports = """/** 保护区划分计算页面
 *
 * 功能：
 * 1. 单个/批量水源地保护区计算
 * 2. 经验值法 + 解析法（Cooper-Jacob）
 * 3. 计算结果展示（参数/公式/面积/边界描述）
 * 4. 结果持久化到IDB
 * 5. 从水源地列表快速导入
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useWaterSourceStore, WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { CalcResult } from '@/lib/zoneCalcEngine';
import { exportZoneExcel } from '@/lib/zoneExcelExporter';
import {
  toGeoJSON,
  toBatchGeoJSON,
  exportGeoJSON,
  exportKML,
  exportWKT,
  exportBatchGeoJSON as exportAllGeoJSON,
} from '@/lib/zoneGISExporter';
import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';
import { clipBatchZones, loadAdminBoundaries, summarizeClipResults } from '@/lib/zoneClipEngine';
import type { SourceClipResult } from '@/lib/zoneClipEngine';
import { analyzeSensitivity, toChartData } from '@/lib/sensitivityEngine';
import type { SensitivityResult } from '@/lib/sensitivityEngine';
import {
  generateZoneReport,
  generateBatchReports,
  type ReportConfig,
} from '@/lib/zoneReportGenerator';
import { generatePdfReport } from '@/lib/reportPdfExporter';
import ReportConfigModal from '@/components/ReportConfigModal';
import WellFieldCalc from '@/components/WellFieldCalc';
import CompliancePanel from '@/components/CompliancePanel';
import QuickCalcPanel from '@/components/protection-zone/QuickCalcPanel';
import PreciseCalcPanel from '@/components/protection-zone/PreciseCalcPanel';
import ResultCard from '@/components/protection-zone/ResultCard';
import ComparePanel from '@/components/protection-zone/ComparePanel';

"""

with open(SRC, 'w', encoding='utf-8') as f:
    f.write(main_imports)
    f.write(main_code)
print("ProtectionZoneCalc.tsx rewritten (main only)")

# ===== 统计 =====
for name in ['QuickCalcPanel.tsx', 'PreciseCalcPanel.tsx', 'ResultCard.tsx', 'ComparePanel.tsx', 'calcRecommendations.ts']:
    path = os.path.join(OUT_DIR, name)
    with open(path, 'r', encoding='utf-8') as f:
        count = len(f.readlines())
    print(f"  {name}: {count} lines")

with open(SRC, 'r', encoding='utf-8') as f:
    count = len(f.readlines())
print(f"  ProtectionZoneCalc.tsx: {count} lines")
print("Done!")
