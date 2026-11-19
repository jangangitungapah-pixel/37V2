import { useMemo, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Info,
  Loader2,
  Music2,
  RefreshCw,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import { CustomerIdentityConflictDialog } from '@/features/admin/customer/components/CustomerIdentityConflictDialog';
import {
  lookupCustomerByPhone,
  mapCustomerErrorToMessage,
} from '@/features/admin/customer/services/customer-service';
import {
  CUSTOMER_RESOLUTION_MODE,
  IDENTITY_MATCH_STATUS,
  resolveCustomerIdentityCandidates,
} from '@/features/admin/customer/utils/customer-identity';
import {
  formatPhoneDisplay,
  normalizePhoneNumber,
} from '@/features/admin/customer/utils/phone-number';

import {
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
  DISCOUNT_RULE_MODES,
  FEE_MODES,
  PRICING_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { formatOptionPricingSummary } from '@/features/admin/settings/pricing/utils/calculate-pricing-settings';
import {
  isOptionBookableForStudio,
  normalizePricingSettings,
} from '@/features/admin/settings/pricing/utils/normalize-pricing-settings';

import {
  DURATION_PRESET_OPTIONS,
  getInitialPaymentStatusMeta,
  getPaymentMethodLabel,
  INITIAL_PAYMENT_STATUS,
  INITIAL_PAYMENT_STATUS_OPTIONS,
  OPERATING_END_MINUTE,
  PAYMENT_METHOD_OPTIONS,
  SLOT_INTERVAL_MINUTES,
  STUDIO_ROOMS,
  TIMELINE_HOURLY_SLOTS,
} from '../config/calendar-config';
import { generateOperationId } from '../repositories/calendar-booking-repository';
import { resolveFormDurationMinutes, validateBookingFormPayload } from '../schemas/booking-schema';
import {
  calculateBookingPricingSnapshot,
  formatRupiah,
  getCommissionSnapshotDisplay,
  resolveServiceAndOption,
} from '../utils/booking-pricing';
import { formatDurationMinutes, formatMinuteOfDay, formatMinuteRange } from '../utils/booking-time';
import { formatIndonesianDateFull, getJakartaTodayIso } from '../utils/calendar-date';

const FORM_STEPS = [
  { id: 'customer', order: '01', label: 'Customer', icon: UserRound },
  { id: 'service', order: '02', label: 'Layanan', icon: Music2 },
  { id: 'schedule', order: '03', label: 'Jadwal', icon: CalendarDays },
  { id: 'payment', order: '04', label: 'Pembayaran', icon: CreditCard },
];

const PRESET_MINUTE_SET = new Set([60, 120, 180, 240, 300, 360]);

function buildInitialFormValues({ mode, initialSlot, editingBooking, normalizedSettings }) {
  if ((mode === 'edit' || mode === 'reschedule') && editingBooking) {
    const durMins = Number(editingBooking.durationMinutes) || 60;
    const isPreset = PRESET_MINUTE_SET.has(durMins);
    const resolved = resolveServiceAndOption({
      serviceTypeId: editingBooking.serviceTypeId || editingBooking.serviceId,
      serviceOptionId:
        editingBooking.serviceOptionId ||
        editingBooking.packageId ||
        editingBooking.recordingTypeId,
      pricingSettings: normalizedSettings,
    });

    const commissionDisplay = getCommissionSnapshotDisplay(editingBooking.commissionSnapshot);

    return {
      customerName: editingBooking.customerName || '',
      bandName: editingBooking.bandName || '',
      phone: editingBooking.phone || '',
      serviceTypeId:
        editingBooking.serviceTypeId ||
        editingBooking.serviceId ||
        resolved.serviceType?.id ||
        'rehearsal',
      serviceOptionId:
        editingBooking.serviceOptionId ||
        editingBooking.packageId ||
        editingBooking.recordingTypeId ||
        resolved.option?.id ||
        '',
      serviceId: editingBooking.serviceTypeId || editingBooking.serviceId || 'rehearsal',
      packageId: editingBooking.packageId || '',
      recordingTypeId: editingBooking.recordingTypeId || '',
      manualCustomerPrice:
        editingBooking.pricingMode === PRICING_MODES.MANUAL_QUOTE
          ? String(editingBooking.subtotal || '')
          : '',
      manualStaffFee:
        commissionDisplay?.staff?.basis === FEE_MODES.MANUAL
          ? String(commissionDisplay.staff.amount || 0)
          : '0',
      manualOwnerFee:
        commissionDisplay?.owner?.basis === FEE_MODES.MANUAL
          ? String(commissionDisplay.owner.amount || 0)
          : '0',
      manualRecordingOperatorFee:
        commissionDisplay?.recordingOperator?.basis === FEE_MODES.MANUAL
          ? String(commissionDisplay.recordingOperator.amount || 0)
          : '0',
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

  const studioServices = (normalizedSettings.serviceTypes || [])
    .filter((svc) => svc.deliveryMode === DELIVERY_MODES.STUDIO && svc.isActive !== false)
    .map((svc) => ({
      ...svc,
      bookableOptions: (svc.options || []).filter(isOptionBookableForStudio),
    }))
    .filter((svc) => svc.bookableOptions.length > 0);

  const defaultService =
    studioServices.find((svc) => svc.id === initialSlot?.defaultServiceId) ||
    studioServices[0] ||
    null;

  const defaultOption =
    defaultService?.bookableOptions?.find((opt) => opt.id === initialSlot?.defaultOptionId) ||
    defaultService?.bookableOptions?.find((opt) => opt.pricing?.mode === PRICING_MODES.HOURLY) ||
    defaultService?.bookableOptions?.[0] ||
    null;

  const defaultDuration =
    defaultOption?.pricing?.mode === PRICING_MODES.FIXED_SHIFT &&
      defaultOption.pricing.durationMinutes > 0
      ? String(defaultOption.pricing.durationMinutes)
      : '60';

  return {
    customerName: '',
    bandName: '',
    phone: '',
    serviceTypeId: defaultService?.id || 'rehearsal',
    serviceOptionId: defaultOption?.id || 'rehearsal-regular',
    serviceId: defaultService?.id || 'rehearsal',
    packageId: '',
    recordingTypeId: '',
    manualCustomerPrice: '',
    manualStaffFee: '0',
    manualOwnerFee: '0',
    manualRecordingOperatorFee: '0',
    studioId: initialSlot?.studioId || 'room-a',
    date: initialSlot?.date || getJakartaTodayIso(),
    startMinute: String(initialSlot?.startMinute ?? 600),
    durationPreset: PRESET_MINUTE_SET.has(Number(defaultDuration)) ? defaultDuration : 'custom',
    customDurationMinutes: defaultDuration === '60' ? '90' : defaultDuration,
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
  const normalizedSettings = useMemo(
    () => normalizePricingSettings(pricingSettings),
    [pricingSettings],
  );

  const [formValues, setFormValues] = useState(() =>
    buildInitialFormValues({ mode, initialSlot, editingBooking, normalizedSettings }),
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
    customerId: generateOperationId('cust'),
  }));

  const [lookupState, setLookupState] = useState({
    status: 'idle', // 'idle' | 'loading' | 'resolved' | 'error'
    phoneNormalized: '',
    result: null,
    error: '',
  });
  const [manualCustomerChoice, setManualCustomerChoice] = useState(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const lookupSeqRef = useRef(0);

  const isEditingOrRescheduling = mode === 'edit' || mode === 'reschedule';
  const editingBookingId = isEditingOrRescheduling ? editingBooking?.id || '' : '';

  const currentPhoneNormalized = useMemo(
    () => normalizePhoneNumber(formValues.phone),
    [formValues.phone],
  );

  // Re-evaluate name match locally whenever customerName changes after a phone lookup succeeded
  const effectiveIdentity = useMemo(() => {
    if (
      isEditingOrRescheduling ||
      lookupState.status !== 'resolved' ||
      !lookupState.result ||
      !currentPhoneNormalized ||
      lookupState.phoneNormalized !== currentPhoneNormalized
    ) {
      return null;
    }

    const profilesById = new Map(
      [
        ...(lookupState.result.activeProfiles || []),
        ...(lookupState.result.historicalProfiles || []),
      ].map((p) => [p.id, p]),
    );

    return resolveCustomerIdentityCandidates({
      inputName: formValues.customerName,
      phoneNormalized: currentPhoneNormalized,
      phoneIndex: lookupState.result.phoneIndex,
      profilesById,
    });
  }, [isEditingOrRescheduling, lookupState, currentPhoneNormalized, formValues.customerName]);

  const activeManualChoice =
    manualCustomerChoice && manualCustomerChoice.phoneNormalized === currentPhoneNormalized
      ? manualCustomerChoice
      : null;

  const runPhoneLookup = async (rawPhone, currentName, { openDialogOnConflict = false } = {}) => {
    if (isEditingOrRescheduling) return null;
    const normalized = normalizePhoneNumber(rawPhone);
    if (!normalized) {
      setLookupState({ status: 'idle', phoneNormalized: '', result: null, error: '' });
      return null;
    }

    const seq = lookupSeqRef.current + 1;
    lookupSeqRef.current = seq;
    setLookupState({ status: 'loading', phoneNormalized: normalized, result: null, error: '' });

    try {
      const result = await lookupCustomerByPhone({
        phone: normalized,
        inputName: currentName,
      });

      if (lookupSeqRef.current !== seq) return null;

      setLookupState({
        status: 'resolved',
        phoneNormalized: normalized,
        result,
        error: '',
      });

      const needsConflictDecision =
        result.status === IDENTITY_MATCH_STATUS.SINGLE_CONFLICT ||
        result.status === IDENTITY_MATCH_STATUS.MULTIPLE_MATCHES;

      if (
        needsConflictDecision &&
        openDialogOnConflict &&
        String(currentName || '').trim().length >= 2
      ) {
        setConflictDialogOpen(true);
      }

      return result;
    } catch (err) {
      if (lookupSeqRef.current !== seq) return null;
      setLookupState({
        status: 'error',
        phoneNormalized: normalized,
        result: null,
        error: mapCustomerErrorToMessage(err),
      });
      return null;
    }
  };

  // Studio Services ONLY (WFA services are excluded from Studio Room Booking Form!)
  const studioServiceOptions = useMemo(() => {
    const activeStudio = (normalizedSettings.serviceTypes || [])
      .filter((svc) => svc.deliveryMode === DELIVERY_MODES.STUDIO && svc.isActive !== false)
      .map((svc) => ({
        ...svc,
        bookableOptions: (svc.options || []).filter(isOptionBookableForStudio),
      }))
      .filter((svc) => svc.bookableOptions.length > 0);

    const historicalServiceId = editingBooking?.serviceTypeId || editingBooking?.serviceId || '';
    if (
      isEditingOrRescheduling &&
      historicalServiceId &&
      !activeStudio.some((svc) => svc.id === historicalServiceId)
    ) {
      const historicalOptionId =
        editingBooking.serviceOptionId ||
        editingBooking.packageId ||
        editingBooking.recordingTypeId ||
        `${historicalServiceId}-snapshot`;

      return [
        ...activeStudio,
        {
          id: historicalServiceId,
          name: `${editingBooking.serviceTypeName || editingBooking.serviceLabel || historicalServiceId} (Snapshot Eksisting)`,
          description: 'Layanan eksisting dari booking lama',
          deliveryMode: editingBooking.deliveryMode || DELIVERY_MODES.STUDIO,
          isHistoricalFallback: true,
          bookableOptions: [
            {
              id: historicalOptionId,
              name:
                editingBooking.serviceOptionName ||
                editingBooking.packageLabel ||
                editingBooking.recordingTypeLabel ||
                'Snapshot Eksisting',
              description: 'Subcategory dari snapshot booking lama',
              isActive: true,
              isHistoricalFallback: true,
              pricing: {
                mode: editingBooking.pricingMode || PRICING_MODES.HOURLY,
                hourlyRate: Number(editingBooking.unitRate) || 0,
                durationMinutes: Number(editingBooking.durationMinutes) || 60,
                basePrice: Number(editingBooking.subtotal) || 0,
                discountAmount: Number(editingBooking.discountAmount) || 0,
                projectPrice: null,
                unitLabel: '',
              },
              discountRules: [],
              fees: {
                staff: { mode: FEE_MODES.NONE, amount: 0 },
                owner: { mode: FEE_MODES.NONE, amount: 0 },
                recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
              },
            },
          ],
        },
      ];
    }

    return activeStudio;
  }, [normalizedSettings.serviceTypes, isEditingOrRescheduling, editingBooking]);

  const selectedServiceType = useMemo(() => {
    return (
      studioServiceOptions.find((svc) => svc.id === formValues.serviceTypeId) ||
      studioServiceOptions[0] ||
      null
    );
  }, [studioServiceOptions, formValues.serviceTypeId]);

  const subcategoryOptions = useMemo(() => {
    const activeOpts = selectedServiceType?.bookableOptions || [];
    const historicalOptionId =
      editingBooking?.serviceOptionId ||
      editingBooking?.packageId ||
      editingBooking?.recordingTypeId ||
      '';
    const historicalServiceId = editingBooking?.serviceTypeId || editingBooking?.serviceId || '';

    if (
      isEditingOrRescheduling &&
      historicalOptionId &&
      selectedServiceType?.id === historicalServiceId &&
      !activeOpts.some((opt) => opt.id === historicalOptionId)
    ) {
      return [
        ...activeOpts,
        {
          id: historicalOptionId,
          name: `${editingBooking.serviceOptionName || editingBooking.packageLabel || editingBooking.recordingTypeLabel || historicalOptionId} (Snapshot Eksisting)`,
          description: 'Subcategory non-aktif dari booking lama',
          isActive: true,
          isHistoricalFallback: true,
          pricing: {
            mode: editingBooking.pricingMode || PRICING_MODES.HOURLY,
            hourlyRate: Number(editingBooking.unitRate) || 0,
            durationMinutes: Number(editingBooking.durationMinutes) || 60,
            basePrice: Number(editingBooking.subtotal) || 0,
            discountAmount: Number(editingBooking.discountAmount) || 0,
            projectPrice: null,
            unitLabel: '',
          },
          discountRules: [],
          fees: {
            staff: { mode: FEE_MODES.NONE, amount: 0 },
            owner: { mode: FEE_MODES.NONE, amount: 0 },
            recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
          },
        },
      ];
    }

    return activeOpts;
  }, [selectedServiceType, isEditingOrRescheduling, editingBooking]);

  const selectedOption = useMemo(() => {
    return (
      subcategoryOptions.find((opt) => opt.id === formValues.serviceOptionId) ||
      subcategoryOptions[0] ||
      null
    );
  }, [subcategoryOptions, formValues.serviceOptionId]);

  const isDurationLockedByFixedShift = Boolean(
    selectedOption?.pricing?.mode === PRICING_MODES.FIXED_SHIFT &&
    Number(selectedOption?.pricing?.durationMinutes) > 0,
  );
  const isManualQuoteOption = selectedOption?.pricing?.mode === PRICING_MODES.MANUAL_QUOTE;
  const hasManualStaffFee = selectedOption?.fees?.staff?.mode === FEE_MODES.MANUAL;
  const hasManualOwnerFee = selectedOption?.fees?.owner?.mode === FEE_MODES.MANUAL;
  const hasManualOperatorFee = selectedOption?.fees?.recordingOperator?.mode === FEE_MODES.MANUAL;
  const hasAnyManualInputs =
    isManualQuoteOption || hasManualStaffFee || hasManualOwnerFee || hasManualOperatorFee;

  // Hourly start options (10:00 – 21:00), plus preserved legacy HH:30 or late-hour option when editing
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
    () => resolveFormDurationMinutes(formValues, normalizedSettings),
    [formValues, normalizedSettings],
  );

  const historicalServiceId = editingBooking?.serviceTypeId || editingBooking?.serviceId || '';
  const historicalOptionId =
    editingBooking?.serviceOptionId ||
    editingBooking?.packageId ||
    editingBooking?.recordingTypeId ||
    '';

  const isServiceScopeChanged = Boolean(
    isEditingOrRescheduling &&
    editingBooking &&
    (formValues.serviceTypeId !== historicalServiceId ||
      (historicalOptionId && formValues.serviceOptionId !== historicalOptionId) ||
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
        serviceTypeId: formValues.serviceTypeId,
        serviceOptionId: formValues.serviceOptionId,
        serviceId: formValues.serviceTypeId,
        durationMinutes: effectiveDurationMinutes,
        manualCustomerPrice: formValues.manualCustomerPrice,
        manualStaffFee: formValues.manualStaffFee,
        manualOwnerFee: formValues.manualOwnerFee,
        manualRecordingOperatorFee: formValues.manualRecordingOperatorFee,
        initialPaymentStatus: isEditingOrRescheduling
          ? editingBooking?.initialPaymentStatus
          : formValues.initialPaymentStatus,
        dpAmount: isEditingOrRescheduling ? editingBooking?.initialPaidAmount : formValues.dpAmount,
        paymentMethod: isEditingOrRescheduling
          ? editingBooking?.paymentMethod
          : formValues.paymentMethod,
        pricingSettings: normalizedSettings,
      }),
    [
      formValues,
      effectiveDurationMinutes,
      isEditingOrRescheduling,
      editingBooking,
      normalizedSettings,
    ],
  );

  const displayedPricing = useMemo(() => {
    if (!shouldUsePreservedSnapshot || !editingBooking) {
      return livePricing;
    }

    const totalAmount = Math.max(0, Number(editingBooking.totalAmount) || 0);
    const initialPaidAmount = Math.max(0, Number(editingBooking.initialPaidAmount) || 0);
    const preservedAutomaticDiscount = editingBooking.automaticDiscount ?? null;
    return {
      ...livePricing,
      durationMinutes: Number(editingBooking.durationMinutes) || effectiveDurationMinutes,
      unitRate: Number(editingBooking.unitRate) || 0,
      subtotal: Number(editingBooking.subtotal) || 0,
      discountAmount: Number(editingBooking.discountAmount) || 0,
      automaticDiscount: preservedAutomaticDiscount,
      durationDiscountConfig: null,
      appliedDiscountName: preservedAutomaticDiscount
        ? 'Diskon Durasi'
        : editingBooking.packageId && Number(editingBooking.discountAmount) > 0
          ? 'Diskon Paket (Snapshot)'
          : Number(editingBooking.discountAmount) > 0
            ? 'Diskon (Snapshot)'
            : '',
      totalAmount,
      initialPaidAmount,
      remainingBalance: Math.max(0, totalAmount - initialPaidAmount),
      commissionSnapshot: editingBooking.commissionSnapshot ?? null,
    };
  }, [shouldUsePreservedSnapshot, editingBooking, livePricing, effectiveDurationMinutes]);

  const displayedCommission = useMemo(
    () => getCommissionSnapshotDisplay(displayedPricing.commissionSnapshot),
    [displayedPricing.commissionSnapshot],
  );

  const liveValidation = useMemo(
    () =>
      validateBookingFormPayload(
        formValues,
        existingBookings,
        editingBookingId,
        normalizedSettings,
        {
          allowedHistoricalServiceIds: historicalServiceId ? [historicalServiceId] : [],
          allowedHistoricalOptionIds: historicalOptionId ? [historicalOptionId] : [],
          skipManualQuoteValidation: shouldUsePreservedSnapshot,
          paymentTotalOverride: shouldUsePreservedSnapshot
            ? editingBooking?.totalAmount
            : undefined,
        },
      ),
    [
      formValues,
      existingBookings,
      editingBookingId,
      normalizedSettings,
      historicalServiceId,
      historicalOptionId,
      shouldUsePreservedSnapshot,
      editingBooking,
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
    if (field === 'phone') {
      const nextNormalized = normalizePhoneNumber(value);
      if (nextNormalized !== lookupState.phoneNormalized) {
        setManualCustomerChoice(null);
        setLookupState((prev) =>
          prev.status === 'idle'
            ? prev
            : { status: 'idle', phoneNormalized: '', result: null, error: '' },
        );
      }
    }
    if (field === 'customerName' && manualCustomerChoice) {
      setManualCustomerChoice(null);
    }
    if (submitError) {
      setSubmitError('');
    }
  };

  const handleSelectServiceType = (nextServiceTypeId) => {
    const nextService = studioServiceOptions.find((svc) => svc.id === nextServiceTypeId);
    const nextDefaultOption =
      nextService?.bookableOptions?.find((opt) => opt.pricing?.mode === PRICING_MODES.HOURLY) ||
      nextService?.bookableOptions?.[0] ||
      null;

    const nextDurationPreset =
      nextDefaultOption?.pricing?.mode === PRICING_MODES.FIXED_SHIFT &&
        nextDefaultOption.pricing.durationMinutes > 0
        ? PRESET_MINUTE_SET.has(nextDefaultOption.pricing.durationMinutes)
          ? String(nextDefaultOption.pricing.durationMinutes)
          : 'custom'
        : formValues.durationPreset;

    setFormValues((prev) => ({
      ...prev,
      serviceTypeId: nextServiceTypeId,
      serviceId: nextServiceTypeId,
      serviceOptionId: nextDefaultOption?.id || '',
      packageId: '',
      recordingTypeId: '',
      // Always reset manual values cleanly when changing service type
      manualCustomerPrice: '',
      manualStaffFee: '0',
      manualOwnerFee: '0',
      manualRecordingOperatorFee: '0',
      durationPreset: nextDurationPreset,
      customDurationMinutes:
        nextDefaultOption?.pricing?.mode === PRICING_MODES.FIXED_SHIFT &&
          nextDefaultOption.pricing.durationMinutes > 0
          ? String(nextDefaultOption.pricing.durationMinutes)
          : prev.customDurationMinutes,
    }));
    if (submitError) setSubmitError('');
  };

  const handleSelectSubcategory = (nextOptionId) => {
    const nextOption = subcategoryOptions.find((opt) => opt.id === nextOptionId);
    const isFixedShift =
      nextOption?.pricing?.mode === PRICING_MODES.FIXED_SHIFT &&
      Number(nextOption.pricing.durationMinutes) > 0;

    setFormValues((prev) => ({
      ...prev,
      serviceOptionId: nextOptionId,
      packageId: '',
      recordingTypeId: '',
      // Never bleed manual values across options
      manualCustomerPrice: '',
      manualStaffFee: '0',
      manualOwnerFee: '0',
      manualRecordingOperatorFee: '0',
      durationPreset: isFixedShift
        ? PRESET_MINUTE_SET.has(Number(nextOption.pricing.durationMinutes))
          ? String(nextOption.pricing.durationMinutes)
          : 'custom'
        : prev.durationPreset,
      customDurationMinutes: isFixedShift
        ? String(nextOption.pricing.durationMinutes)
        : prev.customDurationMinutes,
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

    let customerResolution = null;

    if (!isEditingOrRescheduling) {
      // Never commit when phone lookup previously failed due to network error
      if (
        lookupState.status === 'error' &&
        lookupState.phoneNormalized === currentPhoneNormalized
      ) {
        handleStepSelect('customer');
        setSubmitError(
          'Pencarian nomor HP di Customer Directory gagal. Klik "Coba Cek Lagi" sebelum menyimpan booking.',
        );
        return;
      }

      let resolvedIdentity = effectiveIdentity;
      if (!resolvedIdentity) {
        const freshResult = await runPhoneLookup(formValues.phone, formValues.customerName, {
          openDialogOnConflict: false,
        });
        if (!freshResult) {
          handleStepSelect('customer');
          setSubmitError(
            'Gagal memverifikasi nomor HP pada Customer Directory. Periksa koneksi lalu coba lagi.',
          );
          return;
        }
        resolvedIdentity = freshResult;
      }

      if (activeManualChoice) {
        customerResolution = {
          mode: activeManualChoice.mode,
          customerId: activeManualChoice.customerId,
          expectedPhoneIndexVersion: activeManualChoice.expectedPhoneIndexVersion,
        };
      } else if (
        resolvedIdentity.status === IDENTITY_MATCH_STATUS.NO_MATCH ||
        resolvedIdentity.status === IDENTITY_MATCH_STATUS.HISTORICAL_ONLY
      ) {
        customerResolution = {
          mode: CUSTOMER_RESOLUTION_MODE.CREATE_NEW,
          customerId: operationIds.customerId,
          expectedPhoneIndexVersion: resolvedIdentity.phoneIndexVersion,
        };
      } else if (
        resolvedIdentity.status === IDENTITY_MATCH_STATUS.EXACT_MATCH &&
        resolvedIdentity.matchedProfile
      ) {
        customerResolution = {
          mode: CUSTOMER_RESOLUTION_MODE.REUSE_EXISTING,
          customerId: resolvedIdentity.matchedProfile.id,
          expectedPhoneIndexVersion: resolvedIdentity.phoneIndexVersion,
        };
      } else {
        // SINGLE_CONFLICT or MULTIPLE_MATCHES: require explicit user choice before commit
        handleStepSelect('customer');
        setConflictDialogOpen(true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmitBooking({
        mode,
        bookingId: operationIds.bookingId,
        eventId: operationIds.eventId,
        expectedVersion: editingBooking?.version,
        formValues,
        customerResolution,
      });
      handleDialogOpenChange(false);
    } catch (err) {
      if (
        err?.code === 'booking/stale-customer-identity' ||
        err?.code === 'booking/customer-identity-conflict'
      ) {
        setManualCustomerChoice(null);
        await runPhoneLookup(formValues.phone, formValues.customerName, {
          openDialogOnConflict: true,
        });
      }
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

  const computedStartMinute = Number(formValues.startMinute) || 600;
  const computedEndMinute = computedStartMinute + effectiveDurationMinutes;

  const endTimeOptions = useMemo(() => {
    const options = [];
    for (
      let endMin = computedStartMinute + SLOT_INTERVAL_MINUTES;
      endMin <= OPERATING_END_MINUTE;
      endMin += SLOT_INTERVAL_MINUTES
    ) {
      const durationDiff = endMin - computedStartMinute;
      options.push({
        endMinute: endMin,
        value: String(endMin),
        label: `${formatMinuteOfDay(endMin)} WIB (${formatDurationMinutes(durationDiff)})`,
        disabled: false,
      });
    }

    if (computedEndMinute > OPERATING_END_MINUTE) {
      options.push({
        endMinute: computedEndMinute,
        value: String(computedEndMinute),
        label: `${formatMinuteOfDay(computedEndMinute)} WIB (Melewati 23:00)`,
        disabled: true,
      });
    }

    return options;
  }, [computedStartMinute, computedEndMinute]);

  const handleEndTimeChange = (nextEndMinuteValue) => {
    const nextEndMinute = Number(nextEndMinuteValue);
    const nextDuration = nextEndMinute - computedStartMinute;
    if (
      !Number.isInteger(nextDuration) ||
      nextDuration < SLOT_INTERVAL_MINUTES ||
      nextDuration % SLOT_INTERVAL_MINUTES !== 0
    ) {
      return;
    }

    setFormValues((prev) => ({
      ...prev,
      durationPreset: PRESET_MINUTE_SET.has(nextDuration) ? String(nextDuration) : 'custom',
      customDurationMinutes: String(nextDuration),
    }));
    setTouchedFields((prev) => ({
      ...prev,
      durationMinutes: true,
    }));
    if (submitError) {
      setSubmitError('');
    }
  };

  return (
    <>
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
                    Lengkapi empat tahap operasional di bawah. Konflik jadwal, harga, dan fee internal
                    dihitung secara otomatis.
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
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 border px-2.5 py-1.5 text-left transition-colors ${isStepActive
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
                          className={`flex h-4 w-4 shrink-0 items-center justify-center border ${isStepActive
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
                        onBlur={() => {
                          if (!isEditingOrRescheduling && currentPhoneNormalized) {
                            runPhoneLookup(formValues.phone, formValues.customerName, {
                              openDialogOnConflict: true,
                            });
                          }
                        }}
                        placeholder="Contoh: 081234567890"
                        className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-bold"
                      />
                      {shouldShowFieldError('phone') ? (
                        <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                          {liveValidation.errors.phone}
                        </p>
                      ) : null}
                    </div>

                    {/* Customer Identity Resolution Status Panel (Phase 7) */}
                    {isEditingOrRescheduling ? (
                      <div className="border-studio-ink bg-studio-ivory flex items-start gap-2.5 border p-3 text-xs sm:col-span-2">
                        <Info
                          className="text-studio-ink mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] font-extrabold uppercase">
                            Profil Customer Tetap Terjaga
                          </p>
                          <p className="text-studio-muted-ink mt-0.5 leading-relaxed font-medium">
                            Perubahan nama atau nomor HP pada form ini hanya memperbarui snapshot
                            kontak booking. Perubahan nomor utama customer dilakukan melalui halaman{' '}
                            <strong>Customer</strong>.
                          </p>
                        </div>
                      </div>
                    ) : lookupState.status === 'loading' ? (
                      <div
                        role="status"
                        className="border-studio-ink bg-studio-ivory flex items-center gap-2 border px-3 py-2.5 font-mono text-[11px] font-bold sm:col-span-2"
                      >
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Memeriksa nomor HP pada Customer Directory...</span>
                      </div>
                    ) : lookupState.status === 'error' ? (
                      <div
                        role="alert"
                        className="border-studio-ink bg-studio-orange/15 flex flex-wrap items-center justify-between gap-2 border-2 p-3 text-xs sm:col-span-2"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle
                            className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="font-mono text-[10px] font-extrabold text-[#b92b0c] uppercase">
                              Gagal Memeriksa Nomor HP
                            </p>
                            <p className="text-studio-ink mt-0.5 font-semibold">
                              {lookupState.error}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            runPhoneLookup(formValues.phone, formValues.customerName, {
                              openDialogOnConflict: true,
                            })
                          }
                          className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3 py-1 font-mono text-[10px] font-extrabold uppercase"
                        >
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          <span>Coba Cek Lagi</span>
                        </button>
                      </div>
                    ) : activeManualChoice ? (
                      <div className="border-studio-ink bg-studio-lime/25 flex flex-wrap items-center justify-between gap-2 border-2 p-3 text-xs sm:col-span-2">
                        <div className="flex items-start gap-2">
                          <UserCheck
                            className="text-studio-ink mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <span className="border-studio-ink bg-studio-lime text-studio-ink inline-block border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                              {activeManualChoice.mode === CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE
                                ? 'PROFIL TERPISAH (SHARED NUMBER)'
                                : 'DIGABUNGKAN KE PROFIL EXISTING'}
                            </span>
                            <p className="text-studio-ink mt-1 font-semibold">
                              {activeManualChoice.mode === CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE
                                ? `Akan membuat profil terpisah untuk "${formValues.customerName || '-'}" dengan nomor ${formatPhoneDisplay(currentPhoneNormalized)}.`
                                : `Booking akan masuk ke riwayat "${activeManualChoice.profileName}" dan nama baru dicatat sebagai alias.`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConflictDialogOpen(true)}
                          className="border-studio-ink bg-studio-white text-studio-ink min-h-9 cursor-pointer border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase"
                        >
                          Ubah Pilihan
                        </button>
                      </div>
                    ) : effectiveIdentity?.status === IDENTITY_MATCH_STATUS.EXACT_MATCH &&
                      effectiveIdentity.matchedProfile ? (
                      <div className="border-studio-ink bg-studio-lime/25 flex items-start gap-2.5 border-2 p-3 text-xs sm:col-span-2">
                        <UserCheck
                          className="text-studio-ink mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <span className="border-studio-ink bg-studio-lime text-studio-ink inline-block border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                            CUSTOMER EXISTING
                          </span>
                          <p className="text-studio-ink mt-1 font-semibold">
                            Cocok dengan profil{' '}
                            <strong>{effectiveIdentity.matchedProfile.displayName}</strong> (
                            {effectiveIdentity.matchedProfile.bookingCount} booking) •{' '}
                            <span className="font-mono">
                              {formatPhoneDisplay(currentPhoneNormalized)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ) : effectiveIdentity?.status === IDENTITY_MATCH_STATUS.NO_MATCH ? (
                      <div className="border-studio-ink bg-studio-ivory flex items-start gap-2.5 border p-3 text-xs sm:col-span-2">
                        <UserPlus
                          className="text-studio-ink mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <span className="border-studio-ink bg-studio-white text-studio-ink inline-block border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                            NEW CUSTOMER
                          </span>
                          <p className="text-studio-muted-ink mt-1 font-semibold">
                            Nomor{' '}
                            <span className="text-studio-ink font-mono font-bold">
                              {formatPhoneDisplay(currentPhoneNormalized)}
                            </span>{' '}
                            belum terdaftar. Profil customer akan otomatis dibuat saat booking
                            disimpan.
                          </p>
                        </div>
                      </div>
                    ) : effectiveIdentity?.status === IDENTITY_MATCH_STATUS.HISTORICAL_ONLY ? (
                      <div className="border-studio-ink flex items-start gap-2.5 border-2 bg-amber-100 p-3 text-xs sm:col-span-2">
                        <AlertTriangle
                          className="text-studio-ink mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <span className="border-studio-ink bg-studio-ink text-studio-lime inline-block border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                            NOMOR HISTORIS (RECYCLED)
                          </span>
                          <p className="text-studio-ink mt-1 font-semibold">
                            Nomor ini pernah tercatat sebagai nomor lama / arsip customer lain.
                            Booking baru akan membuat <strong>profil customer terpisah</strong> tanpa
                            menggabungkan riwayat lama.
                          </p>
                        </div>
                      </div>
                    ) : effectiveIdentity?.status === IDENTITY_MATCH_STATUS.SINGLE_CONFLICT ||
                      effectiveIdentity?.status === IDENTITY_MATCH_STATUS.MULTIPLE_MATCHES ? (
                      <div
                        role="alert"
                        className="border-studio-ink bg-studio-orange/15 flex flex-wrap items-center justify-between gap-2.5 border-2 p-3 text-xs sm:col-span-2"
                      >
                        <div className="flex items-start gap-2">
                          <Users
                            className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <span className="border-studio-ink bg-studio-orange text-studio-white inline-block border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                              {effectiveIdentity.status === IDENTITY_MATCH_STATUS.MULTIPLE_MATCHES
                                ? `SHARED NUMBER (${effectiveIdentity.activeProfiles.length} PROFIL)`
                                : 'NOMOR SUDAH TERDAFTAR'}
                            </span>
                            <p className="text-studio-ink mt-1 font-semibold">
                              {effectiveIdentity.status === IDENTITY_MATCH_STATUS.MULTIPLE_MATCHES
                                ? 'Nomor ini dipakai beberapa profil customer. Pilih profil atau buat profil terpisah.'
                                : `Nomor ini digunakan oleh "${effectiveIdentity.matchedProfile?.displayName}". Konfirmasi apakah ingin menggabungkan riwayat atau memisahkan profil.`}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setConflictDialogOpen(true)}
                          className="brutal-btn bg-studio-lime text-studio-ink min-h-10 cursor-pointer px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase"
                        >
                          Pilih Profil
                        </button>
                      </div>
                    ) : null}

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
                        placeholder="Contoh: The Velvet Echo / Solo Project"
                        className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                      />
                    </div>
                  </div>
                </section>

                {/* STEP 02: SEQUENTIAL STUDIO SERVICE & SUBCATEGORY SECTION (V2) */}
                <section
                  ref={serviceSectionRef}
                  aria-labelledby="step-service-heading"
                  onFocusCapture={() => setActiveStep('service')}
                  className="brutal-card bg-studio-white p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                    <div>
                      <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                        TAHAP 02 • JENIS JASA &amp; SUBCATEGORY
                      </span>
                      <h3
                        id="step-service-heading"
                        className="font-display text-studio-ink text-xl font-black uppercase"
                      >
                        Layanan Studio
                      </h3>
                    </div>

                    <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                      {isManualQuoteOption
                        ? 'Manual Quote'
                        : `Tarif: ${formatRupiah(displayedPricing.unitRate)}/jam`}
                    </span>
                  </div>

                  {/* Step 02A: Jenis Jasa (Studio Services Only) */}
                  <div className="mt-4">
                    <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                      1. Pilih Jenis Jasa (Studio) <span className="text-studio-orange">*</span>
                    </span>

                    <div
                      role="group"
                      aria-label="Pilih layanan studio"
                      className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                    >
                      {studioServiceOptions.map((service) => {
                        const isSelected = selectedServiceType?.id === service.id;
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => handleSelectServiceType(service.id)}
                            aria-pressed={isSelected}
                            className={`flex min-h-14 cursor-pointer flex-col justify-between border-2 p-3 text-left transition-colors ${isSelected
                              ? 'border-studio-ink bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                              : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-display text-lg leading-none font-black uppercase">
                                {service.name}
                              </span>
                              <span className="font-mono text-[10px] font-extrabold uppercase">
                                {service.bookableOptions.length} opsi
                              </span>
                            </div>
                            {service.description ? (
                              <span className="text-studio-muted-ink mt-1 text-xs font-medium">
                                {service.description}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {shouldShowFieldError('serviceId') ? (
                      <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-bold">
                        {liveValidation.errors.serviceId}
                      </p>
                    ) : null}
                  </div>

                  {/* Step 02B: Subcategory / Paket under selected Jenis Jasa */}
                  <div className="mt-4">
                    <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                      2. Pilih Subcategory / Paket ({selectedServiceType?.name || 'Studio'}){' '}
                      <span className="text-studio-orange">*</span>
                    </span>

                    <div
                      role="group"
                      aria-label="Pilih subcategory layanan"
                      className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
                    >
                      {subcategoryOptions.map((option) => {
                        const isSelected = selectedOption?.id === option.id;
                        const summary = formatOptionPricingSummary(option);
                        const activeBlockRule = (option.discountRules || []).find(
                          (r) =>
                            r.isActive !== false &&
                            r.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK &&
                            r.intervalMinutes > 0 &&
                            r.discountAmount > 0,
                        );

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleSelectSubcategory(option.id)}
                            aria-pressed={isSelected}
                            className={`flex min-h-14 cursor-pointer flex-col justify-between border-2 p-3 text-left transition-colors ${isSelected
                              ? 'border-studio-ink bg-studio-ink text-studio-white shadow-[2px_2px_0px_#151515]'
                              : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-display text-lg leading-none font-black uppercase">
                                {option.name}
                              </span>
                              <span
                                className={`shrink-0 font-mono text-[11px] font-extrabold ${isSelected ? 'text-studio-lime' : 'text-studio-ink'
                                  }`}
                              >
                                {summary.primary}
                              </span>
                            </div>

                            {option.description ? (
                              <span
                                className={`mt-1 text-xs font-medium ${isSelected ? 'text-neutral-300' : 'text-studio-muted-ink'
                                  }`}
                              >
                                {option.description}
                              </span>
                            ) : null}

                            {activeBlockRule ? (
                              <span
                                className={`mt-1.5 inline-block font-mono text-[10px] font-extrabold ${isSelected ? 'text-studio-lime' : 'text-emerald-800'
                                  }`}
                              >
                                Diskon Durasi -{formatRupiah(activeBlockRule.discountAmount)} /{' '}
                                {formatDurationMinutes(activeBlockRule.intervalMinutes)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {shouldShowFieldError('serviceOptionId') ? (
                      <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-bold">
                        {liveValidation.errors.serviceOptionId}
                      </p>
                    ) : null}
                  </div>

                  {/* Manual Quote & Manual Internal Fee Inputs (e.g. Recording Others) */}
                  {hasAnyManualInputs ? (
                    <div className="border-studio-ink bg-studio-ivory mt-4 space-y-4 border-2 p-4">
                      {isManualQuoteOption ? (
                        <div>
                          <p className="font-mono text-[11px] font-extrabold tracking-wider uppercase">
                            CUSTOMER PRICE (MANUAL QUOTE)
                          </p>
                          <div className="mt-2">
                            <label
                              htmlFor="booking-manual-customer-price"
                              className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                            >
                              Harga Manual (IDR) <span className="text-studio-orange">*</span>
                            </label>
                            <input
                              id="booking-manual-customer-price"
                              type="text"
                              inputMode="numeric"
                              value={formValues.manualCustomerPrice}
                              onChange={(e) =>
                                handleFieldChange(
                                  'manualCustomerPrice',
                                  e.target.value.replace(/\D/g, ''),
                                )
                              }
                              placeholder="Contoh: 350000"
                              className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                            />
                            {shouldShowFieldError('manualCustomerPrice') ? (
                              <p
                                role="alert"
                                className="text-studio-error-ink mt-1 text-xs font-bold"
                              >
                                {liveValidation.errors.manualCustomerPrice}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {hasManualStaffFee || hasManualOwnerFee || hasManualOperatorFee ? (
                        <div
                          className={isManualQuoteOption ? 'border-t border-neutral-300 pt-3' : ''}
                        >
                          <p className="font-mono text-[11px] font-extrabold tracking-wider uppercase">
                            INTERNAL FEES (INPUT MANUAL — TIDAK MASUK TAGIHAN CUSTOMER)
                          </p>
                          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {hasManualStaffFee ? (
                              <div>
                                <label
                                  htmlFor="booking-manual-staff-fee"
                                  className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                                >
                                  Staff Fee (IDR)
                                </label>
                                <input
                                  id="booking-manual-staff-fee"
                                  type="text"
                                  inputMode="numeric"
                                  value={formValues.manualStaffFee}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      'manualStaffFee',
                                      e.target.value.replace(/\D/g, ''),
                                    )
                                  }
                                  placeholder="0"
                                  className="border-studio-ink bg-studio-white text-studio-ink mt-1 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                                />
                              </div>
                            ) : null}

                            {hasManualOwnerFee ? (
                              <div>
                                <label
                                  htmlFor="booking-manual-owner-fee"
                                  className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                                >
                                  Owner Fee (IDR)
                                </label>
                                <input
                                  id="booking-manual-owner-fee"
                                  type="text"
                                  inputMode="numeric"
                                  value={formValues.manualOwnerFee}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      'manualOwnerFee',
                                      e.target.value.replace(/\D/g, ''),
                                    )
                                  }
                                  placeholder="0"
                                  className="border-studio-ink bg-studio-white text-studio-ink mt-1 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                                />
                              </div>
                            ) : null}

                            {hasManualOperatorFee ? (
                              <div>
                                <label
                                  htmlFor="booking-manual-operator-fee"
                                  className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                                >
                                  Recording Operator Fee (IDR)
                                </label>
                                <input
                                  id="booking-manual-operator-fee"
                                  type="text"
                                  inputMode="numeric"
                                  value={formValues.manualRecordingOperatorFee}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      'manualRecordingOperatorFee',
                                      e.target.value.replace(/\D/g, ''),
                                    )
                                  }
                                  placeholder="0"
                                  className="border-studio-ink bg-studio-white text-studio-ink mt-1 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
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
                            className={`flex min-h-14 cursor-pointer flex-col justify-between border-2 p-3 text-left transition-colors ${isSelected
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
                              className={`mt-1 text-xs font-medium ${isSelected ? 'text-neutral-300' : 'text-studio-muted-ink'
                                }`}
                            >
                              {room.subtitle}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date, Start Time & End Time */}
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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

                    <div>
                      <label
                        htmlFor="booking-end-minute"
                        className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                      >
                        Jam Selesai (Maks. 23:00 WIB)
                      </label>
                      <select
                        id="booking-end-minute"
                        disabled={isDurationLockedByFixedShift}
                        value={String(computedEndMinute)}
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                        className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {endTimeOptions.map((slot) => (
                          <option key={slot.endMinute} value={slot.value} disabled={slot.disabled}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Duration Preset & Custom Duration (30-min intervals) */}
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                        Durasi Sesi <span className="text-studio-orange">*</span>
                      </span>
                      {isDurationLockedByFixedShift ? (
                        <span className="font-mono text-[10px] font-bold text-emerald-800 uppercase">
                          Terkunci oleh Fixed Shift ({formatDurationMinutes(effectiveDurationMinutes)}
                          )
                        </span>
                      ) : null}
                    </div>

                    <div
                      role="group"
                      aria-label="Pilih durasi sesi"
                      className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
                    >
                      {DURATION_PRESET_OPTIONS.map((option) => {
                        const isSelected = formValues.durationPreset === option.key;

                        return (
                          <button
                            key={option.key}
                            type="button"
                            disabled={isDurationLockedByFixedShift}
                            onClick={() => handleFieldChange('durationPreset', option.key)}
                            aria-pressed={isSelected}
                            className={`min-h-11 cursor-pointer border-2 px-2.5 py-1.5 font-mono text-xs font-extrabold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isSelected
                              ? 'border-studio-ink bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                              : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
                              }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    {formValues.durationPreset === 'custom' && !isDurationLockedByFixedShift ? (
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
                                className={`flex min-h-14 cursor-pointer flex-col justify-between border-2 p-3 text-left transition-colors ${isSelected
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

                  {/* Historical Price Protection Banner when Service/Subcategory/Duration changed on Edit */}
                  {isEditingOrRescheduling && isServiceScopeChanged ? (
                    <div className="border-studio-ink mt-4 border-2 bg-amber-100 p-3.5">
                      <p className="font-mono text-xs font-extrabold uppercase">
                        Konfirmasi Perubahan Harga &amp; Fee Snapshot
                      </p>
                      <p className="text-studio-ink mt-1 text-xs leading-relaxed font-medium">
                        Anda mengubah jenis jasa, subcategory, atau durasi pada booking lama. Secara
                        default snapshot harga &amp; fee sebelumnya tetap dipertahankan (
                        <strong>{formatRupiah(editingBooking?.totalAmount)}</strong>). Centang opsi di
                        bawah hanya jika Anda ingin menerapkan preset harga &amp; fee terbaru (
                        <strong>{formatRupiah(livePricing.totalAmount)}</strong>) — snapshot fee
                        internal juga akan diperbarui.
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

                  {/* Live Pricing Breakdown Summary Card: CUSTOMER BILL + INTERNAL FEE ESTIMATE */}
                  <div className="border-studio-ink bg-studio-ivory mt-4 grid grid-cols-1 gap-4 border-2 p-4 md:grid-cols-2">
                    <div>
                      <p className="font-mono text-xs font-extrabold tracking-wider uppercase">
                        CUSTOMER BILL
                      </p>

                      <dl className="mt-2.5 space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <dt className="text-studio-muted-ink">
                            {displayedPricing.serviceId === 'rehearsal'
                              ? 'Durasi Latihan'
                              : 'Durasi Sesi'}
                          </dt>
                          <dd className="font-bold">
                            {formatDurationMinutes(displayedPricing.durationMinutes)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-studio-muted-ink">Harga Normal</dt>
                          <dd className="font-bold">{formatRupiah(displayedPricing.subtotal)}</dd>
                        </div>
                        {displayedPricing.discountAmount > 0 ? (
                          <div className="space-y-0.5 text-emerald-800">
                            <div className="flex items-center justify-between">
                              <dt>{displayedPricing.appliedDiscountName || 'Diskon Durasi'}</dt>
                              <dd className="font-bold">
                                -{formatRupiah(displayedPricing.discountAmount)}
                              </dd>
                            </div>
                            {displayedPricing.automaticDiscount ? (
                              <p className="text-[10px] font-semibold text-emerald-900">
                                {displayedPricing.automaticDiscount.eligibleBlocks}x kelipatan{' '}
                                {formatDurationMinutes(
                                  displayedPricing.automaticDiscount.intervalMinutes,
                                )}{' '}
                                (-{formatRupiah(displayedPricing.automaticDiscount.discountPerBlock)})
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="border-studio-ink flex items-center justify-between border-t pt-1.5 text-sm font-extrabold">
                          <dt>Total Pembayaran</dt>
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

                      {displayedPricing.durationDiscountConfig?.enabled &&
                        displayedPricing.durationDiscountConfig?.intervalMinutes > 0 &&
                        displayedPricing.durationDiscountConfig?.discountAmount > 0 ? (
                        <p className="border-studio-ink bg-studio-white text-studio-ink mt-3 border px-2.5 py-2 font-mono text-[10px] leading-relaxed font-semibold">
                          Diskon Durasi otomatis:{' '}
                          <strong className="text-emerald-800">
                            hemat{' '}
                            {formatRupiah(displayedPricing.durationDiscountConfig.discountAmount)}
                          </strong>{' '}
                          berlaku setiap kelipatan{' '}
                          <strong>
                            {formatDurationMinutes(
                              displayedPricing.durationDiscountConfig.intervalMinutes,
                            )}
                          </strong>{' '}
                          tanpa kode promo atau paket khusus.
                        </p>
                      ) : null}
                    </div>

                    <div className="border-studio-ink border-t pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4">
                      <p className="font-mono text-xs font-extrabold tracking-wider uppercase">
                        INTERNAL FEE ESTIMATE
                      </p>
                      <p className="text-studio-muted-ink mt-0.5 text-[11px] font-medium">
                        Estimasi operasional internal studio (tidak memengaruhi tagihan customer).
                      </p>

                      {displayedCommission ? (
                        <dl className="mt-2.5 space-y-1.5 font-mono text-xs">
                          <div className="flex items-center justify-between">
                            <dt className="text-studio-muted-ink">Staff Fee</dt>
                            <dd className="font-bold">
                              {formatRupiah(displayedCommission.staff.amount)}
                            </dd>
                          </div>
                          {displayedCommission.owner ? (
                            <div className="flex items-center justify-between">
                              <dt className="text-studio-muted-ink">Owner Fee</dt>
                              <dd className="font-bold">
                                {formatRupiah(displayedCommission.owner.amount)}
                              </dd>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between">
                            <dt className="text-studio-muted-ink">Recording Operator Fee</dt>
                            <dd className="font-bold">
                              {formatRupiah(displayedCommission.recordingOperator.amount)}
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

      <CustomerIdentityConflictDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        matchStatus={effectiveIdentity?.status}
        inputName={formValues.customerName}
        phoneNormalized={currentPhoneNormalized}
        activeProfiles={effectiveIdentity?.activeProfiles || []}
        onSelectMerge={(profile) => {
          setManualCustomerChoice({
            mode: CUSTOMER_RESOLUTION_MODE.MERGE_INTO_EXISTING,
            customerId: profile.id,
            profileName: profile.displayName,
            phoneNormalized: currentPhoneNormalized,
            expectedPhoneIndexVersion: effectiveIdentity?.phoneIndexVersion ?? 0,
          });
          setConflictDialogOpen(false);
          if (submitError) setSubmitError('');
        }}
        onSelectSeparate={() => {
          setManualCustomerChoice({
            mode: CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE,
            customerId: operationIds.customerId,
            profileName: formValues.customerName,
            phoneNormalized: currentPhoneNormalized,
            expectedPhoneIndexVersion: effectiveIdentity?.phoneIndexVersion ?? 0,
          });
          setConflictDialogOpen(false);
          if (submitError) setSubmitError('');
        }}
        onReviewAgain={() => {
          setConflictDialogOpen(false);
        }}
      />
    </>
  );
}
