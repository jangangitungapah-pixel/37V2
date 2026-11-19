import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';

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
      <p className="text-studio-muted-ink text-xs leading-relaxed font-medium">
        Aturan diskon otomatis khusus subcategory <strong>Hourly</strong>. Jika beberapa aturan
        memenuhi syarat, sistem memilih <strong>1 diskon valid terbesar</strong> tanpa stacking dan
        dibatasi maksimal subtotal.
      </p>

      {/* Existing Discount Rules */}
      {discountRules.length === 0 ? (
        <div className="border-studio-ink bg-studio-ivory border border-dashed p-3 text-center font-mono text-[11px]">
          Belum ada aturan diskon pada subcategory ini.
        </div>
      ) : (
        <ul className="space-y-2">
          {discountRules.map((rule) => {
            const isPerBlock = rule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK;
            return (
              <li
                key={rule.id}
                className={`border-studio-ink flex flex-wrap items-center justify-between gap-2 border p-2.5 ${
                  rule.isActive ? 'bg-studio-ivory' : 'bg-neutral-100 opacity-75'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="border-studio-ink bg-studio-white border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                      {isPerBlock ? 'Per Kelipatan' : 'Min. Durasi'}
                    </span>
                    <span className="font-mono text-xs font-extrabold">{rule.name}</span>
                  </div>
                  <p className="text-studio-muted-ink mt-1 font-mono text-[11px] font-semibold">
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
                    className={`border-studio-ink min-h-9 cursor-pointer border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase ${
                      rule.isActive
                        ? 'bg-studio-lime text-studio-ink'
                        : 'bg-studio-white text-studio-muted-ink'
                    }`}
                  >
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus aturan diskon ${rule.name}`}
                    onClick={() => handleRemoveRule(rule.id)}
                    className="border-studio-ink bg-studio-white text-studio-error-ink hover:bg-studio-orange hover:text-studio-white inline-flex h-9 w-9 cursor-pointer items-center justify-center border"
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
      <div className="border-studio-ink bg-studio-ivory space-y-2.5 border p-3">
        <p className="font-mono text-[11px] font-extrabold uppercase">Tambah Aturan Diskon</p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label
              htmlFor="opt-disc-rule-mode"
              className="text-studio-ink block font-mono text-[10px] font-extrabold uppercase"
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
              className="border-studio-ink bg-studio-white text-studio-ink mt-1 min-h-10 w-full border px-2.5 py-1.5 text-xs font-bold"
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
              className="text-studio-ink block font-mono text-[10px] font-extrabold uppercase"
            >
              Label Diskon
            </label>
            <input
              id="opt-disc-rule-name"
              type="text"
              value={draftRule.name}
              onChange={(e) => setDraftRule((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Diskon Durasi"
              className="border-studio-ink bg-studio-white text-studio-ink mt-1 min-h-10 w-full border px-2.5 py-1.5 text-xs font-semibold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-1">
              <label
                htmlFor="opt-disc-rule-duration"
                className="text-studio-ink block font-mono text-[10px] font-extrabold uppercase"
              >
                {draftRule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK
                  ? 'Interval Blok (Menit)'
                  : 'Min. Durasi (Menit)'}
              </label>
              <span className="font-mono text-[10px] font-bold">
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
              className="border-studio-ink bg-studio-white text-studio-ink mt-1 min-h-10 w-full border px-2.5 py-1.5 font-mono text-xs font-extrabold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-1">
              <label
                htmlFor="opt-disc-rule-amount"
                className="text-studio-ink block font-mono text-[10px] font-extrabold uppercase"
              >
                Nominal Diskon (IDR)
              </label>
              <span className="font-mono text-[10px] font-extrabold text-emerald-800">
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
              className="border-studio-ink bg-studio-white text-studio-ink mt-1 min-h-10 w-full border px-2.5 py-1.5 font-mono text-xs font-extrabold"
            />
          </div>
        </div>

        {draftError ? (
          <p role="alert" className="text-studio-error-ink text-xs font-bold">
            {draftError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleAddRule}
          className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Tambah Aturan Diskon</span>
        </button>
      </div>

      {errors.discountRules ? (
        <p role="alert" className="text-studio-error-ink text-xs font-bold">
          {errors.discountRules}
        </p>
      ) : null}
    </div>
  );
}
