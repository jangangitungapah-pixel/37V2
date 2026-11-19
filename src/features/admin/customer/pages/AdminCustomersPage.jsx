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
    <div data-customer-scoped="true" className="relative isolate z-0 space-y-3.5 sm:space-y-4">
      {/* Page Header & Compact Metrics Strip (matches CalendarToolbar.jsx scale) */}
      <section
        aria-labelledby="customer-page-heading"
        className="cal-card bg-studio-white p-3 sm:p-4"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
                <UsersRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>PHONE-BASED CUSTOMER IDENTITY</span>
              </span>
              <span className="border-studio-ink bg-studio-ivory text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-bold uppercase">
                <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>CANONICAL +62 / INTL</span>
              </span>
            </div>

            <h2
              id="customer-page-heading"
              className="font-display text-studio-ink mt-1.5 truncate text-xl leading-none font-black tracking-tight uppercase sm:text-3xl"
            >
              Customer
            </h2>
            <p className="text-studio-muted-ink mt-1 hidden text-xs font-medium sm:block">
              Customer Directory &amp; Booking History berbasis nomor HP yang terpisah maupun
              tergabung.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openFormDialog('create')}
            className="cal-control bg-studio-orange text-studio-white inline-flex min-h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-1.5 font-mono text-[11px] font-extrabold tracking-wider uppercase sm:min-h-11 sm:w-auto sm:px-4"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Compact Horizontal Directory Metrics Strip */}
        <dl
          aria-label="Ringkasan Customer Directory"
          className="mt-3 grid grid-cols-1 gap-2 border-t border-neutral-200 pt-2.5 sm:grid-cols-3"
        >
          <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-2.5 border-2 px-3 py-2 shadow-[2px_2px_0px_#151515]">
            <div className="min-w-0">
              <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase">
                <UsersRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Customer Profiles</span>
              </dt>
              <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[9px] font-semibold">
                Profil aktif terdaftar
              </p>
            </div>
            <dd className="font-display text-studio-ink shrink-0 text-2xl leading-none font-black tabular-nums">
              {metrics.totalActiveProfiles}
            </dd>
          </div>

          <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-2.5 border-2 px-3 py-2 shadow-[2px_2px_0px_#151515]">
            <div className="min-w-0">
              <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase">
                <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Unique Phone Numbers</span>
              </dt>
              <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[9px] font-semibold">
                Nomor canonical (+62 / intl)
              </p>
            </div>
            <dd className="font-display text-studio-ink shrink-0 text-2xl leading-none font-black tabular-nums">
              {metrics.uniqueActivePhones}
            </dd>
          </div>

          <div
            className={`border-studio-ink flex items-center justify-between gap-2.5 border-2 px-3 py-2 shadow-[2px_2px_0px_#151515] ${
              metrics.sharedPhoneCount > 0 ? 'bg-amber-100' : 'bg-studio-ivory'
            }`}
          >
            <div className="min-w-0">
              <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase">
                <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Duplicate / Shared Numbers</span>
              </dt>
              <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[9px] font-semibold">
                {metrics.sharedPhoneCount > 0
                  ? `${metrics.sharedProfileCount} profil berbagi nomor`
                  : 'Tidak ada nomor berbagi saat ini'}
              </p>
            </div>
            <dd className="font-display text-studio-ink shrink-0 text-2xl leading-none font-black tabular-nums">
              {metrics.sharedPhoneCount}
            </dd>
          </div>
        </dl>
      </section>

      {/* Legacy Booking History Backfill Banner (No Auto-Write on Render!) */}
      {legacyUnlinkedCount > 0 ? (
        <section
          role="region"
          aria-label="Import histori booking lama"
          className="cal-card bg-studio-lime/35 flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2.5"
        >
          <div className="flex items-start gap-2">
            <Database className="text-studio-ink mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] font-extrabold uppercase">
                Existing booking records need to be linked to Customer Directory.
              </p>
              <p className="text-studio-ink mt-0.5 text-xs font-medium">
                Ditemukan <strong>{legacyUnlinkedCount} booking historis</strong> yang belum
                memiliki profil customer
                {legacyNeedsReviewCount > 0
                  ? ` (${legacyNeedsReviewCount} perlu review nomor HP)`
                  : ''}
                . Tinjau preview sebelum menjalankan import.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLegacyImportOpen(true)}
            className="cal-control bg-studio-ink text-studio-lime inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
          >
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Review &amp; Import History</span>
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
