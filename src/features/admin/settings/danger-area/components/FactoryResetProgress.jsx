import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Pause,
  Play,
  XCircle,
} from 'lucide-react';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import {
  FACTORY_RESET_DELETION_MANIFEST,
  FACTORY_RESET_STATUS,
} from '../config/factory-reset-config';
import { reauthenticateOwnerForFactoryReset } from '../services/factory-reset-auth-service';
import { formatResetErrorForDisplay } from '../utils/factory-reset-manifest';
import { canCancelFactoryResetSafely } from '../utils/factory-reset-validation';

export function FactoryResetProgress({
  operation,
  progress,
  actor,
  reauthenticate,
  isExecuting = false,
  isPauseRequested = false,
  executionError = '',
  onRequestPause,
  onResume,
  onCancelBeforeDeletion,
}) {
  const [resumePassword, setResumePassword] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [isVerifyingAndResuming, setIsVerifyingAndResuming] = useState(false);

  const isFailed = operation?.status === FACTORY_RESET_STATUS.FAILED;
  const isPaused = operation?.status === FACTORY_RESET_STATUS.PAUSED;
  const canSafeCancel = canCancelFactoryResetSafely(operation) && !isExecuting;
  const completedSet = new Set(operation?.completedCollections || []);

  const handleVerifyAndResume = async (e) => {
    e.preventDefault();
    if (isVerifyingAndResuming || isExecuting) return;

    setResumeError('');
    setIsVerifyingAndResuming(true);
    const pwd = resumePassword;
    setResumePassword('');

    try {
      const verifiedAt = await reauthenticateOwnerForFactoryReset({
        actor,
        password: pwd,
        reauthenticate,
      });
      await onResume?.({ reauthenticatedAtOverride: verifiedAt });
    } catch (err) {
      setResumeError(formatResetErrorForDisplay(err));
    } finally {
      setIsVerifyingAndResuming(false);
    }
  };

  return (
    <AdminSurface
      as="section"
      variant="card"
      data-testid="factory-reset-progress-section"
      aria-labelledby="factory-reset-progress-heading"
      className="border-red-300 bg-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#151515]/[0.08] pb-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700">
            {isExecuting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="factory-reset-progress-heading"
                className="text-base font-bold tracking-tight text-[#151515] sm:text-lg"
              >
                Factory Reset in Progress
              </h2>
              <AdminStatusBadge
                tone={isFailed ? 'danger' : isPaused ? 'amber' : 'orange'}
                dot
                size="sm"
              >
                {isExecuting
                  ? 'MENJALANKAN BATCH'
                  : isFailed
                    ? 'TERHENTI (ERROR)'
                    : isPaused
                      ? 'DIJEDA'
                      : 'MENUNGGU RESUME'}
              </AdminStatusBadge>
            </div>
            <p className="mt-1 font-mono text-[11px] text-[#666159]">
              Operation ID: {operation?.operationId}
            </p>
          </div>
        </div>

        {isExecuting ? (
          <AdminButton
            variant="secondary"
            size="sm"
            onClick={onRequestPause}
            disabled={isPauseRequested}
            className="min-h-10 w-full justify-center sm:w-auto"
          >
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isPauseRequested ? 'Menjeda setelah batch ini...' : 'Jeda Setelah Batch Ini'}
            </span>
          </AdminButton>
        ) : null}
      </div>

      {/* Persistent Maintenance Notice */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <span>
          <strong>Maintenance Lock Aktif:</strong> Fitur tambah/ubah booking, pelanggan, pembayaran,
          inventori, pembukuan, dan pengajuan booking request baru dinonaktifkan sementara hingga
          Factory Reset tuntas dan terverifikasi.
        </span>
      </div>

      {/* Progress Telemetry */}
      <div className="mt-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[#151515]">
            Koleksi aktif:{' '}
            <span className="font-mono text-red-700">
              {progress.currentStep?.label || 'Verifikasi akhir & inisialisasi ulang'}
            </span>
          </span>
          <span className="font-mono text-[11px] font-bold text-[#46433D]">
            {progress.completedStepsCount} / {progress.totalSteps} target selesai •{' '}
            {progress.totalDeletedCount} dokumen terhapus
            {typeof progress.remainingEstimate === 'number'
              ? ` • ~${progress.remainingEstimate} tersisa`
              : ''}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.isIndeterminate ? undefined : progress.percentage}
          className="h-3 w-full overflow-hidden rounded-full border border-[#151515]/15 bg-[#F2EFE8]"
        >
          {progress.isIndeterminate ? (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-red-600" />
          ) : (
            <div
              className="h-full rounded-full bg-red-600 transition-all duration-300"
              style={{ width: `${Math.max(4, progress.percentage)}%` }}
            />
          )}
        </div>
      </div>

      {/* Error Display */}
      {executionError || operation?.lastErrorMessage ? (
        <div
          role="alert"
          data-testid="factory-reset-execution-error"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-bold">Eksekusi terhenti — progres aman tersimpan untuk Resume.</p>
            <p>{executionError || operation?.lastErrorMessage}</p>
          </div>
        </div>
      ) : null}

      {/* Resume / Safe Cancel Actions when NOT currently executing in this tab */}
      {!isExecuting ? (
        <div className="mt-5 rounded-2xl border border-[#151515]/10 bg-[#FAF8F3] p-4">
          <form onSubmit={handleVerifyAndResume} className="space-y-3">
            <div>
              <h3 className="text-xs font-bold text-[#151515] sm:text-sm">
                Lanjutkan (Resume) dari Kursor Terakhir
              </h3>
              <p className="mt-0.5 text-xs text-[#666159]">
                Masukkan password akun Owner Anda untuk memverifikasi sesi dan melanjutkan batch
                yang tersisa.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <label htmlFor="factory-reset-resume-password" className="sr-only">
                  Password Owner untuk Resume Factory Reset
                </label>
                <KeyRound
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#666159]"
                  aria-hidden="true"
                />
                <input
                  id="factory-reset-resume-password"
                  type="password"
                  autoComplete="current-password"
                  value={resumePassword}
                  onChange={(e) => setResumePassword(e.target.value)}
                  disabled={isVerifyingAndResuming}
                  placeholder="Password Owner saat ini..."
                  className="min-h-11 w-full rounded-xl border border-[#151515]/20 bg-white py-2.5 pr-3 pl-9 text-sm text-[#151515] outline-none focus:border-[#151515] sm:text-xs"
                  required
                />
              </div>

              <AdminButton
                type="submit"
                variant="danger"
                size="md"
                disabled={isVerifyingAndResuming || resumePassword.length === 0}
                className="min-h-11 w-full justify-center sm:w-auto"
              >
                {isVerifyingAndResuming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Melanjutkan...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    <span>{isFailed ? 'Coba Lagi & Resume' : 'Resume Factory Reset'}</span>
                  </>
                )}
              </AdminButton>
            </div>

            {resumeError ? (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {resumeError}
              </p>
            ) : null}
          </form>

          <div className="mt-3.5 border-t border-[#151515]/[0.08] pt-3 text-xs">
            {canSafeCancel ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[#666159]">
                  Belum ada dokumen yang dihapus. Operasi masih dapat dibatalkan dengan aman.
                </span>
                <AdminButton
                  variant="secondary"
                  size="sm"
                  onClick={onCancelBeforeDeletion}
                  className="min-h-10 w-full justify-center sm:w-auto"
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Batalkan Operasi</span>
                </AdminButton>
              </div>
            ) : (
              <p className="font-medium text-[#666159]">
                Penghapusan sudah berjalan ({progress.totalDeletedCount} dokumen terhapus). Operasi
                tidak dapat di-rollback dan wajib dilanjutkan hingga seluruh target terverifikasi
                kosong.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Per-target status breakdown */}
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FACTORY_RESET_DELETION_MANIFEST.map((step) => {
          const isDone = completedSet.has(step.key);
          const isActive = operation?.currentCollection === step.key && !isDone;
          const deletedCount = operation?.deletedDocumentCounts?.[step.key] || 0;

          return (
            <div
              key={step.key}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                isDone
                  ? 'border-[#8BAD12]/35 bg-[#F4FBE0]'
                  : isActive
                    ? 'border-red-300 bg-red-50'
                    : 'border-[#151515]/10 bg-[#FAF8F3]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {isDone ? (
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0 text-[#658800]"
                    aria-hidden="true"
                  />
                ) : isActive && isExecuting ? (
                  <Loader2
                    className="h-3.5 w-3.5 shrink-0 animate-spin text-red-700"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#8B857B]" aria-hidden="true" />
                )}
                <span className="truncate font-medium text-[#151515]">{step.label}</span>
              </div>
              <span className="shrink-0 font-mono text-[11px] font-bold text-[#46433D]">
                {deletedCount}
              </span>
            </div>
          );
        })}
      </div>
    </AdminSurface>
  );
}
