import { Component, ChangeDetectionStrategy, input, output, inject } from '@angular/core';
import { FFlowModule } from '@foblex/flow';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { WorkflowNode } from '../../workflow.models';

@Component({
  selector: 'app-branch-node',
  standalone: true,
  imports: [FFlowModule, MatIconModule, TranslocoPipe],
  template: `
    <div fNode
         [fNodeId]="node().id"
         [fNodePosition]="node().position"
         class="workflow-node branch-node"
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
            <mat-icon>call_split</mat-icon>
          </div>
          <div class="node-info">
            <span class="node-label">{{ node().label || ('workflows.builder.branch' | transloco) }}</span>
            @if (conditionSummary) {
              <span class="node-badge">{{ conditionSummary }}</span>
            }
          </div>
        </div>
      </div>

      <div class="branch-outputs">
        <div class="branch-output-wrapper">
          <div fNodeOutput
               [fOutputId]="node().id + '_output_yes'"
               fOutputConnectableSide="bottom"
               class="connector connector-output-yes">
          </div>
          <span class="branch-label yes-label">{{ 'workflows.builder.branchYes' | transloco }}</span>
        </div>
        <div class="branch-output-wrapper">
          <div fNodeOutput
               [fOutputId]="node().id + '_output_no'"
               fOutputConnectableSide="bottom"
               class="connector connector-output-no">
          </div>
          <span class="branch-label no-label">{{ 'workflows.builder.branchNo' | transloco }}</span>
        </div>
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

    .branch-node {
      border-left: 4px solid #8B5CF6;
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
      background: #F5F3FF;
      color: #8B5CF6;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    :host-context([data-theme="dark"]) .node-icon,
    :host-context(.dark) .node-icon {
      background: rgba(139, 92, 246, 0.15);
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

    .branch-outputs {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      padding: 0 12px;
    }

    .branch-output-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }

    .branch-label {
      font-size: 10px;
      font-weight: var(--font-medium);
      margin-top: 2px;
    }

    .yes-label {
      color: var(--color-success-text);
    }

    .no-label {
      color: var(--color-danger-text);
    }

    .connector {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--color-surface);
      z-index: 1;
    }

    .connector-input {
      background: #8B5CF6;
      position: absolute;
      top: -5px;
      left: 50%;
      transform: translateX(-50%);
    }

    .connector-output-yes {
      background: var(--color-success);
    }

    .connector-output-no {
      background: var(--color-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchNodeComponent {
  readonly node = input.required<WorkflowNode>();
  readonly isSelected = input<boolean>(false);
  readonly selected = output<string>();

  private readonly transloco = inject(TranslocoService);

  get conditionSummary(): string {
    const config = this.node().config;
    if (!config?.['conditions']?.length) return '';
    const first = config['conditions'][0];
    if (first?.field && first?.operator) {
      const val = first.value ? ` ${first.value}` : '';
      return `${this.transloco.translate('workflows.nodes.ifPrefix')} ${first.field} ${first.operator}${val}`;
    }
    return '';
  }
}
