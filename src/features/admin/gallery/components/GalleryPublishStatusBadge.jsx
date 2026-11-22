import { Archive, CheckCircle2, FileEdit } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

import { GALLERY_STATUSES } from '../config/gallery-config';

export function GalleryPublishStatusBadge({ status, publishedPosition = null }) {
  if (status === GALLERY_STATUSES.PUBLISHED) {
    return (
      <AdminStatusBadge tone="lime" icon={CheckCircle2} size="sm">
        {publishedPosition ? `Published • #${publishedPosition}` : 'Published'}
      </AdminStatusBadge>
    );
  }

  if (status === GALLERY_STATUSES.ARCHIVED) {
    return (
      <AdminStatusBadge tone="neutral" icon={Archive} size="sm">
        Archived
      </AdminStatusBadge>
    );
  }

  return (
    <AdminStatusBadge tone="ivory" icon={FileEdit} size="sm">
      Draft
    </AdminStatusBadge>
  );
}
