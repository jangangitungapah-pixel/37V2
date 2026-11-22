import { Inbox } from 'lucide-react';

import { AdminButton, AdminEmptyState } from '@/features/admin/design-system';

export function BookingRequestEmptyState({ hasActiveFilters = false, onResetFilters }) {
  return (
    <AdminEmptyState
      icon={Inbox}
      tone="lime"
      title={
        hasActiveFilters
          ? 'Tidak ada request yang sesuai filter'
          : 'Belum ada booking request masuk'
      }
      description={
        hasActiveFilters
          ? 'Coba ubah filter status, layanan, tanggal, atau kata kunci pencarian.'
          : 'Permintaan sesi baru yang dikirim pengunjung dari Landing Page akan langsung muncul di inbox ini secara realtime.'
      }
      action={
        hasActiveFilters && onResetFilters ? (
          <AdminButton variant="secondary" size="sm" onClick={onResetFilters}>
            Reset Filter
          </AdminButton>
        ) : null
      }
    />
  );
}
