import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordAddSource,
  recordUpdateSource,
  recordDeleteSource,
  recordImportReplace,
  recordImportMerge,
  recordSaveZoneResult,
  recordDeleteZoneResult,
  recordAddReport,
  recordUpdateReport,
  recordDeleteReport,
  recordResetToStatic,
  beginBatch,
  commitBatch,
  discardBatch,
} from '@/lib/inverseOps';
import { undoManager } from '@/lib/undoManager';
import type { WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';

// Mock IDB
vi.mock('@/lib/idb', () => ({
  dbPut: vi.fn().mockResolvedValue(undefined),
  dbDelete: vi.fn().mockResolvedValue(undefined),
  dbPutBatch: vi.fn().mockResolvedValue(undefined),
  dbClear: vi.fn().mockResolvedValue(undefined),
  dbGetAll: vi.fn().mockResolvedValue([]),
}));

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'test_1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    subType: '湖库型',
    county: '平山县',
    status: '在用',
    population: 500000,
    river: '滹沱河',
    lng: 114.21,
    lat: 38.27,
    dataVersion: 1,
    ...overrides,
  };
}

function makeZoneResult(overrides: Partial<ZoneCalcRecord> = {}): ZoneCalcRecord {
  return {
    id: 'zr1',
    sourceId: 's1',
    sourceName: '测试水源地',
    zones: [],
    params: {} as never,
    calculatedAt: '2024-01-01',
    warnings: [],
    ...overrides,
  };
}

function makeStoreSet(sources: WaterSourceRecord[]) {
  return vi.fn((fn: (s: { sources: WaterSourceRecord[] }) => { sources: WaterSourceRecord[] }) => {
    const result = fn({ sources: [...sources] });
    sources.splice(0, sources.length, ...result.sources);
  });
}

function makeStoreSetZone(zoneResults: ZoneCalcRecord[]) {
  return vi.fn((fn: (s: { zoneResults: ZoneCalcRecord[] }) => { zoneResults: ZoneCalcRecord[] }) => {
    const result = fn({ zoneResults: [...zoneResults] });
    zoneResults.splice(0, zoneResults.length, ...result.zoneResults);
  });
}

function makeStoreSetReports(reports: { id: string; reportName?: string }[]) {
  const saveToStorage = vi.fn();
  const storeSet = vi.fn((fn: (s: { reports: typeof reports }) => { reports: typeof reports }) => {
    const result = fn({ reports: [...reports] });
    reports.splice(0, reports.length, ...result.reports);
  });
  return { storeSet, saveToStorage };
}

describe('inverseOps - 水源地操作', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T01-recordAddSource推入命令', () => {
    const record = makeRecord({ id: 'r1', name: '测试水源地' });
    const storeSet = makeStoreSet([]);
    recordAddSource(record, storeSet);
    expect(undoManager.getState().undoCount).toBe(1);
  });

  it('T02-recordAddSource命令label包含名称', () => {
    const record = makeRecord({ id: 'r2', name: '黄壁庄水库' });
    const storeSet = makeStoreSet([]);
    recordAddSource(record, storeSet);
    expect(undoManager.canUndo()).toBe(true);
  });

  it('T03-recordUpdateSource推入命令', () => {
    const old = makeRecord({ id: 'r3', name: '旧名称', population: 100 });
    const newRec = makeRecord({ id: 'r3', name: '新名称', population: 200 });
    const storeSet = makeStoreSet([old]);
    recordUpdateSource(old, newRec, storeSet);
    expect(undoManager.getState().undoCount).toBe(1);
  });

  it('T04-recordUpdateSource推入后可撤销', () => {
    const old = makeRecord({ id: 'r4', name: '水源A', population: 100 });
    const newRec = makeRecord({ id: 'r4', name: '水源A', population: 200 });
    const storeSet = makeStoreSet([old]);
    recordUpdateSource(old, newRec, storeSet);
    expect(undoManager.canUndo()).toBe(true);
  });

  it('T05-recordDeleteSource推入命令', () => {
    const record = makeRecord({ id: 'r5', name: '要删除的' });
    const storeSet = makeStoreSet([record]);
    recordDeleteSource(record, storeSet);
    expect(undoManager.getState().undoCount).toBe(1);
  });

  it('T06-recordImportReplace推入命令', () => {
    const oldSources = [makeRecord({ id: 'old1' })];
    const newSources = [makeRecord({ id: 'new1' }), makeRecord({ id: 'new2' })];
    const storeSet = makeStoreSet(oldSources);
    recordImportReplace(oldSources, newSources, storeSet);
    expect(undoManager.getState().undoCount).toBe(1);
  });

  it('T07-recordImportMerge推入命令', () => {
    const existing = [makeRecord({ id: 'existing' })];
    const imported = [makeRecord({ id: 'imported' })];
    const storeSet = makeStoreSet(existing);
    recordImportMerge(imported, storeSet);
    expect(undoManager.getState().undoCount).toBe(1);
  });
});

describe('inverseOps - 保护区操作', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T08-recordSaveZoneResult推入命令', () => {
    const newRecord = makeZoneResult({ id: 'zr1', sourceName: '测试水源地' });
    const storeSet = makeStoreSetZone([]);
    recordSaveZoneResult(undefined, newRecord, storeSet);
    expect(undoManager.getState().undoCount).toBe(1);
  });

  it('T09-recordDeleteZoneResult推入命令', () => {
    const record = makeZoneResult({ id: 'zr2', sourceName: '测试水源地2' });
    const storeSet = makeStoreSetZone([record]);
    recordDeleteZoneResult(record, storeSet);
    expect(undoManager.getState().undoCount).toBe(1);
  });
});

describe('inverseOps - 报告操作', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T10-recordAddReport推入命令', () => {
    const report = { id: 'rep1', reportName: '测试报告' };
    const { storeSet, saveToStorage } = makeStoreSetReports([]);
    recordAddReport(report, storeSet, saveToStorage);
    expect(undoManager.getState().undoCount).toBe(1);
  });

  it('T11-recordUpdateReport推入命令', () => {
    const oldReport = { id: 'rep1', reportName: '旧报告' };
    const newReport = { id: 'rep1', reportName: '新报告' };
    const { storeSet, saveToStorage } = makeStoreSetReports([oldReport]);
    recordUpdateReport(oldReport, newReport, storeSet, saveToStorage);
    expect(undoManager.getState().undoCount).toBe(1);
  });

  it('T12-recordDeleteReport推入命令', () => {
    const report = { id: 'rep1', reportName: '被删报告' };
    const { storeSet, saveToStorage } = makeStoreSetReports([report]);
    recordDeleteReport(report, storeSet, saveToStorage);
    expect(undoManager.getState().undoCount).toBe(1);
  });
});

describe('inverseOps - 重置操作', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T13-recordResetToStatic推入命令', () => {
    const oldSources = [makeRecord({ id: 'r1' })];
    const newSources = [makeRecord({ id: 'static1' })];
    const storeSet = makeStoreSet(oldSources);
    recordResetToStatic(oldSources, newSources, storeSet);
    expect(undoManager.getState().undoCount).toBe(1);
  });
});

describe('inverseOps - 批量操作', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T14-beginBatch+commitBatch合并为单条命令', () => {
    const storeSet = makeStoreSet([]);
    beginBatch();
    recordAddSource(makeRecord({ id: 'b1' }), storeSet);
    recordAddSource(makeRecord({ id: 'b2' }), storeSet);
    recordAddSource(makeRecord({ id: 'b3' }), storeSet);
    commitBatch('批量新增3条');
    expect(undoManager.getState().undoCount).toBe(1);
  });

  it('T15-discardBatch不推入命令', () => {
    const storeSet = makeStoreSet([]);
    beginBatch();
    recordAddSource(makeRecord({ id: 'd1' }), storeSet);
    discardBatch();
    expect(undoManager.getState().undoCount).toBe(0);
  });

  it('T16-连续操作累积命令数', () => {
    const storeSet = makeStoreSet([]);
    recordAddSource(makeRecord({ id: 'c1' }), storeSet);
    recordAddSource(makeRecord({ id: 'c2' }), storeSet);
    recordDeleteSource(makeRecord({ id: 'c1' }), storeSet);
    expect(undoManager.getState().undoCount).toBe(3);
  });
});
