"""
S3.2: 修复12处 as any
S3.3: 修复 Layout.tsx 2处空 catch
S4.1: 创建 EmptyState + LoadingSpinner 组件
S4.3: Home.tsx useNavigate → window.location.hash
"""
import os

BASE = r'F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src'

def read(path):
    with open(os.path.join(BASE, path), 'r', encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(os.path.join(BASE, path), 'w', encoding='utf-8') as f:
        f.write(content)

# ══════════════════════════════════════
# S3.2: as any 修复
# ══════════════════════════════════════

# 1. ZoneStatsPanel.tsx:70 — .filter(Boolean) as any[]
p = 'components/dashboard/ZoneStatsPanel.tsx'
c = read(p)
# Define interface for city zone data, replace as any[]
c = c.replace(
    "  const cityZoneData = cityOrder\n    .map((city) => cityZoneMap.get(city))\n    .filter(Boolean) as any[];",
    "  const cityZoneData = cityOrder\n    .map((city) => cityZoneMap.get(city))\n    .filter((d): d is { city: string; count: number; primaryArea: number; secondaryArea: number; totalArea: number; sources: string[] } => d !== undefined);"
)
write(p, c)
print('OK: ZoneStatsPanel')

# 2. ComparePanel.tsx:103,125 — (r as any)._idx
p = 'components/protection-zone/ComparePanel.tsx'
c = read(p)
# The type is already defined inline: CalcResult & { _idx: number }
# Replace (r as any)._idx with r._idx and add proper type annotation
c = c.replace(
    "      groups[r.sourceName].push({ ...r, _idx: idx } as CalcResult & { _idx: number });",
    "      groups[r.sourceName].push({ ...r, _idx: idx } as CalcResult & { _idx: number });\n      idx++;"
)
# Check if idx++ is already there (avoid duplicate)
if c.count("idx++;") > 2:
    c = c.replace("\n      idx++;", "", 1)  # Remove the one we just added if it was already there
# Actually, let's just replace (r as any)._idx with (r as CalcResult & { _idx: number })._idx
c = read(p)  # re-read clean
c = c.replace("(r as any)._idx", "(r as CalcResult & { _idx: number })._idx")
write(p, c)
print('OK: ComparePanel')

# 3. WaterQualityInfo.tsx:110 — as any for setSortBy
p = 'components/report-tabs/WaterQualityInfo.tsx'
c = read(p)
c = c.replace(
    "onChange={(e) => setSortBy(e.target.value as any)}",
    "onChange={(e) => setSortBy(e.target.value as 'default' | 'pi-desc' | 'name')}"
)
write(p, c)
print('OK: WaterQualityInfo')

# 4. zoneClipEngine.ts:156 — turf.intersect(polygon as any, boundaryPoly as any)
p = 'lib/zoneClipEngine.ts'
c = read(p)
c = c.replace(
    "const intersection = turf.intersect(polygon as any, boundaryPoly as any);",
    "const intersection = turf.intersect(polygon as unknown as turf.Feature, boundaryPoly as unknown as turf.Feature);"
)
# 5. zoneClipEngine.ts:171 — turf.polygon(b as any)
c = c.replace(
    "turf.area(turf.polygon(b as any)) > turf.area(turf.polygon(a as any)) ? b : a,",
    "turf.area(turf.polygon(b as unknown as number[][])) > turf.area(turf.polygon(a as unknown as number[][])) ? b : a,"
)
write(p, c)
print('OK: zoneClipEngine')

# 6. zoneCompareEngine.ts:148-149 — (schemeA.params as any)[key]
p = 'lib/zoneCompareEngine.ts'
c = read(p)
c = c.replace(
    "const valA = (schemeA.params as any)[key];",
    "const valA = (schemeA.params as Record<string, unknown>)[key];"
)
c = c.replace(
    "const valB = (schemeB.params as any)[key];",
    "const valB = (schemeB.params as Record<string, unknown>)[key];"
)
write(p, c)
print('OK: zoneCompareEngine')

# 7. zoneGISExporter.ts:151 — (field as any).decimal
p = 'lib/zoneGISExporter.ts'
c = read(p)
# The fields array has { name, type, size, decimal } but the type doesn't include decimal
# Find the fields array definition and add a type annotation
c = c.replace(
    "  const fields = [",
    "  const fields: { name: string; type: string; size: number; decimal?: number }[] = ["
)
c = c.replace(
    "(field as any).decimal",
    "field.decimal"
)
write(p, c)
print('OK: zoneGISExporter')

# 8. zoneReportGenerator.ts:340 — .filter(Boolean) as any[]
p = 'lib/zoneReportGenerator.ts'
c = read(p)
# Find the pattern and replace with type-safe filter
c = c.replace(
    ".filter(Boolean) as any[];",
    ".filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);"
)
write(p, c)
print('OK: zoneReportGenerator')

# 9. MapView.tsx:26 — delete (L.Icon.Default.prototype as any)._getIconUrl
# This is a Leaflet type limitation, use Record<string, unknown>
p = 'pages/MapView.tsx'
c = read(p)
c = c.replace(
    "delete (L.Icon.Default.prototype as any)._getIconUrl;",
    "delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;"
)
write(p, c)
print('OK: MapView')

# 10. ProjectAnalysis.tsx:451 — .filter(Boolean) as any[]
p = 'pages/ProjectAnalysis.tsx'
c = read(p)
# Need to know the type being filtered - it's the result of analyzeBuffer targets
# Let's use a type-safe filter
c = c.replace(
    ".filter(Boolean) as any[];",
    ".filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);"
)
write(p, c)
print('OK: ProjectAnalysis')

# ══════════════════════════════════════
# S3.3: Layout.tsx 空 catch 修复
# ══════════════════════════════════════
p = 'components/layout/Layout.tsx'
c = read(p)
# First empty catch (dark mode read)
c = c.replace(
    "    } catch {\n      return false;\n    }",
    "    } catch (err) {\n      console.warn('Failed to read dark mode preference:', err);\n      return false;\n    }"
)
# Second empty catch (dark mode write) — already has a comment
c = c.replace(
    "    } catch {\n      /* localStorage may be unavailable */\n    }",
    "    } catch (err) {\n      console.warn('Failed to save dark mode preference:', err);\n    }"
)
write(p, c)
print('OK: Layout.tsx empty catch')

# ══════════════════════════════════════
# S4.1: 创建 EmptyState + LoadingSpinner 组件
# ══════════════════════════════════════
empty_state_code = """\
/**
 * S4.1: EmptyState — 统一空状态组件
 *
 * 替代各页面散落的条件渲染空状态
 */

import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-4xl mb-3 opacity-30">
        {icon ?? (
          <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-700 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-400 max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );
};

export default EmptyState;
"""

loading_spinner_code = """\
/**
 * S4.1: LoadingSpinner — 统一加载状态组件
 *
 * 替代各页面散落的 loading 条件渲染
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const SIZE_MAP = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <svg
        className={`${SIZE_MAP[size]} animate-spin text-blue-500`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && <p className="text-xs text-gray-400">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
"""

write('components/EmptyState.tsx', empty_state_code)
write('components/LoadingSpinner.tsx', loading_spinner_code)
print('OK: EmptyState + LoadingSpinner created')

# ══════════════════════════════════════
# S4.3: Home.tsx useNavigate → window.location.hash
# ══════════════════════════════════════
p = 'pages/Home.tsx'
c = read(p)
# Remove useNavigate import
c = c.replace(
    "import { useNavigate } from 'react-router-dom';\n",
    ""
)
# Remove hook usage
c = c.replace(
    "  const navigate = useNavigate();\n",
    ""
)
# Replace navigate() call with window.location.hash
c = c.replace(
    "navigate(`/report/${reportId}`);",
    "window.location.hash = `#/report/${reportId}`;"
)
write(p, c)
print('OK: Home.tsx useNavigate removed')

print('\n=== All S3/S4 fixes applied ===')
