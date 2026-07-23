/**
 * B1: 报告生成配置弹窗
 *
 * 功能：
 * 1. 模板选择（简版/标准版/详版）
 * 2. 章节勾选
 * 3. 元数据填写（编号/编制单位/委托单位/编制人/审核人）
 * 4. 导出格式选择（Word/PDF）
 */

import React, { useState, useMemo } from 'react';
import type { ReportChapter, ReportTemplate, ReportConfig } from '@/lib/zoneReportGenerator';

const TEMPLATE_CHAPTERS: Record<ReportTemplate, ReportChapter[]> = {
  simple: ['cover', 'overview', 'sourceList', 'calcDetail', 'summary'],
  standard: ['cover', 'overview', 'sourceList', 'calcDetail', 'vertices', 'summary'],
  detailed: [
    'cover',
    'overview',
    'sourceList',
    'calcDetail',
    'vertices',
    'sensitivity',
    'summary',
    'compliance',
  ],
};

const CHAPTER_LABELS: Record<ReportChapter, string> = {
  cover: '封面',
  overview: '第一章 概述（依据/范围/方法）',
  sourceList: '第二章 水源地概况（清单表）',
  calcDetail: '第三章 保护区划分结果',
  vertices: '拐点坐标表',
  sensitivity: '敏感性分析',
  summary: '第四章 汇总统计',
  compliance: '第五章 合规性检查',
};

const TEMPLATE_LABELS: Record<ReportTemplate, string> = {
  simple: '简版',
  standard: '标准版',
  detailed: '详版',
};

const TEMPLATE_DESC: Record<ReportTemplate, string> = {
  simple: '仅含汇总表和统计，适合快速查看',
  standard: '含计算过程和拐点坐标，适合常规提交',
  detailed: '含图件/敏感性分析/合规检查，适合正式归档',
};

interface ReportConfigModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (config: ReportConfig, format: 'word' | 'pdf' | 'both') => void;
}

const ReportConfigModal: React.FC<ReportConfigModalProps> = ({ open, onClose, onGenerate }) => {
  const [template, setTemplate] = useState<ReportTemplate>('standard');
  const [chapters, setChapters] = useState<ReportChapter[]>(TEMPLATE_CHAPTERS.standard);
  const [reportNumber, setReportNumber] = useState('');
  const [compileUnit, setCompileUnit] = useState('');
  const [entrustUnit, setEntrustUnit] = useState('');
  const [compiler, setCompiler] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [format, setFormat] = useState<'word' | 'pdf' | 'both'>('word');

  // 切换模板时自动预设章节
  const handleTemplateChange = (t: ReportTemplate) => {
    setTemplate(t);
    setChapters(TEMPLATE_CHAPTERS[t]);
  };

  const toggleChapter = (ch: ReportChapter) => {
    if (chapters.includes(ch)) {
      setChapters(chapters.filter((c) => c !== ch));
    } else {
      setChapters([...chapters, ch]);
    }
  };

  const handleGenerate = () => {
    const config: ReportConfig = {
      template,
      chapters,
      reportNumber: reportNumber || undefined,
      compileUnit: compileUnit || undefined,
      entrustUnit: entrustUnit || undefined,
      compiler: compiler || undefined,
      reviewer: reviewer || undefined,
      includeVertices: chapters.includes('vertices'),
    };
    onGenerate(config, format);
    onClose();
  };

  if (!open) return null;

  const allChapters: ReportChapter[] = [
    'cover',
    'overview',
    'sourceList',
    'calcDetail',
    'vertices',
    'sensitivity',
    'summary',
    'compliance',
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 mx-4 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">报告生成配置</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* 模板选择 */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 mb-2 block">模板</label>
          <div className="flex gap-2">
            {(Object.keys(TEMPLATE_LABELS) as ReportTemplate[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTemplateChange(t)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  template === t
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div>{TEMPLATE_LABELS[t]}</div>
                <div className="text-[9px] text-gray-400 mt-0.5 font-normal">
                  {TEMPLATE_DESC[t]}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 章节勾选 */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 mb-2 block">章节内容</label>
          <div className="space-y-1">
            {allChapters.map((ch) => (
              <label
                key={ch}
                className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={chapters.includes(ch)}
                  onChange={() => toggleChapter(ch)}
                  className="w-3.5 h-3.5"
                />
                {CHAPTER_LABELS[ch]}
              </label>
            ))}
          </div>
        </div>

        {/* 元数据 */}
        <div className="mb-4 space-y-2">
          <label className="text-xs font-medium text-gray-600 block">报告信息</label>
          <input
            type="text"
            placeholder="报告编号（留空不填）"
            value={reportNumber}
            onChange={(e) => setReportNumber(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          />
          <input
            type="text"
            placeholder="编制单位"
            value={compileUnit}
            onChange={(e) => setCompileUnit(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          />
          <input
            type="text"
            placeholder="委托单位"
            value={entrustUnit}
            onChange={(e) => setEntrustUnit(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="编制人"
              value={compiler}
              onChange={(e) => setCompiler(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5"
            />
            <input
              type="text"
              placeholder="审核人"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5"
            />
          </div>
        </div>

        {/* 导出格式 */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 mb-2 block">导出格式</label>
          <div className="flex gap-2">
            {[
              { value: 'word' as const, label: 'Word (.docx)' },
              { value: 'pdf' as const, label: 'PDF (.pdf)' },
              { value: 'both' as const, label: 'Word + PDF' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFormat(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  format === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700"
          >
            生成报告
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportConfigModal;
