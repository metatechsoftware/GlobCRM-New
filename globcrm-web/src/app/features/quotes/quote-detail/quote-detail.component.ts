import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { QuoteService } from '../quote.service';
import {
  QuoteDetailDto,
  QuoteLineItemDto,
  QuoteVersionDto,
  QuoteStatus,
  QUOTE_STATUSES,
  QUOTE_TRANSITIONS,
} from '../quote.models';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';

/**
 * Quote detail page with line items table, PDF download, versioning, and status management.
 * Shows header info, action bar, info cards, and 4 tabs: Line Items, Details, Versions, Timeline.
 */
@Component({
  selector: 'app-quote-detail',
  standalone: true,
  imports: [
    RouterLink,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    PercentPipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTabsModule,
    HasPermissionDirective,
    EntityTimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .detail-container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }

    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-left h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .quote-number {
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      font-size: 14px;
    }

    .version-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: var(--mat-sys-surface-variant, #e0e0e0);
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
      color: #fff;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .action-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: var(--mat-sys-surface-container, #f5f5f5);
      border-radius: 8px;
    }

    .action-bar .spacer {
      flex: 1;
    }

    .info-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .info-card {
      padding: 16px;
      background: var(--mat-sys-surface-container-low, #fafafa);
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }

    .info-card .label {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-card .value {
      font-size: 16px;
      font-weight: 500;
    }

    .info-card .value.grand-total {
      font-size: 24px;
      font-weight: 600;
      color: var(--mat-sys-primary, #1976d2);
    }

    .info-card a {
      color: var(--mat-sys-primary, #1976d2);
      text-decoration: none;
    }

    .info-card a:hover {
      text-decoration: underline;
    }

    /* Line Items Table */
    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    .line-items-table th {
      text-align: left;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      border-bottom: 2px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }

    .line-items-table th.num-col {
      text-align: right;
    }

    .line-items-table td {
      padding: 10px 12px;
      font-size: 14px;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
    }

    .line-items-table td.num-col {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .line-items-table tbody tr:hover {
      background: var(--mat-sys-surface-container-low, #fafafa);
    }

    .totals-summary {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .totals-grid {
      display: grid;
      grid-template-columns: auto auto;
      gap: 4px 24px;
      text-align: right;
    }

    .totals-grid .total-label {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .totals-grid .total-value {
      font-size: 14px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .totals-grid .grand-total .total-label,
    .totals-grid .grand-total .total-value {
      font-size: 18px;
      font-weight: 600;
      padding-top: 8px;
      border-top: 2px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
      color: var(--mat-sys-primary, #1976d2);
    }

    /* Details tab */
    .details-section {
      padding: 16px 0;
    }

    .details-section h3 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .details-section p {
      margin: 0 0 24px;
      font-size: 14px;
      white-space: pre-wrap;
    }

    /* Versions list */
    .versions-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .version-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
    }

    .version-item:hover {
      background: var(--mat-sys-surface-container-low, #fafafa);
    }

    .version-item .version-num {
      font-weight: 600;
      font-size: 16px;
      min-width: 40px;
    }

    .version-item .version-num.current {
      color: var(--mat-sys-primary, #1976d2);
    }

    .version-item .version-info {
      flex: 1;
    }

    .version-item .version-date {
      font-size: 13px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .transition-buttons {
      display: flex;
      gap: 4px;
    }

    @media (max-width: 768px) {
      .detail-header {
        flex-direction: column;
        gap: 12px;
      }

      .action-bar {
        flex-direction: column;
      }

      .info-cards {
        grid-template-columns: repeat(2, 1fr);
      }

      .line-items-table {
        font-size: 12px;
      }
    }
  `,
  template: `
    @if (isLoading()) {
      <div class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
      </div>
    } @else if (quote()) {
      <div class="detail-container">
        <!-- Header -->
        <div class="detail-header">
          <div class="header-left">
            <a mat-icon-button routerLink="/quotes" aria-label="Back to quotes">
              <mat-icon>arrow_back</mat-icon>
            </a>
            <div>
              <div class="quote-number">
                {{ quote()!.quoteNumber }}
                <span class="version-badge">v{{ quote()!.versionNumber }}</span>
              </div>
              <h1>{{ quote()!.title }}</h1>
            </div>
          </div>
          <span class="status-chip"
                [style.background-color]="getStatusColor(quote()!.status)">
            {{ getStatusLabel(quote()!.status) }}
          </span>
        </div>

        <!-- Action Bar -->
        <div class="action-bar">
          <button mat-stroked-button routerLink="/quotes/{{ quote()!.id }}/edit"
                  *appHasPermission="'Quote:Update'">
            <mat-icon>edit</mat-icon> Edit
          </button>
          <button mat-stroked-button (click)="onDelete()"
                  *appHasPermission="'Quote:Delete'">
            <mat-icon>delete</mat-icon> Delete
          </button>
          <button mat-stroked-button (click)="onGeneratePdf()"
                  [disabled]="pdfGenerating()">
            @if (pdfGenerating()) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <mat-icon>picture_as_pdf</mat-icon>
            }
            Generate PDF
          </button>
          <button mat-stroked-button (click)="onCreateNewVersion()"
                  *appHasPermission="'Quote:Create'">
            <mat-icon>content_copy</mat-icon> New Version
          </button>
          <span class="spacer"></span>
          <div class="transition-buttons">
            @for (transition of allowedTransitions(); track transition) {
              <button mat-flat-button color="primary"
                      (click)="onTransitionStatus(transition)">
                {{ getTransitionLabel(transition) }}
              </button>
            }
          </div>
        </div>

        <!-- Info Cards -->
        <div class="info-cards">
          <div class="info-card">
            <div class="label">Grand Total</div>
            <div class="value grand-total">{{ quote()!.grandTotal | currency:'USD':'symbol':'1.2-2' }}</div>
          </div>
          <div class="info-card">
            <div class="label">Issue Date</div>
            <div class="value">{{ quote()!.issueDate | date:'mediumDate' }}</div>
          </div>
          <div class="info-card">
            <div class="label">Expiry Date</div>
            <div class="value">{{ quote()!.expiryDate ? (quote()!.expiryDate | date:'mediumDate') : '-' }}</div>
          </div>
          @if (quote()!.contactName) {
            <div class="info-card">
              <div class="label">Contact</div>
              <div class="value">
                <a [routerLink]="['/contacts', quote()!.contactName]">{{ quote()!.contactName }}</a>
              </div>
            </div>
          }
          @if (quote()!.companyName) {
            <div class="info-card">
              <div class="label">Company</div>
              <div class="value">{{ quote()!.companyName }}</div>
            </div>
          }
          @if (quote()!.dealTitle) {
            <div class="info-card">
              <div class="label">Deal</div>
              <div class="value">{{ quote()!.dealTitle }}</div>
            </div>
          }
          @if (quote()!.ownerName) {
            <div class="info-card">
              <div class="label">Owner</div>
              <div class="value">{{ quote()!.ownerName }}</div>
            </div>
          }
        </div>

        <!-- Tabs -->
        <mat-tab-group animationDuration="0ms">
          <!-- Line Items Tab -->
          <mat-tab label="Line Items">
            <div style="padding: 16px 0;">
              @if (quote()!.lineItems.length === 0) {
                <div class="empty-state">No line items</div>
              } @else {
                <table class="line-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th class="num-col">Qty</th>
                      <th class="num-col">Unit Price</th>
                      <th class="num-col">Discount %</th>
                      <th class="num-col">Tax %</th>
                      <th class="num-col">Line Total</th>
                      <th class="num-col">Net Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of quote()!.lineItems; track item.id; let i = $index) {
                      <tr>
                        <td>{{ i + 1 }}</td>
                        <td>{{ item.description }}</td>
                        <td class="num-col">{{ item.quantity | number:'1.0-2' }}</td>
                        <td class="num-col">{{ item.unitPrice | currency:'USD':'symbol':'1.2-2' }}</td>
                        <td class="num-col">{{ item.discountPercent | number:'1.0-2' }}%</td>
                        <td class="num-col">{{ item.taxPercent | number:'1.0-2' }}%</td>
                        <td class="num-col">{{ item.lineTotal | currency:'USD':'symbol':'1.2-2' }}</td>
                        <td class="num-col">{{ item.netTotal | currency:'USD':'symbol':'1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>

                <div class="totals-summary">
                  <div class="totals-grid">
                    <span class="total-label">Subtotal</span>
                    <span class="total-value">{{ subtotal() | currency:'USD':'symbol':'1.2-2' }}</span>
                    <span class="total-label">Discount Total</span>
                    <span class="total-value">-{{ discountTotal() | currency:'USD':'symbol':'1.2-2' }}</span>
                    <span class="total-label">Tax Total</span>
                    <span class="total-value">{{ taxTotal() | currency:'USD':'symbol':'1.2-2' }}</span>
                    <div class="grand-total">
                      <span class="total-label">Grand Total</span>
                    </div>
                    <div class="grand-total">
                      <span class="total-value">{{ quote()!.grandTotal | currency:'USD':'symbol':'1.2-2' }}</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </mat-tab>

          <!-- Details Tab -->
          <mat-tab label="Details">
            <div class="details-section">
              @if (quote()!.description) {
                <h3>Description</h3>
                <p>{{ quote()!.description }}</p>
              }
              @if (quote()!.notes) {
                <h3>Notes</h3>
                <p>{{ quote()!.notes }}</p>
              }
              @if (!quote()!.description && !quote()!.notes) {
                <div class="empty-state">No additional details</div>
              }
            </div>
          </mat-tab>

          <!-- Versions Tab -->
          <mat-tab label="Versions ({{ quote()!.versions.length }})">
            <div style="padding: 16px 0;">
              @if (quote()!.versions.length === 0) {
                <div class="empty-state">No version history available</div>
              } @else {
                <ul class="versions-list">
                  @for (version of quote()!.versions; track version.id) {
                    <li class="version-item">
                      <span class="version-num"
                            [class.current]="version.id === quote()!.id">
                        v{{ version.versionNumber }}
                      </span>
                      <div class="version-info">
                        <span class="status-chip"
                              [style.background-color]="getStatusColor(version.status)"
                              style="font-size: 11px; padding: 2px 8px;">
                          {{ getStatusLabel(version.status) }}
                        </span>
                        <span class="version-date">{{ version.createdAt | date:'medium' }}</span>
                      </div>
                      @if (version.id !== quote()!.id) {
                        <a mat-stroked-button [routerLink]="['/quotes', version.id]">
                          View
                        </a>
                      } @else {
                        <span style="font-size: 12px; color: var(--mat-sys-on-surface-variant, rgba(0,0,0,0.6));">
                          Current
                        </span>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          </mat-tab>

          <!-- Timeline Tab -->
          <mat-tab label="Timeline">
            <div style="padding: 16px 0;">
              @if (timelineLoading()) {
                <div class="loading-container">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>
              } @else {
                <app-entity-timeline [entries]="timelineEntries()" />
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    } @else {
      <div class="empty-state">
        <h2>Quote not found</h2>
        <a mat-button routerLink="/quotes">Back to Quotes</a>
      </div>
    }
  `,
})
export class QuoteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quoteService = inject(QuoteService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Quote detail data. */
  quote = signal<QuoteDetailDto | null>(null);
  isLoading = signal(true);

  /** PDF generation state. */
  pdfGenerating = signal(false);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Current quote ID from route. */
  private quoteId = '';

  /** Computed: allowed status transitions from current status. */
  allowedTransitions = computed(() => {
    const q = this.quote();
    if (!q) return [];
    return QUOTE_TRANSITIONS[q.status] ?? [];
  });

  /** Computed: subtotal from line items (sum of lineTotal). */
  subtotal = computed(() => {
    const q = this.quote();
    if (!q?.lineItems?.length) return 0;
    return q.lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  });

  /** Computed: total discount across all line items. */
  discountTotal = computed(() => {
    const q = this.quote();
    if (!q?.lineItems?.length) return 0;
    return q.lineItems.reduce((sum, item) => sum + item.discountAmount, 0);
  });

  /** Computed: total tax across all line items. */
  taxTotal = computed(() => {
    const q = this.quote();
    if (!q?.lineItems?.length) return 0;
    return q.lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
  });

  ngOnInit(): void {
    this.quoteId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.quoteId) {
      this.isLoading.set(false);
      return;
    }

    this.loadQuote();
    this.loadTimeline();
  }

  /** Load quote detail data. */
  private loadQuote(): void {
    this.isLoading.set(true);
    this.quoteService.getById(this.quoteId).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /** Load timeline entries. */
  private loadTimeline(): void {
    this.timelineLoading.set(true);
    this.quoteService.getTimeline(this.quoteId).subscribe({
      next: (entries) => {
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Get status color from QUOTE_STATUSES constant. */
  getStatusColor(status: QuoteStatus): string {
    return QUOTE_STATUSES.find((s) => s.value === status)?.color ?? '#757575';
  }

  /** Get status label from QUOTE_STATUSES constant. */
  getStatusLabel(status: QuoteStatus): string {
    return QUOTE_STATUSES.find((s) => s.value === status)?.label ?? status;
  }

  /** Get a human-friendly label for a status transition button. */
  getTransitionLabel(status: QuoteStatus): string {
    switch (status) {
      case 'Sent':
        return 'Mark as Sent';
      case 'Accepted':
        return 'Accept';
      case 'Rejected':
        return 'Reject';
      case 'Expired':
        return 'Mark Expired';
      case 'Draft':
        return 'Revert to Draft';
      default:
        return status;
    }
  }

  /** Generate PDF and trigger download in browser. */
  onGeneratePdf(): void {
    this.pdfGenerating.set(true);
    this.quoteService.generatePdf(this.quoteId).subscribe({
      next: (blob) => {
        const q = this.quote()!;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Quote-${q.quoteNumber}-v${q.versionNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.pdfGenerating.set(false);
      },
      error: () => {
        this.pdfGenerating.set(false);
        this.snackBar.open('Failed to generate PDF', 'OK', { duration: 5000 });
      },
    });
  }

  /** Create a new version from this quote. */
  onCreateNewVersion(): void {
    const q = this.quote()!;
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: {
        name: `${q.quoteNumber} v${q.versionNumber}`,
        type: 'new version from Quote',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.quoteService.createNewVersion(this.quoteId).subscribe({
          next: (newVersion) => {
            this.snackBar.open(
              `Version ${newVersion.versionNumber} created`,
              'OK',
              { duration: 3000 },
            );
            this.router.navigate(['/quotes', newVersion.id]);
          },
          error: () => {
            this.snackBar.open('Failed to create new version', 'OK', {
              duration: 5000,
            });
          },
        });
      }
    });
  }

  /** Transition quote to a new status. */
  onTransitionStatus(newStatus: QuoteStatus): void {
    this.quoteService
      .updateStatus(this.quoteId, { status: newStatus })
      .subscribe({
        next: () => {
          const label = this.getStatusLabel(newStatus);
          this.snackBar.open(`Status updated to ${label}`, 'OK', {
            duration: 3000,
          });
          this.loadQuote();
          this.loadTimeline();
        },
        error: () => {
          this.snackBar.open('Failed to update status', 'OK', {
            duration: 5000,
          });
        },
      });
  }

  /** Delete quote with confirmation dialog. */
  onDelete(): void {
    const q = this.quote();
    if (!q) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: q.title, type: 'quote' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.quoteService.delete(this.quoteId).subscribe({
          next: () => {
            this.snackBar.open('Quote deleted', 'OK', { duration: 3000 });
            this.router.navigate(['/quotes']);
          },
          error: () => {
            this.snackBar.open('Failed to delete quote', 'OK', {
              duration: 5000,
            });
          },
        });
      }
    });
  }
}
