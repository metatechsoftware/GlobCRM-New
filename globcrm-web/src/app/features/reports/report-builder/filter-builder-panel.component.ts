import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { FormsModule } from '@angular/forms';
import {
  ReportFieldMetadata,
  ReportFilterGroup,
  ReportFilterCondition,
  ReportFieldInfo,
  FilterLogic,
} from '../report.models';

interface OperatorOption {
  value: string;
  label: string;
}

const STRING_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not contains' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

const NUMBER_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'greater_than_or_equal', label: '>= ' },
  { value: 'less_than_or_equal', label: '<= ' },
  { value: 'between', label: 'Between' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

const DATE_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'On' },
  { value: 'not_equals', label: 'Not on' },
  { value: 'greater_than', label: 'After' },
  { value: 'less_than', label: 'Before' },
  { value: 'between', label: 'Between' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

const BOOLEAN_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'Equals' },
];

/**
 * Recursive filter builder panel supporting nestable AND/OR condition groups.
 * Each group has a logic toggle, conditions, and child groups.
 * When isNested=true, renders without mat-expansion-panel wrapper (just group content).
 */
@Component({
  selector: 'app-filter-builder-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatDatepickerModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!isNested()) {
      <mat-expansion-panel class="filter-builder-panel">
        <mat-expansion-panel-header>
          <mat-panel-title>
            <mat-icon>filter_list</mat-icon>
            Filters
            @if (conditionCount() > 0) {
              <span class="filter-builder-panel__count">{{ conditionCount() }}</span>
            }
          </mat-panel-title>
        </mat-expansion-panel-header>

        <ng-container *ngTemplateOutlet="groupContent"></ng-container>
      </mat-expansion-panel>
    } @else {
      <div class="filter-builder-panel__nested-group">
        <ng-container *ngTemplateOutlet="groupContent"></ng-container>
      </div>
    }

    <ng-template #groupContent>
      <div class="filter-group">
        <!-- Logic Toggle -->
        <div class="filter-group__header">
          <mat-button-toggle-group
            [value]="currentGroup().logic"
            (change)="onLogicChange($event.value)"
            class="filter-group__logic-toggle"
          >
            <mat-button-toggle value="and">AND</mat-button-toggle>
            <mat-button-toggle value="or">OR</mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <!-- Conditions -->
        @for (condition of currentGroup().conditions; track $index; let idx = $index) {
          <div class="filter-condition">
            <!-- Field Selector -->
            <mat-form-field appearance="outline" class="filter-condition__field">
              <mat-label>Field</mat-label>
              <mat-select
                [ngModel]="condition.fieldId"
                (ngModelChange)="onConditionFieldChange(idx, $event)"
              >
                @for (field of allFields(); track field.fieldId) {
                  <mat-option [value]="field.fieldId">{{ field.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Operator Selector -->
            <mat-form-field appearance="outline" class="filter-condition__operator">
              <mat-label>Operator</mat-label>
              <mat-select
                [ngModel]="condition.operator"
                (ngModelChange)="onConditionOperatorChange(idx, $event)"
              >
                @for (op of getOperatorsForField(condition.fieldId); track op.value) {
                  <mat-option [value]="op.value">{{ op.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Value Input (adapts to field type) -->
            @if (!isEmptyOperator(condition.operator)) {
              @if (isBetweenOperator(condition.operator)) {
                <mat-form-field appearance="outline" class="filter-condition__value filter-condition__value--half">
                  <mat-label>From</mat-label>
                  <input
                    matInput
                    [type]="getInputType(condition.fieldId)"
                    [ngModel]="condition.value"
                    (ngModelChange)="onConditionValueChange(idx, $event)"
                  />
                </mat-form-field>
                <mat-form-field appearance="outline" class="filter-condition__value filter-condition__value--half">
                  <mat-label>To</mat-label>
                  <input
                    matInput
                    [type]="getInputType(condition.fieldId)"
                    [ngModel]="condition.valueTo"
                    (ngModelChange)="onConditionValueToChange(idx, $event)"
                  />
                </mat-form-field>
              } @else if (isBooleanField(condition.fieldId)) {
                <mat-form-field appearance="outline" class="filter-condition__value">
                  <mat-label>Value</mat-label>
                  <mat-select
                    [ngModel]="condition.value"
                    (ngModelChange)="onConditionValueChange(idx, $event)"
                  >
                    <mat-option value="true">True</mat-option>
                    <mat-option value="false">False</mat-option>
                  </mat-select>
                </mat-form-field>
              } @else {
                <mat-form-field appearance="outline" class="filter-condition__value">
                  <mat-label>Value</mat-label>
                  <input
                    matInput
                    [type]="getInputType(condition.fieldId)"
                    [ngModel]="condition.value"
                    (ngModelChange)="onConditionValueChange(idx, $event)"
                  />
                </mat-form-field>
              }
            }

            <!-- Remove Button -->
            <button
              mat-icon-button
              class="filter-condition__remove"
              (click)="removeCondition(idx)"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }

        <!-- Child Groups (recursive) -->
        @for (childGroup of currentGroup().groups; track $index; let childIdx = $index) {
          <app-filter-builder-panel
            [fieldMetadata]="fieldMetadata()"
            [filterGroup]="childGroup"
            [isNested]="true"
            (filterGroupChange)="onChildGroupChange(childIdx, $event)"
            (removeRequest)="onChildGroupRemove(childIdx)"
          ></app-filter-builder-panel>
        }

        <!-- Actions -->
        <div class="filter-group__actions">
          <button mat-button (click)="addCondition()" class="filter-group__add-btn">
            <mat-icon>add</mat-icon>
            Add condition
          </button>
          <button mat-button (click)="addGroup()" class="filter-group__add-btn">
            <mat-icon>playlist_add</mat-icon>
            Add group
          </button>
          @if (isNested()) {
            <button mat-icon-button (click)="removeGroup()" class="filter-group__remove-btn">
              <mat-icon>delete_outline</mat-icon>
            </button>
          }
        </div>
      </div>
    </ng-template>
  `,
  styles: `
    .filter-builder-panel {
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

      &__nested-group {
        margin-left: 12px;
        padding-left: 12px;
        border-left: 2px solid var(--color-primary, #F97316);
        margin-top: 8px;
        margin-bottom: 8px;
      }
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 8px;

      &__header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      &__logic-toggle {
        .mat-button-toggle {
          font-size: 11px;
          font-weight: 600;
        }
      }

      &__actions {
        display: flex;
        align-items: center;
        gap: 4px;
        padding-top: 4px;
      }

      &__add-btn {
        font-size: var(--text-sm, 13px);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      &__remove-btn {
        margin-left: auto;
        color: var(--color-error, #DC2626);

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    .filter-condition {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      flex-wrap: wrap;

      &__field {
        flex: 1;
        min-width: 100px;
      }

      &__operator {
        flex: 1;
        min-width: 90px;
      }

      &__value {
        flex: 1;
        min-width: 80px;

        &--half {
          flex: 0.5;
          min-width: 60px;
        }
      }

      &__remove {
        margin-top: 8px;
        width: 28px !important;
        height: 28px !important;
        line-height: 28px !important;
        color: var(--color-text-secondary, #6B7280);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }
    }
  `,
})
export class FilterBuilderPanelComponent {
  readonly fieldMetadata = input<ReportFieldMetadata | null>(null);
  readonly filterGroup = input<ReportFilterGroup | null>(null);
  readonly isNested = input(false);

  readonly filterGroupChange = output<ReportFilterGroup>();
  readonly removeRequest = output<void>();

  // All available fields from metadata for dropdowns
  readonly allFields = computed((): ReportFieldInfo[] => {
    const meta = this.fieldMetadata();
    if (!meta) return [];
    return [
      ...meta.systemFields,
      ...meta.customFields,
      ...meta.formulaFields,
      ...meta.relatedFields,
    ];
  });

  private fieldMap = computed((): Map<string, ReportFieldInfo> => {
    const map = new Map<string, ReportFieldInfo>();
    for (const f of this.allFields()) {
      map.set(f.fieldId, f);
    }
    return map;
  });

  // Total condition count for badge
  readonly conditionCount = computed((): number => {
    const group = this.filterGroup();
    if (!group) return 0;
    return this.countConditions(group);
  });

  // Current group with safe defaults
  readonly currentGroup = computed((): ReportFilterGroup => {
    return this.filterGroup() ?? {
      logic: 'and',
      conditions: [],
      groups: [],
    };
  });

  getOperatorsForField(fieldId: string): OperatorOption[] {
    const field = this.fieldMap().get(fieldId);
    if (!field) return STRING_OPERATORS;

    const type = field.dataType.toLowerCase();
    if (type === 'number' || type === 'currency') return NUMBER_OPERATORS;
    if (type === 'date' || type === 'datetime') return DATE_OPERATORS;
    if (type === 'boolean') return BOOLEAN_OPERATORS;
    return STRING_OPERATORS;
  }

  getInputType(fieldId: string): string {
    const field = this.fieldMap().get(fieldId);
    if (!field) return 'text';

    const type = field.dataType.toLowerCase();
    if (type === 'number' || type === 'currency') return 'number';
    if (type === 'date' || type === 'datetime') return 'date';
    return 'text';
  }

  isEmptyOperator(operator: string): boolean {
    return operator === 'is_empty' || operator === 'is_not_empty';
  }

  isBetweenOperator(operator: string): boolean {
    return operator === 'between';
  }

  isBooleanField(fieldId: string): boolean {
    const field = this.fieldMap().get(fieldId);
    return field?.dataType.toLowerCase() === 'boolean';
  }

  onLogicChange(logic: string): void {
    const group = this.currentGroup();
    this.emitUpdate({ ...group, logic: logic as FilterLogic });
  }

  onConditionFieldChange(index: number, fieldId: string): void {
    const group = this.currentGroup();
    const operators = this.getOperatorsForField(fieldId);
    const conditions = group.conditions.map((c, i) =>
      i === index
        ? { ...c, fieldId, operator: operators[0]?.value ?? 'equals', value: undefined, valueTo: undefined }
        : c
    );
    this.emitUpdate({ ...group, conditions });
  }

  onConditionOperatorChange(index: number, operator: string): void {
    const group = this.currentGroup();
    const conditions = group.conditions.map((c, i) =>
      i === index ? { ...c, operator } : c
    );
    this.emitUpdate({ ...group, conditions });
  }

  onConditionValueChange(index: number, value: string): void {
    const group = this.currentGroup();
    const conditions = group.conditions.map((c, i) =>
      i === index ? { ...c, value: value || undefined } : c
    );
    this.emitUpdate({ ...group, conditions });
  }

  onConditionValueToChange(index: number, valueTo: string): void {
    const group = this.currentGroup();
    const conditions = group.conditions.map((c, i) =>
      i === index ? { ...c, valueTo: valueTo || undefined } : c
    );
    this.emitUpdate({ ...group, conditions });
  }

  removeCondition(index: number): void {
    const group = this.currentGroup();
    const conditions = group.conditions.filter((_, i) => i !== index);
    this.emitUpdate({ ...group, conditions });
  }

  addCondition(): void {
    const group = this.currentGroup();
    const fields = this.allFields();
    const defaultFieldId = fields[0]?.fieldId ?? '';
    const newCondition: ReportFilterCondition = {
      fieldId: defaultFieldId,
      operator: 'equals',
    };
    this.emitUpdate({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  }

  addGroup(): void {
    const group = this.currentGroup();
    const newGroup: ReportFilterGroup = {
      logic: 'and',
      conditions: [],
      groups: [],
    };
    this.emitUpdate({
      ...group,
      groups: [...group.groups, newGroup],
    });
  }

  removeGroup(): void {
    this.removeRequest.emit();
  }

  onChildGroupChange(index: number, updatedChild: ReportFilterGroup): void {
    const group = this.currentGroup();
    const groups = group.groups.map((g, i) =>
      i === index ? updatedChild : g
    );
    this.emitUpdate({ ...group, groups });
  }

  onChildGroupRemove(index: number): void {
    const group = this.currentGroup();
    const groups = group.groups.filter((_, i) => i !== index);
    this.emitUpdate({ ...group, groups });
  }

  private emitUpdate(group: ReportFilterGroup): void {
    this.filterGroupChange.emit(group);
  }

  private countConditions(group: ReportFilterGroup): number {
    let count = group.conditions.length;
    for (const child of group.groups) {
      count += this.countConditions(child);
    }
    return count;
  }
}
