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
  FormControl,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  of,
} from 'rxjs';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { DealService } from '../deal.service';
import { PipelineService } from '../pipeline.service';
import {
  DealDetailDto,
  CreateDealRequest,
  UpdateDealRequest,
  PipelineDto,
  PipelineStageDto,
} from '../deal.models';
import { CompanyService } from '../../companies/company.service';
import { CompanyDto } from '../../companies/company.models';
import {
  ProfileService,
  TeamMemberDto,
} from '../../profile/profile.service';

/**
 * Deal create/edit form component.
 * Renders deal fields with pipeline/stage cascade selection,
 * company autocomplete, owner selection, and custom fields.
 * Determines create vs edit mode from the presence of :id route param.
 */
@Component({
  selector: 'app-deal-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    CustomFieldFormComponent,
  ],
  providers: [provideNativeDateAdapter()],
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
        <a mat-icon-button routerLink="/deals" aria-label="Back to deals">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>{{ isEditMode ? 'Edit Deal' : 'New Deal' }}</h1>
      </div>

      @if (isLoadingDetail()) {
        <div class="form-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <form [formGroup]="dealForm" (ngSubmit)="onSubmit()">
          <!-- Deal Info Section -->
          <div class="form-section">
            <h3>Deal Information</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" required>
                @if (dealForm.controls['title'].hasError('required')) {
                  <mat-error>Title is required</mat-error>
                }
                @if (dealForm.controls['title'].hasError('maxlength')) {
                  <mat-error>Title cannot exceed 500 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Value</mat-label>
                <input matInput formControlName="value" type="number" min="0">
                <span matTextPrefix>$&nbsp;</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Probability (%)</mat-label>
                <input matInput formControlName="probability" type="number" min="0" max="100">
                <span matTextSuffix>&nbsp;%</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Expected Close Date</mat-label>
                <input matInput [matDatepicker]="closeDatePicker" formControlName="expectedCloseDate">
                <mat-datepicker-toggle matIconSuffix [for]="closeDatePicker"></mat-datepicker-toggle>
                <mat-datepicker #closeDatePicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
              </mat-form-field>
            </div>
          </div>

          <!-- Pipeline & Stage Section -->
          <div class="form-section">
            <h3>Pipeline & Stage</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Pipeline</mat-label>
                <mat-select formControlName="pipelineId" required>
                  @for (pipeline of pipelines(); track pipeline.id) {
                    <mat-option [value]="pipeline.id">{{ pipeline.name }}</mat-option>
                  }
                </mat-select>
                @if (dealForm.controls['pipelineId'].hasError('required')) {
                  <mat-error>Pipeline is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Stage</mat-label>
                <mat-select formControlName="pipelineStageId">
                  @for (stage of pipelineStages(); track stage.id) {
                    <mat-option [value]="stage.id">{{ stage.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          <!-- Company & Owner Section -->
          <div class="form-section">
            <h3>Company & Owner</h3>
            <div class="form-grid">
              <!-- Company autocomplete -->
              <mat-form-field appearance="outline">
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

              <!-- Owner select -->
              <mat-form-field appearance="outline">
                <mat-label>Owner</mat-label>
                <mat-select formControlName="ownerId">
                  <mat-option [value]="null">Unassigned</mat-option>
                  @for (member of teamMembers(); track member.id) {
                    <mat-option [value]="member.id">{{ member.firstName }} {{ member.lastName }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          <!-- Custom fields -->
          <div class="custom-fields-section">
            <h3>Custom Fields</h3>
            <app-custom-field-form
              [entityType]="'Deal'"
              [customFieldValues]="existingCustomFields"
              (valuesChanged)="onCustomFieldsChanged($event)" />
          </div>

          <!-- Form actions -->
          <div class="form-actions">
            <button mat-button type="button" routerLink="/deals">Cancel</button>
            <button mat-raised-button color="primary" type="submit"
                    [disabled]="dealForm.invalid || isSaving()">
              @if (isSaving()) {
                <mat-spinner diameter="20"></mat-spinner>
              }
              {{ isEditMode ? 'Save Changes' : 'Create Deal' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class DealFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly dealService = inject(DealService);
  private readonly pipelineService = inject(PipelineService);
  private readonly companyService = inject(CompanyService);
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);

  /** Whether this is an edit (vs create) form. */
  isEditMode = false;

  /** Deal ID for edit mode. */
  private dealId = '';

  /** Loading state for fetching deal detail in edit mode. */
  isLoadingDetail = signal(false);

  /** Saving/submitting state. */
  isSaving = signal(false);

  /** Existing custom field values for edit mode. */
  existingCustomFields: Record<string, any> | undefined;

  /** Custom field values captured from CustomFieldFormComponent. */
  private customFieldValues: Record<string, any> = {};

  /** Available pipelines. */
  pipelines = signal<PipelineDto[]>([]);

  /** Stages for the currently selected pipeline. */
  pipelineStages = signal<PipelineStageDto[]>([]);

  /** Team members for owner selection. */
  teamMembers = signal<TeamMemberDto[]>([]);

  /** Company autocomplete search results. */
  companySearchResults = signal<CompanyDto[]>([]);

  /** Currently selected company ID (nullable). */
  selectedCompanyId = signal<string | null>(null);

  /** Form control for company search input (separate from main form). */
  companySearchControl = new FormControl('');

  /** Subject for company search typeahead. */
  private readonly companySearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  /** Whether the user has manually overridden the probability value. */
  private probabilityManuallySet = false;

  /** Reactive form with all core deal fields. */
  dealForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(500)]],
    description: [''],
    value: [null as number | null],
    probability: [null as number | null],
    expectedCloseDate: [null as Date | null],
    pipelineId: ['', [Validators.required]],
    pipelineStageId: [null as string | null],
    ownerId: [null as string | null],
  });

  ngOnInit(): void {
    this.dealId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEditMode = !!this.dealId;

    // Load pipelines
    this.pipelineService.getAll().subscribe({
      next: (pipelines) => {
        this.pipelines.set(pipelines);
        // If creating and only one pipeline, auto-select it
        if (!this.isEditMode && pipelines.length === 1) {
          this.dealForm.patchValue({ pipelineId: pipelines[0].id });
        }
      },
      error: () => {},
    });

    // Load team members for owner dropdown
    this.profileService.getTeamDirectory({ pageSize: 100 }).subscribe({
      next: (result) => this.teamMembers.set(result.items),
      error: () => {},
    });

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

    // Pipeline-Stage cascade: when pipelineId changes, load stages
    this.dealForm.controls['pipelineId'].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((pipelineId) => {
        if (pipelineId) {
          this.loadStagesForPipeline(pipelineId);
        } else {
          this.pipelineStages.set([]);
          this.dealForm.patchValue({ pipelineStageId: null });
        }
      });

    // Track manual probability edits
    this.dealForm.controls['probability'].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.probabilityManuallySet = true;
      });

    if (this.isEditMode) {
      this.loadDealForEdit();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load stages for a pipeline, auto-selecting first stage if creating. */
  private loadStagesForPipeline(pipelineId: string): void {
    this.pipelineService.getStages(pipelineId).subscribe({
      next: (stages) => {
        const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
        this.pipelineStages.set(sorted);

        // Auto-select first stage if creating new deal
        if (!this.isEditMode && sorted.length > 0) {
          this.dealForm.patchValue({ pipelineStageId: sorted[0].id });

          // Also auto-set probability from stage's default if user hasn't manually set it
          if (!this.probabilityManuallySet && sorted[0].defaultProbability != null) {
            this.probabilityManuallySet = false; // Reset since this is auto-set
            this.dealForm.patchValue(
              { probability: sorted[0].defaultProbability },
              { emitEvent: false },
            );
          }
        }
      },
      error: () => {},
    });
  }

  /** Load existing deal data for editing. */
  private loadDealForEdit(): void {
    this.isLoadingDetail.set(true);
    this.dealService.getById(this.dealId).subscribe({
      next: (deal) => {
        // Set pipeline first, then stages will load via valueChanges
        this.dealForm.patchValue({
          title: deal.title,
          description: deal.description ?? '',
          value: deal.value,
          probability: deal.probability,
          expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null,
          pipelineId: deal.pipelineId,
          ownerId: deal.ownerId,
        });

        // Load stages and preserve the current stage selection
        if (deal.pipelineId) {
          this.pipelineService.getStages(deal.pipelineId).subscribe({
            next: (stages) => {
              const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
              this.pipelineStages.set(sorted);
              this.dealForm.patchValue({ pipelineStageId: deal.pipelineStageId });
            },
          });
        }

        // Set company link if exists
        if (deal.companyId && deal.companyName) {
          this.selectedCompanyId.set(deal.companyId);
          this.companySearchControl.setValue(
            { id: deal.companyId, name: deal.companyName } as any,
          );
        }

        this.existingCustomFields = deal.customFields;
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
        this.snackBar.open('Failed to load deal data', 'Close', {
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

  /** Submit the form -- create or update. */
  onSubmit(): void {
    if (this.dealForm.invalid) return;

    this.isSaving.set(true);
    const fv = this.dealForm.value;

    // Format date to ISO string if present
    const expectedCloseDate = fv.expectedCloseDate
      ? new Date(fv.expectedCloseDate).toISOString().split('T')[0]
      : null;

    if (this.isEditMode) {
      const request: UpdateDealRequest = {
        title: fv.title,
        description: fv.description || null,
        value: fv.value ?? null,
        probability: fv.probability ?? null,
        expectedCloseDate,
        pipelineId: fv.pipelineId,
        pipelineStageId: fv.pipelineStageId || null,
        companyId: this.selectedCompanyId(),
        ownerId: fv.ownerId || null,
        customFields: this.customFieldValues,
      };

      this.dealService.update(this.dealId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open('Deal updated successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/deals', this.dealId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('Failed to update deal', 'Close', {
            duration: 5000,
          });
        },
      });
    } else {
      const request: CreateDealRequest = {
        title: fv.title,
        description: fv.description || null,
        value: fv.value ?? null,
        probability: fv.probability ?? null,
        expectedCloseDate,
        pipelineId: fv.pipelineId,
        pipelineStageId: fv.pipelineStageId || null,
        companyId: this.selectedCompanyId(),
        ownerId: fv.ownerId || null,
        customFields: this.customFieldValues,
      };

      this.dealService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.snackBar.open('Deal created successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/deals', created.id]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('Failed to create deal', 'Close', {
            duration: 5000,
          });
        },
      });
    }
  }
}
