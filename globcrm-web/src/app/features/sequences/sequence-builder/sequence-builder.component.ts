import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  signal,
  effect,
} from '@angular/core';
import { CommonModule, TitleCasePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { SequenceStore } from '../sequence.store';
import { SequenceStep, UpdateStepRequest } from '../sequence.models';
import { StepItemComponent } from './step-item.component';
import {
  TemplatePickerDialogComponent,
  TemplatePickerResult,
} from './template-picker-dialog.component';

@Component({
  selector: 'app-sequence-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TitleCasePipe,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    TranslocoPipe,
    CdkDrag,
    CdkDropList,
    StepItemComponent,
  ],
  providers: [SequenceStore],
  templateUrl: './sequence-builder.component.html',
  styleUrl: './sequence-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SequenceBuilderComponent implements OnInit {
  /** Route param :id provided by withComponentInputBinding() */
  readonly id = input<string>();

  readonly store = inject(SequenceStore);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);

  readonly isEditMode = signal(false);
  readonly steps = signal<SequenceStep[]>([]);
  name = '';
  description = '';

  private sequenceLoaded = false;

  constructor() {
    // React to sequence loading in edit mode
    effect(() => {
      const seq = this.store.selectedSequence();
      if (seq && this.isEditMode() && !this.sequenceLoaded) {
        this.name = seq.name;
        this.description = seq.description ?? '';
        this.steps.set([...seq.steps]);
        this.sequenceLoaded = true;
      }
    });
  }

  ngOnInit(): void {
    const routeId = this.id();
    if (routeId) {
      this.isEditMode.set(true);
      this.store.loadSequence(routeId);
    }
  }

  goBack(): void {
    this.location.back();
  }

  onStepDrop(event: CdkDragDrop<SequenceStep[]>): void {
    const currentSteps = [...this.steps()];
    moveItemInArray(currentSteps, event.previousIndex, event.currentIndex);

    // Reassign step numbers
    const reordered = currentSteps.map((step, index) => ({
      ...step,
      stepNumber: index + 1,
    }));

    this.steps.set(reordered);

    // Persist reorder if in edit mode
    const routeId = this.id();
    if (routeId) {
      const stepIds = reordered.map((s) => s.id);
      this.store.reorderSteps(routeId, stepIds);
    }
  }

  onStepChanged(step: SequenceStep, changes: UpdateStepRequest): void {
    // Optimistic local update
    const updated = this.steps().map((s) => {
      if (s.id !== step.id) return s;

      return {
        ...s,
        ...(changes.emailTemplateId != null ? { emailTemplateId: changes.emailTemplateId } : {}),
        ...(changes.subjectOverride !== undefined ? { subjectOverride: changes.subjectOverride || null } : {}),
        ...(changes.delayDays != null ? { delayDays: changes.delayDays } : {}),
        ...(changes.preferredSendTime !== undefined ? { preferredSendTime: changes.preferredSendTime || null } : {}),
      };
    });
    this.steps.set(updated);

    // Persist if editing an existing sequence
    const routeId = this.id();
    if (routeId && step.id && !step.id.startsWith('temp-')) {
      this.store.updateStep(routeId, step.id, changes, (updatedStep) => {
        // Update with server response (includes template name)
        this.steps.set(
          this.steps().map((s) => (s.id === updatedStep.id ? updatedStep : s)),
        );
      });
    }
  }

  onStepDeleted(step: SequenceStep): void {
    const routeId = this.id();

    if (routeId && step.id && !step.id.startsWith('temp-')) {
      // Existing step: delete from server
      this.store.deleteStep(routeId, step.id, () => {
        const remaining = this.steps()
          .filter((s) => s.id !== step.id)
          .map((s, i) => ({ ...s, stepNumber: i + 1 }));
        this.steps.set(remaining);
        this.snackBar.open(this.transloco.translate('sequences.messages.stepDeleted'), this.transloco.translate('common.close'), { duration: 3000 });
      });
    } else {
      // Temp step: just remove locally
      const remaining = this.steps()
        .filter((s) => s.id !== step.id)
        .map((s, i) => ({ ...s, stepNumber: i + 1 }));
      this.steps.set(remaining);
    }
  }

  addStep(): void {
    const routeId = this.id();

    if (routeId) {
      // Edit mode: open template picker, then add via API
      const dialogRef = this.dialog.open(TemplatePickerDialogComponent, {
        width: '700px',
        maxHeight: '80vh',
      });

      dialogRef.afterClosed().subscribe((result: TemplatePickerResult | undefined) => {
        if (!result) return;

        this.store.addStep(
          routeId,
          {
            emailTemplateId: result.id,
            delayDays: this.steps().length === 0 ? 0 : 1,
            subjectOverride: null,
            preferredSendTime: null,
          },
          (step) => {
            this.steps.set([...this.steps(), step]);
          },
        );
      });
    } else {
      // Create mode: add a temporary step locally
      const tempStep: SequenceStep = {
        id: `temp-${Date.now()}`,
        stepNumber: this.steps().length + 1,
        emailTemplateId: '',
        emailTemplateName: null,
        subjectOverride: null,
        delayDays: this.steps().length === 0 ? 0 : 1,
        preferredSendTime: null,
        createdAt: new Date().toISOString(),
      };
      this.steps.set([...this.steps(), tempStep]);
    }
  }

  save(): void {
    if (!this.name) return;

    const routeId = this.id();

    if (routeId) {
      // Update existing sequence
      this.store.updateSequence(
        routeId,
        {
          name: this.name,
          description: this.description || null,
        },
        () => {
          this.snackBar.open(this.transloco.translate('sequences.messages.updated'), this.transloco.translate('common.close'), { duration: 3000 });
          this.router.navigate(['/sequences', routeId]);
        },
      );
    } else {
      // Create new sequence
      this.store.createSequence(
        {
          name: this.name,
          description: this.description || null,
        },
        (created) => {
          // If there are temp steps, add them via API
          const tempSteps = this.steps().filter((s) =>
            s.id.startsWith('temp-'),
          );

          if (tempSteps.length === 0) {
            this.snackBar.open('Sequence created.', 'Close', {
              duration: 3000,
            });
            this.router.navigate(['/sequences', created.id, 'edit']);
            return;
          }

          // Add steps sequentially
          let added = 0;
          for (const tempStep of tempSteps) {
            if (!tempStep.emailTemplateId) {
              added++;
              if (added === tempSteps.length) {
                this.snackBar.open(this.transloco.translate('sequences.messages.created'), this.transloco.translate('common.close'), {
                  duration: 3000,
                });
                this.router.navigate(['/sequences', created.id, 'edit']);
              }
              continue;
            }

            this.store.addStep(
              created.id,
              {
                emailTemplateId: tempStep.emailTemplateId,
                subjectOverride: tempStep.subjectOverride,
                delayDays: tempStep.delayDays,
                preferredSendTime: tempStep.preferredSendTime,
              },
              () => {
                added++;
                if (added === tempSteps.length) {
                  this.snackBar.open('Sequence created.', 'Close', {
                    duration: 3000,
                  });
                  this.router.navigate(['/sequences', created.id, 'edit']);
                }
              },
            );
          }
        },
      );
    }
  }
}
