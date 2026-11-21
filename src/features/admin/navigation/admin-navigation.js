import {
  BookOpenText,
  Boxes,
  CalendarDays,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  UsersRound,
} from 'lucide-react';

/**
 * Central navigation and route configuration for the 37 Music Studio Admin Shell.
 *
 * Menu order is strictly locked per Phase 4 specification:
 * 01. Dashboard
 * 02. Calendar
 * 03. Customer
 * 04. Payment and Bill
 * 05. Commission and Fee
 * 06. Inventory
 * 07. Pembukuan
 * 08. Settings
 *
 * Note: Phase 4 intentionally grants both `owner` and `staff` roles identical
 * visibility and navigation access across all eight routes. Role-specific permissions
 * are deferred to a future user-directed phase.
 */
export const ADMIN_NAVIGATION_ITEMS = [
  {
    id: 'dashboard',
    order: '01',
    label: 'Dashboard',
    path: 'dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    eyebrow: 'RINGKASAN STUDIO',
    summary: 'Pusat akses cepat untuk seluruh menu operasional dan pengelolaan 37 Music Studio.',
    scopeNotes: [
      'Akses terpadu untuk Owner dan Staff studio',
      'Pintasan langsung ke jadwal, pelanggan, dan tagihan',
      'Ringkasan aktivitas operasional studio harian',
    ],
  },
  {
    id: 'calendar',
    order: '02',
    label: 'Calendar',
    path: 'calendar',
    href: '/admin/calendar',
    icon: CalendarDays,
    eyebrow: 'JADWAL RUANGAN STUDIO',
    summary: 'Kelola jadwal latihan (rehearsal), rekaman, dan mixing di Room A serta Room B.',
    scopeNotes: [
      'Pantau jadwal harian, mingguan, dan bulanan Room A & Room B',
      'Cegah bentrok jadwal otomatis saat membuat booking baru',
      'Catat status kedatangan, sesi berlangsung, hingga selesai',
    ],
  },
  {
    id: 'customer',
    order: '03',
    label: 'Customer',
    path: 'customer',
    href: '/admin/customer',
    icon: UsersRound,
    eyebrow: 'DAFTAR PELANGGAN',
    summary: 'Kelola data pelanggan, band, kontak WhatsApp, dan riwayat booking mereka.',
    scopeNotes: [
      'Catatan kontak pelanggan & nama band yang pernah dipakai',
      'Riwayat lengkap booking dan tagihan per pelanggan',
      'Mendukung satu nomor HP dipakai bersama oleh beberapa orang',
    ],
  },
  {
    id: 'payment-and-bill',
    order: '04',
    label: 'Payment and Bill',
    path: 'payment-and-bill',
    href: '/admin/payment-and-bill',
    icon: ReceiptText,
    eyebrow: 'TAGIHAN & PEMBAYARAN',
    summary: 'Buat invoice otomatis, catat DP maupun pelunasan, dan cetak bukti pembayaran.',
    scopeNotes: [
      'Satu booking otomatis menghasilkan satu invoice tagihan',
      'Catat pembayaran bertahap, sisa tagihan, dan koreksi aman',
      'Cetak invoice/kwitansi rapi dan salin ringkasan untuk WhatsApp',
    ],
  },
  {
    id: 'commission-and-fee',
    order: '05',
    label: 'Commission and Fee',
    path: 'commission-and-fee',
    href: '/admin/commission-and-fee',
    icon: HandCoins,
    eyebrow: 'KOMISI & HONOR TIM',
    summary: 'Kelola rincian honor operator rekaman, fee staff, dan pembagian hasil sesi.',
    scopeNotes: [
      'Rekap komisi tim berdasarkan sesi studio yang selesai',
      'Laporan fee untuk Staff, Owner, dan Recording Operator',
      'Pencatatan status pembayaran honor tim studio',
    ],
  },
  {
    id: 'inventory',
    order: '06',
    label: 'Inventory',
    path: 'inventory',
    href: '/admin/inventory',
    icon: Boxes,
    eyebrow: 'PERALATAN & ASET STUDIO',
    summary: 'Catat daftar alat musik, ampli, mikrofon, kondisi alat, dan jadwal perawatan.',
    scopeNotes: [
      'Daftar perlengkapan Room A, Room B, dan peralatan rekaman',
      'Pantau kondisi alat, perbaikan, serta servis berkala',
      'Stok perlengkapan habis pakai seperti senar dan kabel',
    ],
  },
  {
    id: 'pembukuan',
    order: '07',
    label: 'Pembukuan',
    path: 'pembukuan',
    href: '/admin/pembukuan',
    icon: BookOpenText,
    eyebrow: 'CATATAN KEUANGAN STUDIO',
    summary: 'Rekap pemasukan, pengeluaran operasional harian, dan ringkasan arus kas studio.',
    scopeNotes: [
      'Catatan pemasukan sewa studio dan pengeluaran operasional',
      'Ringkasan pemasukan & pengeluaran per periode',
      'Laporan ringkas untuk evaluasi keuangan bulanan',
    ],
  },
  {
    id: 'settings',
    order: '08',
    label: 'Settings',
    path: 'settings',
    href: '/admin/settings',
    icon: Settings2,
    eyebrow: 'PENGATURAN STUDIO',
    summary: 'Atur layanan studio, tarif per jam, paket, diskon durasi, dan komisi internal.',
    scopeNotes: [
      'Daftar layanan studio dan layanan jarak jauh (mixing/mastering)',
      'Tarif per jam, paket harga khusus, serta diskon otomatis',
      'Pengaturan fee staff, owner, operator, dan uang makan',
    ],
  },
];

export function getAdminModuleById(moduleId) {
  return ADMIN_NAVIGATION_ITEMS.find((item) => item.id === moduleId) || ADMIN_NAVIGATION_ITEMS[0];
}

export function getAdminNavItemByPath(pathname = '') {
  const normalized = String(pathname || '').replace(/\/+$/, '');
  const matched = ADMIN_NAVIGATION_ITEMS.find(
    (item) => normalized === item.href || normalized.startsWith(`${item.href}/`),
  );
  return matched || ADMIN_NAVIGATION_ITEMS[0];
}
