/**
 * S9.1: 页面级错误边界包装组件
 *
 * 包裹每个路由页面，单个页面崩溃不影响侧边栏和其他页面导航。
 * 提供简化的错误提示（不含全屏遮罩），支持重试。
 */

import React from 'react';
import ErrorBoundary from './ErrorBoundary';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
  /** 页面名称，用于错误提示 */
  pageName?: string;
}

const PageErrorFallback: React.FC<{
  error: Error;
  reset: () => void;
  pageName?: string;
}> = ({ error, reset, pageName }) => (
  <div
    className="flex items-center justify-center p-8"
    style={{ minHeight: '60vh' }}
    role="alert"
    aria-live="assertive"
  >
    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-gray-800 mb-1">
        {pageName ? `${pageName}加载失败` : '页面加载失败'}
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        该页面遇到错误，但不影响其他功能使用。您可以尝试重新加载此页面。
      </p>
      <details className="text-left mb-3">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
          错误详情
        </summary>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-[10px] text-gray-600 overflow-auto max-h-24">
          {error.name}: {error.message}
        </pre>
      </details>
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={reset}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
        >
          重试
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
        >
          刷新页面
        </button>
      </div>
    </div>
  </div>
);

const PageErrorBoundary: React.FC<PageErrorBoundaryProps> = ({ children, pageName }) => (
  <ErrorBoundary
    pageLevel
    fallback={(error, reset) => (
      <PageErrorFallback error={error} reset={reset} pageName={pageName} />
    )}
  >
    {children}
  </ErrorBoundary>
);

export default PageErrorBoundary;
