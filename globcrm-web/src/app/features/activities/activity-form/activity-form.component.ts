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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { ActivityService } from '../activity.service';
import {
  ActivityDetailDto,
  CreateActivityRequest,
  UpdateActivityRequest,
  ACTIVITY_TYPES,
  ACTIVITY_PRIORITIES,
  ActivityType,
  ActivityPriority,
} from '../activity.models';
import {
  ProfileService,
  TeamMemberDto,
} from '../../profile/profile.service';

/**
 * Activity create/edit form component.
 * Renders activity fields with type, priority, assignee selection, and custom fields.
 * Determines create vs edit mode from the presence of :id route param.
 */
@Component({
  selector: 'app-activity-form',
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
    CustomFieldFormComponent,
    TranslocoPipe,
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
          <a mat-icon-button routerLink="/activities" aria-label="Back to activities">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>{{ isEditMode ? ('activities.form.editTitle' | transloco) : ('activities.form.createTitle' | transloco) }}</h1>
        </div>
      }

      @if (isLoadingDetail()) {
        <div class="form-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <form [formGroup]="activityForm" (ngSubmit)="onSubmit()">
          <!-- Activity Info Section -->
          <div class="form-section">
            <h3>{{ 'activities.form.sections.activityInfo' | transloco }}</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'activities.form.fields.subject' | transloco }}</mat-label>
                <input matInput formControlName="subject" required>
                @if (activityForm.controls['subject'].hasError('required')) {
                  <mat-error>{{ 'activities.form.validation.subjectRequired' | transloco }}</mat-error>
                }
                @if (activityForm.controls['subject'].hasError('minlength')) {
                  <mat-error>{{ 'activities.form.validation.subjectMinLength' | transloco }}</mat-error>
                }
                @if (activityForm.controls['subject'].hasError('maxlength')) {
                  <mat-error>{{ 'activities.form.validation.subjectMaxLength' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'activities.form.fields.type' | transloco }}</mat-label>
                <mat-select formControlName="type" required>
                  @for (t of activityTypes; track t.value) {
                    <mat-option [value]="t.value">
                      <mat-icon>{{ t.icon }}</mat-icon> {{ t.label }}
                    </mat-option>
                  }
                </mat-select>
                @if (activityForm.controls['type'].hasError('required')) {
                  <mat-error>{{ 'activities.form.validation.typeRequired' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'activities.form.fields.priority' | transloco }}</mat-label>
                <mat-select formControlName="priority" required>
                  @for (p of activityPriorities; track p.value) {
                    <mat-option [value]="p.value">{{ p.label }}</mat-option>
                  }
                </mat-select>
                @if (activityForm.controls['priority'].hasError('required')) {
                  <mat-error>{{ 'activities.form.validation.priorityRequired' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'activities.form.fields.dueDate' | transloco }}</mat-label>
                <input matInput [matDatepicker]="dueDatePicker" formControlName="dueDate">
                <mat-datepicker-toggle matIconSuffix [for]="dueDatePicker"></mat-datepicker-toggle>
                <mat-datepicker #dueDatePicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'activities.form.fields.assignedTo' | transloco }}</mat-label>
                <mat-select formControlName="assignedToId">
                  <mat-option [value]="null">{{ 'activities.form.fields.unassigned' | transloco }}</mat-option>
                  @for (member of teamMembers(); track member.id) {
                    <mat-option [value]="member.id">{{ member.firstName }} {{ member.lastName }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'activities.form.fields.description' | transloco }}</mat-label>
                <textarea matInput formControlName="description" rows="4"
                          cdkTextareaAutosize></textarea>
              </mat-form-field>
            </div>
          </div>

          <!-- Custom fields -->
          <div class="custom-fields-section">
            <h3>{{ 'activities.form.sections.customFields' | transloco }}</h3>
            <app-custom-field-form
              [entityType]="'Activity'"
              [customFieldValues]="existingCustomFields"
              (valuesChanged)="onCustomFieldsChanged($event)" />
          </div>

          <!-- Form actions -->
          @if (!dialogMode()) {
            <div class="form-actions">
              <button mat-button type="button" routerLink="/activities">{{ 'common.cancel' | transloco }}</button>
              <button mat-raised-button color="primary" type="submit"
                      [disabled]="activityForm.invalid || isSaving()">
                @if (isSaving()) {
                  <mat-spinner diameter="20"></mat-spinner>
                }
                {{ isEditMode ? ('activities.form.saveChanges' | transloco) : ('activities.form.createActivity' | transloco) }}
              </button>
            </div>
          }
        </form>
      }
    </div>
  `,
})
export class ActivityFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly activityService = inject(ActivityService);
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** Dialog mode inputs/outputs. */
  dialogMode = input(false);
  entityCreated = output<any>();
  entityCreateError = output<void>();

  /** Expose constants for template. */
  readonly activityTypes = ACTIVITY_TYPES;
  readonly activityPriorities = ACTIVITY_PRIORITIES;

  /** Whether this is an edit (vs create) form. */
  isEditMode = false;

  /** Activity ID for edit mode. */
  private activityId = '';

  /** Loading state for fetching activity detail in edit mode. */
  isLoadingDetail = signal(false);

  /** Saving/submitting state. */
  isSaving = signal(false);

  /** Existing custom field values for edit mode. */
  existingCustomFields: Record<string, any> | undefined;

  /** Custom field values captured from CustomFieldFormComponent. */
  private customFieldValues: Record<string, any> = {};

  /** Team members for assignee selection. */
  teamMembers = signal<TeamMemberDto[]>([]);

  /** Destroy subject for unsubscribing. */
  private readonly destroy$ = new Subject<void>();

  /** Reactive form with all core activity fields. */
  activityForm: FormGroup = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
    description: [''],
    type: ['Task' as ActivityType, [Validators.required]],
    priority: ['Medium' as ActivityPriority, [Validators.required]],
    dueDate: [null as Date | null],
    assignedToId: [null as string | null],
  });

  ngOnInit(): void {
    if (!this.dialogMode()) {
      const idParam = this.route.snapshot.paramMap.get('id') ?? '';
      this.isEditMode = !!idParam && idParam !== 'new';
      if (this.isEditMode) {
        this.activityId = idParam;
      }
    }

    // Load team members for assignee dropdown
    this.profileService.getTeamDirectory({ pageSize: 100 }).subscribe({
      next: (result) => this.teamMembers.set(result.items),
      error: () => {},
    });

    if (this.isEditMode) {
      this.loadActivityForEdit();
    } else if (!this.dialogMode()) {
      // In create mode, pre-fill dueDate from queryParams (e.g., from calendar date click)
      const dueDateParam = this.route.snapshot.queryParamMap.get('dueDate');
      if (dueDateParam) {
        this.activityForm.patchValue({ dueDate: new Date(dueDateParam) });
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Load existing activity data for editing. */
  private loadActivityForEdit(): void {
    this.isLoadingDetail.set(true);
    this.activityService.getById(this.activityId).subscribe({
      next: (activity) => {
        this.activityForm.patchValue({
          subject: activity.subject,
          description: activity.description ?? '',
          type: activity.type,
          priority: activity.priority,
          dueDate: activity.dueDate ? new Date(activity.dueDate) : null,
          assignedToId: activity.assignedToId,
        });

        this.existingCustomFields = activity.customFields;
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
        this.snackBar.open(this.transloco.translate('activities.messages.loadFailed'), 'Close', {
          duration: 5000,
        });
      },
    });
  }

  /** Capture custom field value changes. */
  onCustomFieldsChanged(values: Record<string, any>): void {
    this.customFieldValues = values;
  }

  /** Submit the form -- create or update. */
  onSubmit(): void {
    if (this.activityForm.invalid) return;

    this.isSaving.set(true);
    const fv = this.activityForm.value;

    // Format date to ISO string if present
    const dueDate = fv.dueDate
      ? new Date(fv.dueDate).toISOString().split('T')[0]
      : null;

    if (this.isEditMode) {
      const request: UpdateActivityRequest = {
        subject: fv.subject,
        description: fv.description || null,
        type: fv.type,
        priority: fv.priority,
        dueDate,
        assignedToId: fv.assignedToId || null,
        customFields: this.customFieldValues,
      };

      this.activityService.update(this.activityId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('activities.messages.activityUpdated'), 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/activities', this.activityId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('activities.messages.activityUpdateFailed'), 'Close', {
            duration: 5000,
          });
        },
      });
    } else {
      const request: CreateActivityRequest = {
        subject: fv.subject,
        description: fv.description || null,
        type: fv.type,
        priority: fv.priority,
        dueDate,
        assignedToId: fv.assignedToId || null,
        customFields: this.customFieldValues,
      };

      this.activityService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreated.emit(created);
          } else {
            this.snackBar.open(this.transloco.translate('activities.messages.activityCreated'), 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/activities', created.id]);
          }
        },
        error: () => {
          this.isSaving.set(false);
          if (this.dialogMode()) {
            this.entityCreateError.emit();
          } else {
            this.snackBar.open(this.transloco.translate('activities.messages.activityCreateFailed'), 'Close', {
              duration: 5000,
            });
          }
        },
      });
    }
  }

  /** Trigger form submission programmatically (used by dialog wrapper). */
  triggerSubmit(): void {
    if (this.activityForm.invalid) {
      this.activityForm.markAllAsTouched();
      return;
    }
    this.onSubmit();
  }
}
