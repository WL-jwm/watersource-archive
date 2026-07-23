/**
 * 逆向操作工厂 (Inverse Operations Factory)
 *
 * 为每种 CRUD 操作生成对应的 UndoCommand
 * 直接操作 IDB + Zustand set()，绕过 Store 方法避免递归入栈
 *
 * 命令的 execute/inverse 闭包捕获操作所需数据，
 * 通过 store.getState() 读取最新状态，避免闭包过期
 */

import { undoManager, genCommandId, type UndoCommand, type CommandSource } from './undoManager';
import type { WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';
import { dbPut, dbDelete, dbPutBatch, dbClear, dbGetAll } from '@/lib/idb';

// ===== 水源地操作 =====

/**
 * 包装 addSource：正向新增，逆向删除
 * 在 Store 的 addSource 执行成功后调用
 */
export function recordAddSource(
  record: WaterSourceRecord,
  storeSet: (fn: (s: { sources: WaterSourceRecord[] }) => { sources: WaterSourceRecord[] }) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `新增水源地「${record.name}」`,
    source: 'waterSource',
    timestamp: new Date().toISOString(),
    execute: async () => {
      await dbPut('water_sources', record);
      storeSet((s) => ({
        sources: [...s.sources.filter((x) => x.id !== record.id), record],
      }));
    },
    inverse: async () => {
      await dbDelete('water_sources', record.id);
      storeSet((s) => ({
        sources: s.sources.filter((x) => x.id !== record.id),
      }));
    },
  };
  undoManager.push(command);
}

/**
 * 包装 updateSource：正向更新，逆向恢复旧值
 * @param oldRecord 操作前的完整记录
 * @param newRecord 操作后的完整记录
 */
export function recordUpdateSource(
  oldRecord: WaterSourceRecord,
  newRecord: WaterSourceRecord,
  storeSet: (fn: (s: { sources: WaterSourceRecord[] }) => { sources: WaterSourceRecord[] }) => void,
): void {
  const changedFields = Object.keys(newRecord).filter(
    (k) =>
      k !== 'dataVersion' &&
      JSON.stringify((oldRecord as unknown as Record<string, unknown>)[k]) !==
        JSON.stringify((newRecord as unknown as Record<string, unknown>)[k]),
  );

  const command: UndoCommand = {
    id: genCommandId(),
    label: `修改水源地「${oldRecord.name}」(${changedFields.join('、') || '属性'})`,
    source: 'waterSource',
    timestamp: new Date().toISOString(),
    execute: async () => {
      await dbPut('water_sources', newRecord);
      storeSet((s) => ({
        sources: s.sources.map((x) => (x.id === newRecord.id ? newRecord : x)),
      }));
    },
    inverse: async () => {
      await dbPut('water_sources', oldRecord);
      storeSet((s) => ({
        sources: s.sources.map((x) => (x.id === oldRecord.id ? oldRecord : x)),
      }));
    },
  };
  undoManager.push(command);
}

/**
 * 包装 deleteSource：正向删除，逆向恢复
 * @param record 被删除的完整记录
 */
export function recordDeleteSource(
  record: WaterSourceRecord,
  storeSet: (fn: (s: { sources: WaterSourceRecord[] }) => { sources: WaterSourceRecord[] }) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `删除水源地「${record.name}」`,
    source: 'waterSource',
    timestamp: new Date().toISOString(),
    execute: async () => {
      await dbDelete('water_sources', record.id);
      storeSet((s) => ({
        sources: s.sources.filter((x) => x.id !== record.id),
      }));
    },
    inverse: async () => {
      await dbPut('water_sources', record);
      storeSet((s) => ({
        sources: [...s.sources.filter((x) => x.id !== record.id), record],
      }));
    },
  };
  undoManager.push(command);
}

/**
 * 包装 importJSON (replace 模式)：正向替换全部，逆向恢复旧数据
 * @param oldSources 导入前的全量记录
 * @param newSources 导入后的全量记录
 */
export function recordImportReplace(
  oldSources: WaterSourceRecord[],
  newSources: WaterSourceRecord[],
  storeSet: (fn: (s: { sources: WaterSourceRecord[] }) => { sources: WaterSourceRecord[] }) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `导入数据（替换模式，${newSources.length} 条）`,
    source: 'waterSource',
    timestamp: new Date().toISOString(),
    execute: async () => {
      await dbClear('water_sources');
      await dbPutBatch('water_sources', newSources);
      storeSet(() => ({ sources: newSources }));
    },
    inverse: async () => {
      await dbClear('water_sources');
      await dbPutBatch('water_sources', oldSources);
      storeSet(() => ({ sources: oldSources }));
    },
  };
  undoManager.push(command);
}

/**
 * 包装 importJSON (merge 模式)：正向追加新记录，逆向移除新增
 * @param addedRecords 导入新增的记录列表
 */
export function recordImportMerge(
  addedRecords: WaterSourceRecord[],
  storeSet: (fn: (s: { sources: WaterSourceRecord[] }) => { sources: WaterSourceRecord[] }) => void,
): void {
  const addedIds = new Set(addedRecords.map((r) => r.id));
  const command: UndoCommand = {
    id: genCommandId(),
    label: `导入数据（合并模式，新增 ${addedRecords.length} 条）`,
    source: 'waterSource',
    timestamp: new Date().toISOString(),
    execute: async () => {
      await dbPutBatch('water_sources', addedRecords);
      storeSet((s) => ({
        sources: [...s.sources, ...addedRecords.filter((r) => !s.sources.find((x) => x.id === r.id))],
      }));
    },
    inverse: async () => {
      for (const r of addedRecords) {
        await dbDelete('water_sources', r.id);
      }
      storeSet((s) => ({
        sources: s.sources.filter((x) => !addedIds.has(x.id)),
      }));
    },
  };
  undoManager.push(command);
}

// ===== 保护区计算操作 =====

/**
 * 包装 saveZoneResult：正向保存，逆向恢复旧记录
 * @param oldRecord 操作前的旧记录（若为新建则为 undefined）
 * @param newRecord 新保存的记录
 */
export function recordSaveZoneResult(
  oldRecord: ZoneCalcRecord | undefined,
  newRecord: ZoneCalcRecord,
  storeSet: (fn: (s: { zoneResults: ZoneCalcRecord[] }) => { zoneResults: ZoneCalcRecord[] }) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `保存保护区计算「${newRecord.sourceName}」`,
    source: 'zoneCalc',
    timestamp: new Date().toISOString(),
    execute: async () => {
      await dbPut('zone_results', newRecord);
      storeSet((s) => ({
        zoneResults: [...s.zoneResults.filter((z) => z.id !== newRecord.id), newRecord],
      }));
    },
    inverse: async () => {
      if (oldRecord) {
        await dbPut('zone_results', oldRecord);
        storeSet((s) => ({
          zoneResults: [...s.zoneResults.filter((z) => z.id !== newRecord.id), oldRecord],
        }));
      } else {
        await dbDelete('zone_results', newRecord.id);
        storeSet((s) => ({
          zoneResults: s.zoneResults.filter((z) => z.id !== newRecord.id),
        }));
      }
    },
  };
  undoManager.push(command);
}

/**
 * 包装 deleteZoneResult：正向删除，逆向恢复
 * @param record 被删除的完整记录
 */
export function recordDeleteZoneResult(
  record: ZoneCalcRecord,
  storeSet: (fn: (s: { zoneResults: ZoneCalcRecord[] }) => { zoneResults: ZoneCalcRecord[] }) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `删除保护区计算「${record.sourceName}」`,
    source: 'zoneCalc',
    timestamp: new Date().toISOString(),
    execute: async () => {
      await dbDelete('zone_results', record.id);
      storeSet((s) => ({
        zoneResults: s.zoneResults.filter((z) => z.id !== record.id),
      }));
    },
    inverse: async () => {
      await dbPut('zone_results', record);
      storeSet((s) => ({
        zoneResults: [...s.zoneResults.filter((z) => z.id !== record.id), record],
      }));
    },
  };
  undoManager.push(command);
}

// ===== 技术报告操作 (appStore / localStorage) =====

/** appStore 报告类型（最小接口，避免循环依赖） */
interface ReportLike {
  id: string;
  reportName?: string;
  updatedAt?: string;
}

/**
 * 包装 addReport：正向新增，逆向删除
 * @param report 新增的报告
 * @param storeSet Zustand set 函数
 * @param saveToStorage 持久化函数
 */
export function recordAddReport<T extends ReportLike>(
  report: T,
  storeSet: (fn: (s: { reports: T[] }) => { reports: T[] }) => void,
  saveToStorage: (reports: T[]) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `新增技术报告「${report.reportName || report.id}」`,
    source: 'appStore',
    timestamp: new Date().toISOString(),
    execute: async () => {
      storeSet((s) => {
        const reports = [...s.reports.filter((r) => r.id !== report.id), report];
        saveToStorage(reports);
        return { reports };
      });
    },
    inverse: async () => {
      storeSet((s) => {
        const reports = s.reports.filter((r) => r.id !== report.id);
        saveToStorage(reports);
        return { reports };
      });
    },
  };
  undoManager.push(command);
}

/**
 * 包装 updateReport：正向更新，逆向恢复旧值
 */
export function recordUpdateReport<T extends ReportLike>(
  oldReport: T,
  newReport: T,
  storeSet: (fn: (s: { reports: T[] }) => { reports: T[] }) => void,
  saveToStorage: (reports: T[]) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `修改技术报告「${oldReport.reportName || oldReport.id}」`,
    source: 'appStore',
    timestamp: new Date().toISOString(),
    execute: async () => {
      storeSet((s) => {
        const reports = s.reports.map((r) => (r.id === newReport.id ? newReport : r));
        saveToStorage(reports);
        return { reports };
      });
    },
    inverse: async () => {
      storeSet((s) => {
        const reports = s.reports.map((r) => (r.id === oldReport.id ? oldReport : r));
        saveToStorage(reports);
        return { reports };
      });
    },
  };
  undoManager.push(command);
}

/**
 * 包装 deleteReport：正向删除，逆向恢复
 */
export function recordDeleteReport<T extends ReportLike>(
  report: T,
  storeSet: (fn: (s: { reports: T[] }) => { reports: T[] }) => void,
  saveToStorage: (reports: T[]) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `删除技术报告「${report.reportName || report.id}」`,
    source: 'appStore',
    timestamp: new Date().toISOString(),
    execute: async () => {
      storeSet((s) => {
        const reports = s.reports.filter((r) => r.id !== report.id);
        saveToStorage(reports);
        return { reports };
      });
    },
    inverse: async () => {
      storeSet((s) => {
        const reports = [...s.reports.filter((r) => r.id !== report.id), report];
        saveToStorage(reports);
        return { reports };
      });
    },
  };
  undoManager.push(command);
}

// ===== 通用操作 =====

/**
 * 包装 resetToStatic：正向重置为静态数据，逆向恢复旧数据
 * @param oldSources 重置前的全量记录
 * @param newSources 重置后的全量记录
 */
export function recordResetToStatic(
  oldSources: WaterSourceRecord[],
  newSources: WaterSourceRecord[],
  storeSet: (fn: (s: { sources: WaterSourceRecord[] }) => { sources: WaterSourceRecord[] }) => void,
): void {
  const command: UndoCommand = {
    id: genCommandId(),
    label: `重置为默认数据（${newSources.length} 条）`,
    source: 'waterSource',
    timestamp: new Date().toISOString(),
    execute: async () => {
      await dbClear('water_sources');
      await dbPutBatch('water_sources', newSources);
      storeSet(() => ({ sources: newSources }));
    },
    inverse: async () => {
      await dbClear('water_sources');
      await dbPutBatch('water_sources', oldSources);
      storeSet(() => ({ sources: oldSources }));
    },
  };
  undoManager.push(command);
}

/**
 * 包装批量操作：开始批量模式
 * 在连续多次 Store 操作前调用
 */
export function beginBatch(): void {
  undoManager.startBatch();
}

/**
 * 提交批量操作
 * @param label 批量操作描述
 * @param source 操作来源
 */
export function commitBatch(label: string, source?: CommandSource): void {
  undoManager.commitBatch(label, source);
}

/**
 * 放弃批量操作
 */
export function discardBatch(): void {
  undoManager.discardBatch();
}

/**
 * 从 IDB 加载全量记录（供 inverseOps 使用）
 */
export async function loadAllSourcesFromIDB<T>(): Promise<T[]> {
  return await dbGetAll<T>('water_sources');
}
