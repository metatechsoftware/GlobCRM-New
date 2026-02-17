import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImportService } from '../import.service';
import { ImportJob, ImportEntityType } from '../import.models';

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
  ],
  template: `
    <div class="import-history">
      <!-- Header -->
      <div class="import-history__header">
        <div>
          <h1 class="import-history__title">Import History</h1>
          <p class="import-history__subtitle">View past import jobs and their results</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/import" class="import-history__new-btn">
          <mat-icon>upload_file</mat-icon>
          New Import
        </a>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="import-history__loading">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Loading import history...</span>
        </div>
      }

      <!-- Empty State -->
      @if (!loading() && jobs().length === 0) {
        <div class="import-history__empty">
          <mat-icon class="import-history__empty-icon">cloud_upload</mat-icon>
          <h3>No imports yet</h3>
          <p>Import your first CSV file.</p>
          <a mat-flat-button color="primary" routerLink="/import">
            <mat-icon>upload_file</mat-icon>
            Import Data
          </a>
        </div>
      }

      <!-- Jobs Table -->
      @if (!loading() && jobs().length > 0) {
        <div class="import-history__table-wrapper">
          <table class="import-history__table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Entity Type</th>
                <th>Status</th>
                <th class="text-right">Rows</th>
                <th class="text-right">Success</th>
                <th class="text-right">Errors</th>
                <th>Date</th>
                <th>Actions</th>
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
                        {{ expandedJobId() === job.id ? 'Hide' : 'View' }} Details
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
                          Import Errors ({{ job.errors.length }})
                        </h4>
                        <table class="import-history__errors-table">
                          <thead>
                            <tr>
                              <th>Row</th>
                              <th>Field</th>
                              <th>Error</th>
                              <th>Value</th>
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
              Load More
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .import-history {
      padding: 24px 32px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .import-history__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .import-history__title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: var(--text-primary, #1e293b);
    }

    .import-history__subtitle {
      font-size: 14px;
      color: var(--text-secondary, #64748b);
      margin: 0;
    }

    .import-history__new-btn mat-icon {
      margin-right: 8px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .import-history__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 64px 0;
      color: var(--text-secondary, #64748b);
    }

    .import-history__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 64px 0;
      text-align: center;
    }

    .import-history__empty-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--text-secondary, #94a3b8);
    }

    .import-history__empty h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      color: var(--text-primary, #1e293b);
    }

    .import-history__empty p {
      font-size: 14px;
      color: var(--text-secondary, #64748b);
      margin: 0;
    }

    .import-history__table-wrapper {
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      overflow: hidden;
    }

    .import-history__table {
      width: 100%;
      border-collapse: collapse;
    }

    .import-history__table thead th {
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary, #64748b);
      background: var(--bg-secondary, #f8fafc);
      border-bottom: 1px solid var(--border-color, #e2e8f0);
      text-align: left;
    }

    .import-history__table tbody td {
      padding: 12px 16px;
      font-size: 14px;
      color: var(--text-primary, #334155);
      border-bottom: 1px solid var(--border-color, #f1f5f9);
      vertical-align: middle;
    }

    .import-history__row:hover {
      background: var(--bg-hover, #f8fafc);
    }

    .text-right {
      text-align: right;
    }

    .import-history__filename {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .import-history__file-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--text-secondary, #94a3b8);
    }

    .import-history__entity-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--bg-secondary, #f1f5f9);
      font-size: 13px;
      font-weight: 500;
    }

    .import-history__entity-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .import-history__status {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .import-history__status--completed {
      background: #dcfce7;
      color: #166534;
    }

    .import-history__status--processing {
      background: #dbeafe;
      color: #1e40af;
    }

    .import-history__status--pending,
    .import-history__status--mapping,
    .import-history__status--previewing {
      background: #f1f5f9;
      color: #475569;
    }

    .import-history__status--failed {
      background: #fee2e2;
      color: #991b1b;
    }

    .import-history__success {
      color: #16a34a;
      font-weight: 600;
    }

    .import-history__error-count {
      color: #dc2626;
      font-weight: 600;
    }

    .import-history__no-errors {
      color: var(--text-secondary, #94a3b8);
    }

    .import-history__details-btn {
      font-size: 13px;
    }

    .import-history__error-row td {
      padding: 0 !important;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
    }

    .import-history__errors {
      padding: 16px 24px;
      background: #fef2f2;
    }

    .import-history__errors-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #991b1b;
      margin: 0 0 12px 0;
    }

    .import-history__errors-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .import-history__errors-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 6px;
      overflow: hidden;
    }

    .import-history__errors-table thead th {
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-secondary, #64748b);
      background: var(--bg-secondary, #f8fafc);
      text-align: left;
    }

    .import-history__errors-table tbody td {
      padding: 8px 12px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }

    .import-history__raw-value {
      font-family: monospace;
      font-size: 12px;
      color: var(--text-secondary, #64748b);
    }

    .import-history__load-more {
      display: flex;
      justify-content: center;
      padding: 16px 0;
    }
  `],
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
