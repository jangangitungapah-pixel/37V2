import { ArrowLeft, ArrowRight, FileText, SlidersHorizontal } from 'lucide-react';

import { PRICING_MODES } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';

import {
  MAX_COMPOSITE_NOTES_LENGTH,
  PROJECT_TYPE_OPTIONS,
  buildProjectMetadataPrefix,
} from '../../utils/client-booking-notes';

export function ClientBookingStepProjectDetails({
  selectedService,
  selectedOption,
  pricingEstimate,
  draft,
  todayIso,
  onChangeDraft,
  onBack,
  onContinue,
}) {
  const metadataPrefix = buildProjectMetadataPrefix({
    projectType: draft.projectType,
    trackCount: draft.trackCount,
  });
  const separatorLen = metadataPrefix ? 1 : 0;
  const maxBriefLength = Math.max(
    200,
    MAX_COMPOSITE_NOTES_LENGTH - metadataPrefix.length - separatorLen,
  );
  const currentBrief = String(draft.projectBrief || '');
  const trimmedBriefLen = currentBrief.trim().length;
  const deadlineError =
    draft.targetDeadline && draft.targetDeadline < todayIso
      ? 'Target deadline cannot be in the past.'
      : '';

  const pricingMode = pricingEstimate?.pricingMode || selectedOption?.pricing?.mode;

  return (
    <div data-testid="client-booking-step-project-details" className="space-y-4">
      <AdminSurface variant="card" className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#151515]/[0.08] pb-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#151515] text-[#C8F13A]">
              <SlidersHorizontal className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#151515] sm:text-lg">
                  2. Project Details
                </h2>
                <AdminStatusBadge tone="ink" size="sm">
                  {selectedService?.name} · {selectedOption?.name}
                </AdminStatusBadge>
              </div>
              <p className="mt-0.5 text-xs text-[#666159]">
                Mix &amp; Master works remotely (work-from-anywhere) — no studio room or calendar
                slot needed. Tell us your project scope and timeline.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F1] px-3.5 py-2 text-right">
            <span className="block font-mono text-[10px] font-bold tracking-wider text-[#666159] uppercase">
              Service Pricing
            </span>
            {pricingMode === PRICING_MODES.MANUAL_QUOTE || pricingEstimate?.isManualQuote ? (
              <span className="mt-0.5 block text-sm font-bold text-[#151515]">Custom Quote</span>
            ) : pricingEstimate?.estimatedTotal !== null &&
              pricingEstimate?.estimatedTotal !== undefined ? (
              <span className="mt-0.5 block font-mono text-sm font-bold text-[#151515]">
                {formatRupiah(pricingEstimate.estimatedTotal)}
                {pricingEstimate.unitLabel ? ` ${pricingEstimate.unitLabel}` : ''}
              </span>
            ) : (
              <span className="mt-0.5 block text-sm font-bold text-[#151515]">Custom Quote</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="client-project-band-name"
              className="block text-xs font-semibold text-[#151515]"
            >
              Project / Artist Name <span className="font-normal text-[#666159]">(Optional)</span>
            </label>
            <input
              id="client-project-band-name"
              type="text"
              maxLength={100}
              placeholder="e.g. Midnight Echo — Single Mix"
              value={draft.bandName}
              onChange={(e) => onChangeDraft('bandName', e.target.value)}
              className="sa-input mt-1.5 min-h-10.5 w-full rounded-xl px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="client-project-deadline"
              className="block text-xs font-semibold text-[#151515]"
            >
              Target Deadline <span className="font-normal text-[#666159]">(Optional)</span>
            </label>
            <input
              id="client-project-deadline"
              type="date"
              min={todayIso}
              value={draft.targetDeadline}
              onChange={(e) => onChangeDraft('targetDeadline', e.target.value)}
              className="sa-input mt-1.5 min-h-10.5 w-full rounded-xl px-3.5 py-2 text-sm"
            />
            {deadlineError ? (
              <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                {deadlineError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="block text-xs font-semibold text-[#151515]">
              Project Type <span className="font-normal text-[#666159]">(Optional)</span>
            </span>
            <div role="group" aria-label="Project type" className="mt-1.5 flex flex-wrap gap-2">
              {PROJECT_TYPE_OPTIONS.map((typeOption) => {
                const isSelected = draft.projectType === typeOption.id;
                return (
                  <button
                    key={typeOption.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onChangeDraft('projectType', isSelected ? '' : typeOption.id)}
                    className={`min-h-9 cursor-pointer rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-[#151515] bg-[#151515] text-white'
                        : 'border-[#151515]/12 bg-[#FAF8F1] text-[#151515] hover:bg-white'
                    }`}
                  >
                    {typeOption.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="client-project-track-count"
              className="block text-xs font-semibold text-[#151515]"
            >
              Track Count <span className="font-normal text-[#666159]">(Optional)</span>
            </label>
            <input
              id="client-project-track-count"
              type="number"
              min="1"
              max="50"
              placeholder="e.g. 1"
              value={draft.trackCount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                onChangeDraft('trackCount', val ? String(Math.min(50, Number(val))) : '');
              }}
              className="sa-input mt-1.5 min-h-10.5 w-full rounded-xl px-3.5 py-2 text-sm sm:max-w-[180px]"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="client-project-brief"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#151515]"
            >
              <FileText className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
              <span>Project Brief / References</span>
              <span className="font-normal text-[#666159]">(Optional)</span>
            </label>
            <span className="font-mono text-[11px] text-[#666159]">
              {trimmedBriefLen}/{maxBriefLength}
            </span>
          </div>
          <textarea
            id="client-project-brief"
            rows={4}
            maxLength={maxBriefLength}
            placeholder="Share track style, reference links, stem details, or revision expectations..."
            value={currentBrief}
            onChange={(e) => onChangeDraft('projectBrief', e.target.value.slice(0, maxBriefLength))}
            className="sa-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
          />
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-[#151515]/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="sa-btn-secondary inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          <button
            type="button"
            disabled={Boolean(deadlineError)}
            onClick={onContinue}
            className="sa-btn-primary inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <span>Continue to Review</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </AdminSurface>
    </div>
  );
}
