import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { WorkflowListItem } from '../workflow.models';

/**
 * Individual workflow card with miniaturized flow diagram SVG thumbnail,
 * name, status badge, entity type chip, trigger summary, execution stats,
 * and enable/disable toggle. Used in the card grid on WorkflowListComponent.
 *
 * The SVG thumbnail uses a schematic approach (approach 2 from plan):
 * renders trigger nodes on the left, action nodes on the right, connected
 * by bezier curves within a 280x100 viewBox. Node colors match the
 * workflow node type color scheme.
 *
 * Enhanced with "Precision Control Room" visual treatment:
 * - Left status stripe (green/amber/gray)
 * - Animated SVG flow dashes + pulsing node rings on active workflows
 * - Staggered card entrance animation
 * - Enhanced hover with orange border glow
 */
@Component({
  selector: 'app-workflow-card',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatMenuModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="workflow-card"
      [class.is-active]="workflow().status === 'active'"
      [class.is-paused]="workflow().status === 'paused'"
      [class.is-draft]="workflow().status === 'draft'"
      (click)="onCardClick($event)"
    >
      <!-- Status Stripe -->
      <div class="workflow-card__status-stripe"></div>

      <!-- SVG Thumbnail -->
      <div class="workflow-card__thumbnail">
        @if (workflow().nodeCount === 0) {
          <div class="workflow-card__thumbnail-empty">
            <mat-icon>account_tree</mat-icon>
            <span>{{ 'card.emptyWorkflow' | transloco }}</span>
          </div>
        } @else {
          <svg
            [attr.viewBox]="'0 0 280 100'"
            class="workflow-card__svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Connections -->
            @for (conn of svgConnections(); track conn.id; let ci = $index) {
              <path
                [attr.d]="conn.path"
                fill="none"
                stroke="var(--color-border-strong, #D1D5DB)"
                stroke-width="1.5"
                stroke-opacity="0.6"
                [attr.stroke-dasharray]="workflow().status === 'active' ? '4 3' : null"
                [class.flow-path]="workflow().status === 'active'"
                [style.animation-delay]="workflow().status === 'active' ? (ci * 200) + 'ms' : null"
              />
            }
            <!-- Nodes -->
            @for (node of svgNodes(); track node.id) {
              <!-- Pulse ring for active workflows -->
              @if (workflow().status === 'active') {
                <circle
                  class="node-pulse"
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  [attr.r]="node.r"
                  fill="none"
                  [attr.stroke]="node.color"
                  stroke-width="0.5"
                  [style.animation-delay]="node.pulseDelay"
                />
              }
              <circle
                [attr.cx]="node.x"
                [attr.cy]="node.y"
                [attr.r]="node.r"
                [attr.fill]="node.color"
                opacity="0.85"
              />
            }
          </svg>
        }
      </div>

      <!-- Info Section -->
      <div class="workflow-card__info">
        <h3 class="workflow-card__name">{{ workflow().name }}</h3>
        @if (workflow().description) {
          <p class="workflow-card__desc">{{ workflow().description }}</p>
        }

        <div class="workflow-card__meta">
          <span class="workflow-card__entity-chip">{{ workflow().entityType }}</span>
          <span
            class="workflow-card__status"
            [class.status--draft]="workflow().status === 'draft'"
            [class.status--active]="workflow().status === 'active'"
            [class.status--paused]="workflow().status === 'paused'"
          >
            {{ workflow().status }}
          </span>
        </div>

        @if (workflow().triggerSummary.length > 0) {
          <div class="workflow-card__triggers">
            @for (trigger of displayTriggers(); track trigger; let i = $index) {
              <span class="workflow-card__trigger-chip">{{ trigger }}</span>
            }
            @if (workflow().triggerSummary.length > 3) {
              <span class="workflow-card__trigger-more">
                +{{ workflow().triggerSummary.length - 3 }}
              </span>
            }
          </div>
        }
      </div>

      <!-- Actions Section -->
      <div class="workflow-card__actions">
        <div class="workflow-card__stats">
          <span class="workflow-card__run-info">
            <mat-icon class="workflow-card__stat-icon">schedule</mat-icon>
            {{ lastRunText() }}
          </span>
          <span class="workflow-card__run-count">
            <mat-icon class="workflow-card__stat-icon">bar_chart</mat-icon>
            {{ 'card.runs' | transloco:{ count: workflow().executionCount } }}
          </span>
        </div>
        <div class="workflow-card__controls" (click)="$event.stopPropagation()">
          <mat-slide-toggle
            [checked]="workflow().isActive"
            (change)="toggleStatus.emit()"
            [matTooltip]="workflow().isActive ? ('card.disableWorkflow' | transloco) : ('card.enableWorkflow' | transloco)"
            color="primary"
          />
          <button
            mat-icon-button
            [matMenuTriggerFor]="cardMenu"
            [matTooltip]="'card.moreActions' | transloco"
            class="workflow-card__menu-btn"
          >
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #cardMenu="matMenu">
            <button mat-menu-item (click)="edit.emit()">
              <mat-icon>edit</mat-icon>
              <span>{{ 'card.edit' | transloco }}</span>
            </button>
            <button mat-menu-item (click)="duplicate.emit()">
              <mat-icon>content_copy</mat-icon>
              <span>{{ 'card.duplicate' | transloco }}</span>
            </button>
            <button mat-menu-item (click)="deleteWorkflow.emit()" class="workflow-card__delete-item">
              <mat-icon>delete</mat-icon>
              <span>{{ 'card.delete' | transloco }}</span>
            </button>
          </mat-menu>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      animation: cardEntrance 400ms var(--ease-default, ease-out) both;
      animation-delay: calc(var(--card-index, 0) * 60ms);
    }

    @keyframes cardEntrance {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .workflow-card {
      display: flex;
      flex-direction: column;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #E8E8E6);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      cursor: pointer;
      position: relative;
      transition: box-shadow var(--duration-normal, 200ms) var(--ease-default),
                  transform var(--duration-normal, 200ms) var(--ease-default),
                  border-color var(--duration-normal, 200ms) var(--ease-default);
    }

    .workflow-card:hover {
      box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1));
      transform: translateY(-2px);
      border-color: var(--color-primary, #F97316);
    }

    .workflow-card.is-active:hover {
      box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1)),
                  0 0 0 1px rgba(16, 185, 129, 0.2);
    }

    /* Status Stripe */
    .workflow-card__status-stripe {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 4px;
      border-radius: var(--radius-lg, 12px) 0 0 var(--radius-lg, 12px);
      z-index: 2;
    }

    .is-active .workflow-card__status-stripe {
      background: var(--color-success, #10B981);
      box-shadow: 2px 0 8px rgba(16, 185, 129, 0.25);
    }

    .is-paused .workflow-card__status-stripe {
      background: var(--color-warning, #F59E0B);
      box-shadow: 2px 0 8px rgba(245, 158, 11, 0.2);
    }

    .is-draft .workflow-card__status-stripe {
      background: var(--color-text-muted, #9CA3AF);
    }

    /* Thumbnail */
    .workflow-card__thumbnail {
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-bottom: 1px solid var(--color-border-subtle, #F0F0EE);
      position: relative;
    }

    .is-active .workflow-card__thumbnail {
      background: linear-gradient(135deg, #F0FDF8 0%, var(--color-bg-secondary, #F0F0EE) 100%);
    }

    .is-paused .workflow-card__thumbnail {
      background: linear-gradient(135deg, #FFFDF5 0%, var(--color-bg-secondary, #F0F0EE) 100%);
    }

    .is-draft .workflow-card__thumbnail {
      background: var(--color-bg-secondary, #F0F0EE);
    }

    /* Thumbnail hover radial glow */
    .workflow-card__thumbnail::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, var(--color-primary, #F97316) 0%, transparent 70%);
      opacity: 0;
      transition: opacity var(--duration-normal, 200ms) var(--ease-default);
      pointer-events: none;
    }

    .workflow-card:hover .workflow-card__thumbnail::after {
      opacity: 0.06;
    }

    .workflow-card__thumbnail-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: var(--color-text-muted, #9CA3AF);
    }

    .workflow-card__thumbnail-empty mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      opacity: 0.5;
    }

    .workflow-card__thumbnail-empty span {
      font-size: var(--text-xs, 12px);
    }

    .workflow-card__svg {
      width: 100%;
      height: 100%;
      padding: 8px 16px;
    }

    /* Flow path animation for active workflows */
    .flow-path {
      animation: flowDash 1.5s linear infinite;
    }

    @keyframes flowDash {
      from {
        stroke-dashoffset: 14;
      }
      to {
        stroke-dashoffset: 0;
      }
    }

    /* Node pulse ring animation for active workflows */
    .node-pulse {
      animation: nodeRingExpand 2.5s ease-out infinite;
    }

    @keyframes nodeRingExpand {
      0% {
        r: inherit;
        opacity: 0.6;
      }
      70% {
        opacity: 0;
      }
      100% {
        r: 16;
        opacity: 0;
      }
    }

    /* Info */
    .workflow-card__info {
      padding: var(--space-4, 16px);
      padding-left: calc(var(--space-4, 16px) + 4px);
      flex: 1;
    }

    .workflow-card__name {
      margin: 0;
      font-size: var(--text-base, 14px);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #1A1A1A);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .workflow-card__desc {
      margin: var(--space-1, 4px) 0 0;
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #6B7280);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: var(--leading-normal, 1.5);
    }

    .workflow-card__meta {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-top: var(--space-3, 12px);
    }

    .workflow-card__entity-chip {
      display: inline-block;
      font-size: var(--text-xs, 12px);
      padding: 2px 8px;
      border-radius: var(--radius-sm, 4px);
      background: var(--color-info-soft, #EFF6FF);
      color: var(--color-info-text, #1D4ED8);
      font-weight: var(--font-medium, 500);
      text-transform: capitalize;
    }

    .workflow-card__status {
      display: inline-block;
      font-size: var(--text-xs, 12px);
      padding: 2px 10px;
      border-radius: var(--radius-full, 9999px);
      font-weight: var(--font-medium, 500);
      text-transform: capitalize;
    }

    .status--draft {
      background-color: var(--color-bg-secondary, #F0F0EE);
      color: var(--color-text-secondary, #6B7280);
    }

    .status--active {
      background-color: var(--color-success-soft, #F0FDF4);
      color: var(--color-success-text, #15803D);
    }

    .status--paused {
      background-color: var(--color-warning-soft, #FFFBEB);
      color: var(--color-warning-text, #B45309);
    }

    /* Triggers */
    .workflow-card__triggers {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1, 4px);
      margin-top: var(--space-2, 8px);
    }

    .workflow-card__trigger-chip {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--radius-sm, 4px);
      background: #F5F3FF;
      color: #6D28D9;
      white-space: nowrap;
    }

    .workflow-card__trigger-more {
      font-size: 10px;
      padding: 1px 6px;
      color: var(--color-text-muted, #9CA3AF);
    }

    /* Actions */
    .workflow-card__actions {
      padding: var(--space-3, 12px) var(--space-4, 16px);
      padding-left: calc(var(--space-4, 16px) + 4px);
      border-top: 1px solid var(--color-border-subtle, #F0F0EE);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .workflow-card__stats {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .workflow-card__run-info,
    .workflow-card__run-count {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #6B7280);
    }

    .workflow-card__stat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .workflow-card__controls {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
    }

    .workflow-card__menu-btn {
      width: 32px;
      height: 32px;
      line-height: 32px;
    }

    .workflow-card__delete-item {
      color: var(--color-danger, #EF4444);
    }

    /* Dark mode overrides */
    :host-context([data-theme="dark"]) {
      .is-active .workflow-card__thumbnail {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--color-bg-secondary, #1F2937) 100%);
      }

      .is-paused .workflow-card__thumbnail {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, var(--color-bg-secondary, #1F2937) 100%);
      }

      .workflow-card:hover {
        box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.3)),
                    0 0 0 1px rgba(249, 115, 22, 0.3);
      }

      .workflow-card__trigger-chip {
        background: rgba(109, 40, 217, 0.15);
        color: #C4B5FD;
      }
    }
  `,
})
export class WorkflowCardComponent {
  private readonly transloco = inject(TranslocoService);
  readonly workflow = input.required<WorkflowListItem>();
  readonly toggleStatus = output<void>();
  readonly duplicate = output<void>();
  readonly deleteWorkflow = output<void>();
  readonly edit = output<void>();

  /** Show first 3 trigger summary strings */
  readonly displayTriggers = computed(() =>
    this.workflow().triggerSummary.slice(0, 3),
  );

  /** Relative time for last run */
  readonly lastRunText = computed(() => {
    const lastRun = this.workflow().lastExecutedAt;
    if (!lastRun) return this.transloco.translate('card.neverRun');
    const diff = Date.now() - new Date(lastRun).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return this.transloco.translate('card.justNow');
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  });

  /**
   * SVG thumbnail nodes using schematic approach (approach 2):
   * Trigger nodes on left, action nodes on right, proportionally spaced.
   * Each node includes a pulseDelay for staggered animation on active workflows.
   */
  readonly svgNodes = computed(() => {
    const wf = this.workflow();
    const triggerCount = Math.max(wf.triggerSummary.length, 1);
    const actionCount = Math.max(wf.nodeCount - triggerCount, 1);
    const nodes: { id: string; x: number; y: number; r: number; color: string; pulseDelay: string }[] = [];

    // Trigger nodes (left side, blue)
    for (let i = 0; i < triggerCount; i++) {
      const y = triggerCount === 1 ? 50 : 20 + (60 / (triggerCount - 1)) * i;
      nodes.push({
        id: `t${i}`,
        x: 40,
        y,
        r: 8,
        color: '#3B82F6',
        pulseDelay: `${i * 300}ms`,
      });
    }

    // If there are more than 2 total nodes, add a condition node in the center
    if (wf.nodeCount > 2) {
      nodes.push({
        id: 'c0',
        x: 140,
        y: 50,
        r: 7,
        color: '#F59E0B',
        pulseDelay: `${triggerCount * 300}ms`,
      });
    }

    // Action nodes (right side, green)
    for (let i = 0; i < Math.min(actionCount, 4); i++) {
      const effectiveCount = Math.min(actionCount, 4);
      const y = effectiveCount === 1 ? 50 : 20 + (60 / (effectiveCount - 1)) * i;
      nodes.push({
        id: `a${i}`,
        x: 240,
        y,
        r: 7,
        color: '#10B981',
        pulseDelay: `${(triggerCount + 1 + i) * 300}ms`,
      });
    }

    return nodes;
  });

  /** SVG connections between nodes */
  readonly svgConnections = computed(() => {
    const nodes = this.svgNodes();
    const connections: { id: string; path: string }[] = [];

    const triggers = nodes.filter((n) => n.id.startsWith('t'));
    const conditions = nodes.filter((n) => n.id.startsWith('c'));
    const actions = nodes.filter((n) => n.id.startsWith('a'));

    if (conditions.length > 0) {
      const cond = conditions[0];
      // Trigger -> Condition
      for (const trigger of triggers) {
        connections.push({
          id: `${trigger.id}-${cond.id}`,
          path: this.bezierPath(trigger.x, trigger.y, cond.x, cond.y),
        });
      }
      // Condition -> Actions
      for (const action of actions) {
        connections.push({
          id: `${cond.id}-${action.id}`,
          path: this.bezierPath(cond.x, cond.y, action.x, action.y),
        });
      }
    } else {
      // Direct trigger -> action
      for (const trigger of triggers) {
        for (const action of actions) {
          connections.push({
            id: `${trigger.id}-${action.id}`,
            path: this.bezierPath(trigger.x, trigger.y, action.x, action.y),
          });
        }
      }
    }

    return connections;
  });

  onCardClick(event: MouseEvent): void {
    // Don't navigate if clicking on controls area
    const target = event.target as HTMLElement;
    if (target.closest('.workflow-card__controls')) {
      return;
    }
  }

  private bezierPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): string {
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }
}
