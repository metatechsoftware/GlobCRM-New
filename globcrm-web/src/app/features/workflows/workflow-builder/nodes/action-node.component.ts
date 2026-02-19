import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { FFlowModule } from '@foblex/flow';
import { MatIconModule } from '@angular/material/icon';
import { WorkflowNode } from '../../workflow.models';

@Component({
  selector: 'app-action-node',
  standalone: true,
  imports: [FFlowModule, MatIconModule],
  template: `
    <div fNode
         [fNodeId]="node().id"
         [fNodePosition]="node().position"
         class="workflow-node action-node"
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
            <mat-icon>{{ actionIcon() }}</mat-icon>
          </div>
          <div class="node-info">
            <span class="node-label">{{ node().label || 'Action' }}</span>
            @if (actionTypeBadge()) {
              <span class="node-badge">{{ actionTypeBadge() }}</span>
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

    .action-node {
      border-left: 4px solid #10B981;
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
      background: #ECFDF5;
      color: #10B981;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    :host-context([data-theme="dark"]) .node-icon,
    :host-context(.dark) .node-icon {
      background: rgba(16, 185, 129, 0.15);
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
      background: #10B981;
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
export class ActionNodeComponent {
  readonly node = input.required<WorkflowNode>();
  readonly isSelected = input<boolean>(false);
  readonly selected = output<string>();

  readonly actionIcon = computed(() => {
    const actionType = this.node().config?.['actionType'];
    switch (actionType) {
      case 'updateField': return 'edit';
      case 'sendNotification': return 'notifications';
      case 'createActivity': return 'task_alt';
      case 'sendEmail': return 'email';
      case 'fireWebhook': return 'webhook';
      case 'enrollInSequence': return 'schedule_send';
      default: return 'play_arrow';
    }
  });

  readonly actionTypeBadge = computed(() => {
    const actionType = this.node().config?.['actionType'];
    switch (actionType) {
      case 'updateField': return 'Update Field';
      case 'sendNotification': return 'Send Notification';
      case 'createActivity': return 'Create Activity';
      case 'sendEmail': return 'Send Email';
      case 'fireWebhook': return 'Fire Webhook';
      case 'enrollInSequence': return 'Enroll in Sequence';
      default: return '';
    }
  });
}
