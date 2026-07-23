import re

filepath = r'F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src\lib\zoneClipEngine.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change clipZone return type and move polyGeom before try
content = content.replace(
    "  level: string,\n): ClipResult {\n  try {",
    "  level: string,\n): Omit<ClipResult, 'sourceName' | 'cityName'> {\n  const polyGeom = polygon.geometry as Polygon;\n  try {"
)

# 2. Remove the duplicate polyGeom inside if(intersection) block
content = content.replace(
    "      let clippedCoords: number[][][] = [];\n      const polyGeom = polygon.geometry as Polygon;\n      if (intersection.geometry.type === 'Polygon') {",
    "      let clippedCoords: number[][][] = [];\n      if (intersection.geometry.type === 'Polygon') {"
)

# 3. Fix clippedCoords type - coordinates[0] is Position[] not number[]
content = content.replace(
    "        clippedCoords = [intersection.geometry.coordinates[0]];",
    "        clippedCoords = [intersection.geometry.coordinates[0] as unknown as number[]];"
)

# 4. Fix maxPoly[0] type
content = content.replace(
    "        clippedCoords = [maxPoly[0]];\n      } else {\n        clippedCoords = polyGeom.coordinates;",
    "        clippedCoords = [maxPoly[0]] as number[][];\n      } else {\n        clippedCoords = polyGeom.coordinates as unknown as number[][][];"
)

# 5. Fix the "no intersection" return - polyGeom.coordinates type
content = content.replace(
    "      clippedCoordinates: polyGeom.coordinates,\n      level,\n      isClipped: true,",
    "      clippedCoordinates: polyGeom.coordinates as unknown as number[][][],\n      level,\n      isClipped: true,"
)

# 6. Fix catch block - remove duplicate polyGeom and fix type
content = content.replace(
    "  } catch (e) {\n    // Turf.js intersect可能因拓扑错误失败，回退到原始面积\n    const polyGeom = (polygon as Feature<Polygon>).geometry as Polygon;\n    return {\n      originalArea,\n      clippedArea: originalArea,\n      clipRatio: 1,\n      clippedCoordinates: polyGeom.coordinates,\n      level,\n      isClipped: false,",
    "  } catch {\n    // Turf.js intersect可能因拓扑错误失败，回退到原始面积\n    return {\n      originalArea,\n      clippedArea: originalArea,\n      clipRatio: 1,\n      clippedCoordinates: polyGeom.coordinates as unknown as number[][][],\n      level,\n      isClipped: false,"
)

# 7. Fix clipSourceZones spread order - spread first, then sourceName/cityName
content = content.replace(
    "    const clipRes = clipZone(polygon, boundary, zone.area, zone.level);\n    return {\n      sourceName: source.sourceName,\n      cityName,\n      ...clipRes,\n    };",
    "    const clipRes = clipZone(polygon, boundary, zone.area, zone.level);\n    return {\n      ...clipRes,\n      sourceName: source.sourceName,\n      cityName,\n    };"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("zoneClipEngine.ts fixed successfully")
