import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import {
  CustomFieldDefinition,
  CustomFieldType,
  CUSTOM_FIELD_TYPE_LABELS,
} from '../../../core/custom-fields/custom-field.models';

/**
 * Quick-add custom field button that appears in the table header.
 * Renders a "+" icon triggering a mat-menu with a minimal form (label + type).
 * Only visible to Admin users.
 */
@Component({
  selector: 'app-quick-add-field',
  standalone: true,
  imports: [
    FormsModule,
    MatMenuModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isAdmin()) {
      <button mat-icon-button
              [matMenuTriggerFor]="addFieldMenu"
              [attr.aria-label]="'common.quickAddField.addButton' | transloco"
              class="add-field-trigger">
        <mat-icon>add_circle_outline</mat-icon>
      </button>
      <mat-menu #addFieldMenu="matMenu" class="quick-add-field-menu">
        <div class="quick-add-form"
             (click)="$event.stopPropagation()"
             (keydown)="$event.stopPropagation()">
          <div class="quick-add-header">{{ 'common.quickAddField.title' | transloco }}</div>

          <mat-form-field appearance="outline" class="quick-add-input">
            <mat-label>{{ 'common.quickAddField.fieldLabel' | transloco }}</mat-label>
            <input matInput
                   [(ngModel)]="label"
                   placeholder="e.g. Revenue Tier"
                   (keydown.enter)="onSubmit()">
          </mat-form-field>

          <mat-form-field appearance="outline" class="quick-add-input">
            <mat-label>{{ 'common.quickAddField.fieldType' | transloco }}</mat-label>
            <mat-select [(ngModel)]="selectedType">
              @for (type of availableTypes; track type) {
                <mat-option [value]="type">{{ typeLabel(type) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <button mat-flat-button
                  color="primary"
                  class="quick-add-submit"
                  [disabled]="saving() || label.trim().length === 0"
                  (click)="onSubmit()">
            {{ saving() ? 'Creating...' : 'Create' }}
          </button>

          <div class="quick-add-hint">{{ 'common.quickAddField.configureHint' | transloco }}</div>
        </div>
      </mat-menu>
    }
  `,
  styles: `
    .add-field-trigger {
      width: 32px;
      height: 32px;
      line-height: 32px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--color-text-muted);
        transition: color var(--duration-fast) var(--ease-default);
      }

      &:hover mat-icon {
        color: var(--color-primary);
      }
    }

    .quick-add-form {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 240px;
    }

    .quick-add-header {
      font-weight: 500;
      font-size: 13px;
      color: var(--color-text-secondary);
      padding-bottom: 4px;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 4px;
    }

    .quick-add-input {
      width: 100%;

      ::ng-deep .mat-mdc-form-field-infix {
        min-height: 36px;
        padding-top: 6px;
        padding-bottom: 6px;
      }
    }

    .quick-add-submit {
      align-self: flex-end;
    }

    .quick-add-hint {
      font-size: 11px;
      color: var(--color-text-muted);
      text-align: center;
    }
  `,
})
export class QuickAddFieldComponent {
  entityType = input.required<string>();
  existingFieldCount = input<number>(0);
  fieldCreated = output<CustomFieldDefinition>();

  private readonly menuTrigger = viewChild(MatMenuTrigger);
  private readonly authStore = inject(AuthStore);
  private readonly customFieldService = inject(CustomFieldService);
  private readonly snackBar = inject(MatSnackBar);

  isAdmin = computed(() => this.authStore.userRole() === 'Admin');

  label = '';
  selectedType: CustomFieldType = CustomFieldType.Text;
  saving = signal(false);

  /** Types available for quick-add (excluding types that need extra config like options or relation target). */
  readonly availableTypes: CustomFieldType[] = [
    CustomFieldType.Text,
    CustomFieldType.Number,
    CustomFieldType.Date,
    CustomFieldType.Checkbox,
    CustomFieldType.Currency,
  ];

  typeLabel(type: CustomFieldType): string {
    return CUSTOM_FIELD_TYPE_LABELS[type] ?? type;
  }

  onSubmit(): void {
    const trimmedLabel = this.label.trim();
    if (trimmedLabel.length === 0 || this.saving()) return;

    const name = trimmedLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    this.saving.set(true);

    this.customFieldService
      .createField({
        entityType: this.entityType(),
        name,
        label: trimmedLabel,
        fieldType: this.selectedType,
        sortOrder: this.existingFieldCount(),
      })
      .subscribe({
        next: (field) => {
          this.saving.set(false);
          this.fieldCreated.emit(field);
          this.menuTrigger()?.closeMenu();
          this.resetForm();
          this.snackBar.open(`Column "${field.label}" added`, 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err?.error?.message || err?.error?.title || 'Failed to create field';
          this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
        },
      });
  }

  resetForm(): void {
    this.label = '';
    this.selectedType = CustomFieldType.Text;
  }
}
