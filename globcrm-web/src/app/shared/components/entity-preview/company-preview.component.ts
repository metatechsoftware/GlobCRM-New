import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EntityPreviewDto } from '../../models/entity-preview.models';

@Component({
  selector: 'app-company-preview',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-fields">
      @if (data().fields['industry']; as industry) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.industry' | transloco }}</span>
          <span class="field-value">{{ industry }}</span>
        </div>
      }
      @if (data().fields['phone']; as phone) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.phone' | transloco }}</span>
          <span class="field-value">{{ phone }}</span>
        </div>
      }
      @if (data().fields['website']; as website) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.website' | transloco }}</span>
          <a class="field-value field-link" [href]="website" target="_blank" rel="noopener">{{ website }}</a>
        </div>
      }
      @if (data().fields['size']; as size) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.size' | transloco }}</span>
          <span class="field-value">{{ size }}</span>
        </div>
      }
      @if (data().fields['city']; as city) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.city' | transloco }}</span>
          <span class="field-value">{{ city }}</span>
        </div>
      }
      @if (data().fields['country']; as country) {
        <div class="field-row">
          <span class="field-label">{{ 'common.preview.fields.country' | transloco }}</span>
          <span class="field-value">{{ country }}</span>
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
  `],
})
export class CompanyPreviewComponent {
  readonly data = input.required<EntityPreviewDto>();
}
