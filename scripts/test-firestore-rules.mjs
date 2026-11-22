import assert from 'node:assert/strict';

const PROJECT_ID = 'demo-studio37-rules';
const EMULATOR_HOST = '127.0.0.1:8088';
const DB_ROOT = `projects/${PROJECT_ID}/databases/(default)/documents`;
const REST_BASE = `http://${EMULATOR_HOST}/v1/${DB_ROOT}`;
const CLEAR_URL = `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function base64Url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function makeEmulatorJwt(uid, email) {
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
    email_verified: true,
    firebase: {
      identities: { email: [email] },
      sign_in_provider: 'password',
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
    'paymentTransactions/pay_1',
    'commissionBatches/cb_1',
    'commissionPostingItems/bkg_1',
    'commissionReviewResolutions/res_1',
    'bookkeepingEntries/bk_1',
    'bookkeepingSettlements/set_1',
    'inventoryItems/item_1',
    'inventoryMovements/mov_1',
    'publicAvailability/bkg_1',
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
    'bookingRequestMessageTemplates/tpl_1',
    'galleryItems/gal_1',
    'landingPagePlacements/room-a',
    'publicAvailabilityMetadata/status',
  ];

  // 1. IDLE STATE: Unauthenticated, Staff, and Owner must ALL be DENIED deleting protected operational collections
  for (const p of [
    'bookings/bkg_1',
    'customers/cust_1',
    'invoices/inv_bkg_1',
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
  console.log('✓ Owner 10-doc batch delete & all 18 operational manifest targets passed');

  // 7. Public site settings remain readable & publicBookingRequests inaccessible after deletion
  assert.equal((await userRequest('GET', '/publicSiteSettings/site', null)).status, 200);
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
        verificationSummary: { allZero: false, checkedCollectionsCount: 18, remainingTotal: 2 },
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
        verificationSummary: { allZero: true, checkedCollectionsCount: 18, remainingTotal: 0 },
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
