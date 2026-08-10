/**
 * 空间分析 Web Worker
 *
 * 将计算密集型操作（最近邻指数、贪心聚类、密度网格、关系矩阵等）
 * 从主线程移到 Worker 中执行，避免阻塞 UI。
 *
 * 使用方式：主线程通过 postMessage 发送请求，Worker 计算后回传结果。
 * 协议见 spatialWorkerClient.ts。
 *
 * 注意：本 Worker 只能依赖纯函数引擎（无 DOM/window 依赖），
 * 目前支持 spatialDensityEngine 与 spatialRelationMatrixEngine。
 */

import {
  computeDistributionStats,
  clusterByNearestNeighbor,
  buildDensityGrid,
} from '@/lib/spatialDensityEngine';
import { buildRelationMatrix, type RelationProject, type RelationSource } from '@/lib/spatialRelationMatrixEngine';

export interface SpatialWorkerRequestMap {
  computeDistributionStats: {
    sources: Parameters<typeof computeDistributionStats>[0];
    bounds: Parameters<typeof computeDistributionStats>[1];
  };
  clusterByNearestNeighbor: {
    sources: Parameters<typeof clusterByNearestNeighbor>[0];
    maxRadiusM: Parameters<typeof clusterByNearestNeighbor>[1];
  };
  buildDensityGrid: {
    sources: Parameters<typeof buildDensityGrid>[0];
    bounds: Parameters<typeof buildDensityGrid>[1];
    gridSize?: Parameters<typeof buildDensityGrid>[2];
  };
  analyzeBatchRelations: {
    projects: RelationProject[];
    sources: RelationSource[];
  };
}

interface RequestBase<K extends keyof SpatialWorkerRequestMap> {
  id: string;
  type: K;
  payload: SpatialWorkerRequestMap[K];
}

// 显式 discriminated union，使 switch 能按 type 收窄 payload
export type SpatialWorkerRequest =
  | RequestBase<'computeDistributionStats'>
  | RequestBase<'clusterByNearestNeighbor'>
  | RequestBase<'buildDensityGrid'>
  | RequestBase<'analyzeBatchRelations'>;

// 供客户端类型推导：导出各操作的结果类型
export type DistributionStatsResult = ReturnType<typeof computeDistributionStats>;
export type ClusterResult = ReturnType<typeof clusterByNearestNeighbor>;
export type DensityGridResultType = ReturnType<typeof buildDensityGrid>;
export type RelationMatrixResultType = ReturnType<typeof buildRelationMatrix>;

function dispatch(request: SpatialWorkerRequest): unknown {
  switch (request.type) {
    case 'computeDistributionStats':
      return computeDistributionStats(request.payload.sources, request.payload.bounds);
    case 'clusterByNearestNeighbor':
      return clusterByNearestNeighbor(request.payload.sources, request.payload.maxRadiusM);
    case 'buildDensityGrid':
      return buildDensityGrid(request.payload.sources, request.payload.bounds, request.payload.gridSize);
    case 'analyzeBatchRelations':
      return buildRelationMatrix(request.payload.projects, request.payload.sources);
    default:
      throw new Error('未知的 worker 请求类型');
  }
}

self.onmessage = (event: MessageEvent<SpatialWorkerRequest>) => {
  const request = event.data;

  try {
    const result = dispatch(request);
    self.postMessage({ id: request.id, type: 'result', result } satisfies WorkerResult);
  } catch (err) {
    self.postMessage({
      id: request.id,
      type: 'error',
      error: (err as Error).message,
    } satisfies WorkerError);
  }
};

export interface WorkerResult {
  id: string;
  type: 'result';
  result: unknown;
}

export interface WorkerError {
  id: string;
  type: 'error';
  error: string;
}

export type WorkerMessage = WorkerResult | WorkerError;