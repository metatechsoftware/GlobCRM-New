import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  of,
} from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { QuoteService } from '../quote.service';
import {
  QuoteDetailDto,
  CreateQuoteRequest,
  UpdateQuoteRequest,
  CreateQuoteLineItemRequest,
  QuoteTotals,
  calculateLineTotals,
  calculateQuoteTotals,
} from '../quote.models';
import { CompanyService } from '../../companies/company.service';
import { CompanyDto } from '../../companies/company.models';
import { ContactService } from '../../contacts/contact.service';
import { ContactDto } from '../../contacts/contact.models';
import { DealService } from '../../deals/deal.service';
import { DealListDto } from '../../deals/deal.models';
import { ProductService } from '../../products/product.service';
import { ProductDto } from '../../products/product.models';

/**
 * Quote create/edit form component with dynamic line items FormArray.
 * Features live total calculations, entity linking via autocomplete
 * (deal, contact, company), and product search for line item auto-fill.
 *
 * Standalone component with inline template and styles.
 * Uses QuoteService directly (not store) for create/update operations.
 */
@Component({
  selector: 'app-quote-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .entity-form-container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }

    .form-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .form-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .form-loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .form-section {
      margin-bottom: 24px;
    }

    .form-section h3 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 500;
      color: var(--color-text-secondary);
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 16px;
    }

    .form-grid .full-width {
      grid-column: 1 / -1;
    }

    .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px 16px;
    }

    .entity-option {
      display: flex;
      flex-direction: column;
    }

    .entity-option-name {
      font-weight: 500;
    }

    .entity-option-detail {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    /* Line items section */
    .line-items-section {
      margin-bottom: 24px;
    }

    .line-items-section h3 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 500;
      color: var(--color-text-secondary);
    }

    .line-items-header {
      display: grid;
      grid-template-columns: 1fr 80px 100px 80px 80px 100px 48px;
      gap: 8px;
      padding: 8px 0;
      font-weight: 500;
      font-size: 13px;
      color: var(--color-text-secondary);
      border-bottom: 1px solid var(--color-border);
    }

    .line-item-row {
      display: grid;
      grid-template-columns: 1fr 80px 100px 80px 80px 100px 48px;
      gap: 8px;
      align-items: center;
      padding: 4px 0;
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .line-item-row mat-form-field {
      width: 100%;
    }

    .line-item-row ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .line-total {
      font-weight: 500;
      text-align: right;
      font-size: 14px;
      padding-right: 8px;
    }

    .add-line-item-btn {
      margin-top: 8px;
    }

    .product-search-row {
      margin-bottom: 8px;
    }

    /* Totals summary */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .totals-card {
      min-width: 280px;
    }

    .totals-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px 24px;
      padding: 16px;
    }

    .totals-label {
      text-align: right;
      color: var(--color-text-secondary);
      font-size: 14px;
    }

    .totals-value {
      text-align: right;
      font-size: 14px;
    }

    .totals-grid .grand-total-label {
      font-weight: 600;
      font-size: 16px;
      color: var(--color-text);
    }

    .totals-grid .grand-total-value {
      font-weight: 600;
      font-size: 16px;
    }

    .totals-divider {
      grid-column: 1 / -1;
      height: 1px;
      background: var(--color-border);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--color-border);
    }

    @media (max-width: 768px) {
      .form-grid {
        grid-template-columns: 1fr;
      }

      .form-grid-3 {
        grid-template-columns: 1fr;
      }

      .line-items-header,
      .line-item-row {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="entity-form-container">
      <div class="form-header">
        <a mat-icon-button routerLink="/quotes" [attr.aria-label]="'quotes.form.aria.backToQuotes' | transloco">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>{{ isEditMode ? ('quotes.form.editTitle' | transloco) : ('quotes.form.createTitle' | transloco) }}</h1>
      </div>

      @if (isLoadingDetail()) {
        <div class="form-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <form [formGroup]="quoteForm" (ngSubmit)="onSubmit()">
          <!-- Section 1: Quote Header Fields -->
          <div class="form-section">
            <h3>{{ 'quotes.form.sections.quoteInfo' | transloco }}</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'quotes.form.fields.title' | transloco }}</mat-label>
                <input matInput formControlName="title" required>
                @if (quoteForm.controls['title'].hasError('required')) {
                  <mat-error>{{ 'quotes.form.validation.titleRequired' | transloco }}</mat-error>
                }
                @if (quoteForm.controls['title'].hasError('maxlength')) {
                  <mat-error>{{ 'quotes.form.validation.titleMaxLength' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'quotes.form.fields.issueDate' | transloco }}</mat-label>
                <input matInput [matDatepicker]="issueDatePicker" formControlName="issueDate" required>
                <mat-datepicker-toggle matIconSuffix [for]="issueDatePicker"></mat-datepicker-toggle>
                <mat-datepicker #issueDatePicker></mat-datepicker>
                @if (quoteForm.controls['issueDate'].hasError('required')) {
                  <mat-error>{{ 'quotes.form.validation.issueDateRequired' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'quotes.form.fields.expiryDate' | transloco }}</mat-label>
                <input matInput [matDatepicker]="expiryDatePicker" formControlName="expiryDate">
                <mat-datepicker-toggle matIconSuffix [for]="expiryDatePicker"></mat-datepicker-toggle>
                <mat-datepicker #expiryDatePicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'quotes.form.fields.description' | transloco }}</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'quotes.form.fields.notes' | transloco }}</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>
            </div>
          </div>

          <!-- Section 2: Entity Links -->
          <div class="form-section">
            <h3>{{ 'quotes.form.sections.linkedEntities' | transloco }}</h3>
            <div class="form-grid-3">
              <!-- Deal autocomplete -->
              <mat-form-field appearance="outline">
                <mat-label>{{ 'quotes.form.fields.deal' | transloco }}</mat-label>
                <input matInput
                       [formControl]="dealSearchControl"
                       [matAutocomplete]="dealAuto"
                       [placeholder]="'quotes.form.fields.searchDeals' | transloco">
                <mat-autocomplete #dealAuto="matAutocomplete"
                                  [displayWith]="displayDealTitle"
                                  (optionSelected)="onDealSelected($event)">
                  @for (deal of dealSearchResults(); track deal.id) {
                    <mat-option [value]="deal">
                      <div class="entity-option">
                        <span class="entity-option-name">{{ deal.title }}</span>
                        @if (deal.companyName) {
                          <span class="entity-option-detail">{{ deal.companyName }}</span>
                        }
                      </div>
                    </mat-option>
                  }
                </mat-autocomplete>
                @if (selectedDealId()) {
                  <button mat-icon-button matSuffix type="button"
                          (click)="clearDeal()"
                          [attr.aria-label]="'quotes.form.aria.clearDeal' | transloco">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </mat-form-field>

              <!-- Contact autocomplete -->
              <mat-form-field appearance="outline">
                <mat-label>{{ 'quotes.form.fields.contact' | transloco }}</mat-label>
                <input matInput
                       [formControl]="contactSearchControl"
                       [matAutocomplete]="contactAuto"
                       [placeholder]="'quotes.form.fields.searchContacts' | transloco">
                <mat-autocomplete #contactAuto="matAutocomplete"
                                  [displayWith]="displayContactName"
                                  (optionSelected)="onContactSelected($event)">
                  @for (contact of contactSearchResults(); track contact.id) {
                    <mat-option [value]="contact">
                      <div class="entity-option">
                        <span class="entity-option-name">{{ contact.fullName }}</span>
                        @if (contact.companyName) {
                          <span class="entity-option-detail">{{ contact.companyName }}</span>
                        }
                      </div>
                    </mat-option>
                  }
                </mat-autocomplete>
                @if (selectedContactId()) {
                  <button mat-icon-button matSuffix type="button"
                          (click)="clearContact()"
                          [attr.aria-label]="'quotes.form.aria.clearContact' | transloco">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </mat-form-field>

              <!-- Company autocomplete -->
              <mat-form-field appearance="outline">
                <mat-label>{{ 'quotes.form.fields.company' | transloco }}</mat-label>
                <input matInput
                       [formControl]="companySearchControl"
                       [matAutocomplete]="companyAuto"
                       [placeholder]="'quotes.form.fields.searchCompanies' | transloco">
                <mat-autocomplete #companyAuto="matAutocomplete"
                                  [displayWith]="displayCompanyName"
                                  (optionSelected)="onCompanySelected($event)">
                  @for (company of companySearchResults(); track company.id) {
                    <mat-option [value]="company">
                      <div class="entity-option">
                        <span class="entity-option-name">{{ company.name }}</span>
                        @if (company.industry) {
                          <span class="entity-option-detail">{{ company.industry }}</span>
                        }
                      </div>
                    </mat-option>
                  }
                </mat-autocomplete>
                @if (selectedCompanyId()) {
                  <button mat-icon-button matSuffix type="button"
                          (click)="clearCompany()"
                          [attr.aria-label]="'quotes.form.aria.clearCompany' | transloco">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </mat-form-field>
            </div>
          </div>

          <!-- Section 3: Line Items -->
          <div class="line-items-section">
            <h3>{{ 'quotes.form.sections.lineItems' | transloco }}</h3>

            <!-- Product search for quick add -->
            <div class="product-search-row">
              <mat-form-field appearance="outline" style="width: 300px;">
                <mat-label>{{ 'quotes.form.fields.searchProductToAdd' | transloco }}</mat-label>
                <input matInput
                       [formControl]="productSearchControl"
                       [matAutocomplete]="productAuto"
                       [placeholder]="'quotes.form.fields.searchProducts' | transloco">
                <mat-autocomplete #productAuto="matAutocomplete"
                                  (optionSelected)="onProductSelected($event)">
                  @for (product of productSearchResults(); track product.id) {
                    <mat-option [value]="product">
                      <div class="entity-option">
                        <span class="entity-option-name">{{ product.name }}</span>
                        <span class="entity-option-detail">{{ formatCurrency(product.unitPrice) }}</span>
                      </div>
                    </mat-option>
                  }
                </mat-autocomplete>
              </mat-form-field>
            </div>

            @if (quoteForm.controls['lineItems'].hasError('minlength')) {
              <mat-error style="margin-bottom: 8px;">{{ 'quotes.form.validation.lineItemRequired' | transloco }}</mat-error>
            }

            <div class="line-items-header">
              <span>{{ 'quotes.form.lineItems.description' | transloco }}</span>
              <span>{{ 'quotes.form.lineItems.qty' | transloco }}</span>
              <span>{{ 'quotes.form.lineItems.unitPrice' | transloco }}</span>
              <span>{{ 'quotes.form.lineItems.discountPercent' | transloco }}</span>
              <span>{{ 'quotes.form.lineItems.taxPercent' | transloco }}</span>
              <span>{{ 'quotes.form.lineItems.lineTotal' | transloco }}</span>
              <span></span>
            </div>

            @for (lineItem of lineItems.controls; track $index; let i = $index) {
              <div class="line-item-row" [formGroupName]="'lineItems'">
                <ng-container [formGroupName]="i">
                  <mat-form-field appearance="outline">
                    <input matInput formControlName="description" [placeholder]="'quotes.form.fields.descriptionPlaceholder' | transloco">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <input matInput formControlName="quantity" type="number" min="1" placeholder="1">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <input matInput formControlName="unitPrice" type="number" min="0" step="0.01" placeholder="0.00">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <input matInput formControlName="discountPercent" type="number" min="0" max="100" step="0.1" placeholder="0">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <input matInput formControlName="taxPercent" type="number" min="0" max="100" step="0.1" placeholder="0">
                  </mat-form-field>

                  <span class="line-total">{{ getLineTotal(i) }}</span>

                  <button mat-icon-button type="button" color="warn"
                          (click)="removeLineItem(i)"
                          [attr.aria-label]="'quotes.form.aria.removeLineItem' | transloco">
                    <mat-icon>delete</mat-icon>
                  </button>
                </ng-container>
              </div>
            }

            <button mat-stroked-button type="button" class="add-line-item-btn"
                    (click)="addLineItem()">
              <mat-icon>add</mat-icon> {{ 'quotes.form.lineItems.addLineItem' | transloco }}
            </button>
          </div>

          <!-- Section 4: Totals Summary -->
          <div class="totals-section">
            <mat-card class="totals-card">
              <div class="totals-grid">
                <span class="totals-label">{{ 'quotes.form.totals.subtotal' | transloco }}</span>
                <span class="totals-value">{{ formatCurrency(quoteTotals().subtotal) }}</span>

                <span class="totals-label">{{ 'quotes.form.totals.discount' | transloco }}</span>
                <span class="totals-value">-{{ formatCurrency(quoteTotals().discountTotal) }}</span>

                <span class="totals-label">{{ 'quotes.form.totals.tax' | transloco }}</span>
                <span class="totals-value">{{ formatCurrency(quoteTotals().taxTotal) }}</span>

                <div class="totals-divider"></div>

                <span class="totals-label grand-total-label">{{ 'quotes.form.totals.grandTotal' | transloco }}</span>
                <span class="totals-value grand-total-value">{{ formatCurrency(quoteTotals().grandTotal) }}</span>
              </div>
            </mat-card>
          </div>

          <!-- Form actions -->
          <div class="form-actions">
            <button mat-button type="button" routerLink="/quotes">{{ 'common.cancel' | transloco }}</button>
            <button mat-raised-button color="primary" type="submit"
                    [disabled]="quoteForm.invalid || isSaving()">
              @if (isSaving()) {
                <mat-spinner diameter="20"></mat-spinner>
              }
              {{ isEditMode ? ('quotes.form.saveChanges' | transloco) : ('quotes.form.createQuote' | transloco) }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class QuoteFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly quoteService = inject(QuoteService);
  private readonly companyService = inject(CompanyService);
  private readonly contactService = inject(ContactService);
  private readonly dealService = inject(DealService);
  private readonly productService = inject(ProductService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** Currency formatter for display. */
  private readonly currencyFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  /** Whether this is an edit (vs create) form. */
  isEditMode = false;

  /** Quote ID for edit mode. */
  private quoteId = '';

  /** Loading state for fetching quote detail in edit mode. */
  isLoadingDetail = signal(false);

  /** Saving/submitting state. */
  isSaving = signal(false);

  // ─── Entity Autocomplete State ─────────────────────────────────────────

  /** Deal autocomplete. */
  dealSearchResults = signal<DealListDto[]>([]);
  selectedDealId = signal<string | null>(null);
  dealSearchControl = new FormControl('');
  private readonly dealSearch$ = new Subject<string>();

  /** Contact autocomplete. */
  contactSearchResults = signal<ContactDto[]>([]);
  selectedContactId = signal<string | null>(null);
  contactSearchControl = new FormControl('');
  private readonly contactSearch$ = new Subject<string>();

  /** Company autocomplete. */
  companySearchResults = signal<CompanyDto[]>([]);
  selectedCompanyId = signal<string | null>(null);
  companySearchControl = new FormControl('');
  private readonly companySearch$ = new Subject<string>();

  /** Product search for line item auto-fill. */
  productSearchResults = signal<ProductDto[]>([]);
  productSearchControl = new FormControl('');
  private readonly productSearch$ = new Subject<string>();

  private readonly destroy$ = new Subject<void>();

  // ─── Reactive Form ─────────────────────────────────────────────────────

  quoteForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(500)]],
    description: [''],
    dealId: [null as string | null],
    contactId: [null as string | null],
    companyId: [null as string | null],
    issueDate: [new Date(), Validators.required],
    expiryDate: [null as Date | null],
    notes: [''],
    lineItems: this.fb.array([], Validators.minLength(1)),
  });

  /** Convenience getter for lineItems FormArray. */
  get lineItems(): FormArray {
    return this.quoteForm.get('lineItems') as FormArray;
  }

  /**
   * Computed quote totals -- recalculates whenever lineItems signal changes.
   * Uses a signal updated via valueChanges subscription for reactive display.
   */
  private readonly lineItemValues = signal<
    { quantity: number; unitPrice: number; discountPercent: number; taxPercent: number }[]
  >([]);

  quoteTotals = computed<QuoteTotals>(() => {
    return calculateQuoteTotals(this.lineItemValues());
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.quoteId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEditMode = !!this.quoteId;

    this.setupDealSearch();
    this.setupContactSearch();
    this.setupCompanySearch();
    this.setupProductSearch();
    this.setupLineItemWatcher();

    if (this.isEditMode) {
      this.loadQuoteForEdit();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Search Setup (debounced 300ms) ────────────────────────────────────

  private setupDealSearch(): void {
    this.dealSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 1) return of({ items: [] as DealListDto[] });
          return this.dealService.getList({ search: term, pageSize: 10, page: 1 });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.dealSearchResults.set(Array.isArray(result) ? result : result.items);
      });

    this.dealSearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.dealSearch$.next(value);
        }
      });
  }

  private setupContactSearch(): void {
    this.contactSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 1) return of({ items: [] as ContactDto[] });
          return this.contactService.getList({ search: term, pageSize: 10, page: 1 });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.contactSearchResults.set(Array.isArray(result) ? result : result.items);
      });

    this.contactSearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.contactSearch$.next(value);
        }
      });
  }

  private setupCompanySearch(): void {
    this.companySearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 1) return of({ items: [] as CompanyDto[] });
          return this.companyService.getList({ search: term, pageSize: 10, page: 1 });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.companySearchResults.set(Array.isArray(result) ? result : result.items);
      });

    this.companySearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.companySearch$.next(value);
        }
      });
  }

  private setupProductSearch(): void {
    this.productSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 1) return of({ items: [] as ProductDto[] });
          return this.productService.getList({ search: term, pageSize: 10, page: 1 });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.productSearchResults.set(Array.isArray(result) ? result : result.items);
      });

    this.productSearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.productSearch$.next(value);
        }
      });
  }

  /**
   * Watch lineItems FormArray for changes and update computed totals signal.
   */
  private setupLineItemWatcher(): void {
    this.lineItems.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((items: any[]) => {
        this.lineItemValues.set(
          items.map((item) => ({
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            discountPercent: Number(item.discountPercent) || 0,
            taxPercent: Number(item.taxPercent) || 0,
          })),
        );
      });
  }

  // ─── Line Item Management ──────────────────────────────────────────────

  /**
   * Add a new line item to the FormArray.
   * If product provided, pre-fill description and unitPrice.
   */
  addLineItem(product?: ProductDto): void {
    const group = this.fb.group({
      productId: [product?.id ?? null],
      description: [product?.name ?? '', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [product?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
      discountPercent: [0, [Validators.min(0), Validators.max(100)]],
      taxPercent: [0, [Validators.min(0), Validators.max(100)]],
    });

    this.lineItems.push(group);
  }

  /** Remove a line item by index. */
  removeLineItem(index: number): void {
    this.lineItems.removeAt(index);
  }

  /**
   * Get formatted line total for a specific line item index.
   */
  getLineTotal(index: number): string {
    const items = this.lineItemValues();
    if (index >= items.length) return this.formatCurrency(0);

    const totals = calculateLineTotals(items[index]);
    return this.formatCurrency(totals.netTotal);
  }

  // ─── Entity Selection Handlers ─────────────────────────────────────────

  onDealSelected(event: any): void {
    const deal = event.option.value as DealListDto;
    this.selectedDealId.set(deal.id);
    this.quoteForm.patchValue({ dealId: deal.id });
  }

  clearDeal(): void {
    this.selectedDealId.set(null);
    this.dealSearchControl.setValue('');
    this.dealSearchResults.set([]);
    this.quoteForm.patchValue({ dealId: null });
  }

  displayDealTitle = (deal: DealListDto | any): string => {
    return deal?.title ?? '';
  };

  onContactSelected(event: any): void {
    const contact = event.option.value as ContactDto;
    this.selectedContactId.set(contact.id);
    this.quoteForm.patchValue({ contactId: contact.id });
  }

  clearContact(): void {
    this.selectedContactId.set(null);
    this.contactSearchControl.setValue('');
    this.contactSearchResults.set([]);
    this.quoteForm.patchValue({ contactId: null });
  }

  displayContactName = (contact: ContactDto | any): string => {
    return contact?.fullName ?? '';
  };

  onCompanySelected(event: any): void {
    const company = event.option.value as CompanyDto;
    this.selectedCompanyId.set(company.id);
    this.quoteForm.patchValue({ companyId: company.id });
  }

  clearCompany(): void {
    this.selectedCompanyId.set(null);
    this.companySearchControl.setValue('');
    this.companySearchResults.set([]);
    this.quoteForm.patchValue({ companyId: null });
  }

  displayCompanyName = (company: CompanyDto | any): string => {
    return company?.name ?? '';
  };

  /**
   * When a product is selected from search, add a new line item
   * pre-filled with the product's name and unit price.
   */
  onProductSelected(event: any): void {
    const product = event.option.value as ProductDto;
    this.addLineItem(product);
    // Clear the product search input
    this.productSearchControl.setValue('');
    this.productSearchResults.set([]);
  }

  // ─── Edit Mode: Load Existing Quote ────────────────────────────────────

  private loadQuoteForEdit(): void {
    this.isLoadingDetail.set(true);
    this.quoteService.getById(this.quoteId).subscribe({
      next: (quote) => {
        this.quoteForm.patchValue({
          title: quote.title,
          description: quote.description ?? '',
          issueDate: quote.issueDate ? new Date(quote.issueDate) : new Date(),
          expiryDate: quote.expiryDate ? new Date(quote.expiryDate) : null,
          notes: quote.notes ?? '',
          dealId: null,
          contactId: null,
          companyId: null,
        });

        // Set entity links from detail response
        if (quote.dealTitle) {
          // Deal link -- set ID from quote detail
          // Note: QuoteDetailDto extends QuoteListDto which has dealTitle but no dealId
          // We pass dealId from form's hidden state
        }

        if (quote.contactName) {
          this.contactSearchControl.setValue(
            { fullName: quote.contactName } as any,
          );
        }

        if (quote.companyName) {
          this.selectedCompanyId.set(null); // will be set via hidden form field
          this.companySearchControl.setValue(
            { name: quote.companyName } as any,
          );
        }

        // Clear existing line items and rebuild from detail
        while (this.lineItems.length > 0) {
          this.lineItems.removeAt(0);
        }

        for (const item of quote.lineItems) {
          const group = this.fb.group({
            productId: [item.productId],
            description: [item.description, Validators.required],
            quantity: [item.quantity, [Validators.required, Validators.min(1)]],
            unitPrice: [item.unitPrice, [Validators.required, Validators.min(0)]],
            discountPercent: [item.discountPercent, [Validators.min(0), Validators.max(100)]],
            taxPercent: [item.taxPercent, [Validators.min(0), Validators.max(100)]],
          });
          this.lineItems.push(group);
        }

        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
        this.snackBar.open(this.transloco.translate('quotes.messages.loadFailed'), 'Close', {
          duration: 5000,
        });
      },
    });
  }

  // ─── Submit ────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.quoteForm.invalid) return;

    this.isSaving.set(true);
    const fv = this.quoteForm.value;

    // Format dates to ISO date strings
    const issueDate = fv.issueDate
      ? new Date(fv.issueDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const expiryDate = fv.expiryDate
      ? new Date(fv.expiryDate).toISOString().split('T')[0]
      : null;

    // Build line items from FormArray values
    const lineItems: CreateQuoteLineItemRequest[] = (fv.lineItems || []).map(
      (item: any) => ({
        productId: item.productId || null,
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        taxPercent: Number(item.taxPercent) || 0,
      }),
    );

    if (this.isEditMode) {
      const request: UpdateQuoteRequest = {
        title: fv.title,
        description: fv.description || null,
        dealId: this.selectedDealId(),
        contactId: this.selectedContactId(),
        companyId: this.selectedCompanyId(),
        issueDate,
        expiryDate,
        notes: fv.notes || null,
        lineItems,
      };

      this.quoteService.update(this.quoteId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('quotes.messages.quoteUpdated'), 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/quotes', this.quoteId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('quotes.messages.quoteUpdateFailed'), 'Close', {
            duration: 5000,
          });
        },
      });
    } else {
      const request: CreateQuoteRequest = {
        title: fv.title,
        description: fv.description || null,
        dealId: this.selectedDealId(),
        contactId: this.selectedContactId(),
        companyId: this.selectedCompanyId(),
        issueDate,
        expiryDate,
        notes: fv.notes || null,
        lineItems,
      };

      this.quoteService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('quotes.messages.quoteCreated'), 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/quotes', created.id]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('quotes.messages.quoteCreateFailed'), 'Close', {
            duration: 5000,
          });
        },
      });
    }
  }

  // ─── Utility ───────────────────────────────────────────────────────────

  formatCurrency(value: number): string {
    return this.currencyFmt.format(value);
  }
}
