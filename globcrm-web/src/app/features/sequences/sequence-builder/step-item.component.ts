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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SequenceStep, UpdateStepRequest } from '../sequence.models';
import {
  TemplatePickerDialogComponent,
  TemplatePickerResult,
} from './template-picker-dialog.component';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

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
    SafeHtmlPipe,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .step-item {
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-md, 8px);
      background: var(--color-surface, #fff);
      transition:
        border-color var(--duration-fast, 100ms) var(--ease-default),
        box-shadow var(--duration-fast, 100ms) var(--ease-default),
        transform var(--duration-fast, 100ms) var(--ease-default);
      position: relative;
      overflow: hidden;
    }

    .step-item::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--color-primary, #f97316);
      opacity: 0;
      transition: opacity var(--duration-fast, 100ms) var(--ease-default);
    }

    .step-item:hover {
      border-color: var(--color-primary, #f97316);
      box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.05));
      transform: translateY(-1px);
    }

    .step-item:hover::before {
      opacity: 1;
    }

    .step-item__collapsed {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-3, 12px) var(--space-4, 16px);
      cursor: pointer;
    }

    .step-item__drag-handle {
      cursor: grab;
      color: var(--color-text-muted, #9CA3AF);
      display: flex;
      align-items: center;
      transition: color var(--duration-fast, 100ms) var(--ease-default);
    }

    .step-item__drag-handle:hover {
      color: var(--color-text-secondary, #6B7280);
    }

    .step-item__drag-handle:active {
      cursor: grabbing;
      color: var(--color-primary, #f97316);
    }

    .step-item__badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full, 9999px);
      background: linear-gradient(135deg, var(--color-primary, #f97316) 0%, var(--color-primary-hover, #EA580C) 100%);
      color: var(--color-primary-fg, white);
      font-size: 12px;
      font-weight: var(--font-bold, 700);
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(249, 115, 22, 0.25);
    }

    .step-item__info {
      flex: 1;
      min-width: 0;
    }

    .step-item__template-name {
      font-weight: var(--font-semibold, 600);
      font-size: var(--text-base, 14px);
      color: var(--color-text, #1e293b);
    }

    .step-item__delay {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #64748b);
      margin-top: 2px;
    }

    .step-item__delay mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .step-item__actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      opacity: 0.5;
      transition: opacity var(--duration-fast, 100ms) var(--ease-default);
    }

    .step-item:hover .step-item__actions {
      opacity: 1;
    }

    .step-item__expanded {
      padding: var(--space-4, 16px);
      border-top: 1px solid var(--color-border-subtle, #f1f5f9);
      background: var(--color-bg-secondary, #F0F0EE);
      animation: stepExpandIn 0.2s var(--ease-out, ease-out) both;
    }

    @keyframes stepExpandIn {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .step-item__section {
      margin-top: var(--space-4, 16px);
    }

    .step-item__section:first-child {
      margin-top: 0;
    }

    .step-item__section-label {
      font-size: 11px;
      font-weight: var(--font-semibold, 600);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--color-text-secondary, #64748b);
      margin-bottom: var(--space-2, 8px);
    }

    .step-item__template-select {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .step-item__template-preview {
      width: 100%;
      height: 120px;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-sm, 4px);
      margin-top: var(--space-2, 8px);
      pointer-events: none;
    }

    .step-item__delay-row {
      display: flex;
      gap: var(--space-3, 12px);
      align-items: flex-start;
    }

    .step-item__delay-field {
      flex: 1;
    }

    .step-item__edit-link {
      font-size: var(--text-xs, 12px);
      color: var(--color-primary, #f97316);
      cursor: pointer;
      text-decoration: none;
      margin-top: var(--space-1, 4px);
      display: inline-flex;
      align-items: center;
      gap: var(--space-1, 4px);
      font-weight: var(--font-medium, 500);
      transition: color var(--duration-fast, 100ms) var(--ease-default);
    }

    .step-item__edit-link:hover {
      color: var(--color-primary-hover, #EA580C);
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
            {{ step().emailTemplateName || ('sequences.builder.stepItem.noTemplate' | transloco) }}
          </div>
          <div class="step-item__delay">
            <mat-icon>schedule</mat-icon>
            {{ getDelaySummary() }}
          </div>
        </div>

        <div class="step-item__actions" (click)="$event.stopPropagation()">
          <button mat-icon-button
                  [matTooltip]="'sequences.builder.stepItem.deleteStep' | transloco"
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
            <div class="step-item__section-label">{{ 'sequences.builder.stepItem.emailTemplate' | transloco }}</div>
            <div class="step-item__template-select">
              <button mat-stroked-button (click)="openTemplatePicker()">
                <mat-icon>drafts</mat-icon>
                {{ step().emailTemplateName || ('sequences.builder.stepItem.selectTemplate' | transloco) }}
              </button>
              @if (step().emailTemplateId) {
                <a class="step-item__edit-link"
                   [href]="'/email-templates/' + step().emailTemplateId + '/edit'"
                   target="_blank">
                  {{ 'sequences.builder.stepItem.editTemplate' | transloco }}
                </a>
              }
            </div>
            @if (templatePreviewHtml()) {
              <iframe class="step-item__template-preview"
                      [srcdoc]="templatePreviewHtml()! | safeHtml"
                      sandbox
                      scrolling="no"
                      [title]="'sequences.builder.stepItem.templatePreviewTitle' | transloco"></iframe>
            }
          </div>

          <!-- Subject Override -->
          <div class="step-item__section">
            <div class="step-item__section-label">{{ 'sequences.builder.stepItem.subjectOverride' | transloco }}</div>
            <mat-form-field class="step-item__delay-field" appearance="outline">
              <mat-label>{{ 'sequences.builder.stepItem.subjectPlaceholder' | transloco }}</mat-label>
              <input matInput
                     [ngModel]="step().subjectOverride ?? ''"
                     (ngModelChange)="onSubjectChange($event)" />
            </mat-form-field>
          </div>

          <!-- Delay Configuration -->
          <div class="step-item__section">
            <div class="step-item__section-label">{{ 'sequences.builder.stepItem.delay' | transloco }}</div>
            <div class="step-item__delay-row">
              <mat-form-field class="step-item__delay-field" appearance="outline">
                <mat-label>{{ 'sequences.builder.stepItem.waitDaysLabel' | transloco }}</mat-label>
                <input matInput
                       type="number"
                       min="0"
                       [ngModel]="step().delayDays"
                       (ngModelChange)="onDelayChange($event)" />
              </mat-form-field>
              <mat-form-field class="step-item__delay-field" appearance="outline">
                <mat-label>{{ 'sequences.builder.stepItem.sendAtLabel' | transloco }}</mat-label>
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
  private readonly transloco = inject(TranslocoService);

  readonly expanded = signal(false);
  readonly templatePreviewHtml = signal<string | null>(null);

  toggleExpand(): void {
    this.expanded.update((v) => !v);
  }

  getDelaySummary(): string {
    const s = this.step();
    const parts: string[] = [];

    if (s.stepNumber === 1 && s.delayDays === 0) {
      parts.push(this.transloco.translate('sequences.builder.stepItem.sendImmediately'));
    } else if (s.delayDays === 0) {
      parts.push(this.transloco.translate('sequences.builder.stepItem.noDelay'));
    } else {
      const key = s.delayDays === 1 ? 'sequences.builder.stepItem.waitDays' : 'sequences.builder.stepItem.waitDaysPlural';
      parts.push(this.transloco.translate(key, { count: s.delayDays }));
    }

    if (s.preferredSendTime) {
      parts.push(this.transloco.translate('sequences.builder.stepItem.sendAt', { time: s.preferredSendTime }));
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
