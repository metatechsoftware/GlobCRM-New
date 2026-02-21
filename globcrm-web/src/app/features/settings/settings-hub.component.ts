import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthStore } from '../../core/auth/auth.store';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

type SectionTheme = 'orange' | 'blue' | 'violet';

interface SettingsSection {
  titleKey: string;
  theme: SectionTheme;
  items: SettingsItem[];
}

interface SettingsItem {
  icon: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-settings-hub',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatIconModule, MatButtonModule, TranslocoPipe],
  template: `
    <!-- Hero Header -->
    <div class="sh-hero">
      <div class="sh-hero__mesh"></div>
      <div class="sh-hero__content">
        <div class="sh-hero__icon-wrap">
          <mat-icon class="sh-hero__icon">settings</mat-icon>
        </div>
        <div class="sh-hero__text">
          <h1 class="sh-hero__title">{{ 'settings.title' | transloco }}</h1>
          <p class="sh-hero__subtitle">{{ 'settings.subtitle' | transloco }}</p>
        </div>
      </div>
      <div class="sh-hero__search">
        <mat-icon class="sh-hero__search-icon">search</mat-icon>
        <input
          type="text"
          class="sh-hero__search-input"
          [placeholder]="'settings.search' | transloco"
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
        />
        @if (searchQuery()) {
          <button class="sh-hero__search-clear" (click)="searchQuery.set('')">
            <mat-icon>close</mat-icon>
          </button>
        }
      </div>
    </div>

    <!-- Sections -->
    <div class="sh-body">
      @for (section of filteredSections(); track section.titleKey; let si = $index) {
        <section
          class="sh-section"
          [class.sh-section--orange]="section.theme === 'orange'"
          [class.sh-section--blue]="section.theme === 'blue'"
          [class.sh-section--violet]="section.theme === 'violet'"
          [style.animation-delay]="(si * 80) + 'ms'"
        >
          <div class="sh-section__header">
            <div class="sh-section__accent"></div>
            <h2 class="sh-section__title">{{ section.titleKey | transloco }}</h2>
            <span class="sh-section__count">{{ visibleItemCount(section) }}</span>
          </div>

          <div class="sh-section__grid">
            @for (item of visibleItems(section); track item.route; let ii = $index) {
              <a
                [routerLink]="item.route"
                class="sh-card"
                [style.animation-delay]="(si * 80 + ii * 50 + 100) + 'ms'"
              >
                <div class="sh-card__icon-wrap">
                  <mat-icon class="sh-card__icon">{{ item.icon }}</mat-icon>
                </div>
                <div class="sh-card__body">
                  <div class="sh-card__title-row">
                    <h3 class="sh-card__label">{{ item.labelKey | transloco }}</h3>
                    @if (item.adminOnly) {
                      <span class="sh-card__badge">{{ 'settings.common.admin' | transloco }}</span>
                    }
                  </div>
                  <p class="sh-card__desc">{{ item.descriptionKey | transloco }}</p>
                </div>
                <mat-icon class="sh-card__arrow">arrow_forward</mat-icon>
              </a>
            }
          </div>
        </section>
      }

      @if (filteredSections().length === 0) {
        <div class="sh-empty">
          <mat-icon class="sh-empty__icon">search_off</mat-icon>
          <p class="sh-empty__text">{{ 'settings.noResults' | transloco }} "<strong>{{ searchQuery() }}</strong>"</p>
          <button class="sh-empty__reset" (click)="searchQuery.set('')">{{ 'settings.clearSearch' | transloco }}</button>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ─── Keyframes ──────────────────────────────────── */
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes meshDrift {
      0%, 100% { background-position: 0% 50%; }
      50%      { background-position: 100% 50%; }
    }

    @keyframes iconPulse {
      0%, 100% { transform: rotate(0deg); }
      50%      { transform: rotate(12deg); }
    }

    /* ─── Hero ───────────────────────────────────────── */
    .sh-hero {
      position: relative;
      padding: 40px 32px 28px;
      overflow: hidden;
    }

    .sh-hero__mesh {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 70% 50% at 10% 40%, rgba(249,115,22,0.08) 0%, transparent 70%),
        radial-gradient(ellipse 50% 60% at 90% 20%, rgba(139,92,246,0.06) 0%, transparent 70%),
        radial-gradient(ellipse 60% 40% at 50% 80%, rgba(20,184,166,0.05) 0%, transparent 70%);
      background-size: 200% 200%;
      animation: meshDrift 20s ease-in-out infinite;
      pointer-events: none;
    }

    .sh-hero__content {
      position: relative;
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 24px;
    }

    .sh-hero__icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow:
        0 4px 16px rgba(249,115,22,0.25),
        0 0 0 4px rgba(249,115,22,0.08);
      flex-shrink: 0;
      animation: iconPulse 6s ease-in-out infinite;
    }

    .sh-hero__icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #fff;
    }

    .sh-hero__title {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0;
      color: var(--color-text);
    }

    .sh-hero__subtitle {
      font-size: 15px;
      color: var(--color-text-secondary);
      margin: 4px 0 0;
      line-height: 1.4;
    }

    /* ─── Search ─────────────────────────────────────── */
    .sh-hero__search {
      position: relative;
      max-width: 420px;
    }

    .sh-hero__search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-text-muted);
      pointer-events: none;
    }

    .sh-hero__search-input {
      width: 100%;
      padding: 10px 40px 10px 44px;
      border: 1.5px solid var(--color-border);
      border-radius: 12px;
      background: var(--color-surface);
      color: var(--color-text);
      font-size: 14px;
      font-family: var(--font-sans);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .sh-hero__search-input::placeholder {
      color: var(--color-text-muted);
    }

    .sh-hero__search-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
    }

    .sh-hero__search-clear {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      padding: 4px;
      border-radius: 50%;
      transition: background 0.15s, color 0.15s;
    }

    .sh-hero__search-clear mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .sh-hero__search-clear:hover {
      background: var(--color-surface-hover);
      color: var(--color-text);
    }

    /* ─── Body ───────────────────────────────────────── */
    .sh-body {
      padding: 0 32px 48px;
      max-width: 960px;
    }

    /* ─── Section ────────────────────────────────────── */
    .sh-section {
      margin-bottom: 36px;
      opacity: 0;
      animation: fadeSlideUp 0.4s var(--ease-out) forwards;
    }

    .sh-section__header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .sh-section__accent {
      width: 4px;
      height: 20px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .sh-section__title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0;
      color: var(--color-text-secondary);
    }

    .sh-section__count {
      font-size: 11px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 10px;
      line-height: 1.5;
    }

    /* Section themes — accent bar + badge */
    .sh-section--orange .sh-section__accent { background: var(--color-primary); }
    .sh-section--orange .sh-section__count  { background: var(--color-primary-soft); color: var(--color-primary-text); }
    .sh-section--orange .sh-card__icon-wrap { background: var(--color-primary-soft); }
    .sh-section--orange .sh-card__icon      { color: var(--color-primary); }
    .sh-section--orange .sh-card:hover      { border-color: var(--color-primary); box-shadow: 0 2px 12px rgba(249,115,22,0.10); }
    .sh-section--orange .sh-card:hover .sh-card__icon-wrap { background: var(--color-primary); }
    .sh-section--orange .sh-card:hover .sh-card__icon      { color: #fff; }

    .sh-section--blue .sh-section__accent { background: var(--color-info); }
    .sh-section--blue .sh-section__count  { background: var(--color-info-soft); color: var(--color-info-text); }
    .sh-section--blue .sh-card__icon-wrap { background: var(--color-info-soft); }
    .sh-section--blue .sh-card__icon      { color: var(--color-info); }
    .sh-section--blue .sh-card:hover      { border-color: var(--color-info); box-shadow: 0 2px 12px rgba(59,130,246,0.10); }
    .sh-section--blue .sh-card:hover .sh-card__icon-wrap { background: var(--color-info); }
    .sh-section--blue .sh-card:hover .sh-card__icon      { color: #fff; }

    .sh-section--violet .sh-section__accent { background: var(--color-secondary); }
    .sh-section--violet .sh-section__count  { background: var(--color-secondary-soft); color: var(--color-secondary-text); }
    .sh-section--violet .sh-card__icon-wrap { background: var(--color-secondary-soft); }
    .sh-section--violet .sh-card__icon      { color: var(--color-secondary); }
    .sh-section--violet .sh-card:hover      { border-color: var(--color-secondary); box-shadow: 0 2px 12px rgba(139,92,246,0.10); }
    .sh-section--violet .sh-card:hover .sh-card__icon-wrap { background: var(--color-secondary); }
    .sh-section--violet .sh-card:hover .sh-card__icon      { color: #fff; }

    /* ─── Grid ───────────────────────────────────────── */
    .sh-section__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }

    /* ─── Card ───────────────────────────────────────── */
    .sh-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface);
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition:
        border-color 0.2s var(--ease-default),
        box-shadow 0.2s var(--ease-default),
        transform 0.2s var(--ease-default),
        background-color 0.2s var(--ease-default);
      opacity: 0;
      animation: fadeSlideUp 0.35s var(--ease-out) forwards;
    }

    .sh-card:hover {
      transform: translateY(-2px);
      background: var(--color-surface);
    }

    .sh-card:active {
      transform: translateY(0);
    }

    /* Icon container */
    .sh-card__icon-wrap {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.25s var(--ease-default), transform 0.25s var(--ease-default);
    }

    .sh-card:hover .sh-card__icon-wrap {
      transform: scale(1.08);
    }

    .sh-card__icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      transition: color 0.25s var(--ease-default);
    }

    /* Card body */
    .sh-card__body {
      flex: 1;
      min-width: 0;
    }

    .sh-card__title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sh-card__label {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
      color: var(--color-text);
      line-height: 1.3;
    }

    .sh-card__badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 6px;
      border-radius: 6px;
      background: var(--color-warning-soft);
      color: var(--color-warning-text);
      line-height: 1.6;
      flex-shrink: 0;
    }

    .sh-card__desc {
      font-size: 12.5px;
      color: var(--color-text-muted);
      margin: 3px 0 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Arrow */
    .sh-card__arrow {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-muted);
      flex-shrink: 0;
      opacity: 0;
      transform: translateX(-4px);
      transition: opacity 0.2s, transform 0.2s, color 0.2s;
    }

    .sh-card:hover .sh-card__arrow {
      opacity: 1;
      transform: translateX(0);
    }

    .sh-section--orange .sh-card:hover .sh-card__arrow { color: var(--color-primary); }
    .sh-section--blue   .sh-card:hover .sh-card__arrow { color: var(--color-info); }
    .sh-section--violet .sh-card:hover .sh-card__arrow { color: var(--color-secondary); }

    /* ─── Empty State ────────────────────────────────── */
    .sh-empty {
      text-align: center;
      padding: 64px 24px;
      opacity: 0;
      animation: fadeSlideUp 0.3s var(--ease-out) forwards;
    }

    .sh-empty__icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
      opacity: 0.5;
      margin-bottom: 12px;
    }

    .sh-empty__text {
      font-size: 15px;
      color: var(--color-text-secondary);
      margin: 0 0 16px;
    }

    .sh-empty__reset {
      background: none;
      border: 1.5px solid var(--color-border);
      border-radius: 10px;
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text);
      cursor: pointer;
      font-family: var(--font-sans);
      transition: border-color 0.15s, background 0.15s;
    }

    .sh-empty__reset:hover {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
    }

    /* ─── Responsive ─────────────────────────────────── */
    @media (max-width: 768px) {
      .sh-hero {
        padding: 28px 16px 20px;
      }

      .sh-hero__content {
        gap: 14px;
      }

      .sh-hero__icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 12px;
      }

      .sh-hero__icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .sh-hero__title {
        font-size: 22px;
      }

      .sh-hero__subtitle {
        font-size: 13px;
      }

      .sh-hero__search {
        max-width: 100%;
      }

      .sh-body {
        padding: 0 16px 32px;
      }

      .sh-section__grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .sh-card {
        padding: 14px 14px;
        border-radius: 12px;
      }

      .sh-card__icon-wrap {
        width: 38px;
        height: 38px;
        border-radius: 10px;
      }

      .sh-card__arrow {
        opacity: 0.4;
        transform: translateX(0);
      }
    }

    @media (min-width: 769px) and (max-width: 1024px) {
      .sh-hero {
        padding: 32px 24px 24px;
      }

      .sh-body {
        padding: 0 24px 40px;
      }

      .sh-section__grid {
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      }
    }

    /* ─── Reduced motion ─────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .sh-hero__mesh {
        animation: none;
      }
      .sh-hero__icon-wrap {
        animation: none;
      }
      .sh-section,
      .sh-card,
      .sh-empty {
        animation: none;
        opacity: 1;
      }
    }
  `],
})
export class SettingsHubComponent {
  private readonly authStore = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);

  readonly searchQuery = signal('');

  readonly sections: SettingsSection[] = [
    {
      titleKey: 'settings.sections.organization',
      theme: 'orange',
      items: [
        {
          icon: 'shield',
          labelKey: 'settings.items.roles',
          descriptionKey: 'settings.items.rolesDesc',
          route: '/settings/roles',
          adminOnly: true,
        },
        {
          icon: 'groups',
          labelKey: 'settings.items.teams',
          descriptionKey: 'settings.items.teamsDesc',
          route: '/settings/teams',
          adminOnly: true,
        },
        {
          icon: 'tune',
          labelKey: 'settings.items.customFields',
          descriptionKey: 'settings.items.customFieldsDesc',
          route: '/settings/custom-fields',
          adminOnly: true,
        },
        {
          icon: 'linear_scale',
          labelKey: 'settings.items.pipelines',
          descriptionKey: 'settings.items.pipelinesDesc',
          route: '/settings/pipelines',
          adminOnly: true,
        },
        {
          icon: 'compare_arrows',
          labelKey: 'settings.items.duplicateDetection',
          descriptionKey: 'settings.items.duplicateDetectionDesc',
          route: '/settings/duplicate-rules',
          adminOnly: true,
        },
        {
          icon: 'webhook',
          labelKey: 'settings.items.webhooks',
          descriptionKey: 'settings.items.webhooksDesc',
          route: '/settings/webhooks',
          adminOnly: true,
        },
        {
          icon: 'language',
          labelKey: 'settings.language.title',
          descriptionKey: 'settings.language.description',
          route: '/settings/language',
          adminOnly: true,
        },
        {
          icon: 'hub',
          labelKey: 'settings.items.integrations',
          descriptionKey: 'settings.items.integrationsDesc',
          route: '/settings/integrations',
          adminOnly: false,
        },
      ],
    },
    {
      titleKey: 'settings.sections.dataOperations',
      theme: 'blue',
      items: [
        {
          icon: 'upload_file',
          labelKey: 'settings.items.importData',
          descriptionKey: 'settings.items.importDataDesc',
          route: '/import',
        },
        {
          icon: 'history',
          labelKey: 'settings.items.importHistory',
          descriptionKey: 'settings.items.importHistoryDesc',
          route: '/import/history',
        },
      ],
    },
    {
      titleKey: 'settings.sections.personal',
      theme: 'violet',
      items: [
        {
          icon: 'mail',
          labelKey: 'settings.items.emailAccounts',
          descriptionKey: 'settings.items.emailAccountsDesc',
          route: '/settings/email-accounts',
        },
        {
          icon: 'notifications_active',
          labelKey: 'settings.items.notifications',
          descriptionKey: 'settings.items.notificationsDesc',
          route: '/settings/notification-preferences',
        },
      ],
    },
  ];

  readonly filteredSections = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) {
      return this.sections
        .map(s => ({ ...s, items: s.items.filter(i => !i.adminOnly || this.isAdmin()) }))
        .filter(s => s.items.length > 0);
    }

    return this.sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (item.adminOnly && !this.isAdmin()) return false;
          const label = this.transloco.translate(item.labelKey).toLowerCase();
          const desc = this.transloco.translate(item.descriptionKey).toLowerCase();
          return label.includes(q) || desc.includes(q);
        }),
      }))
      .filter(s => s.items.length > 0);
  });

  visibleItems(section: SettingsSection): SettingsItem[] {
    return section.items;
  }

  visibleItemCount(section: SettingsSection): number {
    return section.items.length;
  }

  isAdmin(): boolean {
    return this.authStore.userRole() === 'Admin';
  }
}
