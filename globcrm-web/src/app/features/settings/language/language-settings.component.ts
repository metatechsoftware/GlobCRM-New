import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/api/api.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

interface LanguageOption {
  value: string;
  label: string;
  nativeLabel: string;
}

@Component({
  selector: 'app-language-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslocoPipe,
  ],
  template: `
    <div class="lang-settings">
      <div class="lang-settings__header">
        <a routerLink="/settings" class="lang-settings__back">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div class="lang-settings__icon-wrap">
          <mat-icon>language</mat-icon>
        </div>
        <div>
          <h1 class="lang-settings__title">{{ 'language.title' | transloco }}</h1>
          <p class="lang-settings__subtitle">{{ 'language.description' | transloco }}</p>
        </div>
      </div>

      <div class="lang-settings__card">
        <h2 class="lang-settings__card-title">{{ 'language.cardTitle' | transloco }}</h2>
        <p class="lang-settings__card-desc">
          {{ 'language.cardDesc' | transloco }}
        </p>

        <mat-form-field appearance="outline" class="lang-settings__select">
          <mat-label>{{ 'language.defaultLanguage' | transloco }}</mat-label>
          <mat-select
            [ngModel]="selectedLanguage()"
            (ngModelChange)="onLanguageChange($event)"
            [disabled]="saving()"
          >
            @for (lang of languages; track lang.value) {
              <mat-option [value]="lang.value">
                {{ lang.label }} ({{ lang.nativeLabel }})
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </div>
  `,
  styles: [`
    .lang-settings {
      max-width: 640px;
      padding: 32px;
    }

    .lang-settings__header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
    }

    .lang-settings__back {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      color: var(--color-text-secondary);
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }

    .lang-settings__back:hover {
      background: var(--color-surface-hover);
      color: var(--color-text);
    }

    .lang-settings__icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }

    .lang-settings__icon-wrap mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .lang-settings__title {
      font-size: 22px;
      font-weight: 700;
      margin: 0;
      color: var(--color-text);
    }

    .lang-settings__subtitle {
      font-size: 14px;
      color: var(--color-text-secondary);
      margin: 2px 0 0;
    }

    .lang-settings__card {
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: 16px;
      padding: 24px;
    }

    .lang-settings__card-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 8px;
      color: var(--color-text);
    }

    .lang-settings__card-desc {
      font-size: 13px;
      color: var(--color-text-muted);
      margin: 0 0 20px;
      line-height: 1.5;
    }

    .lang-settings__select {
      width: 100%;
      max-width: 320px;
    }
  `],
})
export class LanguageSettingsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  readonly selectedLanguage = signal('en');
  readonly saving = signal(false);

  readonly languages: LanguageOption[] = [
    { value: 'en', label: 'English', nativeLabel: 'English' },
    { value: 'tr', label: 'Turkish', nativeLabel: 'T\u00fcrk\u00e7e' },
  ];

  ngOnInit(): void {
    this.loadDefaultLanguage();
  }

  onLanguageChange(lang: string): void {
    this.saving.set(true);
    this.api.put<{ defaultLanguage: string }>('/api/organizations/settings/language', { language: lang })
      .subscribe({
        next: () => {
          this.selectedLanguage.set(lang);
          this.saving.set(false);
          this.snackBar.open(this.transloco.translate('settings.language.saveSuccess'), 'OK', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
        },
        error: (err) => {
          this.saving.set(false);
          this.snackBar.open(err.message || this.transloco.translate('settings.language.saveFailed'), 'OK', {
            duration: 5000,
          });
        },
      });
  }

  private loadDefaultLanguage(): void {
    this.api.get<{ defaultLanguage: string }>('/api/organizations/default-language')
      .subscribe({
        next: (res) => {
          this.selectedLanguage.set(res.defaultLanguage || 'en');
        },
        error: () => {
          // Fallback to 'en' if load fails
          this.selectedLanguage.set('en');
        },
      });
  }
}
