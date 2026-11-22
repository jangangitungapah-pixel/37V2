# 37 Music Studio — Admin Portal Spatial Ambient Design System

**Phase:** 10 — Admin Portal Visual System Overhaul  
**Date:** 19 November 2026  
**Repository:** `jangangitungapah-pixel/37V2`  
**Scope:** Strictly authenticated Admin Portal (`/admin/*`) and Client Portal Workspace (`/portal`, `/portal/book`, `/portal/bookings`, `/portal/invoices`, `/portal/profile` & portaled overlay layers)

---

## 1. Visual Direction & Architectural Boundaries

Phase 10 transitions the authenticated portal workspaces away from the Landing Page Neo-Brutalist style (`2px` black outlines, hard offset shadows, `brutal-card`, `cal-card`, uppercase monospace labels) to the **Spatial Ambient Workspace** visual system.

### Key Principles

1. **Brand Palette Continuity:** Preserves the exact 37 Music Studio palette (`#F1EEE4` Ivory, `#151515` Obsidian Ink, `#C8F13A` Signal Lime, `#FF4B22` Signal Orange, `#FFFFFF` Elevated Surface) while shifting from high-contrast graphic borders to layered hairline boundaries and diffused elevation.
2. **Scoped Boundary (`/` vs `/admin/*` & `/portal/*`):**
   - Root wrapper in `src/features/admin/layout/AdminLayout.jsx` sets `data-admin-portal="true"`.
   - Root wrapper in `src/features/client-portal/layout/ClientPortalLayout.jsx` sets `data-client-portal="true"`.
   - Portaled UI layers (drawers & dialogs rendered outside the root node via `@base-ui/react`) set `data-admin-portal-layer="true"` or `data-client-portal-layer="true"`.
   - Every custom CSS token and `.sa-*` utility class is strictly scoped to `[data-admin-portal='true']`, `[data-admin-portal-layer='true']`, `[data-client-portal='true']`, and `[data-client-portal-layer='true']`.
   - The Public Landing Page (`/`), Staff Login (`/staff/login`), Client Login (`/portal/login`), `RequireStaff`, `RequireClient`, `.brutal-card`/`.brutal-btn` global styles, and A4 `@media print` `#studio-print-portal` document sheets (`InvoiceDocumentSheet`, `PaymentReceiptSheet`) remain completely unaffected.
3. **Zero Functional / Business Logic Changes:** All routes, Firebase/Firestore services, repositories, Zod schemas, pricing math, discount calculations, invoice generation, commission calculations, and ARIA test contracts remain preserved.

---

## 2. Design System File Structure

```text
src/features/admin/design-system/
├── admin-design-tokens.css   # Scoped CSS variables (--sa-*) & @layer components utilities
├── AdminSurface.jsx          # Layered containers: card, hero, panel, ivory, subcard
├── AdminPageHeader.jsx       # Unified ambient hero header bar with eyebrow, title & CTA slot
├── AdminMetricCard.jsx       # Spatial KPI card w/ corner radial wash glow & tabular numerals
├── AdminStatusBadge.jsx      # Soft rounded capsule pills replacing hard-edged uppercase stamps
├── AdminButton.jsx           # Tactile buttons: primary, orange, lime, secondary, ghost, danger
├── AdminEmptyState.jsx       # Calm dashed placeholder container for zero-data states
└── index.js                  # Barrel export + automatic CSS token import
```

### 2.1 Color & Surface Tokens (`admin-design-tokens.css`)

- **Canvas & Ambient Wash:** `--sa-canvas` (`#f1eee4`), `--sa-canvas-deep` (`#eae5d8`), `--sa-ambient-canvas` (radial warm lime top-right glow + subtle orange wash over warm paper ivory gradient).
- **Elevation Hierarchy:**
  - `.sa-card`: Solid white `#ffffff`, `1px solid var(--sa-border-hairline)`, `16px` radius, diffused depth `--sa-shadow-md`.
  - `.sa-card-hero`: Ambient lime radial wash over elevated white gradient, `20px` radius.
  - `.sa-panel` & `.sa-panel-ivory`: Recessed (`rgba(21,21,21,0.032)`) and warm ivory (`#f8f6ef`) sub-containers (`14px` radius).
  - `.sa-subcard`: Nested white elevated items (`12px` radius, `--sa-shadow-xs`).
  - `.sa-topbar`: Sticky translucent glass header (`rgba(250, 248, 243, 0.84)`, `backdrop-filter: blur(16px)`).
  - `.sa-sidebar`: Deep obsidian dark surface (`#151515`) with subtle radial ambient corner lighting.
- **Overlays & Drawers:**
  - `.sa-overlay-backdrop`: Soft scrim (`rgba(21, 21, 21, 0.34)`, `backdrop-filter: blur(5px)`).
  - `.sa-dialog`: Rounded elevated white modal (`20px` radius, `--sa-shadow-overlay`).
  - `.sa-drawer`: Warm `#fcfbf7` right-edge sheet with hairline left divider and `--sa-shadow-overlay`.
- **Interactive Controls & Motion:**
  - `.sa-pill-track`: Recessed pill switcher container (`14px` radius).
  - `.sa-control`, `.sa-btn-primary`, `.sa-btn-orange`, `.sa-btn-lime`, `.sa-btn-secondary`, `.sa-input`: Crisp `10px`–`12px` radius, subtle hover elevation, scale press feedback, and accessible `--sa-focus-ring`, respecting `@media (prefers-reduced-motion: reduce)`.

### 2.2 Primitive Components

- **`AdminSurface`:** Polymorphic container (`as` prop) mapping `variant="card" | "hero" | "panel" | "ivory" | "subcard"` to `.sa-*` tokens.
- **`AdminPageHeader`:** Standardized module header with pill eyebrow, crisp tracking title, concise subtitle, metadata slot, right-aligned primary actions, and optional footer child slot (e.g., nested metric rows).
- **`AdminMetricCard`:** Supports `tone="neutral" | "lime" | "orange" | "amber" | "emerald" | "ink"` with subtle radial glow gradients and tabular monospace figures.
- **`AdminStatusBadge`:** Capsule badges (`neutral`, `ivory`, `lime`, `orange`, `amber`, `emerald`, `danger`, `ink`) with optional indicator dot (`dot`) and Lucide icon (`icon`) across `sm` and `md` sizes.
- **`AdminButton`:** Unified interactive button API across variants (`primary`, `orange`, `lime`, `secondary`, `ghost`, `danger`) and heights (`xs`, `sm`, `md`, `lg`).
- **`AdminEmptyState`:** Consistent dashed empty-state card with tone-matched icon container and optional CTA action slot.

---

## 3. Redesigned Modules

| Batch                           | Scope                                                                                                                                                                                                                                                                                                                                                                                   | Highlighted Refinements                                                                                                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Batch A — Shell & Dashboard** | `AdminLayout`, `AdminSidebar`, `AdminSidebarNavItem`, `AdminMobileDrawer`, `AdminTopbar`, `AdminDashboardPage`, `AdminModulePlaceholderPage`                                                                                                                                                                                                                                            | Ambient canvas, translucent blurred Topbar, dark Spatial Sidebar w/ animated Lime pill active state, centered `max-w-[1440px]` workspace, clean `<Toaster position="bottom-right" />`, calm Dashboard greeting & module shortcut grid.                                                                      |
| **Batch B — Settings**          | `AdminSettingsPage`, `PriceAndFeeSettingsPage`, `SettingsModuleCard`, `SettingsSectionCard`, `SettingsSaveBar`, `SettingsConfirmDialog`, `DailyMealAllowanceForm`, `ServiceTypeCard`, `ServiceOptionList`, `ServiceTypeDialog`, `ServiceOptionDialog`, `PricingModeFields`, `InternalFeeEditor`, `DiscountRulesEditor`                                                                  | Accordion service cards, pill mode switchers, sticky translucent bottom Save Bar, calm validation/error banners, layered modals for service CRUD & fee editing.                                                                                                                                             |
| **Batch C — Commission & Fee**  | `AdminCommissionAndFeePage`, `CommissionWorkspaceTabs`, `CommissionOverviewMetrics`, `CommissionPeriodFilter`, `CommissionSelectedSummary`, `CommissionReviewTable`, `CommissionReviewCard`, `CommissionNeedsReviewList`, `CommissionBatchHistory`, `CommissionBookingDetailDrawer`, `CommissionBatchDetailDrawer`, `CommissionPostConfirmDialog`, `CommissionResolveNeedsReviewDialog` | Pill period & workspace tabs, compact 12-column review table cleanly visible at `1440px` alongside mobile `CommissionReviewCard`, refined dark-header slide-over inspection drawers.                                                                                                                        |
| **Batch D — Customer**          | `AdminCustomersPage`, `CustomerDirectoryToolbar`, `CustomerDirectoryTable`, `CustomerBookingHistory`, `CustomerDetailDrawer`, `CustomerFormDialog`, `CustomerArchiveDialog`, `CustomerMergeDialog`, `CustomerIdentityConflictDialog`, `LegacyCustomerImportDialog`                                                                                                                      | Responsive 1-col mobile / 3-col desktop metrics strip, `overflow-x-auto` tablet-safe customer table + mobile cards, clean shared-phone group callouts, layered identity resolution & merge dialogs.                                                                                                         |
| **Batch E — Payment & Bill**    | `payment/utils/invoice-status.js`, `AdminPaymentAndBillPage`, `PaymentWorkspaceTabs`, `PaymentOverviewMetrics`, `InvoiceDirectoryToolbar`, `InvoiceDirectoryTable`, `PaymentTransactionList`, `InvoiceDetailDrawer`, `RecordPaymentDialog`, `PaymentCorrectionDialog`, `VoidInvoiceDialog`, `LegacyInvoiceImportDialog`, `InvoicePrintable` & `PaymentReceipt` screen wrappers          | Soft capsule payment/invoice status tokens, `overflow-x-auto` tablet-safe table, streamlined drawer ledger & payment recording flow while preserving print sheets (`InvoiceDocumentSheet`, `PaymentReceiptSheet`) and `#studio-print-portal`.                                                               |
| **Batch F — Calendar**          | `calendar-config.js`, `AdminCalendarPage`, `CalendarViewSwitcher`, `CalendarToolbar`, `CalendarFilters`, `CalendarGrid`, `CalendarDayView`, `CalendarWeekView`, `CalendarMonthView`, `CalendarTimelineGrid`, `CalendarBookingCard`, `UpcomingBookings`, `BookingDetailDrawer`, `BookingFormDialog`                                                                                      | Soft Room/Payment/Session pill badges, full-width mobile toolbar date range above action CTA, refined obsidian sticky timeline column headers (`10:00–22:00 WIB` proportional grid preserved), floating rounded Room A / Room B accent booking cards, calm 4-step modal stepper & drawer lifecycle buttons. |
