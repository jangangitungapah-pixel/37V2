import { useEffect, useMemo, useRef } from 'react';
import { BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';

import {
  AdminButton,
  AdminEmptyState,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';

import { DASHBOARD_PERIOD_OPTIONS } from '../config/dashboard-config';

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

/**
 * SECTION F — Booking Trend (Apache ECharts 6)
 * Visualizes daily active studio booking volume (`Room A` & `Room B`) across
 * the selected `Asia/Jakarta` period (`7 hari`, `30 hari`, `90 hari`).
 */
export function DashboardBookingTrendChart({
  bookingTrend,
  periodId,
  onPeriodChange,
  isLoading = false,
  error = null,
  onRetry,
}) {
  const containerRef = useRef(null);
  const points = useMemo(() => bookingTrend?.points || [], [bookingTrend?.points]);
  const hasActivity = Boolean(bookingTrend?.hasActivity);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasActivity || points.length === 0 || isLoading || error) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const initialWidth = el.clientWidth > 0 ? el.clientWidth : 640;
    const chartHeight = 250;

    const chart = echarts.init(el, undefined, {
      renderer: 'svg',
      width: initialWidth,
      height: chartHeight,
    });

    chart.setOption({
      animation: !prefersReducedMotion,
      animationDuration: prefersReducedMotion ? 0 : 300,
      grid: {
        left: 38,
        right: 16,
        top: 34,
        bottom: 28,
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: '#46433D',
          fontSize: 11,
          fontWeight: 600,
        },
        data: ['Room A', 'Room B'],
      },
      tooltip: {
        trigger: 'axis',
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
              `<div>${item.marker} ${item.seriesName}: <strong>${item.value} sesi</strong></div>`,
            );
          }
          if (point) {
            lines.push(
              `<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.15)">Total Aktif: <strong>${point.activeCount} sesi</strong></div>`,
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
        minInterval: 1,
        axisLabel: {
          color: '#666159',
          fontSize: 10,
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
          name: 'Room A',
          type: 'bar',
          stack: 'bookings',
          barMaxWidth: 20,
          itemStyle: {
            color: '#151515',
            borderRadius: [0, 0, 0, 0],
          },
          data: points.map((p) => p.roomACount),
        },
        {
          name: 'Room B',
          type: 'bar',
          stack: 'bookings',
          barMaxWidth: 20,
          itemStyle: {
            color: '#8BAD12',
            borderRadius: [4, 4, 0, 0],
          },
          data: points.map((p) => p.roomBCount),
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
  }, [points, hasActivity, isLoading, error]);

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="dashboard-booking-trend-heading"
      data-testid="dashboard-booking-trend-section"
      className="space-y-4 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 border-b border-[#151515]/[0.07] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id="dashboard-booking-trend-heading"
              className="text-base font-bold tracking-tight text-[#151515]"
            >
              Tren Volume Booking Studio
            </h3>
            <AdminStatusBadge tone="ivory" size="sm">
              {bookingTrend?.totalActiveBookings ?? 0} Sesi Aktif
            </AdminStatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-[#666159]">
            {bookingTrend?.definitionLabel ||
              'Sesi operasional aktif (tidak termasuk Cancelled & No Show)'}
            .
          </p>
        </div>

        <div
          role="group"
          aria-label="Pilih rentang periode tren booking"
          className="inline-flex self-start rounded-xl border border-[#151515]/10 bg-[#F8F6EF] p-1 sm:self-auto"
        >
          {DASHBOARD_PERIOD_OPTIONS.map((opt) => {
            const isActive = opt.id === periodId;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPeriodChange?.(opt.id)}
                aria-pressed={isActive}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#151515] text-[#F8F6EF] shadow-2xs'
                    : 'text-[#46433D] hover:text-[#151515]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {bookingTrend?.isTruncated ? (
        <div
          role="status"
          data-testid="booking-trend-truncation-banner"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-[#FEF4DD] px-3.5 py-2.5 text-xs text-[#8A4B08]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Cakupan data grafik dibatasi hingga {bookingTrend.maxLimit} dokumen booking pertama pada
            periode {bookingTrend.periodRangeLabel}.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4 sm:flex-row sm:items-center">
          <p className="text-xs font-medium text-red-800">{error}</p>
          {onRetry ? (
            <AdminButton variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Muat Ulang</span>
            </AdminButton>
          ) : null}
        </div>
      ) : isLoading ? (
        <div
          aria-label="Memuat grafik tren booking"
          className="h-64 animate-pulse rounded-2xl border border-[#151515]/[0.07] bg-[#F8F6EF]/70"
        />
      ) : !hasActivity ? (
        <AdminEmptyState
          icon={BarChart3}
          title="Belum ada sesi aktif pada periode ini"
          description={`Tidak ditemukan jadwal sesi aktif antara ${bookingTrend?.periodRangeLabel || 'rentang tanggal terpilih'}.`}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="sa-subcard p-2.5 sm:p-3">
              <p className="text-[11px] font-medium text-[#666159]">Room A</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-[#151515] tabular-nums sm:text-base">
                {bookingTrend.totalRoomABookings} Sesi
              </p>
            </div>
            <div className="sa-subcard p-2.5 sm:p-3">
              <p className="text-[11px] font-medium text-[#666159]">Room B</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-[#151515] tabular-nums sm:text-base">
                {bookingTrend.totalRoomBBookings} Sesi
              </p>
            </div>
            <div className="sa-subcard p-2.5 sm:p-3">
              <p className="text-[11px] font-medium text-[#666159]">Total Durasi</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-[#151515] tabular-nums sm:text-base">
                {bookingTrend.totalHoursBooked} Jam
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#151515]/[0.08] bg-white p-3.5 sm:p-4">
            <div
              ref={containerRef}
              data-testid="booking-trend-echarts-container"
              data-total-active-bookings={bookingTrend.totalActiveBookings}
              role="img"
              aria-label={`Grafik tren volume booking studio untuk ${bookingTrend.periodLabel}`}
              className="w-full overflow-hidden"
              style={{ minHeight: '250px' }}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#151515]/[0.06] pt-2.5 text-[11px] text-[#666159]">
              <span>
                Selesai:{' '}
                <strong className="text-[#151515]">
                  {bookingTrend.totalCompletedBookings} sesi
                </strong>
                {bookingTrend.totalCancelledOrNoShow > 0
                  ? ` • Dikecualikan (Cancelled/No-Show): ${bookingTrend.totalCancelledOrNoShow}`
                  : ''}
              </span>
              <span className="font-mono font-semibold text-[#151515] tabular-nums">
                {bookingTrend.periodRangeLabel} • WIB
              </span>
            </div>
          </div>
        </div>
      )}
    </AdminSurface>
  );
}
