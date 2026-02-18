import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../notifications/notification.service';
import {
  NotificationPreferenceDto,
  NotificationType,
} from '../../notifications/notification.models';

interface PreferenceRow {
  type: string;
  label: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  [NotificationType.ActivityAssigned]: 'Activity Assigned',
  [NotificationType.DealStageChanged]: 'Deal Stage Changed',
  [NotificationType.Mention]: 'Mentions',
  [NotificationType.DueDateApproaching]: 'Due Date Approaching',
  [NotificationType.EmailReceived]: 'Email Received',
};

@Component({
  selector: 'app-notification-preferences',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  template: `
    <div class="preferences-container">
      <div class="preferences-header">
        <h2>Notification Preferences</h2>
        <p class="preferences-description">
          Choose how you receive notifications for different events.
        </p>
      </div>

      @if (loading()) {
        <div class="preferences-loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else {
        <table class="preferences-table">
          <thead>
            <tr>
              <th class="type-col">Notification Type</th>
              <th class="toggle-col">In-App</th>
              <th class="toggle-col">Email</th>
            </tr>
          </thead>
          <tbody>
            @for (pref of preferences(); track pref.type) {
              <tr>
                <td class="type-col">{{ pref.label }}</td>
                <td class="toggle-col">
                  <mat-slide-toggle
                    [(ngModel)]="pref.inAppEnabled"
                    color="primary"
                  ></mat-slide-toggle>
                </td>
                <td class="toggle-col">
                  <mat-slide-toggle
                    [(ngModel)]="pref.emailEnabled"
                    color="primary"
                  ></mat-slide-toggle>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="preferences-actions">
          <button
            mat-raised-button
            color="primary"
            [disabled]="saving()"
            (click)="save()"
          >
            @if (saving()) {
              <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
            }
            Save Preferences
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .preferences-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 24px;
    }

    .preferences-header {
      margin-bottom: 24px;
    }

    .preferences-header h2 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 500;
    }

    .preferences-description {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .preferences-loading {
      display: flex;
      justify-content: center;
      padding: 48px 0;
    }

    .preferences-table {
      width: 100%;
      border-collapse: collapse;
    }

    .preferences-table th {
      text-align: left;
      padding: 12px 16px;
      font-weight: 500;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--color-text-secondary);
      border-bottom: 2px solid var(--color-border);
    }

    .preferences-table td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .preferences-table tbody tr:nth-child(even) {
      background: var(--color-surface-hover);
    }

    .type-col {
      width: 60%;
    }

    .toggle-col {
      width: 20%;
      text-align: center;
    }

    .preferences-table th.toggle-col {
      text-align: center;
    }

    .preferences-actions {
      margin-top: 24px;
      display: flex;
      justify-content: flex-end;
    }

    .btn-spinner {
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
  `,
})
export class NotificationPreferencesComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly preferences = signal<PreferenceRow[]>([]);

  ngOnInit(): void {
    this.loadPreferences();
  }

  private loadPreferences(): void {
    this.loading.set(true);
    this.notificationService.getPreferences().subscribe({
      next: (prefs) => {
        if (prefs.length === 0) {
          // Generate default preferences for all 5 notification types
          this.preferences.set(this.generateDefaults());
        } else {
          this.preferences.set(
            prefs.map((p) => ({
              type: p.notificationType,
              label:
                NOTIFICATION_TYPE_LABELS[p.notificationType] ??
                p.notificationType,
              inAppEnabled: p.inAppEnabled,
              emailEnabled: p.emailEnabled,
            }))
          );
        }
        this.loading.set(false);
      },
      error: () => {
        // Fallback to defaults on error
        this.preferences.set(this.generateDefaults());
        this.loading.set(false);
      },
    });
  }

  private generateDefaults(): PreferenceRow[] {
    return Object.values(NotificationType).map((type) => ({
      type,
      label: NOTIFICATION_TYPE_LABELS[type] ?? type,
      inAppEnabled: true,
      emailEnabled: true,
    }));
  }

  save(): void {
    this.saving.set(true);
    const dtos: NotificationPreferenceDto[] = this.preferences().map((p) => ({
      notificationType: p.type,
      inAppEnabled: p.inAppEnabled,
      emailEnabled: p.emailEnabled,
    }));

    this.notificationService.updatePreferences(dtos).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Preferences saved successfully', 'Close', {
          duration: 3000,
        });
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open('Failed to save preferences', 'Close', {
          duration: 3000,
        });
      },
    });
  }
}
