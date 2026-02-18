# Architecture Patterns: v1.1 Automation & Intelligence

**Domain:** CRM Workflow Automation, Email Sequences, Computed Fields, Duplicate Detection, Webhooks, Advanced Reporting
**Researched:** 2026-02-18
**Confidence:** HIGH (based on existing codebase analysis + verified technology patterns)

## Executive Summary

The v1.1 features represent a shift from CRUD operations to **event-driven automation** and **dynamic computation**. The existing Clean Architecture layers remain intact, but v1.1 introduces three new cross-cutting concerns: (1) an event bus that reacts to entity changes, (2) a background processing pipeline for async work (workflows, webhooks, email sequences), and (3) a dynamic expression evaluation layer for formula fields and report queries.

The key architectural insight: **all six features share a common trigger mechanism** -- CRM entity changes (create/update/delete/stage-change) are the events that start workflows, fire webhooks, trigger duplicate checks, and recalculate formula fields. This means the core investment is a lightweight domain event system wired into the existing `SaveChangesAsync` pipeline, with each feature subscribing to relevant events.

**Background processing model:** v1.1 adopts Hangfire (PostgreSQL-backed) for all async job processing -- workflow action execution, webhook delivery with retry, email sequence step scheduling, and batch duplicate scanning. This replaces the need for hand-rolled `BackgroundService` polling loops (though existing ones like `DueDateNotificationService` and `EmailSyncBackgroundService` remain unchanged). Hangfire provides delayed job scheduling, automatic retry with backoff, job persistence across app restarts, and a monitoring dashboard -- capabilities that CRM automation specifically requires.

## Recommended Architecture

### System-Level View: v1.1 Components

```
EXISTING (unchanged)                    NEW (v1.1)
============================           ============================

Angular 19 Frontend                    + Workflow Builder UI
  - Feature modules                    + Email Template Editor
  - Signal Stores                      + Report Builder UI
  - Shared components                  + Duplicate Review UI
       |                                      |
       v                                      v
.NET 10 API Layer                      + WorkflowsController
  - Controllers                        + EmailTemplatesController
  - DTOs, Validators                   + EmailSequencesController
  - Middleware                         + ReportBuilderController
       |                              + DuplicatesController
       v                              + WebhooksController
Application Layer                            |
  - Command/Handlers                         v
  - Abstractions                       + Domain Event Dispatcher
       |                              + IWorkflowEngine
       v                              + IFormulaEvaluator
Domain Layer                           + IDuplicateDetector
  - Entities                           + IWebhookPublisher
  - Interfaces                               |
  - Enums                                    v
       |                               Infrastructure Layer
       v                              + WorkflowEngine (NCalc conditions)
Infrastructure Layer                   + FormulaEvaluator (NCalc)
  - EF Core / Repositories            + DuplicateDetectionService (pg_trgm + FuzzySharp)
  - Email / Gmail                      + WebhookDeliveryService (Polly + HttpClient)
  - Notifications                      + EmailTemplateRenderer (Fluid/Liquid)
  - SignalR                            + ReportQueryBuilder
  - Background Services               + Hangfire Job Server (PostgreSQL storage)
                                         - WorkflowActionJob
                                         - WebhookDeliveryJob
                                         - SequenceStepJob
                                         - DuplicateScanJob
```

### Component Boundaries

| Component | Layer | Responsibility | Communicates With |
|-----------|-------|---------------|-------------------|
| **DomainEventInterceptor** | Infrastructure | Intercepts SaveChanges, publishes entity change events | WorkflowEngine, WebhookPublisher, DuplicateDetector |
| **WorkflowEngine** | Infrastructure | Evaluates workflow conditions (NCalc), enqueues action jobs via Hangfire | Hangfire, NotificationDispatcher, EmailService, WebhookPublisher, FeedRepository |
| **FormulaEvaluator** | Application | Evaluates NCalc expressions against entity + custom field data | CustomFieldRepository (for field definitions) |
| **FluidEmailTemplateRenderer** | Infrastructure | Renders Liquid/Fluid templates with entity context | Existing RazorEmailRenderer (coexists for system emails) |
| **EmailSequenceService** | Infrastructure | Manages enrollments, schedules steps as delayed Hangfire jobs | FluidEmailTemplateRenderer, EmailService, Hangfire |
| **DuplicateDetectionService** | Infrastructure | Fuzzy matching via pg_trgm + FuzzySharp scoring | ApplicationDbContext (raw SQL for similarity) |
| **WebhookDeliveryService** | Infrastructure | HTTP delivery with HMAC signing, Polly retry pipeline | IHttpClientFactory, Polly |
| **WebhookPublisher** | Infrastructure | Enqueues webhook delivery as Hangfire fire-and-forget jobs | Hangfire, WebhookDeliveryService |
| **ReportQueryBuilder** | Infrastructure | Translates report definitions into EF Core/SQL queries | ApplicationDbContext, FormulaEvaluator |
| **Hangfire Job Server** | Infrastructure | Persists and executes background jobs with retry, scheduling, monitoring | PostgreSQL (dedicated schema), all job classes |

### Data Flow

#### Flow 1: Entity Change Triggers Everything

```
User updates Deal stage via API
       |
       v
DealsController.UpdateStage()
       |
       v
_db.SaveChangesAsync()  <--- DomainEventInterceptor fires
       |                      |
       v                      +---> DomainEvent: DealUpdated { DealId, Changes, OldStage, NewStage }
  Response 200 OK                    |
                                     +---> WorkflowEngine.EvaluateAsync(event)
                                     |       -> Matches "When deal moves to Won" rule
                                     |       -> Quick actions inline (update field)
                                     |       -> Slow actions enqueued via Hangfire:
                                     |            BackgroundJob.Enqueue(() => SendWorkflowEmail(...))
                                     |            BackgroundJob.Enqueue(() => DeliverWebhook(...))
                                     |            BackgroundJob.Enqueue(() => CreateActivity(...))
                                     |
                                     +---> WebhookPublisher.EnqueueAsync(event)
                                     |       -> For each matching subscription:
                                     |            BackgroundJob.Enqueue(() => DeliverWebhook(...))
                                     |
                                     +---> DuplicateDetectionService (on Create only)
                                             -> Inline pg_trgm check for real-time feedback
                                             -> If found, create DuplicateCandidate records
```

#### Flow 2: Email Sequence Execution

```
Workflow Action: "Start sequence 'Welcome Onboarding'"
       |
       v
EmailSequenceService.EnrollAsync(contactId, sequenceId)
  -> Create SequenceEnrollment (status=Active, currentStep=0)
  -> Schedule first step as delayed Hangfire job:
       BackgroundJob.Schedule(() => ExecuteSequenceStep(enrollmentId, stepNumber: 0),
                             delay: step.DelayDays days + step.DelayHours hours)
       |
       v
[After delay elapses, Hangfire executes:]
SequenceStepJob.ExecuteSequenceStep(enrollmentId, stepNumber)
  1. Load enrollment + step template
  2. Check step condition (NCalc, optional)
  3. Render template with Fluid (contact/company/deal context)
  4. Send via existing EmailService (SendGrid)
  5. Log to SequenceStepLog
  6. If more steps remain:
       BackgroundJob.Schedule(() => ExecuteSequenceStep(enrollmentId, stepNumber + 1),
                             delay: nextStep.Delay)
  7. If last step: mark enrollment as Completed
```

#### Flow 3: Report Builder Query Execution

```
User configures report in UI:
  Entity: Deal
  Columns: [Title, Value, Stage, Owner, "Weighted Value" (formula field)]
  Filters: [Stage != Lost, CreatedAt > 30 days ago]
  Group By: Stage
  Aggregation: SUM(Value), COUNT(*)
       |
       v
POST /api/reports/preview { reportDefinition }
       |
       v
ReportQueryBuilder.ExecuteAsync(definition)
  1. Start with _db.Deals.AsQueryable()
     (EF Core global query filters apply -- tenant-scoped automatically)
  2. Apply filters via Expression<Func<Deal, bool>> building
  3. Execute query to get materialized results
  4. Compute formula fields in-memory via FormulaEvaluator
  5. Apply GroupBy + aggregation
  6. Project to ReportRow DTOs
       |
       v
Return paginated results with column metadata
```

#### Flow 4: Webhook Delivery with Retry

```
WebhookPublisher.EnqueueAsync("deal.updated", dealId, payload, tenantId)
       |
       v
BackgroundJob.Enqueue(() => webhookDeliveryService.DeliverAsync(subscriptionId, eventType, payload))
       |
       v
[Hangfire executes immediately:]
WebhookDeliveryService.DeliverAsync(...)
  1. Load subscription (URL, secret, headers)
  2. Sign payload with HMAC-SHA256 using subscription secret
  3. POST to target URL via IHttpClientFactory ("WebhookClient")
     - Polly pipeline: 3 immediate retries with jitter for transient HTTP errors
  4. If 2xx response: log as Delivered
  5. If non-2xx after Polly retries: throw exception
     -> Hangfire auto-retries the job with backoff (attempt 2, 3, ... up to 7)
     -> After 7 total failures: moves to Hangfire failed queue (dead letter)
  6. Log all attempts to WebhookDeliveryLog for admin visibility
```

## New Domain Entities

### Workflow Automation Entities

```csharp
// Domain/Entities/WorkflowDefinition.cs
public class WorkflowDefinition
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public string EntityType { get; set; }          // "Deal", "Contact", etc.
    public string TriggerType { get; set; }          // "Created", "Updated", "FieldChanged", "StageChanged"
    public Dictionary<string, object?> TriggerConfig { get; set; }  // JSONB: { "field": "stage", "from": "...", "to": "..." }
    public List<WorkflowCondition> Conditions { get; set; }         // JSON array in JSONB
    public List<WorkflowAction> Actions { get; set; }               // JSON array in JSONB
    public bool IsActive { get; set; }
    public int ExecutionOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

// Stored as JSONB within WorkflowDefinition
public class WorkflowCondition
{
    public string Field { get; set; }        // "value", "stage.name", "customFields.abc123"
    public string Operator { get; set; }     // "equals", "greaterThan", "contains", "changed", "changedTo"
    public object? Value { get; set; }
    public string? LogicalOperator { get; set; }  // "and", "or" for chaining
}

public class WorkflowAction
{
    public string ActionType { get; set; }   // "sendEmail", "createActivity", "updateField", "sendWebhook", "startSequence", "notify"
    public Dictionary<string, object?> Config { get; set; }  // Action-specific params as JSONB
    public int Order { get; set; }
}

// Domain/Entities/WorkflowExecutionLog.cs
public class WorkflowExecutionLog
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid WorkflowDefinitionId { get; set; }
    public string EntityType { get; set; }
    public Guid EntityId { get; set; }
    public string TriggerType { get; set; }
    public string Status { get; set; }       // "Success", "Failed", "Skipped"
    public string? ErrorMessage { get; set; }
    public Dictionary<string, object?>? ExecutionDetails { get; set; }  // JSONB
    public DateTimeOffset ExecutedAt { get; set; }
}
```

### Email Template & Sequence Entities

```csharp
// Domain/Entities/EmailTemplate.cs
public class EmailTemplate
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; }
    public string Subject { get; set; }          // Liquid template: "Hi {{contact.firstName}}"
    public string BodyHtml { get; set; }         // Liquid template with HTML
    public string? BodyText { get; set; }        // Plain text fallback
    public string EntityType { get; set; }       // "Contact", "Deal", etc.
    public string? Category { get; set; }        // "Welcome", "Follow-up", etc.
    public bool IsActive { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

// Domain/Entities/EmailSequence.cs
public class EmailSequence
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public string EntityType { get; set; }       // "Contact" (primary target)
    public bool IsActive { get; set; }
    public ICollection<EmailSequenceStep> Steps { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

// Domain/Entities/EmailSequenceStep.cs
public class EmailSequenceStep
{
    public Guid Id { get; set; }
    public Guid SequenceId { get; set; }
    public EmailSequence Sequence { get; set; }
    public int StepNumber { get; set; }
    public Guid EmailTemplateId { get; set; }
    public EmailTemplate EmailTemplate { get; set; }
    public int DelayDays { get; set; }           // Days to wait before sending
    public int DelayHours { get; set; }          // Additional hours
    public string? ConditionExpression { get; set; }  // Optional NCalc condition to skip step
}

// Domain/Entities/SequenceEnrollment.cs
public class SequenceEnrollment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SequenceId { get; set; }
    public Guid ContactId { get; set; }
    public int CurrentStep { get; set; }
    public string Status { get; set; }           // "Active", "Completed", "Paused", "Unsubscribed"
    public DateTimeOffset? NextStepAt { get; set; }
    public DateTimeOffset EnrolledAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public Guid? EnrolledByWorkflowId { get; set; }  // Track which workflow enrolled
    public string? HangfireJobId { get; set; }       // Track scheduled Hangfire job for cancellation
}

// Domain/Entities/SequenceStepLog.cs
public class SequenceStepLog
{
    public Guid Id { get; set; }
    public Guid EnrollmentId { get; set; }
    public int StepNumber { get; set; }
    public string Status { get; set; }           // "Sent", "Skipped", "Failed", "Opened", "Clicked"
    public string? ErrorMessage { get; set; }
    public DateTimeOffset ExecutedAt { get; set; }
}
```

### Formula/Computed Field Extension

```csharp
// Extend existing CustomFieldType enum
public enum CustomFieldType
{
    // ... existing values 0-8 ...
    Formula = 9       // NEW: computed from other fields
}

// Extend existing CustomFieldDefinition entity
// Add to CustomFieldDefinition:
//   public string? FormulaExpression { get; set; }  // NCalc expression: "{Value} * {Probability}"
//   public string? FormulaResultType { get; set; }  // "number", "text", "date", "currency"
//
// FormulaExpression uses {FieldName} for built-in fields
// and {cf:GUID} for other custom fields
```

### Duplicate Detection Entities

```csharp
// Domain/Entities/DuplicateCandidate.cs
public class DuplicateCandidate
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string EntityType { get; set; }       // "Contact", "Company"
    public Guid SourceEntityId { get; set; }     // The record being checked
    public Guid MatchEntityId { get; set; }      // The potential duplicate
    public decimal SimilarityScore { get; set; } // 0.0-1.0 from pg_trgm + FuzzySharp
    public string MatchedFields { get; set; }    // JSON: ["email", "firstName+lastName"]
    public string Status { get; set; }           // "Pending", "Merged", "Dismissed"
    public Guid? ResolvedById { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset DetectedAt { get; set; }
}

// Domain/Entities/DuplicateRule.cs
public class DuplicateRule
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string EntityType { get; set; }
    public string Name { get; set; }
    public List<DuplicateMatchField> MatchFields { get; set; }  // JSONB
    public decimal SimilarityThreshold { get; set; }             // Default 0.85
    public bool IsActive { get; set; }
    public bool CheckOnCreate { get; set; }
    public bool CheckOnImport { get; set; }
}

public class DuplicateMatchField
{
    public string FieldName { get; set; }    // "email", "firstName", "phone"
    public string MatchType { get; set; }    // "exact", "fuzzy", "normalized"
    public decimal Weight { get; set; }      // How much this field contributes to overall score
}
```

### Webhook Entities

```csharp
// Domain/Entities/WebhookSubscription.cs
public class WebhookSubscription
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; }
    public string TargetUrl { get; set; }
    public string Secret { get; set; }           // HMAC-SHA256 signing secret
    public List<string> EventTypes { get; set; } // ["deal.created", "contact.updated", ...]
    public bool IsActive { get; set; }
    public Dictionary<string, string>? Headers { get; set; }  // Custom headers
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

// Domain/Entities/WebhookDeliveryLog.cs
public class WebhookDeliveryLog
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SubscriptionId { get; set; }
    public string EventType { get; set; }
    public string Payload { get; set; }          // JSON payload
    public string Status { get; set; }           // "Pending", "Delivered", "Failed", "DeadLetter"
    public int AttemptCount { get; set; }
    public int? HttpStatusCode { get; set; }
    public string? ResponseBody { get; set; }    // First 1000 chars
    public string? ErrorMessage { get; set; }
    public string? HangfireJobId { get; set; }   // Track Hangfire job for monitoring
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
}
```

### Report Builder Entities

```csharp
// Domain/Entities/ReportDefinition.cs
public class ReportDefinition
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public string EntityType { get; set; }       // Primary entity
    public List<ReportColumn> Columns { get; set; }      // JSONB
    public List<ReportFilter> Filters { get; set; }      // JSONB
    public List<ReportSort> Sorts { get; set; }          // JSONB
    public ReportGrouping? Grouping { get; set; }        // JSONB
    public string? ChartType { get; set; }               // "bar", "line", "pie", null (table only)
    public Guid? OwnerId { get; set; }
    public bool IsShared { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class ReportColumn
{
    public string Field { get; set; }            // "title", "value", "stage.name", "customFields.GUID"
    public string Label { get; set; }
    public string? Aggregation { get; set; }     // "sum", "avg", "count", "min", "max", null
    public string? Format { get; set; }          // "currency", "percent", "date"
}

public class ReportFilter
{
    public string Field { get; set; }
    public string Operator { get; set; }         // "equals", "notEquals", "greaterThan", "contains", "in", "between"
    public object? Value { get; set; }
    public string? LogicalOperator { get; set; } // "and", "or"
}
```

## Integration Points With Each Clean Architecture Layer

### Domain Layer Changes

| Change | Type | Description |
|--------|------|-------------|
| New entities (12) | ADD | WorkflowDefinition, WorkflowExecutionLog, EmailTemplate, EmailSequence, EmailSequenceStep, SequenceEnrollment, SequenceStepLog, DuplicateCandidate, DuplicateRule, WebhookSubscription, WebhookDeliveryLog, ReportDefinition |
| CustomFieldType.Formula | MODIFY | Add Formula = 9 to existing enum |
| CustomFieldDefinition | MODIFY | Add FormulaExpression, FormulaResultType nullable properties |
| New enums | ADD | WorkflowTriggerType, WorkflowActionType, SequenceStatus, WebhookEventType, DuplicateStatus |
| New interfaces | ADD | IWorkflowRepository, IEmailTemplateRepository, IEmailSequenceRepository, IDuplicateRepository, IWebhookRepository, IReportRepository |
| IDomainEventHandler | ADD | Interface for event handling: `Task HandleAsync(DomainEvent event)` |

### Application Layer Changes

| Change | Type | Description |
|--------|------|-------------|
| IFormulaEvaluator | ADD | Abstraction: `object? Evaluate(string expression, Dictionary<string, object?> context)` |
| IWorkflowEngine | ADD | Abstraction: `Task EvaluateTriggersAsync(DomainEvent event)` |
| IDuplicateDetector | ADD | Abstraction: `Task<List<DuplicateCandidate>> FindDuplicatesAsync(string entityType, Dictionary<string, object?> entityData)` |
| IWebhookPublisher | ADD | Abstraction: `Task EnqueueAsync(string eventType, Guid entityId, object payload)` |
| IEmailTemplateRenderer | ADD | Abstraction: `Task<RenderedEmail> RenderAsync(string subjectTemplate, string bodyTemplate, Dictionary<string, object?> context)` |
| IReportQueryBuilder | ADD | Abstraction: `Task<ReportResult> ExecuteAsync(ReportDefinition definition)` |

### Infrastructure Layer Changes

| Change | Type | Description |
|--------|------|-------------|
| DomainEventInterceptor | ADD | SaveChangesInterceptor that detects entity changes and publishes domain events |
| WorkflowEngine | ADD | NCalc-based condition evaluation, Hangfire job dispatch for actions |
| FormulaEvaluator | ADD | NCalc expression evaluation against entity data |
| FluidEmailTemplateRenderer | ADD | Fluid (Liquid) template engine for user-defined templates |
| EmailSequenceService | ADD | Enrollment management, Hangfire delayed job scheduling for steps |
| DuplicateDetectionService | ADD | pg_trgm SQL queries + FuzzySharp composite scoring |
| WebhookDeliveryService | ADD | Polly-resilient HttpClient delivery with HMAC signing |
| WebhookPublisher | ADD | Enqueues Hangfire fire-and-forget jobs for webhook delivery |
| ReportQueryBuilder | ADD | Dynamic LINQ/EF Core query builder from ReportDefinition |
| Hangfire integration | ADD | `AddHangfire()` + `AddHangfireServer()` in DI, TenantJobFilter for multi-tenancy |
| Hangfire job classes (4) | ADD | WorkflowActionJob, WebhookDeliveryJob, SequenceStepJob, DuplicateScanJob |
| New EF Configurations (12) | ADD | One per new entity |
| ApplicationDbContext | MODIFY | Add 12 new DbSet properties, new global query filters |
| New Repositories (6) | ADD | One per new aggregate root |
| DependencyInjection | MODIFY | Register via AddWorkflowServices(), AddWebhookServices(), AddEmailTemplateServices(), AddDuplicateServices(), AddReportServices() |

### API Layer Changes

| Change | Type | Description |
|--------|------|-------------|
| WorkflowsController | ADD | CRUD for workflow definitions, execution logs, manual trigger |
| EmailTemplatesController | ADD | CRUD for templates, preview/render endpoint |
| EmailSequencesController | ADD | CRUD for sequences/steps, enrollment management |
| DuplicatesController | ADD | List candidates, merge, dismiss, configure rules |
| WebhooksController | ADD | CRUD for subscriptions, delivery logs, test endpoint |
| ReportBuilderController | ADD | CRUD for report definitions, preview/execute, export |
| Existing Controllers | MODIFY | DealsController etc. expose formula field values in DTOs |
| Program.cs | MODIFY | Add Hangfire server, map Hangfire dashboard at /hangfire (admin-only) |

### Frontend Changes

| Change | Type | Description |
|--------|------|-------------|
| `features/workflows/` | ADD | Workflow builder UI with trigger/condition/action configuration (@foblex/flow) |
| `features/email-templates/` | ADD | Template editor with Liquid syntax, preview, variable picker |
| `features/email-sequences/` | ADD | Sequence builder, enrollment list, step logs |
| `features/duplicates/` | ADD | Duplicate review queue, side-by-side comparison, merge UI |
| `features/webhooks/` | ADD | Subscription management, delivery log viewer, test UI |
| `features/reports/` | ADD | Visual report builder, column/filter/group configuration, chart preview |
| `core/custom-fields/` | MODIFY | Support Formula field type display (read-only, shows computed value) |
| `features/settings/` | MODIFY | Add admin sections for workflow, duplicate rules, webhook management |

## Patterns to Follow

### Pattern 1: Domain Event Interceptor

The centerpiece of v1.1. Intercepts `SaveChangesAsync` to detect entity changes and dispatch events. This reuses the existing interceptor pattern (see `AuditableEntityInterceptor`).

**What:** A `SaveChangesInterceptor` that captures `ChangeTracker` entries before save, then dispatches events after successful save.

**When:** Every `SaveChangesAsync` call on `ApplicationDbContext`.

**Why:** Ensures workflows, webhooks, and formula recalculation happen reliably without modifying every controller. Single integration point.

```csharp
// Infrastructure/Events/DomainEventInterceptor.cs
public class DomainEventInterceptor : SaveChangesInterceptor
{
    private readonly IServiceProvider _serviceProvider;
    private List<DomainEvent> _capturedEvents = new();

    // Capture changes BEFORE save (while ChangeTracker has original values)
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        var context = eventData.Context as ApplicationDbContext;
        if (context == null) return ValueTask.FromResult(result);

        _capturedEvents = CaptureEntityChanges(context.ChangeTracker);
        return ValueTask.FromResult(result);
    }

    // Dispatch events AFTER successful save
    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        if (_capturedEvents.Count == 0) return result;

        using var scope = _serviceProvider.CreateScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IDomainEventDispatcher>();

        foreach (var domainEvent in _capturedEvents)
        {
            // Fire-and-forget with error logging (same pattern as NotificationDispatcher)
            try { await dispatcher.DispatchAsync(domainEvent); }
            catch (Exception ex) { /* log, don't fail the save */ }
        }

        _capturedEvents.Clear();
        return result;
    }

    private List<DomainEvent> CaptureEntityChanges(ChangeTracker tracker)
    {
        var events = new List<DomainEvent>();
        foreach (var entry in tracker.Entries())
        {
            if (entry.Entity is not ITenantEntity tenantEntity) continue;

            var entityType = entry.Entity.GetType().Name;
            var changes = entry.State switch
            {
                EntityState.Added => new DomainEvent(entityType, "Created", tenantEntity.TenantId, ...),
                EntityState.Modified => CaptureFieldChanges(entry, entityType, tenantEntity.TenantId),
                EntityState.Deleted => new DomainEvent(entityType, "Deleted", tenantEntity.TenantId, ...),
                _ => null
            };

            if (changes != null) events.Add(changes);
        }
        return events;
    }
}
```

**Critical Design Decision:** Events are captured in `SavingChangesAsync` (while `ChangeTracker` still has `OriginalValues` for detecting what changed) but dispatched in `SavedChangesAsync` (after the entity is persisted). This ensures:
1. We know exactly which fields changed (old vs new values)
2. The entity is safely persisted before workflows/webhooks fire
3. Workflow actions that modify other entities use their own `SaveChangesAsync` call

### Pattern 2: Hangfire Job Dispatch for Async Actions

**What:** Workflow actions, webhook deliveries, and email sequence steps are enqueued as Hangfire jobs rather than executed inline.

**When:** Any action that involves external I/O (HTTP calls, email sending) or needs delayed execution.

**Why:** Decouples the API response time from action execution time. Provides automatic retry with backoff, persistence across app restarts, delayed scheduling for email sequences, and a monitoring dashboard for ops.

```csharp
// Infrastructure/Workflows/WorkflowEngine.cs
public class WorkflowEngine : IWorkflowEngine
{
    private readonly ApplicationDbContext _db;
    private readonly IBackgroundJobClient _hangfire;
    private readonly ILogger<WorkflowEngine> _logger;

    public async Task EvaluateTriggersAsync(DomainEvent domainEvent)
    {
        var workflows = await _db.WorkflowDefinitions
            .Where(w => w.IsActive && w.EntityType == domainEvent.EntityType
                        && w.TriggerType == domainEvent.TriggerType)
            .OrderBy(w => w.ExecutionOrder)
            .ToListAsync();

        foreach (var workflow in workflows)
        {
            if (!EvaluateConditions(workflow.Conditions, domainEvent))
            {
                LogExecution(workflow, domainEvent, "Skipped", "Conditions not met");
                continue;
            }

            foreach (var action in workflow.Actions.OrderBy(a => a.Order))
            {
                switch (action.ActionType)
                {
                    case "updateField":
                        // Quick action: execute inline
                        await ExecuteFieldUpdate(domainEvent, action.Config);
                        break;

                    case "sendEmail":
                        // Slow action: enqueue via Hangfire
                        _hangfire.Enqueue<WorkflowActionJob>(
                            j => j.SendEmailAsync(domainEvent.TenantId, workflow.Id,
                                domainEvent.EntityId, action.Config));
                        break;

                    case "sendWebhook":
                        _hangfire.Enqueue<WorkflowActionJob>(
                            j => j.FireWebhookAsync(domainEvent.TenantId, workflow.Id,
                                domainEvent.EntityId, action.Config));
                        break;

                    case "startSequence":
                        _hangfire.Enqueue<WorkflowActionJob>(
                            j => j.StartSequenceAsync(domainEvent.TenantId,
                                domainEvent.EntityId, action.Config));
                        break;
                }
            }

            LogExecution(workflow, domainEvent, "Success", null);
        }
    }

    private bool EvaluateConditions(List<WorkflowCondition> conditions, DomainEvent domainEvent)
    {
        // Use NCalc for condition evaluation
        // Build expression from conditions and evaluate against entity data
        // ...
    }
}
```

**Hangfire multi-tenancy:** Every Hangfire job receives `tenantId` as a parameter. A `TenantJobFilter` (Hangfire `IServerFilter`) sets the tenant context before job execution:

```csharp
// Infrastructure/Hangfire/TenantJobFilter.cs
public class TenantJobFilter : IServerFilter
{
    public void OnPerforming(PerformingContext context)
    {
        // Extract tenantId from job arguments
        // Set ITenantProvider context for the scoped DI container
        // This enables EF Core global query filters inside jobs
    }
}
```

### Pattern 3: Formula Field Evaluation with NCalc

**What:** Formula custom fields are evaluated server-side using NCalc expressions. Values are computed on-read (not stored), keeping JSONB `custom_fields` free of stale data.

**When:** Any GET request that returns entity data with formula fields.

**Why:** Formulas depend on other field values that may have changed. Computing on-read guarantees freshness. NCalc provides safe sandboxed evaluation with no code injection risk.

```csharp
// Application layer (pure business logic, no infrastructure dependencies)
// FormulaEvaluator.cs
public class FormulaEvaluator : IFormulaEvaluator
{
    public object? Evaluate(string expression, Dictionary<string, object?> context)
    {
        var ncalcExpression = new Expression(TranslateFieldRefs(expression));

        // Register built-in fields as parameters
        foreach (var (key, value) in context)
        {
            ncalcExpression.Parameters[key] = value;
        }

        // Register custom functions (IF, CONCAT, DATEDIFF, etc.)
        ncalcExpression.EvaluateFunction += OnEvaluateFunction;

        return ncalcExpression.Evaluate();
    }

    // Translate {FieldName} syntax to NCalc [FieldName] parameter syntax
    private string TranslateFieldRefs(string expression)
    {
        return Regex.Replace(expression, @"\{(\w+)\}", "[$1]");
    }

    private void OnEvaluateFunction(string name, FunctionArgs args)
    {
        switch (name.ToUpperInvariant())
        {
            case "IF":
                args.Result = (bool)args.Parameters[0].Evaluate()
                    ? args.Parameters[1].Evaluate()
                    : args.Parameters[2].Evaluate();
                break;
            case "CONCAT":
                args.Result = string.Join("", args.Parameters.Select(p => p.Evaluate()?.ToString()));
                break;
            case "DATEDIFF":
                var d1 = Convert.ToDateTime(args.Parameters[0].Evaluate());
                var d2 = Convert.ToDateTime(args.Parameters[1].Evaluate());
                args.Result = (d2 - d1).TotalDays;
                break;
            // TODAY(), NOW(), ROUND(), UPPER(), LOWER(), etc.
        }
    }
}
```

**Evaluation context includes:**
- Built-in entity fields (Value, Probability, CreatedAt, etc.)
- Other custom field values from the same entity's JSONB
- Related entity fields (e.g., `company.industry` for a Contact formula)

### Pattern 4: Liquid Templates with Fluid

**What:** User-created email templates use Liquid syntax (via the Fluid library). This coexists with the existing `RazorEmailRenderer` used for system emails.

**When:** Rendering workflow email actions and email sequence steps.

**Why:** Liquid is safe (no code execution), user-friendly, and the Fluid library is the fastest .NET implementation. Existing Razor templates continue to serve system emails (verification, password reset, invitations).

```csharp
// Infrastructure/Email/FluidEmailTemplateRenderer.cs
public class FluidEmailTemplateRenderer : IEmailTemplateRenderer
{
    private readonly FluidParser _parser = new();

    public async Task<RenderedEmail> RenderAsync(string subjectTemplate, string bodyTemplate,
        Dictionary<string, object?> context)
    {
        if (!_parser.TryParse(subjectTemplate, out var subjectFluid, out var subjectError))
            throw new TemplateParseException($"Subject template error: {subjectError}");

        if (!_parser.TryParse(bodyTemplate, out var bodyFluid, out var bodyError))
            throw new TemplateParseException($"Body template error: {bodyError}");

        var templateContext = new TemplateContext();
        foreach (var (key, value) in context)
        {
            templateContext.SetValue(key, FluidValue.Create(value, templateContext.Options));
        }

        // Register custom filters (currency formatting, date formatting, etc.)
        templateContext.Options.Filters.AddFilter("currency", CurrencyFilter);

        return new RenderedEmail
        {
            Subject = await subjectFluid.RenderAsync(templateContext),
            BodyHtml = await bodyFluid.RenderAsync(templateContext)
        };
    }
}
```

**Template variable convention:**
```liquid
Hi {{contact.firstName}},

Your deal "{{deal.title}}" worth {{deal.value | currency}} has moved to {{deal.stage}}.

{% if deal.probability > 0.8 %}
This deal is looking great!
{% endif %}
```

**Context building for templates:** A `TemplateContextBuilder` service assembles the variable dictionary for any entity type:
- `contact.*` - Contact fields (firstName, lastName, email, company.name, etc.)
- `deal.*` - Deal fields (title, value, stage, probability, owner.name, etc.)
- `company.*` - Company fields (name, domain, industry, etc.)
- `user.*` - Current user / workflow owner
- `org.*` - Organization/tenant name, settings

### Pattern 5: Two-Tier Duplicate Detection (pg_trgm + FuzzySharp)

**What:** Use PostgreSQL's `pg_trgm` extension for fast database-level candidate pre-filtering, then FuzzySharp for nuanced in-memory scoring and ranking.

**When:** On entity creation (real-time check) and on-demand batch scanning via Hangfire.

**Why:** pg_trgm runs entirely in PostgreSQL with GIN index support. FuzzySharp adds weighted multi-field scoring for accurate ranking. Two tiers avoid loading all records into memory.

```sql
-- Migration: Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram indexes on key contact fields
CREATE INDEX idx_contacts_email_trgm ON contacts USING gin (email gin_trgm_ops);
CREATE INDEX idx_contacts_name_trgm ON contacts
    USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX idx_companies_name_trgm ON companies USING gin (name gin_trgm_ops);
```

```csharp
// Infrastructure/Duplicates/DuplicateDetectionService.cs
public class DuplicateDetectionService : IDuplicateDetector
{
    public async Task<List<DuplicateCandidate>> FindDuplicatesAsync(
        string entityType, Guid sourceId, Dictionary<string, object?> entityData, Guid tenantId)
    {
        // Tier 1: pg_trgm database pre-filter (returns ~10-50 candidates)
        var candidates = await ExecuteTrgmQuery(entityType, sourceId, entityData, tenantId);

        // Tier 2: FuzzySharp composite scoring
        var scored = candidates.Select(c => new DuplicateCandidate
        {
            SourceEntityId = sourceId,
            MatchEntityId = c.Id,
            SimilarityScore = ComputeWeightedScore(entityData, c),
            MatchedFields = GetMatchedFields(entityData, c),
            // ...
        })
        .Where(c => c.SimilarityScore >= 0.7m)
        .OrderByDescending(c => c.SimilarityScore)
        .Take(10)
        .ToList();

        return scored;
    }

    private decimal ComputeWeightedScore(Dictionary<string, object?> source, CandidateRecord match)
    {
        decimal score = 0;
        // Email: 30% weight, exact or fuzzy
        if (source.TryGetValue("email", out var email) && email != null)
            score += 0.3m * (Fuzz.Ratio(email.ToString(), match.Email) / 100m);

        // Name: 40% weight, token sort for "John Smith" vs "Smith, John"
        score += 0.4m * (Fuzz.TokenSortRatio(source["name"]?.ToString(), match.Name) / 100m);

        // Phone: 20% weight, normalized comparison
        // Company: 10% weight
        return score;
    }
}
```

### Pattern 6: Dynamic Report Query Building

**What:** Translate JSON report definitions into EF Core IQueryable chains using Expression Trees.

**When:** Report preview and execution endpoints.

**Why:** Keeps reports within the existing tenant isolation (EF Core global query filters + RLS apply automatically). No raw SQL leaves the server boundary.

```csharp
// Infrastructure/Reporting/ReportQueryBuilder.cs
public class ReportQueryBuilder : IReportQueryBuilder
{
    private readonly ApplicationDbContext _db;
    private readonly IFormulaEvaluator _formulaEvaluator;
    private readonly ICustomFieldRepository _customFieldRepository;

    public async Task<ReportResult> ExecuteAsync(ReportDefinition definition)
    {
        // 1. Get base queryable for entity type
        //    (EF Core global query filters apply automatically -- tenant-scoped)
        var entityType = definition.EntityType;

        // 2. Build dynamic filter expressions
        var filters = BuildFilterExpressions(definition.Filters, entityType);

        // 3. Apply filters to queryable
        // 4. Execute query to materialize results
        // 5. Compute formula fields in-memory via FormulaEvaluator
        // 6. Apply grouping + aggregation
        // 7. Apply sorting
        // 8. Return paginated ReportResult with column metadata

        // For simple aggregations (COUNT, SUM, AVG over built-in fields),
        // push to database via EF Core GroupBy/Select projections
        // (same approach as DashboardAggregationService)

        // For formula fields in aggregations, must materialize first,
        // compute formulas, then aggregate in-memory
    }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous Workflow Execution in Request Pipeline

**What:** Executing all workflow actions (send email, create activity, fire webhook) inside the HTTP request handler before returning the response.

**Why bad:** If a workflow sends 5 emails and fires 3 webhooks, the API response could take 10+ seconds. External service failures would cause 500 errors for simple CRUD operations.

**Instead:** Domain events trigger workflow evaluation. Quick actions (update a field) happen synchronously. Slow actions (send email, fire webhook) are enqueued as Hangfire jobs. The API response returns immediately after the entity save.

### Anti-Pattern 2: Storing Formula Results in JSONB

**What:** Computing formula field values and saving them back to the `custom_fields` JSONB column alongside user-entered values.

**Why bad:** Formula values become stale when dependent fields change. You would need to track every dependency and trigger recalculation cascades. The JSONB would grow with computed data that has no user-authored source of truth.

**Instead:** Compute formula fields on-read. The `FormulaExpression` lives in `CustomFieldDefinition`. When an entity is fetched, evaluate formulas against current field values and include the result in the DTO. Formula fields are never written to JSONB.

### Anti-Pattern 3: N+1 Duplicate Checks

**What:** Checking for duplicates by loading every record in the entity table and comparing in C# code.

**Why bad:** For a tenant with 50,000 contacts, this means loading 50K records into memory for every new contact creation. Extremely slow and memory-intensive.

**Instead:** Use pg_trgm similarity queries that run entirely in PostgreSQL with GIN indexes. The database engine handles the fuzzy matching in a single indexed query, returning only the top N candidates. FuzzySharp scoring runs only on the pre-filtered candidates (10-50 records).

### Anti-Pattern 4: Storing Report SQL as User-Authored Strings

**What:** Letting users write raw SQL or allowing the report builder to generate arbitrary SQL strings that are executed directly.

**Why bad:** SQL injection risk. Bypasses tenant isolation (EF Core query filters and RLS). Difficult to validate and secure.

**Instead:** Report definitions are structured JSON (entity type, columns, filters, grouping). The `ReportQueryBuilder` translates these into EF Core IQueryable chains, which automatically apply tenant filters. No raw SQL leaves the server boundary.

### Anti-Pattern 5: Mixing Hangfire and BackgroundService for New Features

**What:** Using some `BackgroundService` polling loops alongside Hangfire for new v1.1 features, creating two parallel job processing systems.

**Why bad:** Increases operational complexity, makes monitoring harder, splits retry logic between two systems, and creates confusion about where to put new background work.

**Instead:** All new v1.1 background processing uses Hangfire exclusively. Existing `BackgroundService` implementations (`DueDateNotificationService`, `EmailSyncBackgroundService`) continue unchanged -- they are simple periodic tasks that predate Hangfire and work fine. Future enhancements may migrate them to Hangfire recurring jobs, but that is not a v1.1 priority.

## Tenant Isolation for New Entities

All 12 new entities follow the existing triple-layer isolation pattern:

1. **Entity property:** Every new entity has `Guid TenantId`.
2. **EF Core global query filter:** Added to `ApplicationDbContext.OnModelCreating()` using the same `_tenantProvider` pattern.
3. **PostgreSQL RLS:** Add policies in `scripts/rls-setup.sql` for each new table.

Child entities (WorkflowCondition/WorkflowAction stored as JSONB, EmailSequenceStep via SequenceId FK, SequenceStepLog via EnrollmentId FK) inherit isolation through their parent's filter -- consistent with existing patterns (e.g., DealContact, QuoteLineItem).

**Hangfire job tenant isolation:** Hangfire jobs run outside the HTTP request pipeline, so there is no Finbuckle tenant context. The `TenantJobFilter` sets the tenant context from the `tenantId` job parameter before execution, mirroring the pattern in `DueDateNotificationService` (which uses `IgnoreQueryFilters()` and passes explicit tenantId).

## Hangfire Integration Architecture

### Registration in Program.cs

```csharp
// Program.cs additions
builder.Services.AddHangfire(config => config
    .UsePostgreSqlStorage(connectionString, new PostgreSqlStorageOptions
    {
        SchemaName = "hangfire"  // Separate schema from CRM data
    })
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings());

builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = Environment.ProcessorCount * 2;
    options.Queues = new[] { "default", "webhooks", "emails", "workflows" };
});

// Map dashboard (admin only)
app.MapHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new HangfireAdminAuthFilter() }
});
```

### Job Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `default` | General workflow actions, duplicate scans | Default |
| `webhooks` | Webhook delivery (may have slow external endpoints) | Higher concurrency |
| `emails` | Email sending (workflow emails, sequence steps) | Moderate |
| `workflows` | Workflow evaluation for scheduled/date-based triggers | Default |

### Recurring Jobs

```csharp
// Date-based workflow trigger evaluation (check conditions like "3 days before close date")
RecurringJob.AddOrUpdate<WorkflowDateTriggerJob>(
    "workflow-date-triggers",
    j => j.EvaluateDateTriggersAsync(),
    "*/15 * * * *");  // Every 15 minutes

// Batch duplicate scan (full-table scan for existing duplicates)
RecurringJob.AddOrUpdate<DuplicateScanJob>(
    "duplicate-batch-scan",
    j => j.ScanAllTenantsAsync(),
    "0 2 * * *");  // Daily at 2 AM
```

## Migration Strategy

### Database Migrations

```
Migration 1: AddHangfireSchema
  - Hangfire auto-creates its tables in the 'hangfire' schema
  - No manual migration needed, but document it

Migration 2: AddEmailTemplateEntities
  - email_templates, email_sequences, email_sequence_steps
  - sequence_enrollments, sequence_step_logs
  - Global query filters

Migration 3: AddFormulaFieldSupport
  - ALTER custom_field_definitions ADD formula_expression text NULL, formula_result_type text NULL
  - No new tables, extends existing entity

Migration 4: AddWorkflowEntities
  - workflow_definitions (with JSONB columns for conditions, actions, trigger_config)
  - workflow_execution_logs
  - Global query filters

Migration 5: AddDuplicateDetection
  - CREATE EXTENSION IF NOT EXISTS pg_trgm
  - duplicate_rules, duplicate_candidates
  - GIN trigram indexes on contacts (email, name), companies (name)

Migration 6: AddWebhookEntities
  - webhook_subscriptions (with JSONB for event_types, headers)
  - webhook_delivery_logs
  - Index on (status, created_at) for monitoring queries

Migration 7: AddReportBuilder
  - report_definitions (with JSONB for columns, filters, sorts, grouping)

Migration 8: UpdateRlsPolicies
  - RLS policies for all new tables in scripts/rls-setup.sql
```

### NuGet Packages Required

```xml
<!-- Infrastructure layer -->
<PackageReference Include="Hangfire.AspNetCore" Version="1.8.23" />
<PackageReference Include="Hangfire.PostgreSql" Version="1.21.1" />
<PackageReference Include="Fluid.Core" Version="2.31.0" />
<PackageReference Include="Polly" Version="8.6.5" />
<PackageReference Include="Microsoft.Extensions.Http.Polly" Version="10.0.3" />
<PackageReference Include="FuzzySharp" Version="2.0.2" />

<!-- Application layer -->
<PackageReference Include="NCalcSync" Version="5.11.0" />
```

**Note:** Microsoft.RulesEngine was considered for workflow condition evaluation but is **not recommended**. Its JSON schema is overly complex for CRM workflow conditions (which are simple field comparisons). Instead, use NCalc for condition evaluation -- the same dependency used for formula fields. Workflow conditions translate naturally to NCalc expressions: `[value] > 10000 && [stage] == 'Won'`. This keeps the dependency count low and the condition evaluation consistent across features.

## Build Order (Feature Dependencies)

```
Phase 1: Foundation (Hangfire + Email Templates + Formula Fields)
  - Add Hangfire infrastructure (shared by all subsequent features)
  - Email templates: Fluid renderer, CRUD, preview
  - Formula fields: NCalc evaluator, CustomFieldType.Formula, on-read evaluation
  - No dependencies on other v1.1 features
  - Email templates needed by workflows and sequences
  - Formula fields needed by reporting

Phase 2: Domain Events + Workflow Automation Engine
  - Depends on: Phase 1 (Hangfire for action dispatch, email templates for "send email" action)
  - DomainEventInterceptor, WorkflowEngine, WorkflowActionJob
  - Workflow builder UI (@foblex/flow)
  - This is the largest and most complex phase

Phase 3: Email Sequences
  - Depends on: Phase 1 (email templates for step content, Hangfire for delayed scheduling)
  - Optional: Phase 2 (workflows can trigger "start sequence" action)
  - EmailSequenceService, SequenceStepJob, enrollment management

Phase 4: Webhooks
  - Depends on: Phase 1 (Hangfire for delivery jobs), Phase 2 (domain events trigger webhooks)
  - WebhookPublisher, WebhookDeliveryService (Polly), delivery logs

Phase 5: Duplicate Detection & Merge
  - Depends on: Phase 2 (domain events for on-create checking)
  - pg_trgm extension + FuzzySharp, DuplicateDetectionService
  - Most complex merge logic (combining records, reassigning FKs)
  - Hangfire recurring job for batch scanning

Phase 6: Advanced Reporting Builder
  - Depends on: Phase 1 (formula fields for computed columns in reports)
  - Extends: Existing DashboardAggregationService patterns
  - ReportQueryBuilder, report builder UI
```

**Rationale:** Phase 1 installs Hangfire and the two leaf dependencies (email templates, formula fields) that every other feature uses. Workflows are Phase 2 because they are the orchestration layer connecting everything. Sequences and Webhooks are relatively independent after that. Duplicate Detection has the most complex data mutation (merge). Reporting comes last because it benefits from all other data being in place and can reference formula fields.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Workflow evaluation | Inline in interceptor, Hangfire for actions | Same, increase Hangfire worker count | Dedicated Hangfire worker servers |
| Webhook delivery | Hangfire fire-and-forget with Polly | Increase "webhooks" queue workers | Separate webhook service + message queue |
| Formula evaluation | On-read per request | Cache formula results in-memory (tenant-scoped) | Materialized formula columns in PostgreSQL |
| Duplicate detection | On-create via pg_trgm | On-create + nightly Hangfire batch scan | Dedicated dedup worker + bloom filter pre-screen |
| Report execution | Direct EF Core query | Query timeout limits + result caching | Pre-aggregated materialized views |
| Email sequences | Hangfire delayed jobs | Same, no polling needed | Separate Hangfire server for email queue |

**Current target: 100-10K users.** The architecture above handles this range. Hangfire scales horizontally by adding worker servers against the same PostgreSQL storage. The domain/application layer interfaces remain unchanged when scaling.

## Sources

- [NCalc Expression Evaluator](https://github.com/ncalc/ncalc) - Recommended for formula evaluation and workflow conditions
- [Fluid Template Engine](https://github.com/sebastienros/fluid) - Recommended for Liquid email templates
- [Hangfire Documentation](https://docs.hangfire.io/en/latest/) - Background job processing with PostgreSQL storage
- [PostgreSQL pg_trgm Documentation](https://www.postgresql.org/docs/current/pgtrgm.html) - Fuzzy matching for duplicate detection
- [FuzzySharp](https://github.com/JakeBayer/FuzzySharp) - In-memory fuzzy string matching for duplicate scoring
- [Polly Documentation](https://www.pollydocs.org/) - Resilient HTTP for webhook delivery
- [Outbox Pattern in ASP.NET Core](https://www.milanjovanovic.tech/blog/implementing-the-outbox-pattern) - Webhook delivery reliability pattern
- [Webhook Delivery Best Practices](https://developersvoice.com/blog/dotnet/scalable_webhook_delivery_security_asp_net_core/) - Retry, signing, architecture
- [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html) - JSONB querying for report builder
- [Dynamic Query Building with EF Core Expression Trees](https://en.ittrip.xyz/c-sharp/dynamic-query-builder-cs) - Report query building approach
- [Microsoft RulesEngine](https://github.com/microsoft/RulesEngine) - Evaluated but not recommended (too complex for CRM conditions)
- [@foblex/flow](https://flow.foblex.com/) - Angular flow-based UI for workflow builder
