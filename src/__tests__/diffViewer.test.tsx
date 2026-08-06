/* ===== S11.5: DiffViewer 组件测试 ===== */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DiffViewer from '@/components/version/DiffViewer';
import type { VersionDiff } from '@/lib/dataVersionEngine';

function makeDiff(overrides: Partial<VersionDiff> = {}): VersionDiff {
  return {
    added: [],
    removed: [],
    modified: [],
    unchanged: 0,
    ...overrides,
  };
}

describe('DiffViewer', () => {
  it('空 diff 应显示"无差异"提示', () => {
    render(<DiffViewer diff={makeDiff()} />);
    expect(screen.getByText('当前数据与此版本完全一致，无差异')).toBeInTheDocument();
  });

  it('应显示统计摘要', () => {
    const diff = makeDiff({
      added: [{ id: '1', name: '新水源', data: { type: '地下水' } }],
      removed: [{ id: '2', name: '旧水源', data: { status: '在用' } }],
      modified: [{ id: '3', name: '改水源', changes: [{ field: 'status', oldValue: '在用', newValue: '备用' }] }],
      unchanged: 5,
    });
    render(<DiffViewer diff={diff} />);

    // 统计数字
    expect(screen.getByText('新增')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
    expect(screen.getByText('修改')).toBeInTheDocument();
    expect(screen.getByText('未变')).toBeInTheDocument();
  });

  it('新增记录应显示名称', () => {
    const diff = makeDiff({
      added: [{ id: '1', name: '岗南水库', data: { type: '地表水', county: '平山县' } }],
    });
    render(<DiffViewer diff={diff} />);
    expect(screen.getByText('岗南水库')).toBeInTheDocument();
  });

  it('删除记录应显示名称', () => {
    const diff = makeDiff({
      removed: [{ id: '2', name: '黄壁庄水库', data: { status: '在用' } }],
    });
    render(<DiffViewer diff={diff} />);
    expect(screen.getByText('黄壁庄水库')).toBeInTheDocument();
  });

  it('修改记录应显示字段差异', () => {
    const diff = makeDiff({
      modified: [{
        id: '3',
        name: '测试水源',
        changes: [
          { field: 'status', oldValue: '在用', newValue: '备用' },
          { field: 'population', oldValue: 10000, newValue: 20000 },
        ],
      }],
    });
    const { container } = render(<DiffViewer diff={diff} />);
    expect(screen.getByText('测试水源')).toBeInTheDocument();
    // 字段标签
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('服务人口')).toBeInTheDocument();
    // 旧值/新值
    expect(container.textContent).toContain('在用');
    expect(container.textContent).toContain('备用');
  });

  it('修改记录应使用中文字段标签', () => {
    const diff = makeDiff({
      modified: [{
        id: '1',
        name: '水源',
        changes: [{ field: 'lng', oldValue: 114.5, newValue: 115.0 }],
      }],
    });
    render(<DiffViewer diff={diff} />);
    expect(screen.getByText('经度')).toBeInTheDocument();
  });

  it('未知字段应保留原始字段名', () => {
    const diff = makeDiff({
      modified: [{
        id: '1',
        name: '水源',
        changes: [{ field: 'customField', oldValue: 'a', newValue: 'b' }],
      }],
    });
    render(<DiffViewer diff={diff} />);
    expect(screen.getByText('customField')).toBeInTheDocument();
  });

  it('空值应显示为(空)', () => {
    const diff = makeDiff({
      modified: [{
        id: '1',
        name: '水源',
        changes: [{ field: 'remark', oldValue: undefined, newValue: '新备注' }],
      }],
    });
    const { container } = render(<DiffViewer diff={diff} />);
    expect(container.textContent).toContain('(空)');
    expect(container.textContent).toContain('新备注');
  });
});
