import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';

@Component({
  selector: 'app-quick-action-bar',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quick-action-bar">
      <button mat-flat-button
              class="action-pill"
              *appHasPermission="'Note:Create'"
              (click)="addNote.emit()">
        <mat-icon>note_add</mat-icon>
        Add Note
      </button>
      <button mat-flat-button
              class="action-pill"
              *appHasPermission="'Activity:Create'"
              (click)="logActivity.emit()">
        <mat-icon>add_task</mat-icon>
        Log Activity
      </button>
      @if (showSendEmail()) {
        <button mat-flat-button
                class="action-pill"
                *appHasPermission="'Email:Create'"
                (click)="sendEmail.emit()">
          <mat-icon>email</mat-icon>
          Send Email
        </button>
      }
    </div>
  `,
  styles: [`
    .quick-action-bar {
      display: flex;
      gap: var(--space-3, 12px);
      padding: var(--space-3, 12px) 0;
      flex-wrap: wrap;
    }

    .action-pill {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5, 6px);
      font-size: var(--text-sm, 13px);
      font-weight: var(--font-medium, 500);
      border-radius: var(--radius-full, 9999px) !important;
      --mdc-filled-button-container-color: var(--color-primary-soft, #FFF7ED);
      --mdc-filled-button-label-text-color: var(--color-primary-text, #C2410C);
      transition: all var(--duration-normal, 200ms) var(--ease-default);

      &:hover {
        --mdc-filled-button-container-color: var(--color-primary-soft-hover, #FFEDD5);
        box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.04));
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--color-primary, #F97316);
      }
    }
  `],
})
export class QuickActionBarComponent {
  readonly showSendEmail = input(false);

  readonly addNote = output<void>();
  readonly logActivity = output<void>();
  readonly sendEmail = output<void>();
}
