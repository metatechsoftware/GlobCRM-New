import {
  Component,
  ChangeDetectionStrategy,
  inject,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ImportStore } from '../stores/import.store';

/**
 * Step 4: Progress -- real-time progress bar via SignalR + completion summary.
 * SignalR subscription is handled by the parent ImportWizardComponent.
 * Displays processedRows/totalRows, success/error counts.
 * On completion: shows summary banner, first 10 errors, "Import Another" button.
 */
@Component({
  selector: 'app-step-progress',
  standalone: true,
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .progress-container {
      padding: 24px 0;
    }

    .progress-section {
      margin-bottom: 24px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .progress-title {
      font-size: 18px;
      font-weight: 500;
    }

    .progress-percent {
      font-size: 24px;
      font-weight: 600;
      color: var(--color-primary);
    }

    .progress-stats {
      display: flex;
      gap: 24px;
      margin-top: 16px;
      font-size: 14px;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .stat.processed {
      color: var(--color-text);
    }

    .stat.success {
      color: #4caf50;
    }

    .stat.errors {
      color: #f44336;
    }

    .completion-banner {
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 24px;
    }

    .completion-banner.completed {
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.3);
    }

    .completion-banner.failed {
      background: var(--color-danger-soft);
      border: 1px solid rgba(244, 67, 54, 0.3);
    }

    .completion-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .completion-banner.completed .completion-icon {
      color: #4caf50;
    }

    .completion-banner.failed .completion-icon {
      color: #f44336;
    }

    .completion-title {
      font-size: 20px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .completion-summary {
      font-size: 14px;
      color: var(--color-text-secondary);
    }

    .error-list {
      margin-top: 16px;
    }

    .error-list h3 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 500;
    }

    .error-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .error-table th {
      text-align: left;
      padding: 8px;
      font-weight: 500;
      background: var(--color-surface-hover);
      border-bottom: 1px solid var(--color-border);
    }

    .error-table td {
      padding: 8px;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .completion-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 24px;
    }
  `,
  template: `
    <div class="progress-container">
      @if (!store.isComplete()) {
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-title">Importing data...</span>
            <span class="progress-percent">{{ store.progressPercent() }}%</span>
          </div>
          <mat-progress-bar
            mode="determinate"
            [value]="store.progressPercent()">
          </mat-progress-bar>
          <div class="progress-stats">
            <div class="stat processed">
              <mat-icon>sync</mat-icon>
              {{ store.progress()?.processedRows ?? 0 }} / {{ store.progress()?.totalRows ?? 0 }} processed
            </div>
            <div class="stat success">
              <mat-icon>check_circle</mat-icon>
              {{ store.progress()?.successCount ?? 0 }} succeeded
            </div>
            <div class="stat errors">
              <mat-icon>error</mat-icon>
              {{ store.progress()?.errorCount ?? 0 }} errors
            </div>
          </div>
        </div>
      } @else {
        <div class="completion-banner"
             [class.completed]="store.progress()?.status === 'Completed'"
             [class.failed]="store.progress()?.status === 'Failed'">
          <mat-icon class="completion-icon">
            {{ store.progress()?.status === 'Completed' ? 'check_circle' : 'error' }}
          </mat-icon>
          <div class="completion-title">
            {{ store.progress()?.status === 'Completed' ? 'Import Complete' : 'Import Failed' }}
          </div>
          <div class="completion-summary">
            {{ store.progress()?.successCount ?? 0 }} records imported successfully,
            {{ store.progress()?.errorCount ?? 0 }} errors
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
          <a mat-button routerLink="/settings">
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

  @Output() importAnother = new EventEmitter<void>();
}
