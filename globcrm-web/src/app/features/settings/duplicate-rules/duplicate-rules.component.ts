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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .rules-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .rules-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .rules-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .rules-subtitle {
      color: var(--text-secondary, #64748b);
      font-size: 14px;
      margin: 0 0 24px 0;
      padding-left: 48px;
    }

    .rules-loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .rule-card {
      margin-bottom: 24px;
    }

    .rule-card mat-card-title {
      font-size: 18px;
      font-weight: 500;
    }

    .rule-section {
      margin-bottom: 24px;
    }

    .rule-section:last-child {
      margin-bottom: 0;
    }

    .rule-section-label {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
      color: var(--text-primary, #1e293b);
    }

    .rule-section-helper {
      font-size: 13px;
      color: var(--text-secondary, #64748b);
      margin: 4px 0 0 0;
    }

    .toggle-section {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .toggle-content {
      flex: 1;
    }

    .threshold-section {
      padding-top: 8px;
    }

    .threshold-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .threshold-value {
      font-weight: 600;
      font-size: 14px;
    }

    .threshold-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .threshold-indicator--strict {
      background-color: #4caf50;
    }

    .threshold-indicator--moderate {
      background-color: #ff9800;
    }

    .threshold-indicator--permissive {
      background-color: #f44336;
    }

    .threshold-slider {
      width: 100%;
    }

    .fields-section {
      padding-top: 8px;
    }

    .field-checkbox {
      display: block;
      margin-bottom: 8px;
    }

    .card-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 16px;
      border-top: 1px solid var(--border-color, #e2e8f0);
    }
  `,
  template: `
    <div class="rules-container">
      <div class="rules-header">
        <a mat-icon-button routerLink="/settings" aria-label="Back to settings">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>Duplicate Detection Rules</h1>
      </div>
      <p class="rules-subtitle">Configure how the system detects potential duplicate records</p>

      @if (isLoading()) {
        <div class="rules-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        @for (config of configs(); track config.entityType) {
          <mat-card class="rule-card">
            <mat-card-header>
              <mat-card-title>
                {{ config.entityType === 'Contact' ? 'Contact Matching Rules' : 'Company Matching Rules' }}
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <!-- Auto-detection toggle -->
              <div class="rule-section">
                <div class="toggle-section">
                  <mat-slide-toggle
                    [checked]="config.autoDetectionEnabled"
                    (change)="config.autoDetectionEnabled = $event.checked">
                  </mat-slide-toggle>
                  <div class="toggle-content">
                    <div class="rule-section-label">Enable auto-detection on create</div>
                    <p class="rule-section-helper">
                      When enabled, the system warns users about potential duplicates when creating new records
                    </p>
                  </div>
                </div>
              </div>

              <!-- Similarity threshold slider -->
              <div class="rule-section threshold-section">
                <div class="threshold-label">
                  <span class="rule-section-label">Similarity Threshold:</span>
                  <span class="threshold-value">{{ config.similarityThreshold }}%</span>
                  <span class="threshold-indicator"
                        [class.threshold-indicator--strict]="config.similarityThreshold > 85"
                        [class.threshold-indicator--moderate]="config.similarityThreshold >= 70 && config.similarityThreshold <= 85"
                        [class.threshold-indicator--permissive]="config.similarityThreshold < 70">
                  </span>
                </div>
                <mat-slider
                  class="threshold-slider"
                  [min]="50"
                  [max]="100"
                  [step]="5"
                  [discrete]="true"
                  [showTickMarks]="true">
                  <input matSliderThumb
                         [value]="config.similarityThreshold"
                         (valueChange)="config.similarityThreshold = $event">
                </mat-slider>
                <p class="rule-section-helper">
                  Records scoring above this threshold are flagged as potential duplicates
                </p>
              </div>

              <!-- Matching fields checkboxes -->
              <div class="rule-section fields-section">
                <div class="rule-section-label">Matching Fields</div>
                <p class="rule-section-helper" style="margin-bottom: 12px;">
                  Checked fields participate in duplicate matching
                </p>
                @if (config.entityType === 'Contact') {
                  <mat-checkbox
                    class="field-checkbox"
                    [checked]="true"
                    [disabled]="true">
                    Name (always required)
                  </mat-checkbox>
                  <mat-checkbox
                    class="field-checkbox"
                    [checked]="isFieldEnabled(config, 'email')"
                    (change)="toggleField(config, 'email', $event.checked)">
                    Email
                  </mat-checkbox>
                } @else {
                  <mat-checkbox
                    class="field-checkbox"
                    [checked]="true"
                    [disabled]="true">
                    Company Name (always required)
                  </mat-checkbox>
                  <mat-checkbox
                    class="field-checkbox"
                    [checked]="isFieldEnabled(config, 'website')"
                    (change)="toggleField(config, 'website', $event.checked)">
                    Website / Domain
                  </mat-checkbox>
                }
              </div>
            </mat-card-content>
            <mat-card-actions>
              <div class="card-actions">
                <button mat-raised-button color="primary"
                        [disabled]="config.saving"
                        (click)="saveConfig(config)">
                  @if (config.saving) {
                    <mat-spinner diameter="20"></mat-spinner>
                  }
                  Save {{ config.entityType }} Rules
                </button>
              </div>
            </mat-card-actions>
          </mat-card>
        }
      }
    </div>
  `,
})
export class DuplicateRulesComponent implements OnInit {
  private readonly duplicateService = inject(DuplicateService);
  private readonly snackBar = inject(MatSnackBar);

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
        this.snackBar.open('Failed to load duplicate detection settings', 'Close', {
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
          this.snackBar.open('Settings updated', 'Close', {
            duration: 3000,
          });
        },
        error: () => {
          config.saving = false;
          this.configs.update((configs) => [...configs]);
          this.snackBar.open('Failed to save settings', 'Close', {
            duration: 5000,
          });
        },
      });
  }
}
