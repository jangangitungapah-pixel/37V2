import { useMemo, useState } from 'react';
import { AlertTriangle, Database, Loader2, Phone, Plus, Users, UsersRound } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { ClientIdentityLinkDialog } from '../components/ClientIdentityLinkDialog';
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
  const { user, profile, role } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '').toLowerCase();
  const canReviewClientIdentity = actorRole === 'owner';
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
  const [identityLinkDialogState, setIdentityLinkDialogState] = useState({
    sessionKey: 0,
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

  const openClientIdentityLinkDialog = (customer) => {
    if (!canReviewClientIdentity || !customer || customer.status !== CUSTOMER_STATUS.ACTIVE) {
      return;
    }
    setIdentityLinkDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      customer,
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
    <div data-customer-scoped="true" className="relative isolate z-0 space-y-3 sm:space-y-5">
      {/* Page Header & Compact Metrics Strip */}
      <AdminSurface
        as="section"
        variant="hero"
        aria-labelledby="customer-page-heading"
        className="p-4 sm:p-6"
      >
        <div className="flex flex-row items-center justify-between gap-2.5 sm:gap-3">
          <div className="min-w-0">
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <AdminStatusBadge tone="ink" icon={UsersRound} size="sm" className="uppercase">
                Data Pelanggan Studio
              </AdminStatusBadge>
              <AdminStatusBadge tone="ivory" icon={Phone} size="sm">
                Format Nomor +62 / Intl
              </AdminStatusBadge>
            </div>

            <h2
              id="customer-page-heading"
              className="truncate text-xl leading-tight font-extrabold tracking-[-0.03em] text-[#151515] sm:mt-2.5 sm:text-2xl lg:text-[28px]"
            >
              Customer
            </h2>
            <p className="mt-1 hidden text-xs leading-relaxed text-[#666159] sm:block sm:text-[13.5px]">
              Daftar pelanggan &amp; riwayat booking berdasarkan nomor HP (mendukung nomor yang
              dipakai bersama maupun terpisah).
            </p>
          </div>

          <button
            type="button"
            onClick={() => openFormDialog('create')}
            aria-label="Add Customer"
            className="sa-control sa-btn-orange inline-flex min-h-9.5 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold sm:px-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Tambah</span>
            <span className="hidden sm:inline">Pelanggan</span>
          </button>
        </div>

        {/* Metrics Row */}
        <dl
          aria-label="Ringkasan daftar pelanggan"
          className="mt-3.5 grid grid-cols-3 gap-1.5 border-t border-[#151515]/[0.06] pt-3.5 min-[375px]:gap-2 sm:mt-4 sm:gap-3.5 sm:pt-4"
        >
          <AdminMetricCard
            label="Pelanggan"
            value={metrics.totalActiveProfiles}
            hint="Pelanggan aktif terdaftar"
            icon={UsersRound}
            tone="neutral"
            compactMobile
            hideIconOnMobile
            className="p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#151515]/15 hover:shadow-md sm:p-4"
            valueClassName="text-[15px] min-[375px]:text-base sm:text-xl"
          />

          <AdminMetricCard
            label="No. HP Unik"
            value={metrics.uniqueActivePhones}
            hint="Nomor HP terdaftar"
            icon={Phone}
            tone="neutral"
            compactMobile
            hideIconOnMobile
            className="p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#151515]/15 hover:shadow-md sm:p-4"
            valueClassName="text-[15px] min-[375px]:text-base sm:text-xl"
          />

          <AdminMetricCard
            label="No. Bersama"
            value={metrics.sharedPhoneCount}
            hint={
              metrics.sharedPhoneCount > 0
                ? `${metrics.sharedProfileCount} orang berbagi nomor`
                : 'Belum ada nomor bersama'
            }
            icon={Users}
            tone={metrics.sharedPhoneCount > 0 ? 'amber' : 'neutral'}
            compactMobile
            hideIconOnMobile
            className="p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#151515]/15 hover:shadow-md sm:p-4"
            valueClassName="text-[15px] min-[375px]:text-base sm:text-xl"
          />
        </dl>
      </AdminSurface>

      {/* Legacy Booking History Backfill Banner (No Auto-Write on Render!) */}
      {legacyUnlinkedCount > 0 ? (
        <section
          role="region"
          aria-label="Lengkapi data pelanggan booking lama"
          className="flex flex-col gap-2.5 rounded-2xl border border-[#8BAD12]/28 bg-[#EDF8C2]/50 p-3.5 shadow-[0_1px_2px_rgba(21,21,21,0.03)] sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3"
        >
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/85 text-[#243300] shadow-2xs">
              <Database className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#151515]">
                Booking lama perlu dihubungkan ke daftar pelanggan.
              </p>
              <p className="mt-0.5 text-xs leading-snug text-[#46433D]">
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
            className="sa-control sa-btn-primary inline-flex min-h-9.5 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold sm:w-auto"
          >
            <Database className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
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
          className="flex items-start gap-2.5 rounded-2xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-xs font-medium text-[#B92B0C]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Customer Directory Table */}
      {isLoading ? (
        <AdminSurface
          role="status"
          variant="card"
          className="flex items-center gap-2.5 p-5 text-xs font-medium text-[#666159]"
        >
          <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
          <span>Memuat Customer Directory dari Firestore...</span>
        </AdminSurface>
      ) : phoneGroups.length === 0 ? (
        <AdminSurface as="section" variant="card" className="p-5 sm:p-6">
          <AdminEmptyState
            icon={UsersRound}
            title={
              searchQuery || activeFilter !== 'all'
                ? 'Tidak Ada Customer yang Cocok'
                : 'Customer Directory Masih Kosong'
            }
            description={
              searchQuery || activeFilter !== 'all'
                ? 'Coba ubah kata kunci pencarian atau pilih filter All Customers.'
                : 'Customer akan tercatat otomatis saat booking dibuat melalui Calendar, atau Anda dapat menambahkan profil secara manual.'
            }
            action={
              !searchQuery && activeFilter === 'all' ? (
                <>
                  <button
                    type="button"
                    onClick={() => openFormDialog('create')}
                    className="sa-control sa-btn-lime inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Add Customer</span>
                  </button>
                  {legacyUnlinkedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setLegacyImportOpen(true)}
                      className="sa-control sa-btn-secondary inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold"
                    >
                      <Database className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Review &amp; Import History</span>
                    </button>
                  ) : null}
                </>
              ) : null
            }
          />
        </AdminSurface>
      ) : (
        <div className="space-y-3.5">
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
                className="sa-control sa-btn-secondary inline-flex min-h-9.5 w-full cursor-pointer items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold sm:w-auto"
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
        onLinkClient={canReviewClientIdentity ? openClientIdentityLinkDialog : undefined}
      />

      {/* Owner-reviewed one-to-one Client identity reconciliation */}
      <ClientIdentityLinkDialog
        key={identityLinkDialogState.sessionKey}
        open={identityLinkDialogState.open}
        onOpenChange={(nextOpen) =>
          setIdentityLinkDialogState((prev) => ({ ...prev, open: nextOpen }))
        }
        customer={identityLinkDialogState.customer}
        actorUid={actorUid}
        actorRole={actorRole}
        onComplete={() => {
          toast.success('Akun Client berhasil dihubungkan ke Customer CRM. Audit review tersimpan.');
          setIdentityLinkDialogState((prev) => ({ ...prev, open: false }));
        }}
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
