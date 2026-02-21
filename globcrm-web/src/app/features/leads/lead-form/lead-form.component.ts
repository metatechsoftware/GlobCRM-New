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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.dialog-mode]': 'dialogMode()' },
  templateUrl: './lead-form.component.html',
  styleUrl: './lead-form.component.scss',
})
export class LeadFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly leadService = inject(LeadService);
  private readonly profileService = inject(ProfileService);
  private readonly authStore = inject(AuthStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** Dialog mode inputs/outputs. */
  dialogMode = input(false);
  entityCreated = output<any>();
  entityCreateError = output<void>();

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
          this.snackBar.open(this.transloco.translate('form.validation.cannotEditConverted'), this.transloco.translate('common.close'), { duration: 5000 });
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
        this.snackBar.open(this.transloco.translate('messages.leadDataLoadFailed'), this.transloco.translate('common.close'), { duration: 5000 });
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
          this.snackBar.open(this.transloco.translate('messages.leadUpdated'), this.transloco.translate('common.close'), { duration: 3000 });
          this.router.navigate(['/leads', this.leadId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('messages.leadUpdateFailed'), this.transloco.translate('common.close'), { duration: 5000 });
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
          if (this.dialogMode()) {
            this.entityCreated.emit(created);
          } else {
            this.snackBar.open(this.transloco.translate('messages.leadCreated'), this.transloco.translate('common.close'), { duration: 3000 });
            this.router.navigate(['/leads', created.id]);
          }
        },
        error: () => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreateError.emit();
          } else {
            this.snackBar.open(this.transloco.translate('messages.leadCreateFailed'), this.transloco.translate('common.close'), { duration: 5000 });
          }
        },
      });
    }
  }

  /** Trigger form submission programmatically (used by dialog wrapper). */
  triggerSubmit(): void {
    if (this.leadForm.invalid) {
      this.leadForm.markAllAsTouched();
      return;
    }
    this.onSubmit();
  }
}
