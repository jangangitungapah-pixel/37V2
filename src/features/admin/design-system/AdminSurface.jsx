import { cn } from '@/lib/utils';

const VARIANT_CLASSES = {
  card: 'sa-card',
  hero: 'sa-card-hero',
  panel: 'sa-panel',
  ivory: 'sa-panel-ivory',
  subcard: 'sa-subcard',
};

/**
 * Spatial Ambient surface container. Renders semantic element with soft elevation
 * and hairline boundaries strictly scoped inside authenticated Admin & Client Workspaces.
 */
export function AdminSurface({
  as: Component = 'div',
  variant = 'card',
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={cn(VARIANT_CLASSES[variant] || VARIANT_CLASSES.card, className)}
      {...props}
    >
      {children}
    </Component>
  );
}
