import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from './permission.service';
import { EffectivePermission, FieldPermission } from './permission.models';

interface PermissionState {
  permissions: EffectivePermission[];
  fieldPermissions: FieldPermission[];
  isLoaded: boolean;
  isLoading: boolean;
}

const initialState: PermissionState = {
  permissions: [],
  fieldPermissions: [],
  isLoaded: false,
  isLoading: false,
};

export const PermissionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /**
     * Maps "EntityType:Operation" -> scope string for O(1) lookups.
     */
    permissionMap: computed(() => {
      const map = new Map<string, string>();
      for (const p of store.permissions()) {
        map.set(`${p.entityType}:${p.operation}`, p.scope);
      }
      return map;
    }),
    /**
     * Maps "EntityType:FieldName" -> access level for O(1) lookups.
     */
    fieldPermissionMap: computed(() => {
      const map = new Map<string, string>();
      for (const fp of store.fieldPermissions()) {
        map.set(`${fp.entityType}:${fp.fieldName}`, fp.accessLevel);
      }
      return map;
    }),
  })),
  withMethods((store, permissionService = inject(PermissionService)) => ({
    /**
     * Load all effective permissions for the current user.
     * Called after successful login and token refresh.
     */
    async loadPermissions(): Promise<void> {
      patchState(store, { isLoading: true });
      try {
        const permissions = await firstValueFrom(
          permissionService.getMyPermissions()
        );
        patchState(store, {
          permissions,
          isLoaded: true,
          isLoading: false,
        });
      } catch (error) {
        console.error('Failed to load permissions:', error);
        patchState(store, { isLoading: false });
      }
    },

    /**
     * Load field-level permissions for the current user.
     * Can be called alongside loadPermissions or lazily when needed.
     */
    async loadFieldPermissions(): Promise<void> {
      try {
        const fieldPermissions = await firstValueFrom(
          permissionService.getMyFieldPermissions()
        );
        patchState(store, { fieldPermissions });
      } catch (error) {
        console.error('Failed to load field permissions:', error);
      }
    },

    /**
     * Check if user has permission for an entity operation.
     * Returns a computed signal for reactive template usage.
     */
    hasPermission(entityType: string, operation: string): boolean {
      const scope = store.permissionMap().get(`${entityType}:${operation}`);
      return !!scope && scope !== 'none';
    },

    /**
     * Get the scope for an entity operation.
     * Returns the scope string ('none' | 'own' | 'team' | 'all') or 'none' if not found.
     */
    getScope(entityType: string, operation: string): string {
      return store.permissionMap().get(`${entityType}:${operation}`) ?? 'none';
    },

    /**
     * Get field access level for a specific entity field.
     * Returns the access level or the provided fallback (default: 'editable').
     */
    getFieldAccess(
      entityType: string,
      fieldName: string,
      fallback: 'hidden' | 'readonly' | 'editable' = 'editable'
    ): string {
      return (
        store.fieldPermissionMap().get(`${entityType}:${fieldName}`) ?? fallback
      );
    },

    /**
     * Clear all permission state (on logout).
     */
    clear(): void {
      patchState(store, {
        permissions: [],
        fieldPermissions: [],
        isLoaded: false,
        isLoading: false,
      });
    },
  }))
);
