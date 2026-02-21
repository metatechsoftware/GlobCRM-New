import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  WorkflowNode,
  WorkflowTriggerType,
  EntityField,
} from '../../workflow.models';

interface TriggerFormState {
  triggerType: WorkflowTriggerType;
  fieldName: string;
  operator: string;
  value: string;
  fromValue: string;
  dateField: string;
  dateOffsetDays: number;
  dateDirection: 'before' | 'after';
  preferredTime: string;
}

@Component({
  selector: 'app-trigger-config',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  template: `
    <div class="config-panel">
      <div class="config-panel__header">
        <mat-icon class="config-panel__icon trigger-icon">bolt</mat-icon>
        <h3>{{ 'config.triggerConfig' | transloco }}</h3>
      </div>

      <div class="config-panel__body">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'config.triggerType' | transloco }}</mat-label>
          <mat-select [ngModel]="form().triggerType"
                      (ngModelChange)="updateField('triggerType', $event)">
            <mat-option value="recordCreated">{{ 'nodes.recordCreated' | transloco }}</mat-option>
            <mat-option value="recordUpdated">{{ 'nodes.recordUpdated' | transloco }}</mat-option>
            <mat-option value="recordDeleted">{{ 'nodes.recordDeleted' | transloco }}</mat-option>
            <mat-option value="fieldChanged">{{ 'nodes.fieldChanged' | transloco }}</mat-option>
            <mat-option value="dateBased">{{ 'nodes.dateBased' | transloco }}</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Field Changed Config -->
        @if (form().triggerType === 'fieldChanged') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'config.field' | transloco }}</mat-label>
            <mat-select [ngModel]="form().fieldName"
                        (ngModelChange)="updateField('fieldName', $event)">
              @for (field of entityFields(); track field.name) {
                <mat-option [value]="field.name">{{ field.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'config.operator' | transloco }}</mat-label>
            <mat-select [ngModel]="form().operator"
                        (ngModelChange)="updateField('operator', $event)">
              <mat-option value="equals">{{ 'config.equals' | transloco }}</mat-option>
              <mat-option value="not_equals">{{ 'config.notEquals' | transloco }}</mat-option>
              <mat-option value="gt">{{ 'config.greaterThan' | transloco }}</mat-option>
              <mat-option value="gte">{{ 'config.greaterThanOrEqual' | transloco }}</mat-option>
              <mat-option value="lt">{{ 'config.lessThan' | transloco }}</mat-option>
              <mat-option value="lte">{{ 'config.lessThanOrEqual' | transloco }}</mat-option>
              <mat-option value="contains">{{ 'config.contains' | transloco }}</mat-option>
              <mat-option value="changed_to">{{ 'config.changedTo' | transloco }}</mat-option>
              <mat-option value="changed_from_to">{{ 'config.changedFromTo' | transloco }}</mat-option>
              <mat-option value="is_null">{{ 'config.isNull' | transloco }}</mat-option>
              <mat-option value="is_not_null">{{ 'config.isNotNull' | transloco }}</mat-option>
            </mat-select>
          </mat-form-field>

          @if (form().operator === 'changed_from_to') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'config.fromValueOptional' | transloco }}</mat-label>
              <input matInput
                     [ngModel]="form().fromValue"
                     (ngModelChange)="updateField('fromValue', $event)"
                     [placeholder]="'config.previousValueOptional' | transloco" />
            </mat-form-field>
          }

          @if (needsValueInput()) {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ form().operator === 'changed_from_to' ? ('config.toValue' | transloco) : ('config.value' | transloco) }}</mat-label>
              <input matInput
                     [ngModel]="form().value"
                     (ngModelChange)="updateField('value', $event)" />
            </mat-form-field>
          }
        }

        <!-- Date Based Config -->
        @if (form().triggerType === 'dateBased') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'config.dateField' | transloco }}</mat-label>
            <mat-select [ngModel]="form().dateField"
                        (ngModelChange)="updateField('dateField', $event)">
              @for (field of dateFields(); track field.name) {
                <mat-option [value]="field.name">{{ field.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="config-panel__row">
            <mat-form-field appearance="outline" class="config-panel__number-field">
              <mat-label>{{ 'config.days' | transloco }}</mat-label>
              <input matInput
                     type="number"
                     min="0"
                     [ngModel]="form().dateOffsetDays"
                     (ngModelChange)="updateField('dateOffsetDays', $event)" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="config-panel__direction-field">
              <mat-label>{{ 'config.direction' | transloco }}</mat-label>
              <mat-select [ngModel]="form().dateDirection"
                          (ngModelChange)="updateField('dateDirection', $event)">
                <mat-option value="before">{{ 'config.daysBefore' | transloco }}</mat-option>
                <mat-option value="after">{{ 'config.daysAfter' | transloco }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'config.preferredTime' | transloco }}</mat-label>
            <input matInput
                   type="time"
                   [ngModel]="form().preferredTime"
                   (ngModelChange)="updateField('preferredTime', $event)" />
          </mat-form-field>
        }
      </div>

      <div class="config-panel__footer">
        <span class="config-panel__hint">
          @switch (form().triggerType) {
            @case ('recordCreated') {
              {{ 'config.firesOnCreated' | transloco:{ entity: entityType() } }}
            }
            @case ('recordUpdated') {
              {{ 'config.firesOnUpdated' | transloco:{ entity: entityType() } }}
            }
            @case ('recordDeleted') {
              {{ 'config.firesOnDeleted' | transloco:{ entity: entityType() } }}
            }
            @case ('fieldChanged') {
              {{ 'config.firesOnFieldChanged' | transloco:{ entity: entityType() } }}
            }
            @case ('dateBased') {
              {{ 'config.firesOnDateBased' | transloco:{ entity: entityType() } }}
            }
          }
        </span>
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

    .trigger-icon {
      color: #3B82F6;
    }

    .config-panel__body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .full-width {
      width: 100%;
    }

    .config-panel__row {
      display: flex;
      gap: 8px;
    }

    .config-panel__number-field {
      flex: 1;
    }

    .config-panel__direction-field {
      flex: 1.5;
    }

    .config-panel__footer {
      margin-top: 12px;
    }

    .config-panel__hint {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TriggerConfigComponent {
  readonly node = input.required<WorkflowNode>();
  readonly entityType = input<string>('');
  readonly entityFields = input<EntityField[]>([]);
  readonly configChanged = output<Record<string, any>>();

  readonly form = signal<TriggerFormState>({
    triggerType: 'recordCreated',
    fieldName: '',
    operator: 'equals',
    value: '',
    fromValue: '',
    dateField: '',
    dateOffsetDays: 0,
    dateDirection: 'before',
    preferredTime: '',
  });

  readonly dateFields = computed(() =>
    this.entityFields().filter(
      (f) => f.fieldType === 'date' || f.fieldType === 'datetime',
    ),
  );

  readonly needsValueInput = computed(() => {
    const op = this.form().operator;
    return op !== 'is_null' && op !== 'is_not_null';
  });

  constructor() {
    // Initialize form from node config
    effect(() => {
      const config = this.node().config;
      if (config) {
        this.form.set({
          triggerType: config['triggerType'] ?? 'recordCreated',
          fieldName: config['fieldName'] ?? '',
          operator: config['operator'] ?? 'equals',
          value: config['value'] ?? '',
          fromValue: config['fromValue'] ?? '',
          dateField: config['dateField'] ?? '',
          dateOffsetDays: config['dateOffsetDays'] ?? 0,
          dateDirection: config['dateDirection'] ?? 'before',
          preferredTime: config['preferredTime'] ?? '',
        });
      }
    });
  }

  updateField(field: keyof TriggerFormState, value: any): void {
    this.form.update((f) => ({ ...f, [field]: value }));
    this.emitConfig();
  }

  private emitConfig(): void {
    const f = this.form();
    const config: Record<string, any> = {
      triggerType: f.triggerType,
    };

    if (f.triggerType === 'fieldChanged') {
      config['fieldName'] = f.fieldName;
      config['operator'] = f.operator;
      if (f.operator !== 'is_null' && f.operator !== 'is_not_null') {
        config['value'] = f.value;
      }
      if (f.operator === 'changed_from_to') {
        config['fromValue'] = f.fromValue;
      }
    }

    if (f.triggerType === 'dateBased') {
      config['dateField'] = f.dateField;
      config['dateOffsetDays'] =
        f.dateDirection === 'before' ? -f.dateOffsetDays : f.dateOffsetDays;
      config['preferredTime'] = f.preferredTime || undefined;
    }

    this.configChanged.emit(config);
  }
}
