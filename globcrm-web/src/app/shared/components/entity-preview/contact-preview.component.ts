import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { EntityPreviewDto } from '../../models/entity-preview.models';

@Component({
  selector: 'app-contact-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-fields">
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
      @if (data().fields['jobTitle']; as jobTitle) {
        <div class="field-row">
          <span class="field-label">Job Title</span>
          <span class="field-value">{{ jobTitle }}</span>
        </div>
      }
      @if (data().fields['companyName']; as companyName) {
        <div class="field-row">
          <span class="field-label">Company</span>
          <span class="field-value">{{ companyName }}</span>
        </div>
      }
      @if (data().fields['city']; as city) {
        <div class="field-row">
          <span class="field-label">City</span>
          <span class="field-value">{{ city }}</span>
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
export class ContactPreviewComponent {
  readonly data = input.required<EntityPreviewDto>();
}
