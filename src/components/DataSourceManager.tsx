/**
 * 数据源管理面板
 *
 * 功能：
 * 1. 展示所有已注册的数据源（类型/状态/记录数/优先级）
 * 2. 添加新数据源（选择类型 → 填写配置 → 测试连接）
 * 3. 编辑/删除/启用/禁用数据源
 * 4. 调整数据源优先级
 * 5. 手动触发数据加载与合并
 * 6. 展示合并统计结果
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDataSourceStore } from '@/stores/dataSourceStore';
import {
  type DataSourceMeta,
  type DataSourceType,
  type DataSourceConfigField,
  dataSourceRegistry,
  getDataSourceTypeLabel,
  getDataSourceTypeColor,
} from '@/lib/dataSourceRegistry';

/** 状态标签映射 */
function getStatusLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    idle: { label: '待加载', color: 'bg-gray-100 text-gray-600' },
    loading: { label: '加载中', color: 'bg-blue-100 text-blue-700 animate-pulse' },
    ready: { label: '就绪', color: 'bg-green-100 text-green-700' },
    error: { label: '错误', color: 'bg-red-100 text-red-700' },
    disabled: { label: '已禁用', color: 'bg-gray-100 text-gray-400' },
  };
  return map[status] || map.idle;
}

interface DataSourceManagerProps {
  onClose: () => void;
}

const DataSourceManager: React.FC<DataSourceManagerProps> = ({ onClose }) => {
  const {
    sources,
    loaded,
    merging,
    lastMergeResult,
    error,
    init,
    addSource,
    updateSource,
    removeSource,
    toggleSource,
    setPriority,
    loadSource,
    loadAndMergeAll,
    resetToDefault,
  } = useDataSourceStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!loaded) init();
  }, [loaded, init]);

  const handleTest = useCallback(
    async (id: string) => {
      setTestResult((prev) => ({ ...prev, [id]: '测试中...' }));
      try {
        const result = await loadSource(id);
        setTestResult((prev) => ({
          ...prev,
          [id]: `成功: ${result.meta.totalRecords} 条记录, 耗时 ${result.meta.loadDuration.toFixed(0)}ms`,
        }));
      } catch (e) {
        setTestResult((prev) => ({ ...prev, [id]: `失败: ${e}` }));
      }
    },
    [loadSource],
  );

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">数据源管理</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              管理水源地数据来源，支持多数据源合并、优先级配置与来源追踪
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 工具栏 */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            + 添加数据源
          </button>
          <button
            onClick={() => loadAndMergeAll()}
            disabled={merging}
            className="text-xs px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            {merging ? '合并中...' : '加载并合并全部'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('重置为默认数据源配置？这将清除所有自定义数据源。')) {
                resetToDefault();
              }
            }}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            重置默认
          </button>
          <span className="text-xs text-gray-400 ml-auto">
            共 {sources.length} 个数据源，{sources.filter((s) => s.enabled).length} 个启用
          </span>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="px-6 py-2 bg-red-50 text-red-600 text-xs border-b border-red-100">
            {error}
          </div>
        )}

        {/* 合并结果 */}
        {lastMergeResult && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
            <div className="text-xs font-semibold text-blue-800 mb-1">上次合并结果</div>
            <div className="flex items-center gap-4 text-xs text-blue-700">
              <span>输入 {lastMergeResult.stats.totalInput} 条</span>
              <span>输出 {lastMergeResult.stats.totalOutput} 条</span>
              <span>重复 {lastMergeResult.stats.duplicates} 条</span>
              <span>冲突 {lastMergeResult.stats.conflicts} 条</span>
              {Object.entries(lastMergeResult.stats.bySource).map(([sid, count]) => (
                <span key={sid} className="text-gray-500">
                  {sources.find((s) => s.id === sid)?.name || sid}: {count}
                </span>
              ))}
            </div>
            {lastMergeResult.warnings.length > 0 && (
              <details className="mt-1">
                <summary className="text-xs text-amber-600 cursor-pointer">
                  {lastMergeResult.warnings.length} 条警告
                </summary>
                <div className="text-xs text-amber-600 mt-1 space-y-0.5">
                  {lastMergeResult.warnings.slice(0, 10).map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* 数据源列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {sources.length === 0 && (
            <div className="text-center text-gray-400 py-12 text-sm">
              暂无数据源，点击「添加数据源」开始
            </div>
          )}

          {[...sources]
            .sort((a, b) => a.priority - b.priority)
            .map((source) => (
              <DataSourceCard
                key={source.id}
                source={source}
                isEditing={editingId === source.id}
                testResult={testResult[source.id]}
                onEdit={() => setEditingId(editingId === source.id ? null : source.id)}
                onTest={() => handleTest(source.id)}
                onToggle={() => toggleSource(source.id)}
                onRemove={() => {
                  if (
                    source.type === 'static' &&
                    !window.confirm('删除内置数据源可能导致应用无法正常工作，确定继续？')
                  ) {
                    return;
                  }
                  if (source.type !== 'static' && !window.confirm(`删除数据源「${source.name}」？`))
                    return;
                  removeSource(source.id);
                }}
                onPriorityChange={(p) => setPriority(source.id, p)}
                onSave={(updates) => {
                  updateSource(source.id, updates);
                  setEditingId(null);
                }}
              />
            ))}
        </div>

        {/* 添加数据源表单 */}
        {showAddForm && (
          <AddDataSourceForm
            onCancel={() => setShowAddForm(false)}
            onAdd={async (params) => {
              await addSource(params);
              setShowAddForm(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

// ===== 数据源卡片 =====

interface DataSourceCardProps {
  source: DataSourceMeta;
  isEditing: boolean;
  testResult: string | null | undefined;
  onEdit: () => void;
  onTest: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onPriorityChange: (priority: number) => void;
  onSave: (updates: Partial<DataSourceMeta>) => void;
}

const DataSourceCard: React.FC<DataSourceCardProps> = ({
  source,
  isEditing,
  testResult,
  onEdit,
  onTest,
  onToggle,
  onRemove,
  onPriorityChange,
  onSave,
}) => {
  const [editName, setEditName] = useState(source.name);
  const [editDesc, setEditDesc] = useState(source.description || '');
  const [editConfig, setEditConfig] = useState(
    JSON.stringify(source.config, null, 2),
  );

  useEffect(() => {
    setEditName(source.name);
    setEditDesc(source.description || '');
    setEditConfig(JSON.stringify(source.config, null, 2));
  }, [source]);

  const status = getStatusLabel(source.status);
  const adapter = dataSourceRegistry.getAdapter(source.type);
  const configSchema = adapter?.getConfigSchema() || [];

  return (
    <div
      className={`rounded-lg border p-4 ${
        source.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
      }`}
    >
      {/* 头部行 */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-medium ${getDataSourceTypeColor(source.type)}`}
        >
          {getDataSourceTypeLabel(source.type)}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded ${status.color}`}>{status.label}</span>
        <span className="text-xs font-semibold text-gray-800 flex-1">{source.name}</span>
        {source.recordCount !== undefined && (
          <span className="text-xs text-gray-400">{source.recordCount} 条</span>
        )}
        <span className="text-[10px] text-gray-400">优先级</span>
        <input
          type="number"
          value={source.priority}
          onChange={(e) => onPriorityChange(parseInt(e.target.value) || 100)}
          className="w-12 text-xs border border-gray-200 rounded px-1 py-0.5 text-center"
          min={1}
          max={999}
        />
      </div>

      {/* 描述 */}
      {source.description && !isEditing && (
        <p className="text-xs text-gray-500 mb-2">{source.description}</p>
      )}

      {/* 配置信息 */}
      {!isEditing && configSchema.length > 0 && (
        <div className="text-xs text-gray-400 space-y-0.5 mb-2">
          {configSchema.map((field) => {
            const value = source.config[field.key];
            if (field.key.startsWith('_')) return null;
            return (
              <div key={field.key}>
                <span className="text-gray-400">{field.label}:</span>{' '}
                <span className="text-gray-600">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 最后加载时间 */}
      {source.lastLoadedAt && !isEditing && (
        <div className="text-[10px] text-gray-400 mb-2">
          最后加载: {new Date(source.lastLoadedAt).toLocaleString('zh-CN')}
        </div>
      )}

      {/* 错误信息 */}
      {source.error && (
        <div className="text-xs text-red-500 bg-red-50 rounded px-2 py-1 mb-2">{source.error}</div>
      )}

      {/* 测试结果 */}
      {testResult && (
        <div
          className={`text-xs rounded px-2 py-1 mb-2 ${
            testResult.startsWith('成功')
              ? 'text-green-600 bg-green-50'
              : testResult.startsWith('失败')
                ? 'text-red-600 bg-red-50'
                : 'text-blue-600 bg-blue-50'
          }`}
        >
          {testResult}
        </div>
      )}

      {/* 编辑模式 */}
      {isEditing && (
        <div className="space-y-2 mb-3">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1"
            placeholder="数据源名称"
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1"
            placeholder="描述"
            rows={2}
          />
          <textarea
            value={editConfig}
            onChange={(e) => setEditConfig(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono"
            placeholder="配置 (JSON)"
            rows={4}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                let config = source.config;
                try {
                  config = JSON.parse(editConfig);
                } catch {
                  // keep original
                }
                onSave({ name: editName, description: editDesc, config });
              }}
              className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              保存
            </button>
            <button
              onClick={onEdit}
              className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {!isEditing && (
        <div className="flex items-center gap-2">
          <button
            onClick={onTest}
            disabled={!source.enabled}
            className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-30"
          >
            测试加载
          </button>
          <button
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            编辑
          </button>
          <button
            onClick={onToggle}
            className={`text-xs px-2 py-1 rounded border ${
              source.enabled
                ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                : 'border-green-200 text-green-600 hover:bg-green-50'
            }`}
          >
            {source.enabled ? '禁用' : '启用'}
          </button>
          <button
            onClick={onRemove}
            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 ml-auto"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
};

// ===== 添加数据源表单 =====

interface AddDataSourceFormProps {
  onCancel: () => void;
  onAdd: (params: {
    name: string;
    type: DataSourceType;
    description?: string;
    config?: Record<string, unknown>;
    priority?: number;
  }) => Promise<void>;
}

const AddDataSourceForm: React.FC<AddDataSourceFormProps> = ({ onCancel, onAdd }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<DataSourceType>('file');
  const [description, setDescription] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const adapter = dataSourceRegistry.getAdapter(type);
  const schema = adapter?.getConfigSchema() || [];

  const handleTypeChange = (newType: DataSourceType) => {
    setType(newType);
    setConfigValues({});
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('请填写数据源名称');
      return;
    }

    // 构建配置
    const config: Record<string, unknown> = {};
    for (const field of schema) {
      if (field.key.startsWith('_')) continue;
      const val = configValues[field.key];
      if (field.required && !val) {
        setError(`请填写「${field.label}」`);
        return;
      }
      if (val) {
        if (field.type === 'number') {
          config[field.key] = parseFloat(val);
        } else if (field.key === 'headers') {
          try {
            config[field.key] = JSON.parse(val);
          } catch {
            setError('请求头 JSON 格式无效');
            return;
          }
        } else {
          config[field.key] = val;
        }
      }
    }

    // 校验配置
    const validationError = adapter?.validateConfig(config);
    if (validationError) {
      setError(validationError);
      return;
    }

    setAdding(true);
    try {
      await onAdd({ name: name.trim(), type, description: description.trim(), config });
    } catch (e) {
      setError(String(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">添加数据源</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">名称 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
            placeholder="如：石家庄市水源地名录"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">类型 *</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as DataSourceType)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="file">文件上传</option>
            <option value="url">远程URL</option>
            <option value="static">内置静态数据</option>
            <option value="manual">手动录入</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">描述</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          placeholder="数据源说明"
        />
      </div>

      {/* 动态配置字段 */}
      {schema.length > 0 && (
        <div className="space-y-2">
          {schema.map((field) => {
            if (field.key.startsWith('_')) {
              return (
                <div key={field.key} className="text-xs text-gray-400 bg-blue-50 rounded px-2 py-1">
                  {field.helpText}
                </div>
              );
            }
            return (
              <div key={field.key}>
                <label className="text-xs text-gray-500 block mb-0.5">
                  {field.label} {field.required && '*'}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={configValues[field.key] || (field.defaultValue as string) || ''}
                    onChange={(e) =>
                      setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={configValues[field.key] || ''}
                    onChange={(e) =>
                      setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 font-mono"
                    placeholder={field.placeholder}
                    rows={3}
                  />
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={configValues[field.key] || ''}
                    onChange={(e) =>
                      setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                    placeholder={field.placeholder}
                  />
                )}
                {field.helpText && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{field.helpText}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="text-xs text-red-500">{error}</div>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={adding}
          className="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? '添加中...' : '添加'}
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-4 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default DataSourceManager;
