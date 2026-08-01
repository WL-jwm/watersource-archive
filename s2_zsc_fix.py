"""S2.5 fix: 插入 handleExportComparison 函数"""
import os

p = os.path.join(
    r'F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src',
    'components', 'protection-zone', 'ZoneSchemeCompare.tsx'
)

with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

old = "  const toast = useToast();\n  const handleCompare = () => {"

new_code = """  const toast = useToast();

  // S2.5: 导出对比结果为Excel
  const handleExportComparison = async () => {
    if (!result) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Sheet1: 逐级面积对比
    const areaData = result.items.map(item => ({
      '保护区级别': item.level,
      '方案A面积(km\u00b2)': parseFloat(item.areaA.toFixed(4)),
      '方案B面积(km\u00b2)': parseFloat(item.areaB.toFixed(4)),
      '面积变化量(km\u00b2)': parseFloat(item.areaChange.toFixed(4)),
      '面积变化率(%)': parseFloat(item.areaChangeRate.toFixed(1)),
      '变化方向': item.direction,
      '半径A(m)': item.radiusA ?? '',
      '半径B(m)': item.radiusB ?? '',
      '半径变化(m)': item.radiusChange ?? '',
      '调整说明': item.adjustmentText,
    }));
    const ws1 = XLSX.utils.json_to_sheet(areaData);
    ws1['!cols'] = [
      { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, '逐级面积对比');

    // Sheet2: 参数变化对比
    if (result.paramChanges.length > 0) {
      const paramData = result.paramChanges.map(p => ({
        '参数名称': p.param,
        '方案A': p.valueA,
        '方案B': p.valueB,
        '是否变更': p.changed ? '是' : '否',
      }));
      const ws2 = XLSX.utils.json_to_sheet(paramData);
      ws2['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws2, '参数变化对比');
    }

    // Sheet3: 方案信息与总体说明
    const summaryData = [
      { 项目: '水源地名称', 内容: result.sourceName },
      { 项目: '方案A', 内容: result.schemeALabel },
      { 项目: '方案B', 内容: result.schemeBLabel },
      { 项目: '方案A方法', 内容: result.methodA },
      { 项目: '方案B方法', 内容: result.methodB },
      { 项目: '是否有重大变化', 内容: result.hasSignificantChange ? '是（面积变化>20%）' : '否' },
      { 项目: '总体调整说明', 内容: result.overallAdjustment },
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    ws3['!cols'] = [{ wch: 16 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws3, '方案信息与总体说明');

    XLSX.writeFile(wb, `保护区方案对比_${result.sourceName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('对比结果已导出为Excel');
  };

  const handleCompare = () => {"""

assert old in c, "old NOT found!"
c = c.replace(old, new_code)
with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('OK: export function inserted')
