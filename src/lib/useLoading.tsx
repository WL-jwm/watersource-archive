import { useState, useCallback } from 'react';

/**
 * 为异步操作提供 loading 状态
 *
 * 用法：
 *   const { loading, run } = useLoading();
 *   <button disabled={loading} onClick={run(handleExport)}>
 *     {loading ? '导出中...' : '导出'}
 *   </button>
 */
export function useLoading(initial = false) {
  const [loading, setLoading] = useState(initial);

  const run = useCallback(
    <T,>(fn: () => T | Promise<T>) =>
      async () => {
        if (loading) return;
        setLoading(true);
        try {
          await fn();
        } finally {
          setLoading(false);
        }
      },
    [loading],
  );

  return { loading, run };
}

/**
 * 带 loading 的按钮组件
 */
export function LoadingButton({
  onClick,
  loading,
  loadingText = '处理中...',
  children,
  className = '',
  disabled,
  ...rest
}: {
  onClick: () => void;
  loading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-colors ${
        loading ? 'opacity-70 cursor-wait' : ''
      } ${className}`}
      {...rest}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {loading ? loadingText : children}
    </button>
  );
}