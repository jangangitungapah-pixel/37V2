/**
 * Centralized production base content for the 37 Music Studio public landing page.
 * Merged dynamically at runtime with Owner-managed `publicSiteSettings/site` and
 * published `landingPagePlacements` from Cloud Firestore.
 */

export const landingPageContent = {
  meta: {
    studioName: '37 Music Studio',
    seoTitle: '37 Music Studio — Rehearsal, Recording, Mixing & Mastering',
    seoDescription:
      'Book rehearsal and recording sessions or send a mixing & mastering inquiry at 37 Music Studio. Check live room availability online.',
    isDemoContent: false,
    isPublished: true,
  },

  utilityStrip: {
    descriptor: '37 MUSIC STUDIO • REHEARSAL / RECORDING / MIX & MASTER',
    isHoursConfirmed: true,
    hoursText: '10:00 – 23:00 WIB',
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
      { label: 'Availability', href: '/availability', isRoute: true },
      { label: 'Contact', href: '#contact' },
    ],
    primaryCta: {
      label: 'Book a session',
      href: '#booking',
    },
  },

  hero: {
    badges: [
      {
        id: 'badge-studio',
        label: '37 MUSIC STUDIO • LIVE BOOKING REQUESTS',
        variant: 'white',
        hasDot: true,
      },
      {
        id: 'badge-sessions',
        label: '10:00 – 23:00 WIB',
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
      'Rehearsal, studio tracking, and post-production sessions at 37 Music Studio. Inspect live Room A & Room B availability and send your session request directly to our studio desk.',
    primaryCta: {
      label: 'Book a session',
      href: '#booking',
    },
    secondaryCta: {
      label: 'Check availability',
      href: '/availability',
      isRoute: true,
    },
    facts: [
      {
        id: 'fact-room-a',
        value: 'ROOM A',
        label: 'LIVE REHEARSAL FLOOR',
        highlight: false,
      },
      {
        id: 'fact-room-b',
        value: 'ROOM B',
        label: 'CONTROL + BOOTH',
        highlight: true,
      },
      {
        id: 'fact-hours',
        value: '10–23',
        label: 'DAILY OPERATING HOURS (WIB)',
        highlight: false,
      },
    ],
    featuredPhoto: {
      src: '',
      alt: '37 Music Studio live rehearsal and recording room',
      width: 960,
      height: 680,
      topSticker: '37 MUSIC STUDIO',
      captionTitle: 'ROOM A — LIVE ROOM',
      captionSubtitle: 'Rehearsal & live recording floor at 37 Music Studio',
      demoTagLabel: '',
      floatingBadgeTitle: 'Two Dedicated Rooms',
      floatingBadgeSubtitle: 'Rehearsal • Recording • Mix',
      isDemoAsset: false,
    },
  },

  ticker: {
    items: [
      'BAND REHEARSAL',
      'RECORDING SESSIONS',
      'MIXING & MASTERING',
      '30-MINUTE LIVE SLOTS',
      'DIRECT STUDIO REQUESTS',
      'WHATSAPP COORDINATION',
    ],
  },

  services: {
    eyebrow: 'WHAT WE OFFER',
    heading: 'Pick your session',
    intro:
      'Choose studio room booking for Rehearsal or Recording, or send a dedicated post-production inquiry for Mixing & Mastering.',
    items: [
      {
        id: 'rehearsal',
        number: '01',
        badge: 'STUDIO ROOM SESSION',
        badgeVariant: 'lime',
        icon: 'drum',
        title: 'Rehearsal',
        description:
          'Dedicated studio rehearsal sessions for bands and ensembles with full backline readiness.',
        features: [
          'Group rehearsal floor',
          '30-minute slot scheduling',
          'Room A & Room B options',
        ],
        publicPriceLabel: '',
        ctaLabel: 'Request rehearsal',
        defaultRoom: 'room-a',
      },
      {
        id: 'recording',
        number: '02',
        badge: 'STUDIO ROOM SESSION',
        badgeVariant: 'orange',
        icon: 'mic',
        title: 'Recording',
        description:
          'Focused studio tracking sessions for vocals, instruments, and full-band live takes.',
        features: [
          'Live & booth tracking',
          'Dedicated control room session',
          'Flexible session lengths',
        ],
        publicPriceLabel: '',
        ctaLabel: 'Request recording',
        defaultRoom: 'room-b',
      },
      {
        id: 'mix-master',
        number: '03',
        badge: 'POST-PRODUCTION',
        badgeVariant: 'ink',
        icon: 'sliders',
        title: 'Mix & Master',
        description:
          'Post-production mixing and final mastering inquiries for singles, EPs, and multi-track stems.',
        features: [
          'Post-production workflow',
          'Project brief & target deadline',
          'Direct coordination via WhatsApp',
        ],
        publicPriceLabel: '',
        ctaLabel: 'Send inquiry',
        defaultRoom: 'any',
      },
    ],
  },

  rooms: {
    eyebrow: 'THE SPACES',
    heading: 'Two rooms, zero guesswork',
    intro:
      'Room A and Room B are scheduled independently in 30-minute blocks from 10:00 to 23:00 WIB.',
    items: [
      {
        id: 'room-a',
        name: 'Room A — Live Room',
        sticker: 'ROOM A • LIVE SPACE',
        image: {
          src: '',
          alt: 'Room A live rehearsal space at 37 Music Studio',
          width: 960,
          height: 680,
          isDemoAsset: false,
        },
        capacityLabel: 'Primary rehearsal and live tracking floor at 37 Music Studio.',
        tags: ['Live Rehearsal Floor', 'Band Sessions', '10:00 – 23:00 WIB'],
        ctaLabel: 'Book this room',
        defaultService: 'rehearsal',
      },
      {
        id: 'room-b',
        name: 'Room B — Control + Booth',
        sticker: 'ROOM B • CONTROL + BOOTH',
        image: {
          src: '',
          alt: 'Room B control room and vocal booth at 37 Music Studio',
          width: 960,
          height: 680,
          isDemoAsset: false,
        },
        capacityLabel: 'Recording control room and vocal/instrument tracking suite.',
        tags: ['Control + Booth', 'Tracking & Production', '10:00 – 23:00 WIB'],
        ctaLabel: 'Book this room',
        defaultService: 'recording',
      },
    ],
    includedLabel: 'Scheduling basics:',
    includedChips: [
      '30-minute time blocks',
      'Asia/Jakarta (WIB) schedule',
      'Live availability calendar',
      'Studio team confirmation',
    ],
  },

  gallery: {
    eyebrow: 'INSIDE THE STUDIO',
    heading: 'Proof, not renders.',
    subtitle:
      'Verified 37 Music Studio photography curated and published directly from the studio gallery.',
    ctaLabel: 'View all photos',
    emptyTitle: 'Studio photos coming soon.',
    emptyDescription:
      'Published 37 Music Studio session and room photographs will appear here as soon as they are curated by the studio owner.',
    items: [],
  },

  bookingSection: {
    process: {
      eyebrow: 'HOW BOOKING REQUESTS WORK',
      heading: 'Three taps to loud.',
      steps: [
        {
          number: '1',
          title: 'Pick session + slot',
          description:
            'Choose Rehearsal, Recording, or a Mix & Master inquiry and share your preferred schedule or project details.',
        },
        {
          number: '2',
          title: 'Studio verifies availability',
          description:
            'Our team checks the live studio calendar and reviews your session brief or technical notes.',
        },
        {
          number: '3',
          title: 'Confirmed via WhatsApp',
          description:
            'Once details are agreed via WhatsApp, we lock your official calendar booking and send confirmation.',
        },
      ],
      reassuranceNote: 'Submitting a request notifies the studio desk directly — zero account required.',
    },
    form: {
      heading: 'Send booking request',
      subtitle:
        'Send your session request or mixing/mastering brief. Our studio team will follow up via WhatsApp to finalize availability.',
      submitLabel: 'Submit booking request',
      postProductionSubmitLabel: 'Send post-production inquiry',
      footnote:
        'Requests are reviewed by 37 Music Studio staff before a room slot is officially reserved.',
    },
  },

  testimonialsAndContact: {
    testimonials: {
      eyebrow: 'ARTIST NOTES',
      isVerified: false,
      items: [],
    },
    contact: {
      eyebrow: 'FIND US',
      heading: 'Studio location & hours',
      statusBadge: 'VERIFIED STUDIO INFO',
      isAddressConfirmed: false,
      addressText: '',
      mapsUrl: '',
      isHoursConfirmed: true,
      hoursText: '10:00 – 23:00 WIB',
      isContactConfirmed: false,
      contactText: '',
      whatsappNumber: '',
      email: '',
      image: {
        src: '',
        alt: '37 Music Studio exterior and location',
        width: 720,
        height: 420,
        caption: '',
        isDemoAsset: false,
      },
      mapCtaLabel: 'Open in Maps',
    },
  },

  finalCta: {
    eyebrow: 'READY TO BOOK',
    headline: 'DON’T REHEARSE IN A GARAGE.',
    description:
      'Check live Room A & Room B open slots or send your rehearsal, recording, or mixing & mastering request directly to the studio.',
    primaryCta: {
      label: 'Book a session',
      href: '#booking',
    },
    secondaryCta: {
      label: 'Ask on WhatsApp',
      isConfirmed: false,
      whatsappNumber: '',
      whatsappUrl: '',
      prefilledMessage: '',
    },
  },

  footer: {
    brandMark: '37',
    brandName: '37 MUSIC STUDIO',
    description: '37 Music Studio — Rehearsal, Recording, Mixing & Mastering.',
    visitHeading: 'VISIT & NAVIGATE',
    hoursHeading: 'HOURS & CONTACT',
    ctaHeading: 'READY TO PLAY?',
    ctaLabel: 'Send booking request →',
    ctaHref: '#booking',
    staffLoginLabel: 'Staff / Owner Login',
    staffLoginHref: '/staff/login',
    privacyLabel: 'Privacy Notice',
    privacyHref: '/privacy',
    socialLinks: [],
    copyright: '© 2026 37 Music Studio. All rights reserved.',
    phaseNote: '10:00 – 23:00 WIB',
  },
};
