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
      label: 'Invoices',
      count: invoicesCount,
      icon: FileText,
    },
    {
      id: 'transactions',
      label: 'Transactions',
      count: transactionsCount,
      icon: ArrowLeftRight,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Workspace Payment and Bill"
      className="border-studio-ink bg-studio-ivory grid w-full grid-cols-2 border-2 p-0.5 shadow-[2px_2px_0px_#151515] sm:inline-grid sm:w-auto"
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
                ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 border px-3 py-1 font-mono text-[10.5px] font-extrabold whitespace-nowrap uppercase sm:px-4'
                : 'text-studio-muted-ink hover:text-studio-ink inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 border border-transparent px-3 py-1 font-mono text-[10.5px] font-bold whitespace-nowrap uppercase sm:px-4'
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{tab.label}</span>
            <span className="border-studio-ink bg-studio-white text-studio-ink border px-1.5 py-0 text-[9px] font-extrabold tabular-nums">
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
