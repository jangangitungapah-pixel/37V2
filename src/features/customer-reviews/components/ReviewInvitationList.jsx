import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router';

import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminEmptyState, AdminSurface } from '@/features/admin/design-system';

import { resolveEffectiveInvitationStatus } from '../utils/customer-review-normalize';
import { ReviewStatusBadge } from './ReviewStatusBadge';

export function ReviewInvitationList({ invitations = [], reviewsByBookingId = new Map() }) {
  if (!invitations.length) {
    return (
      <AdminEmptyState
        title="Belum Ada Undangan Ulasan"
        description="Buat undangan ulasan langsung dari detail booking yang berstatus Completed di menu Admin Calendar."
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="admin-review-invitations-list">
      {invitations.map((inv) => {
        const effectiveStatus = resolveEffectiveInvitationStatus(inv);
        const linkedReview = reviewsByBookingId.get(inv.bookingId) || null;

        return (
          <AdminSurface
            key={inv.id}
            variant="card"
            data-testid={`admin-invitation-row-${inv.bookingId}`}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ReviewStatusBadge status={effectiveStatus} kind="invitation" />
                {linkedReview ? (
                  <ReviewStatusBadge status={linkedReview.status} kind="review" />
                ) : null}
                <span className="font-mono text-[11px] font-bold text-[#151515]">
                  Booking: {inv.bookingId}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#666159]">
                <span>
                  Layanan: <strong>{inv.serviceLabelSnapshot || '-'}</strong>
                </span>
                <span>
                  Tanggal Sesi: <strong>{inv.sessionDate || '-'}</strong>
                </span>
                <span>Dibuat: {formatIndonesianTimestamp(inv.issuedAt)}</span>
                <span>Kedaluwarsa: {formatIndonesianTimestamp(inv.expiresAt)}</span>
              </div>
              <p className="mt-1 font-mono text-[10.5px] break-words text-[#8B857B]">
                Token Hash Prefix: {inv.id.slice(0, 12)}… (token mentah tidak pernah disimpan)
              </p>
            </div>

            <Link
              to={`/admin/calendar?bookingId=${encodeURIComponent(inv.bookingId)}`}
              className="sa-control sa-btn-secondary inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold sm:w-auto"
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Buka Booking di Calendar</span>
            </Link>
          </AdminSurface>
        );
      })}
    </div>
  );
}
