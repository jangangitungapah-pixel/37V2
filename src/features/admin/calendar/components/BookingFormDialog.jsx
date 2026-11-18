import { useMemo, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Music2,
  UserRound,
  X,
} from 'lucide-react';

import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { calculatePackageFinalPrice } from '@/features/admin/settings/pricing/utils/calculate-pricing-settings';

import {
  DURATION_PRESET_OPTIONS,
  getInitialPaymentStatusMeta,
  getPaymentMethodLabel,
  INITIAL_PAYMENT_STATUS,
  INITIAL_PAYMENT_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  STUDIO_ROOMS,
  TIMELINE_HOURLY_SLOTS,
} from '../config/calendar-config';
import { generateOperationId } from '../repositories/calendar-booking-repository';
import { resolveFormDurationMinutes, validateBookingFormPayload } from '../schemas/booking-schema';
import { calculateBookingPricingSnapshot, formatRupiah } from '../utils/booking-pricing';
import { formatDurationMinutes, formatMinuteOfDay, formatMinuteRange } from '../utils/booking-time';
import { formatIndonesianDateFull, getJakartaTodayIso } from '../utils/calendar-date';

const FORM_STEPS = [
  { id: 'customer', order: '01', label: 'Customer', icon: UserRound },
  { id: 'service', order: '02', label: 'Layanan', icon: Music2 },
  { id: 'schedule', order: '03', label: 'Jadwal', icon: CalendarDays },
  { id: 'payment', order: '04', label: 'Pembayaran', icon: CreditCard },
];

const PRESET_MINUTE_SET = new Set([60, 120, 180, 240, 300, 360]);

function buildInitialFormValues({ mode, initialSlot, editingBooking }) {
  if ((mode === 'edit' || mode === 'reschedule') && editingBooking) {
    const durMins = Number(editingBooking.durationMinutes) || 60;
    const isPreset = PRESET_MINUTE_SET.has(durMins);

    return {
      customerName: editingBooking.customerName || '',
      bandName: editingBooking.bandName || '',
      phone: editingBooking.phone || '',
      serviceId: editingBooking.serviceId || 'rehearsal',
      packageId: editingBooking.packageId || '',
      recordingTypeId: editingBooking.recordingTypeId || '',
      studioId: editingBooking.studioId || 'room-a',
      date: editingBooking.date || getJakartaTodayIso(),
      startMinute: String(editingBooking.startMinute ?? 600),
      durationPreset: isPreset ? String(durMins) : 'custom',
      customDurationMinutes: isPreset ? '90' : String(durMins),
      initialPaymentStatus: editingBooking.initialPaymentStatus || INITIAL_PAYMENT_STATUS.UNPAID,
      dpAmount:
        editingBooking.initialPaidAmount > 0 ? String(editingBooking.initialPaidAmount) : '',
      paymentMethod: editingBooking.paymentMethod || 'cash',
      notes: editingBooking.notes || '',
      applyUpdatedPricing: false,
    };
  }

  return {
    customerName: '',
    bandName: '',
    phone: '',
    serviceId: initialSlot?.defaultServiceId || 'rehearsal',
    packageId: '',
    recordingTypeId: '',
    studioId: initialSlot?.studioId || 'room-a',
    date: initialSlot?.date || getJakartaTodayIso(),
    startMinute: String(initialSlot?.startMinute ?? 600),
    durationPreset: '60',
    customDurationMinutes: '90',
    initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
    dpAmount: '',
    paymentMethod: 'cash',
    notes: '',
    applyUpdatedPricing: true,
  };
}

export function BookingFormDialog({
  open,
  mode = 'create',
  initialSlot = null,
  editingBooking = null,
  existingBookings = [],
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  onOpenChange,
  onSubmitBooking,
  returnFocusRef = null,
}) {
  const [formValues, setFormValues] = useState(() =>
    buildInitialFormValues({ mode, initialSlot, editingBooking }),
  );
  const [activeStep, setActiveStep] = useState(() =>
    mode === 'reschedule' ? 'schedule' : 'customer',
  );
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customerSectionRef = useRef(null);
  const serviceSectionRef = useRef(null);
  const scheduleSectionRef = useRef(null);
  const paymentSectionRef = useRef(null);

  // Pre-generated operation IDs kept stable across retries for idempotency
  const [operationIds] = useState(() => ({
    bookingId: editingBooking?.id || generateOperationId('bkg'),
    eventId: generateOperationId('evt'),
  }));

  const isEditingOrRescheduling = mode === 'edit' || mode === 'reschedule';
  const editingBookingId = isEditingOrRescheduling ? editingBooking?.id || '' : '';

  const serviceOptions = useMemo(() => {
    const active = (pricingSettings?.sessionTypes || []).filter((item) => item.isActive !== false);
    if (
      isEditingOrRescheduling &&
      editingBooking?.serviceId &&
      !active.some((item) => item.id === editingBooking.serviceId)
    ) {
      return [
        ...active,
        {
          id: editingBooking.serviceId,
          name: `${editingBooking.serviceLabel || editingBooking.serviceId} (Snapshot Eksisting)`,
          description: 'Layanan non-aktif dari booking lama',
          hourlyRate: Number(editingBooking.unitRate) || 0,
          isHistoricalFallback: true,
        },
      ];
    }
    return active;
  }, [pricingSettings?.sessionTypes, isEditingOrRescheduling, editingBooking]);

  const recordingTypeOptions = useMemo(() => {
    const active = (pricingSettings?.recordingTypes || []).filter(
      (item) => item.isActive !== false,
    );
    if (
      isEditingOrRescheduling &&
      editingBooking?.recordingTypeId &&
      !active.some((item) => item.id === editingBooking.recordingTypeId)
    ) {
      return [
        ...active,
        {
          id: editingBooking.recordingTypeId,
          name: `${editingBooking.recordingTypeLabel || editingBooking.recordingTypeId} (Snapshot Eksisting)`,
          description: 'Opsi recording non-aktif dari booking lama',
          priceMode: 'hourly',
          durationMinutes: 0,
          price: Number(editingBooking.unitRate) || 0,
          isHistoricalFallback: true,
        },
      ];
    }
    return active;
  }, [pricingSettings?.recordingTypes, isEditingOrRescheduling, editingBooking]);

  const packageOptions = useMemo(() => {
    const baseNone = {
      id: '',
      name: 'Tanpa Paket (Reguler)',
      detail: 'Pilih layanan dan durasi sesuai kebutuhan',
      sessionTypeId: '',
      durationMinutes: 0,
      basePrice: 0,
      discountAmount: 0,
      finalPrice: 0,
    };

    const active = (pricingSettings?.packages || [])
      .filter((item) => item.isActive !== false)
      .map((item) => ({
        ...item,
        finalPrice: calculatePackageFinalPrice(item.basePrice, item.discountAmount).finalPrice,
      }));

    if (
      isEditingOrRescheduling &&
      editingBooking?.packageId &&
      !active.some((item) => item.id === editingBooking.packageId)
    ) {
      active.push({
        id: editingBooking.packageId,
        name: `${editingBooking.packageLabel || editingBooking.packageId} (Snapshot Eksisting)`,
        detail: 'Paket non-aktif dari booking lama',
        sessionTypeId: editingBooking.serviceId,
        durationMinutes: editingBooking.durationMinutes,
        basePrice: editingBooking.subtotal,
        discountAmount: editingBooking.discountAmount,
        finalPrice: editingBooking.totalAmount,
        isHistoricalFallback: true,
      });
    }

    return [baseNone, ...active];
  }, [pricingSettings?.packages, isEditingOrRescheduling, editingBooking]);

  // Hourly start options (10:00 – 21:00), plus preserved legacy HH:30 or late-hour option when editing an existing booking
  const startTimeOptions = useMemo(() => {
    const baseOptions = TIMELINE_HOURLY_SLOTS.map((slot) => ({
      startMinute: slot.startMinute,
      value: String(slot.startMinute),
      label: `${slot.label} WIB`,
    }));

    const existingStartMinute = Number(editingBooking?.startMinute);
    if (
      isEditingOrRescheduling &&
      Number.isInteger(existingStartMinute) &&
      !baseOptions.some((opt) => opt.startMinute === existingStartMinute)
    ) {
      baseOptions.push({
        startMinute: existingStartMinute,
        value: String(existingStartMinute),
        label: `${formatMinuteOfDay(existingStartMinute)} WIB (Jadwal Eksisting)`,
      });
      baseOptions.sort((a, b) => a.startMinute - b.startMinute);
    }

    return baseOptions;
  }, [isEditingOrRescheduling, editingBooking]);

  const effectiveDurationMinutes = useMemo(
    () => resolveFormDurationMinutes(formValues, pricingSettings),
    [formValues, pricingSettings],
  );

  const isServiceScopeChanged = Boolean(
    isEditingOrRescheduling &&
    editingBooking &&
    (formValues.serviceId !== (editingBooking.serviceId || '') ||
      formValues.packageId !== (editingBooking.packageId || '') ||
      formValues.recordingTypeId !== (editingBooking.recordingTypeId || '') ||
      effectiveDurationMinutes !== Number(editingBooking.durationMinutes || 0)),
  );

  const shouldUsePreservedSnapshot = Boolean(
    isEditingOrRescheduling &&
    editingBooking &&
    (!isServiceScopeChanged || !formValues.applyUpdatedPricing),
  );

  const livePricing = useMemo(
    () =>
      calculateBookingPricingSnapshot({
        serviceId: formValues.serviceId,
        packageId: formValues.packageId,
        recordingTypeId: formValues.recordingTypeId,
        durationMinutes: effectiveDurationMinutes,
        initialPaymentStatus: isEditingOrRescheduling
          ? editingBooking?.initialPaymentStatus
          : formValues.initialPaymentStatus,
        dpAmount: isEditingOrRescheduling ? editingBooking?.initialPaidAmount : formValues.dpAmount,
        paymentMethod: isEditingOrRescheduling
          ? editingBooking?.paymentMethod
          : formValues.paymentMethod,
        pricingSettings,
      }),
    [
      formValues,
      effectiveDurationMinutes,
      isEditingOrRescheduling,
      editingBooking,
      pricingSettings,
    ],
  );

  const displayedPricing = useMemo(() => {
    if (!shouldUsePreservedSnapshot || !editingBooking) {
      return livePricing;
    }

    const totalAmount = Math.max(0, Number(editingBooking.totalAmount) || 0);
    const initialPaidAmount = Math.max(0, Number(editingBooking.initialPaidAmount) || 0);
    return {
      ...livePricing,
      unitRate: Number(editingBooking.unitRate) || 0,
      subtotal: Number(editingBooking.subtotal) || 0,
      discountAmount: Number(editingBooking.discountAmount) || 0,
      appliedDiscountName: editingBooking.packageId
        ? 'Diskon Paket (Snapshot)'
        : Number(editingBooking.discountAmount) > 0
          ? 'Diskon (Snapshot)'
          : '',
      totalAmount,
      initialPaidAmount,
      remainingBalance: Math.max(0, totalAmount - initialPaidAmount),
      commissionSnapshot: editingBooking.commissionSnapshot ?? null,
    };
  }, [shouldUsePreservedSnapshot, editingBooking, livePricing]);

  const liveValidation = useMemo(
    () =>
      validateBookingFormPayload(formValues, existingBookings, editingBookingId, pricingSettings, {
        allowedHistoricalServiceIds: editingBooking?.serviceId ? [editingBooking.serviceId] : [],
        paymentTotalOverride: shouldUsePreservedSnapshot ? editingBooking?.totalAmount : undefined,
      }),
    [
      formValues,
      existingBookings,
      editingBookingId,
      pricingSettings,
      editingBooking,
      shouldUsePreservedSnapshot,
    ],
  );

  const handleFieldChange = (field, value) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
    setTouchedFields((prev) => ({
      ...prev,
      [field]: true,
    }));
    if (submitError) {
      setSubmitError('');
    }
  };

  const handleSelectService = (nextServiceId) => {
    setFormValues((prev) => ({
      ...prev,
      serviceId: nextServiceId,
      recordingTypeId:
        nextServiceId === 'recording'
          ? prev.recordingTypeId ||
            recordingTypeOptions.find((item) => item.priceMode === 'hourly')?.id ||
            recordingTypeOptions[0]?.id ||
            ''
          : '',
    }));
    if (submitError) setSubmitError('');
  };

  const handleSelectPackage = (nextPackageId) => {
    const selectedPkg = packageOptions.find((item) => item.id === nextPackageId);
    setFormValues((prev) => ({
      ...prev,
      packageId: nextPackageId,
      serviceId: selectedPkg?.sessionTypeId || prev.serviceId,
      recordingTypeId: '',
      durationPreset: selectedPkg?.durationMinutes
        ? String(selectedPkg.durationMinutes)
        : prev.durationPreset,
    }));
    if (submitError) setSubmitError('');
  };

  const handleSelectRecordingType = (nextRecordingTypeId) => {
    const recType = recordingTypeOptions.find((item) => item.id === nextRecordingTypeId);
    setFormValues((prev) => ({
      ...prev,
      recordingTypeId: nextRecordingTypeId,
      durationPreset:
        recType?.priceMode === 'fixed' && recType?.durationMinutes > 0
          ? String(recType.durationMinutes)
          : prev.durationPreset,
    }));
    if (submitError) setSubmitError('');
  };

  const handleStepSelect = (stepId) => {
    setActiveStep(stepId);
    let targetNode = customerSectionRef.current;
    if (stepId === 'service') targetNode = serviceSectionRef.current;
    if (stepId === 'schedule') targetNode = scheduleSectionRef.current;
    if (stepId === 'payment') targetNode = paymentSectionRef.current;

    if (targetNode && typeof targetNode.scrollIntoView === 'function') {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const shouldShowFieldError = (field) => {
    return Boolean((hasAttemptedSubmit || touchedFields[field]) && liveValidation.errors[field]);
  };

  const handleDialogOpenChange = (nextOpen) => {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
    if (!nextOpen && returnFocusRef?.current) {
      window.requestAnimationFrame(() => {
        returnFocusRef.current?.focus?.();
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setHasAttemptedSubmit(true);
    setSubmitError('');

    if (!liveValidation.isValid) {
      if (!liveValidation.stepStatus.customer) {
        handleStepSelect('customer');
      } else if (!liveValidation.stepStatus.service) {
        handleStepSelect('service');
      } else if (!liveValidation.stepStatus.schedule) {
        handleStepSelect('schedule');
      } else if (!liveValidation.stepStatus.payment) {
        handleStepSelect('payment');
      }
      const firstError =
        Object.values(liveValidation.errors)[0] ||
        'Periksa kembali field yang belum valid sebelum menyimpan.';
      setSubmitError(firstError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitBooking({
        mode,
        bookingId: operationIds.bookingId,
        eventId: operationIds.eventId,
        expectedVersion: editingBooking?.version,
        formValues,
      });
      handleDialogOpenChange(false);
    } catch (err) {
      setSubmitError(
        err?.message || 'Gagal menyimpan booking. Data input Anda tetap tersimpan di form.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogEyebrow =
    mode === 'reschedule' ? 'RESCHEDULE BOOKING' : mode === 'edit' ? 'EDIT BOOKING' : 'NEW BOOKING';

  const dialogTitle =
    mode === 'reschedule'
      ? 'Reschedule Booking'
      : mode === 'edit'
        ? 'Edit Booking'
        : 'Tambah Booking';

  const isDurationLockedByPackage = Boolean(formValues.packageId);
  const selectedRecType = recordingTypeOptions.find(
    (item) => item.id === formValues.recordingTypeId,
  );
  const isDurationLockedByRecordingType = Boolean(
    !formValues.packageId &&
    formValues.serviceId === 'recording' &&
    selectedRecType?.priceMode === 'fixed' &&
    selectedRecType?.durationMinutes > 0,
  );

  const computedStartMinute = Number(formValues.startMinute) || 600;
  const computedEndMinute = computedStartMinute + effectiveDurationMinutes;

  return (
    <Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label={dialogTitle}
          data-calendar-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[100dvh] w-full max-w-4xl flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-y-4 sm:h-auto sm:max-h-[92dvh] sm:w-[95vw] sm:border-2"
        >
          {/* Sticky Header + 4-Stage Stepper */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory shrink-0 border-b-2 px-4 py-3.5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-block border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-widest uppercase">
                  {dialogEyebrow}
                </span>
                <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black tracking-tight text-white uppercase sm:text-3xl">
                  {dialogTitle}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-neutral-300">
                  Lengkapi empat tahap operasional di bawah. Konflik jadwal dan harga dihitung
                  secara otomatis.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup form booking"
                disabled={isSubmitting}
                className="hover:border-studio-lime hover:text-studio-lime inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Functional 4-Stage Stepper */}
            <nav
              aria-label="Tahapan form booking"
              className="mt-3.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
            >
              {FORM_STEPS.map((step) => {
                const isStepValid = Boolean(liveValidation.stepStatus[step.id]);
                const isStepActive = activeStep === step.id;
                const StepIcon = step.icon;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepSelect(step.id)}
                    aria-current={isStepActive ? 'step' : undefined}
                    className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 border px-2.5 py-1.5 text-left transition-colors ${
                      isStepActive
                        ? 'border-studio-ivory bg-studio-lime text-studio-ink font-extrabold'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <StepIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate font-mono text-[11px] uppercase">
                        {step.order}. {step.label}
                      </span>
                    </div>

                    {isStepValid ? (
                      <span
                        title={`Tahap ${step.label} lengkap`}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                          isStepActive
                            ? 'border-studio-ink bg-studio-ink text-studio-lime'
                            : 'border-studio-lime bg-studio-lime text-studio-ink'
                        }`}
                      >
                        <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Scrollable Form Content */}
          <form
            id="studio-booking-form"
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-8 sm:px-6 sm:py-5"
          >
            {/* Global Submission Error Banner */}
            {submitError ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white mb-5 flex items-start gap-2.5 border-2 p-3.5 shadow-[3px_3px_0px_#151515]"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 text-xs font-bold sm:text-sm">{submitError}</div>
              </div>
            ) : null}

            <div className="space-y-6">
              {/* STEP 01: CUSTOMER SECTION */}
              <section
                ref={customerSectionRef}
                aria-labelledby="step-customer-heading"
                onFocusCapture={() => setActiveStep('customer')}
                className="brutal-card bg-studio-white p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                  <div>
                    <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                      TAHAP 01 • DATA PEMESAN
                    </span>
                    <h3
                      id="step-customer-heading"
                      className="font-display text-studio-ink text-xl font-black uppercase"
                    >
                      Customer Snapshot
                    </h3>
                  </div>
                  {liveValidation.stepStatus.customer ? (
                    <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      <span>Valid</span>
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="booking-customer-name"
                      className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                    >
                      Nama Customer <span className="text-studio-orange">*</span>
                    </label>
                    <input
                      id="booking-customer-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={formValues.customerName}
                      onChange={(e) => handleFieldChange('customerName', e.target.value)}
                      placeholder="Contoh: Raka Pratama"
                      className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                    />
                    {shouldShowFieldError('customerName') ? (
                      <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                        {liveValidation.errors.customerName}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="booking-customer-phone"
                      className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                    >
                      Nomor HP / WhatsApp <span className="text-studio-orange">*</span>
                    </label>
                    <input
                      id="booking-customer-phone"
                      type="tel"
                      inputMode="tel"
                      required
                      autoComplete="tel"
                      value={formValues.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-bold"
                    />
                    {shouldShowFieldError('phone') ? (
                      <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                        {liveValidation.errors.phone}
                      </p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="booking-band-name"
                      className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                    >
                      Nama Band / Project <span className="text-studio-muted-ink">(Opsional)</span>
                    </label>
                    <input
                      id="booking-band-name"
                      type="text"
                      autoComplete="organization"
                      value={formValues.bandName}
                      onChange={(e) => handleFieldChange('bandName', e.target.value)}
                      placeholder="Contoh:The Velvet Echo / Solo Project"
                      className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                    />
                  </div>
                </div>
              </section>

              {/* STEP 02: SERVICE SECTION */}
              <section
                ref={serviceSectionRef}
                aria-labelledby="step-service-heading"
                onFocusCapture={() => setActiveStep('service')}
                className="brutal-card bg-studio-white p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                  <div>
                    <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                      TAHAP 02 • LAYANAN &amp; PAKET
                    </span>
                    <h3
                      id="step-service-heading"
                      className="font-display text-studio-ink text-xl font-black uppercase"
                    >
                      Layanan Studio
                    </h3>
                  </div>

                  <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                    Tarif: {formatRupiah(displayedPricing.unitRate)}/jam
                  </span>
                </div>

                {/* Optional Package Selector */}
                <div className="mt-4">
                  <label
                    htmlFor="booking-package-select"
                    className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                  >
                    Pilihan Paket Studio
                  </label>
                  <select
                    id="booking-package-select"
                    value={formValues.packageId}
                    onChange={(e) => handleSelectPackage(e.target.value)}
                    className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-bold"
                  >
                    {packageOptions.map((pkg) => (
                      <option key={pkg.id || 'none'} value={pkg.id}>
                        {pkg.name}
                        {pkg.finalPrice > 0 ? ` — ${formatRupiah(pkg.finalPrice)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Service Type Radio/Button Grid */}
                <div className="mt-4">
                  <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                    Kategori Layanan <span className="text-studio-orange">*</span>
                  </span>

                  <div
                    role="group"
                    aria-label="Pilih layanan studio"
                    className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                  >
                    {serviceOptions.map((service) => {
                      const isSelected = formValues.serviceId === service.id;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          disabled={Boolean(formValues.packageId)}
                          onClick={() => handleSelectService(service.id)}
                          aria-pressed={isSelected}
                          className={`flex min-h-14 cursor-pointer flex-col justify-between border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            isSelected
                              ? 'border-studio-ink bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                              : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display text-lg leading-none font-black uppercase">
                              {service.name}
                            </span>
                            <span className="font-mono text-xs font-extrabold">
                              {formatRupiah(service.hourlyRate)}/jam
                            </span>
                          </div>
                          <span className="text-studio-muted-ink mt-1 text-xs font-medium">
                            {service.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recording Type Selector when Recording is active */}
                {!formValues.packageId && formValues.serviceId === 'recording' ? (
                  <div className="mt-4">
                    <label
                      htmlFor="booking-recording-type"
                      className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                    >
                      Jenis Recording
                    </label>
                    <select
                      id="booking-recording-type"
                      value={formValues.recordingTypeId}
                      onChange={(e) => handleSelectRecordingType(e.target.value)}
                      className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-bold"
                    >
                      {recordingTypeOptions.map((recType) => (
                        <option key={recType.id} value={recType.id}>
                          {recType.name} —{' '}
                          {recType.priceMode === 'fixed'
                            ? `${formatDurationMinutes(recType.durationMinutes)} (${formatRupiah(recType.price)})`
                            : `${formatRupiah(recType.price)}/jam`}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </section>

              {/* STEP 03: SCHEDULE SECTION */}
              <section
                ref={scheduleSectionRef}
                aria-labelledby="step-schedule-heading"
                onFocusCapture={() => setActiveStep('schedule')}
                className="brutal-card bg-studio-white p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                  <div>
                    <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                      TAHAP 03 • RUANGAN &amp; WAKTU SESI
                    </span>
                    <h3
                      id="step-schedule-heading"
                      className="font-display text-studio-ink text-xl font-black uppercase"
                    >
                      Jadwal &amp; Ketersediaan Slot
                    </h3>
                  </div>

                  <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[10px] font-bold">
                    Asia/Jakarta (WIB)
                  </span>
                </div>

                {/* Studio Room Selector */}
                <div className="mt-4">
                  <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                    Pilih Studio Room <span className="text-studio-orange">*</span>
                  </span>

                  <div
                    role="group"
                    aria-label="Pilih ruangan studio"
                    className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                  >
                    {STUDIO_ROOMS.map((room) => {
                      const isSelected = formValues.studioId === room.id;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => handleFieldChange('studioId', room.id)}
                          aria-pressed={isSelected}
                          className={`flex min-h-14 cursor-pointer flex-col justify-between border-2 p-3 text-left transition-colors ${
                            isSelected
                              ? 'border-studio-ink bg-studio-ink text-studio-lime shadow-[2px_2px_0px_#151515]'
                              : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display text-lg leading-none font-black uppercase">
                              {room.label}
                            </span>
                            <span
                              className={`border px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase ${room.badgeClass}`}
                            >
                              {room.shortLabel}
                            </span>
                          </div>
                          <span
                            className={`mt-1 text-xs font-medium ${
                              isSelected ? 'text-neutral-300' : 'text-studio-muted-ink'
                            }`}
                          >
                            {room.subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date & Start Time */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="booking-schedule-date"
                      className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                    >
                      Tanggal Sesi <span className="text-studio-orange">*</span>
                    </label>
                    <input
                      id="booking-schedule-date"
                      type="date"
                      required
                      value={formValues.date}
                      onChange={(e) => handleFieldChange('date', e.target.value)}
                      className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-bold"
                    />
                    {shouldShowFieldError('date') ? (
                      <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                        {liveValidation.errors.date}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="booking-start-minute"
                      className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                    >
                      Jam Mulai (10:00 – 21:00 WIB) <span className="text-studio-orange">*</span>
                    </label>
                    <select
                      id="booking-start-minute"
                      value={formValues.startMinute}
                      onChange={(e) => handleFieldChange('startMinute', e.target.value)}
                      className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-bold"
                    >
                      {startTimeOptions.map((slot) => (
                        <option key={slot.startMinute} value={slot.value}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                    {shouldShowFieldError('startMinute') ? (
                      <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                        {liveValidation.errors.startMinute}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Duration Preset & Custom Duration (30-min intervals) */}
                <div className="mt-4">
                  <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                    Durasi Sesi <span className="text-studio-orange">*</span>
                  </span>

                  <div
                    role="group"
                    aria-label="Pilih durasi sesi"
                    className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
                  >
                    {DURATION_PRESET_OPTIONS.map((option) => {
                      const isSelected = formValues.durationPreset === option.key;
                      const isDisabled =
                        isDurationLockedByPackage || isDurationLockedByRecordingType;

                      return (
                        <button
                          key={option.key}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleFieldChange('durationPreset', option.key)}
                          aria-pressed={isSelected}
                          className={`min-h-11 cursor-pointer border-2 px-2.5 py-1.5 font-mono text-xs font-extrabold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            isSelected
                              ? 'border-studio-ink bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                              : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {formValues.durationPreset === 'custom' &&
                  !isDurationLockedByPackage &&
                  !isDurationLockedByRecordingType ? (
                    <div className="mt-3">
                      <label
                        htmlFor="booking-custom-duration"
                        className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                      >
                        Durasi Custom (Menit — Kelipatan 30 Menit)
                      </label>
                      <input
                        id="booking-custom-duration"
                        type="number"
                        min="30"
                        max="780"
                        step="30"
                        value={formValues.customDurationMinutes}
                        onChange={(e) => handleFieldChange('customDurationMinutes', e.target.value)}
                        className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full max-w-xs border-2 px-3 py-2 font-mono text-sm font-bold"
                      />
                      <p className="text-studio-muted-ink mt-1 font-mono text-[11px]">
                        Contoh: 90 = 1 jam 30 menit, 150 = 2 jam 30 menit.
                      </p>
                    </div>
                  ) : null}

                  {liveValidation.errors.durationMinutes ? (
                    <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-bold">
                      {liveValidation.errors.durationMinutes}
                    </p>
                  ) : null}
                </div>

                {/* Live Slot Availability & Conflict Banner */}
                <div className="mt-4">
                  {liveValidation.errors.scheduleConflict ||
                  liveValidation.errors.startMinute ||
                  liveValidation.errors.durationMinutes ? (
                    <div
                      role="alert"
                      className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2.5 border-2 p-3 shadow-[2px_2px_0px_#151515]"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div className="text-xs font-bold">
                        <p className="font-mono uppercase">KONFLIK ATAU BATAS JAM OPERASIONAL</p>
                        <p className="mt-0.5">
                          {liveValidation.errors.scheduleConflict ||
                            liveValidation.errors.startMinute ||
                            liveValidation.errors.durationMinutes}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="status"
                      className="border-studio-ink bg-studio-lime/40 text-studio-ink flex flex-wrap items-center justify-between gap-2 border-2 px-3.5 py-2.5 font-mono text-xs font-extrabold"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>SLOT TERSEDIA</span>
                      </span>
                      <span>
                        {formatIndonesianDateFull(formValues.date)} •{' '}
                        {formatMinuteRange(computedStartMinute, computedEndMinute)} (
                        {formatDurationMinutes(effectiveDurationMinutes)})
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* STEP 04: PAYMENT SECTION */}
              <section
                ref={paymentSectionRef}
                aria-labelledby="step-payment-heading"
                onFocusCapture={() => setActiveStep('payment')}
                className="brutal-card bg-studio-white p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                  <div>
                    <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                      TAHAP 04 • PEMBAYARAN AWAL &amp; CATATAN
                    </span>
                    <h3
                      id="step-payment-heading"
                      className="font-display text-studio-ink text-xl font-black uppercase"
                    >
                      Informasi Pembayaran Awal
                    </h3>
                  </div>

                  <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                    Pricing Snapshot
                  </span>
                </div>

                {isEditingOrRescheduling ? (
                  <div className="border-studio-ink bg-studio-ivory mt-4 border-2 p-3.5">
                    <p className="font-mono text-xs font-extrabold uppercase">
                      Snapshot Pembayaran Awal Terkunci
                    </p>
                    <p className="text-studio-muted-ink mt-1 text-xs leading-relaxed font-medium">
                      Sesuai aturan integritas data, status pembayaran awal yang tercatat saat
                      booking dibuat (
                      <strong>
                        {getInitialPaymentStatusMeta(editingBooking?.initialPaymentStatus).label}
                      </strong>{' '}
                      • <strong>{formatRupiah(editingBooking?.initialPaidAmount)}</strong> • Metode:{' '}
                      <strong>{getPaymentMethodLabel(editingBooking?.paymentMethod)}</strong>) tidak
                      diubah melalui jalur edit jadwal.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Initial Payment Status Selector */}
                    <div className="mt-4">
                      <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                        Status Pembayaran Awal <span className="text-studio-orange">*</span>
                      </span>

                      <div
                        role="group"
                        aria-label="Pilih status pembayaran awal"
                        className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                      >
                        {INITIAL_PAYMENT_STATUS_OPTIONS.map((statusOption) => {
                          const isSelected = formValues.initialPaymentStatus === statusOption.id;
                          return (
                            <button
                              key={statusOption.id}
                              type="button"
                              onClick={() =>
                                handleFieldChange('initialPaymentStatus', statusOption.id)
                              }
                              aria-pressed={isSelected}
                              className={`flex min-h-14 cursor-pointer flex-col justify-between border-2 p-3 text-left transition-colors ${
                                isSelected
                                  ? 'border-studio-ink bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                                  : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
                              }`}
                            >
                              <span className="font-display text-lg leading-none font-black uppercase">
                                {statusOption.shortLabel}
                              </span>
                              <span className="text-studio-muted-ink mt-1 text-[11px] font-medium">
                                {statusOption.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payment Method & DP Nominal */}
                    {formValues.initialPaymentStatus === INITIAL_PAYMENT_STATUS.PARTIAL ||
                    formValues.initialPaymentStatus === INITIAL_PAYMENT_STATUS.PAID ? (
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="booking-payment-method"
                            className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                          >
                            Metode Pembayaran <span className="text-studio-orange">*</span>
                          </label>
                          <select
                            id="booking-payment-method"
                            value={formValues.paymentMethod}
                            onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                            className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-bold"
                          >
                            {PAYMENT_METHOD_OPTIONS.map((method) => (
                              <option key={method.id} value={method.id}>
                                {method.label} — {method.description}
                              </option>
                            ))}
                          </select>
                          {shouldShowFieldError('paymentMethod') ? (
                            <p
                              role="alert"
                              className="text-studio-error-ink mt-1 text-xs font-bold"
                            >
                              {liveValidation.errors.paymentMethod}
                            </p>
                          ) : null}
                        </div>

                        {formValues.initialPaymentStatus === INITIAL_PAYMENT_STATUS.PARTIAL ? (
                          <div>
                            <label
                              htmlFor="booking-dp-amount"
                              className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                            >
                              Nominal DP (IDR) <span className="text-studio-orange">*</span>
                            </label>
                            <input
                              id="booking-dp-amount"
                              type="text"
                              inputMode="numeric"
                              value={formValues.dpAmount}
                              onChange={(e) => handleFieldChange('dpAmount', e.target.value)}
                              placeholder="Contoh: 50000"
                              className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-bold"
                            />
                            {shouldShowFieldError('dpAmount') ? (
                              <p
                                role="alert"
                                className="text-studio-error-ink mt-1 text-xs font-bold"
                              >
                                {liveValidation.errors.dpAmount}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}

                {/* Notes Field */}
                <div className="mt-4">
                  <label
                    htmlFor="booking-notes"
                    className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                  >
                    Catatan Sesi <span className="text-studio-muted-ink">(Opsional)</span>
                  </label>
                  <textarea
                    id="booking-notes"
                    rows={2}
                    maxLength={500}
                    value={formValues.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    placeholder="Kebutuhan ampli, jumlah mic vokal, atau catatan khusus sesi..."
                    className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 w-full border-2 p-3 text-sm font-medium"
                  />
                </div>

                {/* Historical Price Protection Banner when Service/Package/Duration changed on Edit */}
                {isEditingOrRescheduling && isServiceScopeChanged ? (
                  <div className="border-studio-ink mt-4 border-2 bg-amber-100 p-3.5">
                    <p className="font-mono text-xs font-extrabold uppercase">
                      Konfirmasi Perubahan Harga &amp; Fee Snapshot
                    </p>
                    <p className="text-studio-ink mt-1 text-xs leading-relaxed font-medium">
                      Anda mengubah layanan, paket, atau durasi pada booking lama. Secara default
                      snapshot harga &amp; komisi sebelumnya tetap dipertahankan (
                      <strong>{formatRupiah(editingBooking?.totalAmount)}</strong>). Centang opsi di
                      bawah hanya jika Anda ingin menerapkan preset harga &amp; fee terbaru (
                      <strong>{formatRupiah(livePricing.totalAmount)}</strong>).
                    </p>
                    <label className="mt-2.5 flex cursor-pointer items-center gap-2 font-mono text-xs font-extrabold">
                      <input
                        type="checkbox"
                        checked={Boolean(formValues.applyUpdatedPricing)}
                        onChange={(e) => handleFieldChange('applyUpdatedPricing', e.target.checked)}
                        className="accent-studio-ink h-4 w-4 cursor-pointer"
                      />
                      <span>Terapkan harga &amp; fee preset terbaru</span>
                    </label>
                  </div>
                ) : null}

                {/* Live Pricing Breakdown Summary Card: CUSTOMER CHARGE + INTERNAL FEE ESTIMATE */}
                <div className="border-studio-ink bg-studio-ivory mt-4 grid grid-cols-1 gap-4 border-2 p-4 md:grid-cols-2">
                  <div>
                    <p className="font-mono text-xs font-extrabold tracking-wider uppercase">
                      CUSTOMER CHARGE
                    </p>

                    <dl className="mt-2.5 space-y-1.5 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <dt className="text-studio-muted-ink">Subtotal</dt>
                        <dd className="font-bold">{formatRupiah(displayedPricing.subtotal)}</dd>
                      </div>
                      {displayedPricing.discountAmount > 0 ? (
                        <div className="flex items-center justify-between text-emerald-800">
                          <dt>{displayedPricing.appliedDiscountName || 'Discount'}</dt>
                          <dd className="font-bold">
                            - {formatRupiah(displayedPricing.discountAmount)}
                          </dd>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-neutral-600">
                          <dt>Discount</dt>
                          <dd className="font-bold">{formatRupiah(0)}</dd>
                        </div>
                      )}
                      <div className="border-studio-ink flex items-center justify-between border-t pt-1.5 text-sm font-extrabold">
                        <dt>TOTAL</dt>
                        <dd>{formatRupiah(displayedPricing.totalAmount)}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-studio-muted-ink">Pembayaran Awal</dt>
                        <dd className="font-bold">
                          {formatRupiah(displayedPricing.initialPaidAmount)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between font-extrabold">
                        <dt className="text-studio-orange">Sisa Tagihan</dt>
                        <dd className="text-studio-orange">
                          {formatRupiah(displayedPricing.remainingBalance)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="border-studio-ink border-t pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4">
                    <p className="font-mono text-xs font-extrabold tracking-wider uppercase">
                      INTERNAL FEE ESTIMATE
                    </p>
                    <p className="text-studio-muted-ink mt-0.5 text-[11px] font-medium">
                      Estimasi operasional internal studio (tidak memengaruhi tagihan customer).
                    </p>

                    {displayedPricing.commissionSnapshot ? (
                      <dl className="mt-2.5 space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <dt className="text-studio-muted-ink">Staff Commission</dt>
                          <dd className="font-bold">
                            {formatRupiah(displayedPricing.commissionSnapshot.staffAmount)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-studio-muted-ink">Recording Operator</dt>
                          <dd className="font-bold">
                            {formatRupiah(
                              displayedPricing.commissionSnapshot.recordingOperatorAmount,
                            )}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-studio-muted-ink mt-2.5 font-mono text-[11px]">
                        Booking historis Phase 5 (tidak memiliki snapshot komisi internal).
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </form>

          {/* Sticky Action Footer */}
          <div className="border-studio-ink bg-studio-white shrink-0 border-t-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div>
                  <span className="text-studio-muted-ink block font-mono text-[10px] font-bold uppercase">
                    ESTIMASI TOTAL
                  </span>
                  <span className="font-display text-studio-ink text-2xl leading-none font-black">
                    {formatRupiah(displayedPricing.totalAmount)}
                  </span>
                </div>

                <div className="text-studio-muted-ink font-mono text-[11px] font-bold">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{formatDurationMinutes(effectiveDurationMinutes)}</span>
                  </span>
                  <span> • Sisa: {formatRupiah(displayedPricing.remainingBalance)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDialogOpenChange(false)}
                  className="brutal-btn bg-studio-ivory text-studio-ink min-h-11 flex-1 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase sm:flex-initial"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  form="studio-booking-form"
                  disabled={isSubmitting || Boolean(liveValidation.errors.scheduleConflict)}
                  className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 px-5 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Booking</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
