/**
 * Centralized content & configuration module for the 37 Music Studio public landing page.
 *
 * Content & Verification Policy (PRD v0.2 Section 12 & Phase 2B Priority 3/4):
 * - Separates confirmed brand identity from draft layout copy and demo placeholders.
 * - Preserves explicit pending tokens in `pendingConfigTokens` for owner replacement.
 * - Never exposes raw `[..._PENDING]` tokens in visitor-facing UI.
 * - No unverified studio dimensions, channel counts, capacities, equipment lists,
 *   operating hours, addresses, coordinates, prices, availability, or ratings are
 *   presented as confirmed facts.
 */

export const pendingConfigTokens = {
  studioAddress: '[STUDIO_ADDRESS_PENDING]',
  mapsUrl: '[MAPS_URL_PENDING]',
  whatsappNumber: '[WHATSAPP_NUMBER_PENDING]',
  whatsappUrl: '[WHATSAPP_URL_PENDING]',
  operatingHours: '[OPERATING_HOURS_PENDING]',
  studioDomain: '[STUDIO_DOMAIN_PENDING]',
};

export const landingPageContent = {
  meta: {
    studioName: '37 Music Studio',
    isDemoContent: true,
    audienceNote:
      'Public landing page for prospective 37 Music Studio clients (bands, musicians, recording artists, and producers).',
  },

  utilityStrip: {
    descriptor: '37 MUSIC STUDIO • REHEARSAL / RECORDING / MIX & MASTER',
    isHoursConfirmed: false,
    hoursText: '',
    hoursToken: pendingConfigTokens.operatingHours,
    hoursPendingLabel: 'OPERATING HOURS: PENDING CONFIRMATION (DEMO)',
    ctaLabel: 'BOOK A SESSION →',
    ctaHref: '#booking',
  },

  header: {
    brandMark: '37',
    brandName: '37 MUSIC STUDIO',
    brandTagline: 'REHEARSAL • RECORDING • MIX',
    navLinks: [
      { label: 'Services', href: '#services' },
      { label: 'Rooms', href: '#rooms' },
      { label: 'Gallery', href: '#gallery' },
      { label: 'How to book', href: '#how-to-book' },
      { label: 'Contact', href: '#contact' },
    ],
    loginButton: {
      label: 'Login',
      ariaLabel: 'Studio staff and owner login (coming soon)',
    },
    primaryCta: {
      label: 'Book now',
      href: '#booking',
    },
  },

  loginDialog: {
    badge: 'INTERNAL 37 STUDIO MANAGEMENT',
    title: 'Studio access is coming soon',
    description: 'Owner and operator login will be available in a future update.',
    detail:
      'This login portal is exclusively for internal 37 Music Studio staff and studio operations. Prospective studio clients do not need an account to explore services or send a session inquiry.',
    closeLabel: 'Got it',
    bookingCtaLabel: 'Start a booking inquiry instead',
  },

  hero: {
    badges: [
      {
        id: 'badge-studio',
        label: '37 MUSIC STUDIO • DRAFT PREVIEW',
        variant: 'white',
        hasDot: true,
      },
      {
        id: 'badge-sessions',
        label: 'REHEARSAL • RECORDING • MIX & MASTER',
        variant: 'lime',
        hasDot: false,
      },
    ],
    headline: {
      lineOne: 'LOUD ROOMS',
      lineTwo: 'FOR LOUD',
      lineThree: 'IDEAS.',
    },
    description:
      'A public showcase for 37 Music Studio — rehearsal, recording, and mixing & mastering sessions. Explore our draft room cards and test the session inquiry preview below.',
    primaryCta: {
      label: 'Book a session',
      href: '#booking',
    },
    secondaryCta: {
      label: 'See the rooms',
      href: '#rooms',
    },
    facts: [
      {
        id: 'fact-room-a',
        value: 'ROOM A',
        label: 'LIVE SPACE (DRAFT)',
        highlight: false,
      },
      {
        id: 'fact-room-b',
        value: 'ROOM B',
        label: 'RECORD & MIX (DRAFT)',
        highlight: true,
      },
      {
        id: 'fact-inquiry',
        value: 'DEMO',
        label: 'LOCAL INQUIRY PREVIEW',
        highlight: false,
      },
    ],
    featuredPhoto: {
      src: '/images/demo/room-a-live.svg',
      alt: 'Illustrative demo artwork representing a studio live room layout; awaiting approved 37 Music Studio photography',
      width: 960,
      height: 680,
      topSticker: 'DEMO PREVIEW',
      captionTitle: 'ROOM A — LIVE ROOM (DRAFT)',
      captionSubtitle: 'Illustrative preview asset • Real studio photograph pending',
      demoTagLabel: 'DEMO ASSET',
      floatingBadgeTitle: 'Demo Illustration',
      floatingBadgeSubtitle: 'Real photo pending owner upload',
      isDemoAsset: true,
    },
  },

  ticker: {
    items: [
      'BAND REHEARSAL',
      'RECORDING SESSIONS',
      'MIXING & MASTERING',
      'DRAFT ROOM PREVIEW',
      'SESSION INQUIRIES',
      'DEMO PREVIEW MODE',
    ],
  },

  services: {
    eyebrow: 'WHAT WE OFFER (DRAFT)',
    heading: 'Pick your session',
    intro:
      'Select a draft session category to prefill the inquiry form below. Final service scopes, included equipment, and pricing await studio owner confirmation.',
    items: [
      {
        id: 'rehearsal',
        number: '01',
        badge: 'GROUP SESSION',
        badgeVariant: 'lime',
        icon: 'drum',
        title: 'Rehearsal',
        description:
          'Dedicated group rehearsal sessions for bands and ensembles. Exact room equipment and package details are draft placeholders pending confirmation.',
        features: [
          'Full band rehearsal category (draft)',
          'Included gear list pending owner confirmation',
          'Session rates & durations to be confirmed',
        ],
        ctaLabel: 'Check availability',
        defaultRoom: 'room-a',
        isDraftSpec: true,
      },
      {
        id: 'recording',
        number: '02',
        badge: 'TRACKING',
        badgeVariant: 'orange',
        icon: 'mic',
        title: 'Recording',
        description:
          'Studio recording sessions for vocals, solo instruments, or band tracking. Engineering workflow and equipment specs are draft placeholders pending confirmation.',
        features: [
          'Vocal, instrument, or band tracking (draft)',
          'Signal chain & mic list pending confirmation',
          'Deliverables & rates to be confirmed',
        ],
        ctaLabel: 'Check availability',
        defaultRoom: 'room-b',
        isDraftSpec: true,
      },
      {
        id: 'mix-master',
        number: '03',
        badge: 'POST-PRODUCTION',
        badgeVariant: 'ink',
        icon: 'sliders',
        title: 'Mix & Master',
        description:
          'Post-production mixing and mastering inquiries for singles, EPs, and session stems. Workflow and turnaround details await owner confirmation.',
        features: [
          'Mixing & mastering session category (draft)',
          'Delivery formats pending owner confirmation',
          'Revision policy & pricing to be confirmed',
        ],
        ctaLabel: 'Check availability',
        defaultRoom: 'room-b',
        isDraftSpec: true,
      },
    ],
  },

  rooms: {
    eyebrow: 'THE SPACES (DRAFT)',
    heading: 'Two rooms, zero guesswork',
    intro:
      'Layout preview for two proposed studio spaces. Room capacities, equipment lists, and real studio photography will be published once verified by the owner.',
    items: [
      {
        id: 'room-a',
        name: 'Room A — Live Room',
        sticker: 'DRAFT ROOM • DEMO ASSET',
        image: {
          src: '/images/demo/room-a-live.svg',
          alt: 'Illustrative demo artwork representing Room A live rehearsal space; awaiting verified studio photograph',
          width: 960,
          height: 680,
          isDemoAsset: true,
        },
        capacityLabel: 'Room capacity & floor dimensions pending owner confirmation',
        tags: ['Draft room slot', 'Rehearsal layout', 'Equipment list pending'],
        ctaLabel: 'Book this room',
        defaultService: 'rehearsal',
      },
      {
        id: 'room-b',
        name: 'Room B — Control + Booth',
        sticker: 'DRAFT ROOM • DEMO ASSET',
        image: {
          src: '/images/demo/room-b-control.svg',
          alt: 'Illustrative demo artwork representing Room B control room and vocal booth; awaiting verified studio photograph',
          width: 960,
          height: 680,
          isDemoAsset: true,
        },
        capacityLabel: 'Room capacity & equipment specs pending owner confirmation',
        tags: ['Draft room slot', 'Recording / mix layout', 'Equipment list pending'],
        ctaLabel: 'Book this room',
        defaultService: 'recording',
      },
    ],
    includedLabel: 'Details awaiting confirmation:',
    includedChips: [
      'Amenities: Pending owner confirmation',
      'Gear specs: Pending owner confirmation',
      'Pricing: Pending owner decision',
      'Booking: Local demo preview only',
    ],
  },

  gallery: {
    eyebrow: 'INSIDE THE STUDIO',
    heading: 'Proof, not renders.',
    subtitle:
      'Development illustration placeholders shown below for layout review — real 37 Music Studio photographs remain pending.',
    ctaLabel: 'View all photos',
    items: [
      {
        id: 'gallery-1',
        title: 'Backline photo slot',
        category: 'DEMO ILLUSTRATION 01',
        src: '/images/demo/gallery-guitar.svg',
        alt: 'Illustrative demo artwork representing a guitar close-up; real 37 Music Studio photo pending',
        width: 600,
        height: 680,
      },
      {
        id: 'gallery-2',
        title: 'Live session photo slot',
        category: 'DEMO ILLUSTRATION 02',
        src: '/images/demo/gallery-drums.svg',
        alt: 'Illustrative demo artwork representing a drum session; real 37 Music Studio photo pending',
        width: 600,
        height: 680,
      },
      {
        id: 'gallery-3',
        title: 'Vocal booth photo slot',
        category: 'DEMO ILLUSTRATION 03',
        src: '/images/demo/gallery-mic.svg',
        alt: 'Illustrative demo artwork representing a condenser microphone; real 37 Music Studio photo pending',
        width: 600,
        height: 680,
      },
      {
        id: 'gallery-4',
        title: 'Control desk photo slot',
        category: 'DEMO ILLUSTRATION 04',
        src: '/images/demo/gallery-console.svg',
        alt: 'Illustrative demo artwork representing an audio console; real 37 Music Studio photo pending',
        width: 600,
        height: 680,
      },
    ],
  },

  bookingSection: {
    process: {
      eyebrow: 'HOW INQUIRY WORKS (DEMO)',
      heading: 'Three taps to loud.',
      steps: [
        {
          number: '1',
          title: 'Pick session + time',
          description:
            'Choose a draft service category, room slot, and your preferred date and start time in the inquiry form.',
        },
        {
          number: '2',
          title: 'Review locally',
          description:
            'Inputs are validated directly in your browser. In this Phase 2 preview, no reservation or external message is sent.',
        },
        {
          number: '3',
          title: 'Confirmed channel next',
          description:
            'Approved studio contact routing and booking workflow integration will be connected in a future phase.',
        },
      ],
      reassuranceNote: 'Demo inquiry preview — no real booking or availability check occurs.',
    },
    form: {
      heading: 'Booking inquiry',
      subtitle:
        'Test the session inquiry layout below. Submissions are validated locally only and never sent or stored.',
      submitLabel: 'Send booking inquiry',
      footnote: 'Demo inquiry only — no personal data is transmitted or stored.',
      demoConfirmationTitle: 'Demo Inquiry Received (Local Preview)',
      demoConfirmationMessage:
        'Demo inquiry only — your request has not been sent. The booking integration will be added later.',
      durations: [
        { value: '2 hours', label: '2 hours (Draft option)' },
        { value: '3 hours', label: '3 hours (Draft option)' },
        { value: '4 hours', label: '4 hours (Draft option)' },
        { value: '6+ hours', label: '6+ hours / Custom (Draft option)' },
      ],
      timeSlots: ['10:00', '12:00', '14:00', '16:00', '18:00', '19:00', '20:00', '21:00'],
    },
  },

  testimonialsAndContact: {
    testimonials: {
      eyebrow: 'ARTIST NOTES • DEMO PLACEHOLDER LAYOUT',
      isVerified: false,
      demoNotice:
        'Placeholder cards only — no customer reviews, ratings, or artist attributions are published until confirmed by the studio owner.',
      items: [
        {
          id: 'demo-quote-1',
          badge: 'DEMO PLACEHOLDER 01',
          quote:
            'Placeholder layout slot reserved for a verified rehearsal client quote once owner approval and attribution permission are supplied.',
          author: 'Client Name Pending',
          role: 'Rehearsal Quote Slot • Unverified Placeholder',
          rating: null,
        },
        {
          id: 'demo-quote-2',
          badge: 'DEMO PLACEHOLDER 02',
          quote:
            'Placeholder layout slot reserved for a verified recording or mixing quote once owner approval and attribution permission are supplied.',
          author: 'Artist Name Pending',
          role: 'Recording Quote Slot • Unverified Placeholder',
          rating: null,
        },
      ],
    },
    contact: {
      eyebrow: 'FIND US',
      heading: 'Studio location & hours',
      statusBadge: 'DEMO CONTACT CARD',
      isAddressConfirmed: false,
      addressText: '',
      addressToken: pendingConfigTokens.studioAddress,
      addressPendingLabel: 'Studio street address pending owner confirmation',
      mapsUrl: '',
      mapsToken: pendingConfigTokens.mapsUrl,
      isHoursConfirmed: false,
      hoursText: '',
      hoursToken: pendingConfigTokens.operatingHours,
      hoursPendingLabel: 'Operating hours pending owner confirmation',
      isContactConfirmed: false,
      contactText: '',
      contactToken: pendingConfigTokens.whatsappNumber,
      contactPendingLabel: 'Direct WhatsApp & phone line pending owner confirmation',
      image: {
        src: '/images/demo/location-exterior.svg',
        alt: 'Illustrative architectural demo placeholder — awaiting verified 37 Music Studio exterior photograph',
        width: 720,
        height: 420,
        isDemoAsset: true,
      },
      mapCtaLabel: 'Open in Maps',
      mapPendingNotice:
        'Verified studio map coordinates and street address are pending owner confirmation. Use the on-page booking inquiry form above to test the session inquiry flow.',
    },
  },

  finalCta: {
    eyebrow: 'SESSION INQUIRY PREVIEW',
    headline: 'DON’T REHEARSE IN A GARAGE.',
    description:
      'Preview a session inquiry for rehearsal, recording, or mixing at 37 Music Studio. Final room details and direct contact channels will be updated upon owner confirmation.',
    primaryCta: {
      label: 'Book a session',
      href: '#booking',
    },
    secondaryCta: {
      label: 'Ask on WhatsApp',
      isConfirmed: false,
      whatsappNumber: '',
      whatsappUrl: '',
      whatsappToken: pendingConfigTokens.whatsappUrl,
      prefilledMessage: '',
      pendingNotice:
        'The official 37 Music Studio WhatsApp number is pending owner confirmation. We have scrolled you to the on-page booking inquiry demo instead.',
    },
  },

  footer: {
    brandMark: '37',
    brandName: '37 MUSIC STUDIO',
    description:
      'Public preview site for 37 Music Studio — rehearsal, recording, and mixing & mastering inquiries.',
    visitHeading: 'VISIT',
    visitAddressPendingNote: 'Official studio address pending owner confirmation',
    hoursHeading: 'HOURS & CONTACT',
    hoursPendingNote: 'Operating hours pending owner confirmation',
    contactPendingNote: 'WhatsApp & email channels pending confirmation',
    ctaHeading: 'READY TO PLAY?',
    ctaLabel: 'Start booking inquiry →',
    ctaHref: '#booking',
    socialLinks: [
      { id: 'instagram', label: 'Instagram', isConfirmed: false, href: '' },
      { id: 'tiktok', label: 'TikTok', isConfirmed: false, href: '' },
      { id: 'youtube', label: 'YouTube', isConfirmed: false, href: '' },
      { id: 'music', label: 'Streaming / Audio reels', isConfirmed: false, href: '' },
    ],
    copyright: '© 2026 37 Music Studio. All rights reserved.',
    phaseNote: 'Phase 2B Public Landing Page • Demo Content Mode',
  },
};
