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
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  Observable,
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  of,
} from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor/rich-text-editor.component';
import { NoteService } from '../note.service';
import {
  NoteDetailDto,
  CreateNoteRequest,
  UpdateNoteRequest,
  NOTE_ENTITY_TYPES,
} from '../note.models';
import { CompanyService } from '../../companies/company.service';
import { CompanyDto } from '../../companies/company.models';
import { ContactService } from '../../contacts/contact.service';
import { ContactDto } from '../../contacts/contact.models';
import { DealService } from '../../deals/deal.service';
import { DealListDto } from '../../deals/deal.models';
import { QuoteService } from '../../quotes/quote.service';
import { QuoteListDto } from '../../quotes/quote.models';
import { RequestService } from '../../requests/request.service';
import { RequestListDto } from '../../requests/request.models';

/**
 * Note create/edit form component with rich text editor body.
 *
 * Features:
 * - Entity type selection (Company, Contact, Deal, Quote, Request)
 * - Entity search autocomplete based on selected entity type
 * - QueryParam pre-fill: reads entityType, entityId, entityName from query params
 *   when navigating from entity detail pages (e.g. /notes/new?entityType=Company&entityId={id}&entityName={name})
 * - Rich text body via RichTextEditorComponent (ngx-quill wrapper)
 *
 * Standalone component with inline template and styles.
 * Uses NoteService directly (not store) for create/update operations.
 */
@Component({
  selector: 'app-note-form',
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
    RichTextEditorComponent,
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

    .entity-option {
      display: flex;
      flex-direction: column;
    }

    .entity-option-name {
      font-weight: 500;
    }

    .entity-option-detail {
      font-size: 12px;
      color: var(--color-text-secondary);
    }

    .body-section {
      margin-bottom: 24px;
    }

    .body-section label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-secondary);
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
      @if (!dialogMode()) {
        <div class="form-header">
          <a mat-icon-button routerLink="/notes" [attr.aria-label]="'form.backToNotes' | transloco">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>{{ isEditMode ? ('form.editTitle' | transloco) : ('form.createTitle' | transloco) }}</h1>
        </div>
      }

      @if (isLoadingDetail()) {
        <div class="form-loading">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      } @else {
        <form [formGroup]="noteForm" (ngSubmit)="onSubmit()">
          <!-- Note Title -->
          <div class="form-section">
            <h3>{{ 'form.noteInformation' | transloco }}</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'form.title' | transloco }}</mat-label>
                <input matInput formControlName="title" required>
                @if (noteForm.controls['title'].hasError('required')) {
                  <mat-error>{{ 'form.titleRequired' | transloco }}</mat-error>
                }
                @if (noteForm.controls['title'].hasError('maxlength')) {
                  <mat-error>{{ 'form.titleMaxLength' | transloco }}</mat-error>
                }
              </mat-form-field>
            </div>
          </div>

          <!-- Entity Linking -->
          <div class="form-section">
            <h3>{{ 'form.linkedEntity' | transloco }}</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'form.entityType' | transloco }}</mat-label>
                <mat-select formControlName="entityType" required
                            (selectionChange)="onEntityTypeChanged()">
                  @for (type of entityTypes; track type.value) {
                    <mat-option [value]="type.value">{{ type.label }}</mat-option>
                  }
                </mat-select>
                @if (noteForm.controls['entityType'].hasError('required')) {
                  <mat-error>{{ 'form.entityTypeRequired' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ 'form.entity' | transloco }}</mat-label>
                <input matInput
                       [formControl]="entitySearchControl"
                       [matAutocomplete]="entityAuto"
                       [placeholder]="'form.searchEntity' | transloco"
                       required>
                <mat-autocomplete #entityAuto="matAutocomplete"
                                  [displayWith]="displayEntityName"
                                  (optionSelected)="onEntitySelected($event)">
                  @for (entity of entitySearchResults(); track entity.id) {
                    <mat-option [value]="entity">
                      <div class="entity-option">
                        <span class="entity-option-name">{{ entity.name }}</span>
                        @if (entity.detail) {
                          <span class="entity-option-detail">{{ entity.detail }}</span>
                        }
                      </div>
                    </mat-option>
                  }
                </mat-autocomplete>
                @if (noteForm.controls['entityId'].hasError('required')) {
                  <mat-error>{{ 'form.entityRequired' | transloco }}</mat-error>
                }
              </mat-form-field>
            </div>
          </div>

          <!-- Rich Text Body -->
          <div class="body-section">
            <label>{{ 'form.body' | transloco }} *</label>
            <app-rich-text-editor
              formControlName="body"
              [placeholder]="'form.bodyPlaceholder' | transloco"
              height="300px"
            />
            @if (noteForm.controls['body'].touched && noteForm.controls['body'].hasError('required')) {
              <mat-error style="margin-top: 4px;">{{ 'form.bodyRequired' | transloco }}</mat-error>
            }
          </div>

          <!-- Form actions -->
          @if (!dialogMode()) {
            <div class="form-actions">
              <button mat-button type="button" routerLink="/notes">{{ 'common.cancel' | transloco }}</button>
              <button mat-raised-button color="primary" type="submit"
                      [disabled]="noteForm.invalid || isSaving()">
                @if (isSaving()) {
                  <mat-spinner diameter="20"></mat-spinner>
                }
                {{ isEditMode ? ('form.saveChanges' | transloco) : ('form.createNote' | transloco) }}
              </button>
            </div>
          }
        </form>
      }
    </div>
  `,
})
export class NoteFormComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly noteService = inject(NoteService);
  private readonly companyService = inject(CompanyService);
  private readonly contactService = inject(ContactService);
  private readonly dealService = inject(DealService);
  private readonly quoteService = inject(QuoteService);
  private readonly requestService = inject(RequestService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translocoService = inject(TranslocoService);

  /** Optional dialog data injected when used inside EntityFormDialogComponent. */
  private readonly dialogData = inject(MAT_DIALOG_DATA, { optional: true }) as { prefill?: { entityType?: string; entityId?: string; entityName?: string } } | null;

  /** When true, hides form header/actions -- parent dialog provides those. */
  dialogMode = input(false);

  /** Emitted when entity is created in dialog mode. */
  entityCreated = output<any>();

  /** Emitted when entity creation fails in dialog mode. */
  entityCreateError = output<void>();

  /** Entity type options for the select dropdown. */
  readonly entityTypes = NOTE_ENTITY_TYPES;

  /** Whether this is an edit (vs create) form. */
  isEditMode = false;

  /** Note ID for edit mode. */
  private noteId = '';

  /** Loading state for fetching note detail in edit mode. */
  isLoadingDetail = signal(false);

  /** Saving/submitting state. */
  isSaving = signal(false);

  // ─── Entity Autocomplete State ─────────────────────────────────────────

  entitySearchResults = signal<{ id: string; name: string; detail?: string }[]>([]);
  entitySearchControl = new FormControl('');
  private readonly entitySearch$ = new Subject<string>();

  private readonly destroy$ = new Subject<void>();

  // ─── Reactive Form ─────────────────────────────────────────────────────

  noteForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    body: ['', Validators.required],
    entityType: ['', Validators.required],
    entityId: ['', Validators.required],
    entityName: [''],
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.noteId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEditMode = !!this.noteId;

    this.setupEntitySearch();

    if (this.isEditMode) {
      this.loadNoteForEdit();
    } else if (this.dialogMode() && this.dialogData?.prefill) {
      // Pre-fill from dialog data when used inside EntityFormDialogComponent
      this.prefillFromDialogData();
    } else {
      // QueryParam pre-fill for create mode
      this.prefillFromQueryParams();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Called by parent EntityFormDialogComponent to trigger form submission. */
  triggerSubmit(): void {
    this.onSubmit();
  }

  // ─── Dialog Pre-fill ──────────────────────────────────────────────────

  /**
   * Pre-fill form from dialog data when used inside EntityFormDialogComponent.
   */
  private prefillFromDialogData(): void {
    const prefill = this.dialogData?.prefill;
    if (!prefill) return;

    if (prefill.entityType) {
      this.noteForm.patchValue({ entityType: prefill.entityType });
    }
    if (prefill.entityId) {
      this.noteForm.patchValue({ entityId: prefill.entityId });
    }
    if (prefill.entityName) {
      this.noteForm.patchValue({ entityName: prefill.entityName });
      this.entitySearchControl.setValue(
        { id: prefill.entityId, name: prefill.entityName } as any,
      );
    }
  }

  // ─── QueryParam Pre-fill ───────────────────────────────────────────────

  /**
   * Read entityType, entityId, entityName from queryParams and pre-fill form.
   * Enables "Add Note" button from entity detail pages to pre-fill entity fields.
   * Example: /notes/new?entityType=Company&entityId={id}&entityName={name}
   */
  private prefillFromQueryParams(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    const entityType = queryParams.get('entityType');
    const entityId = queryParams.get('entityId');
    const entityName = queryParams.get('entityName');

    if (entityType) {
      this.noteForm.patchValue({ entityType });
    }
    if (entityId) {
      this.noteForm.patchValue({ entityId });
    }
    if (entityName) {
      this.noteForm.patchValue({ entityName });
      // Pre-fill the autocomplete display with the entity name
      this.entitySearchControl.setValue(
        { id: entityId, name: entityName } as any,
      );
    }
  }

  // ─── Entity Search Setup ───────────────────────────────────────────────

  private setupEntitySearch(): void {
    this.entitySearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.length < 1) return of([]);
          return this.searchEntities(term);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((results) => {
        this.entitySearchResults.set(results);
      });

    this.entitySearchControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.entitySearch$.next(value);
        }
      });
  }

  /**
   * Search entities based on currently selected entity type.
   * Returns a normalized array of { id, name, detail? } objects.
   */
  private searchEntities(
    term: string,
  ): Observable<{ id: string; name: string; detail?: string }[]> {
    const entityType = this.noteForm.get('entityType')?.value;
    if (!entityType) return of([]);

    const params = { search: term, pageSize: 10, page: 1 };

    switch (entityType) {
      case 'Company':
        return new Observable((subscriber) => {
          this.companyService.getList(params).subscribe({
            next: (result) => {
              subscriber.next(
                result.items.map((c: CompanyDto) => ({
                  id: c.id,
                  name: c.name,
                  detail: c.industry ?? undefined,
                })),
              );
              subscriber.complete();
            },
            error: () => {
              subscriber.next([]);
              subscriber.complete();
            },
          });
        });

      case 'Contact':
        return new Observable((subscriber) => {
          this.contactService.getList(params).subscribe({
            next: (result) => {
              subscriber.next(
                result.items.map((c: ContactDto) => ({
                  id: c.id,
                  name: c.fullName,
                  detail: c.companyName ?? undefined,
                })),
              );
              subscriber.complete();
            },
            error: () => {
              subscriber.next([]);
              subscriber.complete();
            },
          });
        });

      case 'Deal':
        return new Observable((subscriber) => {
          this.dealService.getList(params).subscribe({
            next: (result) => {
              subscriber.next(
                result.items.map((d: DealListDto) => ({
                  id: d.id,
                  name: d.title,
                  detail: d.companyName ?? undefined,
                })),
              );
              subscriber.complete();
            },
            error: () => {
              subscriber.next([]);
              subscriber.complete();
            },
          });
        });

      case 'Quote':
        return new Observable((subscriber) => {
          this.quoteService.getList(params).subscribe({
            next: (result) => {
              subscriber.next(
                result.items.map((q: QuoteListDto) => ({
                  id: q.id,
                  name: `${q.quoteNumber} - ${q.title}`,
                  detail: q.companyName ?? undefined,
                })),
              );
              subscriber.complete();
            },
            error: () => {
              subscriber.next([]);
              subscriber.complete();
            },
          });
        });

      case 'Request':
        return new Observable((subscriber) => {
          this.requestService.getList(params).subscribe({
            next: (result) => {
              subscriber.next(
                result.items.map((r: RequestListDto) => ({
                  id: r.id,
                  name: r.subject,
                  detail: r.contactName ?? undefined,
                })),
              );
              subscriber.complete();
            },
            error: () => {
              subscriber.next([]);
              subscriber.complete();
            },
          });
        });

      default:
        return of([]);
    }
  }

  /** When entity type changes, clear entity search and selection. */
  onEntityTypeChanged(): void {
    this.entitySearchControl.setValue('');
    this.entitySearchResults.set([]);
    this.noteForm.patchValue({ entityId: '', entityName: '' });
  }

  /** When an entity is selected from autocomplete. */
  onEntitySelected(event: any): void {
    const entity = event.option.value as { id: string; name: string };
    this.noteForm.patchValue({
      entityId: entity.id,
      entityName: entity.name,
    });
  }

  /** Display function for entity autocomplete. */
  displayEntityName = (entity: { id: string; name: string } | any): string => {
    return entity?.name ?? '';
  };

  // ─── Edit Mode: Load Existing Note ────────────────────────────────────

  private loadNoteForEdit(): void {
    this.isLoadingDetail.set(true);
    this.noteService.getById(this.noteId).subscribe({
      next: (note) => {
        this.noteForm.patchValue({
          title: note.title,
          body: note.body,
          entityType: note.entityType,
          entityId: note.entityId,
          entityName: note.entityName ?? '',
        });

        // Set entity search display
        if (note.entityName) {
          this.entitySearchControl.setValue(
            { id: note.entityId, name: note.entityName } as any,
          );
        }

        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.isLoadingDetail.set(false);
        this.snackBar.open(this.translocoService.translate('notes.messages.loadFailed'), this.translocoService.translate('common.close'), {
          duration: 5000,
        });
      },
    });
  }

  // ─── Submit ────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.noteForm.invalid) return;

    this.isSaving.set(true);
    const fv = this.noteForm.value;

    if (this.isEditMode) {
      const request: UpdateNoteRequest = {
        title: fv.title,
        body: fv.body,
      };

      this.noteService.update(this.noteId, request).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.translocoService.translate('notes.messages.updated'), this.translocoService.translate('common.close'), {
            duration: 3000,
          });
          this.router.navigate(['/notes', this.noteId]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.translocoService.translate('notes.messages.updateFailed'), this.translocoService.translate('common.close'), {
            duration: 5000,
          });
        },
      });
    } else {
      const request: CreateNoteRequest = {
        title: fv.title,
        body: fv.body,
        entityType: fv.entityType,
        entityId: fv.entityId,
        entityName: fv.entityName || null,
      };

      this.noteService.create(request).subscribe({
        next: (created) => {
          this.isSaving.set(false);
          this.snackBar.open(this.translocoService.translate('notes.messages.created'), this.translocoService.translate('common.close'), {
            duration: 3000,
          });
          if (this.dialogMode()) {
            this.entityCreated.emit(created);
          } else {
            this.router.navigate(['/notes', created.id]);
          }
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open(this.translocoService.translate('notes.messages.createFailed'), this.translocoService.translate('common.close'), {
            duration: 5000,
          });
          if (this.dialogMode()) {
            this.entityCreateError.emit();
          }
        },
      });
    }
  }
}
