import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { FFlowModule } from '@foblex/flow';
import { MatIconModule } from '@angular/material/icon';
import { WorkflowNode } from '../../workflow.models';

@Component({
  selector: 'app-trigger-node',
  standalone: true,
  imports: [FFlowModule, MatIconModule],
  template: `
    <div fNode
         [fNodeId]="node().id"
         [fNodePosition]="node().position"
         class="workflow-node trigger-node"
         [class.selected]="isSelected()"
         (click)="selected.emit(node().id)">

      <div class="node-content">
        <div class="node-header">
          <div class="node-icon">
            <mat-icon>bolt</mat-icon>
          </div>
          <div class="node-info">
            <span class="node-label">{{ node().label || 'Trigger' }}</span>
            @if (triggerTypeBadge) {
              <span class="node-badge">{{ triggerTypeBadge }}</span>
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

    .trigger-node {
      border-left: 4px solid #3B82F6;
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
      background: #EFF6FF;
      color: #3B82F6;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    :host-context([data-theme="dark"]) .node-icon,
    :host-context(.dark) .node-icon {
      background: rgba(59, 130, 246, 0.15);
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
      background: #3B82F6;
      border: 2px solid var(--color-surface);
      position: absolute;
      z-index: 1;
    }

    .connector-output {
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TriggerNodeComponent {
  readonly node = input.required<WorkflowNode>();
  readonly isSelected = input<boolean>(false);
  readonly selected = output<string>();

  get triggerTypeBadge(): string {
    const config = this.node().config;
    if (!config) return '';
    switch (config['triggerType']) {
      case 'recordCreated': return 'Record Created';
      case 'recordUpdated': return 'Record Updated';
      case 'recordDeleted': return 'Record Deleted';
      case 'fieldChanged': return 'Field Changed';
      case 'dateBased': return 'Date Based';
      default: return '';
    }
  }
}
