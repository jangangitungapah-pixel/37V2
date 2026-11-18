import { BrowserRouter, Route, Routes } from 'react-router';

import { AppProviders } from '@/app/providers/AppProviders';
import { RequireStaff } from '@/features/auth/RequireStaff';
import { AdminPortalPage } from '@/pages/AdminPortalPage';
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
            <AdminPortalPage />
          </RequireStaff>
        }
      />
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
