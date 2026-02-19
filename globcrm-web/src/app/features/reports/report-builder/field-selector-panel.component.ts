import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
} from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { FormsModule } from '@angular/forms';
import {
  ReportFieldMetadata,
  ReportField,
  ReportFieldInfo,
} from '../report.models';

interface RelatedFieldGroup {
  entity: string;
  fields: ReportFieldInfo[];
}

/**
 * Field selector panel with categorized checkbox lists and search.
 * Users can select/deselect fields to include as report columns.
 * Fields are grouped by: System, Custom, Formula, Related (sub-grouped by entity).
 */
@Component({
  selector: 'app-field-selector-panel',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    MatBadgeModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-expansion-panel [expanded]="true" class="field-selector-panel">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>view_column</mat-icon>
          Columns
          @if (selectedCount() > 0) {
            <span class="field-selector-panel__count">{{ selectedCount() }}</span>
          }
        </mat-panel-title>
      </mat-expansion-panel-header>

      <div class="field-selector-panel__content">
        <!-- Search -->
        <mat-form-field appearance="outline" class="field-selector-panel__search">
          <mat-label>Search fields</mat-label>
          <input
            matInput
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Filter fields..."
          />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        @if (fieldMetadata()) {
          <!-- System Fields -->
          @if (filteredSystemFields().length > 0) {
            <div class="field-group">
              <div class="field-group__header" (click)="toggleGroup('system')">
                <mat-icon>{{ expandedGroups().has('system') ? 'expand_more' : 'chevron_right' }}</mat-icon>
                <span>System Fields</span>
                <span class="field-group__count">{{ filteredSystemFields().length }}</span>
              </div>
              @if (expandedGroups().has('system')) {
                <div class="field-group__items">
                  @for (field of filteredSystemFields(); track field.fieldId) {
                    <label class="field-item">
                      <mat-checkbox
                        [checked]="isFieldSelected(field.fieldId)"
                        (change)="toggleField(field)"
                        color="primary"
                      ></mat-checkbox>
                      <span class="field-item__label">{{ field.label }}</span>
                      <span class="field-item__badge field-item__badge--{{ field.dataType }}">
                        {{ field.dataType }}
                      </span>
                    </label>
                  }
                </div>
              }
            </div>
          }

          <!-- Custom Fields -->
          @if (filteredCustomFields().length > 0) {
            <div class="field-group">
              <div class="field-group__header" (click)="toggleGroup('custom')">
                <mat-icon>{{ expandedGroups().has('custom') ? 'expand_more' : 'chevron_right' }}</mat-icon>
                <span>Custom Fields</span>
                <span class="field-group__count">{{ filteredCustomFields().length }}</span>
              </div>
              @if (expandedGroups().has('custom')) {
                <div class="field-group__items">
                  @for (field of filteredCustomFields(); track field.fieldId) {
                    <label class="field-item">
                      <mat-checkbox
                        [checked]="isFieldSelected(field.fieldId)"
                        (change)="toggleField(field)"
                        color="primary"
                      ></mat-checkbox>
                      <span class="field-item__label">{{ field.label }}</span>
                      <span class="field-item__badge field-item__badge--{{ field.dataType }}">
                        {{ field.dataType }}
                      </span>
                    </label>
                  }
                </div>
              }
            </div>
          }

          <!-- Formula Fields -->
          @if (filteredFormulaFields().length > 0) {
            <div class="field-group">
              <div class="field-group__header" (click)="toggleGroup('formula')">
                <mat-icon>{{ expandedGroups().has('formula') ? 'expand_more' : 'chevron_right' }}</mat-icon>
                <span>Formula Fields</span>
                <span class="field-group__count">{{ filteredFormulaFields().length }}</span>
              </div>
              @if (expandedGroups().has('formula')) {
                <div class="field-group__items">
                  @for (field of filteredFormulaFields(); track field.fieldId) {
                    <label class="field-item">
                      <mat-checkbox
                        [checked]="isFieldSelected(field.fieldId)"
                        (change)="toggleField(field)"
                        color="primary"
                      ></mat-checkbox>
                      <span class="field-item__label">{{ field.label }}</span>
                      <span class="field-item__badge field-item__badge--computed">computed</span>
                    </label>
                  }
                </div>
              }
            </div>
          }

          <!-- Related Fields (sub-grouped by entity) -->
          @for (group of filteredRelatedGroups(); track group.entity) {
            <div class="field-group">
              <div class="field-group__header" (click)="toggleGroup('related-' + group.entity)">
                <mat-icon>{{ expandedGroups().has('related-' + group.entity) ? 'expand_more' : 'chevron_right' }}</mat-icon>
                <span>Related: {{ group.entity }}</span>
                <span class="field-group__count">{{ group.fields.length }}</span>
              </div>
              @if (expandedGroups().has('related-' + group.entity)) {
                <div class="field-group__items">
                  @for (field of group.fields; track field.fieldId) {
                    <label class="field-item">
                      <mat-checkbox
                        [checked]="isFieldSelected(field.fieldId)"
                        (change)="toggleField(field)"
                        color="primary"
                      ></mat-checkbox>
                      <span class="field-item__label">{{ field.label }}</span>
                      <span class="field-item__badge field-item__badge--{{ field.dataType }}">
                        {{ field.dataType }}
                      </span>
                    </label>
                  }
                </div>
              }
            </div>
          }

          @if (filteredSystemFields().length === 0 && filteredCustomFields().length === 0 &&
               filteredFormulaFields().length === 0 && filteredRelatedGroups().length === 0) {
            <p class="field-selector-panel__empty">No fields match your search</p>
          }
        } @else {
          <p class="field-selector-panel__empty">Select an entity type to see available fields</p>
        }
      </div>
    </mat-expansion-panel>
  `,
  styles: `
    .field-selector-panel {
      &__content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      &__search {
        width: 100%;
      }

      &__count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        margin-left: 8px;
        border-radius: 10px;
        background: var(--color-primary, #F97316);
        color: white;
        font-size: 11px;
        font-weight: 600;
      }

      &__empty {
        text-align: center;
        color: var(--color-text-muted, #9CA3AF);
        font-size: var(--text-sm, 13px);
        padding: 16px 0;
        margin: 0;
      }
    }

    .field-group {
      border-bottom: 1px solid var(--color-border-light, #f0f0f0);

      &:last-child {
        border-bottom: none;
      }

      &__header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 0;
        cursor: pointer;
        font-size: var(--text-sm, 13px);
        font-weight: 500;
        color: var(--color-text, #1A1A1A);
        user-select: none;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: var(--color-text-secondary, #6B7280);
        }
      }

      &__count {
        margin-left: auto;
        font-size: 11px;
        color: var(--color-text-muted, #9CA3AF);
        font-weight: normal;
      }

      &__items {
        display: flex;
        flex-direction: column;
        padding-left: 8px;
        padding-bottom: 8px;
      }
    }

    .field-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 0;
      cursor: pointer;

      &__label {
        flex: 1;
        font-size: var(--text-sm, 13px);
        color: var(--color-text, #1A1A1A);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &__badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        font-weight: 500;
        white-space: nowrap;

        &--string {
          background: #EFF6FF;
          color: #2563EB;
        }

        &--number, &--currency {
          background: #F0FDF4;
          color: #16A34A;
        }

        &--date, &--datetime {
          background: #FFF7ED;
          color: #EA580C;
        }

        &--boolean {
          background: #F5F3FF;
          color: #7C3AED;
        }

        &--computed {
          background: #FEF3C7;
          color: #D97706;
        }
      }
    }
  `,
})
export class FieldSelectorPanelComponent {
  readonly fieldMetadata = input<ReportFieldMetadata | null>(null);
  readonly selectedFields = input<ReportField[]>([]);
  readonly fieldsChange = output<ReportField[]>();

  readonly searchQuery = signal('');
  readonly expandedGroups = signal(new Set<string>(['system']));

  // Track selected field IDs for checkbox state
  private selectedFieldIds = computed(() =>
    new Set(this.selectedFields().map((f) => f.fieldId))
  );

  readonly selectedCount = computed(() => this.selectedFields().length);

  // Filtered fields based on search query
  readonly filteredSystemFields = computed(() => {
    const meta = this.fieldMetadata();
    if (!meta) return [];
    return this.filterFields(meta.systemFields);
  });

  readonly filteredCustomFields = computed(() => {
    const meta = this.fieldMetadata();
    if (!meta) return [];
    return this.filterFields(meta.customFields);
  });

  readonly filteredFormulaFields = computed(() => {
    const meta = this.fieldMetadata();
    if (!meta) return [];
    return this.filterFields(meta.formulaFields);
  });

  readonly filteredRelatedGroups = computed((): RelatedFieldGroup[] => {
    const meta = this.fieldMetadata();
    if (!meta) return [];

    const filtered = this.filterFields(meta.relatedFields);

    // Group by related entity
    const groupMap = new Map<string, ReportFieldInfo[]>();
    for (const field of filtered) {
      const entity = field.relatedEntity ?? 'Other';
      const existing = groupMap.get(entity) ?? [];
      existing.push(field);
      groupMap.set(entity, existing);
    }

    return Array.from(groupMap.entries())
      .map(([entity, fields]) => ({ entity, fields }))
      .sort((a, b) => a.entity.localeCompare(b.entity));
  });

  isFieldSelected(fieldId: string): boolean {
    return this.selectedFieldIds().has(fieldId);
  }

  toggleField(field: ReportFieldInfo): void {
    const current = this.selectedFields();
    const exists = current.find((f) => f.fieldId === field.fieldId);

    if (exists) {
      // Remove field
      const updated = current
        .filter((f) => f.fieldId !== field.fieldId)
        .map((f, i) => ({ ...f, sortOrder: i }));
      this.fieldsChange.emit(updated);
    } else {
      // Add field with next sort order
      const newField: ReportField = {
        fieldId: field.fieldId,
        label: field.label,
        fieldType: field.dataType,
        sortOrder: current.length,
      };
      this.fieldsChange.emit([...current, newField]);
    }
  }

  toggleGroup(groupId: string): void {
    const current = this.expandedGroups();
    const next = new Set(current);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    this.expandedGroups.set(next);
  }

  private filterFields(fields: ReportFieldInfo[]): ReportFieldInfo[] {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return fields;
    return fields.filter((f) => f.label.toLowerCase().includes(query));
  }
}
