import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

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
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby={`service-card-heading-${serviceType.id}`}
      className={`overflow-hidden ${serviceType.isActive ? '' : 'opacity-80'}`}
    >
      {/* Card Header */}
      <div className="flex flex-col gap-2.5 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/80 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <AdminStatusBadge tone={isStudio ? 'lime' : 'ink'} size="sm" className="font-mono">
              {isStudio ? 'STUDIO' : 'WFA'}
            </AdminStatusBadge>
            <AdminStatusBadge tone="neutral" size="sm" className="font-mono">
              {activeCount}/{options.length} Subcategories Aktif
            </AdminStatusBadge>
          </div>

          <h3
            id={`service-card-heading-${serviceType.id}`}
            className="mt-2 text-base font-bold tracking-tight text-[#151515] sm:mt-2.5 sm:text-xl"
          >
            {serviceType.name}
          </h3>

          {serviceType.description ? (
            <p className="mt-1 hidden text-xs leading-relaxed text-[#666159] sm:block">
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
            className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            disabled={readOnly}
            onClick={() => onRequestDeleteService(serviceType)}
            aria-label={`Delete Service ${serviceType.name}`}
            className="sa-control inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#FF4B22]/20 bg-[#FFEDE8]/80 px-3 py-1.5 text-xs font-semibold text-[#B92B0C] transition-colors hover:border-[#FF4B22] hover:bg-[#FF4B22] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Tutup' : 'Buka'} daftar subcategory ${serviceType.name}`}
            className="sa-control sa-btn-secondary inline-flex h-9 w-9 cursor-pointer items-center justify-center text-[#46433D] hover:bg-[#EDF8C2] hover:text-[#151515]"
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
        <div className="space-y-3 p-3 sm:space-y-3.5 sm:p-5">
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
                className="sa-control sa-btn-lime inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold sm:w-auto"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Subcategory ({serviceType.name})</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </AdminSurface>
  );
}
