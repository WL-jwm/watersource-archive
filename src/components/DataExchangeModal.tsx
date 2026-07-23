/**
 * E3: 数据交换弹窗
 *
 * 功能：
 * - JSON 导入（原功能保留）
 * - Excel 导入（新增，含验证错误报告）
 * - CSV 导入（新增）
 * - Excel 导出（新增）
 * - CSV 导出（新增）
 * - 模板下载（新增）
 */

import { useState, useRef } from 'react';
import {
  exportToExcel,
  exportToCsv,
  downloadTemplate,
  parseExcelToRecords,
  parseCsvToRecords,
  readFileAsArrayBuffer,
  readFileAsText,
  type ImportResult,
} from '@/lib/dataExchange';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

interface Props {
  open: boolean;
  onClose: () => void;
  sources: WaterSourceRecord[];
  onImportJSON: (json: string) => void;
  onImportRecords: (records: Partial<WaterSourceRecord>[]) => void;
}

type Tab = 'import' | 'export';

export default function DataExchangeModal({
  open,
  onClose,
  sources,
  onImportJSON,
  onImportRecords,
}: Props) {
  const [tab, setTab] = useState<Tab>('import');
  const [importFormat, setImportFormat] = useState<'json' | 'excel' | 'csv'>('excel');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      if (importFormat === 'json') {
        const text = await readFileAsText(file);
        onImportJSON(text);
        setImportResult({
          success: true,
          imported: 1,
          skipped: 0,
          errors: [],
          records: [],
        });
      } else if (importFormat === 'excel') {
        const buffer = await readFileAsArrayBuffer(file);
        const result = parseExcelToRecords(buffer);
        if (result.success) {
          onImportRecords(result.records);
        }
        setImportResult(result);
      } else {
        const text = await readFileAsText(file);
        const result = parseCsvToRecords(text);
        if (result.success) {
          onImportRecords(result.records);
        }
        setImportResult(result);
      }
    } catch (err) {
      setImportResult({
        success: false,
        imported: 0,
        skipped: 0,
        errors: [{ row: 0, message: err instanceof Error ? err.message : String(err) }],
        records: [],
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">数据交换</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setTab('import')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'import'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            导入数据
          </button>
          <button
            onClick={() => setTab('export')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'export'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            导出数据
          </button>
        </div>

        <div className="p-6">
          {tab === 'import' ? (
            <div className="space-y-4">
              {/* 格式选择 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">导入格式</label>
                <div className="flex gap-2">
                  {([
                    { value: 'excel', label: 'Excel (.xlsx)', icon: '📊' },
                    { value: 'csv', label: 'CSV', icon: '📝' },
                    { value: 'json', label: 'JSON', icon: '📄' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setImportFormat(opt.value);
                        setImportResult(null);
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        importFormat === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="mr-1">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 模板下载（仅 Excel） */}
              {importFormat === 'excel' && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <p className="text-xs text-amber-700 mb-2">
                    首次导入 Excel？建议先下载模板了解格式要求。
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="text-xs px-3 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    下载导入模板
                  </button>
                </div>
              )}

              {/* 文件选择 */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={
                    importFormat === 'json'
                      ? '.json'
                      : importFormat === 'excel'
                        ? '.xlsx,.xls'
                        : '.csv'
                  }
                  onChange={handleFileSelect}
                  disabled={importing}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                />
              </div>

              {/* 导入结果 */}
              {importResult && (
                <div
                  className={`rounded-lg p-3 text-sm ${
                    importResult.success
                      ? 'bg-green-50 border border-green-100 text-green-700'
                      : 'bg-red-50 border border-red-100 text-red-700'
                  }`}
                >
                  <div className="font-semibold mb-1">
                    {importResult.success ? '导入完成' : '导入失败'}
                  </div>
                  {importResult.imported > 0 && (
                    <div>成功导入：{importResult.imported} 条</div>
                  )}
                  {importResult.skipped > 0 && (
                    <div>跳过：{importResult.skipped} 条（数据验证未通过）</div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      <div className="font-semibold text-xs mb-1">错误详情：</div>
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <div key={i} className="text-xs">
                          第{err.row}行
                          {err.field ? ` [${err.field}]` : ''}: {err.message}
                          {err.value ? ` (${err.value})` : ''}
                        </div>
                      ))}
                      {importResult.errors.length > 10 && (
                        <div className="text-xs">...共{importResult.errors.length}条错误</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 说明 */}
              <div className="text-xs text-gray-400 leading-relaxed">
                {importFormat === 'excel' && '支持 .xlsx 格式，必填字段：水源地名称、城市、水源类型'}
                {importFormat === 'csv' && '支持 UTF-8 编码的 CSV 文件，字段同 Excel 格式'}
                {importFormat === 'json' && '支持之前导出的 JSON 格式，数据将合并到现有记录中'}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 导出选项 */}
              <div className="space-y-3">
                <button
                  onClick={() => exportToExcel(sources)}
                  disabled={sources.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-left"
                >
                  <span className="text-2xl">📊</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">导出 Excel</div>
                    <div className="text-xs text-gray-500">
                      完整水源地清单（含所有字段，{sources.length} 条记录）
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => exportToCsv(sources)}
                  disabled={sources.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-left"
                >
                  <span className="text-2xl">📝</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">导出 CSV</div>
                    <div className="text-xs text-gray-500">
                      通用文本格式，可用记事本或 Excel 打开
                    </div>
                  </div>
                </button>

                <button
                  onClick={downloadTemplate}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-left"
                >
                  <span className="text-2xl">📋</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">下载导入模板</div>
                    <div className="text-xs text-gray-500">
                      含字段说明和示例数据的 Excel 模板
                    </div>
                  </div>
                </button>
              </div>

              {sources.length === 0 && (
                <div className="text-xs text-gray-400 text-center">暂无数据可导出</div>
              )}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
