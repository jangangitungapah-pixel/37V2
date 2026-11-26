import { getClientPortalRepositoryAdapter } from '../repositories/client-portal-repository';

function identityLinkError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateOwnerActor(actorUid, actorRole) {
  const uid = String(actorUid || '').trim();
  const role = String(actorRole || '').trim().toLowerCase();
  if (!uid || role !== 'owner') {
    throw identityLinkError(
      'client-identity/owner-only',
      'Hanya Owner aktif yang boleh meninjau dan menghubungkan identitas Client.',
    );
  }
  return uid;
}

export async function listOwnerEligibleClientAccounts({
  actorUid,
  actorRole,
  adapter = getClientPortalRepositoryAdapter(),
} = {}) {
  validateOwnerActor(actorUid, actorRole);
  if (typeof adapter?.listOwnerEligibleClientAccounts !== 'function') {
    throw identityLinkError(
      'client-identity/repository-unavailable',
      'Repository identity linking belum tersedia.',
    );
  }
  return adapter.listOwnerEligibleClientAccounts({ maxResults: 100 });
}

export async function linkLegacyClientAccountToCustomer({
  actorUid,
  actorRole,
  clientUid,
  targetCustomerId,
  reviewReason,
  adapter = getClientPortalRepositoryAdapter(),
} = {}) {
  const ownerUid = validateOwnerActor(actorUid, actorRole);
  const cleanClientUid = String(clientUid || '').trim();
  const cleanCustomerId = String(targetCustomerId || '').trim();
  const cleanReason = String(reviewReason || '').trim();

  if (!cleanClientUid || !cleanCustomerId) {
    throw identityLinkError(
      'client-identity/invalid-input',
      'Pilih akun Client dan Customer CRM target secara eksplisit.',
    );
  }
  if (cleanReason.length < 10 || cleanReason.length > 1000) {
    throw identityLinkError(
      'client-identity/invalid-reason',
      'Catatan review wajib 10–1000 karakter.',
    );
  }
  if (typeof adapter?.linkLegacyClientToCustomer !== 'function') {
    throw identityLinkError(
      'client-identity/repository-unavailable',
      'Repository identity linking belum tersedia.',
    );
  }

  return adapter.linkLegacyClientToCustomer({
    uid: cleanClientUid,
    targetCustomerId: cleanCustomerId,
    actorUid: ownerUid,
    reviewReason: cleanReason,
    operationId: `link_${cleanClientUid}_${cleanCustomerId}`,
  });
}

export function mapClientIdentityLinkError(error) {
  const code = String(error?.code || '').toLowerCase();
  if (code.includes('permission-denied') || code.includes('owner-only')) {
    return 'Aksi ini hanya dapat dilakukan oleh Owner aktif.';
  }
  if (code.includes('customer-already-claimed') || code.includes('profile-already-claimed')) {
    return 'Customer ini sudah tertaut ke akun Client lain. Tidak ada data yang diubah.';
  }
  if (code.includes('profile-conflict')) {
    return 'Snapshot Client Profile tidak cocok dengan data CRM. Periksa konsistensi profil sebelum linking.';
  }
  if (code.includes('reassignment-blocked')) {
    return 'Akun Client sudah tertaut ke Customer lain. Kasus reassignment harus ditinjau secara terpisah.';
  }
  if (code.includes('source-binding-invalid')) {
    return 'Binding profil Client asal tidak konsisten. Hubungi tim teknis sebelum melanjutkan.';
  }
  if (code.includes('customer-not-eligible')) {
    return 'Customer target tidak ditemukan atau tidak aktif.';
  }
  if (code.includes('account-not-eligible')) {
    return 'Akun Client bukan akun aktif dengan profil terisolasi.';
  }
  if (code.includes('invalid-reason')) {
    return 'Catatan review wajib berisi 10–1000 karakter.';
  }
  return 'Gagal menghubungkan identitas Client. Periksa kembali pilihan dan coba lagi.';
}
