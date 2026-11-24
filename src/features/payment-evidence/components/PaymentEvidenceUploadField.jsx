import { useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

import {
  PAYMENT_EVIDENCE_PRIVACY_NOTICE,
  PAYMENT_EVIDENCE_PRIVACY_NOTICE_ID,
  PAYMENT_EVIDENCE_UPLOAD_STATES,
} from '../config/payment-evidence-config';
import { formatEvidenceFileSize } from '../utils/payment-evidence-utils';

/**
 * Compact, polished Spatial Ambient payment-evidence upload field shared by Client Portal
 * and Admin Portal (RecordPaymentDialog & BookingFormDialog).
 *
 * Supports drag-and-drop on desktop, mobile file/camera picker, preview before submit,
 * replace/remove, progress bar, safe cancel while uploading, preserved Cloudinary upload
 * retry notice, unconfigured preset notice, and explicit public-URL privacy warning.
 */
export function PaymentEvidenceUploadField({
  upload,
  label = '',
  required = false,
  disabled = false,
  locale = 'en',
  showPrivacyNotice = true,
  inputTestId = 'payment-evidence-file-input',
}) {
  const isId = locale === 'id';
  const inputId = useId();
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    config,
    uploadState,
    selectedFile,
    previewUrl,
    progress,
    hasPreservedUpload,
    error,
    selectFile,
    cancelUpload,
    reset,
  } = upload;

  const isBusy =
    uploadState === PAYMENT_EVIDENCE_UPLOAD_STATES.VALIDATING ||
    uploadState === PAYMENT_EVIDENCE_UPLOAD_STATES.UPLOADING ||
    uploadState === PAYMENT_EVIDENCE_UPLOAD_STATES.SAVING_METADATA;

  const isUnconfigured = !config?.isConfigured;

  const resolvedLabel =
    label || (isId ? 'Bukti Pembayaran (Gambar)' : 'Payment Proof Image');

  const handleFileList = (files) => {
    if (disabled || isBusy || isUnconfigured) return;
    const file = files?.[0] || null;
    if (file) {
      void selectFile(file);
    }
  };

  const handleInputChange = (event) => {
    handleFileList(event.target.files);
    // Allow re-selecting the same file after clearing/error
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFileList(event.dataTransfer?.files);
  };

  const triggerFilePicker = () => {
    if (disabled || isBusy || isUnconfigured) return;
    fileInputRef.current?.click();
  };

  return (
    <div data-testid="payment-evidence-upload-field" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#151515]">
          {resolvedLabel}{' '}
          {required ? (
            <span className="text-[#FF4B22]">*</span>
          ) : (
            <span className="font-normal text-[#666159]">
              ({isId ? 'Opsional' : 'Optional'})
            </span>
          )}
        </label>
        <span className="font-mono text-[10.5px] text-[#666159]">JPG, PNG, WEBP · Max 5 MB</span>
      </div>

      {/* Missing Preset Configuration Notice */}
      {isUnconfigured ? (
        <div
          role="alert"
          data-testid="payment-evidence-unconfigured-alert"
          className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-[#FEF4DD]/85 p-3 text-xs text-[#8A4B08]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-semibold">
              {isId
                ? 'Preset unggah bukti pembayaran belum dikonfigurasi'
                : 'Payment proof upload is not configured yet'}
            </p>
            <p className="leading-relaxed text-[#6B3B06]">{config?.statusMessage}</p>
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || isBusy || isUnconfigured}
        onChange={handleInputChange}
        data-testid={inputTestId}
        className="sr-only"
      />

      {/* Compact Dropzone OR Selected/Uploaded Preview Card */}
      {!selectedFile && !hasPreservedUpload ? (
        <div
          role="button"
          tabIndex={disabled || isUnconfigured ? -1 : 0}
          aria-label={
            isId
              ? 'Pilih atau tarik file gambar bukti pembayaran'
              : 'Select or drop a payment proof image'
          }
          onClick={triggerFilePicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerFilePicker();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!disabled && !isUnconfigured) setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !isUnconfigured) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-3.5 py-3 transition-all ${
            disabled || isUnconfigured
              ? 'cursor-not-allowed border-[#151515]/12 bg-[#FAF8F3]/60 opacity-60'
              : isDragging
                ? 'border-[#FF4B22] bg-[#FFEDE8]/55 shadow-xs'
                : 'border-[#151515]/18 bg-[#FAF8F3]/85 hover:border-[#151515]/35 hover:bg-white hover:shadow-xs'
          }`}
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#151515]/10 bg-white text-[#46433D] shadow-2xs">
            <ImagePlus className="h-4.5 w-4.5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#151515]">
              {isId ? 'Pilih foto atau screenshot bukti transfer' : 'Choose screenshot or photo'}
            </p>
            <p className="mt-0.5 text-[11px] text-[#666159]">
              {isId
                ? 'Tarik file ke sini atau ketuk untuk memilih dari perangkat / kamera.'
                : 'Drag and drop here, or tap to pick from your device or camera.'}
            </p>
          </div>

          <span className="hidden shrink-0 rounded-full border border-[#151515]/12 bg-white px-3 py-1 text-[11px] font-semibold text-[#151515] shadow-2xs sm:inline-flex">
            {isId ? 'Pilih File' : 'Browse'}
          </span>
        </div>
      ) : (
        <div
          data-testid="payment-evidence-selected-card"
          className="rounded-2xl border border-[#151515]/12 bg-[#FAF8F3]/85 p-3 shadow-2xs"
        >
          <div className="flex flex-col gap-2.5 min-[400px]:flex-row min-[400px]:items-start min-[400px]:gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {previewUrl ? (
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#151515]/12 bg-white">
                  <img
                    src={previewUrl}
                    alt={isId ? 'Pratinjau file dipilih' : 'Selected proof preview'}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#151515]/10 bg-white text-[#666159]">
                  <UploadCloud className="h-5 w-5" aria-hidden="true" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#151515]">
                  {selectedFile?.name ||
                    (isId ? 'Bukti pembayaran terunggah' : 'Uploaded payment proof')}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[#666159]">
                  {selectedFile
                    ? `${formatEvidenceFileSize(selectedFile.size)} · ${selectedFile.type || 'image'}`
                    : isId
                      ? 'Tersimpan sementara di Cloudinary'
                      : 'Uploaded to Cloudinary'}
                </p>

                {/* Progress / State Status */}
                {uploadState === PAYMENT_EVIDENCE_UPLOAD_STATES.UPLOADING ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10.5px] font-medium text-[#46433D]">
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        <span>{isId ? 'Mengunggah gambar...' : 'Uploading image...'}</span>
                      </span>
                      <span className="font-mono tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#151515]/10">
                      <div
                        className="h-full rounded-full bg-[#151515] transition-all duration-150"
                        style={{ width: `${Math.max(5, progress)}%` }}
                      />
                    </div>
                  </div>
                ) : uploadState === PAYMENT_EVIDENCE_UPLOAD_STATES.SAVING_METADATA ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#46433D]">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    <span>{isId ? 'Menyimpan catatan bukti...' : 'Saving submission...'}</span>
                  </p>
                ) : hasPreservedUpload ? (
                  <p
                    data-testid="payment-evidence-preserved-badge"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F6246]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {isId
                        ? 'Gambar sudah terunggah — tidak perlu unggah ulang jika mencoba simpan lagi.'
                        : 'Image uploaded — retrying will save without re-uploading.'}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5 border-t border-[#151515]/[0.07] pt-2 min-[400px]:border-t-0 min-[400px]:pt-0">
              {uploadState === PAYMENT_EVIDENCE_UPLOAD_STATES.UPLOADING ? (
                <button
                  type="button"
                  onClick={cancelUpload}
                  aria-label={isId ? 'Batalkan unggahan' : 'Cancel upload'}
                  className="inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[#151515]/15 bg-white px-3.5 text-[11px] font-semibold text-[#46433D] transition-colors hover:text-[#151515] min-[400px]:flex-initial"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isId ? 'Batal' : 'Cancel'}</span>
                </button>
              ) : !isBusy && !disabled ? (
                <>
                  <button
                    type="button"
                    onClick={triggerFilePicker}
                    aria-label={isId ? 'Ganti gambar bukti pembayaran' : 'Replace payment proof image'}
                    className="inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[#151515]/15 bg-white px-3.5 text-[11px] font-semibold text-[#46433D] transition-colors hover:border-[#151515]/30 hover:text-[#151515] min-[400px]:flex-initial"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isId ? 'Ganti' : 'Replace'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    aria-label={isId ? 'Hapus file dipilih' : 'Remove selected image'}
                    className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#151515]/12 bg-white text-[#666159] transition-colors hover:border-[#FF4B22]/30 hover:text-[#B92B0C]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Upload / Validation Error */}
      {error ? (
        <p
          role="alert"
          data-testid="payment-evidence-upload-error"
          className="flex items-start gap-1.5 text-xs font-medium text-[#B92B0C]"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      {/* Mandatory Compact Public-URL Privacy Notice */}
      {showPrivacyNotice ? (
        <div
          data-testid="payment-evidence-privacy-notice"
          className="flex items-start gap-2 rounded-xl border border-[#151515]/10 bg-[#F8F6EF] px-3 py-2 text-[11px] leading-relaxed text-[#46433D]"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
          <p>{isId ? PAYMENT_EVIDENCE_PRIVACY_NOTICE_ID : PAYMENT_EVIDENCE_PRIVACY_NOTICE}</p>
        </div>
      ) : null}
    </div>
  );
}
