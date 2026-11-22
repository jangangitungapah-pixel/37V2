# PRD + IMPLEMENTATION PROMPT — 37 MUSIC STUDIO LANDING PAGE

**Phase:** 2 — Public Landing Page  
**Document version:** 0.2  
**Date:** 17 November 2026  
**Status:** Ready for implementation planning; implementation starts only when the user opens Phase 2 work  
**Repository:** `jangangitungapah-pixel/37V2`  
**Target:** Public-facing 37 Music Studio website  
**Design priority:** Mobile-first  
**Language:** JavaScript / JSX

> **This document supersedes PRD v0.1** at `docs/prd/PRD-LANDING-PAGE-2026-11-17.md`. It turns the user's Banani screenshot into the primary visual specification and includes a copy-ready coding-agent prompt in Section 18.

---

# PART A — PRODUCT REQUIREMENTS

## 1. Product Overview

Build a premium public landing page for the physical 37 Music Studio business. The site is the first point of contact for musicians, bands, producers, and creators who are considering the studio.

The page must make the studio feel distinctive, credible, creative, and easy to contact. Visitors should understand the services, see the rooms and studio atmosphere, understand the inquiry process, and be able to start a booking inquiry with minimal friction.

The design must closely follow the user-provided Banani reference screenshot. The intended style is:

**Neo-Brutalist Editorial × Premium Music Studio**

It combines:

- warm ivory / off-white canvas;
- heavy black typography and outlines;
- acid-lime highlight bands;
- signal-orange CTA accents;
- large condensed editorial headlines;
- real, cinematic studio photography;
- rigid card edges and hard offset shadows;
- dense but clearly structured information;
- asymmetric desktop composition;
- carefully reflowed, touch-friendly mobile layouts.

This is not a dashboard, SaaS marketing page, or generic booking template.

## 2. Authoritative Visual Reference

### 2.1 Primary visual source

The user supplied a full-page Banani landing-page screenshot in the conversation and the following preview URL:

https://app.banani.co/preview/4n685iiZ5CXw?component=SiteHeader

The screenshot is the primary visual source of truth. It is more authoritative than generic descriptions such as “premium”, “modern”, “minimal”, or “spatial”.

When beginning implementation, the coding agent must use the actual screenshot supplied by the user. If the image is not available in the coding session/tool context, ask the user to attach it; do not silently substitute a generic interpretation.

The Banani URL is a reference, not an instruction to embed or depend on Banani at runtime. Do not scrape private assets, reuse unlicensed source files, or embed the Banani preview as an iframe.

### 2.2 Visual fidelity requirement

The implementation must reproduce the visual language and content hierarchy closely, not merely borrow its colors.

Preserve:

- page section order and the overall long-form composition;
- two-tier header and compact utility strip;
- dramatic typographic hero with an adjacent large room photograph;
- thin lime ticker/divider band;
- numbered service cards;
- room cards with large photography and clear booking actions;
- proof/gallery strip;
- split booking process + inquiry form panel;
- lime testimonial surface paired with contact/location card;
- full-width orange final CTA;
- black footer with compact business details.

Exact pixel-for-pixel reproduction is not a realistic requirement from one screenshot because source fonts, exact dimensions, and original image assets are not available. However, visual fidelity to the screenshot's hierarchy, contrast, geometry, typography, component treatment, and rhythm is a mandatory acceptance criterion.

## 3. Goals

1. Make the brand and core studio services understandable in the first mobile viewport.
2. Establish a recognizable visual identity based on the supplied reference.
3. Show the studio environment and services through strong visual storytelling.
4. Make booking inquiry the primary customer action.
5. Provide a visible but deliberately non-functional Login entry point for future Owner/Operator authentication.
6. Deliver a fast, accessible mobile-first experience.
7. Keep the page maintainable so real content and future integrations can replace demo data without rewriting the layout.

## 4. Scope and Non-Goals

### 4.1 In scope for Phase 2

- One public landing page at route `/`.
- Responsive desktop, tablet, and mobile layouts.
- Header, section navigation, and mobile menu.
- Hero and primary calls to action.
- Services section.
- Studio rooms/facilities section.
- Image gallery / proof section.
- Booking process explanation.
- Frontend-only booking inquiry form.
- Testimonials/reviews presentation using clearly identified demo content until approved real content is provided.
- Location/contact information card using clearly identified demo content until confirmed.
- Final CTA and footer.
- Dummy Login button and its explanatory interaction.
- Minimal local UI state and form validation where required.
- SEO metadata and accessible semantic markup.
- Reusable components and design tokens for this landing page.

### 4.2 Out of scope

- Real authentication, authorization, registration, password reset, account session, or protected routes.
- Firebase Authentication, Firestore, or any backend connection for Login.
- Real booking creation, slot reservation, calendar availability, payment, deposit, invoices, rescheduling, or cancellation.
- WhatsApp message transmission unless the user provides and approves the actual destination and content.
- CMS or admin editing interface.
- Owner/Operator dashboard.
- Role/permission architecture.
- Customer database, CRM, notification service, or analytics vendor.
- Deployment, DNS/domain configuration, and production release.
- A decision about Phase 3 or any later phase.

**Important:** This phase may display a booking inquiry interface and demo interactions, but it must not claim that a booking has been created or that real availability has been checked.

## 5. Target Visitors and Main Journey

| Visitor                 | Need                                                       | Desired action                                   |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| Band / rehearsal group  | Find a good rehearsal room and understand what is included | Start a rehearsal inquiry                        |
| Recording artist        | Evaluate recording setup and production support            | Start a recording inquiry                        |
| Producer / creator      | Understand mixing/mastering services                       | Start a mix/master inquiry                       |
| Returning customer      | Quickly find rooms, contact, and booking route             | Open booking inquiry                             |
| Studio Owner / Operator | See an entry point for a future internal system            | Tap Login and see a clear “coming later” message |

### Primary journey

1. Arrive from a social profile, search result, shared link, or direct visit.
2. Understand the studio and its offer immediately.
3. Explore services and rooms.
4. See real or clearly marked demo visual assets.
5. Understand the inquiry process.
6. Fill in the frontend demo inquiry form.
7. Receive an honest demo confirmation that no booking request was sent.
8. Optionally tap Login and see that internal access is not implemented yet.

## 6. Page Structure and Visual Specification

Build one long-form landing page. On desktop, use an editorial grid with intentional asymmetry. On mobile, preserve the same narrative order while stacking content vertically.

### Section 01 — Top Utility Strip

**Reference treatment**

- A very slim black strip at the absolute top of the page.
- Tiny uppercase service descriptor on the left.
- Operating-hours copy on the right.
- A compact orange action near the right edge on wide screens.

**Content**

- Service descriptor: rehearsal / recording / mixing / mastering.
- Operating-hours text: use a configurable demo placeholder until verified.
- Optional shortcut to the booking section.

**Responsive**

- Keep the strip short on mobile.
- Remove or condense non-essential text at very narrow widths.
- Do not use an uncontrolled marquee that continuously moves important information.
- If a ticker effect is used, it must be slow, pauseable, and hidden from reduced-motion users.

### Section 02 — Main Header / Navigation

**Reference treatment**

- Warm ivory background.
- Compact square 37 mark at left, followed by wordmark and micro tagline.
- Desktop navigation links in the center/right.
- Outlined secondary utility button and solid orange primary booking button.
- Strong black bottom border.

**Navigation anchors**

- Services
- Rooms
- Gallery
- How to book
- Contact

**Login dummy**

- Add a visible `Login` button in the header.
- Make it visually secondary to the orange `Book now` CTA.
- On mobile, keep Login reachable without hiding the primary booking action. If space is limited, retain the Login action in the mobile menu while keeping Book now visible in the header.
- Login is not a route and must not look like a working sign-in page.

**Mobile**

- Brand mark/wordmark on the left.
- Compact menu trigger.
- Book now primary button visible where practical.
- Login remains reachable in the open menu or a compact secondary control.
- Use Base UI accessible menu/dialog primitives if required.
- Menu opens/closes cleanly, supports Escape, and returns focus to its trigger.

### Section 03 — Hero

**Reference treatment**

- Warm ivory background.
- Desktop: two-column, asymmetric composition; text on the left and a large studio image on the right.
- Small pill-shaped information badges above the headline.
- Extremely large, bold, condensed, poster-like headline.
- One part of the headline may use an inverted black rectangle; the final emphasized word uses signal orange.
- Short supporting paragraph.
- Primary orange CTA and secondary white/ivory outlined CTA.
- Studio photo framed by a thick black edge and hard offset shadow.
- Small label stickers / room information may overlap the photo edge.
- A three-part fact strip sits under the hero content with one lime cell.

**Suggested headline direction**

- “LOUD ROOMS FOR LOUD IDEAS.”
- This is sample copy for layout direction, not immutable brand copy. Keep the headline in a content config so the user can revise it.

**CTA behavior**

- Primary: `Book a session` / `Book now` → scroll to `#booking`.
- Secondary: `See the rooms` → scroll to `#rooms`.
- Hero badges may display short brand descriptors, but must not make unverified availability or rating claims.

**Hero image**

- Use the real approved room/studio image when supplied.
- If none is supplied, use an obvious development placeholder with an isolated replaceable asset path. Do not imply an AI-generated room is the actual 37 Music Studio facility.

**Mobile**

- Stack content in this order: badges, headline, paragraph, CTAs, image, fact strip.
- The headline must fit the viewport without clipping or horizontal overflow.
- Primary CTA must be visible without requiring the user to scroll past a large decorative image.
- Image remains large and impactful, not reduced to a tiny thumbnail.
- Fact strip may become a three-column compact strip only if readable; otherwise stack or use a two-plus-one arrangement.

### Section 04 — Lime Service Ticker / Divider

**Reference treatment**

- Full-width bright acid-lime strip.
- Very small black uppercase type repeating service categories.
- Functions as a strong visual transition between hero and services.

**Rules**

- Use CSS animation only if it adds value.
- Respect `prefers-reduced-motion`.
- Do not let moving text become the only place where services are communicated.
- Provide a static readable fallback.

### Section 05 — Services (“Pick your session”)

**Reference treatment**

- Warm ivory section.
- Small black uppercase eyebrow label.
- Large bold section heading.
- Brief explanatory copy aligned opposite the heading on desktop.
- Three numbered cards with thick black border and hard black offset shadow.
- Each card includes a number, short status/category label, icon tile, title, description, concise feature list, and bottom action row.

**Default demo categories**

1. Rehearsal
2. Recording
3. Mix & Master

These are draft categories from the existing product concept. The user must confirm final service availability and content before production.

**Card behavior**

- `Check availability` scrolls to `#booking` and preselects the corresponding inquiry service.
- Do not display real-time availability or imply a slot is open.
- Category status chips are descriptive labels only, not real inventory/availability statuses unless confirmed.

**Mobile**

- Single-column stack by default.
- Do not force horizontal carousel behavior for core service information.
- Keep card CTAs full-width or easy to tap.
- Preserve the numbered, poster-like visual style.

### Section 06 — Rooms / Studio Spaces (“Two rooms, zero guesswork”)

**Reference treatment**

- Strong section divider.
- Small dark eyebrow and large heading.
- Two large image-led room cards side-by-side on desktop.
- Each card has thick black outline and hard offset shadow.
- Large room photograph with small lime sticker/label.
- Room name, capacity/features, compact chips, and black full-width booking action at the bottom.
- Small capability chips may appear under the cards.

**Default demo room labels**

- Room A — Live Room
- Room B — Control + Booth

Room names, capacity, facilities, equipment, amenities, and claims are configurable draft content only. Do not present these as confirmed facts until the user verifies them.

**Card behavior**

- `Book this room` scrolls to `#booking` and preselects that room in the demo form.
- Do not show a real availability badge or real-time status.

**Mobile**

- Stack room cards vertically.
- Keep photographs prominent with consistent image aspect ratios.
- Place card actions immediately after card details.
- Capability chips wrap naturally without causing horizontal overflow.

### Section 07 — Gallery (“Proof, not renders.”)

**Reference treatment**

- Bold editorial heading.
- Optional `View all photos` link/button.
- Desktop: four-photo horizontal grid with varying but aligned card proportions.
- Hard borders and shadows.
- Photo subjects may include instruments, artists, recording microphones, consoles, and the room atmosphere.

**Image policy**

- Prefer real photos supplied/approved by the user.
- Do not synthesize fake customers, fake artists, fake equipment, or fake 37 Music Studio rooms.
- Use clearly marked placeholders during development if assets are unavailable.
- Images must have stable dimensions/aspect ratios to prevent layout shift.
- Add useful alt text for informative photos.

**Mobile**

- Use a well-balanced two-column grid if readable; otherwise a one-column or carefully controlled two-column composition.
- Never require horizontal scrolling to discover essential content.
- Do not autoplay a carousel.

### Section 08 — Booking Process + Booking Inquiry

**Reference treatment**

- A bold split panel.
- Left: black background, lime eyebrow, large white editorial heading (e.g. “Three taps to loud.”), three numbered process steps, small reassurance/social-proof line.
- Right: warm/white panel with booking inquiry heading and concise helper copy.
- Form controls are compact, clearly labeled, strongly bordered, and aligned to the same grid.
- Orange full-width submit button.

**Process copy**
Use simple draft steps such as:

1. Pick room + time.
2. We confirm availability.
3. Show up and play.

Because this phase has no backend or real calendar availability, label the section as an inquiry/demo flow and do not claim an actual confirmation will occur.

**Frontend-only demo form fields**

- Name / band name.
- WhatsApp / contact number.
- Requested service.
- Room preference (if applicable).
- Preferred date.
- Preferred start time.
- Estimated duration.
- Notes / additional requirements.
- Submit button.

**Form implementation**

- Use React Hook Form + Zod only if useful for this client-side validation.
- Provide clear required/optional labeling and inline error messages.
- Input types and mobile keyboard hints must match the data.
- No data is submitted to Firebase, Firestore, an API, email, or WhatsApp in this phase.
- On submit, show an honest success/demo state such as: “Demo inquiry only — your request has not been sent. The booking integration will be added later.”
- Do not store personal data in localStorage or send it to a third party.
- A reset/edit option must be available after demo submission.
- Avoid collecting sensitive information.

**Mobile**

- Stack process panel above the form panel.
- Inputs are full-width, vertically arranged, and at least 44 CSS px in height.
- Use native date/time inputs unless a strong accessibility reason requires a custom control.
- The submit button is full-width.
- Avoid a side-by-side two-column form on small phones.

### Section 09 — Testimonials + Location / Contact

**Reference treatment**

- Desktop: lime testimonial panel on the left and a white/ivory location/contact card on the right.
- Testimonials are displayed in crisp white cards with black outlines.
- Contact card has a dark eyebrow, strong heading, address/hours/phone rows, location image/map preview, and a directions action.
- Cards use the same hard shadow geometry as earlier sections.

**Content constraints**

- Testimonials, names, avatars, star ratings, customer counts, address, hours, phone number, and map pin are all unverified until supplied.
- Use explicitly labelled demo content during UI development. Never publish invented ratings, quotes, visitor/session counts, business details, or coordinates as real.
- Map preview may use a neutral placeholder until an approved location is provided.
- `Open in Maps` must not point to an invented address.

**Mobile**

- Stack testimonial and contact panels.
- Testimonials must remain readable; no tiny carousel-only text.
- Contact details must use tappable phone/map links when configured.

### Section 10 — Final CTA

**Reference treatment**

- Full-width vivid signal-orange panel.
- Thick black outline and hard offset shadow.
- Small dark eyebrow label.
- Huge uppercase condensed headline (e.g. “DON’T REHEARSE IN A GARAGE.”).
- One short supporting sentence.
- Dark primary booking button and contrasting secondary contact button.

**Behavior**

- Primary CTA scrolls to `#booking`.
- Secondary CTA can open an approved WhatsApp contact target only after the user supplies it. Until then, use a clearly marked non-production placeholder that does not launch a fabricated URL.

**Mobile**

- Strong stacked headline with controlled line breaks.
- Buttons stack or wrap with comfortable tap targets.
- Avoid clipping and excessively tall empty banner space.

### Section 11 — Footer

**Reference treatment**

- Full-width black background.
- Brand lockup and short brand descriptor.
- Compact address/directions block.
- Hours and contact block.
- Quick booking CTA in orange.
- Social icon buttons with accessible names.
- Thin lower divider and small copyright/legal row.

**Content**

- Use approved social links and business details only.
- Omit unprovided legal links or display neutral development placeholders; do not invent a legal policy.
- Keep footer content readable on mobile.

## 7. Visual Design System

### 7.1 Working color tokens

Approximate values sampled by visual judgment from the supplied screenshot. They are initial design tokens, not guaranteed extracted brand specifications.

| Token         | Approx. value | Usage                                                        |
| ------------- | ------------- | ------------------------------------------------------------ |
| Warm ivory    | `#F1EEE4`     | Main page canvas and light surfaces                          |
| Ink black     | `#151515`     | Text, outlines, dark panels, footer                          |
| Acid lime     | `#C8F13A`     | Ticker, feature highlights, eyebrow chips, testimonial panel |
| Signal orange | `#FF4B22`     | Primary CTA and headline emphasis                            |
| Clean white   | `#FFFFFF`     | Card interiors and contrast surfaces                         |
| Muted gray    | `#DAD6CB`     | Secondary borders / restrained surfaces                      |

Centralize these as CSS custom properties. Do not scatter raw color values throughout component markup.

### 7.2 Borders and shadows

- Use a consistent strong black outline, generally 1.5–2 px depending on viewport and component scale.
- Use hard offset shadows (for example, 4–6 px horizontal/vertical offset, zero or very small blur).
- Do not replace the reference's hard shadows with soft ambient shadows.
- Use small consistent corner radii; avoid over-rounded “SaaS card” styling.
- Buttons should feel tactile, with clear pressed/active states that do not shift the page layout unexpectedly.

### 7.3 Typography

- Display headlines: heavy condensed or tightly tracked grotesk type with poster-like impact.
- Body: clean, highly readable sans-serif.
- Utility labels: very small but legible uppercase text with modest tracking.
- Use one display family and one body family at most unless an approved brand font is provided.
- Font assets must have appropriate usage rights. If no approved font asset exists, use well-supported fallback stacks and document the temporary choice.
- Do not shrink body copy below readable sizes just to imitate tiny text in the screenshot.

### 7.4 Spatial composition

- Use a clear page grid, strong alignment, and occasional intentional asymmetry.
- Maintain visual rhythm through alternating ivory, black, lime, and orange surfaces.
- Images, cards, ticker, and CTA should establish depth through layered edges and hard shadows rather than heavy blur.
- Avoid generic glassmorphism, floating translucent panels, excessive gradients, glowing borders, neon effects, and gratuitous parallax.
- The page can be visually bold without adding continuous motion.

## 8. Mobile-First and Responsive Rules

Mobile is the primary design target. Implement mobile structure first, then enhance it for larger screens.

| Viewport     | Required behavior                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------- |
| 320–374 px   | No horizontal overflow; single-column sections; compact header; readable display type           |
| 375–430 px   | Primary mobile review target; balanced spacing, prominent hero CTAs, comfortable touch controls |
| 431–767 px   | Fluid mobile/tablet transition; preserve vertical hierarchy                                     |
| 768–1023 px  | Introduce two-column layouts where they improve clarity                                         |
| 1024 px+     | Restore the reference's asymmetric editorial grid and expanded navigation                       |
| Wide desktop | Restrained maximum content width; do not stretch text lines or cards excessively                |

Mandatory mobile rules:

- Design and test at 375–430 px before desktop tuning.
- Do not simply scale down the desktop design.
- No horizontal document scrolling at supported widths.
- No hover-only content or controls.
- Minimum project target for touch areas: 44 × 44 CSS px.
- Keep essential CTA, services, room details, and contact content accessible without desktop-only interactions.
- Respect device safe areas and do not obstruct content with sticky elements.
- Avoid mandatory horizontal carousels for service or room information.
- Stack the booking process and inquiry form.
- Ensure the Login dummy remains reachable on mobile.
- Prefer a compact navigation drawer/menu rather than squeezing all nav links into a narrow header.
- The hero heading must reflow naturally; no fixed-height text box that clips at narrow widths.

## 9. Dummy Login Requirement

This is a deliberately temporary UI affordance for the future internal application.

### Required behavior

- Show a `Login` button in the public page header.
- It is a real clickable UI control, but it must not authenticate or navigate to a sign-in route.
- On click, open a small accessible dialog or show a Sonner toast. Preferred behavior: dialog, because it can communicate the intent clearly.
- Suggested message:
  - Title: `Studio access is coming soon`
  - Body: `Owner and operator login will be available in a future update.`
  - Action: `Got it` / `Close`
- On mobile, keep Login available from the header/menu.
- The visual state should be distinct from the primary customer booking CTA.

### Prohibited Login behavior

- Do not add `/login` or `/auth` routes.
- Do not show a username/password form.
- Do not initialize Firebase Auth.
- Do not add authentication state, fake sessions, fake credentials, or role selection.
- Do not write auth-related records to Firebase.
- Do not claim that login is working.
- Do not add new auth dependencies.

## 10. Functional Interaction Matrix

| Element                              | Expected behavior in Phase 2                             |
| ------------------------------------ | -------------------------------------------------------- |
| Logo                                 | Scroll to top / route to `/`                             |
| Services nav                         | Scroll to `#services`                                    |
| Rooms nav                            | Scroll to `#rooms`                                       |
| Gallery nav                          | Scroll to `#gallery`                                     |
| How to book nav                      | Scroll to `#how-to-book`                                 |
| Contact nav                          | Scroll to `#contact`                                     |
| Book now / Book a session            | Scroll to `#booking`                                     |
| See the rooms                        | Scroll to `#rooms`                                       |
| Check availability on a service card | Scroll to `#booking` and preselect that service          |
| Book this room                       | Scroll to `#booking` and preselect that room             |
| Inquiry form submit                  | Client-side validation and honest demo confirmation only |
| Login                                | Accessible “coming soon” dialog; no authentication       |
| Open in Maps                         | Only works when the actual destination is supplied       |
| WhatsApp / phone / social links      | Only use verified owner-provided destinations            |

All interactive elements must have a real and clear behavior. If a destination is not supplied, do not pretend a placeholder link works.

## 11. Technical Requirements and Existing Dependencies

Use the dependency foundation already committed in Phase 1. Do not introduce another UI system or replace pinned packages without an explicit reason and approval.

| Need                      | Existing dependency                         | Phase 2 guidance                                                   |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| UI runtime                | React 19.3.1 + React DOM                    | JavaScript / JSX only                                              |
| Build tool                | Vite 8.3.8                                  | Use existing config                                                |
| Styling                   | Tailwind CSS 4.3.5                          | Mobile-first layout and tokens                                     |
| Accessible primitives     | `@base-ui/react` 1.9.0                      | Menu and dialog interactions                                       |
| Local components          | shadcn CLI 4.23.0                           | Add only required component source                                 |
| Animation                 | `motion` 14.14.0                            | Optional, limited interaction/reveal motion                        |
| Icons                     | `lucide-react` 1.74.0                       | Consistent icons                                                   |
| Class helpers             | CVA 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0 | Component variants and class merging                               |
| Form                      | React Hook Form 7.92.0                      | Client-side inquiry form                                           |
| Validation                | Zod 4.6.7 + resolvers 7.0.7                 | Client-side validation                                             |
| Feedback                  | Sonner 2.0.8                                | Use only for meaningful feedback                                   |
| Routing                   | React Router 8.5.1                          | Only if current app routing requires it; no login route            |
| Backend SDK               | Firebase 13.3.0                             | Do not import/use in this phase                                    |
| Global state              | Zustand 5.1.0                               | Not needed; use local state                                        |
| Server state              | TanStack Query 5.107.1                      | Not needed for static/demo content                                 |
| Charts                    | ECharts 6.1.0                               | Not used                                                           |
| Data table/virtualization | TanStack Table / Virtual                    | Not used                                                           |
| Date/time utilities       | date-fns / @date-fns/tz                     | Use only if needed for demo date input; no real availability logic |

### Bundle policy

- Do not import all packages because they are installed.
- Do not load Firebase, ECharts, TanStack Query, Zustand, table, or virtualization code on the landing page.
- Keep static content in a small configuration/data module.
- Lazy-load gallery viewer functionality if added.
- Prefer CSS for simple hover/pressed transitions.
- Use Motion only where it materially improves interaction.
- Avoid autoplay video backgrounds, heavy parallax, and continuous large-surface animation.
- Avoid unnecessary dependencies and do not add a carousel package; CSS grid and existing primitives are sufficient.

## 12. Content and Data Strategy

All business content must live in a centralized, easy-to-replace source module (for example, `src/data/landing-page-content.js`).

The content module should clearly separate:

- confirmed content supplied by the owner;
- draft copy awaiting approval;
- demonstration placeholders;
- link destinations requiring real values.

Use explicit placeholder strings such as:

- `[STUDIO_ADDRESS_PENDING]`
- `[WHATSAPP_NUMBER_PENDING]`
- `[OPERATING_HOURS_PENDING]`
- `[STUDIO_DOMAIN_PENDING]`

Do not display these raw tokens to public visitors. For missing production data, hide the corresponding row or show a development-only visual placeholder with an obvious label.

The following are unconfirmed and must not be fabricated:

- address and map coordinates;
- operating hours;
- phone, WhatsApp, and email;
- social media URLs;
- prices, packages, service durations, and discounts;
- room names, capacities, equipment, and included facilities;
- booking availability;
- testimonials, names, ratings, and customer/session counts;
- customer/artist identities and endorsements.

Demo values may exist for local design preview only. Mark them as demo in code/config and ensure they are not mistaken for verified facts.

## 13. Accessibility, Performance, SEO, and Quality

### Accessibility

- Target WCAG 2.2 AA.
- Use semantic header, nav, main, section, form, and footer landmarks.
- Maintain a logical H1/H2/H3 structure.
- All controls work with keyboard and touch.
- Visible focus indicators are mandatory.
- Menus/dialogs must manage focus, Escape behavior, and accessible labels.
- Use informative alt text for meaningful images; decorative images use empty alt.
- Do not use color alone to communicate status.
- Respect `prefers-reduced-motion`.

### Performance

- Prioritize mobile rendering and real image optimization.
- The hero image should have intrinsic dimensions and loading priority appropriate to its LCP role.
- Below-the-fold gallery images should lazy-load.
- Use responsive image sizing and modern image formats where available.
- Avoid CLS through stable image aspect ratios and reserved layout space.
- Avoid importing unused dependencies.
- Performance targets for release measurement:
  - LCP ≤ 2.5 s
  - INP ≤ 200 ms
  - CLS ≤ 0.1
- These are targets, not claims about unmeasured results.

### SEO and sharing

- Descriptive title and meta description.
- Approved Open Graph/social preview image.
- Canonical URL only after the public domain is confirmed.
- Semantic content and heading hierarchy.
- LocalBusiness structured data only after owner data is verified.
- Do not publish fake business claims, ratings, or offers.

### Quality

- ESLint clean.
- Prettier check clean.
- Vitest passes.
- Vite production build succeeds.
- Verify responsive behavior at 320, 375, 390, 430, 768, 1024, 1280, and 1440 px.
- Verify keyboard navigation and reduced-motion mode.
- Verify all button destinations and form messages.
- Compare implementation screenshots against the Banani reference.

## 14. Acceptance Criteria

### Visual fidelity

- [ ] Overall page closely resembles the supplied reference's neo-brutalist editorial identity.
- [ ] Warm ivory, black, acid lime, and signal orange are used consistently.
- [ ] Strong black outlines and hard offset shadows are present on the appropriate cards and CTA panels.
- [ ] Hero hierarchy and photo treatment match the reference.
- [ ] The lime ticker/divider, numbered service cards, room cards, gallery, booking split panel, testimonial/contact row, orange CTA, and black footer are implemented.
- [ ] Typography feels bold, condensed, and editorial without sacrificing readability.
- [ ] No generic SaaS dashboard or glassmorphism visual language has replaced the reference style.

### Mobile-first

- [ ] Mobile composition is designed first and reviewed at 375–430 px.
- [ ] No horizontal overflow down to 320 px.
- [ ] Header navigation and Login are reachable.
- [ ] Primary booking action is easy to access.
- [ ] Service/room cards stack cleanly.
- [ ] Booking process and form stack vertically.
- [ ] Buttons and form controls are touch-friendly.
- [ ] The visual hierarchy remains recognizable at all tested sizes.

### Function

- [ ] All section navigation and scroll CTAs work.
- [ ] Service/room CTAs preselect the correct demo form option.
- [ ] Inquiry form validates inputs and shows the explicitly labelled demo response.
- [ ] No inquiry data is sent or persisted.
- [ ] Login opens the “coming soon” dialog.
- [ ] No login route, credentials form, Firebase Auth, or fake session exists.
- [ ] Missing link targets do not lead to fake destinations.

### Engineering

- [ ] Only existing dependencies are used unless an addition is approved.
- [ ] No unused heavy dependency is imported.
- [ ] Static content is centralized and replaceable.
- [ ] All quality commands pass and results are provided.
- [ ] No deployment or PR merge occurs without explicit user authorization.

## 15. Required User Assets / Inputs

The following can be supplied during implementation or left as clearly identified local-only placeholders until available:

| Item                                         | Needed for production?                | Current status                                                       |
| -------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Banani screenshot (primary visual reference) | Yes, for visual comparison            | Supplied in this conversation; not currently committed in repository |
| 37 Music Studio logo/mark                    | Yes                                   | To provide/confirm                                                   |
| Actual room photos                           | Yes for factual studio representation | To provide                                                           |
| Gallery photos                               | Strongly recommended                  | To provide                                                           |
| Actual services and descriptions             | Yes                                   | To confirm                                                           |
| Room details/capacities/features             | Yes if displayed                      | To confirm                                                           |
| WhatsApp / phone / email                     | Yes if contact CTAs are enabled       | To confirm                                                           |
| Address / map destination                    | Yes if location card is enabled       | To confirm                                                           |
| Opening hours                                | If displayed                          | To confirm                                                           |
| Pricing                                      | Optional; owner decision              | To confirm                                                           |
| Testimonials and rating source               | Optional                              | To confirm                                                           |
| Production domain                            | Before canonical SEO / launch         | To confirm                                                           |

---

# PART B — COPY-READY IMPLEMENTATION PROMPT

The following prompt is intended to be copied as a complete instruction to the coding agent when the user explicitly starts Phase 2. The coding agent must read this PRD and use the attached Banani screenshot before writing code.

## 16. Implementation Prompt

```text
You are implementing Phase 2 of the 37 Music Studio application.

REPOSITORY
https://github.com/jangangitungapah-pixel/37V2

BRANCH
main

PRODUCT
A public-facing, mobile-first landing page for the physical 37 Music Studio business.

AUTHORITATIVE DESIGN REFERENCE
Use the user-provided full-page Banani screenshot and this preview URL:
https://app.banani.co/preview/4n685iiZ5CXw?component=SiteHeader

The screenshot is the primary design source of truth. Inspect it before coding. If the image is not available to you, ask the user to attach it. Do not replace it with an unrelated template or generic inspiration.

PHASE OBJECTIVE
Build the complete public landing page described in:
docs/prd/PRD-LANDING-PAGE-PHASE-2-v0.2.md

The expected visual direction is:
NEO-BRUTALIST EDITORIAL × PREMIUM MUSIC STUDIO.

It must closely follow the screenshot's layout hierarchy, section sequence,
warm ivory canvas, black typography and borders, acid-lime accent bands,
signal-orange CTAs, large condensed editorial headlines, studio imagery,
hard offset shadows, and tactile cards.

IMPORTANT: DESIGN MOBILE FIRST.
Build and tune the experience at 375–430 px before widening it. It must
also work at 320 px with no horizontal overflow. Do not merely shrink a
desktop layout.

BEFORE CODING
1. Inspect the current repository, package.json, vite.config.js,
   src/styles/index.css, and the Phase 1 dependency foundation.
2. Read the entire PRD linked above.
3. Confirm that you have access to the visual reference screenshot.
4. Inspect existing local changes before editing. Do not overwrite user
   work or discard uncommitted files.
5. Do not install a new UI framework or replace pinned dependencies.
6. Keep JavaScript / JSX. Do not migrate to TypeScript.

IMPLEMENT ONLY THIS PHASE
Create one public landing page at route "/". Do not implement dashboard,
actual Login/authentication, Firebase, backend services, real bookings,
availability checking, payments, CRM, or deployment.

PAGE STRUCTURE — PRESERVE THIS ORDER
1. Slim black utility strip with service descriptor and operating-hours
   placeholder.
2. Warm ivory main header with 37 brand mark, section navigation, a
   secondary Login dummy action, and orange Book now CTA.
3. Asymmetric hero: information badges, oversized editorial headline,
   short description, orange primary CTA, outlined secondary CTA, large
   studio photograph, overlapping label stickers, and compact facts strip.
4. Acid-lime service ticker/divider.
5. Services section with three numbered, bordered, hard-shadow cards:
   Rehearsal, Recording, Mix & Master (draft content pending confirmation).
6. Rooms section with two large photo-led cards:
   Room A — Live Room and Room B — Control + Booth (draft labels pending
   confirmation).
7. Gallery section with title "Proof, not renders." and photo grid.
8. Split booking section: black 3-step process panel plus light booking
   inquiry form panel.
9. Acid-lime testimonials panel paired with a location/contact card.
10. Full-width signal-orange final CTA panel.
11. Black footer with brand, contact/location placeholders, social links,
    and quick booking CTA.

MATCH THE REFERENCE'S VISUAL LANGUAGE
- Approximate working palette:
  warm ivory #F1EEE4
  ink black #151515
  acid lime #C8F13A
  signal orange #FF4B22
  white #FFFFFF
- Centralize these into CSS variables / existing token system.
- Strong black borders (roughly 1.5–2 px).
- Hard offset black shadows (roughly 4–6 px), minimal blur.
- Small consistent corner radii, not excessive pill/rounded SaaS cards.
- Large heavy condensed display typography and readable sans-serif body.
- Tiny uppercase section labels and microcopy, but keep readable on mobile.
- Editorial grid, asymmetric desktop rhythm, and alternating ivory,
  black, lime, and orange section surfaces.
- Use actual screenshot composition as a reference. Do not invent a new
  visual style.
- Do not add glassmorphism, glowing gradients, large blur, gratuitous
  parallax, or constant floating animations.

RESPONSIVE BEHAVIOR
- 320–374 px: compact header, single-column layout, no overflow.
- 375–430 px: primary design target; clear hero CTA and readable type.
- 431–767 px: fluid stacked layout.
- 768–1023 px: selected two-column compositions.
- 1024 px+: expand into reference-like asymmetric grids.
- Use a compact accessible mobile menu.
- Keep Login reachable on mobile; Book now should remain prominent.
- Stack services and room cards vertically on mobile.
- Stack booking process above the form.
- Never require horizontal swiping to access essential content.
- All touch targets should aim for at least 44 x 44 CSS px.
- Respect device safe areas.
- No hover-only content or functionality.

LOGIN DUMMY — REQUIRED
Add a visible Login button in the header. It must be clickable and polished
but deliberately non-functional as authentication.

On click, open an accessible Base UI dialog (preferred) with:
Title: "Studio access is coming soon"
Body: "Owner and operator login will be available in a future update."
Action: "Got it" or "Close"

Do not:
- create /login or /auth routes;
- create username/password inputs;
- initialize Firebase Authentication;
- add fake credentials or a fake session;
- create roles or protected routes;
- write anything to Firebase;
- claim the login feature works.

BOOKING INQUIRY — FRONTEND DEMO ONLY
Create a booking inquiry UI consistent with the reference. Include:
- Name / band name
- WhatsApp / contact number
- Service
- Room preference
- Preferred date
- Preferred start time
- Estimated duration
- Notes

Use React Hook Form + Zod if needed for client-side validation.
Service-card CTAs must scroll to #booking and preselect the service.
Room-card CTAs must scroll to #booking and preselect the room.

On submit:
- validate the form;
- do not call an API, Firebase, WhatsApp, email, or any external service;
- do not persist or transmit personal data;
- show an honest demo message:
  "Demo inquiry only — your request has not been sent. The booking
   integration will be added later."
- provide a way to edit/reset the form.

Do not claim that availability has been checked or a reservation has
been created.

CONTENT / ASSET HANDLING
- Put page copy and configurable content into a maintainable data module.
- No invented phone number, WhatsApp link, address, coordinates, hours,
  price, discount, availability, review, rating, customer count, or
  equipment claim.
- Use clearly labelled development-only placeholders where actual
  information or photographs are missing.
- Hide missing production contact rows rather than rendering fake data.
- Use actual user-provided studio photos when available.
- Do not generate fake room/customer/equipment photos that could be
  mistaken for the real business.
- Do not publish placeholder tokens to production.

TECHNICAL STACK — USE WHAT IS ALREADY INSTALLED
- React 19.3.1 + React DOM
- Vite 8.3.8
- Tailwind CSS 4.3.5
- @base-ui/react 1.9.0
- shadcn CLI 4.23.0 (add only required local component source)
- motion 14.14.0 (selective motion only)
- lucide-react 1.74.0
- sonner 2.0.8
- react-hook-form 7.92.0
- zod 4.6.7
- @hookform/resolvers 7.0.7
- clsx 2.1.1
- tailwind-merge 3.7.0
- class-variance-authority 0.7.1

Avoid importing Firebase, ECharts, TanStack Query, Zustand, TanStack
Table, or virtualization on this static/demo landing page. They are
already installed for future needs but are not needed here. Do not add
a carousel package.

ENGINEERING EXPECTATIONS
- Use semantic React components with clear responsibilities.
- Keep page content separate from presentation.
- Use CSS variables for palette, borders, shadows, and spacing tokens.
- Avoid giant monolithic components.
- Avoid unnecessary abstraction and premature design-system work.
- Keep interactions accessible and keyboard operable.
- Implement visible focus states and reduced-motion behavior.
- Prevent layout shift with reserved image aspect ratios and intrinsic
  image dimensions.
- Prioritize the hero image; lazy-load below-the-fold images.
- Use CSS for simple transitions; use Motion only where meaningful.
- Do not add complex animation merely to make the page appear premium.
- No new dependencies without explicit approval.

QUALITY / VERIFICATION
Run the existing project's checks:
- npm run format:check
- npm run lint
- npm run test:run
- npm run build
- npm audit

Check responsive screenshots at:
320, 375, 390, 430, 768, 1024, 1280, and 1440 px.

Manually verify:
- nav anchors;
- mobile menu and focus handling;
- Book now / See the rooms;
- service-card preselection;
- room-card preselection;
- inquiry validation and demo confirmation;
- Login coming-soon dialog;
- reduced-motion mode;
- keyboard-only navigation;
- no horizontal overflow.

Compare the final screenshots side by side with the Banani reference.
Record any intentional mobile-specific layout changes.

PROCESS RULES
- Implement only Phase 2 requirements.
- Do not choose or begin Phase 3.
- Do not deploy.
- Do not merge a PR.
- Do not overwrite uncommitted user work.
- Do not claim tests passed unless command output proves it.
- After completion, report changed files, commit SHA, verification
  results, known gaps/assets still needed, and create a detailed
  HANDOFF .txt for the next chat.
- The user alone decides what the next phase implements.
```

## 17. Phase 2 Definition of Done

Phase 2 is complete only when:

- the public landing page is implemented at `/`;
- all eleven page sections are present in the correct order;
- visual comparison against the supplied Banani screenshot has been reviewed;
- mobile-first responsive behavior has been checked at the specified widths;
- all navigation and section CTAs work;
- service and room cards preselect the matching demo inquiry options;
- the inquiry form validates locally and clearly states that it does not send a real request;
- the Login dummy dialog works and no real authentication has been added;
- no fake business information is presented as verified;
- formatting, lint, tests, production build, and npm audit results are recorded;
- a detailed Phase 2 handoff `.txt` has been created;
- no deployment or PR merge has occurred without explicit user permission.

## 18. Decisions Still Requiring Owner Input

These details can be provided while implementation is being prepared. Until confirmed, the page must use development-only placeholders or omit the corresponding content:

1. Approved 37 Music Studio logo/wordmark.
2. Real room photos and gallery assets.
3. Final service names and service descriptions.
4. Actual room names, facilities, equipment, and capacity.
5. WhatsApp / phone / email destinations.
6. Address, map destination, and operating hours.
7. Public pricing policy.
8. Authentic testimonials/reviews and permission to publish them.
9. Final display/body fonts and any brand-specific typography assets.
10. Production domain.

**Phase authority:** This PRD defines Phase 2 only. It does not authorize work on Phase 3. The user decides the next scope after reviewing Phase 2 results.

---

## 19. Post-Phase Addendum — Google Maps Reviews Social Proof Section

Added after Phase 2 completion as a standalone public Landing Page enhancement (`src/components/landing/GoogleReviewsSection.jsx` and `src/lib/google-maps/places-client.js`):

- **Placement:** Inserted independently in `src/pages/LandingPage.jsx` directly after `GallerySection` and before `PublicAvailabilityTeaserSection`, without modifying or replacing the existing Artist Testimonials mechanism in `TestimonialsAndContactSection.jsx`.
- **Data Source & Boundary:** Frontend-only integration using **Google Maps JavaScript API — Places Library (New)** (`Place.fetchFields()`) targeting `37 Music Studio TANGERANG` (`VITE_GOOGLE_MAPS_PLACE_ID`, default `ChIJfYXPy6P-aS4RFCRQptFpsVg`), lazy-loaded on viewport approach via `IntersectionObserver`, holding review payloads in transient runtime memory only (zero Firestore/browser storage persistence).
- **Fallback & Compliance:** Verifies business identity at runtime (`verifyStudioPlaceIdentity`), displays live aggregate rating/count, up to 5 attributed Google reviews in Google relevance order with direct `googleMapsURI` links, and degrades gracefully to `https://share.google/vNzc7I8OCvwMexEU9` when unconfigured, errored, or empty.
