import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
      <p className="text-studio-muted-ink text-xs leading-relaxed font-medium">
        Konfigurasi alokasi internal per booking/project. Seluruh fee internal{' '}
        <strong>terpisah sepenuhnya</strong> dari total tagihan customer, DP, dan sisa pembayaran.
      </p>

      {ROLE_META.map((role) => {
        const rule = fees?.[role.key] || { mode: FEE_MODES.NONE, amount: '0' };
        const isExpanded = Boolean(expandedRoles[role.key]);
        const needsAmount = rule.mode === FEE_MODES.FIXED || rule.mode === FEE_MODES.HOURLY;
        const parsedAmount = parseMoneyInput(rule.amount);
        const amountError = errors[`fees.${role.key}.amount`] || errors[`fees.${role.key}.mode`];

        return (
          <div key={role.key} className="border-studio-ink bg-studio-ivory border-2">
            <button
              type="button"
              onClick={() => toggleRole(role.key)}
              aria-expanded={isExpanded}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left"
            >
              <div className="min-w-0">
                <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                  {role.label}
                </span>
                <span className="text-studio-muted-ink block truncate text-[11px] font-medium">
                  {role.subtitle}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`border-studio-ink border px-2 py-0.5 font-mono text-[10px] font-extrabold whitespace-nowrap uppercase ${
                    rule.mode === FEE_MODES.NONE
                      ? 'bg-studio-white text-studio-muted-ink'
                      : 'bg-studio-lime text-studio-ink'
                  }`}
                >
                  {formatRoleBadge(rule)}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
              </div>
            </button>

            {isExpanded ? (
              <div className="border-studio-ink bg-studio-white space-y-3 border-t p-3">
                <div>
                  <span className="text-studio-muted-ink block font-mono text-[10px] font-bold uppercase">
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
                          className={`min-h-10 cursor-pointer border px-2 py-1.5 font-mono text-[11px] font-extrabold uppercase transition-colors ${
                            isSelected
                              ? 'border-studio-ink bg-studio-ink text-studio-lime'
                              : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
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
                        className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                      >
                        {role.label}{' '}
                        {rule.mode === FEE_MODES.HOURLY ? 'Rate per Jam (IDR)' : 'Fixed (IDR)'}
                      </label>
                      <span className="font-mono text-[11px] font-extrabold">
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
                      className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                    />
                    {rule.mode === FEE_MODES.HOURLY ? (
                      <p className="text-studio-muted-ink mt-1 font-mono text-[10px]">
                        {isWfa
                          ? `Dihitung berdasarkan estimasi jam kerja WFA (contoh 3 jam = ${formatRupiah(parsedAmount * 3)}).`
                          : `Dihitung proporsional durasi studio (contoh 3 jam = ${formatRupiah(parsedAmount * 3)}).`}
                      </p>
                    ) : null}
                  </div>
                ) : rule.mode === FEE_MODES.MANUAL ? (
                  <p className="text-studio-muted-ink font-mono text-[11px]">
                    Nominal {role.label} diinput manual pada Booking Form (nilai Rp 0
                    diperbolehkan).
                  </p>
                ) : null}

                {amountError ? (
                  <p role="alert" className="text-studio-error-ink text-xs font-bold">
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
