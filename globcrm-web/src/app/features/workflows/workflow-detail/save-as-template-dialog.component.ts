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
import { TranslocoPipe } from '@jsverse/transloco';

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
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'saveTemplate.title' | transloco }}</h2>
    <mat-dialog-content>
      <p class="dialog-hint">
        {{ 'saveTemplate.hint' | transloco:{ name: data.workflowName } }}
      </p>

      <mat-form-field appearance="outline" class="dialog-field">
        <mat-label>{{ 'saveTemplate.templateName' | transloco }}</mat-label>
        <input matInput
               [(ngModel)]="name"
               [placeholder]="'saveTemplate.templateNamePlaceholder' | transloco"
               required />
      </mat-form-field>

      <mat-form-field appearance="outline" class="dialog-field">
        <mat-label>{{ 'saveTemplate.description' | transloco }}</mat-label>
        <textarea matInput
                  [(ngModel)]="description"
                  [placeholder]="'saveTemplate.descriptionPlaceholder' | transloco"
                  rows="3">
        </textarea>
      </mat-form-field>

      <mat-form-field appearance="outline" class="dialog-field">
        <mat-label>{{ 'saveTemplate.category' | transloco }}</mat-label>
        <mat-select [(ngModel)]="category" required>
          <mat-option value="sales">{{ 'saveTemplate.categories.sales' | transloco }}</mat-option>
          <mat-option value="engagement">{{ 'saveTemplate.categories.engagement' | transloco }}</mat-option>
          <mat-option value="operational">{{ 'saveTemplate.categories.operational' | transloco }}</mat-option>
          <mat-option value="custom">{{ 'saveTemplate.categories.custom' | transloco }}</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'saveTemplate.cancel' | transloco }}</button>
      <button mat-flat-button
              color="primary"
              [disabled]="!name() || !category()"
              (click)="save()">
        {{ 'saveTemplate.save' | transloco }}
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
