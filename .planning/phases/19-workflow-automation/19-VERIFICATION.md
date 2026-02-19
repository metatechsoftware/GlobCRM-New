---
phase: 19-workflow-automation
verified: 2026-02-19T20:00:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Nodes appear and are draggable on the visual workflow canvas"
    expected: "After clicking Add Node and selecting a type, a colored node card appears on the canvas and can be dragged to reposition. Trigger=blue, Condition=amber, Action=green, Branch=purple, Wait=gray."
    why_human: "@foblex/flow canvas interaction and DOM content projection cannot be verified programmatically. The inlined-template fix (plan 19-07) addresses the root cause, but actual rendering requires a browser."
  - test: "Nodes can be connected by dragging output to input connector"
    expected: "Dragging from a node's bottom connector to another node's top connector creates a bezier connection line. Branch nodes show two output connectors labeled Yes and No."
    why_human: "Drag-and-drop canvas interaction requires browser testing."
  - test: "Custom template saved from Detail page appears in gallery"
    expected: "After clicking Save as Template on a workflow detail page, opening the template gallery in the builder shows the newly saved template under the Custom category and under All."
    why_human: "The template gallery now loads all templates without an entityType filter (plan 19-07 fix). Requires running app to verify the fix works end-to-end."
  - test: "Workflow navigation works without re-login for users with fresh sessions"
    expected: "After the auth interceptor now reloads permissions after a 401-retry token refresh (plan 19-08), users who are already logged in can navigate to /workflows without being redirected to dashboard, even if their session predates the Workflow entity type being added."
    why_human: "Permission reload on token refresh requires a live session with an expired access token to observe the 401-retry path."
  - test: "Workflow execution end-to-end"
    expected: "Creating a workflow with a RecordCreated trigger on Contact, activating it, then creating a Contact causes the workflow to fire. An execution log appears with Succeeded status and correct action logs."
    why_human: "Requires running backend with database and Hangfire queue processing."
---

# Phase 19: Workflow Automation Verification Report

**Phase Goal:** Users can automate CRM operations by creating trigger-based workflows that execute actions (field updates, notifications, tasks, emails, webhooks, sequence enrollment) when entity events or conditions are met
**Verified:** 2026-02-19T20:00:00Z
**Status:** HUMAN_NEEDED (automated checks passed; UAT gaps were diagnosed and closed by plans 19-07 and 19-08; browser verification needed to confirm fixes work)
**Re-verification:** No — initial authoritative verification (the previous VERIFICATION.md was written before UAT completion and claimed "passed" incorrectly)

## Note on Previous VERIFICATION.md

A VERIFICATION.md existed at `.planning/phases/19-workflow-automation/VERIFICATION.md` (no numeric prefix, round timestamp `16:00:00Z`) claiming status "passed" with score 13/13. This was written **before** UAT was conducted and was therefore premature. The UAT (`19-UAT.md`) subsequently found 3 major gaps. Two gap-closure plans (19-07, 19-08) were executed to address them. This report reflects the post-gap-closure state of the codebase.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Workflow entity stores event triggers, field-change triggers, and date-based triggers as JSONB definition | VERIFIED | `Workflow.cs` (303 lines): `WorkflowDefinition` with `Triggers` (List<WorkflowTriggerConfig>), `Conditions`, `Actions`, `Nodes`, `Connections`. EF Core `OwnsOne(...).ToJson("definition")` for JSONB storage. |
| 2 | Domain events from entity saves trigger matching workflows via WorkflowDomainEventHandler | VERIFIED | `WorkflowDomainEventHandler.cs` (230 lines): implements `IDomainEventHandler`, `MatchesTrigger()` handles RecordCreated/Updated/Deleted/FieldChanged/DateBased. Registered via `AddWorkflowServices()`. |
| 3 | Field-change triggers detect specific field value transitions | VERIFIED | Handler checks `FieldChanged` trigger + `ChangedProperties.ContainsKey(trigger.FieldName)`. `WorkflowConditionEvaluator.cs` (242 lines): `changed_to` and `changed_from_to` operators with old/new value comparison. |
| 4 | Date-based triggers fire via hourly Hangfire scan | VERIFIED | `DateTriggerScanService.cs` (201 lines): registered as `RecurringJob.AddOrUpdate` in `Program.cs` (line 150-151). Scans active workflows with DateBased trigger, matches entities by date field + offset days, prevents duplicate execution via log check. |
| 5 | Condition evaluator supports AND/OR groups with 11 field comparison operators | VERIFIED | `WorkflowConditionEvaluator.cs`: OR across groups, AND within groups. Operators: equals, not_equals, gt, gte, lt, lte, contains, changed_to, changed_from_to, is_null, is_not_null. |
| 6 | All 6 core action types execute using existing infrastructure | VERIFIED | 6 action files in `src/GlobCRM.Infrastructure/Workflows/Actions/`: UpdateFieldAction (153L), SendNotificationAction (164L), CreateActivityAction (177L), SendEmailAction (105L), FireWebhookAction (123L), EnrollInSequenceAction (119L). All dispatched via `WorkflowActionExecutor.cs` (95L). |
| 7 | Multiple actions chain in a single workflow (multi-action, WFLOW-10) | VERIFIED | `WorkflowExecutionService.cs` line 277: `definition.Actions.OrderBy(a => a.Order)` executes actions sequentially with per-action `ContinueOnError` flag. |
| 8 | Execution logs capture full audit trail of trigger, conditions, and per-action results | VERIFIED | `WorkflowExecutionLog` + `WorkflowActionLog` entities. API: `GET /{id}/logs` (paginated) and `GET /{id}/logs/{logId}` (with ActionLogs). Frontend: `ExecutionLogListComponent` (327L) and `ExecutionLogDetailComponent` (758L). |
| 9 | Enable/disable workflows without deletion | VERIFIED | Controller `PATCH /{id}/status` toggles `IsActive` + `Status` (Active/Paused). Frontend `WorkflowStore.toggleStatus()` (line 155) with optimistic update + revert on error. `mat-slide-toggle` in list component. |
| 10 | Visual workflow builder renders nodes on canvas with @foblex/flow | VERIFIED (code); HUMAN NEEDED (rendering) | `WorkflowCanvasComponent` (709L): plan 19-07 inlined all 5 node types as `<div fNode ...>` direct children of `<f-canvas>`, fixing the content projection issue. Rendering requires browser confirmation. |
| 11 | Template gallery shows all templates without over-filtering by entity type | VERIFIED (code); HUMAN NEEDED (end-to-end) | `template-gallery.component.ts` line 295: `this.service.getTemplates()` with no arguments. `filterTemplates()` (lines 307-330) handles client-side category filtering. Server-side `entityType` filter removed from gallery call. |
| 12 | Permission reload after 401-retry prevents Workflow:View stale permission | VERIFIED | `auth.interceptor.ts` line 81: `permissionStore.loadPermissions()` called after successful token refresh in the 401-retry path. Injected at line 48. |
| 13 | Prebuilt workflow templates available in gallery with category tabs | VERIFIED | `WorkflowTemplatesController.cs` (350L): 5 endpoints. `TenantSeeder.SeedWorkflowsAsync()` seeds 3 system templates (IsSystem=true). `TemplateGalleryComponent`: category tabs All/Sales/Engagement/Operational/Custom, system/custom badges. |

**Score:** 13/13 truths verified (10 fully automated, 3 require browser confirmation)

---

### Required Artifacts

| Artifact | Status | Lines | Evidence |
|----------|--------|-------|----------|
| `src/GlobCRM.Domain/Entities/Workflow.cs` | VERIFIED | 303 | WorkflowDefinition, TriggerSummary, IsActive, EntityType |
| `src/GlobCRM.Domain/Entities/WorkflowExecutionLog.cs` | VERIFIED | exists | TriggerType, ConditionsEvaluated, Status, DurationMs |
| `src/GlobCRM.Domain/Entities/WorkflowActionLog.cs` | VERIFIED | exists | ActionType, Status, ErrorMessage, DurationMs |
| `src/GlobCRM.Domain/Entities/WorkflowTemplate.cs` | VERIFIED | exists | IsSystem, Category, Definition (JSONB copy) |
| `src/GlobCRM.Domain/Enums/WorkflowStatus.cs` | VERIFIED | exists | Draft, Active, Paused |
| `src/GlobCRM.Domain/Enums/WorkflowTriggerType.cs` | VERIFIED | exists | RecordCreated, RecordUpdated, RecordDeleted, FieldChanged, DateBased |
| `src/GlobCRM.Domain/Enums/WorkflowActionType.cs` | VERIFIED | exists | UpdateField, SendNotification, CreateActivity, SendEmail, FireWebhook, EnrollInSequence, Branch, Wait |
| `src/GlobCRM.Domain/Enums/WorkflowExecutionStatus.cs` | VERIFIED | exists | Succeeded, PartiallyFailed, Failed, Skipped |
| `src/GlobCRM.Domain/Interfaces/IWorkflowRepository.cs` | VERIFIED | exists | CRUD, logs, templates, active workflow queries |
| `src/GlobCRM.Infrastructure/Workflows/WorkflowRepository.cs` | VERIFIED | exists | GetActiveWorkflowsAsync, GetExecutionLogsAsync, template methods |
| `src/GlobCRM.Infrastructure/Workflows/WorkflowDomainEventHandler.cs` | VERIFIED | 230 | IDomainEventHandler, MatchesTrigger, Hangfire enqueue |
| `src/GlobCRM.Infrastructure/Workflows/WorkflowExecutionService.cs` | VERIFIED | 748 | ExecuteAsync, graph traversal, branch/wait, entity loading |
| `src/GlobCRM.Infrastructure/Workflows/WorkflowConditionEvaluator.cs` | VERIFIED | 242 | Evaluate, OR/AND groups, 11 operators |
| `src/GlobCRM.Infrastructure/Workflows/WorkflowActionExecutor.cs` | VERIFIED | 95 | Switch dispatch to 6 action implementations |
| `src/GlobCRM.Infrastructure/Workflows/WorkflowLoopGuard.cs` | VERIFIED | 89 | MaxDepth=5, AsyncLocal processed pairs |
| `src/GlobCRM.Infrastructure/Workflows/DateTriggerScanService.cs` | VERIFIED | 201 | Hourly Hangfire job, date field scan, duplicate prevention |
| `src/GlobCRM.Infrastructure/Workflows/Actions/UpdateFieldAction.cs` | VERIFIED | 153 | Reflection for standard fields, JSONB for custom fields |
| `src/GlobCRM.Infrastructure/Workflows/Actions/SendNotificationAction.cs` | VERIFIED | 164 | NotificationDispatcher, 4 recipient types, merge fields |
| `src/GlobCRM.Infrastructure/Workflows/Actions/CreateActivityAction.cs` | VERIFIED | 177 | Activity entity, ActivityLink, dynamic assignee |
| `src/GlobCRM.Infrastructure/Workflows/Actions/SendEmailAction.cs` | VERIFIED | 105 | Template rendering, IEmailService.SendRawEmailAsync |
| `src/GlobCRM.Infrastructure/Workflows/Actions/FireWebhookAction.cs` | VERIFIED | 123 | SSRF validation, custom headers, WebhookDelivery HttpClient |
| `src/GlobCRM.Infrastructure/Workflows/Actions/EnrollInSequenceAction.cs` | VERIFIED | 119 | Duplicate check, Hangfire scheduling |
| `src/GlobCRM.Infrastructure/Workflows/WorkflowServiceExtensions.cs` | VERIFIED | exists | Registers all 12 workflow services including IDomainEventHandler |
| `src/GlobCRM.Api/Controllers/WorkflowsController.cs` | VERIFIED | 1034 | CRUD, toggle status, duplicate, entity fields, logs endpoints |
| `src/GlobCRM.Api/Controllers/WorkflowTemplatesController.cs` | VERIFIED | 350 | List, get, save-as-template, apply, delete |
| `globcrm-web/src/app/features/workflows/workflow.models.ts` | VERIFIED | 211 | Full TypeScript interfaces for all workflow entities |
| `globcrm-web/src/app/features/workflows/workflow.service.ts` | VERIFIED | 174 | 17 API methods |
| `globcrm-web/src/app/features/workflows/workflow.store.ts` | VERIFIED | 265 | toggleStatus with optimistic update, CRUD, logs, templates |
| `globcrm-web/src/app/features/workflows/workflows.routes.ts` | VERIFIED | 47 | 6 lazy-loaded routes: list, new, :id, :id/edit, :id/logs, :id/logs/:logId |
| `globcrm-web/src/app/features/workflows/workflow-list/workflow-list.component.ts` | VERIFIED | 163 | Card grid list with filters, toggleStatus call |
| `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts` | VERIFIED | 391 | Node management, connection management, save, load existing |
| `globcrm-web/src/app/features/workflows/workflow-builder/workflow-canvas.component.ts` | VERIFIED | 709 | Inlined node templates with fNode as direct div children of f-canvas (plan 19-07 fix) |
| `globcrm-web/src/app/features/workflows/workflow-builder/panels/template-gallery.component.ts` | VERIFIED | 333 | loadTemplates() calls getTemplates() without entityType; client-side category filter (plan 19-07 fix) |
| `globcrm-web/src/app/features/workflows/workflow-detail/workflow-detail.component.ts` | VERIFIED | 194 | Stats cards, embedded log list, duplicate/save-as-template actions |
| `globcrm-web/src/app/features/workflows/workflow-detail/save-as-template-dialog.component.ts` | VERIFIED | 119 | Dialog with name/description/category fields |
| `globcrm-web/src/app/features/workflows/workflow-logs/execution-log-list.component.ts` | VERIFIED | 327 | Paginated table, status icons, standalone + embedded modes |
| `globcrm-web/src/app/features/workflows/workflow-logs/execution-log-detail.component.ts` | VERIFIED | 758 | Per-action timeline, trigger section, conditions card |
| `globcrm-web/src/app/core/auth/auth.interceptor.ts` | VERIFIED | exists | permissionStore.loadPermissions() at line 81 after 401-retry success (plan 19-08 fix) |
| `scripts/rls-setup.sql` | VERIFIED | exists | RLS policies on workflows, workflow_execution_logs, workflow_templates |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| WorkflowDomainEventHandler | WorkflowExecutionService | Hangfire enqueue | WIRED | `_jobClient.Enqueue<WorkflowExecutionService>(...)` |
| WorkflowExecutionService | WorkflowConditionEvaluator | Constructor injection | WIRED | Called during execution to evaluate condition groups |
| WorkflowExecutionService | WorkflowActionExecutor | Constructor injection | WIRED | `definition.Actions.OrderBy(a => a.Order)` dispatches each action |
| WorkflowActionExecutor | 6 action implementations | Constructor injection + switch | WIRED | All 6 injected and dispatched to by action type |
| WorkflowsController | IWorkflowRepository | Constructor injection | WIRED | All CRUD/log/toggle endpoints use `_workflowRepository` |
| DateTriggerScanService | Program.cs | RecurringJob registration | WIRED | `RecurringJob.AddOrUpdate<DateTriggerScanService>` lines 150-151 |
| DI container | All workflow services | AddWorkflowServices() | WIRED | WorkflowServiceExtensions.cs registers 12 services including IDomainEventHandler |
| ApplicationDbContext | 4 workflow DbSets | DbSet<T> + configurations | WIRED | Lines 143-147 (DbSets), lines 252-256 (ApplyConfiguration x4) |
| app.routes.ts | /workflows | loadChildren + permissionGuard('Workflow','View') | WIRED | Line 172-175 |
| WorkflowService | WorkflowsController | HTTP endpoints | WIRED | 17 service methods map to /api/workflows and /api/workflow-templates |
| WorkflowStore | WorkflowService | inject(WorkflowService) | WIRED | All store methods call service observables |
| Navbar | /workflows route | navGroups 'Connect' group | WIRED | `{ route: '/workflows', icon: 'account_tree', label: 'Workflows' }` at line 96 |
| workflow-canvas.component.ts | f-canvas (fNode content projection) | div[fNode] as direct children | WIRED (code) | Plan 19-07: all 5 node types inlined as `<div fNode ...>` inside `<f-canvas>` |
| template-gallery.component.ts | WorkflowService.getTemplates() | No entityType arg | WIRED | Line 295: `this.service.getTemplates()` — all templates loaded, client-side category filter |
| auth.interceptor.ts | PermissionStore.loadPermissions() | inject after 401-retry | WIRED | Line 81: `permissionStore.loadPermissions()` in the token refresh success path |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WFLOW-01 | 19-01, 19-02, 19-08 | User can create a workflow with event triggers (record created/updated/deleted) | SATISFIED | WorkflowDomainEventHandler handles RecordCreated/Updated/Deleted. Builder supports trigger node config. Auth interceptor reloads permissions so Workflow:View permission is accessible after session. |
| WFLOW-02 | 19-01, 19-02, 19-07 | User can add field-change triggers with conditions (equals, greater than, changed to, etc.) | SATISFIED | FieldChanged trigger type + WorkflowConditionEvaluator with 11 operators including changed_to/changed_from_to. Trigger config panel in builder UI. |
| WFLOW-03 | 19-02 | User can add date-based triggers (X days before/after a date field) | SATISFIED | DateTriggerScanService hourly Hangfire job with DateOffsetDays and PreferredTime support. |
| WFLOW-04 | 19-02, 19-07 | User can add "update field" action to set field values automatically | SATISFIED | UpdateFieldAction supports standard (reflection) and custom (JSONB) fields, static and dynamic values. Action config panel in builder. |
| WFLOW-05 | 19-02, 19-07 | User can add "send notification" action to alert users/teams | SATISFIED | SendNotificationAction with 4 recipient types (record_owner, deal_owner, specific_user, team). |
| WFLOW-06 | 19-02, 19-07 | User can add "create activity/task" action with template-based configuration | SATISFIED | CreateActivityAction creates Activity entity + ActivityLink, configurable type/priority/due date offset/assignee. |
| WFLOW-07 | 19-02 | User can add "send email" action using an email template with merge fields | SATISFIED | SendEmailAction loads template, renders via TemplateRenderService + MergeFieldService, sends via IEmailService. |
| WFLOW-08 | 19-02 | User can add "fire webhook" action to trigger external integrations | SATISFIED | FireWebhookAction with SSRF validation, custom payload templates, custom headers, WebhookDelivery named HttpClient. |
| WFLOW-09 | 19-02 | User can add "enroll in sequence" action to start email sequences | SATISFIED | EnrollInSequenceAction with duplicate check and Hangfire scheduling. |
| WFLOW-10 | 19-02 | User can chain multiple actions in a single workflow (multi-action) | SATISFIED | WorkflowExecutionService executes `definition.Actions.OrderBy(a => a.Order)` sequentially with per-action ContinueOnError flag. |
| WFLOW-11 | 19-01, 19-03, 19-06 | User can view workflow execution logs showing trigger, conditions, and action results | SATISFIED | WorkflowExecutionLog + WorkflowActionLog entities. API: GET /{id}/logs and GET /{id}/logs/{logId}. ExecutionLogListComponent + ExecutionLogDetailComponent (758L with per-action timeline). |
| WFLOW-12 | 19-01, 19-03, 19-04, 19-06 | User can enable/disable workflows without deleting them | SATISFIED | PATCH /{id}/status endpoint, IsActive flag, optimistic toggle in store with revert-on-error, mat-slide-toggle in list. |
| WFLOW-13 | 19-01, 19-03, 19-05, 19-07 | Admin can select from pre-built workflow templates as starting points | SATISFIED | 3 system templates seeded (5 per later plan), WorkflowTemplatesController 5 endpoints, TemplateGalleryComponent. Plan 19-07 fixed gallery to show all templates regardless of entity type filter. |

All 13 WFLOW requirements are satisfied. No orphaned requirements were found.

---

### Anti-Patterns Found

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| (none) | — | — | No TODO/FIXME/HACK/PLACEHOLDER comments in workflow code. No stub implementations. No empty handlers. |

HTML `placeholder` attributes in input fields (trigger-config, action-config, toolbar, save-as-template-dialog) are standard UX affordances, not implementation stubs.

---

### Human Verification Required

#### 1. Visual Canvas Node Rendering (UAT Gap from 19-UAT.md, gap closure in 19-07)

**Test:** Navigate to /workflows/new. Click the Add Node button (or toolbar menu) and select "Trigger". Repeat for Condition, Action, Branch, Wait.
**Expected:** Each node appears on the canvas as a colored card with the correct left-border color (trigger=blue `#3B82F6`, condition=amber `#F59E0B`, action=green `#10B981`, branch=purple `#8B5CF6`, wait=gray `#6B7280`). Nodes can be dragged to reposition.
**Why human:** The root cause was @foblex/flow's `ng-content select='[fNode]'` only matching direct children. Plan 19-07 inlined all 5 node types as `<div fNode>` directly inside `<f-canvas>` in `workflow-canvas.component.ts`. The code fix is verified, but actual DOM rendering and drag behavior require a browser.

#### 2. Node Connection Drawing

**Test:** With nodes on the canvas, drag from a node's output connector (bottom circle) to another node's input connector (top circle).
**Expected:** A bezier connection line appears between the nodes. Branch nodes show two output connectors labeled "Yes" (green) and "No" (red).
**Why human:** Drag-and-drop interaction and SVG connection rendering require browser testing.

#### 3. Template Gallery Completeness After Save (UAT Gap from 19-UAT.md, gap closure in 19-07)

**Test:** Open a Deal workflow. Click Save as Template on the detail page. Enter a name, description, select "Custom" category, submit. Open the builder for a Contact workflow. Open the template gallery. Switch to the "All" tab and the "Custom" tab.
**Expected:** The template saved from the Deal workflow appears in both the All tab and the Custom tab, regardless of the current workflow's entity type.
**Why human:** The fix (loading all templates without entityType filter + sorting by relevance) is code-verified, but the end-to-end save-then-appear flow requires running app confirmation.

#### 4. Permission Reload After Token Refresh (UAT Gap from 19-UAT.md, gap closure in 19-08)

**Test:** Log in, let the access token expire (or use browser dev tools to clear the access_token while keeping the refresh_token). Navigate to /workflows.
**Expected:** The app silently refreshes the token via the interceptor's 401-retry path, reloads permissions (including Workflow:View), and successfully shows the workflow list — no redirect to dashboard.
**Why human:** Requires a live session with an expired token to exercise the 401-retry code path.

#### 5. Workflow Execution End-to-End

**Test:** Create a workflow with entity type "Contact", trigger = RecordCreated. Add a SendNotification action with recipient_type = record_owner. Activate the workflow. Create a new Contact.
**Expected:** Workflow fires asynchronously via Hangfire. A notification appears for the contact owner. An execution log is visible on the workflow detail page with status "Succeeded" and one ActionLog entry for SendNotification.
**Why human:** Requires running backend with database, Hangfire worker, and domain event dispatch chain.

---

### Gap Summary

All 13 WFLOW requirements are implemented with substantive code across all layers. The three UAT gaps from `19-UAT.md` were diagnosed and addressed:

1. **Canvas nodes not rendering** — Diagnosed: Angular content projection limitation with wrapper components around `[fNode]`. Fixed in 19-07: all node types inlined as `<div fNode>` directly inside `<f-canvas>` in `workflow-canvas.component.ts`. Code verified.

2. **Custom templates not appearing in gallery** — Diagnosed: gallery sent `entityType` filter causing cross-entity templates to be excluded. Fixed in 19-07: `template-gallery.component.ts` calls `this.service.getTemplates()` with no arguments; client-side `filterTemplates()` handles category filtering with entity-type relevance sorting. Code verified.

3. **Workflows navigation redirected to dashboard** — Diagnosed: stale permission state from sessions that predated the `Workflow` EntityType addition. Fixed in 19-08: `auth.interceptor.ts` now calls `permissionStore.loadPermissions()` after every successful 401-retry token refresh. Code verified.

No further code gaps remain. Human testing is needed to confirm the three fixes function correctly in the browser.

---

_Verified: 2026-02-19T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Previous VERIFICATION.md (no numeric prefix, pre-UAT, status "passed") superseded by this report._
