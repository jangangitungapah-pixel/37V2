/**
 * Centralized content & configuration module for the 37 Music Studio public landing page.
 *
 * Content strategy (PRD v0.2 Section 12):
 * - Separates confirmed brand identity from draft copy and demonstration placeholders.
 * - Preserves explicit pending tokens in `pendingConfigTokens` for owner replacement.
 * - Never exposes raw `[..._PENDING]` tokens in visitor-facing UI; components check
 *   `isConfirmed` flags and render honest demo/pending notices until owner data is supplied.
 */

export const pendingConfigTokens = {
  studioAddress: '[STUDIO_ADDRESS_PENDING]',
  whatsappNumber: '[WHATSAPP_NUMBER_PENDING]',
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
    descriptor: '37 MUSIC STUDIO • REHEARSAL / RECORDING / MIXING',
    hoursDisplay: 'DAILY 10:00 – 23:00 (DEMO SCHEDULE)',
    hoursToken: pendingConfigTokens.operatingHours,
    isHoursConfirmed: false,
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
      'This login portal is exclusively for internal 37 Music Studio staff and studio operations. Prospective studio clients do not need an account to book a rehearsal, recording, or mixing session.',
    closeLabel: 'Got it',
    bookingCtaLabel: 'Start a booking inquiry instead',
  },

  hero: {
    badges: [
      {
        id: 'badge-acoustics',
        label: 'SOUNDPROOFED & ACOUSTICALLY TREATED',
        variant: 'white',
        hasDot: true,
      },
      {
        id: 'badge-sessions',
        label: 'REHEARSAL • RECORDING • MIX',
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
      '37 Music Studio is a rehearsal, recording, and mixing space built for bands and artists who want treated rooms, solid backline, and engineers who actually play.',
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
        id: 'fact-live-room',
        value: '42m²',
        label: 'LIVE ROOM (DEMO SPEC)',
        highlight: false,
      },
      {
        id: 'fact-channels',
        value: '24ch',
        label: 'CONSOLE & I/O (DEMO SPEC)',
        highlight: true,
      },
      {
        id: 'fact-turnaround',
        value: '15min',
        label: 'SETUP TURNAROUND',
        highlight: false,
      },
    ],
    featuredPhoto: {
      src: '/images/demo/room-a-live.svg',
      alt: 'Illustration of 37 Music Studio Room A live rehearsal and recording space with treated wood panels, production desk, guitars, and keyboards',
      width: 960,
      height: 680,
      topSticker: 'STUDIO PREVIEW',
      captionTitle: 'ROOM A — LIVE ROOM',
      captionSubtitle: 'Treated acoustics • Full band backline • Demo preview asset',
      floatingBadgeTitle: 'Tuned for bands',
      floatingBadgeSubtitle: 'Treated floor & walls',
      isDemoAsset: true,
    },
  },

  ticker: {
    items: [
      'BAND REHEARSAL',
      'MULTITRACK RECORDING',
      'VOCAL TRACKING',
      'MIXING & MASTERING',
      'BACKLINE INCLUDED',
      'TREATED ROOMS',
      'ON-SITE CREW SUPPORT',
    ],
  },

  services: {
    eyebrow: 'WHAT WE DO',
    heading: 'Pick your session',
    intro:
      'Choose how you want to use 37 Music Studio. Draft service categories below are ready for client inquiries and will be finalized with confirmed studio packages.',
    items: [
      {
        id: 'rehearsal',
        number: '01',
        badge: 'BAND FAVORITE',
        badgeVariant: 'lime',
        icon: 'drum',
        title: 'Rehearsal',
        description:
          'Walk into a soundproofed room with full band backline ready so your group spends the session playing, not troubleshooting cables.',
        features: [
          'Full drum kit, guitar & bass amplifiers',
          'Vocal PA & floor monitoring system',
          'On-site crew assistance for room setup',
        ],
        ctaLabel: 'Check availability',
        defaultRoom: 'room-a',
        isDraftSpec: true,
      },
      {
        id: 'recording',
        number: '02',
        badge: 'FULL TRACKING',
        badgeVariant: 'orange',
        icon: 'mic',
        title: 'Recording',
        description:
          'Capture live band takes, tight drum tracking, or isolated vocal and instrument overdubs with a dedicated recording engineer.',
        features: [
          'Multitrack live band or isolated booth tracking',
          'Curated vocal & instrument microphone locker',
          'Rough monitor mix export after your session',
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
          'Turn raw multitracks into release-ready singles, EPs, or live session records in an acoustically accurate control room.',
        features: [
          'Attended or unattended mixing workflows',
          'Streaming, vinyl, and live-show stem delivery',
          'Structured revision rounds with your engineer',
        ],
        ctaLabel: 'Check availability',
        defaultRoom: 'room-b',
        isDraftSpec: true,
      },
    ],
  },

  rooms: {
    eyebrow: 'THE SPACES',
    heading: 'Two rooms, zero guesswork',
    intro:
      'Every session takes place in a purpose-built studio space. Inspect the draft room configurations below and pick the room that fits your session.',
    items: [
      {
        id: 'room-a',
        name: 'Room A — Live Room',
        sticker: 'LIVE ROOM • DRAFT SPEC',
        image: {
          src: '/images/demo/room-a-live.svg',
          alt: 'Illustration of Room A Live Room featuring acoustic wood diffusers, guitars, keyboards, and full band floor space',
          width: 960,
          height: 680,
          isDemoAsset: true,
        },
        capacityLabel: 'Up to 6–7 musicians • Band rehearsal & live tracking (Draft spec)',
        tags: ['Full drum kit', 'Guitar & bass amps', 'Stage monitoring', 'Treated live floor'],
        ctaLabel: 'Book this room',
        defaultService: 'rehearsal',
      },
      {
        id: 'room-b',
        name: 'Room B — Control + Booth',
        sticker: 'CONTROL + BOOTH • DRAFT SPEC',
        image: {
          src: '/images/demo/room-b-control.svg',
          alt: 'Illustration of Room B Control Room and isolated Vocal Booth with mixing console and studio monitors',
          width: 960,
          height: 680,
          isDemoAsset: true,
        },
        capacityLabel: '1–4 people • Vocal booth, overdubs & mixing suite (Draft spec)',
        tags: ['Isolated vocal booth', 'Studio monitors', 'Outboard preamps', 'DAW workstation'],
        ctaLabel: 'Book this room',
        defaultService: 'recording',
      },
    ],
    includedLabel: 'All sessions include (draft):',
    includedChips: [
      'Air-conditioned rooms',
      'Fast studio Wi-Fi',
      'Instrument cables & stands',
      'Lounge & waiting area',
      'On-site crew support',
      'Gear check before start',
    ],
  },

  gallery: {
    eyebrow: 'INSIDE THE STUDIO',
    heading: 'Proof, not renders.',
    subtitle:
      'Development preview placeholders shown below — ready to be replaced with approved 37 Music Studio photography.',
    ctaLabel: 'View all photos',
    items: [
      {
        id: 'gallery-1',
        title: 'Maintained studio instruments & backline',
        category: 'BACKLINE DETAIL • DEMO ASSET',
        src: '/images/demo/gallery-guitar.svg',
        alt: 'Close-up demo illustration of an electric guitar body, humbucker pickups, and strings in the studio',
        width: 600,
        height: 680,
      },
      {
        id: 'gallery-2',
        title: 'Live drum room energy & sightlines',
        category: 'ROOM A SESSION • DEMO ASSET',
        src: '/images/demo/gallery-drums.svg',
        alt: 'Demo illustration of a drummer performing on an acoustic drum kit under warm studio lights',
        width: 600,
        height: 680,
      },
      {
        id: 'gallery-3',
        title: 'Isolated vocal booth & condenser chain',
        category: 'VOCAL TRACKING • DEMO ASSET',
        src: '/images/demo/gallery-mic.svg',
        alt: 'Demo illustration of a large-diaphragm condenser microphone and pop filter inside the vocal booth',
        width: 600,
        height: 680,
      },
      {
        id: 'gallery-4',
        title: 'Hands-on mixing & monitor control',
        category: 'ROOM B CONSOLE • DEMO ASSET',
        src: '/images/demo/gallery-console.svg',
        alt: 'Demo illustration of an audio engineer adjusting faders and EQ knobs on the mixing console',
        width: 600,
        height: 680,
      },
    ],
  },

  bookingSection: {
    process: {
      eyebrow: 'HOW IT WORKS',
      heading: 'Three taps to loud.',
      steps: [
        {
          number: '1',
          title: 'Pick room + time',
          description:
            'Choose Rehearsal, Recording, or Mix & Master and let us know your preferred date, start time, and room.',
        },
        {
          number: '2',
          title: 'We confirm availability',
          description:
            'Our studio team checks the 37 Music Studio schedule and replies to confirm your slot and gear setup.',
        },
        {
          number: '3',
          title: 'Show up and play',
          description:
            'Walk into a prepped studio room with backline checked so you spend your session making music.',
        },
      ],
      reassuranceNote: 'Demo inquiry preview — no real booking or calendar hold is created yet.',
    },
    form: {
      heading: 'Booking inquiry',
      subtitle:
        'Tell us what session you are planning. In this Phase 2 preview, submissions are validated locally only.',
      submitLabel: 'Send booking inquiry',
      footnote: 'Demo inquiry only — no personal data is transmitted or stored.',
      demoConfirmationTitle: 'Demo Inquiry Received (Local Preview)',
      demoConfirmationMessage:
        'Demo inquiry only — your request has not been sent. The booking integration will be added later.',
      durations: [
        { value: '2 hours', label: '2 hours (Standard session)' },
        { value: '3 hours', label: '3 hours (Extended rehearsal / tracking)' },
        { value: '4 hours', label: '4 hours (Half-day block)' },
        { value: '6+ hours', label: '6+ hours (Full-day lock / Custom)' },
      ],
      timeSlots: ['10:00', '12:00', '14:00', '16:00', '18:00', '19:00', '20:00', '21:00'],
    },
  },

  testimonialsAndContact: {
    testimonials: {
      eyebrow: 'ARTIST NOTES • DEMO SAMPLE LAYOUT (AWAITING OWNER QUOTES)',
      isVerified: false,
      items: [
        {
          id: 'demo-quote-1',
          quote:
            '“Sample layout quote: Drum room translation and monitor clarity made tightening our live set effortless.”',
          author: 'Sample Band Client',
          role: 'Rehearsal Session • Demo Placeholder',
          badge: 'DEMO QUOTE',
        },
        {
          id: 'demo-quote-2',
          quote:
            '“Sample layout quote: Tracked vocals and guitars in one afternoon with a clean monitor mix ready the same night.”',
          author: 'Sample Recording Artist',
          role: 'Recording & Mix • Demo Placeholder',
          badge: 'DEMO QUOTE',
        },
      ],
    },
    contact: {
      eyebrow: 'FIND US',
      heading: '2 min from the mainline.',
      statusBadge: 'DEMO CONTACT CARD',
      addressLabel: 'Studio address pending owner confirmation',
      addressToken: pendingConfigTokens.studioAddress,
      isAddressConfirmed: false,
      hoursLabel: 'Daily 10:00 – 23:00 (Demo schedule — pending confirmation)',
      hoursToken: pendingConfigTokens.operatingHours,
      isHoursConfirmed: false,
      contactLabel: 'Direct WhatsApp & phone line pending owner confirmation',
      contactToken: pendingConfigTokens.whatsappNumber,
      isContactConfirmed: false,
      image: {
        src: '/images/demo/location-exterior.svg',
        alt: 'Architectural demo illustration representing the studio building exterior',
        width: 720,
        height: 420,
      },
      mapCtaLabel: 'Open in Maps',
      mapPendingNotice:
        'Verified studio map coordinates and street address are pending owner confirmation. Use the on-page booking inquiry form above to test the session inquiry flow.',
    },
  },

  finalCta: {
    eyebrow: 'READY FOR YOUR NEXT SESSION?',
    headline: 'DON’T REHEARSE IN A GARAGE.',
    description:
      'Book a treated room at 37 Music Studio, plug into maintained gear, and hear your band the way it actually sounds.',
    primaryCta: {
      label: 'Book a session',
      href: '#booking',
    },
    secondaryCta: {
      label: 'Ask on WhatsApp',
      isConfirmed: false,
      pendingNotice:
        'The official 37 Music Studio WhatsApp number is pending owner confirmation. We have scrolled you to the on-page booking inquiry demo instead.',
    },
  },

  footer: {
    brandMark: '37',
    brandName: '37 MUSIC STUDIO',
    description:
      'Dedicated rehearsal, recording, and mixing studio for bands, solo musicians, and creators.',
    visitHeading: 'VISIT',
    visitAddressNote: 'Official studio address pending owner confirmation',
    hoursHeading: 'HOURS & CONTACT',
    hoursNote: 'Daily 10:00 – 23:00 (Demo schedule)',
    contactNote: 'WhatsApp & email channels pending confirmation',
    ctaHeading: 'READY TO PLAY?',
    ctaLabel: 'Start booking inquiry →',
    ctaHref: '#booking',
    socialLinks: [
      { id: 'instagram', label: 'Instagram', isConfirmed: false },
      { id: 'tiktok', label: 'TikTok', isConfirmed: false },
      { id: 'youtube', label: 'YouTube', isConfirmed: false },
      { id: 'music', label: 'Streaming / Audio reels', isConfirmed: false },
    ],
    copyright: '© 2026 37 Music Studio. All rights reserved.',
    phaseNote: 'Phase 2 Public Landing Page • Demo Content Mode',
  },
};
