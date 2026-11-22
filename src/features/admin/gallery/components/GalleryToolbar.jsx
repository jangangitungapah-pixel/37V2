import { Search, X } from 'lucide-react';

import { GALLERY_STATUSES } from '../config/gallery-config';

const PHOTO_FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: GALLERY_STATUSES.PUBLISHED, label: 'Galeri Website' },
  { id: GALLERY_STATUSES.DRAFT, label: 'Tersembunyi' },
  { id: GALLERY_STATUSES.ARCHIVED, label: 'Arsip' },
];

export function GalleryToolbar({
  activeFilter = 'all',
  onFilterChange,
  counts = { total: 0, published: 0, draft: 0, archived: 0 },
  searchQuery = '',
  onSearchChange,
}) {
  const getCount = (id) => {
    if (id === 'all') return counts.total;
    if (id === GALLERY_STATUSES.PUBLISHED) return counts.published;
    if (id === GALLERY_STATUSES.DRAFT) return counts.draft;
    if (id === GALLERY_STATUSES.ARCHIVED) return counts.archived;
    return 0;
  };

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div
        role="group"
        aria-label="Filter koleksi foto"
        className="flex flex-wrap items-center gap-1.5"
      >
        {PHOTO_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const count = getCount(filter.id);
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onFilterChange?.(filter.id)}
              className={`sa-control inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-[#151515] text-[#F1EEE4]'
                  : 'bg-white/80 text-[#46433D] hover:bg-[#151515]/[0.07]'
              }`}
            >
              <span>{filter.label}</span>
              <span
                className={`py-0.2 rounded-full px-1.5 font-mono text-[10px] ${
                  isActive ? 'bg-[#C8F13A] text-[#151515]' : 'bg-[#151515]/10 text-[#46433D]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative min-w-0 sm:w-60">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#756F65]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Cari judul foto..."
          aria-label="Search gallery photos by title"
          className="sa-control min-h-9 w-full rounded-full border-[#151515]/15 bg-white pr-8 pl-8.5 text-xs text-[#151515] focus:border-[#151515] focus:outline-none"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange?.('')}
            aria-label="Clear search query"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-full p-0.5 text-[#756F65] hover:text-[#151515]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
