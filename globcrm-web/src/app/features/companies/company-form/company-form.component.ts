import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  input,
  output,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { CompanyService } from '../company.service';
import {
  CompanyDetailDto,
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '../company.models';
import { DuplicateService } from '../../duplicates/duplicate.service';
import { CompanyDuplicateMatch } from '../../duplicates/duplicate.models';

/**
 * Company create/edit form component.
 * Renders core company fields in a 2-column grid with custom field integration.
 * Determines create vs edit mode from the presence of :id route param.
 * Shows duplicate warning banner on create mode when potential duplicates are detected.
 */
@Component({
  selector: 'app-company-form',
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
    CustomFieldFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.dialog-mode]': 'dialogMode()' },
  templateUrl: './company-form.component.html',
  styleUrl: './company-form.component.scss',
})
export class CompanyFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly duplicateService = inject(DuplicateService);
  private readonly snackBar = inject(MatSnackBar);

  /** Dialog mode inputs/outputs. */
  dialogMode = input(false);
  entityCreated = output<any>();
  entityCreateError = output<void>();

  /** Whether this is an edit (vs create) form. */
  isEditMode = false;

  /** Company ID for edit mode. */
  private companyId = '';

  /** Loading state for fetching company detail in edit mode. */
  isLoadingDetail = signal(false);

  /** Saving/submitting state. */
  isSaving = signal(false);

  /** Existing custom field values for edit mode. */
  existingCustomFields: Record<string, any> | undefined;

  /** Custom field values captured from CustomFieldFormComponent. */
  private customFieldValues: Record<string, any> = {};

  /** Duplicate detection signals (create mode only). */
  potentialDuplicates = signal<CompanyDuplicateMatch[]>([]);
  duplicateWarningDismissed = signal(false);

  /** Track last checked values to avoid redundant API calls. */
  private lastCheckedValues = '';

  /** Reactive form with all core company fields. */
  companyForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    industry: [''],
    website: [''],
    phone: [''],
    email: [''],
    address: [''],
    city: [''],
    state: [''],
    country: [''],
    postalCode: [''],
    size: [''],
    description: [''],
  });

  ngOnInit(): void {
    if (!this.dialogMode()) {
      this.companyId = this.route.snapshot.paramMap.get('id') ?? '';
      this.isEditMode = !!this.companyId;
    }

    if (this.isEditMode) {
      this.loadCompanyForEdit();
    }
  }

  /** Load existing company data for editing. */
  private loadCompanyForEdit(): void {
    this.isLoadingDetail.set(true);
    this.companyService.getById(this.companyId).subscribe({
      next: (company) => {
        this.companyForm.patchValue({
          name: company.name,
          industry: company.industry ?? '',
          website: company.website ?? '',
          phone: company.phone ?? '',
          email: company.email ?? '',
          address: company.address ?? '',
          city: company.city ?? '',
          state: company.state ?? '',
          country: company.country ?? '',
          postalCode: company.postalCode ?? '',
          size: company.size ?? '',
          description: company.description ?? '',
        });
        this.existingCustomFields = company.customFields;
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
        this.snackBar.open('Failed to load company data', 'Close', {
          duration: 5000,
        });
      },
    });
  }

  /** Capture custom field value changes. */
  onCustomFieldsChanged(values: Record<string, any>): void {
    this.customFieldValues = values;
  }

  /**
   * On blur of name or website fields in CREATE mode,
   * check for potential duplicates via the API.
   */
  onNameOrWebsiteBlur(): void {
    // Only check duplicates in create mode (not edit mode)
    if (this.isEditMode) return;

    const name = (this.companyForm.get('name')?.value || '').trim();
    const website = (this.companyForm.get('website')?.value || '').trim();

    // Need at least a name to check
    if (!name) return;

    // Avoid redundant API calls if values haven't changed
    const currentValues = `${name}|${website}`;
    if (currentValues === this.lastCheckedValues) return;
    this.lastCheckedValues = currentValues;

    // Reset dismissed state so new results can appear
    this.duplicateWarningDismissed.set(false);

    this.duplicateService
      .checkCompanyDuplicates({ name, website: website || undefined })
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
    if (this.companyForm.invalid) return;

    this.isSaving.set(true);
    const formValues = this.companyForm.value;

    if (this.isEditMode) {
      const request: UpdateCompanyRequest = {
        name: formValues.name,
        industry: formValues.industry || null,
        website: formValues.website || null,
        phone: formValues.phone || null,
        email: formValues.email || null,
        address: formValues.address || null,
        city: formValues.city || null,
        state: formValues.state || null,
        country: formValues.country || null,
        postalCode: formValues.postalCode || null,
        size: formValues.size || null,
        description: formValues.description || null,
        customFields: this.customFieldValues,
      };

      this.companyService.update(this.companyId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open('Company updated successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/companies', this.companyId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('Failed to update company', 'Close', {
            duration: 5000,
          });
        },
      });
    } else {
      const request: CreateCompanyRequest = {
        name: formValues.name,
        industry: formValues.industry || null,
        website: formValues.website || null,
        phone: formValues.phone || null,
        email: formValues.email || null,
        address: formValues.address || null,
        city: formValues.city || null,
        state: formValues.state || null,
        country: formValues.country || null,
        postalCode: formValues.postalCode || null,
        size: formValues.size || null,
        description: formValues.description || null,
        customFields: this.customFieldValues,
      };

      this.companyService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreated.emit(created);
          } else {
            this.snackBar.open('Company created successfully', 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/companies', created.id]);
          }
        },
        error: () => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreateError.emit();
          } else {
            this.snackBar.open('Failed to create company', 'Close', {
              duration: 5000,
            });
          }
        },
      });
    }
  }

  /** Trigger form submission programmatically (used by dialog wrapper). */
  triggerSubmit(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }
    this.onSubmit();
  }
}
