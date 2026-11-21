import { STUDIO_PROFILE_LIMITS } from '../studio-profile/config/default-studio-profile';

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
      {message}
    </p>
  );
}

export function StudioProfileForm({ register, errors = {}, readOnly = false, onFirstEdit }) {
  const inputBaseClass = readOnly
    ? 'sa-control w-full min-h-11 bg-[#F8F6EF] px-3.5 py-2.5 text-sm text-[#3E3A33] border-[#151515]/10 cursor-default focus:outline-none'
    : 'sa-control w-full min-h-11 bg-white px-3.5 py-2.5 text-sm text-[#151515] border-[#151515]/15 focus:border-[#151515] focus:outline-none';

  return (
    <div className="space-y-4 sm:space-y-5" onInput={() => onFirstEdit?.()}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="studio-profile-name"
            className="block text-xs font-semibold tracking-wide text-[#151515]"
          >
            Nama Studio <span className="text-[#FF4B22]">*</span>
          </label>
          <input
            id="studio-profile-name"
            type="text"
            readOnly={readOnly}
            maxLength={STUDIO_PROFILE_LIMITS.studioNameMax}
            placeholder="Contoh: 37 Music Studio"
            aria-invalid={Boolean(errors.studioName)}
            aria-describedby={errors.studioName ? 'studio-profile-name-error' : undefined}
            className={`${inputBaseClass} mt-1.5`}
            {...register('studioName')}
          />
          <FieldError id="studio-profile-name-error" message={errors.studioName?.message} />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="studio-profile-tagline"
            className="block text-xs font-semibold tracking-wide text-[#151515]"
          >
            Tagline
          </label>
          <input
            id="studio-profile-tagline"
            type="text"
            readOnly={readOnly}
            maxLength={STUDIO_PROFILE_LIMITS.taglineMax}
            placeholder="Contoh: Recording, Mixing, Mastering & Studio Rental"
            aria-invalid={Boolean(errors.tagline)}
            aria-describedby={errors.tagline ? 'studio-profile-tagline-error' : undefined}
            className={`${inputBaseClass} mt-1.5`}
            {...register('tagline')}
          />
          <FieldError id="studio-profile-tagline-error" message={errors.tagline?.message} />
        </div>

        <div>
          <label
            htmlFor="studio-profile-whatsapp"
            className="block text-xs font-semibold tracking-wide text-[#151515]"
          >
            Nomor WhatsApp Studio
          </label>
          <input
            id="studio-profile-whatsapp"
            type="tel"
            inputMode="tel"
            readOnly={readOnly}
            maxLength={30}
            placeholder="0812-3456-7890 atau +62812..."
            aria-invalid={Boolean(errors.whatsappNumber)}
            aria-describedby="studio-profile-whatsapp-help studio-profile-whatsapp-error"
            className={`${inputBaseClass} mt-1.5`}
            {...register('whatsappNumber')}
          />
          <p id="studio-profile-whatsapp-help" className="mt-1 text-[11px] text-[#666159]">
            Format Indonesia (contoh: 0812...) otomatis dinormalisasi ke +62 saat disimpan.
          </p>
          <FieldError id="studio-profile-whatsapp-error" message={errors.whatsappNumber?.message} />
        </div>

        <div>
          <label
            htmlFor="studio-profile-email"
            className="block text-xs font-semibold tracking-wide text-[#151515]"
          >
            Email Kontak Studio
          </label>
          <input
            id="studio-profile-email"
            type="email"
            inputMode="email"
            readOnly={readOnly}
            maxLength={STUDIO_PROFILE_LIMITS.emailMax}
            placeholder="studio@37musicstudio.id"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'studio-profile-email-error' : undefined}
            className={`${inputBaseClass} mt-1.5`}
            {...register('email')}
          />
          <FieldError id="studio-profile-email-error" message={errors.email?.message} />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="studio-profile-address"
            className="block text-xs font-semibold tracking-wide text-[#151515]"
          >
            Alamat Studio
          </label>
          <textarea
            id="studio-profile-address"
            rows={3}
            readOnly={readOnly}
            maxLength={STUDIO_PROFILE_LIMITS.addressMax}
            placeholder="Alamat lengkap jalan, nomor gedung, kelurahan/kecamatan..."
            aria-invalid={Boolean(errors.address)}
            aria-describedby={errors.address ? 'studio-profile-address-error' : undefined}
            className={`${inputBaseClass} mt-1.5 min-h-24 resize-y`}
            {...register('address')}
          />
          <FieldError id="studio-profile-address-error" message={errors.address?.message} />
        </div>

        <div>
          <label
            htmlFor="studio-profile-city"
            className="block text-xs font-semibold tracking-wide text-[#151515]"
          >
            Kota / Wilayah
          </label>
          <input
            id="studio-profile-city"
            type="text"
            readOnly={readOnly}
            maxLength={STUDIO_PROFILE_LIMITS.cityMax}
            placeholder="Contoh: Jakarta Selatan"
            aria-invalid={Boolean(errors.city)}
            aria-describedby={errors.city ? 'studio-profile-city-error' : undefined}
            className={`${inputBaseClass} mt-1.5`}
            {...register('city')}
          />
          <FieldError id="studio-profile-city-error" message={errors.city?.message} />
        </div>

        <div>
          <label
            htmlFor="studio-profile-maps-url"
            className="block text-xs font-semibold tracking-wide text-[#151515]"
          >
            URL Google Maps
          </label>
          <input
            id="studio-profile-maps-url"
            type="url"
            inputMode="url"
            readOnly={readOnly}
            maxLength={STUDIO_PROFILE_LIMITS.mapsUrlMax}
            placeholder="https://maps.google.com/?q=..."
            aria-invalid={Boolean(errors.mapsUrl)}
            aria-describedby="studio-profile-maps-help studio-profile-maps-error"
            className={`${inputBaseClass} mt-1.5`}
            {...register('mapsUrl')}
          />
          <p id="studio-profile-maps-help" className="mt-1 text-[11px] text-[#666159]">
            Opsional. Gunakan URL valid berawalan http:// atau https://.
          </p>
          <FieldError id="studio-profile-maps-error" message={errors.mapsUrl?.message} />
        </div>
      </div>
    </div>
  );
}
