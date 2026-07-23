/**
 * 全局错误边界组件
 *
 * 捕获子组件树中的运行时错误，展示友好的错误提示页面，
 * 避免整个应用白屏崩溃。支持一键刷新恢复。
 */

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** 自定义错误回退渲染函数 */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] 捕获到未处理错误:', error, errorInfo);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      const error = this.state.error;
      const isChunkError =
        error.name === 'ChunkLoadError' ||
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading chunk');

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            {/* 错误图标 */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-lg font-bold text-gray-800 mb-2">
              {isChunkError ? '资源加载失败' : '页面运行出错'}
            </h1>

            <p className="text-sm text-gray-500 mb-4">
              {isChunkError
                ? '部分资源文件加载失败，可能是网络问题或应用已更新。请刷新页面重试。'
                : '应用遇到了意外错误。您可以尝试刷新页面，如果问题持续出现，请清除浏览器缓存后重试。'}
            </p>

            {/* 错误详情（可折叠） */}
            <details className="text-left mb-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                查看错误详情
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded-lg text-xs text-gray-600 overflow-auto max-h-32">
                {error.name}: {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>

            {/* 操作按钮 */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                刷新页面
              </button>
              <button
                onClick={this.reset}
                className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                尝试恢复
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
