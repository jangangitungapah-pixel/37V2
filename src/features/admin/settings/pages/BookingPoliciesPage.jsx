import { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Loader2, Save, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { SettingsBreadcrumb } from '../components/SettingsBreadcrumb';
import { useBookingPolicies } from '../booking-policies/hooks/useBookingPolicies';
import { usePricingSettings } from '../hooks/usePricingSettings';
import { useClientReservationBackfill } from '../booking-policies/hooks/useClientReservationBackfill';
import {
  DEFAULT_BOOKING_POLICIES,
  BALANCE_DUE_TRIGGERS,
  DEPOSIT_POLICY_TYPES,
} from '../booking-policies/config/booking-policies-config';
import { saveBookingPolicies, mapBookingPoliciesErrorToMessage } from '../booking-policies/services/booking-policies-service';
import { normalizeBookingPolicies } from '../booking-policies/utils/booking-policies-normalize';

const BALANCE_LABELS = {
  before_session: 'Sebelum sesi dimulai',
  at_check_in: 'Saat check-in studio',
  before_delivery: 'Sebelum hasil Mix & Master diserahkan',
};

function NumberField({ label, value, onChange, min = 0, max = 1000000000, step = 1, disabled = false }) {
  return (
    <label className="block space-y-1.5 text-xs font-semibold text-[#4C473F]">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60"
      />
    </label>
  );
}

export function BookingPoliciesPage() {
  const { user, profile, role } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '').toLowerCase();
  const isOwner = actorRole === 'owner';
  const { policies: remotePolicies, isPersisted, isLoading, error: loadError } = useBookingPolicies();
  const { settings: pricingSettings } = usePricingSettings();
  const serviceTypes = pricingSettings?.serviceTypes || [];
  const {
    status: backfillStatus,
    isLoading: isBackfillLoading,
    isRunning: isBackfillRunning,
    error: backfillError,
    runNextBatch,
  } = useClientReservationBackfill({ actorUid, actorRole, enabled: isOwner });

  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const current = draft || remotePolicies;
  const [scope, setScope] = useState('default');
  const [serviceId, setServiceId] = useState('');
  const [optionId, setOptionId] = useState('');

  const selectedService = serviceTypes.find((item) => item.id === serviceId) || serviceTypes[0] || null;
  const selectedOptions = selectedService?.options || [];
  const activeServiceId = selectedService?.id || serviceId;
  const activeOptionId = selectedOptions.find((item) => item.id === optionId)?.id || selectedOptions[0]?.id || '';
  const overrideKey = scope === 'option' ? activeOptionId : activeServiceId;
  const overrideMapName = scope === 'option' ? 'optionOverrides' : 'serviceOverrides';
  const selectedOverride = scope === 'default' ? null : current[overrideMapName]?.[overrideKey] || {};
  const effective = scope === 'default'
    ? {
        depositPolicy: current.defaultDepositPolicy,
        holdPolicy: current.defaultHoldPolicy,
        balanceDuePolicy: current.defaultBalanceDuePolicy,
      }
    : {
        depositPolicy: selectedOverride.depositPolicy || current.defaultDepositPolicy,
        holdPolicy: selectedOverride.holdPolicy || current.defaultHoldPolicy,
        balanceDuePolicy: selectedOverride.balanceDuePolicy || current.defaultBalanceDuePolicy,
      };
  const isOverrideActive = Boolean(
    selectedOverride.depositPolicy || selectedOverride.holdPolicy || selectedOverride.balanceDuePolicy,
  );

  const isDirty = useMemo(
    () => Boolean(draft && JSON.stringify(normalizeBookingPolicies(draft)) !== JSON.stringify(normalizeBookingPolicies(remotePolicies))),
    [draft, remotePolicies],
  );

  const updateSection = (section, field, value) => {
    if (!isOwner) return;
    setDraft((previous) => {
      const base = structuredClone(previous || remotePolicies || DEFAULT_BOOKING_POLICIES);
      if (scope === 'default') {
        const key = section === 'depositPolicy'
          ? 'defaultDepositPolicy'
          : section === 'holdPolicy'
            ? 'defaultHoldPolicy'
            : 'defaultBalanceDuePolicy';
        base[key] = { ...base[key], [field]: value };
      } else {
        const mapName = scope === 'option' ? 'optionOverrides' : 'serviceOverrides';
        const key = overrideKey;
        if (!key) return previous;
        base[mapName] = { ...(base[mapName] || {}) };
        base[mapName][key] = { ...(base[mapName][key] || {}) };
        base[mapName][key][section] = {
          ...(base[mapName][key][section] || effective[section]),
          [field]: value,
        };
      }
      return base;
    });
  };

  const resetOverride = () => {
    if (!isOwner || !overrideKey) return;
    setDraft((previous) => {
      const base = structuredClone(previous || remotePolicies);
      const mapName = scope === 'option' ? 'optionOverrides' : 'serviceOverrides';
      const next = { ...(base[mapName] || {}) };
      delete next[overrideKey];
      base[mapName] = next;
      return base;
    });
  };

  const handleSave = async () => {
    if (!isOwner || isSaving || !isDirty) return;
    setIsSaving(true);
    try {
      const saved = await saveBookingPolicies({
        actorUid,
        actorRole,
        policies: current,
        expectedVersion: remotePolicies.version,
      });
      setDraft(null);
      toast.success(`Booking Policies tersimpan (v${saved.version}). Public pricing preview ikut disinkronkan.`);
    } catch (error) {
      toast.error(mapBookingPoliciesErrorToMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-calendar-scoped="true" className="space-y-4 sm:space-y-6">
      <AdminSurface as="section" variant="hero" className="p-4 sm:p-6">
        <SettingsBreadcrumb
          items={[
            { label: 'Admin', to: '/admin/dashboard' },
            { label: 'Settings', to: '/admin/settings' },
            { label: 'Booking Policies' },
          ]}
          backTo="/admin/settings"
          backLabel="Back to Settings"
        />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[#8BAD12]" aria-hidden="true" />
              <span className="font-mono text-[10px] font-semibold tracking-wider text-[#666159]">OPERATIONS FOUNDATION</span>
              <AdminStatusBadge tone={isOwner ? 'lime' : 'ivory'} size="sm">
                {isOwner ? 'Owner Edit' : 'Staff Read Only'}
              </AdminStatusBadge>
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-[#151515] sm:text-3xl">Booking Policies</h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#666159] sm:text-sm">
              Kelola parameter DP, masa hold, dan pelunasan. Ini adalah fondasi konfigurasi Phase 1; engine hold, konfirmasi, expiry, dan penagihan belum mengonsumsi nilai ini sebelum Phase 2.
            </p>
          </div>
          <div className="text-right text-[10px] text-[#777166]">
            <div>{isPersisted ? `Persisted · v${remotePolicies.version}` : 'Default · Belum tersimpan'}</div>
            <div>Zona waktu operasional: Asia/Jakarta</div>
          </div>
        </div>
      </AdminSurface>

      {loadError ? (
        <AdminSurface role="alert" variant="subcard" className="border-red-300 bg-red-50 p-3 text-xs text-red-800">
          {loadError}
        </AdminSurface>
      ) : null}
      <AdminSurface role="note" variant="subcard" className="border-[#151515]/10 bg-[#FAF8F1] p-3.5 text-xs leading-relaxed text-[#666159]">
        <strong className="text-[#151515]">Implementation boundary:</strong> nilai di halaman ini belum mengubah booking yang berjalan. Reservation confirmation trigger, hold deadline, dan balance-due deadline tetap menunggu approval Owner sebelum Phase 2.
      </AdminSurface>
      {!isOwner ? (
        <AdminSurface role="status" variant="subcard" className="border-amber-500/30 bg-[#FEF4DD] p-3.5 text-xs text-[#6B3B08]">
          <ShieldAlert className="mr-2 inline h-4 w-4" aria-hidden="true" />
          Staff dapat membaca policy aktif, tetapi hanya Owner yang boleh menyimpan perubahannya.
        </AdminSurface>
      ) : null}
      {isLoading ? (
        <AdminSurface variant="card" className="flex items-center gap-3 p-5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat Booking Policies...
        </AdminSurface>
      ) : (
        <>
          <AdminSurface variant="card" className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/10 pb-3">
              <div>
                <h2 className="font-bold text-[#151515]">Policy Scope</h2>
                <p className="text-xs text-[#666159]">Default digunakan kecuali terdapat override layanan atau opsi.</p>
              </div>
              {scope !== 'default' && isOverrideActive ? (
                <button type="button" disabled={!isOwner} onClick={resetOverride} className="text-xs font-semibold text-[#A33A20] disabled:opacity-50">
                  Reset override
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-xs font-semibold text-[#4C473F]">
                <span>Scope</span>
                <select value={scope} onChange={(event) => setScope(event.target.value)} className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-sm">
                  <option value="default">Global default</option>
                  <option value="service">Service override</option>
                  <option value="option">Service option override</option>
                </select>
              </label>
              {scope !== 'default' ? (
                <label className="space-y-1.5 text-xs font-semibold text-[#4C473F]">
                  <span>Service</span>
                  <select value={activeServiceId} onChange={(event) => { setServiceId(event.target.value); setOptionId(''); }} className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-sm">
                    {serviceTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              ) : null}
              {scope === 'option' ? (
                <label className="space-y-1.5 text-xs font-semibold text-[#4C473F]">
                  <span>Option</span>
                  <select value={activeOptionId} onChange={(event) => setOptionId(event.target.value)} className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-sm">
                    {selectedOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            {scope !== 'default' && !isOverrideActive ? (
              <p className="rounded-xl border border-dashed border-[#151515]/20 bg-[#FAF8F1] p-3 text-xs text-[#666159]">
                Belum ada override. Field di bawah akan menjadi override tersimpan untuk scope yang dipilih.
              </p>
            ) : null}
          </AdminSurface>

          <div className="grid gap-4 lg:grid-cols-3">
            <AdminSurface variant="card" className="space-y-3 p-4 sm:p-5">
              <div><h3 className="font-bold text-[#151515]">Deposit Policy</h3><p className="text-xs text-[#666159]">Tidak ada nominal DP yang dipaksakan. Owner dapat memilih fixed atau percentage.</p></div>
              <label className="block space-y-1.5 text-xs font-semibold text-[#4C473F]">
                <span>Jenis DP</span>
                <select value={effective.depositPolicy.type} disabled={!isOwner} onChange={(event) => updateSection('depositPolicy', 'type', event.target.value)} className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-sm">
                  {DEPOSIT_POLICY_TYPES.map((type) => <option key={type} value={type}>{type === 'none' ? 'Tanpa DP' : type === 'fixed' ? 'Nominal tetap' : 'Persentase'}</option>)}
                </select>
              </label>
              {effective.depositPolicy.type === 'fixed' ? <NumberField label="Nominal DP (IDR)" value={effective.depositPolicy.fixedAmount} disabled={!isOwner} onChange={(value) => updateSection('depositPolicy', 'fixedAmount', value)} min={1} /> : null}
              {effective.depositPolicy.type === 'percentage' ? <NumberField label="DP (%)" value={effective.depositPolicy.percentage} disabled={!isOwner} onChange={(value) => updateSection('depositPolicy', 'percentage', value)} min={1} max={100} /> : null}
              <label className="block space-y-1.5 text-xs font-semibold text-[#4C473F]">
                <span>Basis perhitungan</span>
                <select value={effective.depositPolicy.calculationBase} disabled={!isOwner} onChange={(event) => updateSection('depositPolicy', 'calculationBase', event.target.value)} className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-sm">
                  <option value="total_amount">Total setelah diskon</option><option value="subtotal">Subtotal sebelum diskon</option>
                </select>
              </label>
            </AdminSurface>

            <AdminSurface variant="card" className="space-y-3 p-4 sm:p-5">
              <div><h3 className="font-bold text-[#151515]">Hold Policy</h3><p className="text-xs text-[#666159]">Parameter durasi hold untuk engine berikutnya. Expiry manual; halaman ini belum menjalankan expiry dan tidak memakai cron/scheduler.</p></div>
              <NumberField label="Durasi hold default (jam)" value={effective.holdPolicy.defaultHours} disabled={!isOwner} onChange={(value) => updateSection('holdPolicy', 'defaultHours', value)} min={1} max={168} />
              <NumberField label="Minimal jarak dari sesi (menit)" value={effective.holdPolicy.minMinutesBeforeSessionStart} disabled={!isOwner} onChange={(value) => updateSection('holdPolicy', 'minMinutesBeforeSessionStart', value)} min={0} max={1440} />
              <label className="flex items-center gap-2 text-xs font-semibold text-[#4C473F]">
                <input type="checkbox" checked={effective.holdPolicy.allowPerBookingOverride} disabled={!isOwner} onChange={(event) => updateSection('holdPolicy', 'allowPerBookingOverride', event.target.checked)} />
                Izinkan staff override per booking
              </label>
            </AdminSurface>

            <AdminSurface variant="card" className="space-y-3 p-4 sm:p-5">
              <div><h3 className="font-bold text-[#151515]">Balance Due Policy</h3><p className="text-xs text-[#666159]">Tentukan kapan pelunasan harus diterima; khusus Mix &amp; Master dapat memakai milestone sebelum delivery.</p></div>
              <label className="block space-y-1.5 text-xs font-semibold text-[#4C473F]">
                <span>Tenggat pelunasan</span>
                <select value={effective.balanceDuePolicy.trigger} disabled={!isOwner} onChange={(event) => updateSection('balanceDuePolicy', 'trigger', event.target.value)} className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-sm">
                  {BALANCE_DUE_TRIGGERS.map((trigger) => <option key={trigger} value={trigger}>{BALANCE_LABELS[trigger]}</option>)}
                </select>
              </label>
              <NumberField label="Jam sebelum waktu acuan" value={effective.balanceDuePolicy.offsetHoursBeforeStart} disabled={!isOwner} onChange={(value) => updateSection('balanceDuePolicy', 'offsetHoursBeforeStart', value)} min={0} max={168} />
            </AdminSurface>
          </div>

          {isOwner ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <AdminButton type="button" variant="secondary" disabled={!isDirty || isSaving} onClick={() => setDraft(null)}>Discard</AdminButton>
              <AdminButton type="button" disabled={!isDirty || isSaving} onClick={handleSave}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                Save Booking Policies
              </AdminButton>
            </div>
          ) : null}
          {isDirty && isOwner ? (
            <AdminSurface role="status" variant="subcard" className="flex items-center gap-2 border-amber-500/25 bg-[#FEF4DD] p-3 text-xs text-[#6B3B08]">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Perubahan belum tersimpan. Policy lama tetap menjadi konfigurasi aktif sampai Save berhasil.
            </AdminSurface>
          ) : null}
          <AdminSurface variant="card" className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-[#151515]">Client Reservation Identity Backfill</h3>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#666159]">
                  Migrasi terkontrol untuk booking Client Portal yang sudah confirmed dan tanggal sesinya belum lewat.
                  Setiap eksekusi memproses maksimal 5 request, membaca ulang request, booking, dan invoice dalam satu transaksi,
                  lalu menyinkronkan clientUid serta proyeksi aman Client Portal. Data historis dan relasi CRM tidak digabung.
                </p>
              </div>
              <AdminStatusBadge tone={backfillStatus?.status === 'completed' ? 'lime' : 'ivory'} size="sm">
                {isBackfillLoading ? 'Loading' : backfillStatus?.status === 'completed' ? 'Completed' : backfillStatus?.status || 'Not started'}
              </AdminStatusBadge>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3"><span className="text-[#777166]">Inspected</span><div className="mt-1 text-lg font-bold tabular-nums text-[#151515]">{backfillStatus?.processedCount || 0}</div></div>
              <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3"><span className="text-[#777166]">Projections</span><div className="mt-1 text-lg font-bold tabular-nums text-[#151515]">{backfillStatus?.projectedCount || 0}</div></div>
              <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3"><span className="text-[#777166]">Skipped / conflict</span><div className="mt-1 text-lg font-bold tabular-nums text-[#151515]">{backfillStatus?.skippedCount || 0}</div></div>
            </div>
            {backfillError ? <p role="alert" className="text-xs text-red-700">{backfillError}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[#777166]">Manual Owner action only · no scheduler · resumable cursor</p>
              {isOwner ? (
                <AdminButton
                  type="button"
                  disabled={isBackfillLoading || isBackfillRunning || backfillStatus?.status === 'completed'}
                  onClick={async () => {
                    try {
                      const result = await runNextBatch();
                      if (result?.isComplete) {
                        toast.success(`Backfill selesai. ${result.projectedCount} projection tersedia.`);
                      } else {
                        toast.success(`Batch selesai: ${result?.newlyProjected || 0} projection dibuat. Jalankan batch berikutnya untuk melanjutkan.`);
                      }
                    } catch (error) {
                      toast.error(error?.message || 'Backfill gagal dijalankan.');
                    }
                  }}
                >
                  {isBackfillRunning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Clock3 className="h-4 w-4" aria-hidden="true" />}
                  {backfillStatus?.status ? 'Run next batch (max 5)' : 'Start backfill (max 5)'}
                </AdminButton>
              ) : <AdminStatusBadge tone="ivory" size="sm">Owner only</AdminStatusBadge>}
            </div>
          </AdminSurface>
        </>
      )}
    </div>
  );
}
