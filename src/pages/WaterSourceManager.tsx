/**
 * 水源地数据管理页面
 *
 * 功能：
 * 1. 水源地列表（支持城市/级别/类型筛选）
 * 2. 新增/编辑/删除水源地
 * 3. 数据导入（Excel/CSV/JSON）
 * 4. 数据导出（Excel/CSV/JSON）
 * 5. 重置为静态默认数据
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useWaterSourceStore, WaterSourceRecord } from '@/stores/waterSourceStore';
import DataImportPanel from '@/components/DataImportPanel';
import DataSourceManager from '@/components/DataSourceManager';
import SourceFormModal from '@/components/SourceFormModal';
import type { ImportResult } from '@/lib/dataImportEngine';
import type { WaterSourceInfo } from '@/types';

const cityOrder = [
  '石家庄市',
  '唐山市',
  '秦皇岛市',
  '邯郸市',
  '邢台市',
  '保定市',
  '张家口市',
  '承德市',
  '沧州市',
  '廊坊市',
  '衡水市',
  '辛集市',
  '定州市',
];

const levelLabels: Record<string, string> = {
  municipal: '市级',
  county: '县级',
  township: '乡镇级',
};

const statusOptions = ['在用', '备用', '取消', '规划', '在建'];

const WaterSourceManager: React.FC = () => {
  const {
    loaded,
    initializing,
    sources,
    error,
    initDB,
    addSource,
    updateSource,
    deleteSource,
    getByCity,
    exportJSON,
    importJSON,
    resetToStatic,
    getStats,
  } = useWaterSourceStore();

  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [editingSource, setEditingSource] = useState<WaterSourceRecord | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [showDataSourceMgr, setShowDataSourceMgr] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editTarget, setEditTarget] = useState<WaterSourceRecord | null>(null);
  const pageSize = 30;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const jsonInputRef = React.useRef<HTMLInputElement>(null);

  // 初始化IDB
  useEffect(() => {
    initDB();
  }, []);

  // 统计
  const stats = getStats();

  // 过滤后的数据
  const filtered = useMemo(() => {
    let result = sources;
    if (filterCity !== 'all') result = result.filter((s) => s.cityName === filterCity);
    if (filterLevel !== 'all') result = result.filter((s) => s.level === filterLevel);
    if (filterType !== 'all') result = result.filter((s) => s.type === filterType);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.county.toLowerCase().includes(q) ||
          s.cityName.toLowerCase().includes(q) ||
          (s.remark || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [sources, filterCity, filterLevel, filterType, searchText]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 处理JSON导入
  const handleJSONImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importJSON(text, 'merge');
      alert(`成功导入 ${count} 条水源地记录`);
    } catch {
      alert('导入失败，请检查文件格式');
    }
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  // 处理Excel/CSV导入回调
  const handleDataImport = useCallback(
    async (data: WaterSourceInfo[], result: ImportResult) => {
      let imported = 0;
      for (const item of data) {
        // 自动推断城市和级别
        let cityName = '未知';
        let level: WaterSourceRecord['level'] = 'county';

        if (item.county) {
          // 尝试从县区反推城市
          const matched = cityOrder.find(
            (c) =>
              item.county?.includes(c.replace('市', '')) ||
              c.includes(item.county?.slice(0, 2) || ''),
          );
          if (matched) cityName = matched;
        }

        // 根据子类型推断级别
        if (item.subType === 'township') level = 'township';

        await addSource({
          cityName,
          level,
          name: item.name,
          type: item.type === '地表水' ? '地表水' : '地下水',
          county: item.county || '',
          status: item.status || '在用',
          remark: item.remark || '',
        });
        imported++;
      }
      setShowImportPanel(false);
      alert(`成功导入 ${imported} 条水源地记录（共 ${result.meta.parsedRows} 行解析成功）`);
    },
    [addSource],
  );

  // 处理导出JSON
  const handleExportJSON = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `水源地数据_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 处理导出Excel
  const handleExportExcel = () => {
    const data = sources.map((s, i) => ({
      序号: i + 1,
      城市: s.cityName,
      水源地名称: s.name,
      级别: levelLabels[s.level] || s.level,
      水源类型: s.type,
      所在县区: s.county,
      使用状态: s.status,
      备注: s.remark || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 }, // 序号
      { wch: 12 }, // 城市
      { wch: 35 }, // 名称
      { wch: 8 }, // 级别
      { wch: 10 }, // 类型
      { wch: 14 }, // 县区
      { wch: 10 }, // 状态
      { wch: 40 }, // 备注
    ];
    XLSX.utils.book_append_sheet(wb, ws, '水源地');
    XLSX.writeFile(wb, `水源地数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 处理导出CSV
  const handleExportCSV = () => {
    const headers = [
      '序号',
      '城市',
      '水源地名称',
      '级别',
      '水源类型',
      '所在县区',
      '使用状态',
      '备注',
    ];
    const rows = sources.map((s, i) => [
      i + 1,
      s.cityName,
      s.name,
      levelLabels[s.level] || s.level,
      s.type,
      s.county,
      s.status,
      s.remark || '',
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel UTF-8
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `水源地数据_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 处理重置
  const handleReset = async () => {
    if (!window.confirm('确定重置为默认数据？所有手动修改将丢失。')) return;
    await resetToStatic();
    setCurrentPage(1);
  };

  // 处理删除
  const handleDelete = async (source: WaterSourceRecord) => {
    if (!window.confirm(`确定删除"${source.name}"？`)) return;
    await deleteSource(source.id);
  };

  // 处理新增 — 打开模态框
  const handleAdd = () => {
    setEditTarget(null);
    setShowFormModal(true);
  };

  // 处理编辑 — 打开模态框（编辑模式）
  const handleEdit = (source: WaterSourceRecord) => {
    setEditTarget(source);
    setShowFormModal(true);
  };

  // 模态框提交
  const handleFormSubmit = async (
    data: Omit<WaterSourceRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    if (editTarget) {
      await updateSource(editTarget.id, data);
    } else {
      await addSource(data);
    }
  };

  // 处理编辑状态切换
  const handleStatusChange = async (source: WaterSourceRecord, newStatus: string) => {
    await updateSource(source.id, { status: newStatus });
  };

  if (!loaded) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">{initializing ? '正在初始化数据库...' : '数据加载中...'}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 导入面板 */}
      {showImportPanel && (
        <DataImportPanel
          onImport={handleDataImport}
          onClose={() => setShowImportPanel(false)}
          existingData={sources.map((s) => ({
            name: s.name,
            type: s.type as '地表水' | '地下水',
            county: s.county,
            status: s.status as
              | '在用'
              | '备用'
              | '取消'
              | '规划'
              | '热备用'
              | '在建'
              | '应急'
              | '停用'
              | '已取消'
              | '已撤销',
          }))}
        />
      )}

      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">水源地数据管理</h1>
          <p className="text-xs text-gray-500 mt-1">IndexedDB 动态数据，支持增删改查</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">共 {stats.total} 条记录</span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '水源地总数', value: stats.total, color: 'text-blue-800' },
          { label: '市级', value: stats.totalMunicipal, color: 'text-blue-600' },
          { label: '县级', value: stats.totalCounty, color: 'text-green-600' },
          { label: '乡镇级', value: stats.totalTownship, color: 'text-amber-600' },
        ].map((card) => (
          <div key={card.label} className="rounded-lg p-3 bg-white border border-gray-200">
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="rounded-lg p-3 bg-white border border-gray-200 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="搜索名称/县区/备注..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 flex-1 min-w-40 max-w-xs"
          />

          <select
            value={filterCity}
            onChange={(e) => {
              setFilterCity(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="all">全部城市</option>
            {cityOrder.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filterLevel}
            onChange={(e) => {
              setFilterLevel(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="all">全部级别</option>
            {Object.entries(levelLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setCurrentPage(1);
            }}
            className="text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="all">全部类型</option>
            <option value="地表水">地表水</option>
            <option value="地下水">地下水</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
          <button
            onClick={handleAdd}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            新增水源地
          </button>

          <button
            onClick={() => setShowImportPanel(true)}
            className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            导入Excel/CSV
          </button>

          <div className="relative group">
            <button className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50">
              导出 ▾
            </button>
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10 min-w-28">
              <button
                onClick={handleExportJSON}
                className="block w-full text-left text-xs px-3 py-2 hover:bg-gray-50"
              >
                导出 JSON
              </button>
              <button
                onClick={handleExportExcel}
                className="block w-full text-left text-xs px-3 py-2 hover:bg-gray-50"
              >
                导出 Excel
              </button>
              <button
                onClick={handleExportCSV}
                className="block w-full text-left text-xs px-3 py-2 hover:bg-gray-50"
              >
                导出 CSV
              </button>
            </div>
          </div>

          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            onChange={handleJSONImport}
            className="hidden"
          />
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
          >
            导入JSON
          </button>

          <button
            onClick={() => setShowDataSourceMgr(true)}
            className="text-xs px-3 py-1.5 rounded border border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            数据源管理
          </button>

          <button
            onClick={handleReset}
            className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 ml-auto"
          >
            重置为默认
          </button>
        </div>
      </div>

      {/* 数据源管理面板 */}
      {showDataSourceMgr && (
        <DataSourceManager onClose={() => setShowDataSourceMgr(false)} />
      )}

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {error}
        </div>
      )}

      {/* 结果统计 */}
      <div className="text-xs text-gray-500">
        筛选结果：{filtered.length} 条
        {filtered.length !== sources.length && ` / 共 ${sources.length} 条`}
      </div>

      {/* 数据表格 */}
      <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
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
            </thead>
            <tbody>
              {pageData.map((s, i) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 text-gray-400">
                    {(currentPage - 1) * pageSize + i + 1}
                  </td>
                  <td className="px-3 py-1.5 font-medium">{s.cityName}</td>
                  <td className="px-3 py-1.5 font-medium text-blue-800">{s.name}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        s.level === 'municipal'
                          ? 'bg-blue-100 text-blue-700'
                          : s.level === 'county'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {levelLabels[s.level] || s.level}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        s.type === '地表水'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-violet-100 text-violet-700'
                      }`}
                    >
                      {s.type}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{s.county}</td>
                  <td className="px-3 py-1.5 text-center">
                    <select
                      value={s.status}
                      onChange={(e) => handleStatusChange(s, e.target.value)}
                      className={`text-[10px] border rounded px-1 py-0.5 ${
                        s.status === '在用'
                          ? 'border-green-300 text-green-700'
                          : s.status === '备用'
                            ? 'border-amber-300 text-amber-700'
                            : s.status === '取消'
                              ? 'border-red-300 text-red-700'
                              : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 truncate max-w-32" title={s.remark}>
                    {s.remark || '-'}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button
                      onClick={() => handleEdit(s)}
                      className="text-blue-400 hover:text-blue-600 text-[10px] mr-2"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="text-red-400 hover:text-red-600 text-[10px]"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 text-xs">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
          >
            上一页
          </button>
          <span className="px-2 text-gray-500">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-2 py-1 rounded border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
          >
            下一页
          </button>
        </div>
      )}
      {/* 新增/编辑模态框 */}
      <SourceFormModal
        open={showFormModal}
        source={editTarget}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
};

export default WaterSourceManager;
