import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

import {
  mapBookingRequestErrorToMessage,
  submitClientBookingRequest,
} from '@/features/admin/booking-requests/services/booking-request-service';
import { calculateCustomerPriceEstimate } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import {
  DELIVERY_MODES,
  PRICING_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { useAuth } from '@/features/auth/AuthContext';
import { usePublicPricingCatalog } from '@/features/public-pricing/hooks/usePublicPricingCatalog';
import { usePublicSiteSettings } from '@/features/public-site-settings/hooks/usePublicSiteSettings';

import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';

import { ClientBookingStepper } from '../components/booking/ClientBookingStepper';
import { ClientBookingStepSelectSession } from '../components/booking/ClientBookingStepSelectSession';
import { ClientBookingStepSchedule } from '../components/booking/ClientBookingStepSchedule';
import { ClientBookingStepProjectDetails } from '../components/booking/ClientBookingStepProjectDetails';
import { ClientBookingStepReview } from '../components/booking/ClientBookingStepReview';
import { ClientBookingSuccessView } from '../components/booking/ClientBookingSuccessView';
import { composePostProductionNotes } from '../utils/client-booking-notes';

export function ClientBookSessionPage({ now } = {}) {
  const { user, clientAccount, clientProfile } = useAuth();
  const {
    catalog,
    serviceTypes,
    studioServiceTypes,
    wfaServiceTypes,
    isReady: isCatalogReady,
    isLoading: isCatalogLoading,
    error: catalogError,
    retry: retryCatalog,
  } = usePublicPricingCatalog();
  const { settings: siteSettings } = usePublicSiteSettings();

  const whatsappUrl = useMemo(() => {
    const digits = String(siteSettings?.publicWhatsappNumber || '').replace(/\D/g, '');
    if (!digits) return '';
    const studioName = siteSettings?.studioName || '37 Music Studio';
    return `https://wa.me/${digits}?text=${encodeURIComponent(
      `Halo ${studioName}, saya ingin bertanya tentang jadwal & pemesanan sesi studio.`,
    )}`;
  }, [siteSettings?.publicWhatsappNumber, siteSettings?.studioName]);

  const todayIso = useMemo(() => getJakartaTodayIso(now), [now]);

  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');

  // Studio scheduling state
  const [requestedRoomId, setRequestedRoomId] = useState('any');
  const [preferredDate, setPreferredDate] = useState(() => getJakartaTodayIso(now));
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [selectedStartMinute, setSelectedStartMinute] = useState(null);

  // Mix & Master post-production state
  const [projectDetails, setProjectDetails] = useState({
    bandName: '',
    projectType: '',
    trackCount: '',
    targetDeadline: '',
    projectBrief: '',
  });

  // Contact & consent state (reactive fallback to streamed profile without synchronous effect setState)
  const profileDefaultName =
    clientProfile?.displayName || clientAccount?.displayName || user?.displayName || '';
  const profileDefaultPhone = clientProfile?.phoneDisplay || clientProfile?.phoneNormalized || '';

  const [contactForm, setContactForm] = useState({
    customerName: '',
    contactPhone: '',
    bandName: '',
    notes: '',
  });
  const [touchedContactFields, setTouchedContactFields] = useState({});
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [honeypotValue, setHoneypotValue] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);
  const submissionLockRef = useRef(false);

  const resolvedContactForm = {
    ...contactForm,
    customerName: touchedContactFields.customerName
      ? contactForm.customerName
      : contactForm.customerName || profileDefaultName,
    contactPhone: touchedContactFields.contactPhone
      ? contactForm.contactPhone
      : contactForm.contactPhone || profileDefaultPhone,
  };

  // Resolve effective active service & option cleanly against live publicPricingCatalog
  const effectiveService = useMemo(() => {
    if (!isCatalogReady) return null;
    if (selectedServiceId) {
      return serviceTypes.find((svc) => svc.id === selectedServiceId) || null;
    }
    return studioServiceTypes[0] || wfaServiceTypes[0] || null;
  }, [isCatalogReady, serviceTypes, selectedServiceId, studioServiceTypes, wfaServiceTypes]);

  const effectiveOption = useMemo(() => {
    if (!effectiveService) return null;
    const options = effectiveService.options || [];
    if (selectedOptionId) {
      return options.find((opt) => opt.id === selectedOptionId) || null;
    }
    return options[0] || null;
  }, [effectiveService, selectedOptionId]);

  const hasStaleServiceSelection = Boolean(selectedServiceId && !effectiveService);
  const hasStaleOptionSelection = Boolean(
    selectedOptionId && effectiveService && !effectiveOption,
  );
  const selectionInvalidated = hasStaleServiceSelection || hasStaleOptionSelection;
  const activeStep = selectionInvalidated ? 1 : step;
  const flowType = effectiveService?.deliveryMode === DELIVERY_MODES.WFA ? 'wfa' : 'studio';

  const pricingEstimate = useMemo(() => {
    if (!isCatalogReady || !effectiveService || !effectiveOption) return null;
    return calculateCustomerPriceEstimate({
      catalog,
      serviceTypeId: effectiveService.id,
      serviceOptionId: effectiveOption.id,
      durationMinutes: flowType === 'studio' ? durationMinutes : null,
    });
  }, [isCatalogReady, catalog, effectiveService, effectiveOption, flowType, durationMinutes]);

  const applyOptionDurationConstraint = (nextService, nextOption, currentDuration) => {
    if (!nextService || !nextOption) return 120;
    if (nextOption.pricing?.mode === PRICING_MODES.FIXED_SHIFT) {
      const baseMinutes = Math.max(60, Number(nextOption.pricing.durationMinutes) || 180);
      const nextEstimate = calculateCustomerPriceEstimate({
        catalog,
        serviceTypeId: nextService.id,
        serviceOptionId: nextOption.id,
        durationMinutes: currentDuration,
      });
      if (!nextEstimate?.canExtendDuration) {
        return baseMinutes;
      }
      return currentDuration >= baseMinutes ? currentDuration : baseMinutes;
    }
    return WHOLE_HOUR_DEFAULT(currentDuration);
  };

  function WHOLE_HOUR_DEFAULT(value) {
    const mins = Number(value);
    return Number.isInteger(mins) && mins >= 60 && mins <= 360 && mins % 60 === 0 ? mins : 120;
  }

  const handleSelectService = (nextServiceId) => {
    const nextService = serviceTypes.find((svc) => svc.id === nextServiceId) || null;
    const nextOption = nextService?.options?.[0] || null;
    setSelectedServiceId(nextService?.id || '');
    setSelectedOptionId(nextOption?.id || '');
    setDurationMinutes((prev) => applyOptionDurationConstraint(nextService, nextOption, prev));
    setSelectedStartMinute(null);
    setStep(1);
    setSubmitError('');
  };

  const handleSelectOption = (nextOptionId) => {
    const nextOption = effectiveService?.options?.find((opt) => opt.id === nextOptionId) || null;
    setSelectedOptionId(nextOption?.id || '');
    setDurationMinutes((prev) => applyOptionDurationConstraint(effectiveService, nextOption, prev));
    setStep(1);
    setSubmitError('');
  };

  const handleSubmitRequest = async (event) => {
    event.preventDefault();
    if (submissionLockRef.current || isSubmitting || !effectiveService || !effectiveOption) {
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const isWfa = flowType === 'wfa';
      const created = await submitClientBookingRequest({
        input: isWfa
          ? {
              customerName: resolvedContactForm.customerName,
              contactPhone: resolvedContactForm.contactPhone,
              bandName: projectDetails.bandName,
              projectBrief: projectDetails.projectBrief,
              serviceTypeId: effectiveService.id,
              serviceOptionId: effectiveOption.id,
              targetDeadline: projectDetails.targetDeadline || null,
              notes: composePostProductionNotes({
                projectType: projectDetails.projectType,
                trackCount: projectDetails.trackCount,
                brief: projectDetails.projectBrief,
              }),
              privacyConsent,
            }
          : {
              customerName: resolvedContactForm.customerName,
              contactPhone: resolvedContactForm.contactPhone,
              bandName: resolvedContactForm.bandName,
              serviceTypeId: effectiveService.id,
              serviceOptionId: effectiveOption.id,
              requestedRoomId,
              preferredDate,
              preferredStartMinute: selectedStartMinute,
              preferredDurationMinutes: durationMinutes,
              notes: resolvedContactForm.notes,
              privacyConsent,
            },
        clientAuth: {
          uid: user?.uid,
          clientAccount,
          customerId: clientAccount?.customerId,
        },
        publicCatalog: catalog,
        honeypotValue,
        formOpenedAtMs: 0,
        minElapsedMs: 0,
        now: now || new Date(),
      });

      setSubmittedResult({
        request: created,
        estimate: pricingEstimate,
      });
    } catch (err) {
      setSubmitError(mapBookingRequestErrorToMessage(err));
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    setSubmittedResult(null);
    setStep(1);
    setSelectedStartMinute(null);
    setPrivacyConsent(false);
    setSubmitError('');
    setProjectDetails({
      bandName: '',
      projectType: '',
      trackCount: '',
      targetDeadline: '',
      projectBrief: '',
    });
    setContactForm((prev) => ({
      ...prev,
      bandName: '',
      notes: '',
    }));
  };

  return (
    <div data-testid="client-book-session-page" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        eyebrow="STUDIO RESERVATION"
        titleId="client-book-session-heading"
        title="Book a Session"
        description="Choose a service, pick an open schedule or project timeline, and send your request."
        keepDescriptionOnMobile
        meta={
          submittedResult ? (
            <AdminStatusBadge tone="amber" dot>
              Request Pending Review
            </AdminStatusBadge>
          ) : isCatalogReady ? (
            <AdminStatusBadge tone="lime" dot>
              Self-Service Booking
            </AdminStatusBadge>
          ) : (
            <AdminStatusBadge tone="ivory">Catalog Unavailable</AdminStatusBadge>
          )
        }
      />

      {submittedResult ? (
        <ClientBookingSuccessView
          submittedRequest={submittedResult.request}
          estimateSnapshot={submittedResult.estimate}
          onBookAnother={handleBookAnother}
        />
      ) : isCatalogLoading ? (
        <AdminSurface variant="card" className="p-6">
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 text-xs font-medium text-[#46433D] sm:text-sm"
          >
            <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
            <span>Loading live studio services and pricing...</span>
          </div>
        </AdminSurface>
      ) : !isCatalogReady ? (
        <AdminSurface
          variant="card"
          data-testid="client-pricing-unavailable-state"
          className="p-6 sm:p-8"
        >
          <AdminEmptyState
            icon={AlertTriangle}
            title={
              catalogError
                ? 'Unable to load studio pricing'
                : 'Studio pricing catalog is not published yet'
            }
            description={
              catalogError
                ? `We could not load live service rates (${catalogError}). Click Check Again or contact studio staff directly via WhatsApp.`
                : 'The public pricing catalog has not been published by the studio owner yet. Self-service booking requires published studio rates — click Check Again shortly or message the studio team via WhatsApp.'
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={retryCatalog}
                  className="sa-btn-primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:text-sm"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>Check Again</span>
                </button>
                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sa-btn-secondary inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:text-sm"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Contact Studio</span>
                  </a>
                ) : null}
                <Link
                  to={CLIENT_PORTAL_ROUTES.HOME}
                  className="inline-flex min-h-10 items-center justify-center px-3 py-2 text-xs font-semibold text-[#666159] hover:text-[#151515]"
                >
                  Back to Overview
                </Link>
              </div>
            }
          />
        </AdminSurface>
      ) : (
        <div className="space-y-4">
          {selectionInvalidated ? (
            <div
              role="alert"
              data-testid="client-booking-selection-invalidated"
              className="rounded-xl border border-amber-500/35 bg-[#FEF4DD] px-4 py-3 text-xs leading-relaxed text-[#6B3904]"
            >
              The studio updated its service catalog. Your previous package is no longer
              available, so please select a service and package again before continuing.
            </div>
          ) : null}

          <ClientBookingStepper
            flowType={flowType}
            currentStep={activeStep}
            onSelectStep={(nextStep) => {
              if (nextStep < activeStep && !isSubmitting) {
                setStep(nextStep);
                setSubmitError('');
              }
            }}
          />

          {activeStep === 1 ? (
            <ClientBookingStepSelectSession
              studioServiceTypes={studioServiceTypes}
              wfaServiceTypes={wfaServiceTypes}
              selectedService={effectiveService}
              selectedOption={effectiveOption}
              onSelectService={handleSelectService}
              onSelectOption={handleSelectOption}
              onContinue={() => setStep(2)}
            />
          ) : null}

          {activeStep === 2 && flowType === 'studio' ? (
            <ClientBookingStepSchedule
              selectedService={effectiveService}
              selectedOption={effectiveOption}
              preferredDate={preferredDate}
              requestedRoomId={requestedRoomId}
              durationMinutes={durationMinutes}
              selectedStartMinute={selectedStartMinute}
              pricingEstimate={pricingEstimate}
              todayIso={todayIso}
              now={now}
              onChangeDate={(nextDate) => {
                setPreferredDate(nextDate);
                setSelectedStartMinute(null);
              }}
              onChangeRoom={(nextRoom) => {
                setRequestedRoomId(nextRoom);
              }}
              onChangeDuration={(nextDuration) => {
                setDurationMinutes(nextDuration);
              }}
              onSelectStartMinute={(min) => setSelectedStartMinute(min)}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          ) : null}

          {activeStep === 2 && flowType === 'wfa' ? (
            <ClientBookingStepProjectDetails
              selectedService={effectiveService}
              selectedOption={effectiveOption}
              pricingEstimate={pricingEstimate}
              draft={projectDetails}
              todayIso={todayIso}
              onChangeDraft={(field, value) =>
                setProjectDetails((prev) => ({ ...prev, [field]: value }))
              }
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          ) : null}

          {activeStep === 3 ? (
            <ClientBookingStepReview
              selectedService={effectiveService}
              selectedOption={effectiveOption}
              flowType={flowType}
              preferredDate={preferredDate}
              requestedRoomId={requestedRoomId}
              durationMinutes={durationMinutes}
              selectedStartMinute={selectedStartMinute}
              projectDetails={projectDetails}
              contactForm={resolvedContactForm}
              pricingEstimate={pricingEstimate}
              privacyConsent={privacyConsent}
              honeypotValue={honeypotValue}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onChangeContactField={(field, value) => {
                setTouchedContactFields((prev) => ({ ...prev, [field]: true }));
                setContactForm((prev) => ({ ...prev, [field]: value }));
                if (submitError) setSubmitError('');
              }}
              onChangePrivacyConsent={(checked) => {
                setPrivacyConsent(checked);
                if (submitError) setSubmitError('');
              }}
              onChangeHoneypot={(val) => setHoneypotValue(val)}
              onBack={() => {
                if (!isSubmitting) {
                  setStep(2);
                  setSubmitError('');
                }
              }}
              onSubmit={handleSubmitRequest}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ClientBookSessionPage;
