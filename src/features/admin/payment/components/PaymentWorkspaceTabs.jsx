import { ArrowLeftRight, FileText } from 'lucide-react';

export function PaymentWorkspaceTabs({
  activeTab,
  onTabChange,
  invoicesCount = 0,
  transactionsCount = 0,
}) {
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
  ];

  return (
    <div
      role="tablist"
      aria-label="Workspace Payment and Bill"
      className="sa-pill-track grid w-full grid-cols-2 sm:inline-grid sm:w-auto"
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
            className={
              isActive
                ? 'inline-flex min-h-9.5 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#151515] shadow-[0_1px_3px_rgba(21,21,21,0.08)] sm:min-h-10 sm:px-4'
                : 'inline-flex min-h-9.5 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[#666159] transition-colors hover:text-[#151515] sm:min-h-10 sm:px-4'
            }
          >
            <Icon
              className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#151515]' : 'text-[#8B857B]'}`}
              aria-hidden="true"
            />
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                isActive ? 'bg-[#C8F13A] text-[#151515]' : 'bg-[#151515]/[0.06] text-[#46433D]'
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
