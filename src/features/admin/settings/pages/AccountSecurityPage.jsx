import { useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { SettingsBreadcrumb } from '../components/SettingsBreadcrumb';
import { SettingsConfirmDialog } from '../components/SettingsConfirmDialog';
import { formatSettingsTimestamp } from '../utils/settings-formatters';

function formatRoleLabel(role, profileRole) {
  const normalized = String(role || profileRole || '')
    .trim()
    .toLowerCase();
  if (normalized === 'owner') return 'Owner';
  if (normalized === 'staff') return 'Staff';
  return 'Tidak diketahui';
}

function getAccountStatusInfo(profile) {
  if (profile && profile.active === true) {
    return {
      label: 'Active',
      tone: 'emerald',
    };
  }

  if (profile && profile.active === false) {
    return {
      label: 'Inactive',
      tone: 'danger',
    };
  }

  return {
    label: 'Tidak diketahui',
    tone: 'amber',
  };
}

export function AccountSecurityPage() {
  const { user, profile, role, resetPassword } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const displayName =
    profile?.displayName?.trim() ||
    profile?.name?.trim() ||
    user?.displayName?.trim() ||
    'Belum diatur';
  const email = user?.email?.trim() || profile?.email?.trim() || '';
  const roleLabel = formatRoleLabel(role, profile?.role);
  const accountStatus = getAccountStatusInfo(profile);
  const lastSignInFormatted = formatSettingsTimestamp(
    user?.metadata?.lastSignInTime,
    'Tidak tersedia',
  );

  const canSendReset = Boolean(email) && !isSendingReset;

  const handleConfirmPasswordReset = async () => {
    if (!email || isSendingReset) {
      setConfirmOpen(false);
      return;
    }

    setConfirmOpen(false);
    setIsSendingReset(true);
    setResetResult(null);

    try {
      const result = await resetPassword(email);
      const message =
        result?.message ||
        'Jika alamat email tersebut terdaftar dan aktif, tautan reset password akan dikirim melalui Firebase Authentication.';
      setResetResult({ type: 'success', message });
      toast.success('Permintaan email reset password berhasil diproses.');
    } catch (err) {
      const errorMessage =
        err?.message || 'Gagal mengirim email reset password. Coba beberapa saat lagi.';
      setResetResult({ type: 'error', message: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div data-calendar-scoped="true" className="space-y-4 sm:space-y-6">
      <AdminSurface
        as="section"
        variant="hero"
        aria-labelledby="account-security-heading"
        className="p-3.5 sm:p-6 lg:p-7"
      >
        <SettingsBreadcrumb
          items={[
            { label: 'Admin', to: '/admin/dashboard' },
            { label: 'Settings', to: '/admin/settings' },
            { label: 'Account & Security' },
          ]}
          backTo="/admin/settings"
          backLabel="Back to Settings"
        />

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 sm:mt-4">
          <div className="min-w-0 flex-1">
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#151515] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide text-[#F1EEE4]">
                <ShieldCheck className="h-3 w-3 text-[#C8F13A]" aria-hidden="true" />
                <span>PERSONAL SECURITY</span>
              </span>
              <AdminStatusBadge tone="ivory" size="sm">
                Owner &amp; Staff
              </AdminStatusBadge>
            </div>

            <h2
              id="account-security-heading"
              className="mt-2 text-xl font-bold tracking-[-0.025em] text-[#151515] sm:text-3xl"
            >
              Account &amp; Security
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#666159] sm:text-sm">
              Ringkasan identitas akun admin yang sedang masuk serta kontrol aman untuk mengirim
              tautan reset password via Firebase Authentication.
            </p>
          </div>
        </div>
      </AdminSurface>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,1fr)] lg:items-start">
        {/* Account Overview */}
        <AdminSurface
          as="section"
          variant="card"
          aria-labelledby="account-overview-heading"
          className="p-4 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[#151515]" aria-hidden="true" />
              <h3 id="account-overview-heading" className="text-base font-bold text-[#151515]">
                Account Overview
              </h3>
            </div>
            <AdminStatusBadge tone={accountStatus.tone} dot size="sm">
              {accountStatus.label}
            </AdminStatusBadge>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-[#151515]/[0.08] bg-[#F8F6EF] p-3.5">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
                Display Name
              </dt>
              <dd className="mt-1 text-sm font-semibold wrap-break-word text-[#151515]">
                {displayName}
              </dd>
            </div>

            <div className="rounded-xl border border-[#151515]/[0.08] bg-[#F8F6EF] p-3.5">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
                Email Address
              </dt>
              <dd className="mt-1 text-sm font-semibold wrap-break-word text-[#151515]">
                {email || 'Tidak tersedia'}
              </dd>
            </div>

            <div className="rounded-xl border border-[#151515]/[0.08] bg-[#F8F6EF] p-3.5">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
                Role
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#151515]">{roleLabel}</dd>
            </div>

            <div className="rounded-xl border border-[#151515]/[0.08] bg-[#F8F6EF] p-3.5">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
                Account Status
              </dt>
              <dd className="mt-1">
                <AdminStatusBadge tone={accountStatus.tone} dot size="sm">
                  {accountStatus.label}
                </AdminStatusBadge>
              </dd>
            </div>

            <div className="rounded-xl border border-[#151515]/[0.08] bg-[#F8F6EF] p-3.5 sm:col-span-2">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
                Last Sign-In Time
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[#151515]">{lastSignInFormatted}</dd>
            </div>
          </dl>
        </AdminSurface>

        {/* Password Security + Read-only Boundary */}
        <div className="space-y-4">
          <AdminSurface
            as="section"
            variant="card"
            aria-labelledby="password-security-heading"
            className="p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 border-b border-[#151515]/[0.08] pb-3">
              <KeyRound className="h-4 w-4 text-[#151515]" aria-hidden="true" />
              <h3 id="password-security-heading" className="text-base font-bold text-[#151515]">
                Keamanan Kata Sandi
              </h3>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#666159]">
              Untuk menjaga keamanan akun, penggantian kata sandi dilakukan melalui tautan resmi
              Firebase Authentication yang dikirim ke email akun yang sedang login.
            </p>

            {resetResult ? (
              <div
                role={resetResult.type === 'error' ? 'alert' : 'status'}
                className={
                  resetResult.type === 'error'
                    ? 'mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800'
                    : 'mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-[#E6F6EC] p-3 text-xs font-medium text-[#0F6246]'
                }
              >
                {resetResult.type === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                ) : null}
                <span>{resetResult.message}</span>
              </div>
            ) : null}

            <div className="mt-4">
              <AdminButton
                type="button"
                variant="primary"
                size="md"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSendReset}
                className="w-full"
              >
                {isSendingReset ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#C8F13A]" aria-hidden="true" />
                ) : (
                  <Mail className="h-4 w-4 text-[#C8F13A]" aria-hidden="true" />
                )}
                <span>
                  {isSendingReset ? 'Mengirim Email Reset...' : 'Send Password Reset Email'}
                </span>
              </AdminButton>
            </div>
          </AdminSurface>

          <AdminSurface
            as="section"
            variant="ivory"
            aria-labelledby="account-boundaries-heading"
            className="p-4 sm:p-5"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
              <h3
                id="account-boundaries-heading"
                className="text-sm font-bold tracking-tight text-[#151515]"
              >
                Informasi Akun Terkelola Sistem
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#666159]">
              Display Name, Email Address, Role, dan status keaktifan akun tidak dapat diubah
              langsung dari halaman ini. Hubungi Owner atau pengelola Firebase jika diperlukan
              perubahan hak akses.
            </p>
          </AdminSurface>
        </div>
      </div>

      <SettingsConfirmDialog
        open={confirmOpen}
        title="Kirim Email Reset Password?"
        description={`Tautan reset kata sandi akan dikirim ke alamat email akun Anda (${email || 'tidak tersedia'}) melalui Firebase Authentication.`}
        confirmLabel="Kirim Email Reset"
        cancelLabel="Batal"
        confirmTone="primary"
        onConfirm={handleConfirmPasswordReset}
        onOpenChange={setConfirmOpen}
      />
    </div>
  );
}

export default AccountSecurityPage;
