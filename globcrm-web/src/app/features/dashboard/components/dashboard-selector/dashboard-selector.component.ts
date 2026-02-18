import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { DashboardDto } from '../../models/dashboard.models';
import { AuthStore } from '../../../../core/auth/auth.store';

/**
 * Dashboard selector component.
 * Groups dashboards into "My Dashboards" (ownerId non-null) and
 * "Team Dashboards" (ownerId null) using mat-optgroup.
 * Provides create and delete actions.
 */
@Component({
  selector: 'app-dashboard-selector',
  standalone: true,
  imports: [
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .dashboard-selector__select {
      min-width: 200px;
      max-width: 220px;
    }

    :host ::ng-deep .dashboard-selector__select .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .dashboard-selector__option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .dashboard-selector__option-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dashboard-selector__delete-btn {
      width: 24px;
      height: 24px;
      line-height: 24px;
    }

    .dashboard-selector__delete-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dashboard-selector__add-btn {
      flex-shrink: 0;
    }
  `,
  template: `
    <mat-form-field appearance="outline" class="dashboard-selector__select">
      <mat-label>Dashboard</mat-label>
      <mat-select
        [value]="activeDashboardId()"
        (selectionChange)="dashboardSelected.emit($event.value)"
      >
        @if (personalDashboards().length > 0) {
          <mat-optgroup label="My Dashboards">
            @for (d of personalDashboards(); track d.id) {
              <mat-option [value]="d.id">
                <div class="dashboard-selector__option">
                  <span class="dashboard-selector__option-name">{{ d.name }}</span>
                  <button
                    mat-icon-button
                    class="dashboard-selector__delete-btn"
                    (click)="onDelete($event, d.id)"
                    title="Delete dashboard"
                  >
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </mat-option>
            }
          </mat-optgroup>
        }
        @if (teamDashboards().length > 0) {
          <mat-optgroup label="Team Dashboards">
            @for (d of teamDashboards(); track d.id) {
              <mat-option [value]="d.id">
                <div class="dashboard-selector__option">
                  <span class="dashboard-selector__option-name">{{ d.name }}</span>
                  @if (isAdmin()) {
                    <button
                      mat-icon-button
                      class="dashboard-selector__delete-btn"
                      (click)="onDelete($event, d.id)"
                      title="Delete dashboard"
                    >
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  }
                </div>
              </mat-option>
            }
          </mat-optgroup>
        }
      </mat-select>
    </mat-form-field>
    <button
      mat-icon-button
      class="dashboard-selector__add-btn"
      (click)="createDashboard.emit()"
      title="Create dashboard"
    >
      <mat-icon>add</mat-icon>
    </button>
  `,
})
export class DashboardSelectorComponent {
  private readonly authStore = inject(AuthStore);

  readonly dashboards = input<DashboardDto[]>([]);
  readonly activeDashboardId = input<string | null>(null);

  readonly dashboardSelected = output<string>();
  readonly createDashboard = output<void>();
  readonly deleteDashboard = output<string>();

  /** Personal dashboards where ownerId is non-null. */
  readonly personalDashboards = computed(() =>
    this.dashboards().filter((d) => d.ownerId !== null)
  );

  /** Team-wide dashboards where ownerId is null. */
  readonly teamDashboards = computed(() =>
    this.dashboards().filter((d) => d.ownerId === null)
  );

  /** Whether the current user has Admin role. */
  readonly isAdmin = computed(() => this.authStore.userRole() === 'Admin');

  /** Handle delete click -- stop propagation to prevent select change. */
  onDelete(event: MouseEvent, dashboardId: string): void {
    event.stopPropagation();
    this.deleteDashboard.emit(dashboardId);
  }
}
