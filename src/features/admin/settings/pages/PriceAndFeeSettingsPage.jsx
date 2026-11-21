import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Globe,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { DailyMealAllowanceForm } from '../components/DailyMealAllowanceForm';
import { ServiceOptionDialog } from '../components/ServiceOptionDialog';
import { ServiceTypeCard } from '../components/ServiceTypeCard';
import { ServiceTypeDialog } from '../components/ServiceTypeDialog';
import { SettingsConfirmDialog } from '../components/SettingsConfirmDialog';
import { SettingsSaveBar } from '../components/SettingsSaveBar';
import { usePricingSettings } from '../hooks/usePricingSettings';
import { DELIVERY_MODES, PRICING_MODES } from '../pricing/config/default-pricing-settings';
import {
  canDeleteServiceOption,
  canDeleteServiceType,
} from '../pricing/schemas/pricing-settings-schema';
import {
  mapPricingSettingsErrorToMessage,
  savePricingSettings,
} from '../pricing/services/pricing-settings-service';
import {
  arePricingSettingsEqual,
  clonePricingSettings,
} from '../pricing/utils/normalize-pricing-settings';

function upsertById(list = [], nextItem) {
  const index = list.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [...list, nextItem];
  }
  return list.map((item, idx) => (idx === index ? nextItem : item));
}

export function PriceAndFeeSettingsPage() {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '').toLowerCase();
  const isOwner = actorRole === 'owner';

  const {
    settings: remoteSettings,
    isPersisted: remoteIsPersisted,
    migratedFromV1: remoteMigratedFromV1,
    isLoading,
    error: loadError,
  } = usePricingSettings();

  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [draftEntry, setDraftEntry] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [serviceDialog, setServiceDialog] = useState({
    key: 0,
    open: false,
    mode: 'add',
    item: null,
    defaultDeliveryMode: DELIVERY_MODES.STUDIO,
  });

  const [optionDialog, setOptionDialog] = useState({
    key: 0,
    open: false,
    mode: 'add',
    serviceTypeId: '',
    item: null,
  });

  const [confirmState, setConfirmState] = useState({
    open: false,
    type: '',
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    confirmTone: 'danger',
    infoOnly: false,
    payload: null,
  });

  const isLocalSnapshotNewer = Boolean(
    savedSnapshot && savedSnapshot.version > remoteSettings.version,
  );
  const serverSettings = isLocalSnapshotNewer ? savedSnapshot : remoteSettings;
  const isPersisted = remoteIsPersisted || Boolean(savedSnapshot && savedSnapshot.version >= 1);
  const migratedFromV1 = !isLocalSnapshotNewer && remoteMigratedFromV1;

  const effectiveSettings = draftEntry ? draftEntry.settings : serverSettings;
  const effectiveServiceTypes = effectiveSettings.serviceTypes || [];
  const studioServices = effectiveServiceTypes.filter(
    (svc) => svc.deliveryMode === DELIVERY_MODES.STUDIO,
  );
  const wfaServices = effectiveServiceTypes.filter(
    (svc) => svc.deliveryMode === DELIVERY_MODES.WFA,
  );

  const isDirty = Boolean(
    draftEntry && !arePricingSettingsEqual(draftEntry.settings, serverSettings),
  );

  const hasRemoteVersionConflict = Boolean(
    isDirty && draftEntry && remoteSettings.version > draftEntry.basedOnVersion,
  );

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const updateDraft = (updater) => {
    if (!isOwner) return;
    setSaveError('');
    setSaveSuccess('');
    setDraftEntry((prev) => {
      const baseSettings = clonePricingSettings(prev ? prev.settings : serverSettings);
      const nextSettings = updater(baseSettings);
      return {
        basedOnVersion: prev ? prev.basedOnVersion : serverSettings.version,
        settings: nextSettings,
      };
    });
  };

  // Service Type CRUD
  const openServiceDialog = (mode, item = null, defaultDeliveryMode = DELIVERY_MODES.STUDIO) => {
    if (!isOwner) return;
    setServiceDialog((prev) => ({
      key: prev.key + 1,
      open: true,
      mode,
      item,
      defaultDeliveryMode,
    }));
  };

  const handleSaveServiceType = (nextService) => {
    updateDraft((draft) => ({
      ...draft,
      serviceTypes: upsertById(draft.serviceTypes, nextService),
    }));
  };

  const handleToggleServiceActive = (targetService) => {
    updateDraft((draft) => ({
      ...draft,
      serviceTypes: draft.serviceTypes.map((svc) =>
        svc.id === targetService.id ? { ...svc, isActive: !(svc.isActive !== false) } : svc,
      ),
    }));
  };

  const handleRequestDeleteService = (serviceType) => {
    if (!isOwner) return;
    const check = canDeleteServiceType(serviceType, effectiveServiceTypes);
    if (!check.canDelete) {
      setConfirmState({
        open: true,
        type: 'blocked',
        title: 'Service Type Tidak Dapat Dihapus',
        description: check.message,
        confirmLabel: 'Mengerti',
        confirmTone: 'primary',
        infoOnly: true,
        payload: null,
      });
      return;
    }

    setConfirmState({
      open: true,
      type: 'delete-service',
      title: `Hapus Service "${serviceType.name}"?`,
      description:
        'Service ini akan dihapus dari katalog draft. Klik Save Changes untuk menyimpan ke Firestore. Booking historis tetap mempertahankan snapshot harganya.',
      confirmLabel: 'Hapus Service',
      confirmTone: 'danger',
      infoOnly: false,
      payload: { serviceTypeId: serviceType.id },
    });
  };

  // Subcategory / Service Option CRUD
  const openOptionDialog = (mode, serviceType, option = null) => {
    if (!isOwner) return;
    setOptionDialog((prev) => ({
      key: prev.key + 1,
      open: true,
      mode,
      serviceTypeId: serviceType.id,
      item: option,
    }));
  };

  const handleSaveServiceOption = (serviceTypeId, nextOption) => {
    updateDraft((draft) => ({
      ...draft,
      serviceTypes: draft.serviceTypes.map((svc) =>
        svc.id === serviceTypeId
          ? {
              ...svc,
              options: upsertById(svc.options || [], nextOption),
            }
          : svc,
      ),
    }));
  };

  const handleToggleOptionActive = (serviceType, targetOption) => {
    if (!isOwner || targetOption.pricing?.mode === PRICING_MODES.UNCONFIGURED) return;
    updateDraft((draft) => ({
      ...draft,
      serviceTypes: draft.serviceTypes.map((svc) =>
        svc.id === serviceType.id
          ? {
              ...svc,
              options: (svc.options || []).map((opt) =>
                opt.id === targetOption.id ? { ...opt, isActive: !(opt.isActive !== false) } : opt,
              ),
            }
          : svc,
      ),
    }));
  };

  const handleRequestDeleteOption = (serviceType, option) => {
    if (!isOwner) return;
    const check = canDeleteServiceOption(serviceType, option, effectiveServiceTypes);
    if (!check.canDelete) {
      setConfirmState({
        open: true,
        type: 'blocked',
        title: 'Subcategory Tidak Dapat Dihapus',
        description: check.message,
        confirmLabel: 'Mengerti',
        confirmTone: 'primary',
        infoOnly: true,
        payload: null,
      });
      return;
    }

    setConfirmState({
      open: true,
      type: 'delete-option',
      title: `Hapus Subcategory "${option.name}"?`,
      description: `Subcategory ini akan dihapus dari layanan "${serviceType.name}". Klik Save Changes untuk menerapkan perubahan ke Firestore. Data booking historis tetap aman.`,
      confirmLabel: 'Hapus Subcategory',
      confirmTone: 'danger',
      infoOnly: false,
      payload: { serviceTypeId: serviceType.id, optionId: option.id },
    });
  };

  const handleConfirmAction = () => {
    if (confirmState.type === 'delete-service' && confirmState.payload) {
      const { serviceTypeId } = confirmState.payload;
      updateDraft((draft) => ({
        ...draft,
        serviceTypes: draft.serviceTypes.filter((svc) => svc.id !== serviceTypeId),
      }));
    } else if (confirmState.type === 'delete-option' && confirmState.payload) {
      const { serviceTypeId, optionId } = confirmState.payload;
      updateDraft((draft) => ({
        ...draft,
        serviceTypes: draft.serviceTypes.map((svc) =>
          svc.id === serviceTypeId
            ? {
                ...svc,
                options: (svc.options || []).filter((opt) => opt.id !== optionId),
              }
            : svc,
        ),
      }));
    } else if (confirmState.type === 'leave' && confirmState.payload?.targetPath) {
      setDraftEntry(null);
      navigate(confirmState.payload.targetPath);
    }

    setConfirmState((prev) => ({
      ...prev,
      open: false,
    }));
  };

  const handleGuardedNavigate = (targetPath) => {
    if (isDirty) {
      setConfirmState({
        open: true,
        type: 'leave',
        title: 'Perubahan Belum Disimpan',
        description:
          'Anda memiliki perubahan Price and Fee Settings yang belum disimpan ke Firestore. Keluar dari halaman tanpa menyimpan?',
        confirmLabel: 'Tinggalkan Halaman',
        confirmTone: 'danger',
        infoOnly: false,
        payload: { targetPath },
      });
      return;
    }

    navigate(targetPath);
  };

  const handleResetDraft = () => {
    setDraftEntry(null);
    setSaveError('');
    setSaveSuccess('');
  };

  const handleSaveChanges = async () => {
    if (!isOwner || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const expectedVersion = draftEntry ? draftEntry.basedOnVersion : serverSettings.version;
      const saved = await savePricingSettings({
        actorUid,
        actorRole,
        settings: effectiveSettings,
        expectedVersion,
      });

      setSavedSnapshot(saved);
      setDraftEntry(null);
      const msg = `Price and Fee Settings (Catalog V2) berhasil disimpan ke Firestore (v${saved.version}).`;
      setSaveSuccess(msg);
      toast.success(msg);
    } catch (err) {
      const readableError = mapPricingSettingsErrorToMessage(err);
      setSaveError(readableError);
      toast.error(readableError);
    } finally {
      setIsSaving(false);
    }
  };

  const activeOptionService = optionDialog.serviceTypeId
    ? effectiveServiceTypes.find((svc) => svc.id === optionDialog.serviceTypeId) || null
    : null;

  return (
    <div data-calendar-scoped="true" className="space-y-3.5 sm:space-y-7">
      {/* Header & Breadcrumb Card */}
      <AdminSurface
        as="section"
        variant="hero"
        aria-labelledby="price-and-fee-heading"
        className="p-3.5 sm:p-6 lg:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <nav aria-label="Settings breadcrumb" className="hidden sm:block">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#666159]">
              <li>
                <button
                  type="button"
                  onClick={() => handleGuardedNavigate('/admin/dashboard')}
                  className="cursor-pointer transition-colors hover:text-[#FF4B22]"
                >
                  Admin
                </button>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5 text-[#8B857B]" />
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleGuardedNavigate('/admin/settings')}
                  className="cursor-pointer transition-colors hover:text-[#FF4B22]"
                >
                  Settings
                </button>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5 text-[#8B857B]" />
              </li>
              <li aria-current="page" className="font-semibold text-[#151515]">
                Price and Fee Settings
              </li>
            </ol>
          </nav>

          <button
            type="button"
            onClick={() => handleGuardedNavigate('/admin/settings')}
            className="sa-control sa-btn-secondary inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Settings</span>
          </button>
        </div>

        <h2
          id="price-and-fee-heading"
          className="mt-2.5 text-xl font-bold tracking-[-0.025em] text-[#151515] sm:mt-4 sm:text-3xl lg:text-4xl"
        >
          Price and Fee Settings
        </h2>

        <p className="mt-1.5 hidden max-w-2xl text-xs leading-relaxed text-[#666159] sm:block sm:text-sm">
          Kelola daftar layanan, tarif sewa studio, diskon, dan komisi tim (Staff, Owner, Recording
          Operator).
        </p>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="sa-panel-ivory mt-4 flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-[#46433D]"
          >
            <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
            <span>Memuat pengaturan tarif studio...</span>
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-xs font-medium text-[#B92B0C]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
        ) : null}

        {migratedFromV1 ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3.5 text-xs text-[#8A4B08]"
          >
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Daftar tarif lama telah disesuaikan ke format terbaru tanpa menghapus tarif
              sebelumnya. Periksa kategori layanan lalu klik <strong>Save Changes</strong> untuk
              menyimpan.
            </span>
          </div>
        ) : null}

        {!isOwner ? (
          <div
            role="status"
            aria-live="polite"
            className="sa-panel-ivory mt-4 flex items-start gap-2.5 p-3.5 text-xs text-[#46433D]"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4B22]" aria-hidden="true" />
            <span>
              Mode Baca Saja (Staff / Operator): Konfigurasi katalog layanan, tarif customer, fee
              internal, dan uang makan hanya dapat diubah oleh Owner.
            </span>
          </div>
        ) : null}
      </AdminSurface>

      {/* GROUP 1: STUDIO SESSIONS */}
      <section aria-labelledby="group-studio-sessions-heading" className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div>
            <AdminStatusBadge
              tone="lime"
              icon={Music2}
              size="sm"
              className="hidden font-mono uppercase sm:inline-flex"
            >
              Studio Sessions
            </AdminStatusBadge>
            <h3
              id="group-studio-sessions-heading"
              className="text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl"
            >
              Layanan Ruangan Studio ({studioServices.length})
            </h3>
            <p className="mt-1 hidden text-xs text-[#666159] sm:block">
              Tampil pada Studio Calendar (Room A &amp; Room B). Subcategory berstatus Belum
              Dikonfigurasi otomatis disembunyikan dari Booking Form.
            </p>
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={() => openServiceDialog('add', null, DELIVERY_MODES.STUDIO)}
              className="sa-control sa-btn-secondary inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Studio Service</span>
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          {studioServices.map((svc) => (
            <ServiceTypeCard
              key={svc.id}
              serviceType={svc}
              defaultExpanded
              readOnly={!isOwner}
              onEditService={(item) => openServiceDialog('edit', item, item.deliveryMode)}
              onToggleServiceActive={handleToggleServiceActive}
              onRequestDeleteService={handleRequestDeleteService}
              onAddOption={(parent) => openOptionDialog('add', parent, null)}
              onEditOption={(parent, opt) => openOptionDialog('edit', parent, opt)}
              onToggleOptionActive={handleToggleOptionActive}
              onRequestDeleteOption={handleRequestDeleteOption}
            />
          ))}
        </div>
      </section>

      {/* GROUP 2: WFA SERVICES */}
      <section aria-labelledby="group-wfa-services-heading" className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div>
            <AdminStatusBadge
              tone="ink"
              icon={Globe}
              size="sm"
              className="hidden font-mono uppercase sm:inline-flex"
            >
              WFA Services
            </AdminStatusBadge>
            <h3
              id="group-wfa-services-heading"
              className="text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl"
            >
              Layanan Work From Anywhere ({wfaServices.length})
            </h3>
            <p className="mt-1 hidden text-xs text-[#666159] sm:block">
              Tarif dan fee untuk layanan Mixing, Mastering, atau pekerjaan jarak jauh. Layanan WFA
              tidak mengunci jadwal Room A / Room B di Studio Calendar.
            </p>
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={() => openServiceDialog('add', null, DELIVERY_MODES.WFA)}
              className="sa-control sa-btn-secondary inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add WFA Service</span>
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          {wfaServices.length === 0 ? (
            <div className="sa-panel border-dashed p-6 text-center text-xs text-[#666159]">
              Belum ada layanan WFA yang terdaftar.
            </div>
          ) : (
            wfaServices.map((svc) => (
              <ServiceTypeCard
                key={svc.id}
                serviceType={svc}
                defaultExpanded
                readOnly={!isOwner}
                onEditService={(item) => openServiceDialog('edit', item, item.deliveryMode)}
                onToggleServiceActive={handleToggleServiceActive}
                onRequestDeleteService={handleRequestDeleteService}
                onAddOption={(parent) => openOptionDialog('add', parent, null)}
                onEditOption={(parent, opt) => openOptionDialog('edit', parent, opt)}
                onToggleOptionActive={handleToggleOptionActive}
                onRequestDeleteOption={handleRequestDeleteOption}
              />
            ))
          )}
        </div>
      </section>

      {/* GROUP 3: GLOBAL OPERATIONAL SETTINGS */}
      <DailyMealAllowanceForm
        operationalSettings={effectiveSettings.operationalSettings}
        readOnly={!isOwner}
        onChangeOperationalSettings={(nextOperational) =>
          updateDraft((draft) => ({
            ...draft,
            operationalSettings: nextOperational,
          }))
        }
      />

      {/* STICKY SAVE BAR */}
      <SettingsSaveBar
        isDirty={isDirty}
        isPersisted={isPersisted}
        migratedFromV1={migratedFromV1}
        isSaving={isSaving}
        isLoading={isLoading}
        readOnly={!isOwner}
        version={serverSettings.version}
        hasRemoteVersionConflict={hasRemoteVersionConflict}
        errorMessage={saveError}
        successMessage={saveSuccess}
        onSave={handleSaveChanges}
        onReset={handleResetDraft}
        onReloadRemote={handleResetDraft}
      />

      {/* MODALS */}
      {serviceDialog.open ? (
        <ServiceTypeDialog
          key={`svc-${serviceDialog.key}`}
          open={serviceDialog.open}
          mode={serviceDialog.mode}
          initialItem={serviceDialog.item}
          defaultDeliveryMode={serviceDialog.defaultDeliveryMode}
          nextSortOrder={effectiveServiceTypes.length + 1}
          onOpenChange={(nextOpen) => setServiceDialog((prev) => ({ ...prev, open: nextOpen }))}
          onSaveItem={handleSaveServiceType}
        />
      ) : null}

      {optionDialog.open && activeOptionService ? (
        <ServiceOptionDialog
          key={`opt-${optionDialog.key}`}
          open={optionDialog.open}
          mode={optionDialog.mode}
          serviceType={activeOptionService}
          initialItem={optionDialog.item}
          nextSortOrder={(activeOptionService.options?.length || 0) + 1}
          onOpenChange={(nextOpen) => setOptionDialog((prev) => ({ ...prev, open: nextOpen }))}
          onSaveItem={(item) => handleSaveServiceOption(activeOptionService.id, item)}
        />
      ) : null}

      <SettingsConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        confirmTone={confirmState.confirmTone}
        infoOnly={confirmState.infoOnly}
        onConfirm={handleConfirmAction}
        onOpenChange={(nextOpen) =>
          setConfirmState((prev) => ({
            ...prev,
            open: nextOpen,
          }))
        }
      />
    </div>
  );
}

export default PriceAndFeeSettingsPage;
