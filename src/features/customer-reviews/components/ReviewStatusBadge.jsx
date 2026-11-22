import { AdminStatusBadge } from '@/features/admin/design-system';

import { CUSTOMER_REVIEW_STATUS, REVIEW_INVITATION_STATUS } from '../config/customer-review-config';

const REVIEW_STATUS_META = {
  [CUSTOMER_REVIEW_STATUS.PENDING]: { label: 'Pending Review', tone: 'amber' },
  [CUSTOMER_REVIEW_STATUS.PUBLISHED]: { label: 'Published', tone: 'lime' },
  [CUSTOMER_REVIEW_STATUS.REJECTED]: { label: 'Rejected', tone: 'danger' },
  [CUSTOMER_REVIEW_STATUS.ARCHIVED]: { label: 'Archived', tone: 'ivory' },
};

const INVITATION_STATUS_META = {
  [REVIEW_INVITATION_STATUS.ACTIVE]: { label: 'Invitation Active', tone: 'emerald' },
  [REVIEW_INVITATION_STATUS.SUBMITTED]: { label: 'Submitted', tone: 'lime' },
  [REVIEW_INVITATION_STATUS.REVOKED]: { label: 'Revoked', tone: 'danger' },
  expired: { label: 'Expired', tone: 'amber' },
};

export function ReviewStatusBadge({ status, kind = 'review', size = 'sm' }) {
  const map = kind === 'invitation' ? INVITATION_STATUS_META : REVIEW_STATUS_META;
  const meta = map[status] || { label: String(status || 'Unknown'), tone: 'ivory' };

  return (
    <AdminStatusBadge tone={meta.tone} dot size={size}>
      {meta.label}
    </AdminStatusBadge>
  );
}
