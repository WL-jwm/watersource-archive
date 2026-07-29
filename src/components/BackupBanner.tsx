/**
 * 备份提醒横幅
 * 
 * 在页面顶部显示，当超过阈值未备份时提示用户
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  checkBackupNeeded,
  triggerBackupDownload,
  getBackupSettings,
  formatDaysSince,
  type BackupSettings,
} from '@/lib/backupManager';

interface BackupBannerState {
  visible: boolean;
  daysSince: number;
  lastTime: string | null;
  backing: boolean;
}

const BackupBanner: React.FC = () => {
  const [state, setState] = useState<BackupBannerState>({
    visible: false,
    daysSince: 0,
    lastTime: null,
    backing: false,
  });
  const [dismissed, setDismissed] = useState(false);

  const checkStatus = useCallback(async () => {
    const { needed, daysSince, lastTime } = await checkBackupNeeded();
    setState((prev) => ({
      ...prev,
      visible: needed,
      daysSince,
      lastTime,
    }));
  }, []);

  useEffect(() => {
    // 延迟检查，避免与初始化竞争
    const timer = setTimeout(checkStatus, 3000);
    return () => clearTimeout(timer);
  }, [checkStatus]);

  const handleBackupNow = useCallback(async () => {
    setState((prev) => ({ ...prev, backing: true }));
    try {
      await triggerBackupDownload();
      setState((prev) => ({ ...prev, visible: false, backing: false }));
      setDismissed(true);
    } catch {
      setState((prev) => ({ ...prev, backing: false }));
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!state.visible || dismissed) return null;

  const settings: BackupSettings = getBackupSettings();
  const isOverdue = state.daysSince === Infinity || state.daysSince >= settings.thresholdDays;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm border-b transition-all ${
        isOverdue
          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200'
          : 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 4a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
        </svg>
        <span className="truncate">
          {state.daysSince === Infinity
            ? '您从未进行过数据备份，建议立即备份以防数据丢失'
            : `上次备份：${formatDaysSince(state.daysSince)}（${state.lastTime ? new Date(state.lastTime).toLocaleDateString('zh-CN') : '-'}），建议定期备份`}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleBackupNow}
          disabled={state.backing}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            isOverdue
              ? 'bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50'
              : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
          }`}
        >
          {state.backing ? '备份中...' : '立即备份'}
        </button>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="关闭"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BackupBanner;
