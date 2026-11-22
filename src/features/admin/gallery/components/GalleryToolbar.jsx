import { Eye, Search, X } from 'lucide-react';

import { AdminButton, AdminSurface } from '@/features/admin/design-system';

import { GALLERY_FILTER_TABS } from '../config/gallery-config';

export function GalleryToolbar({
  activeFilter = 'all',
  onFilterChange,
  counts = { total: 0, published: 0, draft: 0, archived: 0 },
  searchQuery = '',
  onSearchChange,
  showPublicPreview = false,
  onTogglePublicPreview,
}) {
  const getCountForTab = (tabId) => {
    if (tabId === 'all') return counts.total;
    if (tabId === 'published') return counts.published;
    if (tabId === 'draft') return counts.draft;
    if (tabId === 'archived') return counts.archived;
    return 0;
  };

  return (
    <AdminSurface variant="card" className="p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Status Filter Pills */}
        <div
          role="group"
          aria-label="Filter gallery by publication status"
          className="flex flex-wrap items-center gap-1.5"
        >
          {GALLERY_FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            const count = getCountForTab(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange?.(tab.id)}
                className={`sa-control inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#151515] text-[#F1EEE4]'
                    : 'bg-[#F8F6EF] text-[#46433D] hover:bg-[#151515]/[0.07]'
                }`}
              >
                <span>{tab.label}</span>
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

        {/* Search Input & Public Arrangement Preview Toggle */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:w-64">
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
              className="sa-control min-h-9.5 w-full border-[#151515]/15 bg-white pr-8 pl-8.5 text-xs text-[#151515] focus:border-[#151515] focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                aria-label="Clear search query"
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-[#756F65] hover:text-[#151515]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <AdminButton
            type="button"
            variant={showPublicPreview ? 'lime' : 'secondary'}
            size="sm"
            aria-pressed={showPublicPreview}
            onClick={onTogglePublicPreview}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{showPublicPreview ? 'Hide Public Preview' : 'Preview Public Gallery'}</span>
          </AdminButton>
        </div>
      </div>
    </AdminSurface>
  );
}
