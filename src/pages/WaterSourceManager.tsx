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

import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import React, { useEffect, useState, useCallback } from 'react';
// F3: XLSX 改为动态导入，减小首屏体积(426KB)
import { WaterSourceRecord, useWaterSourceStore } from '@/stores/waterSourceStore';
import DataImportPanel from '@/components/DataImportPanel';
import DataSourceManager from '@/components/DataSourceManager';
import SourceFormModal from '@/components/SourceFormModal';
import CodeValidationPanel from '@/components/CodeValidationPanel';
import CryptoExportModal from '@/components/CryptoExportModal';
import BatchEditModal from '@/components/BatchEditModal';
import TagManager from '@/components/TagManager';
import SyncPanel from '@/components/SyncPanel';
import CustomFieldPanel from '@/components/CustomFieldPanel';
import ExportTemplateDialog from '@/components/ExportTemplateDialog';
import BackupPanel from '@/components/BackupPanel';
import AdvancedSearchPanel, { HighlightedText } from '@/components/AdvancedSearchPanel';
import { useSearchFilter } from '@/hooks/useSearchFilter';
import type { ImportResult } from '@/lib/dataImportEngine';
import type { WaterSourceInfo } from '@/types';
import { MobileCardList } from '@/lib/mobileEnhanced';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
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

  // 高级搜索筛选
  const searchFilter = useSearchFilter(sources);
  const [editingSource, setEditingSource] = useState<WaterSourceRecord | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [showDataSourceMgr, setShowDataSourceMgr] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editTarget, setEditTarget] = useState<WaterSourceRecord | null>(null);
  const [showCodeValidation, setShowCodeValidation] = useState(false);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  // S2.1: 行多选
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // S11: 批量编辑/标签/同步弹窗
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [tagMgrOpen, setTagMgrOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [customFieldOpen, setCustomFieldOpen] = useState(false);
  const [exportTplOpen, setExportTplOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  // S2.2: 排序
  const [sortField, setSortField] = useState<keyof WaterSourceRecord | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const pageSize = 30;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const jsonInputRef = React.useRef<HTMLInputElement>(null);

  // 初始化IDB
  useEffect(() => {
    initDB();
  }, []);

  // 统计
  const stats = getStats();

  // 过滤后的数据（来自高级搜索引擎）
  const filtered = searchFilter.filterResult.records;
  const matchMap = searchFilter.filterResult.matches;

  // 筛选结果变化时重置分页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter.filterResult.stats.filtered]);

  // S2.2: 排序后的数据
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
    return <span className="text-blue-500 ml-0.5">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
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
  };

  // 处理JSON导入
  const handleJSONImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importJSON(text, 'merge');
      toast.success(`成功导入 ${count} 条水源地记录`);
    } catch {
      toast.error('导入失败，请检查文件格式');
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
      toast.success(`成功导入 ${imported} 条水源地记录（共 ${result.meta.parsedRows} 行解析成功）`);
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
  const handleExportExcel = async () => {
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

    const XLSX = await import('xlsx');
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
    if (!await confirm({ message: '确定重置为默认数据？所有手动修改将丢失。', danger: true })) return;
    await resetToStatic();
    setCurrentPage(1);
  };

  // 处理删除
  const handleDelete = async (source: WaterSourceRecord) => {
    if (!await confirm({ message: `确定删除"${source.name}"？`, danger: true })) return;
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

      {/* 高级搜索筛选面板 */}
      <AdvancedSearchPanel search={searchFilter} />

      {/* 操作工具栏 */}
      <div className="rounded-lg p-3 bg-white border border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => handleExportExcel()}
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
            onClick={() => setShowCodeValidation(true)}
            className="text-xs px-3 py-1.5 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            编码校验
          </button>

          <button
            onClick={() => setShowCryptoModal(true)}
            className="text-xs px-3 py-1.5 rounded border border-teal-200 text-teal-600 hover:bg-teal-50"
          >
            加密导出
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

      {/* T5: 移动端卡片列表 */}
      <MobileCardList
        items={(pageData as WaterSourceRecord[]).map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: `${s.cityName || ""} · ${s.type || ""} · ${s.county || ""}`,
          badges: [
            { text: s.level || "", color: "bg-blue-100 text-blue-600" },
            ...(s.type === "地下水" ? [{ text: "地下水", color: "bg-cyan-100 text-cyan-600" }] : []),
          ],
        }))}
      />

      {/* S11.4/S11.6/S11.10: 工具栏入口 */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setCustomFieldOpen(true)}
          className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          自定义字段
        </button>
        <button
          onClick={() => setExportTplOpen(true)}
          className="text-xs px-3 py-1 rounded bg-teal-600 text-white hover:bg-teal-700"
        >
          导出模板
        </button>
        <button
          onClick={() => setSyncOpen(true)}
          className="text-xs px-3 py-1 rounded bg-cyan-600 text-white hover:bg-cyan-700"
        >
          数据同步
        </button>
        <button
          onClick={() => setBackupOpen(true)}
          className="text-xs px-3 py-1 rounded bg-orange-600 text-white hover:bg-orange-700"
        >
          定时备份
        </button>
      </div>
      {/* S2.1: 批量操作工具栏 */}
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
            <button
              onClick={() => setBatchEditOpen(true)}
              className="text-xs px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
            >
              批量编辑
            </button>
            <button
              onClick={() => setTagMgrOpen(true)}
              className="text-xs px-3 py-1 rounded bg-violet-500 text-white hover:bg-violet-600"
            >
              标签管理
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
      <div className="hidden md:block rounded-lg overflow-hidden bg-white border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
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
            </thead>
            <tbody>
              {pageData.map((s, i) => (
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
                  </td>
                  <td className="px-3 py-1.5 font-medium">{s.cityName}</td>
                  <td className="px-3 py-1.5 font-medium text-blue-800">
                    <HighlightedText text={s.name} match={matchMap.get(s.id)?.find((m) => m.field === 'name')} />
                  </td>
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
                    {s.lng != null && s.lat != null && (
                      <button
                        onClick={() =>
                          navigate(`/map?focus=${encodeURIComponent(s.name)}`)
                        }
                        className="text-emerald-500 hover:text-emerald-700 text-[10px] mr-2"
                        title="在 GIS 地图中定位查看"
                      >
                        地图
                      </button>
                    )}
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
        allSources={sources}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
      />
      <CodeValidationPanel
        open={showCodeValidation}
        sources={sources}
        onClose={() => setShowCodeValidation(false)}
      />
      {batchEditOpen && (
        <BatchEditModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setBatchEditOpen(false)}
        />
      )}
      {tagMgrOpen && (
        <TagManager
          selectedIds={Array.from(selectedIds)}
          onClose={() => setTagMgrOpen(false)}
        />
      )}
      {syncOpen && (
        <SyncPanel onClose={() => setSyncOpen(false)} />
      )}
      {customFieldOpen && (
        <CustomFieldPanel onClose={() => setCustomFieldOpen(false)} />
      )}
      {exportTplOpen && (
        <ExportTemplateDialog onClose={() => setExportTplOpen(false)} />
      )}
      {backupOpen && (
        <BackupPanel onClose={() => setBackupOpen(false)} />
      )}
      <CryptoExportModal
        open={showCryptoModal}
        onClose={() => setShowCryptoModal(false)}
      />
    </div>
  );
};

export default WaterSourceManager;
