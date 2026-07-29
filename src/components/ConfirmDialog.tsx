/**
 * ConfirmDialog — 全局确认弹窗组件
 *
 * 替代原生 window.confirm()，支持：
 * - 自定义标题/确认/取消文案
 * - danger 模式（红色确认按钮）
 * - Promise 化调用（通过 useConfirm hook）
 */

import React from 'react';
import { useToastStore } from '@/stores/toastStore';

const ConfirmDialog: React.FC = () => {
  const confirm = useToastStore((s) => s.confirm);
  const resolveConfirm = useToastStore((s) => s.resolveConfirm);

  if (!confirm.open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 animate-fadeIn"
      onClick={() => resolveConfirm(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-[420px] w-[90%] mx-4 overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        {confirm.title && (
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-base font-semibold text-gray-900">{confirm.title}</h3>
          </div>
        )}

        {/* 消息体 */}
        <div className={`px-5 ${confirm.title ? 'pb-4' : 'pt-5 pb-4'}`}>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {confirm.message}
          </p>
        </div>

        {/* 按钮区 */}
        <div className="flex gap-2 px-5 pb-5 pt-1 justify-end">
          <button
            onClick={() => resolveConfirm(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {confirm.cancelText ?? '取消'}
          </button>
          <button
            onClick={() => resolveConfirm(true)}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              confirm.danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {confirm.confirmText ?? '确认'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
