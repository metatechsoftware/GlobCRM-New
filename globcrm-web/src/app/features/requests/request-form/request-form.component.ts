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
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, takeUntil } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { RequestService } from '../request.service';
import {
  RequestDetailDto,
  CreateRequestRequest,
  UpdateRequestRequest,
  REQUEST_PRIORITIES,
  REQUEST_CATEGORIES,
  RequestPriority,
} from '../request.models';
import { ContactService } from '../../contacts/contact.service';
import { CompanyService } from '../../companies/company.service';
import { ContactDto } from '../../contacts/contact.models';
import { CompanyDto } from '../../companies/company.models';
import {
  ProfileService,
  TeamMemberDto,
} from '../../profile/profile.service';

/**
 * Request create/edit form component.
 * Renders request fields with priority, category, contact/company autocomplete,
 * and team member assignment.
 * Determines create vs edit mode from the presence of :id route param.
 */
@Component({
  selector: 'app-request-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    CustomFieldFormComponent,
    TranslocoPipe,
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
        <a mat-icon-button routerLink="/requests" [attr.aria-label]="'requests.form.aria.backToRequests' | transloco">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>{{ isEditMode ? ('requests.form.editTitle' | transloco) : ('requests.form.createTitle' | transloco) }}</h1>
      </div>

      @if (isLoadingDetail()) {
        <div class="form-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <form [formGroup]="requestForm" (ngSubmit)="onSubmit()">
          <!-- Request Info Section -->
          <div class="form-section">
            <h3>{{ 'requests.form.sections.requestInfo' | transloco }}</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'requests.form.fields.subject' | transloco }}</mat-label>
                <input matInput formControlName="subject" required>
                @if (requestForm.controls['subject'].hasError('required')) {
                  <mat-error>{{ 'requests.form.validation.subjectRequired' | transloco }}</mat-error>
                }
                @if (requestForm.controls['subject'].hasError('maxlength')) {
                  <mat-error>{{ 'requests.form.validation.subjectMaxLength' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'requests.form.fields.priority' | transloco }}</mat-label>
                <mat-select formControlName="priority" required>
                  @for (p of priorities; track p.value) {
                    <mat-option [value]="p.value">{{ p.label }}</mat-option>
                  }
                </mat-select>
                @if (requestForm.controls['priority'].hasError('required')) {
                  <mat-error>{{ 'requests.form.validation.priorityRequired' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'requests.form.fields.category' | transloco }}</mat-label>
                <mat-select formControlName="category">
                  <mat-option [value]="null">{{ 'requests.form.fields.none' | transloco }}</mat-option>
                  @for (cat of categories; track cat) {
                    <mat-option [value]="cat">{{ cat }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <!-- Contact autocomplete -->
              <mat-form-field appearance="outline">
                <mat-label>{{ 'requests.form.fields.contact' | transloco }}</mat-label>
                <input matInput
                       [formControl]="contactSearchControl"
                       [matAutocomplete]="contactAuto"
                       (input)="onContactSearch($event)">
                <mat-autocomplete #contactAuto="matAutocomplete"
                                  [displayWith]="displayContact"
                                  (optionSelected)="onContactSelected($event)">
                  @if (contactSearchLoading()) {
                    <mat-option disabled>{{ 'requests.form.fields.searching' | transloco }}</mat-option>
                  }
                  @for (contact of contactResults(); track contact.id) {
                    <mat-option [value]="contact">
                      {{ contact.fullName }}
                    </mat-option>
                  }
                </mat-autocomplete>
                @if (selectedContactId()) {
                  <button matSuffix mat-icon-button (click)="clearContact($event)" [attr.aria-label]="'requests.form.aria.clearContact' | transloco">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </mat-form-field>

              <!-- Company autocomplete -->
              <mat-form-field appearance="outline">
                <mat-label>{{ 'requests.form.fields.company' | transloco }}</mat-label>
                <input matInput
                       [formControl]="companySearchControl"
                       [matAutocomplete]="companyAuto"
                       (input)="onCompanySearch($event)">
                <mat-autocomplete #companyAuto="matAutocomplete"
                                  [displayWith]="displayCompany"
                                  (optionSelected)="onCompanySelected($event)">
                  @if (companySearchLoading()) {
                    <mat-option disabled>{{ 'requests.form.fields.searching' | transloco }}</mat-option>
                  }
                  @for (company of companyResults(); track company.id) {
                    <mat-option [value]="company">
                      {{ company.name }}
                    </mat-option>
                  }
                </mat-autocomplete>
                @if (selectedCompanyId()) {
                  <button matSuffix mat-icon-button (click)="clearCompany($event)" [attr.aria-label]="'requests.form.aria.clearCompany' | transloco">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'requests.form.fields.assignedTo' | transloco }}</mat-label>
                <mat-select formControlName="assignedToId">
                  <mat-option [value]="null">{{ 'requests.form.fields.unassigned' | transloco }}</mat-option>
                  @for (member of teamMembers(); track member.id) {
                    <mat-option [value]="member.id">{{ member.firstName }} {{ member.lastName }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'requests.form.fields.description' | transloco }}</mat-label>
                <textarea matInput formControlName="description" rows="4"></textarea>
              </mat-form-field>
            </div>
          </div>

          <!-- Custom fields -->
          <div class="custom-fields-section">
            <h3>{{ 'requests.form.sections.customFields' | transloco }}</h3>
            <app-custom-field-form
              [entityType]="'Request'"
              [customFieldValues]="existingCustomFields"
              (valuesChanged)="onCustomFieldsChanged($event)" />
          </div>

          <!-- Form actions -->
          <div class="form-actions">
            <button mat-button type="button" routerLink="/requests">{{ 'common.cancel' | transloco }}</button>
            <button mat-raised-button color="primary" type="submit"
                    [disabled]="requestForm.invalid || isSaving()">
              @if (isSaving()) {
                <mat-spinner diameter="20"></mat-spinner>
              }
              {{ isEditMode ? ('requests.form.saveChanges' | transloco) : ('requests.form.createRequest' | transloco) }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class RequestFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly requestService = inject(RequestService);
  private readonly contactService = inject(ContactService);
  private readonly companyService = inject(CompanyService);
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** Expose constants for template. */
  readonly priorities = REQUEST_PRIORITIES;
  readonly categories = REQUEST_CATEGORIES;

  /** Whether this is an edit (vs create) form. */
  isEditMode = false;

  /** Request ID for edit mode. */
  private requestId = '';

  /** Loading state for fetching request detail in edit mode. */
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

  // ─── Contact Autocomplete ─────────────────────────────────────────────
  contactSearchControl = new FormControl('');
  contactResults = signal<ContactDto[]>([]);
  contactSearchLoading = signal(false);
  selectedContactId = signal<string | null>(null);
  private contactSearch$ = new Subject<string>();

  // ─── Company Autocomplete ─────────────────────────────────────────────
  companySearchControl = new FormControl('');
  companyResults = signal<CompanyDto[]>([]);
  companySearchLoading = signal(false);
  selectedCompanyId = signal<string | null>(null);
  private companySearch$ = new Subject<string>();

  /** Reactive form with all core request fields. */
  requestForm: FormGroup = this.fb.group({
    subject: ['', [Validators.required, Validators.maxLength(500)]],
    description: [''],
    priority: ['Medium' as RequestPriority, Validators.required],
    category: [null as string | null],
    contactId: [null as string | null],
    companyId: [null as string | null],
    assignedToId: [null as string | null],
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEditMode = !!idParam && idParam !== 'new';
    if (this.isEditMode) {
      this.requestId = idParam;
    }

    // Load team members for assignee dropdown
    this.profileService.getTeamDirectory({ pageSize: 100 }).subscribe({
      next: (result) => this.teamMembers.set(result.items),
      error: () => {},
    });

    // Setup autocomplete searches
    this.setupContactSearch();
    this.setupCompanySearch();

    if (this.isEditMode) {
      this.loadRequestForEdit();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Contact Autocomplete Methods ─────────────────────────────────────

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
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (result) => {
          this.contactResults.set(result.items);
          this.contactSearchLoading.set(false);
        },
        error: () => {
          this.contactSearchLoading.set(false);
        },
      });
  }

  onContactSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.contactSearch$.next(value);
  }

  onContactSelected(event: any): void {
    const contact: ContactDto = event.option.value;
    this.selectedContactId.set(contact.id);
    this.requestForm.patchValue({ contactId: contact.id });
  }

  clearContact(event: Event): void {
    event.stopPropagation();
    this.selectedContactId.set(null);
    this.contactSearchControl.setValue('');
    this.requestForm.patchValue({ contactId: null });
    this.contactResults.set([]);
  }

  displayContact(contact: any): string {
    return contact?.fullName ?? '';
  }

  // ─── Company Autocomplete Methods ─────────────────────────────────────

  private setupCompanySearch(): void {
    this.companySearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 2) {
            return of({ items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 });
          }
          this.companySearchLoading.set(true);
          return this.companyService.getList({ search: term, pageSize: 10 });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (result) => {
          this.companyResults.set(result.items);
          this.companySearchLoading.set(false);
        },
        error: () => {
          this.companySearchLoading.set(false);
        },
      });
  }

  onCompanySearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.companySearch$.next(value);
  }

  onCompanySelected(event: any): void {
    const company: CompanyDto = event.option.value;
    this.selectedCompanyId.set(company.id);
    this.requestForm.patchValue({ companyId: company.id });
  }

  clearCompany(event: Event): void {
    event.stopPropagation();
    this.selectedCompanyId.set(null);
    this.companySearchControl.setValue('');
    this.requestForm.patchValue({ companyId: null });
    this.companyResults.set([]);
  }

  displayCompany(company: any): string {
    return company?.name ?? '';
  }

  // ─── Edit Mode Loading ────────────────────────────────────────────────

  /** Load existing request data for editing. */
  private loadRequestForEdit(): void {
    this.isLoadingDetail.set(true);
    this.requestService.getById(this.requestId).subscribe({
      next: (request) => {
        this.requestForm.patchValue({
          subject: request.subject,
          description: request.description ?? '',
          priority: request.priority,
          category: request.category,
          contactId: request.contactId,
          companyId: request.companyId,
          assignedToId: request.assignedToId,
        });

        // Set contact autocomplete display
        if (request.contactId && request.contactName) {
          this.selectedContactId.set(request.contactId);
          this.contactSearchControl.setValue({ fullName: request.contactName } as any);
        }

        // Set company autocomplete display
        if (request.companyId && request.companyName) {
          this.selectedCompanyId.set(request.companyId);
          this.companySearchControl.setValue({ name: request.companyName } as any);
        }

        this.existingCustomFields = request.customFields;
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
        this.snackBar.open(this.transloco.translate('requests.messages.loadFailed'), 'Close', {
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
    if (this.requestForm.invalid) return;

    this.isSaving.set(true);
    const fv = this.requestForm.value;

    if (this.isEditMode) {
      const request: UpdateRequestRequest = {
        subject: fv.subject,
        description: fv.description || null,
        priority: fv.priority,
        category: fv.category || null,
        contactId: fv.contactId || null,
        companyId: fv.companyId || null,
        assignedToId: fv.assignedToId || null,
        customFields: this.customFieldValues,
      };

      this.requestService.update(this.requestId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('requests.messages.requestUpdated'), 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/requests', this.requestId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('requests.messages.requestUpdateFailed'), 'Close', {
            duration: 5000,
          });
        },
      });
    } else {
      const request: CreateRequestRequest = {
        subject: fv.subject,
        description: fv.description || null,
        priority: fv.priority,
        category: fv.category || null,
        contactId: fv.contactId || null,
        companyId: fv.companyId || null,
        assignedToId: fv.assignedToId || null,
        customFields: this.customFieldValues,
      };

      this.requestService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('requests.messages.requestCreated'), 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/requests', created.id]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.transloco.translate('requests.messages.requestCreateFailed'), 'Close', {
            duration: 5000,
          });
        },
      });
    }
  }
}
