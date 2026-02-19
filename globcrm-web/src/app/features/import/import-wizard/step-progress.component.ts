import {
  Component,
  ChangeDetectionStrategy,
  inject,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ImportStore } from '../stores/import.store';

/**
 * Step 4: Progress -- SVG ring progress via SignalR + completion summary.
 * SignalR subscription is handled by the parent ImportWizardComponent.
 * Displays processedRows/totalRows, success/error counts.
 * On completion: shows summary banner, first 10 errors, "Import Another" button.
 */
@Component({
  selector: 'app-step-progress',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './step-progress.component.scss',
  template: `
    <div class="progress-container">
      @if (!store.isComplete()) {
        <div class="progress-section">
          <div class="progress-ring-container">
            <svg class="progress-ring" viewBox="0 0 140 140">
              <circle class="ring-track" cx="70" cy="70" r="58" />
              <circle class="ring-fill" cx="70" cy="70" r="58"
                      [attr.stroke-dasharray]="circumference"
                      [attr.stroke-dashoffset]="circumference - (circumference * store.progressPercent() / 100)" />
            </svg>
            <div class="ring-center">
              <span class="ring-percent">{{ store.progressPercent() }}%</span>
              <span class="ring-text">Complete</span>
            </div>
          </div>

          <div class="progress-title">Importing data...</div>

          <div class="live-stats">
            <div class="stat-item">
              <div class="stat-icon processed">
                <mat-icon>sync</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ store.progress()?.processedRows ?? 0 }} / {{ store.progress()?.totalRows ?? 0 }}</span>
                <span class="stat-label">Processed</span>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon success">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ store.progress()?.successCount ?? 0 }}</span>
                <span class="stat-label">Succeeded</span>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon errors">
                <mat-icon>error</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ store.progress()?.errorCount ?? 0 }}</span>
                <span class="stat-label">Errors</span>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <!-- Completion Banner -->
        <div class="completion-banner"
             [class.completed]="store.progress()?.status === 'Completed'"
             [class.failed]="store.progress()?.status === 'Failed'">
          <div class="completion-icon-wrapper">
            <mat-icon>
              {{ store.progress()?.status === 'Completed' ? 'check_circle' : 'error' }}
            </mat-icon>
          </div>
          <div class="completion-title">
            {{ store.progress()?.status === 'Completed' ? 'Import Complete' : 'Import Failed' }}
          </div>
          <div class="completion-summary">
            Your data has been processed successfully
          </div>
          <div class="completion-detail-chips">
            <span class="detail-chip success">
              <mat-icon>check_circle</mat-icon>
              {{ store.progress()?.successCount ?? 0 }} imported
            </span>
            @if ((store.progress()?.errorCount ?? 0) > 0) {
              <span class="detail-chip errors">
                <mat-icon>error</mat-icon>
                {{ store.progress()?.errorCount ?? 0 }} errors
              </span>
            }
          </div>
        </div>

        @if (store.currentJob()?.errors?.length) {
          <div class="error-list">
            <h3>Errors (showing first {{ Math.min(store.currentJob()!.errors.length, 10) }})</h3>
            <table class="error-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Field</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                @for (error of store.currentJob()!.errors.slice(0, 10); track error.id) {
                  <tr>
                    <td>{{ error.rowNumber }}</td>
                    <td>{{ error.fieldName }}</td>
                    <td>{{ error.errorMessage }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <div class="completion-actions">
          <button mat-raised-button color="primary" (click)="importAnother.emit()">
            <mat-icon>add</mat-icon>
            Import Another
          </button>
          <a mat-button routerLink="/import/history">
            View Import History
          </a>
        </div>
      }
    </div>
  `,
})
export class StepProgressComponent {
  readonly store = inject(ImportStore);
  readonly Math = Math;
  readonly circumference = 2 * Math.PI * 58;

  @Output() importAnother = new EventEmitter<void>();
}
