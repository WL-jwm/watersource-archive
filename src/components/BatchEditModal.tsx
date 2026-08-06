/* ===== S11.9: 批量编辑弹窗 =====
 * 字段选择 → 动态控件 → 预览 → 确认执行
 */

import React, { useState, useCallback } from 'react';
import { type WaterSourceRecord, useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import { logAudit } from '@/lib/auditTrail';
import {
  BATCH_EDITABLE_FIELDS, formatLevelValue,
} from '@/lib/batchEditEngine';

interface BatchEditModalProps {
  selectedIds: string[];
  onClose: () => void;
}

const BatchEditModal: React.FC<BatchEditModalProps> = ({ selectedIds, onClose }) => {
  const { sources, updateSource } = useWaterSourceStore();
  const toast = useToast();

  const [selectedField, setSelectedField] = useState<string>('');
  const [fieldValue, setFieldValue] = useState<string>('');
  const [applying, setApplying] = useState(false);

  const selectedRecords = sources.filter((s) => selectedIds.includes(s.id));

  const fieldConfig = BATCH_EDITABLE_FIELDS.find((f) => f.field === selectedField);

  const handleApply = useCallback(async () => {
    if (!selectedField || !fieldConfig) {
      toast.warning('请选择要编辑的字段');
      return;
    }

    let value: unknown = fieldValue;
    if (fieldConfig.type === 'number') {
      value = Number(fieldValue);
      if (isNaN(value as number)) {
        toast.warning('请输入有效的数字');
        return;
      }
    }

    const updates: Partial<WaterSourceRecord> = {
      [selectedField]: value,
    } as Partial<WaterSourceRecord>;

    setApplying(true);
    try {
      for (const id of selectedIds) {
        await updateSource(id, updates);
      }
      logAudit('update', 'water_source', `批量编辑: ${selectedIds.length}条记录的${fieldConfig.label}改为${fieldValue}`);
      toast.success(`已更新 ${selectedIds.length} 条记录的"${fieldConfig.label}"`);
      onClose();
    } catch (err) {
      toast.error(`批量编辑失败: ${(err as Error).message}`);
    } finally {
      setApplying(false);
    }
  }, [selectedField, fieldConfig, fieldValue, selectedIds, updateSource, toast, onClose]);

  // 渲染输入控件
  const renderInput = () => {
    if (!fieldConfig) return null;

    switch (fieldConfig.type) {
      case 'select':
        return (
          <select
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">— 请选择 —</option>
            {fieldConfig.options?.map((opt) => (
              <option key={opt} value={opt}>
                {fieldConfig.field === 'level' ? formatLevelValue(opt) : opt}
              </option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder="输入数值"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        );
      default:
        return (
          <input
            type="text"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder="输入文本"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[520px] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">批量编辑</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {/* 选中信息 */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-600">
            已选中 <strong>{selectedIds.length}</strong> 条水源地记录
          </div>

          {/* 字段选择 */}
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">选择编辑字段</label>
            <select
              value={selectedField}
              onChange={(e) => { setSelectedField(e.target.value); setFieldValue(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">— 请选择 —</option>
              {BATCH_EDITABLE_FIELDS.map((f) => (
                <option key={f.field} value={f.field}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* 值输入 */}
          {selectedField && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">新值</label>
              {renderInput()}
            </div>
          )}

          {/* 预览 */}
          {selectedField && fieldValue && selectedRecords.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-500 mb-2">预览（前 5 条）</div>
              <div className="space-y-1">
                {selectedRecords.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600 font-medium">{r.name}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-blue-600">
                      {fieldConfig?.field === 'level' ? formatLevelValue(fieldValue) : fieldValue}
                    </span>
                  </div>
                ))}
                {selectedRecords.length > 5 && (
                  <div className="text-xs text-gray-400">...还有 {selectedRecords.length - 5} 条</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">
            取消
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedField || !fieldValue || applying}
            className="px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? '应用中...' : `应用至 ${selectedIds.length} 条`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchEditModal;
