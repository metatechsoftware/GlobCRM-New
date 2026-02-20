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
      <button mat-stroked-button
              *appHasPermission="'Note:Create'"
              (click)="addNote.emit()">
        <mat-icon>note_add</mat-icon>
        Add Note
      </button>
      <button mat-stroked-button
              *appHasPermission="'Activity:Create'"
              (click)="logActivity.emit()">
        <mat-icon>add_task</mat-icon>
        Log Activity
      </button>
      @if (showSendEmail()) {
        <button mat-stroked-button
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
      gap: 12px;
      padding: 12px 0;
      flex-wrap: wrap;
    }

    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
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
