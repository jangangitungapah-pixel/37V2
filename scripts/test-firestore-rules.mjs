import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const PROJECT_ID = 'demo-studio37-rules';
const EMULATOR_HOST = '127.0.0.1:8088';
const DB_ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`;
const REST_BASE = `http://${EMULATOR_HOST}/v1/${DB_ROOT}`;
const CLEAR_URL = `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function base64Url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function makeEmulatorJwt(uid, email, { signInProvider = 'password', emailVerified = true } = {}) {
  const header = base64Url({ alg: 'none', typ: 'JWT' });
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = base64Url({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    auth_time: nowSec,
    user_id: uid,
    sub: uid,
    iat: nowSec,
    exp: nowSec + 3600,
    email,
    email_verified: emailVerified,
    firebase: {
      identities: { email: [email] },
      sign_in_provider: signInProvider,
    },
  });
  return `${header}.${payload}.`;
}

function toFsValue(val) {
  if (val === null) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (val && typeof val === 'object' && val._ts) return { timestampValue: val._ts };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFsValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFsValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFsFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) {
      fields[k] = toFsValue(v);
    }
  }
  return fields;
}

const TOKEN_OWNER = makeEmulatorJwt('owner-1', 'owner@37music.id');
const TOKEN_STAFF = makeEmulatorJwt('staff-1', 'staff@37music.id');
const TOKEN_INACTIVE_OWNER = makeEmulatorJwt('inactive-owner-1', 'inactive@37music.id');
const TOKEN_GOOGLE_OWNER = makeEmulatorJwt('owner-1', 'owner@37music.id', {
  signInProvider: 'google.com',
  emailVerified: true,
});
const TOKEN_GOOGLE_STAFF = makeEmulatorJwt('staff-1', 'staff@37music.id', {
  signInProvider: 'google.com',
  emailVerified: true,
});
const TOKEN_CLIENT_MATCHED = makeEmulatorJwt('client-matched-1', 'matched@gmail.com', {
  signInProvider: 'google.com',
  emailVerified: true,
});
const TOKEN_CLIENT_NEW = makeEmulatorJwt('client-new-1', 'newclient@gmail.com', {
  signInProvider: 'google.com',
  emailVerified: true,
});
const TOKEN_CLIENT_ATTACKER = makeEmulatorJwt('client-attacker-1', 'attacker@gmail.com', {
  signInProvider: 'google.com',
  emailVerified: true,
});
const TOKEN_CLIENT_AMBIGUOUS = makeEmulatorJwt('client-ambig-1', 'shared@gmail.com', {
  signInProvider: 'google.com',
  emailVerified: true,
});
const TOKEN_CLIENT_UNVERIFIED = makeEmulatorJwt('client-unverified-1', 'unverified@gmail.com', {
  signInProvider: 'google.com',
  emailVerified: false,
});
const TOKEN_CLIENT_PASSWORD = makeEmulatorJwt('client-password-1', 'pwuser@gmail.com', {
  signInProvider: 'password',
  emailVerified: true,
});
const SERVER_TS = { _ts: new Date('2026-11-22T10:00:00.000Z').toISOString() };

async function clearDb() {
  const res = await fetch(CLEAR_URL, { method: 'DELETE' });
  assert.equal(res.status, 200, `Failed clearing emulator DB: ${res.status}`);
}

async function adminSetDoc(docPath, data) {
  const res = await fetch(`${REST_BASE}/${docPath}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify({ fields: toFsFields(data) }),
  });
  const text = await res.text();
  assert.equal(res.status, 200, `Admin seed ${docPath} failed (${res.status}): ${text}`);
}

async function userRequest(method, urlSuffix, token = null, bodyObj = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${REST_BASE}${urlSuffix}`, {
    method,
    headers,
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = { raw };
  }
  return { status: res.status, ok: res.ok, body: json };
}

async function seedProfilesAndConfig() {
  await adminSetDoc('staffProfiles/owner-1', {
    displayName: 'Studio Owner',
    email: 'owner@37music.id',
    role: 'owner',
    active: true,
    createdAt: SERVER_TS,
  });
  await adminSetDoc('staffProfiles/staff-1', {
    displayName: 'Studio Staff',
    email: 'staff@37music.id',
    role: 'staff',
    active: true,
    createdAt: SERVER_TS,
  });
  await adminSetDoc('staffProfiles/inactive-owner-1', {
    displayName: 'Inactive Owner',
    email: 'inactive@37music.id',
    role: 'owner',
    active: false,
    createdAt: SERVER_TS,
  });
  await adminSetDoc('settings/studioProfile', {
    schemaVersion: 1,
    studioName: '37 Music Studio',
    tagline: 'Studio Musik',
    whatsappNumber: '+6281234567890',
    email: 'info@37music.id',
    address: 'Jl. Studio 37',
    city: 'Jakarta',
    mapsUrl: '',
    version: 1,
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
  });
  await adminSetDoc('settings/pricing', {
    schemaVersion: 2,
    serviceTypes: [{ id: 'rehearsal', name: 'Rehearsal' }],
    operationalSettings: { dailyMealAllowancePerStaff: 25000 },
    version: 1,
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
  });
  await adminSetDoc('bookkeepingSettings/default', {
    openingCashBalance: 1000000,
    openingBalanceAsOf: '2026-11-01',
    openingBalanceNote: 'Saldo awal',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
  });
  await adminSetDoc('publicSiteSettings/site', {
    schemaVersion: 1,
    studioName: '37 Music Studio',
    tagline: 'Loud Rooms',
    publicWhatsappNumber: '+6281234567890',
    publicEmail: 'info@37music.id',
    publicAddress: 'Jl. Studio 37',
    city: 'Jakarta',
    mapsUrl: '',
    operatingHours: '10:00 - 23:00 WIB',
    publishedServices: [{ id: 'rehearsal' }],
    publishedRooms: [{ id: 'room-a' }],
    socialLinks: [],
    verifiedTestimonials: [],
    seoTitle: '37 Music Studio',
    seoDescription: 'Studio latihan & rekaman profesional.',
    isPublished: true,
    updatedAt: SERVER_TS,
  });
  await adminSetDoc('bookingRequestMessageTemplates/tpl_1', {
    schemaVersion: 1,
    label: 'Initial Greeting',
    category: 'initial_response',
    description: 'Greeting template',
    body: 'Halo {{customerName}}!',
    allowedVariables: ['customerName'],
    requiredVariables: ['customerName'],
    requiresConfirmedBooking: false,
    isActive: true,
    isBuiltIn: true,
    sortOrder: 1,
    version: 1,
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
  });
  await adminSetDoc('galleryItems/gal_1', {
    schemaVersion: 1,
    title: 'Live Room A',
    category: 'Rooms',
    altText: 'Room A inside studio',
    caption: 'Room A photo',
    cloudinaryPublicId: '37music/gal_1',
    cloudinaryAssetId: 'asset_1',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/gal_1.jpg',
    resourceType: 'image',
    format: 'jpg',
    width: 1200,
    height: 800,
    bytes: 200000,
    status: 'published',
    sortOrder: 100,
    uploadedAt: SERVER_TS,
    uploadedByUid: 'owner-1',
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
    version: 1,
  });
  await adminSetDoc('landingPagePlacements/room-a', {
    schemaVersion: 1,
    placementId: 'room-a',
    sourceGalleryItemId: 'gal_1',
    cloudinaryPublicId: '37music/gal_1',
    cloudinaryAssetId: 'asset_1',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/gal_1.jpg',
    resourceType: 'image',
    format: 'jpg',
    width: 1200,
    height: 800,
    bytes: 200000,
    altText: 'Room A studio banner',
    copy: {
      sticker: 'LIVE ROOM',
      name: 'Room A',
      capacityLabel: 'Up to 6 players',
      tags: ['Backline'],
      ctaLabel: 'Book Room A',
    },
    status: 'published',
    version: 1,
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
  });
  await adminSetDoc('publicAvailabilityMetadata/status', {
    schemaVersion: 1,
    isReady: true,
    backfilledFromDate: '2026-11-22',
    backfillCompletedAt: SERVER_TS,
    updatedAt: SERVER_TS,
  });
}

async function seedOperationalSampleData() {
  await adminSetDoc('bookings/bkg_1', {
    customerId: 'cust_1',
    customerName: 'Raka',
    phone: '081234567890',
    phoneNormalized: '+6281234567890',
    bandName: 'Noise',
    studioId: 'room-a',
    serviceId: 'rehearsal',
    serviceLabel: 'Rehearsal',
    packageId: '',
    packageLabel: '',
    recordingTypeId: '',
    recordingTypeLabel: '',
    date: '2026-11-25',
    startMinute: 600,
    durationMinutes: 60,
    endMinute: 660,
    timeZone: 'Asia/Jakarta',
    unitRate: 100000,
    subtotal: 100000,
    discountAmount: 0,
    totalAmount: 100000,
    initialPaymentStatus: 'unpaid',
    initialPaidAmount: 0,
    paymentMethod: 'cash',
    sessionStatus: 'upcoming',
    notes: '',
    version: 1,
    createdByUid: 'owner-1',
    updatedByUid: 'owner-1',
  });
  await adminSetDoc('bookingSlots/2026-11-25__room-a__600', {
    bookingId: 'bkg_1',
    date: '2026-11-25',
    studioId: 'room-a',
    slotStartMinute: 600,
    createdAt: SERVER_TS,
  });
  await adminSetDoc('bookingEvents/evt_1', {
    bookingId: 'bkg_1',
    eventType: 'created',
    actorUid: 'owner-1',
    createdAt: SERVER_TS,
  });
  await adminSetDoc('customers/cust_1', {
    displayName: 'Raka',
    normalizedName: 'raka',
    phoneDisplay: '+62 812-3456-7890',
    phoneNormalized: '+6281234567890',
    nameAliases: [],
    previousPhones: [],
    status: 'active',
    mergedIntoCustomerId: null,
    historyCustomerIds: ['cust_1'],
    bookingCount: 1,
    firstBookingDate: '2026-11-25',
    lastBookingDate: '2026-11-25',
    notes: '',
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
    version: 1,
  });
  await adminSetDoc('customerPhoneIndex/hash_1', {
    phoneNormalized: '+6281234567890',
    activeCustomerIds: ['cust_1'],
    historicalCustomerIds: ['cust_1'],
    version: 1,
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
  });
  await adminSetDoc('invoices/inv_bkg_1', {
    invoiceNumber: '37MS-20261125-ABCDEF123456',
    bookingId: 'bkg_1',
    customerId: 'cust_1',
    invoiceStatus: 'issued',
    currency: 'IDR',
    amountPaid: 0,
    balanceDue: 100000,
    paymentStatus: 'unpaid',
    createdByUid: 'owner-1',
    updatedByUid: 'owner-1',
    version: 1,
  });
  await adminSetDoc('paymentTransactions/pay_1', {
    invoiceId: 'inv_bkg_1',
    bookingId: 'bkg_1',
    customerId: 'cust_1',
    transactionType: 'payment',
    amount: 50000,
    recordedByUid: 'owner-1',
  });
  await adminSetDoc('paymentEvidence/ev_reset_1', {
    schemaVersion: 1,
    invoiceId: 'inv_bkg_1',
    invoiceNumber: '37MS-20261125-ABCDEF123456',
    bookingId: 'bkg_1',
    customerId: 'cust_1',
    clientUid: '',
    evidenceSource: 'admin_manual',
    status: 'attached',
    claimedAmount: 50000,
    paymentMethod: 'cash',
    claimedPaidAt: '2026-11-25',
    referenceNumber: '',
    evidence: {
      provider: 'cloudinary',
      cloudName: 'demo37',
      cloudinaryPublicId: 'payment-evidence/pe_reset1',
      cloudinaryAssetId: 'asset_reset1',
      secureUrl: 'https://res.cloudinary.com/demo37/image/upload/v1/payment-evidence/pe_reset1.jpg',
      resourceType: 'image',
      format: 'jpg',
      width: 800,
      height: 1200,
      bytes: 120000,
    },
    submittedByUid: 'owner-1',
    submittedAt: SERVER_TS,
    reviewedAt: null,
    reviewedByUid: '',
    rejectionReason: '',
    verifiedAmount: 50000,
    linkedTransactionId: 'pay_1',
    createdAt: SERVER_TS,
    updatedAt: SERVER_TS,
    version: 1,
  });
  await adminSetDoc('commissionBatches/cb_1', {
    status: 'posted',
    postedByUid: 'owner-1',
    createdByUid: 'owner-1',
  });
  await adminSetDoc('commissionPostingItems/bkg_1', {
    bookingId: 'bkg_1',
    batchId: 'cb_1',
    status: 'posted',
  });
  await adminSetDoc('commissionReviewResolutions/res_1', {
    bookingId: 'bkg_1',
    status: 'dismissed_no_commission',
  });
  await adminSetDoc('bookkeepingEntries/bk_1', {
    sourceModule: 'bookkeeping',
    sourceType: 'manual',
    amount: 50000,
  });
  await adminSetDoc('bookkeepingSettlements/set_1', {
    entryId: 'bk_1',
    amount: 50000,
  });
  await adminSetDoc('inventoryItems/item_1', {
    itemCode: 'STR-01',
    name: 'Guitar Strings',
    isActive: true,
    version: 1,
  });
  await adminSetDoc('inventoryMovements/mov_1', {
    itemId: 'item_1',
    movementType: 'opening_stock',
  });
  await adminSetDoc('publicAvailability/bkg_1', {
    schemaVersion: 1,
    date: '2026-11-25',
    studioId: 'room-a',
    startMinute: 600,
    endMinute: 660,
    updatedAt: SERVER_TS,
  });
  await adminSetDoc('publicBookingRequests/req_1', {
    schemaVersion: 1,
    requestReference: 'REQ-12345678',
    requestType: 'studio_booking',
    status: 'new',
    customerName: 'Raka',
    contactPhone: '+6281234567890',
    publicServiceId: 'rehearsal',
    requestedRoomId: 'room-a',
    preferredDate: '2026-11-25',
    preferredStartMinute: 600,
    preferredDurationMinutes: 120,
    notes: 'Test note',
    privacyConsent: true,
    consentVersion: 'v1',
    source: 'public_landing_page',
    version: 1,
  });
  await adminSetDoc('publicBookingRequests/req_1/communications/comm_1', {
    eventType: 'staff_note_added',
    messageBodySnapshot: 'Note 1',
  });
  await adminSetDoc('publicBookingRequests/req_1/activities/act_1', {
    eventType: 'request_created',
    note: 'Created',
  });
}

function makeResetOpWrite(fieldsPatch, isCreate = false) {
  return {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/systemOperations/factoryReset`,
          fields: toFsFields(fieldsPatch),
        },
        currentDocument: { exists: !isCreate },
        updateTransforms: [
          ...(isCreate ? [{ fieldPath: 'initiatedAt', setToServerValue: 'REQUEST_TIME' }] : []),
          ...(isCreate ? [{ fieldPath: 'startedAt', setToServerValue: 'REQUEST_TIME' }] : []),
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ...(fieldsPatch.status === 'completed'
            ? [{ fieldPath: 'completedAt', setToServerValue: 'REQUEST_TIME' }]
            : []),
        ],
      },
    ],
  };
}

async function runTests() {
  await clearDb();
  await seedProfilesAndConfig();
  await seedOperationalSampleData();

  const operationalDeletePaths = [
    'bookings/bkg_1',
    'bookingSlots/2026-11-25__room-a__600',
    'bookingEvents/evt_1',
    'customers/cust_1',
    'customerPhoneIndex/hash_1',
    'invoices/inv_bkg_1',
    'paymentEvidence/ev_reset_1',
    'paymentTransactions/pay_1',
    'commissionBatches/cb_1',
    'commissionPostingItems/bkg_1',
    'commissionReviewResolutions/res_1',
    'bookkeepingEntries/bk_1',
    'bookkeepingSettlements/set_1',
    'inventoryItems/item_1',
    'inventoryMovements/mov_1',
    'publicAvailability/bkg_1',
    'reviewInvitations/' + createHash('sha256').update('factory-reset-test-token-1').digest('hex'),
    'reviewInvitationIndexes/bkg_1',
    'publicBookingRequests/req_1/communications/comm_1',
    'publicBookingRequests/req_1/activities/act_1',
    'publicBookingRequests/req_1',
  ];

  const preservedDeletePaths = [
    'staffProfiles/owner-1',
    'staffProfiles/staff-1',
    'settings/studioProfile',
    'settings/pricing',
    'bookkeepingSettings/default',
    'publicSiteSettings/site',
    'publicPricingCatalog/current',
    'bookingRequestMessageTemplates/tpl_1',
    'galleryItems/gal_1',
    'landingPagePlacements/room-a',
    'publicAvailabilityMetadata/status',
    'customerReviews/bkg_completed_review',
    'publicReviewStats/summary',
  ];

  // 1. IDLE STATE: Unauthenticated, Staff, and Owner must ALL be DENIED deleting protected operational collections
  for (const p of [
    'bookings/bkg_1',
    'customers/cust_1',
    'invoices/inv_bkg_1',
    'paymentEvidence/ev_reset_1',
    'publicBookingRequests/req_1',
  ]) {
    assert.equal((await userRequest('DELETE', `/${p}`, null)).status, 403, `anon delete ${p}`);
    assert.equal(
      (await userRequest('DELETE', `/${p}`, TOKEN_STAFF)).status,
      403,
      `staff delete ${p}`,
    );
    assert.equal(
      (await userRequest('DELETE', `/${p}`, TOKEN_OWNER)).status,
      403,
      `owner idle delete ${p}`,
    );
  }
  console.log('✓ Matrix IDLE denials passed');

  // 2. Test normal multi-document 6-hour createBooking + bookingRequest atomic transaction when RESET IS IDLE
  //    Verifies that adding !isFactoryResetLocked() NEVER exceeds the 20-call Firestore transaction budget!
  const slotWrites = Array.from({ length: 12 }, (_, idx) => {
    const slotMin = 600 + idx * 30;
    return {
      update: {
        name: `${DB_ROOT}/bookingSlots/2026-11-26__room-a__${slotMin}`,
        fields: toFsFields({
          bookingId: 'bkg_tx_6h',
          date: '2026-11-26',
          studioId: 'room-a',
          slotStartMinute: slotMin,
          createdAt: SERVER_TS,
        }),
      },
      currentDocument: { exists: false },
    };
  });
  const heavyTxRes = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customers/cust_tx_new`,
          fields: toFsFields({
            displayName: 'New Tx Band',
            normalizedName: 'new tx band',
            phoneDisplay: '+62 813-1111-2222',
            phoneNormalized: '+6281311112222',
            nameAliases: [],
            previousPhones: [],
            status: 'active',
            mergedIntoCustomerId: null,
            historyCustomerIds: ['cust_tx_new'],
            bookingCount: 1,
            firstBookingDate: '2026-11-26',
            lastBookingDate: '2026-11-26',
            notes: '',
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/customerPhoneIndex/hash_tx_new`,
          fields: toFsFields({
            phoneNormalized: '+6281311112222',
            activeCustomerIds: ['cust_tx_new'],
            historicalCustomerIds: [],
            version: 1,
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/bookings/bkg_tx_6h`,
          fields: toFsFields({
            customerId: 'cust_tx_new',
            customerName: 'New Tx Band',
            phone: '081311112222',
            phoneNormalized: '+6281311112222',
            bandName: 'Band 6H',
            studioId: 'room-a',
            serviceTypeId: 'rehearsal',
            serviceTypeName: 'Rehearsal',
            serviceOptionId: 'rehearsal-regular',
            serviceOptionName: 'Reguler',
            deliveryMode: 'studio',
            pricingMode: 'hourly',
            pricingSettingsVersion: 1,
            serviceId: 'rehearsal',
            serviceLabel: 'Rehearsal',
            packageId: '',
            packageLabel: '',
            recordingTypeId: '',
            recordingTypeLabel: '',
            date: '2026-11-26',
            startMinute: 600,
            durationMinutes: 360,
            endMinute: 960,
            timeZone: 'Asia/Jakarta',
            unitRate: 100000,
            subtotal: 600000,
            discountAmount: 0,
            totalAmount: 600000,
            automaticDiscount: null,
            commissionSnapshot: null,
            initialPaymentStatus: 'partial',
            initialPaidAmount: 100000,
            paymentMethod: 'cash',
            sessionStatus: 'upcoming',
            notes: '',
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_tx_6h`,
          fields: toFsFields({
            invoiceNumber: '37MS-20261126-ABCDEF123457',
            bookingId: 'bkg_tx_6h',
            customerId: 'cust_tx_new',
            invoiceStatus: 'issued',
            currency: 'IDR',
            customerSnapshot: { name: 'New Tx Band', phone: '081311112222', bandName: 'Band 6H' },
            bookingSnapshot: {
              serviceTypeName: 'Rehearsal',
              serviceOptionName: 'Reguler',
              studioId: 'room-a',
              bookingDate: '2026-11-26',
              startMinute: 600,
              endMinute: 960,
              durationMinutes: 360,
            },
            financialSnapshot: { subtotal: 600000, discountAmount: 0, totalAmount: 600000 },
            amountPaid: 100000,
            balanceDue: 500000,
            paymentStatus: 'partial',
            invoiceDate: SERVER_TS,
            dueDate: '2026-11-26',
            lastPaymentTransactionId: 'pay_init_bkg_tx_6h',
            voidReason: '',
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_init_bkg_tx_6h`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_tx_6h',
            invoiceNumber: '37MS-20261126-ABCDEF123457',
            bookingId: 'bkg_tx_6h',
            customerId: 'cust_tx_new',
            transactionType: 'payment',
            amount: 100000,
            currency: 'IDR',
            paymentMethod: 'cash',
            receivedAt: SERVER_TS,
            referenceNumber: '',
            notes: 'Initial DP',
            source: 'booking_initial_payment',
            reversalOfTransactionId: null,
            recordedByUid: 'staff-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/bookingEvents/evt_tx_6h`,
          fields: toFsFields({
            bookingId: 'bkg_tx_6h',
            eventType: 'created',
            actorUid: 'staff-1',
            createdAt: SERVER_TS,
            previousValue: null,
            newValue: { status: 'upcoming' },
            note: 'Created',
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/publicAvailability/bkg_tx_6h`,
          fields: toFsFields({
            schemaVersion: 1,
            date: '2026-11-26',
            studioId: 'room-a',
            startMinute: 600,
            endMinute: 960,
            updatedAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
      ...slotWrites,
    ],
  });
  assert.equal(
    heavyTxRes.status,
    200,
    `Heavy 6h Staff createBooking commit should succeed without exceeding rule call budget: ${JSON.stringify(heavyTxRes.body)}`,
  );
  console.log('✓ Normal 6h multi-document Staff booking transaction passed under call budget');

  // 2b. customerPhoneIndex list access (Owner allowed, Staff & Unauthenticated denied)
  assert.equal(
    (await userRequest('GET', '/customerPhoneIndex', TOKEN_OWNER)).status,
    200,
    'Active Owner can list customerPhoneIndex',
  );
  assert.equal(
    (await userRequest('GET', '/customerPhoneIndex', TOKEN_STAFF)).status,
    403,
    'Staff denied listing customerPhoneIndex',
  );
  assert.equal(
    (await userRequest('GET', '/customerPhoneIndex', null)).status,
    403,
    'Unauthenticated visitor denied listing customerPhoneIndex',
  );
  console.log('✓ customerPhoneIndex list RBAC (Owner vs Staff vs Unauth) passed');

  // 2B. CUSTOMER REVIEW MANAGEMENT SECURITY RULES (Section 22.6)
  // Seed a completed studio booking & operational invitation for later reset tests
  await adminSetDoc('bookings/bkg_completed_review', {
    customerId: 'cust_1',
    customerName: 'Nadia Pratama',
    phone: '081234567890',
    phoneNormalized: '+6281234567890',
    studioId: 'room-a',
    serviceId: 'rehearsal',
    serviceTypeName: 'Rehearsal Band',
    serviceLabel: 'Rehearsal',
    deliveryMode: 'studio',
    date: '2026-11-20',
    startMinute: 600,
    durationMinutes: 120,
    endMinute: 720,
    timeZone: 'Asia/Jakarta',
    totalAmount: 200000,
    initialPaymentStatus: 'paid',
    initialPaidAmount: 200000,
    sessionStatus: 'completed',
    actualCompletedAt: SERVER_TS,
    notes: '',
    version: 2,
    createdByUid: 'owner-1',
    updatedByUid: 'owner-1',
  });

  const resetInvHash = createHash('sha256').update('factory-reset-test-token-1').digest('hex');
  await adminSetDoc(`reviewInvitations/${resetInvHash}`, {
    schemaVersion: 1,
    bookingId: 'bkg_1',
    serviceLabelSnapshot: 'Rehearsal',
    sessionDate: '2026-11-25',
    studioId: 'room-a',
    status: 'active',
    issuedByUid: 'owner-1',
    issuedAt: SERVER_TS,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    submittedAt: null,
    revokedAt: null,
    revokedByUid: '',
    version: 1,
  });
  await adminSetDoc('reviewInvitationIndexes/bkg_1', {
    schemaVersion: 1,
    bookingId: 'bkg_1',
    activeInvitationId: resetInvHash,
    issuedAt: SERVER_TS,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    version: 1,
  });

  const validHashA = createHash('sha256').update('valid-customer-token-alpha-37').digest('hex');
  const validHashB = createHash('sha256').update('valid-customer-token-beta-37').digest('hex');
  const expiredHash = createHash('sha256').update('expired-customer-token-37').digest('hex');
  const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Unauthenticated cannot list reviewInvitations, reviewInvitationIndexes, or publicReviewStats
  assert.equal(
    (
      await userRequest('POST', ':runQuery', null, {
        structuredQuery: { from: [{ collectionId: 'reviewInvitations' }] },
      })
    ).status,
    403,
    'Public cannot list reviewInvitations',
  );
  assert.equal(
    (
      await userRequest('POST', ':runQuery', null, {
        structuredQuery: { from: [{ collectionId: 'reviewInvitationIndexes' }] },
      })
    ).status,
    403,
    'Public cannot list reviewInvitationIndexes',
  );
  assert.equal(
    (
      await userRequest('POST', ':runQuery', null, {
        structuredQuery: { from: [{ collectionId: 'publicReviewStats' }] },
      })
    ).status,
    403,
    'Public cannot list publicReviewStats',
  );

  // Staff CANNOT issue review invitation for an UPCOMING / uncompleted booking (bkg_1)
  const upcomingInvAttempt = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/reviewInvitations/${validHashA}`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_1',
            serviceLabelSnapshot: 'Rehearsal',
            sessionDate: '2026-11-25',
            studioId: 'room-a',
            status: 'active',
            issuedByUid: 'staff-1',
            expiresAt: futureExpiry,
            submittedAt: null,
            revokedAt: null,
            revokedByUid: '',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: 'issuedAt', setToServerValue: 'REQUEST_TIME' }],
      },
      {
        update: {
          name: `${DB_ROOT}/reviewInvitationIndexes/bkg_1`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_1',
            activeInvitationId: validHashA,
            expiresAt: futureExpiry,
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'issuedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(upcomingInvAttempt.status, 403, 'Cannot issue invitation for non-completed booking');

  // Staff CAN atomically issue invitation + index for a COMPLETED studio booking
  const completedInvCreate = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/reviewInvitations/${validHashA}`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_completed_review',
            serviceLabelSnapshot: 'Rehearsal Band',
            sessionDate: '2026-11-20',
            studioId: 'room-a',
            status: 'active',
            issuedByUid: 'staff-1',
            expiresAt: futureExpiry,
            submittedAt: null,
            revokedAt: null,
            revokedByUid: '',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: 'issuedAt', setToServerValue: 'REQUEST_TIME' }],
      },
      {
        update: {
          name: `${DB_ROOT}/reviewInvitationIndexes/bkg_completed_review`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_completed_review',
            activeInvitationId: validHashA,
            expiresAt: futureExpiry,
            version: 1,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: 'issuedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(
    completedInvCreate.status,
    200,
    `Staff should create invitation for completed booking: ${JSON.stringify(completedInvCreate.body)}`,
  );

  // Public CAN GET active invitation by exact hash, CANNOT GET non-existent hash
  assert.equal(
    (await userRequest('GET', `/reviewInvitations/${validHashA}`, null)).status,
    200,
    'Public can GET active unexpired invitation',
  );
  assert.equal(
    (await userRequest('GET', `/reviewInvitations/${'f'.repeat(64)}`, null)).status,
    403,
    'Public gets 403 for non-existent invitation hash',
  );

  // Seed expired invitation directly and verify Public GET is denied (403)
  await adminSetDoc(`reviewInvitations/${expiredHash}`, {
    schemaVersion: 1,
    bookingId: 'bkg_completed_review',
    serviceLabelSnapshot: 'Rehearsal Band',
    sessionDate: '2026-11-20',
    studioId: 'room-a',
    status: 'active',
    issuedByUid: 'staff-1',
    issuedAt: SERVER_TS,
    expiresAt: new Date(Date.now() - 86400 * 1000),
    submittedAt: null,
    revokedAt: null,
    revokedByUid: '',
    version: 1,
  });
  assert.equal(
    (await userRequest('GET', `/reviewInvitations/${expiredHash}`, null)).status,
    403,
    'Public gets 403 for expired invitation',
  );

  // Staff CAN revoke validHashA while rotating to validHashB
  const rotateInvRes = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/reviewInvitations/${validHashA}`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_completed_review',
            serviceLabelSnapshot: 'Rehearsal Band',
            sessionDate: '2026-11-20',
            studioId: 'room-a',
            status: 'revoked',
            issuedByUid: 'staff-1',
            issuedAt: SERVER_TS,
            expiresAt: futureExpiry,
            submittedAt: null,
            revokedByUid: 'owner-1',
            version: 2,
          }),
        },
        updateMask: {
          fieldPaths: ['status', 'revokedByUid', 'revokedAt', 'version'],
        },
        currentDocument: { exists: true },
        updateTransforms: [{ fieldPath: 'revokedAt', setToServerValue: 'REQUEST_TIME' }],
      },
      {
        update: {
          name: `${DB_ROOT}/reviewInvitations/${validHashB}`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_completed_review',
            serviceLabelSnapshot: 'Rehearsal Band',
            sessionDate: '2026-11-20',
            studioId: 'room-a',
            status: 'active',
            issuedByUid: 'owner-1',
            expiresAt: futureExpiry,
            submittedAt: null,
            revokedAt: null,
            revokedByUid: '',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: 'issuedAt', setToServerValue: 'REQUEST_TIME' }],
      },
      {
        update: {
          name: `${DB_ROOT}/reviewInvitationIndexes/bkg_completed_review`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_completed_review',
            activeInvitationId: validHashB,
            expiresAt: futureExpiry,
            version: 2,
          }),
        },
        currentDocument: { exists: true },
        updateTransforms: [{ fieldPath: 'issuedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(rotateInvRes.status, 200, `Rotation failed: ${JSON.stringify(rotateInvRes.body)}`);

  // Public gets 403 for revoked validHashA
  assert.equal(
    (await userRequest('GET', `/reviewInvitations/${validHashA}`, null)).status,
    403,
    'Public gets 403 for revoked invitation',
  );

  // Public CANNOT create customerReview as directly 'published'
  const directPublishedAttempt = await userRequest('POST', ':commit', null, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customerReviews/bkg_completed_review`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_completed_review',
            invitationId: validHashB,
            displayName: 'Nadia Band',
            rating: 5,
            reviewText: 'Kualitas ruangan dan alat musik terjaga sangat rapi sepanjang sesi.',
            serviceLabelSnapshot: 'Rehearsal Band',
            sessionDate: '2026-11-20',
            consentToPublish: true,
            consentVersion: 'customer-review-publication-v1',
            status: 'published',
            publishedAt: null,
            version: 1,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
      {
        update: {
          name: `${DB_ROOT}/reviewInvitations/${validHashB}`,
          fields: toFsFields({
            status: 'submitted',
            version: 2,
          }),
        },
        updateMask: { fieldPaths: ['status', 'submittedAt', 'version'] },
        currentDocument: { exists: true },
        updateTransforms: [{ fieldPath: 'submittedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(
    directPublishedAttempt.status,
    403,
    'Public cannot create directly published review',
  );

  // Public CANNOT create customerReview without atomically consuming active invitation
  const soloReviewAttempt = await userRequest('POST', ':commit', null, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customerReviews/bkg_completed_review`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_completed_review',
            invitationId: validHashB,
            displayName: 'Nadia Band',
            rating: 5,
            reviewText: 'Kualitas ruangan dan alat musik terjaga sangat rapi sepanjang sesi.',
            serviceLabelSnapshot: 'Rehearsal Band',
            sessionDate: '2026-11-20',
            consentToPublish: true,
            consentVersion: 'customer-review-publication-v1',
            status: 'pending',
            publishedAt: null,
            version: 1,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
    ],
  });
  assert.equal(
    soloReviewAttempt.status,
    403,
    'Public review create requires atomic invitation consume',
  );

  // Public CAN atomically submit pending review + consume validHashB
  const validPublicSubmit = await userRequest('POST', ':commit', null, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customerReviews/bkg_completed_review`,
          fields: toFsFields({
            schemaVersion: 1,
            bookingId: 'bkg_completed_review',
            invitationId: validHashB,
            displayName: 'Nadia Band',
            rating: 5,
            reviewText: 'Kualitas ruangan dan alat musik terjaga sangat rapi sepanjang sesi.',
            serviceLabelSnapshot: 'Rehearsal Band',
            sessionDate: '2026-11-20',
            consentToPublish: true,
            consentVersion: 'customer-review-publication-v1',
            status: 'pending',
            publishedAt: null,
            version: 1,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
      {
        update: {
          name: `${DB_ROOT}/reviewInvitations/${validHashB}`,
          fields: toFsFields({
            status: 'submitted',
            version: 2,
          }),
        },
        updateMask: { fieldPaths: ['status', 'submittedAt', 'version'] },
        currentDocument: { exists: true },
        updateTransforms: [{ fieldPath: 'submittedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(
    validPublicSubmit.status,
    200,
    `Valid public review submission failed: ${JSON.stringify(validPublicSubmit.body)}`,
  );

  // Public gets 200 on submitted invitation status view, CANNOT list or read pending review
  assert.equal(
    (await userRequest('GET', `/reviewInvitations/${validHashB}`, null)).status,
    200,
    'Public can see submitted invitation state cleanly',
  );
  assert.equal(
    (await userRequest('GET', '/customerReviews/bkg_completed_review', null)).status,
    403,
    'Public CANNOT read pending review',
  );
  assert.equal(
    (
      await userRequest('POST', ':runQuery', null, {
        structuredQuery: { from: [{ collectionId: 'customerReviews' }] },
      })
    ).status,
    403,
    'Public CANNOT list customerReviews without published status filter',
  );

  // Staff CANNOT moderate pending review or mutate publicReviewStats
  const staffPublishAttempt = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customerReviews/bkg_completed_review`,
          fields: toFsFields({
            status: 'published',
            version: 2,
          }),
        },
        updateMask: { fieldPaths: ['status', 'publishedAt', 'updatedAt', 'version'] },
        currentDocument: { exists: true },
        updateTransforms: [
          { fieldPath: 'publishedAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
    ],
  });
  assert.equal(staffPublishAttempt.status, 403, 'Staff CANNOT approve/publish review');

  // Owner CANNOT alter customer reviewText during moderation
  const ownerTamperAttempt = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customerReviews/bkg_completed_review`,
          fields: toFsFields({
            status: 'published',
            reviewText: 'Edited by studio admin secretly!',
            version: 2,
          }),
        },
        updateMask: { fieldPaths: ['status', 'reviewText', 'publishedAt', 'updatedAt', 'version'] },
        currentDocument: { exists: true },
        updateTransforms: [
          { fieldPath: 'publishedAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
    ],
  });
  assert.equal(ownerTamperAttempt.status, 403, 'Owner CANNOT edit customer written reviewText');

  // Owner CANNOT write mismatched ratingDistribution math to publicReviewStats/summary
  const invalidStatsWrite = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicReviewStats/summary`,
          fields: toFsFields({
            schemaVersion: 1,
            publishedCount: 1,
            ratingSum: 10,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(invalidStatsWrite.status, 403, 'Stats math inconsistency must be denied');

  // Owner CAN atomically publish review + update publicReviewStats/summary
  const validOwnerPublish = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customerReviews/bkg_completed_review`,
          fields: toFsFields({
            status: 'published',
            version: 2,
          }),
        },
        updateMask: { fieldPaths: ['status', 'publishedAt', 'updatedAt', 'version'] },
        currentDocument: { exists: true },
        updateTransforms: [
          { fieldPath: 'publishedAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
      {
        update: {
          name: `${DB_ROOT}/publicReviewStats/summary`,
          fields: toFsFields({
            schemaVersion: 1,
            publishedCount: 1,
            ratingSum: 5,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(
    validOwnerPublish.status,
    200,
    `Owner publish + stats commit failed: ${JSON.stringify(validOwnerPublish.body)}`,
  );

  // Public CAN now read published review, filtered published list, and publicReviewStats/summary
  assert.equal(
    (await userRequest('GET', '/customerReviews/bkg_completed_review', null)).status,
    200,
    'Public can GET published review',
  );
  assert.equal(
    (await userRequest('GET', '/publicReviewStats/summary', null)).status,
    200,
    'Public can GET publicReviewStats/summary',
  );
  assert.equal(
    (
      await userRequest('POST', ':runQuery', null, {
        structuredQuery: {
          from: [{ collectionId: 'customerReviews' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'published' },
            },
          },
        },
      })
    ).status,
    200,
    'Public can query published customerReviews',
  );
  console.log('✓ Customer Review invitation, atomic submission, RBAC & moderation rules passed');

  // 2C. CLIENT PORTAL PHASE 1 SECURITY RULES (Auth Provisioning, Email Matching, RBAC & Isolation)
  // Unauthenticated access to client portal collections is always denied
  for (const unauthPath of [
    'clientAccounts/client-matched-1',
    'clientProfiles/cust_email_matched',
    'customerEmailIndex/matched@gmail.com',
    'clientCustomerLinks/cust_email_matched',
  ]) {
    assert.equal(
      (await userRequest('GET', `/${unauthPath}`, null)).status,
      403,
      `Unauthenticated visitor denied GET ${unauthPath}`,
    );
  }

  // Unverified Google user & non-Google password user cannot read customerEmailIndex or provision Client accounts
  assert.equal(
    (await userRequest('GET', '/customerEmailIndex/unverified@gmail.com', TOKEN_CLIENT_UNVERIFIED))
      .status,
    403,
    'Unverified Google user denied GET customerEmailIndex',
  );
  assert.equal(
    (await userRequest('GET', '/customerEmailIndex/pwuser@gmail.com', TOKEN_CLIENT_PASSWORD))
      .status,
    403,
    'Password-provider user denied GET customerEmailIndex',
  );

  // Staff creates Customer + Email Index + Client-Safe Profile atomically
  const staffCreateEmailCustomerRes = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customers/cust_email_matched`,
          fields: toFsFields({
            displayName: 'Band Matched',
            normalizedName: 'band matched',
            phoneDisplay: '+62 812-7777-8888',
            phoneNormalized: '+6281277778888',
            email: 'matched@gmail.com',
            emailNormalized: 'matched@gmail.com',
            nameAliases: [],
            previousPhones: [],
            status: 'active',
            mergedIntoCustomerId: null,
            historyCustomerIds: ['cust_email_matched'],
            bookingCount: 0,
            firstBookingDate: '',
            lastBookingDate: '',
            notes: 'VIP internal studio note must NEVER leak to Client',
            createdByUid: 'staff-1',
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientProfiles/cust_email_matched`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'cust_email_matched',
            ownerUid: null,
            profileSource: 'linked_customer',
            displayName: 'Band Matched',
            emailNormalized: 'matched@gmail.com',
            phoneDisplay: '+62 812-7777-8888',
            photoURL: '',
            status: 'active',
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/customerEmailIndex/matched@gmail.com`,
          fields: toFsFields({
            schemaVersion: 1,
            emailNormalized: 'matched@gmail.com',
            customerId: 'cust_email_matched',
            status: 'active',
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/customerEmailIndex/shared@gmail.com`,
          fields: toFsFields({
            schemaVersion: 1,
            emailNormalized: 'shared@gmail.com',
            customerId: '',
            status: 'ambiguous',
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    staffCreateEmailCustomerRes.status,
    200,
    `Staff creating customer + emailIndex + clientProfile failed: ${JSON.stringify(staffCreateEmailCustomerRes.body)}`,
  );

  // customerEmailIndex RBAC: verified Google Client can GET ONLY own normalized email doc; never list/write
  assert.equal(
    (await userRequest('GET', '/customerEmailIndex/matched@gmail.com', TOKEN_CLIENT_MATCHED))
      .status,
    200,
    'Verified Google client can GET own customerEmailIndex',
  );
  assert.equal(
    (await userRequest('GET', '/customerEmailIndex/attacker@gmail.com', TOKEN_CLIENT_MATCHED))
      .status,
    403,
    'Client denied GET another email in customerEmailIndex',
  );
  assert.equal(
    (await userRequest('GET', '/customerEmailIndex', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client denied LIST customerEmailIndex',
  );
  assert.equal(
    (await userRequest('GET', '/customerEmailIndex', TOKEN_STAFF)).status,
    403,
    'Staff denied LIST customerEmailIndex',
  );
  assert.equal(
    (await userRequest('GET', '/customerEmailIndex', TOKEN_OWNER)).status,
    200,
    'Owner allowed LIST customerEmailIndex',
  );
  assert.equal(
    (await userRequest('DELETE', '/customerEmailIndex/matched@gmail.com', TOKEN_CLIENT_MATCHED))
      .status,
    403,
    'Client denied deleting customerEmailIndex',
  );

  // Staff / Owner accounts with Google claims CANNOT create clientAccounts or hijack Client role
  const staffSelfClientAttempt = await userRequest('POST', ':commit', TOKEN_GOOGLE_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/staff-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'staff-1',
            role: 'client',
            status: 'active',
            customerId: 'client_staff-1',
            profileSource: 'isolated_client_profile',
            emailNormalized: 'staff@37music.id',
            displayName: 'Staff User',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientCustomerLinks/client_staff-1`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'client_staff-1',
            ownerUid: 'staff-1',
            emailNormalized: 'staff@37music.id',
            profileSource: 'isolated_client_profile',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientProfiles/client_staff-1`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'client_staff-1',
            ownerUid: 'staff-1',
            profileSource: 'isolated_client_profile',
            displayName: 'Staff User',
            emailNormalized: 'staff@37music.id',
            phoneDisplay: '',
            photoURL: '',
            status: 'active',
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    staffSelfClientAttempt.status,
    403,
    'Staff account cannot create clientAccounts doc even with Google claims',
  );

  // Ambiguous customerEmailIndex blocks linked provisioning (cannot link to arbitrary customerId)
  const ambigLinkAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_AMBIGUOUS, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-ambig-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-ambig-1',
            role: 'client',
            status: 'active',
            customerId: 'cust_email_matched',
            profileSource: 'linked_customer',
            emailNormalized: 'shared@gmail.com',
            displayName: 'Ambiguous Client',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientCustomerLinks/cust_email_matched`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'cust_email_matched',
            ownerUid: 'client-ambig-1',
            emailNormalized: 'shared@gmail.com',
            profileSource: 'linked_customer',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    ambigLinkAttempt.status,
    403,
    'Ambiguous email client denied linking to existing customer',
  );

  // Client with unverified Google email denied creating isolated account
  const unverifiedCreateAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_UNVERIFIED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-unverified-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-unverified-1',
            role: 'client',
            status: 'active',
            customerId: 'client_client-unverified-1',
            profileSource: 'isolated_client_profile',
            emailNormalized: 'unverified@gmail.com',
            displayName: 'Unverified User',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientCustomerLinks/client_client-unverified-1`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'client_client-unverified-1',
            ownerUid: 'client-unverified-1',
            emailNormalized: 'unverified@gmail.com',
            profileSource: 'isolated_client_profile',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientProfiles/client_client-unverified-1`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'client_client-unverified-1',
            ownerUid: 'client-unverified-1',
            profileSource: 'isolated_client_profile',
            displayName: 'Unverified User',
            emailNormalized: 'unverified@gmail.com',
            phoneDisplay: '',
            photoURL: '',
            status: 'active',
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    unverifiedCreateAttempt.status,
    403,
    'Unverified Google email cannot create clientAccounts doc',
  );

  // Matched Client creates atomic linked account + customer ownership lock (instant active, zero pending)
  const linkedClientCreateRes = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-matched-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-matched-1',
            role: 'client',
            status: 'active',
            customerId: 'cust_email_matched',
            profileSource: 'linked_customer',
            emailNormalized: 'matched@gmail.com',
            displayName: 'Matched Musician',
            photoURL: 'https://lh3.googleusercontent.com/matched.jpg',
            authProvider: 'google.com',
            emailVerified: true,
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientCustomerLinks/cust_email_matched`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'cust_email_matched',
            ownerUid: 'client-matched-1',
            emailNormalized: 'matched@gmail.com',
            profileSource: 'linked_customer',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    linkedClientCreateRes.status,
    200,
    `Linked client atomic create failed: ${JSON.stringify(linkedClientCreateRes.body)}`,
  );

  // Active linked Client reads own account and client-safe clientProfile, NEVER raw customers or admin docs
  assert.equal(
    (await userRequest('GET', '/clientAccounts/client-matched-1', TOKEN_CLIENT_MATCHED)).status,
    200,
    'Client can GET own clientAccount',
  );
  assert.equal(
    (await userRequest('GET', '/clientProfiles/cust_email_matched', TOKEN_CLIENT_MATCHED)).status,
    200,
    'Active linked Client can GET bound clientProfiles projection',
  );
  for (const forbiddenAdminPath of [
    'customers/cust_email_matched',
    'bookings/bkg_1',
    'invoices/inv_bkg_1',
    'paymentEvidence/ev_reset_1',
    'paymentTransactions/pay_1',
    'bookkeepingEntries/bk_1',
    'publicBookingRequests/req_1',
    'settings/pricing',
    'staffProfiles/owner-1',
    'systemOperations/factoryReset',
  ]) {
    assert.equal(
      (await userRequest('GET', `/${forbiddenAdminPath}`, TOKEN_CLIENT_MATCHED)).status,
      403,
      `Active Client MUST be denied reading admin path ${forbiddenAdminPath}`,
    );
  }

  // Another client CANNOT hijack already-claimed customer or read someone else's account/profile
  assert.equal(
    (await userRequest('GET', '/clientAccounts/client-matched-1', TOKEN_CLIENT_ATTACKER)).status,
    403,
    'Attacker denied reading another clientAccount',
  );
  assert.equal(
    (await userRequest('GET', '/clientProfiles/cust_email_matched', TOKEN_CLIENT_ATTACKER)).status,
    403,
    'Attacker denied reading linked clientProfile',
  );
  assert.equal(
    (await userRequest('GET', '/clientCustomerLinks/cust_email_matched', TOKEN_CLIENT_ATTACKER))
      .status,
    403,
    'Attacker denied reading clientCustomerLinks',
  );
  const attackerClaimAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_ATTACKER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-attacker-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-attacker-1',
            role: 'client',
            status: 'active',
            customerId: 'cust_email_matched',
            profileSource: 'linked_customer',
            emailNormalized: 'attacker@gmail.com',
            displayName: 'Attacker',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientCustomerLinks/cust_email_matched`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'cust_email_matched',
            ownerUid: 'client-attacker-1',
            emailNormalized: 'attacker@gmail.com',
            profileSource: 'linked_customer',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    attackerClaimAttempt.status,
    403,
    'Attacker cannot claim already-linked customer or spoof matched email',
  );

  // Unmatched Google client creates isolated profile + link + account atomically
  const isolatedCreateRes = await userRequest('POST', ':commit', TOKEN_CLIENT_NEW, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-new-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-new-1',
            role: 'client',
            status: 'active',
            customerId: 'client_client-new-1',
            profileSource: 'isolated_client_profile',
            emailNormalized: 'newclient@gmail.com',
            displayName: 'New Client Musician',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientCustomerLinks/client_client-new-1`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'client_client-new-1',
            ownerUid: 'client-new-1',
            emailNormalized: 'newclient@gmail.com',
            profileSource: 'isolated_client_profile',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientProfiles/client_client-new-1`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'client_client-new-1',
            ownerUid: 'client-new-1',
            profileSource: 'isolated_client_profile',
            displayName: 'New Client Musician',
            emailNormalized: 'newclient@gmail.com',
            phoneDisplay: '',
            photoURL: '',
            status: 'active',
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    isolatedCreateRes.status,
    200,
    `Isolated client atomic create failed: ${JSON.stringify(isolatedCreateRes.body)}`,
  );
  assert.equal(
    (await userRequest('GET', '/clientProfiles/client_client-new-1', TOKEN_CLIENT_NEW)).status,
    200,
    'Isolated client can GET own isolated clientProfile',
  );

  // Client cannot escalate role/status/customerId, but can update safe displayName/photoURL
  const fetchedNewAcct = await userRequest('GET', '/clientAccounts/client-new-1', TOKEN_CLIENT_NEW);
  const newCreatedAtTs = fetchedNewAcct.body.fields.createdAt.timestampValue;
  const selfEscalateAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_NEW, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-new-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-new-1',
            role: 'owner',
            status: 'active',
            customerId: 'cust_email_matched',
            profileSource: 'linked_customer',
            emailNormalized: 'newclient@gmail.com',
            displayName: 'New Client Musician',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            createdAt: { _ts: newCreatedAtTs },
            version: 2,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(selfEscalateAttempt.status, 403, 'Client denied escalating role/customerId');

  // Staff denied suspending clientAccount; Owner CAN suspend; suspended client locked out & cannot self-reactivate
  const staffSuspendAttempt = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-new-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-new-1',
            role: 'client',
            status: 'suspended',
            customerId: 'client_client-new-1',
            profileSource: 'isolated_client_profile',
            emailNormalized: 'newclient@gmail.com',
            displayName: 'New Client Musician',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            createdAt: { _ts: newCreatedAtTs },
            version: 2,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(staffSuspendAttempt.status, 403, 'Staff denied suspending Client account');

  const ownerSuspendRes = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-new-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-new-1',
            role: 'client',
            status: 'suspended',
            customerId: 'client_client-new-1',
            profileSource: 'isolated_client_profile',
            emailNormalized: 'newclient@gmail.com',
            displayName: 'New Client Musician',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            createdAt: { _ts: newCreatedAtTs },
            version: 2,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    ownerSuspendRes.status,
    200,
    `Owner suspending client account failed: ${JSON.stringify(ownerSuspendRes.body)}`,
  );

  // Suspended Client can read own clientAccounts/{uid} (for clear notice), CANNOT read clientProfiles or self-reactivate
  assert.equal(
    (await userRequest('GET', '/clientAccounts/client-new-1', TOKEN_CLIENT_NEW)).status,
    200,
    'Suspended client can read own account status for neutral suspension check',
  );
  assert.equal(
    (await userRequest('GET', '/clientProfiles/client_client-new-1', TOKEN_CLIENT_NEW)).status,
    403,
    'Suspended client denied reading own clientProfile',
  );
  const selfReactivateAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_NEW, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-new-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-new-1',
            role: 'client',
            status: 'active',
            customerId: 'client_client-new-1',
            profileSource: 'isolated_client_profile',
            emailNormalized: 'newclient@gmail.com',
            displayName: 'New Client Musician',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            createdAt: { _ts: newCreatedAtTs },
            version: 3,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(selfReactivateAttempt.status, 403, 'Suspended client cannot self-reactivate');

  // Nobody can delete clientAccounts documents directly
  assert.equal(
    (await userRequest('DELETE', '/clientAccounts/client-matched-1', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client denied deleting clientAccounts',
  );
  assert.equal(
    (await userRequest('DELETE', '/clientAccounts/client-matched-1', TOKEN_OWNER)).status,
    403,
    'Owner denied deleting clientAccounts',
  );
  console.log(
    '✓ Client Portal Phase 1 rules (Google provisioning, email index, isolation & suspension) passed',
  );

  // 2D. CLIENT PORTAL PHASE 3 SECURITY RULES (publicPricingCatalog + client_portal bookingRequests)
  const samplePublicCatalogServiceTypes = [
    {
      id: 'rehearsal',
      name: 'Rehearsal',
      description: 'Band rehearsal',
      deliveryMode: 'studio',
      sortOrder: 1,
      options: [
        {
          id: 'rehearsal-regular',
          name: 'Reguler',
          description: 'Per jam',
          sortOrder: 1,
          pricing: {
            mode: 'hourly',
            hourlyRate: 100000,
            durationMinutes: null,
            basePrice: null,
            discountAmount: 0,
            projectPrice: null,
            unitLabel: '',
          },
          discountRules: [],
        },
        {
          id: 'pkg-rehearsal-3h',
          name: 'Paket Rehearsal 3 Jam',
          description: 'Hemat 30rb',
          sortOrder: 2,
          pricing: {
            mode: 'fixed_shift',
            hourlyRate: null,
            durationMinutes: 180,
            basePrice: 300000,
            discountAmount: 30000,
            projectPrice: null,
            unitLabel: '',
          },
          discountRules: [],
        },
      ],
    },
    {
      id: 'mixing',
      name: 'Mixing',
      description: 'Post-production mix & master',
      deliveryMode: 'wfa',
      sortOrder: 2,
      options: [
        {
          id: 'mixing-regular',
          name: 'Mixing Lagu',
          description: 'Per lagu',
          sortOrder: 1,
          pricing: {
            mode: 'manual_quote',
            hourlyRate: null,
            durationMinutes: null,
            basePrice: null,
            discountAmount: 0,
            projectPrice: null,
            unitLabel: 'per lagu',
          },
          discountRules: [],
        },
      ],
    },
  ];
  const samplePublicPricingOptionIndex = samplePublicCatalogServiceTypes.flatMap((service) =>
    service.options.map((option) => ({
      serviceTypeId: service.id,
      serviceLabelSnapshot: service.name,
      serviceOptionId: option.id,
      serviceOptionName: option.name,
      deliveryMode: service.deliveryMode,
    })),
  );

  // Unauthenticated, Staff, Active Client denied writing publicPricingCatalog/current
  for (const [label, tok] of [
    ['Anon', null],
    ['Staff', TOKEN_STAFF],
    ['Client', TOKEN_CLIENT_MATCHED],
  ]) {
    const deniedWrite = await userRequest('POST', ':commit', tok, {
      writes: [
        {
          update: {
            name: `${DB_ROOT}/publicPricingCatalog/current`,
            fields: toFsFields({
              schemaVersion: 3,
              version: 1,
              serviceTypes: samplePublicCatalogServiceTypes,
              serviceOptionIndex: samplePublicPricingOptionIndex,
            }),
          },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ],
    });
    assert.equal(deniedWrite.status, 403, `${label} denied writing publicPricingCatalog/current`);
  }

  // Fail-closed: client_portal booking request denied before publicPricingCatalog/current exists
  const buildClientRequestFields = (overrides = {}) => ({
    schemaVersion: 1,
    requestReference: 'REQ-CLNT0001',
    requestType: 'studio_booking',
    status: 'new',
    statusReason: '',
    customerName: 'Matched Client Musician',
    bandName: 'Matched Sound',
    contactPhone: '+6281234567890',
    publicServiceId: 'rehearsal',
    serviceLabelSnapshot: 'Rehearsal',
    requestedRoomId: 'room-a',
    preferredDate: '2026-11-28',
    preferredStartMinute: 600,
    preferredDurationMinutes: 180,
    targetDeadline: null,
    notes: 'Butuh Paket 3 Jam',
    privacyConsent: true,
    consentVersion: 'v1',
    source: 'client_portal',
    clientUid: 'client-matched-1',
    customerId: 'cust_email_matched',
    serviceOptionId: 'pkg-rehearsal-3h',
    serviceOptionName: 'Paket Rehearsal 3 Jam',
    pricingVersion: 2,
    assignedStaffUid: '',
    assignedStaffName: '',
    lastCommunicationAt: null,
    lastCommunicationType: '',
    lastCommunicationStatus: '',
    linkedBookingId: null,
    confirmedBookingSnapshot: null,
    confirmedAt: null,
    confirmedByUid: '',
    appCheckState: 'unconfigured',
    updatedByUid: '',
    version: 1,
    ...overrides,
  });

  const beforeCatalogCreateAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicBookingRequests/req_client_missing_cat`,
          fields: toFsFields(buildClientRequestFields({ pricingVersion: 1 })),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    beforeCatalogCreateAttempt.status,
    403,
    'Client request denied before publicPricingCatalog/current is published',
  );

  // Owner denied leaking fees / operationalSettings / updatedByUid inside publicPricingCatalog/current
  const forbiddenCatalogLeak = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicPricingCatalog/current`,
          fields: toFsFields({
            schemaVersion: 3,
            version: 1,
            serviceTypes: samplePublicCatalogServiceTypes,
            serviceOptionIndex: samplePublicPricingOptionIndex,
            operationalSettings: { dailyMealAllowancePerStaff: 25000 },
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(
    forbiddenCatalogLeak.status,
    403,
    'Owner denied writing forbidden operationalSettings',
  );

  // Owner denied writing non-current doc ID in publicPricingCatalog
  const nonCurrentCatalog = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicPricingCatalog/draft`,
          fields: toFsFields({
            schemaVersion: 3,
            version: 1,
            serviceTypes: samplePublicCatalogServiceTypes,
            serviceOptionIndex: samplePublicPricingOptionIndex,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(nonCurrentCatalog.status, 403, 'Owner denied writing non-current docId');

  // Owner CAN atomically write settings/pricing + publicPricingCatalog/current (version 2)
  const ownerAtomicPricingSync = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/settings/pricing`,
          fields: toFsFields({
            schemaVersion: 2,
            version: 2,
            serviceTypes: samplePublicCatalogServiceTypes.map((svc) => ({
              ...svc,
              isActive: true,
              options: svc.options.map((opt) => ({
                ...opt,
                isActive: true,
                fees: {
                  staff: { mode: 'fixed', amount: 15000 },
                  owner: { mode: 'none', amount: 0 },
                  recordingOperator: { mode: 'none', amount: 0 },
                },
              })),
            })),
            operationalSettings: { dailyMealAllowancePerStaff: 25000 },
            updatedByUid: 'owner-1',
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      },
      {
        update: {
          name: `${DB_ROOT}/publicPricingCatalog/current`,
          fields: toFsFields({
            schemaVersion: 3,
            version: 2,
            serviceTypes: samplePublicCatalogServiceTypes,
            serviceOptionIndex: samplePublicPricingOptionIndex,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
  });
  assert.equal(
    ownerAtomicPricingSync.status,
    200,
    `Owner atomic sync settings/pricing + publicPricingCatalog/current failed: ${JSON.stringify(ownerAtomicPricingSync.body)}`,
  );

  // Anon & Active Client can GET publicPricingCatalog/current, DENIED LIST collection & DELETE
  assert.equal((await userRequest('GET', '/publicPricingCatalog/current', null)).status, 200);
  assert.equal(
    (await userRequest('GET', '/publicPricingCatalog/current', TOKEN_CLIENT_MATCHED)).status,
    200,
  );
  assert.equal((await userRequest('GET', '/publicPricingCatalog', null)).status, 403);
  assert.equal(
    (await userRequest('DELETE', '/publicPricingCatalog/current', TOKEN_OWNER)).status,
    403,
  );

  // Anonymous user CANNOT submit source='client_portal', while public_landing_page STILL works
  const anonSpoofClientSource = await userRequest('POST', ':commit', null, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicBookingRequests/req_anon_spoof_cp`,
          fields: toFsFields(buildClientRequestFields()),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    anonSpoofClientSource.status,
    403,
    'Anonymous denied submitting client_portal source',
  );

  // Client denied submitting stale pricingVersion, spoofed clientUid, spoofed customerId, or confirmed status
  for (const [desc, overrides] of [
    ['stale pricingVersion', { pricingVersion: 1 }],
    ['unknown service option', { serviceOptionId: 'not-in-catalog' }],
    ['mismatched service option name', { serviceOptionName: 'Forged Package Name' }],
    ['spoofed clientUid', { clientUid: 'other-client-uid' }],
    ['spoofed customerId', { customerId: 'cust_other' }],
    ['self-confirmed status', { status: 'confirmed' }],
    ['prefilled linkedBookingId', { linkedBookingId: 'bkg_fake' }],
  ]) {
    const badAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
      writes: [
        {
          update: {
            name: `${DB_ROOT}/publicBookingRequests/req_client_bad_01`,
            fields: toFsFields(buildClientRequestFields(overrides)),
          },
          updateTransforms: [
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
          currentDocument: { exists: false },
        },
      ],
    });
    assert.equal(badAttempt.status, 403, `Client denied ${desc}`);
  }

  // Suspended client (client-new-1) DENIED creating client_portal booking request
  const suspendedCreateAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_NEW, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicBookingRequests/req_client_susp_01`,
          fields: toFsFields(
            buildClientRequestFields({
              clientUid: 'client-new-1',
              customerId: 'client_client-new-1',
            }),
          ),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(suspendedCreateAttempt.status, 403, 'Suspended client denied creating request');

  // Client Portal WFA inquiries require project name and brief even for direct Firestore writes.
  for (const [label, overrides] of [
    [
      'missing project name',
      {
        requestType: 'post_production_inquiry',
        publicServiceId: 'mixing',
        serviceLabelSnapshot: 'Mixing',
        serviceOptionId: 'mixing-regular',
        serviceOptionName: 'Mixing Lagu',
        requestedRoomId: null,
        preferredDate: null,
        preferredStartMinute: null,
        preferredDurationMinutes: null,
        bandName: '',
        notes: 'Project Brief: Warm indie pop mix reference',
      },
    ],
    [
      'missing project brief',
      {
        requestType: 'post_production_inquiry',
        publicServiceId: 'mixing',
        serviceLabelSnapshot: 'Mixing',
        serviceOptionId: 'mixing-regular',
        serviceOptionName: 'Mixing Lagu',
        requestedRoomId: null,
        preferredDate: null,
        preferredStartMinute: null,
        preferredDurationMinutes: null,
        bandName: 'Senja EP',
        notes: '[Project Type: EP]',
      },
    ],
  ]) {
    const invalidWfaRequest = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
      writes: [
        {
          update: {
            name: `${DB_ROOT}/publicBookingRequests/req_client_wfa_invalid_${label.replace(/\s+/g, '_')}`,
            fields: toFsFields(buildClientRequestFields(overrides)),
          },
          updateTransforms: [
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
          currentDocument: { exists: false },
        },
      ],
    });
    assert.equal(invalidWfaRequest.status, 403, `Client WFA denied ${label}`);
  }

  // Active Client SUCCEEDS submitting valid client_portal studio_booking & post_production_inquiry
  const validClientStudioReq = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicBookingRequests/req_client_studio_1`,
          fields: toFsFields(buildClientRequestFields()),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    validClientStudioReq.status,
    200,
    `Client studio booking request create failed: ${JSON.stringify(validClientStudioReq.body)}`,
  );

  const validClientMixReq = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicBookingRequests/req_client_mix_1`,
          fields: toFsFields(
            buildClientRequestFields({
              requestReference: 'REQ-CLNT0002',
              requestType: 'post_production_inquiry',
              publicServiceId: 'mixing',
              serviceLabelSnapshot: 'Mixing',
              serviceOptionId: 'mixing-regular',
              serviceOptionName: 'Mixing Lagu',
              requestedRoomId: null,
              preferredDate: null,
              preferredStartMinute: null,
              preferredDurationMinutes: null,
              targetDeadline: '2026-12-05',
              bandName: 'Senja EP',
              notes: 'Project Brief: Warm indie pop mix reference',
            }),
          ),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    validClientMixReq.status,
    200,
    `Client WFA inquiry create failed: ${JSON.stringify(validClientMixReq.body)}`,
  );

  // Active Client can GET own request, CANNOT update/delete, CANNOT GET other requests (`req_1` anonymous or another client)
  assert.equal(
    (await userRequest('GET', '/publicBookingRequests/req_client_studio_1', TOKEN_CLIENT_MATCHED))
      .status,
    200,
    'Active client can GET own client_portal request',
  );
  assert.equal(
    (await userRequest('GET', '/publicBookingRequests/req_1', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client denied reading anonymous req_1',
  );
  assert.equal(
    (await userRequest('GET', '/publicBookingRequests/req_client_studio_1', null)).status,
    403,
    'Anonymous denied reading client_portal request',
  );
  assert.equal(
    (
      await userRequest(
        'DELETE',
        '/publicBookingRequests/req_client_studio_1',
        TOKEN_CLIENT_MATCHED,
      )
    ).status,
    403,
    'Client denied deleting own request',
  );

  // Provision second active client and verify cross-client read isolation
  await adminSetDoc('clientAccounts/client-attacker-1', {
    schemaVersion: 1,
    uid: 'client-attacker-1',
    role: 'client',
    status: 'active',
    customerId: 'client_client-attacker-1',
    profileSource: 'isolated_client_profile',
    emailNormalized: 'attacker@gmail.com',
    displayName: 'Other Client',
    photoURL: '',
    authProvider: 'google.com',
    emailVerified: true,
    createdAt: SERVER_TS,
    updatedAt: SERVER_TS,
    version: 1,
  });
  assert.equal(
    (await userRequest('GET', '/publicBookingRequests/req_client_studio_1', TOKEN_CLIENT_ATTACKER))
      .status,
    403,
    'Other active client denied reading matched client request',
  );

  // List / runQuery checks: active client CAN query own client_portal requests; cross-client & suspended DENIED
  const matchedOwnListRes = await userRequest('POST', ':runQuery', TOKEN_CLIENT_MATCHED, {
    structuredQuery: {
      from: [{ collectionId: 'publicBookingRequests' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'source' },
                op: 'EQUAL',
                value: { stringValue: 'client_portal' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'clientUid' },
                op: 'EQUAL',
                value: { stringValue: 'client-matched-1' },
              },
            },
          ],
        },
      },
    },
  });
  assert.equal(
    matchedOwnListRes.status,
    200,
    `Active client listing own requests failed: ${JSON.stringify(matchedOwnListRes.body)}`,
  );

  const crossClientListRes = await userRequest('POST', ':runQuery', TOKEN_CLIENT_ATTACKER, {
    structuredQuery: {
      from: [{ collectionId: 'publicBookingRequests' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'source' },
                op: 'EQUAL',
                value: { stringValue: 'client_portal' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'clientUid' },
                op: 'EQUAL',
                value: { stringValue: 'client-matched-1' },
              },
            },
          ],
        },
      },
    },
  });
  assert.equal(
    crossClientListRes.status,
    403,
    'Other active client denied listing matched client requests',
  );

  const suspendedListRes = await userRequest('POST', ':runQuery', TOKEN_CLIENT_NEW, {
    structuredQuery: {
      from: [{ collectionId: 'publicBookingRequests' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'source' },
                op: 'EQUAL',
                value: { stringValue: 'client_portal' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'clientUid' },
                op: 'EQUAL',
                value: { stringValue: 'client-new-1' },
              },
            },
          ],
        },
      },
    },
  });
  assert.equal(suspendedListRes.status, 403, 'Suspended client denied listing requests');

  // Staff can transition & atomically confirm Client Portal request (preserving all 38 keys + client ownership),
  // while DENIED altering Client serviceOptionId/clientUid
  const fetchedClientReq = await userRequest(
    'GET',
    '/publicBookingRequests/req_client_studio_1',
    TOKEN_STAFF,
  );
  assert.equal(fetchedClientReq.status, 200, 'Staff can read Client Portal request');
  const clientReqCreatedAtTs = fetchedClientReq.body.fields.createdAt.timestampValue;

  const staffTamperOptionAttempt = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicBookingRequests/req_client_studio_1`,
          fields: toFsFields({
            ...buildClientRequestFields(),
            serviceOptionId: 'rehearsal-regular',
            status: 'in_review',
            assignedStaffUid: 'staff-1',
            assignedStaffName: 'Staff Studio',
            createdAt: { _ts: clientReqCreatedAtTs },
            updatedByUid: 'staff-1',
            version: 2,
          }),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    staffTamperOptionAttempt.status,
    403,
    'Staff denied tampering client serviceOptionId',
  );

  const staffAtomicConfirmRes = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/bookings/bkg_client_portal_1`,
          fields: toFsFields({
            customerId: 'cust_email_matched',
            customerName: 'Matched Client Musician',
            phone: '081277778888',
            phoneNormalized: '+6281277778888',
            bandName: 'Matched Sound',
            studioId: 'room-a',
            serviceTypeId: 'rehearsal',
            serviceTypeName: 'Rehearsal',
            serviceOptionId: 'pkg-rehearsal-3h',
            serviceOptionName: 'Paket Rehearsal 3 Jam',
            deliveryMode: 'studio',
            pricingMode: 'fixed_shift',
            pricingSettingsVersion: 2,
            serviceId: 'rehearsal',
            serviceLabel: 'Rehearsal',
            packageId: 'pkg-rehearsal-3h',
            packageLabel: 'Paket Rehearsal 3 Jam',
            recordingTypeId: '',
            recordingTypeLabel: '',
            date: '2026-11-28',
            startMinute: 600,
            durationMinutes: 180,
            endMinute: 780,
            timeZone: 'Asia/Jakarta',
            unitRate: 100000,
            subtotal: 300000,
            discountAmount: 30000,
            totalAmount: 270000,
            automaticDiscount: null,
            commissionSnapshot: {
              schemaVersion: 2,
              settingsVersion: 2,
              staff: { basis: 'fixed', rate: 20000, amount: 20000 },
              owner: { basis: 'none', rate: 0, amount: 0 },
              recordingOperator: { basis: 'none', rate: 0, amount: 0 },
            },
            initialPaymentStatus: 'unpaid',
            initialPaidAmount: 0,
            paymentMethod: '',
            sessionStatus: 'upcoming',
            notes: 'Converted from Client Portal',
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/publicBookingRequests/req_client_studio_1`,
          fields: toFsFields({
            ...buildClientRequestFields(),
            status: 'confirmed',
            assignedStaffUid: 'staff-1',
            assignedStaffName: 'Staff Studio',
            linkedBookingId: 'bkg_client_portal_1',
            confirmedBookingSnapshot: {
              bookingId: 'bkg_client_portal_1',
              bookingReference: 'BKG-CP001',
              studioId: 'room-a',
              studioName: 'Room A — Live Room',
              serviceTypeName: 'Rehearsal',
              serviceOptionName: 'Paket Rehearsal 3 Jam',
              date: '2026-11-28',
              startMinute: 600,
              endMinute: 780,
              durationMinutes: 180,
            },
            confirmedAt: SERVER_TS,
            confirmedByUid: 'staff-1',
            createdAt: { _ts: clientReqCreatedAtTs },
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    staffAtomicConfirmRes.status,
    200,
    `Staff atomic confirm of Client Portal request failed: ${JSON.stringify(staffAtomicConfirmRes.body)}`,
  );

  console.log(
    '✓ Client Portal Phase 3 rules (publicPricingCatalog & client_portal bookingRequests) passed',
  );

  // 2E. Public galleryItems & landingPagePlacements read rules across Unauth, Active/Suspended Client, Staff, and Owner
  await adminSetDoc('galleryItems/gal_draft_1', {
    schemaVersion: 1,
    title: 'Draft Backstage Photo',
    category: 'Studio',
    altText: 'Draft backstage studio view',
    caption: 'Draft caption',
    cloudinaryPublicId: '37music/gal_draft_1',
    cloudinaryAssetId: 'asset_draft_1',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/gal_draft_1.jpg',
    resourceType: 'image',
    format: 'jpg',
    width: 1200,
    height: 800,
    bytes: 180000,
    status: 'draft',
    sortOrder: 200,
    uploadedAt: SERVER_TS,
    uploadedByUid: 'owner-1',
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
    version: 1,
  });
  await adminSetDoc('galleryItems/gal_archived_1', {
    schemaVersion: 1,
    title: 'Archived Studio Photo',
    category: 'Studio',
    altText: 'Archived studio rig photo',
    caption: 'Archived caption',
    cloudinaryPublicId: '37music/gal_archived_1',
    cloudinaryAssetId: 'asset_archived_1',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/gal_archived_1.jpg',
    resourceType: 'image',
    format: 'jpg',
    width: 1200,
    height: 800,
    bytes: 190000,
    status: 'archived',
    sortOrder: 300,
    uploadedAt: SERVER_TS,
    uploadedByUid: 'owner-1',
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
    version: 1,
  });
  await adminSetDoc('landingPagePlacements/hero-featured', {
    schemaVersion: 1,
    placementId: 'hero-featured',
    sourceGalleryItemId: 'gal_draft_1',
    cloudinaryPublicId: '37music/gal_draft_1',
    cloudinaryAssetId: 'asset_draft_1',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/gal_draft_1.jpg',
    resourceType: 'image',
    format: 'jpg',
    width: 1200,
    height: 800,
    bytes: 180000,
    altText: 'Hero draft studio banner',
    copy: {
      topSticker: 'LIVE STUDIO',
      captionTitle: 'Live Floor Tangerangs Finest',
      captionSubtitle: 'Acoustic treated room',
      floatingBadgeTitle: 'READY TO TRACK',
      floatingBadgeSubtitle: '10:00 - 23:00 WIB',
    },
    status: 'draft',
    version: 1,
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
  });

  const publishedGalleryQuery = {
    structuredQuery: {
      from: [{ collectionId: 'galleryItems' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'published' },
        },
      },
      orderBy: [{ field: { fieldPath: 'sortOrder' }, direction: 'ASCENDING' }],
      limit: 100,
    },
  };
  const publishedPlacementsQuery = {
    structuredQuery: {
      from: [{ collectionId: 'landingPagePlacements' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'published' },
        },
      },
      limit: 10,
    },
  };

  for (const [roleLabel, actorToken] of [
    ['Anon', null],
    ['Active Client', TOKEN_CLIENT_MATCHED],
    ['Suspended Client', TOKEN_CLIENT_NEW],
    ['Active Staff', TOKEN_STAFF],
    ['Active Owner', TOKEN_OWNER],
  ]) {
    assert.equal(
      (await userRequest('GET', '/galleryItems/gal_1', actorToken)).status,
      200,
      `${roleLabel} can GET published galleryItems/gal_1`,
    );
    assert.equal(
      (await userRequest('GET', '/landingPagePlacements/room-a', actorToken)).status,
      200,
      `${roleLabel} can GET published landingPagePlacements/room-a`,
    );

    const galleryListRes = await userRequest(
      'POST',
      ':runQuery',
      actorToken,
      publishedGalleryQuery,
    );
    assert.equal(
      galleryListRes.status,
      200,
      `${roleLabel} published galleryItems query failed: ${JSON.stringify(galleryListRes.body)}`,
    );
    const galleryIds = (Array.isArray(galleryListRes.body) ? galleryListRes.body : [])
      .map((row) => row?.document?.name?.split('/').pop())
      .filter(Boolean);
    assert.ok(galleryIds.includes('gal_1'), `${roleLabel} gallery list includes published gal_1`);
    assert.ok(
      !galleryIds.includes('gal_draft_1') && !galleryIds.includes('gal_archived_1'),
      `${roleLabel} gallery list excludes draft & archived items`,
    );

    const placementsListRes = await userRequest(
      'POST',
      ':runQuery',
      actorToken,
      publishedPlacementsQuery,
    );
    assert.equal(
      placementsListRes.status,
      200,
      `${roleLabel} published placements query failed: ${JSON.stringify(placementsListRes.body)}`,
    );
    const placementIds = (Array.isArray(placementsListRes.body) ? placementsListRes.body : [])
      .map((row) => row?.document?.name?.split('/').pop())
      .filter(Boolean);
    assert.ok(
      placementIds.includes('room-a'),
      `${roleLabel} placements list includes published room-a`,
    );
    assert.ok(
      !placementIds.includes('hero-featured'),
      `${roleLabel} placements list excludes draft hero-featured`,
    );
  }

  // Non-published documents and unfiltered collection list remain locked strictly to Active Owner
  for (const [roleLabel, actorToken] of [
    ['Anon', null],
    ['Active Client', TOKEN_CLIENT_MATCHED],
    ['Active Staff', TOKEN_STAFF],
    ['Inactive Owner', TOKEN_INACTIVE_OWNER],
  ]) {
    assert.equal(
      (await userRequest('GET', '/galleryItems/gal_draft_1', actorToken)).status,
      403,
      `${roleLabel} denied reading draft galleryItem`,
    );
    assert.equal(
      (await userRequest('GET', '/galleryItems/gal_archived_1', actorToken)).status,
      403,
      `${roleLabel} denied reading archived galleryItem`,
    );
    assert.equal(
      (await userRequest('GET', '/landingPagePlacements/hero-featured', actorToken)).status,
      403,
      `${roleLabel} denied reading draft landingPagePlacement`,
    );
    assert.equal(
      (await userRequest('GET', '/galleryItems', actorToken)).status,
      403,
      `${roleLabel} denied unfiltered galleryItems list`,
    );
    assert.equal(
      (await userRequest('GET', '/landingPagePlacements', actorToken)).status,
      403,
      `${roleLabel} denied unfiltered landingPagePlacements list`,
    );
  }

  for (const ownerPath of [
    '/galleryItems/gal_draft_1',
    '/galleryItems/gal_archived_1',
    '/landingPagePlacements/hero-featured',
    '/galleryItems',
    '/landingPagePlacements',
  ]) {
    assert.equal(
      (await userRequest('GET', ownerPath, TOKEN_OWNER)).status,
      200,
      `Active Owner can read ${ownerPath}`,
    );
  }

  // Non-existent document GET behavior: 403 for non-owner, 404 for Active Owner (initial tx.get support)
  for (const [roleLabel, actorToken] of [
    ['Anon', null],
    ['Active Client', TOKEN_CLIENT_MATCHED],
  ]) {
    assert.equal(
      (await userRequest('GET', '/galleryItems/gal_nonexistent', actorToken)).status,
      403,
      `${roleLabel} gets 403 on missing galleryItem`,
    );
    assert.equal(
      (await userRequest('GET', '/landingPagePlacements/studio-exterior', actorToken)).status,
      403,
      `${roleLabel} gets 403 on missing landingPagePlacement`,
    );
  }
  assert.equal(
    (await userRequest('GET', '/galleryItems/gal_nonexistent', TOKEN_OWNER)).status,
    404,
    'Active Owner gets 404 on missing galleryItem for tx.get() create flow',
  );
  assert.equal(
    (await userRequest('GET', '/landingPagePlacements/studio-exterior', TOKEN_OWNER)).status,
    404,
    'Active Owner gets 404 on missing landingPagePlacement for tx.get() create flow',
  );

  // Active Client cannot update or delete galleryItems or landingPagePlacements
  assert.equal(
    (await userRequest('DELETE', '/galleryItems/gal_1', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client denied deleting galleryItems',
  );
  assert.equal(
    (await userRequest('DELETE', '/landingPagePlacements/room-a', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client denied deleting landingPagePlacements',
  );
  const clientGalleryUpdateAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/galleryItems/gal_1`,
          fields: toFsFields({
            schemaVersion: 1,
            title: 'Tampered Room A',
            category: 'Rooms',
            altText: 'Room A inside studio',
            caption: 'Room A photo',
            cloudinaryPublicId: '37music/gal_1',
            cloudinaryAssetId: 'asset_1',
            secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/gal_1.jpg',
            resourceType: 'image',
            format: 'jpg',
            width: 1200,
            height: 800,
            bytes: 200000,
            status: 'published',
            sortOrder: 100,
            uploadedAt: SERVER_TS,
            uploadedByUid: 'owner-1',
            createdAt: SERVER_TS,
            createdByUid: 'owner-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'client-matched-1',
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(clientGalleryUpdateAttempt.status, 403, 'Client denied updating galleryItems');

  console.log('✓ Public galleryItems & landingPagePlacements Client/Public read rules passed');

  // 2F. Client Portal Phase 4 — Client Billing & Payments (`invoices` & `paymentTransactions`)
  const TOKEN_CLIENT_B = makeEmulatorJwt('client-b-1', 'clientb@gmail.com', {
    signInProvider: 'google.com',
    emailVerified: true,
  });

  // Provision Active Client B bound to `client_client-b-1`
  const clientBProvisionRes = await userRequest('POST', ':commit', TOKEN_CLIENT_B, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/clientAccounts/client-b-1`,
          fields: toFsFields({
            schemaVersion: 1,
            uid: 'client-b-1',
            role: 'client',
            status: 'active',
            customerId: 'client_client-b-1',
            profileSource: 'isolated_client_profile',
            emailNormalized: 'clientb@gmail.com',
            displayName: 'Client B Musician',
            photoURL: '',
            authProvider: 'google.com',
            emailVerified: true,
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientCustomerLinks/client_client-b-1`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'client_client-b-1',
            ownerUid: 'client-b-1',
            emailNormalized: 'clientb@gmail.com',
            profileSource: 'isolated_client_profile',
            version: 1,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/clientProfiles/client_client-b-1`,
          fields: toFsFields({
            schemaVersion: 1,
            customerId: 'client_client-b-1',
            ownerUid: 'client-b-1',
            profileSource: 'isolated_client_profile',
            displayName: 'Client B Musician',
            emailNormalized: 'clientb@gmail.com',
            phoneDisplay: '',
            photoURL: '',
            status: 'active',
            version: 1,
          }),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    clientBProvisionRes.status,
    200,
    `Client B provision failed: ${JSON.stringify(clientBProvisionRes.body)}`,
  );

  // Seed Client A invoices (issued, void, draft) and Client B issued invoice + Suspended Client invoice
  const clientAIssuedInvNumber = '37MS-20261128-A1A1A1A1A1A1';
  const clientAVoidInvNumber = '37MS-20261128-A2A2A2A2A2A2';
  const clientADraftInvNumber = '37MS-20261128-A3A3A3A3A3A3';
  const clientBIssuedInvNumber = '37MS-20261128-B1B1B1B1B1B1';
  const suspendedClientInvNumber = '37MS-20261128-C1C1C1C1C1C1';

  const baseClientASnapshots = {
    customerSnapshot: {
      name: 'Matched Client Musician',
      phone: '081277778888',
      bandName: 'Matched Sound',
    },
    bookingSnapshot: {
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Paket Rehearsal 3 Jam',
      studioId: 'room-a',
      bookingDate: '2026-11-28',
      startMinute: 600,
      endMinute: 780,
      durationMinutes: 180,
    },
    financialSnapshot: {
      subtotal: 300000,
      discountAmount: 30000,
      totalAmount: 270000,
    },
  };

  // Staff creates Client A issued invoice via real Admin rules path (proving Staff regression!)
  const staffCreateClientAInvoiceRes = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_client_portal_1`,
          fields: toFsFields({
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            ...baseClientASnapshots,
            amountPaid: 0,
            balanceDue: 270000,
            paymentStatus: 'unpaid',
            invoiceDate: SERVER_TS,
            dueDate: '2026-12-05',
            lastPaymentTransactionId: null,
            voidReason: '',
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    staffCreateClientAInvoiceRes.status,
    200,
    `Staff create Client A invoice failed: ${JSON.stringify(staffCreateClientAInvoiceRes.body)}`,
  );

  const fetchedClientAInv = await userRequest(
    'GET',
    '/invoices/inv_bkg_client_portal_1',
    TOKEN_STAFF,
  );
  assert.equal(fetchedClientAInv.status, 200, 'Staff can GET Client A invoice');
  const clientAInvDateTs = { _ts: fetchedClientAInv.body.fields.invoiceDate.timestampValue };
  const clientAInvCreatedTs = { _ts: fetchedClientAInv.body.fields.createdAt.timestampValue };

  // Staff records valid payment (Rp 100.000) + Owner records second payment (Rp 70.000) + Staff reverses Rp 100.000
  const staffRecordPaymentRes = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_cp_1`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_client_portal_1',
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            transactionType: 'payment',
            amount: 100000,
            currency: 'IDR',
            paymentMethod: 'transfer',
            receivedAt: SERVER_TS,
            referenceNumber: 'BCA-CP-001',
            notes: 'Internal staff payment note',
            source: 'manual',
            reversalOfTransactionId: null,
            recordedByUid: 'staff-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_client_portal_1`,
          fields: toFsFields({
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            ...baseClientASnapshots,
            amountPaid: 100000,
            balanceDue: 170000,
            paymentStatus: 'partial',
            invoiceDate: clientAInvDateTs,
            dueDate: '2026-12-05',
            lastPaymentTransactionId: 'pay_cp_1',
            voidReason: '',
            createdAt: clientAInvCreatedTs,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    staffRecordPaymentRes.status,
    200,
    `Staff atomic payment record failed: ${JSON.stringify(staffRecordPaymentRes.body)}`,
  );

  const ownerRecordPaymentRes = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_cp_2`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_client_portal_1',
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            transactionType: 'payment',
            amount: 70000,
            currency: 'IDR',
            paymentMethod: 'qris',
            receivedAt: SERVER_TS,
            referenceNumber: 'QRIS-CP-002',
            notes: 'Owner verified QRIS',
            source: 'manual',
            reversalOfTransactionId: null,
            recordedByUid: 'owner-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_client_portal_1`,
          fields: toFsFields({
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            ...baseClientASnapshots,
            amountPaid: 170000,
            balanceDue: 100000,
            paymentStatus: 'partial',
            invoiceDate: clientAInvDateTs,
            dueDate: '2026-12-05',
            lastPaymentTransactionId: 'pay_cp_2',
            voidReason: '',
            createdAt: clientAInvCreatedTs,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'owner-1',
            version: 3,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    ownerRecordPaymentRes.status,
    200,
    `Owner atomic payment record failed: ${JSON.stringify(ownerRecordPaymentRes.body)}`,
  );

  const staffReversalRes = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_rev_pay_cp_1`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_client_portal_1',
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            transactionType: 'reversal',
            amount: 100000,
            currency: 'IDR',
            paymentMethod: 'transfer',
            receivedAt: SERVER_TS,
            referenceNumber: '',
            notes: 'Duplicate transfer entry reversal',
            source: 'reversal',
            reversalOfTransactionId: 'pay_cp_1',
            recordedByUid: 'staff-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_client_portal_1`,
          fields: toFsFields({
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            ...baseClientASnapshots,
            amountPaid: 70000,
            balanceDue: 200000,
            paymentStatus: 'partial',
            invoiceDate: clientAInvDateTs,
            dueDate: '2026-12-05',
            lastPaymentTransactionId: 'pay_rev_pay_cp_1',
            voidReason: '',
            createdAt: clientAInvCreatedTs,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 4,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    staffReversalRes.status,
    200,
    `Staff atomic payment reversal failed: ${JSON.stringify(staffReversalRes.body)}`,
  );

  // Invoice immutability regression: Staff cannot tamper `financialSnapshot` on update
  const staffMutateSnapshotAttempt = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_client_portal_1`,
          fields: toFsFields({
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            ...baseClientASnapshots,
            financialSnapshot: { subtotal: 100000, discountAmount: 0, totalAmount: 100000 },
            amountPaid: 70000,
            balanceDue: 30000,
            paymentStatus: 'partial',
            invoiceDate: clientAInvDateTs,
            dueDate: '2026-12-10',
            lastPaymentTransactionId: 'pay_rev_pay_cp_1',
            voidReason: '',
            createdAt: clientAInvCreatedTs,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 5,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    staffMutateSnapshotAttempt.status,
    403,
    'Invoice immutable financialSnapshot must remain locked even for Staff',
  );

  // Seed Client A void invoice, Client A draft invoice, Client B issued invoice + payment,
  // Suspended Client invoice + payment, and mismatched-parent transaction fixture
  await adminSetDoc('invoices/inv_bkg_client_a_void', {
    invoiceNumber: clientAVoidInvNumber,
    bookingId: 'bkg_client_a_void',
    customerId: 'cust_email_matched',
    invoiceStatus: 'void',
    currency: 'IDR',
    ...baseClientASnapshots,
    amountPaid: 0,
    balanceDue: 270000,
    paymentStatus: 'unpaid',
    invoiceDate: SERVER_TS,
    dueDate: null,
    lastPaymentTransactionId: null,
    voidReason: 'Cancelled session',
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
    version: 2,
  });

  await adminSetDoc('invoices/inv_bkg_client_a_draft', {
    invoiceNumber: clientADraftInvNumber,
    bookingId: 'bkg_client_a_draft',
    customerId: 'cust_email_matched',
    invoiceStatus: 'draft',
    currency: 'IDR',
    ...baseClientASnapshots,
    amountPaid: 0,
    balanceDue: 270000,
    paymentStatus: 'unpaid',
    invoiceDate: SERVER_TS,
    dueDate: null,
    lastPaymentTransactionId: null,
    voidReason: '',
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
    version: 1,
  });

  await adminSetDoc('invoices/inv_bkg_client_b_1', {
    invoiceNumber: clientBIssuedInvNumber,
    bookingId: 'bkg_client_b_1',
    customerId: 'client_client-b-1',
    invoiceStatus: 'issued',
    currency: 'IDR',
    ...baseClientASnapshots,
    customerSnapshot: {
      name: 'Client B Musician',
      phone: '081399990000',
      bandName: 'Bravo Trio',
    },
    amountPaid: 270000,
    balanceDue: 0,
    paymentStatus: 'paid',
    invoiceDate: SERVER_TS,
    dueDate: null,
    lastPaymentTransactionId: 'pay_client_b_1',
    voidReason: '',
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
    version: 1,
  });

  await adminSetDoc('paymentTransactions/pay_client_b_1', {
    invoiceId: 'inv_bkg_client_b_1',
    invoiceNumber: clientBIssuedInvNumber,
    bookingId: 'bkg_client_b_1',
    customerId: 'client_client-b-1',
    transactionType: 'payment',
    amount: 270000,
    currency: 'IDR',
    paymentMethod: 'cash',
    receivedAt: SERVER_TS,
    referenceNumber: '',
    notes: 'Client B full settlement',
    source: 'manual',
    reversalOfTransactionId: null,
    recordedByUid: 'owner-1',
    createdAt: SERVER_TS,
  });

  // Cross-customer parent mismatch fixture: tx claims Client A customerId, but links to Client B's invoice!
  await adminSetDoc('paymentTransactions/pay_cross_parent_mismatch', {
    invoiceId: 'inv_bkg_client_b_1',
    invoiceNumber: clientBIssuedInvNumber,
    bookingId: 'bkg_client_b_1',
    customerId: 'cust_email_matched',
    transactionType: 'payment',
    amount: 50000,
    currency: 'IDR',
    paymentMethod: 'cash',
    receivedAt: SERVER_TS,
    referenceNumber: '',
    notes: 'Mismatched parent invoice fixture',
    source: 'manual',
    reversalOfTransactionId: null,
    recordedByUid: 'owner-1',
    createdAt: SERVER_TS,
  });

  // Transaction linked to Client A's DRAFT invoice -> must ALSO be denied to Client A
  await adminSetDoc('paymentTransactions/pay_draft_parent', {
    invoiceId: 'inv_bkg_client_a_draft',
    invoiceNumber: clientADraftInvNumber,
    bookingId: 'bkg_client_a_draft',
    customerId: 'cust_email_matched',
    transactionType: 'payment',
    amount: 50000,
    currency: 'IDR',
    paymentMethod: 'cash',
    receivedAt: SERVER_TS,
    referenceNumber: '',
    notes: 'Draft parent invoice fixture',
    source: 'manual',
    reversalOfTransactionId: null,
    recordedByUid: 'owner-1',
    createdAt: SERVER_TS,
  });

  // Suspended Client (`client-new-1` -> `client_client-new-1`) invoice & payment
  await adminSetDoc('invoices/inv_bkg_suspended_1', {
    invoiceNumber: suspendedClientInvNumber,
    bookingId: 'bkg_suspended_1',
    customerId: 'client_client-new-1',
    invoiceStatus: 'issued',
    currency: 'IDR',
    ...baseClientASnapshots,
    amountPaid: 50000,
    balanceDue: 220000,
    paymentStatus: 'partial',
    invoiceDate: SERVER_TS,
    dueDate: null,
    lastPaymentTransactionId: 'pay_suspended_1',
    voidReason: '',
    createdAt: SERVER_TS,
    createdByUid: 'owner-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'owner-1',
    version: 1,
  });

  await adminSetDoc('paymentTransactions/pay_suspended_1', {
    invoiceId: 'inv_bkg_suspended_1',
    invoiceNumber: suspendedClientInvNumber,
    bookingId: 'bkg_suspended_1',
    customerId: 'client_client-new-1',
    transactionType: 'payment',
    amount: 50000,
    currency: 'IDR',
    paymentMethod: 'cash',
    receivedAt: SERVER_TS,
    referenceNumber: '',
    notes: '',
    source: 'manual',
    reversalOfTransactionId: null,
    recordedByUid: 'owner-1',
    createdAt: SERVER_TS,
  });

  // --- INVOICE ACCESS ASSERTIONS ---
  // 1. Client A reads own issued invoice -> ALLOW
  assert.equal(
    (await userRequest('GET', '/invoices/inv_bkg_client_portal_1', TOKEN_CLIENT_MATCHED)).status,
    200,
    'Client A can read own issued invoice',
  );
  // 2. Client A reads own void invoice -> ALLOW
  assert.equal(
    (await userRequest('GET', '/invoices/inv_bkg_client_a_void', TOKEN_CLIENT_MATCHED)).status,
    200,
    'Client A can read own void invoice',
  );
  // 3. Client A reads own draft invoice -> DENY
  assert.equal(
    (await userRequest('GET', '/invoices/inv_bkg_client_a_draft', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A MUST be denied reading own draft invoice',
  );
  // 4. Client A reads Client B invoice -> DENY (and vice versa)
  assert.equal(
    (await userRequest('GET', '/invoices/inv_bkg_client_b_1', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A denied reading Client B invoice',
  );
  assert.equal(
    (await userRequest('GET', '/invoices/inv_bkg_client_portal_1', TOKEN_CLIENT_B)).status,
    403,
    'Client B denied reading Client A invoice',
  );
  // 5. Client A queries invoices with own customerId + visible statuses -> ALLOW
  const clientAOwnInvoicesQueryRes = await userRequest('POST', ':runQuery', TOKEN_CLIENT_MATCHED, {
    structuredQuery: {
      from: [{ collectionId: 'invoices' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'customerId' },
                op: 'EQUAL',
                value: { stringValue: 'cust_email_matched' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'invoiceStatus' },
                op: 'IN',
                value: {
                  arrayValue: {
                    values: [{ stringValue: 'issued' }, { stringValue: 'void' }],
                  },
                },
              },
            },
          ],
        },
      },
      limit: 101,
    },
  });
  assert.equal(
    clientAOwnInvoicesQueryRes.status,
    200,
    `Client A own customerId invoices query failed: ${JSON.stringify(clientAOwnInvoicesQueryRes.body)}`,
  );
  const clientAQueriedInvIds = (
    Array.isArray(clientAOwnInvoicesQueryRes.body) ? clientAOwnInvoicesQueryRes.body : []
  )
    .map((row) => row?.document?.name?.split('/').pop())
    .filter(Boolean);
  assert.ok(
    clientAQueriedInvIds.includes('inv_bkg_client_portal_1') &&
      clientAQueriedInvIds.includes('inv_bkg_client_a_void'),
    'Client A query returns own issued and void invoices',
  );
  assert.ok(
    !clientAQueriedInvIds.includes('inv_bkg_client_a_draft') &&
      !clientAQueriedInvIds.includes('inv_bkg_client_b_1'),
    'Client A query never returns draft or Client B invoices',
  );

  // 6. Client A queries all invoices without owner scope (or queries draft status) -> DENY
  assert.equal(
    (await userRequest('GET', '/invoices', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A denied unfiltered invoices list',
  );
  const clientADraftQueryRes = await userRequest('POST', ':runQuery', TOKEN_CLIENT_MATCHED, {
    structuredQuery: {
      from: [{ collectionId: 'invoices' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'customerId' },
                op: 'EQUAL',
                value: { stringValue: 'cust_email_matched' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'invoiceStatus' },
                op: 'EQUAL',
                value: { stringValue: 'draft' },
              },
            },
          ],
        },
      },
      limit: 10,
    },
  });
  assert.equal(clientADraftQueryRes.status, 403, 'Client A denied querying draft invoices');

  // 7. Suspended Client reads invoice -> DENY
  assert.equal(
    (await userRequest('GET', '/invoices/inv_bkg_suspended_1', TOKEN_CLIENT_NEW)).status,
    403,
    'Suspended Client denied reading own invoice',
  );
  // 8. Anonymous user reads invoice -> DENY
  assert.equal(
    (await userRequest('GET', '/invoices/inv_bkg_client_portal_1', null)).status,
    403,
    'Anonymous user denied reading invoice',
  );
  // 9, 10, 11. Client create / update / delete invoice -> DENY
  const clientCreateInvAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_client_fake`,
          fields: toFsFields({
            invoiceNumber: '37MS-20261128-F1F1F1F1F1F1',
            bookingId: 'bkg_client_fake',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            ...baseClientASnapshots,
            amountPaid: 270000,
            balanceDue: 0,
            paymentStatus: 'paid',
            invoiceDate: SERVER_TS,
            dueDate: null,
            lastPaymentTransactionId: null,
            voidReason: '',
            createdAt: SERVER_TS,
            createdByUid: 'client-matched-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'client-matched-1',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(clientCreateInvAttempt.status, 403, 'Client denied creating invoice');

  const clientUpdateInvAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_client_portal_1`,
          fields: toFsFields({
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            ...baseClientASnapshots,
            amountPaid: 270000,
            balanceDue: 0,
            paymentStatus: 'paid',
            invoiceDate: clientAInvDateTs,
            dueDate: '2026-12-05',
            lastPaymentTransactionId: 'pay_cp_2',
            voidReason: '',
            createdAt: clientAInvCreatedTs,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'client-matched-1',
            version: 5,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(clientUpdateInvAttempt.status, 403, 'Client denied updating invoice');
  assert.equal(
    (await userRequest('DELETE', '/invoices/inv_bkg_client_portal_1', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client denied deleting invoice',
  );

  // --- PAYMENT TRANSACTION ACCESS ASSERTIONS ---
  // 1. Client A reads own payment -> ALLOW
  assert.equal(
    (await userRequest('GET', '/paymentTransactions/pay_cp_1', TOKEN_CLIENT_MATCHED)).status,
    200,
    'Client A can read own payment transaction',
  );
  // 2. Client A reads own reversal transaction -> ALLOW
  assert.equal(
    (await userRequest('GET', '/paymentTransactions/pay_rev_pay_cp_1', TOKEN_CLIENT_MATCHED)).status,
    200,
    'Client A can read own reversal transaction',
  );
  // Client A invoice-scoped transaction list query -> ALLOW
  const clientATxQueryRes = await userRequest('POST', ':runQuery', TOKEN_CLIENT_MATCHED, {
    structuredQuery: {
      from: [{ collectionId: 'paymentTransactions' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'customerId' },
                op: 'EQUAL',
                value: { stringValue: 'cust_email_matched' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'invoiceId' },
                op: 'EQUAL',
                value: { stringValue: 'inv_bkg_client_portal_1' },
              },
            },
          ],
        },
      },
      limit: 201,
    },
  });
  assert.equal(
    clientATxQueryRes.status,
    200,
    `Client A invoice-scoped paymentTransactions query failed: ${JSON.stringify(clientATxQueryRes.body)}`,
  );
  const clientATxIds = (Array.isArray(clientATxQueryRes.body) ? clientATxQueryRes.body : [])
    .map((row) => row?.document?.name?.split('/').pop())
    .filter(Boolean);
  assert.ok(
    clientATxIds.includes('pay_cp_1') &&
      clientATxIds.includes('pay_cp_2') &&
      clientATxIds.includes('pay_rev_pay_cp_1'),
    'Client A transaction query returns own payments and reversal',
  );

  // 3. Client A reads Client B payment -> DENY
  assert.equal(
    (await userRequest('GET', '/paymentTransactions/pay_client_b_1', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A denied reading Client B payment transaction',
  );
  // 4. Client A queries all transactions -> DENY
  assert.equal(
    (await userRequest('GET', '/paymentTransactions', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A denied querying all paymentTransactions',
  );
  // 5. Client A reads transaction linked to another customer's invoice (or draft parent) -> DENY
  assert.equal(
    (
      await userRequest(
        'GET',
        '/paymentTransactions/pay_cross_parent_mismatch',
        TOKEN_CLIENT_MATCHED,
      )
    ).status,
    403,
    'Client A denied reading transaction linked to another customer invoice',
  );
  assert.equal(
    (await userRequest('GET', '/paymentTransactions/pay_draft_parent', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A denied reading transaction linked to a draft parent invoice',
  );
  // 6, 7, 8. Client A creates / updates / deletes payment transaction -> DENY
  const clientCreateTxAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_client_forged_1`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_client_portal_1',
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            transactionType: 'payment',
            amount: 200000,
            currency: 'IDR',
            paymentMethod: 'qris',
            receivedAt: SERVER_TS,
            referenceNumber: 'FORGED-1',
            notes: '',
            source: 'manual',
            reversalOfTransactionId: null,
            recordedByUid: 'client-matched-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(clientCreateTxAttempt.status, 403, 'Client A denied creating paymentTransaction');

  const clientUpdateTxAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_cp_1`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_client_portal_1',
            invoiceNumber: clientAIssuedInvNumber,
            bookingId: 'bkg_client_portal_1',
            customerId: 'cust_email_matched',
            transactionType: 'payment',
            amount: 270000,
            currency: 'IDR',
            paymentMethod: 'transfer',
            receivedAt: SERVER_TS,
            referenceNumber: 'TAMPERED',
            notes: '',
            source: 'manual',
            reversalOfTransactionId: null,
            recordedByUid: 'staff-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(clientUpdateTxAttempt.status, 403, 'Client A denied updating paymentTransaction');
  assert.equal(
    (await userRequest('DELETE', '/paymentTransactions/pay_cp_1', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A denied deleting paymentTransaction',
  );

  // 9 & 10. Suspended Client & Anonymous user read payment history -> DENY
  assert.equal(
    (await userRequest('GET', '/paymentTransactions/pay_suspended_1', TOKEN_CLIENT_NEW)).status,
    403,
    'Suspended Client denied reading payment history',
  );
  assert.equal(
    (await userRequest('GET', '/paymentTransactions/pay_cp_1', null)).status,
    403,
    'Anonymous user denied reading payment history',
  );

  // Owner & Active Staff regression: can read all invoices (including draft & Client B)
  for (const staffOrOwnerToken of [TOKEN_OWNER, TOKEN_STAFF]) {
    assert.equal(
      (await userRequest('GET', '/invoices/inv_bkg_client_a_draft', staffOrOwnerToken)).status,
      200,
      'Owner/Staff can read draft invoices',
    );
    assert.equal(
      (await userRequest('GET', '/invoices/inv_bkg_client_b_1', staffOrOwnerToken)).status,
      200,
      'Owner/Staff can read Client B invoices',
    );
    assert.equal(
      (await userRequest('GET', '/invoices', staffOrOwnerToken)).status,
      200,
      'Owner/Staff can list all invoices',
    );
  }

  console.log(
    '✓ Client Portal Phase 4 rules (Client Billing invoices & paymentTransactions ownership, isolation & Admin regression) passed',
  );

  // 2G. Payment Evidence & Verification v1 Rules (`paymentEvidence`, `invoices`, `paymentTransactions`)
  const validCloudinaryEvidenceAsset = {
    provider: 'cloudinary',
    cloudName: 'demo37',
    cloudinaryPublicId: 'payment-evidence/pe_abcd1234',
    cloudinaryAssetId: 'asset_ev_1',
    secureUrl: 'https://res.cloudinary.com/demo37/image/upload/v1/payment-evidence/pe_abcd1234.jpg',
    resourceType: 'image',
    format: 'jpg',
    width: 1080,
    height: 1920,
    bytes: 245000,
  };

  // Seed Client A eligible Client Portal invoice (clientPaymentEvidenceRequired: true, balanceDue: 360000)
  const evEligibleInvNumber = '37MS-20261128-EVCLIENTA001';
  const evNonRequiredInvNumber = '37MS-20261128-EVADMIN00001';
  const evPaidInvNumber = '37MS-20261128-EVPAID000001';
  const evVoidInvNumber = '37MS-20261128-EVVOID000001';
  const evClientBInvNumber = '37MS-20261128-EVCLIENTB001';

  await adminSetDoc('bookings/bkg_ev_client_a', {
    customerId: 'cust_email_matched',
    customerName: 'Matched Client',
    date: '2026-11-28',
    studioId: 'room-a',
  });
  await adminSetDoc('bookings/bkg_ev_admin_manual', {
    customerId: 'cust_email_matched',
    customerName: 'Matched Client',
    date: '2026-11-28',
    studioId: 'room-b',
  });

  await adminSetDoc('invoices/inv_bkg_ev_client_a', {
    invoiceNumber: evEligibleInvNumber,
    bookingId: 'bkg_ev_client_a',
    customerId: 'cust_email_matched',
    invoiceStatus: 'issued',
    currency: 'IDR',
    customerSnapshot: { name: 'Matched Client', phone: '+6281234567890', bandName: 'Matched Band' },
    bookingSnapshot: {
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      studioId: 'room-a',
      bookingDate: '2026-11-28',
      startMinute: 600,
      endMinute: 780,
      durationMinutes: 180,
    },
    financialSnapshot: { subtotal: 360000, discountAmount: 0, totalAmount: 360000 },
    amountPaid: 0,
    balanceDue: 360000,
    paymentStatus: 'unpaid',
    invoiceDate: SERVER_TS,
    dueDate: '2026-11-29',
    lastPaymentTransactionId: null,
    voidReason: '',
    clientPaymentEvidenceRequired: true,
    createdAt: SERVER_TS,
    createdByUid: 'staff-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'staff-1',
    version: 1,
  });

  await adminSetDoc('invoices/inv_bkg_ev_admin_manual', {
    invoiceNumber: evNonRequiredInvNumber,
    bookingId: 'bkg_ev_admin_manual',
    customerId: 'cust_email_matched',
    invoiceStatus: 'issued',
    currency: 'IDR',
    customerSnapshot: { name: 'Matched Client', phone: '+6281234567890', bandName: '' },
    bookingSnapshot: {
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      studioId: 'room-b',
      bookingDate: '2026-11-28',
      startMinute: 840,
      endMinute: 960,
      durationMinutes: 120,
    },
    financialSnapshot: { subtotal: 240000, discountAmount: 0, totalAmount: 240000 },
    amountPaid: 0,
    balanceDue: 240000,
    paymentStatus: 'unpaid',
    invoiceDate: SERVER_TS,
    dueDate: null,
    lastPaymentTransactionId: null,
    voidReason: '',
    clientPaymentEvidenceRequired: false,
    createdAt: SERVER_TS,
    createdByUid: 'staff-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'staff-1',
    version: 1,
  });

  await adminSetDoc('invoices/inv_bkg_ev_paid', {
    invoiceNumber: evPaidInvNumber,
    bookingId: 'bkg_ev_paid',
    customerId: 'cust_email_matched',
    invoiceStatus: 'issued',
    currency: 'IDR',
    customerSnapshot: { name: 'Matched Client', phone: '+6281234567890', bandName: '' },
    bookingSnapshot: {
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      studioId: 'room-a',
      bookingDate: '2026-11-28',
      startMinute: 600,
      endMinute: 660,
      durationMinutes: 60,
    },
    financialSnapshot: { subtotal: 120000, discountAmount: 0, totalAmount: 120000 },
    amountPaid: 120000,
    balanceDue: 0,
    paymentStatus: 'paid',
    invoiceDate: SERVER_TS,
    dueDate: null,
    lastPaymentTransactionId: 'pay_ev_paid_1',
    voidReason: '',
    clientPaymentEvidenceRequired: true,
    createdAt: SERVER_TS,
    createdByUid: 'staff-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'staff-1',
    version: 2,
  });

  await adminSetDoc('invoices/inv_bkg_ev_void', {
    invoiceNumber: evVoidInvNumber,
    bookingId: 'bkg_ev_void',
    customerId: 'cust_email_matched',
    invoiceStatus: 'void',
    currency: 'IDR',
    customerSnapshot: { name: 'Matched Client', phone: '+6281234567890', bandName: '' },
    bookingSnapshot: {
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      studioId: 'room-a',
      bookingDate: '2026-11-28',
      startMinute: 600,
      endMinute: 660,
      durationMinutes: 60,
    },
    financialSnapshot: { subtotal: 120000, discountAmount: 0, totalAmount: 120000 },
    amountPaid: 0,
    balanceDue: 120000,
    paymentStatus: 'unpaid',
    invoiceDate: SERVER_TS,
    dueDate: null,
    lastPaymentTransactionId: null,
    voidReason: 'Cancelled session',
    clientPaymentEvidenceRequired: true,
    createdAt: SERVER_TS,
    createdByUid: 'staff-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'staff-1',
    version: 2,
  });

  await adminSetDoc('invoices/inv_bkg_ev_client_b', {
    invoiceNumber: evClientBInvNumber,
    bookingId: 'bkg_ev_client_b',
    customerId: 'client_client-b-1',
    invoiceStatus: 'issued',
    currency: 'IDR',
    customerSnapshot: { name: 'Client B Musician', phone: '+6281200000000', bandName: '' },
    bookingSnapshot: {
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      studioId: 'room-a',
      bookingDate: '2026-11-28',
      startMinute: 600,
      endMinute: 720,
      durationMinutes: 120,
    },
    financialSnapshot: { subtotal: 240000, discountAmount: 0, totalAmount: 240000 },
    amountPaid: 0,
    balanceDue: 240000,
    paymentStatus: 'unpaid',
    invoiceDate: SERVER_TS,
    dueDate: null,
    lastPaymentTransactionId: null,
    voidReason: '',
    clientPaymentEvidenceRequired: true,
    createdAt: SERVER_TS,
    createdByUid: 'staff-1',
    updatedAt: SERVER_TS,
    updatedByUid: 'staff-1',
    version: 1,
  });

  function makeClientEvidenceCreateWrite(evidenceId, overrides = {}) {
    return {
      writes: [
        {
          update: {
            name: `${DB_ROOT}/paymentEvidence/${evidenceId}`,
            fields: toFsFields({
              schemaVersion: 1,
              invoiceId: 'inv_bkg_ev_client_a',
              invoiceNumber: evEligibleInvNumber,
              bookingId: 'bkg_ev_client_a',
              customerId: 'cust_email_matched',
              clientUid: 'client-matched-1',
              evidenceSource: 'client_portal',
              status: 'pending_review',
              claimedAmount: 180000,
              paymentMethod: 'transfer',
              claimedPaidAt: '2026-11-28',
              referenceNumber: 'TRF-BCA-001',
              evidence: validCloudinaryEvidenceAsset,
              submittedByUid: 'client-matched-1',
              reviewedAt: null,
              reviewedByUid: '',
              rejectionReason: '',
              verifiedAmount: null,
              linkedTransactionId: null,
              version: 1,
              ...overrides,
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [
            { fieldPath: 'submittedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        },
      ],
    };
  }

  // 1. Active Client A creates valid `pending_review` evidence on own eligible invoice -> ALLOW
  const clientValidEvCreate = await userRequest(
    'POST',
    ':commit',
    TOKEN_CLIENT_MATCHED,
    makeClientEvidenceCreateWrite('ev_client_a_1'),
  );
  assert.equal(
    clientValidEvCreate.status,
    200,
    `Client A valid evidence create failed: ${JSON.stringify(clientValidEvCreate.body)}`,
  );

  // Create second evidence to test rejection flow later
  const clientValidEvCreate2 = await userRequest(
    'POST',
    ':commit',
    TOKEN_CLIENT_MATCHED,
    makeClientEvidenceCreateWrite('ev_client_a_reject', { claimedAmount: 180000 }),
  );
  assert.equal(clientValidEvCreate2.status, 200, 'Client A second evidence create allowed');

  // 2. Client A creates evidence for Client B's invoice -> DENY
  assert.equal(
    (
      await userRequest(
        'POST',
        ':commit',
        TOKEN_CLIENT_MATCHED,
        makeClientEvidenceCreateWrite('ev_cross_customer', {
          invoiceId: 'inv_bkg_ev_client_b',
          invoiceNumber: evClientBInvNumber,
          bookingId: 'bkg_ev_client_b',
          customerId: 'client_client-b-1',
        }),
      )
    ).status,
    403,
    'Client A denied submitting evidence for Client B invoice',
  );

  // 3. Client A creates evidence for non-eligible (`clientPaymentEvidenceRequired: false`), paid, void, or over-balance invoice -> DENY
  assert.equal(
    (
      await userRequest(
        'POST',
        ':commit',
        TOKEN_CLIENT_MATCHED,
        makeClientEvidenceCreateWrite('ev_non_required', {
          invoiceId: 'inv_bkg_ev_admin_manual',
          invoiceNumber: evNonRequiredInvNumber,
          bookingId: 'bkg_ev_admin_manual',
        }),
      )
    ).status,
    403,
    'Client A denied submitting evidence for admin-managed non-required invoice',
  );
  assert.equal(
    (
      await userRequest(
        'POST',
        ':commit',
        TOKEN_CLIENT_MATCHED,
        makeClientEvidenceCreateWrite('ev_paid_inv', {
          invoiceId: 'inv_bkg_ev_paid',
          invoiceNumber: evPaidInvNumber,
          bookingId: 'bkg_ev_paid',
          claimedAmount: 10000,
        }),
      )
    ).status,
    403,
    'Client A denied submitting evidence for already-paid invoice',
  );
  assert.equal(
    (
      await userRequest(
        'POST',
        ':commit',
        TOKEN_CLIENT_MATCHED,
        makeClientEvidenceCreateWrite('ev_void_inv', {
          invoiceId: 'inv_bkg_ev_void',
          invoiceNumber: evVoidInvNumber,
          bookingId: 'bkg_ev_void',
          claimedAmount: 10000,
        }),
      )
    ).status,
    403,
    'Client A denied submitting evidence for void invoice',
  );
  assert.equal(
    (
      await userRequest(
        'POST',
        ':commit',
        TOKEN_CLIENT_MATCHED,
        makeClientEvidenceCreateWrite('ev_over_balance', { claimedAmount: 500000 }),
      )
    ).status,
    403,
    'Client A denied submitting evidence exceeding balanceDue',
  );

  // 4. Client A creates forged `verified`, `rejected`, `attached`, or non-Cloudinary / HTTP URL -> DENY
  for (const [label, patch] of [
    ['forged verified', { status: 'verified', verifiedAmount: 180000, reviewedByUid: 'client-matched-1' }],
    ['forged rejected', { status: 'rejected', rejectionReason: 'forged' }],
    ['forged attached', { status: 'attached', evidenceSource: 'admin_manual' }],
    [
      'non-cloudinary url',
      {
        evidence: {
          ...validCloudinaryEvidenceAsset,
          secureUrl: 'https://evil.example.com/demo37/image/upload/v1/x.jpg',
        },
      },
    ],
    [
      'insecure http cloudinary url',
      {
        evidence: {
          ...validCloudinaryEvidenceAsset,
          secureUrl: 'http://res.cloudinary.com/demo37/image/upload/v1/x.jpg',
        },
      },
    ],
    [
      'mismatched cloudName url',
      {
        evidence: {
          ...validCloudinaryEvidenceAsset,
          cloudName: 'othercloud',
        },
      },
    ],
  ]) {
    assert.equal(
      (
        await userRequest(
          'POST',
          ':commit',
          TOKEN_CLIENT_MATCHED,
          makeClientEvidenceCreateWrite(`ev_bad_${label.replace(/\W+/g, '_')}`, patch),
        )
      ).status,
      403,
      `Client A denied creating evidence with ${label}`,
    );
  }

  // 5. Suspended Client & Anonymous denied creating or reading evidence
  assert.equal(
    (
      await userRequest(
        'POST',
        ':commit',
        TOKEN_CLIENT_NEW,
        makeClientEvidenceCreateWrite('ev_suspended_create', {
          clientUid: 'client-new-1',
          submittedByUid: 'client-new-1',
        }),
      )
    ).status,
    403,
    'Suspended Client denied creating evidence',
  );
  assert.equal(
    (
      await userRequest(
        'POST',
        ':commit',
        null,
        makeClientEvidenceCreateWrite('ev_anon_create'),
      )
    ).status,
    403,
    'Anonymous user denied creating evidence',
  );

  // 6. Client A reads own evidence (GET + scoped LIST), Client B / Suspended / Anon DENIED
  assert.equal(
    (await userRequest('GET', '/paymentEvidence/ev_client_a_1', TOKEN_CLIENT_MATCHED)).status,
    200,
    'Client A can GET own paymentEvidence',
  );
  const clientAListEv = await userRequest('POST', ':runQuery', TOKEN_CLIENT_MATCHED, {
    structuredQuery: {
      from: [{ collectionId: 'paymentEvidence' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'customerId' },
          op: 'EQUAL',
          value: { stringValue: 'cust_email_matched' },
        },
      },
    },
  });
  assert.equal(clientAListEv.status, 200, 'Client A can LIST own scoped paymentEvidence');
  assert.equal(
    (await userRequest('GET', '/paymentEvidence/ev_client_a_1', TOKEN_CLIENT_B)).status,
    403,
    'Client B denied reading Client A paymentEvidence',
  );
  assert.equal(
    (await userRequest('GET', '/paymentEvidence/ev_client_a_1', TOKEN_CLIENT_NEW)).status,
    403,
    'Suspended Client denied reading paymentEvidence',
  );
  assert.equal(
    (await userRequest('GET', '/paymentEvidence/ev_client_a_1', null)).status,
    403,
    'Anonymous user denied reading paymentEvidence',
  );
  assert.equal(
    (await userRequest('GET', '/paymentEvidence', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A denied unscoped paymentEvidence collection list',
  );

  // 7. Client A denied updating or deleting paymentEvidence
  assert.equal(
    (await userRequest('DELETE', '/paymentEvidence/ev_client_a_1', TOKEN_CLIENT_MATCHED)).status,
    403,
    'Client A denied deleting paymentEvidence',
  );
  const clientEvDocRes = await userRequest('GET', '/paymentEvidence/ev_client_a_1', TOKEN_STAFF);
  assert.equal(clientEvDocRes.status, 200, 'Staff can read Client A paymentEvidence');
  const evSubmittedTs = { _ts: clientEvDocRes.body.fields.submittedAt.timestampValue };

  const clientUpdateEvAttempt = await userRequest('POST', ':commit', TOKEN_CLIENT_MATCHED, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentEvidence/ev_client_a_1`,
          fields: toFsFields({
            schemaVersion: 1,
            invoiceId: 'inv_bkg_ev_client_a',
            invoiceNumber: evEligibleInvNumber,
            bookingId: 'bkg_ev_client_a',
            customerId: 'cust_email_matched',
            clientUid: 'client-matched-1',
            evidenceSource: 'client_portal',
            status: 'verified',
            claimedAmount: 180000,
            paymentMethod: 'transfer',
            claimedPaidAt: '2026-11-28',
            referenceNumber: 'TRF-BCA-001',
            evidence: validCloudinaryEvidenceAsset,
            submittedByUid: 'client-matched-1',
            submittedAt: evSubmittedTs,
            reviewedAt: SERVER_TS,
            reviewedByUid: 'client-matched-1',
            rejectionReason: '',
            verifiedAmount: 180000,
            linkedTransactionId: 'pay_evidence_ev_client_a_1',
            createdAt: evSubmittedTs,
            updatedAt: SERVER_TS,
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(clientUpdateEvAttempt.status, 403, 'Client A denied updating paymentEvidence');

  // 8. Staff CANNOT bypass clientPaymentEvidenceRequired invoice with manual payment transaction!
  const staffManualBypassRes = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_bypass_attempt`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_ev_client_a',
            invoiceNumber: evEligibleInvNumber,
            bookingId: 'bkg_ev_client_a',
            customerId: 'cust_email_matched',
            transactionType: 'payment',
            amount: 180000,
            currency: 'IDR',
            paymentMethod: 'transfer',
            receivedAt: SERVER_TS,
            referenceNumber: '',
            notes: 'Bypass attempt',
            source: 'manual',
            reversalOfTransactionId: null,
            recordedByUid: 'staff-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_ev_client_a`,
          fields: toFsFields({
            invoiceNumber: evEligibleInvNumber,
            bookingId: 'bkg_ev_client_a',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            customerSnapshot: {
              name: 'Matched Client',
              phone: '+6281234567890',
              bandName: 'Matched Band',
            },
            bookingSnapshot: {
              serviceTypeName: 'Rehearsal',
              serviceOptionName: 'Reguler',
              studioId: 'room-a',
              bookingDate: '2026-11-28',
              startMinute: 600,
              endMinute: 780,
              durationMinutes: 180,
            },
            financialSnapshot: { subtotal: 360000, discountAmount: 0, totalAmount: 360000 },
            amountPaid: 180000,
            balanceDue: 180000,
            paymentStatus: 'partial',
            invoiceDate: SERVER_TS,
            dueDate: '2026-11-29',
            lastPaymentTransactionId: 'pay_bypass_attempt',
            voidReason: '',
            clientPaymentEvidenceRequired: true,
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    staffManualBypassRes.status,
    403,
    'Staff denied bypassing clientPaymentEvidenceRequired invoice with manual payment',
  );

  // 9. Staff atomically verifies Client A's pending evidence (updates evidence + creates pay_evidence_* tx + updates invoice) -> ALLOW
  const staffVerifyCommit = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentEvidence/ev_client_a_1`,
          fields: toFsFields({
            schemaVersion: 1,
            invoiceId: 'inv_bkg_ev_client_a',
            invoiceNumber: evEligibleInvNumber,
            bookingId: 'bkg_ev_client_a',
            customerId: 'cust_email_matched',
            clientUid: 'client-matched-1',
            evidenceSource: 'client_portal',
            status: 'verified',
            claimedAmount: 180000,
            paymentMethod: 'transfer',
            claimedPaidAt: '2026-11-28',
            referenceNumber: 'TRF-BCA-001',
            evidence: validCloudinaryEvidenceAsset,
            submittedByUid: 'client-matched-1',
            submittedAt: evSubmittedTs,
            reviewedAt: SERVER_TS,
            reviewedByUid: 'staff-1',
            rejectionReason: '',
            verifiedAmount: 180000,
            linkedTransactionId: 'pay_evidence_ev_client_a_1',
            createdAt: evSubmittedTs,
            updatedAt: SERVER_TS,
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_evidence_ev_client_a_1`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_ev_client_a',
            invoiceNumber: evEligibleInvNumber,
            bookingId: 'bkg_ev_client_a',
            customerId: 'cust_email_matched',
            transactionType: 'payment',
            amount: 180000,
            currency: 'IDR',
            paymentMethod: 'transfer',
            receivedAt: SERVER_TS,
            referenceNumber: 'TRF-BCA-001',
            notes: 'Verified transfer proof',
            source: 'client_evidence_verified',
            reversalOfTransactionId: null,
            recordedByUid: 'staff-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_ev_client_a`,
          fields: toFsFields({
            invoiceNumber: evEligibleInvNumber,
            bookingId: 'bkg_ev_client_a',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            customerSnapshot: {
              name: 'Matched Client',
              phone: '+6281234567890',
              bandName: 'Matched Band',
            },
            bookingSnapshot: {
              serviceTypeName: 'Rehearsal',
              serviceOptionName: 'Reguler',
              studioId: 'room-a',
              bookingDate: '2026-11-28',
              startMinute: 600,
              endMinute: 780,
              durationMinutes: 180,
            },
            financialSnapshot: { subtotal: 360000, discountAmount: 0, totalAmount: 360000 },
            amountPaid: 180000,
            balanceDue: 180000,
            paymentStatus: 'partial',
            invoiceDate: SERVER_TS,
            dueDate: '2026-11-29',
            lastPaymentTransactionId: 'pay_evidence_ev_client_a_1',
            voidReason: '',
            clientPaymentEvidenceRequired: true,
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    staffVerifyCommit.status,
    200,
    `Staff atomic evidence verification failed: ${JSON.stringify(staffVerifyCommit.body)}`,
  );

  // 10. Staff rejects pending evidence with valid reason (ALLOW) and without reason (DENY)
  const evRejectDoc = await userRequest('GET', '/paymentEvidence/ev_client_a_reject', TOKEN_STAFF);
  const evRejectSubmittedTs = { _ts: evRejectDoc.body.fields.submittedAt.timestampValue };
  const staffBadReject = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentEvidence/ev_client_a_reject`,
          fields: toFsFields({
            schemaVersion: 1,
            invoiceId: 'inv_bkg_ev_client_a',
            invoiceNumber: evEligibleInvNumber,
            bookingId: 'bkg_ev_client_a',
            customerId: 'cust_email_matched',
            clientUid: 'client-matched-1',
            evidenceSource: 'client_portal',
            status: 'rejected',
            claimedAmount: 180000,
            paymentMethod: 'transfer',
            claimedPaidAt: '2026-11-28',
            referenceNumber: 'TRF-BCA-001',
            evidence: validCloudinaryEvidenceAsset,
            submittedByUid: 'client-matched-1',
            submittedAt: evRejectSubmittedTs,
            reviewedAt: SERVER_TS,
            reviewedByUid: 'staff-1',
            rejectionReason: 'x',
            verifiedAmount: null,
            linkedTransactionId: null,
            createdAt: evRejectSubmittedTs,
            updatedAt: SERVER_TS,
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(staffBadReject.status, 403, 'Staff denied rejecting without >= 3 char reason');

  const staffGoodReject = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentEvidence/ev_client_a_reject`,
          fields: toFsFields({
            schemaVersion: 1,
            invoiceId: 'inv_bkg_ev_client_a',
            invoiceNumber: evEligibleInvNumber,
            bookingId: 'bkg_ev_client_a',
            customerId: 'cust_email_matched',
            clientUid: 'client-matched-1',
            evidenceSource: 'client_portal',
            status: 'rejected',
            claimedAmount: 180000,
            paymentMethod: 'transfer',
            claimedPaidAt: '2026-11-28',
            referenceNumber: 'TRF-BCA-001',
            evidence: validCloudinaryEvidenceAsset,
            submittedByUid: 'client-matched-1',
            submittedAt: evRejectSubmittedTs,
            reviewedAt: SERVER_TS,
            reviewedByUid: 'staff-1',
            rejectionReason: 'Bukti transfer buram, mohon unggah ulang.',
            verifiedAmount: null,
            linkedTransactionId: null,
            createdAt: evRejectSubmittedTs,
            updatedAt: SERVER_TS,
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
    ],
  });
  assert.equal(
    staffGoodReject.status,
    200,
    `Staff valid evidence rejection failed: ${JSON.stringify(staffGoodReject.body)}`,
  );

  // 11. Staff creates optional `admin_manual` `attached` evidence atomically with manual payment on non-Client-Portal invoice -> ALLOW
  const staffAttachCommit = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentTransactions/pay_admin_attached_1`,
          fields: toFsFields({
            invoiceId: 'inv_bkg_ev_admin_manual',
            invoiceNumber: evNonRequiredInvNumber,
            bookingId: 'bkg_ev_admin_manual',
            customerId: 'cust_email_matched',
            transactionType: 'payment',
            amount: 120000,
            currency: 'IDR',
            paymentMethod: 'transfer',
            receivedAt: SERVER_TS,
            referenceNumber: 'TRF-STUDIO-77',
            notes: 'Manual payment with optional proof',
            source: 'manual',
            reversalOfTransactionId: null,
            recordedByUid: 'staff-1',
            createdAt: SERVER_TS,
          }),
        },
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${DB_ROOT}/invoices/inv_bkg_ev_admin_manual`,
          fields: toFsFields({
            invoiceNumber: evNonRequiredInvNumber,
            bookingId: 'bkg_ev_admin_manual',
            customerId: 'cust_email_matched',
            invoiceStatus: 'issued',
            currency: 'IDR',
            customerSnapshot: { name: 'Matched Client', phone: '+6281234567890', bandName: '' },
            bookingSnapshot: {
              serviceTypeName: 'Rehearsal',
              serviceOptionName: 'Reguler',
              studioId: 'room-b',
              bookingDate: '2026-11-28',
              startMinute: 840,
              endMinute: 960,
              durationMinutes: 120,
            },
            financialSnapshot: { subtotal: 240000, discountAmount: 0, totalAmount: 240000 },
            amountPaid: 120000,
            balanceDue: 120000,
            paymentStatus: 'partial',
            invoiceDate: SERVER_TS,
            dueDate: null,
            lastPaymentTransactionId: 'pay_admin_attached_1',
            voidReason: '',
            clientPaymentEvidenceRequired: false,
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 2,
          }),
        },
        currentDocument: { exists: true },
      },
      {
        update: {
          name: `${DB_ROOT}/paymentEvidence/ev_admin_attached_1`,
          fields: toFsFields({
            schemaVersion: 1,
            invoiceId: 'inv_bkg_ev_admin_manual',
            invoiceNumber: evNonRequiredInvNumber,
            bookingId: 'bkg_ev_admin_manual',
            customerId: 'cust_email_matched',
            clientUid: '',
            evidenceSource: 'admin_manual',
            status: 'attached',
            claimedAmount: 120000,
            paymentMethod: 'transfer',
            claimedPaidAt: '2026-11-28',
            referenceNumber: 'TRF-STUDIO-77',
            evidence: validCloudinaryEvidenceAsset,
            submittedByUid: 'staff-1',
            submittedAt: SERVER_TS,
            reviewedAt: null,
            reviewedByUid: '',
            rejectionReason: '',
            verifiedAmount: 120000,
            linkedTransactionId: 'pay_admin_attached_1',
            createdAt: SERVER_TS,
            updatedAt: SERVER_TS,
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    staffAttachCommit.status,
    200,
    `Staff optional admin_manual evidence attach failed: ${JSON.stringify(staffAttachCommit.body)}`,
  );

  // 12. Staff denied attaching admin_manual evidence pointing to mismatched/non-existent transaction
  const staffBadAttach = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/paymentEvidence/ev_admin_bad_tx`,
          fields: toFsFields({
            schemaVersion: 1,
            invoiceId: 'inv_bkg_ev_admin_manual',
            invoiceNumber: evNonRequiredInvNumber,
            bookingId: 'bkg_ev_admin_manual',
            customerId: 'cust_email_matched',
            clientUid: '',
            evidenceSource: 'admin_manual',
            status: 'attached',
            claimedAmount: 120000,
            paymentMethod: 'transfer',
            claimedPaidAt: '2026-11-28',
            referenceNumber: '',
            evidence: validCloudinaryEvidenceAsset,
            submittedByUid: 'staff-1',
            submittedAt: SERVER_TS,
            reviewedAt: null,
            reviewedByUid: '',
            rejectionReason: '',
            verifiedAmount: 120000,
            linkedTransactionId: 'pay_does_not_exist',
            createdAt: SERVER_TS,
            updatedAt: SERVER_TS,
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(
    staffBadAttach.status,
    403,
    'Staff denied creating admin_manual evidence linked to missing transaction',
  );

  console.log(
    '✓ Payment Evidence & Verification v1 rules (Client upload/isolation, Staff atomic verify/reject, manual bypass block & admin optional attachment) passed',
  );

  // 3. systemOperations/factoryReset read & start authorization
  assert.equal(
    (await userRequest('GET', '/systemOperations/factoryReset', TOKEN_STAFF)).status,
    403,
    'Staff cannot read factoryReset manifest',
  );
  assert.equal(
    (await userRequest('GET', '/systemOperations/factoryReset', TOKEN_INACTIVE_OWNER)).status,
    403,
    'Inactive Owner cannot read factoryReset manifest',
  );

  const invalidStartPayload = makeResetOpWrite(
    {
      schemaVersion: 1,
      operationId: 'reset_op_0001',
      status: 'running',
      initiatedByUid: 'staff-1',
      currentCollection: 'bookings',
      lastProcessedDocumentId: '',
      completedCollections: [],
      deletedDocumentCounts: {},
      totalDeletedCount: 0,
      completedAt: null,
      lastErrorCode: '',
      lastErrorMessage: '',
      verificationSummary: null,
    },
    true,
  );
  assert.equal(
    (await userRequest('POST', ':commit', TOKEN_STAFF, invalidStartPayload)).status,
    403,
    'Staff cannot start Factory Reset',
  );
  assert.equal(
    (await userRequest('POST', ':commit', null, invalidStartPayload)).status,
    403,
    'Unauthenticated visitor cannot set reset status',
  );

  // Owner starts valid Factory Reset
  const validStartPayload = makeResetOpWrite(
    {
      schemaVersion: 1,
      operationId: 'reset_op_0001',
      status: 'running',
      initiatedByUid: 'owner-1',
      currentCollection: 'publicBookingRequests_communications',
      lastProcessedDocumentId: '',
      completedCollections: [],
      deletedDocumentCounts: {},
      totalDeletedCount: 0,
      completedAt: null,
      lastErrorCode: '',
      lastErrorMessage: '',
      verificationSummary: null,
    },
    true,
  );
  const startRes = await userRequest('POST', ':commit', TOKEN_OWNER, validStartPayload);
  assert.equal(startRes.status, 200, `Owner start failed: ${JSON.stringify(startRes.body)}`);
  const startedOpRes = await userRequest('GET', '/systemOperations/factoryReset', TOKEN_OWNER);
  assert.equal(startedOpRes.status, 200, 'Owner can read reset manifest');
  assert.ok(
    startedOpRes.body?.fields?.initiatedAt?.timestampValue,
    `Missing initiatedAt in started reset doc: ${JSON.stringify(startedOpRes.body)}`,
  );
  const opInitiatedAt = { _ts: startedOpRes.body.fields.initiatedAt.timestampValue };
  const opStartedAt = { _ts: startedOpRes.body.fields.startedAt.timestampValue };
  console.log('✓ Reset manifest RBAC (Owner vs Staff vs Unauth) passed');

  // 4. WHILE RUNNING: Maintenance lock blocks normal operational writes
  const lockedBookingCreate = await userRequest('POST', ':commit', TOKEN_STAFF, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/customers/cust_blocked`,
          fields: toFsFields({
            displayName: 'Blocked',
            normalizedName: 'blocked',
            phoneDisplay: '+62 811-1111-1111',
            phoneNormalized: '+6281111111111',
            nameAliases: [],
            previousPhones: [],
            status: 'active',
            mergedIntoCustomerId: null,
            historyCustomerIds: ['cust_blocked'],
            bookingCount: 0,
            firstBookingDate: '2026-11-26',
            lastBookingDate: '2026-11-26',
            notes: '',
            createdAt: SERVER_TS,
            createdByUid: 'staff-1',
            updatedAt: SERVER_TS,
            updatedByUid: 'staff-1',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
      },
    ],
  });
  assert.equal(lockedBookingCreate.status, 403, 'Maintenance lock blocks new customer writes');

  const lockedPublicReq = await userRequest('POST', ':commit', null, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicBookingRequests/req_blocked_during_reset`,
          fields: toFsFields({
            schemaVersion: 1,
            requestReference: 'REQ-99998888',
            requestType: 'post_production_inquiry',
            status: 'new',
            statusReason: '',
            customerName: 'Public User',
            bandName: '',
            contactPhone: '+6281234567890',
            publicServiceId: 'mix-master',
            serviceLabelSnapshot: 'Mix & Master',
            requestedRoomId: null,
            preferredDate: null,
            preferredStartMinute: null,
            preferredDurationMinutes: null,
            targetDeadline: null,
            notes: '',
            privacyConsent: true,
            consentVersion: 'v1',
            source: 'public_landing_page',
            assignedStaffUid: '',
            assignedStaffName: '',
            lastCommunicationAt: null,
            lastCommunicationType: '',
            lastCommunicationStatus: '',
            linkedBookingId: null,
            confirmedBookingSnapshot: null,
            confirmedAt: null,
            confirmedByUid: '',
            appCheckState: 'unconfigured',
            updatedByUid: '',
            version: 1,
          }),
        },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
    ],
  });
  assert.equal(lockedPublicReq.status, 403, 'Maintenance lock blocks new publicBookingRequests');
  console.log('✓ Maintenance lock blocks operational mutations while running');

  // 5. WHILE RUNNING: Staff & Unauthenticated STILL denied deleting; Owner denied deleting PRESERVED collections!
  assert.equal(
    (await userRequest('DELETE', '/bookings/bkg_1', TOKEN_STAFF)).status,
    403,
    'Staff denied deleting even while reset running',
  );
  assert.equal(
    (await userRequest('DELETE', '/bookings/bkg_1', null)).status,
    403,
    'Unauth denied deleting even while reset running',
  );
  for (const preservedPath of preservedDeletePaths) {
    assert.equal(
      (await userRequest('DELETE', `/${preservedPath}`, TOKEN_OWNER)).status,
      403,
      `Owner CANNOT delete preserved path ${preservedPath} during reset`,
    );
  }
  assert.equal(
    (await userRequest('DELETE', '/systemOperations/factoryReset', TOKEN_OWNER)).status,
    403,
    'Owner CANNOT delete systemOperations/factoryReset audit doc',
  );
  assert.equal(
    (await userRequest('DELETE', '/clientAccounts/client-matched-1', TOKEN_OWNER)).status,
    403,
    'Owner CANNOT delete clientAccounts even during running Factory Reset',
  );
  console.log('✓ Preserved targets & Staff/Unauth delete protection passed');

  // 6. WHILE RUNNING: Owner CAN batch delete up to 10 operational docs in a single writeBatch, plus every targeted path
  const tenBatchDeletes = [
    ...Array.from({ length: 10 }, (_, idx) => ({
      delete: `${DB_ROOT}/bookingSlots/2026-11-26__room-a__${600 + idx * 30}`,
    })),
  ];
  const tenBatchRes = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: tenBatchDeletes,
  });
  assert.equal(
    tenBatchRes.status,
    200,
    `Owner 10-doc writeBatch delete failed: ${JSON.stringify(tenBatchRes.body)}`,
  );

  for (const opPath of operationalDeletePaths) {
    const delRes = await userRequest('DELETE', `/${opPath}`, TOKEN_OWNER);
    assert.equal(delRes.status, 200, `Owner reset delete failed for ${opPath}: ${delRes.status}`);
  }
  console.log('✓ Owner 10-doc batch delete & all 21 operational manifest targets passed');

  // 7. Public site settings & public pricing catalog remain readable; publicBookingRequests inaccessible after deletion
  assert.equal((await userRequest('GET', '/publicSiteSettings/site', null)).status, 200);
  assert.equal((await userRequest('GET', '/publicPricingCatalog/current', null)).status, 200);
  assert.equal((await userRequest('GET', '/publicBookingRequests/req_1', null)).status, 403);

  // 8. Owner can update progress, fail-guard unsafe cancel after deletion, pause, resume, reinit publicAvailabilityMetadata, and complete ONLY with verificationSummary.allZero == true
  const progressUpdate = await userRequest(
    'POST',
    ':commit',
    TOKEN_OWNER,
    makeResetOpWrite(
      {
        schemaVersion: 1,
        operationId: 'reset_op_0001',
        status: 'paused',
        initiatedByUid: 'owner-1',
        currentCollection: 'bookings',
        lastProcessedDocumentId: 'bkg_1',
        completedCollections: ['publicBookingRequests_communications'],
        deletedDocumentCounts: { bookings: 1 },
        totalDeletedCount: 1,
        initiatedAt: opInitiatedAt,
        startedAt: opStartedAt,
        completedAt: null,
        lastErrorCode: '',
        lastErrorMessage: '',
        verificationSummary: null,
      },
      false,
    ),
  );
  assert.equal(
    progressUpdate.status,
    200,
    `Pause update failed: ${JSON.stringify(progressUpdate.body)}`,
  );

  // While PAUSED: Owner cannot delete operational docs, and CANNOT cancel after deletion!
  assert.equal(
    (await userRequest('DELETE', '/customers/cust_tx_new', TOKEN_OWNER)).status,
    403,
    'Owner denied deleting while paused',
  );
  const unsafeCancel = await userRequest(
    'POST',
    ':commit',
    TOKEN_OWNER,
    makeResetOpWrite(
      {
        schemaVersion: 1,
        operationId: 'reset_op_0001',
        status: 'cancelled',
        initiatedByUid: 'owner-1',
        currentCollection: '',
        lastProcessedDocumentId: '',
        completedCollections: ['publicBookingRequests_communications'],
        deletedDocumentCounts: { bookings: 1 },
        totalDeletedCount: 1,
        initiatedAt: opInitiatedAt,
        startedAt: opStartedAt,
        completedAt: null,
        lastErrorCode: '',
        lastErrorMessage: 'Attempted unsafe cancel',
        verificationSummary: null,
      },
      false,
    ),
  );
  assert.equal(unsafeCancel.status, 403, 'Cannot cancel reset after deletion occurred');

  // Resume (preserve operationId & counts)
  const resumeRes = await userRequest(
    'POST',
    ':commit',
    TOKEN_OWNER,
    makeResetOpWrite(
      {
        schemaVersion: 1,
        operationId: 'reset_op_0001',
        status: 'running',
        initiatedByUid: 'owner-1',
        currentCollection: 'bookings',
        lastProcessedDocumentId: 'bkg_1',
        completedCollections: ['publicBookingRequests_communications'],
        deletedDocumentCounts: { bookings: 1 },
        totalDeletedCount: 1,
        initiatedAt: opInitiatedAt,
        startedAt: opStartedAt,
        completedAt: null,
        lastErrorCode: '',
        lastErrorMessage: '',
        verificationSummary: null,
      },
      false,
    ),
  );
  assert.equal(resumeRes.status, 200, 'Owner can resume paused reset with immutable ID');

  // Reinitialize publicAvailabilityMetadata/status while running
  const reinitMetaRes = await userRequest('POST', ':commit', TOKEN_OWNER, {
    writes: [
      {
        update: {
          name: `${DB_ROOT}/publicAvailabilityMetadata/status`,
          fields: toFsFields({
            schemaVersion: 1,
            isReady: true,
            backfilledFromDate: '2026-11-22',
          }),
        },
        updateTransforms: [
          { fieldPath: 'backfillCompletedAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
    ],
  });
  assert.equal(reinitMetaRes.status, 200, 'Owner can reinitialize publicAvailabilityMetadata');

  // Complete without verificationSummary.allZero == true must be denied
  const invalidComplete = await userRequest(
    'POST',
    ':commit',
    TOKEN_OWNER,
    makeResetOpWrite(
      {
        schemaVersion: 1,
        operationId: 'reset_op_0001',
        status: 'completed',
        initiatedByUid: 'owner-1',
        currentCollection: '',
        lastProcessedDocumentId: '',
        completedCollections: ['bookings'],
        deletedDocumentCounts: { bookings: 1 },
        totalDeletedCount: 1,
        initiatedAt: opInitiatedAt,
        startedAt: opStartedAt,
        lastErrorCode: '',
        lastErrorMessage: '',
        verificationSummary: { allZero: false, checkedCollectionsCount: 21, remainingTotal: 2 },
      },
      false,
    ),
  );
  assert.equal(invalidComplete.status, 403, 'Cannot complete reset with non-zero remainingTotal');

  // Valid completion
  const validComplete = await userRequest(
    'POST',
    ':commit',
    TOKEN_OWNER,
    makeResetOpWrite(
      {
        schemaVersion: 1,
        operationId: 'reset_op_0001',
        status: 'completed',
        initiatedByUid: 'owner-1',
        currentCollection: '',
        lastProcessedDocumentId: '',
        completedCollections: ['bookings'],
        deletedDocumentCounts: { bookings: 1 },
        totalDeletedCount: 1,
        initiatedAt: opInitiatedAt,
        startedAt: opStartedAt,
        lastErrorCode: '',
        lastErrorMessage: '',
        verificationSummary: { allZero: true, checkedCollectionsCount: 21, remainingTotal: 0 },
      },
      false,
    ),
  );
  assert.equal(
    validComplete.status,
    200,
    `Valid reset completion failed: ${JSON.stringify(validComplete.body)}`,
  );

  // AFTER COMPLETED: Owner can NO LONGER delete operational docs, and normal writes work again!
  assert.equal(
    (await userRequest('DELETE', '/customers/cust_tx_new', TOKEN_OWNER)).status,
    403,
    'Owner denied deleting after reset completed',
  );
  console.log('✓ Pause/Resume/Completion state transitions & post-complete unlock passed');

  console.log('\nALL FIRESTORE SECURITY RULES TESTS PASSED (REAL EMULATOR)!');
}

runTests().catch((err) => {
  console.error('FIRESTORE RULES TEST FAILED:', err);
  process.exit(1);
});
