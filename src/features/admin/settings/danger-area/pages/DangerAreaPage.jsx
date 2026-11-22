import { useState } from 'react';
import { CheckCircle2, History } from 'lucide-react';
import { toast } from 'sonner';

import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminPageHeader, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { SettingsBreadcrumb } from '@/features/admin/settings/components/SettingsBreadcrumb';

import { DangerAreaOverview } from '../components/DangerAreaOverview';
import { FactoryResetConfirmDialog } from '../components/FactoryResetConfirmDialog';
import { FactoryResetPreservedData } from '../components/FactoryResetPreservedData';
import { FactoryResetPreview } from '../components/FactoryResetPreview';
import { FactoryResetProgress } from '../components/FactoryResetProgress';
import { FactoryResetResult } from '../components/FactoryResetResult';
import { FactoryResetWarning } from '../components/FactoryResetWarning';
import { FACTORY_RESET_STATUS } from '../config/factory-reset-config';
import { useFactoryReset } from '../hooks/useFactoryReset';
import { formatResetErrorForDisplay } from '../utils/factory-reset-manifest';

export function DangerAreaPage() {
  const {
    actor,
    reauthenticate,
    preflight,
    isPreviewLoading,
    previewError,
    runPreview,
    operation,
    isLocked,
    isExecuting,
    isPauseRequested,
    executionError,
    progress,
    sessionCompletedOperation,
    startReset,
    resumeReset,
    requestPause,
    cancelBeforeDeletion,
    clearCompletedView,
  } = useFactoryReset();

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleExecuteReset = async (payload) => {
    try {
      const result = await startReset(payload);
      if (result?.status === FACTORY_RESET_STATUS.COMPLETED) {
        toast.success(
          'Factory Reset selesai dan seluruh koleksi operasional telah terverifikasi kosong.',
        );
      } else if (result?.status === FACTORY_RESET_STATUS.PAUSED) {
        toast.info('Factory Reset dijeda dengan aman setelah batch terakhir.');
      }
      return result;
    } catch (err) {
      toast.error(formatResetErrorForDisplay(err));
      throw err;
    }
  };

  const handleResumeReset = async (opts) => {
    try {
      const result = await resumeReset(opts);
      if (result?.status === FACTORY_RESET_STATUS.COMPLETED) {
        toast.success('Factory Reset dilanjutkan hingga selesai dan terverifikasi kosong.');
      } else if (result?.status === FACTORY_RESET_STATUS.PAUSED) {
        toast.info('Factory Reset dijeda dengan aman.');
      }
      return result;
    } catch (err) {
      toast.error(formatResetErrorForDisplay(err));
      throw err;
    }
  };

  const handleCancelBeforeDeletion = async () => {
    try {
      await cancelBeforeDeletion();
      toast.success('Operasi Factory Reset dibatalkan aman sebelum ada dokumen terhapus.');
    } catch (err) {
      toast.error(formatResetErrorForDisplay(err));
    }
  };

  const showCompletedResult = Boolean(
    sessionCompletedOperation?.status === FACTORY_RESET_STATUS.COMPLETED,
  );
  const showActiveProgress = Boolean(!showCompletedResult && (isLocked || isExecuting));

  return (
    <div data-calendar-scoped="true" className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        eyebrow="Settings • Danger Area"
        titleId="danger-area-page-heading"
        title="Danger Area"
        description="Zona destruktif khusus Studio Owner untuk menjalankan Operational Factory Reset secara terkontrol, terverifikasi, dan dapat dilanjutkan kembali."
        meta={
          <AdminStatusBadge tone="danger" dot size="sm">
            OWNER ONLY
          </AdminStatusBadge>
        }
      >
        <SettingsBreadcrumb
          items={[
            { label: 'Admin', to: '/admin/dashboard' },
            { label: 'Settings', to: '/admin/settings' },
            { label: 'Danger Area' },
          ]}
          backTo="/admin/settings"
          backLabel="Back to Settings"
        />
      </AdminPageHeader>

      {showCompletedResult ? (
        <FactoryResetResult
          operation={sessionCompletedOperation}
          onDoneResetView={clearCompletedView}
        />
      ) : null}

      {showActiveProgress && operation ? (
        <FactoryResetProgress
          operation={operation}
          progress={progress}
          actor={actor}
          reauthenticate={reauthenticate}
          isExecuting={isExecuting}
          isPauseRequested={isPauseRequested}
          executionError={executionError}
          onRequestPause={requestPause}
          onResume={handleResumeReset}
          onCancelBeforeDeletion={handleCancelBeforeDeletion}
        />
      ) : null}

      {!showCompletedResult && !showActiveProgress ? (
        <>
          {operation?.status === FACTORY_RESET_STATUS.COMPLETED ? (
            <AdminSurface
              as="section"
              variant="ivory"
              className="flex flex-wrap items-center justify-between gap-3 border-[#8BAD12]/35 bg-[#F4FBE0]/75 px-4 py-3 text-xs text-[#243300]"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#658800]" aria-hidden="true" />
                <span>
                  Factory Reset terakhir (<strong>{operation.operationId}</strong>) selesai pada{' '}
                  <strong>{formatIndonesianTimestamp(operation.completedAt)}</strong> (
                  {operation.totalDeletedCount} dokumen dihapus).
                </span>
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold uppercase">
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                Audit Record Tersimpan
              </span>
            </AdminSurface>
          ) : null}

          <DangerAreaOverview />
          <FactoryResetWarning />

          <FactoryResetPreview
            preflight={preflight}
            isLoading={isPreviewLoading}
            error={previewError}
            isLocked={isLocked}
            onRefresh={runPreview}
            onRequestStartReset={() => setConfirmOpen(true)}
          />

          <FactoryResetPreservedData preservedItems={preflight?.preservedItems || []} />

          <FactoryResetConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            preflight={preflight}
            actor={actor}
            reauthenticate={reauthenticate}
            isExecuting={isExecuting}
            onExecuteReset={handleExecuteReset}
          />
        </>
      ) : null}
    </div>
  );
}

export default DangerAreaPage;
