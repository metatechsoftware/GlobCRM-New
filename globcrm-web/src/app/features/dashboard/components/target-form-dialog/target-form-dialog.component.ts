import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  TargetDto,
  MetricType,
  TargetPeriod,
  CreateTargetRequest,
  UpdateTargetRequest,
} from '../../models/dashboard.models';

export interface TargetFormDialogData {
  target?: TargetDto;
}

interface MetricOption {
  value: MetricType;
  label: string;
  group: string;
}

const METRIC_OPTIONS: MetricOption[] = [
  // Deals
  { value: 'DealCount', label: 'Deal Count', group: 'Deals' },
  { value: 'DealPipelineValue', label: 'Pipeline Value', group: 'Deals' },
  { value: 'DealsByStage', label: 'Deals by Stage', group: 'Deals' },
  { value: 'DealsWon', label: 'Deals Won', group: 'Deals' },
  { value: 'DealsLost', label: 'Deals Lost', group: 'Deals' },
  { value: 'WinRate', label: 'Win Rate', group: 'Deals' },
  { value: 'AverageDealValue', label: 'Avg Deal Value', group: 'Deals' },
  { value: 'SalesLeaderboard', label: 'Sales Leaderboard', group: 'Deals' },
  // Activities
  { value: 'ActivityCount', label: 'Activity Count', group: 'Activities' },
  { value: 'ActivitiesByType', label: 'Activities by Type', group: 'Activities' },
  { value: 'ActivitiesByStatus', label: 'Activities by Status', group: 'Activities' },
  { value: 'ActivitiesCompleted', label: 'Activities Completed', group: 'Activities' },
  { value: 'OverdueActivities', label: 'Overdue Activities', group: 'Activities' },
  { value: 'ActivityLeaderboard', label: 'Activity Leaderboard', group: 'Activities' },
  // Quotes
  { value: 'QuoteTotal', label: 'Quote Total', group: 'Quotes' },
  { value: 'QuotesByStatus', label: 'Quotes by Status', group: 'Quotes' },
  // Contacts
  { value: 'ContactsCreated', label: 'Contacts Created', group: 'Contacts' },
  // Companies
  { value: 'CompaniesCreated', label: 'Companies Created', group: 'Companies' },
  // Requests
  { value: 'RequestsByStatus', label: 'Requests by Status', group: 'Requests' },
  { value: 'RequestsByPriority', label: 'Requests by Priority', group: 'Requests' },
];

const PERIOD_OPTIONS: { value: TargetPeriod; label: string }[] = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Yearly', label: 'Yearly' },
];

/** Metric groups for grouped select display. */
const METRIC_GROUPS = [
  { label: 'Deals', metrics: METRIC_OPTIONS.filter((m) => m.group === 'Deals') },
  { label: 'Activities', metrics: METRIC_OPTIONS.filter((m) => m.group === 'Activities') },
  { label: 'Quotes', metrics: METRIC_OPTIONS.filter((m) => m.group === 'Quotes') },
  { label: 'Contacts', metrics: METRIC_OPTIONS.filter((m) => m.group === 'Contacts') },
  { label: 'Companies', metrics: METRIC_OPTIONS.filter((m) => m.group === 'Companies') },
  { label: 'Requests', metrics: METRIC_OPTIONS.filter((m) => m.group === 'Requests') },
];

/**
 * Dialog component for creating / editing KPI targets.
 * Auto-computes startDate / endDate based on period selection.
 */
@Component({
  selector: 'app-target-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatCheckboxModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .target-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 400px;
    }

    .target-form__row {
      display: flex;
      gap: 12px;
    }

    .target-form__row > * {
      flex: 1;
    }
  `,
  template: `
    <h2 mat-dialog-title>{{ isEdit ? ('targets.editTarget' | transloco) : ('targets.createTarget' | transloco) }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="target-form">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'targets.targetName' | transloco }}</mat-label>
          <input matInput formControlName="name" [placeholder]="'targets.targetNamePlaceholder' | transloco" />
        </mat-form-field>

        @if (!isEdit) {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'targets.metric' | transloco }}</mat-label>
            <mat-select formControlName="metricType">
              @for (group of metricGroups; track group.label) {
                <mat-optgroup [label]="group.label">
                  @for (metric of group.metrics; track metric.value) {
                    <mat-option [value]="metric.value">{{ metric.label }}</mat-option>
                  }
                </mat-optgroup>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'targets.period' | transloco }}</mat-label>
            <mat-select formControlName="period">
              @for (p of periodOptions; track p.value) {
                <mat-option [value]="p.value">{{ p.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ 'targets.targetValue' | transloco }}</mat-label>
          <input matInput type="number" formControlName="targetValue" min="1" />
        </mat-form-field>

        <div class="target-form__row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'targets.startDate' | transloco }}</mat-label>
            <input matInput [matDatepicker]="startPicker" formControlName="startDate" />
            <mat-datepicker-toggle matIconSuffix [for]="startPicker" />
            <mat-datepicker #startPicker />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'targets.endDate' | transloco }}</mat-label>
            <input matInput [matDatepicker]="endPicker" formControlName="endDate" />
            <mat-datepicker-toggle matIconSuffix [for]="endPicker" />
            <mat-datepicker #endPicker />
          </mat-form-field>
        </div>

        @if (!isEdit) {
          <mat-checkbox formControlName="isTeamWide">{{ 'targets.teamWide' | transloco }}</mat-checkbox>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'targets.cancel' | transloco }}</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid"
        (click)="onSave()"
      >
        {{ isEdit ? ('targets.update' | transloco) : ('targets.create' | transloco) }}
      </button>
    </mat-dialog-actions>
  `,
})
export class TargetFormDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<TargetFormDialogComponent>);
  private readonly data: TargetFormDialogData | null = inject(MAT_DIALOG_DATA, { optional: true });

  readonly metricGroups = METRIC_GROUPS;
  readonly periodOptions = PERIOD_OPTIONS;
  readonly isEdit: boolean;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    metricType: new FormControl<MetricType>('DealCount', { nonNullable: true, validators: [Validators.required] }),
    period: new FormControl<TargetPeriod>('Monthly', { nonNullable: true, validators: [Validators.required] }),
    targetValue: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    startDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    endDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    isTeamWide: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    this.isEdit = !!this.data?.target;

    // Listen to period changes to auto-compute dates
    this.form.controls.period.valueChanges.subscribe((period) => {
      this.autoComputeDates(period);
    });
  }

  ngOnInit(): void {
    if (this.data?.target) {
      const t = this.data.target;
      this.form.patchValue({
        name: t.name,
        metricType: t.metricType,
        period: t.period,
        targetValue: t.targetValue,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
        isTeamWide: t.ownerId === null,
      });
    } else {
      // Auto-compute default dates for Monthly
      this.autoComputeDates('Monthly');
    }
  }

  onSave(): void {
    if (this.form.invalid) return;

    const val = this.form.getRawValue();
    const startDate = val.startDate ? this.toUTCISOString(val.startDate) : '';
    const endDate = val.endDate ? this.toUTCISOString(val.endDate) : '';

    if (this.isEdit) {
      const result: UpdateTargetRequest = {
        name: val.name,
        targetValue: val.targetValue,
        startDate,
        endDate,
      };
      this.dialogRef.close(result);
    } else {
      const result: CreateTargetRequest = {
        name: val.name,
        metricType: val.metricType,
        period: val.period,
        targetValue: val.targetValue,
        startDate,
        endDate,
        isTeamWide: val.isTeamWide,
      };
      this.dialogRef.close(result);
    }
  }

  private autoComputeDates(period: TargetPeriod): void {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case 'Daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'Weekly': {
        const day = now.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        break;
      }
      case 'Monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'Quarterly': {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      }
      case 'Yearly':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
    }

    this.form.patchValue({ startDate: start, endDate: end });
  }

  /** Convert a Date to UTC ISO string (YYYY-MM-DDT00:00:00.000Z). */
  private toUTCISOString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}T00:00:00.000Z`;
  }
}
