import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { EntityPreviewDto } from '../../models/entity-preview.models';

@Component({
  selector: 'app-activity-preview',
  standalone: true,
  imports: [DatePipe, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-fields">
      @if (data().fields['type']; as type) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.type' | transloco }}</span>
          <span class="field-value">{{ type }}</span>
        </div>
      }
      @if (data().fields['status']; as status) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.status' | transloco }}</span>
          <span class="field-value">{{ status }}</span>
        </div>
      }
      @if (data().fields['priority']; as priority) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.priority' | transloco }}</span>
          <span class="field-value">
            <span class="priority-badge" [class]="'priority-' + priority.toString().toLowerCase()">{{ priority }}</span>
          </span>
        </div>
      }
      @if (data().fields['dueDate']; as dueDate) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.dueDate' | transloco }}</span>
          <span class="field-value">{{ dueDate | date:'mediumDate' }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .preview-fields { display: flex; flex-direction: column; gap: 2px; }
    .field-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .field-label { font-size: 13px; color: var(--color-text-muted); }
    .field-value { font-size: 13px; text-align: right; color: var(--color-text); }
    .priority-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: capitalize;
    }
    .priority-high, .priority-urgent { background-color: var(--color-danger-soft); color: var(--color-danger-text); }
    .priority-medium, .priority-normal { background-color: var(--color-warning-soft); color: var(--color-warning-text); }
    .priority-low { background-color: var(--color-info-soft); color: var(--color-info-text); }
  `],
})
export class ActivityPreviewComponent {
  readonly data = input.required<EntityPreviewDto>();
}
