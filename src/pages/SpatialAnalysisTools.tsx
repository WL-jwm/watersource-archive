/* ===== S12 Batch5: 空间分析工具箱页面 =====
 * 整合 S12.8 空间分析报告 / S12.10 多项目批量评估 / S12.12 空间数据导入
 */
import React, { useState, useMemo } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import {
  querySpatialContext,
  type QuerySource,
} from '@/lib/spatialQueryEngine';
import type { SensitiveTarget } from '@/lib/sensitiveScreeningEngine';
import {
  buildSpatialReport,
  type SpatialReportInput,
} from '@/lib/spatialAnalysisReportEngine';
import {
  assessProjectsBatch,
  assessmentToCsv,
  type AssessedProjectInput,
} from '@/lib/multiProjectAssessmentEngine';
import {
  parseSpatialData,
  type SpatialFormat,
  type SpatialFeature,
} from '@/lib/spatialDataImportEngine';
import { riskLevelColor } from '@/lib/riskMatrixEngine';
import { type SpatialAnalysisRecord, useSpatialAnalysisStore } from '@/stores/spatialAnalysisStore';
import { useLoading, LoadingButton } from '@/lib/useLoading';
import {
  previewHtmlReport,
  downloadPdfReport,
  downloadDocxReport,
} from '@/lib/reportExportEngine';
import ActualBoundaryTab from '@/components/spatial/ActualBoundaryTab';

// ===== 数据构造 =====

interface Props {
  sources?: QuerySource[];
  sensitiveTargets?: SensitiveTarget[];
}

type Tab = 'report' | 'batch' | 'import' | 'history' | 'actual';

const SpatialAnalysisTools: React.FC<Props> = () => {
  const { loaded, initDB, sources: storeSources } = useWaterSourceStore();

  // 从 store 构造查询源（带坐标的水源地）
  const querySources = useMemo<QuerySource[]>(() => {
    if (!storeSources) return [];
    return storeSources
      .filter((s) => s.lng !== undefined && s.lat !== undefined)
      .map((s) => ({
        id: s.id,
        name: s.name,
        cityName: s.cityName,
        lng: s.lng as number,
        lat: s.lat as number,
        level: s.level,
        type: s.type,
        zoneRadiusM: 500,
      }));
  }, [storeSources]);

  const [tab, setTab] = useState<Tab>('report');
  const { loadAnalyses } = useSpatialAnalysisStore();

  // 初始化时加载历史记录
  React.useEffect(() => { initDB(); }, []);
  React.useEffect(() => { loadAnalyses(); }, [loadAnalyses]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'report', label: '空间分析报告' },
    { id: 'batch', label: '多项目批量评估' },
    { id: 'import', label: '空间数据导入' },
    { id: 'actual', label: '实际边界避让' },
    { id: 'history', label: '历史记录' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">空间分析工具箱</h1>
        <p className="text-sm text-text-tertiary mt-1">
          综合空间分析报告 · 多项目批量评估 · 空间数据导入
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6 border-b border-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-accent-500 text-white'
                : 'text-text-secondary hover:bg-surface-tertiary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!loaded && (
        <div className="text-sm text-text-tertiary mb-4">数据加载中...</div>
      )}

      {tab === 'report' && (
        <ReportTab sources={querySources} />
      )}
      {tab === 'batch' && (
        <BatchTab sources={querySources} />
      )}
      {tab === 'import' && (
        <ImportTab />
      )}
      {tab === 'actual' && (
        <ActualBoundaryTab />
      )}
      {tab === 'history' && (
        <HistoryTab />
      )}
    </div>
  );
};

/* ===== 报告 Tab ===== */
const ReportTab: React.FC<{ sources: QuerySource[] }> = ({ sources }) => {
  const [lng, setLng] = useState('');
  const [lat, setLat] = useState('');
  const [name, setName] = useState('');
  const [report, setReport] = useState<SpatialReportInput | null>(null);
  const { saveAnalysis } = useSpatialAnalysisStore();

  const runReport = () => {
    const lngV = parseFloat(lng);
    const latV = parseFloat(lat);
    if (isNaN(lngV) || isNaN(latV)) {
      alert('请输入有效的经度/纬度');
      return;
    }
    const query = querySpatialContext({
      lng: lngV,
      lat: latV,
      sources,
    });
    const input: SpatialReportInput = { projectName: name || '未命名项目', point: { lng: lngV, lat: latV }, query };
    setReport(input);

    // 自动保存到历史记录
    const record: SpatialAnalysisRecord = {
      id: `sa-${Date.now()}`,
      name: `综合报告 - ${name || '未命名'}`,
      createdAt: new Date().toISOString(),
      analysisType: 'comprehensive',
      projectPoint: { lng: lngV, lat: latV },
      projectName: name || '未命名项目',
      sourceCount: sources.length,
      riskLevel: query.riskLabel,
      insideAnyZone: query.insideAnyZone,
      nearestSourceName: query.nearestSummary.split('(')[0]?.trim() || undefined,
      sensitiveCount: query.sensitiveScreening?.totalCount,
      reportInput: input,
    };
    saveAnalysis(record).catch(console.warn);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3 h-fit">
        <h2 className="text-sm font-semibold text-text-primary">报告参数</h2>
        <div>
          <label className="text-xs text-text-tertiary">项目名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-400 bg-surface"
            placeholder="例如：石家庄某工业项目"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-tertiary">经度</label>
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-400 bg-surface"
              placeholder="114.5"
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary">纬度</label>
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-400 bg-surface"
              placeholder="38.1"
            />
          </div>
        </div>
        <button
          onClick={runReport}
          className="w-full py-2 bg-accent-500 text-white rounded-md text-sm font-medium hover:bg-accent-600 transition-colors"
        >
          生成综合报告
        </button>
      </div>

      <div className="space-y-4">
        {!report ? (
          <div className="text-sm text-text-tertiary text-center py-20 border border-dashed border-border rounded-lg">
            输入坐标后生成空间分析综合报告
          </div>
        ) : (
          <ReportPreview input={report} />
        )}
      </div>
    </div>
  );
};

const ReportPreview: React.FC<{ input: SpatialReportInput }> = ({ input }) => {
  const report = useMemo(() => buildSpatialReport(input), [input]);
  const [showAll, setShowAll] = useState(false);
  const { loading: htmlLoading, run: runHtmlPreview } = useLoading();
  const { loading: pdfLoading, run: runPdfDownload } = useLoading();
  const { loading: docxLoading, run: runDocxDownload } = useLoading();

  const visible = showAll ? report.sections : report.sections.slice(0, 4);

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{report.title}</h2>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-accent-600 hover:underline"
        >
          {showAll ? '收起' : '展开全部'}
        </button>
      </div>
      <div className="text-xs text-text-tertiary">
        分析对象：{report.projectName} · 章节 {report.sections.length}
      </div>

      {visible.map((s, i) => (
        <div key={i} className="border-t border-border pt-3">
          <h3 className="text-sm font-semibold text-text-primary mb-1">{s.heading}</h3>
          {s.paragraphs.map((p, j) => (
            <p key={j} className="text-sm text-text-secondary leading-relaxed mb-1">{p}</p>
          ))}
          {s.table && (
            <table className="w-full text-xs mt-2 border-collapse">
              <thead>
                <tr>
                  {s.table.headers.map((h, k) => (
                    <th key={k} className="border border-border bg-surface-tertiary px-2 py-1 text-left text-text-primary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.table.rows.map((r, k) => (
                  <tr key={k}>
                    {r.map((c, m) => (
                      <td key={m} className="border border-border px-2 py-1 text-text-secondary">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* 导出按钮 */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <LoadingButton
          onClick={runHtmlPreview(() => previewHtmlReport(report))}
          loading={htmlLoading}
          loadingText="预览中..."
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          HTML 预览
        </LoadingButton>
        <LoadingButton
          onClick={runPdfDownload(() => downloadPdfReport(report))}
          loading={pdfLoading}
          loadingText="生成 PDF 中..."
          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
        >
          下载 PDF
        </LoadingButton>
        <LoadingButton
          onClick={runDocxDownload(() => downloadDocxReport(report))}
          loading={docxLoading}
          loadingText="生成 Word 中..."
          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
        >
          下载 Word
        </LoadingButton>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-3">
        <div className="text-xs font-semibold text-amber-700 mb-1">综合结论</div>
        <div className="text-sm text-amber-800 leading-relaxed">{report.conclusion}</div>
      </div>
    </div>
  );
};

/* ===== 批量评估 Tab ===== */
const BatchTab: React.FC<{ sources: QuerySource[] }> = ({ sources }) => {
  const [projectsText, setProjectsText] = useState(
    '项目A,114.5,38.1,工业\n项目B,115.0,38.5,住宅',
  );
  const [result, setResult] = useState<ReturnType<typeof assessProjectsBatch> | null>(null);
  const [error, setError] = useState('');
  const { saveAnalysis } = useSpatialAnalysisStore();
  const { loading: csvLoading, run: runCsvExport } = useLoading();

  const runBatch = () => {
    const projects: AssessedProjectInput[] = [];
    const lines = projectsText.split('\n').filter((l) => l.trim());
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',').map((s) => s.trim());
      const [pname, plng, plat, ptype] = parts;
      const lngV = parseFloat(plng);
      const latV = parseFloat(plat);
      if (isNaN(lngV) || isNaN(latV)) {
        setError(`第 ${i + 1} 行坐标无效`);
        return;
      }
      projects.push({ id: `p${i}`, name: pname || `项目${i + 1}`, lng: lngV, lat: latV, type: ptype, radiusM: 100 });
    }

    const zones = sources.map((s) => ({
      sourceId: s.id,
      sourceName: s.name,
      level: s.level,
      centerLng: s.lng,
      centerLat: s.lat,
      radiusM: s.zoneRadiusM,
    }));

    const r = assessProjectsBatch({ projects, zones });
    setResult(r);
    setError('');

    // 自动保存到历史记录
    const record: SpatialAnalysisRecord = {
      id: `sa-batch-${Date.now()}`,
      name: `批量评估 - ${projects.length} 个项目`,
      createdAt: new Date().toISOString(),
      analysisType: 'batch',
      projectPoint: { lng: 0, lat: 0 },
      sourceCount: sources.length,
      riskLevel: r.riskCounts.red > 0 ? 'red' : r.riskCounts.yellow > 0 ? 'yellow' : 'green',
      batchProjectCount: projects.length,
      description: `红线${r.riskCounts.red}个/黄线${r.riskCounts.yellow}个/重叠${r.overlapCount}个/禁止${r.bannedCount}个`,
    };
    saveAnalysis(record).catch(console.warn);
  };

  const exportCsv = () => {
    if (!result) return;
    const csv = assessmentToCsv(result);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '批量评估汇总.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3 h-fit">
        <h2 className="text-sm font-semibold text-text-primary">批量项目输入</h2>
        <div className="text-xs text-text-tertiary">
          每行一个项目：名称,经度,纬度,类型
        </div>
        <textarea
          value={projectsText}
          onChange={(e) => setProjectsText(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-400 bg-surface font-mono"
        />
        {error && <div className="text-xs text-red-600">{error}</div>}
        <div className="flex gap-2">
          <button
            onClick={runBatch}
            className="flex-1 py-2 bg-accent-500 text-white rounded-md text-sm font-medium hover:bg-accent-600 transition-colors"
          >
            执行批量评估
          </button>
          <button
            onClick={runCsvExport(exportCsv)}
            disabled={!result}
            className="px-4 py-2 border border-border rounded-md text-sm hover:bg-surface-tertiary disabled:opacity-40"
          >
            {csvLoading ? '导出中...' : '导出CSV'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {!result ? (
          <div className="text-sm text-text-tertiary text-center py-20 border border-dashed border-border rounded-lg">
            输入项目列表后执行批量综合评估
          </div>
        ) : (
          <BatchResultView result={result} />
        )}
      </div>
    </div>
  );
};

const BatchResultView: React.FC<{ result: ReturnType<typeof assessProjectsBatch> }> = ({ result }) => {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatCard label="项目总数" value={String(result.totalProjects)} />
        <StatCard label="红线" value={String(result.riskCounts.red)} color="red" />
        <StatCard label="黄线" value={String(result.riskCounts.yellow)} color="amber" />
        <StatCard label="重叠" value={String(result.overlapCount)} color="red" />
        <StatCard label="禁止建设" value={String(result.bannedCount)} color="red" />
        <StatCard label="上游" value={String(result.upstreamCount)} color="amber" />
      </div>

      {/* 明细表 */}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {['项目', '风险', '重叠', '禁止', '上游', '敏感', '结论'].map((h) => (
              <th key={h} className="border border-border bg-surface-tertiary px-2 py-1.5 text-left text-text-primary">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.summaryTable.map((r, i) => (
            <tr key={i}>
              <td className="border border-border px-2 py-1.5 text-text-primary font-medium">{r.projectName}</td>
              <td className="border border-border px-2 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-xs ${riskLevelColor(r.risk as never)}`}>
                  {r.risk}
                </span>
              </td>
              <td className="border border-border px-2 py-1.5 text-text-secondary">{r.overlap}</td>
              <td className="border border-border px-2 py-1.5 text-text-secondary">{r.banned}</td>
              <td className="border border-border px-2 py-1.5 text-text-secondary">{r.upstream}</td>
              <td className="border border-border px-2 py-1.5 text-text-secondary">{r.sensitive}</td>
              <td className="border border-border px-2 py-1.5 text-text-secondary max-w-[200px] truncate" title={r.conclusion}>{r.conclusion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="bg-surface-tertiary rounded-lg p-3 text-center">
    <div className={`text-xl font-bold ${color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : 'text-text-primary'}`}>
      {value}
    </div>
    <div className="text-xs text-text-tertiary mt-1">{label}</div>
  </div>
);

/* ===== 数据导入 Tab ===== */
const ImportTab: React.FC = () => {
  const [format, setFormat] = useState<SpatialFormat>('geojson');
  const [text, setText] = useState('');
  const [features, setFeatures] = useState<SpatialFeature[]>([]);
  const [warning, setWarning] = useState('');

  const sampleGeoJSON = `{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "岗南水库", "level": "一级" },
      "geometry": { "type": "Point", "coordinates": [114.0, 38.0] }
    },
    {
      "type": "Feature",
      "properties": { "name": "黄壁庄水库", "level": "二级" },
      "geometry": { "type": "Point", "coordinates": [114.3, 38.0] }
    }
  ]
}`;

  const runImport = () => {
    const r = parseSpatialData(text || sampleGeoJSON, format);
    setFeatures(r.features);
    setWarning(r.warnings.join('；'));
  };

  const loadSample = () => {
    setFormat('geojson');
    setText(sampleGeoJSON);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3 h-fit">
        <h2 className="text-sm font-semibold text-text-primary">空间数据输入</h2>
        <div className="flex gap-2">
          {(['geojson', 'kml', 'csv'] as SpatialFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium uppercase ${
                format === f ? 'bg-accent-500 text-white' : 'bg-surface-tertiary text-text-secondary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="粘贴 GeoJSON / KML / CSV 内容"
          className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-400 bg-surface font-mono"
        />
        <div className="flex gap-2">
          <button
            onClick={runImport}
            className="flex-1 py-2 bg-accent-500 text-white rounded-md text-sm font-medium hover:bg-accent-600 transition-colors"
          >
            解析导入
          </button>
          <button
            onClick={loadSample}
            className="px-4 py-2 border border-border rounded-md text-sm hover:bg-surface-tertiary"
          >
            载入示例
          </button>
        </div>
        {warning && <div className="text-xs text-red-600">{warning}</div>}
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">
          解析结果（{features.length} 个要素）
        </h2>
        {features.length === 0 ? (
          <div className="text-sm text-text-tertiary text-center py-20 border border-dashed border-border rounded-lg">
            暂无解析结果，点击"解析导入"
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {features.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-surface-tertiary rounded p-2">
                <div>
                  <div className="text-sm text-text-primary font-medium">{f.name}</div>
                  <div className="text-xs text-text-tertiary">
                    {f.kind === 'point' ? (
                      <>点 ({f.lng?.toFixed(4)}, {f.lat?.toFixed(4)})</>
                    ) : (
                      <>面（{f.ring?.length} 顶点）</>
                    )}
                  </div>
                </div>
                <div className="text-xs text-text-tertiary">
                  {Object.entries(f.properties).slice(0, 2).map(([k, v]) => `${k}=${v}`).join(' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ===== 历史记录 Tab ===== */
const HistoryTab: React.FC = () => {
  const { analyses, loaded, deleteAnalysis, clearAnalyses, setCurrentAnalysis, currentAnalysisId } = useSpatialAnalysisStore();

  if (!loaded) {
    return <div className="text-sm text-text-tertiary text-center py-10">加载历史记录中...</div>;
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">分析历史记录</h2>
          <button
            onClick={() => { if (confirm('确认清空所有历史记录？')) clearAnalyses(); }}
            className="text-xs text-red-600 hover:underline"
          >
            清空
          </button>
        </div>
        <div className="text-xs text-text-tertiary">共 {analyses.length} 条记录</div>

        {analyses.length === 0 ? (
          <div className="text-sm text-text-tertiary text-center py-10 border border-dashed border-border rounded-lg">
            暂无历史记录
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {analyses.map((a) => (
              <div
                key={a.id}
                onClick={() => setCurrentAnalysis(a.id)}
                className={`rounded-lg p-3 cursor-pointer transition-colors ${
                  currentAnalysisId === a.id
                    ? 'bg-accent-50 border border-accent-300'
                    : 'bg-surface-tertiary hover:bg-surface-hover border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{a.name}</span>
                  {a.riskLevel && (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      a.riskLevel === 'red' ? 'bg-red-100 text-red-700' :
                      a.riskLevel === 'yellow' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {a.riskLevel === 'red' ? '红线' : a.riskLevel === 'yellow' ? '黄线' : '绿线'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-tertiary mt-1">
                  {a.analysisType === 'comprehensive' ? '综合报告' : a.analysisType === 'batch' ? '批量评估' : '空间查询'}
                  {' · '}{new Date(a.createdAt).toLocaleString()}
                </div>
                {a.description && (
                  <div className="text-xs text-text-tertiary mt-1">{a.description}</div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-text-tertiary">
                    {a.projectName && `${a.projectName} · `}
                    {a.sourceCount} 个水源地
                    {a.batchProjectCount && ` · ${a.batchProjectCount} 个项目`}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 当前分析详情 */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">详情</h2>
        {!currentAnalysisId ? (
          <div className="text-sm text-text-tertiary text-center py-20 border border-dashed border-border rounded-lg">
            选择左侧历史记录查看详情
          </div>
        ) : (
          <HistoryDetail />
        )}
      </div>
    </div>
  );
};

const HistoryDetail: React.FC = () => {
  const { analyses, currentAnalysisId } = useSpatialAnalysisStore();
  const record = analyses.find((a) => a.id === currentAnalysisId);
  if (!record) {
    return <div className="text-sm text-text-tertiary">记录未找到</div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-text-tertiary">名称</div>
        <div className="text-sm text-text-primary font-medium">{record.name}</div>
      </div>
      <div>
        <div className="text-xs text-text-tertiary">类型</div>
        <div className="text-sm text-text-secondary">
          {record.analysisType === 'comprehensive' ? '综合报告' :
           record.analysisType === 'batch' ? '批量评估' : '空间查询'}
        </div>
      </div>
      <div>
        <div className="text-xs text-text-tertiary">时间</div>
        <div className="text-sm text-text-secondary">{new Date(record.createdAt).toLocaleString()}</div>
      </div>
      {record.projectName && (
        <div>
          <div className="text-xs text-text-tertiary">项目</div>
          <div className="text-sm text-text-secondary">{record.projectName}</div>
        </div>
      )}
      {record.projectPoint && (
        <div>
          <div className="text-xs text-text-tertiary">坐标</div>
          <div className="text-sm text-text-secondary">
            {record.projectPoint.lng.toFixed(4)}, {record.projectPoint.lat.toFixed(4)}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {record.riskLevel && (
          <div className="bg-surface-tertiary rounded p-2">
            <div className="text-xs text-text-tertiary">风险等级</div>
            <div className={`text-sm font-bold ${
              record.riskLevel === 'red' ? 'text-red-600' :
              record.riskLevel === 'yellow' ? 'text-amber-600' : 'text-green-600'
            }`}>
              {record.riskLevel === 'red' ? '红线' : record.riskLevel === 'yellow' ? '黄线' : '绿线'}
            </div>
          </div>
        )}
        {record.insideAnyZone !== undefined && (
          <div className="bg-surface-tertiary rounded p-2">
            <div className="text-xs text-text-tertiary">保护区内</div>
            <div className="text-sm font-bold">{record.insideAnyZone ? '是' : '否'}</div>
          </div>
        )}
        {record.nearestSourceName && (
          <div className="bg-surface-tertiary rounded p-2">
            <div className="text-xs text-text-tertiary">最近水源地</div>
            <div className="text-sm font-medium">{record.nearestSourceName}</div>
          </div>
        )}
        {record.sensitiveCount !== undefined && (
          <div className="bg-surface-tertiary rounded p-2">
            <div className="text-xs text-text-tertiary">敏感目标</div>
            <div className="text-sm font-bold">{record.sensitiveCount}</div>
          </div>
        )}
        {record.batchProjectCount !== undefined && (
          <div className="bg-surface-tertiary rounded p-2">
            <div className="text-xs text-text-tertiary">评估项目数</div>
            <div className="text-sm font-bold">{record.batchProjectCount}</div>
          </div>
        )}
      </div>
      {record.description && (
        <div>
          <div className="text-xs text-text-tertiary">摘要</div>
          <div className="text-sm text-text-secondary">{record.description}</div>
        </div>
      )}
    </div>
  );
};

export default SpatialAnalysisTools;
