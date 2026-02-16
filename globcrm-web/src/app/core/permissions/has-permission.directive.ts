import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect,
  DestroyRef,
} from '@angular/core';
import { PermissionStore } from './permission.store';

/**
 * Structural directive that conditionally renders elements based on permission.
 *
 * Usage:
 *   <button *appHasPermission="'Contact:Edit'" (click)="edit()">Edit</button>
 *   <div *appHasPermission="'Deal:Create'">Create new deal</div>
 *
 * The input format is "EntityType:Operation" (e.g., "Contact:Edit", "Deal:View").
 * The directive reactively watches the PermissionStore using signals/computed,
 * so permission changes automatically show/hide the element without polling.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly permissionStore = inject(PermissionStore);
  private readonly destroyRef = inject(DestroyRef);

  private hasView = false;
  private entityType = '';
  private operation = '';

  @Input()
  set appHasPermission(permission: string) {
    const parts = permission.split(':');
    if (parts.length === 2) {
      this.entityType = parts[0];
      this.operation = parts[1];
    }
  }

  constructor() {
    // Use effect() for reactive permission checking via signals.
    // This avoids method calls per change detection cycle (research pitfall #7).
    const effectRef = effect(() => {
      const allowed = this.permissionStore.hasPermission(
        this.entityType,
        this.operation
      );
      this.updateView(allowed);
    });

    this.destroyRef.onDestroy(() => {
      effectRef.destroy();
    });
  }

  private updateView(allowed: boolean): void {
    if (allowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
