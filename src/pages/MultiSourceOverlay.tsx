/**
 * S5.3: 多水源地叠加分析页面
 *
 * 整合水源地选择器、地图面板、统计卡片、重叠列表、导出工具栏
 */

import React, { useEffect, useState } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import OverlaySourceSelector from '@/components/overlay/OverlaySourceSelector';
import OverlayMapPanel from '@/components/overlay/OverlayMapPanel';
import OverlayStatsCard from '@/components/overlay/OverlayStatsCard';
import OverlayPairwiseList from '@/components/overlay/OverlayPairwiseList';
import OverlayExportBar from '@/components/overlay/OverlayExportBar';
import EmptyState from '@/components/EmptyState';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { ZoneLevel } from '@/lib/multiSourceOverlayEngine';

const MultiSourceOverlay: React.FC = () => {
  const {
    analyses,
    currentAnalysisId,
    calculating,
    runOverlay,
    deleteAnalysis,
    loadAnalyses,
    loaded,
    setCurrentAnalysis,
  } = useOverlayStore();
  const { sources, zoneResults } = useWaterSourceStore();
  const toast = useToast();
  const confirm = useConfirm();

  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<ZoneLevel[]>(['一级']);
  const [analysisName, setAnalysisName] = useState('');

  // 初始加载已保存的分析结果
  useEffect(() => {
    if (!loaded) {
      loadAnalyses();
    }
  }, [loaded, loadAnalyses]);

  const currentAnalysis = analyses.find((a) => a.id === currentAnalysisId) ?? null;

  const handleRun = async () => {
    try {
      const name = analysisName.trim() || `${selectedSourceIds.length}个水源地叠加分析`;
      await runOverlay(
        {
          sourceIds: selectedSourceIds,
          levels: selectedLevels,
          useClippedGeometry: false,
          analysisName: name,
        },
        sources,
        zoneResults,
      );
      toast.success('叠加分析完成');
    } catch {
      toast.error('叠加分析失败');
    }
  };

  const handleDelete = async () => {
    if (!currentAnalysis) return;
    const ok = await confirm({
      message: `确定要删除分析"${currentAnalysis.analysisName}"吗？此操作不可恢复。`,
      danger: true,
      confirmText: '删除',
      cancelText: '取消',
    });
    if (ok) {
      await deleteAnalysis(currentAnalysis.id);
      toast.success('分析已删除');
    }
  };

  const handleSelectAnalysis = (id: string) => {
    setCurrentAnalysis(id);
  };

  return (
    <div className="min-h-full bg-background p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">多水源地叠加分析</h1>
            <p className="text-sm text-text-tertiary mt-0.5">
              对多个水源地保护区进行空间叠加分析，计算合并面积和重叠区域
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          {/* 左侧：选择器 + 历史记录 */}
          <div className="space-y-4">
            <OverlaySourceSelector
              selectedSourceIds={selectedSourceIds}
              selectedLevels={selectedLevels}
              analysisName={analysisName}
              onSourceIdsChange={setSelectedSourceIds}
              onLevelsChange={setSelectedLevels}
              onAnalysisNameChange={setAnalysisName}
              onRun={handleRun}
              calculating={calculating}
            />

            {/* 历史分析记录 */}
            <div className="bg-surface rounded-lg border border-surface-border p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                历史分析（{analyses.length}）
              </h3>
              {!loaded ? (
                <LoadingSpinner size="sm" text="加载中..." />
              ) : analyses.length === 0 ? (
                <p className="text-xs text-text-tertiary text-center py-3">暂无分析记录</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {analyses.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAnalysis(a.id)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        currentAnalysisId === a.id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-surface-tertiary border border-transparent'
                      }`}
                    >
                      <div className="text-xs font-medium text-text-primary truncate">
                        {a.analysisName}
                      </div>
                      <div className="text-[10px] text-text-tertiary">
                        {a.sourceCount} 个水源地 · {a.overlaps.length} 对重叠 ·{' '}
                        {new Date(a.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：分析结果 */}
          <div className="space-y-4">
            {calculating ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" text="正在执行叠加分析..." />
              </div>
            ) : currentAnalysis ? (
              <>
                <OverlayExportBar result={currentAnalysis} onDelete={handleDelete} />
                <OverlayStatsCard result={currentAnalysis} />
                <OverlayMapPanel result={currentAnalysis} />
                <OverlayPairwiseList result={currentAnalysis} />
              </>
            ) : (
              <EmptyState
                title="尚未执行叠加分析"
                description="请在左侧选择 2 个以上已计算保护区的水源地，选择保护区级别后点击「执行叠加分析」"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiSourceOverlay;
