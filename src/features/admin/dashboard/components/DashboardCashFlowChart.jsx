import { useEffect, useMemo, useRef } from 'react';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { AlertTriangle, TrendingUp } from 'lucide-react';

import { AdminEmptyState } from '@/features/admin/design-system';

import { formatDashboardRupiah } from '../utils/dashboard-calculations';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

function formatCompactRupiahAxis(value) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${Math.round(abs / 100_000) / 10}jt`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}rb`;
  }
  return `${sign}${abs}`;
}

/**
 * SECTION E.2 — Owner Cash Flow Trend Chart (Apache ECharts 6)
 * Compares daily `Cash In` (Kas Masuk) and `Cash Out` (Kas Keluar aktual)
 * across the selected `Asia/Jakarta` period (`7 hari`, `30 hari`, `90 hari`).
 */
export function DashboardCashFlowChart({ cashFlowTrend }) {
  const containerRef = useRef(null);
  const points = useMemo(() => cashFlowTrend?.points || [], [cashFlowTrend?.points]);
  const hasActivity = Boolean(cashFlowTrend?.hasActivity);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasActivity || points.length === 0) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const initialWidth = el.clientWidth > 0 ? el.clientWidth : 640;
    const chartHeight = 260;

    const getResponsiveLayout = (width) => {
      const isCompact = width > 0 && width < 440;
      return {
        isCompact,
        grid: isCompact
          ? {
              left: 42,
              right: 10,
              top: 48,
              bottom: 26,
              containLabel: false,
            }
          : {
              left: 52,
              right: 16,
              top: 36,
              bottom: 28,
              containLabel: false,
            },
        legend: isCompact
          ? {
              top: 0,
              left: 0,
              right: 'auto',
              itemGap: 10,
              itemWidth: 10,
              itemHeight: 10,
              textStyle: {
                color: '#46433D',
                fontSize: 10.5,
                fontWeight: 600,
              },
              data: ['Kas Masuk (Cash In)', 'Kas Keluar (Cash Out)'],
            }
          : {
              top: 0,
              left: 'auto',
              right: 0,
              itemGap: 12,
              itemWidth: 10,
              itemHeight: 10,
              textStyle: {
                color: '#46433D',
                fontSize: 11,
                fontWeight: 600,
              },
              data: ['Kas Masuk (Cash In)', 'Kas Keluar (Cash Out)'],
            },
      };
    };

    let lastCompact = initialWidth > 0 && initialWidth < 440;
    const initialLayout = getResponsiveLayout(initialWidth);

    const chart = echarts.init(el, undefined, {
      renderer: 'svg',
      width: initialWidth,
      height: chartHeight,
    });

    chart.setOption({
      animation: !prefersReducedMotion,
      animationDuration: prefersReducedMotion ? 0 : 320,
      grid: initialLayout.grid,
      legend: initialLayout.legend,
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: '#151515',
        borderColor: 'rgba(255,255,255,0.12)',
        textStyle: { color: '#F8F6EF', fontSize: 12 },
        formatter(params) {
          const list = Array.isArray(params) ? params : [params];
          const first = list[0];
          if (!first) return '';
          const point = points[first.dataIndex];
          const heading = point?.mediumLabel || first.axisValueLabel || first.name;
          const lines = [`<div style="font-weight:700;margin-bottom:4px">${heading} (WIB)</div>`];
          for (const item of list) {
            lines.push(
              `<div>${item.marker} ${item.seriesName}: <strong>${formatDashboardRupiah(item.value)}</strong></div>`,
            );
          }
          if (point) {
            lines.push(
              `<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.15)">Perubahan Kas Bersih: <strong>${formatDashboardRupiah(point.netMovement)}</strong></div>`,
            );
          }
          return lines.join('');
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((p) => p.label),
        axisLine: { lineStyle: { color: 'rgba(21,21,21,0.15)' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#666159',
          fontSize: 10,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#666159',
          fontSize: 10,
          formatter: formatCompactRupiahAxis,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(21,21,21,0.07)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Kas Masuk (Cash In)',
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: {
            color: '#658800',
            borderRadius: [4, 4, 0, 0],
          },
          data: points.map((p) => p.cashIn),
        },
        {
          name: 'Kas Keluar (Cash Out)',
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: {
            color: '#FF4B22',
            borderRadius: [4, 4, 0, 0],
          },
          data: points.map((p) => p.cashOut),
        },
      ],
    });

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        const nextWidth = el.clientWidth;
        if (nextWidth > 0) {
          chart.resize({ width: nextWidth, height: chartHeight });
          const nextCompact = nextWidth < 440;
          if (nextCompact !== lastCompact) {
            lastCompact = nextCompact;
            const nextLayout = getResponsiveLayout(nextWidth);
            chart.setOption({
              grid: nextLayout.grid,
              legend: nextLayout.legend,
            });
          }
        }
      });
      observer.observe(el);
    }

    return () => {
      observer?.disconnect();
      chart.dispose();
    };
  }, [points, hasActivity]);

  return (
    <div className="space-y-3" data-testid="dashboard-cash-flow-chart-section">
      {cashFlowTrend?.hasPartialCoverage ? (
        <div
          role="status"
          data-testid="cash-flow-partial-coverage-banner"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-[#FEF4DD] px-3.5 py-2.5 text-xs text-[#8A4B08]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Cakupan Data Terbatas (Partial Dataset Coverage)</p>
            <p className="mt-0.5">
              {cashFlowTrend.coverageDetails?.join(' • ') ||
                'Sebagian sumber transaksi melebihi batas kuota pembacaan real-time.'}{' '}
              Buka modul Pembukuan untuk laporan lengkap.
            </p>
          </div>
        </div>
      ) : null}

      {!hasActivity ? (
        <AdminEmptyState
          icon={TrendingUp}
          title="Belum ada pergerakan kas pada periode ini"
          description="Tidak ada transaksi pembayaran masuk maupun pelunasan pengeluaran aktual pada rentang tanggal yang dipilih."
        />
      ) : (
        <div className="rounded-xl border border-[#151515]/[0.08] bg-white p-2.5 sm:p-3.5">
          <div
            ref={containerRef}
            data-testid="cash-flow-echarts-container"
            data-total-cash-in={cashFlowTrend?.totalCashIn ?? 0}
            data-total-cash-out={cashFlowTrend?.totalCashOut ?? 0}
            role="img"
            aria-label={`Grafik tren arus kas masuk dan keluar untuk ${cashFlowTrend?.periodLabel || 'periode terpilih'}`}
            className="w-full overflow-hidden"
            style={{ minHeight: '260px' }}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#151515]/[0.06] pt-2.5 text-[11px] text-[#666159]">
            <span>
              Sumber: <strong className="text-[#151515]">paymentTransactions</strong> (net reversal)
              &amp; <strong className="text-[#151515]">bookkeepingSettlements</strong> (kas aktual)
            </span>
            <span className="font-mono font-semibold text-[#151515] tabular-nums">
              {cashFlowTrend?.periodRangeLabel} • WIB
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
