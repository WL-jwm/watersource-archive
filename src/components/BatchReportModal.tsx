/**
 * E2: 批量报告生成配置弹窗
 *
 * 功能：
 * - 选择输出格式（Word/PDF/两者）
 * - 选择是否打包ZIP
 * - 选择是否包含汇总报告
 * - 选择目标城市
 * - 选择报告模板
 * - 实时进度显示
 */

import { useState, useMemo } from 'react';
import {
  generateBatchReportsV2,
  groupByCity,
  type BatchFormat,
  type BatchProgress,
} from '@/lib/batchReportPackager';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ReportTemplate } from '@/lib/zoneReportGenerator';

interface Props {
  open: boolean;
  onClose: () => void;
  results: ZoneCalcRecord[];
  sources: WaterSourceRecord[];
}

export default function BatchReportModal({ open, onClose, results, sources }: Props) {
  const [format, setFormat] = useState<BatchFormat>('word');
  const [zipOutput, setZipOutput] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [template, setTemplate] = useState<ReportTemplate>('standard');
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [running, setRunning] = useState(false);

  // 按城市分组
  const cityGroups = useMemo(() => groupByCity(results, sources), [results, sources]);
  const allCities = useMemo(() => Array.from(cityGroups.keys()), [cityGroups]);

  const toggleCity = (city: string) => {
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCities.size === allCities.length) {
      setSelectedCities(new Set());
    } else {
      setSelectedCities(new Set(allCities));
    }
  };

  const handleGenerate = async () => {
    setRunning(true);
    setProgress(null);
    try {
      await generateBatchReportsV2(results, sources, {
        format,
        zipOutput,
        includeSummary,
        template,
        cityNames: selectedCities.size > 0 ? Array.from(selectedCities) : undefined,
        onProgress: (p) => setProgress(p),
      });
      onClose();
    } catch (err) {
      alert(`批量报告生成失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">批量报告生成</h2>
          <button
            onClick={onClose}
            disabled={running}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {progress ? (
          /* 进度显示 */
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{progress.percent}%</div>
              <div className="text-sm text-gray-500 mt-1">{progress.action}</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {progress.cityName ? `城市：${progress.cityName}` : '处理中...'}
              </span>
              <span>
                {progress.currentStep} / {progress.totalSteps}
              </span>
            </div>
            <p className="text-xs text-gray-400 text-center">
              {progress.percent < 100 ? '正在生成报告，请勿关闭页面' : '即将完成...'}
            </p>
          </div>
        ) : (
          /* 配置表单 */
          <div className="p-6 space-y-5">
            {/* 输出格式 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">输出格式</label>
              <div className="flex gap-2">
                {([
                  { value: 'word', label: 'Word (.docx)', icon: '📄' },
                  { value: 'pdf', label: 'PDF', icon: '📑' },
                  { value: 'both', label: 'Word + PDF', icon: '📚' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      format === opt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-1">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 输出方式 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">输出方式</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zipOutput}
                    onChange={(e) => setZipOutput(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>打包为 ZIP 文件下载（推荐，避免浏览器多文件下载混乱）</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSummary}
                    onChange={(e) => setIncludeSummary(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>包含全省汇总报告（额外生成一个总统计 Word 文件）</span>
                </label>
              </div>
            </div>

            {/* 报告模板 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">报告模板</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as ReportTemplate)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="simple">简化版（封面+概况+结果+汇总）</option>
                <option value="standard">标准版（含拐点坐标表）</option>
                <option value="detailed">详细版（含敏感性分析+合规性检查）</option>
              </select>
            </div>

            {/* 城市选择 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  目标城市（不选=全部 {allCities.length} 个城市）
                </label>
                <button
                  onClick={toggleAll}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {selectedCities.size === allCities.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {allCities.map((city) => (
                  <label
                    key={city}
                    className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCities.has(city)}
                      onChange={() => toggleCity(city)}
                      className="rounded border-gray-300"
                    />
                    <span>{city}</span>
                    <span className="text-gray-400">({cityGroups.get(city)?.length || 0})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 预估信息 */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
              {selectedCities.size > 0 ? (
                <span>
                  将生成 {selectedCities.size} 个城市的报告
                  {format === 'both' ? '（Word + PDF）' : format === 'word' ? '（Word）' : '（PDF）'}
                  {includeSummary && ' + 1 个汇总报告'}
                  {zipOutput && '，打包为 ZIP 下载'}
                </span>
              ) : (
                <span>
                  将生成 {allCities.length} 个城市的报告
                  {format === 'both' ? '（Word + PDF）' : format === 'word' ? '（Word）' : '（PDF）'}
                  {includeSummary && ' + 1 个汇总报告'}
                  {zipOutput && '，打包为 ZIP 下载'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 底部按钮 */}
        {!progress && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={running}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleGenerate}
              disabled={running || results.length === 0}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {running ? '生成中...' : '开始生成'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
