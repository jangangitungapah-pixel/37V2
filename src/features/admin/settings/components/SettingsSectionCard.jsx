import { Pencil, Plus, Trash2 } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

export function SettingsStatusToggle({ isActive, label, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={Boolean(isActive)}
      aria-label={`Toggle status ${label}`}
      className={
        isActive
          ? 'sa-control inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border-[#8BAD12]/40 bg-[#EDF8C2] px-3 py-1 text-xs font-semibold text-[#243300] disabled:cursor-not-allowed disabled:opacity-55'
          : 'sa-control inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border-[#151515]/12 bg-[#151515]/[0.04] px-3 py-1 text-xs font-medium text-[#666159] disabled:cursor-not-allowed disabled:opacity-55'
      }
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${isActive ? 'bg-[#658800]' : 'bg-[#8B857B]'}`}
      />
      <span>{isActive ? 'Active' : 'Inactive'}</span>
    </button>
  );
}

export function SettingsItemActions({
  itemName,
  onEdit,
  onDelete,
  disableEdit = false,
  disableDelete = false,
  readOnly = false,
  deleteTitle = '',
}) {
  const isEditDisabled = readOnly || disableEdit;
  const isDeleteDisabled = readOnly || disableDelete;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isEditDisabled}
        onClick={onEdit}
        aria-label={`Edit ${itemName}`}
        className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Pencil className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
        <span>Edit</span>
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleteDisabled}
        title={deleteTitle || `Delete ${itemName}`}
        aria-label={`Delete ${itemName}`}
        className="sa-control inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#FF4B22]/20 bg-[#FFEDE8]/80 px-3 py-1.5 text-xs font-semibold text-[#B92B0C] transition-colors hover:border-[#FF4B22] hover:bg-[#FF4B22] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Delete</span>
      </button>
    </div>
  );
}

export function SettingsSectionCard({
  sectionId,
  order,
  title,
  description,
  countLabel = '',
  actionLabel = '',
  onAction = null,
  readOnly = false,
  headerNote = '',
  children,
}) {
  return (
    <AdminSurface as="section" variant="card" aria-labelledby={sectionId} className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-[#151515]/[0.07] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone="ink" size="sm" className="font-mono uppercase">
              SECTION {order}
            </AdminStatusBadge>
            {countLabel ? (
              <AdminStatusBadge tone="ivory" size="sm" className="font-mono">
                {countLabel}
              </AdminStatusBadge>
            ) : null}
          </div>

          <h3
            id={sectionId}
            className="mt-2.5 text-lg font-bold tracking-tight text-[#151515] sm:text-xl"
          >
            {title}
          </h3>

          {description ? (
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#666159] sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>

        {actionLabel && onAction && !readOnly ? (
          <button
            type="button"
            onClick={onAction}
            className="sa-control sa-btn-lime inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{actionLabel}</span>
          </button>
        ) : null}
      </div>

      {headerNote ? (
        <div className="sa-panel-ivory mt-4 px-3.5 py-2.5 text-xs font-medium text-[#46433D]">
          {headerNote}
        </div>
      ) : null}

      <div className="mt-4">{children}</div>
    </AdminSurface>
  );
}
