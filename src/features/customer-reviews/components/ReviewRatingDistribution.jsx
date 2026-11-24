import { Star } from 'lucide-react';

import { AdminSurface } from '@/features/admin/design-system';

export function ReviewRatingDistribution({ overview }) {
  const total = Math.max(0, Number(overview?.statsPublishedCount || 0));
  const distribution = overview?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  return (
    <AdminSurface
      variant="card"
      data-testid="admin-reviews-rating-distribution"
      className="p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight break-words text-[#151515]">
            Distribusi Bintang Publik (`publicReviewStats/summary`)
          </h3>
          <p className="text-xs text-[#666159]">Dihitung atomik dari ulasan berstatus Published.</p>
        </div>
        <span className="font-mono text-xs font-bold text-[#151515]">
          {total} ulasan terpublikasi
        </span>
      </div>

      <div className="mt-3.5 space-y-2">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = Number(distribution[String(stars)] || 0);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={stars} className="flex items-center gap-3 text-xs">
              <span className="inline-flex w-14 shrink-0 items-center gap-1 font-mono font-bold text-[#151515]">
                <span>{stars}</span>
                <Star className="h-3.5 w-3.5 fill-current text-[#151515]" aria-hidden="true" />
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-[#151515]/10 bg-[#F2EFE8]">
                <div
                  className="h-full rounded-full bg-[#C8F13A] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-[11px] font-semibold text-[#46433D] tabular-nums">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </AdminSurface>
  );
}
