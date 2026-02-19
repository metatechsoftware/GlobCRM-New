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
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
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
