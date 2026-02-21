import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  viewChild,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, debounceTime, takeUntil, switchMap, of, catchError, tap, EMPTY } from 'rxjs';
import { CustomFieldService } from '../../../../core/custom-fields/custom-field.service';
import { FieldInfo } from '../../../../core/custom-fields/custom-field.models';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-formula-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  templateUrl: './formula-editor.component.html',
  styleUrl: './formula-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormulaEditorComponent implements OnInit, OnDestroy {
  private readonly fieldService = inject(CustomFieldService);
  private readonly destroy$ = new Subject<void>();

  // Inputs
  readonly entityType = input.required<string>();
  readonly initialFormula = input<string>('');
  readonly excludeFieldId = input<string | null>(null);

  // Outputs
  readonly formulaChange = output<string>();
  readonly validationChange = output<{ valid: boolean; errors: string[] }>();

  // Form control
  readonly formulaControl = new FormControl('');

  // Template ref
  readonly formulaTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('formulaTextarea');

  // Signals
  readonly availableFields = signal<FieldInfo[]>([]);
  readonly showAutocomplete = signal(false);
  readonly autocompleteFilter = signal('');
  readonly autocompletePosition = signal({ top: 0, left: 0 });
  readonly validationErrors = signal<string[]>([]);
  readonly isValidating = signal(false);
  readonly previewResult = signal<any>(null);
  readonly previewError = signal<string | null>(null);
  readonly isPreviewLoading = signal(false);
  readonly showHelp = signal(false);

  // Computed signals
  readonly groupedFields = computed(() => {
    const fields = this.availableFields();
    const filter = this.autocompleteFilter().toLowerCase();
    const groups: Record<string, FieldInfo[]> = {};

    for (const field of fields) {
      if (filter && !field.name.toLowerCase().includes(filter) && !field.label.toLowerCase().includes(filter)) {
        continue;
      }
      if (!groups[field.category]) {
        groups[field.category] = [];
      }
      groups[field.category].push(field);
    }

    return groups;
  });

  readonly hasErrors = computed(() => this.validationErrors().length > 0);

  ngOnInit(): void {
    // Load available fields
    this.fieldService
      .getFieldRegistry(this.entityType())
      .pipe(takeUntil(this.destroy$))
      .subscribe((fields) => this.availableFields.set(fields));

    // Set initial formula value
    const initial = this.initialFormula();
    if (initial) {
      this.formulaControl.setValue(initial, { emitEvent: false });
    }

    // Subscribe to value changes with debounce
    this.formulaControl.valueChanges
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe((value) => {
        const expression = value ?? '';
        this.formulaChange.emit(expression);

        if (expression.trim()) {
          this.validateAndPreview(expression);
        } else {
          this.validationErrors.set([]);
          this.previewResult.set(null);
          this.previewError.set(null);
          this.validationChange.emit({ valid: true, errors: [] });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onKeyUp(event: KeyboardEvent): void {
    const textarea = this.formulaTextarea()?.nativeElement;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const value = textarea.value;

    if (event.key === '[') {
      this.showAutocomplete.set(true);
      this.autocompleteFilter.set('');
      this.updateAutocompletePosition(textarea);
      return;
    }

    if (this.showAutocomplete()) {
      if (event.key === ']' || event.key === 'Escape') {
        this.showAutocomplete.set(false);
        return;
      }

      // Find text between last '[' and cursor for filtering
      const textBeforeCursor = value.substring(0, cursorPos);
      const lastBracket = textBeforeCursor.lastIndexOf('[');
      if (lastBracket >= 0) {
        const filterText = textBeforeCursor.substring(lastBracket + 1);
        this.autocompleteFilter.set(filterText);
      } else {
        this.showAutocomplete.set(false);
      }
    }
  }

  insertField(field: FieldInfo): void {
    const textarea = this.formulaTextarea()?.nativeElement;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const value = textarea.value;

    // Find the last '[' before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastBracket = textBeforeCursor.lastIndexOf('[');

    if (lastBracket >= 0) {
      const before = value.substring(0, lastBracket);
      const after = value.substring(cursorPos);
      const newValue = `${before}[${field.name}]${after}`;

      this.formulaControl.setValue(newValue);

      // Set cursor position after the inserted field
      const newCursorPos = lastBracket + field.name.length + 2;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }

    this.showAutocomplete.set(false);
  }

  toggleHelp(): void {
    this.showHelp.update((v) => !v);
  }

  private updateAutocompletePosition(textarea: HTMLTextAreaElement): void {
    // Position the autocomplete below the textarea
    const rect = textarea.getBoundingClientRect();
    const parentRect = textarea.closest('.formula-editor')?.getBoundingClientRect();
    if (parentRect) {
      this.autocompletePosition.set({
        top: rect.bottom - parentRect.top + 4,
        left: 0,
      });
    } else {
      this.autocompletePosition.set({
        top: rect.height + 4,
        left: 0,
      });
    }
  }

  private validateAndPreview(expression: string): void {
    this.isValidating.set(true);
    this.isPreviewLoading.set(true);

    this.fieldService
      .validateFormula({
        entityType: this.entityType(),
        expression,
        excludeFieldId: this.excludeFieldId() ?? undefined,
      })
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.isValidating.set(false);
          this.isPreviewLoading.set(false);
          this.validationErrors.set(['Failed to validate formula']);
          this.validationChange.emit({ valid: false, errors: ['Failed to validate formula'] });
          return EMPTY;
        }),
      )
      .subscribe((result) => {
        this.validationErrors.set(result.errors);
        this.isValidating.set(false);
        this.validationChange.emit({ valid: result.valid, errors: result.errors });

        if (result.valid) {
          this.fieldService
            .previewFormula({
              entityType: this.entityType(),
              expression,
            })
            .pipe(
              takeUntil(this.destroy$),
              catchError(() => {
                this.isPreviewLoading.set(false);
                this.previewError.set('Failed to preview formula');
                this.previewResult.set(null);
                return EMPTY;
              }),
            )
            .subscribe((preview) => {
              this.isPreviewLoading.set(false);
              if (preview.error) {
                this.previewError.set(preview.error);
                this.previewResult.set(null);
              } else {
                this.previewError.set(null);
                this.previewResult.set(preview.value);
              }
            });
        } else {
          this.isPreviewLoading.set(false);
          this.previewResult.set(null);
          this.previewError.set(null);
        }
      });
  }
}
