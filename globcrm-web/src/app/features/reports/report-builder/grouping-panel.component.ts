import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import {
  ReportFieldMetadata,
  ReportField,
  ReportGrouping,
  ReportFieldInfo,
  AggregationType,
} from '../report.models';

const DATE_TRUNCATION_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const AGGREGATION_OPTIONS: { value: AggregationType; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

/**
 * Grouping panel for configuring group-by fields and aggregation types.
 * Shows date truncation options for date fields and aggregation dropdowns
 * for numeric fields when groupings are active.
 */
@Component({
  selector: 'app-grouping-panel',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-expansion-panel class="grouping-panel">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>group_work</mat-icon>
          Grouping
          @if (groupings().length > 0) {
            <span class="grouping-panel__count">{{ groupings().length }}</span>
          }
        </mat-panel-title>
      </mat-expansion-panel-header>

      <div class="grouping-panel__content">
        <!-- Current Groupings -->
        @if (groupings().length > 0) {
          <div class="grouping-panel__chips">
            @for (grouping of groupings(); track grouping.fieldId; let idx = $index) {
              <div class="grouping-chip">
                <span class="grouping-chip__label">
                  {{ getFieldLabel(grouping.fieldId) }}
                  @if (grouping.dateTruncation) {
                    <span class="grouping-chip__truncation">({{ grouping.dateTruncation }})</span>
                  }
                </span>
                <button
                  mat-icon-button
                  class="grouping-chip__remove"
                  (click)="removeGrouping(idx)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <!-- Date truncation selector for date fields -->
              @if (isDateField(grouping.fieldId)) {
                <mat-form-field appearance="outline" class="grouping-panel__truncation">
                  <mat-label>Date truncation</mat-label>
                  <mat-select
                    [ngModel]="grouping.dateTruncation ?? 'month'"
                    (ngModelChange)="updateDateTruncation(idx, $event)"
                  >
                    @for (opt of dateTruncationOptions; track opt.value) {
                      <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }
            }
          </div>
        }

        <!-- Add Grouping -->
        @if (availableGroupFields().length > 0) {
          <mat-form-field appearance="outline" class="grouping-panel__add-field">
            <mat-label>Group by field</mat-label>
            <mat-select (selectionChange)="addGrouping($event.value)">
              @for (field of availableGroupFields(); track field.fieldId) {
                <mat-option [value]="field.fieldId">{{ field.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <!-- Aggregations (visible when groupings active) -->
        @if (groupings().length > 0 && aggregatableFields().length > 0) {
          <div class="grouping-panel__aggregations">
            <h4 class="grouping-panel__section-title">Aggregations</h4>
            @for (field of aggregatableFields(); track field.fieldId) {
              <div class="aggregation-row">
                <span class="aggregation-row__label">{{ field.label }}</span>
                <mat-form-field appearance="outline" class="aggregation-row__select">
                  <mat-select
                    [ngModel]="getFieldAggregation(field.fieldId)"
                    (ngModelChange)="updateAggregation(field.fieldId, $event)"
                  >
                    @for (agg of getAggregationOptions(field); track agg.value) {
                      <mat-option [value]="agg.value">{{ agg.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
            }
          </div>
        }

        @if (availableGroupFields().length === 0 && groupings().length === 0) {
          <p class="grouping-panel__empty">Select fields to enable grouping</p>
        }
      </div>
    </mat-expansion-panel>
  `,
  styles: `
    .grouping-panel {
      &__content {
        display: flex;
        flex-direction: column;
        gap: 8px;
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

      &__chips {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      &__truncation {
        width: 100%;
        margin-left: 16px;
      }

      &__add-field {
        width: 100%;
      }

      &__aggregations {
        border-top: 1px solid var(--color-border, #E8E8E6);
        padding-top: 12px;
        margin-top: 4px;
      }

      &__section-title {
        margin: 0 0 8px 0;
        font-size: var(--text-sm, 13px);
        font-weight: 600;
        color: var(--color-text-secondary, #6B7280);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      &__empty {
        text-align: center;
        color: var(--color-text-muted, #9CA3AF);
        font-size: var(--text-sm, 13px);
        padding: 12px 0;
        margin: 0;
      }
    }

    .grouping-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--color-bg-secondary, #F0F0EE);
      border-radius: 6px;

      &__label {
        flex: 1;
        font-size: var(--text-sm, 13px);
        color: var(--color-text, #1A1A1A);
      }

      &__truncation {
        color: var(--color-text-secondary, #6B7280);
        font-size: 11px;
      }

      &__remove {
        width: 24px !important;
        height: 24px !important;
        line-height: 24px !important;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }

    .aggregation-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;

      &__label {
        flex: 1;
        font-size: var(--text-sm, 13px);
        color: var(--color-text, #1A1A1A);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &__select {
        width: 120px;
        min-width: 120px;
      }
    }
  `,
})
export class GroupingPanelComponent {
  readonly selectedFields = input<ReportField[]>([]);
  readonly fieldMetadata = input<ReportFieldMetadata | null>(null);
  readonly groupings = input<ReportGrouping[]>([]);

  readonly groupingsChange = output<ReportGrouping[]>();
  readonly aggregationsChange = output<ReportField[]>();

  readonly dateTruncationOptions = DATE_TRUNCATION_OPTIONS;

  // All groupable fields from metadata, excluding already-grouped ones
  readonly availableGroupFields = computed((): ReportFieldInfo[] => {
    const meta = this.fieldMetadata();
    if (!meta) return [];

    const groupedIds = new Set(this.groupings().map((g) => g.fieldId));
    const allFields = [
      ...meta.systemFields,
      ...meta.customFields,
      ...meta.formulaFields,
      ...meta.relatedFields,
    ];

    return allFields.filter(
      (f) => f.isGroupable && !groupedIds.has(f.fieldId)
    );
  });

  // Fields that can have aggregation (numeric/currency among selected fields)
  readonly aggregatableFields = computed((): ReportFieldInfo[] => {
    const meta = this.fieldMetadata();
    if (!meta) return [];

    const selectedIds = new Set(this.selectedFields().map((f) => f.fieldId));
    const groupedIds = new Set(this.groupings().map((g) => g.fieldId));

    const allFields = [
      ...meta.systemFields,
      ...meta.customFields,
      ...meta.formulaFields,
      ...meta.relatedFields,
    ];

    // Show aggregation for selected fields that are not themselves grouping fields
    return allFields.filter(
      (f) => selectedIds.has(f.fieldId) && !groupedIds.has(f.fieldId) && f.isAggregatable
    );
  });

  private allFieldsMap = computed((): Map<string, ReportFieldInfo> => {
    const meta = this.fieldMetadata();
    if (!meta) return new Map();

    const map = new Map<string, ReportFieldInfo>();
    for (const f of [
      ...meta.systemFields,
      ...meta.customFields,
      ...meta.formulaFields,
      ...meta.relatedFields,
    ]) {
      map.set(f.fieldId, f);
    }
    return map;
  });

  getFieldLabel(fieldId: string): string {
    return this.allFieldsMap().get(fieldId)?.label ?? fieldId;
  }

  isDateField(fieldId: string): boolean {
    const field = this.allFieldsMap().get(fieldId);
    return field?.dataType === 'date' || field?.dataType === 'datetime';
  }

  getFieldAggregation(fieldId: string): AggregationType {
    const selected = this.selectedFields().find((f) => f.fieldId === fieldId);
    return selected?.aggregation ?? 'count';
  }

  getAggregationOptions(field: ReportFieldInfo): { value: AggregationType; label: string }[] {
    const isNumeric = field.dataType === 'number' || field.dataType === 'currency';
    if (isNumeric) {
      return AGGREGATION_OPTIONS;
    }
    // Non-numeric only supports count
    return [{ value: 'count', label: 'Count' }];
  }

  addGrouping(fieldId: string): void {
    const field = this.allFieldsMap().get(fieldId);
    const isDate = field?.dataType === 'date' || field?.dataType === 'datetime';

    const newGrouping: ReportGrouping = {
      fieldId,
      dateTruncation: isDate ? 'month' : undefined,
    };

    this.groupingsChange.emit([...this.groupings(), newGrouping]);
  }

  removeGrouping(index: number): void {
    const updated = this.groupings().filter((_, i) => i !== index);
    this.groupingsChange.emit(updated);
  }

  updateDateTruncation(index: number, truncation: string): void {
    const updated = this.groupings().map((g, i) =>
      i === index ? { ...g, dateTruncation: truncation } : g
    );
    this.groupingsChange.emit(updated);
  }

  updateAggregation(fieldId: string, aggregation: AggregationType): void {
    const updated = this.selectedFields().map((f) =>
      f.fieldId === fieldId ? { ...f, aggregation } : f
    );
    this.aggregationsChange.emit(updated);
  }
}
