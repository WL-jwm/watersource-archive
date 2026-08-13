/**
 * P8.1: 保护区审计规则管理页面
 *
 * 对实际边界图层的"已取消/已调整"审计规则进行可视化管理，
 * 支持新增 / 编辑 / 删除 / 恢复默认，省政府批复更新无需改代码。
 *
 * 规则持久化于 localStorage（zoneAuditStore），地图图层读取生效规则集。
 */

import React, { useMemo, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useZoneAuditStore } from '@/data/zoneAuditStore';
import type { ZoneAuditRule, ZoneAuditStatus } from '@/data/zoneAuditMeta';

const CITIES = [
  '石家庄市',
  '唐山市',
  '秦皇岛市',
  '邯郸市',
  '邢台市',
  '保定市',
  '张家口市',
  '承德市',
  '沧州市',
  '廊坊市',
  '衡水市',
  '辛集市',
  '定州市',
  '雄安新区',
];

const statusMeta: Record<ZoneAuditStatus, { label: string; badge: string }> = {
  cancelled: { label: '已取消', badge: 'bg-red-100 text-red-700' },
  adjusted: { label: '已调整', badge: 'bg-orange-100 text-orange-700' },
};

interface EditorState {
  open: boolean;
  index: number | null;
  city: string;
  keywords: string;
  status: ZoneAuditStatus;
  note: string;
  ref: string;
}

const emptyEditor = (): EditorState => ({
  open: false,
  index: null,
  city: CITIES[0],
  keywords: '',
  status: 'cancelled',
  note: '',
  ref: '',
});

const ZoneAuditManager: React.FC = () => {
  const rules = useZoneAuditStore((s) => s.rules);
  const isCustomized = useZoneAuditStore((s) => s.isCustomized);
  const addRule = useZoneAuditStore((s) => s.addRule);
  const updateRule = useZoneAuditStore((s) => s.updateRule);
  const deleteRule = useZoneAuditStore((s) => s.deleteRule);
  const resetToDefault = useZoneAuditStore((s) => s.resetToDefault);
  const confirm = useConfirm();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);

  const stats = useMemo(() => {
    const cancelled = rules.filter((r) => r.status === 'cancelled').length;
    return { total: rules.length, cancelled, adjusted: rules.length - cancelled };
  }, [rules]);

  const openCreate = () => setEditor(emptyEditor());
  const openEdit = (index: number, rule: ZoneAuditRule) =>
    setEditor({
      open: true,
      index,
      city: rule.city,
      keywords: rule.keywords.join('、'),
      status: rule.status,
      note: rule.note,
      ref: rule.ref,
    });
  const closeEditor = () => setEditor((e) => ({ ...e, open: false }));

  const saveEditor = () => {
    if (!editor.city.trim() || !editor.keywords.trim()) return;
    const rule: ZoneAuditRule = {
      city: editor.city.trim(),
      keywords: editor.keywords
        .split(/[、,，\s]+/)
        .map((k) => k.trim())
        .filter(Boolean),
      status: editor.status,
      note: editor.note.trim(),
      ref: editor.ref.trim(),
    };
    if (rule.keywords.length === 0) return;
    if (editor.index === null) addRule(rule);
    else updateRule(editor.index, rule);
    closeEditor();
  };

  const handleDelete = async (index: number, name: string) => {
    const ok = await confirm({
      title: '删除审计规则',
      message: `确定删除"${name}"这条规则吗？删除后地图图层将不再对该保护区做特殊标记。`,
      confirmText: '删除',
    });
    if (ok) deleteRule(index);
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: '恢复默认规则',
      message: '将丢弃所有自定义修改，恢复为内置默认规则（满城/南大港/定州经开区等）。',
      confirmText: '恢复默认',
    });
    if (ok) resetToDefault();
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">保护区审计规则</h1>
          <p className="text-xs text-text-tertiary mt-1">
            实际边界图层的"已取消/已调整"标记规则，可按省政府最新批复随时维护。修改后地图图层即时生效。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!isCustomized}
            className="px-3 py-1.5 text-xs rounded-md border border-border text-text-secondary hover:bg-surface-tertiary disabled:opacity-40"
          >
            恢复默认
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            + 新增规则
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="text-2xl font-bold text-text-primary">{stats.total}</div>
          <div className="text-xs text-text-tertiary">规则总数</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          <div className="text-xs text-red-500">已取消</div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
          <div className="text-2xl font-bold text-orange-600">{stats.adjusted}</div>
          <div className="text-xs text-orange-500">已调整</div>
        </div>
      </div>

      {!isCustomized && (
        <div className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
          当前使用内置默认规则。您可按需新增或修改，修改后将以自定义规则持久化保存。
        </div>
      )}

      {/* 规则表格 */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-tertiary text-left text-xs text-text-tertiary">
              <th className="px-3 py-2 font-medium">城市</th>
              <th className="px-3 py-2 font-medium">关键词</th>
              <th className="px-3 py-2 font-medium">状态</th>
              <th className="px-3 py-2 font-medium">说明</th>
              <th className="px-3 py-2 font-medium">批复</th>
              <th className="px-3 py-2 font-medium w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, i) => (
              <tr key={i} className="border-t border-border hover:bg-surface-tertiary/50">
                <td className="px-3 py-2 text-text-primary">{rule.city}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {rule.keywords.map((k, j) => (
                      <span
                        key={j}
                        className="text-[11px] bg-surface-tertiary text-text-secondary rounded px-1.5 py-0.5"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block text-[11px] px-2 py-0.5 rounded-full ${statusMeta[rule.status].badge}`}
                  >
                    {statusMeta[rule.status].label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">{rule.note}</td>
                <td className="px-3 py-2 text-xs text-text-tertiary">{rule.ref}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(i, rule)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(i, rule.city)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-text-tertiary">
                  暂无规则。点击"新增规则"添加，或"恢复默认"载入内置规则。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 编辑弹窗 */}
      {editor.open && (
        <div className="fixed inset-0 z-[2000] bg-black/30 flex items-center justify-center p-4">
          <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">
                {editor.index === null ? '新增规则' : '编辑规则'}
              </h2>
              <button onClick={closeEditor} className="text-text-tertiary hover:text-text-primary">
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs text-text-tertiary mb-1">城市</label>
              <select
                value={editor.city}
                onChange={(e) => setEditor((s) => ({ ...s, city: e.target.value }))}
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-text-tertiary mb-1">
                关键词（用逗号分隔，命中任一即标记）
              </label>
              <input
                value={editor.keywords}
                onChange={(e) => setEditor((s) => ({ ...s, keywords: e.target.value }))}
                placeholder="如：满城、满城区"
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
              />
            </div>

            <div>
              <label className="block text-xs text-text-tertiary mb-1">状态</label>
              <select
                value={editor.status}
                onChange={(e) =>
                  setEditor((s) => ({ ...s, status: e.target.value as ZoneAuditStatus }))
                }
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
              >
                <option value="cancelled">已取消</option>
                <option value="adjusted">已调整</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-text-tertiary mb-1">说明</label>
              <input
                value={editor.note}
                onChange={(e) => setEditor((s) => ({ ...s, note: e.target.value }))}
                placeholder="如：保定市满城区县城水源保护区已取消"
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
              />
            </div>

            <div>
              <label className="block text-xs text-text-tertiary mb-1">批复文号</label>
              <input
                value={editor.ref}
                onChange={(e) => setEditor((s) => ({ ...s, ref: e.target.value }))}
                placeholder="如：冀政字〔2021〕41号"
                className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-surface"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeEditor}
                className="px-3 py-1.5 text-xs rounded-md border border-border text-text-secondary"
              >
                取消
              </button>
              <button
                onClick={saveEditor}
                disabled={!editor.city.trim() || !editor.keywords.trim()}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoneAuditManager;
