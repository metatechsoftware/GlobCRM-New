/**
 * Workflow automation models matching backend DTOs from WorkflowsController
 * and WorkflowTemplatesController. Used by WorkflowService, WorkflowStore,
 * and all workflow components.
 */

// ---- Core Entity ----

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  status: WorkflowStatus;
  isActive: boolean;
  triggerSummary: string[];
  executionCount: number;
  lastExecutedAt?: string;
  definition: WorkflowDefinition;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

// Lightweight for list page
export interface WorkflowListItem {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  status: WorkflowStatus;
  isActive: boolean;
  triggerSummary: string[];
  executionCount: number;
  lastExecutedAt?: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowStatus = 'draft' | 'active' | 'paused';

// ---- Visual Flow Definition ----

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  triggers: WorkflowTriggerConfig[];
  conditions: WorkflowConditionGroup[];
  actions: WorkflowActionConfig[];
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'branch' | 'wait';
  label: string;
  position: { x: number; y: number };
  config?: Record<string, any>;
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceOutput?: string; // "yes" | "no" for branch nodes
}

export interface WorkflowTriggerConfig {
  id: string;
  nodeId: string;
  triggerType: WorkflowTriggerType;
  eventType?: string;
  fieldName?: string;
  dateOffsetDays?: number;
  preferredTime?: string;
}

export type WorkflowTriggerType =
  | 'recordCreated'
  | 'recordUpdated'
  | 'recordDeleted'
  | 'fieldChanged'
  | 'dateBased';

export interface WorkflowConditionGroup {
  id: string;
  nodeId: string;
  conditions: WorkflowCondition[];
}

export interface WorkflowCondition {
  field: string;
  operator: string;
  value?: string;
  fromValue?: string;
}

export interface WorkflowActionConfig {
  id: string;
  nodeId: string;
  actionType: WorkflowActionType;
  continueOnError: boolean;
  order: number;
  config: Record<string, any>;
}

export type WorkflowActionType =
  | 'updateField'
  | 'sendNotification'
  | 'createActivity'
  | 'sendEmail'
  | 'fireWebhook'
  | 'enrollInSequence'
  | 'branch'
  | 'wait';

// ---- Execution Logs ----

export interface WorkflowExecutionLog {
  id: string;
  workflowId: string;
  workflowName?: string;
  triggerType: string;
  triggerEvent: string;
  entityId: string;
  entityType: string;
  conditionsEvaluated: boolean;
  conditionsPassed: boolean;
  status: WorkflowExecutionStatus;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  actionLogs?: WorkflowActionLog[];
}

export type WorkflowExecutionStatus =
  | 'succeeded'
  | 'partiallyFailed'
  | 'failed'
  | 'skipped';

export interface WorkflowActionLog {
  id: string;
  actionType: string;
  actionNodeId: string;
  order: number;
  status: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs: number;
}

// ---- Templates ----

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  entityType: string;
  isSystem: boolean;
  definition: WorkflowDefinition;
  createdByUserId?: string;
  createdAt: string;
}

export interface WorkflowTemplateListItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  entityType: string;
  isSystem: boolean;
  nodeCount: number;
}

// ---- Request Types ----

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  entityType: string;
  definition: WorkflowDefinition;
}

export interface UpdateWorkflowRequest {
  name: string;
  description?: string;
  entityType: string;
  definition: WorkflowDefinition;
}

// ---- Paginated Response ----

export interface WorkflowPaginatedResponse {
  items: WorkflowListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ---- Entity Field for Builder Config Panels ----

export interface EntityField {
  name: string;
  label: string;
  fieldType: string;
}
