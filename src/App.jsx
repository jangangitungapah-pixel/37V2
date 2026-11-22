import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppProviders } from '@/app/providers/AppProviders';
import { AdminBookkeepingPage } from '@/features/admin/bookkeeping/pages/AdminBookkeepingPage';
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
import { PriceAndFeeSettingsPage } from '@/features/admin/settings/pages/PriceAndFeeSettingsPage';
import { StudioProfilePage } from '@/features/admin/settings/pages/StudioProfilePage';
import { RequireStaff } from '@/features/auth/RequireStaff';
import { PublicAvailabilityPage } from '@/features/public-availability/pages/PublicAvailabilityPage';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { StaffLoginPage } from '@/pages/StaffLoginPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/availability" element={<PublicAvailabilityPage />} />
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
        <Route path="customer" element={<AdminCustomersPage />} />
        <Route path="payment-and-bill" element={<AdminPaymentAndBillPage />} />
        <Route path="commission-and-fee" element={<AdminCommissionAndFeePage />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="pembukuan" element={<AdminBookkeepingPage />} />
        <Route path="gallery" element={<AdminGalleryPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="settings/studio-profile" element={<StudioProfilePage />} />
        <Route path="settings/account-security" element={<AccountSecurityPage />} />
        <Route path="settings/price-and-fee" element={<PriceAndFeeSettingsPage />} />
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
