import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  WorkflowNode,
  WorkflowConnection,
  WorkflowDefinition,
  EntityField,
} from '../workflow.models';
import { WorkflowService } from '../workflow.service';
import { WorkflowStore } from '../workflow.store';
import { WorkflowCanvasComponent } from './workflow-canvas.component';
import { WorkflowToolbarComponent } from './workflow-toolbar.component';
import { TriggerConfigComponent } from './panels/trigger-config.component';
import { ConditionConfigComponent } from './panels/condition-config.component';
import { ActionConfigComponent } from './panels/action-config.component';
import { TemplateGalleryComponent } from './panels/template-gallery.component';

@Component({
  selector: 'app-workflow-builder',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
    WorkflowCanvasComponent,
    WorkflowToolbarComponent,
    TriggerConfigComponent,
    ConditionConfigComponent,
    ActionConfigComponent,
    TemplateGalleryComponent,
  ],
  templateUrl: './workflow-builder.component.html',
  styleUrl: './workflow-builder.component.scss',
  providers: [WorkflowStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowBuilderComponent implements OnInit {
  /** Route param: workflow ID. Absent for new workflows. */
  readonly id = input<string>();

  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly service = inject(WorkflowService);
  private readonly store = inject(WorkflowStore);

  // -- Workflow metadata --
  readonly workflowName = signal('Untitled Workflow');
  readonly workflowDescription = signal('');
  readonly entityType = signal('Contact');
  readonly isActive = signal(false);

  // -- Canvas state --
  readonly nodes = signal<WorkflowNode[]>([]);
  readonly connections = signal<WorkflowConnection[]>([]);
  readonly selectedNodeId = signal<string | null>(null);

  // -- Sidebar --
  readonly sidebarMode = signal<'config' | 'templates' | null>(null);

  // -- UI state --
  readonly isDirty = signal(false);
  readonly isSaving = signal(false);

  readonly isNew = computed(() => !this.id());

  readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    if (!id) return null;
    return this.nodes().find((n) => n.id === id) ?? null;
  });

  readonly entityFields = signal<EntityField[]>([]);

  private nodeCounter = 0;

  ngOnInit(): void {
    const workflowId = this.id();
    if (workflowId) {
      this.loadWorkflow(workflowId);
    }
    this.loadEntityFields();
  }

  // -- Load existing workflow --

  private loadWorkflow(id: string): void {
    this.service.getWorkflow(id).subscribe({
      next: (workflow) => {
        this.workflowName.set(workflow.name);
        this.workflowDescription.set(workflow.description ?? '');
        this.entityType.set(workflow.entityType);
        this.isActive.set(workflow.isActive);

        if (workflow.definition) {
          this.nodes.set(workflow.definition.nodes ?? []);
          this.connections.set(workflow.definition.connections ?? []);
        }
      },
      error: () => {
        this.snackBar.open('Failed to load workflow', 'Dismiss', {
          duration: 3000,
        });
      },
    });
  }

  loadEntityFields(): void {
    const et = this.entityType();
    if (et) {
      this.service.getEntityFields(et).subscribe({
        next: (fields) => this.entityFields.set(fields),
        error: () => this.entityFields.set([]),
      });
    }
  }

  // -- Node management --

  onNodeSelected(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    if (this.sidebarMode() !== 'templates') {
      this.sidebarMode.set('config');
    }
  }

  onNodeAdded(event: {
    type: WorkflowNode['type'];
    position: { x: number; y: number };
  }): void {
    const id = this.generateNodeId();
    const labelMap: Record<string, string> = {
      trigger: 'Trigger',
      condition: 'Condition',
      action: 'Action',
      branch: 'Branch',
      wait: 'Wait',
    };

    const newNode: WorkflowNode = {
      id,
      type: event.type,
      label: labelMap[event.type] || event.type,
      position: event.position,
      config: {},
    };

    this.nodes.update((nodes) => [...nodes, newNode]);
    this.selectedNodeId.set(id);
    this.sidebarMode.set('config');
    this.markDirty();
  }

  addNode(type: WorkflowNode['type']): void {
    // Calculate position based on existing nodes
    const existing = this.nodes();
    const lastNode = existing[existing.length - 1];
    const position = lastNode
      ? { x: lastNode.position.x, y: lastNode.position.y + 120 }
      : { x: 400, y: 100 };

    this.onNodeAdded({ type, position });
  }

  removeNode(nodeId: string): void {
    this.nodes.update((nodes) => nodes.filter((n) => n.id !== nodeId));
    this.connections.update((conns) =>
      conns.filter(
        (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId,
      ),
    );
    if (this.selectedNodeId() === nodeId) {
      this.selectedNodeId.set(null);
      this.sidebarMode.set(null);
    }
    this.markDirty();
  }

  onConfigChanged(nodeId: string, config: Record<string, any>): void {
    this.nodes.update((nodes) =>
      nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return { ...n, config: { ...n.config, ...config } };
      }),
    );
    this.markDirty();
  }

  onNodeDblClicked(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    this.sidebarMode.set('config');
  }

  // -- Connection management --

  onConnectionCreated(event: {
    sourceNodeId: string;
    targetNodeId: string;
    sourceOutput?: string;
  }): void {
    // Prevent duplicate connections
    const exists = this.connections().some(
      (c) =>
        c.sourceNodeId === event.sourceNodeId &&
        c.targetNodeId === event.targetNodeId &&
        c.sourceOutput === event.sourceOutput,
    );
    if (exists) return;

    const conn: WorkflowConnection = {
      id: this.generateConnectionId(),
      sourceNodeId: event.sourceNodeId,
      targetNodeId: event.targetNodeId,
      sourceOutput: event.sourceOutput,
    };

    this.connections.update((conns) => [...conns, conn]);
    this.markDirty();
  }

  onConnectionRemoved(connId: string): void {
    this.connections.update((conns) => conns.filter((c) => c.id !== connId));
    this.markDirty();
  }

  onNodePositionChanged(event: {
    nodeId: string;
    position: { x: number; y: number };
  }): void {
    this.nodes.update((nodes) =>
      nodes.map((n) => {
        if (n.id !== event.nodeId) return n;
        return { ...n, position: event.position };
      }),
    );
    this.markDirty();
  }

  // -- Template --

  onTemplateApplied(definition: WorkflowDefinition): void {
    this.nodes.set(definition.nodes ?? []);
    this.connections.set(definition.connections ?? []);
    this.sidebarMode.set(null);
    this.selectedNodeId.set(null);
    this.markDirty();
    this.snackBar.open('Template applied', 'Dismiss', { duration: 2000 });
  }

  // -- Save --

  onSave(): void {
    this.isSaving.set(true);
    const definition = this.buildDefinition();
    const request = {
      name: this.workflowName(),
      description: this.workflowDescription() || undefined,
      entityType: this.entityType(),
      definition,
    };

    const workflowId = this.id();
    if (workflowId) {
      this.store.updateWorkflow(workflowId, request, (updated) => {
        this.isSaving.set(false);
        this.isDirty.set(false);
        this.snackBar.open('Workflow saved', 'Dismiss', { duration: 2000 });
      });
      // Handle store error
      setTimeout(() => {
        if (this.store.error()) {
          this.isSaving.set(false);
          this.snackBar.open(
            this.store.error() ?? 'Failed to save',
            'Dismiss',
            { duration: 3000 },
          );
        }
      }, 100);
    } else {
      this.store.createWorkflow(request, (created) => {
        this.isSaving.set(false);
        this.isDirty.set(false);
        this.snackBar.open('Workflow created', 'Dismiss', { duration: 2000 });
        this.router.navigate(['/workflows', created.id, 'edit']);
      });
      setTimeout(() => {
        if (this.store.error()) {
          this.isSaving.set(false);
          this.snackBar.open(
            this.store.error() ?? 'Failed to create',
            'Dismiss',
            { duration: 3000 },
          );
        }
      }, 100);
    }
  }

  onToggleActive(): void {
    const workflowId = this.id();
    if (!workflowId) return;
    const newState = !this.isActive();
    this.isActive.set(newState);
    this.store.toggleStatus(workflowId, newState);
  }

  onBack(): void {
    this.router.navigate(['/workflows']);
  }

  // -- Sidebar --

  closeSidebar(): void {
    this.sidebarMode.set(null);
  }

  // -- Utilities --

  markDirty(): void {
    this.isDirty.set(true);
  }

  private buildDefinition(): WorkflowDefinition {
    const currentNodes = this.nodes();
    const triggers = currentNodes
      .filter((n) => n.type === 'trigger')
      .map((n) => ({
        id: n.id,
        nodeId: n.id,
        triggerType: (n.config?.['triggerType'] ?? 'recordCreated') as any,
        eventType: n.config?.['eventType'],
        fieldName: n.config?.['fieldName'],
        dateOffsetDays: n.config?.['dateOffsetDays'],
        preferredTime: n.config?.['preferredTime'],
      }));

    const conditions = currentNodes
      .filter((n) => n.type === 'condition' || n.type === 'branch')
      .flatMap((n) => {
        const groups = n.config?.['conditionGroups'] ?? [];
        return groups.map((g: any, i: number) => ({
          id: `${n.id}_group_${i}`,
          nodeId: n.id,
          conditions: g.conditions ?? [],
        }));
      });

    const actions = currentNodes
      .filter((n) => n.type === 'action')
      .map((n, idx) => ({
        id: n.id,
        nodeId: n.id,
        actionType: (n.config?.['actionType'] ?? 'updateField') as any,
        continueOnError: n.config?.['continueOnError'] ?? false,
        order: idx,
        config: n.config ?? {},
      }));

    return {
      nodes: currentNodes,
      connections: this.connections(),
      triggers,
      conditions,
      actions,
    };
  }

  private generateNodeId(): string {
    this.nodeCounter++;
    return `node_${Date.now()}_${this.nodeCounter}`;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
