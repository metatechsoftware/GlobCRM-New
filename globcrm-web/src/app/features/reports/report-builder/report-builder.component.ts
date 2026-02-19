import {
  Component,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';

/**
 * Report builder shell with two-panel layout. Placeholder for Task 2 full implementation.
 */
@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [],
  template: `<div class="report-builder"><p>Report Builder - loading...</p></div>`,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportBuilderComponent {
  readonly id = input<string>();
}
