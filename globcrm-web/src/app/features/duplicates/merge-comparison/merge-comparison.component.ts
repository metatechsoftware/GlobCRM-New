import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Placeholder merge comparison component.
 * Full implementation in Task 2.
 */
@Component({
  selector: 'app-merge-comparison',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Merge comparison loading...</p>`,
})
export class MergeComparisonComponent {}
