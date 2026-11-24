import { ArrowLeftRight, BarChart3, LayoutDashboard, Wallet } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { BOOKKEEPING_TAB_ITEMS, BOOKKEEPING_TABS } from '../config/bookkeeping-config';

const TAB_ICONS = {
  [BOOKKEEPING_TABS.OVERVIEW]: LayoutDashboard,
  [BOOKKEEPING_TABS.TRANSACTIONS]: ArrowLeftRight,
  [BOOKKEEPING_TABS.CASH_SETTLEMENT]: Wallet,
  [BOOKKEEPING_TABS.REPORTS]: BarChart3,
};

export function BookkeepingWorkspaceTabs({
  activeTab,
  onTabChange,
  transactionsCount = 0,
  openPayablesCount = 0,
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label="Workspace Pembukuan"
      className="sa-pill-track grid w-full grid-cols-2 gap-1 sm:inline-grid sm:w-auto sm:grid-cols-4"
    >
      {BOOKKEEPING_TAB_ITEMS.map((tab) => {
        const Icon = TAB_ICONS[tab.id] || LayoutDashboard;
        const isActive = activeTab === tab.id;
        const badgeCount =
          tab.id === BOOKKEEPING_TABS.TRANSACTIONS
            ? transactionsCount
            : tab.id === BOOKKEEPING_TABS.CASH_SETTLEMENT
              ? openPayablesCount
              : null;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange?.(tab.id)}
            className={`relative inline-flex min-h-9.5 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors duration-150 sm:px-3.5 ${
              isActive ? 'font-semibold text-[#151515]' : 'font-medium text-[#666159] hover:text-[#151515]'
            }`}
          >
            {isActive ? (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : 'bookkeeping-workspace-tab-pill'}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 460, damping: 34 }
                }
                className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_3px_rgba(21,21,21,0.08),0_0_0_1px_rgba(21,21,21,0.05)]"
                aria-hidden="true"
              />
            ) : null}
            <Icon
              className={`relative z-10 h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#151515]' : 'text-[#8B857B]'}`}
              aria-hidden="true"
            />
            <span className="relative z-10 truncate">{tab.label}</span>
            {badgeCount !== null ? (
              <span
                className={`relative z-10 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                  tab.id === BOOKKEEPING_TABS.CASH_SETTLEMENT && badgeCount > 0
                    ? isActive
                      ? 'bg-[#FF4B22] text-white'
                      : 'bg-[#FFEDE8] text-[#B92B0C]'
                    : isActive
                      ? 'bg-[#C8F13A] text-[#151515]'
                      : 'bg-[#151515]/[0.06] text-[#46433D]'
                }`}
              >
                {badgeCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
