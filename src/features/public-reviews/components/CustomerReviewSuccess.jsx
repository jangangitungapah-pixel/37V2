import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { CUSTOMER_REVIEW_SUCCESS_COPY } from '@/features/customer-reviews/config/customer-review-config';

export function CustomerReviewSuccess({ submittedReview = null }) {
  return (
    <div
      data-testid="public-review-success"
      className="brutal-card bg-studio-lime text-studio-ink p-6 sm:p-10"
    >
      <div className="border-studio-ink bg-studio-white inline-flex h-12 w-12 items-center justify-center border-2 shadow-[3px_3px_0px_#151515]">
        <CheckCircle2 className="text-studio-ink h-6 w-6" aria-hidden="true" />
      </div>

      <h2 className="font-display text-studio-ink mt-5 text-4xl leading-none font-black uppercase sm:text-5xl">
        {CUSTOMER_REVIEW_SUCCESS_COPY.heading}
      </h2>

      <p className="mt-3 max-w-xl text-sm leading-relaxed font-semibold sm:text-base">
        {CUSTOMER_REVIEW_SUCCESS_COPY.description}
      </p>

      {submittedReview ? (
        <div className="border-studio-ink bg-studio-white mt-5 border-2 p-4 text-xs">
          <p className="text-studio-muted-ink font-mono font-bold uppercase">
            Ringkasan Kiriman Anda
          </p>
          <p className="text-studio-ink mt-1.5 font-extrabold">
            {submittedReview.displayName} • {submittedReview.rating}/5 ★
          </p>
          <p className="text-studio-muted-ink mt-1 leading-relaxed">{submittedReview.reviewText}</p>
        </div>
      ) : null}

      <div className="mt-6">
        <Link
          to="/"
          className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-12 items-center gap-2 px-6 py-3 font-mono text-xs font-extrabold tracking-wider uppercase"
        >
          <span>Kembali ke Beranda 37 Music Studio</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
