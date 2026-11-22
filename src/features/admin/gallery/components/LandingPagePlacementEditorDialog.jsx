import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ImagePlus, Loader2, Save, X } from 'lucide-react';

import { StudioImage } from '@/components/landing/StudioImage';
import { AdminButton } from '@/features/admin/design-system';

import {
  getLandingPagePlacementDefinition,
  LANDING_PAGE_PLACEMENT_IDS,
  LANDING_PAGE_PLACEMENT_LIMITS,
} from '../config/landing-page-placements-config';
import { normalizePlacementCopy } from '../utils/landing-page-placement-normalize';

export function LandingPagePlacementEditorDialog({
  open,
  placementId,
  existingPlacement = null,
  selectedPhoto = null,
  onOpenChange,
  onOpenPhotoPicker,
  onSavePlacement,
}) {
  const def = getLandingPagePlacementDefinition(placementId);

  const initialCopy = normalizePlacementCopy(placementId, existingPlacement?.copy);
  const activePhoto = selectedPhoto || existingPlacement || null;

  const [altText, setAltText] = useState(
    () =>
      existingPlacement?.altText ||
      selectedPhoto?.altText ||
      selectedPhoto?.title ||
      def?.defaultAltText ||
      '',
  );

  // Hero fields
  const [topSticker, setTopSticker] = useState(initialCopy.topSticker || '');
  const [captionTitle, setCaptionTitle] = useState(initialCopy.captionTitle || '');
  const [captionSubtitle, setCaptionSubtitle] = useState(initialCopy.captionSubtitle || '');
  const [floatingBadgeTitle, setFloatingBadgeTitle] = useState(
    initialCopy.floatingBadgeTitle || '',
  );
  const [floatingBadgeSubtitle, setFloatingBadgeSubtitle] = useState(
    initialCopy.floatingBadgeSubtitle || '',
  );

  // Room fields
  const [sticker, setSticker] = useState(initialCopy.sticker || '');
  const [name, setName] = useState(initialCopy.name || '');
  const [capacityLabel, setCapacityLabel] = useState(initialCopy.capacityLabel || '');
  const [tagsText, setTagsText] = useState(
    Array.isArray(initialCopy.tags) ? initialCopy.tags.join(', ') : '',
  );
  const [ctaLabel, setCtaLabel] = useState(initialCopy.ctaLabel || 'Book this room');

  // Studio Exterior field
  const [exteriorCaption, setExteriorCaption] = useState(initialCopy.caption || '');

  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isHero = placementId === LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED;
  const isRoom =
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_A ||
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_B;
  const isExterior = placementId === LANDING_PAGE_PLACEMENT_IDS.STUDIO_EXTERIOR;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    const photoToSave = selectedPhoto || existingPlacement;
    if (!photoToSave || !photoToSave.secureUrl) {
      setSubmitError('Pilih foto terlebih dahulu sebelum menyimpan ke Landing Page.');
      return;
    }

    const copyPayload = isHero
      ? {
          topSticker,
          captionTitle,
          captionSubtitle,
          floatingBadgeTitle,
          floatingBadgeSubtitle,
        }
      : isRoom
        ? {
            sticker,
            name,
            capacityLabel,
            tags: tagsText,
            ctaLabel,
          }
        : {
            caption: exteriorCaption,
          };

    setIsSaving(true);
    try {
      await onSavePlacement?.({
        placementId,
        photoItem: photoToSave,
        altText: altText.trim() || photoToSave.altText || photoToSave.title || def?.defaultAltText,
        copy: copyPayload,
        expectedVersion: existingPlacement ? existingPlacement.version : 0,
      });
    } catch (err) {
      // Keep editor state in memory so Owner can retry without losing edits
      setSubmitError(err?.message || 'Gagal menyimpan perubahan ke Landing Page.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup className="sa-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 sm:rounded-2xl sm:p-6">
            {def ? (
              <div>
                <div className="flex items-start justify-between gap-3 border-b border-[#151515]/10 pb-3">
                  <div>
                    <p className="font-mono text-[10px] font-semibold tracking-wider text-[#756F65] uppercase">
                      {def.sectionLabel}
                    </p>
                    <Dialog.Title className="text-lg font-bold text-[#151515]">
                      {def.label}
                    </Dialog.Title>
                    <Dialog.Description className="text-xs text-[#666159]">
                      Atur foto dan teks yang ditampilkan pada bagian ini di Landing Page.
                    </Dialog.Description>
                  </div>

                  <Dialog.Close
                    aria-label="Tutup editor penempatan"
                    className="sa-control sa-btn-secondary inline-flex h-8.5 w-8.5 shrink-0 cursor-pointer items-center justify-center rounded-full"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
                  {submitError ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800"
                    >
                      {submitError}
                    </div>
                  ) : null}

                  {/* Selected Photo Preview & Change Action */}
                  <div className="space-y-2 rounded-xl border border-[#151515]/10 bg-[#F8F6EF] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#151515]">Foto Terpilih</span>
                      <AdminButton
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={onOpenPhotoPicker}
                        disabled={isSaving}
                      >
                        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Pilih Foto Lain</span>
                      </AdminButton>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-[#151515]/10 bg-[#151515]">
                      <StudioImage
                        src={activePhoto?.thumbnailUrl || activePhoto?.secureUrl || ''}
                        alt={altText || def.defaultAltText}
                        width={activePhoto?.width || 960}
                        height={activePhoto?.height || 640}
                        fallbackLabel="Belum ada foto dipilih"
                        className={`${def.aspectClass} max-h-48 w-full`}
                      />
                    </div>
                  </div>

                  {/* Hero Copywriting Controls */}
                  {isHero ? (
                    <>
                      <div>
                        <label
                          htmlFor="placement-hero-sticker"
                          className="block text-xs font-semibold text-[#151515]"
                        >
                          Label Sticker Atas
                        </label>
                        <input
                          id="placement-hero-sticker"
                          type="text"
                          value={topSticker}
                          onChange={(e) => setTopSticker(e.target.value)}
                          maxLength={LANDING_PAGE_PLACEMENT_LIMITS.stickerMax}
                          className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="placement-hero-title"
                          className="block text-xs font-semibold text-[#151515]"
                        >
                          Judul Foto Hero <span className="text-[#FF4B22]">*</span>
                        </label>
                        <input
                          id="placement-hero-title"
                          type="text"
                          value={captionTitle}
                          onChange={(e) => setCaptionTitle(e.target.value)}
                          maxLength={LANDING_PAGE_PLACEMENT_LIMITS.titleMax}
                          className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="placement-hero-subtitle"
                          className="block text-xs font-semibold text-[#151515]"
                        >
                          Subjudul Foto Hero
                        </label>
                        <input
                          id="placement-hero-subtitle"
                          type="text"
                          value={captionSubtitle}
                          onChange={(e) => setCaptionSubtitle(e.target.value)}
                          maxLength={LANDING_PAGE_PLACEMENT_LIMITS.subtitleMax}
                          className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="placement-hero-badge-title"
                            className="block text-xs font-semibold text-[#151515]"
                          >
                            Judul Badge Melayang
                          </label>
                          <input
                            id="placement-hero-badge-title"
                            type="text"
                            value={floatingBadgeTitle}
                            onChange={(e) => setFloatingBadgeTitle(e.target.value)}
                            maxLength={LANDING_PAGE_PLACEMENT_LIMITS.floatingTitleMax}
                            className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="placement-hero-badge-subtitle"
                            className="block text-xs font-semibold text-[#151515]"
                          >
                            Subjudul Badge Melayang
                          </label>
                          <input
                            id="placement-hero-badge-subtitle"
                            type="text"
                            value={floatingBadgeSubtitle}
                            onChange={(e) => setFloatingBadgeSubtitle(e.target.value)}
                            maxLength={LANDING_PAGE_PLACEMENT_LIMITS.floatingSubtitleMax}
                            className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                          />
                        </div>
                      </div>
                    </>
                  ) : null}

                  {/* Room A / Room B Copywriting Controls */}
                  {isRoom ? (
                    <>
                      <div>
                        <label
                          htmlFor="placement-room-sticker"
                          className="block text-xs font-semibold text-[#151515]"
                        >
                          Label Sticker Ruangan
                        </label>
                        <input
                          id="placement-room-sticker"
                          type="text"
                          value={sticker}
                          onChange={(e) => setSticker(e.target.value)}
                          maxLength={LANDING_PAGE_PLACEMENT_LIMITS.stickerMax}
                          className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="placement-room-name"
                          className="block text-xs font-semibold text-[#151515]"
                        >
                          Nama Ruangan <span className="text-[#FF4B22]">*</span>
                        </label>
                        <input
                          id="placement-room-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          maxLength={LANDING_PAGE_PLACEMENT_LIMITS.titleMax}
                          className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="placement-room-capacity"
                          className="block text-xs font-semibold text-[#151515]"
                        >
                          Deskripsi Singkat / Kapasitas <span className="text-[#FF4B22]">*</span>
                        </label>
                        <textarea
                          id="placement-room-capacity"
                          rows={2}
                          value={capacityLabel}
                          onChange={(e) => setCapacityLabel(e.target.value)}
                          maxLength={LANDING_PAGE_PLACEMENT_LIMITS.capacityMax}
                          className="sa-control mt-1 w-full resize-y border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="placement-room-tags"
                          className="block text-xs font-semibold text-[#151515]"
                        >
                          Highlight Tags (pisahkan dengan koma){' '}
                          <span className="text-[#FF4B22]">*</span>
                        </label>
                        <input
                          id="placement-room-tags"
                          type="text"
                          value={tagsText}
                          onChange={(e) => setTagsText(e.target.value)}
                          placeholder="Full band rehearsal, Live tracking, Backline ready"
                          className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="placement-room-cta"
                          className="block text-xs font-semibold text-[#151515]"
                        >
                          Teks Tombol Booking <span className="text-[#FF4B22]">*</span>
                        </label>
                        <input
                          id="placement-room-cta"
                          type="text"
                          value={ctaLabel}
                          onChange={(e) => setCtaLabel(e.target.value)}
                          maxLength={LANDING_PAGE_PLACEMENT_LIMITS.ctaLabelMax}
                          className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                        />
                      </div>
                    </>
                  ) : null}

                  {/* Studio Exterior Copywriting Control */}
                  {isExterior ? (
                    <div>
                      <label
                        htmlFor="placement-exterior-caption"
                        className="block text-xs font-semibold text-[#151515]"
                      >
                        Caption Foto Lokasi (Opsional)
                      </label>
                      <input
                        id="placement-exterior-caption"
                        type="text"
                        value={exteriorCaption}
                        onChange={(e) => setExteriorCaption(e.target.value)}
                        maxLength={LANDING_PAGE_PLACEMENT_LIMITS.exteriorCaptionMax}
                        placeholder="Contoh: Tampak depan area parkir 37 Music Studio"
                        className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                      />
                    </div>
                  ) : null}

                  {/* Accessibility Description */}
                  <div>
                    <label
                      htmlFor="placement-alt-text"
                      className="block text-xs font-semibold text-[#151515]"
                    >
                      Deskripsi Foto <span className="text-[#FF4B22]">*</span>
                    </label>
                    <input
                      id="placement-alt-text"
                      type="text"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      maxLength={LANDING_PAGE_PLACEMENT_LIMITS.altTextMax}
                      placeholder="Deskripsi singkat isi foto..."
                      className="sa-control mt-1 min-h-10 w-full border-[#151515]/15 bg-white px-3 py-1.5 text-sm text-[#151515]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#151515]/10 pt-3.5">
                    <AdminButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenChange?.(false)}
                      disabled={isSaving}
                    >
                      <span>Batal</span>
                    </AdminButton>
                    <AdminButton type="submit" variant="primary" size="sm" disabled={isSaving}>
                      {isSaving ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin text-[#C8F13A]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Save className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                      )}
                      <span>{isSaving ? 'Menyimpan...' : 'Simpan ke Landing Page'}</span>
                    </AdminButton>
                  </div>
                </form>
              </div>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
