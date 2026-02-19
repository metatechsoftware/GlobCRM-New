import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { EntityPreviewDto } from '../../models/entity-preview.models';
import { MiniStageBarComponent } from './mini-stage-bar.component';

@Component({
  selector: 'app-lead-preview',
  standalone: true,
  imports: [MiniStageBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-fields">
      @if (data().pipelineStage; as stage) {
        <div class="field-row">
          <span class="field-label">Stage</span>
          <span class="field-value">{{ stage.currentStageName }}</span>
        </div>
        <app-mini-stage-bar
          [stages]="stage.allStages"
          [currentStageId]="stage.currentStageId"
          [currentSortOrder]="stage.currentSortOrder" />
      }
      @if (data().fields['email']; as email) {
        <div class="field-row">
          <span class="field-label">Email</span>
          <a class="field-value field-link" [href]="'mailto:' + email">{{ email }}</a>
        </div>
      }
      @if (data().fields['phone']; as phone) {
        <div class="field-row">
          <span class="field-label">Phone</span>
          <span class="field-value">{{ phone }}</span>
        </div>
      }
      @if (data().fields['companyName']; as companyName) {
        <div class="field-row">
          <span class="field-label">Company</span>
          <span class="field-value">{{ companyName }}</span>
        </div>
      }
      @if (data().fields['temperature']; as temp) {
        <div class="field-row">
          <span class="field-label">Temperature</span>
          <span class="field-value">
            <span class="temp-badge" [class]="'temp-' + temp.toString().toLowerCase()">{{ temp }}</span>
          </span>
        </div>
      }
      @if (data().fields['source']; as source) {
        <div class="field-row">
          <span class="field-label">Source</span>
          <span class="field-value">{{ source }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .preview-fields { display: flex; flex-direction: column; gap: 2px; }
    .field-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .field-label { font-size: 13px; color: var(--color-text-muted); }
    .field-value { font-size: 13px; text-align: right; color: var(--color-text); }
    .field-link { color: var(--color-primary); text-decoration: none; }
    .field-link:hover { text-decoration: underline; }
    .temp-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: capitalize;
    }
    .temp-hot { background-color: var(--color-danger-soft); color: var(--color-danger-text); }
    .temp-warm { background-color: var(--color-warning-soft); color: var(--color-warning-text); }
    .temp-cold { background-color: var(--color-info-soft); color: var(--color-info-text); }
  `],
})
export class LeadPreviewComponent {
  readonly data = input.required<EntityPreviewDto>();
}
