import { ArrowLeftRight, FileText, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

export function PaymentWorkspaceTabs({
  activeTab,
  onTabChange,
  invoicesCount = 0,
  transactionsCount = 0,
  pendingEvidenceCount = 0,
}) {
  const prefersReducedMotion = useReducedMotion();

  const tabs = [
    {
      id: 'invoices',
      label: 'Daftar Invoice',
      count: invoicesCount,
      icon: FileText,
    },
    {
      id: 'transactions',
      label: 'Riwayat Bayar',
      count: transactionsCount,
      icon: ArrowLeftRight,
    },
    {
      id: 'evidence',
      label: 'Payment Evidence',
      count: pendingEvidenceCount,
      highlightPending: pendingEvidenceCount > 0,
      icon: ShieldCheck,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Workspace Payment and Bill"
      className="sa-pill-track sa-scroll-x flex w-full items-center gap-1 sm:grid sm:w-auto sm:grid-cols-3"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`relative inline-flex min-h-9.5 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-3 py-1.5 text-xs whitespace-nowrap transition-colors sm:px-4 ${
              isActive
                ? 'font-semibold text-[#151515]'
                : 'font-medium text-[#666159] hover:text-[#151515]'
            }`}
          >
            {isActive ? (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : 'payment-workspace-tab-pill'}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 460, damping: 34 }
                }
                className="absolute inset-0 rounded-[10px] bg-white shadow-[0_2px_8px_-2px_rgba(21,21,21,0.12),0_0_0_1px_rgba(21,21,21,0.05)]"
                aria-hidden="true"
              />
            ) : null}

            <Icon
              className={`relative z-10 h-3.5 w-3.5 shrink-0 ${
                isActive ? 'text-[#151515]' : 'text-[#8B857B]'
              }`}
              aria-hidden="true"
            />
            <span className="relative z-10">{tab.label}</span>
            <span
              className={`relative z-10 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                isActive
                  ? 'bg-[#C8F13A] text-[#151515]'
                  : tab.highlightPending
                    ? 'bg-[#FF4B22] text-white'
                    : 'bg-[#151515]/[0.06] text-[#46433D]'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
