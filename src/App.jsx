import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppProviders } from '@/app/providers/AppProviders';
import { AdminBookkeepingPage } from '@/features/admin/bookkeeping/pages/AdminBookkeepingPage';
import { AdminBookingRequestsPage } from '@/features/admin/booking-requests/pages/AdminBookingRequestsPage';
import { AdminCalendarPage } from '@/features/admin/calendar/pages/AdminCalendarPage';
import { AdminCommissionAndFeePage } from '@/features/admin/commission/pages/AdminCommissionAndFeePage';
import { AdminCustomersPage } from '@/features/admin/customer/pages/AdminCustomersPage';
import { AdminGalleryPage } from '@/features/admin/gallery/pages/AdminGalleryPage';
import { AdminInventoryPage } from '@/features/admin/inventory/pages/AdminInventoryPage';
import { AdminLayout } from '@/features/admin/layout/AdminLayout';
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import { AdminPaymentAndBillPage } from '@/features/admin/payment/pages/AdminPaymentAndBillPage';
import { AccountSecurityPage } from '@/features/admin/settings/pages/AccountSecurityPage';
import { AdminSettingsPage } from '@/features/admin/settings/pages/AdminSettingsPage';
import { DangerAreaPage } from '@/features/admin/settings/danger-area/pages/DangerAreaPage';
import { PriceAndFeeSettingsPage } from '@/features/admin/settings/pages/PriceAndFeeSettingsPage';
import { BookingPoliciesPage } from '@/features/admin/settings/pages/BookingPoliciesPage';
import { StudioProfilePage } from '@/features/admin/settings/pages/StudioProfilePage';
import { RequireOwner } from '@/features/auth/RequireOwner';
import { RequireStaff } from '@/features/auth/RequireStaff';
import { RequireClient } from '@/features/client-portal/components/RequireClient';
import { ClientPortalLayout } from '@/features/client-portal/layout/ClientPortalLayout';
import { ClientBookSessionPage } from '@/features/client-portal/pages/ClientBookSessionPage';
import { ClientBookingsPage } from '@/features/client-portal/pages/ClientBookingsPage';
import { ClientInvoicesPage } from '@/features/client-portal/pages/ClientInvoicesPage';
import { ClientLoginPage } from '@/features/client-portal/pages/ClientLoginPage';
import { ClientPortalHomePage } from '@/features/client-portal/pages/ClientPortalHomePage';
import { ClientPortalNotFoundPage } from '@/features/client-portal/pages/ClientPortalNotFoundPage';
import { ClientProfilePage } from '@/features/client-portal/pages/ClientProfilePage';
import { AdminCustomerReviewsPage } from '@/features/customer-reviews/pages/AdminCustomerReviewsPage';
import { PublicAvailabilityPage } from '@/features/public-availability/pages/PublicAvailabilityPage';
import { PublicReviewSubmissionPage } from '@/features/public-reviews/pages/PublicReviewSubmissionPage';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PrivacyNoticePage } from '@/pages/PrivacyNoticePage';
import { StaffLoginPage } from '@/pages/StaffLoginPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/availability" element={<PublicAvailabilityPage />} />
      <Route path="/review" element={<PublicReviewSubmissionPage />} />
      <Route path="/review/:token" element={<PublicReviewSubmissionPage />} />
      <Route path="/privacy" element={<PrivacyNoticePage />} />
      <Route path="/portal/login" element={<ClientLoginPage />} />
      <Route
        path="/portal"
        element={
          <RequireClient>
            <ClientPortalLayout />
          </RequireClient>
        }
      >
        <Route index element={<ClientPortalHomePage />} />
        <Route path="book" element={<ClientBookSessionPage />} />
        <Route path="bookings" element={<ClientBookingsPage />} />
        <Route path="invoices" element={<ClientInvoicesPage />} />
        <Route path="profile" element={<ClientProfilePage />} />
        <Route path="*" element={<ClientPortalNotFoundPage />} />
      </Route>
      <Route path="/staff/login" element={<StaffLoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireStaff>
            <AdminLayout />
          </RequireStaff>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="calendar" element={<AdminCalendarPage />} />
        <Route path="booking-requests" element={<AdminBookingRequestsPage />} />
        <Route path="customer" element={<AdminCustomersPage />} />
        <Route path="payment-and-bill" element={<AdminPaymentAndBillPage />} />
        <Route path="commission-and-fee" element={<AdminCommissionAndFeePage />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="pembukuan" element={<AdminBookkeepingPage />} />
        <Route path="gallery" element={<AdminGalleryPage />} />
        <Route
          path="reviews"
          element={
            <RequireOwner>
              <AdminCustomerReviewsPage />
            </RequireOwner>
          }
        />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="settings/studio-profile" element={<StudioProfilePage />} />
        <Route path="settings/account-security" element={<AccountSecurityPage />} />
        <Route path="settings/price-and-fee" element={<PriceAndFeeSettingsPage />} />
        <Route path="settings/booking-policies" element={<BookingPoliciesPage />} />
        <Route
          path="settings/danger-area"
          element={
            <RequireOwner>
              <DangerAreaPage />
            </RequireOwner>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;
