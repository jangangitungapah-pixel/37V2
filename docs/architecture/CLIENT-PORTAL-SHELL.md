# 37 Music Studio Client Portal — Phase 2 Spatial Ambient Shell & Placeholders Architecture

## 1. Shell Architecture

Phase 2 replaces the minimal Phase 1 landing card inside `/portal` with a full persistent **Spatial Ambient Application Shell** that achieves visual parity with the existing Admin Portal Workspace while maintaining complete domain, route, and permission isolation.

- **`ClientPortalLayout` (`src/features/client-portal/layout/ClientPortalLayout.jsx`):**
  - Scoped root wrapper `<div data-client-portal="true" data-testid="client-portal-shell" className="sa-canvas ...">`.
  - Accessible keyboard skip link targeting `#client-main-content`.
  - Sticky desktop sidebar (`ClientSidebar`, visible `1024px+`) with smooth collapse/expand (`264px` <-> `80px`).
  - Off-canvas mobile/tablet drawer (`ClientMobileDrawer`, `< 1024px`) via `@base-ui/react/dialog` + `motion/react`.
  - Sticky translucent topbar (`ClientTopbar`).
  - Centered `max-w-[1440px]` workspace container with subtle `0.18s` entrance transitions (`useReducedMotion()` respected).
  - Compact workspace footer (`ClientPortalFooter`) and single `<Toaster position="bottom-right" />`.

## 2. Client Routes

Nested protected route tree in `src/App.jsx`:

| Route              | Component                  | Behavior                                                                                   |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `/portal/login`    | `ClientLoginPage`          | Public Google Sign-In/Sign-Up gateway (outside shell)                                      |
| `/portal`          | `ClientPortalHomePage`     | Protected Overview workspace (`index` route inside `RequireClient` + `ClientPortalLayout`) |
| `/portal/book`     | `ClientBookSessionPage`    | Protected Studio Reservation placeholder                                                   |
| `/portal/bookings` | `ClientBookingsPage`       | Protected Session History placeholder                                                      |
| `/portal/invoices` | `ClientInvoicesPage`       | Protected Billing Workspace placeholder                                                    |
| `/portal/profile`  | `ClientProfilePage`        | Protected Personal Account read-only view                                                  |
| `/portal/*`        | `ClientPortalNotFoundPage` | Client-scoped not-found state with navigation back to Overview                             |

## 3. Navigation Configuration

Centralized in `src/features/client-portal/navigation/client-navigation.js`:

- Exports `CLIENT_NAVIGATION_ITEMS` (exact order `01`–`05`: **Overview**, **Book a Session**, **My Bookings**, **Invoices & Payments**, **My Profile**).
- Exports `CLIENT_NOT_FOUND_NAV_ITEM` and `getClientNavItemByPath(pathname)` as the single source of truth for sidebar items, drawer items, breadcrumb labels, dynamic topbar `<h1>` titles, icons (`lucide-react`), eyebrows, and descriptions.

## 4. Shared Spatial Ambient Design System Integration

- `src/features/admin/design-system/admin-design-tokens.css` extends `[data-client-portal='true']` and `[data-client-portal-layer='true']` alongside `[data-admin-portal='true']` and `[data-admin-portal-layer='true']` across CSS custom properties (`--sa-*`), `.sa-canvas`, `.sa-topbar`, `.sa-sidebar`, `.sa-card`, `.sa-card-hero`, `.sa-panel`, `.sa-panel-ivory`, `.sa-subcard`, `.sa-pill-track`, `.sa-control`, `.sa-btn-*`, `.sa-input`, overlay primitives, reduced-motion rules, and print canvas overrides.
- `src/styles/index.css` excludes `[data-client-portal] *` and `[data-client-portal-layer] *` from the base font reset rule alongside Admin Portal selectors.
- Reuses `AdminSurface`, `AdminPageHeader`, `AdminMetricCard`, and `AdminStatusBadge`, and `AdminEmptyState` directly across Client Portal pages, paired with a reusable `ClientPortalPagePlaceholder`.
- Public Landing Page (`brutal-*`), `/staff/login`, `/portal/login`, Admin Portal, and `#studio-print-portal` remain completely unaffected.

## 5. Responsive Behavior

- **`>= 1024px` (Desktop / Tablet Landscape):** Persistent obsidian sidebar (`264px` expanded / `80px` collapsed), sticky glass topbar with breadcrumb `37 Studio > [Page]`, client avatar/name/email pill, `CLIENT` capsule badge, `Public Site` link, and Sign Out button.
- **`< 1024px` (Mobile / Tablet Portrait, down to `320px`):** Desktop sidebar hidden; topbar shows hamburger button triggering `ClientMobileDrawer` (`280px` / `max-w-[86vw]`), compact `CLIENT` badge, and compact icon Sign Out control without horizontal overflow. Zero bottom navigation bars.

## 6. Page Placeholder Boundaries

1. **Overview (`/portal`):** Hero greeting, Primary/Secondary CTAs, Account Snapshot (`—` metric cards), 4 Quick Access links, Next Session panel, and Recent Activity panel.
2. **Book a Session (`/portal/book`):** Preview cards for `Rehearsal`, `Recording`, and `Mix & Master` (`Coming Soon` badges) + Room Availability Preview notice (zero calendar pickers or pricing reads).
3. **My Bookings (`/portal/bookings`):** Local category filter tabs (`All Groups`, `Upcoming`, `Requests`, `History`) and contextual empty states (zero Firestore `bookings` / `publicBookingRequests` reads).
4. **Invoices & Payments (`/portal/invoices`):** Summary placeholders (`—`), horizontal ledger column headers preview, and empty state (zero `invoices` / `paymentTransactions` reads or payment buttons).
5. **My Profile (`/portal/profile`):** Read-only view displaying Google avatar (with initials `onError` fallback), display name, verified email, Studio/Personal profile type, phone display if present, provider (`Google`), verification status, and active status.

## 7. AuthContext Data Consumption

Consumes only already-authorized `useAuth()` fields settled by Phase 1 `RequireClient`:

- `user` (`displayName`, `email`, `photoURL`, `emailVerified`)
- `clientAccount` (`displayName`, `emailNormalized`, `photoURL`, `profileSource`, `status`, `emailVerified`)
- `clientProfile` (`displayName`, `emailNormalized`, `phoneDisplay`, `photoURL`, `profileSource`, `status`)
- `logout()`

## 8. Security Boundaries

- All Client Workspace routes remain nested inside a single parent `<RequireClient>` guard in `src/App.jsx`.
- Zero role resolution or `staffProfiles` access inside `ClientPortalLayout` or placeholder pages.
- Zero Firestore collection queries added (`collection`, `query`, `getDocs` never invoked).
- Internal identifiers (`uid`, `customerId`, `clientCustomerLinks`, `customerEmailIndex`) are never rendered in Client UI views.
- Zero links or imports pointing to `/admin/*`.

## 9. Files Created & Modified

**Created:**

- `src/features/client-portal/navigation/client-navigation.js`
- `src/features/client-portal/components/ClientSidebarNavItem.jsx`
- `src/features/client-portal/components/ClientSidebar.jsx`
- `src/features/client-portal/components/ClientMobileDrawer.jsx`
- `src/features/client-portal/components/ClientTopbar.jsx`
- `src/features/client-portal/components/ClientPortalFooter.jsx`
- `src/features/client-portal/components/ClientPortalPagePlaceholder.jsx`
- `src/features/client-portal/layout/ClientPortalLayout.jsx`
- `src/features/client-portal/pages/ClientBookSessionPage.jsx`
- `src/features/client-portal/pages/ClientBookingsPage.jsx`
- `src/features/client-portal/pages/ClientInvoicesPage.jsx`
- `src/features/client-portal/pages/ClientProfilePage.jsx`
- `src/features/client-portal/pages/ClientPortalNotFoundPage.jsx`
- `src/features/client-portal/client-portal-shell.test.jsx`
- `docs/architecture/CLIENT-PORTAL-SHELL.md`
- `docs/handoffs/HANDOFF-CLIENT-PORTAL-PHASE-2.txt`

**Modified:**

- `src/features/admin/design-system/admin-design-tokens.css`
- `src/features/admin/design-system/AdminSurface.jsx`
- `src/styles/index.css`
- `src/features/client-portal/config/client-portal-config.js`
- `src/features/client-portal/pages/ClientPortalHomePage.jsx`
- `src/App.jsx`
- `src/features/client-portal/client-portal.test.jsx`
- `scripts/test-firestore-rules.mjs` (removed duplicate baseline Section 2B block so ESLint/Node parse cleanly; zero changes to `firestore.rules`)
- `docs/architecture/ADMIN-PORTAL-SPATIAL-AMBIENT-DESIGN-SYSTEM.md`

## 10. Test & Build Verification Summary

Verified after final code edits with `npm run lint`, `npm run test:run`, and `npm run build` (exact counts recorded in `docs/handoffs/HANDOFF-CLIENT-PORTAL-PHASE-2.txt`).
