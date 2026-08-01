"""Fix all ESLint import warnings in split components"""

# ===== PreciseCalcPanel: merge duplicate imports =====
p = r'src/components/protection-zone/PreciseCalcPanel.tsx'
with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

old_imports = (
    "import { useWaterSourceStore } from '@/stores/waterSourceStore';\n"
    "import type { WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';\n"
    "import type { CalcParams, CalcResult } from '@/lib/zoneCalcEngine';\n"
    "import { calcProtectionZones } from '@/lib/zoneCalcEngine';\n"
)
new_imports = (
    "import { useWaterSourceStore, type WaterSourceRecord, type ZoneCalcRecord } from '@/stores/waterSourceStore';\n"
    "import { calcProtectionZones, type CalcParams, type CalcResult } from '@/lib/zoneCalcEngine';\n"
)
if old_imports in c:
    c = c.replace(old_imports, new_imports)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Fixed PreciseCalcPanel: merged duplicate imports')
else:
    print('PreciseCalcPanel: pattern not found for import merge')

# ===== ProtectionZoneCalc.tsx: clean up unused imports and merge duplicates =====
p2 = r'src/pages/ProtectionZoneCalc.tsx'
with open(p2, 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the entire import block
old_block = (
    "import React, { useState, useMemo, useCallback, useEffect } from 'react';\n"
    "import { useWaterSourceStore, WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';\n"
    "import type { CalcResult } from '@/lib/zoneCalcEngine';\n"
    "import { exportZoneExcel } from '@/lib/zoneExcelExporter';\n"
    "import {\n"
    "  toGeoJSON,\n"
    "  toBatchGeoJSON,\n"
    "  exportGeoJSON,\n"
    "  exportKML,\n"
    "  exportWKT,\n"
    "  exportBatchGeoJSON as exportAllGeoJSON,\n"
    "} from '@/lib/zoneGISExporter';\n"
    "import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';\n"
    "import { clipBatchZones, loadAdminBoundaries, summarizeClipResults } from '@/lib/zoneClipEngine';\n"
    "import type { SourceClipResult } from '@/lib/zoneClipEngine';\n"
    "import { analyzeSensitivity, toChartData } from '@/lib/sensitivityEngine';\n"
    "import type { SensitivityResult } from '@/lib/sensitivityEngine';\n"
    "import {\n"
    "  generateZoneReport,\n"
    "  generateBatchReports,\n"
    "  type ReportConfig,\n"
    "} from '@/lib/zoneReportGenerator';\n"
    "import { generatePdfReport } from '@/lib/reportPdfExporter';\n"
    "import ReportConfigModal from '@/components/ReportConfigModal';\n"
    "import WellFieldCalc from '@/components/WellFieldCalc';\n"
    "import CompliancePanel from '@/components/CompliancePanel';\n"
    "import QuickCalcPanel from '@/components/protection-zone/QuickCalcPanel';\n"
    "import PreciseCalcPanel from '@/components/protection-zone/PreciseCalcPanel';\n"
    "import ResultCard from '@/components/protection-zone/ResultCard';\n"
    "import ComparePanel from '@/components/protection-zone/ComparePanel';\n"
)
new_block = (
    "import React, { useState, useMemo, useCallback, useEffect } from 'react';\n"
    "import { useWaterSourceStore, type ZoneCalcRecord } from '@/stores/waterSourceStore';\n"
    "import type { CalcResult } from '@/lib/zoneCalcEngine';\n"
    "import { exportZoneExcel } from '@/lib/zoneExcelExporter';\n"
    "import {\n"
    "  exportKML,\n"
    "  exportWKT,\n"
    "  exportBatchGeoJSON as exportAllGeoJSON,\n"
    "} from '@/lib/zoneGISExporter';\n"
    "import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';\n"
    "import { clipBatchZones, summarizeClipResults, type SourceClipResult } from '@/lib/zoneClipEngine';\n"
    "import { analyzeSensitivity, toChartData, type SensitivityResult } from '@/lib/sensitivityEngine';\n"
    "import {\n"
    "  generateZoneReport,\n"
    "  generateBatchReports,\n"
    "  type ReportConfig,\n"
    "} from '@/lib/zoneReportGenerator';\n"
    "import { generatePdfReport } from '@/lib/reportPdfExporter';\n"
    "import ReportConfigModal from '@/components/ReportConfigModal';\n"
    "import WellFieldCalc from '@/components/WellFieldCalc';\n"
    "import CompliancePanel from '@/components/CompliancePanel';\n"
    "import QuickCalcPanel from '@/components/protection-zone/QuickCalcPanel';\n"
    "import PreciseCalcPanel from '@/components/protection-zone/PreciseCalcPanel';\n"
    "import ResultCard from '@/components/protection-zone/ResultCard';\n"
    "import ComparePanel from '@/components/protection-zone/ComparePanel';\n"
)
if old_block in c:
    c = c.replace(old_block, new_block)
    print('Fixed ProtectionZoneCalc: cleaned imports')
else:
    print('ProtectionZoneCalc: import block not found')

# Remove deleteZoneResult from destructuring
old_destructure = (
    "const { loaded, sources, zoneResults, saveZoneResult, deleteZoneResult, loadZoneResults } =\n"
    "    useWaterSourceStore();"
)
new_destructure = (
    "const { loaded, sources, zoneResults, saveZoneResult, loadZoneResults } =\n"
    "    useWaterSourceStore();"
)
if old_destructure in c:
    c = c.replace(old_destructure, new_destructure)
    print('Fixed ProtectionZoneCalc: removed unused deleteZoneResult')
else:
    print('ProtectionZoneCalc: destructure pattern not found')

with open(p2, 'w', encoding='utf-8') as f:
    f.write(c)

print('Done')
