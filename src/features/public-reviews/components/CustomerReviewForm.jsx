import { useState } from 'react';
import { CalendarDays, DoorOpen, Loader2, Music2, ShieldCheck, Star } from 'lucide-react';

import {
  CUSTOMER_REVIEW_CONSENT_LABEL,
  CUSTOMER_REVIEW_LIMITS,
  CUSTOMER_REVIEW_MODERATION_NOTICE,
} from '@/features/customer-reviews/config/customer-review-config';

import { formatPublicInvitationContext } from '../services/public-review-service';

export function CustomerReviewForm({
  invitation,
  isSubmitting = false,
  submitError = '',
  onSubmit,
}) {
  const [displayName, setDisplayName] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [consentToPublish, setConsentToPublish] = useState(false);
  const [honeypotValue, setHoneypotValue] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const context = formatPublicInvitationContext(invitation);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const nextErrors = {};
    const trimmedName = displayName.trim();
    const trimmedText = reviewText.trim();

    if (trimmedName.length < CUSTOMER_REVIEW_LIMITS.displayNameMin) {
      nextErrors.displayName = `Nama tampilan minimal ${CUSTOMER_REVIEW_LIMITS.displayNameMin} karakter.`;
    } else if (trimmedName.length > CUSTOMER_REVIEW_LIMITS.displayNameMax) {
      nextErrors.displayName = `Nama tampilan maksimal ${CUSTOMER_REVIEW_LIMITS.displayNameMax} karakter.`;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      nextErrors.rating = 'Pilih rating bintang 1 sampai 5.';
    }

    if (trimmedText.length < CUSTOMER_REVIEW_LIMITS.reviewTextMin) {
      nextErrors.reviewText = `Ulasan minimal ${CUSTOMER_REVIEW_LIMITS.reviewTextMin} karakter.`;
    } else if (trimmedText.length > CUSTOMER_REVIEW_LIMITS.reviewTextMax) {
      nextErrors.reviewText = `Ulasan maksimal ${CUSTOMER_REVIEW_LIMITS.reviewTextMax} karakter.`;
    }

    if (!consentToPublish) {
      nextErrors.consentToPublish =
        'Anda wajib menyetujui publikasi ulasan sebelum mengirim formulir.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    await onSubmit?.({
      formValues: {
        displayName: trimmedName,
        rating,
        reviewText: trimmedText,
        consentToPublish,
      },
      honeypotValue,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      data-testid="public-customer-review-form"
      className="brutal-card bg-studio-white text-studio-ink space-y-6 p-5 sm:p-8"
    >
      {/* Safe Limited Session Context */}
      {context ? (
        <div
          data-testid="public-review-session-context"
          className="border-studio-ink bg-studio-ivory border-2 p-4"
        >
          <p className="text-studio-muted-ink font-mono text-[10px] font-extrabold tracking-wider uppercase">
            Booking Session Verified By Invitation
          </p>
          <div className="mt-2.5 flex flex-wrap gap-3 text-xs font-bold">
            <span className="border-studio-ink bg-studio-white inline-flex items-center gap-1.5 border px-2.5 py-1">
              <Music2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{context.serviceLabel}</span>
            </span>
            {context.roomLabel ? (
              <span className="border-studio-ink bg-studio-white inline-flex items-center gap-1.5 border px-2.5 py-1">
                <DoorOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{context.roomLabel}</span>
              </span>
            ) : null}
            {context.sessionDateLabel ? (
              <span className="border-studio-ink bg-studio-white inline-flex items-center gap-1.5 border px-2.5 py-1">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{context.sessionDateLabel}</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Low-cost bot honeypot */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="review-website-field">Website</label>
        <input
          id="review-website-field"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypotValue}
          onChange={(e) => setHoneypotValue(e.target.value)}
        />
      </div>

      {/* 1. Display Name */}
      <div>
        <label
          htmlFor="review-display-name"
          className="block font-mono text-xs font-extrabold tracking-wide uppercase"
        >
          Nama Tampilan Publik <span className="text-studio-error-ink">*</span>
        </label>
        <p className="text-studio-muted-ink mt-1 text-xs">
          Nama band, artis, atau nama panggilan yang ingin ditampilkan bersama ulasan Anda.
        </p>
        <input
          id="review-display-name"
          type="text"
          required
          minLength={CUSTOMER_REVIEW_LIMITS.displayNameMin}
          maxLength={CUSTOMER_REVIEW_LIMITS.displayNameMax}
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (fieldErrors.displayName) {
              setFieldErrors((prev) => ({ ...prev, displayName: '' }));
            }
          }}
          disabled={isSubmitting}
          placeholder="Contoh: Raka — Midnight Static"
          className="border-studio-ink bg-studio-white focus:border-studio-orange mt-2 min-h-12 w-full border-2 px-3.5 py-2.5 text-sm font-medium outline-none"
        />
        {fieldErrors.displayName ? (
          <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-semibold">
            {fieldErrors.displayName}
          </p>
        ) : null}
      </div>

      {/* 2. Star Rating */}
      <div>
        <span className="block font-mono text-xs font-extrabold tracking-wide uppercase">
          Rating Pengalaman Studio <span className="text-studio-error-ink">*</span>
        </span>
        <div
          role="group"
          aria-label="Pilih rating bintang"
          className="mt-2.5 flex flex-wrap items-center gap-2"
        >
          {[1, 2, 3, 4, 5].map((starValue) => {
            const isSelected = rating === starValue;
            const isActive = starValue <= rating;
            const ariaLabel = starValue === 1 ? '1 star' : `${starValue} stars`;

            return (
              <button
                key={starValue}
                type="button"
                aria-label={ariaLabel}
                aria-pressed={isSelected}
                disabled={isSubmitting}
                onClick={() => {
                  setRating(starValue);
                  if (fieldErrors.rating) {
                    setFieldErrors((prev) => ({ ...prev, rating: '' }));
                  }
                }}
                className={`border-studio-ink inline-flex h-12 min-w-12 cursor-pointer items-center justify-center gap-1 border-2 px-3 transition-colors disabled:opacity-50 ${
                  isActive
                    ? 'bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                    : 'bg-studio-ivory text-studio-muted-ink hover:bg-studio-white'
                }`}
              >
                <Star
                  className={`h-5 w-5 ${isActive ? 'text-studio-ink fill-current' : ''}`}
                  aria-hidden="true"
                />
                <span className="font-mono text-xs font-extrabold">{starValue}</span>
              </button>
            );
          })}
        </div>
        {fieldErrors.rating ? (
          <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-semibold">
            {fieldErrors.rating}
          </p>
        ) : null}
      </div>

      {/* 3. Written Review */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="review-text"
            className="block font-mono text-xs font-extrabold tracking-wide uppercase"
          >
            Ulasan Tertulis <span className="text-studio-error-ink">*</span>
          </label>
          <span
            data-testid="review-text-counter"
            className="text-studio-muted-ink font-mono text-[11px] font-bold"
          >
            {reviewText.trim().length} / {CUSTOMER_REVIEW_LIMITS.reviewTextMax}
          </span>
        </div>
        <textarea
          id="review-text"
          rows={5}
          required
          minLength={CUSTOMER_REVIEW_LIMITS.reviewTextMin}
          maxLength={CUSTOMER_REVIEW_LIMITS.reviewTextMax}
          value={reviewText}
          onChange={(e) => {
            setReviewText(e.target.value);
            if (fieldErrors.reviewText) {
              setFieldErrors((prev) => ({ ...prev, reviewText: '' }));
            }
          }}
          disabled={isSubmitting}
          placeholder="Ceritakan pengalaman sesi rehearsal atau rekaman Anda (minimal 10 karakter)..."
          className="border-studio-ink bg-studio-white focus:border-studio-orange mt-2 w-full border-2 p-3.5 text-sm leading-relaxed font-medium outline-none"
        />
        {fieldErrors.reviewText ? (
          <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-semibold">
            {fieldErrors.reviewText}
          </p>
        ) : null}
      </div>

      {/* 4. Mandatory Publication Consent */}
      <div className="border-studio-ink bg-studio-ivory border-2 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            id="review-publish-consent"
            type="checkbox"
            checked={consentToPublish}
            onChange={(e) => {
              setConsentToPublish(e.target.checked);
              if (fieldErrors.consentToPublish) {
                setFieldErrors((prev) => ({ ...prev, consentToPublish: '' }));
              }
            }}
            disabled={isSubmitting}
            className="accent-studio-ink mt-0.5 h-5 w-5 shrink-0"
          />
          <span className="text-studio-ink text-xs leading-relaxed font-semibold sm:text-sm">
            {CUSTOMER_REVIEW_CONSENT_LABEL}
          </span>
        </label>

        {fieldErrors.consentToPublish ? (
          <p role="alert" className="text-studio-error-ink mt-2 text-xs font-semibold">
            {fieldErrors.consentToPublish}
          </p>
        ) : null}

        <div className="border-studio-ink/15 text-studio-muted-ink mt-3 flex items-start gap-2 border-t pt-3 text-xs leading-relaxed">
          <ShieldCheck className="text-studio-ink mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{CUSTOMER_REVIEW_MODERATION_NOTICE}</span>
        </div>
      </div>

      {submitError ? (
        <div
          role="alert"
          data-testid="public-review-submit-error"
          className="border-studio-ink border-2 bg-[#FFEDE8] px-4 py-3 text-xs font-semibold text-[#B92B0C] sm:text-sm"
        >
          {submitError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-6 py-3 font-mono text-xs font-extrabold tracking-wider uppercase disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Mengirim Ulasan...</span>
          </>
        ) : (
          <span>Kirim Ulasan Studio</span>
        )}
      </button>
    </form>
  );
}
