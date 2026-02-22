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
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatRadioModule } from '@angular/material/radio';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  of,
} from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LeadService } from '../lead.service';
import {
  LeadDetailDto,
  ConvertLeadRequest,
  ConvertLeadResult,
  DuplicateCheckResult,
  ContactMatchDto,
  CompanyMatchDto,
} from '../lead.models';
import { CompanyService } from '../../companies/company.service';
import { CompanyDto } from '../../companies/company.models';
import { PipelineService } from '../../deals/pipeline.service';
import { PipelineDto } from '../../deals/deal.models';

/**
 * Lead conversion dialog component.
 * Multi-section form with Contact (required), Company (optional toggle),
 * and Deal (optional toggle) sections. Includes duplicate detection warnings
 * for email and company name matches.
 */
@Component({
  selector: 'app-lead-convert-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatRadioModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TranslocoPipe,
  ],
  templateUrl: './lead-convert-dialog.component.html',
  styleUrl: './lead-convert-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadConvertDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<LeadConvertDialogComponent>);
  readonly data: { lead: LeadDetailDto } = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly leadService = inject(LeadService);
  private readonly companyService = inject(CompanyService);
  private readonly pipelineService = inject(PipelineService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  private readonly destroy$ = new Subject<void>();

  /** Duplicate check results. */
  duplicateResult = signal<DuplicateCheckResult | null>(null);
  duplicateLoading = signal(true);

  /** Company section toggle. */
  createCompanyEnabled = signal(false);
  companyMode = signal<'link' | 'create'>('create');

  /** Deal section toggle. */
  createDealEnabled = signal(false);

  /** Available pipelines for deal creation. */
  pipelines = signal<PipelineDto[]>([]);

  /** Company search results for autocomplete. */
  companySearchResults = signal<CompanyDto[]>([]);

  /** Saving state. */
  isSaving = signal(false);

  /** Contact form group. */
  contactForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.email]],
    phone: [''],
    mobilePhone: [''],
    jobTitle: [''],
  });

  /** Company form group. */
  companyForm: FormGroup = this.fb.group({
    existingCompanyId: [null as string | null],
    newCompanyName: [''],
    newCompanyWebsite: [''],
    newCompanyPhone: [''],
  });

  /** Company search control for autocomplete. */
  companySearchControl = new FormControl('');
  private readonly companySearch$ = new Subject<string>();

  /** Deal form group. */
  dealForm: FormGroup = this.fb.group({
    dealTitle: [''],
    dealValue: [null as number | null],
    dealPipelineId: [''],
  });

  /** Selected company for linking. */
  selectedCompanyId = signal<string | null>(null);

  ngOnInit(): void {
    const lead = this.data.lead;

    // Pre-fill contact form from lead data
    this.contactForm.patchValue({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      mobilePhone: lead.mobilePhone ?? '',
      jobTitle: lead.jobTitle ?? '',
    });

    // Pre-fill company name if available
    if (lead.companyName) {
      this.companyForm.patchValue({ newCompanyName: lead.companyName });
    }

    // Pre-fill deal title
    this.dealForm.patchValue({
      dealTitle: `${lead.fullName} - New Deal`,
    });

    // Run duplicate check immediately
    this.leadService.checkDuplicates(lead.id).subscribe({
      next: (result) => {
        this.duplicateResult.set(result);
        this.duplicateLoading.set(false);

        // If company matches found, pre-select "link to existing"
        if (result.companyMatches?.length > 0) {
          this.createCompanyEnabled.set(true);
          this.companyMode.set('link');
          this.selectedCompanyId.set(result.companyMatches[0].id);
          this.companySearchControl.setValue(
            { id: result.companyMatches[0].id, name: result.companyMatches[0].name } as any,
          );
        }
      },
      error: () => {
        this.duplicateLoading.set(false);
      },
    });

    // Load pipelines for deal section
    this.pipelineService.getAll().subscribe({
      next: (pipelines) => {
        this.pipelines.set(pipelines);
        if (pipelines.length > 0) {
          this.dealForm.patchValue({ dealPipelineId: pipelines[0].id });
        }
      },
      error: () => {},
    });

    // Setup company search autocomplete
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

    // Listen for company search input
    this.companySearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.companySearch$.next(value);
          // Clear selected company when user types
          this.selectedCompanyId.set(null);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Toggle company section. */
  onCompanyToggle(enabled: boolean): void {
    this.createCompanyEnabled.set(enabled);
    if (!enabled) {
      this.companyMode.set('create');
      this.selectedCompanyId.set(null);
    }
  }

  /** Toggle deal section. */
  onDealToggle(enabled: boolean): void {
    this.createDealEnabled.set(enabled);
  }

  /** Set company mode (link vs create). */
  onCompanyModeChange(mode: 'link' | 'create'): void {
    this.companyMode.set(mode);
    if (mode === 'create') {
      this.selectedCompanyId.set(null);
    }
  }

  /** Handle company selection from autocomplete. */
  onCompanySelected(event: any): void {
    const company = event.option.value as CompanyDto;
    this.selectedCompanyId.set(company.id);
  }

  /** Display function for company autocomplete. */
  displayCompanyName = (company: CompanyDto | any): string => {
    return company?.name ?? '';
  };

  /** Whether there are contact duplicate matches. */
  get hasContactMatches(): boolean {
    const result = this.duplicateResult();
    return (result?.contactMatches?.length ?? 0) > 0;
  }

  /** Whether there are company duplicate matches. */
  get hasCompanyMatches(): boolean {
    const result = this.duplicateResult();
    return (result?.companyMatches?.length ?? 0) > 0;
  }

  /** Submit conversion. */
  onConvert(): void {
    // Validate
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const contactFv = this.contactForm.value;
    const companyFv = this.companyForm.value;
    const dealFv = this.dealForm.value;

    // Validate company section
    if (this.createCompanyEnabled() && this.companyMode() === 'create') {
      if (!companyFv.newCompanyName?.trim()) {
        this.snackBar.open(this.transloco.translate('leads.convert.companyNameRequired'), this.transloco.translate('common.close'), { duration: 3000 });
        return;
      }
    }

    if (this.createCompanyEnabled() && this.companyMode() === 'link') {
      if (!this.selectedCompanyId()) {
        this.snackBar.open(this.transloco.translate('leads.convert.selectCompanyRequired'), this.transloco.translate('common.close'), { duration: 3000 });
        return;
      }
    }

    // Validate deal section
    if (this.createDealEnabled()) {
      if (!dealFv.dealTitle?.trim()) {
        this.snackBar.open(this.transloco.translate('leads.convert.dealTitleRequired'), this.transloco.translate('common.close'), { duration: 3000 });
        return;
      }
    }

    this.isSaving.set(true);

    const request: ConvertLeadRequest = {
      firstName: contactFv.firstName,
      lastName: contactFv.lastName,
      email: contactFv.email || null,
      phone: contactFv.phone || null,
      mobilePhone: contactFv.mobilePhone || null,
      jobTitle: contactFv.jobTitle || null,
      createCompany: this.createCompanyEnabled() && this.companyMode() === 'create',
      existingCompanyId:
        this.createCompanyEnabled() && this.companyMode() === 'link'
          ? this.selectedCompanyId()
          : null,
      newCompanyName:
        this.createCompanyEnabled() && this.companyMode() === 'create'
          ? companyFv.newCompanyName
          : null,
      newCompanyWebsite:
        this.createCompanyEnabled() && this.companyMode() === 'create'
          ? companyFv.newCompanyWebsite || null
          : null,
      newCompanyPhone:
        this.createCompanyEnabled() && this.companyMode() === 'create'
          ? companyFv.newCompanyPhone || null
          : null,
      createDeal: this.createDealEnabled(),
      dealTitle: this.createDealEnabled() ? dealFv.dealTitle : null,
      dealValue: this.createDealEnabled() ? dealFv.dealValue : null,
      dealPipelineId: this.createDealEnabled() ? dealFv.dealPipelineId || null : null,
    };

    this.leadService.convert(this.data.lead.id, request).subscribe({
      next: (result: ConvertLeadResult) => {
        this.isSaving.set(false);
        this.dialogRef.close(result);
      },
      error: () => {
        this.isSaving.set(false);
        this.snackBar.open(this.transloco.translate('leads.messages.leadConvertFailed'), this.transloco.translate('common.close'), { duration: 5000 });
      },
    });
  }

  /** Cancel and close dialog. */
  onCancel(): void {
    this.dialogRef.close(null);
  }
}
