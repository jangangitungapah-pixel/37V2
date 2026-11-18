# 37 Music Studio — Admin Shell & Navigation Architecture

**Phase:** 4 — Admin Shell & Navigation Foundation  
**Date:** 18 November 2026  
**Repository:** `jangangitungapah-pixel/37V2`

---

## 1. Overview

The **Admin Shell** is the authenticated internal workspace wrapper for 37 Music Studio. It replaces the single-page temporary Admin Portal introduced in Phase 3 with a reusable, responsive layout shell consisting of:

1. An expandable and collapsible desktop **Sidebar** (`AdminSidebar`).
2. A modal off-canvas **Mobile Navigation Drawer** (`AdminMobileDrawer`) for viewports below `1024px`.
3. A sticky **Topbar** (`AdminTopbar`) with dynamic breadcrumbs, current page heading, authenticated user identity, role badge, public website shortcut, and logout action.
4. A nested **Workspace Content Area** (`AdminLayout` + React Router `<Outlet />`) serving the **Dashboard** landing page and seven reusable module placeholder pages.

---

## 2. Component Structure & Responsibilities

```text
src/features/admin/
├── navigation/
│   └── admin-navigation.js          # Single source of truth for the 8 menu items & routes
├── layout/
│   └── AdminLayout.jsx              # Owns sidebar collapse & mobile drawer state; renders <Outlet />
├── components/
│   ├── AdminSidebar.jsx             # Desktop expandable (272px) / collapsed (80px) rail
│   ├── AdminSidebarNavItem.jsx      # NavLink item with active indicator, icon & collapsed tooltip
│   ├── AdminMobileDrawer.jsx        # Base UI Dialog off-canvas drawer for mobile & tablet (<1024px)
│   └── AdminTopbar.jsx              # Sticky header with breadcrumb, page title, user pill & Sign Out
└── pages/
    ├── AdminDashboardPage.jsx       # Welcome landing surface & module shortcut grid (/admin/dashboard)
    └── AdminModulePlaceholderPage.jsx # Reusable empty-state foundation for the 7 non-dashboard routes
```

---

## 3. Navigation Menu Order & Route Map

All eight menu items are defined in `src/features/admin/navigation/admin-navigation.js` in this exact locked sequence:

| Order | Menu Label             | Route Path                  | Lucide Icon       | Component                                                      |
| ----: | ---------------------- | --------------------------- | ----------------- | -------------------------------------------------------------- |
|     — | _(Index redirect)_     | `/admin`                    | —                 | Redirects to `/admin/dashboard`                                |
|  `01` | **Dashboard**          | `/admin/dashboard`          | `LayoutDashboard` | `AdminDashboardPage`                                           |
|  `02` | **Calendar**           | `/admin/calendar`           | `CalendarDays`    | `AdminModulePlaceholderPage` (`moduleId="calendar"`)           |
|  `03` | **Customer**           | `/admin/customer`           | `UsersRound`      | `AdminModulePlaceholderPage` (`moduleId="customer"`)           |
|  `04` | **Payment and Bill**   | `/admin/payment-and-bill`   | `ReceiptText`     | `AdminModulePlaceholderPage` (`moduleId="payment-and-bill"`)   |
|  `05` | **Commission and Fee** | `/admin/commission-and-fee` | `HandCoins`       | `AdminModulePlaceholderPage` (`moduleId="commission-and-fee"`) |
|  `06` | **Inventory**          | `/admin/inventory`          | `Boxes`           | `AdminModulePlaceholderPage` (`moduleId="inventory"`)          |
|  `07` | **Pembukuan**          | `/admin/pembukuan`          | `BookOpenText`    | `AdminModulePlaceholderPage` (`moduleId="pembukuan"`)          |
|  `08` | **Settings**           | `/admin/settings`           | `Settings2`       | `AdminModulePlaceholderPage` (`moduleId="settings"`)           |

---

## 4. Sidebar & Responsive Drawer Behavior

### 4.1 Desktop Sidebar (`1024px` and above)

- **Expanded State (default, `272px` wide):** Displays the square `37` brand mark, `37 MUSIC STUDIO` wordmark, `STUDIO MANAGEMENT` subtitle, collapse button (`aria-expanded="true"`), all eight navigation items with icons, labels, and order numbers (`01`–`08`), and the bottom workspace status card.
- **Collapsed State (`80px` wide):** Transitions smoothly using `motion/react` (`220ms`, or instant when `prefers-reduced-motion: reduce` is active). Text labels are removed from the layout flow while icons remain stationary and centered. Each icon link retains its accessible `aria-label` and displays a high-contrast tooltip badge on hover or keyboard focus.
- **Active Route Indicator:** Uses React Router `<NavLink>` (`aria-current="page"`) styled with an acid-lime (`#C8F13A`) surface, ink-black text/icon, and a signal-orange (`#FF4B22`) left accent bar.

### 4.2 Mobile & Tablet Off-Canvas Drawer (below `1024px`)

- Persistent desktop rail is hidden below `1024px`.
- Clicking the topbar menu button (`Open navigation drawer`) opens an off-canvas left drawer built on `@base-ui/react/dialog`.
- Shows a dimmed backdrop, full brand header, and all eight navigation items with full labels and icons.
- Selecting any navigation item, clicking the backdrop, clicking the close button, or pressing `Escape` closes the drawer and returns focus cleanly to the topbar menu trigger.

---

## 5. Topbar Identity & Logout Integration

- **Dynamic Breadcrumb & Heading:** Reads the current pathname via `getAdminNavItemByPath(location.pathname)` to render `37 Studio / <Module Label>` and the dynamic `<h1>` page title.
- **Authenticated Identity Source:** Reads `profile`, `user`, and `role` directly from `useAuth()` (`AuthContext`) populated by Firebase Authentication and Cloud Firestore (`staffProfiles/{uid}`). Displays generated initials, `displayName`, `email`, and the `OWNER` or `STAFF` role badge.
- **Logout Integration:** Calls the existing `logout()` method from `AuthProvider`, disables the button while signing out to prevent duplicate clicks, clears the Firebase Auth session, and navigates to `/staff/login`.

---

## 6. Authentication & Temporary Role Permission Scope

- All `/admin/*` routes are wrapped by `<RequireStaff>` at the parent `/admin` route in `src/App.jsx`.
- Unauthenticated visitors or accounts without an active `staffProfiles/{uid}` document (`active === true` and `role` in `['owner', 'staff']`) are redirected to `/staff/login`.

> **Explicit Scope Note:** Phase 4 intentionally provides the same navigation and placeholder route access to active `Owner` and `Staff` accounts. Role-specific menu and page permissions are deferred to a separate user-directed phase.

---

## 7. Placeholder Strategy & Future Module Integration

- **Dashboard (`AdminDashboardPage.jsx`):** Renders a personalized welcome banner (`"Welcome back, [Display Name]."`), verified account summary, and an 8-card workspace directory linking to each route. No fabricated revenue, booking counts, occupancy percentages, or charts are rendered.
- **Module Placeholders (`AdminModulePlaceholderPage.jsx`):** Renders a consistent, reusable module preparation card with the module's icon, route path, summary, and planned scope notes.
- **How to Integrate Future Operational Modules:** When the Studio Owner authorizes a module phase (for example, Phase 5 Calendar or Customer), create the feature component under `src/features/<module>/` and replace the corresponding `<AdminModulePlaceholderPage moduleId="..." />` element in `src/App.jsx` with the real page component. The surrounding `AdminLayout`, `AdminSidebar`, `AdminTopbar`, and `RequireStaff` protection remain unchanged.
