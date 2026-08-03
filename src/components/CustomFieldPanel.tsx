/* ===== S11.6: 自定义字段管理组件 =====
 * 字段列表 + 新增/编辑/删除 + 排序 + 统计
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import {
  getAllCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
  computeFieldStats,
  type CustomFieldDef,
  type CustomFieldType,
} from '@/lib/customFieldEngine';

interface CustomFieldPanelProps {
  onClose: () => void;
}

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: '文本',
  number: '数字',
  select: '下拉选择',
  date: '日期',
};

const FIELD_TYPE_COLORS: Record<CustomFieldType, string> = {
  text: 'bg-blue-100 text-blue-700',
  number: 'bg-green-100 text-green-700',
  select: 'bg-amber-100 text-amber-700',
  date: 'bg-violet-100 text-violet-700',
};

const CustomFieldPanel: React.FC<CustomFieldPanelProps> = ({ onClose }) => {
  const { sources } = useWaterSourceStore();
  const toast = useToast();

  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 表单状态
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [description, setDescription] = useState('');

  const loadDefs = useCallback(async () => {
    setLoading(true);
    const result = await getAllCustomFields();
    setDefs(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDefs();
  }, [loadDefs]);

  const stats = computeFieldStats(sources, defs);

  const resetForm = () => {
    setName('');
    setType('text');
    setOptions('');
    setRequired(false);
    setDefaultValue('');
    setDescription('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入字段名称');
      return;
    }

    const opts = {
      options: type === 'select' ? options.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
      required,
      defaultValue: defaultValue || undefined,
      description: description || undefined,
    };

    try {
      if (editingId) {
        await updateCustomField(editingId, { name: name.trim(), type, ...opts });
        toast.success('字段已更新');
      } else {
        await createCustomField(name.trim(), type, opts);
        toast.success('字段已创建');
      }
      resetForm();
      await loadDefs();
    } catch {
      toast.error('操作失败');
    }
  };

  const handleEdit = (def: CustomFieldDef) => {
    setEditingId(def.id);
    setName(def.name);
    setType(def.type);
    setOptions(def.options?.join('\n') || '');
    setRequired(def.required);
    setDefaultValue(def.defaultValue ? String(def.defaultValue) : '');
    setDescription(def.description || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此自定义字段？已填写的值将保留在记录中但不再显示。')) return;
    await deleteCustomField(id);
    toast.success('字段已删除');
    await loadDefs();
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const orderedIds = defs.map((d) => d.id);
    const idx = orderedIds.indexOf(id);
    if (direction === 'up' && idx > 0) {
      [orderedIds[idx], orderedIds[idx - 1]] = [orderedIds[idx - 1], orderedIds[idx]];
    } else if (direction === 'down' && idx < orderedIds.length - 1) {
      [orderedIds[idx], orderedIds[idx + 1]] = [orderedIds[idx + 1], orderedIds[idx]];
    }
    await reorderCustomFields(orderedIds);
    await loadDefs();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">自定义字段管理</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : defs.length === 0 && !showForm ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">暂无自定义字段</p>
              <p className="text-sm text-gray-400">自定义字段允许您为水源地记录扩展额外信息，如联系人、电话、管径等</p>
            </div>
          ) : (
            <div className="space-y-3">
              {defs.map((def, idx) => {
                const stat = stats.find((s) => s.def.id === def.id);
                return (
                  <div key={def.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-800">{def.name}</span>
                          {def.required && <span className="text-red-500 text-xs">*必填</span>}
                          <span className={`text-xs px-2 py-0.5 rounded ${FIELD_TYPE_COLORS[def.type]}`}>
                            {FIELD_TYPE_LABELS[def.type]}
                          </span>
                          {def.options && def.options.length > 0 && (
                            <span className="text-xs text-gray-400">{def.options.length} 个选项</span>
                          )}
                        </div>
                        {def.description && (
                          <p className="text-sm text-gray-500">{def.description}</p>
                        )}
                        {stat && (
                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                            <span>已填写: {stat.filledCount}/{sources.length}</span>
                            <div className="flex-1 max-w-[120px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-400 rounded-full transition-all"
                                style={{ width: `${stat.fillRate * 100}%` }}
                              />
                            </div>
                            <span>{(stat.fillRate * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleMove(def.id, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="上移"
                        >↑</button>
                        <button
                          onClick={() => handleMove(def.id, 'down')}
                          disabled={idx === defs.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          title="下移"
                        >↓</button>
                        <button
                          onClick={() => handleEdit(def)}
                          className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                        >编辑</button>
                        <button
                          onClick={() => handleDelete(def.id)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >删除</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 表单 */}
          {showForm && (
            <div className="mt-4 border-2 border-blue-200 rounded-lg p-4 bg-blue-50/30">
              <h3 className="font-medium text-gray-700 mb-3">{editingId ? '编辑字段' : '新增字段'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">字段名称 *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="如：联系人电话"
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">字段类型</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CustomFieldType)}
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="text">文本</option>
                    <option value="number">数字</option>
                    <option value="select">下拉选择</option>
                    <option value="date">日期</option>
                  </select>
                </div>
                {type === 'select' && (
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">选项（每行一个）</label>
                    <textarea
                      value={options}
                      onChange={(e) => setOptions(e.target.value)}
                      placeholder={'选项A\n选项B\n选项C'}
                      rows={4}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">默认值</label>
                    <input
                      value={defaultValue}
                      onChange={(e) => setDefaultValue(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={required}
                        onChange={(e) => setRequired(e.target.checked)}
                        className="rounded"
                      />
                      必填字段
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">描述说明</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="可选"
                    className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  >取消</button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
                  >{editingId ? '保存' : '创建'}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t flex justify-between items-center">
          <span className="text-sm text-gray-400">共 {defs.length} 个自定义字段</span>
          <div className="flex gap-2">
            {!showForm && (
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
              >新增字段</button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomFieldPanel;
