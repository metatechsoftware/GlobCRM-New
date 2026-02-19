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
          <a mat-icon-button routerLink="/companies" aria-label="Back to companies">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>{{ isEditMode ? 'Edit Company' : 'New Company' }}</h1>
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
                  <a [routerLink]="['/companies', match.id]" target="_blank">
                    {{ match.name }}
                  </a>
                  <span class="duplicate-warning__details">
                    {{ match.website ? '(' + match.website + ')' : '' }} -- {{ match.score }}% match
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

        <form [formGroup]="companyForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Company Name</mat-label>
              <input matInput formControlName="name" required
                     (blur)="onNameOrWebsiteBlur()">
              @if (companyForm.controls['name'].hasError('required')) {
                <mat-error>Company name is required</mat-error>
              }
              @if (companyForm.controls['name'].hasError('maxlength')) {
                <mat-error>Company name cannot exceed 200 characters</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Industry</mat-label>
              <input matInput formControlName="industry">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Website</mat-label>
              <input matInput formControlName="website"
                     (blur)="onNameOrWebsiteBlur()">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Phone</mat-label>
              <input matInput formControlName="phone">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Company Size</mat-label>
              <input matInput formControlName="size">
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
              [entityType]="'Company'"
              [customFieldValues]="existingCustomFields"
              (valuesChanged)="onCustomFieldsChanged($event)" />
          </div>

          <!-- Form actions -->
          @if (!dialogMode()) {
            <div class="form-actions">
              <button mat-button type="button" routerLink="/companies">Cancel</button>
              <button mat-raised-button color="primary" type="submit"
                      [disabled]="companyForm.invalid || isSaving()">
                @if (isSaving()) {
                  <mat-spinner diameter="20"></mat-spinner>
                }
                {{ isEditMode ? 'Save Changes' : 'Create Company' }}
              </button>
            </div>
          }
        </form>
      }
    </div>
  `,
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
