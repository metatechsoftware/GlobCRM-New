import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { EntityPreviewDto } from '../../models/entity-preview.models';

@Component({
  selector: 'app-product-preview',
  standalone: true,
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-fields">
      @if (data().fields['unitPrice'] != null) {
        <div class="field-row">
          <span class="field-label">Unit Price</span>
          <span class="field-value">{{ data().fields['unitPrice'] | currency:'USD':'symbol':'1.2-2' }}</span>
        </div>
      }
      @if (data().fields['sku']; as sku) {
        <div class="field-row">
          <span class="field-label">SKU</span>
          <span class="field-value">{{ sku }}</span>
        </div>
      }
      @if (data().fields['category']; as category) {
        <div class="field-row">
          <span class="field-label">Category</span>
          <span class="field-value">{{ category }}</span>
        </div>
      }
      @if (data().fields['description']; as desc) {
        <div class="field-row field-row--description">
          <span class="field-label">Description</span>
          <span class="field-value description-text">{{ truncate(desc) }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .preview-fields { display: flex; flex-direction: column; gap: 2px; }
    .field-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .field-row--description { flex-direction: column; gap: 4px; }
    .field-label { font-size: 13px; color: var(--color-text-muted); }
    .field-value { font-size: 13px; text-align: right; color: var(--color-text); }
    .description-text { text-align: left; line-height: 1.4; color: var(--color-text-secondary); }
  `],
})
export class ProductPreviewComponent {
  readonly data = input.required<EntityPreviewDto>();

  truncate(text: string, maxLength = 120): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
