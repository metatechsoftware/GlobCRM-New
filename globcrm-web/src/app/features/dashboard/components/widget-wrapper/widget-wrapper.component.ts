import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { WidgetDto, MetricResultDto, TargetDto } from '../../models/dashboard.models';
import { KpiCardComponent } from '../widgets/kpi-card/kpi-card.component';
import { ChartWidgetComponent } from '../widgets/chart-widget/chart-widget.component';
import { LeaderboardComponent } from '../widgets/leaderboard/leaderboard.component';
import { TableWidgetComponent } from '../widgets/table-widget/table-widget.component';
import { TargetProgressComponent } from '../widgets/target-progress/target-progress.component';

/**
 * Widget wrapper component that dispatches to the correct widget
 * component based on WidgetType. Provides header with drag handle
 * and action menu in edit mode.
 *
 * The "widget-drag-handle" class is referenced by gridster's
 * dragHandleClass configuration for drag-only-by-handle behavior.
 */
@Component({
  selector: 'app-widget-wrapper',
  standalone: true,
  imports: [
    MatIconModule,
    MatMenuModule,
    MatButtonModule,
    KpiCardComponent,
    ChartWidgetComponent,
    LeaderboardComponent,
    TableWidgetComponent,
    TargetProgressComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .widget-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border-subtle, #F0E8E0);
      border-radius: var(--radius-lg, 12px);
      overflow: hidden;
    }

    .widget-wrapper__header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-3, 12px) var(--space-4, 16px);
      border-bottom: 1px solid var(--color-border-subtle, #F0E8E0);
      min-height: 44px;
      flex-shrink: 0;
    }

    .widget-drag-handle {
      cursor: grab;
      display: flex;
      align-items: center;
      color: var(--color-text-muted, #A89888);
    }

    .widget-drag-handle:active {
      cursor: grabbing;
    }

    .widget-drag-handle mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .widget-wrapper__title {
      flex: 1;
      margin: 0;
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #3D2E22);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .widget-wrapper__menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      border-radius: var(--radius-sm, 4px);
      color: var(--color-text-muted, #A89888);
      cursor: pointer;
      padding: 0;
    }

    .widget-wrapper__menu-btn:hover {
      background: var(--color-highlight, rgba(217, 123, 58, 0.08));
      color: var(--color-text, #3D2E22);
    }

    .widget-wrapper__menu-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .widget-wrapper__content {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }
  `,
  template: `
    <div class="widget-wrapper">
      <div class="widget-wrapper__header">
        @if (isEditing()) {
          <span class="widget-drag-handle">
            <mat-icon>drag_indicator</mat-icon>
          </span>
        }
        <h3 class="widget-wrapper__title">{{ widget().title }}</h3>
        @if (isEditing()) {
          <button
            class="widget-wrapper__menu-btn"
            [matMenuTriggerFor]="widgetMenu"
          >
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #widgetMenu="matMenu">
            <button mat-menu-item (click)="edit.emit()">
              <mat-icon>settings</mat-icon>
              <span>Configure</span>
            </button>
            <button mat-menu-item (click)="remove.emit()">
              <mat-icon>delete</mat-icon>
              <span>Remove</span>
            </button>
          </mat-menu>
        }
      </div>
      <div class="widget-wrapper__content">
        @switch (widget().type) {
          @case ('KpiCard') {
            <app-kpi-card
              [title]="widget().title"
              [value]="data()?.value ?? 0"
              [icon]="widget().config['icon'] ?? 'trending_up'"
              [format]="widget().config['format'] ?? 'number'"
              [target]="widget().config['target'] ?? null"
              [color]="widget().config['color'] ?? 'primary'"
            />
          }
          @case ('BarChart') {
            <app-chart-widget
              chartType="bar"
              [data]="data()"
              [title]="widget().title"
            />
          }
          @case ('LineChart') {
            <app-chart-widget
              chartType="line"
              [data]="data()"
              [title]="widget().title"
            />
          }
          @case ('PieChart') {
            <app-chart-widget
              chartType="pie"
              [data]="data()"
              [title]="widget().title"
            />
          }
          @case ('Leaderboard') {
            <app-leaderboard
              [data]="data()"
              [title]="widget().title"
              [valueFormat]="widget().config['valueFormat'] ?? 'number'"
            />
          }
          @case ('Table') {
            <app-table-widget
              [data]="data()"
              [title]="widget().title"
            />
          }
          @case ('TargetProgress') {
            <app-target-progress
              [target]="target()"
              [data]="data()"
            />
          }
        }
      </div>
    </div>
  `,
})
export class WidgetWrapperComponent {
  readonly widget = input.required<WidgetDto>();
  readonly data = input<MetricResultDto | null>(null);
  readonly target = input<TargetDto | null>(null);
  readonly isEditing = input<boolean>(false);

  readonly edit = output<void>();
  readonly remove = output<void>();
}
