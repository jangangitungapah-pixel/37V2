# 37 Music Studio — Studio Operations Command Center Architecture

**Route:** `/admin/dashboard`  
**Primary Page Component:** `src/features/admin/pages/AdminDashboardPage.jsx`  
**Feature Module:** `src/features/admin/dashboard/`  
**Time Zone Authority:** `Asia/Jakarta` (`WIB`, UTC+7)  
**Architecture Policy:** Firebase Spark-only, single-field Firestore queries, zero custom composite indexes, strict Owner vs Staff query & UI isolation.

---

## 1. Product Purpose & Operational Hierarchy

The Studio Operations Command Center is the daily workspace for Owner and Staff at 37 Music Studio. It is structured around four operational questions in strict priority order:

1. **What is happening in the studio today?** (`SECTION A — Header & Quick Actions` + `SECTION B — Today's Overview`)
2. **What sessions are coming next?** (`SECTION C — Today's Studio Schedule` grouped by `Room A` and `Room B`)
3. **What requires attention or action?** (`SECTION D — Needs Attention` ordered by business urgency)
4. **How is the studio performing?** (`SECTION E — Owner Financial Overview` [Owner-only] + `SECTION F — Booking Trend` [Apache ECharts 6])

---

## 2. Role Access & Firestore Security Rule Compliance

The Dashboard enforces role boundaries at **both** the subscription layer (`useDashboardData.js`) and the presentation layer (`AdminDashboardPage.jsx`):

| Collection / Data Stream      | Firestore Rule    | Owner Dashboard                                        | Staff Dashboard      |
| :---------------------------- | :---------------- | :----------------------------------------------------- | :------------------- |
| `bookings`                    | `isActiveStaff()` | Subscribed                                             | Subscribed           |
| `invoices`                    | `isActiveStaff()` | Subscribed                                             | Subscribed           |
| `inventoryItems`              | `isActiveStaff()` | Subscribed                                             | Subscribed           |
| `paymentTransactions`         | `isActiveStaff()` | Subscribed                                             | **Not Subscribed**   |
| `bookkeepingEntries`          | `isActiveOwner()` | Subscribed                                             | **Never Subscribed** |
| `bookkeepingSettlements`      | `isActiveOwner()` | Subscribed                                             | **Never Subscribed** |
| `bookkeepingSettings`         | `isActiveOwner()` | Not Required                                           | **Never Subscribed** |
| `commissionBatches`           | `isActiveOwner()` | Not Required                                           | **Never Subscribed** |
| `commissionPostingItems`      | `isActiveOwner()` | Subscribed via `useCommissionReview(enabled: isOwner)` | **Never Subscribed** |
| `commissionReviewResolutions` | `isActiveOwner()` | Subscribed via `useCommissionReview(enabled: isOwner)` | **Never Subscribed** |

When a Staff user opens `/admin/dashboard`:

- `isOwner` evaluates to `false`.
- `DashboardOwnerFinancials` and `DashboardCashFlowChart` are never mounted.
- All Owner-only `useEffect` hooks in `useDashboardData` and `useCommissionReview({ enabled: false })` exit immediately without invoking any Firestore listeners.
- The 4th KPI tile in Section B adapts from **`Kas Masuk Hari Ini`** (Owner) to **`Sesi Akan Datang`** (Staff).

---

## 3. Authoritative Domain & Financial Integrity Rules

### 3.1 Time Zone (`Asia/Jakarta`)

- All greeting periods (`Selamat pagi`, `Selamat siang`, `Selamat sore`, `Selamat malam`), today's date (`YYYY-MM-DD`), session time badges (`HH:mm – HH:mm`), overdue invoice comparisons, and `7 hari` / `30 hari` / `90 hari` chart intervals are anchored to `Asia/Jakarta` (`+07:00`).

### 3.2 Authoritative Payment Verification

- Booking payment badges and **`Booking Belum Lunas`** counts are resolved via `resolveBookingLatestPaymentView(booking, invoice, todayIso)` from `src/features/admin/payment/utils/invoice-status.js`.
- Bookings without a loaded authoritative invoice (`paymentView.isAuthoritative === false`) are tracked in `unverifiedInvoiceBookingsCount` and labeled **`Belum Terverifikasi`** rather than being falsely classified as authoritative paid or unpaid.

### 3.3 Anti-Double-Counting Financial Rules

1. **Customer Cash In (`Kas Masuk Hari Ini` & Period `Kas Masuk`):**
   - Computed strictly from `paymentTransactions` (`SUM(payment) - SUM(reversal)`) plus paid non-reversed manual income entries in `bookkeepingEntries`.
   - Never sums `invoice.amountPaid` with `paymentTransactions`.
2. **Actual Operating Cash Out (`Kas Keluar`):**
   - Computed strictly from `bookkeepingSettlements` (`settlementType === 'expense_payment'`).
   - Unpaid expense accruals (`bookkeepingEntries` with `entryType === 'expense_accrual'` and `settlementStatus === 'unpaid'`) are **never** included in Cash Out; they remain in **`Outstanding Payables`** until settled.
3. **Net Cash Movement (`Perubahan Kas Bersih`):**
   - Defined as `Cash In - Cash Out` (`totalIncomeReceived - totalOperatingCashOut`).
   - Explicitly labeled **`Perubahan Kas Bersih`** / **`Net Cash Movement`** and never labeled as accounting Profit / Laba Bersih.

---

## 4. Module Structure

```text
src/features/admin/dashboard/
  config/
    dashboard-config.js
  utils/
    dashboard-date.js
    dashboard-calculations.js
  hooks/
    useDashboardData.js
  components/
    DashboardHeader.jsx
    DashboardTodayOverview.jsx
    DashboardTodaySchedule.jsx
    DashboardNeedsAttention.jsx
    DashboardOwnerFinancials.jsx
    DashboardCashFlowChart.jsx
    DashboardBookingTrendChart.jsx
  dashboard.test.jsx
```
