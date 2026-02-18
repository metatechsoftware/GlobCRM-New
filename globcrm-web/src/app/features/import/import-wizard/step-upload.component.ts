import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImportStore } from '../stores/import.store';
import { ImportEntityType } from '../import.models';

/**
 * Step 1: Upload -- entity type selection + CSV file upload.
 * Displays file name, size, and row count after successful upload.
 */
@Component({
  selector: 'app-step-upload',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .upload-container {
      max-width: 600px;
      padding: 24px 0;
    }

    .entity-type-select {
      width: 100%;
      margin-bottom: 24px;
    }

    .drop-zone {
      border: 2px dashed var(--color-border);
      border-radius: 12px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background-color 0.2s;
    }

    .drop-zone:hover,
    .drop-zone.drag-over {
      border-color: var(--color-primary);
      background-color: var(--color-primary-soft);
    }

    .drop-zone mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--color-text-secondary);
      margin-bottom: 16px;
    }

    .drop-zone p {
      margin: 0;
      color: var(--color-text-secondary);
    }

    .drop-zone .browse-link {
      color: var(--color-primary);
      font-weight: 500;
      text-decoration: underline;
      cursor: pointer;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      background: var(--color-surface-hover);
      margin-top: 16px;
    }

    .file-info mat-icon {
      color: var(--color-primary);
    }

    .file-details {
      flex: 1;
    }

    .file-name {
      font-weight: 500;
    }

    .file-meta {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .error-msg {
      color: var(--color-danger);
      margin-top: 12px;
      font-size: 14px;
    }

    .step-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
      padding-top: 16px;
    }
  `,
  template: `
    <div class="upload-container">
      <mat-form-field appearance="outline" class="entity-type-select">
        <mat-label>Entity Type</mat-label>
        <mat-select [value]="entityType()" (selectionChange)="entityType.set($event.value)">
          <mat-option value="Contact">Contacts</mat-option>
          <mat-option value="Company">Companies</mat-option>
          <mat-option value="Deal">Deals</mat-option>
        </mat-select>
      </mat-form-field>

      <div class="drop-zone"
           [class.drag-over]="isDragOver()"
           (dragover)="onDragOver($event)"
           (dragleave)="isDragOver.set(false)"
           (drop)="onDrop($event)"
           (click)="fileInput.click()">
        <input #fileInput type="file" accept=".csv" hidden (change)="onFileSelected($event)">

        @if (store.loading()) {
          <mat-spinner diameter="48"></mat-spinner>
          <p>Uploading file...</p>
        } @else {
          <mat-icon>cloud_upload</mat-icon>
          <p>Drag and drop a CSV file here</p>
          <p>or <span class="browse-link">browse files</span></p>
        }
      </div>

      @if (selectedFile()) {
        <div class="file-info">
          <mat-icon>description</mat-icon>
          <div class="file-details">
            <div class="file-name">{{ selectedFile()!.name }}</div>
            <div class="file-meta">
              {{ formatFileSize(selectedFile()!.size) }}
              @if (store.uploadResponse()) {
                &mdash; {{ store.uploadResponse()!.totalRows }} rows detected
              }
            </div>
          </div>
          @if (store.hasUpload()) {
            <mat-icon style="color: var(--color-success)">check_circle</mat-icon>
          }
        </div>
      }

      @if (store.error()) {
        <div class="error-msg">{{ store.error() }}</div>
      }

      <div class="step-actions">
        <button mat-raised-button color="primary"
                [disabled]="!store.hasUpload()"
                (click)="stepComplete.emit()">
          Next
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
