export const BOOKING_POLICIES_COLLECTION = 'settings';
export const BOOKING_POLICIES_DOC_ID = 'bookingPolicies';
export const BOOKING_POLICIES_SCHEMA_VERSION = 1;

export const DEPOSIT_POLICY_TYPES = Object.freeze(['none', 'fixed', 'percentage']);
export const DEPOSIT_CALCULATION_BASES = Object.freeze(['total_amount', 'subtotal']);
export const BALANCE_DUE_TRIGGERS = Object.freeze([
  'before_session',
  'at_check_in',
  'before_delivery',
]);

export const DEFAULT_BOOKING_POLICIES = Object.freeze({
  schemaVersion: BOOKING_POLICIES_SCHEMA_VERSION,
  defaultDepositPolicy: Object.freeze({
    type: 'none',
    fixedAmount: 0,
    percentage: 0,
    calculationBase: 'total_amount',
  }),
  defaultHoldPolicy: Object.freeze({
    defaultHours: 24,
    minMinutesBeforeSessionStart: 60,
    allowPerBookingOverride: true,
  }),
  defaultBalanceDuePolicy: Object.freeze({
    trigger: 'before_session',
    offsetHoursBeforeStart: 0,
  }),
  serviceOverrides: Object.freeze({}),
  optionOverrides: Object.freeze({}),
  version: 0,
  updatedAt: null,
  updatedByUid: '',
});
