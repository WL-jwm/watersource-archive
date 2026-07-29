/**
 * 备份设置弹窗
 * 
 * 提供备份频率配置、手动备份/恢复入口
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  getBackupSettings,
  setBackupSettings,
  triggerBackupDownload,
  importAllData,
  getLastBackupTime,
  formatDaysSince,
  formatBackupSize,
  checkBackupNeeded,
  type BackupSettings,
  type RestoreResult,
} from '@/lib/backupManager';
import { encryptAndDownload } from '@/lib/cryptoExport';
import { useToast } from '@/hooks/useToast';

interface BackupSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({ open, onClose }) => {
  const [settings, setSettings] = useState<BackupSettings>(() => getBackupSettings());
  const [lastTime, setLastTime] = useState<string | null>(null);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ fileName: string; size: number } | null>(null);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载上次备份时间
  React.useEffect(() => {
    if (open) {
      getLastBackupTime().then(setLastTime);
      setSettings(getBackupSettings());
      setRestoreResult(null);
      setBackupInfo(null);
    }
  }, [open]);

  const handleSaveSettings = useCallback(() => {
    setBackupSettings(settings);
    onClose();
  }, [settings, onClose]);

  const handleBackupNow = useCallback(async () => {
    setBacking(true);
    try {
      const result = await triggerBackupDownload();
      setBackupInfo({ fileName: result.fileName, size: result.size });
      setLastTime(new Date().toISOString());
    } catch (err) {
      console.error('Backup failed:', err);
    } finally {
      setBacking(false);
    }
  }, []);

  const handleRestoreFile = useCallback(async (file: File) => {
    setRestoring(true);
    setRestoreResult(null);
    try {
      const text = await file.text();
      const result = await importAllData(text);
      setRestoreResult(result);
    } catch (err) {
      setRestoreResult({
        success: false,
        message: `文件读取失败：${err instanceof Error ? err.message : String(err)}`,
        details: {
          waterSources: 0,
          cities: 0,
          zoneResults: 0,
          dataVersions: 0,
          dataChangelog: 0,
          reports: 0,
          auditLogs: 0,
        },
      });
    } finally {
      setRestoring(false);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">数据备份与恢复</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* 备份状态 */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">上次备份时间</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {lastTime ? `${formatDaysSince(Math.floor((Date.now() - new Date(lastTime).getTime()) / 86400000))}（${new Date(lastTime).toLocaleString('zh-CN')}）` : '从未备份'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">备份格式</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">JSON（含全量 IDB + localStorage + 审计日志）</span>
            </div>
          </div>

          {/* 备份频率设置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">自动备份频率</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'daily', label: '每天' },
                { value: 'weekly', label: '每周' },
                { value: 'manual', label: '仅手动' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSettings((prev) => ({ ...prev, frequency: opt.value }))}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    settings.frequency === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 自动下载开关 */}
          {settings.frequency !== 'manual' && (
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">达到阈值自动下载备份文件</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">应用启动时检测，达到设定天数后自动触发文件下载</p>
              </div>
              <button
                onClick={() => setSettings((prev) => ({ ...prev, autoDownload: !prev.autoDownload }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.autoDownload ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoDownload ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* 阈值天数（仅 weekly 模式可配） */}
          {settings.frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                提醒阈值（天）：{settings.thresholdDays}
              </label>
              <input
                type="range"
                min={3}
                max={30}
                step={1}
                value={settings.thresholdDays}
                onChange={(e) => setSettings((prev) => ({ ...prev, thresholdDays: Number(e.target.value) }))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>3天</span>
                <span>30天</span>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
            {/* 手动备份 */}
            <button
              onClick={handleBackupNow}
              disabled={backing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {backing ? '正在备份...' : '立即备份全量数据'}
            </button>
            {backupInfo && (
              <div className="text-xs text-green-600 dark:text-green-400 text-center">
                备份完成：{backupInfo.fileName}（{formatBackupSize(backupInfo.size)}）
              </div>
            )}

            {/* N5: 加密备份 */}
            <button
              onClick={async () => {
                const pwd = prompt('请输入加密密码：');
                if (!pwd) return;
                const confirmPwd = prompt('请再次输入密码确认：');
                if (pwd !== confirmPwd) {
                  toast.warning('两次输入的密码不一致');
                  return;
                }
                setBacking(true);
                try {
                  const { exportAllData } = await import('@/lib/backupManager');
                  const data = await exportAllData();
                  const result = await encryptAndDownload(data, pwd, `watersource-encrypted-backup_${new Date().toISOString().slice(0, 10)}`);
                  setBackupInfo({ fileName: result.fileName, size: result.encryptedSize });
                  setLastTime(new Date().toISOString());
                } catch (err) {
                  toast.error(`加密备份失败：${err instanceof Error ? err.message : String(err)}`);
                } finally {
                  setBacking(false);
                }
              }}
              disabled={backing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {backing ? '加密中...' : '加密备份（AES-256）'}
            </button>

            {/* 恢复 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                从备份文件恢复数据（将覆盖当前所有数据，请谨慎操作）
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleRestoreFile(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={restoring}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {restoring ? '正在恢复...' : '从备份文件恢复'}
              </button>
              {restoreResult && (
                <div
                  className={`mt-2 text-xs p-2 rounded ${
                    restoreResult.success
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}
                >
                  {restoreResult.message}
                  {restoreResult.success && (
                    <div className="mt-1 text-gray-500 dark:text-gray-400">
                      恢复后请刷新页面以加载所有数据。
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupSettingsModal;
