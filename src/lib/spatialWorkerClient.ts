/**
 * 空间分析 Web Worker 客户端
 *
 * 主线程通过本模块异步调用空间分析计算，
 * 计算在 Worker 中执行，避免阻塞 UI。
 *
 * 特性：
 * - 惰性创建 Worker（首次调用时才创建）
 * - 请求 ID 匹配响应
 * - 支持超时与错误处理
 * - 浏览器不支持 Worker 时自动降级为主线程同步计算
 * - 单实例复用
 */

import type {
  SpatialWorkerRequest,
  WorkerMessage,
  SpatialWorkerRequestMap,
} from '@/workers/spatialWorker';
// 降级方案：主线程直接调用引擎
import {
  computeDistributionStats,
  clusterByNearestNeighbor,
  buildDensityGrid,
} from '@/lib/spatialDensityEngine';
import { buildRelationMatrix } from '@/lib/spatialRelationMatrixEngine';

// ===== 请求上下文 =====

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

// ===== 请求类型映射（result 类型） =====

export type SpatialTaskResult<K extends keyof SpatialWorkerRequestMap> =
  K extends 'computeDistributionStats'
    ? ReturnType<typeof computeDistributionStats>
    : K extends 'clusterByNearestNeighbor'
      ? ReturnType<typeof clusterByNearestNeighbor>
      : K extends 'buildDensityGrid'
        ? ReturnType<typeof buildDensityGrid>
        : K extends 'analyzeBatchRelations'
          ? ReturnType<typeof buildRelationMatrix>
          : never;

// ===== 单例 Worker =====

let worker: Worker | null = null;
let pending = new Map<string, PendingRequest>();
let requestSeq = 0;
let fallbackMode = false; // 是否已降级为主线程

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (fallbackMode) return null;

  try {
    // Vite 约定：new URL(..., import.meta.url) 打包为独立 chunk
    worker = new Worker(new URL('@/workers/spatialWorker', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;
      const req = pending.get(msg.id);
      if (!req) return;
      pending.delete(msg.id);
      if (req.timer) clearTimeout(req.timer);
      if (msg.type === 'result') {
        req.resolve(msg.result);
      } else {
        req.reject(new Error(msg.error || '空间分析 Worker 错误'));
      }
    };
    worker.onerror = (err) => {
      // Worker 运行时错误：拒绝所有待处理请求并降级
      fallbackMode = true;
      worker?.terminate();
      worker = null;
      for (const req of pending.values()) {
        if (req.timer) clearTimeout(req.timer);
        req.reject(new Error(err.message || '空间分析 Worker 异常'));
      }
      pending.clear();
    };
    return worker;
  } catch {
    fallbackMode = true;
    return null;
  }
}

// ===== 主线程降级计算 =====

function computeFallback<K extends keyof SpatialWorkerRequestMap>(
  type: K,
  payload: SpatialWorkerRequestMap[K],
): unknown {
  switch (type) {
    case 'computeDistributionStats':
      return computeDistributionStats(
        (payload as SpatialWorkerRequestMap['computeDistributionStats']).sources,
        (payload as SpatialWorkerRequestMap['computeDistributionStats']).bounds,
      );
    case 'clusterByNearestNeighbor':
      return clusterByNearestNeighbor(
        (payload as SpatialWorkerRequestMap['clusterByNearestNeighbor']).sources,
        (payload as SpatialWorkerRequestMap['clusterByNearestNeighbor']).maxRadiusM,
      );
    case 'buildDensityGrid':
      return buildDensityGrid(
        (payload as SpatialWorkerRequestMap['buildDensityGrid']).sources,
        (payload as SpatialWorkerRequestMap['buildDensityGrid']).bounds,
        (payload as SpatialWorkerRequestMap['buildDensityGrid']).gridSize,
      );
    case 'analyzeBatchRelations': {
      const p = payload as SpatialWorkerRequestMap['analyzeBatchRelations'];
      return buildRelationMatrix(p.projects, p.sources);
    }
    default:
      throw new Error(`未知的空间分析任务: ${String(type)}`);
  }
}

// ===== 核心调用接口 =====

export interface RunSpatialTaskOptions {
  /** 超时时间（毫秒），默认 30000 */
  timeoutMs?: number;
}

/**
 * 在主线程/Worker 中运行空间分析任务，返回结果 Promise。
 * Worker 不可用时自动降级为主线程同步计算。
 */
export function runSpatialTask<K extends keyof SpatialWorkerRequestMap>(
  type: K,
  payload: SpatialWorkerRequestMap[K],
  options: RunSpatialTaskOptions = {},
): Promise<SpatialTaskResult<K>> {
  const { timeoutMs = 30000 } = options;
  const w = ensureWorker();

  // 降级：主线程直接计算
  if (!w) {
    return Promise.resolve(computeFallback(type, payload) as SpatialTaskResult<K>);
  }

  // 通过 Worker 计算
  return new Promise<SpatialTaskResult<K>>((resolve, reject) => {
    const id = `spw-${++requestSeq}-${Date.now()}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`空间分析任务超时: ${String(type)}`));
    }, timeoutMs);

    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });

    // type 与 payload 的关联性无法通过 discriminated union 直接构造，使用断言
    const request = { id, type, payload } as SpatialWorkerRequest;
    w.postMessage(request);
  });
}

/**
 * 终止 Worker（释放资源）。通常无需调用，应用卸载时可调用。
 */
export function terminateSpatialWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const req of pending.values()) {
    if (req.timer) clearTimeout(req.timer);
    req.reject(new Error('空间分析 Worker 已终止'));
  }
  pending.clear();
}