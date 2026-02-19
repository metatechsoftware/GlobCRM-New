import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { SequenceStep, UpdateStepRequest } from '../sequence.models';
import {
  TemplatePickerDialogComponent,
  TemplatePickerResult,
} from './template-picker-dialog.component';

@Component({
  selector: 'app-step-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatDialogModule,
    CdkDragHandle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .step-item {
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      background: var(--surface, #fff);
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .step-item:hover {
      border-color: var(--primary, #f97316);
    }

    .step-item__collapsed {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
    }

    .step-item__drag-handle {
      cursor: grab;
      color: var(--text-secondary, #94a3b8);
      display: flex;
      align-items: center;
    }

    .step-item__drag-handle:active {
      cursor: grabbing;
    }

    .step-item__badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--primary, #f97316);
      color: white;
      font-size: 13px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-item__info {
      flex: 1;
      min-width: 0;
    }

    .step-item__template-name {
      font-weight: 500;
      font-size: 14px;
      color: var(--text-primary, #1e293b);
    }

    .step-item__delay {
      font-size: 12px;
      color: var(--text-secondary, #64748b);
      margin-top: 2px;
    }

    .step-item__actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .step-item__expanded {
      padding: 0 16px 16px;
      border-top: 1px solid var(--border-color, #e2e8f0);
    }

    .step-item__section {
      margin-top: 16px;
    }

    .step-item__section-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-secondary, #64748b);
      margin-bottom: 8px;
    }

    .step-item__template-select {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .step-item__template-preview {
      width: 100%;
      height: 120px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 4px;
      margin-top: 8px;
      pointer-events: none;
    }

    .step-item__delay-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .step-item__delay-field {
      flex: 1;
    }

    .step-item__edit-link {
      font-size: 12px;
      color: var(--primary, #f97316);
      cursor: pointer;
      text-decoration: none;
      margin-top: 4px;
      display: inline-block;
    }

    .step-item__edit-link:hover {
      text-decoration: underline;
    }
  `,
  template: `
    <!-- Collapsed View -->
    <div class="step-item">
      <div class="step-item__collapsed" (click)="toggleExpand()">
        <span class="step-item__drag-handle" cdkDragHandle>
          <mat-icon>drag_indicator</mat-icon>
        </span>

        <span class="step-item__badge">{{ step().stepNumber }}</span>

        <div class="step-item__info">
          <div class="step-item__template-name">
            {{ step().emailTemplateName || 'No template selected' }}
          </div>
          <div class="step-item__delay">
            {{ getDelaySummary() }}
          </div>
        </div>

        <div class="step-item__actions" (click)="$event.stopPropagation()">
          <button mat-icon-button
                  matTooltip="Delete step"
                  color="warn"
                  (click)="stepDeleted.emit()">
            <mat-icon>delete</mat-icon>
          </button>
          <button mat-icon-button (click)="toggleExpand()">
            <mat-icon>{{ expanded() ? 'expand_less' : 'expand_more' }}</mat-icon>
          </button>
        </div>
      </div>

      <!-- Expanded View -->
      @if (expanded()) {
        <div class="step-item__expanded">
          <!-- Template Selection -->
          <div class="step-item__section">
            <div class="step-item__section-label">Email Template</div>
            <div class="step-item__template-select">
              <button mat-stroked-button (click)="openTemplatePicker()">
                <mat-icon>drafts</mat-icon>
                {{ step().emailTemplateName || 'Select Template' }}
              </button>
              @if (step().emailTemplateId) {
                <a class="step-item__edit-link"
                   [href]="'/email-templates/' + step().emailTemplateId + '/edit'"
                   target="_blank">
                  Edit Template
                </a>
              }
            </div>
            @if (templatePreviewHtml()) {
              <iframe class="step-item__template-preview"
                      [srcdoc]="templatePreviewHtml()!"
                      sandbox
                      scrolling="no"
                      title="Template preview"></iframe>
            }
          </div>

          <!-- Subject Override -->
          <div class="step-item__section">
            <div class="step-item__section-label">Subject Line Override</div>
            <mat-form-field class="step-item__delay-field" appearance="outline">
              <mat-label>Subject (optional - defaults to template subject)</mat-label>
              <input matInput
                     [ngModel]="step().subjectOverride ?? ''"
                     (ngModelChange)="onSubjectChange($event)" />
            </mat-form-field>
          </div>

          <!-- Delay Configuration -->
          <div class="step-item__section">
            <div class="step-item__section-label">Delay</div>
            <div class="step-item__delay-row">
              <mat-form-field class="step-item__delay-field" appearance="outline">
                <mat-label>Wait (days)</mat-label>
                <input matInput
                       type="number"
                       min="0"
                       [ngModel]="step().delayDays"
                       (ngModelChange)="onDelayChange($event)" />
              </mat-form-field>
              <mat-form-field class="step-item__delay-field" appearance="outline">
                <mat-label>Send at (time)</mat-label>
                <input matInput
                       type="time"
                       [ngModel]="step().preferredSendTime ?? ''"
                       (ngModelChange)="onTimeChange($event)" />
              </mat-form-field>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class StepItemComponent {
  readonly step = input.required<SequenceStep>();
  readonly stepChanged = output<UpdateStepRequest>();
  readonly stepDeleted = output<void>();

  private readonly dialog = inject(MatDialog);

  readonly expanded = signal(false);
  readonly templatePreviewHtml = signal<string | null>(null);

  toggleExpand(): void {
    this.expanded.update((v) => !v);
  }

  getDelaySummary(): string {
    const s = this.step();
    const parts: string[] = [];

    if (s.stepNumber === 1 && s.delayDays === 0) {
      parts.push('Send immediately');
    } else if (s.delayDays === 0) {
      parts.push('No delay');
    } else {
      parts.push(`Wait ${s.delayDays} day${s.delayDays !== 1 ? 's' : ''}`);
    }

    if (s.preferredSendTime) {
      parts.push(`send at ${s.preferredSendTime}`);
    }

    return parts.join(', ');
  }

  openTemplatePicker(): void {
    const dialogRef = this.dialog.open(TemplatePickerDialogComponent, {
      width: '700px',
      maxHeight: '80vh',
      data: { selectedTemplateId: this.step().emailTemplateId },
    });

    dialogRef.afterClosed().subscribe((result: TemplatePickerResult | undefined) => {
      if (!result) return;

      this.stepChanged.emit({
        emailTemplateId: result.id,
      });
    });
  }

  onSubjectChange(value: string): void {
    this.stepChanged.emit({
      subjectOverride: value || '',
    });
  }

  onDelayChange(value: number): void {
    this.stepChanged.emit({
      delayDays: value,
    });
  }

  onTimeChange(value: string): void {
    this.stepChanged.emit({
      preferredSendTime: value || '',
    });
  }
}
