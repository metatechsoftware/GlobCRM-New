import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface CloneTemplateDialogData {
  originalName: string;
}

export interface CloneTemplateDialogResult {
  name: string;
}

/**
 * Simple dialog to prompt for a new name when cloning an email template.
 */
@Component({
  selector: 'app-clone-template-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Clone Template</h2>
    <mat-dialog-content>
      <p>Enter a name for the cloned template:</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Template Name</mat-label>
        <input matInput [(ngModel)]="cloneName" (keydown.enter)="confirm()" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!cloneName.trim()"
        (click)="confirm()"
      >
        Clone
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .full-width {
      width: 100%;
    }
  `,
})
export class CloneTemplateDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CloneTemplateDialogComponent>);
  private readonly data: CloneTemplateDialogData = inject(MAT_DIALOG_DATA);

  cloneName = `${this.data.originalName} (Copy)`;

  confirm(): void {
    if (this.cloneName.trim()) {
      this.dialogRef.close({ name: this.cloneName.trim() } as CloneTemplateDialogResult);
    }
  }
}
