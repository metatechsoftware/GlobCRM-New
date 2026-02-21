import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  effect,
  inject,
  OnDestroy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AttachmentService } from '../../services/attachment.service';
import { AttachmentDto } from '../../models/attachment.models';

// ─── Image Preview Dialog Component ─────────────────────────────────────────

/**
 * Simple dialog component that displays an image preview.
 * Receives imageUrl (blob object URL) and fileName via MAT_DIALOG_DATA.
 */
@Component({
  selector: 'app-image-preview-dialog',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatDialogModule, TranslocoPipe],
  template: `
    <div class="image-preview-dialog">
      <div class="dialog-header">
        <span class="dialog-title">{{ data.fileName }}</span>
        <button mat-icon-button (click)="dialogRef.close()" [attr.aria-label]="'common.close' | transloco">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="dialog-body">
        <img [src]="data.imageUrl" [alt]="data.fileName" class="preview-image" />
      </div>
    </div>
  `,
  styles: [`
    .image-preview-dialog {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }
    .dialog-title {
      font-size: 14px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 300px;
    }
    .dialog-body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow: auto;
    }
    .preview-image {
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImagePreviewDialogComponent {
  readonly data: { imageUrl: string; fileName: string } = inject(MAT_DIALOG_DATA);
  readonly dialogRef: MatDialogRef<ImagePreviewDialogComponent> = inject(MatDialogRef);
}

// ─── Entity Attachments Component ───────────────────────────────────────────

/**
 * Reusable attachment panel for any entity detail page.
 * Accepts entityType and entityId inputs and provides complete file management:
 * upload with validation, list with metadata, download, delete, and inline
 * image preview via mat-dialog for image/* content types.
 */
@Component({
  selector: 'app-entity-attachments',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
    TranslocoPipe,
  ],
  template: `
    <!-- Header -->
    <div class="attachments-header">
      <h3 class="attachments-title">{{ 'common.attachments.title' | transloco }}</h3>
      <button mat-flat-button color="primary" (click)="fileInput.click()" [disabled]="isUploading()">
        <mat-icon>upload_file</mat-icon>
        {{ 'common.attachments.upload' | transloco }}
      </button>
      <input
        #fileInput
        type="file"
        hidden
        (change)="onFileSelected($event)"
      />
    </div>

    <!-- Upload Progress -->
    @if (isUploading()) {
      <mat-progress-bar mode="indeterminate" class="upload-progress"></mat-progress-bar>
    }

    <!-- Error -->
    @if (error()) {
      <div class="error-banner">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error() }}</span>
      </div>
    }

    <!-- Loading -->
    @if (isLoading()) {
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    }

    <!-- Attachment List -->
    @if (!isLoading()) {
      @if (attachments().length === 0) {
        <div class="empty-state">
          <mat-icon class="empty-icon">attach_file</mat-icon>
          <span class="empty-text">{{ 'common.attachments.noAttachments' | transloco }}</span>
        </div>
      } @else {
        <div class="attachment-list">
          @for (attachment of attachments(); track attachment.id) {
            <div class="attachment-row">
              <mat-icon class="file-type-icon">{{ getFileIcon(attachment.contentType) }}</mat-icon>
              <div class="attachment-info">
                <span class="file-name" [title]="attachment.fileName">{{ attachment.fileName }}</span>
                <span class="file-meta">
                  {{ formatFileSize(attachment.fileSizeBytes) }}
                  @if (attachment.uploadedByName) {
                    &middot; {{ attachment.uploadedByName }}
                  }
                  &middot; {{ attachment.uploadedAt | date:'MMM d, yyyy' }}
                </span>
              </div>
              <div class="attachment-actions">
                @if (isImage(attachment.contentType)) {
                  <button mat-icon-button (click)="openImagePreview(attachment)" [title]="'common.attachments.preview' | transloco">
                    <mat-icon>visibility</mat-icon>
                  </button>
                }
                <button mat-icon-button (click)="onDownload(attachment)" [title]="'common.attachments.download' | transloco">
                  <mat-icon>download</mat-icon>
                </button>
                <button mat-icon-button (click)="onDelete(attachment)" [title]="'common.attachments.delete' | transloco" color="warn">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      }
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    .attachments-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .attachments-title {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      flex: 1;
    }

    .upload-progress {
      margin-bottom: 12px;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
      background: var(--color-danger-soft);
      border-radius: 4px;
      color: var(--color-danger-text);
      font-size: 13px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
      color: rgba(0, 0, 0, 0.38);
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }

    .empty-text {
      font-size: 14px;
    }

    .attachment-list {
      display: flex;
      flex-direction: column;
    }

    .attachment-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 4px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }

    .attachment-row:last-child {
      border-bottom: none;
    }

    .file-type-icon {
      color: rgba(0, 0, 0, 0.54);
      flex-shrink: 0;
    }

    .attachment-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .file-name {
      font-size: 14px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-meta {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }

    .attachment-actions {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityAttachmentsComponent implements OnDestroy {
  /** The type of entity (e.g., 'company', 'contact', 'deal'). */
  entityType = input.required<string>();

  /** The ID of the entity to manage attachments for. */
  entityId = input.required<string>();

  private readonly attachmentService = inject(AttachmentService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly translocoService = inject(TranslocoService);

  // ─── Signals ──────────────────────────────────────────────────────────

  attachments = signal<AttachmentDto[]>([]);
  isLoading = signal(false);
  isUploading = signal(false);
  error = signal<string | null>(null);

  /** Track object URLs for cleanup on destroy. */
  private objectUrls: string[] = [];

  constructor() {
    // Load attachments when entityId changes
    effect(() => {
      const id = this.entityId();
      const type = this.entityType();
      if (id && type) {
        this.loadAttachments(type, id);
      }
    });
  }

  ngOnDestroy(): void {
    // Revoke any remaining object URLs
    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }
  }

  // ─── Data Loading ─────────────────────────────────────────────────────

  private loadAttachments(entityType: string, entityId: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.attachmentService.list(entityType, entityId).subscribe({
      next: (attachments) => {
        this.attachments.set(attachments);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set(this.translocoService.translate('common.attachments.loadFailed'));
        this.isLoading.set(false);
      },
    });
  }

  // ─── File Upload ──────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    input.value = ''; // Reset input so same file can be re-selected

    // Validate file before upload
    const validation = this.attachmentService.validateFile(file);
    if (!validation.valid) {
      this.snackBar.open(validation.error!, this.translocoService.translate('common.ok'), { duration: 5000 });
      return;
    }

    this.isUploading.set(true);
    this.error.set(null);

    this.attachmentService
      .upload(this.entityType(), this.entityId(), file)
      .subscribe({
        next: (newAttachment) => {
          this.attachments.update((list) => [newAttachment, ...list]);
          this.isUploading.set(false);
          this.snackBar.open(this.translocoService.translate('common.attachments.uploaded', { name: file.name }), this.translocoService.translate('common.ok'), { duration: 3000 });
        },
        error: () => {
          this.isUploading.set(false);
          this.snackBar.open(this.translocoService.translate('common.attachments.uploadFailed'), this.translocoService.translate('common.ok'), { duration: 5000 });
        },
      });
  }

  // ─── Download ─────────────────────────────────────────────────────────

  onDownload(attachment: AttachmentDto): void {
    this.attachmentService.download(attachment.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.fileName;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open(this.translocoService.translate('common.attachments.downloadFailed'), this.translocoService.translate('common.ok'), { duration: 3000 });
      },
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  onDelete(attachment: AttachmentDto): void {
    const confirmed = confirm(this.translocoService.translate('common.attachments.deleteConfirm', { name: attachment.fileName }));
    if (!confirmed) return;

    this.attachmentService.delete(attachment.id).subscribe({
      next: () => {
        this.attachments.update((list) => list.filter((a) => a.id !== attachment.id));
        this.snackBar.open(this.translocoService.translate('common.attachments.deleted'), this.translocoService.translate('common.ok'), { duration: 3000 });
      },
      error: () => {
        this.snackBar.open(this.translocoService.translate('common.attachments.deleteFailed'), this.translocoService.translate('common.ok'), { duration: 3000 });
      },
    });
  }

  // ─── Image Preview ────────────────────────────────────────────────────

  openImagePreview(attachment: AttachmentDto): void {
    this.attachmentService.download(attachment.id).subscribe({
      next: (blob) => {
        const imageUrl = URL.createObjectURL(blob);
        this.objectUrls.push(imageUrl);

        const dialogRef = this.dialog.open(ImagePreviewDialogComponent, {
          width: 'auto',
          maxWidth: '90vw',
          panelClass: 'image-preview-dialog',
          data: { imageUrl, fileName: attachment.fileName },
        });

        dialogRef.afterClosed().subscribe(() => {
          URL.revokeObjectURL(imageUrl);
          this.objectUrls = this.objectUrls.filter((u) => u !== imageUrl);
        });
      },
      error: () => {
        this.snackBar.open(this.translocoService.translate('common.attachments.previewFailed'), this.translocoService.translate('common.ok'), { duration: 3000 });
      },
    });
  }

  // ─── Utility Methods ──────────────────────────────────────────────────

  /** Returns a Material icon name based on the content type. */
  getFileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (
      contentType === 'application/msword' ||
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return 'description';
    }
    if (
      contentType === 'application/vnd.ms-excel' ||
      contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return 'table_chart';
    }
    return 'insert_drive_file';
  }

  /** Checks if the content type is an image type. */
  isImage(contentType: string): boolean {
    return this.attachmentService.isImageContentType(contentType);
  }

  /** Formats file size in human-readable KB/MB format. */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
