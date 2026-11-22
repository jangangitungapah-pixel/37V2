import { Check } from 'lucide-react';

const STUDIO_STEPS = [
  { number: 1, title: 'Select Session', subtitle: 'Service & package' },
  { number: 2, title: 'Choose Schedule', subtitle: 'Room, date & time' },
  { number: 3, title: 'Review & Send', subtitle: 'Summary & consent' },
];

const WFA_STEPS = [
  { number: 1, title: 'Select Service', subtitle: 'Mix & master tier' },
  { number: 2, title: 'Project Details', subtitle: 'Brief & deadline' },
  { number: 3, title: 'Review & Send', subtitle: 'Summary & consent' },
];

export function ClientBookingStepper({ flowType = 'studio', currentStep = 1, onSelectStep }) {
  const steps = flowType === 'wfa' ? WFA_STEPS : STUDIO_STEPS;

  return (
    <nav aria-label="Booking progress" data-testid="client-booking-stepper">
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {steps.map((step) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;
          const isClickable = isCompleted && typeof onSelectStep === 'function';

          const content = (
            <div
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                isActive
                  ? 'border-[#151515] bg-[#151515] text-white shadow-xs'
                  : isCompleted
                    ? 'border-[#8BAD12]/35 bg-[#EDF8C2] text-[#243300] hover:border-[#8BAD12]/60'
                    : 'border-[#151515]/[0.08] bg-[#FAF8F1] text-[#666159]'
              }`}
            >
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                  isActive
                    ? 'bg-[#C8F13A] text-[#151515]'
                    : isCompleted
                      ? 'bg-[#243300] text-[#EDF8C2]'
                      : 'border border-[#151515]/15 bg-white text-[#666159]'
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : step.number}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold sm:text-[13px]">
                  {step.title}
                </span>
                <span
                  className={`block truncate text-[11px] ${
                    isActive
                      ? 'text-neutral-300'
                      : isCompleted
                        ? 'text-[#3B5200]'
                        : 'text-[#666159]'
                  }`}
                >
                  {step.subtitle}
                </span>
              </span>
            </div>
          );

          return (
            <li key={step.number} aria-current={isActive ? 'step' : undefined}>
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onSelectStep(step.number)}
                  className="w-full cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#151515]"
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
