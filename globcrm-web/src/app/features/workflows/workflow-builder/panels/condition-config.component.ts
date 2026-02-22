import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { WorkflowNode, EntityField } from '../../workflow.models';

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
  fromValue: string;
}

interface ConditionGroup {
  conditions: ConditionRow[];
}

@Component({
  selector: 'app-condition-config',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  template: `
    <div class="config-panel">
      <div class="config-panel__header">
        <mat-icon class="config-panel__icon condition-icon">filter_list</mat-icon>
        <h3>{{ headerTitle() }}</h3>
      </div>

      <div class="config-panel__body">
        @for (group of groups(); track $index; let gi = $index) {
          @if (gi > 0) {
            <div class="or-divider">
              <span>{{ 'workflows.config.or' | transloco }}</span>
            </div>
          }

          <div class="condition-group">
            @for (cond of group.conditions; track $index; let ci = $index) {
              <div class="condition-row">
                <mat-form-field appearance="outline" class="condition-field">
                  <mat-label>{{ 'workflows.config.field' | transloco }}</mat-label>
                  <mat-select [ngModel]="cond.field"
                              (ngModelChange)="updateCondition(gi, ci, 'field', $event)">
                    @for (field of entityFields(); track field.name) {
                      <mat-option [value]="field.name">{{ field.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="condition-operator">
                  <mat-label>{{ 'workflows.config.operator' | transloco }}</mat-label>
                  <mat-select [ngModel]="cond.operator"
                              (ngModelChange)="updateCondition(gi, ci, 'operator', $event)">
                    <mat-option value="equals">{{ 'workflows.config.equals' | transloco }}</mat-option>
                    <mat-option value="not_equals">{{ 'workflows.config.notEquals' | transloco }}</mat-option>
                    <mat-option value="gt">{{ 'workflows.config.greaterThan' | transloco }}</mat-option>
                    <mat-option value="gte">{{ 'workflows.config.greaterThanOrEqual' | transloco }}</mat-option>
                    <mat-option value="lt">{{ 'workflows.config.lessThan' | transloco }}</mat-option>
                    <mat-option value="lte">{{ 'workflows.config.lessThanOrEqual' | transloco }}</mat-option>
                    <mat-option value="contains">{{ 'workflows.config.contains' | transloco }}</mat-option>
                    <mat-option value="changed_to">{{ 'workflows.config.changedTo' | transloco }}</mat-option>
                    <mat-option value="changed_from_to">{{ 'workflows.config.changedFromTo' | transloco }}</mat-option>
                    <mat-option value="is_null">{{ 'workflows.config.isNull' | transloco }}</mat-option>
                    <mat-option value="is_not_null">{{ 'workflows.config.isNotNull' | transloco }}</mat-option>
                  </mat-select>
                </mat-form-field>

                @if (cond.operator !== 'is_null' && cond.operator !== 'is_not_null') {
                  @if (cond.operator === 'changed_from_to') {
                    <mat-form-field appearance="outline" class="condition-value">
                      <mat-label>{{ 'workflows.config.from' | transloco }}</mat-label>
                      <input matInput
                             [ngModel]="cond.fromValue"
                             (ngModelChange)="updateCondition(gi, ci, 'fromValue', $event)" />
                    </mat-form-field>
                  }
                  <mat-form-field appearance="outline" class="condition-value">
                    <mat-label>{{ cond.operator === 'changed_from_to' ? ('workflows.config.to' | transloco) : ('workflows.config.value' | transloco) }}</mat-label>
                    <input matInput
                           [ngModel]="cond.value"
                           (ngModelChange)="updateCondition(gi, ci, 'value', $event)" />
                  </mat-form-field>
                }

                <button mat-icon-button
                        (click)="removeCondition(gi, ci)"
                        class="condition-remove">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }

            <button mat-button
                    (click)="addCondition(gi)"
                    class="add-btn">
              <mat-icon>add</mat-icon>
              {{ 'workflows.config.addCondition' | transloco }}
            </button>
          </div>
        }

        <button mat-stroked-button
                (click)="addGroup()"
                class="add-group-btn">
          <mat-icon>add</mat-icon>
          {{ 'workflows.config.addOrGroup' | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .config-panel {
      padding: 16px;
    }

    .config-panel__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;

      h3 {
        margin: 0;
        font-size: var(--text-md);
        font-weight: var(--font-semibold);
      }
    }

    .config-panel__icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .condition-icon {
      color: #F59E0B;
    }

    .config-panel__body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .condition-group {
      background: var(--color-bg-secondary);
      border-radius: var(--radius-md);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .condition-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: flex-start;
    }

    .condition-field {
      flex: 1;
      min-width: 100px;
    }

    .condition-operator {
      flex: 1;
      min-width: 100px;
    }

    .condition-value {
      flex: 1;
      min-width: 80px;
    }

    .condition-remove {
      margin-top: 4px;
      width: 32px;
      height: 32px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .or-divider {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;

      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--color-border);
      }

      span {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-muted);
        text-transform: uppercase;
      }
    }

    .add-btn {
      align-self: flex-start;
      font-size: var(--text-sm);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 4px;
      }
    }

    .add-group-btn {
      align-self: flex-start;
      margin-top: 4px;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 4px;
      }
    }

    ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    ::ng-deep .mat-mdc-form-field-infix {
      min-height: 36px;
      padding: 6px 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionConfigComponent {
  readonly node = input.required<WorkflowNode>();
  readonly entityFields = input<EntityField[]>([]);
  readonly headerTitle = input<string>('Condition Configuration');
  readonly configChanged = output<Record<string, any>>();

  readonly groups = signal<ConditionGroup[]>([
    { conditions: [{ field: '', operator: 'equals', value: '', fromValue: '' }] },
  ]);

  constructor() {
    effect(() => {
      const config = this.node().config;
      if (config?.['conditionGroups']?.length) {
        this.groups.set(
          config['conditionGroups'].map((g: any) => ({
            conditions: (g.conditions ?? []).map((c: any) => ({
              field: c.field ?? '',
              operator: c.operator ?? 'equals',
              value: c.value ?? '',
              fromValue: c.fromValue ?? '',
            })),
          })),
        );
      }
    });
  }

  updateCondition(
    groupIdx: number,
    condIdx: number,
    field: keyof ConditionRow,
    value: string,
  ): void {
    const newGroups = this.groups().map((g, gi) => {
      if (gi !== groupIdx) return g;
      return {
        conditions: g.conditions.map((c, ci) => {
          if (ci !== condIdx) return c;
          return { ...c, [field]: value };
        }),
      };
    });
    this.groups.set(newGroups);
    this.emitConfig();
  }

  addCondition(groupIdx: number): void {
    const newGroups = this.groups().map((g, gi) => {
      if (gi !== groupIdx) return g;
      return {
        conditions: [
          ...g.conditions,
          { field: '', operator: 'equals', value: '', fromValue: '' },
        ],
      };
    });
    this.groups.set(newGroups);
    this.emitConfig();
  }

  removeCondition(groupIdx: number, condIdx: number): void {
    let newGroups = this.groups().map((g, gi) => {
      if (gi !== groupIdx) return g;
      return {
        conditions: g.conditions.filter((_, ci) => ci !== condIdx),
      };
    });
    // Remove empty groups
    newGroups = newGroups.filter((g) => g.conditions.length > 0);
    if (newGroups.length === 0) {
      newGroups = [
        { conditions: [{ field: '', operator: 'equals', value: '', fromValue: '' }] },
      ];
    }
    this.groups.set(newGroups);
    this.emitConfig();
  }

  addGroup(): void {
    this.groups.update((groups) => [
      ...groups,
      { conditions: [{ field: '', operator: 'equals', value: '', fromValue: '' }] },
    ]);
    this.emitConfig();
  }

  private emitConfig(): void {
    const conditionGroups = this.groups().map((g) => ({
      conditions: g.conditions
        .filter((c) => c.field)
        .map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value || undefined,
          fromValue:
            c.operator === 'changed_from_to' ? c.fromValue || undefined : undefined,
        })),
    }));
    this.configChanged.emit({ conditionGroups });
  }
}
