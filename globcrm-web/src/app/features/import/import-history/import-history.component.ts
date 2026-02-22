import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImportService } from '../import.service';
import { ImportJob, ImportEntityType } from '../import.models';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-import-history',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    DatePipe,
    TranslocoPipe,
  ],
  styleUrl: './import-history.component.scss',
  template: `
    <div class="import-history">
      <!-- Hero Header -->
      <div class="import-history__hero">
        <div class="import-history__mesh"></div>
        <div class="import-history__hero-content">
          <div class="import-history__header-left">
            <a routerLink="/settings" class="import-history__back">
              <mat-icon>arrow_back</mat-icon>
              <span>{{ 'import.history.backToSettings' | transloco }}</span>
            </a>
            <div class="import-history__heading">
              <div class="import-history__icon-wrap">
                <mat-icon>history</mat-icon>
              </div>
              <div>
                <h1 class="import-history__title">{{ 'import.history.title' | transloco }}</h1>
                <p class="import-history__subtitle">{{ 'import.history.subtitle' | transloco }}</p>
              </div>
            </div>
          </div>
          <a mat-flat-button color="primary" routerLink="/import" class="import-history__new-btn">
            <mat-icon>upload_file</mat-icon>
            {{ 'import.history.newImport' | transloco }}
          </a>
        </div>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="import-history__loading">
          <mat-spinner diameter="40"></mat-spinner>
          <span>{{ 'import.history.loading' | transloco }}</span>
        </div>
      }

      <!-- Empty State -->
      @if (!loading() && jobs().length === 0) {
        <div class="import-history__empty">
          <div class="import-history__empty-icon-wrapper">
            <mat-icon class="import-history__empty-icon">cloud_upload</mat-icon>
          </div>
          <h3>{{ 'import.history.noImports' | transloco }}</h3>
          <p>{{ 'import.history.noImportsDesc' | transloco }}</p>
          <a mat-flat-button color="primary" routerLink="/import">
            <mat-icon>upload_file</mat-icon>
            {{ 'import.wizard.title' | transloco }}
          </a>
        </div>
      }

      <!-- Jobs Table -->
      @if (!loading() && jobs().length > 0) {
        <div class="import-history__table-wrapper">
          <table class="import-history__table">
            <thead>
              <tr>
                <th>{{ 'import.history.fileName' | transloco }}</th>
                <th>{{ 'import.history.entityType' | transloco }}</th>
                <th>{{ 'import.history.status' | transloco }}</th>
                <th class="text-right">{{ 'import.history.rows' | transloco }}</th>
                <th class="text-right">{{ 'import.history.success' | transloco }}</th>
                <th class="text-right">{{ 'import.history.errors' | transloco }}</th>
                <th>{{ 'import.history.date' | transloco }}</th>
                <th>{{ 'import.history.actions' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (job of jobs(); track job.id) {
                <tr class="import-history__row">
                  <td class="import-history__filename">
                    <mat-icon class="import-history__file-icon">description</mat-icon>
                    {{ job.originalFileName }}
                  </td>
                  <td>
                    <span class="import-history__entity-badge">
                      <mat-icon class="import-history__entity-icon">{{ getEntityIcon(job.entityType) }}</mat-icon>
                      {{ job.entityType }}
                    </span>
                  </td>
                  <td>
                    <span class="import-history__status" [class]="'import-history__status--' + job.status.toLowerCase()">
                      {{ job.status }}
                    </span>
                  </td>
                  <td class="text-right">{{ job.totalRows }}</td>
                  <td class="text-right import-history__success">{{ job.successCount }}</td>
                  <td class="text-right">
                    @if (job.errorCount > 0) {
                      <span class="import-history__error-count">{{ job.errorCount }}</span>
                    } @else {
                      <span class="import-history__no-errors">0</span>
                    }
                  </td>
                  <td>{{ job.createdAt | date:'MMM d, yyyy h:mm a' }}</td>
                  <td>
                    @if (job.errors && job.errors.length > 0) {
                      <button mat-button color="warn" (click)="toggleErrors(job.id)"
                              class="import-history__details-btn">
                        <mat-icon>{{ expandedJobId() === job.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                        {{ expandedJobId() === job.id ? ('import.history.hideDetails' | transloco) : ('import.history.viewDetails' | transloco) }}
                      </button>
                    }
                  </td>
                </tr>

                <!-- Expandable Error Details -->
                @if (expandedJobId() === job.id && job.errors && job.errors.length > 0) {
                  <tr class="import-history__error-row">
                    <td colspan="8">
                      <div class="import-history__errors">
                        <h4 class="import-history__errors-title">
                          <mat-icon>error_outline</mat-icon>
                          {{ 'import.history.importErrors' | transloco }} ({{ job.errors.length }})
                        </h4>
                        <table class="import-history__errors-table">
                          <thead>
                            <tr>
                              <th>{{ 'import.history.row' | transloco }}</th>
                              <th>{{ 'import.history.field' | transloco }}</th>
                              <th>{{ 'import.history.error' | transloco }}</th>
                              <th>{{ 'import.history.value' | transloco }}</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (error of job.errors; track error.id) {
                              <tr>
                                <td>{{ error.rowNumber }}</td>
                                <td>{{ error.fieldName }}</td>
                                <td>{{ error.errorMessage }}</td>
                                <td class="import-history__raw-value">{{ error.rawValue || '-' }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Load More -->
        @if (hasMore()) {
          <div class="import-history__load-more">
            <button mat-stroked-button (click)="loadMore()">
              {{ 'import.history.loadMore' | transloco }}
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class ImportHistoryComponent implements OnInit {
  private readonly importService = inject(ImportService);

  readonly jobs = signal<ImportJob[]>([]);
  readonly loading = signal(true);
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly expandedJobId = signal<string | null>(null);
  readonly hasMore = signal(false);

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading.set(true);
    this.importService.getJobs(this.page(), this.pageSize).subscribe({
      next: (result) => {
        this.jobs.set(result);
        this.hasMore.set(result.length === this.pageSize);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    this.page.update((p) => p + 1);
    this.importService.getJobs(this.page(), this.pageSize).subscribe({
      next: (result) => {
        this.jobs.update((current) => [...current, ...result]);
        this.hasMore.set(result.length === this.pageSize);
      },
    });
  }

  toggleErrors(jobId: string): void {
    this.expandedJobId.update((current) => (current === jobId ? null : jobId));
  }

  getEntityIcon(entityType: ImportEntityType): string {
    switch (entityType) {
      case 'Company':
        return 'business';
      case 'Contact':
        return 'person';
      case 'Deal':
        return 'handshake';
      default:
        return 'description';
    }
  }
}
