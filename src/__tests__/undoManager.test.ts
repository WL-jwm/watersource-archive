import { describe, it, expect, beforeEach, vi } from 'vitest';
import { undoManager, type UndoCommand, genCommandId, getCommandSourceLabel, getCommandSourceColor, formatRelativeTime } from '@/lib/undoManager';

// ===== 测试工具 =====

function makeCommand(
  label: string,
  executeFn?: () => Promise<void>,
  inverseFn?: () => Promise<void>,
): UndoCommand {
  return {
    id: genCommandId(),
    label,
    source: 'waterSource',
    timestamp: new Date().toISOString(),
    execute: executeFn || (async () => {}),
    inverse: inverseFn || (async () => {}),
  };
}

// 模拟带副作用的命令
function makeTrackedCommand(label: string) {
  const calls: string[] = [];
  const cmd: UndoCommand = {
    id: genCommandId(),
    label,
    source: 'waterSource',
    timestamp: new Date().toISOString(),
    execute: async () => { calls.push('execute'); },
    inverse: async () => { calls.push('inverse'); },
  };
  return { cmd, calls };
}

// ===== 注册中心测试 =====

describe('UndoManager - 基础操作', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T01-push后canUndo为true', () => {
    undoManager.push(makeCommand('测试操作'));
    expect(undoManager.canUndo()).toBe(true);
  });

  it('T02-空栈canUndo为false', () => {
    expect(undoManager.canUndo()).toBe(false);
  });

  it('T03-空栈canRedo为false', () => {
    expect(undoManager.canRedo()).toBe(false);
  });

  it('T04-undo后canRedo为true', async () => {
    undoManager.push(makeCommand('测试操作'));
    await undoManager.undo();
    expect(undoManager.canRedo()).toBe(true);
  });

  it('T05-空栈undo返回false', async () => {
    const result = await undoManager.undo();
    expect(result).toBe(false);
  });

  it('T06-空栈redo返回false', async () => {
    const result = await undoManager.redo();
    expect(result).toBe(false);
  });
});

describe('UndoManager - execute/inverse 调用', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T07-undo调用inverse函数', async () => {
    const { cmd, calls } = makeTrackedCommand('操作A');
    undoManager.push(cmd);
    await undoManager.undo();
    expect(calls).toContain('inverse');
  });

  it('T08-redo调用execute函数', async () => {
    const { cmd, calls } = makeTrackedCommand('操作A');
    undoManager.push(cmd);
    await undoManager.undo();
    await undoManager.redo();
    expect(calls).toContain('execute');
  });

  it('T09-undo后push新命令清空redo栈', async () => {
    undoManager.push(makeCommand('操作A'));
    undoManager.push(makeCommand('操作B'));
    await undoManager.undo();
    expect(undoManager.canRedo()).toBe(true);
    undoManager.push(makeCommand('操作C'));
    expect(undoManager.canRedo()).toBe(false);
  });
});

describe('UndoManager - 栈大小限制', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T10-超过50步丢弃最旧命令', () => {
    for (let i = 0; i < 55; i++) {
      undoManager.push(makeCommand(`操作${i}`));
    }
    const state = undoManager.getState();
    expect(state.undoCount).toBe(50);
  });

  it('T11-恰好50步不丢弃', () => {
    for (let i = 0; i < 50; i++) {
      undoManager.push(makeCommand(`操作${i}`));
    }
    expect(undoManager.getState().undoCount).toBe(50);
  });
});

describe('UndoManager - 批量操作', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T12-startBatch后push不直接入栈', () => {
    undoManager.startBatch();
    undoManager.push(makeCommand('操作A'));
    undoManager.push(makeCommand('操作B'));
    expect(undoManager.getState().undoCount).toBe(0);
  });

  it('T13-commitBatch合并为一条命令', () => {
    undoManager.startBatch();
    undoManager.push(makeCommand('操作A'));
    undoManager.push(makeCommand('操作B'));
    undoManager.push(makeCommand('操作C'));
    undoManager.commitBatch('批量操作');
    expect(undoManager.getState().undoCount).toBe(1);
    expect(undoManager.peekUndo()?.label).toContain('批量操作');
    expect(undoManager.peekUndo()?.label).toContain('3 步');
  });

  it('T14-discardBatch不提交', () => {
    undoManager.startBatch();
    undoManager.push(makeCommand('操作A'));
    undoManager.push(makeCommand('操作B'));
    undoManager.discardBatch();
    expect(undoManager.getState().undoCount).toBe(0);
  });

  it('T15-批量undo逆序执行inverse', async () => {
    const order: string[] = [];
    undoManager.startBatch();
    undoManager.push({
      id: genCommandId(),
      label: '操作A',
      source: 'waterSource',
      timestamp: new Date().toISOString(),
      execute: async () => { order.push('A-execute'); },
      inverse: async () => { order.push('A-inverse'); },
    });
    undoManager.push({
      id: genCommandId(),
      label: '操作B',
      source: 'waterSource',
      timestamp: new Date().toISOString(),
      execute: async () => { order.push('B-execute'); },
      inverse: async () => { order.push('B-inverse'); },
    });
    undoManager.commitBatch('批量');
    await undoManager.undo();
    // 逆序：先 B-inverse 再 A-inverse
    expect(order).toEqual(['A-inverse', 'B-inverse'].reverse());
  });
});

describe('UndoManager - 防递归', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T16-undo执行中push不生效', async () => {
    let pushedDuringUndo = false;
    const cmd: UndoCommand = {
      id: genCommandId(),
      label: '操作A',
      source: 'waterSource',
      timestamp: new Date().toISOString(),
      execute: async () => {},
      inverse: async () => {
        // 在 inverse 执行期间尝试 push
        undoManager.push(makeCommand('操作B'));
        pushedDuringUndo = true;
      },
    };
    undoManager.push(cmd);
    await undoManager.undo();
    expect(pushedDuringUndo).toBe(true);
    // 操作B 不应入栈
    expect(undoManager.getState().undoCount).toBe(0);
  });

  it('T17-redo执行中push不生效', async () => {
    let pushedDuringRedo = false;
    const cmd: UndoCommand = {
      id: genCommandId(),
      label: '操作A',
      source: 'waterSource',
      timestamp: new Date().toISOString(),
      execute: async () => {
        undoManager.push(makeCommand('操作B'));
        pushedDuringRedo = true;
      },
      inverse: async () => {},
    };
    undoManager.push(cmd);
    await undoManager.undo();
    await undoManager.redo();
    expect(pushedDuringRedo).toBe(true);
    expect(undoManager.getState().undoCount).toBe(1);
    expect(undoManager.getState().redoCount).toBe(0);
  });
});

describe('UndoManager - 连续操作', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T18-5步undo再3步redo', async () => {
    for (let i = 0; i < 5; i++) {
      undoManager.push(makeCommand(`操作${i}`));
    }
    expect(undoManager.getState().undoCount).toBe(5);

    for (let i = 0; i < 5; i++) {
      await undoManager.undo();
    }
    expect(undoManager.getState().undoCount).toBe(0);
    expect(undoManager.getState().redoCount).toBe(5);

    for (let i = 0; i < 3; i++) {
      await undoManager.redo();
    }
    expect(undoManager.getState().undoCount).toBe(3);
    expect(undoManager.getState().redoCount).toBe(2);
  });

  it('T19-undoUntil跳转到指定状态', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const cmd = makeCommand(`操作${i}`);
      ids.push(cmd.id);
      undoManager.push(cmd);
    }
    // 撤销到第3个操作（索引2）
    const count = await undoManager.undoUntil(ids[2]);
    expect(count).toBe(3); // 撤销 5→4→3（含目标）
    expect(undoManager.getState().undoCount).toBe(2); // 剩余 2 步（索引0和1）
  });

  it('T20-undo失败时命令放回栈', async () => {
    const cmd: UndoCommand = {
      id: genCommandId(),
      label: '失败操作',
      source: 'waterSource',
      timestamp: new Date().toISOString(),
      execute: async () => {},
      inverse: async () => { throw new Error('模拟失败'); },
    };
    undoManager.push(cmd);
    await expect(undoManager.undo()).rejects.toThrow('模拟失败');
    // 命令应仍在 undo 栈中
    expect(undoManager.getState().undoCount).toBe(1);
    expect(undoManager.getState().redoCount).toBe(0);
  });
});

describe('UndoManager - 订阅', () => {
  beforeEach(() => {
    undoManager.clear();
  });

  it('T21-push后通知listener', () => {
    const listener = vi.fn();
    undoManager.subscribe(listener);
    undoManager.push(makeCommand('操作A'));
    expect(listener).toHaveBeenCalled();
  });

  it('T22-undo后通知listener', async () => {
    const listener = vi.fn();
    undoManager.push(makeCommand('操作A'));
    undoManager.subscribe(listener);
    await undoManager.undo();
    expect(listener).toHaveBeenCalled();
  });

  it('T23-clear后通知listener', () => {
    const listener = vi.fn();
    undoManager.push(makeCommand('操作A'));
    undoManager.subscribe(listener);
    undoManager.clear();
    expect(listener).toHaveBeenCalled();
  });

  it('T24-取消订阅后不再通知', () => {
    const listener = vi.fn();
    const unsub = undoManager.subscribe(listener);
    unsub();
    undoManager.push(makeCommand('操作A'));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('UndoManager - 工具函数', () => {
  it('T25-genCommandId生成唯一ID', () => {
    const id1 = genCommandId();
    const id2 = genCommandId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^cmd_/);
  });

  it('T26-getCommandSourceLabel返回正确标签', () => {
    expect(getCommandSourceLabel('waterSource')).toBe('水源地数据');
    expect(getCommandSourceLabel('appStore')).toBe('技术报告');
    expect(getCommandSourceLabel('zoneCalc')).toBe('保护区计算');
    expect(getCommandSourceLabel('dataSource')).toBe('数据源');
  });

  it('T27-getCommandSourceColor返回Tailwind类名', () => {
    expect(getCommandSourceColor('waterSource')).toContain('bg-blue');
    expect(getCommandSourceColor('appStore')).toContain('bg-purple');
    expect(getCommandSourceColor('zoneCalc')).toContain('bg-green');
    expect(getCommandSourceColor('dataSource')).toContain('bg-amber');
  });

  it('T28-formatRelativeTime-刚刚', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('刚刚');
  });

  it('T29-formatRelativeTime-分钟前', () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    expect(formatRelativeTime(twoMinAgo)).toBe('2 分钟前');
  });

  it('T30-getState返回完整状态对象', () => {
    undoManager.clear();
    undoManager.push(makeCommand('操作A'));
    const state = undoManager.getState();
    expect(state).toHaveProperty('canUndo', true);
    expect(state).toHaveProperty('canRedo', false);
    expect(state).toHaveProperty('undoCount', 1);
    expect(state).toHaveProperty('redoCount', 0);
    expect(state).toHaveProperty('undoHistory');
    expect(state).toHaveProperty('redoHistory');
    expect(state).toHaveProperty('isExecuting', false);
    expect(Array.isArray(state.undoHistory)).toBe(true);
    expect(state.undoHistory.length).toBe(1);
  });
});
