import { Activity, Boxes, Layers, Wrench } from 'lucide-react';

export function InventoryWorkspaceTabs({
  activeTab,
  onTabChange,
  allCount = 0,
  consumablesCount = 0,
  equipmentCount = 0,
  activityCount = 0,
}) {
  const tabs = [
    { id: 'all', label: 'All Items', count: allCount, icon: Layers },
    { id: 'consumables', label: 'Consumables', count: consumablesCount, icon: Boxes },
    { id: 'equipment', label: 'Equipment', count: equipmentCount, icon: Wrench },
    { id: 'activity', label: 'Activity', count: activityCount, icon: Activity },
  ];

  return (
    <div
      role="tablist"
      aria-label="Workspace Inventory"
      className="sa-pill-track grid w-full grid-cols-2 gap-1 sm:inline-grid sm:w-auto sm:grid-cols-4"
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
            onClick={() => onTabChange?.(tab.id)}
            className={
              isActive
                ? 'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-[10px] bg-white px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap text-[#151515] shadow-[0_1px_3px_rgba(21,21,21,0.08)] sm:min-h-10 sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-xs'
                : 'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-[#666159] transition-colors hover:text-[#151515] sm:min-h-10 sm:gap-1.5 sm:px-3.5 sm:py-1.5 sm:text-xs'
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
