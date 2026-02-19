import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  ReportExecutionResult,
  ReportFilterCondition,
} from '../report.models';

/**
 * Entity type to route path mapping for row click navigation.
 */
const ENTITY_ROUTE_MAP: Record<string, string> = {
  Contact: 'contacts',
  Deal: 'deals',
  Company: 'companies',
  Lead: 'leads',
  Activity: 'activities',
  Quote: 'quotes',
  Request: 'requests',
  Product: 'products',
};

/**
 * Paginated data table component for report results.
 * Displays rows in a Material table with column headers from the execution result,
 * supports row click navigation to entity detail pages, drill-down filter display,
 * and pagination.
 */
@Component({
  selector: 'app-report-data-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @keyframes fadeSlideUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    :host {
      display: block;
      animation: fadeSlideUp 400ms cubic-bezier(0, 0, 0.2, 1) 200ms backwards;
    }

    .drill-down-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
      background: #FFFBEB;
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: var(--radius-lg, 12px);
      font-size: 13px;
      font-weight: 500;
      color: #92400E;
    }

    .drill-down-bar mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #D97706;
      background: rgba(245, 158, 11, 0.1);
      border-radius: 4px;
      padding: 2px;
      width: 22px;
      height: 22px;
    }

    .drill-down-bar span {
      flex: 1;
    }

    .report-table-container {
      overflow-x: auto;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-lg, 12px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    table {
      width: 100%;
    }

    th.mat-mdc-header-cell {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-secondary, #6B7280);
      background: var(--color-bg-secondary, #F9FAFB);
      white-space: nowrap;
      border-bottom: 2px solid var(--color-border, #E8E8E6);
    }

    td.mat-mdc-cell {
      font-size: 13px;
      color: var(--color-text, #1A1A1A);
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    tr.mat-mdc-row:nth-child(even) {
      background: rgba(0, 0, 0, 0.015);
    }

    .report-table__row--clickable {
      cursor: pointer;
      transition: background-color 200ms cubic-bezier(0, 0, 0.2, 1),
                  box-shadow 200ms cubic-bezier(0, 0, 0.2, 1);
    }

    .report-table__row--clickable:hover {
      background: var(--color-primary-soft, #FFF7ED) !important;
      box-shadow: inset 3px 0 0 var(--color-primary, #F97316);
    }

    .report-table__empty {
      text-align: center;
      padding: 48px 32px;
      color: var(--color-text-secondary, #6B7280);
      font-size: 14px;
      border: 1px dashed var(--color-border, #e2e8f0);
      border-radius: var(--radius-lg, 12px);
      background: var(--color-surface, #fff);
    }

    ::ng-deep .mat-mdc-paginator {
      border-top: 1px solid var(--color-border, #e2e8f0);
      border-radius: 0 0 var(--radius-lg, 12px) var(--radius-lg, 12px);
    }
  `,
  template: `
    <!-- Drill-down indicator -->
    @if (drillDownFilter()) {
      <div class="drill-down-bar">
        <mat-icon>filter_list</mat-icon>
        <span>Filtered by: {{ drillDownFilter()?.fieldId }} = "{{ drillDownFilter()?.value }}"</span>
        <button mat-icon-button (click)="clearDrillDown.emit()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }

    <!-- Data table -->
    @if (rows().length > 0) {
      <div class="report-table-container">
        <table mat-table [dataSource]="rows()">
          @for (col of columnHeaders(); track col) {
            <ng-container [matColumnDef]="col">
              <th mat-header-cell *matHeaderCellDef>{{ col }}</th>
              <td mat-cell *matCellDef="let row">{{ formatCell(row[fieldIdForColumn(col)]) }}</td>
            </ng-container>
          }
          <tr mat-header-row *matHeaderRowDef="columnHeaders()"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: columnHeaders()"
            class="report-table__row--clickable"
            (click)="onRowClick(row)"
          ></tr>
        </table>

        <!-- Pagination -->
        <mat-paginator
          [length]="executionResult()?.totalCount ?? 0"
          [pageSize]="pageSize()"
          [pageIndex]="currentPage() - 1"
          [pageSizeOptions]="[25, 50, 100]"
          (page)="onPageChange($event)"
          showFirstLastButtons
        ></mat-paginator>
      </div>
    } @else {
      <div class="report-table__empty">
        No data to display. Run the report to see results.
      </div>
    }
  `,
})
export class ReportDataTableComponent {
  readonly executionResult = input<ReportExecutionResult | null>(null);
  readonly entityType = input<string>('');
  readonly currentPage = input(1);
  readonly pageSize = input(50);
  readonly drillDownFilter = input<ReportFilterCondition | null>(null);

  readonly pageChange = output<number>();
  readonly rowClick = output<Record<string, any>>();
  readonly clearDrillDown = output<void>();

  private readonly router = inject(Router);
  private readonly datePipe = new DatePipe('en-US');

  /** Column headers from the execution result. */
  readonly columnHeaders = computed(() => {
    return this.executionResult()?.columnHeaders ?? [];
  });

  /** Rows from the execution result. */
  readonly rows = computed(() => {
    return this.executionResult()?.rows ?? [];
  });

  /**
   * Map a display column header label to the corresponding field ID in the
   * row data object. Headers may match keys directly, or we search by position.
   */
  fieldIdForColumn(headerLabel: string): string {
    const rows = this.rows();
    if (rows.length === 0) return headerLabel;

    const row = rows[0];
    // Direct key match
    if (headerLabel in row) return headerLabel;

    // Try case-insensitive match
    const keys = Object.keys(row);
    const lower = headerLabel.toLowerCase();
    const match = keys.find((k) => k.toLowerCase() === lower);
    if (match) return match;

    // Positional fallback: match header index to key index
    const headers = this.columnHeaders();
    const idx = headers.indexOf(headerLabel);
    if (idx >= 0 && idx < keys.length) return keys[idx];

    return headerLabel;
  }

  /** UUID pattern: 8-4-4-4-12 hex chars */
  private readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /** Date-only pattern: YYYY-MM-DD (no time component) */
  private readonly DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

  /** Compact number formatter for large values */
  private readonly compactFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

  /**
   * Format cell values for display.
   * Handles arrays, objects, dates, UUIDs, large numbers, booleans, and null/undefined.
   */
  formatCell(value: any): string {
    if (value == null) return '\u2014'; // em dash

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    // Arrays — recursively format each item
    if (Array.isArray(value)) {
      return value.map((item) => this.formatCell(item)).join(', ');
    }

    // Plain objects — show up to 3 key-value pairs
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      const shown = entries.slice(0, 3).map(([k, v]) => `${k}: ${v}`);
      return entries.length > 3 ? shown.join(', ') + ' \u2026' : shown.join(', ');
    }

    if (typeof value === 'string') {
      // ISO datetime string detection
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return this.datePipe.transform(value, 'MMM d, yyyy') ?? value;
      }

      // Date-only string (YYYY-MM-DD)
      if (this.DATE_ONLY_RE.test(value)) {
        return this.datePipe.transform(value + 'T00:00:00', 'MMM d, yyyy') ?? value;
      }

      // UUID — truncate to first 8 chars
      if (this.UUID_RE.test(value)) {
        return value.substring(0, 8) + '\u2026';
      }

      return value;
    }

    if (typeof value === 'number') {
      if (!isFinite(value)) return String(value);

      // Large numbers — compact notation
      const abs = Math.abs(value);
      if (abs >= 1_000_000) {
        return this.compactFormatter.format(value);
      }

      // Currency-like detection (has decimals)
      if (value !== Math.floor(value)) {
        return value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }
      return value.toLocaleString();
    }

    return String(value);
  }

  /**
   * Handle row click -- navigate to entity detail page if row has an 'id' field.
   */
  onRowClick(row: Record<string, any>): void {
    this.rowClick.emit(row);

    const id = row['id'] ?? row['Id'];
    if (!id) return;

    const entityType = this.entityType();
    const routePath = ENTITY_ROUTE_MAP[entityType];
    if (routePath) {
      this.router.navigate(['/', routePath, id]);
    }
  }

  /**
   * Handle page change from paginator.
   */
  onPageChange(event: PageEvent): void {
    // API pages are 1-based, paginator is 0-based
    this.pageChange.emit(event.pageIndex + 1);
  }
}
