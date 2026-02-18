import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  Output,
  EventEmitter,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { ImportStore } from '../stores/import.store';

/**
 * Step 3: Preview -- displays validation results (valid/invalid/duplicate counts)
 * with expandable error and duplicate detail lists.
 * Calls store.preview() on init; user confirms with "Execute Import".
 */
@Component({
  selector: 'app-step-preview',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .preview-container {
      padding: 24px 0;
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      padding: 20px;
      border-radius: 12px;
      text-align: center;
    }

    .summary-card.valid {
      background: var(--color-success-soft);
      border: 1px solid rgba(76, 175, 80, 0.3);
    }

    .summary-card.invalid {
      background: var(--color-danger-soft);
      border: 1px solid rgba(244, 67, 54, 0.3);
    }

    .summary-card.duplicate {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
    }

    .card-count {
      font-size: 32px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .valid .card-count {
      color: #4caf50;
    }

    .invalid .card-count {
      color: #f44336;
    }

    .duplicate .card-count {
      color: #ff9800;
    }

    .card-label {
      font-size: 14px;
      color: var(--color-text-secondary);
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

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 48px;
    }

    .step-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 16px;
    }

    .error-msg {
      color: var(--color-danger);
      margin-top: 12px;
      font-size: 14px;
    }

    @media (max-width: 600px) {
      .summary-cards {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="preview-container">
      @if (store.loading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Running validation preview...</p>
        </div>
      } @else if (store.previewResponse()) {
        <div class="summary-cards">
          <div class="summary-card valid">
            <div class="card-count">{{ store.previewResponse()!.validCount }}</div>
            <div class="card-label">Valid Rows</div>
          </div>
          <div class="summary-card invalid">
            <div class="card-count">{{ store.previewResponse()!.invalidCount }}</div>
            <div class="card-label">Invalid Rows</div>
          </div>
          <div class="summary-card duplicate">
            <div class="card-count">{{ store.previewResponse()!.duplicateCount }}</div>
            <div class="card-label">Duplicates Found</div>
          </div>
        </div>

        @if (store.previewResponse()!.errors.length > 0) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon style="color: #f44336; margin-right: 8px;">error</mat-icon>
                Validation Errors ({{ store.previewResponse()!.errors.length }})
              </mat-panel-title>
            </mat-expansion-panel-header>
            <table class="error-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Field</th>
                  <th>Error</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                @for (error of store.previewResponse()!.errors; track $index) {
                  <tr>
                    <td>{{ error.rowNumber }}</td>
                    <td>{{ error.fieldName }}</td>
                    <td>{{ error.errorMessage }}</td>
                    <td>{{ error.rawValue ?? '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </mat-expansion-panel>
        }

        @if (store.previewResponse()!.duplicates.length > 0) {
          <mat-expansion-panel style="margin-top: 8px;">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon style="color: #ff9800; margin-right: 8px;">content_copy</mat-icon>
                Duplicate Matches ({{ store.previewResponse()!.duplicates.length }})
              </mat-panel-title>
            </mat-expansion-panel-header>
            <table class="error-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Match Field</th>
                  <th>Match Value</th>
                </tr>
              </thead>
              <tbody>
                @for (dup of store.previewResponse()!.duplicates; track $index) {
                  <tr>
                    <td>{{ dup.rowIndex }}</td>
                    <td>{{ dup.matchField }}</td>
                    <td>{{ dup.matchValue }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </mat-expansion-panel>
        }
      }

      @if (store.error()) {
        <div class="error-msg">{{ store.error() }}</div>
      }

      <div class="step-actions">
        <button mat-button (click)="stepBack.emit()">Back</button>
        <button mat-raised-button color="primary"
                [disabled]="store.loading() || !store.hasPreview()"
                (click)="onExecute()">
          Execute Import
        </button>
      </div>
    </div>
  `,
})
export class StepPreviewComponent implements OnInit {
  readonly store = inject(ImportStore);

  @Output() stepComplete = new EventEmitter<void>();
  @Output() stepBack = new EventEmitter<void>();

  ngOnInit(): void {
    // Call preview on step entry
    this.store.preview();
  }

  onExecute(): void {
    this.store.execute();
    this.stepComplete.emit();
  }
}
