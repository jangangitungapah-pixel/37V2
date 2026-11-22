import { Images } from 'lucide-react';

import { AdminEmptyState } from '@/features/admin/design-system';

import { GALLERY_STATUSES } from '../config/gallery-config';

export function GalleryEmptyState({ activeFilter = 'all', searchQuery = '', onResetFilters }) {
  if (searchQuery.trim()) {
    return (
      <AdminEmptyState
        icon={Images}
        title="Tidak ada foto yang cocok"
        description={`Tidak ditemukan foto dengan judul yang mengandung "${searchQuery.trim()}".`}
        actionLabel="Reset Pencarian"
        onAction={onResetFilters}
      />
    );
  }

  if (activeFilter === GALLERY_STATUSES.PUBLISHED) {
    return (
      <AdminEmptyState
        icon={Images}
        title="Belum ada foto yang dipublikasikan"
        description="Publikasikan foto berstatus Draft yang sudah memiliki teks alternatif (alt text) agar tampil di Landing Page publik."
      />
    );
  }

  if (activeFilter === GALLERY_STATUSES.DRAFT) {
    return (
      <AdminEmptyState
        icon={Images}
        title="Tidak ada foto berstatus Draft"
        description="Unggah foto studio baru melalui area upload di atas untuk mulai menyusun galeri."
      />
    );
  }

  if (activeFilter === GALLERY_STATUSES.ARCHIVED) {
    return (
      <AdminEmptyState
        icon={Images}
        title="Tidak ada foto yang diarsipkan"
        description="Foto yang diarsipkan disembunyikan dari publik dan pustaka aktif tanpa menghapus file di Cloudinary."
      />
    );
  }

  return (
    <AdminEmptyState
      icon={Images}
      title="Pustaka galeri masih kosong"
      description="Unggah foto studio (JPG, PNG, WEBP, atau AVIF) ke Cloudinary, lengkapi judul serta teks alternatif, lalu publikasikan ke website publik."
    />
  );
}
