import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ 'common.dialog.confirmDelete' | transloco }}</h2>
    <mat-dialog-content>
      <p>{{ 'common.dialog.deleteWarning' | transloco:{ type: data.type, name: data.name } }}</p>
      <p>{{ 'common.dialog.cannotBeUndone' | transloco }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">{{ 'common.delete' | transloco }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDeleteDialogComponent {
  readonly data: { name: string; type: string } = inject(MAT_DIALOG_DATA);
}
