import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FFlowModule } from '@foblex/flow';
import { MatIconModule } from '@angular/material/icon';
import { WorkflowNode } from '../../workflow.models';

@Component({
  selector: 'app-condition-node',
  standalone: true,
  imports: [FFlowModule, MatIconModule],
  template: `
    <div fNode
         [fNodeId]="node().id"
         [fNodePosition]="node().position"
         class="workflow-node condition-node"
         [class.selected]="isSelected()"
         (click)="selected.emit(node().id)">

      <div fNodeInput
           [fInputId]="node().id + '_input'"
           fInputConnectableSide="top"
           class="connector connector-input">
      </div>

      <div class="node-content">
        <div class="node-header">
          <div class="node-icon">
            <mat-icon>filter_list</mat-icon>
          </div>
          <div class="node-info">
            <span class="node-label">{{ node().label || 'Condition' }}</span>
            @if (conditionSummary) {
              <span class="node-badge">{{ conditionSummary }}</span>
            }
          </div>
        </div>
      </div>

      <div fNodeOutput
           [fOutputId]="node().id + '_output'"
           fOutputConnectableSide="bottom"
           class="connector connector-output">
      </div>
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }

    .workflow-node {
      min-width: 220px;
      padding: 12px;
      border-radius: 8px;
      background: var(--color-surface);
      border: 2px solid transparent;
      cursor: pointer;
      transition: border-color var(--duration-fast) var(--ease-default),
                  box-shadow var(--duration-fast) var(--ease-default);
      position: relative;

      &:hover {
        box-shadow: var(--shadow-md);
      }

      &.selected {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
      }
    }

    .condition-node {
      border-left: 4px solid #F59E0B;
    }

    .node-content {
      pointer-events: none;
    }

    .node-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .node-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: #FFFBEB;
      color: #F59E0B;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    :host-context([data-theme="dark"]) .node-icon,
    :host-context(.dark) .node-icon {
      background: rgba(245, 158, 11, 0.15);
    }

    .node-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .node-label {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .node-badge {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .connector {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #F59E0B;
      border: 2px solid var(--color-surface);
      position: absolute;
      z-index: 1;
    }

    .connector-input {
      top: -5px;
      left: 50%;
      transform: translateX(-50%);
    }

    .connector-output {
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionNodeComponent {
  readonly node = input.required<WorkflowNode>();
  readonly isSelected = input<boolean>(false);
  readonly selected = output<string>();

  get conditionSummary(): string {
    const config = this.node().config;
    if (!config?.['conditions']?.length) return '';
    const first = config['conditions'][0];
    if (first?.field && first?.operator) {
      const val = first.value ? ` ${first.value}` : '';
      return `${first.field} ${first.operator}${val}`;
    }
    return '';
  }
}
