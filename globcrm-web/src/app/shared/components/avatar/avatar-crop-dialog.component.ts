import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { ImageCropperComponent, ImageCroppedEvent, LoadedImage } from 'ngx-image-cropper';

export interface AvatarCropDialogData {
  imageFile: File;
}

/**
 * Dialog component for cropping avatar images.
 * Uses ngx-image-cropper with 1:1 aspect ratio for avatar crop.
 */
@Component({
  selector: 'app-avatar-crop-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    ImageCropperComponent,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'common.avatar.cropTitle' | transloco }}</h2>
    <mat-dialog-content>
      <div class="cropper-container">
        <image-cropper
          [imageFile]="data.imageFile"
          [maintainAspectRatio]="true"
          [aspectRatio]="1"
          [resizeToWidth]="256"
          format="webp"
          (imageCropped)="onImageCropped($event)"
          (imageLoaded)="onImageLoaded($event)"
          (loadImageFailed)="onLoadFailed()"
        ></image-cropper>
      </div>
      @if (loadError()) {
        <p class="error-message">{{ 'common.avatar.loadError' | transloco }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">{{ 'common.avatar.cancel' | transloco }}</button>
      <button
        mat-flat-button
        color="primary"
        (click)="save()"
        [disabled]="!croppedBlob()">
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cropper-container {
      max-height: 400px;
      overflow: hidden;
    }

    .error-message {
      color: var(--color-danger-text);
      margin-top: 8px;
    }
  `],
})
export class AvatarCropDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AvatarCropDialogComponent>);
  readonly data = inject<AvatarCropDialogData>(MAT_DIALOG_DATA);

  readonly croppedBlob = signal<Blob | null>(null);
  readonly loadError = signal<boolean>(false);

  onImageCropped(event: ImageCroppedEvent): void {
    if (event.blob) {
      this.croppedBlob.set(event.blob);
    }
  }

  onImageLoaded(image: LoadedImage): void {
    this.loadError.set(false);
  }

  onLoadFailed(): void {
    this.loadError.set(true);
  }

  save(): void {
    const blob = this.croppedBlob();
    if (blob) {
      this.dialogRef.close({ croppedBlob: blob });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
