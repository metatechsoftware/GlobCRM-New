import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Placeholder component for the workflow detail page.
 * Will be replaced with the full implementation in plan 19-06.
 */
@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  template: `
    <div class="placeholder">
      <h2>Workflow Detail</h2>
      <p>Coming soon (19-06)</p>
    </div>
  `,
  styles: `
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      color: var(--text-secondary, #64748b);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowDetailComponent {}
