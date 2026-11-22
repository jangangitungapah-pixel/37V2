import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Trash2, X } from 'lucide-react';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { UPLOAD_QUEUE_STATUSES } from '../hooks/useGalleryUpload';
import { formatGalleryFileSize } from '../utils/gallery-format';

function getQueueStatusBadge(status) {
  switch (status) {
    case UPLOAD_QUEUE_STATUSES.QUEUED:
      return { label: 'Queued', tone: 'ivory' };
    case UPLOAD_QUEUE_STATUSES.UPLOADING:
      return { label: 'Uploading to Cloudinary', tone: 'amber' };
    case UPLOAD_QUEUE_STATUSES.SAVING_METADATA:
      return { label: 'Saving Metadata', tone: 'amber' };
    case UPLOAD_QUEUE_STATUSES.COMPLETED:
      return { label: 'Completed', tone: 'lime' };
    case UPLOAD_QUEUE_STATUSES.METADATA_FAILED:
      return { label: 'Metadata Save Failed', tone: 'orange' };
    case UPLOAD_QUEUE_STATUSES.UPLOAD_FAILED:
      return { label: 'Upload Failed', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function GalleryUploadQueue({
  queue = [],
  onCancelQueued,
  onRetryUpload,
  onRetryMetadataSave,
  onRemoveCompleted,
  onDismissItem,
}) {
  if (!Array.isArray(queue) || queue.length === 0) {
    return null;
  }

  const hasCompleted = queue.some((item) => item.status === UPLOAD_QUEUE_STATUSES.COMPLETED);

  return (
    <AdminSurface
      as="section"
      variant="subcard"
      aria-labelledby="gallery-upload-queue-heading"
      className="p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-3">
        <div>
          <h3 id="gallery-upload-queue-heading" className="text-sm font-bold text-[#151515]">
            Upload Queue ({queue.length})
          </h3>
          <p className="text-xs text-[#666159]">
            Status unggahan file ke Cloudinary dan penyimpanan metadata Firestore.
          </p>
        </div>

        {hasCompleted ? (
          <AdminButton type="button" variant="secondary" size="xs" onClick={onRemoveCompleted}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear Completed</span>
          </AdminButton>
        ) : null}
      </div>

      <ul className="mt-3 space-y-2.5">
        {queue.map((item) => {
          const badge = getQueueStatusBadge(item.status);
          const isBusy =
            item.status === UPLOAD_QUEUE_STATUSES.UPLOADING ||
            item.status === UPLOAD_QUEUE_STATUSES.SAVING_METADATA;

          return (
            <li
              key={item.queueId}
              className="rounded-xl border border-[#151515]/10 bg-white p-3 sm:p-3.5"
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-xs font-bold text-[#151515] sm:text-sm">
                      {item.fileName}
                    </p>
                    <span className="font-mono text-[11px] text-[#666159]">
                      ({formatGalleryFileSize(item.fileSize)})
                    </span>
                    <AdminStatusBadge tone={badge.tone} size="sm">
                      {badge.label}
                    </AdminStatusBadge>
                  </div>

                  {/* Progress Bar */}
                  {isBusy || item.status === UPLOAD_QUEUE_STATUSES.COMPLETED ? (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#151515]/10">
                      <div
                        className="h-full rounded-full bg-[#151515] transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, item.progress || 0))}%` }}
                      />
                    </div>
                  ) : null}

                  {item.error ? (
                    <div
                      role="alert"
                      className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">{item.error}</p>
                        {item.status === UPLOAD_QUEUE_STATUSES.METADATA_FAILED &&
                        item.cloudinaryPublicId ? (
                          <p className="font-mono text-[11px] text-red-900">
                            Cloudinary Public ID: <strong>{item.cloudinaryPublicId}</strong> (File
                            sudah terunggah ke Cloudinary — klik &ldquo;Retry Save Metadata&rdquo;
                            tanpa mengunggah ulang file).
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Per-item Queue Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {isBusy ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#666159]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>{item.progress || 0}%</span>
                    </span>
                  ) : null}

                  {item.status === UPLOAD_QUEUE_STATUSES.COMPLETED ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F6246]">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>Saved as Draft</span>
                    </span>
                  ) : null}

                  {item.status === UPLOAD_QUEUE_STATUSES.QUEUED ? (
                    <AdminButton
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => onCancelQueued?.(item.queueId)}
                      aria-label={`Cancel queued upload for ${item.fileName}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Cancel</span>
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
                        <span>Retry Upload</span>
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
                      <span>Retry Save Metadata</span>
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
