import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import {
  submitCustomerReview,
  validateAndLoadPublicInvitation,
} from '../services/public-review-service';
import { CustomerReviewAccessState } from '../components/CustomerReviewAccessState';
import { CustomerReviewForm } from '../components/CustomerReviewForm';
import { CustomerReviewSuccess } from '../components/CustomerReviewSuccess';

export function PublicReviewSubmissionPage() {
  const { token = '' } = useParams();

  const [loadState, setLoadState] = useState({
    tokenLoaded: '',
    status: 'loading',
    invitation: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedReview, setSubmittedReview] = useState(null);

  // Privacy hygiene: prevent bearer token leakage via Referer header when navigating off this route
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let meta = document.querySelector('meta[name="referrer"]');
    let created = false;
    const prevContent = meta ? meta.getAttribute('content') : null;

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'referrer');
      created = true;
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'no-referrer');

    return () => {
      if (created) {
        meta?.remove();
      } else if (meta && prevContent !== null) {
        meta.setAttribute('content', prevContent);
      } else if (meta) {
        meta.removeAttribute('content');
      }
    };
  }, []);

  const loadInvitation = useCallback(async () => {
    setLoadState({
      tokenLoaded: token,
      status: 'loading',
      invitation: null,
    });
    setSubmitError('');

    try {
      const result = await validateAndLoadPublicInvitation({ rawToken: token });
      setLoadState({
        tokenLoaded: token,
        status: result.state,
        invitation: result.invitation,
      });
    } catch {
      setLoadState({
        tokenLoaded: token,
        status: 'error',
        invitation: null,
      });
    }
  }, [token]);

  useEffect(() => {
    let isCancelled = false;
    Promise.resolve().then(async () => {
      if (!isCancelled) {
        await loadInvitation();
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [loadInvitation]);

  const handleSubmit = async ({ formValues, honeypotValue }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await submitCustomerReview({
        rawToken: token,
        formValues,
        honeypotValue,
      });
      setSubmittedReview(result.review);
    } catch (err) {
      const code = String(err?.code || '');
      if (
        code === 'public-review/already-submitted' ||
        code === 'public-review/duplicate-booking-review'
      ) {
        setLoadState((prev) => ({ ...prev, status: 'submitted' }));
        return;
      }
      if (code === 'public-review/invitation-expired') {
        setLoadState((prev) => ({ ...prev, status: 'expired' }));
        return;
      }
      if (code === 'public-review/invitation-revoked') {
        setLoadState((prev) => ({ ...prev, status: 'revoked' }));
        return;
      }
      setSubmitError(err?.message || 'Gagal mengirim ulasan. Silakan coba beberapa saat lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-studio-ivory text-studio-ink min-h-screen">
      {/* Minimal Branded Public Top Bar (No Admin Navigation) */}
      <header className="border-studio-ink bg-studio-ivory border-b-2">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="border-studio-ink bg-studio-lime text-studio-ink flex h-9 w-9 items-center justify-center border-2 font-mono text-sm font-extrabold shadow-[2px_2px_0px_#151515]">
              37
            </span>
            <span className="font-display text-lg font-black tracking-tight uppercase">
              37 Music Studio
            </span>
          </Link>

          <Link
            to="/"
            className="text-studio-ink font-mono text-xs font-bold tracking-wider uppercase underline-offset-4 hover:underline"
          >
            Website Studio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 sm:mb-8">
          <span className="bg-studio-ink text-studio-lime inline-block px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px]">
            37 MUSIC STUDIO • CUSTOMER EXPERIENCE
          </span>
          <h1 className="font-display text-studio-ink mt-3 text-4xl leading-[0.94] font-black tracking-tight uppercase sm:text-6xl">
            HOW WAS YOUR SESSION?
          </h1>
          <p className="text-studio-muted-ink mt-2.5 text-sm leading-relaxed font-medium sm:text-base">
            Your experience helps us make every session better.
          </p>
        </div>

        {submittedReview ? (
          <CustomerReviewSuccess submittedReview={submittedReview} />
        ) : loadState.status === 'active' && loadState.invitation ? (
          <CustomerReviewForm
            invitation={loadState.invitation}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onSubmit={handleSubmit}
          />
        ) : (
          <CustomerReviewAccessState
            state={loadState.tokenLoaded !== token ? 'loading' : loadState.status}
            onRetry={loadInvitation}
          />
        )}
      </main>
    </div>
  );
}

export default PublicReviewSubmissionPage;
