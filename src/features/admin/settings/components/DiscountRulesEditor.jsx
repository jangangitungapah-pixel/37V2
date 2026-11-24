import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';
import { AdminStatusBadge } from '@/features/admin/design-system';

import { DISCOUNT_RULE_MODES } from '../pricing/config/default-pricing-settings';
import { formatRupiah, parseMoneyInput } from '../pricing/utils/calculate-pricing-settings';
import { generateSettingsItemId } from '../pricing/utils/normalize-pricing-settings';

export function DiscountRulesEditor({ discountRules = [], errors = {}, onChangeRules }) {
  const [draftRule, setDraftRule] = useState({
    mode: DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK,
    name: 'Diskon Durasi',
    durationMinutes: '180',
    discountAmount: '30000',
  });
  const [draftError, setDraftError] = useState('');

  const handleAddRule = () => {
    setDraftError('');
    const minutes = Number(draftRule.durationMinutes);
    const amount = parseMoneyInput(draftRule.discountAmount);
    const isPerBlock = draftRule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK;

    if (!Number.isInteger(minutes) || minutes <= 0) {
      setDraftError('Durasi / interval diskon harus bilangan bulat lebih dari 0 menit.');
      return;
    }

    if (!isPerBlock && (minutes < 30 || minutes % 30 !== 0)) {
      setDraftError('Minimum durasi wajib kelipatan 30 menit (minimal 30 menit).');
      return;
    }

    if (amount <= 0) {
      setDraftError('Nominal diskon wajib lebih dari Rp 0.');
      return;
    }

    const nextRule = {
      id: generateSettingsItemId('disc'),
      name: String(draftRule.name || '').trim() || (isPerBlock ? 'Diskon Durasi' : 'Promo Durasi'),
      mode: draftRule.mode,
      intervalMinutes: isPerBlock ? minutes : 0,
      minimumDurationMinutes: isPerBlock ? 0 : minutes,
      discountAmount: amount,
      isActive: true,
      sortOrder: discountRules.length + 1,
    };

    onChangeRules([...discountRules, nextRule]);
  };

  const handleToggleRule = (ruleId) => {
    onChangeRules(
      discountRules.map((rule) =>
        rule.id === ruleId ? { ...rule, isActive: !(rule.isActive !== false) } : rule,
      ),
    );
  };

  const handleRemoveRule = (ruleId) => {
    onChangeRules(discountRules.filter((rule) => rule.id !== ruleId));
  };

  const parsedDraftMinutes = Number(draftRule.durationMinutes) || 0;
  const parsedDraftAmount = parseMoneyInput(draftRule.discountAmount);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[#666159]">
        Aturan diskon otomatis khusus subcategory <strong className="text-[#151515]">Hourly</strong>
        . Jika beberapa aturan memenuhi syarat, sistem memilih{' '}
        <strong className="text-[#151515]">1 diskon valid terbesar</strong> tanpa stacking dan
        dibatasi maksimal subtotal.
      </p>

      {/* Existing Discount Rules */}
      {discountRules.length === 0 ? (
        <div className="sa-panel border-dashed p-3.5 text-center text-xs text-[#666159]">
          Belum ada aturan diskon pada subcategory ini.
        </div>
      ) : (
        <ul className="space-y-2">
          {discountRules.map((rule) => {
            const isPerBlock = rule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK;
            return (
              <li
                key={rule.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#151515]/10 p-3 ${
                  rule.isActive ? 'bg-[#FAF8F3]' : 'bg-neutral-100 opacity-75'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AdminStatusBadge tone="ivory" size="sm">
                      {isPerBlock ? 'Per Kelipatan' : 'Min. Durasi'}
                    </AdminStatusBadge>
                    <span className="text-xs font-semibold text-[#151515]">{rule.name}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] font-medium text-[#666159]">
                    {isPerBlock
                      ? `Setiap ${formatDurationMinutes(rule.intervalMinutes)} hemat ${formatRupiah(rule.discountAmount)}`
                      : `Min. ${formatDurationMinutes(rule.minimumDurationMinutes)} hemat ${formatRupiah(rule.discountAmount)}`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={rule.isActive}
                    onClick={() => handleToggleRule(rule.id)}
                    className={`min-h-10 cursor-pointer rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      rule.isActive
                        ? 'border-[#8BAD12]/35 bg-[#EDF8C2] text-[#243300]'
                        : 'border-[#151515]/12 bg-white text-[#666159]'
                    }`}
                  >
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus aturan diskon ${rule.name}`}
                    onClick={() => handleRemoveRule(rule.id)}
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#FF4B22]/20 bg-[#FFEDE8] text-[#B92B0C] transition-colors hover:bg-[#FF4B22] hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Compact Inline Rule Adder */}
      <div className="sa-panel-ivory space-y-3 p-3.5">
        <p className="text-xs font-semibold text-[#151515]">Tambah Aturan Diskon</p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="opt-disc-rule-mode"
              className="block text-[11px] font-semibold text-[#151515]"
            >
              Jenis Aturan
            </label>
            <select
              id="opt-disc-rule-mode"
              value={draftRule.mode}
              onChange={(e) => {
                const nextMode = e.target.value;
                setDraftRule((prev) => ({
                  ...prev,
                  mode: nextMode,
                  name:
                    nextMode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK
                      ? 'Diskon Durasi'
                      : 'Promo Durasi',
                }));
              }}
              className="sa-input mt-1 min-h-10 w-full px-2.5 py-1.5 text-xs font-medium"
            >
              <option value={DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK}>
                Per Completed Block (Kelipatan)
              </option>
              <option value={DISCOUNT_RULE_MODES.MINIMUM_DURATION}>Minimum Duration</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="opt-disc-rule-name"
              className="block text-[11px] font-semibold text-[#151515]"
            >
              Label Diskon
            </label>
            <input
              id="opt-disc-rule-name"
              type="text"
              value={draftRule.name}
              onChange={(e) => setDraftRule((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Diskon Durasi"
              className="sa-input mt-1 min-h-10 w-full px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-1">
              <label
                htmlFor="opt-disc-rule-duration"
                className="block text-[11px] font-semibold text-[#151515]"
              >
                {draftRule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK
                  ? 'Interval Blok (Menit)'
                  : 'Min. Durasi (Menit)'}
              </label>
              <span className="font-mono text-[10.5px] text-[#666159]">
                {parsedDraftMinutes > 0 ? formatDurationMinutes(parsedDraftMinutes) : '-'}
              </span>
            </div>
            <input
              id="opt-disc-rule-duration"
              type="number"
              min={30}
              step={30}
              value={draftRule.durationMinutes}
              onChange={(e) =>
                setDraftRule((prev) => ({ ...prev, durationMinutes: e.target.value }))
              }
              className="sa-input mt-1 min-h-10 w-full px-2.5 py-1.5 font-mono text-xs font-semibold tabular-nums"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-1">
              <label
                htmlFor="opt-disc-rule-amount"
                className="block text-[11px] font-semibold text-[#151515]"
              >
                Nominal Diskon (IDR)
              </label>
              <span className="font-mono text-[10.5px] font-semibold text-[#0F6246] tabular-nums">
                -{formatRupiah(parsedDraftAmount)}
              </span>
            </div>
            <input
              id="opt-disc-rule-amount"
              type="text"
              inputMode="numeric"
              value={draftRule.discountAmount}
              onChange={(e) =>
                setDraftRule((prev) => ({
                  ...prev,
                  discountAmount: e.target.value.replace(/\D/g, ''),
                }))
              }
              className="sa-input mt-1 min-h-10 w-full px-2.5 py-1.5 font-mono text-xs font-semibold tabular-nums"
            />
          </div>
        </div>

        {draftError ? (
          <p role="alert" className="text-xs font-medium text-[#B92B0C]">
            {draftError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleAddRule}
          className="sa-control sa-btn-lime inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold sm:w-auto"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tambah Aturan Diskon</span>
        </button>
      </div>

      {errors.discountRules ? (
        <p role="alert" className="text-xs font-medium text-[#B92B0C]">
          {errors.discountRules}
        </p>
      ) : null}
    </div>
  );
}
