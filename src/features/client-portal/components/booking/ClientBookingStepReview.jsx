import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Loader2,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import {
  formatDurationMinutes,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { PUBLIC_ROOM_LABELS } from '@/features/admin/booking-requests/config/booking-request-config';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

export function ClientBookingStepReview({
  selectedService,
  selectedOption,
  flowType = 'studio',
  preferredDate,
  requestedRoomId,
  durationMinutes,
  selectedStartMinute,
  projectDetails,
  contactForm,
  pricingEstimate,
  privacyConsent = false,
  honeypotValue = '',
  isSubmitting = false,
  submitError = '',
  onChangeContactField,
  onChangePrivacyConsent,
  onChangeHoneypot,
  onBack,
  onSubmit,
}) {
  const isWfa = flowType === 'wfa';
  const roomLabel = PUBLIC_ROOM_LABELS[requestedRoomId] || 'No preference / Studio recommends';
  const timeRangeLabel =
    !isWfa && Number.isInteger(selectedStartMinute)
      ? formatMinuteRange(selectedStartMinute, durationMinutes)
      : '-';

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      data-testid="client-booking-step-review"
      className="space-y-4"
    >
      <AdminSurface variant="card" className="space-y-5 p-4 sm:p-6">
        <div className="border-b border-[#151515]/[0.08] pb-3.5">
          <h2 className="text-base font-bold text-[#151515] sm:text-lg">
            3. Review &amp; Send {isWfa ? 'Inquiry' : 'Booking Request'}
          </h2>
          <p className="mt-0.5 text-xs text-[#666159]">
            Check your summary and contact number before sending to the 37 Music Studio team.
          </p>
        </div>

        {/* Hidden honeypot */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="client-booking-website-hp">Company website</label>
          <input
            id="client-booking-website-hp"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypotValue}
            onChange={(e) => onChangeHoneypot(e.target.value)}
          />
        </div>

        {/* Summary & Tentative Price Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="sa-panel-ivory space-y-3 rounded-2xl p-4 lg:col-span-7">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-[#666159] uppercase">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isWfa ? 'Project Inquiry Summary' : 'Requested Studio Session'}</span>
            </div>

            <div className="space-y-2 text-xs text-[#46433D] sm:text-sm">
              <div className="flex items-baseline justify-between gap-2 border-b border-[#151515]/[0.06] pb-1.5">
                <span className="text-[#666159]">Service</span>
                <span className="text-right font-bold text-[#151515]">
                  {selectedService?.name} · {selectedOption?.name}
                </span>
              </div>

              {!isWfa ? (
                <>
                  <div className="flex items-baseline justify-between gap-2 border-b border-[#151515]/[0.06] pb-1.5">
                    <span className="text-[#666159]">Room Preference</span>
                    <span className="text-right font-semibold text-[#151515]">{roomLabel}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 border-b border-[#151515]/[0.06] pb-1.5">
                    <span className="text-[#666159]">Date</span>
                    <span className="font-mono font-semibold text-[#151515]">{preferredDate}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 border-b border-[#151515]/[0.06] pb-1.5">
                    <span className="text-[#666159]">Time Window</span>
                    <span className="font-mono font-semibold text-[#151515]">
                      {timeRangeLabel} WIB
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[#666159]">Duration</span>
                    <span className="font-semibold text-[#151515]">
                      {formatDurationMinutes(durationMinutes)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {projectDetails?.bandName ? (
                    <div className="flex items-baseline justify-between gap-2 border-b border-[#151515]/[0.06] pb-1.5">
                      <span className="text-[#666159]">Project / Artist</span>
                      <span className="text-right font-semibold text-[#151515]">
                        {projectDetails.bandName}
                      </span>
                    </div>
                  ) : null}
                  {projectDetails?.projectType ? (
                    <div className="flex items-baseline justify-between gap-2 border-b border-[#151515]/[0.06] pb-1.5">
                      <span className="text-[#666159]">Project Type</span>
                      <span className="font-semibold text-[#151515] uppercase">
                        {projectDetails.projectType}
                      </span>
                    </div>
                  ) : null}
                  {projectDetails?.trackCount ? (
                    <div className="flex items-baseline justify-between gap-2 border-b border-[#151515]/[0.06] pb-1.5">
                      <span className="text-[#666159]">Track Count</span>
                      <span className="font-mono font-semibold text-[#151515]">
                        {projectDetails.trackCount}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[#666159]">Target Deadline</span>
                    <span className="font-mono font-semibold text-[#151515]">
                      {projectDetails?.targetDeadline || 'Flexible'}
                    </span>
                  </div>
                  {projectDetails?.projectBrief ? (
                    <p className="rounded-xl border border-[#151515]/[0.08] bg-white p-2.5 text-xs whitespace-pre-wrap text-[#46433D]">
                      {projectDetails.projectBrief}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div
            data-testid="client-booking-price-summary"
            className="flex flex-col justify-between rounded-2xl border border-[#151515]/12 bg-white p-4 lg:col-span-5"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold tracking-wider text-[#666159] uppercase">
                  Price Estimate
                </span>
                <AdminStatusBadge tone="amber" size="sm">
                  Tentative
                </AdminStatusBadge>
              </div>

              {pricingEstimate?.isManualQuote || pricingEstimate?.estimatedTotal === null ? (
                <div className="space-y-1.5 py-2">
                  <p className="text-lg font-bold text-[#151515]">Custom Quote</p>
                  <p className="text-xs leading-relaxed text-[#666159]">
                    This option is quoted individually after the studio team reviews your scope via
                    WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {pricingEstimate?.extensionAmount > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-[#46433D]">
                        <span>
                          Base package (
                          {Math.round((pricingEstimate.baseDurationMinutes || 60) / 60)}h)
                        </span>
                        <span className="font-mono font-semibold text-[#151515]">
                          {formatRupiah(pricingEstimate.basePrice)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#46433D]">
                        <span>
                          Extension ({pricingEstimate.extensionHours}h ×{' '}
                          {formatRupiah(pricingEstimate.extensionHourlyRate)}/h)
                        </span>
                        <span className="font-mono font-semibold text-[#151515]">
                          {formatRupiah(pricingEstimate.extensionAmount)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between text-[#46433D]">
                      <span>Subtotal</span>
                      <span className="font-mono font-semibold text-[#151515]">
                        {formatRupiah(pricingEstimate?.subtotal || 0)}
                      </span>
                    </div>
                  )}

                  {pricingEstimate?.discountAmount > 0 ? (
                    <div className="flex items-center justify-between text-[#0F6246]">
                      <span>{pricingEstimate.appliedDiscountName || 'Discount'}</span>
                      <span className="font-mono font-semibold">
                        −{formatRupiah(pricingEstimate.discountAmount)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-baseline justify-between border-t border-[#151515]/10 pt-2.5">
                    <span className="font-bold text-[#151515]">Estimated Total</span>
                    <span className="font-mono text-lg font-extrabold text-[#151515]">
                      {formatRupiah(pricingEstimate?.estimatedTotal ?? 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-3 rounded-lg bg-[#FAF8F1] px-2.5 py-2 text-[11px] leading-relaxed text-[#666159]">
              Estimate only — not a final invoice. No online payment is taken here.
            </p>
          </div>
        </div>

        {/* Contact Details (Prefilled from Client Profile) */}
        <div className="space-y-4 border-t border-[#151515]/[0.08] pt-4">
          <div className="flex items-center gap-1.5">
            <UserRound className="h-4 w-4 text-[#151515]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#151515]">Contact Information</h3>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="client-review-name"
                className="block text-xs font-semibold text-[#151515]"
              >
                Your Name <span className="text-[#FF4B22]">*</span>
              </label>
              <input
                id="client-review-name"
                type="text"
                required
                maxLength={100}
                value={contactForm.customerName}
                onChange={(e) => onChangeContactField('customerName', e.target.value)}
                className="sa-input mt-1.5 min-h-10.5 w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="client-review-phone"
                className="block text-xs font-semibold text-[#151515]"
              >
                WhatsApp / Phone Number <span className="text-[#FF4B22]">*</span>
              </label>
              <input
                id="client-review-phone"
                type="tel"
                required
                placeholder="0812xxxxxxxx"
                value={contactForm.contactPhone}
                onChange={(e) => onChangeContactField('contactPhone', e.target.value)}
                className="sa-input mt-1.5 min-h-10.5 w-full rounded-xl px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          {!isWfa ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="client-review-band-name"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Band / Artist Name <span className="font-normal text-[#666159]">(Optional)</span>
                </label>
                <input
                  id="client-review-band-name"
                  type="text"
                  maxLength={100}
                  placeholder="e.g.Midnight Echo"
                  value={contactForm.bandName}
                  onChange={(e) => onChangeContactField('bandName', e.target.value)}
                  className="sa-input mt-1.5 min-h-10.5 w-full rounded-xl px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="client-review-notes"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Notes for Studio Crew{' '}
                  <span className="font-normal text-[#666159]">(Optional)</span>
                </label>
                <input
                  id="client-review-notes"
                  type="text"
                  maxLength={600}
                  placeholder="Gear setup, mic needs, or extra request..."
                  value={contactForm.notes}
                  onChange={(e) => onChangeContactField('notes', e.target.value)}
                  className="sa-input mt-1.5 min-h-10.5 w-full rounded-xl px-3.5 py-2 text-sm"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Honest Tentative Disclaimer + Consent */}
        <div className="space-y-3 rounded-2xl border border-[#151515]/10 bg-[#FAF8F1] p-4">
          <div className="flex items-start gap-2.5 text-xs leading-relaxed text-[#46433D]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0F6246]" aria-hidden="true" />
            <span>
              Submitting this form creates a <strong>tentative request</strong> only — your room or
              slot is not reserved until verified and confirmed by 37 Music Studio staff.
            </span>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs text-[#151515]">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => onChangePrivacyConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#151515]"
            />
            <span className="leading-relaxed">
              I agree to let 37 Music Studio use my contact details and request information to
              review availability and follow up via WhatsApp.
            </span>
          </label>
        </div>

        {submitError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-xs font-medium text-[#B92B0C]"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2.5 border-t border-[#151515]/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onBack}
            className="sa-btn-secondary inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-2 px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            data-testid="client-booking-submit-btn"
            className="sa-btn-primary inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-6 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {isSubmitting
                ? 'Sending Request...'
                : isWfa
                  ? 'Send Project Inquiry'
                  : 'Send Booking Request'}
            </span>
          </button>
        </div>
      </AdminSurface>
    </form>
  );
}
