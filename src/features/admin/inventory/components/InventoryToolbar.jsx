import { useEffect, useRef, useState } from 'react';
import { Archive, Filter, Search, X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

/**
 * Search toolbar with debounced query normalization (`200ms`) so Firestore/UI
 * avoids excessive work per keystroke, paired with quick mobile Filter & Archived toggles.
 */
export function InventoryToolbar({
  searchQuery = '',
  onSearchQueryChange,
  showingArchived = false,
  onToggleArchived,
  visibleCount = 0,
  archivedCount = 0,
  filtersExpanded = false,
  onToggleFilters,
  activeFilterCount = 0,
}) {
  const [draftQuery, setDraftQuery] = useState(searchQuery);
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  const debounceTimerRef = useRef(null);

  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setDraftQuery(searchQuery);
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleInputChange = (nextValue) => {
    setDraftQuery(nextValue);
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      onSearchQueryChange?.(nextValue);
    }, 200);
  };

  const handleClear = () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    setDraftQuery('');
    onSearchQueryChange?.('');
  };

  const filterHighlighted = filtersExpanded || activeFilterCount > 0;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8B857B]"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Cari barang inventory"
          placeholder="Search item name, code, category..."
          value={draftQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          className="sa-input min-h-10.5 w-full pr-10 pl-9 text-xs font-medium text-[#151515] sm:text-sm"
        />
        {draftQuery ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Hapus kata kunci pencarian"
            className="absolute top-1/2 right-1 inline-flex h-8.5 w-8.5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#666159] hover:bg-[#151515]/[0.06] hover:text-[#151515]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:justify-end sm:gap-2">
        <div className="flex items-center gap-1.5">
          {onToggleFilters ? (
            <button
              type="button"
              onClick={onToggleFilters}
              aria-expanded={filterHighlighted}
              className={`sa-control inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold sm:hidden ${
                filterHighlighted
                  ? 'border-[#8BAD12]/40 bg-[#EDF8C2] text-[#243300]'
                  : 'sa-btn-secondary text-[#46433D]'
              }`}
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filter</span>
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-[#151515] px-1.5 py-0.5 font-mono text-[9.5px] leading-none font-bold text-[#F1EEE4]">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onToggleArchived?.(!showingArchived)}
            aria-pressed={showingArchived}
            className={`sa-control inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold sm:py-1.5 ${
              showingArchived ? 'bg-[#151515] text-[#F1EEE4]' : 'sa-btn-secondary text-[#46433D]'
            }`}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Archived ({archivedCount})</span>
          </button>
        </div>

        <AdminStatusBadge tone="ivory" size="sm" className="font-mono font-semibold">
          {visibleCount} <span className="hidden sm:inline">item </span>tampil
        </AdminStatusBadge>
      </div>
    </div>
  );
}
