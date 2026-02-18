import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import {
  RelatedEntityTabsComponent,
  DEAL_TABS,
} from '../../../shared/components/related-entity-tabs/related-entity-tabs.component';
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { DealService } from '../deal.service';
import { DealDetailDto, LinkedContactDto, LinkedProductDto } from '../deal.models';
import { ContactService } from '../../contacts/contact.service';
import { ContactDto } from '../../contacts/contact.models';
import { ProductService } from '../../products/product.service';
import { ProductDto } from '../../products/product.models';
import { ActivityListDto, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES } from '../../activities/activity.models';
import { ActivityService } from '../../activities/activity.service';
import { QuoteService } from '../../quotes/quote.service';
import { QuoteListDto, QUOTE_STATUSES } from '../../quotes/quote.models';
import { NoteService } from '../../notes/note.service';
import { NoteListDto } from '../../notes/note.models';
import { EntityAttachmentsComponent } from '../../../shared/components/entity-attachments/entity-attachments.component';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';

/**
 * Deal detail page with 5 tabs: Details, Contacts, Products, Activities (disabled), Timeline.
 * Supports linking/unlinking contacts and products, stage badge display, and entity timeline.
 */
@Component({
  selector: 'app-deal-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    HasPermissionDirective,
    RelatedEntityTabsComponent,
    EntityTimelineComponent,
    CustomFieldFormComponent,
    EntityAttachmentsComponent,
  ],
  templateUrl: './deal-detail.component.html',
  styleUrl: './deal-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dealService = inject(DealService);
  private readonly contactService = inject(ContactService);
  private readonly productService = inject(ProductService);
  private readonly activityService = inject(ActivityService);
  private readonly quoteService = inject(QuoteService);
  private readonly noteService = inject(NoteService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Deal detail data. */
  deal = signal<DealDetailDto | null>(null);
  isLoading = signal(true);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Activities linked to this deal. */
  linkedActivities = signal<ActivityListDto[]>([]);
  activitiesLoading = signal(false);
  activitiesLoaded = signal(false);

  /** Quotes linked to this deal. */
  linkedQuotes = signal<QuoteListDto[]>([]);
  quotesLoading = signal(false);
  quotesLoaded = signal(false);

  /** Notes linked to this deal. */
  dealNotes = signal<NoteListDto[]>([]);
  notesLoading = signal(false);
  notesLoaded = signal(false);

  /** Tab configuration for deal detail. */
  readonly tabs = DEAL_TABS;

  /** Current deal ID from route. */
  private dealId = '';

  // ─── Contact Linking ────────────────────────────────────────────────
  contactSearchTerm = signal('');
  contactSearchResults = signal<ContactDto[]>([]);
  contactSearchLoading = signal(false);
  showContactSearch = signal(false);
  private contactSearch$ = new Subject<string>();

  // ─── Product Linking ────────────────────────────────────────────────
  productSearchTerm = signal('');
  productSearchResults = signal<ProductDto[]>([]);
  productSearchLoading = signal(false);
  showProductSearch = signal(false);
  linkProductQuantity = signal(1);
  linkProductUnitPrice = signal<number | null>(null);
  private productSearch$ = new Subject<string>();

  ngOnInit(): void {
    this.dealId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.dealId) {
      this.isLoading.set(false);
      return;
    }

    this.loadDeal();
    this.loadTimeline();
    this.setupContactSearch();
    this.setupProductSearch();
  }

  /** Load deal detail data. */
  private loadDeal(): void {
    this.isLoading.set(true);
    this.dealService.getById(this.dealId).subscribe({
      next: (deal) => {
        this.deal.set(deal);
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
    this.dealService.getTimeline(this.dealId).subscribe({
      next: (entries) => {
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Handle tab change -- lazy load activities/quotes/notes when tab is selected. */
  onTabChanged(index: number): void {
    if (index === 3) {
      this.loadLinkedActivities();
    }
    if (index === 4) {
      this.loadLinkedQuotes();
    }
    if (index === 6) {
      this.loadDealNotes();
    }
  }

  /** Load activities linked to this deal (lazy on tab switch). */
  private loadLinkedActivities(): void {
    if (this.activitiesLoaded() || this.activitiesLoading()) return;

    this.activitiesLoading.set(true);
    this.activityService
      .getList({ linkedEntityType: 'Deal', linkedEntityId: this.dealId, page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedActivities.set(result.items);
          this.activitiesLoading.set(false);
          this.activitiesLoaded.set(true);
        },
        error: () => {
          this.activitiesLoading.set(false);
        },
      });
  }

  /** Get status color for activity chip. */
  getStatusColor(status: string): string {
    return ACTIVITY_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get priority color for activity chip. */
  getPriorityColor(priority: string): string {
    return ACTIVITY_PRIORITIES.find(p => p.value === priority)?.color ?? 'var(--color-text-muted)';
  }

  /** Get quote status color. */
  getQuoteStatusColor(status: string): string {
    return QUOTE_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Load notes linked to this deal (lazy on tab switch). */
  private loadDealNotes(): void {
    if (this.notesLoaded() || this.notesLoading()) return;

    this.notesLoading.set(true);
    this.noteService
      .getEntityNotes('Deal', this.dealId)
      .subscribe({
        next: (notes) => {
          this.dealNotes.set(notes);
          this.notesLoading.set(false);
          this.notesLoaded.set(true);
        },
        error: () => {
          this.notesLoading.set(false);
        },
      });
  }

  /** Format note date for display. */
  formatNoteDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
  }

  /** Format currency for quote totals. */
  formatQuoteCurrency(value: number | null): string {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /** Load quotes linked to this deal (lazy on tab switch). */
  private loadLinkedQuotes(): void {
    if (this.quotesLoaded() || this.quotesLoading()) return;

    this.quotesLoading.set(true);
    this.quoteService
      .getList({ filters: [{ fieldId: 'dealId', operator: 'eq', value: this.dealId }], page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedQuotes.set(result.items);
          this.quotesLoading.set(false);
          this.quotesLoaded.set(true);
        },
        error: () => {
          this.quotesLoading.set(false);
        },
      });
  }

  /** Handle delete with confirmation dialog. */
  onDelete(): void {
    const deal = this.deal();
    if (!deal) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: deal.title, type: 'deal' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.dealService.delete(this.dealId).subscribe({
          next: () => {
            this.router.navigate(['/deals']);
          },
          error: () => {
            // Error is handled by ApiService interceptor
          },
        });
      }
    });
  }

  /** Compute total value from linked products. */
  getProductsTotal(): number {
    const deal = this.deal();
    if (!deal?.linkedProducts?.length) return 0;
    return deal.linkedProducts.reduce((sum, p) => {
      const price = p.unitPrice ?? 0;
      return sum + p.quantity * price;
    }, 0);
  }

  /** Format probability as percentage. */
  formatProbability(probability: number | null): string {
    if (probability == null) return '-';
    return `${Math.round(probability * 100)}%`;
  }

  /** Format currency value. */
  formatValue(value: number | null): string {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  // ─── Contact Linking ────────────────────────────────────────────────

  /** Setup debounced contact search. */
  private setupContactSearch(): void {
    this.contactSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 2) {
            return of({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 });
          }
          this.contactSearchLoading.set(true);
          return this.contactService.getList({ search: term, pageSize: 10 });
        }),
      )
      .subscribe({
        next: (result) => {
          // Filter out already-linked contacts
          const linkedIds = new Set(
            this.deal()?.linkedContacts?.map((c) => c.id) ?? [],
          );
          this.contactSearchResults.set(
            result.items.filter((c) => !linkedIds.has(c.id)),
          );
          this.contactSearchLoading.set(false);
        },
        error: () => {
          this.contactSearchLoading.set(false);
        },
      });
  }

  /** Toggle contact search visibility. */
  toggleContactSearch(): void {
    this.showContactSearch.update((v) => !v);
    if (!this.showContactSearch()) {
      this.contactSearchTerm.set('');
      this.contactSearchResults.set([]);
    }
  }

  /** Trigger contact search from input. */
  onContactSearchInput(term: string): void {
    this.contactSearchTerm.set(term);
    this.contactSearch$.next(term);
  }

  /** Link a contact to this deal. */
  linkContact(contact: ContactDto): void {
    this.dealService.linkContact(this.dealId, contact.id).subscribe({
      next: () => {
        this.snackBar.open(`Linked ${contact.fullName}`, 'OK', { duration: 3000 });
        this.showContactSearch.set(false);
        this.contactSearchTerm.set('');
        this.contactSearchResults.set([]);
        this.loadDeal(); // Refresh to get updated linked contacts
        this.loadTimeline();
      },
      error: () => {
        this.snackBar.open('Failed to link contact', 'OK', { duration: 3000 });
      },
    });
  }

  /** Unlink a contact from this deal. */
  unlinkContact(contact: LinkedContactDto): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: contact.name, type: 'linked contact' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.dealService.unlinkContact(this.dealId, contact.id).subscribe({
          next: () => {
            this.snackBar.open(`Unlinked ${contact.name}`, 'OK', { duration: 3000 });
            this.loadDeal();
            this.loadTimeline();
          },
          error: () => {
            this.snackBar.open('Failed to unlink contact', 'OK', { duration: 3000 });
          },
        });
      }
    });
  }

  // ─── Product Linking ────────────────────────────────────────────────

  /** Setup debounced product search. */
  private setupProductSearch(): void {
    this.productSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 2) {
            return of({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 });
          }
          this.productSearchLoading.set(true);
          return this.productService.getList({ search: term, pageSize: 10 });
        }),
      )
      .subscribe({
        next: (result) => {
          // Filter out already-linked products
          const linkedIds = new Set(
            this.deal()?.linkedProducts?.map((p) => p.id) ?? [],
          );
          this.productSearchResults.set(
            result.items.filter((p) => !linkedIds.has(p.id)),
          );
          this.productSearchLoading.set(false);
        },
        error: () => {
          this.productSearchLoading.set(false);
        },
      });
  }

  /** Toggle product search visibility. */
  toggleProductSearch(): void {
    this.showProductSearch.update((v) => !v);
    if (!this.showProductSearch()) {
      this.productSearchTerm.set('');
      this.productSearchResults.set([]);
      this.linkProductQuantity.set(1);
      this.linkProductUnitPrice.set(null);
    }
  }

  /** Trigger product search from input. */
  onProductSearchInput(term: string): void {
    this.productSearchTerm.set(term);
    this.productSearch$.next(term);
  }

  /** Link a product to this deal with quantity and optional unit price. */
  linkProduct(product: ProductDto): void {
    const quantity = this.linkProductQuantity();
    const unitPrice = this.linkProductUnitPrice();

    this.dealService
      .linkProduct(this.dealId, {
        productId: product.id,
        quantity: quantity > 0 ? quantity : 1,
        unitPrice: unitPrice,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(`Linked ${product.name}`, 'OK', { duration: 3000 });
          this.showProductSearch.set(false);
          this.productSearchTerm.set('');
          this.productSearchResults.set([]);
          this.linkProductQuantity.set(1);
          this.linkProductUnitPrice.set(null);
          this.loadDeal();
          this.loadTimeline();
        },
        error: () => {
          this.snackBar.open('Failed to link product', 'OK', { duration: 3000 });
        },
      });
  }

  /** Unlink a product from this deal. */
  unlinkProduct(product: LinkedProductDto): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: product.name, type: 'linked product' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.dealService.unlinkProduct(this.dealId, product.id).subscribe({
          next: () => {
            this.snackBar.open(`Unlinked ${product.name}`, 'OK', { duration: 3000 });
            this.loadDeal();
            this.loadTimeline();
          },
          error: () => {
            this.snackBar.open('Failed to unlink product', 'OK', { duration: 3000 });
          },
        });
      }
    });
  }
}
