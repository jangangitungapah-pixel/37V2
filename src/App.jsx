import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppProviders } from '@/app/providers/AppProviders';
import { AdminCalendarPage } from '@/features/admin/calendar/pages/AdminCalendarPage';
import { AdminLayout } from '@/features/admin/layout/AdminLayout';
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import { AdminModulePlaceholderPage } from '@/features/admin/pages/AdminModulePlaceholderPage';
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
        <Route path="customer" element={<AdminModulePlaceholderPage moduleId="customer" />} />
        <Route
          path="payment-and-bill"
          element={<AdminModulePlaceholderPage moduleId="payment-and-bill" />}
        />
        <Route
          path="commission-and-fee"
          element={<AdminModulePlaceholderPage moduleId="commission-and-fee" />}
        />
        <Route path="inventory" element={<AdminModulePlaceholderPage moduleId="inventory" />} />
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
