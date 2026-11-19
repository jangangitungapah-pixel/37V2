import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';

import { DELIVERY_MODES, PRICING_MODES } from '../pricing/config/default-pricing-settings';
import { ServiceOptionList } from './ServiceOptionList';
import { SettingsStatusToggle } from './SettingsSectionCard';

export function ServiceTypeCard({
  serviceType,
  defaultExpanded = true,
  readOnly = false,
  onEditService,
  onToggleServiceActive,
  onRequestDeleteService,
  onAddOption,
  onEditOption,
  onToggleOptionActive,
  onRequestDeleteOption,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const options = serviceType.options || [];
  const activeCount = options.filter(
    (opt) => opt.isActive !== false && opt.pricing?.mode !== PRICING_MODES.UNCONFIGURED,
  ).length;
  const isStudio = serviceType.deliveryMode === DELIVERY_MODES.STUDIO;

  return (
    <section
      aria-labelledby={`service-card-heading-${serviceType.id}`}
      className={`brutal-card bg-studio-white ${serviceType.isActive ? '' : 'opacity-85'}`}
    >
      {/* Card Header */}
      <div className="border-studio-ink bg-studio-ivory/60 flex flex-col gap-3 border-b-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`border-studio-ink border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase ${
                isStudio ? 'bg-studio-lime text-studio-ink' : 'bg-studio-ink text-studio-ivory'
              }`}
            >
              {isStudio ? 'STUDIO' : 'WFA'}
            </span>
            <span className="border-studio-ink bg-studio-white text-studio-ink border px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
              {activeCount}/{options.length} Subcategories Aktif
            </span>
          </div>

          <h3
            id={`service-card-heading-${serviceType.id}`}
            className="font-display text-studio-ink mt-2 text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl"
          >
            {serviceType.name}
          </h3>

          {serviceType.description ? (
            <p className="text-studio-muted-ink mt-1 text-xs leading-relaxed font-medium">
              {serviceType.description}
            </p>
          ) : null}
        </div>

        {/* Service Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <SettingsStatusToggle
            isActive={serviceType.isActive}
            label={serviceType.name}
            disabled={readOnly}
            onToggle={() => onToggleServiceActive(serviceType)}
          />

          <button
            type="button"
            disabled={readOnly}
            onClick={() => onEditService(serviceType)}
            aria-label={`Edit Service ${serviceType.name}`}
            className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            disabled={readOnly}
            onClick={() => onRequestDeleteService(serviceType)}
            aria-label={`Delete Service ${serviceType.name}`}
            className="brutal-btn bg-studio-ivory text-studio-error-ink hover:bg-studio-orange hover:text-studio-white inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Tutup' : 'Buka'} daftar subcategory ${serviceType.name}`}
            className="border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex h-10 w-10 cursor-pointer items-center justify-center border-2 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Subcategory Body */}
      {isExpanded ? (
        <div className="space-y-3.5 p-4 sm:p-5">
          <ServiceOptionList
            options={options}
            readOnly={readOnly}
            onEditOption={(option) => onEditOption(serviceType, option)}
            onToggleOptionActive={(option) => onToggleOptionActive(serviceType, option)}
            onRequestDeleteOption={(option) => onRequestDeleteOption(serviceType, option)}
          />

          {!readOnly ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onAddOption(serviceType)}
                className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 px-4 py-2 font-mono text-xs font-extrabold tracking-wider uppercase sm:w-auto"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                <span>Add Subcategory ({serviceType.name})</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
