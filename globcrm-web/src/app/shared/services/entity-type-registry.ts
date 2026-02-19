/**
 * Configuration for a single entity type, providing display metadata
 * used throughout the application for routing, icons, labels, and colors.
 */
export interface EntityTypeConfig {
  icon: string;
  label: string;
  labelPlural: string;
  routePrefix: string;
  color: string;
}

/**
 * Centralized registry of all CRM entity types and their display metadata.
 * Used by the preview sidebar, feed items, related entity tabs, and navigation.
 *
 * Keys match the EntityType string values returned by the backend API.
 */
export const ENTITY_TYPE_REGISTRY: Record<string, EntityTypeConfig> = {
  Contact:  { icon: 'person',      label: 'Contact',  labelPlural: 'Contacts',   routePrefix: '/contacts',   color: 'var(--color-info)' },
  Company:  { icon: 'business',    label: 'Company',  labelPlural: 'Companies',  routePrefix: '/companies',  color: 'var(--color-secondary)' },
  Deal:     { icon: 'handshake',   label: 'Deal',     labelPlural: 'Deals',      routePrefix: '/deals',      color: 'var(--color-warning)' },
  Lead:     { icon: 'trending_up', label: 'Lead',     labelPlural: 'Leads',      routePrefix: '/leads',      color: 'var(--color-success)' },
  Activity: { icon: 'task_alt',    label: 'Activity', labelPlural: 'Activities', routePrefix: '/activities', color: 'var(--color-accent)' },
  Product:  { icon: 'inventory_2', label: 'Product',  labelPlural: 'Products',   routePrefix: '/products',   color: 'var(--color-primary)' },
};

/**
 * Retrieve entity type configuration by entity type string.
 * Returns null if the entity type is not recognized.
 */
export function getEntityConfig(entityType: string): EntityTypeConfig | null {
  return ENTITY_TYPE_REGISTRY[entityType] ?? null;
}

/**
 * Build a router-compatible route path for a specific entity instance.
 * Returns '/' if the entity type is not recognized.
 */
export function getEntityRoute(entityType: string, entityId: string): string {
  const config = ENTITY_TYPE_REGISTRY[entityType];
  return config ? `${config.routePrefix}/${entityId}` : '/';
}
