# Phase 19: Workflow Automation - Research

**Researched:** 2026-02-19
**Domain:** CRM workflow automation engine with visual flow builder, trigger-based execution, and multi-action orchestration
**Confidence:** HIGH

## Summary

Phase 19 builds a workflow automation engine on top of the existing DomainEventInterceptor (Phase 14), Hangfire background job infrastructure, webhook delivery system (Phase 17), and email sequence enrollment (Phase 18). The architecture is a natural extension: a new `WorkflowDomainEventHandler` (parallel to the existing `WebhookDomainEventHandler`) listens for entity lifecycle events, evaluates trigger conditions, and enqueues Hangfire jobs for action execution. Date-based triggers use Hangfire recurring jobs that scan for matching date field conditions.

The frontend visual flow builder uses `@foblex/flow` v18.1.2 -- an Angular-native, MIT-licensed library for node-based diagram editors that supports Angular 15+ (confirmed compatible with Angular 19.2.x). The library provides drag-and-drop nodes, connection management, zoom/pan/minimap, and custom node templates via Angular components. The workflow definition is stored as a JSONB column containing the flow graph (nodes, connections, positions) alongside normalized trigger/condition/action data for fast server-side evaluation.

The workflow engine enforces a depth limit (recommended: 5, configurable per tenant) to prevent infinite cascading triggers. Loop prevention uses a per-request `AsyncLocal<HashSet<string>>` tracking `{workflowId}:{entityId}` pairs, similar to Salesforce's static Set pattern for trigger recursion prevention. Each action execution is logged to a `WorkflowExecutionLog` table for full audit trail visibility.

**Primary recommendation:** Build the workflow engine as an `IDomainEventHandler` implementation that evaluates workflows synchronously (trigger matching + condition evaluation) and enqueues action execution via Hangfire on the existing `workflows` queue. Store workflow definitions as JSONB for the visual flow graph with denormalized relational columns for fast trigger matching queries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Workflow Builder UX
- Visual flow canvas with drag-and-drop nodes and connections (not structured form)
- Workflow list page uses card grid with miniaturized flow diagram thumbnails, name, status badge, and last run info
- New workflow starts with empty canvas and a centered "+ Add trigger to start" button (no pre-placed nodes)

#### Trigger & Condition Design
- A single workflow supports multiple triggers (OR logic) -- any one trigger fires the workflow
- Conditions use AND/OR grouping (like existing filter panel pattern), not simple AND-only rows
- Field-change triggers support both directional ("changed from X to Y") and target-only ("changed to Y") -- "from" value is optional

#### Action Composition
- Per-action "Continue on error" toggle -- each action node controls whether failure halts or skips
- "Update field" action supports both static values and dynamic mapping from trigger entity fields (merge-field-style picker, like email templates)
- "Create activity/task" action supports dynamic assignment: record owner, deal owner, or a specific user from dropdown

#### Templates & Onboarding
- New workflow opens blank canvas; "Use template" button in sidebar opens template gallery (templates are optional, not the default entry point)
- Template categories: sales-focused (deal won, lead qualified, deal idle), engagement-focused (welcome email, follow-up task), and operational (high-value deal notify, new company enrich)
- Applying a template creates a full copy -- user edits freely, no link to original template
- Users can save their own workflows as tenant-scoped reusable templates, shown alongside system templates with a "Custom" badge

### Claude's Discretion
- Whether to support if/else branching or keep workflows linear -- choose based on complexity tradeoffs
- Date trigger timing configuration (relative offset only vs. offset + specific execution time)
- Whether to support configurable delays between actions (wait nodes) -- choose based on Hangfire capabilities
- Loading skeleton and error state designs
- Exact node shapes, colors, and connection line styles on the canvas
- Canvas interaction patterns (zoom, pan, minimap)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WFLOW-01 | User can create a workflow with event triggers (record created/updated/deleted) | DomainEventInterceptor already captures Created/Updated/Deleted events with entity name, ID, and changed properties. WorkflowDomainEventHandler matches these against workflow trigger definitions. |
| WFLOW-02 | User can add field-change triggers with conditions (equals, greater than, changed to, etc.) | DomainEvent record includes `ChangedProperties` and `OldPropertyValues` dictionaries. Condition evaluator compares these against trigger config using AND/OR grouping. |
| WFLOW-03 | User can add date-based triggers (X days before/after a date field) | Hangfire recurring job (daily scan) queries entities where date fields match offset conditions. Follows DueDateNotificationService pattern for cross-tenant background scanning. |
| WFLOW-04 | User can add "update field" action to set field values automatically | WorkflowActionExecutor resolves entity by ID/type, applies field updates (including JSONB custom fields), saves via DbContext. Dynamic mapping uses trigger entity data as merge source. |
| WFLOW-05 | User can add "send notification" action to alert users/teams | Reuses existing NotificationDispatcher.DispatchAsync() with NotificationRequest. Supports dynamic recipient resolution (record owner, deal owner, specific user, team members). |
| WFLOW-06 | User can add "create activity/task" action with template-based configuration | Creates Activity entity with configurable Subject, Type, Priority, DueDate (offset from trigger), and dynamic AssignedToId resolution (record owner, deal owner, specific user). |
| WFLOW-07 | User can add "send email" action using an email template with merge fields | Reuses existing TemplateRenderService + MergeFieldService + email sending infrastructure from Phase 14. Action config references EmailTemplate ID and entity type for merge data resolution. |
| WFLOW-08 | User can add "fire webhook" action to trigger external integrations | Reuses WebhookDeliveryService.DeliverAsync() pattern. Action config stores URL, headers, payload template. SSRF validation via existing WebhookSsrfValidator. |
| WFLOW-09 | User can add "enroll in sequence" action to start email sequences | Creates SequenceEnrollment and schedules first step via SequenceExecutionService, same as manual enrollment but triggered by workflow. Requires contact entity context. |
| WFLOW-10 | User can chain multiple actions in a single workflow (multi-action) | Actions stored as ordered list in JSONB workflow definition. WorkflowActionExecutor processes sequentially, respecting per-action "continue on error" flag. |
| WFLOW-11 | User can view workflow execution logs showing trigger, conditions, and action results | WorkflowExecutionLog and WorkflowActionLog entities capture trigger event, condition evaluation results, and per-action success/failure/duration/error details. |
| WFLOW-12 | User can enable/disable workflows without deleting them | Workflow entity has IsActive boolean (matches WebhookSubscription pattern). WorkflowDomainEventHandler skips inactive workflows during trigger evaluation. |
| WFLOW-13 | Admin can select from pre-built workflow templates as starting points | WorkflowTemplate entity with IsSystem flag for built-in templates + tenant-scoped custom templates. Template gallery UI in workflow builder sidebar. Applying copies full definition. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @foblex/flow | ^18.1.2 | Visual flow canvas (drag-and-drop node editor) | Only Angular-native flow diagram library. MIT licensed, actively maintained (last publish Feb 17, 2026), supports Angular 15+ (confirmed >=19.2.x). Provides f-flow, f-canvas, fNode, fNodeOutput, fNodeInput, f-connection directives. |
| @foblex/platform | 1.0.4 | Peer dependency of @foblex/flow | Required platform abstraction |
| @foblex/mediator | 1.1.3 | Peer dependency of @foblex/flow | Required mediator pattern |
| @foblex/2d | 1.2.2 | Peer dependency of @foblex/flow | Required 2D math utilities |
| @foblex/utils | 1.1.1 | Peer dependency of @foblex/flow | Required utility functions |
| Hangfire (existing) | PostgreSQL storage | Background job execution for workflow actions | Already configured with `workflows` queue. TenantJobFilter propagates tenant context. |
| EF Core (existing) | -- | Workflow entity persistence, JSONB storage | Existing patterns for JSONB columns, GIN indexes, global query filters. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Fluid (existing) | -- | Liquid template rendering for merge fields | "Send email" action renders templates with entity merge data via existing TemplateRenderService. |
| FluentValidation (existing) | -- | Request validation for workflow CRUD endpoints | Validate workflow definition JSON structure, trigger configs, action configs on save. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @foblex/flow | JointJS | JointJS is more mature but has commercial licensing for full features. @foblex/flow is MIT, Angular-native, and sufficient for this use case. |
| @foblex/flow | GoJS | GoJS is powerful but has restrictive commercial licensing and no free tier. |
| @foblex/flow | Custom SVG canvas | Enormous development effort for drag-and-drop, zoom, pan, connection routing. Not justifiable. |
| JSONB workflow definition | Normalized relational tables for every node/connection | Over-engineering for a document that is authored and consumed as a unit. JSONB with denormalized trigger columns for querying is the right balance. |

**Installation:**
```bash
cd globcrm-web && npm install @foblex/flow @foblex/platform @foblex/mediator @foblex/2d @foblex/utils
```

No backend packages needed -- all backend infrastructure (Hangfire, EF Core, Fluid, NotificationDispatcher) already exists.

## Architecture Patterns

### Recommended Project Structure

**Backend:**
```
src/GlobCRM.Domain/
  Entities/
    Workflow.cs                    # Core entity: name, entity type, JSONB definition, IsActive, triggers summary
    WorkflowExecutionLog.cs        # Per-execution: trigger event, conditions result, overall status
    WorkflowActionLog.cs           # Per-action: action type, success/failure, error, duration
    WorkflowTemplate.cs            # Template entity: IsSystem flag, category, definition copy
  Enums/
    WorkflowStatus.cs              # Draft, Active, Paused
    WorkflowTriggerType.cs         # RecordCreated, RecordUpdated, RecordDeleted, FieldChanged, DateBased
    WorkflowActionType.cs          # UpdateField, SendNotification, CreateActivity, SendEmail, FireWebhook, EnrollInSequence
    WorkflowExecutionStatus.cs     # Succeeded, PartiallyFailed, Failed, Skipped
  Interfaces/
    IWorkflowRepository.cs

src/GlobCRM.Infrastructure/
  Workflows/
    WorkflowDomainEventHandler.cs  # IDomainEventHandler - matches triggers, enqueues execution
    WorkflowExecutionService.cs    # Hangfire job - evaluates conditions, executes actions sequentially
    WorkflowConditionEvaluator.cs  # AND/OR condition group evaluation
    WorkflowActionExecutor.cs      # Dispatches to type-specific action handlers
    Actions/
      UpdateFieldAction.cs
      SendNotificationAction.cs
      CreateActivityAction.cs
      SendEmailAction.cs
      FireWebhookAction.cs
      EnrollInSequenceAction.cs
    DateTriggerScanService.cs      # Recurring Hangfire job for date-based triggers
    WorkflowLoopGuard.cs           # AsyncLocal depth tracking and duplicate prevention
    WorkflowRepository.cs
    WorkflowServiceExtensions.cs   # AddWorkflowServices() DI registration

src/GlobCRM.Api/
  Controllers/
    WorkflowsController.cs        # CRUD + execute logs + enable/disable
    WorkflowTemplatesController.cs # Template gallery + save as template
```

**Frontend:**
```
globcrm-web/src/app/features/workflows/
  workflow.models.ts               # TypeScript interfaces for workflow entities
  workflow.service.ts              # API service
  workflow.store.ts                # Signal store
  workflows.routes.ts              # Lazy-loaded routes
  workflow-list/
    workflow-list.component.ts     # Card grid with flow thumbnails
    workflow-card.component.ts     # Individual card with minimap preview
  workflow-builder/
    workflow-builder.component.ts  # Main canvas + sidebar layout
    workflow-canvas.component.ts   # @foblex/flow canvas wrapper
    nodes/
      trigger-node.component.ts    # Trigger node template
      condition-node.component.ts  # Condition node template
      action-node.component.ts     # Action node template (per action type)
    panels/
      trigger-config.component.ts  # Trigger configuration sidebar panel
      condition-config.component.ts # AND/OR condition builder
      action-config.component.ts   # Action configuration (type-specific)
      template-gallery.component.ts # Template picker sidebar
    workflow-toolbar.component.ts   # Save, enable/disable, test, template
  workflow-logs/
    execution-log-list.component.ts # Execution history table
    execution-log-detail.component.ts # Per-execution action breakdown
```

### Pattern 1: WorkflowDomainEventHandler (parallel to WebhookDomainEventHandler)

**What:** A new IDomainEventHandler that matches domain events to active workflow triggers and enqueues execution jobs.
**When to use:** Every entity save that produces a DomainEvent.

```csharp
// Follows existing WebhookDomainEventHandler pattern exactly
public class WorkflowDomainEventHandler : IDomainEventHandler
{
    private readonly IBackgroundJobClient _jobClient;
    private readonly IWorkflowRepository _workflowRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly WorkflowLoopGuard _loopGuard;
    private readonly IMemoryCache _cache;

    private static readonly HashSet<string> EligibleEntities =
        ["Contact", "Company", "Deal", "Lead", "Activity"];

    public async Task HandleAsync(DomainEvent domainEvent, CancellationToken ct)
    {
        if (!EligibleEntities.Contains(domainEvent.EntityName)) return;

        var tenantId = _tenantProvider.GetTenantId();
        if (!tenantId.HasValue) return;

        // Loop guard: check depth and duplicate prevention
        if (!_loopGuard.CanExecute(tenantId.Value))
            return;

        // Load active workflows from cache (60-second TTL, same as webhooks)
        var workflows = await GetCachedWorkflowsAsync(tenantId.Value, ct);

        foreach (var workflow in workflows)
        {
            if (!MatchesTrigger(workflow, domainEvent)) continue;

            // Serialize trigger context NOW (while entity is in memory)
            var triggerContext = BuildTriggerContext(domainEvent, workflow);

            _jobClient.Enqueue<WorkflowExecutionService>(
                WorkflowExecutionService.QueueName,
                svc => svc.ExecuteAsync(workflow.Id, triggerContext, tenantId.Value));
        }
    }
}
```

### Pattern 2: Workflow Definition as JSONB + Denormalized Trigger Columns

**What:** The visual flow graph (nodes, connections, positions) is stored as a single JSONB column. Trigger metadata is denormalized into queryable columns for fast matching.
**When to use:** All workflow CRUD and trigger evaluation.

```csharp
public class Workflow
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // The target entity type this workflow operates on
    public string EntityType { get; set; } = string.Empty; // "Contact", "Deal", etc.

    // Full visual flow definition (nodes, connections, positions, configs)
    // Stored as JSONB for the canvas to load/save as a unit
    public WorkflowDefinition Definition { get; set; } = new();

    // Denormalized trigger summary for fast query matching
    // e.g., ["RecordCreated", "FieldChanged:Status"] -- avoids parsing JSONB on every event
    public List<string> TriggerSummary { get; set; } = [];

    public WorkflowStatus Status { get; set; } = WorkflowStatus.Draft;
    public bool IsActive { get; set; } = false;

    public Guid CreatedByUserId { get; set; }
    public int ExecutionCount { get; set; } = 0;
    public DateTimeOffset? LastExecutedAt { get; set; }

    public bool IsSeedData { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// Stored as JSONB -- the full canvas state
public class WorkflowDefinition
{
    public List<WorkflowNode> Nodes { get; set; } = [];
    public List<WorkflowConnection> Connections { get; set; } = [];
    public List<WorkflowTriggerConfig> Triggers { get; set; } = [];
    public List<WorkflowConditionGroup> Conditions { get; set; } = [];
    public List<WorkflowActionConfig> Actions { get; set; } = [];
}
```

### Pattern 3: AND/OR Condition Evaluation (reuses FilterPanel pattern)

**What:** Conditions use the same AND/OR grouping logic as the existing filter panel, extended for workflow-specific operators like "changed to" and "changed from X to Y".
**When to use:** Condition evaluation during workflow execution.

```csharp
public class WorkflowConditionEvaluator
{
    // Condition groups mirror the filter panel pattern:
    // Groups are OR'd together, conditions within a group are AND'd
    public bool Evaluate(
        List<WorkflowConditionGroup> conditionGroups,
        DomainEvent domainEvent,
        Dictionary<string, object?> entityData)
    {
        if (conditionGroups.Count == 0) return true; // No conditions = always pass

        // OR logic across groups
        return conditionGroups.Any(group => EvaluateGroup(group, domainEvent, entityData));
    }

    private bool EvaluateGroup(
        WorkflowConditionGroup group,
        DomainEvent domainEvent,
        Dictionary<string, object?> entityData)
    {
        // AND logic within a group
        return group.Conditions.All(condition =>
            EvaluateCondition(condition, domainEvent, entityData));
    }

    private bool EvaluateCondition(
        WorkflowCondition condition,
        DomainEvent domainEvent,
        Dictionary<string, object?> entityData)
    {
        return condition.Operator switch
        {
            "equals" => GetFieldValue(condition.Field, entityData)?.ToString() == condition.Value,
            "not_equals" => GetFieldValue(condition.Field, entityData)?.ToString() != condition.Value,
            "gt" => CompareNumeric(condition.Field, entityData, condition.Value) > 0,
            "gte" => CompareNumeric(condition.Field, entityData, condition.Value) >= 0,
            "lt" => CompareNumeric(condition.Field, entityData, condition.Value) < 0,
            "lte" => CompareNumeric(condition.Field, entityData, condition.Value) <= 0,
            "contains" => GetFieldValue(condition.Field, entityData)?.ToString()?.Contains(condition.Value ?? "") ?? false,
            "changed_to" => domainEvent.ChangedProperties?.ContainsKey(condition.Field) == true
                && domainEvent.ChangedProperties[condition.Field]?.ToString() == condition.Value,
            "changed_from_to" => domainEvent.OldPropertyValues?.ContainsKey(condition.Field) == true
                && domainEvent.OldPropertyValues[condition.Field]?.ToString() == condition.FromValue
                && domainEvent.ChangedProperties?[condition.Field]?.ToString() == condition.Value,
            "is_null" => GetFieldValue(condition.Field, entityData) == null,
            "is_not_null" => GetFieldValue(condition.Field, entityData) != null,
            _ => false
        };
    }
}
```

### Pattern 4: Loop Prevention with Depth Tracking

**What:** AsyncLocal-based guard prevents infinite cascading triggers. Tracks execution depth and processed workflow+entity pairs.
**When to use:** Every workflow trigger evaluation and action execution.

```csharp
public class WorkflowLoopGuard
{
    // Max depth for cascading workflows (workflow A updates field -> triggers workflow B -> etc.)
    private const int MaxDepth = 5;

    private static readonly AsyncLocal<int> _currentDepth = new();
    private static readonly AsyncLocal<HashSet<string>?> _processedPairs = new();

    public bool CanExecute(Guid tenantId)
    {
        return _currentDepth.Value < MaxDepth;
    }

    public bool TryMarkProcessed(Guid workflowId, Guid entityId)
    {
        _processedPairs.Value ??= new HashSet<string>();
        var key = $"{workflowId}:{entityId}";
        return _processedPairs.Value.Add(key); // Returns false if already processed
    }

    public IDisposable IncrementDepth()
    {
        _currentDepth.Value++;
        return new DepthScope();
    }

    private class DepthScope : IDisposable
    {
        public void Dispose() => _currentDepth.Value--;
    }
}
```

### Pattern 5: Action Execution with Continue-on-Error

**What:** Sequential action processing with per-action error handling controlled by a "continue on error" flag.
**When to use:** WorkflowExecutionService processes action list.

```csharp
// Inside WorkflowExecutionService.ExecuteAsync()
foreach (var action in orderedActions)
{
    var actionLog = new WorkflowActionLog
    {
        ExecutionLogId = executionLog.Id,
        ActionType = action.Type,
        ActionConfig = action.Config,
        StartedAt = DateTimeOffset.UtcNow
    };

    try
    {
        await _actionExecutor.ExecuteAsync(action, triggerContext, tenantId);
        actionLog.Status = ActionStatus.Succeeded;
    }
    catch (Exception ex)
    {
        actionLog.Status = ActionStatus.Failed;
        actionLog.ErrorMessage = ex.Message;

        if (!action.ContinueOnError)
        {
            // Halt workflow execution
            executionLog.Status = WorkflowExecutionStatus.Failed;
            break;
        }
        // Continue to next action
        executionLog.Status = WorkflowExecutionStatus.PartiallyFailed;
    }
    finally
    {
        actionLog.CompletedAt = DateTimeOffset.UtcNow;
        actionLog.DurationMs = (int)(actionLog.CompletedAt.Value - actionLog.StartedAt).TotalMilliseconds;
    }
}
```

### Discretion Recommendations

#### If/Else Branching: Support Limited Branching

**Recommendation:** Support if/else branching nodes on the canvas. This is a natural fit for the visual flow builder (user decision) and covers the most common CRM automation pattern: "if condition, do A; else do B." Full arbitrary branching with merging/joining adds significant complexity and is deferred (WFLOW-F02). Keep it to a single level of if/else per branch node -- no nested branches within branches.

**Rationale:** The visual canvas already handles node connections with multiple outputs. @foblex/flow supports multiple `fNodeOutput` connectors per node, making "true" and "false" branches trivial to render. The execution engine simply evaluates the branch condition and follows one path. Without branching, users would need two separate workflows for "if deal value > 10000, notify manager; else create follow-up task" -- a very common pattern.

**Implementation:** A "Branch" node type with a condition config and two output connectors ("Yes" / "No"). Each output connects to the next action in that branch. The execution engine follows only the matching branch.

#### Date Trigger Timing: Relative Offset + Optional Execution Time

**Recommendation:** Support both relative offset (X days before/after) AND an optional specific execution time (e.g., "2 days before, at 9:00 AM"). Default to midnight UTC if no time specified.

**Rationale:** "3 days before deal close date" is useful, but "3 days before deal close date at 9 AM" is what users actually want for notification timing. This matches the existing `SequenceExecutionService.CalculateDelay()` pattern that already handles `DelayDays` + optional `PreferredSendTime`. Reuse the same time calculation logic.

**Implementation:** `DateTriggerScanService` runs as a Hangfire recurring job (hourly). It queries workflows with date triggers, finds entities matching the offset window, and enqueues execution jobs. The scan checks `dateField + offset <= now` to find entities that have entered the trigger window since the last scan.

#### Wait/Delay Nodes: Yes, Support Them

**Recommendation:** Support configurable delay nodes between actions (e.g., "wait 2 hours," "wait 1 day").

**Rationale:** Hangfire's `BackgroundJob.Schedule()` with `TimeSpan` delay is purpose-built for this. The existing sequence engine already uses delayed scheduling between steps. Wait nodes are essential for common patterns like "when deal is won -> wait 1 day -> send thank-you email" and "when contact created -> wait 30 minutes -> create follow-up task."

**Implementation:** When the action executor encounters a "Wait" node, it schedules the remaining actions as a new Hangfire job with the configured delay, passing the execution context forward. This is identical to how `SequenceExecutionService.ScheduleNextStepOrComplete()` works.

#### Canvas Interaction Patterns

**Recommendation:**
- **Zoom:** Mouse wheel + zoom control buttons (fit-to-view, zoom in, zoom out) in a floating toolbar
- **Pan:** Click-and-drag on canvas background (standard fDraggable behavior)
- **Minimap:** Include minimap for complex workflows (foblex/flow supports it via f-minimap component if available; otherwise, a simple overview panel)
- **Node colors:** Triggers = blue, Conditions/Branches = amber/yellow, Actions = green, Wait = gray. These align with conventional automation builder color coding.
- **Connection lines:** Bezier curves (default foblex/flow behavior), with directional arrow markers
- **Node shapes:** Rounded rectangles with icon + title header and compact config summary

#### Loading & Error States

**Recommendation:**
- **Loading:** Skeleton cards on list page (4 placeholder cards). Canvas shows centered spinner during workflow load.
- **Error states:** Toast notifications for save failures. Inline validation errors in node config panels. Red border on nodes with configuration errors.

### Anti-Patterns to Avoid

- **Evaluating JSONB on every DomainEvent:** Do NOT parse the full JSONB definition during trigger matching. Use denormalized `TriggerSummary` column and entity type for fast filtering, then parse JSONB only for matched workflows.
- **Synchronous action execution in the DomainEvent handler:** Do NOT execute actions inside the domain event handler. Always enqueue to Hangfire. The handler must be fast (match + enqueue only).
- **Storing canvas state and engine state separately:** The workflow definition JSONB should be the single source of truth for both the visual canvas and the execution engine. Do NOT maintain separate representations that could drift.
- **Unlimited recursion depth:** Always enforce depth limits. Even with loop prevention, set a hard cap. Salesforce uses 16; our recommendation of 5 is more conservative and appropriate for a CRM.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Visual flow canvas | Custom SVG/Canvas drag-and-drop system | @foblex/flow | Connection routing, zoom, pan, node positioning are solved problems. Custom implementation would be 2000+ lines of complex interaction code. |
| Template rendering for email actions | Custom string interpolation | Existing TemplateRenderService + MergeFieldService (Fluid library) | Liquid syntax, custom field resolution, and entity data loading already built and tested. |
| Background job scheduling | Custom timer-based scheduler | Hangfire (existing) | Retry logic, persistence, dashboard monitoring, queue management, tenant context propagation already configured. |
| Notification delivery | Custom notification pipeline | Existing NotificationDispatcher | DB persistence + SignalR push + email already integrated. |
| Webhook delivery | Custom HTTP client with retry | Existing WebhookDeliveryService | HMAC signing, SSRF validation, retry with backoff, auto-disable already built. |
| Sequence enrollment | Custom enrollment logic | Existing SequenceEnrollmentRepository + SequenceExecutionService | Step scheduling, template rendering, tracking injection already built. |
| Condition evaluation operators | Custom comparison logic from scratch | Extend existing FilterPanel operator patterns | Same operators (equals, gt, lt, contains, etc.) already defined and tested in filter panel. |

**Key insight:** Phase 19 is primarily an orchestration layer. Five of the six action types already have working implementations. The new work is the trigger evaluation engine, the visual builder frontend, and the glue that connects events to actions.

## Common Pitfalls

### Pitfall 1: Workflow Triggers Causing Infinite Loops
**What goes wrong:** Workflow A updates a field on Contact -> triggers Workflow B (field changed) -> Workflow B sends notification + updates another field -> triggers Workflow A again -> infinite loop.
**Why it happens:** The "Update field" action triggers another SaveChanges which fires DomainEventInterceptor, which dispatches to WorkflowDomainEventHandler again.
**How to avoid:** WorkflowLoopGuard with AsyncLocal depth counter (max 5) + processed pairs set (`{workflowId}:{entityId}`). The guard is checked at the START of WorkflowDomainEventHandler.HandleAsync(). Additionally, the "Update field" action should NOT re-trigger the same workflow that updated the field (self-trigger prevention).
**Warning signs:** Hangfire dashboard shows rapid job creation; execution logs show the same workflow firing multiple times in seconds.

### Pitfall 2: Serialization Issues in Hangfire Jobs
**What goes wrong:** Entity objects passed as Hangfire job arguments fail to deserialize because DbContext is disposed by the time the job runs.
**Why it happens:** Hangfire serializes job arguments to JSON and stores in PostgreSQL. Entity navigation properties, proxy objects, and DbContext references cannot survive serialization.
**How to avoid:** Pass only primitive IDs and pre-serialized context strings to Hangfire jobs. Build a `WorkflowTriggerContext` record with entity ID, entity type, tenant ID, changed properties (as Dictionary), and trigger metadata -- all serializable primitives. This matches the existing WebhookDomainEventHandler pattern where the payload is serialized BEFORE enqueuing.
**Warning signs:** Hangfire dashboard shows failed jobs with JsonSerializationException or ObjectDisposedException.

### Pitfall 3: Canvas State Desynchronization
**What goes wrong:** The visual canvas and the execution engine disagree about the workflow structure. User adds a node on the canvas but the backend doesn't know about it.
**Why it happens:** If canvas state (visual positions) and engine state (trigger/condition/action configs) are stored in separate structures, they can drift when one is saved but the other isn't.
**How to avoid:** Single JSONB column stores EVERYTHING -- visual positions AND logical configuration. The frontend saves the complete graph as one atomic operation. The backend parses the same JSONB for both display (thumbnails) and execution. Denormalized columns (TriggerSummary, EntityType) are computed on save from the JSONB, never edited independently.
**Warning signs:** Workflow builder shows nodes that don't execute, or execution logs reference actions that aren't visible on the canvas.

### Pitfall 4: Date Trigger Scan Missing Records or Double-Firing
**What goes wrong:** The hourly date scan either misses entities that entered the trigger window between scans, or fires the same workflow twice for the same entity.
**Why it happens:** Scan interval + date math edge cases. If the scan runs at 10:00 and 11:00, an entity with trigger "1 day before" whose date is at 10:30 tomorrow might be picked up by both scans.
**How to avoid:** Track last execution per workflow+entity pair in the execution log. Before executing, check if this workflow has already fired for this entity in the current trigger window. Use a unique constraint or a "last date trigger check" column on the workflow. Follow the DueDateNotificationService pattern: check for existing notification before dispatching.
**Warning signs:** Execution logs show duplicate entries for the same workflow + entity within the scan interval.

### Pitfall 5: Template Gallery Loading All Tenant Workflows
**What goes wrong:** The "Use template" gallery loads slowly because it fetches all workflows for the tenant instead of just templates.
**Why it happens:** No distinction between workflows and templates, or templates stored in the same table without filtering.
**How to avoid:** Separate `WorkflowTemplate` entity (or `IsTemplate` flag on Workflow) with lightweight projection for the gallery (name, description, category, thumbnail -- no full definition until user selects one). System templates have `IsSystem = true`, custom templates are tenant-scoped.
**Warning signs:** Template gallery takes > 1 second to load; network tab shows large payload.

## Code Examples

### @foblex/flow Canvas Setup (Angular)

```typescript
// Source: https://flow.foblex.com/docs/get-started
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  FFlowModule,       // f-flow, f-canvas, f-connection
  FDraggableModule,   // fDraggable
  FNodeModule,        // fNode, fNodeOutput, fNodeInput
} from '@foblex/flow';

@Component({
  selector: 'app-workflow-canvas',
  standalone: true,
  imports: [FFlowModule, FDraggableModule, FNodeModule],
  template: `
    <f-flow fDraggable>
      <f-canvas>
        <!-- Trigger Node -->
        @for (node of nodes(); track node.id) {
          <div fNode
               [fNodeId]="node.id"
               [fNodePosition]="node.position"
               [class]="'workflow-node ' + node.type">

            <!-- Output connector -->
            <div fNodeOutput
                 [fOutputId]="node.id + '_output'"
                 fOutputConnectableSide="bottom">
            </div>

            <!-- Input connector (not on trigger nodes) -->
            @if (node.type !== 'trigger') {
              <div fNodeInput
                   [fInputId]="node.id + '_input'"
                   fInputConnectableSide="top">
              </div>
            }

            <div class="node-content">
              <mat-icon>{{ node.icon }}</mat-icon>
              <span>{{ node.label }}</span>
            </div>
          </div>
        }

        <!-- Connections -->
        @for (conn of connections(); track conn.id) {
          <f-connection
            [fConnectionId]="conn.id"
            [fOutputId]="conn.sourceId + '_output'"
            [fInputId]="conn.targetId + '_input'">
          </f-connection>
        }
      </f-canvas>
    </f-flow>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowCanvasComponent {
  nodes = input<WorkflowNode[]>([]);
  connections = input<WorkflowConnection[]>([]);
}
```

### Workflow Entity Configuration (EF Core)

```csharp
public class WorkflowConfiguration : IEntityTypeConfiguration<Workflow>
{
    public void Configure(EntityTypeBuilder<Workflow> builder)
    {
        builder.ToTable("workflows");
        builder.HasKey(w => w.Id);

        builder.Property(w => w.TenantId).IsRequired();
        builder.Property(w => w.Name).HasMaxLength(200).IsRequired();
        builder.Property(w => w.Description).HasMaxLength(1000);
        builder.Property(w => w.EntityType).HasMaxLength(50).IsRequired();

        // JSONB for the full workflow definition (canvas + logic)
        builder.OwnsOne(w => w.Definition, d =>
        {
            d.ToJson("definition");
        });

        // JSONB list for fast trigger matching
        builder.Property(w => w.TriggerSummary)
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'[]'::jsonb");

        builder.Property(w => w.Status)
            .HasConversion<string>()
            .HasMaxLength(20);

        // Indexes
        builder.HasIndex(w => new { w.TenantId, w.IsActive, w.EntityType })
            .HasDatabaseName("ix_workflows_tenant_active_entity");

        builder.HasIndex(w => w.TenantId)
            .HasDatabaseName("ix_workflows_tenant");

        // Global query filter for multi-tenancy
        builder.HasQueryFilter(w => EF.Property<Guid>(w, "TenantId") ==
            EF.Property<Guid>(w, "TenantId"));
    }
}
```

### WorkflowDomainEventHandler Registration

```csharp
// In WorkflowServiceExtensions.cs -- follows existing patterns
public static IServiceCollection AddWorkflowServices(this IServiceCollection services)
{
    // Domain event handler (alongside WebhookDomainEventHandler)
    services.AddScoped<IDomainEventHandler, WorkflowDomainEventHandler>();

    // Execution services
    services.AddScoped<WorkflowExecutionService>();
    services.AddScoped<WorkflowConditionEvaluator>();
    services.AddScoped<WorkflowActionExecutor>();
    services.AddScoped<WorkflowLoopGuard>();

    // Action handlers
    services.AddScoped<UpdateFieldAction>();
    services.AddScoped<SendNotificationAction>();
    services.AddScoped<CreateActivityAction>();
    services.AddScoped<SendEmailAction>();
    services.AddScoped<FireWebhookAction>();
    services.AddScoped<EnrollInSequenceAction>();

    // Repository
    services.AddScoped<IWorkflowRepository, WorkflowRepository>();

    return services;
}
```

### Date Trigger Scan Service

```csharp
// Follows DueDateNotificationService pattern exactly -- Hangfire recurring job
public class DateTriggerScanService
{
    public const string JobId = "workflow-date-trigger-scan";

    // Registered as: RecurringJob.AddOrUpdate<DateTriggerScanService>(
    //     JobId, svc => svc.ScanAsync(), Cron.Hourly);
    [AutomaticRetry(Attempts = 1)]
    public async Task ScanAsync()
    {
        // 1. Query all active workflows with date-based triggers across all tenants
        //    (IgnoreQueryFilters, same as DueDateNotificationService)
        // 2. For each workflow, find entities where date field + offset falls within scan window
        // 3. Check execution log for duplicate prevention
        // 4. Enqueue WorkflowExecutionService job for each match
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple trigger -> action linear form | Visual flow canvas with drag-and-drop | HubSpot 2020, Salesforce Flow Builder 2021 | Users expect visual workflow builders in modern CRM |
| All workflow processing synchronous | Event-driven + background job execution | Industry standard since ~2018 | Prevents blocking user operations; enables retry and audit |
| Workflow definitions in normalized tables | JSON/JSONB document with denormalized query columns | Modern CRM pattern | Canvas state and execution state unified; fast writes; queryable triggers |
| Manual loop counting by developers | Platform-enforced depth limits | Salesforce (16), Dynamics 365 (16) | Prevents infinite recursion without developer awareness |

**Deprecated/outdated:**
- Purely linear form-based workflow builders: Users expect visual canvas per the locked user decision
- Synchronous workflow execution blocking the HTTP response: Always use background jobs
- Separate workflow versioning in v1.1: Deferred to WFLOW-F03

## Open Questions

1. **@foblex/flow minimap component availability**
   - What we know: The library has minimap mentioned in docs navigation, but documentation page returned 404
   - What's unclear: Whether `f-minimap` is a shipped component or planned feature
   - Recommendation: Start without minimap. If @foblex/flow provides it, add it. If not, implement a simple canvas overview with CSS transform scaling of the flow into a small preview div (this is also needed for the list page card thumbnails).

2. **Workflow-triggered SaveChanges and DomainEvent re-dispatch**
   - What we know: When "Update field" action calls SaveChanges, the DomainEventInterceptor will fire again, dispatching to both WebhookDomainEventHandler AND WorkflowDomainEventHandler
   - What's unclear: Whether the AsyncLocal loop guard state survives across the Hangfire job boundary (it likely does NOT, since Hangfire jobs run in separate threads)
   - Recommendation: Pass the current execution depth as a Hangfire job parameter (alongside tenantId). The WorkflowExecutionService reads it and sets the AsyncLocal before executing actions. If an action triggers SaveChanges that re-enters WorkflowDomainEventHandler, the depth is incremented. This requires modifying the handler to read depth from both AsyncLocal AND Hangfire job parameters.

3. **Thumbnail generation for workflow list cards**
   - What we know: User decision requires miniaturized flow diagram on list cards
   - What's unclear: Whether to render thumbnails server-side or client-side
   - Recommendation: Client-side rendering. Each card component renders a small, non-interactive @foblex/flow canvas (or SVG approximation from the node positions in the JSONB definition). This avoids server-side image generation complexity. The JSONB definition contains node positions which are sufficient for drawing a schematic thumbnail.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- Read DomainEventInterceptor, DomainEventDispatcher, WebhookDomainEventHandler, SequenceExecutionService, NotificationDispatcher, DueDateNotificationService, TenantJobFilter, HangfireServiceExtensions, MergeFieldService, FilterPanelComponent, existing entity patterns, package.json, app.routes.ts
- **npm registry** -- @foblex/flow v18.1.2 peer dependencies verified: `@angular/core >=15.0.0`, published 2026-02-17
- **Foblex Flow official docs** -- https://flow.foblex.com/docs/get-started -- core components (f-flow, f-canvas, fNode, fNodeOutput, fNodeInput, f-connection, fDraggable) verified

### Secondary (MEDIUM confidence)
- **Foblex Flow GitHub** -- https://github.com/Foblex/f-flow -- MIT license, Angular 15+ compatibility, scheme editor example
- **Foblex Flow npm** -- https://www.npmjs.com/package/@foblex/flow -- version history confirms active maintenance (18 releases in last 6 months)
- **Salesforce trigger depth** -- https://www.sfdcpoint.com/salesforce/maximum-trigger-depth-exceeded-error-salesforce/ -- 16-level depth limit for cascading triggers
- **Microsoft Dynamics 365** -- https://learn.microsoft.com/en-us/dynamics365/customerengagement/on-premises/customize/best-practices-workflow-processes -- 16 iteration limit
- **Hangfire delayed jobs** -- https://docs.hangfire.io/en/latest/background-methods/calling-methods-with-delay.html -- BackgroundJob.Schedule with TimeSpan

### Tertiary (LOW confidence)
- **HubSpot workflow loop prevention** -- https://knowledge.hubspot.com/workflows/workflows-faq -- skips actions when enrolled record would re-trigger same workflow (behavioral description, not implementation detail)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @foblex/flow verified via npm registry, all backend infrastructure already exists and was read from codebase
- Architecture: HIGH -- Patterns directly mirror existing WebhookDomainEventHandler, SequenceExecutionService, DueDateNotificationService with minimal new abstractions
- Pitfalls: HIGH -- Loop prevention and serialization issues documented from Salesforce/Dynamics 365 patterns and verified against existing codebase patterns
- Discretion recommendations: MEDIUM -- Branching and delay decisions based on codebase capabilities (Hangfire Schedule, @foblex/flow multi-output) and industry patterns, not user-specific testing

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days -- stable domain, no fast-moving dependencies)
