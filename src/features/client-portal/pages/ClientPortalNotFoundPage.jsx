import { Compass } from 'lucide-react';
import { Link } from 'react-router';

import { AdminEmptyState, AdminSurface } from '@/features/admin/design-system';

import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';

export function ClientPortalNotFoundPage() {
  return (
    <div data-testid="client-portal-not-found" className="space-y-4 sm:space-y-5">
      <AdminSurface variant="card" className="p-4 sm:p-6">
        <AdminEmptyState
          icon={Compass}
          tone="orange"
          title="Portal Page Not Found"
          description="The requested page is not available in your Client Portal workspace."
          action={
            <Link
              to={CLIENT_PORTAL_ROUTES.HOME}
              className="sa-btn-primary inline-flex min-h-10 items-center justify-center px-4 py-2 text-xs font-semibold sm:text-[13px]"
            >
              Back to Overview
            </Link>
          }
        />
      </AdminSurface>
    </div>
  );
}

export default ClientPortalNotFoundPage;
