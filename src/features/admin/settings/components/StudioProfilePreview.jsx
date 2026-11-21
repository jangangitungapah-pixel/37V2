import { ExternalLink, Mail, MapPin, MessageCircle, Music2 } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { isValidStudioMapsUrl } from '../studio-profile/schemas/studio-profile-schema';
import {
  formatStudioWhatsappDisplay,
  normalizeWhatsappInput,
} from '../studio-profile/utils/normalize-studio-profile';
import { formatSettingsTimestamp } from '../utils/settings-formatters';

export function StudioProfilePreview({
  values,
  version = 0,
  isPersisted = false,
  updatedAt = null,
}) {
  const studioName = values?.studioName?.trim() || '37 Music Studio';
  const tagline = values?.tagline?.trim() || '';
  const normalizedWa = normalizeWhatsappInput(values?.whatsappNumber || '');
  const whatsappDisplay = normalizedWa ? formatStudioWhatsappDisplay(normalizedWa) : '';
  const email = values?.email?.trim() || '';
  const address = values?.address?.trim() || '';
  const city = values?.city?.trim() || '';
  const mapsUrl = values?.mapsUrl?.trim() || '';
  const canLinkMaps = Boolean(mapsUrl) && isValidStudioMapsUrl(mapsUrl);

  const locationLine = [address, city].filter(Boolean).join(', ');

  return (
    <AdminSurface
      as="aside"
      variant="ivory"
      aria-labelledby="studio-profile-preview-heading"
      className="p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#151515] px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-[#F1EEE4]">
          <Music2 className="h-3 w-3 text-[#C8F13A]" aria-hidden="true" />
          <span>PRATINJAU INTERNAL</span>
        </span>
        <AdminStatusBadge tone={isPersisted ? 'lime' : 'neutral'} dot size="sm">
          {isPersisted ? `Tersimpan · v${version || 1}` : 'Default Lokal'}
        </AdminStatusBadge>
      </div>

      <div className="mt-4 rounded-xl border border-[#151515]/10 bg-white p-4">
        <h3
          id="studio-profile-preview-heading"
          className="text-lg font-bold tracking-tight wrap-break-word text-[#151515]"
        >
          {studioName}
        </h3>
        {tagline ? (
          <p className="mt-1 text-xs leading-relaxed wrap-break-word text-[#666159]">{tagline}</p>
        ) : (
          <p className="mt-1 text-xs text-[#8B857B] italic">Tagline belum diisi</p>
        )}

        <dl className="mt-4 space-y-2.5 border-t border-[#151515]/[0.08] pt-3.5 text-xs">
          <div className="flex items-start gap-2.5">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-[10.5px] font-semibold tracking-wide text-[#8B857B] uppercase">
                WhatsApp
              </dt>
              <dd className="mt-0.5 font-medium wrap-break-word text-[#151515]">
                {whatsappDisplay || 'Belum diisi'}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-[10.5px] font-semibold tracking-wide text-[#8B857B] uppercase">
                Email
              </dt>
              <dd className="mt-0.5 font-medium wrap-break-word text-[#151515]">
                {email || 'Belum diisi'}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-[10.5px] font-semibold tracking-wide text-[#8B857B] uppercase">
                Lokasi
              </dt>
              <dd className="mt-0.5 font-medium wrap-break-word text-[#151515]">
                {locationLine || 'Belum diisi'}
              </dd>
              {canLinkMaps ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF4B22] hover:underline"
                >
                  <span>Buka tautan Google Maps</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </dl>
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-[#666159]">
        <p>
          Pembaruan terakhir:{' '}
          <span className="font-semibold text-[#151515]">
            {isPersisted ? formatSettingsTimestamp(updatedAt) : 'Belum disimpan ke Firestore'}
          </span>
        </p>
        <p className="text-[#756F65]">
          Pratinjau ini hanya untuk tinjauan internal admin dan tidak mengubah halaman publik.
        </p>
      </div>
    </AdminSurface>
  );
}
