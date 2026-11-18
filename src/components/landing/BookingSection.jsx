import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Info, RotateCcw, Sparkles } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';

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

export function BookingSection({
  bookingSection,
  selectedService,
  selectedRoom,
  selectionVersion = 0,
  preselectionNotice,
  onClearPreselectionNotice,
}) {
  const [submissionRecord, setSubmissionRecord] = useState(null);
  const submittedData =
    submissionRecord && submissionRecord.version === selectionVersion
      ? submissionRecord.values
      : null;

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
      contactNumber: '',
      service: selectedService || 'rehearsal',
      room: selectedRoom || 'room-a',
      preferredDate: '2026-11-21',
      preferredTime: '19:00',
      duration: '2 hours',
      notes: '',
    },
  });

  const activeService = useWatch({
    control,
    name: 'service',
  });

  useEffect(() => {
    if (selectedService) {
      setValue('service', selectedService, { shouldValidate: true });
    }
  }, [selectedService, setValue]);

  useEffect(() => {
    if (selectedRoom) {
      setValue('room', selectedRoom, { shouldValidate: true });
    }
  }, [selectedRoom, setValue]);

  const onSubmit = (values) => {
    setSubmissionRecord({
      version: selectionVersion,
      values,
    });
  };

  const handleResetNew = () => {
    setSubmissionRecord(null);
    onClearPreselectionNotice?.();
    reset({
      clientName: '',
      contactNumber: '',
      service: 'rehearsal',
      room: 'room-a',
      preferredDate: '2026-11-21',
      preferredTime: '19:00',
      duration: '2 hours',
      notes: '',
    });
  };

  const selectedServiceLabel =
    SERVICE_OPTIONS.find((item) => item.id === submittedData?.service)?.label ||
    submittedData?.service;

  const selectedRoomLabel =
    ROOM_OPTIONS.find((item) => item.id === submittedData?.room)?.label || submittedData?.room;

  return (
    <section
      id="how-to-book"
      aria-labelledby="booking-process-heading"
      className="border-studio-ink bg-studio-ivory border-b-2 py-12 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="brutal-card-lg bg-studio-white grid grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* Left Panel: Black 3-Step Process */}
          <div className="border-studio-ink bg-studio-ink text-studio-white flex flex-col justify-between border-b-2 p-6 sm:p-8 lg:col-span-5 lg:border-r-2 lg:border-b-0 lg:p-10">
            <div>
              <span className="bg-studio-lime text-studio-ink inline-block px-2.5 py-1 font-mono text-[11px] font-extrabold tracking-wider uppercase">
                {bookingSection.process.eyebrow}
              </span>

              <h2
                id="booking-process-heading"
                className="font-display text-studio-white mt-4 text-4xl leading-none font-black tracking-tight uppercase sm:text-5xl"
              >
                {bookingSection.process.heading}
              </h2>

              <ol className="mt-6 space-y-4">
                {bookingSection.process.steps.map((step) => (
                  <li key={step.number} className="border border-neutral-700 bg-neutral-900/90 p-4">
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

          {/* Right Panel: Frontend-Only Booking Inquiry Form */}
          <div
            id="booking"
            className="bg-studio-white text-studio-ink p-6 sm:p-8 lg:col-span-7 lg:p-10"
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
              <span className="border-studio-ink bg-studio-ivory border px-2.5 py-1 font-mono text-[10px] font-bold uppercase">
                FRONTEND DEMO
              </span>
            </div>

            {preselectionNotice ? (
              <div
                role="status"
                aria-live="polite"
                className="border-studio-ink bg-studio-lime text-studio-ink mt-4 flex items-center justify-between gap-2 border-2 px-3.5 py-2 text-xs font-bold"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{preselectionNotice}</span>
                </span>
                <button
                  type="button"
                  onClick={onClearPreselectionNotice}
                  className="cursor-pointer underline"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {submittedData ? (
              <div
                role="status"
                aria-live="polite"
                className="border-studio-ink bg-studio-ivory mt-6 border-2 p-5 shadow-[4px_4px_0px_#151515]"
              >
                <div className="flex items-start gap-3">
                  <span className="border-studio-ink bg-studio-lime flex h-9 w-9 shrink-0 items-center justify-center border-2">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl leading-none font-black uppercase">
                      {bookingSection.form.demoConfirmationTitle}
                    </h3>
                    <p className="text-studio-ink mt-2 text-sm leading-relaxed font-bold">
                      {bookingSection.form.demoConfirmationMessage}
                    </p>
                  </div>
                </div>

                <dl className="border-studio-ink bg-studio-white mt-4 grid grid-cols-1 gap-2.5 border-[1.5px] p-4 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Client / Band
                    </dt>
                    <dd className="font-bold">{submittedData.clientName}</dd>
                  </div>
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Contact / WhatsApp
                    </dt>
                    <dd className="font-bold">{submittedData.contactNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Requested Service
                    </dt>
                    <dd className="font-bold">{selectedServiceLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Room Preference
                    </dt>
                    <dd className="font-bold">{selectedRoomLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                      Preferred Slot
                    </dt>
                    <dd className="font-bold">
                      {submittedData.preferredDate} at {submittedData.preferredTime} (
                      {submittedData.duration})
                    </dd>
                  </div>
                  {submittedData.notes ? (
                    <div className="sm:col-span-2">
                      <dt className="text-studio-muted-ink font-mono text-[10px] uppercase">
                        Session Notes
                      </dt>
                      <dd className="font-medium">{submittedData.notes}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setSubmissionRecord(null)}
                    className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                  >
                    Edit inquiry details
                  </button>
                  <button
                    type="button"
                    onClick={handleResetNew}
                    className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reset / New inquiry</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-4">
                {/* Row 1: Name / Band + WhatsApp / Contact Number */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="inquiry-client-name"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      Name / Band Name <span className="text-studio-orange">*</span>
                    </label>
                    <input
                      id="inquiry-client-name"
                      type="text"
                      autoComplete="name"
                      placeholder="e.g. Midnight Static / Raka"
                      aria-invalid={Boolean(errors.clientName)}
                      {...register('clientName')}
                      className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium placeholder:text-neutral-500"
                    />
                    {errors.clientName ? (
                      <p role="alert" className="text-studio-orange mt-1 text-xs font-bold">
                        {errors.clientName.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="inquiry-contact-number"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      WhatsApp / Contact Number <span className="text-studio-orange">*</span>
                    </label>
                    <input
                      id="inquiry-contact-number"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="e.g. +62 812 0000 0000"
                      aria-invalid={Boolean(errors.contactNumber)}
                      {...register('contactNumber')}
                      className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium placeholder:text-neutral-500"
                    />
                    {errors.contactNumber ? (
                      <p role="alert" className="text-studio-orange mt-1 text-xs font-bold">
                        {errors.contactNumber.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Row 2: Requested Service (3 tactile buttons matching reference screenshot) */}
                <fieldset>
                  <legend className="font-mono text-[11px] font-bold tracking-wider uppercase">
                    Requested Service <span className="text-studio-orange">*</span>
                  </legend>
                  <input type="hidden" {...register('service')} />
                  <div className="mt-1.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {SERVICE_OPTIONS.map((option) => {
                      const isSelected = activeService === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() =>
                            setValue('service', option.id, {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                          }
                          className={
                            isSelected
                              ? 'border-studio-ink bg-studio-ink text-studio-white min-h-11 cursor-pointer border-2 px-3 py-2 text-xs font-extrabold tracking-wider uppercase shadow-[2px_2px_0px_#C8F13A]'
                              : 'border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-ivory min-h-11 cursor-pointer border-2 px-3 py-2 text-xs font-bold tracking-wider uppercase'
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {errors.service ? (
                    <p role="alert" className="text-studio-orange mt-1 text-xs font-bold">
                      {errors.service.message}
                    </p>
                  ) : null}
                </fieldset>

                {/* Row 3: Room Preference + Duration */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="inquiry-room"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      Room Preference <span className="text-studio-orange">*</span>
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
                  </div>

                  <div>
                    <label
                      htmlFor="inquiry-duration"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      Estimated Duration <span className="text-studio-orange">*</span>
                    </label>
                    <select
                      id="inquiry-duration"
                      aria-invalid={Boolean(errors.duration)}
                      {...register('duration')}
                      className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                    >
                      {bookingSection.form.durations.map((durationItem) => (
                        <option key={durationItem.value} value={durationItem.value}>
                          {durationItem.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 4: Preferred Date + Preferred Start Time */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="inquiry-date"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      Preferred Date <span className="text-studio-orange">*</span>
                    </label>
                    <input
                      id="inquiry-date"
                      type="date"
                      aria-invalid={Boolean(errors.preferredDate)}
                      {...register('preferredDate')}
                      className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                    />
                    {errors.preferredDate ? (
                      <p role="alert" className="text-studio-orange mt-1 text-xs font-bold">
                        {errors.preferredDate.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="inquiry-time"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      Preferred Start Time <span className="text-studio-orange">*</span>
                    </label>
                    <select
                      id="inquiry-time"
                      aria-invalid={Boolean(errors.preferredTime)}
                      {...register('preferredTime')}
                      className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                    >
                      {bookingSection.form.timeSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot} WIB
                        </option>
                      ))}
                    </select>
                    {errors.preferredTime ? (
                      <p role="alert" className="text-studio-orange mt-1 text-xs font-bold">
                        {errors.preferredTime.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Row 5: Notes / Additional Requirements */}
                <div>
                  <label
                    htmlFor="inquiry-notes"
                    className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                  >
                    Notes / Setup Requirements{' '}
                    <span className="text-studio-muted-ink font-normal">(Optional)</span>
                  </label>
                  <input
                    id="inquiry-notes"
                    type="text"
                    placeholder="e.g. 5-piece rock band, need 3 vocal mics & double kick pedal..."
                    aria-invalid={Boolean(errors.notes)}
                    {...register('notes')}
                    className="border-studio-ink bg-studio-ivory mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium placeholder:text-neutral-500"
                  />
                  {errors.notes ? (
                    <p role="alert" className="text-studio-orange mt-1 text-xs font-bold">
                      {errors.notes.message}
                    </p>
                  ) : null}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="brutal-btn bg-studio-orange text-studio-white flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-6 py-3.5 text-sm font-extrabold tracking-wider uppercase"
                >
                  <span>{bookingSection.form.submitLabel}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
