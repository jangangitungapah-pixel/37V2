import { Archive, CheckCircle2, Clock3, Star, XCircle } from 'lucide-react';

import { AdminSurface } from '@/features/admin/design-system';

export function ReviewOverviewCards({ overview }) {
  const cards = [
    {
      id: 'rating',
      label: 'Average Published Rating',
      value: overview.statsPublishedCount > 0 ? `${overview.averageRatingLabel} / 5` : 'Belum Ada',
      sub: `${overview.statsPublishedCount} ulasan tayang publik`,
      icon: Star,
      toneClass: 'bg-[#F4FBE0] border-[#8BAD12]/35 text-[#243300]',
    },
    {
      id: 'pending',
      label: 'Pending Moderation',
      value: String(overview.pending),
      sub: 'Menunggu persetujuan Owner',
      icon: Clock3,
      toneClass: 'bg-[#FEF4DD] border-amber-500/30 text-[#8A4B08]',
    },
    {
      id: 'published',
      label: 'Published Reviews',
      value: String(overview.published),
      sub: 'Aktif tampil di Landing Page',
      icon: CheckCircle2,
      toneClass: 'bg-[#E6F6EC] border-emerald-500/30 text-[#0F6246]',
    },
    {
      id: 'rejected',
      label: 'Rejected / Archived',
      value: `${overview.rejected} / ${overview.archived}`,
      sub: 'Ditolak / diarsipkan dari publik',
      icon: Archive,
      toneClass: 'bg-[#FAF8F3] border-[#151515]/12 text-[#46433D]',
    },
  ];

  return (
    <div
      data-testid="admin-reviews-overview-cards"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon || XCircle;
        return (
          <AdminSurface
            key={card.id}
            variant="card"
            className="p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-[10px] leading-tight font-bold tracking-wider text-[#756F65] uppercase sm:text-[10.5px]">
                {card.label}
              </p>
              <span
                className={`inline-flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl border sm:h-8.5 sm:w-8.5 ${card.toneClass}`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-xl font-extrabold tracking-tight text-[#151515] tabular-nums sm:mt-2.5 sm:text-3xl">
              {card.value}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[#666159] sm:text-xs">{card.sub}</p>
          </AdminSurface>
        );
      })}
    </div>
  );
}
