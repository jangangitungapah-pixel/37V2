import { useEffect, useRef, useState } from 'react';
import { Archive, Search, X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

/**
 * Search toolbar with debounced query normalization (`200ms`) so Firestore/UI
 * avoids excessive work per keystroke, paired with a quick Active/Archived toggle.
 */
export function InventoryToolbar({
  searchQuery = '',
  onSearchQueryChange,
  showingArchived = false,
  onToggleArchived,
  visibleCount = 0,
  archivedCount = 0,
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

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
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
          className="sa-input min-h-11 w-full pr-9 pl-9 text-xs font-medium text-[#151515] sm:min-h-10 sm:text-sm"
        />
        {draftQuery ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Hapus kata kunci pencarian"
            className="absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[#666159] hover:bg-[#151515]/[0.06] hover:text-[#151515]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => onToggleArchived?.(!showingArchived)}
          aria-pressed={showingArchived}
          className={`sa-control inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${
            showingArchived ? 'bg-[#151515] text-[#F1EEE4]' : 'sa-btn-secondary text-[#46433D]'
          }`}
        >
          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Archived ({archivedCount})</span>
        </button>

        <AdminStatusBadge tone="ivory" size="sm" className="font-mono font-semibold">
          {visibleCount} item tampil
        </AdminStatusBadge>
      </div>
    </div>
  );
}
