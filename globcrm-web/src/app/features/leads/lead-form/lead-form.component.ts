import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
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
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { LeadService } from '../lead.service';
import {
  LeadDetailDto,
  LeadStageDto,
  LeadSourceDto,
  LeadTemperature,
  CreateLeadRequest,
  UpdateLeadRequest,
} from '../lead.models';
import {
  ProfileService,
  TeamMemberDto,
} from '../../profile/profile.service';

/**
 * Lead create/edit form component.
 * Renders all lead fields organized in logical sections: Contact Info,
 * Company, Lead Details (stage, source, temperature, owner), and Custom Fields.
 * Determines create vs edit mode from the presence of :id route param.
 */
@Component({
  selector: 'app-lead-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    CustomFieldFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

    .temperature-toggle-group {
      grid-column: 1 / -1;
      margin-bottom: 8px;
    }

    .temperature-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-bottom: 6px;
    }

    .temp-hot {
      --mat-standard-button-toggle-selected-state-background-color: #f44336;
      --mat-standard-button-toggle-selected-state-text-color: #fff;
    }

    .temp-warm {
      --mat-standard-button-toggle-selected-state-background-color: #ff9800;
      --mat-standard-button-toggle-selected-state-text-color: #fff;
    }

    .temp-cold {
      --mat-standard-button-toggle-selected-state-background-color: #2196f3;
      --mat-standard-button-toggle-selected-state-text-color: #fff;
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

    @media (max-width: 768px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="entity-form-container">
      <div class="form-header">
        <a mat-icon-button routerLink="/leads" aria-label="Back to leads">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>{{ isEditMode ? 'Edit Lead' : 'New Lead' }}</h1>
      </div>

      @if (isLoadingDetail()) {
        <div class="form-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <form [formGroup]="leadForm" (ngSubmit)="onSubmit()">
          <!-- Contact Information Section -->
          <div class="form-section">
            <h3>Contact Information</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>First Name</mat-label>
                <input matInput formControlName="firstName" required>
                @if (leadForm.controls['firstName'].hasError('required')) {
                  <mat-error>First name is required</mat-error>
                }
                @if (leadForm.controls['firstName'].hasError('maxlength')) {
                  <mat-error>Max 100 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Last Name</mat-label>
                <input matInput formControlName="lastName" required>
                @if (leadForm.controls['lastName'].hasError('required')) {
                  <mat-error>Last name is required</mat-error>
                }
                @if (leadForm.controls['lastName'].hasError('maxlength')) {
                  <mat-error>Max 100 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput formControlName="email" type="email">
                @if (leadForm.controls['email'].hasError('email')) {
                  <mat-error>Invalid email format</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone">
                @if (leadForm.controls['phone'].hasError('maxlength')) {
                  <mat-error>Max 50 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Mobile Phone</mat-label>
                <input matInput formControlName="mobilePhone">
                @if (leadForm.controls['mobilePhone'].hasError('maxlength')) {
                  <mat-error>Max 50 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Job Title</mat-label>
                <input matInput formControlName="jobTitle">
              </mat-form-field>
            </div>
          </div>

          <!-- Company Section -->
          <div class="form-section">
            <h3>Company</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Company Name</mat-label>
                <input matInput formControlName="companyName">
              </mat-form-field>
            </div>
          </div>

          <!-- Lead Details Section -->
          <div class="form-section">
            <h3>Lead Details</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Stage</mat-label>
                <mat-select formControlName="leadStageId" required>
                  @for (stage of stages(); track stage.id) {
                    <mat-option [value]="stage.id">{{ stage.name }}</mat-option>
                  }
                </mat-select>
                @if (leadForm.controls['leadStageId'].hasError('required')) {
                  <mat-error>Stage is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Source</mat-label>
                <mat-select formControlName="leadSourceId">
                  <mat-option [value]="null">None</mat-option>
                  @for (source of sources(); track source.id) {
                    <mat-option [value]="source.id">{{ source.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <!-- Temperature toggle -->
              <div class="temperature-toggle-group">
                <span class="temperature-label">Temperature</span>
                <mat-button-toggle-group formControlName="temperature" aria-label="Lead Temperature">
                  <mat-button-toggle value="hot" class="temp-hot">
                    Hot
                  </mat-button-toggle>
                  <mat-button-toggle value="warm" class="temp-warm">
                    Warm
                  </mat-button-toggle>
                  <mat-button-toggle value="cold" class="temp-cold">
                    Cold
                  </mat-button-toggle>
                </mat-button-toggle-group>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>Owner</mat-label>
                <mat-select formControlName="ownerId">
                  <mat-option [value]="null">Unassigned</mat-option>
                  @for (member of teamMembers(); track member.id) {
                    <mat-option [value]="member.id">{{ member.firstName }} {{ member.lastName }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
              </mat-form-field>
            </div>
          </div>

          <!-- Custom Fields -->
          <div class="custom-fields-section">
            <h3>Custom Fields</h3>
            <app-custom-field-form
              [entityType]="'Lead'"
              [customFieldValues]="existingCustomFields"
              (valuesChanged)="onCustomFieldsChanged($event)" />
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button mat-button type="button" routerLink="/leads">Cancel</button>
            <button mat-raised-button color="primary" type="submit"
                    [disabled]="leadForm.invalid || isSaving()">
              @if (isSaving()) {
                <mat-spinner diameter="20"></mat-spinner>
              }
              {{ isEditMode ? 'Save Changes' : 'Create Lead' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class LeadFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly leadService = inject(LeadService);
  private readonly profileService = inject(ProfileService);
  private readonly authStore = inject(AuthStore);
  private readonly snackBar = inject(MatSnackBar);

  /** Whether this is an edit (vs create) form. */
  isEditMode = false;

  /** Lead ID for edit mode. */
  private leadId = '';

  /** Loading state for fetching lead detail in edit mode. */
  isLoadingDetail = signal(false);

  /** Saving/submitting state. */
  isSaving = signal(false);

  /** Existing custom field values for edit mode. */
  existingCustomFields: Record<string, any> | undefined;

  /** Custom field values captured from CustomFieldFormComponent. */
  private customFieldValues: Record<string, any> = {};

  /** Available stages (non-terminal only for the form). */
  stages = signal<LeadStageDto[]>([]);

  /** Available sources. */
  sources = signal<LeadSourceDto[]>([]);

  /** Team members for owner selection. */
  teamMembers = signal<TeamMemberDto[]>([]);

  private readonly destroy$ = new Subject<void>();

  /** Reactive form with all lead fields. */
  leadForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.email]],
    phone: ['', [Validators.maxLength(50)]],
    mobilePhone: ['', [Validators.maxLength(50)]],
    jobTitle: [''],
    companyName: [''],
    leadStageId: ['', [Validators.required]],
    leadSourceId: [null as string | null],
    temperature: ['warm' as LeadTemperature],
    ownerId: [null as string | null],
    description: [''],
  });

  ngOnInit(): void {
    this.leadId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEditMode = !!this.leadId;

    // Load stages (filter to non-terminal for form selection)
    this.leadService.getStages().subscribe({
      next: (stages) => {
        const sorted = [...stages]
          .filter(s => !s.isConverted && !s.isLost)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        this.stages.set(sorted);

        // Default to first stage in create mode
        if (!this.isEditMode && sorted.length > 0) {
          this.leadForm.patchValue({ leadStageId: sorted[0].id });
        }
      },
      error: () => {},
    });

    // Load sources
    this.leadService.getSources().subscribe({
      next: (sources) => this.sources.set(sources),
      error: () => {},
    });

    // Load team members for owner dropdown
    this.profileService.getTeamDirectory({ pageSize: 100 }).subscribe({
      next: (result) => {
        this.teamMembers.set(result.items);

        // Default owner to current user in create mode
        if (!this.isEditMode) {
          const currentUserId = this.authStore.user()?.id;
          if (currentUserId) {
            this.leadForm.patchValue({ ownerId: currentUserId });
          }
        }
      },
      error: () => {},
    });

    if (this.isEditMode) {
      this.loadLeadForEdit();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load existing lead data for editing. */
  private loadLeadForEdit(): void {
    this.isLoadingDetail.set(true);
    this.leadService.getById(this.leadId).subscribe({
      next: (lead) => {
        // Redirect if lead is converted (cannot edit)
        if (lead.isConverted) {
          this.snackBar.open('Cannot edit a converted lead', 'Close', { duration: 5000 });
          this.router.navigate(['/leads', this.leadId]);
          return;
        }

        this.leadForm.patchValue({
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email ?? '',
          phone: lead.phone ?? '',
          mobilePhone: lead.mobilePhone ?? '',
          jobTitle: lead.jobTitle ?? '',
          companyName: lead.companyName ?? '',
          leadStageId: lead.leadStageId,
          leadSourceId: lead.leadSourceId,
          temperature: lead.temperature,
          ownerId: lead.ownerId,
          description: lead.description ?? '',
        });

        this.existingCustomFields = lead.customFields;
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
        this.snackBar.open('Failed to load lead data', 'Close', { duration: 5000 });
      },
    });
  }

  /** Capture custom field value changes. */
  onCustomFieldsChanged(values: Record<string, any>): void {
    this.customFieldValues = values;
  }

  /** Submit the form -- create or update. */
  onSubmit(): void {
    if (this.leadForm.invalid) return;

    this.isSaving.set(true);
    const fv = this.leadForm.value;

    if (this.isEditMode) {
      const request: UpdateLeadRequest = {
        firstName: fv.firstName,
        lastName: fv.lastName,
        email: fv.email || null,
        phone: fv.phone || null,
        mobilePhone: fv.mobilePhone || null,
        jobTitle: fv.jobTitle || null,
        companyName: fv.companyName || null,
        leadStageId: fv.leadStageId,
        leadSourceId: fv.leadSourceId || null,
        temperature: fv.temperature,
        ownerId: fv.ownerId || null,
        description: fv.description || null,
        customFields: this.customFieldValues,
      };

      this.leadService.update(this.leadId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open('Lead updated successfully', 'Close', { duration: 3000 });
          this.router.navigate(['/leads', this.leadId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('Failed to update lead', 'Close', { duration: 5000 });
        },
      });
    } else {
      const request: CreateLeadRequest = {
        firstName: fv.firstName,
        lastName: fv.lastName,
        email: fv.email || null,
        phone: fv.phone || null,
        mobilePhone: fv.mobilePhone || null,
        jobTitle: fv.jobTitle || null,
        companyName: fv.companyName || null,
        leadStageId: fv.leadStageId,
        leadSourceId: fv.leadSourceId || null,
        temperature: fv.temperature,
        ownerId: fv.ownerId || null,
        description: fv.description || null,
        customFields: this.customFieldValues,
      };

      this.leadService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.snackBar.open('Lead created successfully', 'Close', { duration: 3000 });
          this.router.navigate(['/leads', created.id]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('Failed to create lead', 'Close', { duration: 5000 });
        },
      });
    }
  }
}
