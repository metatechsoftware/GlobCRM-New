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
  ],
  template: `
    <div class="config-panel">
      <div class="config-panel__header">
        <mat-icon class="config-panel__icon trigger-icon">bolt</mat-icon>
        <h3>Trigger Configuration</h3>
      </div>

      <div class="config-panel__body">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Trigger Type</mat-label>
          <mat-select [ngModel]="form().triggerType"
                      (ngModelChange)="updateField('triggerType', $event)">
            <mat-option value="recordCreated">Record Created</mat-option>
            <mat-option value="recordUpdated">Record Updated</mat-option>
            <mat-option value="recordDeleted">Record Deleted</mat-option>
            <mat-option value="fieldChanged">Field Changed</mat-option>
            <mat-option value="dateBased">Date Based</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Field Changed Config -->
        @if (form().triggerType === 'fieldChanged') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Field</mat-label>
            <mat-select [ngModel]="form().fieldName"
                        (ngModelChange)="updateField('fieldName', $event)">
              @for (field of entityFields(); track field.name) {
                <mat-option [value]="field.name">{{ field.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Operator</mat-label>
            <mat-select [ngModel]="form().operator"
                        (ngModelChange)="updateField('operator', $event)">
              <mat-option value="equals">Equals</mat-option>
              <mat-option value="not_equals">Not Equals</mat-option>
              <mat-option value="gt">Greater Than</mat-option>
              <mat-option value="gte">Greater Than or Equal</mat-option>
              <mat-option value="lt">Less Than</mat-option>
              <mat-option value="lte">Less Than or Equal</mat-option>
              <mat-option value="contains">Contains</mat-option>
              <mat-option value="changed_to">Changed To</mat-option>
              <mat-option value="changed_from_to">Changed From-To</mat-option>
              <mat-option value="is_null">Is Null</mat-option>
              <mat-option value="is_not_null">Is Not Null</mat-option>
            </mat-select>
          </mat-form-field>

          @if (form().operator === 'changed_from_to') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>From Value (optional)</mat-label>
              <input matInput
                     [ngModel]="form().fromValue"
                     (ngModelChange)="updateField('fromValue', $event)"
                     placeholder="Previous value (optional)" />
            </mat-form-field>
          }

          @if (needsValueInput()) {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ form().operator === 'changed_from_to' ? 'To Value' : 'Value' }}</mat-label>
              <input matInput
                     [ngModel]="form().value"
                     (ngModelChange)="updateField('value', $event)" />
            </mat-form-field>
          }
        }

        <!-- Date Based Config -->
        @if (form().triggerType === 'dateBased') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Date Field</mat-label>
            <mat-select [ngModel]="form().dateField"
                        (ngModelChange)="updateField('dateField', $event)">
              @for (field of dateFields(); track field.name) {
                <mat-option [value]="field.name">{{ field.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="config-panel__row">
            <mat-form-field appearance="outline" class="config-panel__number-field">
              <mat-label>Days</mat-label>
              <input matInput
                     type="number"
                     min="0"
                     [ngModel]="form().dateOffsetDays"
                     (ngModelChange)="updateField('dateOffsetDays', $event)" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="config-panel__direction-field">
              <mat-label>Direction</mat-label>
              <mat-select [ngModel]="form().dateDirection"
                          (ngModelChange)="updateField('dateDirection', $event)">
                <mat-option value="before">Days Before</mat-option>
                <mat-option value="after">Days After</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Preferred Time (optional)</mat-label>
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
              Fires when a new {{ entityType() }} is created
            }
            @case ('recordUpdated') {
              Fires when any {{ entityType() }} is updated
            }
            @case ('recordDeleted') {
              Fires when a {{ entityType() }} is deleted
            }
            @case ('fieldChanged') {
              Fires when the specified field changes on a {{ entityType() }}
            }
            @case ('dateBased') {
              Fires based on a date field value on a {{ entityType() }}
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
