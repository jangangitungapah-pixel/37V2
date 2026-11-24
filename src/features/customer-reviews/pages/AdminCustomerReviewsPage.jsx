import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { AdminPageHeader, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { ReviewDetailDrawer } from '../components/ReviewDetailDrawer';
import { ReviewInboxTable } from '../components/ReviewInboxTable';
import { ReviewInvitationList } from '../components/ReviewInvitationList';
import { ReviewModerationDialog } from '../components/ReviewModerationDialog';
import { ReviewOverviewCards } from '../components/ReviewOverviewCards';
import { ReviewRatingDistribution } from '../components/ReviewRatingDistribution';
import { CUSTOMER_REVIEW_STATUS } from '../config/customer-review-config';
import { useCustomerReviews } from '../hooks/useCustomerReviews';
import { useReviewInvitations } from '../hooks/useReviewInvitations';
import { moderateCustomerReview } from '../services/customer-review-moderation-service';
import { buildAdminReviewsOverview } from '../services/public-review-stats-service';

const REVIEW_TABS = [
  { id: 'pending', label: 'Review Inbox' },
  { id: 'published', label: 'Published Reviews' },
  { id: 'archived_rejected', label: 'Rejected / Archived' },
  { id: 'invitations', label: 'Review Invitations' },
];

export function AdminCustomerReviewsPage() {
  const { user, profile, role } = useAuth();
  const isOwner = Boolean(user?.uid && profile?.active === true && role === 'owner');

  const {
    reviews,
    stats,
    isLoading: isReviewsLoading,
    error: reviewsError,
  } = useCustomerReviews({
    enabled: isOwner,
  });
  const {
    invitations,
    isLoading: isInvitationsLoading,
    error: invitationsError,
  } = useReviewInvitations({
    enabled: isOwner,
  });

  const [activeTab, setActiveTab] = useState('pending');
  const [selectedReviewId, setSelectedReviewId] = useState('');
  const [moderationModal, setModerationModal] = useState({
    open: false,
    review: null,
    targetStatus: '',
  });
  const [isModerating, setIsModerating] = useState(false);
  const [moderationError, setModerationError] = useState('');

  const overview = useMemo(() => buildAdminReviewsOverview(reviews, stats), [reviews, stats]);

  const reviewsByBookingId = useMemo(
    () => new Map((reviews || []).map((item) => [item.bookingId, item])),
    [reviews],
  );

  const selectedReview = useMemo(
    () => (selectedReviewId ? reviewsByBookingId.get(selectedReviewId) || null : null),
    [reviewsByBookingId, selectedReviewId],
  );

  const filteredReviews = useMemo(() => {
    if (activeTab === 'pending') {
      return reviews.filter((r) => r.status === CUSTOMER_REVIEW_STATUS.PENDING);
    }
    if (activeTab === 'published') {
      return reviews.filter((r) => r.status === CUSTOMER_REVIEW_STATUS.PUBLISHED);
    }
    if (activeTab === 'archived_rejected') {
      return reviews.filter(
        (r) =>
          r.status === CUSTOMER_REVIEW_STATUS.REJECTED ||
          r.status === CUSTOMER_REVIEW_STATUS.ARCHIVED,
      );
    }
    return [];
  }, [activeTab, reviews]);

  const handleOpenModeration = (review, targetStatus) => {
    setModerationError('');
    setModerationModal({
      open: true,
      review,
      targetStatus,
    });
  };

  const handleConfirmModeration = async () => {
    if (!moderationModal.review || !moderationModal.targetStatus || isModerating) return;
    setIsModerating(true);
    setModerationError('');

    try {
      await moderateCustomerReview({
        bookingId: moderationModal.review.bookingId,
        targetStatus: moderationModal.targetStatus,
        expectedVersion: moderationModal.review.version,
        actor: {
          uid: user?.uid || '',
          role,
          active: profile?.active === true,
        },
      });
      toast.success(
        `Status ulasan "${moderationModal.review.displayName}" diperbarui menjadi ${moderationModal.targetStatus}.`,
      );
      setModerationModal({ open: false, review: null, targetStatus: '' });
    } catch (err) {
      const msg = err?.message || 'Gagal memperbarui status moderasi ulasan.';
      setModerationError(msg);
      toast.error(msg);
    } finally {
      setIsModerating(false);
    }
  };

  const isLoading = isReviewsLoading || isInvitationsLoading;
  const loadError = reviewsError || invitationsError;

  return (
    <div data-admin-portal="true" className="space-y-5">
      <AdminPageHeader
        compactMobile
        eyebrow="Owner Review Moderation"
        titleId="admin-customer-reviews-heading"
        title="Customer Reviews"
        description="Moderasi ulasan pelanggan yang berasal langsung dari undangan booking sesi studio yang selesai, serta pantau status undangan aktif."
        meta={
          <AdminStatusBadge tone="lime" dot size="sm" icon={ShieldCheck}>
            OWNER MODERATION ONLY
          </AdminStatusBadge>
        }
      />

      {loadError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-300 bg-red-50 p-4 text-xs font-medium text-red-900"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      <ReviewOverviewCards overview={overview} />
      <ReviewRatingDistribution overview={overview} />

      {/* Workspace Tabs */}
      <AdminSurface variant="card" className="p-2">
        <div
          role="tablist"
          aria-label="Kategori moderasi ulasan pelanggan"
          className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap"
        >
          {REVIEW_TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            const badgeCount =
              tab.id === 'pending'
                ? overview.pending
                : tab.id === 'published'
                  ? overview.published
                  : tab.id === 'archived_rejected'
                    ? overview.rejected + overview.archived
                    : invitations.length;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-10 min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-left text-[11.5px] leading-tight font-bold transition-colors sm:justify-start sm:gap-2 sm:px-3.5 sm:text-xs ${
                  isSelected
                    ? 'bg-[#151515] text-[#C8F13A]'
                    : 'bg-[#FAF8F3] text-[#46433D] hover:bg-[#EFECE3]'
                }`}
              >
                <span className="truncate">{tab.label}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${
                    isSelected ? 'bg-[#C8F13A] text-[#151515]' : 'bg-white text-[#151515]'
                  }`}
                >
                  {badgeCount}
                </span>
              </button>
            );
          })}
        </div>
      </AdminSurface>

      {isLoading ? (
        <AdminSurface
          variant="card"
          className="flex items-center justify-center gap-2 p-8 text-xs text-[#666159]"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Memuat data ulasan &amp; undangan...</span>
        </AdminSurface>
      ) : activeTab === 'invitations' ? (
        <ReviewInvitationList invitations={invitations} reviewsByBookingId={reviewsByBookingId} />
      ) : (
        <ReviewInboxTable
          reviews={filteredReviews}
          emptyTitle={
            activeTab === 'pending'
              ? 'Inbox Moderasi Bersih'
              : activeTab === 'published'
                ? 'Belum Ada Ulasan Terpublikasi'
                : 'Belum Ada Ulasan Ditolak / Diarsipkan'
          }
          emptyDescription="Ulasan baru dari pelanggan melalui tautan undangan booking selesai akan muncul otomatis di Review Inbox."
          onInspectReview={(rev) => setSelectedReviewId(rev.bookingId)}
          onRequestModeration={handleOpenModeration}
        />
      )}

      <ReviewDetailDrawer
        open={Boolean(selectedReview)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedReviewId('');
        }}
        review={selectedReview}
        onRequestModeration={handleOpenModeration}
      />

      <ReviewModerationDialog
        open={moderationModal.open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setModerationModal({ open: false, review: null, targetStatus: '' });
          }
        }}
        review={moderationModal.review}
        targetStatus={moderationModal.targetStatus}
        isSubmitting={isModerating}
        error={moderationError}
        onConfirm={handleConfirmModeration}
      />
    </div>
  );
}

export default AdminCustomerReviewsPage;
