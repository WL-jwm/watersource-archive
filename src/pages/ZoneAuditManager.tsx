/**
 * P8.1/P8.3: 保护区审计与缺失清单管理页面
 *
 * 两个 Tab：
 * - 「规则」：实际边界图层的"已取消/已调整"标记规则，支持新增/编辑/删除/恢复默认
 * - 「缺失清单」：官方新增/调整但 KMZ 缺失的保护区，支持逐项标记"已补充"与进度统计
 *
 * 规则持久化于 localStorage（zoneAuditStore），缺失清单状态持久化于 missingZonesStore，
 * 地图图层读取生效规则集，无需改代码。
 */

import React, { useMemo, useState } from 'react';
import { useConfirm } from '@/hooks/useConfirm';
import { useZoneAuditStore } from '@/data/zoneAuditStore';
import { useMissingZonesStore } from '@/data/missingZonesStore';
import { MISSING_ZONES, type ZoneAuditRule, type ZoneAuditStatus } from '@/data/zoneAuditMeta';

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

type TabKey = 'rules' | 'missing';

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

  const marked = useMissingZonesStore((s) => s.marked);
  const toggleMarked = useMissingZonesStore((s) => s.toggleMarked);
  const resetMarked = useMissingZonesStore((s) => s.reset);

  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabKey>('rules');
  const [editor, setEditor] = useState<EditorState>(emptyEditor);

  const stats = useMemo(() => {
    const cancelled = rules.filter((r) => r.status === 'cancelled').length;
    return { total: rules.length, cancelled, adjusted: rules.length - cancelled };
  }, [rules]);

  const missingStats = useMemo(() => {
    const total = MISSING_ZONES.length;
    const done = MISSING_ZONES.filter((m) => marked.includes(m.name)).length;
    return { total, done, remain: total - done };
  }, [marked]);

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

  const handleResetRules = async () => {
    const ok = await confirm({
      title: '恢复默认规则',
      message: '将丢弃所有自定义修改，恢复为内置默认规则（满城/南大港/定州经开区等）。',
      confirmText: '恢复默认',
    });
    if (ok) resetToDefault();
  };

  const handleResetMissing = async () => {
    const ok = await confirm({
      title: '重置缺失清单',
      message: '将清空全部"已补充"标记，所有缺失项重新显示为待补充。',
      confirmText: '重置',
    });
    if (ok) resetMarked();
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">保护区数据核验</h1>
          <p className="text-xs text-text-tertiary mt-1">
            维护实际边界图层的"已取消/已调整"标记规则，并追踪官方新增但 KMZ 缺失的保护区，确保叠加分析不遗漏、不误用。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'rules' ? (
            <>
              <button
                onClick={handleResetRules}
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
            </>
          ) : (
            <button
              onClick={handleResetMissing}
              disabled={missingStats.done === 0}
              className="px-3 py-1.5 text-xs rounded-md border border-border text-text-secondary hover:bg-surface-tertiary disabled:opacity-40"
            >
              重置已补充
            </button>
          )}
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'rules'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          审计规则
          <span className="ml-1.5 text-[10px] bg-surface-tertiary rounded-full px-1.5 py-0.5">
            {stats.total}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('missing')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'missing'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          缺失清单
          {missingStats.remain > 0 && (
            <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
              {missingStats.remain} 待补充
            </span>
          )}
        </button>
      </div>

      {activeTab === 'rules' ? (
        <>
          {/* 规则统计卡片 */}
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
        </>
      ) : (
        <>
          {/* 缺失清单统计卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface border border-border rounded-lg p-3">
              <div className="text-2xl font-bold text-text-primary">{missingStats.total}</div>
              <div className="text-xs text-text-tertiary">缺失项总数</div>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{missingStats.done}</div>
              <div className="text-xs text-green-500">已补充</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-600">{missingStats.remain}</div>
              <div className="text-xs text-amber-500">待补充</div>
            </div>
          </div>

          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
            以下保护区为省政府批复的新增/调整项，但 2021 年 KMZ 数据中缺失，需补充边界后才能用于避让分析。补充完成后可标记"已补充"。
          </div>

          {/* 缺失清单表格 */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-tertiary text-left text-xs text-text-tertiary">
                  <th className="px-3 py-2 font-medium">城市</th>
                  <th className="px-3 py-2 font-medium">缺失保护区</th>
                  <th className="px-3 py-2 font-medium">批复</th>
                  <th className="px-3 py-2 font-medium">说明</th>
                  <th className="px-3 py-2 font-medium w-24">状态</th>
                </tr>
              </thead>
              <tbody>
                {MISSING_ZONES.map((m) => {
                  const done = marked.includes(m.name);
                  return (
                    <tr
                      key={m.name}
                      className={`border-t border-border ${
                        done ? 'bg-green-50/50 opacity-60' : 'hover:bg-surface-tertiary/50'
                      }`}
                    >
                      <td className="px-3 py-2 text-text-primary">{m.city}</td>
                      <td className="px-3 py-2 text-text-primary">{m.name}</td>
                      <td className="px-3 py-2 text-xs text-text-tertiary">{m.ref}</td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{m.note}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleMarked(m.name)}
                          className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                            done
                              ? 'border-green-300 text-green-600 bg-green-50 hover:bg-green-100'
                              : 'border-border text-text-secondary hover:bg-surface-tertiary'
                          }`}
                        >
                          {done ? '✓ 已补充' : '标记已补充'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 编辑弹窗（仅规则 Tab） */}
      {activeTab === 'rules' && editor.open && (
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
