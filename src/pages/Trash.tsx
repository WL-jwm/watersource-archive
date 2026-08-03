/* ===== S11.8: 回收站页面 =====
 * 列表 + 过期倒计时 + 单条/批量恢复 + 清空 + 搜索
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import { formatExpiry, getDaysRemaining, type TrashItem } from '@/lib/trashEngine';

const Trash: React.FC = () => {
  const { restoreFromTrash, purgeTrash, listTrashItems, clearTrash } = useWaterSourceStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const trashItems = await listTrashItems();
      setItems(trashItems);
    } catch (err) {
      console.error('[Trash] 加载失败:', err);
    } finally {
      setLoading(false);
    }
  }, [listTrashItems]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  // 筛选
  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.record.name.toLowerCase().includes(term) ||
      item.record.cityName.toLowerCase().includes(term) ||
      item.record.county?.toLowerCase().includes(term)
    );
  });

  // 恢复单条
  const handleRestore = async (trashId: string) => {
    const result = await restoreFromTrash(trashId);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    await loadTrash();
  };

  // 批量恢复
  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      const result = await restoreFromTrash(id);
      if (result.success) successCount++;
      else failCount++;
    }
    if (failCount === 0) {
      toast.success(`成功恢复 ${successCount} 条记录`);
    } else {
      toast.warning(`恢复完成: 成功 ${successCount} 条, 失败 ${failCount} 条`);
    }
    setSelectedIds(new Set());
    await loadTrash();
  };

  // 彻底删除
  const handlePurge = async (trashId: string, name: string) => {
    const ok = await confirm(`确认彻底删除"${name}"？此操作不可恢复。`);
    if (!ok) return;
    await purgeTrash(trashId);
    toast.info(`已彻底删除"${name}"`);
    await loadTrash();
  };

  // 清空回收站
  const handleClearAll = async () => {
    if (items.length === 0) return;
    const ok = await confirm(`确认清空回收站？将彻底删除 ${items.length} 条记录，此操作不可恢复。`);
    if (!ok) return;
    const count = await clearTrash();
    toast.info(`已清空回收站，删除 ${count} 条记录`);
    setSelectedIds(new Set());
    await loadTrash();
  };

  // 全选/反选
  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // 倒计时颜色
  const getExpiryColor = (expiresAt: string): string => {
    const days = getDaysRemaining(expiresAt);
    if (days <= 0) return 'text-red-600 bg-red-50';
    if (days <= 7) return 'text-orange-600 bg-orange-50';
    if (days <= 14) return 'text-amber-600 bg-amber-50';
    return 'text-gray-500 bg-gray-50';
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">回收站</h1>
          <p className="text-sm text-gray-500 mt-1">
            已删除的水源地记录（保留 30 天）
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
          >
            清空回收站
          </button>
        )}
      </div>

      {/* 搜索 + 批量操作 */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="搜索水源地名称、城市、县区..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchRestore}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
            >
              恢复选中 ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4 text-gray-200">🗑️</div>
          <p className="text-gray-500 font-medium">回收站为空</p>
          <p className="text-gray-400 text-sm mt-1">删除的水源地记录将在此显示，保留 30 天</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-3 py-2 text-left text-gray-600">名称</th>
                <th className="px-3 py-2 text-left text-gray-600">城市</th>
                <th className="px-3 py-2 text-left text-gray-600">级别</th>
                <th className="px-3 py-2 text-left text-gray-600">类型</th>
                <th className="px-3 py-2 text-left text-gray-600">删除时间</th>
                <th className="px-3 py-2 text-left text-gray-600">过期</th>
                <th className="px-3 py-2 text-center text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-800 font-medium">{item.record.name}</td>
                  <td className="px-3 py-2 text-gray-600">{item.record.cityName}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {item.record.level === 'municipal' ? '市级' : item.record.level === 'county' ? '县级' : '乡镇级'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{item.record.type}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {new Date(item.deletedAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getExpiryColor(item.expiresAt)}`}>
                      {formatExpiry(item.expiresAt)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleRestore(item.id)}
                        className="text-blue-500 hover:text-blue-600 text-xs"
                      >
                        恢复
                      </button>
                      <span className="text-gray-200">|</span>
                      <button
                        onClick={() => handlePurge(item.id, item.record.name)}
                        className="text-red-500 hover:text-red-600 text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 底部统计 */}
      {items.length > 0 && (
        <div className="text-xs text-gray-400 text-right">
          共 {items.length} 条记录
          {selectedIds.size > 0 && ` · 已选 ${selectedIds.size} 条`}
        </div>
      )}
    </div>
  );
};

export default Trash;
