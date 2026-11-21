import { useEffect, useRef } from 'react';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { PieChart } from 'lucide-react';

import { AdminEmptyState } from '@/features/admin/design-system';

import { formatBookkeepingRupiah } from '../utils/bookkeeping-format';

echarts.use([BarChart, GridComponent, TooltipComponent, SVGRenderer]);

const CATEGORY_COLORS = ['#151515', '#FF4B22', '#8BAD12', '#D97706', '#46433D', '#0F6246'];

export function BookkeepingCategoryChart({ data = [] }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || data.length === 0) return undefined;

    const initialWidth = el.clientWidth > 0 ? el.clientWidth : 520;
    const chartHeight = Math.max(190, data.length * 42 + 40);
    const chart = echarts.init(el, undefined, {
      renderer: 'svg',
      width: initialWidth,
      height: chartHeight,
    });

    const reversed = [...data].reverse();
    chart.setOption({
      animation: false,
      grid: {
        left: 132,
        right: 24,
        top: 12,
        bottom: 24,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter(params) {
          const item = Array.isArray(params) ? params[0] : params;
          if (!item) return '';
          return `${item.name}: ${formatBookkeepingRupiah(item.value)}`;
        },
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#666159',
          fontSize: 10,
          formatter(value) {
            if (value >= 1000000) return `${Math.round(value / 100000) / 10}jt`;
            if (value >= 1000) return `${Math.round(value / 1000)}rb`;
            return String(value);
          },
        },
        splitLine: { lineStyle: { color: 'rgba(21,21,21,0.08)' } },
      },
      yAxis: {
        type: 'category',
        data: reversed.map((d) => d.label),
        axisLine: { lineStyle: { color: 'rgba(21,21,21,0.16)' } },
        axisLabel: {
          color: '#151515',
          fontSize: 11,
          width: 118,
          overflow: 'truncate',
        },
      },
      series: [
        {
          name: 'Expense',
          type: 'bar',
          barMaxWidth: 20,
          data: reversed.map((d, idx) => ({
            value: d.amount,
            itemStyle: {
              color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
              borderRadius: [0, 6, 6, 0],
            },
          })),
        },
      ],
    });

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (el.clientWidth > 0) {
          chart.resize({ width: el.clientWidth, height: chartHeight });
        }
      });
      observer.observe(el);
    }

    return () => {
      observer?.disconnect();
      chart.dispose();
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <AdminEmptyState
        icon={PieChart}
        title="Belum ada data pengeluaran untuk grafik"
        description="Catat pengeluaran operasional atau posting akrual komisi pada periode ini untuk melihat distribusi kategori."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        aria-label="Grafik distribusi pengeluaran per kategori"
        className="w-full overflow-hidden"
        style={{ minHeight: `${Math.max(190, data.length * 42 + 40)}px` }}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item, idx) => (
          <div
            key={item.categoryId}
            className="sa-subcard flex items-center justify-between gap-2 p-2.5 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#151515]">{item.label}</p>
                <p className="text-[10.5px] text-[#666159]">
                  {item.count} transaksi • {item.sharePercent}%
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono font-bold text-[#151515] tabular-nums">
              {formatBookkeepingRupiah(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
