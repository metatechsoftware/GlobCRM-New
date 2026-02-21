import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  viewChild,
  inject,
} from '@angular/core';
import {
  FFlowModule,
  FCanvasComponent,
  FCreateConnectionEvent,
  FSelectionChangeEvent,
  FMoveNodesEvent,
} from '@foblex/flow';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { WorkflowNode, WorkflowConnection } from '../workflow.models';

@Component({
  selector: 'app-workflow-canvas',
  standalone: true,
  imports: [
    FFlowModule,
    MatIconModule,
    MatButtonModule,
    TranslocoPipe,
  ],
  template: `
    @if (nodes().length === 0) {
      <div class="empty-canvas">
        <button mat-button class="add-trigger-btn" (click)="onAddTriggerClick()">
          <mat-icon>add</mat-icon>
          <span>{{ 'builder.trigger' | transloco }}</span>
        </button>
      </div>
    }

    <f-flow fDraggable
            (fSelectionChange)="onSelectionChange($event)"
            (fCreateConnection)="onConnectionCreate($event)"
            (fMoveNodes)="onNodesMoved($event)"
            class="flow-container"
            [class.hidden]="nodes().length === 0">
      <f-canvas>
        <!-- IMPORTANT: div[fNode] must be a DIRECT child of @for (no @switch wrapper).
             Angular's ng-content select="[fNode]" in f-canvas does not match elements
             nested inside @switch/@case embedded views (Angular issue #55462). -->
        @for (node of nodes(); track node.id) {
          <div fNode
               [fNodeId]="node.id"
               [fNodePosition]="node.position"
               class="workflow-node"
               [class.trigger-node]="node.type === 'trigger'"
               [class.condition-node]="node.type === 'condition'"
               [class.action-node]="node.type === 'action'"
               [class.branch-node]="node.type === 'branch'"
               [class.wait-node]="node.type === 'wait'"
               [class.selected]="selectedNodeId() === node.id"
               (click)="nodeSelected.emit(node.id)"
               (dblclick)="nodeDblClicked.emit(node.id)">

            <!-- Input connector (all types except trigger) -->
            @if (node.type !== 'trigger') {
              <div fNodeInput
                   [fInputId]="node.id + '_input'"
                   fInputConnectableSide="top"
                   class="connector connector-input"
                   [class.condition-connector]="node.type === 'condition'"
                   [class.action-connector]="node.type === 'action'"
                   [class.branch-connector]="node.type === 'branch'"
                   [class.wait-connector]="node.type === 'wait'">
              </div>
            }

            <!-- Node content -->
            <div class="node-content">
              <div class="node-header">
                <div class="node-icon"
                     [class.trigger-icon]="node.type === 'trigger'"
                     [class.condition-icon]="node.type === 'condition'"
                     [class.action-icon]="node.type === 'action'"
                     [class.branch-icon]="node.type === 'branch'"
                     [class.wait-icon]="node.type === 'wait'">
                  <mat-icon>{{ getNodeIcon(node) }}</mat-icon>
                </div>
                <div class="node-info">
                  <span class="node-label">{{ node.label || getDefaultLabel(node.type) }}</span>
                  @if (getNodeBadge(node)) {
                    <span class="node-badge">{{ getNodeBadge(node) }}</span>
                  }
                </div>
              </div>
            </div>

            <!-- Branch outputs (yes/no) -->
            @if (node.type === 'branch') {
              <div class="branch-outputs">
                <div class="branch-output-wrapper">
                  <div fNodeOutput
                       [fOutputId]="node.id + '_output_yes'"
                       fOutputConnectableSide="bottom"
                       class="connector connector-output-yes">
                  </div>
                  <span class="branch-label yes-label">Yes</span>
                </div>
                <div class="branch-output-wrapper">
                  <div fNodeOutput
                       [fOutputId]="node.id + '_output_no'"
                       fOutputConnectableSide="bottom"
                       class="connector connector-output-no">
                  </div>
                  <span class="branch-label no-label">No</span>
                </div>
              </div>
            }

            <!-- Standard output connector (all types except branch) -->
            @if (node.type !== 'branch') {
              <div fNodeOutput
                   [fOutputId]="node.id + '_output'"
                   fOutputConnectableSide="bottom"
                   class="connector connector-output"
                   [class.trigger-connector]="node.type === 'trigger'"
                   [class.condition-connector]="node.type === 'condition'"
                   [class.action-connector]="node.type === 'action'"
                   [class.wait-connector]="node.type === 'wait'">
              </div>
            }
          </div>
        }

        @for (conn of connections(); track conn.id) {
          <f-connection
            [fConnectionId]="conn.id"
            [fOutputId]="conn.sourceNodeId + '_output' + (conn.sourceOutput ? '_' + conn.sourceOutput : '')"
            [fInputId]="conn.targetNodeId + '_input'">
          </f-connection>
        }

        <f-connection-for-create></f-connection-for-create>
      </f-canvas>
    </f-flow>

    <!-- Zoom Controls -->
    @if (nodes().length > 0) {
      <div class="zoom-controls">
        <button mat-icon-button (click)="zoomIn()" class="zoom-btn" title="Zoom in">
          <mat-icon>add</mat-icon>
        </button>
        <button mat-icon-button (click)="zoomOut()" class="zoom-btn" title="Zoom out">
          <mat-icon>remove</mat-icon>
        </button>
        <button mat-icon-button (click)="fitToView()" class="zoom-btn" title="Fit to view">
          <mat-icon>fit_screen</mat-icon>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .flow-container {
      width: 100%;
      height: 100%;
      background:
        radial-gradient(circle, var(--color-border-subtle) 1px, transparent 1px);
      background-size: 20px 20px;

      &.hidden {
        visibility: hidden;
        position: absolute;
        width: 0;
        height: 0;
        overflow: hidden;
      }
    }

    .empty-canvas {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background:
        radial-gradient(circle, var(--color-border-subtle) 1px, transparent 1px);
      background-size: 20px 20px;
    }

    .add-trigger-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 24px;
      border-radius: var(--radius-lg);
      border: 2px dashed var(--color-border-strong);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-size: var(--text-md);
      cursor: pointer;
      transition: all var(--duration-normal) var(--ease-default);

      &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background: var(--color-primary-soft);
      }

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    }

    .zoom-controls {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--color-surface);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      padding: 4px;
      z-index: 10;
    }

    .zoom-btn {
      width: 36px;
      height: 36px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    /* Shared node styles */
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

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
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

    /* Trigger node - Blue */
    .trigger-node {
      border-left: 4px solid #3B82F6;
    }

    .trigger-icon {
      background: #EFF6FF;
      color: #3B82F6;
    }

    .trigger-connector {
      background: #3B82F6;
    }

    /* Condition node - Amber */
    .condition-node {
      border-left: 4px solid #F59E0B;
    }

    .condition-icon {
      background: #FFFBEB;
      color: #F59E0B;
    }

    .condition-connector {
      background: #F59E0B;
    }

    /* Action node - Green */
    .action-node {
      border-left: 4px solid #10B981;
    }

    .action-icon {
      background: #ECFDF5;
      color: #10B981;
    }

    .action-connector {
      background: #10B981;
    }

    /* Branch node - Purple */
    .branch-node {
      border-left: 4px solid #8B5CF6;
    }

    .branch-icon {
      background: #F5F3FF;
      color: #8B5CF6;
    }

    .branch-connector {
      background: #8B5CF6;
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

    .connector-output-yes {
      background: var(--color-success);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--color-surface);
      z-index: 1;
    }

    .connector-output-no {
      background: var(--color-danger);
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--color-surface);
      z-index: 1;
    }

    /* Wait node - Gray */
    .wait-node {
      border-left: 4px solid #6B7280;
    }

    .wait-icon {
      background: #F3F4F6;
      color: #6B7280;
    }

    .wait-connector {
      background: #6B7280;
    }

    /* Dark mode overrides */
    :host-context([data-theme="dark"]),
    :host-context(.dark) {
      .trigger-icon { background: rgba(59, 130, 246, 0.15); }
      .condition-icon { background: rgba(245, 158, 11, 0.15); }
      .action-icon { background: rgba(16, 185, 129, 0.15); }
      .branch-icon { background: rgba(139, 92, 246, 0.15); }
      .wait-icon { background: rgba(107, 114, 128, 0.15); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowCanvasComponent {
  private readonly transloco = inject(TranslocoService);
  readonly nodes = input<WorkflowNode[]>([]);
  readonly connections = input<WorkflowConnection[]>([]);
  readonly selectedNodeId = input<string | null>(null);

  readonly nodeSelected = output<string>();
  readonly nodeAdded = output<{ type: WorkflowNode['type']; position: { x: number; y: number } }>();
  readonly connectionCreated = output<{ sourceNodeId: string; targetNodeId: string; sourceOutput?: string }>();
  readonly connectionRemoved = output<string>();
  readonly nodePositionChanged = output<{ nodeId: string; position: { x: number; y: number } }>();
  readonly nodeDblClicked = output<string>();

  private readonly fCanvas = viewChild(FCanvasComponent);

  onAddTriggerClick(): void {
    this.nodeAdded.emit({
      type: 'trigger',
      position: { x: 400, y: 100 },
    });
  }

  onSelectionChange(event: FSelectionChangeEvent): void {
    if (event.nodeIds.length > 0) {
      this.nodeSelected.emit(event.nodeIds[0]);
    }
  }

  onConnectionCreate(event: FCreateConnectionEvent): void {
    if (!event.targetId) return;

    // Parse the output ID to extract source node ID and optional output suffix
    const sourceId = event.sourceId;
    const targetId = event.targetId;

    // sourceId format: "nodeId_output" or "nodeId_output_yes"/"nodeId_output_no"
    const sourceOutputMatch = sourceId.match(/^(.+?)_output(?:_(.+))?$/);
    const targetInputMatch = targetId.match(/^(.+?)_input$/);

    if (sourceOutputMatch && targetInputMatch) {
      this.connectionCreated.emit({
        sourceNodeId: sourceOutputMatch[1],
        targetNodeId: targetInputMatch[1],
        sourceOutput: sourceOutputMatch[2],
      });
    }
  }

  onNodesMoved(event: FMoveNodesEvent): void {
    for (const moved of event.nodes) {
      this.nodePositionChanged.emit({
        nodeId: moved.id,
        position: { x: moved.position.x, y: moved.position.y },
      });
    }
  }

  zoomIn(): void {
    const canvas = this.fCanvas();
    if (canvas) {
      const currentScale = canvas.getScale();
      canvas.setScale(Math.min(currentScale * 1.2, 3));
    }
  }

  zoomOut(): void {
    const canvas = this.fCanvas();
    if (canvas) {
      const currentScale = canvas.getScale();
      canvas.setScale(Math.max(currentScale * 0.8, 0.2));
    }
  }

  fitToView(): void {
    const canvas = this.fCanvas();
    if (canvas) {
      canvas.fitToScreen({ x: 40, y: 40 }, true);
    }
  }

  // Helper methods for unified node template

  getNodeIcon(node: WorkflowNode): string {
    switch (node.type) {
      case 'trigger': return 'bolt';
      case 'condition': return 'filter_list';
      case 'action': return this.getActionIcon(node);
      case 'branch': return 'call_split';
      case 'wait': return 'hourglass_empty';
      default: return 'circle';
    }
  }

  getDefaultLabel(type: string): string {
    const key = `builder.${type}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : type;
  }

  getNodeBadge(node: WorkflowNode): string {
    switch (node.type) {
      case 'trigger': return this.getTriggerBadge(node);
      case 'condition':
      case 'branch': return this.getConditionSummary(node);
      case 'action': return this.getActionBadge(node);
      case 'wait': return this.getWaitSummary(node);
      default: return '';
    }
  }

  private getTriggerBadge(node: WorkflowNode): string {
    const config = node.config;
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

  private getActionIcon(node: WorkflowNode): string {
    const actionType = node.config?.['actionType'];
    switch (actionType) {
      case 'updateField': return 'edit';
      case 'sendNotification': return 'notifications';
      case 'createActivity': return 'task_alt';
      case 'sendEmail': return 'email';
      case 'fireWebhook': return 'webhook';
      case 'enrollInSequence': return 'schedule_send';
      default: return 'play_arrow';
    }
  }

  private getActionBadge(node: WorkflowNode): string {
    const actionType = node.config?.['actionType'];
    switch (actionType) {
      case 'updateField': return 'Update Field';
      case 'sendNotification': return 'Send Notification';
      case 'createActivity': return 'Create Activity';
      case 'sendEmail': return 'Send Email';
      case 'fireWebhook': return 'Fire Webhook';
      case 'enrollInSequence': return 'Enroll in Sequence';
      default: return '';
    }
  }

  private getConditionSummary(node: WorkflowNode): string {
    const config = node.config;
    if (!config?.['conditions']?.length) return '';
    const first = config['conditions'][0];
    if (first?.field && first?.operator) {
      const val = first.value ? ` ${first.value}` : '';
      return `${first.field} ${first.operator}${val}`;
    }
    return '';
  }

  private getWaitSummary(node: WorkflowNode): string {
    const config = node.config;
    if (!config?.['duration'] || !config?.['unit']) return '';
    const duration = config['duration'];
    const unit = config['unit'];
    return `Wait ${duration} ${unit}`;
  }
}
