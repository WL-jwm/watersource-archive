"""修复 tsc 错误：turf 类型、zoneCompareEngine、S2 测试"""
import os

BASE = r'F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src'

def read(path):
    with open(os.path.join(BASE, path), 'r', encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(os.path.join(BASE, path), 'w', encoding='utf-8') as f:
        f.write(content)

# 1. zoneClipEngine — turf.Feature not exported
p = 'lib/zoneClipEngine.ts'
c = read(p)
c = c.replace(
    'const intersection = turf.intersect(polygon as unknown as turf.Feature, boundaryPoly as unknown as turf.Feature);',
    'const intersection = turf.intersect(polygon as unknown as Parameters<typeof turf.intersect>[0], boundaryPoly as unknown as Parameters<typeof turf.intersect>[1]);'
)
c = c.replace(
    'turf.area(turf.polygon(b as unknown as number[][])) > turf.area(turf.polygon(a as unknown as number[][])) ? b : a,',
    'turf.area(turf.polygon(b as unknown as turf.Position[][])) > turf.area(turf.polygon(a as unknown as turf.Position[][])) ? b : a,'
)
write(p, c)
print('OK: zoneClipEngine')

# 2. zoneCompareEngine — double assertion for CalcParams
p = 'lib/zoneCompareEngine.ts'
c = read(p)
c = c.replace(
    'const valA = (schemeA.params as Record<string, unknown>)[key];',
    'const valA = (schemeA.params as unknown as Record<string, unknown>)[key];'
)
c = c.replace(
    'const valB = (schemeB.params as Record<string, unknown>)[key];',
    'const valB = (schemeB.params as unknown as Record<string, unknown>)[key];'
)
write(p, c)
print('OK: zoneCompareEngine')

# 3. S2 test file — fix missing vi import, Element type
p = '__tests__/s2_tableEnhancement.test.tsx'
c = read(p)
c = c.replace(
    "import { describe, it, expect } from 'vitest';",
    "import { describe, it, expect, vi } from 'vitest';"
)
# Fix Element type — cast to HTMLInputElement
c = c.replace(
    "const radiusInput = Array.from(inputs).find(i => i.value === '50') as HTMLInputElement;",
    "const radiusInput = Array.from(inputs).find(i => (i as HTMLInputElement).value === '50') as HTMLInputElement;"
)
write(p, c)
print('OK: S2 test vi import + Element type')

# 4. Check CalcParams — remove 'population' from mock if not in interface
p = 'lib/zoneCalcEngine.ts'
c = read(p)
# Check what CalcParams actually has
idx = c.find('export interface CalcParams')
if idx >= 0:
    snippet = c[idx:idx+500]
    print('CalcParams interface:')
    print(snippet[:400])
