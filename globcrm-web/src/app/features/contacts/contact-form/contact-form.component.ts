import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  input,
  output,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil, of } from 'rxjs';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { ContactService } from '../contact.service';
import { CompanyService } from '../../companies/company.service';
import { CompanyDto } from '../../companies/company.models';
import {
  ContactDetailDto,
  CreateContactRequest,
  UpdateContactRequest,
} from '../contact.models';
import { DuplicateService } from '../../duplicates/duplicate.service';
import { ContactDuplicateMatch } from '../../duplicates/duplicate.models';

/**
 * Contact create/edit form component.
 * Renders core contact fields in a 2-column grid with company autocomplete
 * selector and custom field integration.
 * Determines create vs edit mode from the presence of :id route param.
 * Shows duplicate warning banner on create mode when potential duplicates are detected.
 */
@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    CustomFieldFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.dialog-mode]': 'dialogMode()' },
  styles: `
    :host {
      display: block;
    }

    .entity-form-container {
      max-width: 900px;
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

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 16px;
    }

    .form-grid .full-width {
      grid-column: 1 / -1;
    }

    .company-field {
      position: relative;
    }

    .company-option {
      display: flex;
      flex-direction: column;
    }

    .company-option-name {
      font-weight: 500;
    }

    .company-option-industry {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .clear-company-btn {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
    }

    .custom-fields-section {
      margin-top: 24px;
    }

    .custom-fields-section h3 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 500;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--color-border);
    }

    .duplicate-warning {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      border-radius: 4px;
    }

    .duplicate-warning mat-icon {
      color: #ff9800;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .duplicate-warning__content {
      flex: 1;
      min-width: 0;
    }

    .duplicate-warning__content strong {
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .duplicate-warning__match {
      font-size: 13px;
      margin-bottom: 2px;
    }

    .duplicate-warning__match a {
      color: var(--color-primary, #e65100);
      text-decoration: underline;
      cursor: pointer;
    }

    .duplicate-warning__match a:hover {
      text-decoration: none;
    }

    .duplicate-warning__details {
      color: var(--color-text-secondary, #64748b);
    }

    .duplicate-warning__dismiss {
      flex-shrink: 0;
    }

    :host.dialog-mode .entity-form-container {
      padding: 0;
      max-width: unset;
    }

    @media (max-width: 768px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="entity-form-container">
      @if (!dialogMode()) {
        <div class="form-header">
          <a mat-icon-button routerLink="/contacts" aria-label="Back to contacts">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>{{ isEditMode ? 'Edit Contact' : 'New Contact' }}</h1>
        </div>
      }

      @if (isLoadingDetail()) {
        <div class="form-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <!-- Duplicate warning banner (create mode only) -->
        @if (potentialDuplicates().length > 0 && !duplicateWarningDismissed()) {
          <div class="duplicate-warning">
            <mat-icon>warning</mat-icon>
            <div class="duplicate-warning__content">
              <strong>Potential duplicates found:</strong>
              @for (match of potentialDuplicates(); track match.id) {
                <div class="duplicate-warning__match">
                  <a [routerLink]="['/contacts', match.id]" target="_blank">
                    {{ match.fullName }}
                  </a>
                  <span class="duplicate-warning__details">
                    {{ match.email ? '(' + match.email + ')' : '' }} -- {{ match.score }}% match
                  </span>
                </div>
              }
            </div>
            <button mat-icon-button class="duplicate-warning__dismiss"
                    (click)="dismissDuplicateWarning()" aria-label="Dismiss warning">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }

        <form [formGroup]="contactForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>First Name</mat-label>
              <input matInput formControlName="firstName" required
                     (blur)="onNameOrEmailBlur()">
              @if (contactForm.controls['firstName'].hasError('required')) {
                <mat-error>First name is required</mat-error>
              }
              @if (contactForm.controls['firstName'].hasError('maxlength')) {
                <mat-error>First name cannot exceed 100 characters</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Last Name</mat-label>
              <input matInput formControlName="lastName" required
                     (blur)="onNameOrEmailBlur()">
              @if (contactForm.controls['lastName'].hasError('required')) {
                <mat-error>Last name is required</mat-error>
              }
              @if (contactForm.controls['lastName'].hasError('maxlength')) {
                <mat-error>Last name cannot exceed 100 characters</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email"
                     (blur)="onNameOrEmailBlur()">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Phone</mat-label>
              <input matInput formControlName="phone">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Mobile Phone</mat-label>
              <input matInput formControlName="mobilePhone">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Job Title</mat-label>
              <input matInput formControlName="jobTitle">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Department</mat-label>
              <input matInput formControlName="department">
            </mat-form-field>

            <!-- Company autocomplete selector (CONT-03) -->
            <mat-form-field appearance="outline" class="company-field">
              <mat-label>Company</mat-label>
              <input matInput
                     [formControl]="companySearchControl"
                     [matAutocomplete]="companyAuto"
                     placeholder="Search companies...">
              <mat-autocomplete #companyAuto="matAutocomplete"
                                [displayWith]="displayCompanyName"
                                (optionSelected)="onCompanySelected($event)">
                @for (company of companySearchResults(); track company.id) {
                  <mat-option [value]="company">
                    <div class="company-option">
                      <span class="company-option-name">{{ company.name }}</span>
                      @if (company.industry) {
                        <span class="company-option-industry">{{ company.industry }}</span>
                      }
                    </div>
                  </mat-option>
                }
              </mat-autocomplete>
              @if (selectedCompanyId()) {
                <button mat-icon-button matSuffix type="button"
                        (click)="clearCompany()"
                        aria-label="Clear company">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Address</mat-label>
              <input matInput formControlName="address">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>City</mat-label>
              <input matInput formControlName="city">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>State / Region</mat-label>
              <input matInput formControlName="state">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Country</mat-label>
              <input matInput formControlName="country">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Postal Code</mat-label>
              <input matInput formControlName="postalCode">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <textarea matInput formControlName="description" rows="3"></textarea>
            </mat-form-field>
          </div>

          <!-- Custom fields -->
          <div class="custom-fields-section">
            <h3>Custom Fields</h3>
            <app-custom-field-form
              [entityType]="'Contact'"
              [customFieldValues]="existingCustomFields"
              (valuesChanged)="onCustomFieldsChanged($event)" />
          </div>

          <!-- Form actions -->
          @if (!dialogMode()) {
            <div class="form-actions">
              <button mat-button type="button" routerLink="/contacts">Cancel</button>
              <button mat-raised-button color="primary" type="submit"
                      [disabled]="contactForm.invalid || isSaving()">
                @if (isSaving()) {
                  <mat-spinner diameter="20"></mat-spinner>
                }
                {{ isEditMode ? 'Save Changes' : 'Create Contact' }}
              </button>
            </div>
          }
        </form>
      }
    </div>
  `,
})
export class ContactFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly contactService = inject(ContactService);
  private readonly companyService = inject(CompanyService);
  private readonly duplicateService = inject(DuplicateService);
  private readonly snackBar = inject(MatSnackBar);

  /** Dialog mode inputs/outputs. */
  dialogMode = input(false);
  entityCreated = output<any>();
  entityCreateError = output<void>();

  /** Whether this is an edit (vs create) form. */
  isEditMode = false;

  /** Contact ID for edit mode. */
  private contactId = '';

  /** Loading state for fetching contact detail in edit mode. */
  isLoadingDetail = signal(false);

  /** Saving/submitting state. */
  isSaving = signal(false);

  /** Existing custom field values for edit mode. */
  existingCustomFields: Record<string, any> | undefined;

  /** Custom field values captured from CustomFieldFormComponent. */
  private customFieldValues: Record<string, any> = {};

  /** Company autocomplete search results. */
  companySearchResults = signal<CompanyDto[]>([]);

  /** Currently selected company ID (nullable). */
  selectedCompanyId = signal<string | null>(null);

  /** Form control for company search input (separate from main form). */
  companySearchControl = new FormControl('');

  /** Subject for company search typeahead. */
  private readonly companySearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  /** Duplicate detection signals (create mode only). */
  potentialDuplicates = signal<ContactDuplicateMatch[]>([]);
  duplicateWarningDismissed = signal(false);

  /** Track last checked values to avoid redundant API calls. */
  private lastCheckedValues = '';

  /** Reactive form with all core contact fields. */
  contactForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: [''],
    phone: [''],
    mobilePhone: [''],
    jobTitle: [''],
    department: [''],
    address: [''],
    city: [''],
    state: [''],
    country: [''],
    postalCode: [''],
    description: [''],
  });

  ngOnInit(): void {
    if (!this.dialogMode()) {
      this.contactId = this.route.snapshot.paramMap.get('id') ?? '';
      this.isEditMode = !!this.contactId;
    }

    // Set up company search typeahead (debounced 300ms)
    this.companySearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 1) {
            return of([]);
          }
          return this.companyService.getList({ search: term, pageSize: 10, page: 1 });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        // Result may be PagedResult<CompanyDto> or empty array
        if (Array.isArray(result)) {
          this.companySearchResults.set(result);
        } else {
          this.companySearchResults.set(result.items);
        }
      });

    // Listen for input changes on company search control
    this.companySearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.companySearch$.next(value);
        }
      });

    if (this.isEditMode) {
      this.loadContactForEdit();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load existing contact data for editing. */
  private loadContactForEdit(): void {
    this.isLoadingDetail.set(true);
    this.contactService.getById(this.contactId).subscribe({
      next: (contact) => {
        this.contactForm.patchValue({
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email ?? '',
          phone: contact.phone ?? '',
          mobilePhone: contact.mobilePhone ?? '',
          jobTitle: contact.jobTitle ?? '',
          department: contact.department ?? '',
          address: contact.address ?? '',
          city: contact.city ?? '',
          state: contact.state ?? '',
          country: contact.country ?? '',
          postalCode: contact.postalCode ?? '',
          description: contact.description ?? '',
        });

        // Set company link if exists
        if (contact.companyId && contact.companyName) {
          this.selectedCompanyId.set(contact.companyId);
          this.companySearchControl.setValue(
            { id: contact.companyId, name: contact.companyName } as any,
          );
        }

        this.existingCustomFields = contact.customFields;
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
        this.snackBar.open('Failed to load contact data', 'Close', {
          duration: 5000,
        });
      },
    });
  }

  /** Display function for company autocomplete. */
  displayCompanyName = (company: CompanyDto | any): string => {
    return company?.name ?? '';
  };

  /** Handle company selection from autocomplete. */
  onCompanySelected(event: any): void {
    const company = event.option.value as CompanyDto;
    this.selectedCompanyId.set(company.id);
  }

  /** Clear the company link. */
  clearCompany(): void {
    this.selectedCompanyId.set(null);
    this.companySearchControl.setValue('');
    this.companySearchResults.set([]);
  }

  /** Capture custom field value changes. */
  onCustomFieldsChanged(values: Record<string, any>): void {
    this.customFieldValues = values;
  }

  /**
   * On blur of firstName, lastName, or email fields in CREATE mode,
   * check for potential duplicates via the API.
   */
  onNameOrEmailBlur(): void {
    // Only check duplicates in create mode (not edit mode)
    if (this.isEditMode) return;

    const firstName = (this.contactForm.get('firstName')?.value || '').trim();
    const lastName = (this.contactForm.get('lastName')?.value || '').trim();
    const email = (this.contactForm.get('email')?.value || '').trim();

    // Need at least a first or last name to check
    if (!firstName && !lastName) return;

    // Avoid redundant API calls if values haven't changed
    const currentValues = `${firstName}|${lastName}|${email}`;
    if (currentValues === this.lastCheckedValues) return;
    this.lastCheckedValues = currentValues;

    // Reset dismissed state so new results can appear
    this.duplicateWarningDismissed.set(false);

    this.duplicateService
      .checkContactDuplicates({ firstName, lastName, email: email || undefined })
      .subscribe({
        next: (matches) => {
          this.potentialDuplicates.set(matches);
        },
        error: () => {
          // Silently fail -- duplicate check is non-critical
        },
      });
  }

  /** Dismiss the duplicate warning banner. */
  dismissDuplicateWarning(): void {
    this.duplicateWarningDismissed.set(true);
  }

  /** Submit the form -- create or update. */
  onSubmit(): void {
    if (this.contactForm.invalid) return;

    this.isSaving.set(true);
    const formValues = this.contactForm.value;

    if (this.isEditMode) {
      const request: UpdateContactRequest = {
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        email: formValues.email || null,
        phone: formValues.phone || null,
        mobilePhone: formValues.mobilePhone || null,
        jobTitle: formValues.jobTitle || null,
        department: formValues.department || null,
        address: formValues.address || null,
        city: formValues.city || null,
        state: formValues.state || null,
        country: formValues.country || null,
        postalCode: formValues.postalCode || null,
        description: formValues.description || null,
        companyId: this.selectedCompanyId(),
        customFields: this.customFieldValues,
      };

      this.contactService.update(this.contactId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open('Contact updated successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/contacts', this.contactId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('Failed to update contact', 'Close', {
            duration: 5000,
          });
        },
      });
    } else {
      const request: CreateContactRequest = {
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        email: formValues.email || null,
        phone: formValues.phone || null,
        mobilePhone: formValues.mobilePhone || null,
        jobTitle: formValues.jobTitle || null,
        department: formValues.department || null,
        address: formValues.address || null,
        city: formValues.city || null,
        state: formValues.state || null,
        country: formValues.country || null,
        postalCode: formValues.postalCode || null,
        description: formValues.description || null,
        companyId: this.selectedCompanyId(),
        customFields: this.customFieldValues,
      };

      this.contactService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreated.emit(created);
          } else {
            this.snackBar.open('Contact created successfully', 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/contacts', created.id]);
          }
        },
        error: () => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreateError.emit();
          } else {
            this.snackBar.open('Failed to create contact', 'Close', {
              duration: 5000,
            });
          }
        },
      });
    }
  }

  /** Trigger form submission programmatically (used by dialog wrapper). */
  triggerSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }
    this.onSubmit();
  }
}
