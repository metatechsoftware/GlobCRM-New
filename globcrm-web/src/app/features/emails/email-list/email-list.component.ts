import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { DynamicTableComponent } from '../../../shared/components/dynamic-table/dynamic-table.component';
import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { FilterChipsComponent } from '../../../shared/components/filter-chips/filter-chips.component';
import { ViewSidebarComponent } from '../../../shared/components/saved-views/view-sidebar.component';
import { ViewStore } from '../../../shared/components/saved-views/view.store';
import {
  ColumnDefinition,
  ViewColumn,
  ViewFilter,
  ViewSort,
  SavedView,
} from '../../../shared/components/saved-views/view.models';
import { EmailStore } from '../email.store';
import { EmailListDto } from '../email.models';
import { EmailComposeComponent } from '../email-compose/email-compose.component';

/**
 * Email list page with DynamicTable, read/star indicators, compose button.
 * Component-provides ViewStore and EmailStore for per-page instance isolation.
 *
 * Shows connection status banner when Gmail is not connected,
 * guiding users to settings page. Unread emails display with bold text.
 * Star toggling is optimistic via EmailStore.toggleStar.
 */
@Component({
  selector: 'app-email-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    TranslocoPipe,
    DynamicTableComponent,
    FilterPanelComponent,
    FilterChipsComponent,
    ViewSidebarComponent,
  ],
  providers: [ViewStore, EmailStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @use '../../../../styles/entity-list';

    .connection-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #fff3e0;
      border: 1px solid #ffe0b2;
      border-radius: 8px;
      color: #e65100;
      font-size: 14px;

      mat-icon {
        color: #ff9800;
      }

      a {
        color: #e65100;
        font-weight: 500;
        text-decoration: underline;
      }
    }

    .email-row-unread {
      font-weight: 600;
    }

    .star-btn {
      cursor: pointer;
      border: none;
      background: none;
      padding: 2px;
      display: flex;
      align-items: center;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .starred {
        color: var(--color-warning);
      }

      .unstarred {
        color: var(--color-text-muted);
      }
    }

    .read-indicator mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .read-indicator .unread {
      color: var(--color-primary);
    }

    .read-indicator .read {
      color: var(--color-text-muted);
    }

    .attachment-icon {
      color: var(--color-text-muted);
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `,
  template: `
    <div class="entity-list-layout">
      <app-view-sidebar
        [entityType]="'Email'"
        (viewSelected)="onViewSelected($event)" />
      <div class="entity-list-content">
        <div class="list-header">
          <h1>{{ 'emails.list.title' | transloco }}</h1>

          <div class="list-header-actions">
            <button mat-raised-button color="primary"
                    (click)="openCompose()">
              <mat-icon>edit</mat-icon> {{ 'emails.list.compose' | transloco }}
            </button>
          </div>
        </div>

        @if (!emailStore.isConnected()) {
          <div class="connection-banner">
            <mat-icon>warning</mat-icon>
            <span [innerHTML]="'emails.list.connectionBanner' | transloco">
            </span>
          </div>
        }

        <app-filter-chips
          [filters]="emailStore.filters()"
          [columnDefinitions]="columnDefs()"
          (filterRemoved)="onFilterRemoved($event)"
          (filtersCleared)="onFiltersCleared()" />

        <app-filter-panel
          [columnDefinitions]="columnDefs()"
          [activeFilters]="emailStore.filters()"
          (filtersChanged)="onFilterApplied($event)" />

        <app-dynamic-table
          entityType="Email"
          [data]="displayData()"
          [columns]="activeViewColumns()"
          [columnDefinitions]="columnDefs()"
          [totalCount]="emailStore.totalCount()"
          [pageSize]="emailStore.pageSize()"
          [loading]="emailStore.isLoading()"
          (sortChanged)="onSortChanged($event)"
          (pageChanged)="onPageChanged($event)"
          (rowEditClicked)="onRowClicked($event)"
          (searchChanged)="onSearchChanged($event)" />
      </div>
    </div>
  `,
})
export class EmailListComponent implements OnInit {
  readonly emailStore = inject(EmailStore);
  private readonly viewStore = inject(ViewStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  /** All column definitions for the email list. */
  columnDefs = signal<ColumnDefinition[]>([]);

  /** Active view columns (from selected view or defaults). */
  private viewColumns = signal<ViewColumn[]>([]);

  /** Default visible column field IDs. */
  private readonly defaultVisibleColumns = [
    'isRead',
    'isStarred',
    'from',
    'subject',
    'bodyPreview',
    'sentAt',
    'hasAttachments',
  ];

  /** Core column definitions for Email entity. */
  private readonly coreColumnDefs: ColumnDefinition[] = [
    { fieldId: 'isRead', label: '', isCustomField: false, fieldType: 'text', sortable: false, filterable: false },
    { fieldId: 'isStarred', label: '', isCustomField: false, fieldType: 'text', sortable: false, filterable: false },
    { fieldId: 'from', label: 'From', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'subject', label: 'Subject', isCustomField: false, fieldType: 'text', sortable: true, filterable: true },
    { fieldId: 'bodyPreview', label: 'Preview', isCustomField: false, fieldType: 'text', sortable: false, filterable: false },
    { fieldId: 'sentAt', label: 'Date', isCustomField: false, fieldType: 'date', sortable: true, filterable: true },
    { fieldId: 'hasAttachments', label: '', isCustomField: false, fieldType: 'text', sortable: false, filterable: false },
    { fieldId: 'linkedContactName', label: 'Contact', isCustomField: false, fieldType: 'text', sortable: true, filterable: false },
  ];

  /** Date formatter for sentAt column. */
  private readonly dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  /**
   * Display data with formatted dates and sender info.
   * For sent emails, shows "To: {recipient}" instead of from address.
   * Unread emails are flagged for bold styling by DynamicTable row class.
   */
  displayData = computed(() => {
    return this.emailStore.items().map((email: EmailListDto) => ({
      ...email,
      from: email.isInbound
        ? (email.fromName || email.fromAddress)
        : `To: ${email.toAddresses?.[0] ?? ''}`,
      sentAt: email.sentAt ? this.dateFormatter.format(new Date(email.sentAt)) : '',
      hasAttachments: email.hasAttachments ? 'Y' : '',
      isRead: email.isRead ? 'read' : 'unread',
      isStarred: email.isStarred ? 'starred' : 'unstarred',
    }));
  });

  /** Computed: columns for the active view (or defaults). */
  activeViewColumns = computed<ViewColumn[]>(() => {
    const cols = this.viewColumns();
    if (cols.length > 0) return cols;

    return this.columnDefs().map((def, i) => ({
      fieldId: def.fieldId,
      isCustomField: def.isCustomField,
      width: 0,
      sortOrder: i,
      visible: this.defaultVisibleColumns.includes(def.fieldId),
    }));
  });

  ngOnInit(): void {
    // Set core column definitions (no custom fields for email entity)
    this.columnDefs.set(this.coreColumnDefs);

    // Load saved views
    this.viewStore.loadViews('Email');

    // Load account status first, then load emails if connected
    this.emailStore.loadAccountStatus();

    // Small delay to let account status load, then check
    // We always load list -- the backend will return empty if not connected
    this.emailStore.loadList();
  }

  /** Open compose email dialog. */
  openCompose(): void {
    const dialogRef = this.dialog.open(EmailComposeComponent, {
      width: '600px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.emailStore.loadList();
      }
    });
  }

  /** Toggle star on an email (optimistic update). */
  onStarToggle(emailId: string): void {
    this.emailStore.toggleStar(emailId);
  }

  /** Handle saved view selection. */
  onViewSelected(view: SavedView): void {
    if (view.columns && view.columns.length > 0) {
      this.viewColumns.set(view.columns);
    }
    if (view.filters && view.filters.length > 0) {
      this.emailStore.setFilters(view.filters);
    }
    if (view.sorts && view.sorts.length > 0) {
      const primarySort = view.sorts[0];
      this.emailStore.setSort(primarySort.fieldId, primarySort.direction);
    }
  }

  /** Handle search change from dynamic table. */
  onSearchChanged(search: string): void {
    this.emailStore.setSearch(search);
  }

  /** Handle sort change from dynamic table. */
  onSortChanged(sort: ViewSort): void {
    this.emailStore.setSort(sort.fieldId, sort.direction);
  }

  /** Handle page change from dynamic table. */
  onPageChanged(event: { page: number; pageSize: number }): void {
    this.emailStore.setPage(event.page);
  }

  /** Handle filter applied from filter panel. */
  onFilterApplied(filters: ViewFilter[]): void {
    this.emailStore.setFilters(filters);
  }

  /** Handle individual filter chip removed. */
  onFilterRemoved(filter: ViewFilter): void {
    const currentFilters = this.emailStore.filters();
    const updated = currentFilters.filter(
      (f) => !(f.fieldId === filter.fieldId && f.operator === filter.operator && f.value === filter.value),
    );
    this.emailStore.setFilters(updated);
  }

  /** Handle all filters cleared. */
  onFiltersCleared(): void {
    this.emailStore.setFilters([]);
  }

  /** Handle row click -- navigate to email detail page. */
  onRowClicked(row: any): void {
    this.router.navigate(['/emails', row.id]);
  }
}
