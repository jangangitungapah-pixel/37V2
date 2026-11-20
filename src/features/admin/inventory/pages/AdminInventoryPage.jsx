import { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Loader2, Plus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  AdminButton,
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { InventoryActivityList } from '../components/InventoryActivityList';
import { InventoryAdjustmentDialog } from '../components/InventoryAdjustmentDialog';
import { InventoryArchiveDialog } from '../components/InventoryArchiveDialog';
import { InventoryFilters } from '../components/InventoryFilters';
import { InventoryItemDetailDrawer } from '../components/InventoryItemDetailDrawer';
import { InventoryItemDialog } from '../components/InventoryItemDialog';
import { InventoryItemTable } from '../components/InventoryItemTable';
import { InventoryMovementDialog } from '../components/InventoryMovementDialog';
import { InventoryOverviewMetrics } from '../components/InventoryOverviewMetrics';
import { InventoryToolbar } from '../components/InventoryToolbar';
import { InventoryWorkspaceTabs } from '../components/InventoryWorkspaceTabs';
import { INVENTORY_ITEM_TYPES } from '../config/inventory-config';
import { useInventoryItems } from '../hooks/useInventoryItems';
import { useInventoryMovements } from '../hooks/useInventoryMovements';
import {
  createInventoryItem,
  setInventoryItemArchiveStatus,
  updateInventoryItemMetadata,
} from '../services/inventory-item-service';
import { recordInventoryMovement } from '../services/inventory-movement-service';
import { filterInventoryItems, filterInventoryMovements } from '../utils/inventory-calculation';
import { formatInventoryTimestamp } from '../utils/inventory-format';
import { computeInventorySummaryMetrics } from '../utils/inventory-status';

export function AdminInventoryPage() {
  const { user, profile, role } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || 'staff')
    .trim()
    .toLowerCase();
  const actorName = profile?.displayName || user?.displayName || profile?.email || actorUid;
  const isOwner = actorRole === 'owner';

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'activity' ? 'activity' : 'all';
  const urlItemId = searchParams.get('itemId') || '';

  const [workspaceTab, setWorkspaceTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Activity tab filters
  const [actSearch, setActSearch] = useState('');
  const [actDateFrom, setActDateFrom] = useState('');
  const [actDateTo, setActDateTo] = useState('');
  const [actItemType, setActItemType] = useState('all');
  const [actMovementType, setActMovementType] = useState('all');
  const [actCategory, setActCategory] = useState('all');

  // Selected item & sibling dialog states
  const [selectedItemIdState, setSelectedItemIdState] = useState('');
  const [itemDialogState, setItemDialogState] = useState({
    sessionKey: 0,
    open: false,
    mode: 'create',
    item: null,
  });
  const [movementDialogState, setMovementDialogState] = useState({
    sessionKey: 0,
    open: false,
    item: null,
    initialMovementType: '',
  });
  const [adjustmentDialogState, setAdjustmentDialogState] = useState({
    sessionKey: 0,
    open: false,
    item: null,
  });
  const [archiveDialogState, setArchiveDialogState] = useState({
    sessionKey: 0,
    open: false,
    item: null,
  });

  const showingArchived = statusFilter === 'archived';
  const {
    items: subscribedItems,
    hasMore: hasMoreItems,
    isLoading: isItemsLoading,
    error: itemsError,
    loadMoreItems,
    archivedItems,
    hasMoreArchived,
    isArchivedLoading,
    loadMoreArchived,
    summary,
    refreshAll,
  } = useInventoryItems({ loadArchived: showingArchived });

  const {
    movements,
    hasMore: hasMoreMovements,
    isLoading: isMovementsLoading,
    error: movementsError,
    loadMoreMovements,
  } = useInventoryMovements();

  const todayIso = getJakartaTodayIso();

  // Merge active & archived lists safely without duplicates when showing Archived filter
  const mergedItemsPool = useMemo(() => {
    const map = new Map();
    for (const item of subscribedItems) {
      map.set(item.id, item);
    }
    if (showingArchived) {
      for (const item of archivedItems) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [subscribedItems, archivedItems, showingArchived]);

  const itemsById = useMemo(() => {
    const map = new Map();
    for (const item of mergedItemsPool) {
      map.set(item.id, item);
    }
    return map;
  }, [mergedItemsPool]);

  const localMetrics = useMemo(
    () => computeInventorySummaryMetrics(subscribedItems, todayIso),
    [subscribedItems, todayIso],
  );

  const effectiveSummary = summary?.isServerAggregated ? summary : localMetrics;
  const loadedActiveItems = useMemo(
    () => subscribedItems.filter((item) => item.isActive !== false),
    [subscribedItems],
  );

  const activeConsumablesCount = useMemo(
    () =>
      loadedActiveItems.filter((item) => item.itemType === INVENTORY_ITEM_TYPES.CONSUMABLE).length,
    [loadedActiveItems],
  );
  const activeEquipmentCount = useMemo(
    () =>
      loadedActiveItems.filter((item) => item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT).length,
    [loadedActiveItems],
  );

  const filteredItems = useMemo(
    () =>
      filterInventoryItems({
        items: mergedItemsPool,
        workspaceTab,
        searchQuery,
        typeFilter,
        categoryFilter,
        locationFilter,
        statusFilter,
        todayIso,
      }),
    [
      mergedItemsPool,
      workspaceTab,
      searchQuery,
      typeFilter,
      categoryFilter,
      locationFilter,
      statusFilter,
      todayIso,
    ],
  );

  const filteredMovements = useMemo(
    () =>
      filterInventoryMovements({
        movements,
        itemsById,
        dateFrom: actDateFrom,
        dateTo: actDateTo,
        itemType: actItemType,
        movementType: actMovementType,
        categoryId: actCategory,
        searchQuery: actSearch,
      }),
    [
      movements,
      itemsById,
      actDateFrom,
      actDateTo,
      actItemType,
      actMovementType,
      actCategory,
      actSearch,
    ],
  );

  const activeItemId = selectedItemIdState || urlItemId;
  const selectedItem = activeItemId ? itemsById.get(activeItemId) || null : null;

  const activeDropdownFilterCount = [
    workspaceTab === 'all' && typeFilter !== 'all',
    categoryFilter !== 'all',
    locationFilter !== 'all',
    statusFilter !== 'all' && statusFilter !== 'archived',
  ].filter(Boolean).length;

  const hasActiveDirectoryFilters = Boolean(
    searchQuery ||
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    locationFilter !== 'all' ||
    statusFilter !== 'all',
  );

  const hasActiveActivityFilters = Boolean(
    actSearch ||
    actDateFrom ||
    actDateTo ||
    actItemType !== 'all' ||
    actMovementType !== 'all' ||
    actCategory !== 'all',
  );

  const handleTabChange = (nextTab) => {
    setWorkspaceTab(nextTab);
    if (nextTab === 'consumables' || nextTab === 'equipment') {
      setTypeFilter('all');
    }
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'activity') {
      nextParams.set('tab', 'activity');
    } else {
      nextParams.delete('tab');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleClearDirectoryFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setLocationFilter('all');
    setStatusFilter('all');
  };

  const handleClearActivityFilters = () => {
    setActSearch('');
    setActDateFrom('');
    setActDateTo('');
    setActItemType('all');
    setActMovementType('all');
    setActCategory('all');
  };

  const handleSelectItem = (item) => {
    if (!item?.id) return;
    setSelectedItemIdState(item.id);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('itemId', item.id);
    setSearchParams(nextParams, { replace: true });
  };

  const handleCloseDrawer = (nextOpen) => {
    if (!nextOpen) {
      setSelectedItemIdState('');
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('itemId');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const openCreateDialog = () => {
    setItemDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode: 'create',
      item: null,
    }));
  };

  const openEditDialog = (item) => {
    setItemDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode: 'edit',
      item,
    }));
  };

  const openMovementDialog = (item, initialMovementType = '') => {
    setMovementDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      item,
      initialMovementType,
    }));
  };

  const openAdjustmentDialog = (item) => {
    setAdjustmentDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      item,
    }));
  };

  const openArchiveDialog = (item) => {
    setArchiveDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      item,
    }));
  };

  const handleCreateItem = async ({ itemId, openingMovementId, input }) => {
    const result = await createInventoryItem({
      itemId,
      openingMovementId,
      actorUid,
      actorName,
      input,
    });
    toast.success(`Barang "${result.item.name}" berhasil ditambahkan.`);
    await refreshAll();
    handleSelectItem(result.item);
    return result;
  };

  const handleEditItem = async ({ itemId, expectedVersion, locationMovementId, input }) => {
    const result = await updateInventoryItemMetadata({
      itemId,
      expectedVersion,
      locationMovementId,
      actorUid,
      actorName,
      input,
    });
    toast.success(`Metadata "${result.item.name}" berhasil diperbarui.`);
    await refreshAll();
    return result;
  };

  const handleRecordMovement = async (params) => {
    const result = await recordInventoryMovement({
      ...params,
      actorUid,
      actorRole,
      actorName,
    });
    toast.success(
      result.replayed
        ? `Pergerakan "${result.item.name}" sudah tercatat sebelumnya.`
        : `Pergerakan stok "${result.item.name}" berhasil disimpan.`,
    );
    await refreshAll();
    return result;
  };

  const handleConfirmArchiveToggle = async ({ itemId, expectedVersion, archived }) => {
    const updated = await setInventoryItemArchiveStatus({
      itemId,
      expectedVersion,
      archived,
      actorUid,
      actorRole,
    });
    toast.success(
      archived
        ? `"${updated.name}" telah diarsipkan.`
        : `"${updated.name}" telah diaktifkan kembali.`,
    );
    await refreshAll();
    return updated;
  };

  const lastActivityLabel = movements[0]
    ? formatInventoryTimestamp(movements[0].occurredAt || movements[0].createdAt)
    : 'Belum ada aktivitas';

  const activeError = workspaceTab === 'activity' ? movementsError : itemsError;

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Header + 4 Deduplicated Summary Metrics */}
      <AdminPageHeader
        compactMobile
        eyebrow="PERALATAN & PERLENGKAPAN STUDIO"
        icon={Boxes}
        title="Inventory"
        titleId="inventory-page-heading"
        description="Manage studio equipment, supplies, and maintenance status."
        meta={
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <AdminStatusBadge tone="ivory" size="sm" className="font-mono">
              {effectiveSummary.activeItemsCount}{' '}
              <span className="hidden sm:inline">Active Items</span>
              <span className="sm:hidden">Aktif</span>
            </AdminStatusBadge>
            <AdminStatusBadge
              tone="neutral"
              size="sm"
              className={`font-mono ${movements[0] ? '' : 'hidden sm:inline-flex'}`}
            >
              <span className="hidden sm:inline">Last activity: </span>
              {lastActivityLabel}
            </AdminStatusBadge>
          </div>
        }
        actions={
          <AdminButton
            variant="orange"
            size="xs"
            onClick={openCreateDialog}
            className="gap-1.5 px-2.5 py-1 text-xs sm:min-h-10 sm:gap-2 sm:px-4 sm:py-2 sm:text-[13px]"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            <span>Add Item</span>
          </AdminButton>
        }
      >
        <InventoryOverviewMetrics
          summary={effectiveSummary}
          loadedActiveCount={loadedActiveItems.length}
          outOfStockCount={localMetrics.outOfStockCount}
          hasMoreItems={
            hasMoreItems && effectiveSummary.activeItemsCount > loadedActiveItems.length
          }
          onLoadMoreItems={loadMoreItems}
        />
      </AdminPageHeader>

      {activeError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-[#FF4B22]/25 bg-[#FFEDE8] px-4 py-3 text-xs font-medium text-[#B92B0C]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      ) : null}

      {/* Segmented Workspace Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <InventoryWorkspaceTabs
          activeTab={workspaceTab}
          onTabChange={handleTabChange}
          allCount={effectiveSummary.activeItemsCount}
          consumablesCount={activeConsumablesCount}
          equipmentCount={activeEquipmentCount}
          activityCount={movements.length}
        />
      </div>

      {/* Main Tab Content */}
      {workspaceTab === 'activity' ? (
        <InventoryActivityList
          movements={filteredMovements}
          itemsById={itemsById}
          searchQuery={actSearch}
          onSearchQueryChange={setActSearch}
          dateFrom={actDateFrom}
          onDateFromChange={setActDateFrom}
          dateTo={actDateTo}
          onDateToChange={setActDateTo}
          itemTypeFilter={actItemType}
          onItemTypeFilterChange={setActItemType}
          movementTypeFilter={actMovementType}
          onMovementTypeFilterChange={setActMovementType}
          categoryFilter={actCategory}
          onCategoryFilterChange={setActCategory}
          hasActiveFilters={hasActiveActivityFilters}
          onClearFilters={handleClearActivityFilters}
          hasMore={hasMoreMovements}
          isLoading={isMovementsLoading}
          onLoadMore={loadMoreMovements}
          onSelectItemById={(id) => {
            const matched = itemsById.get(id);
            if (matched) handleSelectItem(matched);
          }}
        />
      ) : (
        <div className="space-y-3 sm:space-y-4">
          <AdminSurface
            as="section"
            variant="card"
            aria-label="Pencarian dan filter inventory"
            className="space-y-2.5 p-3 sm:space-y-3 sm:p-5"
          >
            <InventoryToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              showingArchived={showingArchived}
              onToggleArchived={(next) => setStatusFilter(next ? 'archived' : 'all')}
              visibleCount={filteredItems.length}
              archivedCount={effectiveSummary.archivedItemsCount || archivedItems.length}
              filtersExpanded={mobileFiltersOpen}
              onToggleFilters={() => setMobileFiltersOpen((prev) => !prev)}
              activeFilterCount={activeDropdownFilterCount}
            />

            <InventoryFilters
              workspaceTab={workspaceTab}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              locationFilter={locationFilter}
              onLocationFilterChange={setLocationFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              hasActiveFilters={hasActiveDirectoryFilters}
              mobileExpanded={mobileFiltersOpen}
              onClearFilters={handleClearDirectoryFilters}
            />
          </AdminSurface>

          {(isItemsLoading && subscribedItems.length === 0) ||
          (showingArchived && isArchivedLoading && archivedItems.length === 0) ? (
            <AdminSurface
              variant="card"
              className="flex items-center justify-center gap-2.5 p-6 text-xs text-[#666159] sm:p-10"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Memuat data inventory studio...</span>
            </AdminSurface>
          ) : filteredItems.length === 0 ? (
            <AdminEmptyState
              icon={Boxes}
              title={
                hasActiveDirectoryFilters
                  ? 'Tidak ada barang yang sesuai filter'
                  : 'Belum ada barang di daftar Inventory'
              }
              description={
                hasActiveDirectoryFilters
                  ? 'Coba ubah kata kunci pencarian atau reset filter yang sedang aktif.'
                  : 'Tambahkan Consumables (senar, stik drum, tape) atau Equipment (mic, ampli, kabel) studio pertama Anda.'
              }
              className="!px-3.5 !py-5 sm:!px-6 sm:!py-10"
              action={
                hasActiveDirectoryFilters ? (
                  <AdminButton variant="secondary" onClick={handleClearDirectoryFilters}>
                    Clear Filters
                  </AdminButton>
                ) : (
                  <AdminButton variant="orange" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Add Item</span>
                  </AdminButton>
                )
              }
            />
          ) : (
            <InventoryItemTable
              items={filteredItems}
              onSelectItem={handleSelectItem}
              onQuickMovement={(item) => openMovementDialog(item)}
              hasMore={showingArchived ? hasMoreArchived : hasMoreItems}
              onLoadMore={showingArchived ? loadMoreArchived : loadMoreItems}
              totalSummaryLabel={
                showingArchived
                  ? `Menampilkan ${filteredItems.length} item diarsipkan`
                  : `Menampilkan ${filteredItems.length} item (${loadedActiveItems.length} dari ${effectiveSummary.activeItemsCount} total item aktif termuat)`
              }
            />
          )}
        </div>
      )}

      {/* Item Detail Drawer */}
      <InventoryItemDetailDrawer
        item={selectedItem}
        open={Boolean(selectedItem)}
        isOwner={isOwner}
        onOpenChange={handleCloseDrawer}
        onEditMetadata={openEditDialog}
        onOpenMovement={openMovementDialog}
        onOpenAdjustment={openAdjustmentDialog}
        onOpenArchive={openArchiveDialog}
      />

      {/* Create / Edit Metadata Dialog */}
      {itemDialogState.open ? (
        <InventoryItemDialog
          key={itemDialogState.sessionKey}
          open={itemDialogState.open}
          mode={itemDialogState.mode}
          item={itemDialogState.item}
          existingItems={mergedItemsPool}
          onOpenChange={(next) => setItemDialogState((prev) => ({ ...prev, open: next }))}
          onSubmitCreate={handleCreateItem}
          onSubmitEdit={handleEditItem}
        />
      ) : null}

      {/* Operational Record Movement Dialog */}
      {movementDialogState.open && movementDialogState.item ? (
        <InventoryMovementDialog
          key={movementDialogState.sessionKey}
          open={movementDialogState.open}
          item={movementDialogState.item}
          initialMovementType={movementDialogState.initialMovementType}
          onOpenChange={(next) => setMovementDialogState((prev) => ({ ...prev, open: next }))}
          onSubmitMovement={handleRecordMovement}
        />
      ) : null}

      {/* Owner-Only Stock Adjustment Dialog */}
      {adjustmentDialogState.open && adjustmentDialogState.item ? (
        <InventoryAdjustmentDialog
          key={adjustmentDialogState.sessionKey}
          open={adjustmentDialogState.open}
          item={adjustmentDialogState.item}
          isOwner={isOwner}
          onOpenChange={(next) => setAdjustmentDialogState((prev) => ({ ...prev, open: next }))}
          onSubmitAdjustment={handleRecordMovement}
        />
      ) : null}

      {/* Archive / Reactivate Dialog */}
      {archiveDialogState.open && archiveDialogState.item ? (
        <InventoryArchiveDialog
          key={archiveDialogState.sessionKey}
          open={archiveDialogState.open}
          item={archiveDialogState.item}
          isOwner={isOwner}
          onOpenChange={(next) => setArchiveDialogState((prev) => ({ ...prev, open: next }))}
          onConfirmArchiveToggle={handleConfirmArchiveToggle}
        />
      ) : null}
    </div>
  );
}

export default AdminInventoryPage;
