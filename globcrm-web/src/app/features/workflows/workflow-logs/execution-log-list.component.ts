import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkflowService } from '../workflow.service';
import { WorkflowExecutionLog } from '../workflow.models';

/**
 * Paginated execution log table for workflow audit trail.
 * Supports both standalone (full page with pagination) and embedded
 * (5 recent logs, no pagination) modes via the `embedded` input.
 */
@Component({
  selector: 'app-execution-log-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  template: `
    @if (loading()) {
      <div class="log-list__loading">
        <mat-spinner diameter="36"></mat-spinner>
      </div>
    } @else if (logs().length === 0) {
      <div class="log-list__empty">
        <mat-icon>history</mat-icon>
        <p>No executions yet. This workflow will log each run here.</p>
      </div>
    } @else {
      <div class="log-list__table-wrap">
        <table mat-table [dataSource]="logs()">
          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let log">
              @switch (log.status) {
                @case ('succeeded') {
                  <mat-icon class="log-status log-status--success"
                            matTooltip="Succeeded">check_circle</mat-icon>
                }
                @case ('partiallyFailed') {
                  <mat-icon class="log-status log-status--warning"
                            matTooltip="Partially Failed">warning</mat-icon>
                }
                @case ('failed') {
                  <mat-icon class="log-status log-status--error"
                            matTooltip="Failed">error</mat-icon>
                }
                @case ('skipped') {
                  <mat-icon class="log-status log-status--skip"
                            matTooltip="Skipped">block</mat-icon>
                }
              }
            </td>
          </ng-container>

          <!-- Trigger Column -->
          <ng-container matColumnDef="trigger">
            <th mat-header-cell *matHeaderCellDef>Trigger</th>
            <td mat-cell *matCellDef="let log">
              {{ log.triggerType }}: {{ log.triggerEvent }}
            </td>
          </ng-container>

          <!-- Entity Column -->
          <ng-container matColumnDef="entity">
            <th mat-header-cell *matHeaderCellDef>Entity</th>
            <td mat-cell *matCellDef="let log">
              <span class="log-list__entity">
                {{ log.entityType }}
              </span>
              <span class="log-list__entity-id"
                    [matTooltip]="log.entityId">
                {{ log.entityId | slice:0:8 }}...
              </span>
            </td>
          </ng-container>

          <!-- Conditions Column -->
          <ng-container matColumnDef="conditions">
            <th mat-header-cell *matHeaderCellDef>Conditions</th>
            <td mat-cell *matCellDef="let log">
              @if (!log.conditionsEvaluated) {
                <span class="log-list__conditions log-list__conditions--na">&mdash;</span>
              } @else if (log.conditionsPassed) {
                <span class="log-list__conditions log-list__conditions--pass">Passed</span>
              } @else {
                <span class="log-list__conditions log-list__conditions--fail">Failed</span>
              }
            </td>
          </ng-container>

          <!-- Duration Column -->
          <ng-container matColumnDef="duration">
            <th mat-header-cell *matHeaderCellDef>Duration</th>
            <td mat-cell *matCellDef="let log">
              {{ log.durationMs }}ms
            </td>
          </ng-container>

          <!-- Started Column -->
          <ng-container matColumnDef="started">
            <th mat-header-cell *matHeaderCellDef>Started</th>
            <td mat-cell *matCellDef="let log"
                [matTooltip]="log.startedAt | date:'medium'">
              {{ getRelativeTime(log.startedAt) }}
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let log">
              <a mat-stroked-button
                 class="log-list__view-btn"
                 [routerLink]="['/workflows', resolvedWorkflowId(), 'logs', log.id]">
                View Details
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>

      @if (!embedded() && totalCount() > pageSize) {
        <mat-paginator
          [length]="totalCount()"
          [pageSize]="pageSize"
          [pageIndex]="currentPage() - 1"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)"
          showFirstLastButtons>
        </mat-paginator>
      }

      @if (embedded() && totalCount() > 5) {
        <div class="log-list__view-all">
          <a mat-button
             [routerLink]="['/workflows', resolvedWorkflowId(), 'logs']">
            View All Logs ({{ totalCount() }})
            <mat-icon>arrow_forward</mat-icon>
          </a>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .log-list__loading {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .log-list__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
      color: var(--color-text-secondary, #64748b);
      border: 2px dashed var(--color-border, #e2e8f0);
      border-radius: 8px;
      text-align: center;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        opacity: 0.5;
        margin-bottom: 12px;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    .log-list__table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
    }

    .log-status {
      font-size: 20px;
      width: 20px;
      height: 20px;

      &--success { color: var(--color-success, #22c55e); }
      &--warning { color: var(--color-warning, #f59e0b); }
      &--error { color: var(--color-danger, #ef4444); }
      &--skip { color: var(--color-text-secondary, #94a3b8); }
    }

    .log-list__entity {
      font-weight: 500;
      margin-right: 4px;
    }

    .log-list__entity-id {
      font-size: 12px;
      color: var(--color-text-secondary, #64748b);
      font-family: monospace;
    }

    .log-list__conditions {
      font-size: 13px;
      font-weight: 500;

      &--pass { color: var(--color-success-text, #15803d); }
      &--fail { color: var(--color-danger-text, #b91c1c); }
      &--na { color: var(--color-text-secondary, #94a3b8); }
    }

    .log-list__view-btn {
      font-size: 12px;
    }

    .log-list__view-all {
      display: flex;
      justify-content: center;
      padding: 12px 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionLogListComponent implements OnInit {
  /** When used as embedded child, parent passes workflowId directly */
  readonly workflowId = input<string>('');
  /** When used as routed component, route param :id is bound here */
  readonly id = input<string>('');
  readonly embedded = input(false);

  private readonly service = inject(WorkflowService);

  readonly logs = signal<WorkflowExecutionLog[]>([]);
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);
  readonly loading = signal(false);
  readonly pageSize = 20;

  readonly displayedColumns = [
    'status',
    'trigger',
    'entity',
    'conditions',
    'duration',
    'started',
    'actions',
  ];

  /** Resolve workflow ID from either input source */
  readonly resolvedWorkflowId = computed(() => this.workflowId() || this.id());

  ngOnInit(): void {
    this.loadLogs();
  }

  private loadLogs(): void {
    const wfId = this.resolvedWorkflowId();
    if (!wfId) return;

    const embeddedMode = this.embedded();
    const page = embeddedMode ? 1 : this.currentPage();
    const size = embeddedMode ? 5 : this.pageSize;

    this.loading.set(true);
    this.service.getExecutionLogs(wfId, page, size).subscribe({
      next: (response) => {
        this.logs.set(response.items);
        this.totalCount.set(response.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    this.loadLogs();
  }

  getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
