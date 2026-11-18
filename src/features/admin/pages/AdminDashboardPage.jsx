import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Link } from 'react-router';

import { useAuth } from '@/features/auth/AuthContext';

import { ADMIN_NAVIGATION_ITEMS } from '../navigation/admin-navigation';

export function AdminDashboardPage() {
  const { profile, user, role } = useAuth();

  const displayName = profile?.displayName || user?.displayName || 'Studio Team Member';
  const email = profile?.email || user?.email || '';
  const roleLabel = (role || profile?.role || 'staff').toUpperCase();
  const isOwner = roleLabel === 'OWNER';

  return (
    <div className="space-y-8">
      {/* Primary Welcome & Identity Panel */}
      <section
        aria-labelledby="dashboard-welcome-heading"
        className="brutal-card-lg bg-studio-white p-5 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border-[1.5px] px-3 py-1 font-mono text-[11px] font-extrabold tracking-wider uppercase">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>WORKSPACE READY</span>
          </span>

          <span
            className={
              isOwner
                ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-xs font-extrabold tracking-wider uppercase'
                : 'border-studio-ink bg-studio-orange text-studio-white inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-xs font-extrabold tracking-wider uppercase'
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>ROLE: {roleLabel}</span>
          </span>
        </div>

        <h2
          id="dashboard-welcome-heading"
          className="font-display text-studio-ink mt-4 text-3xl leading-none font-black tracking-tight uppercase sm:text-5xl"
        >
          Welcome back, {displayName}.
        </h2>

        <p className="text-studio-muted-ink mt-2.5 max-w-2xl text-sm leading-relaxed font-semibold sm:text-base">
          Your 37 Music Studio workspace is ready. Operational modules are being developed
          progressively across dedicated phases—select any workspace module below or from the
          sidebar navigation.
        </p>

        {/* Verified Account Summary Row */}
        <dl
          aria-label="Authenticated account summary"
          className="border-studio-ink bg-studio-ivory mt-6 grid grid-cols-1 gap-3.5 border-2 p-4 sm:grid-cols-3 sm:p-5"
        >
          <div className="border-studio-ink bg-studio-white border p-3.5">
            <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Authenticated Member</span>
            </dt>
            <dd className="text-studio-ink mt-1 text-sm font-extrabold break-words sm:text-base">
              {displayName}
            </dd>
          </div>

          <div className="border-studio-ink bg-studio-white border p-3.5">
            <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Studio Email</span>
            </dt>
            <dd className="text-studio-ink mt-1 font-mono text-xs font-bold break-all sm:text-sm">
              {email}
            </dd>
          </div>

          <div className="border-studio-ink bg-studio-white border p-3.5">
            <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Access Level</span>
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="border-studio-ink bg-studio-ivory inline-block border px-2 py-0.5 font-mono text-xs font-extrabold uppercase">
                {roleLabel}
              </span>
              <span className="text-studio-muted-ink font-mono text-[10px] font-semibold">
                Active Profile
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Module Shortcuts Grid */}
      <section aria-labelledby="dashboard-modules-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <span className="bg-studio-ink text-studio-white inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase">
              <Layers className="h-3 w-3" aria-hidden="true" />
              <span>STUDIO WORKSPACE DIRECTORY (08)</span>
            </span>
            <h2
              id="dashboard-modules-heading"
              className="font-display text-studio-ink mt-2.5 text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl"
            >
              Operational Modules
            </h2>
          </div>

          <p className="text-studio-muted-ink max-w-md text-xs leading-relaxed font-medium">
            All eight workspace routes are active in the Admin Shell. Business workflows and data
            tables will be connected module by module in upcoming phases.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADMIN_NAVIGATION_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isCurrentDashboard = item.id === 'dashboard';

            return (
              <article
                key={item.id}
                className="brutal-card bg-studio-white flex flex-col justify-between p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-neutral-500">
                      {item.order}
                    </span>
                    <span
                      className={
                        isCurrentDashboard
                          ? 'border-studio-ink bg-studio-lime text-studio-ink border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase'
                          : 'border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-mono text-[9px] font-bold uppercase'
                      }
                    >
                      {isCurrentDashboard ? 'CURRENT VIEW' : 'FOUNDATION READY'}
                    </span>
                  </div>

                  <div className="mt-3.5 flex items-center gap-2.5">
                    <span className="border-studio-ink bg-studio-ivory flex h-10 w-10 shrink-0 items-center justify-center border-2">
                      <IconComponent className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-xl leading-none font-black tracking-tight uppercase">
                      {item.label}
                    </h3>
                  </div>

                  <p className="text-studio-muted-ink mt-3 text-xs leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="border-studio-ink mt-5 border-t pt-3.5">
                  <Link
                    to={item.href}
                    className="group text-studio-ink hover:bg-studio-lime flex min-h-11 w-full items-center justify-between px-2.5 py-2 font-mono text-[11px] font-extrabold tracking-wider uppercase transition-colors"
                  >
                    <span>{isCurrentDashboard ? 'Active Workspace' : `Open ${item.label}`}</span>
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Shell Architecture & Role Scope Notice */}
      <section
        aria-labelledby="shell-foundation-note-heading"
        className="brutal-card bg-studio-ink text-studio-white p-5 sm:p-7"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="bg-studio-orange text-studio-white inline-block px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase">
              PHASE 4 SHELL ARCHITECTURE
            </span>
            <h2
              id="shell-foundation-note-heading"
              className="font-display text-studio-white mt-2.5 text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl"
            >
              Unified Navigation Foundation Active
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-300 sm:text-sm">
              Both <strong>Owner</strong> and <strong>Staff</strong> accounts currently share access
              to all eight workspace navigation routes while module-specific business logic and
              role-specific permission rules are scheduled for future phases.
            </p>
          </div>

          <Link
            to="/"
            className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase lg:self-auto"
          >
            <span>View Public Landing Page</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboardPage;
