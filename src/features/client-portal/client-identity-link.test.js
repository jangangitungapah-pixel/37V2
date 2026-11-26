import { describe, expect, it } from 'vitest';

import { createInMemoryCustomerRepositoryAdapter } from '@/features/admin/customer/repositories/customer-repository';
import { createManualCustomer } from '@/features/admin/customer/services/customer-service';

import {
  createInMemoryClientPortalRepositoryAdapter,
} from './repositories/client-portal-repository';
import {
  linkLegacyClientAccountToCustomer,
  listOwnerEligibleClientAccounts,
} from './services/client-identity-link-service';

function seedClientIdentity({ adapter, uid, email = 'client@example.com' }) {
  const isolatedCustomerId = `client_${uid}`;
  adapter._seedClientAccount(uid, {
    customerId: isolatedCustomerId,
    emailNormalized: email,
    displayName: 'Legacy Client Account',
    profileSource: 'isolated_client_profile',
    status: 'active',
    version: 1,
  });
  adapter._seedClientCustomerLink(isolatedCustomerId, {
    ownerUid: uid,
    emailNormalized: email,
    profileSource: 'isolated_client_profile',
  });
  adapter._seedClientProfile(isolatedCustomerId, {
    ownerUid: uid,
    emailNormalized: email,
    displayName: 'Legacy Client Account',
    profileSource: 'isolated_client_profile',
  });
}

describe('Owner-reviewed legacy Client identity linking', () => {
  it('links an isolated Client to an explicitly selected active CRM customer and records an immutable audit payload', async () => {
    const customerAdapter = createInMemoryCustomerRepositoryAdapter();
    const clientAdapter = createInMemoryClientPortalRepositoryAdapter(customerAdapter);
    const customer = await createManualCustomer({
      actorUid: 'staff-1',
      input: {
        displayName: 'The Legacy Studio Band',
        phone: '081234567890',
        email: 'crm-record@example.com',
        notes: 'Internal CRM note remains private',
      },
      adapter: customerAdapter,
    });
    seedClientIdentity({ adapter: clientAdapter, uid: 'legacy-client-1' });

    const candidates = await listOwnerEligibleClientAccounts({
      actorUid: 'owner-1',
      actorRole: 'owner',
      adapter: clientAdapter,
    });
    expect(candidates.map((account) => account.uid)).toEqual(['legacy-client-1']);

    const result = await linkLegacyClientAccountToCustomer({
      actorUid: 'owner-1',
      actorRole: 'owner',
      clientUid: 'legacy-client-1',
      targetCustomerId: customer.id,
      reviewReason: 'Customer identity was verified directly with the account holder.',
      adapter: clientAdapter,
    });

    expect(result.alreadyLinked).toBe(false);
    expect(result.account).toMatchObject({
      uid: 'legacy-client-1',
      customerId: customer.id,
      profileSource: 'linked_customer',
      version: 2,
    });
    expect(result.clientProfile).toMatchObject({
      customerId: customer.id,
      ownerUid: 'legacy-client-1',
      profileSource: 'linked_customer',
      displayName: customer.displayName,
    });
    expect(result.audit).toMatchObject({
      action: 'owner_reviewed_legacy_link',
      clientUid: 'legacy-client-1',
      actorUid: 'owner-1',
      fromCustomerId: 'client_legacy-client-1',
      toCustomerId: customer.id,
      fromProfileSource: 'isolated_client_profile',
      toProfileSource: 'linked_customer',
      accountVersionBefore: 1,
      accountVersionAfter: 2,
    });

    const state = clientAdapter._inspectState();
    expect(state.clientCustomerLinks.get(customer.id).ownerUid).toBe('legacy-client-1');
    expect(state.clientCustomerLinks.get('client_legacy-client-1').ownerUid).toBe('legacy-client-1');
    expect(state.clientProfiles.get('client_legacy-client-1').status).toBe('active');
    expect(state.clientIdentityLinkAudits.size).toBe(1);
    expect(state.clientAccounts.get('legacy-client-1').customerId).toBe(customer.id);
    expect(state.emailIndex.get('crm-record@example.com').customerId).toBe(customer.id);
    expect(result.clientProfile.emailNormalized).toBe(customer.emailNormalized);
    expect(result.clientProfile.phoneDisplay).toBe(customer.phoneDisplay);
    expect((await clientAdapter.listOwnerEligibleClientAccounts()).map((item) => item.uid)).toEqual([]);

    // A retry for the same one-to-one binding returns the original result without
    // incrementing account version or writing a second audit event.
    const retried = await linkLegacyClientAccountToCustomer({
      actorUid: 'owner-1',
      actorRole: 'owner',
      clientUid: 'legacy-client-1',
      targetCustomerId: customer.id,
      reviewReason: 'Retry after the UI did not receive the previous confirmation.',
      adapter: clientAdapter,
    });
    expect(retried.alreadyLinked).toBe(true);
    expect(retried.account.version).toBe(2);
    expect(clientAdapter._inspectState().clientIdentityLinkAudits.size).toBe(1);
  });

  it('does not auto-link by matching email or phone; the Owner must submit an explicit CRM customer ID', async () => {
    const customerAdapter = createInMemoryCustomerRepositoryAdapter();
    const clientAdapter = createInMemoryClientPortalRepositoryAdapter(customerAdapter);
    await createManualCustomer({
      actorUid: 'staff-1',
      input: {
        displayName: 'Same Email And Phone',
        phone: '081234567890',
        email: 'same@example.com',
        notes: '',
      },
      adapter: customerAdapter,
    });
    seedClientIdentity({
      adapter: clientAdapter,
      uid: 'manual-link-2',
      email: 'same@example.com',
    });

    await expect(
      linkLegacyClientAccountToCustomer({
        actorUid: 'owner-1',
        actorRole: 'owner',
        clientUid: 'manual-link-2',
        targetCustomerId: '',
        reviewReason: 'Owner inspected source records and confirmed.',
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client-identity/invalid-input' });
    expect(clientAdapter._inspectState().clientAccounts.get('manual-link-2').customerId).toBe(
      'client_manual-link-2',
    );
  });

  it('rejects a target already linked to a different Client and makes no partial writes', async () => {
    const customerAdapter = createInMemoryCustomerRepositoryAdapter();
    const clientAdapter = createInMemoryClientPortalRepositoryAdapter(customerAdapter);
    const customer = await createManualCustomer({
      actorUid: 'staff-1',
      input: {
        displayName: 'Claimed Customer',
        phone: '081234567891',
        email: 'claimed@example.com',
        notes: '',
      },
      adapter: customerAdapter,
    });
    seedClientIdentity({ adapter: clientAdapter, uid: 'first-client' });
    seedClientIdentity({ adapter: clientAdapter, uid: 'second-client' });

    await linkLegacyClientAccountToCustomer({
      actorUid: 'owner-1',
      actorRole: 'owner',
      clientUid: 'first-client',
      targetCustomerId: customer.id,
      reviewReason: 'Owner verified the first account holder.',
      adapter: clientAdapter,
    });
    const before = clientAdapter._inspectState();

    await expect(
      linkLegacyClientAccountToCustomer({
        actorUid: 'owner-1',
        actorRole: 'owner',
        clientUid: 'second-client',
        targetCustomerId: customer.id,
        reviewReason: 'Owner verified the second account holder.',
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client-identity/customer-already-claimed' });

    const after = clientAdapter._inspectState();
    expect(after.clientAccounts.get('second-client').customerId).toBe('client_second-client');
    expect(after.clientCustomerLinks.get(customer.id).ownerUid).toBe('first-client');
    expect(after.clientIdentityLinkAudits.size).toBe(before.clientIdentityLinkAudits.size);
  });

  it('rejects an orphaned CRM account claim even when its one-to-one link document is missing', async () => {
    const customerAdapter = createInMemoryCustomerRepositoryAdapter();
    const clientAdapter = createInMemoryClientPortalRepositoryAdapter(customerAdapter);
    const customer = await createManualCustomer({
      actorUid: 'staff-1',
      input: {
        displayName: 'Orphaned CRM Claim',
        phone: '081234567895',
        email: 'orphaned@example.com',
        notes: '',
      },
      adapter: customerAdapter,
    });

    // Simulate a pre-existing inconsistent account record whose reverse link was lost.
    clientAdapter._seedClientAccount('orphan-owner', {
      customerId: customer.id,
      profileSource: 'linked_customer',
      status: 'active',
      version: 3,
    });
    seedClientIdentity({ adapter: clientAdapter, uid: 'orphan-attempt' });

    await expect(
      linkLegacyClientAccountToCustomer({
        actorUid: 'owner-1',
        actorRole: 'owner',
        clientUid: 'orphan-attempt',
        targetCustomerId: customer.id,
        reviewReason: 'Owner reviewed but target account claim is inconsistent.',
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client-identity/customer-already-claimed' });

    const after = clientAdapter._inspectState();
    expect(after.clientAccounts.get('orphan-attempt').customerId).toBe('client_orphan-attempt');
    expect(after.clientCustomerLinks.has(customer.id)).toBe(false);
    expect(after.clientIdentityLinkAudits.size).toBe(0);
  });

  it('rejects an account already linked to another real CRM customer instead of silently reassigning it', async () => {
    const customerAdapter = createInMemoryCustomerRepositoryAdapter();
    const clientAdapter = createInMemoryClientPortalRepositoryAdapter(customerAdapter);
    const first = await createManualCustomer({
      actorUid: 'staff-1',
      input: { displayName: 'CRM One', phone: '081234567892', email: 'one@example.com', notes: '' },
      adapter: customerAdapter,
    });
    const second = await createManualCustomer({
      actorUid: 'staff-1',
      input: { displayName: 'CRM Two', phone: '081234567893', email: 'two@example.com', notes: '' },
      adapter: customerAdapter,
    });
    seedClientIdentity({ adapter: clientAdapter, uid: 'already-linked' });
    await linkLegacyClientAccountToCustomer({
      actorUid: 'owner-1',
      actorRole: 'owner',
      clientUid: 'already-linked',
      targetCustomerId: first.id,
      reviewReason: 'Owner confirmed this account mapping.',
      adapter: clientAdapter,
    });

    await expect(
      linkLegacyClientAccountToCustomer({
        actorUid: 'owner-1',
        actorRole: 'owner',
        clientUid: 'already-linked',
        targetCustomerId: second.id,
        reviewReason: 'Attempt to move a previously claimed Client account.',
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client-identity/reassignment-blocked' });
    expect(clientAdapter._inspectState().clientAccounts.get('already-linked').customerId).toBe(
      first.id,
    );
    expect(clientAdapter._inspectState().clientCustomerLinks.has(second.id)).toBe(false);
  });

  it('rejects Staff, short review notes, ambiguous/non-active targets and conflicting profiles', async () => {
    const customerAdapter = createInMemoryCustomerRepositoryAdapter();
    const clientAdapter = createInMemoryClientPortalRepositoryAdapter(customerAdapter);
    const customer = await createManualCustomer({
      actorUid: 'staff-1',
      input: { displayName: 'CRM Target', phone: '081234567894', email: '', notes: '' },
      adapter: customerAdapter,
    });
    seedClientIdentity({ adapter: clientAdapter, uid: 'review-guards' });

    await expect(
      listOwnerEligibleClientAccounts({
        actorUid: 'staff-1',
        actorRole: 'staff',
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client-identity/owner-only' });

    await expect(
      linkLegacyClientAccountToCustomer({
        actorUid: 'staff-1',
        actorRole: 'staff',
        clientUid: 'review-guards',
        targetCustomerId: customer.id,
        reviewReason: 'Valid enough reason',
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client-identity/owner-only' });

    await expect(
      linkLegacyClientAccountToCustomer({
        actorUid: 'owner-1',
        actorRole: 'owner',
        clientUid: 'review-guards',
        targetCustomerId: customer.id,
        reviewReason: 'short',
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client-identity/invalid-reason' });
  });
});
