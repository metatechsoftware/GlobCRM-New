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
import { TranslocoPipe } from '@jsverse/transloco';

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
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './duplicate-scan.component.scss',
  template: `
    <div class="entity-list-layout">
      <div class="scan-page">
        <!-- Header -->
        <div class="scan-header">
          <div class="scan-header__title-group">
            <h1 class="scan-title">
              <span class="scan-title__icon">
                <mat-icon>content_copy</mat-icon>
              </span>
              {{ 'scan.title' | transloco }}
            </h1>
            <div class="scan-subtitle">
              {{ 'scan.subtitle' | transloco }}
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="scan-controls">
          <div class="scan-controls__left">
            <div class="entity-toggle">
              <mat-button-toggle-group
                [value]="entityType()"
                (change)="onEntityTypeChange($event.value)"
                hideSingleSelectionIndicator
              >
                <mat-button-toggle value="contact">
                  <mat-icon>person</mat-icon>
                  {{ 'scan.contacts' | transloco }}
                </mat-button-toggle>
                <mat-button-toggle value="company">
                  <mat-icon>business</mat-icon>
                  {{ 'scan.companies' | transloco }}
                </mat-button-toggle>
              </mat-button-toggle-group>
            </div>
          </div>

          <button
            mat-raised-button
            color="primary"
            class="scan-btn"
            [class.scan-btn--active]="loading()"
            (click)="runScan()"
            [disabled]="loading()"
          >
            <mat-icon>{{ loading() ? 'radar' : 'search' }}</mat-icon>
            {{ loading() ? ('scan.scanning' | transloco) : ('scan.runScan' | transloco) }}
          </button>
        </div>

        <!-- Loading -->
        @if (loading()) {
          <div class="loading-state">
            <div class="loading-state__visual">
              <mat-icon>compare_arrows</mat-icon>
            </div>
            <div class="loading-state__text">
              <div class="loading-state__title">{{ 'scan.analyzingRecords' | transloco }}</div>
              <div class="loading-state__desc">
                {{ 'scan.scanningForMatches' | transloco:{ type: entityType() === 'contact' ? ('scan.contacts' | transloco) : ('scan.companies' | transloco) } }}
              </div>
            </div>
          </div>
        }

        <!-- Initial state -->
        @if (!loading() && !hasScanned()) {
          <div class="initial-state">
            <div class="initial-state__visual">
              <mat-icon>compare_arrows</mat-icon>
            </div>
            <div class="initial-state__text">
              <h3>{{ 'scan.readyToScan' | transloco }}</h3>
              <p>{{ 'scan.readyToScanDesc' | transloco }}</p>
            </div>
          </div>
        }

        <!-- Empty results -->
        @if (!loading() && hasScanned() && pairs().length === 0) {
          <div class="empty-state">
            <div class="empty-state__visual">
              <mat-icon>verified</mat-icon>
            </div>
            <div class="empty-state__text">
              <h3>{{ 'scan.noDuplicates' | transloco }}</h3>
              <p>{{ 'scan.noDuplicatesDesc' | transloco:{ type: entityType() === 'contact' ? ('scan.contacts' | transloco) : ('scan.companies' | transloco) } }}</p>
            </div>
          </div>
        }

        <!-- Results -->
        @if (!loading() && pairs().length > 0) {
          <div class="result-header">
            <div class="result-count">
              <span class="result-count__number">{{ totalCount() }}</span>
              {{ totalCount() === 1 ? ('scan.pairSingular' | transloco) : ('scan.pairPlural' | transloco) }}
              {{ 'scan.found' | transloco }}
            </div>
          </div>

          <div class="pair-list">
            @for (pair of pairs(); track $index) {
              <div class="pair-card">
                <!-- Record A -->
                <div class="record-info">
                  <div class="record-info__name">{{ getRecordName(pair.recordA) }}</div>
                  <div class="record-info__detail">{{ getRecordDetail(pair.recordA) }}</div>
                </div>

                <!-- Score indicator -->
                <div class="score-indicator">
                  <div class="score-ring">
                    <svg viewBox="0 0 36 36">
                      <circle class="score-ring__bg" cx="18" cy="18" r="15.5" />
                      <circle
                        class="score-ring__fill"
                        [class.score-ring__fill--high]="pair.score >= 85"
                        [class.score-ring__fill--medium]="pair.score >= 70 && pair.score < 85"
                        [class.score-ring__fill--low]="pair.score < 70"
                        cx="18" cy="18" r="15.5"
                        [attr.stroke-dasharray]="97.4"
                        [attr.stroke-dashoffset]="97.4 - (97.4 * pair.score / 100)"
                      />
                    </svg>
                    <span class="score-ring__value">{{ pair.score }}%</span>
                  </div>
                  <span
                    class="score-label"
                    [class.score-label--high]="pair.score >= 85"
                    [class.score-label--medium]="pair.score >= 70 && pair.score < 85"
                    [class.score-label--low]="pair.score < 70"
                  >
                    {{ pair.score >= 85 ? ('scan.high' | transloco) : pair.score >= 70 ? ('scan.medium' | transloco) : ('scan.low' | transloco) }}
                  </span>
                </div>

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
                    [matTooltip]="'scan.compareTooltip' | transloco"
                  >
                    <mat-icon>compare</mat-icon>
                    {{ 'scan.compare' | transloco }}
                  </button>
                  <button
                    mat-stroked-button
                    class="dismiss-btn"
                    (click)="onDismiss(pair)"
                    [matTooltip]="'scan.dismissTooltip' | transloco"
                  >
                    {{ 'scan.dismiss' | transloco }}
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Paginator -->
          <mat-paginator
            class="scan-paginator"
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
      return parts.join(' \u00B7 ') || 'No details';
    } else {
      const company = record as CompanyDuplicateMatch;
      const parts: string[] = [];
      if (company.website) parts.push(company.website);
      if (company.email) parts.push(company.email);
      return parts.join(' \u00B7 ') || 'No details';
    }
  }
}
