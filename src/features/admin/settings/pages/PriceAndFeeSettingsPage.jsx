import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, Loader2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/features/auth/AuthContext';

import { DiscountPresetDialog } from '../components/DiscountPresetDialog';
import { DiscountPresetList } from '../components/DiscountPresetList';
import { OperationalFeesForm } from '../components/OperationalFeesForm';
import { RecordingOptionDialog } from '../components/RecordingOptionDialog';
import { RecordingOptionList } from '../components/RecordingOptionList';
import { SessionTypeDialog } from '../components/SessionTypeDialog';
import { SessionTypeList } from '../components/SessionTypeList';
import { SettingsConfirmDialog } from '../components/SettingsConfirmDialog';
import { SettingsSaveBar } from '../components/SettingsSaveBar';
import { StudioPackageDialog } from '../components/StudioPackageDialog';
import { StudioPackageList } from '../components/StudioPackageList';
import { usePricingSettings } from '../hooks/usePricingSettings';
import { canDeleteSessionType } from '../pricing/schemas/pricing-settings-schema';
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
    isLoading,
    error: loadError,
  } = usePricingSettings();

  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [draftEntry, setDraftEntry] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [editorDialog, setEditorDialog] = useState({
    key: 0,
    open: false,
    section: '',
    mode: 'add',
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

  const serverSettings =
    savedSnapshot && savedSnapshot.version > remoteSettings.version
      ? savedSnapshot
      : remoteSettings;

  const isPersisted = remoteIsPersisted || Boolean(savedSnapshot && savedSnapshot.version >= 1);

  const effectiveSettings = draftEntry ? draftEntry.settings : serverSettings;

  const isDirty = Boolean(
    draftEntry && !arePricingSettingsEqual(draftEntry.settings, serverSettings),
  );

  const hasRemoteVersionConflict = Boolean(
    isDirty && draftEntry && remoteSettings.version > draftEntry.basedOnVersion,
  );

  // Warn browser refresh / close when there are unsaved changes
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

  const openEditorDialog = (section, mode, item = null) => {
    if (!isOwner) return;
    setEditorDialog((prev) => ({
      key: prev.key + 1,
      open: true,
      section,
      mode,
      item,
    }));
  };

  const closeEditorDialog = (nextOpen) => {
    setEditorDialog((prev) => ({
      ...prev,
      open: nextOpen,
    }));
  };

  const handleToggleItem = (sectionKey, targetItem) => {
    if (!isOwner) return;
    updateDraft((draft) => ({
      ...draft,
      [sectionKey]: draft[sectionKey].map((item) =>
        item.id === targetItem.id ? { ...item, isActive: !(item.isActive !== false) } : item,
      ),
    }));
  };

  const handleSaveEditorItem = (sectionKey, nextItem) => {
    if (!isOwner) return;
    updateDraft((draft) => ({
      ...draft,
      [sectionKey]: upsertById(draft[sectionKey], nextItem),
    }));
  };

  const handleRequestDelete = (sectionKey, item, label) => {
    if (!isOwner) return;
    if (sectionKey === 'sessionTypes') {
      const check = canDeleteSessionType(item.id, effectiveSettings.packages);
      if (!check.canDelete) {
        setConfirmState({
          open: true,
          type: 'blocked',
          title: 'Session Type Tidak Dapat Dihapus',
          description: check.message,
          confirmLabel: 'Mengerti',
          confirmTone: 'primary',
          infoOnly: true,
          payload: null,
        });
        return;
      }
    }

    setConfirmState({
      open: true,
      type: 'delete',
      title: `Hapus ${label}?`,
      description: `Anda akan menghapus "${item.name}" dari daftar preset. Klik Save Changes untuk menerapkan perubahan ke Firestore. Data booking lama tetap mempertahankan snapshot historisnya.`,
      confirmLabel: `Hapus ${label}`,
      confirmTone: 'danger',
      infoOnly: false,
      payload: { sectionKey, itemId: item.id },
    });
  };

  const handleConfirmAction = () => {
    if (confirmState.type === 'delete' && confirmState.payload) {
      const { sectionKey, itemId } = confirmState.payload;
      updateDraft((draft) => ({
        ...draft,
        [sectionKey]: draft[sectionKey].filter((item) => item.id !== itemId),
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
      const msg = `Price and Fee Settings berhasil disimpan ke Firestore (v${saved.version}).`;
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

  return (
    <div data-calendar-scoped="true" className="space-y-5 sm:space-y-6">
      {/* Header & Breadcrumb Card */}
      <section
        aria-labelledby="price-and-fee-heading"
        className="brutal-card-lg bg-studio-white p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Settings breadcrumb">
            <ol className="text-studio-muted-ink flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase">
              <li>
                <button
                  type="button"
                  onClick={() => handleGuardedNavigate('/admin/dashboard')}
                  className="hover:text-studio-orange cursor-pointer underline-offset-2 hover:underline"
                >
                  Admin
                </button>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleGuardedNavigate('/admin/settings')}
                  className="hover:text-studio-orange cursor-pointer underline-offset-2 hover:underline"
                >
                  Settings
                </button>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="text-studio-ink">
                Price and Fee Settings
              </li>
            </ol>
          </nav>

          <button
            type="button"
            onClick={() => handleGuardedNavigate('/admin/settings')}
            className="brutal-btn bg-studio-ivory text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Settings</span>
          </button>
        </div>

        <h2
          id="price-and-fee-heading"
          className="font-display text-studio-ink mt-4 text-3xl leading-none font-black tracking-tight uppercase sm:text-5xl"
        >
          Price and Fee Settings
        </h2>

        <p className="text-studio-muted-ink mt-2 max-w-2xl text-sm leading-relaxed font-semibold sm:text-base">
          Manage studio pricing, package rates, discounts, and operational fee presets.
        </p>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="border-studio-ink bg-studio-ivory mt-4 flex items-center gap-2 border px-3 py-2 font-mono text-xs font-bold"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Memuat konfigurasi settings/pricing dari Firestore...</span>
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="border-studio-ink bg-studio-orange text-studio-white mt-4 flex items-start gap-2 border-2 p-3 text-xs font-bold"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
        ) : null}

        {!isOwner ? (
          <div
            role="status"
            aria-live="polite"
            className="border-studio-ink bg-studio-ivory text-studio-ink mt-4 flex items-start gap-2.5 border-2 p-3 text-xs font-bold"
          >
            <ShieldAlert
              className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Mode Baca Saja (Staff / Operator): Konfigurasi harga layanan, diskon durasi otomatis,
              paket, dan fee operasional hanya dapat diubah oleh Owner.
            </span>
          </div>
        ) : null}
      </section>

      {/* SECTION 01: SESSION TYPES */}
      <SessionTypeList
        sessionTypes={effectiveSettings.sessionTypes}
        readOnly={!isOwner}
        onAdd={() => openEditorDialog('sessionTypes', 'add')}
        onEdit={(item) => openEditorDialog('sessionTypes', 'edit', item)}
        onToggleActive={(item) => handleToggleItem('sessionTypes', item)}
        onRequestDelete={(item) => handleRequestDelete('sessionTypes', item, 'Session Type')}
      />

      {/* SECTION 02: RECORDING OPTIONS */}
      <RecordingOptionList
        recordingTypes={effectiveSettings.recordingTypes}
        readOnly={!isOwner}
        onAdd={() => openEditorDialog('recordingTypes', 'add')}
        onEdit={(item) => openEditorDialog('recordingTypes', 'edit', item)}
        onToggleActive={(item) => handleToggleItem('recordingTypes', item)}
        onRequestDelete={(item) => handleRequestDelete('recordingTypes', item, 'Recording Option')}
      />

      {/* SECTION 03: STUDIO PACKAGES */}
      <StudioPackageList
        packages={effectiveSettings.packages}
        sessionTypes={effectiveSettings.sessionTypes}
        readOnly={!isOwner}
        onAdd={() => openEditorDialog('packages', 'add')}
        onEdit={(item) => openEditorDialog('packages', 'edit', item)}
        onToggleActive={(item) => handleToggleItem('packages', item)}
        onRequestDelete={(item) => handleRequestDelete('packages', item, 'Package')}
      />

      {/* SECTION 04: DISCOUNT PRESETS */}
      <DiscountPresetList
        discounts={effectiveSettings.discounts}
        sessionTypes={effectiveSettings.sessionTypes}
        readOnly={!isOwner}
        onAdd={() => openEditorDialog('discounts', 'add')}
        onEdit={(item) => openEditorDialog('discounts', 'edit', item)}
        onToggleActive={(item) => handleToggleItem('discounts', item)}
        onRequestDelete={(item) => handleRequestDelete('discounts', item, 'Discount Preset')}
      />

      {/* SECTION 05: STAFF AND OPERATIONAL FEES */}
      <OperationalFeesForm
        fees={effectiveSettings.fees}
        readOnly={!isOwner}
        onChangeFees={(nextFees) =>
          updateDraft((draft) => ({
            ...draft,
            fees: nextFees,
          }))
        }
      />

      {/* STICKY SAVE BAR */}
      <SettingsSaveBar
        isDirty={isDirty}
        isPersisted={isPersisted}
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
      {editorDialog.open && editorDialog.section === 'sessionTypes' ? (
        <SessionTypeDialog
          key={`session-${editorDialog.key}`}
          open={editorDialog.open}
          mode={editorDialog.mode}
          initialItem={editorDialog.item}
          nextSortOrder={(effectiveSettings.sessionTypes?.length || 0) + 1}
          onOpenChange={closeEditorDialog}
          onSaveItem={(item) => handleSaveEditorItem('sessionTypes', item)}
        />
      ) : null}

      {editorDialog.open && editorDialog.section === 'recordingTypes' ? (
        <RecordingOptionDialog
          key={`recording-${editorDialog.key}`}
          open={editorDialog.open}
          mode={editorDialog.mode}
          initialItem={editorDialog.item}
          nextSortOrder={(effectiveSettings.recordingTypes?.length || 0) + 1}
          onOpenChange={closeEditorDialog}
          onSaveItem={(item) => handleSaveEditorItem('recordingTypes', item)}
        />
      ) : null}

      {editorDialog.open && editorDialog.section === 'packages' ? (
        <StudioPackageDialog
          key={`package-${editorDialog.key}`}
          open={editorDialog.open}
          mode={editorDialog.mode}
          initialItem={editorDialog.item}
          sessionTypes={effectiveSettings.sessionTypes}
          nextSortOrder={(effectiveSettings.packages?.length || 0) + 1}
          onOpenChange={closeEditorDialog}
          onSaveItem={(item) => handleSaveEditorItem('packages', item)}
        />
      ) : null}

      {editorDialog.open && editorDialog.section === 'discounts' ? (
        <DiscountPresetDialog
          key={`discount-${editorDialog.key}`}
          open={editorDialog.open}
          mode={editorDialog.mode}
          initialItem={editorDialog.item}
          sessionTypes={effectiveSettings.sessionTypes}
          nextSortOrder={(effectiveSettings.discounts?.length || 0) + 1}
          onOpenChange={closeEditorDialog}
          onSaveItem={(item) => handleSaveEditorItem('discounts', item)}
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
