import { useRef, useState } from 'react';
import { AlertTriangle, CloudUpload, ImagePlus } from 'lucide-react';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

export function GalleryUploadDropzone({ cloudinaryConfig, onSelectFiles, disabled = false }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const isConfigured = Boolean(cloudinaryConfig?.isConfigured);
  const isDisabled = disabled || !isConfigured;

  const handleOpenPicker = () => {
    if (isDisabled) return;
    fileInputRef.current?.click();
  };

  const handleInputChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onSelectFiles?.(files);
    }
    event.target.value = '';
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDisabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (isDisabled) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      onSelectFiles?.(files);
    }
  };

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="gallery-upload-heading"
      className="p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="gallery-upload-heading" className="text-base font-bold text-[#151515]">
            Upload Studio Photographs
          </h3>
          <p className="text-xs text-[#666159]">
            Unggah langsung ke Cloudinary secara unsigned. Foto baru masuk sebagai Draft sebelum
            dipublikasikan.
          </p>
        </div>

        <AdminStatusBadge tone={isConfigured ? 'lime' : 'amber'} dot size="sm">
          {isConfigured ? `Cloudinary • ${cloudinaryConfig.cloudName}` : 'Cloudinary Unconfigured'}
        </AdminStatusBadge>
      </div>

      {!isConfigured ? (
        <div
          role="alert"
          className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-[#FEF4DD] p-3.5 text-xs text-[#6B3B08]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#8A4B08]" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">Konfigurasi Cloudinary Belum Lengkap</p>
            <p className="leading-relaxed">{cloudinaryConfig?.statusMessage}</p>
          </div>
        </div>
      ) : null}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-colors sm:p-7 ${
          isDragging
            ? 'border-[#151515] bg-[#EDF8C2]/45'
            : isDisabled
              ? 'border-[#151515]/15 bg-[#F8F6EF]/60 opacity-75'
              : 'border-[#151515]/20 bg-[#F8F6EF] hover:border-[#151515]/40'
        }`}
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#151515]/10 bg-white text-[#151515] shadow-xs">
          <CloudUpload className="h-5 w-5" aria-hidden="true" />
        </span>

        <p className="mt-3 text-sm font-bold text-[#151515]">
          Tarik &amp; lepaskan foto studio di sini, atau pilih file dari perangkat
        </p>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#666159]">
          Format didukung: <strong>JPG, JPEG, PNG, WEBP, AVIF</strong> · Maksimal{' '}
          <strong>10 MB</strong> per foto · Resolusi maksimal <strong>6000 × 6000 px</strong> ·
          Maksimal 2 unggahan paralel.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
          onChange={handleInputChange}
          disabled={isDisabled}
          aria-label="Select studio photograph files to upload"
          className="sr-only"
        />

        <div className="mt-4">
          <AdminButton
            type="button"
            variant="primary"
            size="sm"
            onClick={handleOpenPicker}
            disabled={isDisabled}
          >
            <ImagePlus className="h-4 w-4 text-[#C8F13A]" aria-hidden="true" />
            <span>Select Photographs</span>
          </AdminButton>
        </div>
      </div>
    </AdminSurface>
  );
}
