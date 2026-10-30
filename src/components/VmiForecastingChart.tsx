import React, { useState } from 'react';
import { TrendingDown, AlertTriangle, Sparkles, CheckCircle2, Package } from 'lucide-react';

interface VmiForecastingChartProps {
  productName?: string;
  currentStock?: number;
  dailyConsumption?: number;
  reorderPoint?: number;
}

export default function VmiForecastingChart({
  productName = 'Coca-Cola 600ml',
  currentStock = 4,
  dailyConsumption = 2.4,
  reorderPoint = 6
}: VmiForecastingChartProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Generar proyección de stock para los próximos 7 días
  const days = ['Hoy', 'Día 1', 'Día 2', 'Día 3', 'Día 4', 'Día 5', 'Día 6'];
  const projection = days.map((day, idx) => {
    const projected = Math.max(0, Number((currentStock - idx * dailyConsumption).toFixed(1)));
    return { day, stock: projected, isCritical: projected <= reorderPoint };
  });

  const maxVal = Math.max(currentStock, 15);
  const chartHeight = 120;
  const chartWidth = 320;
  const padding = 20;

  // Calcular puntos SVG
  const points = projection.map((p, idx) => {
    const x = padding + (idx / (projection.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (p.stock / maxVal) * (chartHeight - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const reorderY = chartHeight - padding - (reorderPoint / maxVal) * (chartHeight - 2 * padding);

  return (
    <div className="p-4 rounded-2xl bg-surface-card border border-border-subtle soft-shadow space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
            <TrendingDown size={12} />
            <span>Proyección Semanal de Inventario</span>
          </div>
          <h4 className="text-xs font-bold text-text-main">{productName}</h4>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-danger/10 text-danger border border-danger/20 flex items-center gap-1">
          <AlertTriangle size={10} />
          <span>Riesgo en 48h</span>
        </span>
      </div>

      {/* Gráfica SVG */}
      <div className="relative bg-bg-main/60 rounded-xl p-2 border border-border-subtle overflow-hidden">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-28 overflow-visible">
          {/* Línea de Punto de Reorden */}
          <line
            x1={padding}
            y1={reorderY}
            x2={chartWidth - padding}
            y2={reorderY}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <text x={chartWidth - padding - 4} y={reorderY - 4} textAnchor="end" fill="#ef4444" fontSize="8" fontWeight="bold">
            Punto de Reorden ({reorderPoint} pzas)
          </text>

          {/* Curva de consumo proyectada */}
          <polyline
            fill="none"
            stroke="var(--color-role-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Nodos de cada día */}
          {projection.map((p, idx) => {
            const x = padding + (idx / (projection.length - 1)) * (chartWidth - 2 * padding);
            const y = chartHeight - padding - (p.stock / maxVal) * (chartHeight - 2 * padding);
            const isHovered = selectedDay === idx;
            return (
              <g key={idx} className="cursor-pointer" onClick={() => setSelectedDay(idx)}>
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3.5}
                  fill={p.stock <= 2 ? '#ef4444' : 'var(--color-role-primary)'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text x={x} y={chartHeight - 4} textAnchor="middle" fill="#888888" fontSize="7" fontWeight="bold">
                  {p.day}
                </text>
              </g>
            );
          })}
        </svg>

        {selectedDay !== null && (
          <div className="absolute top-2 left-2 bg-surface-card/95 border border-border-subtle p-1.5 rounded-lg text-[9px] shadow-lg pointer-events-none">
            <strong>{projection[selectedDay].day}:</strong> {projection[selectedDay].stock} piezas proyectadas
          </div>
        )}
      </div>

      {/* Sugerencia preventiva VMI */}
      <div className="p-2.5 rounded-xl bg-[var(--color-role-primary)]/10 border border-[var(--color-role-primary)]/20 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-text-main font-semibold">
          <Sparkles size={14} className="text-[var(--color-role-primary)] shrink-0" />
          <span>Sugerencia: Confirmar 2 cajas de reabastecimiento</span>
        </div>
        <span className="text-[9px] font-mono font-bold text-[var(--color-role-primary)]">Ruta Mañana</span>
      </div>
    </div>
  );
}
