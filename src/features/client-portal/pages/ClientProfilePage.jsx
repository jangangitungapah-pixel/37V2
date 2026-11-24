import { useState } from 'react';
import { CheckCircle2, Info, Mail, Phone, ShieldCheck, UserCheck } from 'lucide-react';

import { AdminPageHeader, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { CLIENT_PROFILE_SOURCE } from '../config/client-portal-config';

function getInitials(displayName = '') {
  const parts = String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '37';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ClientProfilePage() {
  const { user, clientAccount, clientProfile } = useAuth();
  const [failedPhotoUrl, setFailedPhotoUrl] = useState('');

  const displayName =
    clientProfile?.displayName || clientAccount?.displayName || user?.displayName || 'Client';
  const verifiedEmail =
    clientAccount?.emailNormalized || clientProfile?.emailNormalized || user?.email || '—';
  const photoURL = clientProfile?.photoURL || clientAccount?.photoURL || user?.photoURL || '';
  const phoneDisplay = clientProfile?.phoneDisplay || '';
  const isLinkedCustomer =
    clientAccount?.profileSource === CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER ||
    clientProfile?.profileSource === CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER;
  const isEmailVerified = clientAccount?.emailVerified === true || user?.emailVerified === true;
  const isAccountActive = clientAccount?.status === 'active';
  const initials = getInitials(displayName);
  const showAvatarImage = Boolean(photoURL && failedPhotoUrl !== photoURL);

  return (
    <div data-testid="client-profile-page" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        eyebrow="PERSONAL ACCOUNT"
        titleId="client-profile-heading"
        title="My Profile"
        description="Your account details and personal studio identity."
        keepDescriptionOnMobile
        meta={<AdminStatusBadge tone="ivory">Read-only</AdminStatusBadge>}
      />

      {/* A. Profile Identity Card */}
      <AdminSurface as="section" variant="hero" className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
            {showAvatarImage ? (
              <img
                src={photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setFailedPhotoUrl(photoURL)}
                className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-[#151515]/12 sm:h-16 sm:w-16"
              />
            ) : (
              <span
                aria-hidden="true"
                data-testid="client-profile-avatar-initials"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#151515] font-mono text-base font-extrabold text-[#C8F13A] sm:h-16 sm:w-16 sm:text-lg"
              >
                {initials}
              </span>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-bold text-[#151515] sm:text-xl">
                  {displayName}
                </h3>
                <AdminStatusBadge tone="lime" dot>
                  {isAccountActive ? 'Active' : 'Suspended'}
                </AdminStatusBadge>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-[#666159]">{verifiedEmail}</p>
            </div>
          </div>

          <AdminStatusBadge tone={isLinkedCustomer ? 'emerald' : 'ivory'} icon={UserCheck}>
            {isLinkedCustomer ? 'Studio Customer Profile' : 'Personal Client Profile'}
          </AdminStatusBadge>
        </div>
      </AdminSurface>

      {/* B. Studio Identity & C. Account Information */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminSurface as="section" variant="card" className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#151515] sm:text-base">Studio Identity</h3>
              <p className="text-xs text-[#666159]">
                How your portal space connects to your 37 Music Studio identity
              </p>
            </div>
            <UserCheck className="h-4.5 w-4.5 shrink-0 text-[#46433D]" aria-hidden="true" />
          </div>

          <dl className="space-y-3 text-xs sm:text-sm">
            <div className="sa-panel-ivory flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <dt className="font-medium text-[#666159]">Profile Connection</dt>
              <dd className="font-semibold text-[#151515]">
                {isLinkedCustomer
                  ? 'Linked to Studio Customer Profile'
                  : 'Personal Isolated Client Profile'}
              </dd>
            </div>

            <div className="sa-panel-ivory flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <dt className="font-medium text-[#666159]">Display Name</dt>
              <dd className="truncate font-semibold text-[#151515]">{displayName}</dd>
            </div>

            <div className="sa-panel-ivory flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <dt className="inline-flex items-center gap-1.5 font-medium text-[#666159]">
                <Phone className="h-3.5 w-3.5 text-[#8B857B]" aria-hidden="true" />
                <span>Phone Number</span>
              </dt>
              <dd className="font-mono font-semibold text-[#151515]">
                {phoneDisplay || 'Not provided yet'}
              </dd>
            </div>
          </dl>
        </AdminSurface>

        <AdminSurface as="section" variant="card" className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#151515] sm:text-base">Account Information</h3>
              <p className="text-xs text-[#666159]">Authentication and verification status</p>
            </div>
            <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-[#0F6246]" aria-hidden="true" />
          </div>

          <dl className="space-y-3 text-xs sm:text-sm">
            <div className="sa-panel-ivory flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <dt className="font-medium text-[#666159]">Authentication Provider</dt>
              <dd className="font-semibold text-[#151515]">
                {clientAccount?.authProvider === 'password' ? 'Email & Password' : 'Google'}
              </dd>
            </div>

            <div className="sa-panel-ivory flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <dt className="inline-flex items-center gap-1.5 font-medium text-[#666159]">
                <Mail className="h-3.5 w-3.5 text-[#8B857B]" aria-hidden="true" />
                <span>Email Verification</span>
              </dt>
              <dd
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  isEmailVerified ? 'text-[#0F6246]' : 'text-[#666159]'
                }`}
              >
                {isEmailVerified ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Info className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                )}
                <span>{isEmailVerified ? 'Verified' : 'Unverified'}</span>
              </dd>
            </div>

            <div className="sa-panel-ivory flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <dt className="font-medium text-[#666159]">Profile Status</dt>
              <dd className="font-semibold text-[#151515]">
                {clientProfile?.status === 'active' ? 'Active' : 'Unavailable'}
              </dd>
            </div>
          </dl>
        </AdminSurface>
      </div>

      {/* Honest Read-Only Phase Notice */}
      <AdminSurface variant="ivory" className="flex items-start gap-2.5 p-4 text-xs text-[#46433D]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#666159]" aria-hidden="true" />
        <p className="leading-relaxed">
          Your profile is currently read-only during this workspace setup phase. Self-service
          profile details and contact updates will be enabled in a future update.
        </p>
      </AdminSurface>
    </div>
  );
}

export default ClientProfilePage;
