/**
 * G1: PWA 离线能力增强
 *
 * 功能：
 * 1. 离线状态检测与提示
 * 2. SW 更新提示（新版可用时弹出更新按钮）
 * 3. 缓存管理（查看缓存大小/清除缓存）
 * 4. 安装到桌面提示（beforeinstallprompt）
 */

import { useState, useEffect, useCallback } from 'react';

// ===== 离线状态 Hook =====
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

// ===== SW 更新 Hook =====
export function useSWUpdate(): { updateAvailable: boolean; applyUpdate: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkUpdate = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      setRegistration(reg);
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        }
      });
    };

    checkUpdate();
    // 每5分钟检查一次更新
    const interval = setInterval(checkUpdate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage('SKIP_WAITING');
      window.location.reload();
    }
  }, [registration]);

  return { updateAvailable, applyUpdate };
}

// ===== 安装提示 Hook =====
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt(): {
  canInstall: boolean;
  promptInstall: () => Promise<void>;
} {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { canInstall: !!deferredPrompt, promptInstall };
}

// ===== 缓存管理 =====
export async function getCacheSize(): Promise<number> {
  if (!('caches' in window)) return 0;
  const keys = await caches.keys();
  let totalSize = 0;
  for (const key of keys) {
    const cache = await caches.open(key);
    const requests = await cache.keys();
    for (const req of requests) {
      const response = await cache.match(req);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  return totalSize;
}

export async function clearAllCaches(): Promise<void> {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

// ===== UI 组件 =====
export function OfflineIndicator() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center text-xs py-1.5 z-[9999] shadow-md">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        当前处于离线模式，部分功能可能受限（地图瓦片、在线数据不可用）
      </span>
    </div>
  );
}

export function SWUpdateToast() {
  const { updateAvailable, applyUpdate } = useSWUpdate();
  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-lg shadow-xl p-4 z-[9999] max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm">
          🔄
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">发现新版本</div>
          <div className="text-xs text-blue-100 mt-0.5">
            点击更新以获取最新功能和修复
          </div>
          <button
            onClick={applyUpdate}
            className="mt-2 text-xs bg-white text-blue-600 px-3 py-1 rounded font-medium hover:bg-blue-50"
          >
            立即更新
          </button>
        </div>
      </div>
    </div>
  );
}

export function InstallPromptBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-indigo-600 text-white rounded-lg shadow-xl p-4 z-[9999] max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-sm">
          📱
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">安装到桌面</div>
          <div className="text-xs text-indigo-100 mt-0.5">
            安装后可离线使用，启动更快
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={promptInstall}
              className="text-xs bg-white text-indigo-600 px-3 py-1 rounded font-medium hover:bg-indigo-50"
            >
              安装
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-indigo-200 px-3 py-1 hover:text-white"
            >
              稍后
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
