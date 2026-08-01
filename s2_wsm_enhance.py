"""S2.1-S2.3: WaterSourceManager 行多选+排序+双击编辑"""
import os

BASE = r'F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\src'
p = os.path.join(BASE, 'pages', 'WaterSourceManager.tsx')

with open(p, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Replace filtered/pageData with sorted version
old_block = "  const totalPages = Math.ceil(filtered.length / pageSize);\n  const pageData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);"

new_block = """  // S2.2: 排序后的数据
  const sorted = React.useMemo(() => {
    if (!sortField) return filtered;
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'zh-CN') * dir;
    });
  }, [filtered, sortField, sortDirection]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // S2.2: 排序切换
  const handleSort = (field: keyof WaterSourceRecord) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIndicator = ({ field }: { field: keyof WaterSourceRecord }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-0.5">&#8597;</span>;
    return <span className="text-blue-500 ml-0.5">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  // S2.1: 选择操作
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pageData.length && pageData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageData.map((s) => s.id)));
    }
  };

  const isAllSelected = selectedIds.size === pageData.length && pageData.length > 0;

  // S2.1: 批量删除
  const handleBatchDelete = async () => {
    if (!await confirm({ message: `确定删除选中的 ${selectedIds.size} 条水源地记录？此操作不可恢复。`, danger: true })) return;
    for (const id of selectedIds) {
      await deleteSource(id);
    }
    toast.success(`已删除 ${selectedIds.size} 条记录`);
    setSelectedIds(new Set());
  };

  // S2.1: 批量导出Excel
  const handleBatchExportExcel = async () => {
    const selected = sources.filter((s) => selectedIds.has(s.id));
    const data = selected.map((s, i) => ({
      序号: i + 1,
      城市: s.cityName,
      水源地名称: s.name,
      级别: levelLabels[s.level] || s.level,
      水源类型: s.type,
      所在县区: s.county,
      使用状态: s.status,
      备注: s.remark || '',
    }));
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 35 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, '水源地');
    XLSX.writeFile(wb, `水源地数据_选中${selected.length}条_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // S2.1: 批量导出JSON
  const handleBatchExportJSON = () => {
    const selected = sources.filter((s) => selectedIds.has(s.id));
    const json = JSON.stringify(selected, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `水源地数据_选中${selected.length}条_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };"""

assert old_block in c, "old_block not found!"
c = c.replace(old_block, new_block)

# 2. Replace table header — add checkbox + sort click
old_thead = """            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-500">序号</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">城市</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">名称</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500">级别</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500">类型</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">县区</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500">状态</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">备注</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500">操作</th>
              </tr>
            </thead>"""

new_thead = """            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 cursor-pointer"
                    title="全选/取消全选"
                  />
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">序号</th>
                <th
                  className="px-3 py-2 text-left font-semibold text-gray-500 cursor-pointer hover:text-blue-500 select-none"
                  onClick={() => handleSort('cityName')}
                >
                  城市 <SortIndicator field="cityName" />
                </th>
                <th
                  className="px-3 py-2 text-left font-semibold text-gray-500 cursor-pointer hover:text-blue-500 select-none"
                  onClick={() => handleSort('name')}
                >
                  名称 <SortIndicator field="name" />
                </th>
                <th
                  className="px-3 py-2 text-center font-semibold text-gray-500 cursor-pointer hover:text-blue-500 select-none"
                  onClick={() => handleSort('level')}
                >
                  级别 <SortIndicator field="level" />
                </th>
                <th
                  className="px-3 py-2 text-center font-semibold text-gray-500 cursor-pointer hover:text-blue-500 select-none"
                  onClick={() => handleSort('type')}
                >
                  类型 <SortIndicator field="type" />
                </th>
                <th
                  className="px-3 py-2 text-left font-semibold text-gray-500 cursor-pointer hover:text-blue-500 select-none"
                  onClick={() => handleSort('county')}
                >
                  县区 <SortIndicator field="county" />
                </th>
                <th
                  className="px-3 py-2 text-center font-semibold text-gray-500 cursor-pointer hover:text-blue-500 select-none"
                  onClick={() => handleSort('status')}
                >
                  状态 <SortIndicator field="status" />
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">备注</th>
                <th className="px-3 py-2 text-center font-semibold text-gray-500">操作</th>
              </tr>
            </thead>"""

assert old_thead in c, "old_thead not found!"
c = c.replace(old_thead, new_thead)

# 3. Replace table row — add checkbox + double-click edit
old_row_start = """              {pageData.map((s, i) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 text-gray-400">
                    {(currentPage - 1) * pageSize + i + 1}
                  </td>"""

new_row_start = """              {pageData.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-t border-gray-100 hover:bg-gray-50 ${selectedIds.has(s.id) ? 'bg-blue-50/40' : ''}`}
                  onDoubleClick={() => handleEdit(s)}
                  title="双击行可编辑"
                >
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      className="w-3.5 h-3.5 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-gray-400">
                    {(currentPage - 1) * pageSize + i + 1}
                  </td>"""

assert old_row_start in c, "old_row_start not found!"
c = c.replace(old_row_start, new_row_start)

# 4. Add batch operation toolbar before the table
old_table_div = '      {/* 数据表格（桌面端） */}\n      <div className="hidden md:block rounded-lg overflow-hidden bg-white border border-gray-200">'

batch_bar = """      {/* S2.1: 批量操作工具栏 */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg p-3 bg-blue-50 border border-blue-200 flex items-center gap-3">
          <span className="text-xs font-medium text-blue-700">
            已选中 {selectedIds.size} 条记录
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchExportExcel}
              className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
            >
              批量导出Excel
            </button>
            <button
              onClick={handleBatchExportJSON}
              className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              批量导出JSON
            </button>
            <button
              onClick={handleBatchDelete}
              className="text-xs px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600"
            >
              批量删除
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
          >
            取消选择
          </button>
        </div>
      )}

      {/* 数据表格（桌面端） */}
      <div className="hidden md:block rounded-lg overflow-hidden bg-white border border-gray-200">"""

assert old_table_div in c, "old_table_div not found!"
c = c.replace(old_table_div, batch_bar)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)

print('OK: WaterSourceManager S2.1-S2.3 complete')
