import { Component, inject, computed, afterNextRender, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../../core/auth/auth.store';
import { DashboardStore } from '../../stores/dashboard.store';
import {
  WidgetDto,
  DateRange,
  CreateWidgetRequest,
  CreateDashboardRequest,
  UpdateDashboardRequest,
} from '../../models/dashboard.models';
import { MatTabsModule } from '@angular/material/tabs';
import { DashboardGridComponent } from '../../components/dashboard-grid/dashboard-grid.component';
import { DashboardSelectorComponent } from '../../components/dashboard-selector/dashboard-selector.component';
import { DateRangeFilterComponent } from '../../components/date-range-filter/date-range-filter.component';
import { TargetManagementComponent } from '../../components/target-management/target-management.component';
import {
  WidgetConfigDialogComponent,
  WidgetConfigDialogData,
} from '../../components/widget-config-dialog/widget-config-dialog.component';

/**
 * Inline dialog component for creating a new dashboard.
 * Simple prompt with name + isTeamWide toggle.
 */
@Component({
  selector: 'app-create-dashboard-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'createDialog.title' | transloco }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" style="display: flex; flex-direction: column; gap: 12px; min-width: 360px;">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'createDialog.name' | transloco }}</mat-label>
          <input matInput formControlName="name" [placeholder]="'createDialog.namePlaceholder' | transloco" />
        </mat-form-field>
        <mat-checkbox formControlName="isTeamWide">{{ 'createDialog.teamWide' | transloco }}</mat-checkbox>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'createDialog.cancel' | transloco }}</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" [mat-dialog-close]="form.value">
        {{ 'createDialog.create' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class CreateDashboardDialogComponent {
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    isTeamWide: new FormControl(false, { nonNullable: true }),
  });
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTabsModule,
    TranslocoPipe,
    DashboardGridComponent,
    DashboardSelectorComponent,
    DateRangeFilterComponent,
    TargetManagementComponent,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnDestroy {
  readonly store = inject(DashboardStore);
  private readonly dialog = inject(MatDialog);
  private readonly translocoService = inject(TranslocoService);

  private readonly authStore = inject(AuthStore);

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return this.translocoService.translate('greeting.morning');
    if (hour < 17) return this.translocoService.translate('greeting.afternoon');
    return this.translocoService.translate('greeting.evening');
  });

  readonly timeIcon = computed(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'wb_sunny';
    if (hour >= 12 && hour < 17) return 'wb_cloudy';
    if (hour >= 17 && hour < 21) return 'wb_twilight';
    return 'dark_mode';
  });

  readonly firstName = computed(() => {
    const name = this.authStore.userName();
    return name?.split(' ')[0] ?? '';
  });

  readonly isAdmin = computed(() => this.authStore.userRole() === 'Admin');

  constructor() {
    afterNextRender(() => {
      this.store.loadDashboards();
      this.store.loadTargets();
      this.store.startRealTimeRefresh();
    });
  }

  ngOnDestroy(): void {
    this.store.stopRealTimeRefresh();
  }

  onDashboardSelected(id: string): void {
    this.store.loadDashboard(id);
  }

  onDateRangeChanged(range: DateRange): void {
    this.store.setDateRange(range);
  }

  onToggleEdit(): void {
    this.store.toggleEditMode();
  }

  onLayoutChanged(widgets: WidgetDto[]): void {
    this.store.saveLayout(widgets);
  }

  onAddWidget(): void {
    const data: WidgetConfigDialogData = {
      targets: this.store.targets(),
    };
    const dialogRef = this.dialog.open(WidgetConfigDialogComponent, { data });
    dialogRef.afterClosed().subscribe((result: CreateWidgetRequest | undefined) => {
      if (!result) return;
      const dashboard = this.store.activeDashboard();
      if (!dashboard) return;

      const existingWidgets = dashboard.widgets.map((w) => ({
        type: w.type,
        title: w.title,
        x: w.x,
        y: w.y,
        cols: w.cols,
        rows: w.rows,
        config: w.config,
        sortOrder: w.sortOrder,
      }));

      const req: UpdateDashboardRequest = {
        name: dashboard.name,
        description: dashboard.description ?? undefined,
        isDefault: dashboard.isDefault,
        widgets: [...existingWidgets, result],
      };
      this.store.updateDashboard(dashboard.id, req);
    });
  }

  onEditWidget(widget: WidgetDto): void {
    const data: WidgetConfigDialogData = {
      widget,
      targets: this.store.targets(),
    };
    const dialogRef = this.dialog.open(WidgetConfigDialogComponent, { data });
    dialogRef.afterClosed().subscribe((result: CreateWidgetRequest | undefined) => {
      if (!result) return;
      const dashboard = this.store.activeDashboard();
      if (!dashboard) return;

      const updatedWidgets = dashboard.widgets.map((w) => {
        if (w.id === widget.id) {
          return {
            type: result.type,
            title: result.title,
            x: result.x,
            y: result.y,
            cols: result.cols,
            rows: result.rows,
            config: result.config,
            sortOrder: result.sortOrder,
          };
        }
        return {
          type: w.type,
          title: w.title,
          x: w.x,
          y: w.y,
          cols: w.cols,
          rows: w.rows,
          config: w.config,
          sortOrder: w.sortOrder,
        };
      });

      const req: UpdateDashboardRequest = {
        name: dashboard.name,
        description: dashboard.description ?? undefined,
        isDefault: dashboard.isDefault,
        widgets: updatedWidgets,
      };
      this.store.updateDashboard(dashboard.id, req);
    });
  }

  onRemoveWidget(widget: WidgetDto): void {
    const dashboard = this.store.activeDashboard();
    if (!dashboard) return;

    const filteredWidgets = dashboard.widgets
      .filter((w) => w.id !== widget.id)
      .map((w) => ({
        type: w.type,
        title: w.title,
        x: w.x,
        y: w.y,
        cols: w.cols,
        rows: w.rows,
        config: w.config,
        sortOrder: w.sortOrder,
      }));

    const req: UpdateDashboardRequest = {
      name: dashboard.name,
      description: dashboard.description ?? undefined,
      isDefault: dashboard.isDefault,
      widgets: filteredWidgets,
    };
    this.store.updateDashboard(dashboard.id, req);
  }

  onCreateDashboard(): void {
    const dialogRef = this.dialog.open(CreateDashboardDialogComponent);
    dialogRef.afterClosed().subscribe((result: { name: string; isTeamWide: boolean } | undefined) => {
      if (!result) return;
      const req: CreateDashboardRequest = {
        name: result.name,
        isTeamWide: result.isTeamWide,
        isDefault: false,
        widgets: [],
      };
      this.store.saveDashboard(req);
    });
  }

  onDeleteDashboard(id: string): void {
    const dashboard = this.store.dashboards().find((d) => d.id === id);
    const name = dashboard?.name ?? 'this dashboard';
    if (confirm(this.translocoService.translate('deleteConfirm', { name }))) {
      this.store.deleteDashboard(id);
    }
  }
}
