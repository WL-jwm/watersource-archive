/* ===== 数据导入预览面板 =====
 * 支持拖拽/选择文件上传
 * 表格预览 + 校验结果高亮
 * 逐行确认/修改
 */

import React, { useState, useCallback, useRef } from 'react';
import { importFromFile, importFromText } from '@/lib/dataImportEngine';
import type { ImportResult, ImportWarning } from '@/lib/dataImportEngine';
import { validateWaterSources } from '@/lib/dataValidator';
import type { ValidationResult } from '@/lib/dataValidator';
import type { WaterSourceInfo } from '@/types';

interface DataImportPanelProps {
  /** 导入成功回调 */
  onImport: (data: WaterSourceInfo[], result: ImportResult) => void;
  /** 关闭面板 */
  onClose: () => void;
  /** 已有数据（用于重复检测） */
  existingData?: WaterSourceInfo[];
}

type ImportStep = 'upload' | 'preview' | 'complete';

const DataImportPanel: React.FC<DataImportPanelProps> = ({ onImport, onClose, existingData }) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<WaterSourceInfo>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 处理文件选择 */
  const handleFile = useCallback(async (file: File) => {
    setImporting(true);
    setError(null);
    try {
      const result = await importFromFile(file);
      setImportResult(result);

      if (result.data.length > 0) {
        const validation = validateWaterSources(result.data);
        setValidationResult(validation);
        // 默认全选
        setSelectedRows(new Set(result.data.map((_, i) => i)));
      }
      setStep('preview');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  /** 切换行选中 */
  const toggleRow = (idx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  /** 开始编辑行 */
  const startEdit = (item: WaterSourceInfo, idx: number) => {
    setEditingRow(idx);
    setEditValues({ ...item });
  };

  /** 保存编辑 */
  const saveEdit = (idx: number) => {
    if (!importResult) return;
    const newData = [...importResult.data];
    newData[idx] = { ...newData[idx], ...editValues } as WaterSourceInfo;
    setImportResult({ ...importResult, data: newData });
    const validation = validateWaterSources(newData);
    setValidationResult(validation);
    setEditingRow(null);
    setEditValues({});
  };

  /** 确认导入 */
  const confirmImport = () => {
    if (!importResult) return;
    const selected = importResult.data.filter((_, i) => selectedRows.has(i));
    onImport(selected, importResult);
    setStep('complete');
  };

  /** 获取校验信息 */
  const getValidationInfo = (idx: number): { level?: string; messages: string[] } => {
    if (!validationResult) return { messages: [] };
    const item = validationResult.items.filter(
      (i) =>
        importResult?.data.indexOf(importResult.data[idx]) !== -1 &&
        importResult?.data.indexOf(importResult.data[idx]) === idx,
    );
    // 按行号匹配
    const rowItems = validationResult.items.filter((i) => {
      const dataItem = importResult?.data[idx];
      return dataItem && i.name === dataItem.name;
    });
    const errors = rowItems.filter((i) => i.level === 'error');
    const warns = rowItems.filter((i) => i.level === 'warning');
    const msgs = [...errors, ...warns].map((i) => i.message);
    if (errors.length > 0) return { level: 'error', messages: msgs };
    if (warns.length > 0) return { level: 'warning', messages: msgs };
    return { messages: [] };
  };

  // ===== 渲染 =====

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">导入水源地数据</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="text-4xl mb-3 text-gray-300">{dragOver ? '📂' : '📄'}</div>
              <p className="text-gray-600 font-medium mb-1">
                {dragOver ? '松开以上传文件' : '拖拽文件到此处，或点击选择'}
              </p>
              <p className="text-gray-400 text-sm">支持 .xlsx、.xls、.csv 格式</p>
              {importing && <p className="text-blue-500 mt-3">解析中...</p>}
              {error && <p className="text-red-500 mt-3">{error}</p>}
            </div>
          )}

          {step === 'preview' && importResult && (
            <div className="space-y-4">
              {/* 导入摘要 */}
              <div className="flex gap-3 text-sm">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                  共 {importResult.meta.totalRows - 1} 行
                </span>
                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">
                  解析成功 {importResult.meta.parsedRows} 行
                </span>
                {importResult.meta.skippedRows > 0 && (
                  <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full">
                    跳过 {importResult.meta.skippedRows} 行
                  </span>
                )}
                {importResult.meta.unmappedColumns.length > 0 && (
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full">
                    未识别列 {importResult.meta.unmappedColumns.length} 个
                  </span>
                )}
              </div>

              {/* 校验摘要 */}
              {validationResult && (
                <div className="flex gap-3 text-sm">
                  {validationResult.summary.errors > 0 && (
                    <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full">
                      错误 {validationResult.summary.errors} 项
                    </span>
                  )}
                  {validationResult.summary.warnings > 0 && (
                    <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full">
                      警告 {validationResult.summary.warnings} 项
                    </span>
                  )}
                  {validationResult.valid && (
                    <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">
                      数据校验通过
                    </span>
                  )}
                </div>
              )}

              {/* 数据表格 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === importResult.data.length}
                          onChange={() => {
                            if (selectedRows.size === importResult.data.length) {
                              setSelectedRows(new Set());
                            } else {
                              setSelectedRows(new Set(importResult.data.map((_, i) => i)));
                            }
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">水源地名称</th>
                      <th className="px-3 py-2 text-left">水源类型</th>
                      <th className="px-3 py-2 text-left">所在县区</th>
                      <th className="px-3 py-2 text-left">使用状态</th>
                      <th className="px-3 py-2 text-left">备注</th>
                      <th className="w-16 px-3 py-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.data.map((item, idx) => {
                      const info = getValidationInfo(idx);
                      const rowClass =
                        info.level === 'error'
                          ? 'bg-red-50'
                          : info.level === 'warning'
                            ? 'bg-yellow-50'
                            : idx % 2 === 0
                              ? 'bg-white'
                              : 'bg-gray-50/50';

                      return (
                        <tr key={idx} className={rowClass + ' border-t border-gray-100'}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(idx)}
                              onChange={() => toggleRow(idx)}
                            />
                          </td>
                          {editingRow === idx ? (
                            <>
                              <td className="px-3 py-1">
                                <input
                                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                  value={editValues.name || ''}
                                  onChange={(e) =>
                                    setEditValues((v) => ({ ...v, name: e.target.value }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-1">
                                <select
                                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                  value={editValues.type || '地下水'}
                                  onChange={(e) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      type: e.target.value as '地表水' | '地下水',
                                    }))
                                  }
                                >
                                  <option value="地下水">地下水</option>
                                  <option value="地表水">地表水</option>
                                </select>
                              </td>
                              <td className="px-3 py-1">
                                <input
                                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                  value={editValues.county || ''}
                                  onChange={(e) =>
                                    setEditValues((v) => ({ ...v, county: e.target.value }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-1">
                                <select
                                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                  value={editValues.status || '在用'}
                                  onChange={(e) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      status: e.target.value as WaterSourceInfo['status'],
                                    }))
                                  }
                                >
                                  <option value="在用">在用</option>
                                  <option value="备用">备用</option>
                                  <option value="取消">取消</option>
                                  <option value="规划">规划</option>
                                </select>
                              </td>
                              <td className="px-3 py-1">
                                <input
                                  className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                  value={editValues.remark || ''}
                                  onChange={(e) =>
                                    setEditValues((v) => ({ ...v, remark: e.target.value }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-1 text-center">
                                <button
                                  onClick={() => saveEdit(idx)}
                                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                  保存
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-gray-800 font-medium">
                                {item.name}
                                {info.messages.length > 0 && (
                                  <span className="ml-1" title={info.messages.join('; ')}>
                                    {info.level === 'error' ? '⚠️' : '⚡'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{item.type}</td>
                              <td className="px-3 py-2 text-gray-600">{item.county}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    item.status === '在用'
                                      ? 'bg-green-100 text-green-700'
                                      : item.status === '备用'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : item.status === '取消'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-400 text-xs max-w-[150px] truncate">
                                {item.remark || '-'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => startEdit(item, idx)}
                                  className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  编辑
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 警告列表 */}
              {importResult.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    导入日志（{importResult.warnings.length} 条）
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {importResult.warnings.map((w, i) => (
                      <p
                        key={i}
                        className={`text-xs ${
                          w.level === 'error'
                            ? 'text-red-600'
                            : w.level === 'warning'
                              ? 'text-yellow-700'
                              : 'text-gray-500'
                        }`}
                      >
                        {w.level === 'error' ? '❌' : w.level === 'warning' ? '⚠️' : 'ℹ️'}行{w.row}:{' '}
                        {w.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">导入完成</h3>
              <p className="text-gray-500">已成功导入 {selectedRows.size} 条水源地数据</p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {step === 'preview' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="text-sm text-gray-500">
              已选 <strong className="text-blue-600">{selectedRows.size}</strong> 条
              {!validationResult?.valid && (
                <span className="ml-2 text-yellow-600">
                  （有 {validationResult?.summary.errors} 条错误，建议修正后导入）
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                重新选择
              </button>
              <button
                onClick={confirmImport}
                disabled={selectedRows.size === 0}
                className="px-6 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认导入 ({selectedRows.size} 条)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataImportPanel;
