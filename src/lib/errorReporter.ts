/**
 * S9.1: 错误上报模块
 *
 * 收集运行时错误信息，持久化到 IndexedDB error_logs store，
 * 供"错误日志"页面查询展示。
 */

import { dbClear, dbCount, dbGetAll, dbPut, getDB } from './idb';

const ERROR_LOG_STORE = 'error_logs';
const MAX_LOGS = 200; // 最多保留 200 条错误日志

export interface ErrorLog {
  id: string;
  name: string;
  message: string;
  stack?: string;
  timestamp: string;
  route: string;
  userAgent: string;
  componentStack?: string;
  level: 'error' | 'warning';
  source: 'boundary' | 'unhandled' | 'console';
}

/**
 * 确保 error_logs store 存在
 * 需要在 DB 升级时调用
 */
export function ensureErrorLogStore(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(ERROR_LOG_STORE)) {
    const store = db.createObjectStore(ERROR_LOG_STORE, { keyPath: 'id' });
    store.createIndex('timestamp', 'timestamp', { unique: false });
    store.createIndex('level', 'level', { unique: false });
    store.createIndex('source', 'source', { unique: false });
  }
}

/**
 * 记录错误到 IDB
 */
export async function reportError(
  error: Error,
  options?: {
    componentStack?: string;
    source?: ErrorLog['source'];
    level?: ErrorLog['level'];
  },
): Promise<void> {
  try {
    const log: ErrorLog = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      route: window.location.hash || window.location.pathname || '/',
      userAgent: navigator.userAgent,
      componentStack: options?.componentStack,
      level: options?.level ?? 'error',
      source: options?.source ?? 'boundary',
    };

    await dbPut(ERROR_LOG_STORE, log);

    // 超出上限时清理旧日志
    const count = await dbCount(ERROR_LOG_STORE);
    if (count > MAX_LOGS) {
      const all = await dbGetAll<ErrorLog>(ERROR_LOG_STORE);
      all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const toRemove = all.slice(0, count - MAX_LOGS);
      // 逐条删除（无批量删除 API）
      const db = await getDB();
      for (const log of toRemove) {
        try {
          const tx = db.transaction(ERROR_LOG_STORE, 'readwrite');
          tx.objectStore(ERROR_LOG_STORE).delete(log.id);
        } catch {
          // skip
        }
      }
    }
  } catch {
    // 上报本身失败时静默处理，避免无限循环
  }
}

/**
 * 查询错误日志
 */
export async function queryErrorLogs(options?: {
  limit?: number;
  level?: ErrorLog['level'];
  source?: ErrorLog['source'];
}): Promise<ErrorLog[]> {
  let logs = await dbGetAll<ErrorLog>(ERROR_LOG_STORE);

  if (options?.level) {
    logs = logs.filter((l) => l.level === options.level);
  }
  if (options?.source) {
    logs = logs.filter((l) => l.source === options.source);
  }

  // 按时间降序
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (options?.limit) {
    logs = logs.slice(0, options.limit);
  }

  return logs;
}

/**
 * 清空错误日志
 */
export async function clearErrorLogs(): Promise<void> {
  await dbClear(ERROR_LOG_STORE);
}

/**
 * 获取错误日志数量
 */
export async function getErrorLogCount(): Promise<number> {
  return dbCount(ERROR_LOG_STORE);
}

/**
 * 安装全局未捕获错误处理器
 * 在应用启动时调用一次
 */
export function installGlobalErrorHandlers(): void {
  // 捕获未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    reportError(error, { source: 'unhandled', level: 'error' });
  });

  // 捕获未处理的同步错误
  window.addEventListener('error', (event) => {
    if (event.error) {
      reportError(event.error, { source: 'unhandled', level: 'error' });
    }
  });

  // 拦截 console.error（仅首次调用时生效）
  const originalError = console.error;
  let installed = false;
  if (!installed) {
    installed = true;
    console.error = (...args: unknown[]) => {
      originalError.apply(console, args);
      // 尝试提取 Error 对象
      const errorArg = args.find((a): a is Error => a instanceof Error);
      if (errorArg) {
        reportError(errorArg, { source: 'console', level: 'error' });
      }
    };
  }
}
