/**
 * N6: MapView 拆分 — 地图截图导出 Hook
 *
 * 封装 html2canvas 截图逻辑，支持 CORS 降级和 toBlob 回退
 */

import { useCallback, useState } from 'react';
import L from 'leaflet';

import { toast } from '@/stores/toastStore';

export function useMapExport(
  mapRef: React.RefObject<HTMLDivElement>,
  mapInstanceRef: React.RefObject<L.Map | null>,
  tileLayerRef: React.RefObject<L.TileLayer | null>,
) {
  const [exporting, setExporting] = useState(false);

  const exportMap = useCallback(async () => {
    if (!mapRef.current || exporting) return;
    setExporting(true);
    try {
      // 截图前强制重载瓦片确保 crossOrigin 生效
      if (tileLayerRef.current) {
        const map = mapInstanceRef.current;
        if (map) {
          map.eachLayer((layer: unknown) => {
            if (layer instanceof L.TileLayer) {
              (layer as L.TileLayer).redraw();
            }
          });
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      let canvas: HTMLCanvasElement;
      try {
        const { default: html2canvas } = await import('html2canvas');
        canvas = await html2canvas(mapRef.current, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#f0f4f8',
          scale: 2,
          logging: false,
          imageTimeout: 5000,
        });
        canvas.toDataURL('image/png'); // 验证 canvas 未被污染
      } catch {
        // CORS 模式失败，回退到 allowTaint
        const { default: html2canvas } = await import('html2canvas');
        canvas = await html2canvas(mapRef.current, {
          useCORS: false,
          allowTaint: true,
          backgroundColor: '#f0f4f8',
          scale: 2,
          logging: false,
          imageTimeout: 5000,
        });
      }

      // 优先 toDataURL，失败则用 toBlob
      try {
        const link = document.createElement('a');
        link.download = `水源地保护区地图_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch {
        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error('地图导出失败');
            return;
          }
          const link = document.createElement('a');
          link.download = `水源地保护区地图_${new Date().toISOString().slice(0, 10)}.png`;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }, 'image/png');
      }
    } catch (err) {
      toast.error('地图导出失败：' + (err as Error).message);
    } finally {
      setExporting(false);
    }
  }, [mapRef, mapInstanceRef, tileLayerRef, exporting]);

  return { exporting, exportMap };
}
