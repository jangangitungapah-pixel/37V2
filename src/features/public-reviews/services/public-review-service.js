import { getStudioRoomById } from '@/features/admin/calendar/config/calendar-config';
import { formatIndonesianDateFull } from '@/features/admin/calendar/utils/calendar-date';
import {
  submitCustomerReview,
  validateAndLoadPublicInvitation,
} from '@/features/customer-reviews/services/customer-review-submission-service';

export { validateAndLoadPublicInvitation, submitCustomerReview };

/**
 * Formats safe, minimal booking session metadata returned on an active review invitation.
 * Never touches private customer phone numbers, emails, or financial records.
 */
export function formatPublicInvitationContext(invitation) {
  if (!invitation) return null;

  const serviceLabel = invitation.serviceLabelSnapshot || 'Studio Session';
  const formattedDate = invitation.sessionDate
    ? formatIndonesianDateFull(invitation.sessionDate)
    : '';
  const roomInfo = invitation.studioId ? getStudioRoomById(invitation.studioId) : null;

  return {
    serviceLabel,
    sessionDateLabel: formattedDate || invitation.sessionDate || '',
    roomLabel: roomInfo && invitation.studioId ? roomInfo.label : '',
  };
}
