/**
 * H3: 数据审计追踪
 *
 * 记录所有数据变更操作的时间线，支持审计回溯
 *
 * 功能：
 * 1. 操作日志记录（增删改/导入/导出/计算）
 * 2. 变更前后值对比（diff）
 * 3. 操作者/时间/类型/详情记录
 * 4. 审计日志查询与导出
 * 5. IDB 持久化
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'export'
  | 'calculate'
  | 'reset'
  | 'batch_calculate'
  | 'batch_report';

export type AuditEntityType = 'water_source' | 'zone_result' | 'report' | 'system';

export interface AuditLogEntry {
  /** 日志ID */
  id: string;
  /** 操作类型 */
  action: AuditAction;
  /** 实体类型 */
  entityType: AuditEntityType;
  /** 实体ID */
  entityId?: string;
  /** 实体名称 */
  entityName?: string;
  /** 操作时间 */
  timestamp: string;
  /** 操作描述 */
  description: string;
  /** 变更前（JSON） */
  before?: string;
  /** 变更后（JSON） */
  after?: string;
  /** 变更字段 */
  changedFields?: string[];
  /** 操作来源（用户/系统/导入） */
  source: 'user' | 'system' | 'import' | 'batch';
  /** 会话ID */
  sessionId?: string;
}

export interface AuditQueryOptions {
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  startTime?: string;
  endTime?: string;
  source?: 'user' | 'system' | 'import' | 'batch';
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  entries: AuditLogEntry[];
  total: number;
  hasMore: boolean;
}

// ===== 内存存储（开发阶段，后续可扩展IDB） =====
const auditLogs: AuditLogEntry[] = [];
const MAX_LOGS = 10000;

/** 生成日志ID */
function generateLogId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 获取会话ID */
let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }
  return sessionId;
}

// ===== 核心函数 =====

/**
 * 记录审计日志
 */
export function logAudit(
  action: AuditAction,
  entityType: AuditEntityType,
  description: string,
  options: {
    entityId?: string;
    entityName?: string;
    before?: unknown;
    after?: unknown;
    source?: 'user' | 'system' | 'import' | 'batch';
  } = {},
): AuditLogEntry {
  const { entityId, entityName, before, after, source = 'user' } = options;

  // 计算 changedFields
  let changedFields: string[] | undefined;
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
    changedFields = Array.from(allKeys).filter(
      (key) => JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key]),
    );
    if (changedFields.length === 0) changedFields = undefined;
  }

  const entry: AuditLogEntry = {
    id: generateLogId(),
    action,
    entityType,
    entityId,
    entityName,
    timestamp: new Date().toISOString(),
    description,
    before: before ? JSON.stringify(before, null, 2) : undefined,
    after: after ? JSON.stringify(after, null, 2) : undefined,
    changedFields,
    source,
    sessionId: getSessionId(),
  };

  auditLogs.push(entry);

  // 限制内存中日志数量
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.splice(0, auditLogs.length - MAX_LOGS);
  }

  return entry;
}

/**
 * 查询审计日志
 */
export function queryAuditLogs(options: AuditQueryOptions = {}): AuditQueryResult {
  let filtered = [...auditLogs];

  // 过滤条件
  if (options.action) filtered = filtered.filter((e) => e.action === options.action);
  if (options.entityType) filtered = filtered.filter((e) => e.entityType === options.entityType);
  if (options.entityId) filtered = filtered.filter((e) => e.entityId === options.entityId);
  if (options.source) filtered = filtered.filter((e) => e.source === options.source);
  if (options.startTime) filtered = filtered.filter((e) => e.timestamp >= options.startTime!);
  if (options.endTime) filtered = filtered.filter((e) => e.timestamp <= options.endTime!);
  if (options.keyword) {
    const kw = options.keyword.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.description.toLowerCase().includes(kw) ||
        e.entityName?.toLowerCase().includes(kw) ||
        e.changedFields?.some((f) => f.toLowerCase().includes(kw)),
    );
  }

  // 按时间倒序
  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = filtered.length;
  const offset = options.offset || 0;
  const limit = options.limit || 50;
  const entries = filtered.slice(offset, offset + limit);

  return {
    entries,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * 获取实体的操作历史
 */
export function getEntityHistory(entityId: string): AuditLogEntry[] {
  return auditLogs
    .filter((e) => e.entityId === entityId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * 获取操作统计
 */
export function getAuditStats(): {
  total: number;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
  bySource: Record<string, number>;
  recentActivity: number; // 最近24小时
} {
  const byAction: Record<string, number> = {};
  const byEntityType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let recentActivity = 0;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const entry of auditLogs) {
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
    byEntityType[entry.entityType] = (byEntityType[entry.entityType] || 0) + 1;
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    if (entry.timestamp >= oneDayAgo) recentActivity++;
  }

  return {
    total: auditLogs.length,
    byAction,
    byEntityType,
    bySource,
    recentActivity,
  };
}

/**
 * 导出审计日志为 JSON
 */
export function exportAuditLogs(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      sessionId: getSessionId(),
      totalEntries: auditLogs.length,
      entries: auditLogs,
    },
    null,
    2,
  );
}

/**
 * 清空审计日志
 */
export function clearAuditLogs(): void {
  auditLogs.splice(0, auditLogs.length);
}

/**
 * 获取变更摘要文本
 */
export function formatChangeSummary(entry: AuditLogEntry): string {
  const parts: string[] = [];

  const actionLabels: Record<AuditAction, string> = {
    create: '新增',
    update: '修改',
    delete: '删除',
    import: '导入',
    export: '导出',
    calculate: '计算',
    reset: '重置',
    batch_calculate: '批量计算',
    batch_report: '批量报告',
  };

  parts.push(`[${actionLabels[entry.action] || entry.action}]`);
  if (entry.entityName) parts.push(entry.entityName);
  if (entry.changedFields && entry.changedFields.length > 0) {
    parts.push(`变更字段: ${entry.changedFields.join(', ')}`);
  }
  parts.push(entry.description);

  return parts.join(' ');
}
