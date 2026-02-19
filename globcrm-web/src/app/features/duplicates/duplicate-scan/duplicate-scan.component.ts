import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DuplicateService } from '../duplicate.service';
import {
  DuplicatePair,
  ContactDuplicateMatch,
  CompanyDuplicateMatch,
} from '../duplicate.models';

@Component({
  selector: 'app-duplicate-scan',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .scan-content {
      padding: var(--space-6);
    }

    .scan-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-6);
    }

    .scan-header__title h1 {
      margin: 0;
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--color-text);
      letter-spacing: -0.3px;
    }

    .scan-header__subtitle {
      margin-top: var(--space-1);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .scan-controls {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .scan-btn {
      height: 40px;
    }

    /* Results */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-12) var(--space-6);
      text-align: center;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--color-success);
      margin-bottom: var(--space-4);
    }

    .empty-state h3 {
      margin: 0 0 var(--space-2);
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .empty-state p {
      margin: 0;
      color: var(--color-text-muted);
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-12);
      gap: var(--space-4);
    }

    .loading-state p {
      color: var(--color-text-muted);
    }

    .initial-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-12) var(--space-6);
      text-align: center;
    }

    .initial-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--color-text-muted);
      margin-bottom: var(--space-4);
    }

    .initial-state h3 {
      margin: 0 0 var(--space-2);
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .initial-state p {
      margin: 0;
      color: var(--color-text-muted);
    }

    /* Pair cards */
    .pair-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .pair-card {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      transition: box-shadow 0.15s ease;
    }

    .pair-card:hover {
      box-shadow: var(--shadow-sm);
    }

    .record-info {
      min-width: 0;
    }

    .record-info__name {
      font-weight: var(--font-semibold);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .record-info__detail {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .score-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 72px;
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      white-space: nowrap;
    }

    .score-badge--high {
      background: color-mix(in srgb, var(--color-success) 15%, transparent);
      color: var(--color-success);
    }

    .score-badge--medium {
      background: color-mix(in srgb, var(--color-warning) 15%, transparent);
      color: var(--color-warning);
    }

    .score-badge--low {
      background: color-mix(in srgb, var(--color-error) 15%, transparent);
      color: var(--color-error);
    }

    .pair-actions {
      display: flex;
      gap: var(--space-2);
    }

    .result-count {
      margin-bottom: var(--space-4);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    @media (max-width: 768px) {
      .scan-content {
        padding: var(--space-4);
      }

      .scan-header {
        flex-direction: column;
        gap: var(--space-3);
      }

      .scan-controls {
        flex-direction: column;
        align-items: stretch;
      }

      .pair-card {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }

      .pair-actions {
        justify-content: flex-end;
      }
    }
  `,
  template: `
    <div class="entity-list-layout">
      <div class="scan-content">
        <!-- Header -->
        <div class="scan-header">
          <div class="scan-header__title">
            <h1>Duplicate Detection</h1>
            <div class="scan-header__subtitle">
              Find and merge duplicate records
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="scan-controls">
          <mat-button-toggle-group
            [value]="entityType()"
            (change)="onEntityTypeChange($event.value)"
            hideSingleSelectionIndicator
          >
            <mat-button-toggle value="contact">Contacts</mat-button-toggle>
            <mat-button-toggle value="company">Companies</mat-button-toggle>
          </mat-button-toggle-group>

          <button
            mat-raised-button
            color="primary"
            class="scan-btn"
            (click)="runScan()"
            [disabled]="loading()"
          >
            <mat-icon>search</mat-icon>
            Run Scan
          </button>
        </div>

        <!-- Loading -->
        @if (loading()) {
          <div class="loading-state">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Scanning for duplicates...</p>
          </div>
        }

        <!-- Initial state (no scan run yet) -->
        @if (!loading() && !hasScanned()) {
          <div class="initial-state">
            <mat-icon>compare_arrows</mat-icon>
            <h3>Ready to Scan</h3>
            <p>
              Select an entity type and click "Run Scan" to find potential
              duplicates.
            </p>
          </div>
        }

        <!-- Empty results -->
        @if (!loading() && hasScanned() && pairs().length === 0) {
          <div class="empty-state">
            <mat-icon>check_circle</mat-icon>
            <h3>No Duplicates Found</h3>
            <p>
              No potential duplicates were detected for
              {{ entityType() === 'contact' ? 'contacts' : 'companies' }}.
            </p>
          </div>
        }

        <!-- Results -->
        @if (!loading() && pairs().length > 0) {
          <div class="result-count">
            {{ totalCount() }}
            {{ totalCount() === 1 ? 'potential duplicate pair' : 'potential duplicate pairs' }}
            found
          </div>

          <div class="pair-list">
            @for (pair of pairs(); track $index) {
              <div class="pair-card">
                <!-- Record A -->
                <div class="record-info">
                  <div class="record-info__name">{{ getRecordName(pair.recordA) }}</div>
                  <div class="record-info__detail">{{ getRecordDetail(pair.recordA) }}</div>
                </div>

                <!-- Score badge -->
                <span
                  class="score-badge"
                  [class.score-badge--high]="pair.score >= 85"
                  [class.score-badge--medium]="pair.score >= 70 && pair.score < 85"
                  [class.score-badge--low]="pair.score < 70"
                >
                  {{ pair.score }}% match
                </span>

                <!-- Record B -->
                <div class="record-info">
                  <div class="record-info__name">{{ getRecordName(pair.recordB) }}</div>
                  <div class="record-info__detail">{{ getRecordDetail(pair.recordB) }}</div>
                </div>

                <!-- Actions -->
                <div class="pair-actions">
                  <button
                    mat-stroked-button
                    color="primary"
                    (click)="onCompare(pair)"
                    matTooltip="Compare and merge records"
                  >
                    Compare
                  </button>
                  <button
                    mat-stroked-button
                    (click)="onDismiss(pair)"
                    matTooltip="Dismiss this pair"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Paginator -->
          <mat-paginator
            [length]="totalCount()"
            [pageIndex]="page() - 1"
            [pageSize]="pageSize()"
            [pageSizeOptions]="[10, 20, 50]"
            (page)="onPageChange($event)"
            showFirstLastButtons
          ></mat-paginator>
        }
      </div>
    </div>
  `,
})
export class DuplicateScanComponent {
  private readonly duplicateService = inject(DuplicateService);
  private readonly router = inject(Router);

  readonly entityType = signal<'contact' | 'company'>('contact');
  readonly loading = signal(false);
  readonly hasScanned = signal(false);
  readonly pairs = signal<DuplicatePair[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);

  /** Dismissed pair indices for client-side removal */
  private dismissedIndices = new Set<number>();

  onEntityTypeChange(value: 'contact' | 'company'): void {
    this.entityType.set(value);
    this.hasScanned.set(false);
    this.pairs.set([]);
    this.totalCount.set(0);
    this.page.set(1);
    this.dismissedIndices.clear();
  }

  runScan(): void {
    this.loading.set(true);
    this.dismissedIndices.clear();

    const scan$ =
      this.entityType() === 'contact'
        ? this.duplicateService.scanContacts(this.page(), this.pageSize())
        : this.duplicateService.scanCompanies(this.page(), this.pageSize());

    scan$.subscribe({
      next: (result) => {
        this.pairs.set(result.items);
        this.totalCount.set(result.totalCount);
        this.hasScanned.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.hasScanned.set(true);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.runScan();
  }

  onCompare(pair: DuplicatePair): void {
    const recordA = pair.recordA as any;
    const recordB = pair.recordB as any;
    this.router.navigate(['/duplicates/merge'], {
      queryParams: {
        entityType: this.entityType(),
        id1: recordA.id,
        id2: recordB.id,
      },
    });
  }

  onDismiss(pair: DuplicatePair): void {
    const current = this.pairs();
    this.pairs.set(current.filter((p) => p !== pair));
  }

  getRecordName(record: ContactDuplicateMatch | CompanyDuplicateMatch): string {
    if ('fullName' in record && record.fullName) {
      return record.fullName;
    }
    if ('name' in record && (record as CompanyDuplicateMatch).name) {
      return (record as CompanyDuplicateMatch).name;
    }
    return 'Unknown';
  }

  getRecordDetail(
    record: ContactDuplicateMatch | CompanyDuplicateMatch
  ): string {
    if (this.entityType() === 'contact') {
      const contact = record as ContactDuplicateMatch;
      const parts: string[] = [];
      if (contact.email) parts.push(contact.email);
      if (contact.companyName) parts.push(contact.companyName);
      return parts.join(' - ') || 'No details';
    } else {
      const company = record as CompanyDuplicateMatch;
      const parts: string[] = [];
      if (company.website) parts.push(company.website);
      if (company.email) parts.push(company.email);
      return parts.join(' - ') || 'No details';
    }
  }
}
