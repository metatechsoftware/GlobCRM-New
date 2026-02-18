import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  effect,
  OnDestroy,
} from '@angular/core';
import { GridsterModule, GridsterConfig, GridsterItem } from 'angular-gridster2';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { WidgetDto, MetricResultDto, TargetDto, DashboardGridItem } from '../../models/dashboard.models';
import { WidgetWrapperComponent } from '../widget-wrapper/widget-wrapper.component';

/**
 * Dashboard grid component using angular-gridster2.
 * Renders widgets in a 12-column drag-and-drop layout with resize support.
 * Drag/resize only enabled when isEditing is true.
 *
 * Container height is explicitly set to avoid the collapsed-height pitfall
 * documented in 09-RESEARCH.
 */
@Component({
  selector: 'app-dashboard-grid',
  standalone: true,
  imports: [
    GridsterModule,
    MatButtonModule,
    MatIconModule,
    WidgetWrapperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .dashboard-grid {
      height: calc(100vh - 180px);
      overflow-y: auto;
      background: transparent;
    }

    /* Override gridster background */
    :host ::ng-deep gridster {
      background: transparent !important;
    }
  `,
  template: `
    <gridster [options]="gridOptions" class="dashboard-grid">
      @for (item of gridItems(); track item.widgetId) {
        <gridster-item [item]="item">
          <app-widget-wrapper
            [widget]="item.widget"
            [data]="widgetData()[item.widget.id] ?? null"
            [target]="getTargetForWidget(item.widget)"
            [isEditing]="isEditing()"
            (edit)="editWidget.emit(item.widget)"
            (remove)="removeWidget.emit(item.widget)"
          />
        </gridster-item>
      }
    </gridster>
  `,
})
export class DashboardGridComponent implements OnDestroy {
  readonly widgets = input<WidgetDto[]>([]);
  readonly widgetData = input<Record<string, MetricResultDto>>({});
  readonly targets = input<TargetDto[]>([]);
  readonly isEditing = input<boolean>(false);

  readonly layoutChanged = output<WidgetDto[]>();
  readonly editWidget = output<WidgetDto>();
  readonly removeWidget = output<WidgetDto>();

  /** Subject that debounces rapid layout change events during drag/resize. */
  private readonly layoutChange$ = new Subject<void>();
  private readonly layoutSub: Subscription;

  /** Gridster configuration with 12-column layout and verticalFixed grid type. */
  gridOptions: GridsterConfig = {
    gridType: 'verticalFixed',
    fixedRowHeight: 200,
    compactType: 'compactUp',
    draggable: {
      enabled: false,
      ignoreContent: true,
      dragHandleClass: 'widget-drag-handle',
    },
    resizable: {
      enabled: false,
    },
    pushItems: true,
    swap: false,
    minCols: 12,
    maxCols: 12,
    minRows: 1,
    outerMargin: true,
    outerMarginTop: 16,
    outerMarginRight: 16,
    outerMarginBottom: 16,
    outerMarginLeft: 16,
    margin: 16,
    displayGrid: 'onDrag&Resize',
    itemChangeCallback: () => this.layoutChange$.next(),
    itemResizeCallback: () => this.layoutChange$.next(),
  };

  /** Map widgets to GridsterItem objects for gridster rendering. */
  readonly gridItems = computed<DashboardGridItem[]>(() => {
    return this.widgets().map((w) => ({
      x: w.x,
      y: w.y,
      cols: w.cols,
      rows: w.rows,
      widgetId: w.id,
      widget: w,
    }));
  });

  constructor() {
    // Debounce layout changes -- only emit once the user stops dragging/resizing for 500ms
    this.layoutSub = this.layoutChange$.pipe(debounceTime(500)).subscribe(() => {
      this.emitLayoutChanged();
    });

    // Watch isEditing and toggle drag/resize options
    effect(() => {
      const editing = this.isEditing();
      if (this.gridOptions.draggable) {
        this.gridOptions.draggable.enabled = editing;
      }
      if (this.gridOptions.resizable) {
        this.gridOptions.resizable.enabled = editing;
      }
      this.gridOptions.api?.optionsChanged?.();
    });
  }

  ngOnDestroy(): void {
    this.layoutSub.unsubscribe();
    this.layoutChange$.complete();
  }

  /** Find the matching target for a TargetProgress widget. */
  getTargetForWidget(widget: WidgetDto): TargetDto | null {
    if (widget.type !== 'TargetProgress') return null;
    const targetId = widget.config['targetId'];
    if (!targetId) return null;
    return this.targets().find((t) => t.id === targetId) ?? null;
  }

  /** Map gridster items back to WidgetDto with updated positions and emit. */
  private emitLayoutChanged(): void {
    const updated = this.gridItems().map((gi) => ({
      ...gi.widget,
      x: gi.x,
      y: gi.y,
      cols: gi.cols,
      rows: gi.rows,
    }));
    this.layoutChanged.emit(updated);
  }
}
