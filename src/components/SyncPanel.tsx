/* ===== S11.4: 数据同步面板 =====
 * 导出同步包 + 导入同步包 + 同步历史
 */

import React, { useState, useCallback, useRef } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import {
  createSyncPackage,
  readSyncPackage,
  previewSync,
  applySyncPackage,
  type SyncPackage,
  type SyncPreview,
} from '@/lib/syncEngine';
import { dbPut, dbDelete } from '@/lib/idb';
import type { MergeStrategy } from '@/lib/mergeStrategy';

type SyncStep = 'idle' | 'exporting' | 'importing' | 'preview' | 'applying' | 'done';

interface SyncPanelProps {
  onClose: () => void;
}

const SyncPanel: React.FC<SyncPanelProps> = ({ onClose }) => {
  const { sources } = useWaterSourceStore();
  const toast = useToast();

  const [step, setStep] = useState<SyncStep>('idle');
  const [mode, setMode] = useState<'export' | 'import'>('export');

  // 导出状态
  const [exportPassword, setExportPassword] = useState('');
  const [exportDevice, setExportDevice] = useState('');
  const [exportSince, setExportSince] = useState('1970-01-01');

  // 导入状态
  const [importPassword, setImportPassword] = useState('');
  const [importedPkg, setImportedPkg] = useState<SyncPackage | null>(null);
  const [importPreview, setImportPreview] = useState<SyncPreview | null>(null);
  const [strategy, setStrategy] = useState<MergeStrategy>('skip');
  const [importResult, setImportResult] = useState<{ applied: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ===== 导出 =====
  const handleExport = useCallback(async () => {
    if (!exportPassword || exportPassword.length < 4) {
      toast.warning('密码至少 4 位');
      return;
    }
    setStep('exporting');
    try {
      const result = await createSyncPackage(
        sources,
        exportPassword,
        new Date(exportSince).toISOString(),
        undefined, // 全量导出
        exportDevice || 'unknown',
      );
      if (result.success) {
        toast.success(`同步包已下载 (${(result.fileSize / 1024).toFixed(1)} KB)`);
        setStep('done');
      } else {
        toast.error(`导出失败: ${result.error}`);
        setStep('idle');
      }
    } catch (err) {
      toast.error(`导出失败: ${(err as Error).message}`);
      setStep('idle');
    }
  }, [sources, exportPassword, exportDevice, exportSince, toast]);

  // ===== 导入文件选择 =====
  const handleFileSelect = useCallback(async (file: File) => {
    if (!importPassword) {
      toast.warning('请先输入密码');
      return;
    }
    setStep('importing');
    try {
      const result = await readSyncPackage(file, importPassword);
      if (result.success && result.pkg) {
        const preview = previewSync(result.pkg, sources);
        setImportedPkg(result.pkg);
        setImportPreview(preview);
        setStep('preview');
      } else {
        toast.error(result.error || '解密失败');
        setStep('idle');
      }
    } catch (err) {
      toast.error(`导入失败: ${(err as Error).message}`);
      setStep('idle');
    }
  }, [importPassword, sources, toast]);

  // ===== 应用同步 =====
  const handleApply = useCallback(async () => {
    if (!importedPkg) return;
    setStep('applying');
    try {
      const result = applySyncPackage(importedPkg, sources, strategy);
      let applied = 0;

      // 写入新增
      for (const rec of result.toAdd) {
        await dbPut('water_sources', rec);
        applied++;
      }
      // 写入更新
      for (const rec of result.toUpdate) {
        await dbPut('water_sources', rec);
        applied++;
      }
      // 删除
      for (const id of result.toDelete) {
        await dbDelete('water_sources', id);
        applied++;
      }

      setImportResult({ applied, skipped: result.skipped, errors: result.errors });
      setStep('done');
      if (result.errors.length === 0) {
        toast.success(`同步完成: 应用 ${applied} 条变更`);
      } else {
        toast.warning(`同步完成: 应用 ${applied} 条, 错误 ${result.errors.length} 条`);
      }
    } catch (err) {
      toast.error(`应用失败: ${(err as Error).message}`);
      setStep('preview');
    }
  }, [importedPkg, sources, strategy, toast]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">数据同步</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* 模式切换 */}
          {step === 'idle' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('export')}
                className={`p-4 border-2 rounded-lg text-left ${mode === 'export' ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
              >
                <div className="text-sm font-bold text-gray-700">导出同步包</div>
                <div className="text-xs text-gray-400 mt-1">将当前数据加密导出为 .wsync 文件</div>
              </button>
              <button
                onClick={() => setMode('import')}
                className={`p-4 border-2 rounded-lg text-left ${mode === 'import' ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
              >
                <div className="text-sm font-bold text-gray-700">导入同步包</div>
                <div className="text-xs text-gray-400 mt-1">从 .wsync 文件解密并合并数据</div>
              </button>
            </div>
          )}

          {/* 导出表单 */}
          {mode === 'export' && (step === 'idle' || step === 'exporting') && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">加密密码</label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="至少 4 位密码"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">设备名称（可选）</label>
                <input
                  type="text"
                  value={exportDevice}
                  onChange={(e) => setExportDevice(e.target.value)}
                  placeholder="如：办公室电脑"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">导出起始日期</label>
                <input
                  type="date"
                  value={exportSince}
                  onChange={(e) => setExportSince(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-gray-400 mt-1">导出该日期之后的所有数据变更</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-600">
                当前数据量：{sources.length} 条水源地记录
              </div>
              <button
                onClick={handleExport}
                disabled={step === 'exporting'}
                className="w-full py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {step === 'exporting' ? '加密导出中...' : '生成并下载同步包'}
              </button>
            </div>
          )}

          {/* 导入表单 */}
          {mode === 'import' && (step === 'idle' || step === 'importing') && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">解密密码</label>
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="输入导出时设置的密码"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-300"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wsync"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />
                <div className="text-3xl mb-2 text-gray-300">📦</div>
                <p className="text-gray-500 text-sm">选择 .wsync 同步包文件</p>
                {step === 'importing' && <p className="text-blue-500 mt-2">解密中...</p>}
              </div>
            </div>
          )}

          {/* 导入预览 */}
          {step === 'preview' && importPreview && importedPkg && (
            <div className="space-y-4">
              {/* 同步包信息 */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">同步包类型</span><span className="font-medium">{importedPkg.meta.type === 'full' ? '全量' : '增量'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">生成时间</span><span className="font-medium">{new Date(importedPkg.meta.createdAt).toLocaleString('zh-CN')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">源设备</span><span className="font-medium">{importedPkg.meta.sourceDevice}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">记录数</span><span className="font-medium">{importedPkg.meta.recordCount}</span></div>
              </div>

              {/* 统计 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-700">{importPreview.addedCount}</div>
                  <div className="text-xs text-green-600">新增</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-amber-700">{importPreview.updatedCount}</div>
                  <div className="text-xs text-amber-600">更新</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-red-700">{importPreview.deletedCount}</div>
                  <div className="text-xs text-red-600">删除</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-orange-700">{importPreview.conflicts.conflictCount}</div>
                  <div className="text-xs text-orange-600">冲突</div>
                </div>
              </div>

              {/* 冲突策略 */}
              {importPreview.conflicts.conflictCount > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">冲突处理策略</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'skip', label: '跳过冲突' },
                      { value: 'overwrite', label: '覆盖' },
                      { value: 'rename', label: '重命名' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setStrategy(opt.value)}
                        className={`flex-1 py-2 text-sm rounded-lg border ${strategy === opt.value ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleApply}
                className="w-full py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                应用同步 ({importPreview.totalAffected} 条变更)
              </button>
            </div>
          )}

          {/* 应用中 */}
          {step === 'applying' && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">正在应用同步数据...</p>
            </div>
          )}

          {/* 完成 */}
          {step === 'done' && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                {mode === 'export' ? '导出完成' : '同步完成'}
              </h3>
              {importResult && (
                <p className="text-gray-500 text-sm">
                  应用 {importResult.applied} 条 · 跳过 {importResult.skipped} 条
                </p>
              )}
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                关闭
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncPanel;
