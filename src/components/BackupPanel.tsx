/* ===== S11.12: 定时备份设置面板 =====
 * 备份配置 + 备份历史 + 手动备份
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import {
  getBackupConfig,
  updateBackupConfig,
  getBackupHistory,
  performBackup,
  downloadBackup,
  clearBackupHistory,
  getBackupStats,
  formatBackupFrequency,
  formatFileSize,
  shouldBackup,
  type BackupConfig,
  type BackupRecord,
  type BackupStats,
} from '@/lib/backupEngine';

interface BackupPanelProps {
  onClose: () => void;
}

const FREQUENCIES = ['manual', 'daily', 'weekly', 'monthly'] as const;

const BackupPanel: React.FC<BackupPanelProps> = ({ onClose }) => {
  const { sources } = useWaterSourceStore();
  const toast = useToast();

  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [password, setPassword] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [cfg, hist, st] = await Promise.all([
      getBackupConfig(),
      getBackupHistory(),
      getBackupStats(),
    ]);
    setConfig(cfg);
    setHistory(hist);
    setStats(st);
    setPassword(cfg.password || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfigUpdate = async (updates: Partial<BackupConfig>) => {
    const newConfig = await updateBackupConfig(updates);
    setConfig(newConfig);
  };

  const handleBackup = async () => {
    setBacking(true);
    try {
      const result = await performBackup(sources);
      if (result.success) {
        toast.success(`备份成功：${result.recordCount} 条记录，${formatFileSize(result.fileSize)}`);
      } else {
        toast.error(`备份失败：${result.record.error}`);
      }
      await loadData();
    } catch {
      toast.error('备份失败');
    }
    setBacking(false);
  };

  const handleDownload = async () => {
    try {
      const result = await downloadBackup(sources, password || undefined);
      toast.success(`已下载备份文件 (${formatFileSize(result.fileSize)})`);
    } catch {
      toast.error('下载失败');
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('确定清空备份历史记录？')) return;
    await clearBackupHistory();
    toast.success('备份历史已清空');
    await loadData();
  };

  const needBackup = config ? shouldBackup(config) : false;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">定时备份设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading || !config ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-5">
              {/* 统计 */}
              {stats && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-gray-800">{stats.totalBackups}</div>
                    <div className="text-xs text-gray-500">总备份</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-green-600">{stats.successfulBackups}</div>
                    <div className="text-xs text-gray-500">成功</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-red-600">{stats.failedBackups}</div>
                    <div className="text-xs text-gray-500">失败</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-600">{formatFileSize(stats.totalSize)}</div>
                    <div className="text-xs text-gray-500">总大小</div>
                  </div>
                </div>
              )}

              {/* 自动备份配置 */}
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">自动备份</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">启用自动备份</span>
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={e => handleConfigUpdate({ enabled: e.target.checked })}
                      className="rounded"
                    />
                  </label>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">备份频率</label>
                    <select
                      value={config.frequency}
                      onChange={e => handleConfigUpdate({ frequency: e.target.value as BackupConfig['frequency'] })}
                      disabled={!config.enabled}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
                    >
                      {FREQUENCIES.map(f => (
                        <option key={f} value={f}>{formatBackupFrequency(f)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">保留份数</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={config.maxRetention}
                      onChange={e => handleConfigUpdate({ maxRetention: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>

                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">加密备份</span>
                    <input
                      type="checkbox"
                      checked={config.encrypted}
                      onChange={e => handleConfigUpdate({ encrypted: e.target.checked })}
                      className="rounded"
                    />
                  </label>

                  {config.encrypted && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">加密密码</label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => {
                          setPassword(e.target.value);
                          handleConfigUpdate({ password: e.target.value });
                        }}
                        placeholder="设置密码"
                        className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  )}

                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">自动下载备份文件</span>
                    <input
                      type="checkbox"
                      checked={config.autoDownload}
                      onChange={e => handleConfigUpdate({ autoDownload: e.target.checked })}
                      className="rounded"
                    />
                  </label>

                  {needBackup && config.enabled && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700">
                      距上次备份已超过设定周期，建议立即备份
                    </div>
                  )}

                  {config.lastBackupAt && (
                    <div className="text-xs text-gray-400">
                      上次备份: {new Date(config.lastBackupAt).toLocaleString('zh-CN')}
                    </div>
                  )}
                </div>
              </div>

              {/* 手动操作 */}
              <div className="flex gap-2">
                <button
                  onClick={handleBackup}
                  disabled={backing}
                  className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                >
                  {backing ? '备份中...' : '立即备份'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded"
                >
                  下载备份文件
                </button>
              </div>

              {/* 备份历史 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">备份历史</h3>
                  {history.length > 0 && (
                    <button onClick={handleClearHistory} className="text-xs text-red-600 hover:underline">
                      清空历史
                    </button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">暂无备份记录</p>
                ) : (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {history.map(rec => (
                      <div key={rec.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0 hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${rec.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div>
                            <span className="text-sm text-gray-700">
                              {new Date(rec.createdAt).toLocaleString('zh-CN')}
                            </span>
                            <span className="text-xs text-gray-400 ml-2">
                              {formatBackupFrequency(rec.type)} · {rec.recordCount} 条 · {formatFileSize(rec.fileSize)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {rec.encrypted && <span className="text-xs text-violet-600">加密</span>}
                          {rec.status === 'failed' && <span className="text-xs text-red-600">失败</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">关闭</button>
        </div>
      </div>
    </div>
  );
};

export default BackupPanel;
