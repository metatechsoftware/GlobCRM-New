---
status: diagnosed
phase: 19-workflow-automation
source: 19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md, 19-04-SUMMARY.md, 19-05-SUMMARY.md, 19-06-SUMMARY.md
started: 2026-02-19T15:30:00Z
updated: 2026-02-19T16:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Navigate to Workflows
expected: Sidebar navigation shows a "Workflows" link with an account_tree icon in the Connect group (after Sequences). Clicking it navigates to /workflows and shows the workflow list page.
result: issue
reported: "pressing workflows navigated to the dashboard"
severity: blocker

### 2. View Workflow List with Card Grid
expected: Workflow list page displays seeded demo workflows in a responsive card grid layout. Each card shows the workflow name, entity type chip, status badge (Active/Draft/Paused), an SVG flow diagram thumbnail with colored nodes (blue triggers, amber conditions, green actions connected by curves), and an enable/disable slide toggle.
result: pass

### 3. Filter Workflows
expected: Above the card grid, entity type and status filter dropdowns are visible. Selecting a filter (e.g., entity type = "Contact") updates the displayed cards to show only matching workflows.
result: pass

### 4. Toggle Workflow Active/Inactive
expected: Clicking the slide toggle on a workflow card immediately flips the toggle state (optimistic update). The status badge updates accordingly (Active <-> Paused). If an error occurs, it reverts.
result: pass

### 5. Open Visual Workflow Builder
expected: Clicking "New Workflow" (or editing an existing workflow) navigates to /workflows/new (or /workflows/:id/edit). The builder page shows a 3-section layout: toolbar at top (with name field and entity type selector), visual canvas in the center, and a sidebar panel on the right.
result: issue
reported: "New workflow directs correctly and add new node correctly changes the configure part but I cant add the node to the graph."
severity: major

### 6. Add Nodes to Canvas
expected: Using the add-node controls, you can add trigger (blue), condition (amber), action (green), branch (purple), and wait (gray) nodes to the canvas. Each node appears as a colored card with an icon and can be dragged to reposition.
result: skipped
reason: Blocked by Test 5 — nodes can't be added to canvas

### 7. Configure Trigger Node
expected: Clicking a trigger node opens the trigger config panel in the sidebar. It shows options for record event triggers (created/updated/deleted), field-change triggers (with field selector and operator like "equals", "changed to"), and date-based triggers (with date field, offset days, and optional time).
result: skipped
reason: Blocked by Test 5 — nodes can't be added to canvas

### 8. Configure Action Node
expected: Clicking an action node opens the action config panel. A dropdown shows all 6 action types: Update Field, Send Notification, Create Activity, Send Email, Fire Webhook, Enroll in Sequence. Selecting one reveals type-specific configuration fields.
result: skipped
reason: Blocked by Test 5 — nodes can't be added to canvas

### 9. Connect Nodes with Directional Lines
expected: Dragging from a node's output connector (right side circle) to another node's input connector (left side circle) creates a directional connection line between them. Branch nodes show two output connectors labeled Yes (green) and No (red).
result: skipped
reason: Blocked by Test 5 — nodes can't be added to canvas

### 10. Apply Template from Gallery
expected: In the builder sidebar, a "Templates" tab/button opens the template gallery showing system templates organized by category tabs (All, Sales, Engagement, Operational). Clicking a template and confirming replaces the current canvas with the template's workflow definition.
result: skipped
reason: Blocked by Test 5 — nodes can't be added to canvas

### 11. Save Workflow
expected: After configuring a workflow (name, entity type, at least one trigger and action node connected), clicking Save persists the workflow. Navigating back to the list shows the new workflow as a card with its SVG thumbnail.
result: skipped
reason: Blocked by Test 5 — nodes can't be added to canvas

### 12. View Workflow Detail Page
expected: Clicking a workflow card navigates to /workflows/:id. The detail page shows the workflow name, status badge, entity type, 4 stats cards (total executions, last run, success rate, failed count), trigger summary chips, a flow overview section, and an embedded recent execution log preview.
result: pass

### 13. Duplicate and Save as Template
expected: From the workflow detail page, a "Duplicate" action creates a copy of the workflow (new name like "Copy of ..."). A "Save as Template" action opens a dialog with name, description, and category fields. Submitting saves it as a tenant-scoped custom template.
result: issue
reported: "Duplicate works and saving a template said it was successful but the template doesnt show up in the template gallery"
severity: major

### 14. View Execution Logs
expected: From the workflow detail page, clicking "View All Logs" (or navigating to /workflows/:id/logs) shows a paginated table of execution logs. Each row displays status icon, trigger info, conditions result, execution duration, and relative timestamp.
result: pass

### 15. View Execution Log Detail
expected: Clicking an execution log row navigates to the log detail page showing: trigger section (event type, entity), conditions evaluation result, and a vertical action timeline with per-action status dots (green=success, red=failed, gray=skipped), error messages for failed actions, and duration per action.
result: skipped
reason: No execution logs exist yet to test against

## Summary

total: 15
passed: 5
issues: 3
pending: 0
skipped: 7

## Gaps

- truth: "Clicking Workflows navigates to /workflows and shows the workflow list page"
  status: failed
  reason: "User reported: pressing workflows navigated to the dashboard"
  severity: blocker
  test: 1
  root_cause: "One-time issue: PermissionStore loaded once per session in handleLoginSuccess. Existing session lacked Workflow:View because it started before the EntityType.Workflow enum was added and seeded. After re-login, permissions loaded correctly. No code fix needed for this specific case."
  artifacts:
    - path: "globcrm-web/src/app/core/permissions/permission.store.ts"
      issue: "Permissions loaded once per session, never refreshed"
    - path: "globcrm-web/src/app/core/auth/auth.interceptor.ts"
      issue: "401-retry path updates JWT but does not reload PermissionStore"
  missing:
    - "Consider reloading permissions after 401-retry token refresh for future-proofing"
  debug_session: ""

- truth: "Nodes can be added to the visual workflow canvas via add-node controls"
  status: failed
  reason: "User reported: New workflow directs correctly and add new node correctly changes the configure part but I cant add the node to the graph."
  severity: major
  test: 5
  root_cause: "@foblex/flow f-canvas uses ng-content select='[fNode]' for content projection, which only matches direct children. The 5 node wrapper components (app-trigger-node, etc.) place fNode on an inner div inside their template, not on their host element. Angular content projection cannot match attributes inside child component templates, so nodes are silently dropped from the DOM."
  artifacts:
    - path: "globcrm-web/src/app/features/workflows/workflow-builder/workflow-canvas.component.ts"
      issue: "@for loop renders <app-*-node> components as direct children of f-canvas, but these don't have [fNode] attribute"
    - path: "globcrm-web/src/app/features/workflows/workflow-builder/nodes/trigger-node.component.ts"
      issue: "fNode directive on inner div (line 11), not on host element"
    - path: "globcrm-web/src/app/features/workflows/workflow-builder/nodes/condition-node.component.ts"
      issue: "fNode directive on inner div, not on host element"
    - path: "globcrm-web/src/app/features/workflows/workflow-builder/nodes/action-node.component.ts"
      issue: "fNode directive on inner div, not on host element"
    - path: "globcrm-web/src/app/features/workflows/workflow-builder/nodes/branch-node.component.ts"
      issue: "fNode directive on inner div, not on host element"
    - path: "globcrm-web/src/app/features/workflows/workflow-builder/nodes/wait-node.component.ts"
      issue: "fNode directive on inner div, not on host element"
  missing:
    - "Inline node templates directly into workflow-canvas.component.ts template so <div fNode> is a direct child of f-canvas"
    - "Move node component logic (computed badges/icons) to helper methods or inline expressions"
  debug_session: ".planning/debug/workflow-canvas-nodes-not-rendering.md"

- truth: "Saved template appears in the template gallery"
  status: failed
  reason: "User reported: Duplicate works and saving a template said it was successful but the template doesnt show up in the template gallery"
  severity: major
  test: 13
  root_cause: "Template gallery always sends entityType filter to API (line 295 of template-gallery.component.ts). Templates saved from a workflow with entity type 'Deal' won't appear when gallery is opened from a 'Contact' workflow. The 'All' tab means 'all categories within current entity type', not 'all templates'. Secondary: entityType defaults to 'Contact' before async workflow load completes, causing wrong filter on edit pages."
  artifacts:
    - path: "globcrm-web/src/app/features/workflows/workflow-builder/panels/template-gallery.component.ts"
      issue: "Line 295: this.service.getTemplates(undefined, this.entityType() || undefined) always sends entityType filter"
    - path: "globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts"
      issue: "Line 64: entityType defaults to 'Contact', async loadWorkflow sets actual type later"
    - path: "src/GlobCRM.Api/Controllers/WorkflowTemplatesController.cs"
      issue: "Lines 49-50: server-side entityType filter excludes templates from other entity types"
  missing:
    - "Load all templates without entityType filter, then filter locally in UI"
    - "Add effect() to reload templates when entityType changes"
  debug_session: ".planning/debug/template-gallery-missing.md"
