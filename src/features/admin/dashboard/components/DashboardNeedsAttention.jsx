import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  HandCoins,
  Inbox,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { DASHBOARD_ATTENTION_TYPES } from '../config/dashboard-config';

const ICON_BY_TYPE = {
  [DASHBOARD_ATTENTION_TYPES.OVERDUE_INVOICES]: AlertTriangle,
  [DASHBOARD_ATTENTION_TYPES.NEW_BOOKING_REQUESTS]: Inbox,
  [DASHBOARD_ATTENTION_TYPES.ACTIVE_SESSION_ACTION]: Clock,
  [DASHBOARD_ATTENTION_TYPES.COMMISSION_REVIEW]: HandCoins,
  [DASHBOARD_ATTENTION_TYPES.OUTSTANDING_PAYABLES]: HandCoins,
  [DASHBOARD_ATTENTION_TYPES.EQUIPMENT_MAINTENANCE]: Wrench,
  [DASHBOARD_ATTENTION_TYPES.UNPAID_INVOICES]: CreditCard,
};

/**
 * SECTION D — Needs Attention
 * Surfaces only genuine operational or financial items requiring action,
 * ordered strictly by business urgency.
 */
export function DashboardNeedsAttention({
  items = [],
  recentBookingRequests = [],
  hasMoreNewBookingRequests = false,
  isLoading = false,
  error = null,
  onRetry,
}) {
  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="dashboard-needs-attention-heading"
      className="space-y-3 p-3.5 sm:p-4 lg:p-5"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3
              id="dashboard-needs-attention-heading"
              className="text-[15px] font-bold tracking-tight text-[#151515]"
            >
              Perlu Perhatian
            </h3>
            <AdminStatusBadge
              tone={items.length > 0 ? 'orange' : 'emerald'}
              size="sm"
              dot={items.length > 0}
            >
              {items.length > 0 ? `${items.length} Prioritas` : 'Terkendali'}
            </AdminStatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-[#666159]">
            Antrian tindak lanjut operasional berdasarkan tingkat urgensi.
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 p-3.5 sm:flex-row sm:items-center">
          <p className="text-xs font-medium text-red-800">{error}</p>
          {onRetry ? (
            <AdminButton variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Coba Lagi</span>
            </AdminButton>
          ) : null}
        </div>
      ) : isLoading ? (
        <div className="space-y-2" aria-label="Memuat antrian tindak lanjut">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-20 animate-pulse rounded-xl border border-[#151515]/[0.07] bg-[#F8F6EF]/70 p-3"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div
          data-testid="needs-attention-empty-state"
          className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-[#E6F6EC]/55 px-4 py-8 text-center"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F6EC] text-[#0F6246]">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-2.5 text-sm font-bold text-[#151515]">
            Semua operasional dalam kondisi terkendali.
          </p>
          <p className="mt-1 max-w-xs text-xs text-[#46433D]">
            Tidak ada tagihan jatuh tempo, kendala inventaris, atau antrian tindakan mendesak saat
            ini.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Daftar item yang memerlukan perhatian">
          {items.map((item) => {
            const Icon = ICON_BY_TYPE[item.type] || AlertTriangle;
            return (
              <li
                key={item.id}
                data-testid={`attention-item-${item.type}`}
                className="rounded-xl border border-[#151515]/[0.075] bg-[#FAF8F2]/80 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#151515]/16 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#151515]/[0.06] bg-white text-[#151515] shadow-2xs">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <AdminStatusBadge tone={item.badgeTone} size="sm">
                          {item.badgeLabel}
                        </AdminStatusBadge>
                      </div>
                      <h4 className="mt-1 text-xs font-bold text-[#151515] sm:text-sm">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#5C5850]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-end border-t border-[#151515]/[0.06] pt-2">
                  <Link
                    to={item.href}
                    className="sa-btn-primary inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#F8F6EF]"
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && recentBookingRequests.length > 0 ? (
        <div
          data-testid="dashboard-recent-booking-requests"
          className="space-y-2 border-t border-[#151515]/[0.08] pt-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10.5px] font-bold tracking-wider text-[#46433D] uppercase">
              Permintaan Masuk Terbaru{hasMoreNewBookingRequests ? ' (Terbatas)' : ''}
            </p>
            <Link
              to="/admin/booking-requests"
              className="inline-flex min-h-11 items-center rounded-lg px-1.5 text-[11px] font-semibold text-[#B92B0C] hover:underline"
            >
              Semua Inbox →
            </Link>
          </div>
          <ul className="space-y-1.5">
            {recentBookingRequests.map((req) => (
              <li key={req.id}>
                <Link
                  to={`/admin/booking-requests?requestId=${encodeURIComponent(req.id)}`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[#151515]/[0.08] bg-[#FAF8F1] px-3 py-2 text-xs transition-colors hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#151515]">
                      {req.customerName} · {req.serviceLabelSnapshot}
                    </p>
                    <p className="truncate font-mono text-[10.5px] text-[#666159]">
                      {req.requestReference}
                      {req.preferredDate
                        ? ` · ${req.preferredDate} ${req.preferredTimeLabel || ''}`
                        : ' · Post-Production'}
                    </p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#46433D]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AdminSurface>
  );
}
