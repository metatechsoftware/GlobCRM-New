import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthStore } from '../../core/auth/auth.store';

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  icon: string;
  label: string;
  description: string;
  route: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-settings-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule],
  template: `
    <div class="settings-hub">
      <div class="settings-hub__header">
        <h1 class="settings-hub__title">Settings</h1>
        <p class="settings-hub__subtitle">Manage your organization's configuration and preferences</p>
      </div>

      @for (section of sections; track section.title) {
        <div class="settings-hub__section">
          <h2 class="settings-hub__section-title">{{ section.title }}</h2>
          <div class="settings-hub__cards">
            @for (item of section.items; track item.route) {
              @if (!item.adminOnly || isAdmin()) {
                <a [routerLink]="item.route" class="settings-hub__card">
                  <mat-icon class="settings-hub__card-icon">{{ item.icon }}</mat-icon>
                  <div class="settings-hub__card-content">
                    <h3 class="settings-hub__card-label">{{ item.label }}</h3>
                    <p class="settings-hub__card-desc">{{ item.description }}</p>
                  </div>
                  <mat-icon class="settings-hub__card-arrow">chevron_right</mat-icon>
                </a>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-hub {
      padding: 24px 32px;
      max-width: 900px;
      margin: 0 auto;
    }

    .settings-hub__header {
      margin-bottom: 32px;
    }

    .settings-hub__title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: var(--text-primary, #1e293b);
    }

    .settings-hub__subtitle {
      font-size: 14px;
      color: var(--text-secondary, #64748b);
      margin: 0;
    }

    .settings-hub__section {
      margin-bottom: 32px;
    }

    .settings-hub__section-title {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary, #64748b);
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
    }

    .settings-hub__cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 12px;
    }

    .settings-hub__card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
      cursor: pointer;
    }

    .settings-hub__card:hover {
      border-color: var(--primary, #4f46e5);
      box-shadow: 0 1px 3px rgba(79, 70, 229, 0.1);
    }

    .settings-hub__card-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: var(--primary, #4f46e5);
      flex-shrink: 0;
    }

    .settings-hub__card-content {
      flex: 1;
      min-width: 0;
    }

    .settings-hub__card-label {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 2px 0;
      color: var(--text-primary, #1e293b);
    }

    .settings-hub__card-desc {
      font-size: 13px;
      color: var(--text-secondary, #64748b);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .settings-hub__card-arrow {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--text-secondary, #94a3b8);
      flex-shrink: 0;
    }
  `],
})
export class SettingsHubComponent {
  private readonly authStore = inject(AuthStore);

  readonly sections: SettingsSection[] = [
    {
      title: 'Organization',
      items: [
        {
          icon: 'shield',
          label: 'Roles & Permissions',
          description: 'Manage user roles and access permissions',
          route: '/settings/roles',
          adminOnly: true,
        },
        {
          icon: 'groups',
          label: 'Teams',
          description: 'Create and manage teams',
          route: '/settings/teams',
          adminOnly: true,
        },
        {
          icon: 'tune',
          label: 'Custom Fields',
          description: 'Configure custom fields for entities',
          route: '/settings/custom-fields',
          adminOnly: true,
        },
        {
          icon: 'linear_scale',
          label: 'Pipelines',
          description: 'Manage deal pipeline stages',
          route: '/settings/pipelines',
          adminOnly: true,
        },
      ],
    },
    {
      title: 'Data Operations',
      items: [
        {
          icon: 'upload_file',
          label: 'Import Data',
          description: 'Import contacts, companies, or deals from CSV files',
          route: '/import',
        },
        {
          icon: 'history',
          label: 'Import History',
          description: 'View past import jobs and their results',
          route: '/import/history',
        },
      ],
    },
    {
      title: 'Personal',
      items: [
        {
          icon: 'email',
          label: 'Email Accounts',
          description: 'Connect and manage email accounts',
          route: '/settings/email-accounts',
        },
        {
          icon: 'notifications',
          label: 'Notification Preferences',
          description: 'Customize notification delivery settings',
          route: '/settings/notification-preferences',
        },
      ],
    },
  ];

  isAdmin(): boolean {
    return this.authStore.userRole() === 'Admin';
  }
}
