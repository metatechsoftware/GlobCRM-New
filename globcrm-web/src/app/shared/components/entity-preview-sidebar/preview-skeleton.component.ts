import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-preview-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skeleton">
      <!-- Avatar + name skeleton -->
      <div class="skeleton-header">
        <div class="skeleton-circle"></div>
        <div class="skeleton-header-lines">
          <div class="skeleton-line skeleton-line--lg"></div>
          <div class="skeleton-line skeleton-line--md"></div>
        </div>
      </div>

      <!-- Field rows skeleton -->
      <div class="skeleton-fields">
        @for (i of fieldRows; track i) {
          <div class="skeleton-field-row">
            <div class="skeleton-line skeleton-line--label"></div>
            <div class="skeleton-line skeleton-line--value"></div>
          </div>
        }
      </div>

      <!-- Chips skeleton -->
      <div class="skeleton-chips">
        @for (i of chipRows; track i) {
          <div class="skeleton-chip"></div>
        }
      </div>

      <!-- Timeline skeleton -->
      <div class="skeleton-timeline">
        @for (i of timelineRows; track i) {
          <div class="skeleton-timeline-item">
            <div class="skeleton-dot"></div>
            <div class="skeleton-line skeleton-line--timeline"></div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @keyframes pulse {
      0%, 100% { background-color: var(--color-bg-secondary); }
      50% { background-color: var(--color-border-subtle, #e0e0e0); }
    }

    .skeleton { padding: 0; }

    .skeleton-header {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 20px;
    }

    .skeleton-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
      flex-shrink: 0;
    }

    .skeleton-header-lines {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }

    .skeleton-line {
      border-radius: 4px;
      animation: pulse 1.5s infinite;
      height: 12px;
    }

    .skeleton-line--lg { width: 70%; height: 16px; }
    .skeleton-line--md { width: 45%; }
    .skeleton-line--label { width: 40%; }
    .skeleton-line--value { width: 50%; }
    .skeleton-line--timeline { width: 80%; flex: 1; }

    .skeleton-fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }

    .skeleton-field-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .skeleton-chips {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }

    .skeleton-chip {
      width: 80px;
      height: 28px;
      border-radius: 16px;
      animation: pulse 1.5s infinite;
    }

    .skeleton-timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-timeline-item {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .skeleton-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
      flex-shrink: 0;
    }
  `],
})
export class PreviewSkeletonComponent {
  readonly fieldRows = [1, 2, 3, 4, 5, 6];
  readonly chipRows = [1, 2, 3];
  readonly timelineRows = [1, 2, 3];
}
