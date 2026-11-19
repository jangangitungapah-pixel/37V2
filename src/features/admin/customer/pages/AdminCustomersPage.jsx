import { useMemo, useState } from 'react';
import { AlertTriangle, Database, Loader2, Phone, Plus, Users, UsersRound } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { useAuth } from '@/features/auth/AuthContext';

import { CustomerArchiveDialog } from '../components/CustomerArchiveDialog';
import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer';
import { CustomerDirectoryTable } from '../components/CustomerDirectoryTable';
import { CustomerDirectoryToolbar } from '../components/CustomerDirectoryToolbar';
import { CustomerFormDialog } from '../components/CustomerFormDialog';
import { CustomerMergeDialog } from '../components/CustomerMergeDialog';
import { LegacyCustomerImportDialog } from '../components/LegacyCustomerImportDialog';
import { useCustomers } from '../hooks/useCustomers';
import {
  createManualCustomer,
  mergeCustomerProfiles,
  setCustomerArchiveStatus,
  updateCustomerPhone,
  updateCustomerProfile,
} from '../services/customer-service';
import {
  buildCustomerPhoneGroups,
  computeCustomerDirectoryMetrics,
} from '../utils/customer-history';
import { CUSTOMER_STATUS } from '../utils/customer-identity';

export function AdminCustomersPage() {
  const { user, profile } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCustomerId = searchParams.get('customerId') || '';

  const {
    customers,
    hasMore,
    isLoading,
    error,
    loadMoreCustomers,
    legacyUnlinkedCount,
    legacyNeedsReviewCount,
    bandNamesByCustomerId,
    refreshLegacyOverview,
  } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest_booking');

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [formDialogState, setFormDialogState] = useState({
    sessionKey: 0,
    open: false,
    mode: 'create',
    customer: null,
  });
  const [mergeDialogState, setMergeDialogState] = useState({
    sessionKey: 0,
    open: false,
    candidates: [],
    initialTargetId: '',
    initialSourceId: '',
    allowCrossPhoneMerge: false,
  });
  const [archiveDialogState, setArchiveDialogState] = useState({
    open: false,
    customer: null,
  });
  const [legacyImportOpen, setLegacyImportOpen] = useState(false);

  const todayIso = getJakartaTodayIso();

  const metrics = useMemo(() => computeCustomerDirectoryMetrics(customers), [customers]);

  const phoneGroups = useMemo(
    () =>
      buildCustomerPhoneGroups({
        customers,
        searchQuery,
        filter: activeFilter,
        sortBy,
        bandNamesByCustomerId,
        referenceDateIso: todayIso,
      }),
    [customers, searchQuery, activeFilter, sortBy, bandNamesByCustomerId, todayIso],
  );

  const visibleProfilesCount = useMemo(
    () => phoneGroups.reduce((sum, g) => sum + g.profiles.length, 0),
    [phoneGroups],
  );

  const activeSelectedCustomerId = selectedCustomerId || urlCustomerId;

  const selectedCustomer = useMemo(() => {
    if (!activeSelectedCustomerId) return null;
    return customers.find((c) => c.id === activeSelectedCustomerId) || null;
  }, [customers, activeSelectedCustomerId]);

  const selectedCustomerPeers = useMemo(() => {
    if (!selectedCustomer?.phoneNormalized) return [];
    return customers.filter(
      (c) =>
        c.status === CUSTOMER_STATUS.ACTIVE &&
        c.phoneNormalized === selectedCustomer.phoneNormalized,
    );
  }, [customers, selectedCustomer]);

  const openFormDialog = (mode, customer = null) => {
    setFormDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode,
      customer,
    }));
  };

  const openMergeDialog = (
    candidates,
    initialTarget = null,
    initialSource = null,
    allowCrossPhoneMerge = false,
  ) => {
    setMergeDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      candidates,
      initialTargetId: initialTarget?.id || candidates[0]?.id || '',
      initialSourceId: initialSource?.id || '',
      allowCrossPhoneMerge,
    }));
  };

  const handleCreateCustomer = async ({ input, allowSharedPhone }) => {
    const created = await createManualCustomer({
      actorUid,
      input,
      allowSharedPhone,
    });
    toast.success(`Profil customer "${created.displayName}" berhasil ditambahkan.`);
    setSelectedCustomerId(created.id);
    return created;
  };

  const handleEditCustomer = async ({ customerId, expectedVersion, input }) => {
    const updated = await updateCustomerProfile({
      customerId,
      expectedVersion,
      actorUid,
      input,
    });
    toast.success(`Profil "${updated.displayName}" berhasil diperbarui.`);
    return updated;
  };

  const handleUpdatePhone = async ({ customerId, expectedVersion, newPhone }) => {
    const updated = await updateCustomerPhone({
      customerId,
      expectedVersion,
      actorUid,
      newPhone,
    });
    toast.success(`Nomor utama "${updated.displayName}" diperbarui ke ${updated.phoneDisplay}.`);
    return updated;
  };

  const handleConfirmMerge = async ({
    targetCustomerId,
    sourceCustomerId,
    allowCrossPhoneMerge,
  }) => {
    const { target, source } = await mergeCustomerProfiles({
      targetCustomerId,
      sourceCustomerId,
      actorUid,
      allowCrossPhoneMerge,
    });
    toast.success(
      `Riwayat "${source.displayName}" berhasil digabung ke "${target.displayName}" (${target.bookingCount} total booking).`,
    );
    setSelectedCustomerId(target.id);
  };

  const handleConfirmArchiveToggle = async ({ customerId, expectedVersion, archived }) => {
    const updated = await setCustomerArchiveStatus({
      customerId,
      expectedVersion,
      archived,
      actorUid,
    });
    toast.success(
      archived
        ? `Profil "${updated.displayName}" telah diarsipkan.`
        : `Profil "${updated.displayName}" telah diaktifkan kembali.`,
    );
  };

  return (
    <div data-customer-scoped="true" className="relative isolate z-0 space-y-2.5 sm:space-y-4">
      {/* Page Header & Compact Metrics Strip */}
      <section
        aria-labelledby="customer-page-heading"
        className="cal-card bg-studio-white p-2.5 sm:p-4"
      >
        <div className="flex flex-col gap-2 min-[340px]:flex-row min-[340px]:items-center min-[340px]:justify-between sm:gap-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold tracking-wider uppercase sm:px-2 sm:text-[9px]">
                <UsersRound className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
                <span>DATA PELANGGAN STUDIO</span>
              </span>
              <span className="border-studio-ink bg-studio-ivory text-studio-ink hidden items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-bold uppercase sm:inline-flex">
                <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>FORMAT NOMOR +62 / INTL</span>
              </span>
            </div>

            <h2
              id="customer-page-heading"
              className="font-display text-studio-ink mt-1 truncate text-lg leading-none font-black tracking-tight uppercase sm:mt-1.5 sm:text-3xl"
            >
              Customer
            </h2>
            <p className="text-studio-muted-ink mt-1 hidden text-xs font-medium sm:block">
              Daftar pelanggan &amp; riwayat booking berdasarkan nomor HP (mendukung nomor yang
              dipakai bersama maupun terpisah).
            </p>
          </div>

          <button
            type="button"
            onClick={() => openFormDialog('create')}
            aria-label="Add Customer"
            className="cal-control bg-studio-orange text-studio-white inline-flex min-h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1 px-3 py-1.5 font-mono text-[10px] font-extrabold tracking-wider uppercase min-[340px]:w-auto sm:min-h-11 sm:gap-1.5 sm:px-4 sm:text-[11px]"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
            <span>Tambah</span>
            <span className="hidden sm:inline">Pelanggan</span>
          </button>
        </div>

        {/* Compact Horizontal Directory Metrics Strip (3 cols cleanly on mobile + desktop) */}
        <dl
          aria-label="Ringkasan daftar pelanggan"
          className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-neutral-200 pt-2 sm:mt-3 sm:gap-2 sm:pt-2.5"
        >
          <div className="border-studio-ink bg-studio-ivory flex flex-col justify-between gap-0.5 border-2 px-2 py-1.5 shadow-[2px_2px_0px_#151515] sm:flex-row sm:items-center sm:gap-2.5 sm:px-3 sm:py-2">
            <div className="min-w-0">
              <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
                <UsersRound className="hidden h-3 w-3 shrink-0 sm:inline" aria-hidden="true" />
                <span className="truncate">Pelanggan</span>
              </dt>
              <p className="text-studio-subtle-ink mt-0.5 hidden truncate font-mono text-[9px] font-semibold sm:block">
                Pelanggan aktif terdaftar
              </p>
            </div>
            <dd className="font-display text-studio-ink shrink-0 text-xl leading-none font-black tabular-nums sm:text-2xl">
              {metrics.totalActiveProfiles}
            </dd>
          </div>

          <div className="border-studio-ink bg-studio-ivory flex flex-col justify-between gap-0.5 border-2 px-2 py-1.5 shadow-[2px_2px_0px_#151515] sm:flex-row sm:items-center sm:gap-2.5 sm:px-3 sm:py-2">
            <div className="min-w-0">
              <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
                <Phone className="hidden h-3 w-3 shrink-0 sm:inline" aria-hidden="true" />
                <span className="truncate">No. HP Unik</span>
              </dt>
              <p className="text-studio-subtle-ink mt-0.5 hidden truncate font-mono text-[9px] font-semibold sm:block">
                Nomor HP terdaftar
              </p>
            </div>
            <dd className="font-display text-studio-ink shrink-0 text-xl leading-none font-black tabular-nums sm:text-2xl">
              {metrics.uniqueActivePhones}
            </dd>
          </div>

          <div
            className={`border-studio-ink flex flex-col justify-between gap-0.5 border-2 px-2 py-1.5 shadow-[2px_2px_0px_#151515] sm:flex-row sm:items-center sm:gap-2.5 sm:px-3 sm:py-2 ${
              metrics.sharedPhoneCount > 0 ? 'bg-amber-100' : 'bg-studio-ivory'
            }`}
          >
            <div className="min-w-0">
              <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
                <Users className="hidden h-3 w-3 shrink-0 sm:inline" aria-hidden="true" />
                <span className="truncate">No. Bersama</span>
              </dt>
              <p className="text-studio-subtle-ink mt-0.5 hidden truncate font-mono text-[9px] font-semibold sm:block">
                {metrics.sharedPhoneCount > 0
                  ? `${metrics.sharedProfileCount} orang berbagi nomor`
                  : 'Belum ada nomor bersama'}
              </p>
            </div>
            <dd className="font-display text-studio-ink shrink-0 text-xl leading-none font-black tabular-nums sm:text-2xl">
              {metrics.sharedPhoneCount}
            </dd>
          </div>
        </dl>
      </section>

      {/* Legacy Booking History Backfill Banner (No Auto-Write on Render!) */}
      {legacyUnlinkedCount > 0 ? (
        <section
          role="region"
          aria-label="Lengkapi data pelanggan booking lama"
          className="cal-card bg-studio-lime/35 flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-4 sm:py-2.5"
        >
          <div className="flex items-start gap-2">
            <Database
              className="text-studio-ink mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-extrabold uppercase sm:text-[10.5px]">
                Booking lama perlu dihubungkan ke daftar pelanggan.
              </p>
              <p className="text-studio-ink mt-0.5 text-[11px] leading-snug font-medium sm:text-xs">
                Ditemukan <strong>{legacyUnlinkedCount} booking lama</strong> yang belum memiliki
                data pelanggan
                {legacyNeedsReviewCount > 0
                  ? ` (${legacyNeedsReviewCount} nomor HP perlu dicek)`
                  : ''}
                . Tinjau daftarnya sebelum menghubungkan data.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLegacyImportOpen(true)}
            className="cal-control bg-studio-ink text-studio-lime inline-flex min-h-8.5 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3 py-1 font-mono text-[10px] font-extrabold uppercase sm:min-h-10 sm:py-1.5 sm:text-[10.5px]"
          >
            <Database className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
            <span>Periksa &amp; Hubungkan</span>
          </button>
        </section>
      ) : null}

      {/* Search, Filter & Sort Toolbar */}
      <CustomerDirectoryToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        visibleGroupsCount={phoneGroups.length}
        visibleProfilesCount={visibleProfilesCount}
        sharedCount={metrics.sharedPhoneCount}
        archivedCount={metrics.archivedCount}
      />

      {/* Load Error Alert */}
      {error ? (
        <div
          role="alert"
          className="cal-card bg-studio-orange text-studio-white flex items-start gap-2 p-3 text-xs font-bold"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Customer Directory Table */}
      {isLoading ? (
        <div
          role="status"
          className="cal-card bg-studio-white flex items-center gap-2 p-4 font-mono text-xs font-bold"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Memuat Customer Directory dari Firestore...</span>
        </div>
      ) : phoneGroups.length === 0 ? (
        <section className="cal-card bg-studio-white p-6 text-center">
          <p className="font-display text-studio-ink text-xl font-black uppercase">
            {searchQuery || activeFilter !== 'all'
              ? 'Tidak Ada Customer yang Cocok'
              : 'Customer Directory Masih Kosong'}
          </p>
          <p className="text-studio-muted-ink mx-auto mt-1 max-w-md text-xs font-medium">
            {searchQuery || activeFilter !== 'all'
              ? 'Coba ubah kata kunci pencarian atau pilih filter All Customers.'
              : 'Customer akan tercatat otomatis saat booking dibuat melalui Calendar, atau Anda dapat menambahkan profil secara manual.'}
          </p>
          {!searchQuery && activeFilter === 'all' ? (
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => openFormDialog('create')}
                className="cal-control bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Customer</span>
              </button>
              {legacyUnlinkedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setLegacyImportOpen(true)}
                  className="cal-control bg-studio-white text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
                >
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Review &amp; Import History</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <div className="space-y-3">
          <CustomerDirectoryTable
            phoneGroups={phoneGroups}
            bandNamesByCustomerId={bandNamesByCustomerId}
            onSelectProfile={(prof) => setSelectedCustomerId(prof.id)}
            onOpenMergeGroup={(activePeers, clickedProfile) =>
              openMergeDialog(activePeers, clickedProfile, null, false)
            }
          />

          {hasMore ? (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={loadMoreCustomers}
                className="cal-control bg-studio-white text-studio-ink inline-flex min-h-10 cursor-pointer items-center justify-center px-4 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
              >
                Muat Lebih Banyak Customer
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Slide-Over Customer Detail Drawer */}
      <CustomerDetailDrawer
        key={selectedCustomer?.id || 'customer-detail-closed'}
        customer={selectedCustomer}
        open={Boolean(selectedCustomer)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedCustomerId('');
            if (urlCustomerId) {
              const next = new URLSearchParams(searchParams);
              next.delete('customerId');
              setSearchParams(next, { replace: true });
            }
          }
        }}
        samePhonePeers={selectedCustomerPeers}
        onEditCustomer={(cust) => openFormDialog('edit', cust)}
        onUpdatePhone={(cust) => openFormDialog('phone', cust)}
        onToggleArchive={(cust) => setArchiveDialogState({ open: true, customer: cust })}
        onOpenMerge={(peers, targetCust) => openMergeDialog(peers, targetCust, null, false)}
      />

      {/* Manual Add / Edit / Update Phone Dialog */}
      <CustomerFormDialog
        key={`form-${formDialogState.sessionKey}`}
        open={formDialogState.open}
        mode={formDialogState.mode}
        customer={formDialogState.customer}
        onOpenChange={(nextOpen) => setFormDialogState((prev) => ({ ...prev, open: nextOpen }))}
        onSubmitCreate={handleCreateCustomer}
        onSubmitEdit={handleEditCustomer}
        onSubmitPhoneUpdate={handleUpdatePhone}
        onResolvePhoneConflictWithMerge={({ targetProfile, sourceProfile }) => {
          openMergeDialog([targetProfile, sourceProfile], targetProfile, sourceProfile, true);
        }}
      />

      {/* Explicit Virtual History Merge Dialog */}
      <CustomerMergeDialog
        key={`merge-${mergeDialogState.sessionKey}`}
        open={mergeDialogState.open}
        candidates={mergeDialogState.candidates}
        initialTargetId={mergeDialogState.initialTargetId}
        initialSourceId={mergeDialogState.initialSourceId}
        allowCrossPhoneMerge={mergeDialogState.allowCrossPhoneMerge}
        onOpenChange={(nextOpen) => setMergeDialogState((prev) => ({ ...prev, open: nextOpen }))}
        onConfirmMerge={handleConfirmMerge}
      />

      {/* Archive / Reactivate Confirmation Dialog */}
      <CustomerArchiveDialog
        open={archiveDialogState.open}
        customer={archiveDialogState.customer}
        onOpenChange={(nextOpen) => setArchiveDialogState((prev) => ({ ...prev, open: nextOpen }))}
        onConfirmArchiveToggle={handleConfirmArchiveToggle}
      />

      {/* Legacy Booking History Import & Needs Review Dialog */}
      <LegacyCustomerImportDialog
        open={legacyImportOpen}
        onOpenChange={setLegacyImportOpen}
        actorUid={actorUid}
        activeCustomers={customers}
        onImportCompleted={() => {
          refreshLegacyOverview().catch(() => {});
        }}
      />
    </div>
  );
}

export default AdminCustomersPage;
