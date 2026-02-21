import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Router } from '@angular/router';
import { BoardStore } from '../boards.store';
import {
  BoardVisibility,
  BOARD_TEMPLATES,
  BOARD_COLOR_PRESETS,
  BoardTemplate,
  CreateBoardRequest,
} from '../boards.models';

interface DialogData {
  templateKey: string | null;
}

@Component({
  selector: 'app-board-create-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    TranslocoPipe,
  ],
  templateUrl: './board-create-dialog.component.html',
  styleUrl: './board-create-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardCreateDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<BoardCreateDialogComponent>);
  private readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private readonly boardStore = inject(BoardStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  readonly templates = BOARD_TEMPLATES;
  readonly colorPresets = BOARD_COLOR_PRESETS;

  readonly selectedTemplate = signal<string | null>(this.data?.templateKey ?? null);
  readonly step = signal<'template' | 'details'>(
    this.data?.templateKey ? 'details' : 'template',
  );
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    color: [this.colorPresets[0]],
    visibility: ['private' as BoardVisibility],
  });

  readonly blankTemplate: BoardTemplate = {
    key: '',
    nameKey: 'boards.templates.blank.name',
    descriptionKey: 'boards.templates.blank.description',
    icon: 'dashboard_customize',
    columns: [],
  };

  get selectedTemplateObj(): BoardTemplate | null {
    const key = this.selectedTemplate();
    if (key === '') return this.blankTemplate;
    if (!key) return null;
    return this.templates.find((t) => t.key === key) ?? null;
  }

  selectTemplate(key: string): void {
    this.selectedTemplate.set(key);
    this.step.set('details');
  }

  goBackToTemplates(): void {
    this.step.set('template');
  }

  selectColor(color: string): void {
    this.form.patchValue({ color });
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.error.set(null);

    const formValue = this.form.getRawValue();
    const templateKey = this.selectedTemplate();

    const req: CreateBoardRequest = {
      name: formValue.name,
      description: formValue.description || null,
      color: formValue.color,
      visibility: formValue.visibility,
      templateKey: templateKey || null,
    };

    this.boardStore.createBoard(
      req,
      (board) => {
        this.isSubmitting.set(false);
        this.snackBar.open(
          this.transloco.translate('boards.snackbar.created'),
          '',
          { duration: 3000 },
        );
        this.dialogRef.close({ created: true });
        this.router.navigate(['/boards', board.id]);
      },
      (err) => {
        this.isSubmitting.set(false);
        this.error.set(this.transloco.translate('boards.snackbar.error'));
      },
    );
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
