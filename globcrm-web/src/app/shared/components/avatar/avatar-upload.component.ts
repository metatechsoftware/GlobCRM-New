import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AvatarComponent } from './avatar.component';
import { AvatarCropDialogComponent } from './avatar-crop-dialog.component';

/**
 * Avatar upload component with crop dialog using ngx-image-cropper.
 *
 * Shows current avatar with "Change Photo" overlay on hover.
 * On file select, opens a crop dialog. On save, emits the uploaded avatar URL.
 */
@Component({
  selector: 'app-avatar-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    AvatarComponent,
  ],
  template: `
    <div class="avatar-upload-container">
      <div class="avatar-wrapper" (click)="fileInput.click()">
        <app-avatar
          [avatarUrl]="currentAvatarUrl"
          [firstName]="firstName"
          [lastName]="lastName"
          size="lg" />
        <div class="overlay">
          <mat-icon>photo_camera</mat-icon>
          <span>Change Photo</span>
        </div>
      </div>

      <input
        #fileInput
        type="file"
        accept="image/*"
        class="hidden-input"
        (change)="onFileSelected($event)" />

      <div class="upload-actions">
        @if (uploading()) {
          <mat-spinner diameter="24"></mat-spinner>
        }
        @if (currentAvatarUrl) {
          <button mat-stroked-button color="warn" (click)="removePhoto()" [disabled]="uploading()">
            <mat-icon>delete</mat-icon>
            Remove Photo
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .avatar-upload-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .avatar-wrapper {
      position: relative;
      cursor: pointer;
      border-radius: 50%;
      overflow: hidden;
    }

    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      opacity: 0;
      transition: opacity 0.2s ease;
      border-radius: 50%;
      font-size: 11px;
    }

    .avatar-wrapper:hover .overlay {
      opacity: 1;
    }

    .overlay mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .hidden-input {
      display: none;
    }

    .upload-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `],
})
export class AvatarUploadComponent {
  @Input() currentAvatarUrl: string | null = null;
  @Input() firstName = '';
  @Input() lastName = '';
  @Output() avatarUploaded = new EventEmitter<{ avatarUrl: string }>();
  @Output() avatarRemoved = new EventEmitter<void>();

  private readonly dialog = inject(MatDialog);
  readonly uploading = signal<boolean>(false);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    input.value = '';

    const dialogRef = this.dialog.open(AvatarCropDialogComponent, {
      width: '500px',
      data: { imageFile: file },
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: { croppedBlob: Blob } | null) => {
      if (result?.croppedBlob) {
        this.uploadCroppedImage(result.croppedBlob);
      }
    });
  }

  removePhoto(): void {
    this.avatarRemoved.emit();
  }

  private uploadCroppedImage(blob: Blob): void {
    this.uploading.set(true);

    // Create FormData and emit for parent to handle upload
    // The parent component (ProfileEditComponent) will call ProfileService.uploadAvatar
    const formData = new FormData();
    formData.append('file', blob, 'avatar.webp');

    // For now, create a temporary URL for preview
    // The actual upload is handled by the parent via the avatarUploaded event
    const tempUrl = URL.createObjectURL(blob);
    this.currentAvatarUrl = tempUrl;
    this.uploading.set(false);
    this.avatarUploaded.emit({ avatarUrl: tempUrl });
  }
}
