import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { LeadDetailDto } from '../lead.models';

/**
 * Placeholder for lead conversion dialog.
 * Will be fully implemented in Task 3.
 */
@Component({
  selector: 'app-lead-convert-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Convert Lead</h2>
    <mat-dialog-content>
      <p>Lead conversion dialog - being implemented...</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Cancel</button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadConvertDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<LeadConvertDialogComponent>);
  readonly data: { lead: LeadDetailDto } = inject(MAT_DIALOG_DATA);
}
