import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  viewChild,
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
import { WorkflowNode, WorkflowConnection } from '../workflow.models';
import { TriggerNodeComponent } from './nodes/trigger-node.component';
import { ConditionNodeComponent } from './nodes/condition-node.component';
import { ActionNodeComponent } from './nodes/action-node.component';
import { BranchNodeComponent } from './nodes/branch-node.component';
import { WaitNodeComponent } from './nodes/wait-node.component';

@Component({
  selector: 'app-workflow-canvas',
  standalone: true,
  imports: [
    FFlowModule,
    MatIconModule,
    MatButtonModule,
    TriggerNodeComponent,
    ConditionNodeComponent,
    ActionNodeComponent,
    BranchNodeComponent,
    WaitNodeComponent,
  ],
  template: `
    @if (nodes().length === 0) {
      <div class="empty-canvas">
        <button mat-button class="add-trigger-btn" (click)="onAddTriggerClick()">
          <mat-icon>add</mat-icon>
          <span>Add trigger to start</span>
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
        @for (node of nodes(); track node.id) {
          @switch (node.type) {
            @case ('trigger') {
              <app-trigger-node
                [node]="node"
                [isSelected]="selectedNodeId() === node.id"
                (selected)="nodeSelected.emit($event)"
                (dblclick)="nodeDblClicked.emit(node.id)" />
            }
            @case ('condition') {
              <app-condition-node
                [node]="node"
                [isSelected]="selectedNodeId() === node.id"
                (selected)="nodeSelected.emit($event)"
                (dblclick)="nodeDblClicked.emit(node.id)" />
            }
            @case ('action') {
              <app-action-node
                [node]="node"
                [isSelected]="selectedNodeId() === node.id"
                (selected)="nodeSelected.emit($event)"
                (dblclick)="nodeDblClicked.emit(node.id)" />
            }
            @case ('branch') {
              <app-branch-node
                [node]="node"
                [isSelected]="selectedNodeId() === node.id"
                (selected)="nodeSelected.emit($event)"
                (dblclick)="nodeDblClicked.emit(node.id)" />
            }
            @case ('wait') {
              <app-wait-node
                [node]="node"
                [isSelected]="selectedNodeId() === node.id"
                (selected)="nodeSelected.emit($event)"
                (dblclick)="nodeDblClicked.emit(node.id)" />
            }
          }
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowCanvasComponent {
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
}
