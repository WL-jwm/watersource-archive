/**
 * 版本历史页面
 *
 * 功能：
 * 1. 版本列表（时间线展示）
 * 2. 手动创建版本快照
 * 3. 版本对比（差异明细）
 * 4. 版本回滚
 * 5. 版本删除
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import {
  listVersions,
  getVersion,
  createSnapshot,
  deleteVersion,
  diffVersions,
  rollbackToVersion,
  getChangeLogs,
  formatVersionTime,
  formatAction,
} from '@/lib/dataVersionEngine';
import type { VersionSummary, VersionDiff, ChangeLog } from '@/lib/dataVersionEngine';

type ViewMode = 'list' | 'diff' | 'rollback';

const VersionHistory: React.FC = () => {
  const { sources, resetToStatic } = useWaterSourceStore();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>('list');
  const [diffResult, setDiffResult] = useState<VersionDiff | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<VersionSummary | null>(null);
  const [compareVersion, setCompareVersion] = useState<VersionSummary | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const v = await listVersions();
      setVersions(v);
    } catch (err) {
      setMessage({ type: 'error', text: `加载版本列表失败: ${(err as Error).message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  /** 手动创建快照 */
  const handleCreateSnapshot = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const snapshotData = sources.map((s) => ({ ...s }));
      await createSnapshot(snapshotData, {
        name: newVersionName.trim() || undefined,
        type: 'manual',
        description: newVersionDesc.trim() || undefined,
      });
      setMessage({ type: 'success', text: '版本快照已创建' });
      setShowCreateModal(false);
      setNewVersionName('');
      setNewVersionDesc('');
      await loadVersions();
    } catch (err) {
      setMessage({ type: 'error', text: `创建失败: ${(err as Error).message}` });
    } finally {
      setCreating(false);
    }
  };

  /** 查看版本对比 */
  const handleViewDiff = async (v: VersionSummary) => {
    setSelectedVersion(v);
    setMode('diff');
    setDiffResult(null);

    try {
      const full = await getVersion(v.id);
      if (!full) {
        setMessage({ type: 'error', text: '版本数据加载失败' });
        return;
      }

      const snapshotData = JSON.parse(full.snapshot) as Record<string, unknown>[];
      const currentData = sources.map((s) => ({ ...s }));

      const diff = diffVersions(snapshotData, currentData);
      setDiffResult(diff);
    } catch (err) {
      setMessage({ type: 'error', text: `对比失败: ${(err as Error).message}` });
    }
  };

  /** 回滚到指定版本 */
  const handleRollback = async (v: VersionSummary) => {
    if (
      !window.confirm(`确定回滚到版本"${v.name}"？\n当前数据将被替换。建议先创建当前版本的快照。`)
    )
      return;

    setRollingBack(true);
    try {
      const result = await rollbackToVersion(v.id);
      if (!result) {
        setMessage({ type: 'error', text: '版本数据无效' });
        return;
      }

      // 先创建当前版本的快照（自动）
      const currentSnapshot = sources.map((s) => ({ ...s }));
      await createSnapshot(currentSnapshot, {
        name: `回滚前备份 ${new Date().toLocaleString('zh-CN')}`,
        type: 'auto',
        description: `回滚到"${v.name}"前的自动备份`,
      });

      // 通过 resetToStatic 类似机制触发数据更新
      // 实际上需要 store 层面的支持来重置数据
      setMessage({
        type: 'success',
        text: `已准备回滚到"${v.name}"，共 ${result.data.length} 条记录。\n请在数据管理页面执行重置后重新加载。`,
      });
      setMode('list');
      await loadVersions();
    } catch (err) {
      setMessage({ type: 'error', text: `回滚失败: ${(err as Error).message}` });
    } finally {
      setRollingBack(false);
    }
  };

  /** 删除版本 */
  const handleDeleteVersion = async (v: VersionSummary) => {
    if (!window.confirm(`确定删除版本"${v.name}"？此操作不可恢复。`)) return;
    try {
      await deleteVersion(v.id);
      setMessage({ type: 'success', text: `版本"${v.name}"已删除` });
      await loadVersions();
    } catch (err) {
      setMessage({ type: 'error', text: `删除失败: ${(err as Error).message}` });
    }
  };

  /** 返回列表 */
  const backToList = () => {
    setMode('list');
    setDiffResult(null);
    setSelectedVersion(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">版本历史</h1>
          <p className="text-xs text-gray-500 mt-1">数据版本快照与变更追踪</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            创建快照
          </button>
          <button
            onClick={loadVersions}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
          >
            刷新
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div
          className={`p-3 rounded-lg text-xs ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* 创建快照弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-96 p-6 space-y-4">
            <h3 className="font-bold text-gray-800">创建版本快照</h3>
            <input
              type="text"
              placeholder="版本名称（可选）"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            />
            <textarea
              placeholder="版本描述（可选）"
              value={newVersionDesc}
              onChange={(e) => setNewVersionDesc(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 min-h-20"
            />
            <div className="text-xs text-gray-500">
              当前共 {sources.length} 条水源地记录将被保存
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateSnapshot}
                disabled={creating}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 版本对比视图 */}
      {mode === 'diff' && selectedVersion && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={backToList} className="text-xs text-blue-600 hover:underline">
              &larr; 返回列表
            </button>
            <span className="text-sm font-medium text-gray-700">
              对比: 版本"{selectedVersion.name}" vs 当前数据
            </span>
            <span className="text-xs text-gray-400">
              ({formatVersionTime(selectedVersion.createdAt)})
            </span>
          </div>

          {diffResult && (
            <div className="space-y-4">
              {/* 汇总 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-700">{diffResult.added.length}</div>
                  <div className="text-xs text-green-600">新增</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-red-700">{diffResult.removed.length}</div>
                  <div className="text-xs text-red-600">删除</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-yellow-700">
                    {diffResult.modified.length}
                  </div>
                  <div className="text-xs text-yellow-600">修改</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-600">{diffResult.unchanged}</div>
                  <div className="text-xs text-gray-500">无变化</div>
                </div>
              </div>

              {/* 新增列表 */}
              {diffResult.added.length > 0 && (
                <div className="bg-white border border-green-200 rounded-lg">
                  <div className="px-4 py-2 bg-green-50 border-b border-green-200 text-sm font-medium text-green-800">
                    新增记录 ({diffResult.added.length})
                  </div>
                  <div className="divide-y divide-green-100">
                    {diffResult.added.map((item) => (
                      <div key={item.id} className="px-4 py-2 text-sm text-gray-700">
                        <span className="text-green-600 mr-2">+</span>
                        {item.name}
                        <span className="text-xs text-gray-400 ml-2">
                          {(item.data as Record<string, string>).type} /{' '}
                          {(item.data as Record<string, string>).county}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 删除列表 */}
              {diffResult.removed.length > 0 && (
                <div className="bg-white border border-red-200 rounded-lg">
                  <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm font-medium text-red-800">
                    删除记录 ({diffResult.removed.length})
                  </div>
                  <div className="divide-y divide-red-100">
                    {diffResult.removed.map((item) => (
                      <div key={item.id} className="px-4 py-2 text-sm text-gray-700">
                        <span className="text-red-600 mr-2">-</span>
                        {item.name}
                        <span className="text-xs text-gray-400 ml-2">
                          {(item.data as Record<string, string>).status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 修改列表 */}
              {diffResult.modified.length > 0 && (
                <div className="bg-white border border-yellow-200 rounded-lg">
                  <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-sm font-medium text-yellow-800">
                    修改记录 ({diffResult.modified.length})
                  </div>
                  <div className="divide-y divide-yellow-100">
                    {diffResult.modified.map((item) => (
                      <div key={item.id} className="px-4 py-2">
                        <div className="text-sm font-medium text-gray-700 mb-1">{item.name}</div>
                        <div className="space-y-1">
                          {item.changes.map((c, i) => (
                            <div key={i} className="text-xs flex gap-2">
                              <span className="text-gray-500 w-16 shrink-0">{c.field}:</span>
                              <span className="text-red-500 line-through">
                                {String(c.oldValue ?? '(空)')}
                              </span>
                              <span className="text-gray-300">&rarr;</span>
                              <span className="text-green-600">{String(c.newValue ?? '(空)')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 无差异 */}
              {diffResult.added.length === 0 &&
                diffResult.removed.length === 0 &&
                diffResult.modified.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    当前数据与此版本完全一致，无差异
                  </div>
                )}
            </div>
          )}

          {!diffResult && (
            <div className="text-center py-8 text-gray-400 text-sm">加载对比数据中...</div>
          )}
        </div>
      )}

      {/* 列表视图 */}
      {mode === 'list' && (
        <>
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 text-gray-300">📋</div>
              <p className="text-gray-500 text-sm mb-2">暂无版本快照</p>
              <p className="text-gray-400 text-xs">点击"创建快照"保存当前数据状态</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            v.type === 'manual'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {v.type === 'manual' ? '手动' : '自动'}
                        </span>
                        <span className="text-sm font-medium text-gray-800 truncate">{v.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatVersionTime(v.createdAt)} · {v.sourceCount} 条记录
                      </div>
                      {v.description && (
                        <div className="text-xs text-gray-500 mt-1">{v.description}</div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-4 shrink-0">
                      <button
                        onClick={() => handleViewDiff(v)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-blue-50 text-blue-600"
                        title="与当前数据对比"
                      >
                        对比
                      </button>
                      <button
                        onClick={() => handleRollback(v)}
                        disabled={rollingBack}
                        className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-amber-50 text-amber-600 disabled:opacity-50"
                        title="回滚到此版本"
                      >
                        回滚
                      </button>
                      <button
                        onClick={() => handleDeleteVersion(v)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-red-50 text-red-500"
                        title="删除版本"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VersionHistory;
