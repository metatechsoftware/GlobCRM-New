import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { ImportStore } from '../stores/import.store';
import { TranslocoPipe } from '@jsverse/transloco';

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
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './step-preview.component.scss',
  template: `
    <div class="preview-container">
      @if (store.loading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>{{ 'import.wizard.preview.running' | transloco }}</p>
        </div>
      } @else if (store.previewResponse()) {
        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="summary-card valid">
            <div class="card-icon-wrapper valid">
              <mat-icon>check_circle</mat-icon>
            </div>
            <div class="card-value">{{ store.previewResponse()!.validCount }}</div>
            <div class="card-label">{{ 'import.wizard.preview.validRows' | transloco }}</div>
            <div class="card-sublabel">{{ 'import.wizard.preview.readyToImport' | transloco }}</div>
          </div>
          <div class="summary-card invalid">
            <div class="card-icon-wrapper invalid">
              <mat-icon>error</mat-icon>
            </div>
            <div class="card-value">{{ store.previewResponse()!.invalidCount }}</div>
            <div class="card-label">{{ 'import.wizard.preview.invalidRows' | transloco }}</div>
            <div class="card-sublabel">{{ 'import.wizard.preview.willBeSkipped' | transloco }}</div>
          </div>
          <div class="summary-card duplicate">
            <div class="card-icon-wrapper duplicate">
              <mat-icon>content_copy</mat-icon>
            </div>
            <div class="card-value">{{ store.previewResponse()!.duplicateCount }}</div>
            <div class="card-label">{{ 'import.wizard.preview.duplicates' | transloco }}</div>
            <div class="card-sublabel">{{ 'import.wizard.preview.matchedExisting' | transloco }}</div>
          </div>
        </div>

        <!-- Detail Panels -->
        <div class="detail-panels">
          @if (store.previewResponse()!.errors.length > 0) {
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon class="panel-icon error">error</mat-icon>
                  {{ 'import.wizard.preview.validationErrors' | transloco }} ({{ store.previewResponse()!.errors.length }})
                </mat-panel-title>
              </mat-expansion-panel-header>
              <table class="detail-table">
                <thead>
                  <tr>
                    <th>{{ 'import.wizard.preview.row' | transloco }}</th>
                    <th>{{ 'import.wizard.preview.field' | transloco }}</th>
                    <th>{{ 'import.wizard.preview.error' | transloco }}</th>
                    <th>{{ 'import.wizard.preview.value' | transloco }}</th>
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
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon class="panel-icon warning">content_copy</mat-icon>
                  {{ 'import.wizard.preview.duplicateMatches' | transloco }} ({{ store.previewResponse()!.duplicates.length }})
                </mat-panel-title>
              </mat-expansion-panel-header>
              <table class="detail-table">
                <thead>
                  <tr>
                    <th>{{ 'import.wizard.preview.row' | transloco }}</th>
                    <th>{{ 'import.wizard.preview.matchField' | transloco }}</th>
                    <th>{{ 'import.wizard.preview.matchValue' | transloco }}</th>
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
        </div>
      }

      @if (store.error()) {
        <div class="error-msg">{{ store.error() }}</div>
      }

      <div class="step-actions">
        <button mat-button (click)="stepBack.emit()">{{ 'import.wizard.back' | transloco }}</button>
        <button mat-raised-button color="primary"
                [disabled]="store.loading() || !store.hasPreview()"
                (click)="onExecute()">
          {{ 'import.wizard.preview.executeImport' | transloco }}
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
