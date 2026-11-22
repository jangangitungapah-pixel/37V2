import { AlertTriangle, Loader2, RotateCcw, X } from 'lucide-react';

import { AdminButton, AdminSurface } from '@/features/admin/design-system';

import { UPLOAD_QUEUE_STATUSES } from '../hooks/useGalleryUpload';

/**
 * Compact upload status & recovery bar.
 * Automatically hides completed uploads so successful uploads simply appear in the photo grid,
 * while keeping in-progress uploads and failed uploads (including `Retry Save Metadata`) recoverable.
 */
export function GalleryUploadQueue({
  queue = [],
  onCancelQueued,
  onRetryUpload,
  onRetryMetadataSave,
  onDismissItem,
}) {
  const visibleItems = Array.isArray(queue)
    ? queue.filter((item) => item.status !== UPLOAD_QUEUE_STATUSES.COMPLETED)
    : [];

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <AdminSurface
      as="section"
      variant="subcard"
      aria-label="Status unggahan foto"
      className="p-3 sm:p-4"
    >
      <ul className="space-y-2">
        {visibleItems.map((item) => {
          const isBusy =
            item.status === UPLOAD_QUEUE_STATUSES.UPLOADING ||
            item.status === UPLOAD_QUEUE_STATUSES.SAVING_METADATA;

          return (
            <li
              key={item.queueId}
              className="rounded-xl border border-[#151515]/10 bg-white p-2.5 sm:p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isBusy ? (
                      <Loader2
                        className="h-3.5 w-3.5 shrink-0 animate-spin text-[#151515]"
                        aria-hidden="true"
                      />
                    ) : null}
                    <p className="truncate text-xs font-semibold text-[#151515]">{item.fileName}</p>
                    {isBusy ? (
                      <span className="font-mono text-[11px] text-[#666159]">
                        {item.progress || 0}%
                      </span>
                    ) : null}
                  </div>

                  {isBusy ? (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#151515]/10">
                      <div
                        className="h-full rounded-full bg-[#151515] transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(8, item.progress || 10))}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  {item.error ? (
                    <div
                      role="alert"
                      className="mt-1.5 flex items-start gap-1.5 text-xs text-red-700"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{item.error}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {item.status === UPLOAD_QUEUE_STATUSES.QUEUED ? (
                    <AdminButton
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => onCancelQueued?.(item.queueId)}
                      aria-label={`Cancel queued upload for ${item.fileName}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Batal</span>
                    </AdminButton>
                  ) : null}

                  {item.status === UPLOAD_QUEUE_STATUSES.UPLOAD_FAILED ? (
                    <>
                      <AdminButton
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => onRetryUpload?.(item.queueId)}
                        aria-label={`Retry upload for ${item.fileName}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Coba Lagi</span>
                      </AdminButton>
                      <AdminButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => onDismissItem?.(item.queueId)}
                        aria-label={`Dismiss failed upload for ${item.fileName}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </AdminButton>
                    </>
                  ) : null}

                  {item.status === UPLOAD_QUEUE_STATUSES.METADATA_FAILED ? (
                    <AdminButton
                      type="button"
                      variant="orange"
                      size="xs"
                      onClick={() => onRetryMetadataSave?.(item.queueId)}
                      aria-label={`Retry save metadata for ${item.fileName}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Simpan Ulang Foto</span>
                    </AdminButton>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </AdminSurface>
  );
}
