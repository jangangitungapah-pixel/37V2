import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Info,
  Loader2,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';

import {
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_TYPES,
  PUBLIC_DURATION_OPTION_VALUES,
  PUBLIC_MIN_ELAPSED_MS,
  PUBLIC_START_TIME_SLOTS,
  PUBLIC_SUBMIT_COOLDOWN_MS,
} from '@/features/admin/booking-requests/config/booking-request-config';
import {
  mapBookingRequestErrorToMessage,
  submitPublicBookingRequest,
} from '@/features/admin/booking-requests/services/booking-request-service';
import { formatRequestDurationLabel } from '@/features/admin/booking-requests/utils/booking-request-normalize';
import { buildWhatsAppClickToChatUrl } from '@/features/admin/booking-requests/services/whatsapp-message-service';
import { getTodayLocalDateString } from '@/lib/booking-date';

const lazyBookingResolver = async (values, context, options) => {
  const { bookingInquiryResolver } = await import('./bookingInquirySchema');
  return bookingInquiryResolver(values, context, options);
};

const SERVICE_OPTIONS = [
  { id: 'rehearsal', label: 'Rehearsal' },
  { id: 'recording', label: 'Recording' },
  { id: 'mix-master', label: 'Mix & Master' },
];

const ROOM_OPTIONS = [
  { id: 'room-a', label: 'Room A — Live Room' },
  { id: 'room-b', label: 'Room B — Control + Booth' },
  { id: 'any', label: 'No preference / Recommend' },
];

const DEFAULT_MIN_ELAPSED_MS =
  import.meta.env.MODE === 'test' ? 0 : PUBLIC_MIN_ELAPSED_MS;
const DEFAULT_COOLDOWN_MS =
  import.meta.env.MODE === 'test' ? 0 : PUBLIC_SUBMIT_COOLDOWN_MS;

export function BookingSection({
  bookingSection,
  selectedService,
  selectedRoom,
  selectedDate,
  selectedTime,
  selectedDuration,
  selectionVersion = 0,
  preselectionNotice,
  onClearPreselectionNotice,
  publicWhatsappNumber = '',
  studioName = '37 Music Studio',
  requestSource = BOOKING_REQUEST_SOURCES.PUBLIC_LANDING_PAGE,
  minSubmitElapsedMs = DEFAULT_MIN_ELAPSED_MS,
  submitCooldownMs = DEFAULT_COOLDOWN_MS,
}) {
  const [todayDate, setTodayDate] = useState(() => getTodayLocalDateString());
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [submitErrorState, setSubmitErrorState] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formOpenedAtRef = useRef(0);
  const submittingLockRef = useRef(false);

  useEffect(() => {
    if (!formOpenedAtRef.current) {
      formOpenedAtRef.current = Date.now();
    }
  }, []);

  const submittedData =
    submittedRequest && submittedRequest.version === selectionVersion
      ? submittedRequest.record
      : null;

  const submitError =
    submitErrorState && submitErrorState.version === selectionVersion
      ? submitErrorState.message
      : '';

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm({
    resolver: lazyBookingResolver,
    defaultValues: {
      clientName: '',
      bandName: '',
      contactNumber: '',
      service: selectedService || 'rehearsal',
      room: selectedRoom || 'room-a',
      preferredDate: selectedDate || todayDate,
      preferredTime: selectedTime || '19:00',
      duration: selectedDuration === '6+ hours' ? '6 hours' : selectedDuration || '2 hours',
      targetDeadline: '',
      notes: '',
      privacyConsent: false,
      website: '',
    },
  });

  const activeService = useWatch({ control, name: 'service' });
  const activeRoom = useWatch({ control, name: 'room' });
  const activeDate = useWatch({ control, name: 'preferredDate' });
  const notesValue = useWatch({ control, name: 'notes' });
  const notesLength = (notesValue || '').length;
  const isPostProduction = activeService === 'mix-master';

  useEffect(() => {
    if (selectionVersion > 0) {
      if (selectedService) {
        setValue('service', selectedService, { shouldValidate: true });
      }
      if (selectedRoom) {
        setValue('room', selectedRoom, { shouldValidate: true });
      }
      if (selectedDate) {
        setValue('preferredDate', selectedDate, { shouldValidate: true });
      }
      if (selectedTime) {
        setValue('preferredTime', selectedTime, { shouldValidate: true });
      }
      if (selectedDuration) {
        setValue(
          'duration',
          selectedDuration === '6+ hours' ? '6 hours' : selectedDuration,
          { shouldValidate: true },
        );
      }
    }
  }, [
    selectedService,
    selectedRoom,
    selectedDate,
    selectedTime,
    selectedDuration,
    selectionVersion,
    setValue,
  ]);

  const refreshTodayDate = () => {
    const currentToday = getTodayLocalDateString();
    if (currentToday !== todayDate) {
      setTodayDate(currentToday);
    }
    return currentToday;
  };

  const onSubmit = async (values) => {
    if (submittingLockRef.current || isSubmitting) return;
    submittingLockRef.current = true;
    setIsSubmitting(true);
    setSubmitErrorState(null);

    try {
      const created = await submitPublicBookingRequest({
        input: {
          customerName: values.clientName,
          bandName: values.bandName || '',
          contactPhone: values.contactNumber,
          publicServiceId: values.service,
          requestedRoomId: values.service === 'mix-master' ? null : values.room,
          preferredDate: values.service === 'mix-master' ? null : values.preferredDate,
          preferredTime: values.service === 'mix-master' ? '' : values.preferredTime,
          duration: values.service === 'mix-master' ? '' : values.duration,
          targetDeadline: values.service === 'mix-master' ? values.targetDeadline : '',
          notes: values.notes || '',
          privacyConsent: values.privacyConsent === true,
        },
        source: requestSource,
        honeypotValue: values.website || '',
        formOpenedAtMs: formOpenedAtRef.current,
        minElapsedMs: minSubmitElapsedMs,
        cooldownMs: submitCooldownMs,
      });

      setSubmittedRequest({
        version: selectionVersion,
        record: created,
      });
    } catch (err) {
      setSubmitErrorState({
        version: selectionVersion,
        message: mapBookingRequestErrorToMessage(err),
      });
    } finally {
      submittingLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleResetNew = () => {
    const currentToday = refreshTodayDate();
    formOpenedAtRef.current = Date.now();
    setSubmittedRequest(null);
    setSubmitErrorState(null);
    onClearPreselectionNotice?.();
    reset({
      clientName: '',
      bandName: '',
      contactNumber: '',
      service: 'rehearsal',
      room: 'room-a',
      preferredDate: currentToday,
      preferredTime: '19:00',
      duration: '2 hours',
      targetDeadline: '',
      notes: '',
      privacyConsent: false,
      website: '',
    });
  };

  const availabilityCalendarHref = `/availability?${new URLSearchParams({
    ...(activeRoom && activeRoom !== 'any' ? { room: activeRoom } : {}),
    ...(activeDate ? { date: activeDate } : {}),
    ...(activeService ? { service: activeService } : {}),
  }).toString()}`;

  const studioWhatsAppLink =
    submittedData && publicWhatsappNumber
      ? buildWhatsAppClickToChatUrl({
        phone: publicWhatsappNumber,
        message: `Halo ${studioName}, saya baru saja mengirimkan booking request (${submittedData.requestReference}) untuk ${submittedData.serviceLabelSnapshot} atas nama ${submittedData.customerName}.`,
      })
      : null;

  return (
    <section
      id="how-to-book"
      aria-labelledby="booking-process-heading"
      className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-10 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        <div className="brutal-card-lg bg-studio-white grid grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* Left Panel: Black 3-Step Process + Public Availability Link */}
          <div className="border-studio-ink bg-studio-ink text-studio-white flex flex-col justify-between border-b-2 p-5 sm:p-8 lg:col-span-5 lg:border-r-2 lg:border-b-0 lg:p-10">
            <div>
              <span className="bg-studio-lime text-studio-ink inline-block px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px]">
                {bookingSection.process.eyebrow}
              </span>

              <h2
                id="booking-process-heading"
                className="font-display text-studio-white mt-3 text-3xl leading-none font-black tracking-tight uppercase sm:mt-4 sm:text-5xl"
              >
                {bookingSection.process.heading}
              </h2>

              <ol className="mt-5 space-y-3 sm:mt-6 sm:space-y-4">
                {bookingSection.process.steps.map((step) => (
                  <li
                    key={step.number}
                    className="border border-neutral-700 bg-neutral-900/90 p-3.5 sm:p-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="bg-studio-orange text-studio-white flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs font-extrabold">
                        {step.number}
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold tracking-wide uppercase sm:text-base">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-300">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Public Calendar Quick Check Box */}
              <div className="border-studio-lime/40 mt-6 border bg-neutral-900 p-4">
                <p className="font-mono text-xs font-extrabold text-[#C8F13A] uppercase">
                  Want to check open slots first?
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-300">
                  Inspect Room A and Room B 30-minute availability blocks before sending your
                  preferred inquiry time.
                </p>
                <Link
                  to={availabilityCalendarHref}
                  className="text-studio-lime mt-2.5 inline-flex items-center gap-1.5 font-mono text-xs font-extrabold uppercase hover:underline"
                >
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Open Public Availability Calendar →</span>
                </Link>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 border-t border-neutral-800 pt-5">
              <div className="flex -space-x-2" aria-hidden="true">
                <span className="border-studio-ink bg-studio-lime text-studio-ink flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[10px] font-bold">
                  37
                </span>
                <span className="border-studio-ink bg-studio-orange text-studio-white flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[10px] font-bold">
                  A
                </span>
                <span className="border-studio-ink bg-studio-ivory text-studio-ink flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[10px] font-bold">
                  B
                </span>
              </div>
              <p className="font-mono text-[11px] text-neutral-300">
                {bookingSection.process.reassuranceNote}
              </p>
            </div>
          </div>

          {/* Right Panel: Production Booking Request Form */}
          <div
            id="booking"
            className="bg-studio-white text-studio-ink scroll-mt-20 p-5 sm:p-8 lg:col-span-7 lg:p-10"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">
                  {bookingSection.form.heading}
                </h2>
                <p className="text-studio-muted-ink mt-1.5 text-xs font-medium sm:text-sm">
                  {bookingSection.form.subtitle}
                </p>
              </div>
              <span className="border-studio-ink bg-studio-lime border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase">
                10:00 – 23:00 WIB
              </span>
            </div>

            {/* Required Public Availability Disclaimer Notice */}
            <div
              data-testid="booking-availability-disclaimer"
              className="border-studio-ink/20 bg-studio-ivory mt-4 flex items-start gap-2.5 border p-3 text-xs"
            >
              <ShieldAlert
                className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span className="text-studio-ink font-medium">
                Availability may change. A public slot selection is a preference only — final
                confirmation is subject to studio verification.
              </span>
            </div>

            {preselectionNotice ? (
              <div
                role="status"
                aria-live="polite"
                data-testid="booking-preselection-notice"
                className="border-studio-ink bg-studio-lime text-studio-ink mt-4 flex items-center justify-between gap-2 border-2 px-3.5 py-2 text-xs font-bold"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{preselectionNotice}</span>
                </span>
                <button
                  type="button"
                  onClick={onClearPreselectionNotice}
                  className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center px-2 underline"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {submittedData ? (
              <div
                role="status"
                aria-live="polite"
                data-testid="booking-request-success-panel"
                className="border-studio-ink bg-studio-ivory mt-6 border-2 p-5 shadow-[4px_4px_0px_#151515]"
              >
                <div className="flex items-start gap-3">
                  <span className="border-studio-ink bg-studio-lime flex h-9 w-9 shrink-0 items-center justify-center border-2">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <span className="bg-studio-ink text-studio-ivory inline-block px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                      Reference: {submittedData.requestReference}
                    </span>
                    <h3 className="font-display mt-2 text-2xl leading-none font-black uppercase">
                      Booking request received
                    </h3>
                    <p className="text-studio-ink mt-2 text-sm leading-relaxed font-semibold">
                      Your request has been received. This is not a confirmed reservation. The studio
                      team will contact you to verify availability and finalize your session.
                    </p>
                  </div>
                </div>

                <dl className="border-studio-ink bg-studio-white mt-4 grid grid-cols-1 gap-2.5 border-[1.5px] p-4 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Request Reference
                    </dt>
                    <dd className="font-mono font-extrabold">{submittedData.requestReference}</dd>
                  </div>
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Client / Band
                    </dt>
                    <dd className="font-bold">
                      {submittedData.customerName}
                      {submittedData.bandName ? ` (${submittedData.bandName})` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Contact / WhatsApp
                    </dt>
                    <dd className="font-mono font-bold">{submittedData.contactPhone}</dd>
                  </div>
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Requested Service
                    </dt>
                    <dd className="font-bold">{submittedData.serviceLabelSnapshot}</dd>
                  </div>

                  {submittedData.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING ? (
                    <>
                      <div>
                        <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                          Room Preference
                        </dt>
                        <dd className="font-bold">{submittedData.requestedRoomLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                          Preferred Slot (Pending Review)
                        </dt>
                        <dd className="font-bold">
                          {submittedData.preferredDate} at {submittedData.preferredTimeLabel} WIB (
                          {formatRequestDurationLabel(submittedData.preferredDurationMinutes)})
                        </dd>
                      </div>
                    </>
                  ) : (
                    <div>
                      <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                        Inquiry Type
                      </dt>
                      <dd className="font-bold">
                        Post-Production Inquiry
                        {submittedData.targetDeadline
                          ? ` • Target: ${submittedData.targetDeadline}`
                          : ''}
                      </dd>
                    </div>
                  )}

                  {submittedData.notes ? (
                    <div className="sm:col-span-2">
                      <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                        Notes
                      </dt>
                      <dd className="font-medium break-words whitespace-pre-wrap">
                        {submittedData.notes}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  {studioWhatsAppLink?.isValid ? (
                    <a
                      href={studioWhatsAppLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Chat on WhatsApp</span>
                    </a>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleResetNew}
                    className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Submit another request</span>
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  void handleSubmit(onSubmit)(event);
                }}
                noValidate
                className="mt-5 space-y-5"
              >
                {/* Honeypot anti-spam trap (hidden from real users & screen readers) */}
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="inquiry-website">Website</label>
                  <input
                    id="inquiry-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    {...register('website')}
                  />
                </div>

                {submitError ? (
                  <div
                    role="alert"
                    data-testid="booking-request-error-alert"
                    className="border-studio-error-ink bg-red-50 flex items-start gap-2.5 border-2 p-3.5 text-xs font-semibold text-red-900"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{submitError}</span>
                  </div>
                ) : null}

                {/* STEP 01: Session Type & Room Preference */}
                <div className="border-studio-ink/15 space-y-4 border-t pt-4">
                  <p className="text-studio-muted-ink font-mono text-[11px] font-extrabold tracking-wider uppercase">
                    01 • Choose Service Category
                  </p>

                  <fieldset>
                    <legend className="font-mono text-[11px] font-bold tracking-wider uppercase">
                      Requested Service <span className="text-studio-error-ink">*</span>
                    </legend>
                    <input type="hidden" {...register('service')} />
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {SERVICE_OPTIONS.map((option) => {
                        const isSelected = activeService === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setValue('service', option.id, {
                                shouldValidate: true,
                                shouldDirty: true,
                              });
                              if (submitError) setSubmitErrorState(null);
                            }}
                            className={
                              isSelected
                                ? 'border-studio-ink bg-studio-ink text-studio-white min-h-11 cursor-pointer border-2 px-2 py-2 text-xs font-extrabold tracking-wider uppercase shadow-[2px_2px_0px_#C8F13A]'
                                : 'border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-ivory min-h-11 cursor-pointer border-2 px-2 py-2 text-xs font-bold tracking-wider uppercase'
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {errors.service ? (
                      <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                        {errors.service.message}
                      </p>
                    ) : null}
                  </fieldset>

                  {!isPostProduction ? (
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="inquiry-room"
                          className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                        >
                          Room Preference <span className="text-studio-error-ink">*</span>
                        </label>
                        <select
                          id="inquiry-room"
                          aria-invalid={Boolean(errors.room)}
                          {...register('room')}
                          className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                        >
                          {ROOM_OPTIONS.map((roomOption) => (
                            <option key={roomOption.id} value={roomOption.id}>
                              {roomOption.label}
                            </option>
                          ))}
                        </select>
                        {errors.room ? (
                          <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                            {errors.room.message}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label
                          htmlFor="inquiry-duration"
                          className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                        >
                          Estimated Duration <span className="text-studio-error-ink">*</span>
                        </label>
                        <select
                          id="inquiry-duration"
                          aria-invalid={Boolean(errors.duration)}
                          {...register('duration')}
                          className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                        >
                          {PUBLIC_DURATION_OPTION_VALUES.map((durationItem) => (
                            <option key={durationItem.value} value={durationItem.value}>
                              {durationItem.label}
                            </option>
                          ))}
                        </select>
                        {errors.duration ? (
                          <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                            {errors.duration.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div
                      data-testid="post-production-inquiry-notice"
                      className="border-studio-ink bg-studio-ivory border-2 p-3.5 text-xs leading-relaxed"
                    >
                      <p className="font-mono font-extrabold uppercase">
                        Post-Production Inquiry (No Studio Room Slot Required)
                      </p>
                      <p className="text-studio-muted-ink mt-1">
                        Mixing &amp; Mastering requests do not lock studio rehearsal/recording rooms.
                        Share your project notes and optional target deadline below, and our engineer
                        will follow up via WhatsApp.
                      </p>
                    </div>
                  )}
                </div>

                {/* STEP 02: Preferred Date & Time (or Optional Target Deadline for Mix & Master) */}
                {!isPostProduction ? (
                  <div className="border-studio-ink/15 space-y-3 border-t pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-studio-muted-ink font-mono text-[11px] font-extrabold tracking-wider uppercase">
                        02 • Choose Preferred Date &amp; Time
                      </p>
                      <Link
                        to={availabilityCalendarHref}
                        className="text-studio-orange font-mono text-[11px] font-extrabold uppercase hover:underline"
                      >
                        Check Room Calendar →
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="inquiry-date"
                          className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                        >
                          Preferred Date <span className="text-studio-error-ink">*</span>
                        </label>
                        <input
                          id="inquiry-date"
                          type="date"
                          min={todayDate}
                          onFocus={refreshTodayDate}
                          aria-invalid={Boolean(errors.preferredDate)}
                          {...register('preferredDate')}
                          className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                        />
                        {errors.preferredDate ? (
                          <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                            {errors.preferredDate.message}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label
                          htmlFor="inquiry-time"
                          className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                        >
                          Preferred Start Time <span className="text-studio-error-ink">*</span>
                        </label>
                        <select
                          id="inquiry-time"
                          aria-invalid={Boolean(errors.preferredTime)}
                          {...register('preferredTime')}
                          className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                        >
                          {PUBLIC_START_TIME_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                        {errors.preferredTime ? (
                          <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                            {errors.preferredTime.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-studio-ink/15 space-y-3 border-t pt-4">
                    <p className="text-studio-muted-ink font-mono text-[11px] font-extrabold tracking-wider uppercase">
                      02 • Target Deadline (Optional)
                    </p>
                    <div>
                      <label
                        htmlFor="inquiry-target-deadline"
                        className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                      >
                        Target Release / Delivery Deadline
                      </label>
                      <input
                        id="inquiry-target-deadline"
                        type="date"
                        min={todayDate}
                        onFocus={refreshTodayDate}
                        aria-invalid={Boolean(errors.targetDeadline)}
                        {...register('targetDeadline')}
                        className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold sm:max-w-xs"
                      />
                      {errors.targetDeadline ? (
                        <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                          {errors.targetDeadline.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* STEP 03: Client Information, Notes & Privacy Consent */}
                <div className="border-studio-ink/15 space-y-3.5 border-t pt-4">
                  <p className="text-studio-muted-ink font-mono text-[11px] font-extrabold tracking-wider uppercase">
                    03 • Contact Details &amp; Project Notes
                  </p>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="inquiry-client-name"
                        className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                      >
                        Your Name <span className="text-studio-error-ink">*</span>
                      </label>
                      <input
                        id="inquiry-client-name"
                        type="text"
                        autoComplete="name"
                        placeholder="e.g. Raka Pratama"
                        aria-invalid={Boolean(errors.clientName)}
                        {...register('clientName')}
                        className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium placeholder:text-neutral-500"
                      />
                      {errors.clientName ? (
                        <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                          {errors.clientName.message}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor="inquiry-contact-number"
                        className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                      >
                        WhatsApp / Contact Number <span className="text-studio-error-ink">*</span>
                      </label>
                      <input
                        id="inquiry-contact-number"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="e.g. 081234567890 or +62812..."
                        aria-invalid={Boolean(errors.contactNumber)}
                        {...register('contactNumber')}
                        className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium placeholder:text-neutral-500"
                      />
                      {errors.contactNumber ? (
                        <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                          {errors.contactNumber.message}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="inquiry-band-name"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      Band / Artist / Project{' '}
                      <span className="text-studio-muted-ink font-normal">(Optional)</span>
                    </label>
                    <input
                      id="inquiry-band-name"
                      type="text"
                      placeholder="e.g. Midnight Static"
                      aria-invalid={Boolean(errors.bandName)}
                      {...register('bandName')}
                      className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium placeholder:text-neutral-500"
                    />
                    {errors.bandName ? (
                      <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                        {errors.bandName.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <label
                        htmlFor="inquiry-notes"
                        className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                      >
                        {isPostProduction
                          ? 'Project Description / Track Count / Reference'
                          : 'Notes / Setup Requirements'}{' '}
                        <span className="text-studio-muted-ink font-normal">(Optional)</span>
                      </label>
                      <span
                        id="inquiry-notes-counter"
                        className={
                          notesLength > 600
                            ? 'text-studio-error-ink font-mono text-[11px] font-bold'
                            : 'text-studio-muted-ink font-mono text-[11px] font-medium'
                        }
                      >
                        {notesLength} / 600
                      </span>
                    </div>
                    <textarea
                      id="inquiry-notes"
                      rows={3}
                      placeholder={
                        isPostProduction
                          ? 'Describe song count, approximate track count, genre, or stem readiness...'
                          : 'Optional: describe your band size, gear requests, or session questions...'
                      }
                      aria-invalid={Boolean(errors.notes)}
                      aria-describedby="inquiry-notes-counter"
                      {...register('notes')}
                      className="border-studio-ink bg-studio-ivory mt-1.5 min-h-20 w-full resize-y border-2 px-3 py-2 text-sm font-medium placeholder:text-neutral-500 sm:min-h-24"
                    />
                    {errors.notes ? (
                      <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                        {errors.notes.message}
                      </p>
                    ) : null}
                  </div>

                  {/* Mandatory Privacy Consent */}
                  <div className="border-studio-ink/25 bg-studio-ivory border p-3.5">
                    <label
                      htmlFor="inquiry-privacy-consent"
                      className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed"
                    >
                      <input
                        id="inquiry-privacy-consent"
                        type="checkbox"
                        aria-invalid={Boolean(errors.privacyConsent)}
                        {...register('privacyConsent')}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#151515]"
                      />
                      <span>
                        I agree that {studioName} may store these contact and request details to
                        check availability and contact me via WhatsApp regarding this inquiry.{' '}
                        <Link to="/privacy" className="font-bold underline hover:text-[#FF4B22]">
                          Read Privacy Notice
                        </Link>
                        . <span className="text-studio-error-ink">*</span>
                      </span>
                    </label>
                    {errors.privacyConsent ? (
                      <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-bold">
                        {errors.privacyConsent.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="brutal-btn bg-studio-orange text-studio-white flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-6 py-3.5 text-sm font-extrabold tracking-wider uppercase disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Submitting request...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {isPostProduction
                          ? bookingSection.form.postProductionSubmitLabel
                          : bookingSection.form.submitLabel}
                      </span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>

                <p className="text-studio-muted-ink flex items-center justify-center gap-1.5 text-center font-mono text-[11px]">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{bookingSection.form.footnote}</span>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
