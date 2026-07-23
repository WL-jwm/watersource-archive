/**
 * ErrorBoundary 组件渲染测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

// 制造错误的子组件
const ThrowComponent: React.FC<{ message?: string }> = ({ message = '测试爆炸' }) => {
  throw new Error(message);
};

const SafeComponent: React.FC = () => <div>正常内容</div>;

describe('ErrorBoundary', () => {
  it('正常子组件应正常渲染', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('子组件抛错时应显示错误回退UI', () => {
    // 抑制 console.error 输出
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowComponent message="渲染崩溃测试" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('页面运行出错')).toBeInTheDocument();
    expect(screen.getByText('刷新页面')).toBeInTheDocument();
    expect(screen.getByText('尝试恢复')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('ChunkLoadError 应显示"资源加载失败"提示', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ChunkError: React.FC = () => {
      const e = new Error('Loading chunk 5 failed.');
      e.name = 'ChunkLoadError';
      throw e;
    };
    render(
      <ErrorBoundary>
        <ChunkError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('资源加载失败')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('错误详情应可展开查看', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowComponent message="详细错误信息" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('查看错误详情')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('应支持自定义 fallback 渲染', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={(error) => <div>自定义：{error.message}</div>}>
        <ThrowComponent message="自定义回退" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('自定义：自定义回退')).toBeInTheDocument();
    spy.mockRestore();
  });
});
