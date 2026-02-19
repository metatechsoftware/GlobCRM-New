import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-workflow-toolbar',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    FormsModule,
  ],
  template: `
    <div class="toolbar">
      <button mat-icon-button (click)="back.emit()" matTooltip="Back to workflows">
        <mat-icon>arrow_back</mat-icon>
      </button>

      <div class="toolbar__name">
        @if (editingName) {
          <mat-form-field appearance="outline" class="toolbar__name-field">
            <input matInput
                   [ngModel]="workflowName()"
                   (ngModelChange)="nameChanged.emit($event)"
                   (blur)="editingName = false"
                   (keyup.enter)="editingName = false"
                   placeholder="Workflow name"
                   #nameInput />
          </mat-form-field>
        } @else {
          <span class="toolbar__name-display" (click)="editingName = true; focusNameInput()">
            {{ workflowName() || 'Untitled Workflow' }}
            <mat-icon class="toolbar__name-edit-icon">edit</mat-icon>
          </span>
        }
      </div>

      <mat-form-field appearance="outline" class="toolbar__entity-select">
        <mat-label>Entity Type</mat-label>
        <mat-select [value]="entityType()" (selectionChange)="entityTypeChanged.emit($event.value)">
          <mat-option value="Contact">Contact</mat-option>
          <mat-option value="Company">Company</mat-option>
          <mat-option value="Deal">Deal</mat-option>
          <mat-option value="Lead">Lead</mat-option>
          <mat-option value="Activity">Activity</mat-option>
        </mat-select>
      </mat-form-field>

      <div class="toolbar__spacer"></div>

      <button mat-stroked-button
              (click)="openTemplates.emit()"
              class="toolbar__template-btn">
        <mat-icon>dashboard</mat-icon>
        Use template
      </button>

      @if (!isNew()) {
        <button mat-stroked-button
                (click)="toggleActive.emit()"
                [class.active-btn]="isActive()"
                class="toolbar__toggle-btn">
          @if (isActive()) {
            <mat-icon>pause</mat-icon>
            Deactivate
          } @else {
            <mat-icon>play_arrow</mat-icon>
            Activate
          }
        </button>
      }

      <button mat-flat-button
              color="primary"
              (click)="save.emit()"
              [disabled]="!isDirty() || isSaving()"
              class="toolbar__save-btn">
        @if (isSaving()) {
          <mat-spinner diameter="20" class="toolbar__spinner"></mat-spinner>
        } @else {
          <mat-icon>save</mat-icon>
        }
        Save
      </button>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 48px;
      padding: 0 12px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
    }

    .toolbar__name {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .toolbar__name-display {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-md);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 300px;

      &:hover {
        background: var(--color-surface-hover);
      }
    }

    .toolbar__name-edit-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--color-text-muted);
      opacity: 0;
      transition: opacity var(--duration-fast);
    }

    .toolbar__name-display:hover .toolbar__name-edit-icon {
      opacity: 1;
    }

    .toolbar__name-field {
      width: 250px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }

      ::ng-deep .mdc-text-field {
        padding: 0 8px;
      }

      ::ng-deep .mat-mdc-form-field-infix {
        min-height: 32px;
        padding: 4px 0;
      }
    }

    .toolbar__entity-select {
      width: 140px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }

      ::ng-deep .mat-mdc-form-field-infix {
        min-height: 32px;
        padding: 4px 0;
      }
    }

    .toolbar__spacer {
      flex: 1;
    }

    .toolbar__template-btn,
    .toolbar__toggle-btn {
      white-space: nowrap;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
    }

    .toolbar__toggle-btn.active-btn {
      color: var(--color-success-text);
    }

    .toolbar__save-btn {
      white-space: nowrap;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
    }

    .toolbar__spinner {
      display: inline-block;
      margin-right: 4px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowToolbarComponent {
  readonly workflowName = input<string>('');
  readonly entityType = input<string>('Contact');
  readonly isActive = input<boolean>(false);
  readonly isDirty = input<boolean>(false);
  readonly isSaving = input<boolean>(false);
  readonly isNew = input<boolean>(true);

  readonly nameChanged = output<string>();
  readonly entityTypeChanged = output<string>();
  readonly save = output<void>();
  readonly toggleActive = output<void>();
  readonly openTemplates = output<void>();
  readonly back = output<void>();

  editingName = false;

  focusNameInput(): void {
    // Focus happens automatically when input renders
    setTimeout(() => {
      const input = document.querySelector('.toolbar__name-field input') as HTMLInputElement;
      input?.focus();
      input?.select();
    }, 50);
  }
}
