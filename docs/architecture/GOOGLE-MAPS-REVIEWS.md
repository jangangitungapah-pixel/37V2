# Google Maps Reviews — Landing Page Social Proof Architecture

## 1. Feature Purpose

Displays authentic, live customer ratings and Google Maps reviews for **37 Music Studio TANGERANG** directly on the public Landing Page (`/`) as verified social proof between the Studio Gallery (`GallerySection`) and Public Availability Teaser (`PublicAvailabilityTeaserSection`), without introducing any backend server, scraping, or stored review copies.

## 2. Architecture Overview

- **Integration:** Frontend-only via **Google Maps JavaScript API — Places Library (New)** (`google.maps.importLibrary('places')`, `Place`, `Place.fetchFields()`, `Review`, `AuthorAttribution`).
- **Source Files:**
  - Client & loader: `src/lib/google-maps/places-client.js`
  - UI section & carousel: `src/components/landing/GoogleReviewsSection.jsx`
  - Landing Page mount: `src/pages/LandingPage.jsx`
  - Automated tests: `src/components/landing/GoogleReviewsSection.test.jsx`
- **Firebase / Backend Isolation:** Unchanged. Zero Cloud Functions, zero Firestore collections/rules/indexes, zero third-party proxy APIs.

## 3. Verified Business Listing & Identity Guard

- **Business Name:** `37 Music Studio TANGERANG`
- **Place ID (public config):** `ChIJfYXPy6P-aS4RFCRQptFpsVg`
- **Owner-Provided Google Maps Sharing Fallback URL:** `https://share.google/vNzc7I8OCvwMexEU9`
- **Address:** Semi, Jl. Palem Kuning Jl. Palem Raya No.37, Bencongan Indah, Kecamatan Kelapa Dua, Kabupaten Tangerang, Banten 15810, Indonesia.
- **Runtime Identity Verification:** `verifyStudioPlaceIdentity()` treats `VITE_GOOGLE_MAPS_PLACE_ID` as untrusted configuration until verified at runtime:
  - `displayName` must match `37` + `music studio` / `studio`.
  - When `formattedAddress` is present, at least one Tangerang / Bencongan / Kelapa Dua / Palem / Banten / `15810` location token must match.
  - Missing optional `formattedAddress` does not crash the section, while mismatching business identities reject cleanly without rendering unrelated ratings or reviews (`GOOGLE_PLACE_IDENTITY_MISMATCH`).

## 4. Environment Configuration

Public frontend environment variables (defined in `.env.example`):

```env
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_PLACE_ID=ChIJfYXPy6P-aS4RFCRQptFpsVg
```

- `VITE_GOOGLE_MAPS_API_KEY` is intentionally empty in `.env.example` and **never** committed to source control or documentation.
- `.gitignore` excludes `.env`, `.env.*` (except `!.env.example`), and `*.local`.
- Put the real HTTP-referrer-restricted browser key only in `.env.local` or deployment CI/CD build environment variables.

## 5. Dedicated Google Cloud Project Setup (Manual Owner Steps)

Keep Google Maps Platform billing isolated in its own Google Cloud project (suggested name: `37-music-studio-maps`), separate from the Firebase Spark application project (`studio37classic`):

1. Create a dedicated Google Cloud project (`37-music-studio-maps`).
2. Attach an active Google Cloud Billing account to that Maps project (required by Google Maps Platform; does **not** alter Firebase Spark billing on `studio37classic`).
3. Enable **Maps JavaScript API** and **Places API (New)** under **APIs & Services → Library**.
4. Create a browser **API key** under **APIs & Services → Credentials**.

## 6. Browser API Key Security Restrictions

Maps JavaScript API runs directly in visitors' browsers, so the API key is readable in bundled network requests and **must** be locked down in Google Cloud Console:

### HTTP Referrer Restrictions (Websites)

Restrict the key to approved origins only:

- Production origins (adjust to final Firebase Hosting / custom domains):
  - `https://studio37classic.web.app/*`
  - `https://studio37classic.firebaseapp.com/*`
  - Any custom verified domain (e.g. `https://37musicstudio.com/*`)
- Local development origins (keep separate dev key if preferred):
  - `http://localhost:5173/*`
  - `http://127.0.0.1:5173/*`

### API Restrictions

Restrict the API key strictly to:

- **Maps JavaScript API**
- **Places API (New)**

### Quota & Billing Cost Considerations

- `Place.fetchFields()` requesting `reviews`, `rating`, and `userRatingCount` invokes Places Details / Atmosphere data SKUs in Google Maps Platform.
- Configure daily request quotas and Cloud Billing budget alerts (e.g. monthly email alerts) on `37-music-studio-maps`.

## 7. Lazy-Loading & Runtime Caching Lifecycle

1. `GoogleReviewsSection` uses `IntersectionObserver` (`rootMargin: '240px 0px'`, `threshold: 0.01`) so the Maps JS script and Places `fetchFields()` request do **not** run on initial above-the-fold page paint.
2. `fetchStudioGoogleReviews()` holds a module-level runtime promise and transient result in JavaScript memory (`inFlightReviewsFetchPromise`, `cachedRuntimeReviewsResult`), preventing duplicate paid requests across React Strict Mode double-effects, component remounts, and carousel interactions.
3. Requested `Place` fields: `displayName`, `formattedAddress`, `rating`, `userRatingCount`, `reviews`, `googleMapsURI`, `attributions`.
4. Requested locale/region: `language=id`, `region=ID`.

## 8. Attribution & Authenticity Policy

- Never modifies, filters by rating, re-sorts, merges, or fabricates review content.
- Renders up to 5 Google reviews in Google's exact returned relevance order (`reviews.slice(0, 5)`).
- Excludes incomplete review items lacking `authorAttribution.displayName` or valid `review.googleMapsURI` so every rendered review has visible attribution and a direct `View original review on Google Maps` link (`target="_blank" rel="noopener noreferrer"`).
- Displays reviewer avatar cleanly (`referrerPolicy="no-referrer"`, falling back to neutral monogram avatar on missing URI or load error), author profile link when `authorAttribution.uri` is present, and optional `flagContentURI` report link when present.
- Displays `Powered by Google`, returned `Place.attributions`, and a disclosure that review order matches Google's default relevance order. Never claims Google endorses 37 Music Studio or "verifies" reviewers.

## 9. Strictly Enforced No-Persistence Policy

Google review objects live exclusively in transient React/JS memory for the active page session and are **never** written to:

- Cloud Firestore or Realtime Database
- `localStorage`, `sessionStorage`, or `IndexedDB`
- Static JSON files, repository test fixtures, or service worker caches
- Persistent client query caches

## 10. Graceful Degradation & Fallbacks

| State              | Trigger                                                                | UI Behavior                                                                                                                  |
| :----------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| `idle` / `loading` | Approaching viewport or request in-flight                              | Accessible loading placeholders + listing link                                                                               |
| `unconfigured`     | Missing/empty `VITE_GOOGLE_MAPS_API_KEY`                               | Clear integration status + `VIEW OUR REVIEWS ON GOOGLE MAPS` CTA (`https://share.google/vNzc7I8OCvwMexEU9`), no fake numbers |
| `error`            | Script fail, `gm_authFailure`, `importLibrary` error, or network error | Safe fallback card + `VIEW OUR REVIEWS ON GOOGLE MAPS` CTA; rest of Landing Page unaffected                                  |
| `mismatch`         | Returned Place does not verify as 37 Music Studio Tangerang            | Hides returned rating/reviews completely; shows safe fallback CTA + non-sensitive `GOOGLE_PLACE_IDENTITY_MISMATCH` log       |
| `empty`            | Valid Place with 0 eligible review cards                               | Displays live aggregate `rating` & `userRatingCount` + direct Google Maps CTA with 0 fabricated cards                        |

## 11. How to Disable the Integration Cleanly

To disable live Google Places requests without altering application code:

1. Clear `VITE_GOOGLE_MAPS_API_KEY=` in the build environment (or `.env.local`) and rebuild.
2. When `VITE_GOOGLE_MAPS_API_KEY` is blank, zero external Maps scripts are injected and the section renders the fallback CTA to `https://share.google/vNzc7I8OCvwMexEU9`.

## 12. Troubleshooting

- **Section shows fallback "not configured yet":** Verify `VITE_GOOGLE_MAPS_API_KEY` is set at Vite build time (`.env.local` for local `npm run dev`, CI build secrets for Hosting deploys) and restart the dev server.
- **`GOOGLE_MAPS_AUTH_FAILED` in browser console:** Check Google Cloud Console → API Key HTTP referrer restrictions (`http://localhost:5173/*`, production domain `https://.../*`), verify **Maps JavaScript API** + **Places API (New)** are enabled, and confirm Cloud Billing is linked on the dedicated Maps project.
- **`GOOGLE_PLACE_IDENTITY_MISMATCH` in browser console:** Verify `VITE_GOOGLE_MAPS_PLACE_ID` matches `ChIJfYXPy6P-aS4RFCRQptFpsVg` (`37 Music Studio TANGERANG`).
- **CSP / ad-blocker blocks `maps.googleapis.com`:** Fallback UI automatically keeps the Google Maps CTA interactive and never breaks booking or availability sections.
