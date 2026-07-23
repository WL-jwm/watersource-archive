/**
 * 水源地新增/编辑模态框
 *
 * 替代原有 prompt() 链式输入，提供结构化表单：
 * - 水源地名称（必填）
 * - 所在城市（下拉选择）
 * - 所在县区（文本输入）
 * - 级别（下拉选择）
 * - 水源类型（地表水/地下水）
 * - 使用状态（下拉选择）
 * - 备注（可选）
 */

import React, { useState, useEffect } from 'react';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

const cityOptions = [
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
];

const levelOptions: { value: WaterSourceRecord['level']; label: string }[] = [
  { value: 'municipal', label: '市级' },
  { value: 'county', label: '县级' },
  { value: 'township', label: '乡镇级' },
];

const statusOptions = ['在用', '备用', '取消', '规划', '在建'];

const typeOptions: WaterSourceRecord['type'][] = ['地下水', '地表水'];

export interface SourceFormModalProps {
  open: boolean;
  /** 传入已有记录则为编辑模式，null 为新增模式 */
  source: WaterSourceRecord | null;
  onClose: () => void;
  onSubmit: (data: Omit<WaterSourceRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const SourceFormModal: React.FC<SourceFormModalProps> = ({ open, source, onClose, onSubmit }) => {
  const isEdit = !!source;

  const [form, setForm] = useState({
    name: '',
    cityName: '石家庄市',
    county: '',
    level: 'county' as WaterSourceRecord['level'],
    type: '地下水' as WaterSourceRecord['type'],
    status: '在用',
    remark: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // 编辑模式时填充表单
  useEffect(() => {
    if (source) {
      setForm({
        name: source.name,
        cityName: source.cityName,
        county: source.county,
        level: source.level,
        type: source.type,
        status: source.status,
        remark: source.remark || '',
      });
    } else {
      setForm({
        name: '',
        cityName: '石家庄市',
        county: '',
        level: 'county',
        type: '地下水',
        status: '在用',
        remark: '',
      });
    }
    setErrors({});
  }, [source, open]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '请输入水源地名称';
    if (!form.cityName) e.cityName = '请选择城市';
    if (!form.county.trim()) e.county = '请输入所在县区';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        cityName: form.cityName,
        county: form.county.trim(),
        level: form.level,
        type: form.type,
        status: form.status,
        remark: form.remark.trim(),
      });
      onClose();
    } catch {
      setErrors({ submit: '保存失败，请重试' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inputClass =
    'w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1';
  const errorClass = 'text-xs text-red-500 mt-0.5';

  return (
    /* 背景遮罩 */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      {/* 模态框主体 */}
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {isEdit ? '编辑水源地' : '新增水源地'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 表单内容 */}
        <div className="px-5 py-4 space-y-3">
          {/* 名称 */}
          <div>
            <label className={labelClass}>
              水源地名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：黄壁庄水库水源地"
              className={inputClass}
              autoFocus
            />
            {errors.name && <p className={errorClass}>{errors.name}</p>}
          </div>

          {/* 城市 + 县区 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                所在城市 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.cityName}
                onChange={(e) => setForm({ ...form, cityName: e.target.value })}
                className={inputClass}
              >
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.cityName && <p className={errorClass}>{errors.cityName}</p>}
            </div>
            <div>
              <label className={labelClass}>
                所在县区 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.county}
                onChange={(e) => setForm({ ...form, county: e.target.value })}
                placeholder="如：鹿泉区"
                className={inputClass}
              />
              {errors.county && <p className={errorClass}>{errors.county}</p>}
            </div>
          </div>

          {/* 级别 + 类型 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>级别</label>
              <select
                value={form.level}
                onChange={(e) =>
                  setForm({ ...form, level: e.target.value as WaterSourceRecord['level'] })
                }
                className={inputClass}
              >
                {levelOptions.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>水源类型</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as WaterSourceRecord['type'] })
                }
                className={inputClass}
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>使用状态</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClass}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 备注 */}
          <div>
            <label className={labelClass}>备注（可选）</label>
            <textarea
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              placeholder="如：千吨万人级集中式饮用水水源地"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* 提交错误 */}
          {errors.submit && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {errors.submit}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '保存中...' : isEdit ? '保存修改' : '确认新增'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SourceFormModal;
