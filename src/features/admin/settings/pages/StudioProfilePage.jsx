import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Building2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { SettingsBreadcrumb } from '../components/SettingsBreadcrumb';
import { SettingsConfirmDialog } from '../components/SettingsConfirmDialog';
import { StudioProfileForm } from '../components/StudioProfileForm';
import { StudioProfilePreview } from '../components/StudioProfilePreview';
import { StudioProfileSaveBar } from '../components/StudioProfileSaveBar';
import { DEFAULT_STUDIO_PROFILE_FORM_VALUES } from '../studio-profile/config/default-studio-profile';
import { useStudioProfile } from '../studio-profile/hooks/useStudioProfile';
import { studioProfileFormSchema } from '../studio-profile/schemas/studio-profile-schema';
import {
  mapStudioProfileErrorToMessage,
  saveStudioProfile,
} from '../studio-profile/services/studio-profile-service';
import {
  areStudioProfileValuesEqual,
  extractStudioProfileFormValues,
} from '../studio-profile/utils/normalize-studio-profile';

export function StudioProfilePage() {
  const { user, profile: authProfile, role } = useAuth();
  const navigate = useNavigate();

  const actorUid = user?.uid || authProfile?.uid || '';
  const actorRole = String(role || authProfile?.role || '').toLowerCase();
  const isOwner = actorRole === 'owner';

  const {
    profile: remoteProfile,
    isPersisted: remoteIsPersisted,
    isLoading,
    error: loadError,
  } = useStudioProfile();

  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [editBaseVersion, setEditBaseVersion] = useState(null);
  const [staleConflict, setStaleConflict] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState({ open: false, targetPath: '' });

  const serverProfile =
    savedSnapshot && (!remoteIsPersisted || savedSnapshot.version >= remoteProfile.version)
      ? savedSnapshot
      : remoteProfile;
  const serverIsPersisted = remoteIsPersisted || Boolean(savedSnapshot);
  const serverVersion = serverIsPersisted ? Number(serverProfile.version) || 1 : 0;
  const serverFormValues = extractStudioProfileFormValues(serverProfile);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(studioProfileFormSchema),
    mode: 'onBlur',
    defaultValues: DEFAULT_STUDIO_PROFILE_FORM_VALUES,
    values: serverFormValues,
    resetOptions: {
      keepDirtyValues: true,
    },
  });

  const watchedValues = useWatch({ control });
  const previewValues = watchedValues || serverFormValues;
  const isDirty = isOwner && !areStudioProfileValuesEqual(previewValues, serverFormValues);
  const hasRemoteVersionDrift =
    isDirty && editBaseVersion !== null && serverVersion !== editBaseVersion;

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

  const handleFirstEdit = () => {
    if (!isOwner) return;
    if (editBaseVersion === null) {
      setEditBaseVersion(serverVersion);
    }
    if (saveSuccess) {
      setSaveSuccess('');
    }
    if (saveError) {
      setSaveError('');
    }
  };

  const handleDiscard = () => {
    reset(serverFormValues, {
      keepDirtyValues: false,
      keepDirty: false,
      keepTouched: false,
    });
    setEditBaseVersion(null);
    setStaleConflict(null);
    setSaveError('');
    setSaveSuccess('');
  };

  const handleReloadLatest = () => {
    const latestValues = extractStudioProfileFormValues(remoteProfile);
    setSavedSnapshot(null);
    reset(latestValues, {
      keepDirtyValues: false,
      keepDirty: false,
      keepTouched: false,
    });
    setEditBaseVersion(null);
    setStaleConflict(null);
    setSaveError('');
    setSaveSuccess('');
    toast.info('Data Studio Profile terbaru telah dimuat ke form.');
  };

  const handleGuardedNavigate = (targetPath) => {
    if (isDirty) {
      setLeaveConfirm({ open: true, targetPath });
      return;
    }
    navigate(targetPath);
  };

  const handleConfirmLeave = () => {
    const targetPath = leaveConfirm.targetPath;
    setLeaveConfirm({ open: false, targetPath: '' });
    if (targetPath) {
      navigate(targetPath);
    }
  };

  const onSubmit = async (formData) => {
    if (!isOwner || isSaving) return;

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const expectedVersion = editBaseVersion !== null ? editBaseVersion : serverVersion;
      const saved = await saveStudioProfile({
        actorUid,
        actorRole,
        input: formData,
        expectedVersion,
      });

      const savedFormValues = extractStudioProfileFormValues(saved);
      setSavedSnapshot(saved);
      reset(savedFormValues, {
        keepDirtyValues: false,
        keepDirty: false,
        keepTouched: false,
      });
      setEditBaseVersion(null);
      setStaleConflict(null);

      const msg = `Studio Profile berhasil disimpan ke Firestore (v${saved.version}).`;
      setSaveSuccess(msg);
      toast.success(msg);
    } catch (err) {
      const readableError = mapStudioProfileErrorToMessage(err);
      if (err?.code === 'studio-profile/stale-version') {
        setStaleConflict({
          message: readableError,
          currentVersion: err?.details?.currentVersion ?? null,
        });
      }
      setSaveError(readableError);
      toast.error(readableError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-calendar-scoped="true" className="space-y-4 sm:space-y-6">
      <AdminSurface
        as="section"
        variant="hero"
        aria-labelledby="studio-profile-heading"
        className="p-3.5 sm:p-6 lg:p-7"
      >
        <SettingsBreadcrumb
          items={[
            { label: 'Admin', to: '/admin/dashboard' },
            { label: 'Settings', to: '/admin/settings' },
            { label: 'Studio Profile' },
          ]}
          backTo="/admin/settings"
          backLabel="Back to Settings"
          onNavigate={handleGuardedNavigate}
        />

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 sm:mt-4">
          <div className="min-w-0 flex-1">
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#151515] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide text-[#F1EEE4]">
                <Building2 className="h-3 w-3 text-[#C8F13A]" aria-hidden="true" />
                <span>STUDIO PROFILE &amp; CONTACT</span>
              </span>
              <AdminStatusBadge tone={isOwner ? 'lime' : 'ivory'} size="sm">
                {isOwner ? 'Mode Ubah (Owner)' : 'Mode Baca Saja (Staff)'}
              </AdminStatusBadge>
            </div>

            <h2
              id="studio-profile-heading"
              className="mt-2 text-xl font-bold tracking-[-0.025em] text-[#151515] sm:text-3xl"
            >
              Studio Profile &amp; Contact
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#666159] sm:text-sm">
              Kelola identitas studio, detail kontak WhatsApp, email, alamat, kota, serta tautan
              lokasi Google Maps studio.
            </p>
          </div>
        </div>
      </AdminSurface>

      {!isOwner ? (
        <AdminSurface
          as="div"
          role="status"
          variant="subcard"
          className="border-amber-500/30 bg-[#FEF4DD] p-3.5 sm:p-4"
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#8A4B08]" aria-hidden="true" />
            <div className="min-w-0 text-xs text-[#6B3B08]">
              <p className="font-semibold">Akses Baca Saja (Staff)</p>
              <p className="mt-0.5 leading-relaxed">
                Anda dapat meninjau identitas dan kontak studio saat ini, tetapi hanya akun dengan
                peran Owner yang dapat menyimpan perubahan.
              </p>
            </div>
          </div>
        </AdminSurface>
      ) : null}

      {loadError ? (
        <AdminSurface
          as="div"
          role="alert"
          variant="subcard"
          className="border-red-300 bg-red-50 p-3.5 text-xs text-red-800 sm:p-4"
        >
          {loadError}
        </AdminSurface>
      ) : null}

      {staleConflict || hasRemoteVersionDrift ? (
        <AdminSurface
          as="div"
          role="alert"
          variant="subcard"
          className="border-amber-500/40 bg-[#FEF4DD] p-3.5 sm:p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[#8A4B08]"
                aria-hidden="true"
              />
              <div className="min-w-0 text-xs text-[#6B3B08]">
                <p className="font-semibold">Versi Dokumen Berubah di Sesi Lain</p>
                <p className="mt-0.5 leading-relaxed">
                  {staleConflict?.message ||
                    `Profil studio telah diperbarui ke versi v${serverVersion} di sesi lain sementara Anda memiliki draft lokal.`}
                </p>
              </div>
            </div>

            <AdminButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleReloadLatest}
              className="shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Muat Data Terbaru</span>
            </AdminButton>
          </div>
        </AdminSurface>
      ) : null}

      {saveError && !staleConflict ? (
        <AdminSurface
          as="div"
          role="alert"
          variant="subcard"
          className="border-red-300 bg-red-50 p-3.5 text-xs font-medium text-red-800 sm:p-4"
        >
          {saveError}
        </AdminSurface>
      ) : null}

      {saveSuccess ? (
        <AdminSurface
          as="div"
          role="status"
          variant="subcard"
          className="border-emerald-500/30 bg-[#E6F6EC] p-3.5 text-xs font-medium text-[#0F6246] sm:p-4"
        >
          {saveSuccess}
        </AdminSurface>
      ) : null}

      {isLoading ? (
        <AdminSurface variant="card" className="flex items-center gap-3 p-6 text-sm text-[#46433D]">
          <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
          <span>Memuat Studio Profile dari Firestore...</span>
        </AdminSurface>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)] lg:items-start">
            <AdminSurface variant="card" className="p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#151515]">Identitas &amp; Kontak</h3>
                  <p className="text-xs text-[#666159]">
                    Data ini tersimpan tunggal pada koleksi pengaturan studio.
                  </p>
                </div>
                {!serverIsPersisted ? (
                  <AdminStatusBadge tone="ivory" size="sm">
                    Belum Tersimpan
                  </AdminStatusBadge>
                ) : null}
              </div>

              <StudioProfileForm
                register={register}
                errors={errors}
                readOnly={!isOwner}
                onFirstEdit={handleFirstEdit}
              />
            </AdminSurface>

            <StudioProfilePreview
              values={previewValues}
              version={serverVersion}
              isPersisted={serverIsPersisted}
              updatedAt={serverProfile.updatedAt}
            />
          </div>

          {isOwner ? (
            <StudioProfileSaveBar isDirty={isDirty} isSaving={isSaving} onDiscard={handleDiscard} />
          ) : null}
        </form>
      )}

      <SettingsConfirmDialog
        open={leaveConfirm.open}
        title="Perubahan Belum Disimpan"
        description="Anda memiliki perubahan Studio Profile yang belum disimpan ke Firestore. Keluar dari halaman ini tanpa menyimpan?"
        confirmLabel="Tinggalkan Halaman"
        cancelLabel="Tetap di Sini"
        confirmTone="danger"
        onConfirm={handleConfirmLeave}
        onOpenChange={(open) => {
          if (!open) {
            setLeaveConfirm({ open: false, targetPath: '' });
          }
        }}
      />
    </div>
  );
}

export default StudioProfilePage;
