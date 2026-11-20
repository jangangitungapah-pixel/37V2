import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

import { DELIVERY_MODES, FEE_MODES } from '../pricing/config/default-pricing-settings';
import { formatRupiah, parseMoneyInput } from '../pricing/utils/calculate-pricing-settings';

const FEE_MODE_CHOICES = [
  { id: FEE_MODES.NONE, label: 'None' },
  { id: FEE_MODES.FIXED, label: 'Fixed' },
  { id: FEE_MODES.HOURLY, label: 'Hourly' },
  { id: FEE_MODES.MANUAL, label: 'Manual' },
];

const ROLE_META = [
  {
    key: 'staff',
    label: 'Staff Fee',
    subtitle: 'Penjaga Studio / Staff operasional',
  },
  {
    key: 'owner',
    label: 'Owner Fee',
    subtitle: 'Alokasi internal Owner (bukan tagihan customer)',
  },
  {
    key: 'recordingOperator',
    label: 'Recording Operator Fee',
    subtitle: 'PIC External Studio / Operator rekaman',
  },
];

function formatRoleBadge(rule) {
  const mode = rule?.mode || FEE_MODES.NONE;
  const amount = parseMoneyInput(rule?.amount);
  if (mode === FEE_MODES.NONE) return 'None';
  if (mode === FEE_MODES.MANUAL) return 'Manual';
  if (mode === FEE_MODES.FIXED) return `Fixed • ${formatRupiah(amount)}`;
  if (mode === FEE_MODES.HOURLY) return `Hourly • ${formatRupiah(amount)}/jam`;
  return 'None';
}

export function InternalFeeEditor({
  fees,
  deliveryMode = DELIVERY_MODES.STUDIO,
  serviceTypeId = '',
  errors = {},
  onChangeFees,
}) {
  const showOperatorExpandedByDefault =
    serviceTypeId === 'recording' || fees?.recordingOperator?.mode !== FEE_MODES.NONE;

  const [expandedRoles, setExpandedRoles] = useState(() => ({
    staff: true,
    owner: fees?.owner?.mode !== FEE_MODES.NONE,
    recordingOperator: showOperatorExpandedByDefault,
  }));

  const toggleRole = (roleKey) => {
    setExpandedRoles((prev) => ({
      ...prev,
      [roleKey]: !prev[roleKey],
    }));
  };

  const handleModeChange = (roleKey, nextMode) => {
    const current = fees?.[roleKey] || { mode: FEE_MODES.NONE, amount: '0' };
    onChangeFees({
      ...fees,
      [roleKey]: {
        mode: nextMode,
        amount:
          nextMode === FEE_MODES.NONE || nextMode === FEE_MODES.MANUAL
            ? '0'
            : current.amount && current.amount !== '0'
              ? current.amount
              : '0',
      },
    });
  };

  const handleAmountChange = (roleKey, rawValue) => {
    const current = fees?.[roleKey] || { mode: FEE_MODES.FIXED, amount: '0' };
    onChangeFees({
      ...fees,
      [roleKey]: {
        ...current,
        amount: rawValue.replace(/\D/g, ''),
      },
    });
  };

  const isWfa = deliveryMode === DELIVERY_MODES.WFA;

  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-[#666159]">
        Konfigurasi alokasi internal per booking/project. Seluruh fee internal{' '}
        <strong className="font-semibold text-[#151515]">terpisah sepenuhnya</strong> dari total
        tagihan customer, DP, dan sisa pembayaran.
      </p>

      {ROLE_META.map((role) => {
        const rule = fees?.[role.key] || { mode: FEE_MODES.NONE, amount: '0' };
        const isExpanded = Boolean(expandedRoles[role.key]);
        const needsAmount = rule.mode === FEE_MODES.FIXED || rule.mode === FEE_MODES.HOURLY;
        const parsedAmount = parseMoneyInput(rule.amount);
        const amountError = errors[`fees.${role.key}.amount`] || errors[`fees.${role.key}.mode`];

        return (
          <div
            key={role.key}
            className="overflow-hidden rounded-xl border border-[#151515]/10 bg-[#FAF8F3]"
          >
            <button
              type="button"
              onClick={() => toggleRole(role.key)}
              aria-expanded={isExpanded}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-white/60"
            >
              <div className="min-w-0">
                <span className="block text-xs font-semibold text-[#151515]">{role.label}</span>
                <span className="block truncate text-[11px] text-[#666159]">{role.subtitle}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <AdminStatusBadge
                  tone={rule.mode === FEE_MODES.NONE ? 'neutral' : 'lime'}
                  size="sm"
                  className="font-mono"
                >
                  {formatRoleBadge(rule)}
                </AdminStatusBadge>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-[#666159]" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#666159]" aria-hidden="true" />
                )}
              </div>
            </button>

            {isExpanded ? (
              <div className="space-y-3 border-t border-[#151515]/[0.08] bg-white p-3.5">
                <div>
                  <span className="block text-[11px] font-medium text-[#666159]">
                    Fee Calculation Mode ({role.label})
                  </span>
                  <div
                    role="group"
                    aria-label={`Mode ${role.label}`}
                    className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
                  >
                    {FEE_MODE_CHOICES.map((choice) => {
                      const isSelected = rule.mode === choice.id;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleModeChange(role.key, choice.id)}
                          className={`min-h-9.5 cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                            isSelected
                              ? 'border-[#151515] bg-[#151515] text-[#C8F13A]'
                              : 'border-[#151515]/12 bg-[#FAF8F3] text-[#151515] hover:bg-white'
                          }`}
                        >
                          {choice.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {needsAmount ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`opt-fee-${role.key}-amount`}
                        className="block text-xs font-semibold text-[#151515]"
                      >
                        {role.label}{' '}
                        {rule.mode === FEE_MODES.HOURLY ? 'Rate per Jam (IDR)' : 'Fixed (IDR)'}
                      </label>
                      <span className="font-mono text-xs font-semibold text-[#46433D] tabular-nums">
                        {formatRupiah(parsedAmount)}
                        {rule.mode === FEE_MODES.HOURLY ? '/jam' : ''}
                      </span>
                    </div>
                    <input
                      id={`opt-fee-${role.key}-amount`}
                      type="text"
                      inputMode="numeric"
                      value={rule.amount ?? '0'}
                      onChange={(e) => handleAmountChange(role.key, e.target.value)}
                      placeholder="0"
                      className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 font-mono text-sm font-semibold tabular-nums"
                    />
                    {rule.mode === FEE_MODES.HOURLY ? (
                      <p className="mt-1 text-[11px] text-[#666159]">
                        {isWfa
                          ? `Dihitung berdasarkan estimasi jam kerja WFA (contoh 3 jam = ${formatRupiah(parsedAmount * 3)}).`
                          : `Dihitung proporsional durasi studio (contoh 3 jam = ${formatRupiah(parsedAmount * 3)}).`}
                      </p>
                    ) : null}
                  </div>
                ) : rule.mode === FEE_MODES.MANUAL ? (
                  <p className="text-[11px] text-[#666159]">
                    Nominal {role.label} diinput manual pada Booking Form (nilai Rp 0
                    diperbolehkan).
                  </p>
                ) : null}

                {amountError ? (
                  <p role="alert" className="text-xs font-medium text-[#B92B0C]">
                    {amountError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
