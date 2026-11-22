import { ArrowRight, AudioLines, Check, Mic2, SlidersHorizontal, Sparkles } from 'lucide-react';

import {
  DISCOUNT_RULE_MODES,
  PRICING_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import {
  findServiceExtensionHourlyRate,
  formatRupiah,
} from '@/features/admin/calendar/utils/booking-pricing';

function getServiceIcon(serviceId = '', deliveryMode = 'studio') {
  if (deliveryMode === 'wfa' || serviceId.includes('mix') || serviceId.includes('master')) {
    return SlidersHorizontal;
  }
  if (serviceId.includes('rec')) {
    return Mic2;
  }
  return AudioLines;
}

function getDiscountHint(option) {
  const rules = Array.isArray(option?.discountRules) ? option.discountRules : [];
  if (rules.length === 0) return '';
  const first = rules[0];
  if (first.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK && first.intervalMinutes > 0) {
    const hrs = Math.round(first.intervalMinutes / 60);
    return `Auto discount ${formatRupiah(first.discountAmount)} per ${hrs}h`;
  }
  if (first.mode === DISCOUNT_RULE_MODES.MINIMUM_DURATION && first.minimumDurationMinutes > 0) {
    const hrs = Math.round(first.minimumDurationMinutes / 60);
    return `Save ${formatRupiah(first.discountAmount)} on ${hrs}h+ sessions`;
  }
  return '';
}

function OptionPriceBadge({ option, canExtendFixedShift }) {
  const mode = option?.pricing?.mode;

  if (mode === PRICING_MODES.HOURLY) {
    return (
      <div className="text-right">
        <span className="font-mono text-sm font-bold text-[#151515]">
          {formatRupiah(option.pricing.hourlyRate)}
        </span>
        <span className="block font-mono text-[10px] text-[#666159] uppercase">/ hour</span>
      </div>
    );
  }

  if (mode === PRICING_MODES.FIXED_SHIFT) {
    const basePrice = Number(option.pricing.basePrice) || 0;
    const discountAmount = Math.min(basePrice, Number(option.pricing.discountAmount) || 0);
    const finalPrice = Math.max(0, basePrice - discountAmount);
    const hours = Math.max(1, Math.round((Number(option.pricing.durationMinutes) || 60) / 60));

    return (
      <div className="text-right">
        <div className="flex items-baseline justify-end gap-1.5">
          {discountAmount > 0 ? (
            <span className="font-mono text-[11px] text-[#666159] line-through">
              {formatRupiah(basePrice)}
            </span>
          ) : null}
          <span className="font-mono text-sm font-bold text-[#151515]">
            {formatRupiah(finalPrice)}
          </span>
        </div>
        <span className="block font-mono text-[10px] text-[#666159] uppercase">
          {hours}h package{canExtendFixedShift ? ' · extendable' : ''}
        </span>
      </div>
    );
  }

  if (mode === PRICING_MODES.FIXED_PROJECT) {
    return (
      <div className="text-right">
        <span className="font-mono text-sm font-bold text-[#151515]">
          {formatRupiah(option.pricing.projectPrice)}
        </span>
        <span className="block font-mono text-[10px] text-[#666159] uppercase">
          {option.pricing.unitLabel || '/ project'}
        </span>
      </div>
    );
  }

  return (
    <AdminStatusBadge tone="ink" size="sm">
      Custom Quote
    </AdminStatusBadge>
  );
}

function ServiceCategoryGroup({ title, subtitle, services, selectedServiceId, onSelectService }) {
  if (!services || services.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="px-0.5">
        <h3 className="text-xs font-semibold tracking-wider text-[#666159] uppercase">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-[#666159]">{subtitle}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => {
          const isSelected = svc.id === selectedServiceId;
          const ServiceIcon = getServiceIcon(svc.id, svc.deliveryMode);
          const isWfa = svc.deliveryMode === 'wfa';

          return (
            <button
              key={svc.id}
              type="button"
              data-testid={`client-service-card-${svc.id}`}
              aria-pressed={isSelected}
              onClick={() => onSelectService(svc.id)}
              className={`flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-[#151515] bg-[#151515] text-white shadow-sm'
                  : 'border-[#151515]/10 bg-white text-[#151515] hover:border-[#151515]/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isSelected
                      ? 'bg-[#C8F13A] text-[#151515]'
                      : isWfa
                        ? 'bg-[#F4F1E8] text-[#46433D]'
                        : 'bg-[#EDF8C2] text-[#243300]'
                  }`}
                >
                  <ServiceIcon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>

                <AdminStatusBadge tone={isSelected ? 'lime' : isWfa ? 'ink' : 'ivory'} size="sm">
                  {isWfa ? 'Remote · Inquiry' : 'Studio Room'}
                </AdminStatusBadge>
              </div>

              <div>
                <h4 className="text-sm font-bold sm:text-base">{svc.name}</h4>
                {svc.description ? (
                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      isSelected ? 'text-neutral-300' : 'text-[#666159]'
                    }`}
                  >
                    {svc.description}
                  </p>
                ) : null}
                <p
                  className={`mt-2 font-mono text-[11px] font-semibold ${
                    isSelected ? 'text-[#C8F13A]' : 'text-[#46433D]'
                  }`}
                >
                  {svc.options?.length || 0} package{(svc.options?.length || 0) === 1 ? '' : 's'}{' '}
                  available
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ClientBookingStepSelectSession({
  studioServiceTypes = [],
  wfaServiceTypes = [],
  selectedService = null,
  selectedOption = null,
  onSelectService,
  onSelectOption,
  onContinue,
}) {
  const canExtendFixedShift =
    selectedService && findServiceExtensionHourlyRate(selectedService) > 0;
  const activeOptions = selectedService?.options || [];

  return (
    <div data-testid="client-booking-step-select-session" className="space-y-4">
      <AdminSurface variant="card" className="space-y-6 p-4 sm:p-6">
        <div className="border-b border-[#151515]/[0.08] pb-3.5">
          <h2 className="text-base font-bold text-[#151515] sm:text-lg">
            1. Choose a Service &amp; Package
          </h2>
          <p className="mt-0.5 text-xs text-[#666159]">
            Pick either an on-site Studio Room session or a remote Mix &amp; Master project inquiry.
          </p>
        </div>

        <ServiceCategoryGroup
          title="Studio Sessions (Room A & Room B)"
          subtitle="Pick your session type to view studio availability."
          services={studioServiceTypes}
          selectedServiceId={selectedService?.id || ''}
          onSelectService={onSelectService}
        />

        <ServiceCategoryGroup
          title="Post-Production · Mix & Master"
          subtitle="Remote workflow — submit your project brief and deadline directly."
          services={wfaServiceTypes}
          selectedServiceId={selectedService?.id || ''}
          onSelectService={onSelectService}
        />

        {selectedService ? (
          <div className="space-y-3 border-t border-[#151515]/[0.08] pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#151515]">
                  Packages for {selectedService.name}
                </h3>
                <p className="text-xs text-[#666159]">
                  Select one option to continue to the next step.
                </p>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label={`Packages for ${selectedService.name}`}
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
              {activeOptions.map((option) => {
                const isSelected = option.id === selectedOption?.id;
                const discountHint = getDiscountHint(option);

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`client-option-card-${option.id}`}
                    onClick={() => onSelectOption(option.id)}
                    className={`flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-[#8BAD12]/70 bg-[#EDF8C2]/65 ring-2 ring-[#151515]'
                        : 'border-[#151515]/12 bg-[#FAF8F1] hover:border-[#151515]/30 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              isSelected
                                ? 'border-[#151515] bg-[#151515] text-[#C8F13A]'
                                : 'border-[#151515]/25 bg-white'
                            }`}
                          >
                            {isSelected ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                          </span>
                          <span className="truncate text-sm font-bold text-[#151515]">
                            {option.name}
                          </span>
                        </div>
                        {option.description ? (
                          <p className="mt-1.5 pl-7 text-xs leading-relaxed text-[#46433D]">
                            {option.description}
                          </p>
                        ) : null}
                      </div>

                      <OptionPriceBadge
                        option={option}
                        canExtendFixedShift={Boolean(canExtendFixedShift)}
                      />
                    </div>

                    {discountHint ? (
                      <div className="pl-7">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#151515]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#243300]">
                          <Sparkles className="h-3 w-3 text-[#4F6800]" aria-hidden="true" />
                          <span>{discountHint}</span>
                        </span>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end border-t border-[#151515]/[0.08] pt-4">
          <button
            type="button"
            disabled={!selectedService || !selectedOption}
            onClick={onContinue}
            className="sa-btn-primary inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <span>
              {selectedService?.deliveryMode === 'wfa'
                ? 'Continue to Project Details'
                : 'Continue to Schedule'}
            </span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </AdminSurface>
    </div>
  );
}
