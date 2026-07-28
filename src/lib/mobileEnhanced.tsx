/**
 * G2: 移动端适配增强
 *
 * 功能：
 * 1. 设备检测 Hook（mobile/tablet/desktop）
 * 2. 触摸友好的手势支持（左滑切换侧边栏）
 * 3. 移动端表格优化（横向滚动包装器）
 * 4. 底部导航栏（移动端替代侧边栏的快捷导航）
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';

// ===== 设备检测 Hook =====
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) setDevice('mobile');
      else if (width < 1024) setDevice('tablet');
      else setDevice('desktop');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return device;
}

export function useIsMobile(): boolean {
  return useDeviceType() === 'mobile';
}

// ===== 触摸手势 Hook =====
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold: number = 80,
) {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStart === null) return;
      const touchEnd = e.changedTouches[0].clientX;
      const diff = touchStart - touchEnd;

      if (Math.abs(diff) > threshold) {
        if (diff > 0 && onSwipeLeft) onSwipeLeft();
        if (diff < 0 && onSwipeRight) onSwipeRight();
      }
      setTouchStart(null);
    },
    [touchStart, threshold, onSwipeLeft, onSwipeRight],
  );

  return { onTouchStart, onTouchEnd };
}

// ===== 移动端表格包装器 =====
export function MobileTableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="md:overflow-x-auto -mx-4 md:mx-0">
      <div className="min-w-[600px] md:min-w-0 px-4 md:px-0">
        {children}
      </div>
    </div>
  );
}

// ===== 底部导航栏（移动端快捷导航） =====
interface BottomNavItem {
  label: string;
  icon: string;
  href: string;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { label: '首页', icon: '🏠', href: '#/' },
  { label: '地图', icon: '🗺️', href: '#/map' },
  { label: '仪表盘', icon: '📊', href: '#/dashboard' },
  { label: '保护区', icon: '🛡️', href: '#/zone-calc' },
  { label: '管理', icon: '📋', href: '#/manage' },
];

// P6: 更多导航项（展开菜单）
const MORE_NAV_ITEMS: BottomNavItem[] = [
  { label: '分析', icon: '📈', href: '#/analysis' },
  { label: '行政区划', icon: '🗺️', href: '#/divisions' },
  { label: '审计日志', icon: '📝', href: '#/audit' },
  { label: '版本历史', icon: '📋', href: '#/versions' },
];

export function MobileBottomNav() {
  const device = useDeviceType();
  const [moreOpen, setMoreOpen] = useState(false);
  if (device !== 'mobile') return null;

  const currentHash = window.location.hash;

  const renderItem = (item: BottomNavItem) => {
    const isActive = currentHash === item.href;
    return (
      <a
        key={item.href}
        href={item.href}
        className={`flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors ${
          isActive
            ? 'text-blue-600 border-t-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <span className="text-lg leading-none mb-0.5">{item.icon}</span>
        <span className="text-[10px]">{item.label}</span>
      </a>
    );
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 md:hidden">
        <div className="flex justify-around items-center h-14">
          {BOTTOM_NAV_ITEMS.slice(0, 4).map(renderItem)}
          {/* P6: 更多按钮 */}
          <button
            onClick={() => setMoreOpen(prev => !prev)}
            className={`flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors ${
              moreOpen || MORE_NAV_ITEMS.some(i => i.href === currentHash)
                ? 'text-blue-600 border-t-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-lg leading-none mb-0.5">{moreOpen ? '✕' : '⋯'}</span>
            <span className="text-[10px]">{moreOpen ? '关闭' : '更多'}</span>
          </button>
        </div>
      </nav>
      {/* P6: 展开菜单 */}
      {moreOpen && (
        <div className="fixed bottom-14 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-30 md:hidden">
          <div className="grid grid-cols-4 gap-px bg-gray-100">
            {MORE_NAV_ITEMS.map((item) => {
              const isActive = currentHash === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center justify-center py-3 bg-white ${
                    isActive ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  <span className="text-xl mb-1">{item.icon}</span>
                  <span className="text-[10px]">{item.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ===== 移动端友好的卡片列表（替代复杂表格） =====
interface CardListItem {
  id: string;
  title: string;
  subtitle?: string;
  badges?: { text: string; color: string }[];
  onClick?: () => void;
}

export function MobileCardList({ items }: { items: CardListItem[] }) {
  const device = useDeviceType();
  if (device !== 'mobile') return null;

  return (
    <div className="md:hidden space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={item.onClick}
          className="bg-white border border-gray-200 rounded-lg p-3 active:bg-gray-50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{item.title}</div>
              {item.subtitle && (
                <div className="text-xs text-gray-500 mt-0.5 truncate">{item.subtitle}</div>
              )}
            </div>
            {item.badges && item.badges.length > 0 && (
              <div className="flex flex-wrap gap-1 flex-shrink-0">
                {item.badges.map((badge, i) => (
                  <span
                    key={i}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}
                  >
                    {badge.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
