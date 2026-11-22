import { useEffect } from 'react';
import { ArrowLeft, CalendarClock, Lock, Mail, MessageSquare, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

import { formatPhoneDisplay } from '@/features/admin/customer/utils/phone-number';
import { usePublicSiteSettings } from '@/features/public-site-settings/hooks/usePublicSiteSettings';
import { buildWhatsAppClickToChatUrl } from '@/features/admin/booking-requests/services/whatsapp-message-service';

export function PrivacyNoticePage() {
  const { settings } = usePublicSiteSettings();
  const studioName = settings.studioName || '37 Music Studio';
  const waResult = settings.publicWhatsappNumber
    ? buildWhatsAppClickToChatUrl({
        phone: settings.publicWhatsappNumber,
        message: `Halo ${studioName}, saya ingin bertanya mengenai data permintaan booking saya.`,
      })
    : null;

  useEffect(() => {
    document.title = `Privacy Notice — ${studioName}`;
  }, [studioName]);

  return (
    <div className="bg-studio-ivory text-studio-ink min-h-screen">
      <header className="border-studio-ink bg-studio-ivory border-b-2">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="border-studio-ink bg-studio-white hover:bg-studio-lime inline-flex min-h-11 items-center gap-2 border-2 px-3.5 py-2 font-mono text-xs font-extrabold uppercase transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to {studioName}</span>
          </Link>

          <Link
            to="/availability"
            className="border-studio-ink bg-studio-ink text-studio-ivory hover:bg-studio-orange inline-flex min-h-11 items-center gap-2 border-2 px-3.5 py-2 font-mono text-xs font-extrabold uppercase transition-colors"
          >
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            <span>Availability</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
        <article className="brutal-card-lg bg-studio-white p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border-2 px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>PUBLIC PRIVACY NOTICE • v1</span>
            </span>
          </div>

          <h1 className="font-display text-studio-ink mt-4 text-4xl leading-none font-black tracking-tight uppercase sm:text-5xl">
            Privacy Notice
          </h1>
          <p className="text-studio-muted-ink mt-3 text-sm leading-relaxed sm:text-base">
            This Privacy Notice explains how {studioName} collects and handles personal information
            when you submit a studio booking request or post-production inquiry on this website.
          </p>

          <div className="divide-studio-ink/20 border-studio-ink mt-8 divide-y-2 border-t-2">
            <section className="py-5">
              <h2 className="font-display text-2xl font-black uppercase">
                1. Information We Collect
              </h2>
              <ul className="text-studio-muted-ink mt-2.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                <li>Your name and optional band, artist, or project name.</li>
                <li>Your WhatsApp or contact phone number so our studio team can reach you.</li>
                <li>
                  Your requested service category (Rehearsal, Recording, or Mix &amp; Master).
                </li>
                <li>
                  For studio room requests: preferred room, date, start time, and session duration.
                  For Mix &amp; Master inquiries: optional target deadline.
                </li>
                <li>Optional session notes or setup context provided in your inquiry form.</li>
                <li>Your explicit privacy consent flag and consent version (`v1`).</li>
              </ul>
            </section>

            <section className="py-5">
              <h2 className="font-display text-2xl font-black uppercase">
                2. Why We Collect This Information
              </h2>
              <p className="text-studio-muted-ink mt-2 text-sm leading-relaxed">
                Your inquiry details are stored in {studioName}&apos;s internal operational inbox so
                authorized studio Owner and Staff can verify room availability, clarify technical or
                post-production requirements, propose alternative time slots if needed, and issue a
                confirmed Admin Calendar booking once schedule details are agreed.
              </p>
            </section>

            <section className="py-5">
              <h2 className="font-display text-2xl font-black uppercase">
                3. How WhatsApp Communication Works
              </h2>
              <p className="text-studio-muted-ink mt-2 text-sm leading-relaxed">
                {studioName} uses WhatsApp Click-to-Chat links directly initiated by authorized
                studio staff to respond to your booking request using the phone number you
                submitted. Your submission is never automatically added to marketing broadcast lists
                and is never displayed on public pages or the Public Availability Calendar.
              </p>
            </section>

            <section className="py-5">
              <h2 className="font-display text-2xl font-black uppercase">
                4. Data Access &amp; Honest Scope
              </h2>
              <div className="border-studio-ink/20 bg-studio-ivory mt-2.5 flex items-start gap-2.5 border p-3.5 text-xs leading-relaxed sm:text-sm">
                <Lock className="text-studio-orange mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Submitted request records are readable only by authenticated, active Studio Owner
                  and Staff accounts. Unauthenticated visitors and other clients cannot read, list,
                  or modify submitted booking requests. If a request is later confirmed as a studio
                  session, your name and contact number are also recorded in {studioName}&apos;s
                  internal Customer Directory for booking and billing records.
                </p>
              </div>
            </section>

            <section className="py-5">
              <h2 className="font-display text-2xl font-black uppercase">
                5. Contact Us About Your Data
              </h2>
              <p className="text-studio-muted-ink mt-2 text-sm leading-relaxed">
                If you would like to update a submitted inquiry or ask questions about the contact
                information you provided, please contact {studioName} directly using any verified
                studio contact channel below:
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {waResult?.isValid ? (
                  <a
                    href={waResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 items-center gap-2 px-4 py-2 font-mono text-xs font-extrabold uppercase"
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    <span>WhatsApp ({formatPhoneDisplay(settings.publicWhatsappNumber)})</span>
                  </a>
                ) : null}

                {settings.publicEmail ? (
                  <a
                    href={`mailto:${settings.publicEmail}`}
                    className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 items-center gap-2 px-4 py-2 font-mono text-xs font-extrabold uppercase"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <span>{settings.publicEmail}</span>
                  </a>
                ) : null}

                {!waResult?.isValid && !settings.publicEmail ? (
                  <p className="border-studio-ink/20 bg-studio-ivory border px-3 py-2 font-mono text-xs text-neutral-700">
                    Direct studio contact details are managed in the Studio Profile and appear here
                    once published by the Owner.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}

export default PrivacyNoticePage;
