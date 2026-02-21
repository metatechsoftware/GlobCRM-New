import {
  Component,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  WidgetDto,
  WidgetType,
  MetricType,
  CreateWidgetRequest,
  TargetDto,
} from '../../models/dashboard.models';

/** Metric types grouped by entity for organized dropdown. */
const METRIC_GROUPS: { label: string; metrics: { value: MetricType; label: string }[] }[] = [
  {
    label: 'Deals',
    metrics: [
      { value: 'DealCount', label: 'Deal Count' },
      { value: 'DealPipelineValue', label: 'Pipeline Value' },
      { value: 'DealsByStage', label: 'Deals by Stage' },
      { value: 'DealsWon', label: 'Deals Won' },
      { value: 'DealsLost', label: 'Deals Lost' },
      { value: 'WinRate', label: 'Win Rate' },
      { value: 'AverageDealValue', label: 'Average Deal Value' },
    ],
  },
  {
    label: 'Activities',
    metrics: [
      { value: 'ActivityCount', label: 'Activity Count' },
      { value: 'ActivitiesByType', label: 'Activities by Type' },
      { value: 'ActivitiesByStatus', label: 'Activities by Status' },
      { value: 'ActivitiesCompleted', label: 'Activities Completed' },
      { value: 'OverdueActivities', label: 'Overdue Activities' },
    ],
  },
  {
    label: 'Quotes',
    metrics: [
      { value: 'QuoteTotal', label: 'Quote Total' },
      { value: 'QuotesByStatus', label: 'Quotes by Status' },
    ],
  },
  {
    label: 'Contacts',
    metrics: [
      { value: 'ContactsCreated', label: 'Contacts Created' },
    ],
  },
  {
    label: 'Companies',
    metrics: [
      { value: 'CompaniesCreated', label: 'Companies Created' },
    ],
  },
  {
    label: 'Requests',
    metrics: [
      { value: 'RequestsByStatus', label: 'Requests by Status' },
      { value: 'RequestsByPriority', label: 'Requests by Priority' },
    ],
  },
  {
    label: 'Leaderboard',
    metrics: [
      { value: 'SalesLeaderboard', label: 'Sales Leaderboard' },
      { value: 'ActivityLeaderboard', label: 'Activity Leaderboard' },
    ],
  },
];

/** All 7 widget types for the type selector. */
const WIDGET_TYPES: { value: WidgetType; label: string }[] = [
  { value: 'KpiCard', label: 'KPI Card' },
  { value: 'BarChart', label: 'Bar Chart' },
  { value: 'LineChart', label: 'Line Chart' },
  { value: 'PieChart', label: 'Pie Chart' },
  { value: 'Leaderboard', label: 'Leaderboard' },
  { value: 'Table', label: 'Table' },
  { value: 'TargetProgress', label: 'Target Progress' },
];

/** Default grid sizes per widget type. */
const DEFAULT_SIZES: Record<WidgetType, { cols: number; rows: number }> = {
  KpiCard: { cols: 3, rows: 1 },
  BarChart: { cols: 6, rows: 2 },
  LineChart: { cols: 6, rows: 2 },
  PieChart: { cols: 4, rows: 2 },
  Leaderboard: { cols: 4, rows: 2 },
  Table: { cols: 6, rows: 2 },
  TargetProgress: { cols: 3, rows: 1 },
};

export interface WidgetConfigDialogData {
  widget?: WidgetDto;
  targets?: TargetDto[];
}

/**
 * Dialog for creating or editing widget configuration.
 * Uses deep copy pattern -- store state is not modified until user confirms.
 */
@Component({
  selector: 'app-widget-config-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .widget-config-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3, 12px);
      min-width: 400px;
    }

    .widget-config-form mat-form-field {
      width: 100%;
    }

    .widget-config-form__row {
      display: flex;
      gap: var(--space-3, 12px);
    }

    .widget-config-form__row mat-form-field {
      flex: 1;
    }

    .widget-config-form__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2, 8px);
      margin-top: var(--space-2, 8px);
    }
  `,
  template: `
    <h2 mat-dialog-title>{{ data?.widget ? ('config.editTitle' | transloco) : ('config.addTitle' | transloco) }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="widget-config-form">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'config.title' | transloco }}</mat-label>
          <input matInput formControlName="title" [placeholder]="'config.titlePlaceholder' | transloco" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'config.widgetType' | transloco }}</mat-label>
          <mat-select formControlName="type">
            @for (wt of widgetTypes; track wt.value) {
              <mat-option [value]="wt.value">{{ wt.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (form.value.type !== 'TargetProgress') {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'config.metric' | transloco }}</mat-label>
            <mat-select formControlName="metricType">
              @for (group of metricGroups; track group.label) {
                <mat-optgroup [label]="group.label">
                  @for (m of group.metrics; track m.value) {
                    <mat-option [value]="m.value">{{ m.label }}</mat-option>
                  }
                </mat-optgroup>
              }
            </mat-select>
          </mat-form-field>
        }

        <!-- KpiCard extra config -->
        @if (form.value.type === 'KpiCard') {
          <div class="widget-config-form__row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'config.format' | transloco }}</mat-label>
              <mat-select formControlName="format">
                <mat-option value="number">{{ 'config.formats.number' | transloco }}</mat-option>
                <mat-option value="currency">{{ 'config.formats.currency' | transloco }}</mat-option>
                <mat-option value="percent">{{ 'config.formats.percent' | transloco }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'config.icon' | transloco }}</mat-label>
              <input matInput formControlName="icon" [placeholder]="'config.iconPlaceholder' | transloco" />
            </mat-form-field>
          </div>
        }

        <!-- Leaderboard extra config -->
        @if (form.value.type === 'Leaderboard') {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'config.valueFormat' | transloco }}</mat-label>
            <mat-select formControlName="valueFormat">
              <mat-option value="number">{{ 'config.formats.number' | transloco }}</mat-option>
              <mat-option value="currency">{{ 'config.formats.currency' | transloco }}</mat-option>
            </mat-select>
          </mat-form-field>
        }

        <!-- TargetProgress extra config -->
        @if (form.value.type === 'TargetProgress') {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'config.target' | transloco }}</mat-label>
            <mat-select formControlName="targetId">
              @for (target of availableTargets; track target.id) {
                <mat-option [value]="target.id">{{ target.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'config.cancel' | transloco }}</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="onSave()">
        {{ data?.widget ? ('config.save' | transloco) : ('config.add' | transloco) }}
      </button>
    </mat-dialog-actions>
  `,
})
export class WidgetConfigDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<WidgetConfigDialogComponent>);
  readonly data = inject<WidgetConfigDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  readonly widgetTypes = WIDGET_TYPES;
  readonly metricGroups = METRIC_GROUPS;
  readonly availableTargets: TargetDto[] = this.data?.targets ?? [];

  readonly form: FormGroup;

  constructor() {
    const widget = this.data?.widget ? { ...this.data.widget, config: { ...this.data.widget.config } } : null;

    this.form = this.fb.group({
      title: [widget?.title ?? '', Validators.required],
      type: [widget?.type ?? 'KpiCard', Validators.required],
      metricType: [widget?.config?.['metricType'] ?? 'DealCount'],
      // KpiCard config
      format: [widget?.config?.['format'] ?? 'number'],
      icon: [widget?.config?.['icon'] ?? 'trending_up'],
      // Leaderboard config
      valueFormat: [widget?.config?.['valueFormat'] ?? 'number'],
      // TargetProgress config
      targetId: [widget?.config?.['targetId'] ?? null],
    });
  }

  onSave(): void {
    if (this.form.invalid) return;

    const val = this.form.value;
    const widgetType: WidgetType = val.type;
    const size = DEFAULT_SIZES[widgetType];
    const existingWidget = this.data?.widget;

    // Build config based on widget type
    const config: Record<string, any> = {};
    config['metricType'] = val.metricType;

    if (widgetType === 'KpiCard') {
      config['format'] = val.format;
      config['icon'] = val.icon;
    } else if (widgetType === 'Leaderboard') {
      config['valueFormat'] = val.valueFormat;
    } else if (widgetType === 'TargetProgress') {
      config['targetId'] = val.targetId;
    }

    const result: CreateWidgetRequest = {
      type: widgetType,
      title: val.title,
      x: existingWidget?.x ?? 0,
      y: existingWidget?.y ?? 0,
      cols: existingWidget?.cols ?? size.cols,
      rows: existingWidget?.rows ?? size.rows,
      config,
      sortOrder: existingWidget?.sortOrder ?? 0,
    };

    this.dialogRef.close(result);
  }
}
