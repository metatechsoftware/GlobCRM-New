import {
  Component,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface DisconnectDialogData {
  integrationName: string;
}

@Component({
  selector: 'app-integration-disconnect-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="dd-title">
      <mat-icon class="dd-title__icon">link_off</mat-icon>
      Disconnect {{ data.integrationName }}?
    </h2>

    <mat-dialog-content class="dd-content">
      <p class="dd-content__text">
        This will remove your stored credentials. You can reconnect later.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dd-actions">
      <button mat-button [mat-dialog-close]="false" class="dd-actions__cancel">
        Cancel
      </button>
      <button
        mat-flat-button
        color="warn"
        [mat-dialog-close]="true"
        class="dd-actions__disconnect"
      >
        <mat-icon>link_off</mat-icon>
        Disconnect
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dd-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .dd-title__icon {
        color: var(--color-error);
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .dd-content__text {
        font-size: 14px;
        color: var(--color-text-secondary);
        line-height: 1.5;
        margin: 0;
      }

      .dd-actions__disconnect {
        font-weight: 600;
      }

      .dd-actions__disconnect mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-right: 4px;
      }
    `,
  ],
})
export class IntegrationDisconnectDialogComponent {
  readonly data = inject<DisconnectDialogData>(MAT_DIALOG_DATA);
}
