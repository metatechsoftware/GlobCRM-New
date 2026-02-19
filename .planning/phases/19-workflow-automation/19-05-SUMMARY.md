---
phase: 19-workflow-automation
plan: 05
subsystem: ui
tags: [angular, foblex-flow, workflow-builder, drag-and-drop, visual-canvas, node-editor, signal-store]

# Dependency graph
requires:
  - phase: 19-workflow-automation
    plan: 04
    provides: "TypeScript models, WorkflowService, WorkflowStore, lazy-loaded routes with placeholder builder component"
provides:
  - "@foblex/flow visual canvas with drag-and-drop nodes and directional connections"
  - "5 node components: trigger (blue), condition (amber), action (green), branch (purple), wait (gray)"
  - "WorkflowBuilderComponent with toolbar + canvas + sidebar 3-section layout"
  - "TriggerConfigComponent with record event, field-change, and date-based trigger configuration"
  - "ConditionConfigComponent with AND/OR condition group builder matching FilterPanel pattern"
  - "ActionConfigComponent with all 6 action types plus wait/branch configuration"
  - "TemplateGalleryComponent with category tabs and confirm-before-apply"
  - "WorkflowToolbarComponent with inline-editable name, entity selector, save/activate controls"
affects: [19-06]

# Tech tracking
tech-stack:
  added: ["@foblex/flow ^18.1.2", "@foblex/platform 1.0.4", "@foblex/mediator 1.1.3", "@foblex/2d 1.2.2", "@foblex/utils 1.1.1"]
  patterns:
    - "@foblex/flow canvas wrapper: FFlowModule import with fDraggable, fNode, fNodeInput, fNodeOutput, f-connection directives"
    - "Node component pattern: standalone with input(WorkflowNode), output(selected), type-specific connector configuration"
    - "AND/OR condition group builder: reusable component with signal-based array of groups, each containing array of condition rows"
    - "Config panel sidebar: slide-in panel switching between node config, template gallery, and add-node modes"

key-files:
  created:
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-canvas.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/nodes/trigger-node.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/nodes/condition-node.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/nodes/action-node.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/nodes/branch-node.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/nodes/wait-node.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.html
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.scss
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-toolbar.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/panels/trigger-config.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/panels/condition-config.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/panels/action-config.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/panels/template-gallery.component.ts
  modified:
    - globcrm-web/package.json
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts

key-decisions:
  - "@foblex/flow FFlowModule used as single module import providing all directives (fNode, fNodeInput, fNodeOutput, f-connection, fDraggable, f-canvas)"
  - "FSelectionChangeEvent.nodeIds used for selection tracking; FCreateConnectionEvent sourceId/targetId parsed to extract node IDs and branch output suffix"
  - "FMoveNodesEvent.nodes used for position change tracking; FCanvasComponent.fitToScreen/setScale for zoom controls"
  - "Branch node has dual output connectors (output_yes / output_no) with green/red visual indicators"
  - "ActionConfigComponent handles both action and wait node types via nodeType() computed; shared form state with type-specific sections"
  - "ConditionConfigComponent reused for both condition nodes and branch nodes with configurable headerTitle"
  - "Webhook payload template placeholder uses property binding to avoid Angular template interpolation of mustache syntax"

patterns-established:
  - "foblex/flow canvas composition: f-flow[fDraggable] > f-canvas > [fNode]+[f-connection]+f-connection-for-create"
  - "Node connector naming convention: nodeId_output (single), nodeId_output_yes/no (branch), nodeId_input"
  - "Config panel pattern: signal-based form state with effect() to initialize from node.config, updateField() + emitConfig() for changes"

requirements-completed: [WFLOW-01, WFLOW-02, WFLOW-03, WFLOW-04, WFLOW-05, WFLOW-06, WFLOW-07, WFLOW-08, WFLOW-09, WFLOW-10, WFLOW-13]

# Metrics
duration: 11min
completed: 2026-02-19
---

# Phase 19 Plan 05: Visual Workflow Builder Summary

**@foblex/flow visual canvas with 5 drag-and-drop node types, AND/OR condition builder, 6 action config panels, template gallery sidebar, and full workflow definition save/load as JSONB**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-19T14:58:38Z
- **Completed:** 2026-02-19T15:09:38Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Installed @foblex/flow v18.1.2 with all 4 peer dependencies for Angular-native visual flow canvas
- WorkflowCanvasComponent wrapping f-flow with drag-and-drop nodes, directional connections, zoom controls, and empty state prompt
- 5 node components (trigger/condition/action/branch/wait) with type-specific colors, icons, connectors, and config summary badges
- WorkflowBuilderComponent with 3-section layout: toolbar (48px top), canvas (center), sidebar (360px right)
- Full trigger configuration: record events, field-change with 11 operators including changed_from_to, date-based with offset + optional time
- AND/OR condition group builder reusable for both condition and branch nodes
- All 6 action types with type-specific configuration: updateField (static/dynamic mapping), sendNotification (4 recipient types), createActivity (dynamic assignment), sendEmail, fireWebhook, enrollInSequence
- Template gallery with category tabs (All/Sales/Engagement/Operational/Custom), system/custom badges, confirm-before-apply flow
- Save builds complete WorkflowDefinition from canvas state (nodes, connections, triggers, conditions, actions) as single JSONB document

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @foblex/flow and create canvas + node components** - `cb8bede` (feat)
2. **Task 2: Builder layout, config panels, template gallery, and toolbar** - `7c6a18c` (feat)

## Files Created/Modified
- `globcrm-web/package.json` - Added @foblex/flow + 4 peer dependencies
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-canvas.component.ts` - @foblex/flow canvas wrapper with drag-and-drop, zoom controls, empty state
- `globcrm-web/src/app/features/workflows/workflow-builder/nodes/trigger-node.component.ts` - Blue trigger node with output-only connector and trigger type badges
- `globcrm-web/src/app/features/workflows/workflow-builder/nodes/condition-node.component.ts` - Amber condition node with condition summary display
- `globcrm-web/src/app/features/workflows/workflow-builder/nodes/action-node.component.ts` - Green action node with type-specific icons and badges
- `globcrm-web/src/app/features/workflows/workflow-builder/nodes/branch-node.component.ts` - Purple branch node with dual Yes/No output connectors
- `globcrm-web/src/app/features/workflows/workflow-builder/nodes/wait-node.component.ts` - Gray wait node with duration summary
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts` - Main builder page replacing placeholder
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.html` - Toolbar + canvas + sidebar template
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.scss` - Full-height 3-section layout
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-toolbar.component.ts` - Inline-editable name, entity selector, save/activate/template
- `globcrm-web/src/app/features/workflows/workflow-builder/panels/trigger-config.component.ts` - Record event, field-change, date-based trigger configuration
- `globcrm-web/src/app/features/workflows/workflow-builder/panels/condition-config.component.ts` - AND/OR condition group builder
- `globcrm-web/src/app/features/workflows/workflow-builder/panels/action-config.component.ts` - All 6 action types + wait + branch config
- `globcrm-web/src/app/features/workflows/workflow-builder/panels/template-gallery.component.ts` - Category-filtered template gallery with apply confirmation

## Decisions Made
- **@foblex/flow FFlowModule single import:** Used the module import pattern (not individual directive imports) since FFlowModule bundles all directives. This simplifies imports across all node components.
- **FCreateConnectionEvent parsing:** Connection IDs follow the pattern `nodeId_output[_suffix]` and `nodeId_input`, parsed via regex to extract node IDs and branch output names (yes/no).
- **Branch node dual connectors:** Two separate fNodeOutput directives with `_output_yes` and `_output_no` suffixes. Green/red visual indicators for the Yes/No paths.
- **ActionConfigComponent multi-type:** Single component handles action, wait, and branch config via `nodeType()` computed. This reduces file count while keeping each section's UI focused.
- **ConditionConfigComponent reuse:** Same component for both condition nodes and branch nodes, with configurable `headerTitle` input to distinguish the context.
- **Webhook payload placeholder:** Used `[placeholder]` property binding instead of inline `placeholder=` attribute to avoid Angular interpreting `{{triggerType}}` mustache syntax as template interpolation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Escaped mustache syntax in webhook payload placeholder**
- **Found during:** Task 2 (build verification)
- **Issue:** Angular template compiler interpreted `{{triggerType}}` and `{{entityId}}` in the textarea placeholder attribute as component template interpolation, causing NG9 errors
- **Fix:** Changed from inline `placeholder='...'` to property binding `[placeholder]="webhookPayloadPlaceholder"` with a class property containing the mustache template string
- **Files modified:** panels/action-config.component.ts
- **Verification:** Build passes with 0 errors
- **Committed in:** 7c6a18c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor template escaping fix. No scope creep.

## Issues Encountered
None beyond the placeholder escaping deviation described above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Visual workflow builder fully functional with canvas, all node types, config panels, and template gallery
- WorkflowStore save/load integration ready for end-to-end testing
- Routes already configured: /workflows/new (create), /workflows/:id/edit (edit existing)
- Plan 19-06 can build workflow detail page and execution log views using the same definition model

## Self-Check: PASSED

All 14 created files verified present. Both task commits (cb8bede, 7c6a18c) verified in git log.

---
*Phase: 19-workflow-automation*
*Completed: 2026-02-19*
