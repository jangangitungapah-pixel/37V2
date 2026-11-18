import { Pencil, Plus, Trash2 } from 'lucide-react';

export function SettingsStatusToggle({ isActive, label, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={Boolean(isActive)}
      aria-label={`Toggle status ${label}`}
      className={
        isActive
          ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-extrabold uppercase transition-colors'
          : 'border-studio-ink bg-studio-muted text-studio-muted-ink inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] font-bold uppercase transition-colors'
      }
    >
      <span
        aria-hidden="true"
        className={`border-studio-ink h-2 w-2 border ${isActive ? 'bg-studio-ink' : 'bg-transparent'}`}
      />
      <span>{isActive ? 'Active' : 'Inactive'}</span>
    </button>
  );
}

export function SettingsItemActions({
  itemName,
  onEdit,
  onDelete,
  disableDelete = false,
  deleteTitle = '',
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${itemName}`}
        className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Edit</span>
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={disableDelete}
        title={deleteTitle || `Delete ${itemName}`}
        aria-label={`Delete ${itemName}`}
        className="brutal-btn bg-studio-ivory text-studio-error-ink hover:bg-studio-orange hover:text-studio-white inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
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
  headerNote = '',
  children,
}) {
  return (
    <section aria-labelledby={sectionId} className="brutal-card bg-studio-white p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b-2 border-neutral-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-studio-ink bg-studio-ink text-studio-lime border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-widest uppercase">
              SECTION {order}
            </span>
            {countLabel ? (
              <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                {countLabel}
              </span>
            ) : null}
          </div>

          <h3
            id={sectionId}
            className="font-display text-studio-ink mt-2 text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl"
          >
            {title}
          </h3>

          {description ? (
            <p className="text-studio-muted-ink mt-1.5 max-w-2xl text-xs leading-relaxed font-medium sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>

        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 font-mono text-xs font-extrabold tracking-wider uppercase"
          >
            <Plus className="h-4 w-4 shrink-0 stroke-[2.5]" aria-hidden="true" />
            <span>{actionLabel}</span>
          </button>
        ) : null}
      </div>

      {headerNote ? (
        <div className="border-studio-ink bg-studio-ivory text-studio-muted-ink mt-4 border px-3 py-2 font-mono text-[11px] font-semibold">
          {headerNote}
        </div>
      ) : null}

      <div className="mt-4">{children}</div>
    </section>
  );
}
