import { ArrowUpRight, Globe, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { AdminStatusBadge } from '@/features/admin/design-system';
import { CANONICAL_OPERATING_HOURS_LABEL } from '@/features/public-site-settings/config/public-site-settings-config';

export function PublicSiteSettingsForm({ value, onChange, readOnly = false, isPersisted = false }) {
  const inputBaseClass = readOnly
    ? 'sa-control w-full min-h-10 bg-[#F8F6EF] px-3 py-2 text-xs sm:text-sm text-[#3E3A33] border-[#151515]/10 cursor-default focus:outline-none'
    : 'sa-control w-full min-h-10 bg-white px-3 py-2 text-xs sm:text-sm text-[#151515] border-[#151515]/15 focus:border-[#151515] focus:outline-none';

  const updateField = (patch) => {
    if (readOnly) return;
    onChange({
      ...value,
      ...patch,
    });
  };

  const handleServiceChange = (serviceId, patch) => {
    if (readOnly) return;
    updateField({
      publishedServices: (value.publishedServices || []).map((svc) =>
        svc.id === serviceId ? { ...svc, ...patch } : svc,
      ),
    });
  };

  const handleRoomChange = (roomId, patch) => {
    if (readOnly) return;
    updateField({
      publishedRooms: (value.publishedRooms || []).map((room) =>
        room.id === roomId ? { ...room, ...patch } : room,
      ),
    });
  };

  const handleSocialChange = (socialId, url) => {
    if (readOnly) return;
    updateField({
      socialLinks: (value.socialLinks || []).map((link) =>
        link.id === socialId ? { ...link, url } : link,
      ),
    });
  };

  const handleRemoveTestimonial = (id) => {
    if (readOnly) return;
    updateField({
      verifiedTestimonials: (value.verifiedTestimonials || []).filter((item) => item.id !== id),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#151515]/10 bg-[#F8F6EF] p-3.5 text-xs text-[#46433D]">
        <div className="flex items-start gap-2.5">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[#151515]" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[#151515]">
              Proyeksi Publik (`publicSiteSettings/site`)
            </p>
            <p className="mt-0.5 leading-relaxed">
              Hanya informasi publik yang aman disinkronkan ke Landing Page. Pengaturan tarif
              internal, komisi, dan akun staff tidak pernah disalin ke dokumen ini.
            </p>
          </div>
        </div>
        <AdminStatusBadge tone={isPersisted ? 'emerald' : 'ivory'} size="sm">
          {isPersisted ? 'Publik Tersinkron' : 'Default Lokal'}
        </AdminStatusBadge>
      </div>

      {/* Operating Hours + Publication Flag */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="public-operating-hours"
            className="block text-xs font-semibold text-[#151515]"
          >
            Jam Operasional Publik
          </label>
          <input
            id="public-operating-hours"
            type="text"
            readOnly={readOnly}
            maxLength={80}
            value={value.operatingHours || ''}
            onChange={(e) => updateField({ operatingHours: e.target.value })}
            placeholder={CANONICAL_OPERATING_HOURS_LABEL}
            className={`${inputBaseClass} mt-1.5`}
          />
          <p className="mt-1 text-[11px] text-[#666159]">
            Kalender operasional &amp; `/availability` aktif pada {CANONICAL_OPERATING_HOURS_LABEL}.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#151515]/10 bg-[#FAF8F1] px-3.5 py-2.5">
          <div>
            <p className="text-xs font-semibold text-[#151515]">Status Publikasi Website</p>
            <p className="text-[11px] text-[#666159]">
              Aktifkan agar data terbaru tampil ke pengunjung publik.
            </p>
          </div>
          <input
            id="public-site-is-published"
            type="checkbox"
            aria-label="Publikasikan profil ke website publik"
            disabled={readOnly}
            checked={value.isPublished !== false}
            onChange={(e) => updateField({ isPublished: e.target.checked })}
            className="h-4.5 w-4.5 accent-[#151515]"
          />
        </div>
      </div>

      {/* Public Service Visibility & Copy */}
      <div className="space-y-2.5 border-t border-[#151515]/[0.08] pt-4">
        <div>
          <h4 className="text-xs font-bold tracking-wide text-[#151515] uppercase">
            Layanan yang Ditampilkan di Website
          </h4>
          <p className="text-[11px] text-[#666159]">
            Label harga bersifat opsional untuk publik. Fee operator/staff internal tidak pernah
            ditampilkan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(value.publishedServices || []).map((svc) => (
            <div
              key={svc.id}
              className="space-y-2 rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-[#151515] uppercase">
                  {svc.label}
                </span>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#46433D]">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={svc.isVisible !== false}
                    onChange={(e) => handleServiceChange(svc.id, { isVisible: e.target.checked })}
                    className="h-4 w-4 accent-[#151515]"
                  />
                  <span>Tampil</span>
                </label>
              </div>
              <textarea
                rows={2}
                readOnly={readOnly}
                maxLength={280}
                aria-label={`Deskripsi publik ${svc.label}`}
                value={svc.summary || ''}
                onChange={(e) => handleServiceChange(svc.id, { summary: e.target.value })}
                className={inputBaseClass}
              />
              <input
                type="text"
                readOnly={readOnly}
                maxLength={80}
                aria-label={`Label harga publik ${svc.label}`}
                value={svc.publicPriceLabel || ''}
                onChange={(e) => handleServiceChange(svc.id, { publicPriceLabel: e.target.value })}
                placeholder="Harga publik (opsional, mis. Mulai Rp 100rb/jam)"
                className={inputBaseClass}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Public Rooms */}
      <div className="space-y-2.5 border-t border-[#151515]/[0.08] pt-4">
        <h4 className="text-xs font-bold tracking-wide text-[#151515] uppercase">
          Deskripsi Terverifikasi Room A &amp; Room B
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(value.publishedRooms || []).map((room) => (
            <div
              key={room.id}
              className="space-y-2 rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3"
            >
              <input
                type="text"
                readOnly={readOnly}
                maxLength={100}
                aria-label={`Nama publik ${room.id}`}
                value={room.name || ''}
                onChange={(e) => handleRoomChange(room.id, { name: e.target.value })}
                className={inputBaseClass}
              />
              <textarea
                rows={2}
                readOnly={readOnly}
                maxLength={220}
                aria-label={`Ringkasan publik ${room.id}`}
                value={room.summary || ''}
                onChange={(e) => handleRoomChange(room.id, { summary: e.target.value })}
                className={inputBaseClass}
              />
              <input
                type="text"
                readOnly={readOnly}
                aria-label={`Tag publik ${room.id}`}
                value={(room.tags || []).join(', ')}
                onChange={(e) =>
                  handleRoomChange(room.id, {
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 6),
                  })
                }
                placeholder="Pisahkan tag dengan koma"
                className={inputBaseClass}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Social Links */}
      <div className="space-y-2.5 border-t border-[#151515]/[0.08] pt-4">
        <h4 className="text-xs font-bold tracking-wide text-[#151515] uppercase">
          Tautan Media Sosial Resmi
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(value.socialLinks || []).map((social) => (
            <div key={social.id}>
              <label
                htmlFor={`public-social-${social.id}`}
                className="block text-[11px] font-semibold text-[#151515]"
              >
                URL {social.label}
              </label>
              <input
                id={`public-social-${social.id}`}
                type="url"
                readOnly={readOnly}
                maxLength={300}
                value={social.url || ''}
                onChange={(e) => handleSocialChange(social.id, e.target.value)}
                placeholder={`https://... (kosongkan jika belum ada)`}
                className={`${inputBaseClass} mt-1`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Legacy Verified Testimonials (Deprecated — Replaced by Customer Review Management) */}
      <div
        data-testid="legacy-testimonials-deprecated"
        className="space-y-2.5 border-t border-[#151515]/[0.08] pt-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold tracking-wide text-[#151515] uppercase">
              Testimoni Manual Lama (Dihentikan • Arsip {(value.verifiedTestimonials || []).length})
            </h4>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#666159]">
              Penambahan testimoni manual dinonaktifkan. Ulasan pelanggan publik kini dikelola dari
              undangan sesi Completed melalui halaman moderasi Customer Reviews.
            </p>
          </div>
          <Link
            to="/admin/reviews"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#151515]/15 bg-[#F8F6EF] px-3 py-1.5 text-[11px] font-semibold text-[#151515] hover:border-[#151515]"
          >
            <span>Kelola Customer Reviews</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {(value.verifiedTestimonials || []).length > 0 ? (
          <ul className="space-y-2">
            {value.verifiedTestimonials.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#151515]">
                    {item.author} <span className="font-normal text-[#666159]">· {item.role}</span>
                  </p>
                  <p className="mt-0.5 text-[#46433D]">“{item.quote}”</p>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    aria-label={`Hapus testimoni lama ${item.author}`}
                    onClick={() => handleRemoveTestimonial(item.id)}
                    className="inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-lg text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* SEO Title & Description */}
      <div className="grid grid-cols-1 gap-3 border-t border-[#151515]/[0.08] pt-4">
        <div>
          <label htmlFor="public-seo-title" className="block text-xs font-semibold text-[#151515]">
            SEO Page Title
          </label>
          <input
            id="public-seo-title"
            type="text"
            readOnly={readOnly}
            maxLength={120}
            value={value.seoTitle || ''}
            onChange={(e) => updateField({ seoTitle: e.target.value })}
            className={`${inputBaseClass} mt-1`}
          />
        </div>
        <div>
          <label
            htmlFor="public-seo-description"
            className="block text-xs font-semibold text-[#151515]"
          >
            SEO Meta Description
          </label>
          <textarea
            id="public-seo-description"
            rows={2}
            readOnly={readOnly}
            maxLength={260}
            value={value.seoDescription || ''}
            onChange={(e) => updateField({ seoDescription: e.target.value })}
            className={`${inputBaseClass} mt-1`}
          />
        </div>
      </div>
    </div>
  );
}
