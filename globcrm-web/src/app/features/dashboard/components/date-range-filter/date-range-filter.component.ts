import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { DateRange } from '../../models/dashboard.models';

type PresetRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/**
 * Date range filter with preset ranges and custom date picker.
 * Always converts local dates to UTC ISO 8601 strings before emitting
 * to avoid timezone boundary issues (per 09-RESEARCH pitfall).
 *
 * provideNativeDateAdapter at component level matching existing pattern.
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .date-range-filter {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      flex-wrap: wrap;
    }

    .date-range-filter mat-button-toggle-group {
      height: 36px;
    }

    .date-range-filter mat-button-toggle {
      font-size: var(--text-xs, 0.75rem);
    }

    .date-range-filter mat-form-field {
      max-width: 260px;
    }
  `,
  template: `
    <div class="date-range-filter">
      <mat-button-toggle-group [value]="activePreset()" (change)="onPresetChange($event)">
        <mat-button-toggle value="today">Today</mat-button-toggle>
        <mat-button-toggle value="week">This Week</mat-button-toggle>
        <mat-button-toggle value="month">This Month</mat-button-toggle>
        <mat-button-toggle value="quarter">Quarter</mat-button-toggle>
        <mat-button-toggle value="year">Year</mat-button-toggle>
        <mat-button-toggle value="custom">Custom</mat-button-toggle>
      </mat-button-toggle-group>
      @if (activePreset() === 'custom') {
        <mat-form-field appearance="outline">
          <mat-date-range-input [rangePicker]="picker">
            <input matStartDate placeholder="Start" [value]="customStart" (dateChange)="onCustomChange()">
            <input matEndDate placeholder="End" [value]="customEnd" (dateChange)="onCustomChange()">
          </mat-date-range-input>
          <mat-datepicker-toggle matSuffix [for]="picker" />
          <mat-date-range-picker #picker />
        </mat-form-field>
      }
    </div>
  `,
})
export class DateRangeFilterComponent {
  readonly dateRange = input<DateRange>({ start: null, end: null });
  readonly dateRangeChanged = output<DateRange>();

  readonly activePreset = signal<PresetRange>('month');

  customStart: Date | null = null;
  customEnd: Date | null = null;

  constructor() {
    // Initialize preset from input dateRange (detect which preset matches)
    effect(() => {
      const range = this.dateRange();
      if (range.start && range.end) {
        const detected = this.detectPreset(range);
        if (detected) {
          this.activePreset.set(detected);
        }
      }
    });
  }

  /** Handle preset button toggle selection. */
  onPresetChange(event: MatButtonToggleChange): void {
    const preset = event.value as PresetRange;
    this.activePreset.set(preset);

    if (preset === 'custom') {
      // Don't emit until user selects dates
      return;
    }

    const range = this.computePresetRange(preset);
    this.dateRangeChanged.emit(range);
  }

  /** Handle custom date range change from datepicker. */
  onCustomChange(): void {
    if (this.customStart && this.customEnd) {
      this.dateRangeChanged.emit({
        start: this.toUtcIso(this.customStart),
        end: this.toUtcIso(this.customEnd),
      });
    }
  }

  /** Compute UTC ISO date range from a preset name. */
  private computePresetRange(preset: PresetRange): DateRange {
    const now = new Date();
    let start: Date;
    const end = now;

    switch (preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week': {
        // Monday of current week
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1; // Sunday=0, Monday=1, etc.
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
        break;
      }
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter': {
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterMonth, 1);
        break;
      }
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      start: this.toUtcIso(start),
      end: this.toUtcIso(end),
    };
  }

  /** Convert local date to UTC ISO 8601 date string (YYYY-MM-DD). */
  private toUtcIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Detect which preset matches a given date range (if any). */
  private detectPreset(range: DateRange): PresetRange | null {
    if (!range.start || !range.end) return null;

    const presets: PresetRange[] = ['today', 'week', 'month', 'quarter', 'year'];
    for (const preset of presets) {
      const computed = this.computePresetRange(preset);
      if (computed.start === range.start && computed.end === range.end) {
        return preset;
      }
    }
    return 'custom';
  }
}
