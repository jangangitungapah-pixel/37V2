# PRD — 37 Music Studio Public Landing Page

**Document status:** Draft for product review  
**Version:** 0.1  
**Created:** 17 November 2026  
**Repository:** `jangangitungapah-pixel/37V2`  
**Target platform:** Responsive web application, mobile-first  
**Implementation status:** Not started — this document defines requirements only

---

## 1. Executive Summary

The 37 Music Studio Landing Page is the public-facing digital entry point for the 37 Music Studio brand. It should help prospective customers quickly understand what the studio offers, see the quality and atmosphere of its facilities, build confidence, and take a clear next step to contact the studio or begin a booking inquiry.

The experience must be designed mobile-first. A visitor arriving from Instagram, TikTok, WhatsApp, Google Search, or a shared link should be able to understand the offer and reach the primary call to action comfortably on a phone, without needing to navigate a desktop-style layout.

The visual direction is premium, modern, minimal, spatial, and editorial. It should feel like a contemporary creative studio rather than a generic business template. Real studio photography and accurate business information will carry more of the visual identity than decorative effects.

This PRD covers the public landing page only. It does not define or implement the authenticated Owner/Operator management application.

## 2. Scope Assumption and Product Boundary

### 2.1 Working assumption

For this draft, “Landing Page” means a **public, customer-facing website for the 37 Music Studio business**, not:
- the internal dashboard shown after staff login;
- the login or authentication screen;
- the studio's internal booking calendar;
- a SaaS marketing page selling studio-management software to other studios.

The proposed content model assumes the studio may present rehearsal, recording, and mixing/mastering services, as well as one or more bookable studio spaces. These service categories must be confirmed against the actual current business offer before implementation.

### 2.2 Explicit boundary

The landing page may explain how to inquire or book, but Phase implementation must not invent a booking engine. Unless a booking destination is approved and available, the primary CTA should lead to a confirmed contact channel or an explicitly approved booking flow.

### 2.3 Out of scope

- Authentication, account registration, staff roles, and permissions.
- Owner/Operator dashboard or internal navigation.
- Real-time room availability and calendar slot selection.
- Booking creation, rescheduling, cancellation, deposits, payments, or invoices.
- CRM, customer database, marketing automation, and loyalty features.
- Admin CMS or a self-service content editor.
- Pricing engine, package rules, discount rules, or commission logic.
- Backend schema, Firebase security rules, or production Firebase provisioning.
- Analytics vendor integration until the owner approves a provider and privacy approach.

Any item above requires a separate product decision and scope.

## 3. Product Goals

### Primary goals

1. Communicate the studio's identity and core offer within the first mobile viewport.
2. Make the main action (contact or booking inquiry) obvious and easy to reach.
3. Present services and facilities with clear, scannable information.
4. Build confidence through authentic studio imagery, verified details, and genuine social proof.
5. Provide a responsive, accessible, fast experience across small phones, large phones, tablets, laptops, and wide desktop screens.
6. Provide a maintainable page foundation that can later connect to user-approved booking or application routes.

### Non-goals

- Maximize animation or visual effects at the expense of clarity and speed.
- Show unverified prices, customer reviews, partner logos, addresses, or availability.
- Force visitors to create an account just to learn about the studio or contact it.
- Turn the landing page into a complex multi-page marketing CMS in this scope.

## 4. Target Users and Primary Needs

| User segment | Context | Primary need |
|---|---|---|
| Band / group | Visiting from a mobile social post or search result | Quickly see rehearsal facilities and how to inquire |
| Recording artist / musician | Comparing studios before a recording session | Understand recording services, equipment/space highlights, and contact route |
| Producer / creator | Looking for mixing or mastering support | Understand post-production services and submit an inquiry |
| Returning customer | Has visited before and needs contact details again | Reach booking/contact details with minimal friction |

These are working user segments for content prioritization. Their exact priorities should be validated with the studio owner before detailed copywriting.

## 5. Core User Journeys

### Journey A — First-time visitor from social media

1. Opens the landing page on a phone.
2. Immediately understands the studio identity and service category.
3. Sees a relevant studio image and a primary CTA.
4. Scrolls to review services, rooms/facilities, and supporting information.
5. Taps the primary CTA.
6. Arrives at the approved contact or booking destination with no unnecessary intermediate step.

### Journey B — Visitor evaluating the studio

1. Opens the landing page from search or a direct link.
2. Reviews the service list and what each service includes.
3. Views authentic images of rooms, equipment, and the studio atmosphere.
4. Checks verified location, operating hours, and contact details.
5. Starts an inquiry or booking action.

### Journey C — Returning customer

1. Opens the site on a phone.
2. Uses the persistent or easily reachable contact action.
3. Opens the correct contact channel or approved booking destination.

## 6. Information Architecture and Page Sections

The page is a single public landing route (`/`) for this scope. Sections should follow a clear narrative from identity to offer, evidence, practical details, and action.

| Order | Section | Purpose | Required content |
|---:|---|---|---|
| 1 | Header / Navigation | Establish identity and provide navigation | Brand mark, section links, primary CTA |
| 2 | Hero | Explain the studio and create a strong first impression | One clear headline, supporting sentence, primary CTA, optional secondary CTA, authentic hero image |
| 3 | Services | Explain what customers can book or request | Confirmed service categories, concise description, relevant image/icon |
| 4 | Studio / Facilities | Show the physical spaces and important capabilities | Room names, room photos, facilities/equipment highlights verified by owner |
| 5 | Gallery | Provide visual proof and atmosphere | Curated, optimized images with useful alt text |
| 6 | How to Inquire / Book | Reduce uncertainty about the next step | Short, accurate steps based on the actual booking/contact process |
| 7 | Social Proof | Build trust | Genuine testimonials, ratings, or client/artist references only when permission and source are confirmed |
| 8 | Location & Contact | Answer practical visit questions | Verified address, map/directions link, opening hours, contact channels |
| 9 | Final CTA | Re-state the next action after the visitor has reviewed the offer | Primary CTA and concise supporting copy |
| 10 | Footer | Provide secondary information and close the page | Brand, contact, social links, copyright, optional legal links |

### Section priority

**Must have for initial release:** Header, Hero, Services, Studio/Facilities or Gallery, Contact/Location, primary CTA, Footer.

**Include only when real content is available:** testimonials, ratings, detailed equipment lists, pricing tables, FAQs, partner/customer logos.

Do not render empty sections or fake content to fill the page.

## 7. Functional Requirements

### FR-01 — Brand navigation

- Display the approved 37 Music Studio wordmark/logo.
- Navigation links scroll to their corresponding sections.
- Mobile navigation uses an accessible menu/drawer pattern.
- The menu closes after a section is selected and returns focus appropriately.
- The primary CTA remains easy to find in the mobile experience.

### FR-02 — Hero and CTA

- The hero communicates what 37 Music Studio offers in plain language.
- One primary CTA is visually dominant.
- A secondary CTA may link to services, gallery, or contact if it supports the visitor journey.
- CTA destination, label, and tracking name must be centrally configurable rather than copied into multiple components.
- External contact links must open the intended destination and use safe link attributes where applicable.
- If WhatsApp is selected, use an owner-confirmed number and an approved prefilled message. Do not invent a number or message containing inaccurate claims.

### FR-03 — Services

- Each service card contains a service name and short description.
- Optional price, duration, included facilities, or package details are shown only after confirmation.
- Cards must remain readable and navigable on narrow screens.
- The initial service list is content-driven, not hard-coded into complex business logic.

### FR-04 — Studio and facilities

- Each room/space shown has an approved name and authentic image.
- Facility or equipment claims must be verified.
- Do not imply real-time availability.
- If room-specific detail is not confirmed, present a general gallery rather than fabricated room specifications.

### FR-05 — Gallery

- Images open in an accessible enlarged-view interaction only if that interaction is included in the approved visual design.
- Gallery controls must be keyboard operable and have descriptive labels.
- Avoid autoplay carousels. Prefer a responsive grid or manually controlled gallery.
- Images below the fold are lazy-loaded; the main hero image is prioritized.

### FR-06 — Contact and location

- Display only verified address, hours, phone/WhatsApp, email, and social URLs.
- Map/directions behavior uses a verified map destination.
- Phone and WhatsApp links must use appropriate URI schemes.
- If a detail is not supplied, omit it rather than displaying example or placeholder data in production.

### FR-07 — Responsive navigation and interactions

- All interactive controls work with touch, mouse, and keyboard.
- No essential information is available only on hover.
- Mobile menu, dialogs, accordions, and gallery interactions use accessible primitives.
- Reduced-motion preferences are respected.

### FR-08 — Content and metadata

- Set page title, description, canonical URL, and social-sharing metadata using approved production content.
- Use semantic HTML landmarks and a logical heading structure.
- Include structured local-business data only after all required business information is verified.
- Provide useful image alt text; decorative imagery uses empty alt text.

### FR-09 — Error and fallback behavior

- Broken or unavailable images must not collapse the layout.
- A contact CTA must have a graceful fallback if a configured destination is unavailable.
- External links must be validated during release review.
- The page remains useful when animations are disabled.

## 8. Mobile-First UX and Responsive Requirements

Mobile is the primary design target, not a condensed version of the desktop interface.

### Target viewport classes

| Class | Reference width | Layout expectation |
|---|---:|---|
| Small phone | 320–374 px | Single-column content, compact header, no horizontal overflow |
| Standard phone | 375–430 px | Primary target; thumb-friendly actions and readable content |
| Large phone | 431–767 px | Fluid single-column layout with more breathing room |
| Tablet | 768–1023 px | Two-column compositions where they improve scanning |
| Desktop | 1024 px and above | Wider grids, expanded navigation, restrained content width |

These are design/test ranges, not a requirement to add a breakpoint for every exact width. Use fluid CSS and a small, purposeful breakpoint set.

### Mobile behavior

- Use a compact header with a clear menu affordance.
- Keep the primary CTA visible in the hero without requiring scroll.
- Consider a sticky bottom CTA only if usability testing shows it helps; it must not obscure content, system navigation, or focused fields.
- Use a single-column section layout by default.
- Use swipe only for non-essential gallery exploration; never require horizontal swiping to access core content.
- Use touch targets of at least 44 by 44 CSS pixels as the project target.
- Use a readable base text size; avoid dense paragraphs and tiny metadata.
- Place critical content and controls away from device safe-area edges.
- Prevent horizontal page scrolling at all supported viewport widths.
- Avoid hover-only interactions and desktop-style tiny dropdowns.

### Responsive adaptation

- Services and facility cards may transition to two or more columns as available width allows.
- Hero imagery and text may become a balanced side-by-side composition on wide screens.
- Navigation transitions from a mobile menu to inline navigation at a suitable breakpoint.
- Maintain consistent hierarchy, content order, and CTA priority across viewports.
- Do not hide essential service or contact information on mobile to preserve desktop aesthetics.

## 9. Visual Design Direction

### Desired characteristics

- Premium, modern, minimal, spatial, confident, and creative.
- Clear typographic hierarchy and generous but intentional spacing.
- High-quality real studio photography as a core brand asset.
- Restrained surfaces, subtle depth, layered composition, and controlled contrast.
- Consistent radii, borders, shadows, icon sizing, and motion behavior through reusable tokens.
- Strong legibility and clear CTA contrast.

### Visual guardrails

- Avoid generic SaaS dashboard aesthetics.
- Avoid excessive glassmorphism, blur, gradients, neon accents, floating decoration, or parallax.
- Avoid oversized empty hero areas that push the actual service information below the fold on phones.
- Avoid animation that delays access to content or causes layout shift.
- Avoid using AI-generated imagery to represent actual rooms, equipment, customers, or facilities. Use real, approved studio images for factual representation.
- Do not finalize brand color, font, logo treatment, or imagery style until the owner has approved the brand direction/assets.

### Theme

The current CSS foundation includes neutral light/dark token slots. This PRD does not mandate a light-first or dark-first final brand theme. Theme preference, contrast, and photography treatment must be reviewed with the actual brand assets before implementation.

## 10. Dependency and Technical Implementation Guidance

Use the dependency foundation already committed in Phase 1. Do not add another UI framework or replace the established stack without a documented reason and user approval.

| Requirement | Approved dependency / approach | Usage guidance |
|---|---|---|
| App runtime | React 19.3.1 + React DOM | JavaScript/JSX components |
| Dev server/build | Vite 8.3.8 | Existing Vite config and scripts |
| Styling | Tailwind CSS 4.3.5 | Mobile-first utilities and CSS variables |
| Accessible UI primitives | `@base-ui/react` 1.9.0 | Menu, dialog, accordion, and other needed primitives |
| Local component source | `shadcn` 4.23.0 | Generate only approved components; own and customize the source |
| Animation | `motion` 14.14.0 | Use for purposeful reveal/interaction only; respect reduced motion |
| Icons | `lucide-react` 1.74.0 | Consistent iconography; do not use emoji as interface icons |
| Variants/classes | CVA 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0 | Reusable variant and class composition patterns |
| Routing | `react-router` 8.5.1 | Keep the public landing route isolated from future protected application routes |
| Form validation | React Hook Form 7.92.0 + Zod 4.6.7 + resolvers 7.0.7 | Only if an inquiry form is approved |
| Notifications | Sonner 2.0.8 | Only for meaningful form/action feedback |
| Server state | TanStack Query 5.107.1 | Not needed for static landing-page content; use only if a future approved external data flow requires it |
| Global state | Zustand 5.1.0 | Not expected for this page; local React state is preferred |
| Backend | Firebase 13.3.0 SDK | Not required for static content; no Firebase integration unless an approved feature needs it |
| Date/time | date-fns 4.4.0 + @date-fns/tz 1.5.0 | Not required unless verified dynamic schedules/hours need date calculations |
| Analytics charts | ECharts 6.1.0 + echarts-for-react 3.0.6 | Not used on the landing page |

### Bundle and loading policy

- Do not import every dependency into the landing page.
- No ECharts, React Query, Zustand, Firebase, table, or virtualization bundle should be loaded solely because it exists in package.json.
- Load large gallery/lightbox or other optional functionality only when it is used.
- Prefer CSS transitions for simple visual states.
- Avoid autoplay video backgrounds and large client-side animation libraries for decorative effects.
- Optimize image delivery before adding complex visual effects.

## 11. Performance, SEO, Accessibility, and Quality Requirements

### Performance

- Prioritize fast content rendering on mid-range mobile devices and mobile networks.
- Use responsive image sources and modern formats (AVIF/WebP where supported), with appropriate intrinsic dimensions.
- Prioritize the main hero image and lazy-load below-the-fold imagery.
- Avoid unnecessary JavaScript, excessive animation, large background videos, and layout shifts.
- Use the Core Web Vitals “good” thresholds as release targets where measurable: LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1. Measure with representative mobile conditions and real-user data when analytics/privacy approval exists.
- Performance targets are acceptance goals, not claims that the first implementation already achieves them.

### Accessibility

- Target WCAG 2.2 AA.
- Provide keyboard access, visible focus, semantic landmarks, logical headings, and descriptive control labels.
- Ensure text and interactive elements have sufficient contrast.
- Provide useful alt text for informative images.
- Respect reduced-motion settings.
- Menus and dialogs must manage focus and expose correct accessible names/states.
- Do not rely on color alone to communicate meaning.

### SEO and sharing

- One descriptive page title and meta description.
- Semantic H1 and section heading hierarchy.
- Open Graph / social-sharing metadata with approved image and copy.
- Descriptive link text and meaningful image alt attributes.
- Canonical URL and indexability settings for the approved production domain.
- LocalBusiness structured data only with accurate, owner-confirmed data.
- No keyword stuffing, duplicate headings, or fake ratings/reviews.

### Security and privacy

- No secrets or private credentials in frontend source.
- Do not collect personal information without an approved purpose, consent copy, and data destination.
- If an inquiry form is later approved, define data retention, spam prevention, validation, privacy notice, and failure handling before implementation.
- External links must be reviewed for correct destination and safe opening behavior.

## 12. Content and Asset Requirements

The following items are required from the business owner before final content implementation:

| Asset / data | Required detail | Status |
|---|---|---|
| Brand assets | Approved logo/wordmark and usage rules | To confirm |
| Brand direction | Preferred colors, typography, light/dark preference | To confirm |
| Hero image | Real, high-quality studio photo with usage approval | To provide |
| Services | Actual service list and descriptions | To confirm |
| Facilities | Room names, equipment, amenities, and approved claims | To confirm |
| Gallery | Curated real images with consent/usage rights | To provide |
| CTA destination | WhatsApp number, inquiry form, booking link, or another approved target | To confirm |
| Contact | Phone, email, and social URLs | To confirm |
| Location | Full address and map/directions destination | To confirm |
| Operating hours | Exact days and hours, including holiday handling if relevant | To confirm |
| Pricing | Public prices/packages, or explicit decision not to display prices | To confirm |
| Testimonials | Authentic text, names/attribution permission, and source | Optional / to confirm |
| Domain | Canonical production domain | To confirm |

No missing data may be fabricated. Use clearly marked development placeholders only during local design review; remove them before production.

## 13. Analytics and Success Metrics

No analytics provider is selected in this PRD. If tracking is later approved, measure only events needed to evaluate the page:

| Metric | Definition |
|---|---|
| Primary CTA click-through rate | Primary CTA clicks divided by qualified landing-page visits |
| Contact intent | Visitor opens an approved contact channel |
| Section engagement | Visits to Services, Facilities/Gallery, and Contact sections |
| Mobile conversion | Primary CTA rate on phone viewport classes |
| Page performance | LCP, INP, CLS, and mobile page weight |
| Accessibility quality | No critical keyboard, focus, contrast, or semantic failures in release review |

Do not use invasive tracking or introduce analytics SDKs without an explicit privacy and vendor decision.

## 14. Acceptance Criteria

The initial release is acceptable only when all applicable criteria below pass:

### Functional
- [ ] The landing page loads at the approved public route.
- [ ] Header navigation reaches the correct sections.
- [ ] Mobile menu opens, closes, and manages focus correctly.
- [ ] Primary CTA has an approved destination and works on supported devices.
- [ ] Services and facilities show only verified content.
- [ ] Contact, location, and social links are correct.
- [ ] No placeholder content, dead buttons, or misleading availability claims remain.
- [ ] Broken-image fallback preserves layout.

### Mobile-first and responsive
- [ ] Layout is designed and reviewed first at 375–430 px.
- [ ] No horizontal overflow at 320 px or wider supported viewports.
- [ ] Primary CTA is visible in the initial mobile hero composition.
- [ ] Essential content is not desktop-only or hover-only.
- [ ] Touch controls meet the 44 by 44 CSS pixel project target.
- [ ] Sticky elements do not obscure content, focused controls, or safe areas.
- [ ] Tablet and desktop compositions preserve hierarchy and content order.

### Visual and interaction
- [ ] Brand assets, colors, typography, spacing, and imagery have owner approval.
- [ ] Animation has a clear purpose and reduced-motion behavior is verified.
- [ ] No autoplay hero video or disruptive motion is present.
- [ ] All controls have clear hover, focus, active, disabled, and error states where relevant.

### Quality and release
- [ ] Production build succeeds.
- [ ] ESLint and formatting checks pass.
- [ ] Automated tests cover the meaningful interactive behavior added by the page.
- [ ] Keyboard-only navigation is reviewed.
- [ ] WCAG 2.2 AA review finds no known critical blockers.
- [ ] Mobile performance is measured and compared with the stated targets.
- [ ] Metadata and social-sharing preview are checked.
- [ ] Production links, contact details, image rights, and business claims are verified.

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Ambiguous meaning of “Landing Page” | Wrong product surface may be designed | Confirm whether this is a public customer website or an app entry/dashboard before implementation |
| Missing or poor-quality real photos | Premium visual direction cannot be achieved credibly | Collect approved real images before visual implementation |
| Unconfirmed contact/booking destination | Primary CTA becomes dead or misleading | Select and test one approved destination before release |
| Inaccurate service, room, price, or facility claims | Loss of trust and customer confusion | Require owner approval for published content |
| Overuse of motion and visual effects | Poor mobile performance and accessibility | Motion budget, reduced-motion checks, mobile performance tests |
| Scope expands into booking workflows | Delays and hidden backend requirements | Keep booking transaction logic out of this PRD |
| Too many dependencies loaded on initial route | Slower mobile experience | Import only dependencies required by approved page interactions |

## 16. Open Product Decisions — Required Before Implementation

The following decisions remain intentionally open:

1. **Confirm page identity:** Is this public-facing customer landing page for the physical 37 Music Studio business, or did you mean the first/home screen inside the management application?
2. **Primary CTA:** WhatsApp inquiry, existing booking URL, phone call, or a future booking flow?
3. **Service list:** Confirm the current public services and their names/descriptions.
4. **Public pricing:** Show prices, starting prices, packages, or no prices?
5. **Content assets:** Which real logo, hero photos, room photos, and gallery images are approved?
6. **Business details:** Confirm address, contact channels, operating hours, and domain.
7. **Brand direction:** Confirm preferred visual identity, color direction, typography, and light/dark treatment.
8. **Social proof:** Are approved testimonials, ratings, or customer references available?

Do not block this PRD from being reviewed, but do not begin implementation of a public landing page until decision 1 is confirmed.

## 17. Implementation Handoff Notes

When implementation is authorized in a later phase:

1. Re-read this PRD and resolve the open product decisions.
2. Review the current repository dependency foundation and local verification status.
3. Implement only the scope the user explicitly selects.
4. Start at the mobile viewport and adapt upward.
5. Add only the shadcn/Base UI components and package imports needed for the approved design.
6. Keep static business content in a maintainable content/config layer until a data source is approved.
7. Test at 320 px, 375–430 px, 768 px, 1024 px, and wide desktop.
8. Run the existing project quality scripts and provide a timestamped verification log.
9. At phase completion, write a detailed handoff `.txt` for the next session.
10. Do not select the next phase on the user's behalf.

---

## References

- Repository dependency decision record: [docs/architecture/DEPENDENCY-FOUNDATION.md](../architecture/DEPENDENCY-FOUNDATION.md)
- React documentation: https://react.dev/
- Vite documentation: https://vite.dev/
- Tailwind CSS v4 documentation: https://tailwindcss.com/docs
- Base UI documentation: https://base-ui.com/react/overview/introduction
- shadcn/ui documentation: https://ui.shadcn.com/docs
- Motion documentation: https://motion.dev/docs
- Lucide documentation: https://lucide.dev/guide/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Core Web Vitals: https://web.dev/articles/vitals
