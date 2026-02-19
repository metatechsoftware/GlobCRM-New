import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CurrencyPipe, PercentPipe, DatePipe } from '@angular/common';
import { EntityPreviewDto } from '../../models/entity-preview.models';
import { MiniStageBarComponent } from './mini-stage-bar.component';

@Component({
  selector: 'app-deal-preview',
  standalone: true,
  imports: [CurrencyPipe, PercentPipe, DatePipe, MiniStageBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-fields">
      @if (data().pipelineStage; as stage) {
        <div class="field-row">
          <span class="field-label">Pipeline</span>
          <span class="field-value">{{ stage.pipelineName }}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Stage</span>
          <span class="field-value">{{ stage.currentStageName }}</span>
        </div>
        <app-mini-stage-bar
          [stages]="stage.allStages"
          [currentStageId]="stage.currentStageId"
          [currentSortOrder]="stage.currentSortOrder" />
      }
      @if (data().fields['value'] != null) {
        <div class="field-row">
          <span class="field-label">Value</span>
          <span class="field-value">{{ data().fields['value'] | currency:'USD':'symbol':'1.0-0' }}</span>
        </div>
      }
      @if (data().fields['probability'] != null) {
        <div class="field-row">
          <span class="field-label">Probability</span>
          <span class="field-value">{{ data().fields['probability'] / 100 | percent:'1.0-0' }}</span>
        </div>
      }
      @if (data().fields['expectedCloseDate']; as closeDate) {
        <div class="field-row">
          <span class="field-label">Expected Close</span>
          <span class="field-value">{{ closeDate | date:'mediumDate' }}</span>
        </div>
      }
      @if (data().fields['companyName']; as companyName) {
        <div class="field-row">
          <span class="field-label">Company</span>
          <span class="field-value">{{ companyName }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .preview-fields { display: flex; flex-direction: column; gap: 2px; }
    .field-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .field-label { font-size: 13px; color: var(--color-text-muted); }
    .field-value { font-size: 13px; text-align: right; color: var(--color-text); }
  `],
})
export class DealPreviewComponent {
  readonly data = input.required<EntityPreviewDto>();
}
