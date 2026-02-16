import {
  Directive,
  Input,
  ElementRef,
  Renderer2,
  inject,
  effect,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { PermissionStore } from '../../core/permissions/permission.store';

/**
 * Attribute directive that controls field-level access (hidden/readonly/editable).
 *
 * Usage:
 *   <input [appFieldAccess]="'Contact:phone'" matInput>
 *   <input [appFieldAccess]="'Contact:email'" [appFieldAccessFallback]="'readonly'" matInput>
 *   <button [appFieldAccess]="'Deal:amount'">Edit Amount</button>
 *
 * The input format is "EntityType:FieldName" (e.g., "Contact:phone", "Deal:amount").
 *
 * Access levels:
 *   - 'hidden':   Sets display:none on the host element
 *   - 'readonly': Adds readonly attribute for inputs, disabled for buttons
 *   - 'editable': No modification (default)
 *
 * The directive reactively watches the PermissionStore using signals.
 * Field-level permissions loading is wired when entity pages are built in Phase 3.
 */
@Directive({
  selector: '[appFieldAccess]',
  standalone: true,
})
export class FieldAccessDirective implements OnInit {
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly permissionStore = inject(PermissionStore);
  private readonly destroyRef = inject(DestroyRef);

  private entityType = '';
  private fieldName = '';

  @Input()
  set appFieldAccess(value: string) {
    const parts = value.split(':');
    if (parts.length === 2) {
      this.entityType = parts[0];
      this.fieldName = parts[1];
    }
  }

  @Input()
  appFieldAccessFallback: 'hidden' | 'readonly' | 'editable' = 'editable';

  ngOnInit(): void {
    // Use effect() to reactively apply field access based on permission signals
    const effectRef = effect(() => {
      const accessLevel = this.permissionStore.getFieldAccess(
        this.entityType,
        this.fieldName,
        this.appFieldAccessFallback
      );
      this.applyAccessLevel(accessLevel);
    });

    this.destroyRef.onDestroy(() => {
      effectRef.destroy();
    });
  }

  private applyAccessLevel(accessLevel: string): void {
    const el = this.elementRef.nativeElement;
    const tagName = el.tagName?.toLowerCase();

    // Reset previous states
    this.renderer.removeStyle(el, 'display');
    this.renderer.removeAttribute(el, 'readonly');
    this.renderer.removeAttribute(el, 'disabled');
    this.renderer.removeClass(el, 'field-hidden');
    this.renderer.removeClass(el, 'field-readonly');

    switch (accessLevel) {
      case 'hidden':
        this.renderer.setStyle(el, 'display', 'none');
        this.renderer.addClass(el, 'field-hidden');
        break;

      case 'readonly':
        this.renderer.addClass(el, 'field-readonly');
        if (tagName === 'input' || tagName === 'textarea') {
          this.renderer.setAttribute(el, 'readonly', 'true');
        } else if (tagName === 'button' || tagName === 'select') {
          this.renderer.setAttribute(el, 'disabled', 'true');
        } else {
          // For other elements (e.g., mat-form-field wrappers), add readonly
          this.renderer.setAttribute(el, 'readonly', 'true');
        }
        break;

      case 'editable':
        // No modification needed (default state)
        break;
    }
  }
}
