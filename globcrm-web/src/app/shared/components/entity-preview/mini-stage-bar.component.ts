import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StageInfoDto } from '../../models/entity-preview.models';

@Component({
  selector: 'app-mini-stage-bar',
  standalone: true,
  imports: [MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage-bar">
      @for (stage of stages(); track stage.id) {
        <div class="stage-segment"
             [matTooltip]="stage.name"
             [class.current]="stage.id === currentStageId()"
             [style.background-color]="getSegmentColor(stage)"
             [style.opacity]="getSegmentOpacity(stage)">
        </div>
      }
    </div>
  `,
  styles: [`
    .stage-bar {
      display: flex;
      gap: 2px;
      width: 100%;
      height: 8px;
      margin: var(--space-2, 8px) 0;
    }

    .stage-segment {
      flex: 1;
      border-radius: var(--radius-full, 9999px);
      cursor: default;
      transition: box-shadow var(--duration-normal, 200ms) var(--ease-default);

      &.current {
        box-shadow: 0 0 8px currentColor;
      }
    }
  `],
})
export class MiniStageBarComponent {
  readonly stages = input.required<StageInfoDto[]>();
  readonly currentStageId = input.required<string>();
  readonly currentSortOrder = input.required<number>();

  getSegmentColor(stage: StageInfoDto): string {
    if (stage.id === this.currentStageId()) {
      return stage.color || 'var(--color-primary)';
    }
    if (stage.sortOrder < this.currentSortOrder()) {
      return 'var(--color-success)';
    }
    return 'var(--color-bg-secondary)';
  }

  getSegmentOpacity(stage: StageInfoDto): number {
    if (stage.id === this.currentStageId()) {
      return 1;
    }
    if (stage.sortOrder < this.currentSortOrder()) {
      return 0.6;
    }
    return 1;
  }
}
