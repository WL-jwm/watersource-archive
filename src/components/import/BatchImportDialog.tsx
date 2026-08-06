/* ===== S11.1: 批量导入对话框（四步流程） =====
 * upload → mapping → preview → complete
 * 增强版：支持模板下载、字段映射、冲突检测（S11.2）
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { type WaterSourceRecord, useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import {
  downloadImportTemplate,
  detectFieldMapping,
  applyMapping,
  validateMappedRecord,
  normalizeLevel,
  normalizeType,
  normalizeStatus,
  levelToChinese,
  type FieldMappingItem,
  type FieldMappingResult,
} from '@/lib/importTemplate';
import FieldMappingPanel from './FieldMappingPanel';
import BatchImportProgress, { type BatchImportState, type ImportFailure } from './BatchImportProgress';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface RawRowData {
  /** 原始行数据 */
  row: Record<string, string>;
  /** 行号（从2开始，含表头） */
  rowNum: number;
}

const BatchImportDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const toast = useToast();
  const { sources, batchImport } = useWaterSourceStore();

  const [step, setStep] = useState<ImportStep>('upload');
  const [rawRows, setRawRows] = useState<RawRowData[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mappingResult, setMappingResult] = useState<FieldMappingResult | null>(null);
  const [confirmedMapping, setConfirmedMapping] = useState<FieldMappingItem[]>([]);
  const [mappedRecords, setMappedRecords] = useState<Partial<WaterSourceRecord>[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importStrategy, setImportStrategy] = useState<'skip' | 'overwrite' | 'rename'>('skip');
  const [batchState, setBatchState] = useState<BatchImportState>({
    total: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0,
    running: false, paused: false, failures: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);

  // ===== 文件解析 =====

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setError(null);
    try {
      const fileName = file.name.toLowerCase();
      let rows: Record<string, string>[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', codepage: 65001 });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { defval: '', raw: false });
      } else if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        rows = result.data;
      } else {
        throw new Error(`不支持的文件格式: ${file.name}，仅支持 .xlsx、.xls、.csv`);
      }

      if (rows.length === 0) {
        throw new Error('文件中没有数据行');
      }

      // 提取列名和行数据
      const columns = Object.keys(rows[0]).filter((k) => k.trim() !== '');
      const rowData: RawRowData[] = rows
        .filter((r) => Object.values(r).some((v) => v && v.trim() !== ''))
        .map((r, i) => ({ row: r, rowNum: i + 2 }));

      setSourceColumns(columns);
      setRawRows(rowData);
      setStep('mapping');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ===== 映射确认 =====

  const handleMappingConfirm = useCallback((mappings: FieldMappingItem[]) => {
    setConfirmedMapping(mappings);

    // 应用映射到所有行
    const records: Partial<WaterSourceRecord>[] = [];
    const errors: Record<number, string[]> = {};
    const validIndices = new Set<number>();

    rawRows.forEach((rawData, idx) => {
      const record = applyMapping(rawData.row, mappings);
      records.push(record);
      const validation = validateMappedRecord(record, rawData.rowNum);
      if (!validation.valid) {
        errors[idx] = validation.errors;
      } else {
        validIndices.add(idx);
      }
    });

    setMappedRecords(records);
    setValidationErrors(errors);
    setSelectedRows(validIndices);
    setStep('preview');
  }, [rawRows]);

  // ===== 执行导入 =====

  const executeImport = useCallback(async () => {
    const selected = mappedRecords.filter((_, i) => selectedRows.has(i));
    if (selected.length === 0) {
      toast.warning('请至少选择一行数据');
      return;
    }

    setStep('importing');
    pausedRef.current = false;
    cancelledRef.current = false;

    setBatchState({
      total: selected.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      running: true,
      paused: false,
      failures: [],
    });

    // 检测冲突
    const failures: ImportFailure[] = [];
    let succeeded = 0;
    let skipped = 0;

    // 分批处理（每50条一批，支持暂停）
    const BATCH_SIZE = 50;
    const allRecords: Partial<WaterSourceRecord>[] = [];

    for (let i = 0; i < selected.length; i++) {
      if (cancelledRef.current) break;
      while (pausedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (cancelledRef.current) break;
      }

      allRecords.push(selected[i]);

      // 更新进度
      setBatchState((prev) => ({
        ...prev,
        processed: i + 1,
      }));

      // 每 BATCH_SIZE 条执行一次批量导入
      if (allRecords.length >= BATCH_SIZE || i === selected.length - 1) {
        try {
          const result = await batchImport(allRecords, importStrategy, (processed, total) => {
            // 批内进度回调
          });
          succeeded += result.imported + result.updated;
          skipped += result.skipped;
          // 收集失败
          result.errors.forEach((err) => {
            failures.push({ row: 0, name: '', reason: err });
          });
          allRecords.length = 0; // 清空批次
        } catch (err) {
          failures.push({ row: i + 2, name: '', reason: (err as Error).message });
        }
      }
    }

    setBatchState({
      total: selected.length,
      processed: selected.length,
      succeeded,
      failed: failures.length,
      skipped,
      running: false,
      paused: false,
      failures,
    });

    if (failures.length === 0 && skipped === 0) {
      toast.success(`成功导入 ${succeeded} 条水源地数据`);
    } else if (failures.length > 0) {
      toast.warning(`导入完成: 成功${succeeded}条, 跳过${skipped}条, 失败${failures.length}条`);
    } else {
      toast.success(`导入完成: 成功${succeeded}条, 跳过${skipped}条`);
    }
  }, [mappedRecords, selectedRows, batchImport, importStrategy, toast]);

  // ===== 暂停/继续/取消 =====

  const handlePause = useCallback(() => {
    pausedRef.current = true;
    setBatchState((prev) => ({ ...prev, paused: true }));
  }, []);

  const handleResume = useCallback(() => {
    pausedRef.current = false;
    setBatchState((prev) => ({ ...prev, paused: false }));
  }, []);

  const handleCancelImport = useCallback(() => {
    cancelledRef.current = true;
    pausedRef.current = false;
    setBatchState((prev) => ({ ...prev, running: false, paused: false }));
  }, []);

  // ===== 冲突预检测 =====

  const conflictPreview = useMemo(() => {
    const existingMap = new Map(sources.map((s) => [s.name + '|' + s.cityName, s]));
    const existingIdMap = new Map(sources.map((s) => [s.id, s]));
    let conflicts = 0;
    let newRecords = 0;

    mappedRecords.forEach((rec, idx) => {
      if (!selectedRows.has(idx)) return;
      const key = (rec.name || '') + '|' + (rec.cityName || '');
      if (existingMap.has(key) || (rec.id && existingIdMap.has(rec.id))) {
        conflicts++;
      } else {
        newRecords++;
      }
    });

    return { conflicts, newRecords, total: conflicts + newRecords };
  }, [mappedRecords, selectedRows, sources]);

  // ===== 步骤指示器 =====

  const steps = [
    { key: 'upload', label: '上传文件' },
    { key: 'mapping', label: '字段映射' },
    { key: 'preview', label: '数据预览' },
    { key: 'importing', label: '导入执行' },
    { key: 'complete', label: '完成' },
  ];
  const currentStepIdx = steps.findIndex((s) => s.key === step);

  // ===== 渲染 =====

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[960px] max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">批量导入水源地数据</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center px-6 py-3 border-b border-gray-100 bg-gray-50">
          {steps.map((s, idx) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-2 ${idx <= currentStepIdx ? 'text-blue-600' : 'text-gray-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  idx < currentStepIdx ? 'bg-blue-600 text-white' :
                  idx === currentStepIdx ? 'bg-blue-100 text-blue-600 border-2 border-blue-400' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  {idx < currentStepIdx ? '✓' : idx + 1}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 ${idx < currentStepIdx ? 'bg-blue-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: 上传 */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* 模板下载 */}
              <div className="flex items-center justify-between bg-blue-50 rounded-lg p-4">
                <div>
                  <p className="text-sm font-medium text-blue-700">下载标准导入模板</p>
                  <p className="text-xs text-blue-500 mt-1">模板含标准列名、数据验证下拉和填写说明</p>
                </div>
                <button
                  onClick={() => {
                    downloadImportTemplate();
                    toast.info('模板已下载');
                  }}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  下载模板
                </button>
              </div>

              {/* 拖拽上传 */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                  className="hidden"
                />
                <div className="text-4xl mb-3 text-gray-300">{dragOver ? '📂' : '📄'}</div>
                <p className="text-gray-600 font-medium mb-1">
                  {dragOver ? '松开以上传文件' : '拖拽文件到此处，或点击选择'}
                </p>
                <p className="text-gray-400 text-sm">支持 .xlsx、.xls、.csv 格式</p>
                {parsing && <p className="text-blue-500 mt-3">解析中...</p>}
                {error && <p className="text-red-500 mt-3">{error}</p>}
              </div>
            </div>
          )}

          {/* Step 2: 字段映射 */}
          {step === 'mapping' && (
            <FieldMappingPanel
              sourceColumns={sourceColumns}
              onConfirm={handleMappingConfirm}
              onCancel={() => setStep('upload')}
            />
          )}

          {/* Step 3: 数据预览 */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* 统计摘要 */}
              <div className="flex gap-3 text-sm flex-wrap">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                  总计 {mappedRecords.length} 行
                </span>
                <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">
                  已选 {selectedRows.size} 行
                </span>
                {Object.keys(validationErrors).length > 0 && (
                  <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full">
                    校验错误 {Object.keys(validationErrors).length} 行
                  </span>
                )}
                {conflictPreview.conflicts > 0 && (
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full">
                    冲突 {conflictPreview.conflicts} 条
                  </span>
                )}
              </div>

              {/* 冲突策略选择 */}
              {conflictPreview.conflicts > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-orange-700 mb-2">
                    检测到 {conflictPreview.conflicts} 条与现有数据冲突（名称+城市匹配）
                  </p>
                  <div className="flex gap-3">
                    {([
                      { value: 'skip', label: '跳过冲突', desc: '保留原数据，不导入冲突行' },
                      { value: 'overwrite', label: '覆盖原数据', desc: '用新数据替换已有记录' },
                      { value: 'rename', label: '自动重命名', desc: '冲突行自动追加_2/_3后缀' },
                    ] as const).map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex-1 p-3 border rounded-lg cursor-pointer ${
                          importStrategy === opt.value
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="strategy"
                          value={opt.value}
                          checked={importStrategy === opt.value}
                          onChange={(e) => setImportStrategy(e.target.value as typeof importStrategy)}
                          className="hidden"
                        />
                        <div className="text-sm font-medium text-gray-700">{opt.label}</div>
                        <div className="text-xs text-gray-400 mt-1">{opt.desc}</div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 数据表格 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === mappedRecords.length}
                          onChange={() => {
                            if (selectedRows.size === mappedRecords.length) {
                              setSelectedRows(new Set());
                            } else {
                              setSelectedRows(new Set(mappedRecords.map((_, i) => i)));
                            }
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-gray-600">行号</th>
                      <th className="px-3 py-2 text-left text-gray-600">名称</th>
                      <th className="px-3 py-2 text-left text-gray-600">城市</th>
                      <th className="px-3 py-2 text-left text-gray-600">级别</th>
                      <th className="px-3 py-2 text-left text-gray-600">类型</th>
                      <th className="px-3 py-2 text-left text-gray-600">县区</th>
                      <th className="px-3 py-2 text-left text-gray-600">状态</th>
                      <th className="px-3 py-2 text-left text-gray-600">校验</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mappedRecords.map((rec, idx) => {
                      const hasError = validationErrors[idx];
                      const isSelected = selectedRows.has(idx);
                      const rowClass = hasError
                        ? 'bg-red-50'
                        : isSelected
                          ? idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          : 'bg-gray-100/50';
                      return (
                        <tr key={idx} className={rowClass}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!!hasError}
                              onChange={() => {
                                setSelectedRows((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(idx)) next.delete(idx);
                                  else next.add(idx);
                                  return next;
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-400 text-xs">{idx + 2}</td>
                          <td className="px-3 py-2 text-gray-800 font-medium">{rec.name || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{rec.cityName || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {rec.level ? levelToChinese(rec.level) : '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{rec.type || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{rec.county || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{rec.status || '—'}</td>
                          <td className="px-3 py-2">
                            {hasError ? (
                              <span className="text-red-500 text-xs" title={hasError.join('\n')}>错误</span>
                            ) : (
                              <span className="text-green-500 text-xs">通过</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: 导入执行 */}
          {(step === 'importing' || step === 'complete') && (
            <BatchImportProgress
              state={batchState}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancelImport}
              onComplete={() => setStep('complete')}
            />
          )}

          {/* Step 5: 完成 */}
          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">导入完成</h3>
              <p className="text-gray-500">
                成功 {batchState.succeeded} 条 / 跳过 {batchState.skipped} 条 / 失败 {batchState.failed} 条
              </p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {step === 'preview' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="text-sm text-gray-500">
              已选 <strong className="text-blue-600">{selectedRows.size}</strong> 条
              {conflictPreview.conflicts > 0 && (
                <span className="ml-2 text-orange-600">（含冲突 {conflictPreview.conflicts} 条）</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                返回映射
              </button>
              <button
                onClick={executeImport}
                disabled={selectedRows.size === 0}
                className="px-6 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                开始导入 ({selectedRows.size} 条)
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="flex justify-end px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchImportDialog;
