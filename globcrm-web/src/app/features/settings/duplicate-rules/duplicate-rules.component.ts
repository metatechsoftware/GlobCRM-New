import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { DuplicateService } from '../../duplicates/duplicate.service';
import { DuplicateSettings } from '../../duplicates/duplicate.models';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

/** Local editable state per entity type */
interface EntityRuleConfig {
  entityType: string;
  autoDetectionEnabled: boolean;
  similarityThreshold: number;
  matchingFields: string[];
  saving: boolean;
}

/**
 * Admin page for configuring duplicate detection matching rules.
 * Allows toggling auto-detection, adjusting similarity threshold,
 * and selecting which fields participate in matching per entity type.
 */
@Component({
  selector: 'app-duplicate-rules',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatSnackBarModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* ---- Keyframes ----------------------------------------- */
    @keyframes drFadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes drSectionEntrance {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ---- Host ---------------------------------------------- */
    :host {
      display: block;
    }

    /* ---- Container ----------------------------------------- */
    .dr-container {
      max-width: 900px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-6);
    }

    /* ---- Breadcrumb ---------------------------------------- */
    .dr-breadcrumb {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
      text-decoration: none;
      margin-bottom: var(--space-5);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-md);
      transition: color var(--duration-normal) var(--ease-default),
                  background var(--duration-normal) var(--ease-default);
      opacity: 0;
      animation: drFadeSlideUp var(--duration-slow) var(--ease-out) forwards;
    }

    .dr-breadcrumb:hover {
      color: var(--color-primary);
      background: var(--color-primary-soft);
    }

    .dr-breadcrumb mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* ---- Header -------------------------------------------- */
    .dr-header {
      display: flex;
      align-items: center;
      gap: var(--space-5);
      margin-bottom: var(--space-8);
      opacity: 0;
      animation: drFadeSlideUp var(--duration-slower) var(--ease-out) 60ms forwards;
    }

    .dr-header__icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-xl);
      background: linear-gradient(135deg, var(--color-info) 0%, var(--color-info-text) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow:
        0 4px 16px rgba(96, 165, 250, 0.25),
        0 0 0 4px rgba(96, 165, 250, 0.08);
    }

    .dr-header__icon-wrap mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #fff;
    }

    .dr-header__text {
      flex: 1;
      min-width: 0;
    }

    .dr-header__title {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.5px;
      margin: 0;
      color: var(--color-text);
      line-height: var(--leading-tight);
    }

    .dr-header__subtitle {
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      margin: var(--space-1) 0 0;
      line-height: var(--leading-normal);
    }

    /* ---- Loading ------------------------------------------- */
    .dr-loading {
      display: flex;
      justify-content: center;
      padding: var(--space-16);
    }

    /* ---- Section Card -------------------------------------- */
    .dr-section {
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      padding: var(--space-6);
      margin-bottom: var(--space-5);
      opacity: 0;
      animation: drSectionEntrance var(--duration-slower) var(--ease-out) both;
    }

    .dr-section__header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-6);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .dr-section__icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .dr-section__icon-wrap--contact {
      background: var(--color-primary-soft);
    }

    .dr-section__icon-wrap--contact mat-icon {
      color: var(--color-primary);
    }

    .dr-section__icon-wrap--company {
      background: var(--color-info-soft);
    }

    .dr-section__icon-wrap--company mat-icon {
      color: var(--color-info);
    }

    .dr-section__icon-wrap mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .dr-section__title {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      margin: 0;
      color: var(--color-text);
    }

    /* ---- Rule Block ---------------------------------------- */
    .dr-rule {
      margin-bottom: var(--space-6);
    }

    .dr-rule:last-of-type {
      margin-bottom: 0;
    }

    .dr-rule__label {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      margin: 0 0 var(--space-1) 0;
      color: var(--color-text);
    }

    .dr-rule__helper {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: var(--space-1) 0 0 0;
      line-height: var(--leading-normal);
    }

    /* ---- Toggle Row ---------------------------------------- */
    .dr-toggle {
      display: flex;
      align-items: flex-start;
      gap: var(--space-4);
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      background: var(--color-bg);
      border: 1px solid var(--color-border-subtle);
      transition: border-color var(--duration-normal) var(--ease-default),
                  background var(--duration-normal) var(--ease-default);
    }

    .dr-toggle:hover {
      border-color: var(--color-border);
    }

    .dr-toggle__content {
      flex: 1;
      padding-top: var(--space-0-5);
    }

    /* ---- Threshold ----------------------------------------- */
    .dr-threshold {
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      background: var(--color-bg);
      border: 1px solid var(--color-border-subtle);
    }

    .dr-threshold__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .dr-threshold__value {
      font-weight: var(--font-bold);
      font-size: var(--text-md);
      color: var(--color-text);
    }

    .dr-threshold__badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      padding: var(--space-0-5) var(--space-2);
      border-radius: var(--radius-full);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .dr-threshold__badge--strict {
      background: var(--color-success-soft);
      color: var(--color-success-text);
    }

    .dr-threshold__badge--moderate {
      background: var(--color-warning-soft);
      color: var(--color-warning-text);
    }

    .dr-threshold__badge--permissive {
      background: var(--color-danger-soft);
      color: var(--color-danger-text);
    }

    .dr-threshold__slider-wrap {
      position: relative;
      margin-bottom: var(--space-2);
    }

    .dr-threshold__track {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 6px;
      border-radius: var(--radius-full);
      transform: translateY(-50%);
      background: linear-gradient(
        90deg,
        var(--color-danger) 0%,
        var(--color-warning) 40%,
        var(--color-success) 100%
      );
      opacity: 0.2;
      pointer-events: none;
      z-index: 0;
    }

    .dr-threshold__slider {
      width: 100%;
      position: relative;
      z-index: 1;
    }

    /* ---- Fields -------------------------------------------- */
    .dr-fields {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .dr-field-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      transition: border-color var(--duration-normal) var(--ease-default),
                  box-shadow var(--duration-normal) var(--ease-default);
    }

    .dr-field-card:hover {
      border-color: var(--color-border-strong);
    }

    .dr-field-card--active {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.08);
    }

    .dr-field-card--disabled {
      opacity: 0.7;
      background: var(--color-bg);
    }

    .dr-field-card__icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: var(--color-bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .dr-field-card__icon-wrap mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-secondary);
    }

    .dr-field-card--active .dr-field-card__icon-wrap {
      background: var(--color-primary-soft);
    }

    .dr-field-card--active .dr-field-card__icon-wrap mat-icon {
      color: var(--color-primary);
    }

    .dr-field-card__body {
      flex: 1;
      min-width: 0;
    }

    .dr-field-card__name {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0;
    }

    .dr-field-card__desc {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: var(--space-0-5) 0 0;
    }

    .dr-field-card__required {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      background: var(--color-bg-secondary);
      padding: var(--space-0-5) var(--space-2);
      border-radius: var(--radius-full);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* ---- Actions ------------------------------------------- */
    .dr-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: var(--space-5);
      margin-top: var(--space-6);
      border-top: 1px solid var(--color-border-subtle);
    }

    .dr-actions button {
      min-width: 160px;
    }

    .dr-actions mat-spinner {
      display: inline-block;
      margin-right: var(--space-2);
      vertical-align: middle;
    }

    /* ---- Responsive ---------------------------------------- */
    @media (max-width: 768px) {
      .dr-container {
        padding: var(--space-5) var(--space-4);
      }

      .dr-header {
        gap: var(--space-3);
      }

      .dr-header__icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-lg);
      }

      .dr-header__icon-wrap mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .dr-header__title {
        font-size: var(--text-xl);
      }

      .dr-header__subtitle {
        font-size: var(--text-sm);
      }

      .dr-section {
        padding: var(--space-4);
        border-radius: var(--radius-lg);
      }

      .dr-section__header {
        padding-bottom: var(--space-3);
        margin-bottom: var(--space-4);
      }

      .dr-toggle {
        flex-direction: column;
        gap: var(--space-2);
      }

      .dr-field-card {
        padding: var(--space-2) var(--space-3);
      }

      .dr-actions {
        justify-content: stretch;
      }

      .dr-actions button {
        width: 100%;
      }
    }

    /* ---- Reduced Motion ------------------------------------ */
    @media (prefers-reduced-motion: reduce) {
      .dr-breadcrumb,
      .dr-header,
      .dr-section {
        animation: none;
        opacity: 1;
      }
    }
  `,
  template: `
    <div class="dr-container">
      <!-- Breadcrumb -->
      <a routerLink="/settings" class="dr-breadcrumb">
        <mat-icon>arrow_back</mat-icon>
        <span>{{ 'settings.duplicateRules.breadcrumb' | transloco }}</span>
      </a>

      <!-- Header -->
      <div class="dr-header">
        <div class="dr-header__icon-wrap">
          <mat-icon>compare_arrows</mat-icon>
        </div>
        <div class="dr-header__text">
          <h1 class="dr-header__title">{{ 'settings.duplicateRules.pageTitle' | transloco }}</h1>
          <p class="dr-header__subtitle">{{ 'settings.duplicateRules.pageSubtitle' | transloco }}</p>
        </div>
      </div>

      @if (isLoading()) {
        <div class="dr-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        @for (config of configs(); track config.entityType; let i = $index) {
          <div class="dr-section"
               [style.animation-delay]="(i * 120 + 150) + 'ms'">
            <!-- Section Header -->
            <div class="dr-section__header">
              <div class="dr-section__icon-wrap"
                   [class.dr-section__icon-wrap--contact]="config.entityType === 'Contact'"
                   [class.dr-section__icon-wrap--company]="config.entityType !== 'Contact'">
                <mat-icon>{{ config.entityType === 'Contact' ? 'person' : 'business' }}</mat-icon>
              </div>
              <h2 class="dr-section__title">
                {{ config.entityType === 'Contact' ? ('settings.duplicateRules.contactMatchingRules' | transloco) : ('settings.duplicateRules.companyMatchingRules' | transloco) }}
              </h2>
            </div>

            <!-- Auto-detection toggle -->
            <div class="dr-rule">
              <div class="dr-toggle">
                <mat-slide-toggle
                  [checked]="config.autoDetectionEnabled"
                  (change)="config.autoDetectionEnabled = $event.checked">
                </mat-slide-toggle>
                <div class="dr-toggle__content">
                  <div class="dr-rule__label">{{ 'settings.duplicateRules.enableAutoDetection' | transloco }}</div>
                  <p class="dr-rule__helper">
                    {{ 'settings.duplicateRules.autoDetectionHint' | transloco }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Similarity threshold slider -->
            <div class="dr-rule">
              <div class="dr-threshold">
                <div class="dr-threshold__header">
                  <span class="dr-rule__label">{{ 'settings.duplicateRules.similarityThreshold' | transloco }}</span>
                  <span class="dr-threshold__value">{{ config.similarityThreshold }}%</span>
                  <span class="dr-threshold__badge"
                        [class.dr-threshold__badge--strict]="config.similarityThreshold > 85"
                        [class.dr-threshold__badge--moderate]="config.similarityThreshold >= 70 && config.similarityThreshold <= 85"
                        [class.dr-threshold__badge--permissive]="config.similarityThreshold < 70">
                    {{ config.similarityThreshold > 85 ? ('settings.duplicateRules.strict' | transloco) : (config.similarityThreshold >= 70 ? ('settings.duplicateRules.moderate' | transloco) : ('settings.duplicateRules.permissive' | transloco)) }}
                  </span>
                </div>
                <div class="dr-threshold__slider-wrap">
                  <div class="dr-threshold__track"></div>
                  <mat-slider
                    class="dr-threshold__slider"
                    [min]="50"
                    [max]="100"
                    [step]="5"
                    [discrete]="true"
                    [showTickMarks]="true">
                    <input matSliderThumb
                           [value]="config.similarityThreshold"
                           (valueChange)="config.similarityThreshold = $event">
                  </mat-slider>
                </div>
                <p class="dr-rule__helper">
                  {{ 'settings.duplicateRules.thresholdHint' | transloco }}
                </p>
              </div>
            </div>

            <!-- Matching fields -->
            <div class="dr-rule">
              <div class="dr-rule__label">{{ 'settings.duplicateRules.matchingFieldsLabel' | transloco }}</div>
              <p class="dr-rule__helper" style="margin-bottom: var(--space-3)">
                {{ 'settings.duplicateRules.matchingFieldsHint' | transloco }}
              </p>
              <div class="dr-fields">
                @if (config.entityType === 'Contact') {
                  <div class="dr-field-card dr-field-card--active dr-field-card--disabled">
                    <div class="dr-field-card__icon-wrap">
                      <mat-icon>badge</mat-icon>
                    </div>
                    <div class="dr-field-card__body">
                      <div class="dr-field-card__name">{{ 'settings.duplicateRules.fieldName' | transloco }}</div>
                      <div class="dr-field-card__desc">{{ 'settings.duplicateRules.fieldNameDesc' | transloco }}</div>
                    </div>
                    <span class="dr-field-card__required">{{ 'settings.duplicateRules.required' | transloco }}</span>
                  </div>
                  <label class="dr-field-card"
                         [class.dr-field-card--active]="isFieldEnabled(config, 'email')">
                    <div class="dr-field-card__icon-wrap">
                      <mat-icon>email</mat-icon>
                    </div>
                    <div class="dr-field-card__body">
                      <div class="dr-field-card__name">{{ 'settings.duplicateRules.fieldEmail' | transloco }}</div>
                      <div class="dr-field-card__desc">{{ 'settings.duplicateRules.fieldEmailDesc' | transloco }}</div>
                    </div>
                    <mat-checkbox
                      [checked]="isFieldEnabled(config, 'email')"
                      (change)="toggleField(config, 'email', $event.checked)">
                    </mat-checkbox>
                  </label>
                } @else {
                  <div class="dr-field-card dr-field-card--active dr-field-card--disabled">
                    <div class="dr-field-card__icon-wrap">
                      <mat-icon>business</mat-icon>
                    </div>
                    <div class="dr-field-card__body">
                      <div class="dr-field-card__name">{{ 'settings.duplicateRules.fieldCompanyName' | transloco }}</div>
                      <div class="dr-field-card__desc">{{ 'settings.duplicateRules.fieldCompanyNameDesc' | transloco }}</div>
                    </div>
                    <span class="dr-field-card__required">{{ 'settings.duplicateRules.required' | transloco }}</span>
                  </div>
                  <label class="dr-field-card"
                         [class.dr-field-card--active]="isFieldEnabled(config, 'website')">
                    <div class="dr-field-card__icon-wrap">
                      <mat-icon>language</mat-icon>
                    </div>
                    <div class="dr-field-card__body">
                      <div class="dr-field-card__name">{{ 'settings.duplicateRules.fieldWebsite' | transloco }}</div>
                      <div class="dr-field-card__desc">{{ 'settings.duplicateRules.fieldWebsiteDesc' | transloco }}</div>
                    </div>
                    <mat-checkbox
                      [checked]="isFieldEnabled(config, 'website')"
                      (change)="toggleField(config, 'website', $event.checked)">
                    </mat-checkbox>
                  </label>
                }
              </div>
            </div>

            <!-- Save action -->
            <div class="dr-actions">
              <button mat-raised-button color="primary"
                      [disabled]="config.saving"
                      (click)="saveConfig(config)">
                @if (config.saving) {
                  <mat-spinner diameter="20"></mat-spinner>
                }
                {{ 'settings.duplicateRules.saveRules' | transloco: { entity: config.entityType } }}
              </button>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class DuplicateRulesComponent implements OnInit {
  private readonly duplicateService = inject(DuplicateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  isLoading = signal(true);
  configs = signal<EntityRuleConfig[]>([]);

  ngOnInit(): void {
    this.loadSettings();
  }

  private loadSettings(): void {
    this.isLoading.set(true);
    this.duplicateService.getSettings().subscribe({
      next: (settings: DuplicateSettings[]) => {
        const configs: EntityRuleConfig[] = settings.map((s) => ({
          entityType: s.entityType,
          autoDetectionEnabled: s.autoDetectionEnabled,
          similarityThreshold: s.similarityThreshold,
          matchingFields: [...s.matchingFields],
          saving: false,
        }));
        this.configs.set(configs);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open(this.transloco.translate('settings.duplicateRules.loadFailed'), 'Close', {
          duration: 5000,
        });
      },
    });
  }

  isFieldEnabled(config: EntityRuleConfig, field: string): boolean {
    return config.matchingFields.includes(field);
  }

  toggleField(config: EntityRuleConfig, field: string, enabled: boolean): void {
    if (enabled) {
      if (!config.matchingFields.includes(field)) {
        config.matchingFields = [...config.matchingFields, field];
      }
    } else {
      config.matchingFields = config.matchingFields.filter((f) => f !== field);
    }
  }

  saveConfig(config: EntityRuleConfig): void {
    config.saving = true;
    // Force signal update for change detection
    this.configs.update((configs) => [...configs]);

    this.duplicateService
      .updateSettings(config.entityType, {
        autoDetectionEnabled: config.autoDetectionEnabled,
        similarityThreshold: config.similarityThreshold,
        matchingFields: config.matchingFields,
      })
      .subscribe({
        next: () => {
          config.saving = false;
          this.configs.update((configs) => [...configs]);
          this.snackBar.open(this.transloco.translate('settings.duplicateRules.settingsUpdated'), 'Close', {
            duration: 3000,
          });
        },
        error: () => {
          config.saving = false;
          this.configs.update((configs) => [...configs]);
          this.snackBar.open(this.transloco.translate('settings.duplicateRules.settingsFailed'), 'Close', {
            duration: 5000,
          });
        },
      });
  }
}
