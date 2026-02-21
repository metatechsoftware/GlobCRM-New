import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImportStore } from '../stores/import.store';
import { ImportEntityType } from '../import.models';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Step 1: Upload -- entity type selection via visual cards + CSV file upload.
 * Displays file name, size, and row count after successful upload.
 */
@Component({
  selector: 'app-step-upload',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './step-upload.component.scss',
  template: `
    <div class="upload-container">
      <!-- Entity Type Cards -->
      <div class="section-label">{{ 'wizard.upload.whatImporting' | transloco }}</div>
      <div class="entity-type-cards">
        <button class="entity-card"
                [class.selected]="entityType() === 'Contact'"
                (click)="entityType.set('Contact')">
          <mat-icon class="entity-card__icon">person</mat-icon>
          <span class="entity-card__label">{{ 'wizard.upload.contacts' | transloco }}</span>
        </button>
        <button class="entity-card"
                [class.selected]="entityType() === 'Company'"
                (click)="entityType.set('Company')">
          <mat-icon class="entity-card__icon">business</mat-icon>
          <span class="entity-card__label">{{ 'wizard.upload.companies' | transloco }}</span>
        </button>
        <button class="entity-card"
                [class.selected]="entityType() === 'Deal'"
                (click)="entityType.set('Deal')">
          <mat-icon class="entity-card__icon">handshake</mat-icon>
          <span class="entity-card__label">{{ 'wizard.upload.deals' | transloco }}</span>
        </button>
      </div>

      <!-- Drop Zone -->
      <div class="drop-zone"
           [class.drag-over]="isDragOver()"
           [class.has-file]="selectedFile()"
           (dragover)="onDragOver($event)"
           (dragleave)="isDragOver.set(false)"
           (drop)="onDrop($event)"
           (click)="fileInput.click()">
        <input #fileInput type="file" accept=".csv" hidden (change)="onFileSelected($event)">

        @if (store.loading()) {
          <div class="upload-loading">
            <mat-spinner diameter="48"></mat-spinner>
            <p>{{ 'wizard.upload.processing' | transloco }}</p>
          </div>
        } @else if (!selectedFile()) {
          <div class="drop-zone__content">
            <div class="drop-zone__icon-bg">
              <mat-icon>cloud_upload</mat-icon>
            </div>
            <h3 class="drop-zone__title">{{ 'wizard.upload.dropTitle' | transloco }}</h3>
            <p class="drop-zone__subtitle">{{ 'wizard.upload.orBrowse' | transloco }}</p>
            <p class="drop-zone__hint">{{ 'wizard.upload.hint' | transloco }}</p>
          </div>
        } @else {
          <div class="file-card">
            <div class="file-card__icon">
              <mat-icon>description</mat-icon>
            </div>
            <div class="file-card__info">
              <span class="file-card__name">{{ selectedFile()!.name }}</span>
              <span class="file-card__meta">
                {{ formatFileSize(selectedFile()!.size) }}
                @if (store.uploadResponse()) {
                  · {{ store.uploadResponse()!.totalRows }} {{ 'wizard.upload.rowsDetected' | transloco }}
                }
              </span>
            </div>
            @if (store.hasUpload()) {
              <div class="file-card__status">
                <mat-icon>check_circle</mat-icon>
                {{ 'wizard.upload.ready' | transloco }}
              </div>
            }
          </div>
        }
      </div>

      @if (store.error()) {
        <div class="error-msg">{{ store.error() }}</div>
      }

      <div class="step-actions">
        <button mat-raised-button color="primary"
                [disabled]="!store.hasUpload()"
                (click)="stepComplete.emit()">
          {{ 'wizard.next' | transloco }}
        </button>
      </div>
    </div>
  `,
})
export class StepUploadComponent {
  readonly store = inject(ImportStore);

  @Output() stepComplete = new EventEmitter<void>();

  readonly entityType = signal<ImportEntityType>('Contact');
  readonly selectedFile = signal<File | null>(null);
  readonly isDragOver = signal(false);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return;
    }
    this.selectedFile.set(file);
    this.store.upload(file, this.entityType());
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
