import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

interface DialogData {
  workflowId: string;
  workflowName: string;
}

/**
 * Dialog for saving a workflow as a reusable tenant-scoped template.
 * Provides Name, Description, and Category inputs.
 */
@Component({
  selector: 'app-save-as-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Save as Template</h2>
    <mat-dialog-content>
      <p class="dialog-hint">
        Save "{{ data.workflowName }}" as a reusable template for your organization.
      </p>

      <mat-form-field appearance="outline" class="dialog-field">
        <mat-label>Template Name</mat-label>
        <input matInput
               [(ngModel)]="name"
               placeholder="e.g., New Lead Welcome Flow"
               required />
      </mat-form-field>

      <mat-form-field appearance="outline" class="dialog-field">
        <mat-label>Description</mat-label>
        <textarea matInput
                  [(ngModel)]="description"
                  placeholder="What does this workflow do?"
                  rows="3">
        </textarea>
      </mat-form-field>

      <mat-form-field appearance="outline" class="dialog-field">
        <mat-label>Category</mat-label>
        <mat-select [(ngModel)]="category" required>
          <mat-option value="sales">Sales</mat-option>
          <mat-option value="engagement">Engagement</mat-option>
          <mat-option value="operational">Operational</mat-option>
          <mat-option value="custom">Custom</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button
              color="primary"
              [disabled]="!name() || !category()"
              (click)="save()">
        Save Template
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-hint {
      color: var(--color-text-secondary, #64748b);
      font-size: 14px;
      margin: 0 0 16px 0;
    }

    .dialog-field {
      display: block;
      width: 100%;
      margin-bottom: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveAsTemplateDialogComponent {
  readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<SaveAsTemplateDialogComponent>,
  );

  readonly name = signal(this.data.workflowName + ' Template');
  readonly description = signal('');
  readonly category = signal('custom');

  save(): void {
    if (!this.name() || !this.category()) return;

    this.dialogRef.close({
      name: this.name(),
      description: this.description() || undefined,
      category: this.category(),
    });
  }
}
