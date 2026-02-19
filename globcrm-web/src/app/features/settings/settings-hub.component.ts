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
      color: var(--color-text);
    }

    .settings-hub__subtitle {
      font-size: 14px;
      color: var(--color-text-secondary);
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
      color: var(--color-primary-text);
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--color-primary);
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
      border: 1px solid var(--color-border);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
      cursor: pointer;
    }

    .settings-hub__card:hover {
      border-color: var(--color-primary);
      box-shadow: 0 1px 6px rgba(249, 115, 22, 0.15);
      background-color: var(--color-primary-soft);
    }

    .settings-hub__card-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: var(--color-primary);
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
      color: var(--color-text);
    }

    .settings-hub__card-desc {
      font-size: 13px;
      color: var(--color-text-secondary);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .settings-hub__card-arrow {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-text-muted);
      flex-shrink: 0;
      transition: color 0.15s;
    }

    .settings-hub__card:hover .settings-hub__card-arrow {
      color: var(--color-primary);
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
        {
          icon: 'compare_arrows',
          label: 'Duplicate Detection Rules',
          description: 'Configure matching rules and thresholds',
          route: '/settings/duplicate-rules',
          adminOnly: true,
        },
        {
          icon: 'link',
          label: 'Webhooks',
          description: 'Manage webhook subscriptions for external integrations',
          route: '/settings/webhooks',
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
