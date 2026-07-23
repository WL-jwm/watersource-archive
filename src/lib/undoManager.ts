/**
 * 撤销/重做管理器 (Undo/Redo Manager)
 *
 * 设计：
 * 1. Command Pattern — 每个操作封装为可逆命令 (execute / inverse)
 * 2. 双栈结构 — undoStack（可撤销）+ redoStack（可重做）
 * 3. 内存优先 — 历史栈保存在内存，会话结束清除
 * 4. 批量合并 — startBatch/commitBatch 将多条命令合并为一条
 * 5. 防递归 — 执行 undo/redo 期间不再 push
 * 6. 外部单例 — 不依赖 React 生命周期
 *
 * 与 dataVersionEngine 的关系：
 * - 版本引擎：全量快照 + IDB 持久化（灾难恢复 / 审计回溯）
 * - UndoManager：单步操作级撤销/重做（日常编辑交互）
 * 两者互补不冲突，UndoManager 执行时仍会触发 ChangeLog
 */

// ===== 核心类型 =====

/** 操作来源（标记数据归属哪个 Store） */
export type CommandSource = 'waterSource' | 'appStore' | 'zoneCalc' | 'dataSource';

/** 可逆命令接口 */
export interface UndoCommand {
  /** 唯一标识 */
  id: string;
  /** 操作描述（用于历史面板展示） */
  label: string;
  /** 操作来源 */
  source: CommandSource;
  /** 时间戳 */
  timestamp: string;
  /** 正向执行（重做时调用） */
  execute: () => Promise<void>;
  /** 逆向执行（撤销时调用） */
  inverse: () => Promise<void>;
}

/** 历史栈状态快照（供 UI 订阅） */
export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  /** 可撤销操作列表（最新在前） */
  undoHistory: UndoCommand[];
  /** 可重做操作列表（最新在前） */
  redoHistory: UndoCommand[];
  /** 是否正在执行 undo/redo */
  isExecuting: boolean;
}

// ===== 常量 =====

const MAX_STACK_SIZE = 50;

// ===== UndoManager 类 =====

class UndoManagerClass {
  private undoStack: UndoCommand[] = [];
  private redoStack: UndoCommand[] = [];
  private isExecutingFlag = false;

  // 批量操作支持
  private batching = false;
  private batchCommands: UndoCommand[] = [];

  // 订阅
  private listeners = new Set<() => void>();

  // ===== 基础状态 =====

  /** 是否可撤销 */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** 是否可重做 */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** 是否正在执行 undo/redo */
  isExecuting(): boolean {
    return this.isExecutingFlag;
  }

  /** 获取历史栈状态快照 */
  getState(): UndoState {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      undoHistory: [...this.undoStack].reverse(), // 最新在前
      redoHistory: [...this.redoStack].reverse(),
      isExecuting: this.isExecutingFlag,
    };
  }

  /** 获取可撤销操作列表（最新在前） */
  getHistory(): readonly UndoCommand[] {
    return [...this.undoStack].reverse();
  }

  /** 获取最近一条可撤销命令 */
  peekUndo(): UndoCommand | undefined {
    return this.undoStack[this.undoStack.length - 1];
  }

  /** 获取最近一条可重做命令 */
  peekRedo(): UndoCommand | undefined {
    return this.redoStack[this.redoStack.length - 1];
  }

  // ===== 核心操作 =====

  /**
   * 推入一条命令（在操作成功执行后调用）
   * 如果正在批量模式中，命令暂存到 batchCommands
   * 如果正在执行 undo/redo，不入栈（防递归）
   */
  push(command: UndoCommand): void {
    if (this.isExecutingFlag) return;
    if (this.batching) {
      this.batchCommands.push(command);
      return;
    }

    this.undoStack.push(command);
    // 新操作后清空 redo 栈（标准行为：新操作使重做历史失效）
    this.redoStack = [];

    // 溢出丢弃最旧
    if (this.undoStack.length > MAX_STACK_SIZE) {
      this.undoStack.shift();
    }

    this.notifyListeners();
  }

  /**
   * 撤销最近一条操作
   * @returns 是否成功执行
   */
  async undo(): Promise<boolean> {
    const command = this.undoStack.pop();
    if (!command) return false;

    this.isExecutingFlag = true;
    try {
      await command.inverse();
      this.redoStack.push(command);
      if (this.redoStack.length > MAX_STACK_SIZE) {
        this.redoStack.shift();
      }
    } catch (e) {
      // 撤销失败，将命令放回 undo 栈
      this.undoStack.push(command);
      console.error('Undo failed:', e);
      this.isExecutingFlag = false;
      this.notifyListeners();
      throw e;
    } finally {
      this.isExecutingFlag = false;
    }

    this.notifyListeners();
    return true;
  }

  /**
   * 重做最近一条撤销的操作
   * @returns 是否成功执行
   */
  async redo(): Promise<boolean> {
    const command = this.redoStack.pop();
    if (!command) return false;

    this.isExecutingFlag = true;
    try {
      await command.execute();
      this.undoStack.push(command);
      if (this.undoStack.length > MAX_STACK_SIZE) {
        this.undoStack.shift();
      }
    } catch (e) {
      // 重做失败，将命令放回 redo 栈
      this.redoStack.push(command);
      console.error('Redo failed:', e);
      this.isExecutingFlag = false;
      this.notifyListeners();
      throw e;
    } finally {
      this.isExecutingFlag = false;
    }

    this.notifyListeners();
    return true;
  }

  /**
   * 连续撤销到指定命令（含该命令本身）
   * 用于历史面板点击跳转
   */
  async undoUntil(commandId: string): Promise<number> {
    let count = 0;
    while (this.canUndo()) {
      const top = this.peekUndo();
      if (!top || top.id === commandId) {
        await this.undo();
        count++;
        break;
      }
      await this.undo();
      count++;
    }
    return count;
  }

  /**
   * 连续重做到指定命令（含该命令本身）
   */
  async redoUntil(commandId: string): Promise<number> {
    let count = 0;
    while (this.canRedo()) {
      await this.redo();
      count++;
      const top = this.peekUndo();
      if (top && top.id === commandId) break;
    }
    return count;
  }

  // ===== 批量操作 =====

  /**
   * 开始批量模式
   * 之后 push 的命令暂存，直到 commitBatch
   */
  startBatch(): void {
    if (this.batching) return;
    this.batching = true;
    this.batchCommands = [];
  }

  /**
   * 提交批量操作，合并为一条命令入栈
   */
  commitBatch(label: string, source: CommandSource = 'waterSource'): void {
    if (!this.batching) return;
    this.batching = false;

    if (this.batchCommands.length === 0) return;

    const commands = [...this.batchCommands];
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    // 合并命令：execute 顺序执行全部，inverse 逆序执行全部
    const batchCommand: UndoCommand = {
      id: batchId,
      label: `${label} (${commands.length} 步)`,
      source,
      timestamp,
      execute: async () => {
        for (const cmd of commands) {
          await cmd.execute();
        }
      },
      inverse: async () => {
        // 逆序执行以正确还原
        for (let i = commands.length - 1; i >= 0; i--) {
          await commands[i].inverse();
        }
      },
    };

    this.batchCommands = [];
    this.push(batchCommand);
  }

  /**
   * 放弃当前批量操作（不提交）
   */
  discardBatch(): void {
    this.batching = false;
    this.batchCommands = [];
  }

  /** 是否在批量模式中 */
  isBatching(): boolean {
    return this.batching;
  }

  // ===== 清理 =====

  /** 清空所有历史 */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.batchCommands = [];
    this.batching = false;
    this.notifyListeners();
  }

  /** 仅清空 redo 栈 */
  clearRedo(): void {
    this.redoStack = [];
    this.notifyListeners();
  }

  // ===== 订阅 =====

  /**
   * 订阅状态变化
   * @returns 取消订阅函数
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

// 单例导出
export const undoManager = new UndoManagerClass();

// ===== 工具函数 =====

/** 生成命令 ID */
export function genCommandId(prefix = 'cmd'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 获取操作来源的中文标签 */
export function getCommandSourceLabel(source: CommandSource): string {
  const labels: Record<CommandSource, string> = {
    waterSource: '水源地数据',
    appStore: '技术报告',
    zoneCalc: '保护区计算',
    dataSource: '数据源',
  };
  return labels[source];
}

/** 获取操作来源的 Tailwind 颜色类 */
export function getCommandSourceColor(source: CommandSource): string {
  const colors: Record<CommandSource, string> = {
    waterSource: 'bg-blue-100 text-blue-700',
    appStore: 'bg-purple-100 text-purple-700',
    zoneCalc: 'bg-green-100 text-green-700',
    dataSource: 'bg-amber-100 text-amber-700',
  };
  return colors[source];
}

/** 格式化相对时间 */
export function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diff = now - then;

  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(isoStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
