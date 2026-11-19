/**
 * Commission Snapshot Normalizer & Integrity Validator (Phase 9)
 *
 * CRITICAL CONTRACT:
 * - Strictly consumes persisted `booking.commissionSnapshot` (V2 and Legacy V1).
 * - NEVER recalculates fees from live `settings/pricing`.
 * - NEVER fabricates or clamps negative/corrupted values into valid zero entries;
 *   invalid or missing snapshots fail validation cleanly so they route to Needs Review.
 */

export const VALID_V2_FEE_BASES = ['none', 'fixed', 'hourly', 'manual'];
export const VALID_V1_STAFF_BASES = ['package', 'rehearsal_hourly', 'none'];

export const COMMISSION_BASIS_LABELS = {
  none: 'Tidak Ada',
  fixed: 'Fixed / Tetap',
  hourly: 'Per Jam',
  manual: 'Input Manual',
  package: 'Paket / Fixed (Lama)',
  rehearsal_hourly: 'Per Jam (Lama)',
};

function isFiniteNonNegativeInt(value) {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
  );
}

function isFiniteNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validateV2RoleEntry(entry, roleLabel) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { isValid: false, reason: `Data komisi ${roleLabel} tidak lengkap.` };
  }

  if (!VALID_V2_FEE_BASES.includes(entry.basis)) {
    return {
      isValid: false,
      reason: `Basis fee ${roleLabel} ("${String(entry.basis || '')}") tidak dikenali.`,
    };
  }

  if (!isFiniteNonNegativeInt(entry.rate) || !isFiniteNonNegativeInt(entry.amount)) {
    return {
      isValid: false,
      reason: `Nominal atau tarif fee ${roleLabel} harus berupa bilangan bulat non-negatif.`,
    };
  }

  return {
    isValid: true,
    entry: {
      basis: entry.basis,
      rate: entry.rate,
      amount: entry.amount,
    },
  };
}

/**
 * Parses and strictly validates a raw `booking.commissionSnapshot` (V1 or V2).
 */
export function parseCommissionSnapshot(rawSnapshot = null) {
  if (!rawSnapshot || typeof rawSnapshot !== 'object' || Array.isArray(rawSnapshot)) {
    return {
      isValid: false,
      schemaVersion: 0,
      settingsVersion: 0,
      reason: 'Catatan komisi (commission snapshot) belum tersedia pada booking ini.',
    };
  }

  const isV2Shape =
    rawSnapshot.schemaVersion === 2 ||
    'staff' in rawSnapshot ||
    'owner' in rawSnapshot ||
    'recordingOperator' in rawSnapshot;

  if (isV2Shape) {
    if (rawSnapshot.schemaVersion !== 2) {
      return {
        isValid: false,
        schemaVersion: Number(rawSnapshot.schemaVersion) || 0,
        settingsVersion: 0,
        reason: 'Versi struktur commission snapshot V2 tidak valid.',
      };
    }

    const staffCheck = validateV2RoleEntry(rawSnapshot.staff, 'Staff');
    if (!staffCheck.isValid) {
      return { isValid: false, schemaVersion: 2, settingsVersion: 0, reason: staffCheck.reason };
    }

    const ownerCheck = validateV2RoleEntry(rawSnapshot.owner, 'Owner');
    if (!ownerCheck.isValid) {
      return { isValid: false, schemaVersion: 2, settingsVersion: 0, reason: ownerCheck.reason };
    }

    const operatorCheck = validateV2RoleEntry(rawSnapshot.recordingOperator, 'Recording Operator');
    if (!operatorCheck.isValid) {
      return {
        isValid: false,
        schemaVersion: 2,
        settingsVersion: 0,
        reason: operatorCheck.reason,
      };
    }

    const settingsVersion = Number(rawSnapshot.settingsVersion);
    if (!Number.isInteger(settingsVersion) || settingsVersion < 1) {
      return {
        isValid: false,
        schemaVersion: 2,
        settingsVersion: 0,
        reason: 'Versi pengaturan tarif pada commission snapshot tidak valid.',
      };
    }

    const staffPayableAmount = staffCheck.entry.amount;
    const recordingOperatorPayableAmount = operatorCheck.entry.amount;
    const ownerAllocationReference = ownerCheck.entry.amount;

    return {
      isValid: true,
      schemaVersion: 2,
      settingsVersion,
      staff: staffCheck.entry,
      owner: ownerCheck.entry,
      recordingOperator: operatorCheck.entry,
      staffPayableAmount,
      recordingOperatorPayableAmount,
      ownerAllocationReference,
      payableTotal: staffPayableAmount + recordingOperatorPayableAmount,
    };
  }

  // Legacy V1 compatibility check
  const hasV1Shape =
    'staffBasis' in rawSnapshot ||
    'staffAmount' in rawSnapshot ||
    'recordingOperatorAmount' in rawSnapshot;

  if (!hasV1Shape) {
    return {
      isValid: false,
      schemaVersion: 0,
      settingsVersion: 0,
      reason: 'Struktur commission snapshot tidak dikenali.',
    };
  }

  if (!VALID_V1_STAFF_BASES.includes(rawSnapshot.staffBasis)) {
    return {
      isValid: false,
      schemaVersion: 1,
      settingsVersion: 0,
      reason: `Basis fee Staff V1 ("${String(rawSnapshot.staffBasis || '')}") tidak valid.`,
    };
  }

  if (!isFiniteNonNegativeNumber(rawSnapshot.staffAmount)) {
    return {
      isValid: false,
      schemaVersion: 1,
      settingsVersion: 0,
      reason: 'Nominal Staff pada snapshot V1 tidak valid atau bernilai negatif.',
    };
  }

  const rawOpAmount =
    rawSnapshot.recordingOperatorAmount === undefined ||
    rawSnapshot.recordingOperatorAmount === null
      ? 0
      : rawSnapshot.recordingOperatorAmount;

  if (!isFiniteNonNegativeNumber(rawOpAmount)) {
    return {
      isValid: false,
      schemaVersion: 1,
      settingsVersion: 0,
      reason: 'Nominal Recording Operator pada snapshot V1 tidak valid atau bernilai negatif.',
    };
  }

  const rawStaffRate =
    rawSnapshot.staffRate === undefined || rawSnapshot.staffRate === null
      ? 0
      : rawSnapshot.staffRate;

  if (!isFiniteNonNegativeNumber(rawStaffRate)) {
    return {
      isValid: false,
      schemaVersion: 1,
      settingsVersion: 0,
      reason: 'Tarif Staff pada snapshot V1 tidak valid.',
    };
  }

  const v1SettingsVersion =
    rawSnapshot.settingsVersion === undefined || rawSnapshot.settingsVersion === null
      ? 1
      : Number(rawSnapshot.settingsVersion);

  if (!Number.isInteger(v1SettingsVersion) || v1SettingsVersion < 1) {
    return {
      isValid: false,
      schemaVersion: 1,
      settingsVersion: 0,
      reason: 'Versi pengaturan tarif pada snapshot V1 tidak valid.',
    };
  }

  const staffPayableAmount = Math.round(rawSnapshot.staffAmount);
  const recordingOperatorPayableAmount = Math.round(rawOpAmount);

  return {
    isValid: true,
    schemaVersion: 1,
    settingsVersion: v1SettingsVersion,
    staff: {
      basis: rawSnapshot.staffBasis,
      rate: Math.round(rawStaffRate),
      amount: staffPayableAmount,
    },
    owner: {
      basis: 'none',
      rate: 0,
      amount: 0,
    },
    recordingOperator: {
      basis: recordingOperatorPayableAmount > 0 ? 'fixed' : 'none',
      rate: recordingOperatorPayableAmount,
      amount: recordingOperatorPayableAmount,
    },
    staffPayableAmount,
    recordingOperatorPayableAmount,
    ownerAllocationReference: 0,
    payableTotal: staffPayableAmount + recordingOperatorPayableAmount,
  };
}

/**
 * Deterministic signature of a parsed or raw commission snapshot used by optimistic
 * concurrency review checks before posting so stale snapshots are rejected cleanly.
 */
export function buildCommissionSnapshotSignature(rawSnapshot = null) {
  const parsed = parseCommissionSnapshot(rawSnapshot);
  if (!parsed.isValid) return 'invalid';

  return [
    `v${parsed.schemaVersion}`,
    `sv${parsed.settingsVersion}`,
    `s:${parsed.staff.basis}:${parsed.staff.rate}:${parsed.staff.amount}`,
    `o:${parsed.owner.basis}:${parsed.owner.rate}:${parsed.owner.amount}`,
    `op:${parsed.recordingOperator.basis}:${parsed.recordingOperator.rate}:${parsed.recordingOperator.amount}`,
  ].join('|');
}

export function getCommissionBasisLabel(basis = 'none') {
  return COMMISSION_BASIS_LABELS[basis] || String(basis || '-');
}
