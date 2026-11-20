import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppProviders } from '@/app/providers/AppProviders';
import { AdminCalendarPage } from '@/features/admin/calendar/pages/AdminCalendarPage';
import { AdminCommissionAndFeePage } from '@/features/admin/commission/pages/AdminCommissionAndFeePage';
import { AdminCustomersPage } from '@/features/admin/customer/pages/AdminCustomersPage';
import { AdminInventoryPage } from '@/features/admin/inventory/pages/AdminInventoryPage';
import { AdminLayout } from '@/features/admin/layout/AdminLayout';
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import { AdminModulePlaceholderPage } from '@/features/admin/pages/AdminModulePlaceholderPage';
import { AdminPaymentAndBillPage } from '@/features/admin/payment/pages/AdminPaymentAndBillPage';
import { AdminSettingsPage } from '@/features/admin/settings/pages/AdminSettingsPage';
import { PriceAndFeeSettingsPage } from '@/features/admin/settings/pages/PriceAndFeeSettingsPage';
import { RequireStaff } from '@/features/auth/RequireStaff';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { StaffLoginPage } from '@/pages/StaffLoginPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
        <Route path="pembukuan" element={<AdminModulePlaceholderPage moduleId="pembukuan" />} />
        <Route path="settings" element={<AdminSettingsPage />} />
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
