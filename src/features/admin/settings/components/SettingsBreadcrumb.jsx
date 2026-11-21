import { Fragment } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';

export function SettingsBreadcrumb({
  items = [],
  backTo = '',
  backLabel = 'Back to Settings',
  onNavigate = null,
}) {
  const navigate = useNavigate();

  const handleGo = (target) => {
    if (!target) return;
    if (typeof onNavigate === 'function') {
      onNavigate(target);
      return;
    }
    navigate(target);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
      <nav aria-label="Settings breadcrumb" className="hidden min-w-0 sm:block">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#666159]">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <Fragment key={`${item.label}-${idx}`}>
                {idx > 0 ? (
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5 text-[#8B857B]" />
                  </li>
                ) : null}
                {isLast || !item.to ? (
                  <li
                    aria-current={isLast ? 'page' : undefined}
                    className={isLast ? 'font-semibold text-[#151515]' : undefined}
                  >
                    {item.label}
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      onClick={() => handleGo(item.to)}
                      className="cursor-pointer transition-colors hover:text-[#FF4B22]"
                    >
                      {item.label}
                    </button>
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </nav>

      {backTo ? (
        <button
          type="button"
          onClick={() => handleGo(backTo)}
          className="sa-control sa-btn-secondary inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
