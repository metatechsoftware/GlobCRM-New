import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  input,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ReportStore } from '../report.store';
import {
  ReportField,
  ReportFilterGroup,
  ReportGrouping,
  ReportChartConfig,
  ReportDefinition,
  ReportChartType,
  ReportFilterCondition,
  CreateReportRequest,
  UpdateReportRequest,
} from '../report.models';
import { EntitySourcePanelComponent } from './entity-source-panel.component';
import { FieldSelectorPanelComponent } from './field-selector-panel.component';
import { FilterBuilderPanelComponent } from './filter-builder-panel.component';
import { GroupingPanelComponent } from './grouping-panel.component';
import { ChartConfigPanelComponent } from './chart-config-panel.component';
import { ReportChartComponent } from '../report-viewer/report-chart.component';
import { ReportDataTableComponent } from '../report-viewer/report-data-table.component';
import { ReportAggregationCardsComponent } from '../report-viewer/report-aggregation-cards.component';

/**
 * Report builder with left sidebar configuration panels and right preview area.
 * Sidebar contains 5 collapsible panels for configuring report definition.
 * Fixed "Run Report" and "Save" buttons at sidebar bottom.
 */
@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    EntitySourcePanelComponent,
    FieldSelectorPanelComponent,
    FilterBuilderPanelComponent,
    GroupingPanelComponent,
    ChartConfigPanelComponent,
    ReportChartComponent,
    ReportDataTableComponent,
    ReportAggregationCardsComponent,
    TranslocoPipe,
  ],
  providers: [ReportStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-builder.component.html',
  styleUrl: './report-builder.component.scss',
})
export class ReportBuilderComponent implements OnInit {
  readonly id = input<string>();
  readonly store = inject(ReportStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  // Drill-down filter state (set when user clicks a chart element)
  readonly drillDownFilter = signal<ReportFilterCondition | null>(null);

  // Local state signals for building the report definition
  readonly entityType = signal<string>('');
  readonly reportName = signal<string>('');
  readonly reportDescription = signal<string>('');
  readonly categoryId = signal<string | null>(null);
  readonly selectedFields = signal<ReportField[]>([]);
  readonly filterGroup = signal<ReportFilterGroup | null>(null);
  readonly groupings = signal<ReportGrouping[]>([]);
  readonly chartConfig = signal<ReportChartConfig>({
    chartType: 'table',
    showLegend: true,
    showDataLabels: false,
  });

  // Computed: can we save?
  readonly canSave = computed(
    () =>
      this.entityType() !== '' &&
      this.selectedFields().length > 0 &&
      this.reportName().trim() !== ''
  );

  // Computed: can we run?
  readonly canRun = computed(
    () =>
      this.entityType() !== '' &&
      this.selectedFields().length > 0
  );

  constructor() {
    // When the report loads (edit mode), populate local signals from the loaded report
    effect(() => {
      const report = this.store.selectedReport();
      if (report) {
        this.entityType.set(report.entityType);
        this.reportName.set(report.name);
        this.reportDescription.set(report.description ?? '');
        this.categoryId.set(report.categoryId ?? null);
        this.selectedFields.set(report.definition.fields);
        this.filterGroup.set(report.definition.filterGroup ?? null);
        this.groupings.set(report.definition.groupings);
        this.chartConfig.set(
          report.definition.chartConfig ?? {
            chartType: report.chartType,
            showLegend: true,
            showDataLabels: false,
          }
        );
      }
    });
  }

  ngOnInit(): void {
    // Load categories for the entity source panel
    this.store.loadCategories();

    const reportId = this.id();
    if (reportId) {
      // Edit mode: load the report, then load field metadata
      this.store.loadReport(reportId);
      // Field metadata will load when the report's entityType populates (via effect on selectedReport above
      // and the onEntityTypeChange handler)
    }
  }

  // ---- Panel event handlers ----

  onEntityTypeChange(entityType: string): void {
    this.entityType.set(entityType);
    // Clear dependent state when entity type changes
    this.selectedFields.set([]);
    this.filterGroup.set(null);
    this.groupings.set([]);
    // Load field metadata for the new entity type
    if (entityType) {
      this.store.loadFieldMetadata(entityType);
    }
  }

  onNameChange(name: string): void {
    this.reportName.set(name);
  }

  onDescriptionChange(description: string): void {
    this.reportDescription.set(description);
  }

  onCategoryIdChange(categoryId: string | null): void {
    this.categoryId.set(categoryId);
  }

  onFieldsChange(fields: ReportField[]): void {
    this.selectedFields.set(fields);
  }

  onFilterGroupChange(filterGroup: ReportFilterGroup): void {
    this.filterGroup.set(filterGroup);
  }

  onGroupingsChange(groupings: ReportGrouping[]): void {
    this.groupings.set(groupings);
  }

  onAggregationsChange(fields: ReportField[]): void {
    this.selectedFields.set(fields);
  }

  onChartConfigChange(config: ReportChartConfig): void {
    this.chartConfig.set(config);
  }

  // ---- Actions ----

  runReport(): void {
    const reportId = this.id();
    if (reportId) {
      // For saved reports, execute via API
      this.store.executeReport(reportId);
    }
    // For unsaved reports, save first then execute
    // (handled by saveAndRun pattern in the future)
  }

  saveReport(): void {
    const definition = this.buildDefinition();
    const reportId = this.id();

    if (reportId) {
      // Update existing
      const request: UpdateReportRequest = {
        name: this.reportName(),
        description: this.reportDescription() || undefined,
        categoryId: this.categoryId() || undefined,
        chartType: this.chartConfig().chartType,
        definition,
      };
      this.store.updateReport(reportId, request, (updated) => {
        // Stay on the same page
      });
    } else {
      // Create new
      const request: CreateReportRequest = {
        name: this.reportName(),
        description: this.reportDescription() || undefined,
        entityType: this.entityType(),
        categoryId: this.categoryId() || undefined,
        chartType: this.chartConfig().chartType,
        definition,
      };
      this.store.createReport(request, (created) => {
        // Navigate to edit mode for the new report
        this.router.navigate(['/reports', created.id, 'edit']);
      });
    }
  }

  // ---- Drill-down interaction ----

  onDrillDown(filter: ReportFilterCondition): void {
    this.drillDownFilter.set(filter);
    const reportId = this.id();
    if (reportId) {
      this.store.executeReport(reportId, {
        drillDownFilter: filter,
      });
    }
  }

  onClearDrillDown(): void {
    this.drillDownFilter.set(null);
    const reportId = this.id();
    if (reportId) {
      this.store.executeReport(reportId);
    }
  }

  onPageChange(page: number): void {
    const reportId = this.id();
    if (reportId) {
      const filter = this.drillDownFilter();
      this.store.executeReport(reportId, {
        page,
        pageSize: 50,
        drillDownFilter: filter ?? undefined,
      });
    }
  }

  onRowClick(row: Record<string, any>): void {
    // Navigation handled inside ReportDataTableComponent via Router
  }

  // ---- CSV Export ----

  exportCsv(): void {
    const reportId = this.id() ?? this.store.selectedReport()?.id;
    if (!reportId) return;

    this.store.exportCsv(reportId, () => {
      this.snackBar.open(
        this.transloco.translate('reports.builder.exportStarted'),
        'OK',
        { duration: 5000 },
      );
    });
  }

  // ---- Share / Clone ----

  toggleShare(): void {
    const report = this.store.selectedReport();
    if (!report) return;
    this.store.toggleShare(report.id, !report.isShared);
  }

  cloneReport(): void {
    const report = this.store.selectedReport();
    if (!report) return;
    this.store.cloneReport(report.id, `${report.name} (Copy)`, (cloned) => {
      this.router.navigate(['/reports', cloned.id, 'edit']);
    });
  }

  private buildDefinition(): ReportDefinition {
    return {
      fields: this.selectedFields(),
      filterGroup: this.filterGroup() ?? undefined,
      groupings: this.groupings(),
      chartConfig: this.chartConfig(),
    };
  }
}
