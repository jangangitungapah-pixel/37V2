export const ALLOWED_STAFF_ROLES = ['owner', 'staff'];

export const PASSWORD_RESET_GENERIC_CONFIRMATION =
  'If an account matches this email address, password reset instructions will be sent.';

export function createAuthError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function isAllowedStaffRole(role) {
  return typeof role === 'string' && ALLOWED_STAFF_ROLES.includes(role);
}

/**
 * Maps Firebase Auth and Firestore profile verification errors to safe, user-facing messages.
 * Never exposes internal stack traces or leaks whether a specific email exists.
 */
export function mapAuthErrorToMessage(error) {
  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid email or password.';
    case 'auth/user-disabled':
      return 'Account disabled; contact studio owner.';
    case 'auth/too-many-requests':
      return 'Too many attempts; try again later.';
    case 'auth/network-request-failed':
      return 'Connection problem; retry.';
    case 'firebase/not-configured':
    case 'auth/configuration-not-found':
    case 'auth/invalid-api-key':
      return 'Firebase configuration is incomplete.';
    case 'staff/profile-missing':
      return 'Account is not authorized for staff access.';
    case 'staff/invalid-role':
      return 'Access denied.';
    case 'staff/account-inactive':
      return 'Account inactive.';
    case 'permission-denied':
    case 'firestore/permission-denied':
    case 'staff/permission-denied':
      return 'Cannot verify studio access; contact administrator.';
    default:
      return 'Unable to complete sign-in right now. Please try again.';
  }
}

export function mapPasswordResetErrorToMessage(error) {
  const code = error?.code || '';

  switch (code) {
    case 'auth/too-many-requests':
      return 'Too many attempts; try again later.';
    case 'auth/network-request-failed':
      return 'Connection problem; retry.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'firebase/not-configured':
    case 'auth/configuration-not-found':
    case 'auth/invalid-api-key':
      return 'Firebase configuration is incomplete.';
    default:
      return 'Unable to send password reset instructions right now. Please try again.';
  }
}

export function mapReauthErrorToMessage(error) {
  const code = error?.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-mismatch':
      return 'Password yang Anda masukkan tidak sesuai.';
    case 'auth/missing-password':
      return 'Masukkan password akun Anda saat ini untuk melanjutkan.';
    case 'auth/no-current-user':
    case 'auth/user-token-expired':
    case 'auth/requires-recent-login':
      return 'Sesi autentikasi telah kedaluwarsa. Silakan masuk ulang sebagai Owner.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan autentikasi ulang. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi jaringan bermasalah. Periksa koneksi Anda lalu coba lagi.';
    case 'auth/user-disabled':
      return 'Akun dinonaktifkan; hubungi pemilik studio.';
    case 'staff/account-inactive':
      return 'Profil akun Anda berstatus nonaktif.';
    case 'staff/profile-missing':
    case 'staff/invalid-role':
    case 'owner/required':
      return 'Hanya Owner Studio aktif yang dapat melakukan autentikasi ulang tindakan ini.';
    case 'firebase/not-configured':
    case 'auth/configuration-not-found':
    case 'auth/invalid-api-key':
      return 'Konfigurasi Firebase belum lengkap.';
    default:
      return 'Gagal memverifikasi password saat ini. Silakan periksa kembali dan coba lagi.';
  }
}
