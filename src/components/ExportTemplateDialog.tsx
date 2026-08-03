/* ===== S11.10: 导出模板对话框 =====
 * 模板管理 + 列选择 + 筛选 + 预览 + 导出
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import {
  getAllExportTemplates,
  createExportTemplate,
  updateExportTemplate,
  deleteExportTemplate,
  executeExport,
  applyFilters,
  createPresetTemplate,
  DEFAULT_EXPORT_COLUMNS,
  type ExportTemplate,
  type ExportColumn,
  type ExportFilter,
} from '@/lib/exportTemplateEngine';
import { getAllCustomFields } from '@/lib/customFieldEngine';

interface ExportTemplateDialogProps {
  onClose: () => void;
}

type Step = 'list' | 'edit' | 'preview';

const OPERATOR_LABELS: Record<ExportFilter['operator'], string> = {
  eq: '等于',
  neq: '不等于',
  contains: '包含',
  in: '属于',
  notNull: '非空',
};

const ExportTemplateDialog: React.FC<ExportTemplateDialogProps> = ({ onClose }) => {
  const { sources } = useWaterSourceStore();
  const toast = useToast();

  const [step, setStep] = useState<Step>('list');
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 编辑状态
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS.map(c => ({ ...c })));
  const [filters, setFilters] = useState<ExportFilter[]>([]);
  const [includeCustomFields, setIncludeCustomFields] = useState(false);
  const [customFieldNames, setCustomFieldNames] = useState<{ key: string; name: string }[]>([]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const result = await getAllExportTemplates();
    setTemplates(result);
    setLoading(false);
  }, []);

  const loadCustomFields = useCallback(async () => {
    const defs = await getAllCustomFields();
    setCustomFieldNames(defs.map(d => ({ key: d.key, name: d.name })));
  }, []);

  useEffect(() => {
    loadTemplates();
    loadCustomFields();
  }, [loadTemplates, loadCustomFields]);

  const resetEdit = () => {
    setName('');
    setDescription('');
    setColumns(DEFAULT_EXPORT_COLUMNS.map(c => ({ ...c })));
    setFilters([]);
    setIncludeCustomFields(false);
    setEditingId(null);
  };

  const startNewTemplate = () => {
    resetEdit();
    setStep('edit');
  };

  const handleEditTemplate = (tpl: ExportTemplate) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setDescription(tpl.description || '');
    setColumns(tpl.columns.map(c => ({ ...c })));
    setFilters(tpl.filters.map(f => ({ ...f })));
    setIncludeCustomFields(tpl.includeCustomFields);
    setStep('edit');
  };

  const handlePreset = (preset: 'full' | 'basic' | 'contact') => {
    const p = createPresetTemplate(preset);
    setName(p.name);
    setDescription(p.description);
    setColumns(p.columns);
    setFilters(p.filters);
    setIncludeCustomFields(p.includeCustomFields);
    setEditingId(null);
  };

  const handleToggleColumn = (idx: number) => {
    setColumns(prev => prev.map((c, i) => i === idx ? { ...c, included: !c.included } : c));
  };

  const handleColumnLabelChange = (idx: number, label: string) => {
    setColumns(prev => prev.map((c, i) => i === idx ? { ...c, label } : c));
  };

  const handleAddFilter = () => {
    setFilters(prev => [...prev, { field: 'cityName', operator: 'eq', value: '' }]);
  };

  const handleUpdateFilter = (idx: number, updates: Partial<ExportFilter>) => {
    setFilters(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const handleRemoveFilter = (idx: number) => {
    setFilters(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入模板名称');
      return;
    }
    const includedCount = columns.filter(c => c.included).length;
    if (includedCount === 0) {
      toast.error('至少选择一列');
      return;
    }

    try {
      if (editingId) {
        await updateExportTemplate(editingId, {
          name: name.trim(),
          description,
          columns,
          filters,
          includeCustomFields,
        });
        toast.success('模板已更新');
      } else {
        await createExportTemplate(name.trim(), columns, filters, includeCustomFields, description);
        toast.success('模板已创建');
      }
      resetEdit();
      await loadTemplates();
      setStep('list');
    } catch {
      toast.error('保存失败');
    }
  };

  const handleExport = (tpl: ExportTemplate) => {
    try {
      const result = executeExport({
        template: tpl,
        sources,
        customFieldDefs: includeCustomFields ? customFieldNames : undefined,
      });
      toast.success(`已导出 ${result.rowCount} 条记录`);
    } catch {
      toast.error('导出失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此导出模板？')) return;
    await deleteExportTemplate(id);
    toast.success('模板已删除');
    await loadTemplates();
  };

  const previewData = applyFilters(sources, filters);
  const includedCols = columns.filter(c => c.included);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-800">
              {step === 'list' ? '导出模板' : step === 'edit' ? (editingId ? '编辑模板' : '新建模板') : '预览'}
            </h2>
            {step !== 'list' && (
              <div className="flex items-center gap-1 text-xs">
                <span className={`px-2 py-0.5 rounded ${step === 'edit' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>1. 配置</span>
                <span className="text-gray-300">→</span>
                <span className={`px-2 py-0.5 rounded ${step === 'preview' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>2. 预览</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ===== 模板列表 ===== */}
          {step === 'list' && (
            <div>
              {/* 预设模板 */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-600 mb-2">快速预设</h3>
                <div className="flex gap-2">
                  <button onClick={() => handlePreset('full')} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">完整导出</button>
                  <button onClick={() => handlePreset('basic')} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">基础信息</button>
                  <button onClick={() => handlePreset('contact')} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">联络清单</button>
                </div>
              </div>

              {/* 已保存模板 */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">已保存模板</h3>
                <button onClick={startNewTemplate} className="text-xs px-2 py-1 text-blue-600 border border-blue-300 rounded hover:bg-blue-50">+ 新建模板</button>
              </div>
              {loading ? (
                <div className="text-center py-8 text-gray-400">加载中...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>暂无已保存模板</p>
                  <p className="text-xs mt-1">点击"新建模板"或使用上方预设开始</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(tpl => (
                    <div key={tpl.id} className="border rounded-lg p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{tpl.name}</span>
                            <span className="text-xs text-gray-400">{tpl.columns.filter(c => c.included).length} 列</span>
                            {tpl.filters.length > 0 && <span className="text-xs text-amber-600">{tpl.filters.length} 个筛选</span>}
                            {tpl.includeCustomFields && <span className="text-xs text-violet-600">含自定义字段</span>}
                          </div>
                          {tpl.description && <p className="text-sm text-gray-500 mt-0.5">{tpl.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleExport(tpl)} className="px-3 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded">导出</button>
                          <button onClick={() => handleEditTemplate(tpl)} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">编辑</button>
                          <button onClick={() => handleDelete(tpl.id)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">删除</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 直接导出按钮 */}
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => handleExport({
                    id: 'temp', name: '当前配置', columns, filters, includeCustomFields,
                    createdAt: '', updatedAt: '',
                  })}
                  className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded"
                >用当前配置直接导出 ({sources.length} 条)</button>
              </div>
            </div>
          )}

          {/* ===== 编辑模板 ===== */}
          {step === 'edit' && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">模板名称 *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="如：在用水源地清单"
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">描述</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选"
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>

              {/* 列选择 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-600">导出列 ({includedCols.length}/{columns.length})</label>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setColumns(prev => prev.map(c => ({ ...c, included: true })))} className="text-blue-600 hover:underline">全选</button>
                    <button onClick={() => setColumns(prev => prev.map(c => ({ ...c, included: false })))} className="text-blue-600 hover:underline">全不选</button>
                  </div>
                </div>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {columns.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 hover:bg-gray-50">
                      <input type="checkbox" checked={col.included} onChange={() => handleToggleColumn(idx)} className="rounded" />
                      <input
                        value={col.label}
                        onChange={e => handleColumnLabelChange(idx, e.target.value)}
                        className="flex-1 text-sm border-b border-transparent focus:border-blue-300 focus:outline-none bg-transparent"
                      />
                      <span className="text-xs text-gray-400">{col.field}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 自定义字段 */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={includeCustomFields} onChange={e => setIncludeCustomFields(e.target.checked)} className="rounded" />
                  包含自定义字段 ({customFieldNames.length} 个)
                </label>
              </div>

              {/* 筛选条件 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-600">筛选条件 ({filters.length})</label>
                  <button onClick={handleAddFilter} className="text-xs text-blue-600 hover:underline">+ 添加条件</button>
                </div>
                {filters.length === 0 ? (
                  <p className="text-sm text-gray-400">无筛选条件，将导出全部数据</p>
                ) : (
                  <div className="space-y-2">
                    {filters.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={f.field}
                          onChange={e => handleUpdateFilter(idx, { field: e.target.value as ExportFilter['field'] })}
                          className="px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="cityName">城市</option>
                          <option value="level">级别</option>
                          <option value="type">水源类型</option>
                          <option value="county">县区</option>
                          <option value="status">状态</option>
                          <option value="river">河流</option>
                        </select>
                        <select
                          value={f.operator}
                          onChange={e => handleUpdateFilter(idx, { operator: e.target.value as ExportFilter['operator'] })}
                          className="px-2 py-1.5 border rounded text-sm"
                        >
                          {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        {f.operator !== 'notNull' && (
                          <input
                            value={f.value || ''}
                            onChange={e => handleUpdateFilter(idx, { value: e.target.value })}
                            placeholder="值"
                            className="flex-1 px-2 py-1.5 border rounded text-sm"
                          />
                        )}
                        <button onClick={() => handleRemoveFilter(idx)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 预览按钮 */}
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep('preview')} className="px-4 py-2 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50">
                  预览数据
                </button>
              </div>
            </div>
          )}

          {/* ===== 预览 ===== */}
          {step === 'preview' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  筛选后: <span className="font-medium text-gray-800">{previewData.length}</span> / {sources.length} 条
                </span>
                <button onClick={() => setStep('edit')} className="text-sm text-blue-600 hover:underline">← 返回编辑</button>
              </div>
              <div className="border rounded-lg overflow-x-auto max-h-96">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {includedCols.map((col, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 20).map((src, i) => (
                      <tr key={i} className="border-t">
                        {includedCols.map((col, j) => {
                          const val = src[col.field as keyof typeof src];
                          const str = Array.isArray(val) ? val.join(', ') : val !== undefined ? String(val) : '';
                          return <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{str}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewData.length > 20 && (
                <p className="text-xs text-gray-400 mt-2 text-center">仅显示前 20 条，共 {previewData.length} 条</p>
              )}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t flex justify-between items-center">
          <span className="text-sm text-gray-400">数据源: {sources.length} 条记录</span>
          <div className="flex gap-2">
            {step === 'edit' && (
              <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded">
                {editingId ? '保存模板' : '创建模板'}
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={() => {
                  const tpl: ExportTemplate = {
                    id: editingId || 'temp', name: name || '临时模板', description,
                    columns, filters, includeCustomFields, createdAt: '', updatedAt: '',
                  };
                  handleExport(tpl);
                }}
                className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded"
              >导出 Excel</button>
            )}
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportTemplateDialog;
