import React from 'react';

const CoordinatePreview: React.FC<{ points: any[]; zoneName: string }> = ({ points, zoneName }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || points.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = 300;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const padding = { top: 30, right: 30, bottom: 35, left: 60 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const lngs = points.map((p) => p.longitude);
    const lats = points.map((p) => p.latitude);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const rangeLng = maxLng - minLng || 0.001;
    const rangeLat = maxLat - minLat || 0.001;

    const scaleX = (lng: number) => padding.left + ((lng - minLng) / rangeLng) * plotW;
    const scaleY = (lat: number) => padding.top + plotH - ((lat - minLat) / rangeLat) * plotH;

    // Background
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (i / 5) * plotW;
      const y = padding.top + (i / 5) * plotH;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Area fill
    ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = scaleX(pt.longitude);
      const y = scaleY(pt.latitude);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();

    // Area line
    ctx.strokeStyle = '#0EA5E9';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = scaleX(pt.longitude);
      const y = scaleY(pt.latitude);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();

    // Points + labels
    points.forEach((pt) => {
      const x = scaleX(pt.longitude);
      const y = scaleY(pt.latitude);

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1E3A5F';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#1E293B';
      ctx.font = '11px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`#${pt.pointNumber}`, x + 10, y - 4);
    });

    // Axis labels
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${minLng.toFixed(4)}E`, scaleX(minLng), height - padding.bottom + 8);
    ctx.fillText(`${maxLng.toFixed(4)}E`, scaleX(maxLng), height - padding.bottom + 8);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${minLat.toFixed(4)}N`, padding.left - 6, scaleY(minLat));
    ctx.fillText(`${maxLat.toFixed(4)}N`, padding.left - 6, scaleY(maxLat));

    // Title
    ctx.fillStyle = '#64748B';
    ctx.font = '11px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${zoneName} - 拐点坐标分布图`, width / 2, 8);
  }, [points, zoneName]);

  if (points.length < 2) return null;

  return (
    <div className="mt-3">
      <div ref={containerRef} className="card overflow-hidden">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
};

export default CoordinatePreview;
