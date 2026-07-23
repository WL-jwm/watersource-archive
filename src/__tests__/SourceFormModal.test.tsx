/**
 * SourceFormModal 组件渲染测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SourceFormModal from '@/components/SourceFormModal';

describe('SourceFormModal', () => {
  it('open=false 时不应渲染', () => {
    const { container } = render(
      <SourceFormModal open={false} source={null} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('新增模式应显示"新增水源地"标题和空表单', () => {
    render(<SourceFormModal open={true} source={null} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText('新增水源地')).toBeInTheDocument();
    expect(screen.getByText('确认新增')).toBeInTheDocument();
  });

  it('编辑模式应显示"编辑水源地"标题并填充已有数据', () => {
    const mockSource = {
      id: 'test-1',
      name: '测试水源地',
      cityName: '保定市',
      county: '涞水县',
      level: 'county' as const,
      type: '地下水' as const,
      status: '在用',
      remark: '备注信息',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    render(
      <SourceFormModal open={true} source={mockSource} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('编辑水源地')).toBeInTheDocument();
    expect(screen.getByText('保存修改')).toBeInTheDocument();
    expect(screen.getByDisplayValue('测试水源地')).toBeInTheDocument();
    expect(screen.getByDisplayValue('涞水县')).toBeInTheDocument();
    expect(screen.getByDisplayValue('备注信息')).toBeInTheDocument();
  });

  it('名称为空时提交应显示验证错误', async () => {
    render(<SourceFormModal open={true} source={null} onClose={vi.fn()} onSubmit={vi.fn()} />);
    // 清空名称输入框
    const nameInput = screen.getByPlaceholderText('如：黄壁庄水库水源地');
    fireEvent.change(nameInput, { target: { value: '' } });
    // 点击提交
    fireEvent.click(screen.getByText('确认新增'));
    await waitFor(() => {
      expect(screen.getByText('请输入水源地名称')).toBeInTheDocument();
    });
  });

  it('点击关闭按钮应调用 onClose', () => {
    const onClose = vi.fn();
    render(<SourceFormModal open={true} source={null} onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击取消按钮应调用 onClose', () => {
    const onClose = vi.fn();
    render(<SourceFormModal open={true} source={null} onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('有效数据提交应调用 onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<SourceFormModal open={true} source={null} onClose={onClose} onSubmit={onSubmit} />);
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('如：黄壁庄水库水源地'), {
      target: { value: '新水源地' },
    });
    fireEvent.change(screen.getByPlaceholderText('如：鹿泉区'), { target: { value: '鹿泉区' } });
    // 提交
    fireEvent.click(screen.getByText('确认新增'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0]).toMatchObject({
        name: '新水源地',
        county: '鹿泉区',
        cityName: '石家庄市',
        type: '地下水',
        status: '在用',
      });
    });
  });
});
