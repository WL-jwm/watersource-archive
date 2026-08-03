/* ===== S11.7: 标签管理组件 =====
 * 标签列表 + 新增/编辑/删除 + 批量打标
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import {
  getAllTags, createTag, deleteTag,
  batchAddTag, batchRemoveTag, computeTagStats,
  TAG_COLORS, TAG_GROUPS, type TagDef,
} from '@/lib/tagEngine';

interface TagManagerProps {
  selectedIds: string[];
  onClose: () => void;
}

const TagManager: React.FC<TagManagerProps> = ({ selectedIds, onClose }) => {
  const { sources, updateSource } = useWaterSourceStore();
  const toast = useToast();

  const [tags, setTags] = useState<TagDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [newGroup, setNewGroup] = useState(TAG_GROUPS[0]);
  // editingId 保留用于未来编辑功能

  const loadTags = useCallback(async () => {
    setLoading(true);
    const result = await getAllTags();
    setTags(result);
    setLoading(false);
  }, []);

  useEffect(() => { loadTags(); }, [loadTags]);

  const selectedRecords = sources.filter((s) => selectedIds.includes(s.id));
  const stats = computeTagStats(sources, tags);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.warning('标签名称不能为空');
      return;
    }
    await createTag(newName, newColor, newGroup);
    toast.success(`标签"${newName}"已创建`);
    setNewName('');
    await loadTags();
  };

  const handleDelete = async (id: string, name: string) => {
    await deleteTag(id);
    toast.info(`标签"${name}"已删除`);
    await loadTags();
  };

  const handleBatchTag = async (tagId: string, tagName: string) => {
    const updated = batchAddTag(selectedRecords, tagId);
    for (const rec of updated) {
      await updateSource(rec.id, { tags: rec.tags });
    }
    toast.success(`已给 ${selectedIds.length} 条记录添加标签"${tagName}"`);
  };

  const handleBatchUntag = async (tagId: string, tagName: string) => {
    const updated = batchRemoveTag(selectedRecords, tagId);
    for (const rec of updated) {
      await updateSource(rec.id, { tags: rec.tags });
    }
    toast.info(`已从 ${selectedIds.length} 条记录移除标签"${tagName}"`);
  };

  // 按分组组织标签
  const groupedTags = TAG_GROUPS.map((group) => ({
    group,
    items: tags.filter((t) => t.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">
            标签管理
            {selectedIds.length > 0 && (
              <span className="ml-2 text-sm text-blue-600">（已选 {selectedIds.length} 条）</span>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* 新建标签 */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium text-gray-600">新建标签</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="标签名称"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {TAG_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">颜色:</span>
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${newColor === c ? 'border-gray-800' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
            >
              添加标签
            </button>
          </div>

          {/* 标签列表 */}
          {loading ? (
            <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              暂无标签，请在上方创建
            </div>
          ) : (
            <div className="space-y-3">
              {groupedTags.map(({ group, items }) => (
                <div key={group}>
                  <div className="text-xs font-medium text-gray-400 mb-2">{group}</div>
                  <div className="space-y-1">
                    {items.map((tag) => {
                      const tagStat = stats.byTag.find((s) => s.tagId === tag.id);
                      const selectedHasTag = selectedRecords.filter((r) => r.tags?.includes(tag.id)).length;
                      return (
                        <div key={tag.id} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                          <span
                            className="px-2 py-0.5 rounded text-xs text-white font-medium"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            共 {tagStat?.count || 0} 条
                            {selectedIds.length > 0 && ` · 选中 ${selectedHasTag} 条`}
                          </span>
                          <div className="flex-1" />
                          {selectedIds.length > 0 && (
                            <>
                              <button
                                onClick={() => handleBatchTag(tag.id, tag.name)}
                                className="text-xs text-blue-500 hover:text-blue-600"
                              >
                                打标
                              </button>
                              <button
                                onClick={() => handleBatchUntag(tag.id, tag.name)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                移标
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(tag.id, tag.name)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            删除
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagManager;
