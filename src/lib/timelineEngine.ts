/* ===== S11.11: 活动时间线引擎 =====
 * 聚合变更日志 + 审计日志 + 版本快照为统一时间线
 * 支持筛选、分组、统计
 */

import { getAllChangeLogs, listVersions } from './dataVersionEngine';
import { queryAuditLogs } from './auditTrail';

// ===== 类型定义 =====

export type TimelineEntryType = 'change' | 'audit' | 'version';

export interface TimelineEntry {
  id: string;
  type: TimelineEntryType;
  timestamp: string;
  title: string;
  description: string;
  /** 关联实体 */
  entityType?: string;
  entityId?: string;
  entityName?: string;
  /** 变更动作 */
  action?: string;
  /** 附加数据 */
  meta?: Record<string, unknown>;
}

export interface TimelineFilter {
  types?: TimelineEntryType[];
  startDate?: string;
  endDate?: string;
  entityName?: string;
  action?: string;
}

export interface TimelineStats {
  total: number;
  byType: Record<TimelineEntryType, number>;
  byAction: Record<string, number>;
  byDate: { date: string; count: number }[];
}

// ===== 获取时间线 =====

/**
 * 从多个数据源聚合时间线条目
 */
export async function getTimeline(limit = 500): Promise<TimelineEntry[]> {
  const [changeLogs, auditLogs, versions] = await Promise.all([
    getAllChangeLogs(limit),
    Promise.resolve(queryAuditLogs({ limit }).entries),
    listVersions(),
  ]);

  const entries: TimelineEntry[] = [];

  // 变更日志
  for (const log of changeLogs) {
    entries.push({
      id: `change_${log.id}`,
      type: 'change',
      timestamp: log.timestamp,
      title: formatActionTitle(log.action, log.recordName),
      description: log.description,
      entityId: log.recordId,
      entityName: log.recordName,
      action: log.action,
      meta: log.diff ? { diffCount: log.diff.length } : undefined,
    });
  }

  // 审计日志
  for (const log of auditLogs) {
    entries.push({
      id: `audit_${log.id}`,
      type: 'audit',
      timestamp: log.timestamp,
      title: formatAuditTitle(log.action, log.entityName),
      description: log.description,
      entityType: log.entityType,
      entityId: log.entityId,
      entityName: log.entityName,
      action: log.action,
      meta: log.changedFields ? { changedFields: log.changedFields } : undefined,
    });
  }

  // 版本快照
  for (const ver of versions) {
    entries.push({
      id: `version_${ver.id}`,
      type: 'version',
      timestamp: ver.createdAt,
      title: `版本快照: ${ver.name}`,
      description: ver.description || `${ver.sourceCount} 条水源地记录`,
      action: ver.type,
      meta: { sourceCount: ver.sourceCount, tags: ver.tags },
    });
  }

  // 按时间倒序
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return entries.slice(0, limit);
}

// ===== 筛选 =====

export function filterTimeline(entries: TimelineEntry[], filter: TimelineFilter): TimelineEntry[] {
  return entries.filter((e) => {
    if (filter.types && filter.types.length > 0 && !filter.types.includes(e.type)) return false;
    if (filter.startDate && e.timestamp < filter.startDate) return false;
    if (filter.endDate && e.timestamp > filter.endDate) return false;
    if (filter.entityName && !e.entityName?.includes(filter.entityName)) return false;
    if (filter.action && e.action !== filter.action) return false;
    return true;
  });
}

// ===== 分组 =====

/**
 * 按日期分组
 */
export function groupByDate(entries: TimelineEntry[]): { date: string; entries: TimelineEntry[] }[] {
  const groups = new Map<string, TimelineEntry[]>();

  for (const entry of entries) {
    const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(entry);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, ents]) => ({ date, entries: ents }));
}

// ===== 统计 =====

export function computeTimelineStats(entries: TimelineEntry[]): TimelineStats {
  const byType: Record<TimelineEntryType, number> = { change: 0, audit: 0, version: 0 };
  const byAction: Record<string, number> = {};
  const dateMap = new Map<string, number>();

  for (const entry of entries) {
    byType[entry.type]++;

    if (entry.action) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
    }

    const date = entry.timestamp.slice(0, 10);
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  }

  const byDate = Array.from(dateMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, count]) => ({ date, count }));

  return {
    total: entries.length,
    byType,
    byAction,
    byDate,
  };
}

// ===== 格式化 =====

function formatActionTitle(action: string, name: string): string {
  const labels: Record<string, string> = {
    add: '新增',
    update: '修改',
    delete: '删除',
  };
  const label = labels[action] || action;
  return `${label}: ${name}`;
}

function formatAuditTitle(action: string, name?: string): string {
  const labels: Record<string, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    import: '导入',
    export: '导出',
    calculate: '计算',
    reset: '重置',
    batch_calculate: '批量计算',
    batch_report: '批量报告',
    restore: '恢复',
    purge: '清除',
    purge_all: '清空回收站',
  };
  const label = labels[action] || action;
  return name ? `${label}: ${name}` : label;
}

export function formatTimelineType(type: TimelineEntryType): string {
  const labels: Record<TimelineEntryType, string> = {
    change: '数据变更',
    audit: '操作审计',
    version: '版本快照',
  };
  return labels[type];
}

export function formatTimelineTypeColor(type: TimelineEntryType): string {
  const colors: Record<TimelineEntryType, string> = {
    change: 'bg-blue-100 text-blue-700',
    audit: 'bg-amber-100 text-amber-700',
    version: 'bg-green-100 text-green-700',
  };
  return colors[type];
}
