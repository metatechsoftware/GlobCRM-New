import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { WorkflowService } from '../workflow.service';
import { WorkflowExecutionLog, WorkflowActionLog } from '../workflow.models';

/**
 * Execution log detail page showing trigger info, condition evaluation,
 * and per-action timeline with status, duration, and error messages.
 * Provides full audit trail visibility for WFLOW-11.
 */
@Component({
  selector: 'app-execution-log-detail',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatExpansionModule,
  ],
  template: `
    @if (loading()) {
      <div class="log-detail__loading">
        <mat-spinner diameter="48"></mat-spinner>
      </div>
    }

    @if (log(); as exec) {
      <div class="log-detail">
        <!-- Header -->
        <div class="log-detail__header">
          <button mat-icon-button [routerLink]="['/workflows', id()]" aria-label="Back to workflow">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="log-detail__header-info">
            <h1>Execution Log</h1>
          </div>
          <span class="log-detail__status-badge"
                [class]="'status--' + exec.status">
            {{ formatStatus(exec.status) }}
          </span>
          <span class="log-detail__duration-badge">
            <mat-icon>timer</mat-icon>
            {{ exec.durationMs }}ms
          </span>
          <span class="log-detail__timestamp">
            {{ exec.startedAt | date:'medium' }}
          </span>
        </div>

        <!-- Trigger Section -->
        <div class="log-detail__card">
          <h2>
            <mat-icon>bolt</mat-icon>
            Trigger
          </h2>
          <div class="log-detail__card-body">
            <div class="log-detail__field">
              <span class="log-detail__field-label">Type:</span>
              <span>{{ exec.triggerType }}</span>
            </div>
            <div class="log-detail__field">
              <span class="log-detail__field-label">Event:</span>
              <span>{{ exec.triggerEvent }}</span>
            </div>
            <div class="log-detail__field">
              <span class="log-detail__field-label">Entity:</span>
              <span>
                {{ exec.entityType }}
                <a class="log-detail__entity-link"
                   [routerLink]="getEntityLink(exec.entityType, exec.entityId)">
                  {{ exec.entityId | slice:0:12 }}...
                </a>
              </span>
            </div>
          </div>
        </div>

        <!-- Conditions Section -->
        <div class="log-detail__card">
          <h2>
            <mat-icon>filter_list</mat-icon>
            Conditions
          </h2>
          <div class="log-detail__card-body">
            @if (!exec.conditionsEvaluated) {
              <p class="log-detail__no-conditions">No conditions configured for this workflow.</p>
            } @else {
              <div class="log-detail__field">
                <span class="log-detail__field-label">Evaluated:</span>
                <span>Yes</span>
              </div>
              <div class="log-detail__field">
                <span class="log-detail__field-label">Result:</span>
                @if (exec.conditionsPassed) {
                  <span class="log-detail__conditions-pass">
                    <mat-icon>check_circle</mat-icon> Passed
                  </span>
                } @else {
                  <span class="log-detail__conditions-fail">
                    <mat-icon>cancel</mat-icon> Failed &mdash; conditions not met
                  </span>
                }
              </div>
            }
          </div>
        </div>

        <!-- Actions Timeline -->
        @if (exec.actionLogs && exec.actionLogs.length > 0) {
          <div class="log-detail__section">
            <h2>Actions Timeline</h2>
            <div class="log-detail__timeline">
              @for (action of sortedActions(); track action.id; let i = $index; let last = $last) {
                <div class="timeline-entry"
                     [class.timeline-entry--success]="action.status === 'Succeeded'"
                     [class.timeline-entry--failed]="action.status === 'Failed'"
                     [class.timeline-entry--skipped]="action.status === 'Skipped'">
                  <div class="timeline-entry__line"
                       [class.timeline-entry__line--last]="last"></div>
                  <div class="timeline-entry__dot">
                    @switch (action.status) {
                      @case ('Succeeded') {
                        <mat-icon class="timeline-dot timeline-dot--success">check_circle</mat-icon>
                      }
                      @case ('Failed') {
                        <mat-icon class="timeline-dot timeline-dot--error">error</mat-icon>
                      }
                      @case ('Skipped') {
                        <mat-icon class="timeline-dot timeline-dot--skip">block</mat-icon>
                      }
                      @default {
                        <mat-icon class="timeline-dot timeline-dot--skip">radio_button_unchecked</mat-icon>
                      }
                    }
                  </div>
                  <div class="timeline-entry__content">
                    <div class="timeline-entry__header">
                      <span class="timeline-entry__type">
                        <mat-icon class="timeline-entry__type-icon">{{ getActionIcon(action.actionType) }}</mat-icon>
                        {{ action.actionType }}
                      </span>
                      <span class="timeline-entry__meta">
                        <span class="timeline-entry__badge"
                              [class]="'status--' + action.status.toLowerCase()">
                          {{ action.status }}
                        </span>
                        <span class="timeline-entry__duration">{{ action.durationMs }}ms</span>
                      </span>
                    </div>
                    <div class="timeline-entry__details">
                      <span class="timeline-entry__node-id">Node: {{ action.actionNodeId }}</span>
                      @if (action.startedAt) {
                        <span class="timeline-entry__timing">
                          {{ action.startedAt | date:'mediumTime' }}
                          @if (action.completedAt) {
                            &rarr; {{ action.completedAt | date:'mediumTime' }}
                          }
                        </span>
                      }
                    </div>
                    @if (action.status === 'Failed' && action.errorMessage) {
                      <div class="timeline-entry__error">
                        <mat-icon>error_outline</mat-icon>
                        <pre>{{ action.errorMessage }}</pre>
                      </div>
                    }
                    @if (isHaltedAfter(action, exec)) {
                      <div class="timeline-entry__halt">
                        <mat-icon>dangerous</mat-icon>
                        Execution stopped &mdash; ContinueOnError was not enabled
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Show "Not reached" for actions beyond the halt point -->
              @if (unreachedCount() > 0) {
                <div class="timeline-entry timeline-entry--unreached">
                  <div class="timeline-entry__line timeline-entry__line--last"></div>
                  <div class="timeline-entry__dot">
                    <mat-icon class="timeline-dot timeline-dot--skip">more_horiz</mat-icon>
                  </div>
                  <div class="timeline-entry__content">
                    <span class="timeline-entry__not-reached">
                      {{ unreachedCount() }} action{{ unreachedCount() !== 1 ? 's' : '' }} not reached
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Error Message (top-level) -->
        @if (exec.errorMessage) {
          <div class="log-detail__card log-detail__card--error">
            <h2>
              <mat-icon>error_outline</mat-icon>
              Error
            </h2>
            <div class="log-detail__error-body">
              <pre>{{ exec.errorMessage }}</pre>
            </div>
          </div>
        }

        <!-- Raw Data (expandable) -->
        <mat-accordion>
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon>code</mat-icon>
                Raw Execution Data
              </mat-panel-title>
            </mat-expansion-panel-header>
            <pre class="log-detail__raw-json">{{ exec | json }}</pre>
          </mat-expansion-panel>
        </mat-accordion>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .log-detail {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .log-detail__loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    /* ---- Header ---- */

    .log-detail__header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .log-detail__header-info {
      flex: 1;
      min-width: 120px;

      h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 500;
      }
    }

    .log-detail__status-badge {
      display: inline-block;
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: 500;
    }

    .status--succeeded { background-color: #dcfce7; color: #166534; }
    .status--partiallyFailed, .status--partiallyfailed { background-color: #fef3c7; color: #92400e; }
    .status--failed { background-color: #fecaca; color: #991b1b; }
    .status--skipped { background-color: #e2e8f0; color: #475569; }

    .log-detail__duration-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--color-text-secondary, #64748b);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .log-detail__timestamp {
      font-size: 13px;
      color: var(--color-text-secondary, #64748b);
    }

    /* ---- Cards ---- */

    .log-detail__card {
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      background: var(--color-surface, #ffffff);

      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 500;
        margin: 0 0 12px 0;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: var(--color-primary, #f97316);
        }
      }
    }

    .log-detail__card--error {
      border-color: var(--color-danger, #ef4444);
      background: var(--color-danger-soft, #fef2f2);

      h2 mat-icon {
        color: var(--color-danger, #ef4444);
      }
    }

    .log-detail__card-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .log-detail__field {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .log-detail__field-label {
      font-weight: 500;
      color: var(--color-text-secondary, #64748b);
      min-width: 80px;
    }

    .log-detail__entity-link {
      color: var(--color-primary, #f97316);
      text-decoration: none;
      font-family: monospace;
      font-size: 13px;
      margin-left: 4px;

      &:hover {
        text-decoration: underline;
      }
    }

    .log-detail__no-conditions {
      color: var(--color-text-secondary, #64748b);
      font-size: 14px;
      margin: 0;
    }

    .log-detail__conditions-pass {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--color-success-text, #15803d);
      font-weight: 500;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .log-detail__conditions-fail {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--color-danger-text, #b91c1c);
      font-weight: 500;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    /* ---- Section ---- */

    .log-detail__section {
      margin-bottom: 24px;

      h2 {
        font-size: 18px;
        font-weight: 500;
        margin: 0 0 16px 0;
      }
    }

    /* ---- Timeline ---- */

    .log-detail__timeline {
      position: relative;
      padding-left: 8px;
    }

    .timeline-entry {
      display: flex;
      gap: 12px;
      position: relative;
      padding-bottom: 20px;
    }

    .timeline-entry__line {
      position: absolute;
      left: 18px;
      top: 28px;
      bottom: 0;
      width: 2px;
      background: var(--color-border, #e2e8f0);

      &--last {
        display: none;
      }
    }

    .timeline-entry__dot {
      flex-shrink: 0;
      width: 36px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 2px;
    }

    .timeline-dot {
      font-size: 22px;
      width: 22px;
      height: 22px;

      &--success { color: var(--color-success, #22c55e); }
      &--error { color: var(--color-danger, #ef4444); }
      &--skip { color: var(--color-text-secondary, #94a3b8); }
    }

    .timeline-entry__content {
      flex: 1;
      min-width: 0;
    }

    .timeline-entry__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .timeline-entry__type {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      font-size: 14px;
    }

    .timeline-entry__type-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-secondary, #64748b);
    }

    .timeline-entry__meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .timeline-entry__badge {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }

    .timeline-entry__duration {
      font-size: 12px;
      color: var(--color-text-secondary, #64748b);
      font-family: monospace;
    }

    .timeline-entry__details {
      display: flex;
      gap: 16px;
      margin-top: 4px;
      font-size: 12px;
      color: var(--color-text-secondary, #64748b);
    }

    .timeline-entry__node-id {
      font-family: monospace;
    }

    .timeline-entry__error {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 8px;
      padding: 12px;
      background: var(--color-danger-soft, #fef2f2);
      border: 1px solid var(--color-danger, #ef4444);
      border-radius: 6px;

      mat-icon {
        color: var(--color-danger, #ef4444);
        font-size: 18px;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      pre {
        margin: 0;
        font-size: 13px;
        font-family: 'SF Mono', 'Fira Code', monospace;
        color: var(--color-danger-text, #b91c1c);
        white-space: pre-wrap;
        word-break: break-word;
        overflow-x: auto;
      }
    }

    .timeline-entry__halt {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 8px 12px;
      background: var(--color-danger-soft, #fef2f2);
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-danger-text, #b91c1c);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--color-danger, #ef4444);
      }
    }

    .timeline-entry--unreached {
      opacity: 0.5;
    }

    .timeline-entry__not-reached {
      font-size: 14px;
      color: var(--color-text-secondary, #94a3b8);
      font-style: italic;
    }

    /* ---- Error Body ---- */

    .log-detail__error-body {
      pre {
        margin: 0;
        font-size: 13px;
        font-family: 'SF Mono', 'Fira Code', monospace;
        color: var(--color-danger-text, #b91c1c);
        white-space: pre-wrap;
        word-break: break-word;
      }
    }

    /* ---- Raw JSON ---- */

    .log-detail__raw-json {
      margin: 0;
      padding: 16px;
      background: var(--color-bg, #f7f7f5);
      border-radius: 6px;
      font-size: 12px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 400px;
      overflow-y: auto;
    }

    mat-expansion-panel {
      margin-top: 16px;
    }

    mat-panel-title {
      display: flex;
      align-items: center;
      gap: 8px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    /* ---- Responsive ---- */

    @media (max-width: 600px) {
      .log-detail {
        padding: 16px;
      }

      .log-detail__header {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionLogDetailComponent implements OnInit {
  /** Route param: workflow ID */
  readonly id = input.required<string>();
  /** Route param: execution log ID */
  readonly logId = input.required<string>();

  private readonly service = inject(WorkflowService);

  readonly log = signal<WorkflowExecutionLog | null>(null);
  readonly loading = signal(false);

  /** Actions sorted by execution order */
  readonly sortedActions = signal<WorkflowActionLog[]>([]);

  /** Count of actions that were not reached due to halt */
  readonly unreachedCount = signal(0);

  ngOnInit(): void {
    this.loading.set(true);
    this.service
      .getExecutionLogDetail(this.id(), this.logId())
      .subscribe({
        next: (execLog) => {
          this.log.set(execLog);
          const actions = [...(execLog.actionLogs ?? [])].sort(
            (a, b) => a.order - b.order,
          );
          this.sortedActions.set(actions);

          // Calculate unreached actions (status is Skipped after a Failed action with no ContinueOnError)
          const failIndex = actions.findIndex((a) => a.status === 'Failed');
          if (failIndex >= 0 && execLog.status === 'failed') {
            const unreached = actions
              .slice(failIndex + 1)
              .filter((a) => a.status === 'Skipped').length;
            this.unreachedCount.set(unreached);
          }

          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'succeeded':
        return 'Succeeded';
      case 'partiallyFailed':
        return 'Partially Failed';
      case 'failed':
        return 'Failed';
      case 'skipped':
        return 'Skipped';
      default:
        return status;
    }
  }

  getActionIcon(actionType: string): string {
    switch (actionType) {
      case 'updateField':
        return 'edit_note';
      case 'sendNotification':
        return 'notifications';
      case 'createActivity':
        return 'event';
      case 'sendEmail':
        return 'email';
      case 'fireWebhook':
        return 'webhook';
      case 'enrollInSequence':
        return 'playlist_add';
      case 'branch':
        return 'call_split';
      case 'wait':
        return 'hourglass_empty';
      default:
        return 'settings';
    }
  }

  getEntityLink(entityType: string, entityId: string): string[] {
    const typeMap: Record<string, string> = {
      Contact: '/contacts',
      Company: '/companies',
      Deal: '/deals',
      Lead: '/leads',
      Activity: '/activities',
    };
    const base = typeMap[entityType] ?? '/';
    return [base, entityId];
  }

  /** Check if execution halted after this action (failed + not ContinueOnError) */
  isHaltedAfter(
    action: WorkflowActionLog,
    exec: WorkflowExecutionLog,
  ): boolean {
    if (action.status !== 'Failed') return false;
    if (exec.status !== 'failed') return false;
    const actions = this.sortedActions();
    const idx = actions.indexOf(action);
    // If there are skipped actions after this one, execution was halted
    return (
      idx < actions.length - 1 &&
      actions.slice(idx + 1).some((a) => a.status === 'Skipped')
    );
  }
}
