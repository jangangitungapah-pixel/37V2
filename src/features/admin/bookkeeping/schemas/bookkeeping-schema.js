/**
 * Zod Input Validation, Settlement Derivation, and Firestore Normalizers
 * for `bookkeepingEntries`, `bookkeepingSettlements`, and `bookkeepingSettings`.
 *
 * Preserves 100% backward compatibility with Phase 9 13-field Commission accruals.
 */

import { z } from 'zod';

import { isValidIsoDateString } from '@/features/admin/calendar/utils/calendar-date';

import {
  BOOKKEEPING_ENTRY_TYPES,
  BOOKKEEPING_PAYMENT_METHODS,
  BOOKKEEPING_SETTLEMENT_STATUS,
  BOOKKEEPING_SETTLEMENT_TYPES,
  BOOKKEEPING_SOURCE_MODULES,
  BOOKKEEPING_SOURCE_TYPES,
  getBookkeepingCategoryLabel,
  MANUAL_EXPENSE_CATEGORY_IDS,
  MANUAL_INCOME_CATEGORY_IDS,
} from '../config/bookkeeping-config';

export function toNonNegativeRupiahInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num);
}

/**
 * Pure payable settlement status derivation:
 * - settled == 0 -> unpaid
 * - 0 < settled < original -> partially_paid
 * - settled == original -> paid
 */
export function derivePayableSettlementStatus(originalAmount, amountSettled) {
  const safeTotal = toNonNegativeRupiahInt(originalAmount);
  const safeSettled = toNonNegativeRupiahInt(amountSettled);
  if (safeSettled <= 0) return BOOKKEEPING_SETTLEMENT_STATUS.UNPAID;
  if (safeTotal > 0 && safeSettled >= safeTotal) return BOOKKEEPING_SETTLEMENT_STATUS.PAID;
  return BOOKKEEPING_SETTLEMENT_STATUS.PARTIALLY_PAID;
}

const manualIncomeSchema = z.object({
  description: z
    .string()
    .trim()
    .min(2, 'Deskripsi pemasukan minimal 2 karakter.')
    .max(240, 'Deskripsi pemasukan maksimal 240 karakter.'),
  category: z.enum(MANUAL_INCOME_CATEGORY_IDS, {
    errorMap: () => ({ message: 'Pilih kategori pemasukan manual yang valid.' }),
  }),
  amount: z.coerce
    .number({ invalid_type_error: 'Nominal pemasukan harus berupa angka valid.' })
    .int('Nominal pemasukan harus bilangan bulat Rupiah.')
    .positive('Nominal pemasukan harus lebih dari Rp 0.'),
  receivedDate: z
    .string()
    .trim()
    .refine(isValidIsoDateString, 'Tanggal penerimaan wajib diisi (YYYY-MM-DD).'),
  paymentMethod: z.enum(BOOKKEEPING_PAYMENT_METHODS, {
    errorMap: () => ({ message: 'Pilih metode pembayaran yang valid.' }),
  }),
  referenceNumber: z
    .string()
    .trim()
    .max(120, 'Nomor referensi maksimal 120 karakter.')
    .optional()
    .default(''),
  notes: z.string().trim().max(400, 'Catatan maksimal 400 karakter.').optional().default(''),
});

const manualExpenseSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(2, 'Deskripsi pengeluaran minimal 2 karakter.')
      .max(240, 'Deskripsi pengeluaran maksimal 240 karakter.'),
    category: z.enum(MANUAL_EXPENSE_CATEGORY_IDS, {
      errorMap: () => ({ message: 'Pilih kategori pengeluaran yang valid.' }),
    }),
    amount: z.coerce
      .number({ invalid_type_error: 'Nominal pengeluaran harus berupa angka valid.' })
      .int('Nominal pengeluaran harus bilangan bulat Rupiah.')
      .positive('Nominal pengeluaran harus lebih dari Rp 0.'),
    expenseDate: z
      .string()
      .trim()
      .refine(isValidIsoDateString, 'Tanggal pengeluaran wajib diisi (YYYY-MM-DD).'),
    paymentStatus: z.enum(['paid', 'unpaid'], {
      errorMap: () => ({ message: 'Pilih status pembayaran Paid atau Unpaid.' }),
    }),
    paymentMethod: z.string().trim().optional().default('cash'),
    paidDate: z.string().trim().optional().default(''),
    dueDate: z.string().trim().optional().default(''),
    referenceNumber: z
      .string()
      .trim()
      .max(120, 'Nomor referensi maksimal 120 karakter.')
      .optional()
      .default(''),
    notes: z.string().trim().max(400, 'Catatan maksimal 400 karakter.').optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.paymentStatus === 'paid') {
      if (!BOOKKEEPING_PAYMENT_METHODS.includes(data.paymentMethod)) {
        ctx.addIssue({
          code: 'custom',
          path: ['paymentMethod'],
          message: 'Metode pembayaran wajib dipilih untuk pengeluaran Paid.',
        });
      }
      if (!isValidIsoDateString(data.paidDate)) {
        ctx.addIssue({
          code: 'custom',
          path: ['paidDate'],
          message: 'Tanggal bayar wajib diisi untuk pengeluaran Paid (YYYY-MM-DD).',
        });
      }
    } else if (data.dueDate && !isValidIsoDateString(data.dueDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Format jatuh tempo harus YYYY-MM-DD.',
      });
    }
  });

const settlementSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Nominal pembayaran harus berupa angka valid.' })
    .int('Nominal pembayaran harus bilangan bulat Rupiah.')
    .positive('Nominal pembayaran harus lebih dari Rp 0.'),
  paidDate: z
    .string()
    .trim()
    .refine(isValidIsoDateString, 'Tanggal pembayaran wajib diisi (YYYY-MM-DD).'),
  paymentMethod: z.enum(BOOKKEEPING_PAYMENT_METHODS, {
    errorMap: () => ({ message: 'Pilih metode pembayaran yang valid.' }),
  }),
  referenceNumber: z
    .string()
    .trim()
    .max(120, 'Nomor referensi maksimal 120 karakter.')
    .optional()
    .default(''),
  notes: z.string().trim().max(400, 'Catatan maksimal 400 karakter.').optional().default(''),
});

const reversalSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Alasan koreksi / reversal minimal 3 karakter.')
    .max(300, 'Alasan koreksi maksimal 300 karakter.'),
});

const openingBalanceSchema = z.object({
  enabled: z.boolean().default(false),
  openingCashBalance: z.coerce
    .number({ invalid_type_error: 'Saldo awal harus berupa angka valid.' })
    .int('Saldo awal harus bilangan bulat Rupiah.')
    .min(0, 'Saldo awal tidak boleh negatif.')
    .optional()
    .default(0),
  openingBalanceAsOf: z
    .string()
    .trim()
    .refine((val) => !val || isValidIsoDateString(val), 'Tanggal saldo awal harus YYYY-MM-DD.')
    .optional()
    .default(''),
  openingBalanceNote: z
    .string()
    .trim()
    .max(200, 'Catatan saldo awal maksimal 200 karakter.')
    .optional()
    .default(''),
});

function collectZodErrors(zodError) {
  const errors = {};
  for (const issue of zodError.issues) {
    const key = String(issue.path?.[0] || 'form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function validateManualIncomeInput(input) {
  const parsed = manualIncomeSchema.safeParse({
    description: input?.description || '',
    category: input?.category || '',
    amount: input?.amount,
    receivedDate: input?.receivedDate || '',
    paymentMethod: input?.paymentMethod || 'cash',
    referenceNumber: input?.referenceNumber || '',
    notes: input?.notes || '',
  });
  if (!parsed.success) {
    return { isValid: false, errors: collectZodErrors(parsed.error), data: null };
  }
  return { isValid: true, errors: {}, data: parsed.data };
}

export function validateManualExpenseInput(input) {
  const parsed = manualExpenseSchema.safeParse({
    description: input?.description || '',
    category: input?.category || '',
    amount: input?.amount,
    expenseDate: input?.expenseDate || '',
    paymentStatus: input?.paymentStatus || 'paid',
    paymentMethod: input?.paymentMethod || 'cash',
    paidDate: input?.paidDate || input?.expenseDate || '',
    dueDate: input?.dueDate || '',
    referenceNumber: input?.referenceNumber || '',
    notes: input?.notes || '',
  });
  if (!parsed.success) {
    return { isValid: false, errors: collectZodErrors(parsed.error), data: null };
  }
  return { isValid: true, errors: {}, data: parsed.data };
}

export function validateSettlementInput(input, maxAllowedRemaining = null) {
  const parsed = settlementSchema.safeParse({
    amount: input?.amount,
    paidDate: input?.paidDate || '',
    paymentMethod: input?.paymentMethod || 'transfer',
    referenceNumber: input?.referenceNumber || '',
    notes: input?.notes || '',
  });
  if (!parsed.success) {
    return { isValid: false, errors: collectZodErrors(parsed.error), data: null };
  }

  if (
    maxAllowedRemaining !== null &&
    maxAllowedRemaining !== undefined &&
    parsed.data.amount > toNonNegativeRupiahInt(maxAllowedRemaining)
  ) {
    return {
      isValid: false,
      errors: {
        amount: `Nominal pembayaran melebihi sisa kewajiban (maksimal Rp ${toNonNegativeRupiahInt(maxAllowedRemaining).toLocaleString('id-ID')}).`,
      },
      data: null,
    };
  }

  return { isValid: true, errors: {}, data: parsed.data };
}

export function validateBookkeepingReversalInput(input) {
  const parsed = reversalSchema.safeParse({
    reason: input?.reason || '',
  });
  if (!parsed.success) {
    return {
      isValid: false,
      errors: { reason: parsed.error.issues[0]?.message || 'Alasan koreksi wajib diisi.' },
      data: null,
    };
  }
  return { isValid: true, errors: {}, data: parsed.data };
}

export function validateOpeningBalanceInput(input) {
  const parsed = openingBalanceSchema.safeParse({
    enabled: Boolean(input?.enabled),
    openingCashBalance: input?.openingCashBalance ?? 0,
    openingBalanceAsOf: input?.openingBalanceAsOf || '',
    openingBalanceNote: input?.openingBalanceNote || '',
  });
  if (!parsed.success) {
    return { isValid: false, errors: collectZodErrors(parsed.error), data: null };
  }
  return { isValid: true, errors: {}, data: parsed.data };
}

/**
 * Normalizes any `bookkeepingEntries/{entryId}` record, including:
 * - Legacy 13-field Commission accruals (`bk_commission_{batchId}_staff|operator`)
 * - Manual Income entries
 * - Manual Paid & Unpaid Expense accruals
 * - Manual Compensating Reversal entries
 */
export function normalizeBookkeepingEntryRecord(id, data = {}) {
  const amount = toNonNegativeRupiahInt(data.amount);
  const entryType = String(data.entryType || BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL).trim();
  const sourceModule = String(
    data.sourceModule || BOOKKEEPING_SOURCE_MODULES.COMMISSION_AND_FEE,
  ).trim();
  const sourceType = String(data.sourceType || BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH).trim();
  const category = String(data.category || '').trim();

  const rawStatus = String(data.settlementStatus || BOOKKEEPING_SETTLEMENT_STATUS.UNPAID).trim();
  const validStatuses = Object.values(BOOKKEEPING_SETTLEMENT_STATUS);
  const baseStatus = validStatuses.includes(rawStatus)
    ? rawStatus
    : BOOKKEEPING_SETTLEMENT_STATUS.UNPAID;

  let amountSettled;
  let remainingAmount;
  let settlementStatus;

  if (entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL) {
    if (baseStatus === BOOKKEEPING_SETTLEMENT_STATUS.REVERSED) {
      amountSettled = 0;
      remainingAmount = 0;
      settlementStatus = BOOKKEEPING_SETTLEMENT_STATUS.REVERSED;
    } else {
      const hasExplicitSettled = data.amountSettled !== undefined && data.amountSettled !== null;
      amountSettled = hasExplicitSettled
        ? Math.min(amount, toNonNegativeRupiahInt(data.amountSettled))
        : baseStatus === BOOKKEEPING_SETTLEMENT_STATUS.PAID
          ? amount
          : 0;

      remainingAmount = Math.max(0, amount - amountSettled);
      settlementStatus = derivePayableSettlementStatus(amount, amountSettled);
    }
  } else if (entryType === BOOKKEEPING_ENTRY_TYPES.INCOME) {
    settlementStatus =
      baseStatus === BOOKKEEPING_SETTLEMENT_STATUS.REVERSED
        ? BOOKKEEPING_SETTLEMENT_STATUS.REVERSED
        : BOOKKEEPING_SETTLEMENT_STATUS.PAID;
    amountSettled = settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.REVERSED ? 0 : amount;
    remainingAmount = 0;
  } else {
    settlementStatus = BOOKKEEPING_SETTLEMENT_STATUS.REVERSED;
    amountSettled = 0;
    remainingAmount = 0;
  }

  return {
    id: String(id || data.id || '').trim(),
    sourceModule,
    sourceType,
    sourceId: String(data.sourceId || '').trim(),
    entryType,
    category,
    categoryLabel: getBookkeepingCategoryLabel(category),
    description: String(data.description || '').trim(),
    amount,
    currency: String(data.currency || 'IDR').trim() || 'IDR',
    settlementStatus,
    amountSettled,
    remainingAmount,
    paidOnCreate: Boolean(data.paidOnCreate),
    paymentMethod: data.paymentMethod ? String(data.paymentMethod).trim() : '',
    dueDate:
      typeof data.dueDate === 'string' && isValidIsoDateString(data.dueDate)
        ? data.dueDate.trim()
        : null,
    referenceNumber: String(data.referenceNumber || '').trim(),
    notes: String(data.notes || '').trim(),
    lastSettlementId: data.lastSettlementId ? String(data.lastSettlementId).trim() : null,
    lastSettledAt: data.lastSettledAt ?? null,
    reversalOfEntryId: data.reversalOfEntryId ? String(data.reversalOfEntryId).trim() : null,
    originalEntryType: data.originalEntryType ? String(data.originalEntryType).trim() : null,
    reversedByEntryId: data.reversedByEntryId ? String(data.reversedByEntryId).trim() : null,
    reversalReason: String(data.reversalReason || '').trim(),
    reversedAt: data.reversedAt ?? null,
    reversedByUid: String(data.reversedByUid || '').trim(),
    occurredAt: data.occurredAt ?? data.postedAt ?? data.createdAt ?? null,
    postedAt: data.postedAt ?? null,
    createdAt: data.createdAt ?? null,
    createdByUid: String(data.createdByUid || '').trim(),
    updatedAt: data.updatedAt ?? null,
    updatedByUid: String(data.updatedByUid || '').trim(),
    version:
      Number.isInteger(Number(data.version)) && Number(data.version) >= 1
        ? Number(data.version)
        : 1,
  };
}

/**
 * Normalizes an append-only `bookkeepingSettlements/{settlementId}` document.
 */
export function normalizeBookkeepingSettlementRecord(id, data = {}) {
  const cleanId = String(id || data.id || '').trim();
  const paymentMethod = BOOKKEEPING_PAYMENT_METHODS.includes(data.paymentMethod)
    ? data.paymentMethod
    : 'cash';

  return {
    id: cleanId,
    entryId: String(data.entryId || '').trim(),
    sourceModule: String(data.sourceModule || BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING).trim(),
    sourceType: String(data.sourceType || BOOKKEEPING_SOURCE_TYPES.MANUAL).trim(),
    sourceId: String(data.sourceId || '').trim(),
    settlementType: String(
      data.settlementType || BOOKKEEPING_SETTLEMENT_TYPES.EXPENSE_PAYMENT,
    ).trim(),
    amount: toNonNegativeRupiahInt(data.amount),
    currency: String(data.currency || 'IDR').trim() || 'IDR',
    paymentMethod,
    paidAt: data.paidAt ?? data.createdAt ?? null,
    referenceNumber: String(data.referenceNumber || '').trim(),
    notes: String(data.notes || '').trim(),
    operationId: String(data.operationId || cleanId).trim(),
    createdAt: data.createdAt ?? null,
    createdByUid: String(data.createdByUid || '').trim(),
  };
}

/**
 * Normalizes `bookkeepingSettings/default` configuration.
 */
export function normalizeBookkeepingSettingsRecord(id, data = {}) {
  const hasOpening =
    data.openingCashBalance !== null &&
    data.openingCashBalance !== undefined &&
    Number.isFinite(Number(data.openingCashBalance)) &&
    Number(data.openingCashBalance) >= 0;

  return {
    id: String(id || 'default'),
    openingCashBalance: hasOpening ? Math.round(Number(data.openingCashBalance)) : null,
    openingBalanceAsOf:
      typeof data.openingBalanceAsOf === 'string' && isValidIsoDateString(data.openingBalanceAsOf)
        ? data.openingBalanceAsOf.trim()
        : null,
    openingBalanceNote: String(data.openingBalanceNote || '').trim(),
    updatedAt: data.updatedAt ?? null,
    updatedByUid: String(data.updatedByUid || '').trim(),
  };
}
