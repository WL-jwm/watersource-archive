/**
 * N5: 加密导出/导入弹窗
 *
 * 功能：
 * - 加密导出：输入密码 → 加密全量数据/水源地数据 → 下载 .wsec 文件
 * - 加密导入：选择 .wsec 文件 → 输入密码 → 解密 → 恢复数据
 * - 密码强度检测：实时显示密码强度和建议
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { exportAllData } from '@/lib/backupManager';
import {
  encryptAndDownload,
  readAndDecrypt,
  checkPasswordStrength,
  isEncryptedFile,
  type PasswordStrength,
} from '@/lib/cryptoExport';
import { useWaterSourceStore } from '@/stores/waterSourceStore';

type Mode = 'export' | 'import';
type ExportScope = 'sources' | 'full';

interface CryptoExportModalProps {
  open: boolean;
  onClose: () => void;
}

const CryptoExportModal: React.FC<CryptoExportModalProps> = ({ open, onClose }) => {
  const [mode, setMode] = useState<Mode>('export');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [exportScope, setExportScope] = useState<ExportScope>('sources');
  const [processing, setProcessing] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const store = useWaterSourceStore();

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setProcessing(false);
      setResultMsg(null);
      setSelectedFile(null);
      setMode('export');
      setExportScope('sources');
    }
  }, [open]);

  const strength: PasswordStrength = checkPasswordStrength(password);

  const handleExport = useCallback(async () => {
    if (!password) {
      setResultMsg({ type: 'error', text: '请输入加密密码' });
      return;
    }
    if (password !== confirmPassword) {
      setResultMsg({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }
    if (strength.score < 2) {
      setResultMsg({ type: 'error', text: '密码强度过低，建议使用更复杂的密码' });
      return;
    }

    setProcessing(true);
    setResultMsg(null);
    try {
      let plaintext: string;
      let baseName: string;

      if (exportScope === 'full') {
        plaintext = await exportAllData();
        baseName = `watersource-full-backup_${new Date().toISOString().slice(0, 10)}`;
      } else {
        plaintext = store.exportJSON();
        baseName = `水源地数据_${new Date().toISOString().slice(0, 10)}`;
      }

      const result = await encryptAndDownload(plaintext, password, baseName);
      setResultMsg({
        type: 'success',
        text: `加密导出成功：${result.fileName}（原始 ${(result.originalSize / 1024).toFixed(1)}KB → 加密后 ${(result.encryptedSize / 1024).toFixed(1)}KB）`,
      });
    } catch (err) {
      setResultMsg({
        type: 'error',
        text: `加密失败：${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setProcessing(false);
    }
  }, [password, confirmPassword, strength.score, exportScope]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isEncryptedFile(file) && !file.name.endsWith('.json')) {
      setSelectedFile(file);
      setResultMsg({ type: 'error', text: '请选择 .wsec 加密文件' });
      return;
    }
    setSelectedFile(file);
    setResultMsg(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      setResultMsg({ type: 'error', text: '请先选择加密文件' });
      return;
    }
    if (!password) {
      setResultMsg({ type: 'error', text: '请输入解密密码' });
      return;
    }

    setProcessing(true);
    setResultMsg(null);
    try {
      const result = await readAndDecrypt(selectedFile, password);
      if (!result.success) {
        setResultMsg({ type: 'error', text: result.message });
        return;
      }

      // 尝试解析解密后的数据
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.data);
      } catch {
        setResultMsg({ type: 'error', text: '解密成功但数据格式异常，无法解析为 JSON' });
        return;
      }

      // 判断是全量备份还是水源地数据
      const parsedObj = parsed as Record<string, any>;
      const isFullBackup = !!parsedObj?.meta?.backupVersion;
      const isSourceData = !!parsedObj?.sources;

      if (isFullBackup) {
        // 全量恢复
        const { importAllData } = await import('@/lib/backupManager');
        const restoreResult = await importAllData(result.data);
        if (restoreResult.success) {
          setResultMsg({
            type: 'success',
            text: `解密并恢复成功：${restoreResult.message}`,
          });
        } else {
          setResultMsg({ type: 'error', text: restoreResult.message });
        }
      } else if (isSourceData) {
        // 水源地数据导入（合并模式）
        const count = await store.importJSON(result.data, 'merge');
        setResultMsg({
          type: 'success',
          text: `解密并导入成功：${count} 条水源地记录`,
        });
      } else {
        setResultMsg({ type: 'error', text: '解密成功但数据结构不识别' });
      }
    } catch (err) {
      setResultMsg({
        type: 'error',
        text: `导入失败：${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setProcessing(false);
    }
  }, [selectedFile, password]);

  if (!open) return null;

  // 密码强度条颜色
  const strengthBars = [1, 2, 3, 4].map((i) => {
    if (i <= strength.score) {
      const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
      return colors[strength.score] || 'bg-green-500';
    }
    return 'bg-gray-200 dark:bg-gray-600';
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">数据加密导出/导入</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {([
            { value: 'export', label: '加密导出' },
            { value: 'import', label: '加密导入' },
          ] as { value: Mode; label: string }[]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setMode(tab.value); setResultMsg(null); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {mode === 'export' ? (
            <>
              {/* 导出范围 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">导出范围</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportScope('sources')}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      exportScope === 'sources'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    水源地数据
                  </button>
                  <button
                    onClick={() => setExportScope('full')}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      exportScope === 'full'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    全量备份
                    <span className="block text-[10px] opacity-70">含计算结果+版本+审计</span>
                  </button>
                </div>
              </div>

              {/* 加密算法说明 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 text-xs text-blue-600 dark:text-blue-300">
                <div className="flex items-center gap-1.5 font-medium mb-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  AES-256-GCM 加密
                </div>
                <div className="text-blue-500 dark:text-blue-400">
                  密码通过 PBKDF2(100000次) 派生为 256 位密钥，每次加密使用随机盐和 IV
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 文件选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择加密文件</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wsec"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {selectedFile ? (
                    <span className="text-gray-700 dark:text-gray-200">{selectedFile.name}</span>
                  ) : (
                    '点击选择 .wsec 加密文件'
                  )}
                </button>
              </div>
            </>
          )}

          {/* 密码输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {mode === 'export' ? '加密密码' : '解密密码'} <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'export' ? '请设置加密密码' : '请输入解密密码'}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {/* 密码强度 */}
            {mode === 'export' && password && (
              <div className="mt-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5 flex-1">
                    {strengthBars.map((cls, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${cls}`} />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${strength.color}`}>{strength.label}</span>
                </div>
                {strength.suggestions.length > 0 && (
                  <div className="mt-1 text-[10px] text-gray-400">
                    {strength.suggestions.join('；')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 确认密码（仅导出） */}
          {mode === 'export' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                确认密码 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-0.5 text-xs text-red-500">两次输入的密码不一致</p>
              )}
            </div>
          )}

          {/* 警告提示 */}
          {mode === 'export' && (
            <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md p-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
              </svg>
              <span>请妥善保管密码，密码丢失后将无法恢复加密数据</span>
            </div>
          )}

          {/* 结果消息 */}
          {resultMsg && (
            <div className={`text-xs p-2.5 rounded-md ${
              resultMsg.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : resultMsg.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            }`}>
              {resultMsg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            关闭
          </button>
          <button
            onClick={mode === 'export' ? handleExport : handleImport}
            disabled={processing || !password || (mode === 'export' && !confirmPassword) || (mode === 'import' && !selectedFile)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing
              ? (mode === 'export' ? '加密中...' : '解密中...')
              : (mode === 'export' ? '加密导出' : '解密导入')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CryptoExportModal;
