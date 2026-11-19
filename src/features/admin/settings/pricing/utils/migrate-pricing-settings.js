import {
  DEFAULT_OPERATIONAL_SETTINGS,
  DEFAULT_SERVICE_TYPES,
  DELIVERY_MODES,
  DISCOUNT_RULE_MODES,
  FEE_MODES,
  PRICING_MODES,
  PRICING_SETTINGS_SCHEMA_VERSION,
} from '../config/default-pricing-settings';

function toSafeInt(value, fallback = 0) {
  if (typeof value === 'string' && !value.trim()) {
    return Math.max(0, Math.round(Number(fallback) || 0));
  }
  const num = Number(value);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return Math.max(0, Math.round(Number(fallback) || 0));
  }
  return Math.max(0, Math.round(num));
}

function getDefaultDraftOptionById(serviceTypeId, optionId) {
  const svc = DEFAULT_SERVICE_TYPES.find((item) => item.id === serviceTypeId);
  const opt = svc?.options?.find((item) => item.id === optionId);
  if (!opt) return null;
  return {
    ...opt,
    pricing: { ...opt.pricing },
    discountRules: (opt.discountRules || []).map((rule) => ({ ...rule })),
    fees: {
      staff: { ...opt.fees.staff },
      owner: { ...opt.fees.owner },
      recordingOperator: { ...opt.fees.recordingOperator },
    },
  };
}

/**
 * Detects whether a raw `settings/pricing` document is legacy Schema V1 (flat
 * `sessionTypes`, `recordingTypes`, `packages`, `discounts`, `fees`) rather than V2.
 */
export function isLegacyV1PricingSettings(rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return false;
  }

  if (
    Number(rawData.schemaVersion) === PRICING_SETTINGS_SCHEMA_VERSION &&
    Array.isArray(rawData.serviceTypes)
  ) {
    return false;
  }

  return (
    Number(rawData.schemaVersion) === 1 ||
    Array.isArray(rawData.sessionTypes) ||
    Array.isArray(rawData.recordingTypes) ||
    Array.isArray(rawData.packages) ||
    Array.isArray(rawData.discounts) ||
    Boolean(rawData.fees && !rawData.operationalSettings)
  );
}

/**
 * Pure, deterministic V1 -> V2 migration function.
 *
 * Guarantees:
 * - Preserves all legacy session IDs, names, descriptions, active flags, sort orders, and hourly rates.
 * - Moves V1 `recordingTypes` into `recording.options`.
 * - Moves V1 `packages` into `fixed_shift` options inside their parent `serviceType` while keeping
 *   exact IDs (`pkg-rehearsal-3h`, `pkg-rehearsal-5h`, etc.) and package commissions.
 * - Moves V1 `fees.rehearsalStaffCommissionPerHour` into `rehearsal-regular.fees.staff`.
 * - Preserves V1 `durationDiscount` (as `per_completed_block`) and V1 `discounts` (as `minimum_duration`).
 * - Preserves V1 `fees.dailyMealAllowancePerStaff` into `operationalSettings.dailyMealAllowancePerStaff`.
 * - Appends requested unconfigured draft options (`rehearsal-pkg-6h`, `rec-lite`, `rec-pro`,
 *   `rec-drum-only`) as inactive/unconfigured and `rec-others` as active `manual_quote` when absent.
 * - Never performs any Firestore write or side effects.
 */
export function migratePricingSettingsV1ToV2(rawV1 = null) {
  if (!rawV1 || typeof rawV1 !== 'object') {
    return {
      schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
      serviceTypes: DEFAULT_SERVICE_TYPES.map((svc) => ({
        ...svc,
        options: svc.options.map((opt) => ({
          ...opt,
          pricing: { ...opt.pricing },
          discountRules: opt.discountRules.map((rule) => ({ ...rule })),
          fees: {
            staff: { ...opt.fees.staff },
            owner: { ...opt.fees.owner },
            recordingOperator: { ...opt.fees.recordingOperator },
          },
        })),
      })),
      operationalSettings: { ...DEFAULT_OPERATIONAL_SETTINGS },
      version: 0,
      updatedAt: null,
      updatedByUid: '',
    };
  }

  // Idempotent: if already V2, return shallow structural copy without remigrating
  if (!isLegacyV1PricingSettings(rawV1) && Array.isArray(rawV1.serviceTypes)) {
    return { ...rawV1, schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION };
  }

  const rawSessionTypes = Array.isArray(rawV1.sessionTypes) ? rawV1.sessionTypes : [];
  const rawRecordingTypes = Array.isArray(rawV1.recordingTypes) ? rawV1.recordingTypes : [];
  const rawPackages = Array.isArray(rawV1.packages) ? rawV1.packages : [];
  const rawDiscounts = Array.isArray(rawV1.discounts) ? rawV1.discounts : [];
  const rawFees = rawV1.fees && typeof rawV1.fees === 'object' ? rawV1.fees : {};

  const rehearsalHourlyStaffFee = toSafeInt(rawFees.rehearsalStaffCommissionPerHour, 0);
  const dailyMealAllowance = toSafeInt(rawFees.dailyMealAllowancePerStaff, 0);

  const sortedSessions = [...rawSessionTypes].sort(
    (a, b) => toSafeInt(a?.sortOrder, 0) - toSafeInt(b?.sortOrder, 0),
  );
  const sortedRecordings = [...rawRecordingTypes].sort(
    (a, b) => toSafeInt(a?.sortOrder, 0) - toSafeInt(b?.sortOrder, 0),
  );
  const sortedPackages = [...rawPackages].sort(
    (a, b) => toSafeInt(a?.sortOrder, 0) - toSafeInt(b?.sortOrder, 0),
  );
  const sortedDiscounts = [...rawDiscounts].sort(
    (a, b) => toSafeInt(a?.sortOrder, 0) - toSafeInt(b?.sortOrder, 0),
  );

  const usedOptionIds = new Set();
  const claimUniqueOptionId = (preferredId, fallbackPrefix) => {
    const clean = String(preferredId || '').trim() || `${fallbackPrefix}-${usedOptionIds.size + 1}`;
    if (!usedOptionIds.has(clean)) {
      usedOptionIds.add(clean);
      return clean;
    }
    let counter = 2;
    while (usedOptionIds.has(`${clean}-${counter}`)) {
      counter += 1;
    }
    const nextId = `${clean}-${counter}`;
    usedOptionIds.add(nextId);
    return nextId;
  };

  const buildDiscountRulesForSession = (session) => {
    const rules = [];
    const dd = session?.durationDiscount;
    if (dd && dd.enabled === true) {
      const intervalMinutes = toSafeInt(dd.intervalMinutes, 0);
      const discountAmount = toSafeInt(dd.discountAmount, 0);
      if (intervalMinutes > 0 && discountAmount > 0) {
        rules.push({
          id: `disc-${session.id}-duration`,
          name: 'Diskon Durasi',
          mode: DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK,
          intervalMinutes,
          minimumDurationMinutes: 0,
          discountAmount,
          isActive: true,
        });
      }
    }

    for (const disc of sortedDiscounts) {
      if (!disc || String(disc.sessionTypeId || '').trim() !== session.id) continue;
      const minDur = toSafeInt(disc.minimumDurationMinutes, 0);
      const amt = toSafeInt(disc.discountAmount, 0);
      if (minDur <= 0 || amt <= 0) continue;
      rules.push({
        id: String(disc.id || `disc-${session.id}-${rules.length + 1}`).trim(),
        name: String(disc.name || 'Promo Diskon').trim(),
        mode: DISCOUNT_RULE_MODES.MINIMUM_DURATION,
        intervalMinutes: 0,
        minimumDurationMinutes: minDur,
        discountAmount: amt,
        isActive: disc.isActive !== false,
      });
    }

    return rules;
  };

  const mapPackageToOption = (pkg, sortOrder) => {
    const basePrice = toSafeInt(pkg.basePrice ?? pkg.subtotal, 0);
    const discountAmount = Math.min(basePrice, toSafeInt(pkg.discountAmount, 0));
    const staffAmount = toSafeInt(pkg.staffCommissionAmount, 0);
    const operatorAmount = toSafeInt(pkg.recordingOperatorCommissionAmount, 0);

    return {
      id: claimUniqueOptionId(pkg.id, 'pkg'),
      name: String(pkg.name || pkg.label || 'Paket Studio').trim(),
      description: String(pkg.detail ?? pkg.description ?? '').trim(),
      isActive: pkg.isActive !== false,
      sortOrder,
      pricing: {
        mode: PRICING_MODES.FIXED_SHIFT,
        hourlyRate: null,
        durationMinutes: Math.max(30, toSafeInt(pkg.durationMinutes, 180)),
        basePrice,
        discountAmount,
        projectPrice: null,
        unitLabel: '',
      },
      discountRules: [],
      fees: {
        staff: {
          mode: staffAmount > 0 ? FEE_MODES.FIXED : FEE_MODES.NONE,
          amount: staffAmount,
        },
        owner: { mode: FEE_MODES.NONE, amount: 0 },
        recordingOperator: {
          mode: operatorAmount > 0 ? FEE_MODES.FIXED : FEE_MODES.NONE,
          amount: operatorAmount,
        },
      },
    };
  };

  const serviceTypes = [];

  sortedSessions.forEach((session, svcIdx) => {
    if (!session || !session.id) return;
    const serviceId = String(session.id).trim();
    const serviceName = String(session.name || session.label || serviceId).trim();
    const isWfa = serviceId === 'mixing' || serviceId === 'mastering';
    const deliveryMode = isWfa ? DELIVERY_MODES.WFA : DELIVERY_MODES.STUDIO;
    const options = [];
    const sessionDiscountRules = buildDiscountRulesForSession(session);
    const sessionPackages = sortedPackages.filter(
      (pkg) => pkg && String(pkg.sessionTypeId || '').trim() === serviceId,
    );

    if (serviceId === 'recording') {
      // 1. Preserve all V1 recordingTypes (hourly and fixed shift)
      sortedRecordings.forEach((rec, recIdx) => {
        if (!rec) return;
        const isFixed = rec.priceMode === 'fixed';
        const rawRecId = String(rec.id || '').trim();
        const rawRecName = String(rec.name || rec.label || 'Recording Option').trim();
        const displayName =
          rawRecId === 'live-recording-3h' && rawRecName === 'Live Recording Session'
            ? 'Live'
            : rawRecName;

        options.push({
          id: claimUniqueOptionId(rawRecId, 'rec'),
          name: displayName,
          description: String(rec.description || '').trim(),
          isActive: rec.isActive !== false,
          sortOrder: recIdx + 1,
          pricing: isFixed
            ? {
                mode: PRICING_MODES.FIXED_SHIFT,
                hourlyRate: null,
                durationMinutes: Math.max(30, toSafeInt(rec.durationMinutes, 180)),
                basePrice: toSafeInt(rec.price, 0),
                discountAmount: 0,
                projectPrice: null,
                unitLabel: '',
              }
            : {
                mode: PRICING_MODES.HOURLY,
                hourlyRate: toSafeInt(rec.price ?? session.hourlyRate, 150000),
                durationMinutes: null,
                basePrice: null,
                discountAmount: 0,
                projectPrice: null,
                unitLabel: '',
              },
          discountRules: isFixed ? [] : sessionDiscountRules.map((rule) => ({ ...rule })),
          fees: {
            staff: { mode: FEE_MODES.NONE, amount: 0 },
            owner: { mode: FEE_MODES.NONE, amount: 0 },
            recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
          },
        });
      });

      // If V1 had no recordingTypes at all, preserve Recording's hourly rate as Tracking Reguler
      if (options.length === 0) {
        options.push({
          id: claimUniqueOptionId('tracking-regular', 'rec'),
          name: 'Tracking Reguler',
          description: String(session.description || '').trim(),
          isActive: session.isActive !== false,
          sortOrder: 1,
          pricing: {
            mode: PRICING_MODES.HOURLY,
            hourlyRate: toSafeInt(session.hourlyRate, 150000),
            durationMinutes: null,
            basePrice: null,
            discountAmount: 0,
            projectPrice: null,
            unitLabel: '',
          },
          discountRules: sessionDiscountRules.map((rule) => ({ ...rule })),
          fees: {
            staff: { mode: FEE_MODES.NONE, amount: 0 },
            owner: { mode: FEE_MODES.NONE, amount: 0 },
            recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
          },
        });
      }

      // 2. Preserve any V1 packages linked to recording
      sessionPackages.forEach((pkg) => {
        options.push(mapPackageToOption(pkg, options.length + 1));
      });

      // 3. Ensure new V2 Recording catalog presets exist (unconfigured drafts + manual Others)
      for (const presetId of ['rec-lite', 'rec-pro', 'rec-drum-only', 'rec-others']) {
        if (!options.some((opt) => opt.id === presetId)) {
          const preset = getDefaultDraftOptionById('recording', presetId);
          if (preset) {
            preset.id = claimUniqueOptionId(preset.id, 'rec');
            preset.sortOrder = options.length + 1;
            options.push(preset);
          }
        }
      }
    } else {
      // 1. Primary regular hourly option preserving existing hourlyRate & discount rules
      const regularId = claimUniqueOptionId(`${serviceId}-regular`, serviceId);
      options.push({
        id: regularId,
        name: serviceId === 'rehearsal' ? 'Reguler' : `${serviceName} Reguler`,
        description: String(session.description || '').trim(),
        isActive: session.isActive !== false,
        sortOrder: 1,
        pricing: {
          mode: PRICING_MODES.HOURLY,
          hourlyRate: toSafeInt(session.hourlyRate, 0),
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: sessionDiscountRules.map((rule) => ({ ...rule })),
        fees: {
          staff:
            serviceId === 'rehearsal'
              ? { mode: FEE_MODES.HOURLY, amount: rehearsalHourlyStaffFee }
              : { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      });

      // 2. Preserve all V1 packages belonging to this serviceType (e.g. pkg-rehearsal-3h, pkg-rehearsal-5h)
      sessionPackages.forEach((pkg) => {
        options.push(mapPackageToOption(pkg, options.length + 1));
      });

      // 3. For rehearsal, ensure Paket 6 Hours draft exists if not already present
      if (serviceId === 'rehearsal' && !options.some((opt) => opt.id === 'rehearsal-pkg-6h')) {
        const pkg6h = getDefaultDraftOptionById('rehearsal', 'rehearsal-pkg-6h');
        if (pkg6h) {
          pkg6h.id = claimUniqueOptionId(pkg6h.id, 'rehearsal');
          pkg6h.sortOrder = options.length + 1;
          options.push(pkg6h);
        }
      }
    }

    serviceTypes.push({
      id: serviceId,
      name: serviceName,
      description: String(session.description || '').trim(),
      deliveryMode,
      isActive: session.isActive !== false,
      sortOrder: toSafeInt(session.sortOrder, svcIdx + 1) || svcIdx + 1,
      options: options.map((opt, idx) => ({ ...opt, sortOrder: idx + 1 })),
    });
  });

  // Fallback if V1 document had an empty sessionTypes array
  if (serviceTypes.length === 0) {
    return migratePricingSettingsV1ToV2(null);
  }

  return {
    schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
    serviceTypes,
    operationalSettings: {
      dailyMealAllowancePerStaff: dailyMealAllowance,
    },
    version: toSafeInt(rawV1.version, 0),
    updatedAt: rawV1.updatedAt ?? null,
    updatedByUid: String(rawV1.updatedByUid || ''),
  };
}
