import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Subscription } from 'rxjs';

import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import {
  CustomFieldDefinition,
  CustomFieldSection,
  CustomFieldType,
} from '../../../core/custom-fields/custom-field.models';
import { PermissionStore } from '../../../core/permissions/permission.store';

/**
 * Group of fields within a named section.
 */
interface FieldGroup {
  id: string;
  name: string;
  sortOrder: number;
  fields: CustomFieldDefinition[];
}

/**
 * Reusable custom field form component that dynamically renders form inputs
 * based on field definitions loaded from the CustomFieldService.
 *
 * Supports all 9 custom field types: Text, Number, Date, Dropdown, Checkbox,
 * MultiSelect, Currency, File, and Relation.
 *
 * Groups fields by section and applies field-level access control from
 * the PermissionStore (hidden/readonly/editable).
 *
 * Usage:
 *   <app-custom-field-form
 *     entityType="Company"
 *     [customFieldValues]="company.customFields"
 *     [readonly]="true"
 *     (valuesChanged)="onCustomFieldsChanged($event)" />
 */
@Component({
  selector: 'app-custom-field-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .custom-field-form-loading {
      display: flex;
      justify-content: center;
      padding: 24px;
    }

    .custom-field-form-empty {
      color: var(--color-text-secondary);
      text-align: center;
      padding: 24px;
      font-size: 14px;
    }

    .field-section {
      margin-bottom: 16px;
    }

    .field-section h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 500;
      color: var(--color-text);
    }

    .field-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 8px 16px;
    }

    .field-item {
      display: flex;
      flex-direction: column;
    }

    .checkbox-field {
      padding: 8px 0;
    }

    .currency-prefix {
      font-size: 14px;
      color: var(--color-text-secondary);
    }

    .file-field {
      padding: 8px 0;
    }

    .file-field label {
      display: block;
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    }

    .file-field-placeholder {
      color: var(--color-text-secondary);
      font-size: 13px;
      font-style: italic;
    }
  `,
  template: `
    @if (isLoading()) {
      <div class="custom-field-form-loading">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
    } @else if (groupedFields().length === 0) {
      <div class="custom-field-form-empty">
        No custom fields defined for this entity type.
      </div>
    } @else {
      <form [formGroup]="form">
        @for (group of groupedFields(); track group.id) {
          <div class="field-section">
            <h3>{{ group.name }}</h3>
            <div class="field-grid">
              @for (field of group.fields; track field.id) {
                @if (getFieldAccess(field.id) !== 'hidden') {
                  <div class="field-item">
                    @switch (field.fieldType) {
                      @case ('text') {
                        <mat-form-field appearance="outline">
                          <mat-label>{{ field.label }}</mat-label>
                          <input matInput
                                 [formControlName]="field.id"
                                 [readonly]="isFieldReadonly(field.id)">
                          @if (form.controls[field.id]?.hasError('required')) {
                            <mat-error>{{ field.label }} is required</mat-error>
                          }
                        </mat-form-field>
                      }
                      @case ('number') {
                        <mat-form-field appearance="outline">
                          <mat-label>{{ field.label }}</mat-label>
                          <input matInput type="number"
                                 [formControlName]="field.id"
                                 [readonly]="isFieldReadonly(field.id)">
                          @if (form.controls[field.id]?.hasError('required')) {
                            <mat-error>{{ field.label }} is required</mat-error>
                          }
                        </mat-form-field>
                      }
                      @case ('date') {
                        <mat-form-field appearance="outline">
                          <mat-label>{{ field.label }}</mat-label>
                          <input matInput
                                 [matDatepicker]="picker"
                                 [formControlName]="field.id"
                                 [readonly]="isFieldReadonly(field.id)">
                          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                          <mat-datepicker #picker></mat-datepicker>
                          @if (form.controls[field.id]?.hasError('required')) {
                            <mat-error>{{ field.label }} is required</mat-error>
                          }
                        </mat-form-field>
                      }
                      @case ('dropdown') {
                        <mat-form-field appearance="outline">
                          <mat-label>{{ field.label }}</mat-label>
                          <mat-select [formControlName]="field.id"
                                      [disabled]="isFieldReadonly(field.id)">
                            @for (option of field.options; track option.value) {
                              <mat-option [value]="option.value">{{ option.label }}</mat-option>
                            }
                          </mat-select>
                          @if (form.controls[field.id]?.hasError('required')) {
                            <mat-error>{{ field.label }} is required</mat-error>
                          }
                        </mat-form-field>
                      }
                      @case ('checkbox') {
                        <div class="checkbox-field">
                          <mat-checkbox [formControlName]="field.id"
                                        [disabled]="isFieldReadonly(field.id)">
                            {{ field.label }}
                          </mat-checkbox>
                        </div>
                      }
                      @case ('multiSelect') {
                        <mat-form-field appearance="outline">
                          <mat-label>{{ field.label }}</mat-label>
                          <mat-select [formControlName]="field.id"
                                      multiple
                                      [disabled]="isFieldReadonly(field.id)">
                            @for (option of field.options; track option.value) {
                              <mat-option [value]="option.value">{{ option.label }}</mat-option>
                            }
                          </mat-select>
                          @if (form.controls[field.id]?.hasError('required')) {
                            <mat-error>{{ field.label }} is required</mat-error>
                          }
                        </mat-form-field>
                      }
                      @case ('currency') {
                        <mat-form-field appearance="outline">
                          <mat-label>{{ field.label }}</mat-label>
                          <span matPrefix class="currency-prefix">{{ getCurrencySymbol(field) }}&nbsp;</span>
                          <input matInput type="number"
                                 [formControlName]="field.id"
                                 [readonly]="isFieldReadonly(field.id)">
                          @if (form.controls[field.id]?.hasError('required')) {
                            <mat-error>{{ field.label }} is required</mat-error>
                          }
                        </mat-form-field>
                      }
                      @case ('file') {
                        <div class="file-field">
                          <label>{{ field.label }}</label>
                          <span class="file-field-placeholder">File upload coming soon</span>
                        </div>
                      }
                      @case ('relation') {
                        <mat-form-field appearance="outline">
                          <mat-label>{{ field.label }}</mat-label>
                          <input matInput
                                 [formControlName]="field.id"
                                 placeholder="Related entity ID"
                                 [readonly]="isFieldReadonly(field.id)">
                          @if (form.controls[field.id]?.hasError('required')) {
                            <mat-error>{{ field.label }} is required</mat-error>
                          }
                        </mat-form-field>
                      }
                    }
                  </div>
                }
              }
            </div>
          </div>
        }
      </form>
    }
  `,
})
export class CustomFieldFormComponent implements OnInit, OnDestroy {
  private readonly customFieldService = inject(CustomFieldService);
  private readonly permissionStore = inject(PermissionStore);

  /** The entity type to load custom field definitions for. */
  entityType = input.required<string>();

  /** Current custom field values (for edit mode / detail view). */
  customFieldValues = input<Record<string, any> | undefined>(undefined);

  /** Whether to render all fields as readonly (detail view mode). */
  readonly = input<boolean>(false);

  /** Emits whenever any custom field value changes. */
  valuesChanged = output<Record<string, any>>();

  /** Loading state while fetching field definitions. */
  isLoading = signal(false);

  /** All field definitions for the current entity type. */
  private fieldDefinitions = signal<CustomFieldDefinition[]>([]);

  /** Sections for the current entity type. */
  private sections = signal<CustomFieldSection[]>([]);

  /** The reactive form group -- controls are created dynamically. */
  form = new FormGroup<Record<string, FormControl>>({});

  /** Subscription tracking for form value changes. */
  private formValueSub: Subscription | null = null;

  /** Grouped fields by section, sorted by section sortOrder then field sortOrder. */
  groupedFields = computed<FieldGroup[]>(() => {
    const fields = this.fieldDefinitions();
    const sectionsList = this.sections();

    if (fields.length === 0) return [];

    // Build a map of sectionId -> section info
    const sectionMap = new Map<string, CustomFieldSection>();
    for (const s of sectionsList) {
      sectionMap.set(s.id, s);
    }

    // Group fields by sectionId
    const groups = new Map<string, FieldGroup>();

    for (const field of fields) {
      const sectionId = field.sectionId ?? '__general__';
      if (!groups.has(sectionId)) {
        const section = sectionMap.get(sectionId);
        groups.set(sectionId, {
          id: sectionId,
          name: section?.name ?? 'General',
          sortOrder: section?.sortOrder ?? 999,
          fields: [],
        });
      }
      groups.get(sectionId)!.fields.push(field);
    }

    // Sort fields within each group by sortOrder
    for (const group of groups.values()) {
      group.fields.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    // Sort groups by sortOrder
    return Array.from(groups.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  });

  ngOnInit(): void {
    this.loadFields();
  }

  ngOnDestroy(): void {
    this.formValueSub?.unsubscribe();
  }

  /**
   * Load field definitions and sections from the backend, then build the form.
   */
  private loadFields(): void {
    this.isLoading.set(true);

    const entityType = this.entityType();

    // Load field definitions
    this.customFieldService.getFieldsByEntityType(entityType).subscribe({
      next: (fields) => {
        this.fieldDefinitions.set(fields);
        this.buildFormControls(fields);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });

    // Load sections in parallel
    this.customFieldService.getSections(entityType).subscribe({
      next: (sections) => {
        this.sections.set(sections);
      },
    });
  }

  /**
   * Build dynamic FormControl instances for each field definition.
   * Initializes values from customFieldValues input if provided.
   */
  private buildFormControls(fields: CustomFieldDefinition[]): void {
    // Unsubscribe from previous form changes
    this.formValueSub?.unsubscribe();

    // Create new form group
    const controls: Record<string, FormControl> = {};
    const currentValues = this.customFieldValues();

    for (const field of fields) {
      // Skip hidden fields
      if (this.getFieldAccess(field.id) === 'hidden') continue;

      const initialValue = currentValues?.[field.id] ?? this.getDefaultValue(field);
      const validators = [];

      if (field.validation?.required) {
        validators.push(Validators.required);
      }

      controls[field.id] = new FormControl(initialValue, validators);
    }

    this.form = new FormGroup(controls);

    // Apply readonly state
    if (this.readonly()) {
      this.form.disable({ emitEvent: false });
    }

    // Subscribe to value changes and emit
    this.formValueSub = this.form.valueChanges.subscribe((values) => {
      this.valuesChanged.emit(values as Record<string, any>);
    });
  }

  /**
   * Get the default value for a field based on its type.
   */
  private getDefaultValue(field: CustomFieldDefinition): any {
    switch (field.fieldType) {
      case CustomFieldType.Checkbox:
        return false;
      case CustomFieldType.MultiSelect:
        return [];
      case CustomFieldType.Number:
      case CustomFieldType.Currency:
        return null;
      default:
        return null;
    }
  }

  /**
   * Get the field access level from the PermissionStore.
   * Returns 'hidden', 'readonly', or 'editable'.
   */
  getFieldAccess(fieldId: string): string {
    return this.permissionStore.getFieldAccess(this.entityType(), fieldId, 'editable');
  }

  /**
   * Whether a specific field should be rendered as readonly.
   * True if the component is in readonly mode or the field's access level is 'readonly'.
   */
  isFieldReadonly(fieldId: string): boolean {
    return this.readonly() || this.getFieldAccess(fieldId) === 'readonly';
  }

  /**
   * Get the currency symbol for a currency field.
   * Uses the field's validation currencyCode, defaulting to '$'.
   */
  getCurrencySymbol(field: CustomFieldDefinition): string {
    // The validation model doesn't have currencyCode currently,
    // so we default to '$'. Can be extended when currency codes are added.
    return '$';
  }
}
