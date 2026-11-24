import { useState } from 'react';

import { DASHBOARD_PERIOD_PRESETS } from '@/features/admin/dashboard/config/dashboard-config';
import { DashboardBookingTrendChart } from '@/features/admin/dashboard/components/DashboardBookingTrendChart';
import { DashboardHeader } from '@/features/admin/dashboard/components/DashboardHeader';
import { DashboardNeedsAttention } from '@/features/admin/dashboard/components/DashboardNeedsAttention';
import { DashboardOwnerFinancials } from '@/features/admin/dashboard/components/DashboardOwnerFinancials';
import { DashboardTodayOverview } from '@/features/admin/dashboard/components/DashboardTodayOverview';
import { DashboardTodaySchedule } from '@/features/admin/dashboard/components/DashboardTodaySchedule';
import { useDashboardData } from '@/features/admin/dashboard/hooks/useDashboardData';
import { useAuth } from '@/features/auth/AuthContext';

/**
 * 37 MUSIC STUDIO — STUDIO OPERATIONS COMMAND CENTER (`/admin/dashboard`)
 *
 * Operational workspace answering 4 core studio questions in real time:
 * 1. What is happening in the studio today? (Section B — Today's Overview)
 * 2. What sessions are coming next? (Section C — Today's Studio Schedule)
 * 3. What requires attention or action? (Section D — Needs Attention)
 * 4. How is the studio performing? (Section E — Owner Financial Overview & Section F — Booking Trend)
 */
export function AdminDashboardPage({ now } = {}) {
  const { user, profile, role } = useAuth();
  const displayName =
    profile?.displayName || user?.displayName || profile?.email || user?.email || 'Studio Team';
  const normalizedRole = String(role || profile?.role || 'staff')
    .trim()
    .toLowerCase();
  const isOwner = normalizedRole === 'owner';
  const roleLabel = isOwner ? 'Owner' : 'Staff';

  const [periodId, setPeriodId] = useState(DASHBOARD_PERIOD_PRESETS.DAYS_30);

  const {
    greetingInfo,
    periodBounds,
    todayOverview,
    todaySchedule,
    isTodayScheduleTruncated,
    todayScheduleMaxLimit,
    needsAttentionItems,
    recentBookingRequests,
    hasMoreNewBookingRequests,
    ownerFinancialSummary,
    cashFlowTrend,
    bookingTrend,
    loading,
    errors,
    retryDashboard,
  } = useDashboardData({
    isOwner,
    periodId,
    now,
  });

  return (
    <div data-testid="studio-operations-command-center" className="space-y-3.5 sm:space-y-4 lg:space-y-5">
      {/* SECTION A — Header & Quick Actions */}
      <DashboardHeader
        displayName={displayName}
        roleLabel={roleLabel}
        isOwner={isOwner}
        greetingInfo={greetingInfo}
      />

      {/* SECTION B — Today's Overview (4 Primary Metrics) */}
      <DashboardTodayOverview
        todayOverview={todayOverview}
        isOwner={isOwner}
        isLoading={loading.today}
        error={errors.today}
        onRetry={retryDashboard}
      />

      {/* Primary Operational Grid: SECTION C (Today's Studio Schedule) + SECTION D (Needs Attention) */}
      <div className="grid grid-cols-1 items-start gap-3.5 sm:gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8 2xl:col-span-8">
          <DashboardTodaySchedule
            todaySchedule={todaySchedule}
            formattedDateFull={greetingInfo.formattedDateFull}
            isLoading={loading.today}
            error={errors.today}
            isTruncated={isTodayScheduleTruncated}
            maxLimit={todayScheduleMaxLimit}
            onRetry={retryDashboard}
          />
        </div>

        <aside className="min-w-0 xl:col-span-4 2xl:col-span-4">
          <DashboardNeedsAttention
            items={needsAttentionItems}
            recentBookingRequests={recentBookingRequests}
            hasMoreNewBookingRequests={hasMoreNewBookingRequests}
            isLoading={loading.attention}
            error={errors.attention}
            onRetry={retryDashboard}
          />
        </aside>
      </div>

      {/* SECTION E — Owner Financial Overview (Strictly Owner-Only; never mounted for Staff) */}
      {isOwner ? (
        <DashboardOwnerFinancials
          periodId={periodId}
          onPeriodChange={setPeriodId}
          periodBounds={periodBounds}
          financialSummary={ownerFinancialSummary}
          cashFlowTrend={cashFlowTrend}
          isLoading={loading.ownerFinancial}
          error={errors.ownerFinancial}
          onRetry={retryDashboard}
        />
      ) : null}

      {/* SECTION F — Booking Trend (Apache ECharts 6) */}
      <DashboardBookingTrendChart
        bookingTrend={bookingTrend}
        periodId={periodId}
        onPeriodChange={setPeriodId}
        isLoading={loading.periodBookings}
        error={errors.periodBookings}
        onRetry={retryDashboard}
      />
    </div>
  );
}

export default AdminDashboardPage;
