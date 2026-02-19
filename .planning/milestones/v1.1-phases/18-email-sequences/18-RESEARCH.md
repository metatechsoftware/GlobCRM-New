# Phase 18: Email Sequences - Research

**Researched:** 2026-02-19
**Domain:** Automated email drip campaigns with scheduling, enrollment management, tracking, and reply detection
**Confidence:** HIGH

## Summary

Phase 18 builds email sequences on top of well-established infrastructure from prior phases: Hangfire with PostgreSQL storage for delayed job scheduling (Phase 14), Email Templates with Liquid merge fields for step content (Phase 14), Gmail API integration with MimeKit for sending (Phase 7), and Gmail sync for reply detection (Phase 7). The domain model centers on three new entities: `EmailSequence` (the campaign definition), `EmailSequenceStep` (individual steps with template references and delay config), and `SequenceEnrollment` (per-contact enrollment state machine tracking progress through steps).

The core scheduling pattern follows the existing `WebhookDeliveryService` approach: Hangfire `Schedule` with `TimeSpan` delays, manual retry management, and `TenantScope` for background job tenant context. Email tracking (opens/clicks) requires a new lightweight API controller that serves a transparent 1x1 pixel (opens) and handles link redirect (clicks), writing events to a `SequenceTrackingEvent` table. Reply detection leverages custom `X-Sequence-Id` and `X-Sequence-Step-Id` headers injected via MimeKit on outbound sequence emails, matched during Gmail sync on inbound messages.

**Primary recommendation:** Follow the existing feature patterns exactly (Domain entity, EF Configuration, Repository, Controller with co-located DTOs, Angular feature module with Signal Store). The main novel work is the sequence execution engine (a Hangfire job service that advances enrollments through steps), the tracking pixel/link infrastructure, and the reply detection hook in GmailSyncService.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Vertical step list layout (not visual timeline) -- clean list with drag-to-reorder, each step shows template name, delay, and collapse/expand for details (HubSpot-style)
- Delays configured as days + preferred time of day (e.g., "Wait 2 days, send at 9:00 AM")
- Each step selects from saved email templates with a rendered preview shown inline; quick "edit template" link opens template editor in new tab
- Optional subject line override per step -- defaults to template subject but allows per-step override for sequence-specific messaging
- Single enrollment available from BOTH contact detail page (actions menu) AND sequence detail page ("Add Contacts" button with contact picker/search dialog)
- Bulk enrollment from contacts list via multi-select; confirmation dialog shows count and skips already-enrolled contacts with a note ("3 already enrolled, will be skipped")
- Pause/resume via row-level toggle on each enrollment PLUS multi-select checkboxes for bulk pause/resume from the enrollment list
- A contact can be enrolled in multiple sequences simultaneously; enrollment dialog warns if already in other sequences but doesn't block
- Reply detection via custom email headers (In-Reply-To, References, or custom X-Sequence-Id header) to identify replies to sequence emails -- more precise than thread-based matching
- On auto-unenroll: in-app notification ("John Smith replied to Step 2 of Onboarding Sequence and was unenrolled") PLUS a "Replied" status badge on the enrollment row
- Re-enrollment allowed from any step -- user can choose to start from beginning, where they left off, or a specific step
- Built-in open/click tracking: tracking pixel for opens, link-wrapped URLs for clicks, handled transparently when sequence emails are sent
- Sequence detail page: summary metric cards (Total Enrolled, Active, Completed, Replied, Bounced) PLUS a visual funnel chart showing drop-off from step 1 through completion
- Funnel visualization shows where contacts fall off across the sequence steps

### Claude's Discretion
- Bounce handling strategy (auto-unenroll on hard bounce vs. flag and continue)
- Per-step metrics display approach (inline vs. expandable detail panel)
- Sequence list page metric density (key columns vs. minimal)
- Loading skeleton and empty state designs
- Exact tracking pixel and link wrapping implementation details
- Step reorder animation and drag handle design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ESEQ-01 | User can create a multi-step email sequence with configurable delays between steps | Domain entities (EmailSequence, EmailSequenceStep), EF Configuration, CRUD controller, Angular sequence-builder component with CDK drag-drop for step reordering |
| ESEQ-02 | User can manually enroll contacts into a sequence | SequenceEnrollment entity, enrollment API endpoints, contact picker dialog on sequence detail page, "Enroll in Sequence" action on contact detail page |
| ESEQ-03 | User can bulk-enroll contacts from a list view multi-select | New row selection capability in DynamicTable (SelectionModel from @angular/cdk/collections), bulk enrollment API endpoint, confirmation dialog with skip-already-enrolled logic |
| ESEQ-04 | Contacts are automatically unenrolled when they reply to a sequence email | Custom X-Sequence-Id/X-Sequence-Step-Id headers injected via MimeKit, reply detection hook in GmailSyncService matching headers on inbound messages, auto-unenroll + notification dispatch |
| ESEQ-05 | User can view per-step tracking (open rate, click rate) for each sequence | SequenceTrackingEvent table, tracking pixel endpoint (1x1 transparent GIF), link-wrapping service, per-step aggregation queries |
| ESEQ-06 | User can view sequence-level analytics (enrolled, completed, replied, bounced) | Aggregation endpoint querying SequenceEnrollment statuses, summary metric cards, funnel chart using existing Chart.js/ng2-charts |
| ESEQ-07 | User can pause/resume individual enrollments | Enrollment status field (Active/Paused/Completed/Replied/Bounced/Unenrolled), pause/resume API endpoints, execution engine checks status before sending |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hangfire.AspNetCore | 1.8.18 | Delayed job scheduling for sequence step execution | Already configured with PostgreSQL storage, tenant context propagation via TenantJobFilter, "emails" queue exists |
| Fluid.Core | 2.12.0 | Liquid template rendering for merge fields | Already used by TemplateRenderService for email template personalization |
| MimeKit | 4.15.0 | RFC-compliant email construction with custom headers | Already used by GmailSendService; supports custom header injection for X-Sequence-Id |
| Google.Apis.Gmail.v1 | 1.73.0.4029 | Gmail send and sync API | Already used for email sending and sync; reply detection hooks into existing GmailSyncService |
| @angular/cdk | 19.2.19 | Drag-drop for step reordering, SelectionModel for bulk select | Already installed; CdkDrag/CdkDropList used in pipeline-edit and kanban components |
| chart.js + ng2-charts | 4.5.1 / 8.0.0 | Funnel chart visualization for sequence analytics | Already installed and used in dashboard chart widgets |
| @angular/material | 19.2.19 | UI components (cards, buttons, dialogs, menus, toggles) | Already the project's component library |
| @ngrx/signals | 19.2.1 | Signal Store for sequence state management | Already used for all feature stores |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SendGrid | 9.29.3 | Fallback email sending (if no Gmail account connected) | Sequence emails for users without Gmail integration |
| Hangfire.PostgreSql | 1.21.1 | Job storage | Already configured; no additional setup needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hangfire Schedule per-step | Recurring job checking all pending steps | Per-step Schedule is more precise, avoids polling overhead, follows existing WebhookDeliveryService pattern |
| Chart.js funnel | Custom SVG funnel | Chart.js already installed; chartjs-plugin-funnel exists but not needed -- a horizontal bar chart with decreasing values is simpler and equally effective |
| Custom tracking pixel endpoint | Third-party tracking service | Custom endpoint is simpler, keeps data in-house, avoids external dependency |

**Installation:**
```bash
# No new packages needed - everything is already installed
```

## Architecture Patterns

### Recommended Project Structure

#### Backend
```
src/GlobCRM.Domain/
├── Entities/
│   ├── EmailSequence.cs              # Sequence definition (name, status, owner)
│   ├── EmailSequenceStep.cs          # Step definition (template ref, delay, order, subject override)
│   ├── SequenceEnrollment.cs         # Per-contact enrollment (state machine)
│   └── SequenceTrackingEvent.cs      # Open/click/bounce events
├── Enums/
│   ├── SequenceStatus.cs             # Draft, Active, Paused, Archived
│   └── EnrollmentStatus.cs           # Active, Paused, Completed, Replied, Bounced, Unenrolled
├── Interfaces/
│   ├── IEmailSequenceRepository.cs
│   └── ISequenceEnrollmentRepository.cs

src/GlobCRM.Infrastructure/
├── Persistence/Configurations/
│   ├── EmailSequenceConfiguration.cs
│   ├── EmailSequenceStepConfiguration.cs
│   ├── SequenceEnrollmentConfiguration.cs
│   └── SequenceTrackingEventConfiguration.cs
├── Persistence/Repositories/
│   ├── EmailSequenceRepository.cs
│   └── SequenceEnrollmentRepository.cs
├── Sequences/
│   ├── SequenceExecutionService.cs    # Hangfire job: advance enrollment to next step
│   ├── SequenceEmailSender.cs         # Renders template, injects tracking, sends via Gmail
│   ├── EmailTrackingService.cs        # Tracking pixel/link generation and URL rewriting
│   ├── SequenceReplyDetector.cs       # Called by GmailSyncService on inbound messages
│   └── SequenceServiceExtensions.cs   # DI registration

src/GlobCRM.Api/Controllers/
├── SequencesController.cs             # CRUD + analytics + enrollment management
└── TrackingController.cs              # Tracking pixel/link redirect endpoints (no auth)
```

#### Frontend
```
globcrm-web/src/app/features/sequences/
├── sequence-list/
│   ├── sequence-list.component.ts
│   └── sequence-list.component.html
├── sequence-detail/
│   ├── sequence-detail.component.ts
│   └── sequence-detail.component.html
├── sequence-builder/
│   ├── sequence-builder.component.ts  # Edit/create form with step list
│   ├── sequence-builder.component.html
│   ├── step-item.component.ts         # Individual step card (collapsible)
│   └── template-picker-dialog.component.ts
├── enrollment-dialog/
│   └── enrollment-dialog.component.ts # Contact picker + re-enrollment step picker
├── sequence-analytics/
│   └── sequence-analytics.component.ts # Funnel chart + metric cards
├── sequence.models.ts
├── sequence.service.ts
├── sequence.store.ts
└── sequences.routes.ts
```

### Pattern 1: Sequence Execution via Hangfire Scheduled Jobs
**What:** When a contact is enrolled, the first step is scheduled immediately (or at the preferred time). After each step executes, the next step is scheduled with the configured delay. Each step execution is an independent Hangfire job.
**When to use:** Every time a step completes and the enrollment is still Active.
**Example:**
```csharp
// Following WebhookDeliveryService pattern exactly
public class SequenceExecutionService
{
    public const string QueueName = "emails";

    [Queue(QueueName)]
    [AutomaticRetry(Attempts = 3)] // Use Hangfire retry for transient send failures
    public async Task ExecuteStepAsync(
        Guid enrollmentId, int stepNumber, Guid tenantId)
    {
        TenantScope.SetCurrentTenant(tenantId);

        var enrollment = await _enrollmentRepository.GetByIdAsync(enrollmentId);
        if (enrollment is null || enrollment.Status != EnrollmentStatus.Active)
            return; // Enrollment cancelled/paused/completed -- skip

        var step = await _sequenceRepository.GetStepAsync(
            enrollment.SequenceId, stepNumber);
        if (step is null) return;

        // Render template with contact merge data
        var contact = await _db.Contacts
            .Include(c => c.Company)
            .FirstOrDefaultAsync(c => c.Id == enrollment.ContactId);
        if (contact?.Email is null) return;

        var mergeData = await _mergeFieldService.ResolveEntityDataAsync(
            "contact", enrollment.ContactId);
        var template = await _templateRepository.GetByIdAsync(step.EmailTemplateId);

        var renderedHtml = await _renderService.RenderAsync(
            template.HtmlBody, new Dictionary<string, object?> { ["contact"] = mergeData });
        var subject = step.SubjectOverride ?? template.Subject ?? "No Subject";
        var renderedSubject = await _renderService.RenderAsync(
            subject, new Dictionary<string, object?> { ["contact"] = mergeData });

        // Inject tracking and custom headers, then send
        var trackedHtml = _trackingService.InjectTracking(
            renderedHtml, enrollment.Id, stepNumber);
        await _emailSender.SendSequenceEmailAsync(
            contact.Email, renderedSubject, trackedHtml,
            enrollment.Id, stepNumber, enrollment.SequenceId);

        // Update enrollment progress
        enrollment.CurrentStepNumber = stepNumber;
        enrollment.LastStepSentAt = DateTimeOffset.UtcNow;
        enrollment.StepsSent++;

        // Schedule next step (if exists)
        var nextStep = await _sequenceRepository.GetStepAsync(
            enrollment.SequenceId, stepNumber + 1);
        if (nextStep is not null)
        {
            var delay = CalculateDelay(nextStep.DelayDays, nextStep.PreferredSendTime);
            _jobClient.Schedule<SequenceExecutionService>(
                QueueName,
                svc => svc.ExecuteStepAsync(enrollmentId, stepNumber + 1, tenantId),
                delay);
        }
        else
        {
            enrollment.Status = EnrollmentStatus.Completed;
            enrollment.CompletedAt = DateTimeOffset.UtcNow;
        }

        await _enrollmentRepository.UpdateAsync(enrollment);
    }
}
```

### Pattern 2: Custom Header Injection for Reply Detection
**What:** Sequence emails include custom MIME headers (X-Sequence-Id, X-Sequence-Step-Id, X-Enrollment-Id) that survive email forwarding/reply chains. GmailSyncService checks inbound messages for these headers to detect replies.
**When to use:** Every outbound sequence email sent via GmailSendService.
**Example:**
```csharp
// In SequenceEmailSender - extends GmailSendService pattern
public async Task<EmailMessage> SendSequenceEmailAsync(
    string to, string subject, string htmlBody,
    Guid enrollmentId, int stepNumber, Guid sequenceId)
{
    var account = await GetActiveEmailAccount();
    var gmail = await _serviceFactory.CreateForAccountAsync(account);

    var mimeMessage = new MimeMessage();
    mimeMessage.From.Add(MailboxAddress.Parse(account.GmailAddress));
    mimeMessage.To.Add(MailboxAddress.Parse(to));
    mimeMessage.Subject = subject;
    mimeMessage.Body = new TextPart("html") { Text = htmlBody };

    // Inject custom headers for reply detection
    mimeMessage.Headers.Add("X-Sequence-Id", sequenceId.ToString());
    mimeMessage.Headers.Add("X-Sequence-Step-Id", stepNumber.ToString());
    mimeMessage.Headers.Add("X-Enrollment-Id", enrollmentId.ToString());

    // Standard Gmail API send...
}
```

### Pattern 3: Reply Detection Hook in GmailSyncService
**What:** After syncing an inbound message, check its In-Reply-To/References headers against sent sequence emails, or check if the message thread contains a message with X-Sequence-Id headers.
**When to use:** Called from GmailSyncService.SyncSingleMessageAsync after message entity is created.
**Example:**
```csharp
// In SequenceReplyDetector - called from GmailSyncService
public async Task CheckForSequenceReplyAsync(EmailMessage inboundMessage)
{
    if (!inboundMessage.IsInbound) return;

    // Strategy: Check if this message's thread contains a sent sequence email
    // by looking up the GmailThreadId in sent sequence email records
    var sequenceEmail = await _db.SequenceTrackingEvents
        .Where(e => e.GmailThreadId == inboundMessage.GmailThreadId
                  && e.EventType == "sent")
        .OrderByDescending(e => e.CreatedAt)
        .FirstOrDefaultAsync();

    if (sequenceEmail is null) return;

    var enrollment = await _enrollmentRepository.GetByIdAsync(
        sequenceEmail.EnrollmentId);
    if (enrollment is null || enrollment.Status != EnrollmentStatus.Active)
        return;

    // Auto-unenroll
    enrollment.Status = EnrollmentStatus.Replied;
    enrollment.RepliedAt = DateTimeOffset.UtcNow;
    enrollment.ReplyStepNumber = sequenceEmail.StepNumber;
    await _enrollmentRepository.UpdateAsync(enrollment);

    // Dispatch notification
    await _notificationDispatcher.DispatchAsync(new NotificationRequest
    {
        RecipientId = enrollment.CreatedByUserId,
        Type = NotificationType.SequenceReply,
        Title = "Sequence Reply Received",
        Message = $"{contact.FullName} replied to Step {sequenceEmail.StepNumber} of {sequence.Name} and was unenrolled",
        EntityType = "SequenceEnrollment",
        EntityId = enrollment.Id
    }, enrollment.TenantId);
}
```

### Pattern 4: Email Tracking (Open Pixel + Click Wrapping)
**What:** Before sending, rewrite HTML to include a tracking pixel and wrap links. Tracking endpoint is unauthenticated (email clients don't send auth tokens).
**When to use:** Every outbound sequence email.
**Example:**
```csharp
// TrackingController - no [Authorize] attribute
[ApiController]
[Route("api/t")]  // Short URL for tracking
public class TrackingController : ControllerBase
{
    // 1x1 transparent GIF pixel (43 bytes)
    private static readonly byte[] TransparentPixel = Convert.FromBase64String(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

    /// <summary>
    /// Tracking pixel endpoint - records an open event.
    /// URL: /api/t/o/{encodedToken}
    /// </summary>
    [HttpGet("o/{token}")]
    [ResponseCache(NoStore = true)]
    public async Task<IActionResult> TrackOpen(string token)
    {
        var (enrollmentId, stepNumber) = DecodeToken(token);
        await _trackingService.RecordOpenAsync(enrollmentId, stepNumber);

        return File(TransparentPixel, "image/gif");
    }

    /// <summary>
    /// Link click redirect - records click event, then redirects.
    /// URL: /api/t/c/{encodedToken}?u={encodedUrl}
    /// </summary>
    [HttpGet("c/{token}")]
    public async Task<IActionResult> TrackClick(string token, [FromQuery] string u)
    {
        var (enrollmentId, stepNumber) = DecodeToken(token);
        var decodedUrl = Uri.UnescapeDataString(u);
        await _trackingService.RecordClickAsync(enrollmentId, stepNumber, decodedUrl);

        return Redirect(decodedUrl);
    }
}
```

### Pattern 5: Funnel Chart Using Existing Chart.js
**What:** Use a horizontal bar chart with decreasing values to simulate a funnel visualization. Chart.js is already configured with ng2-charts.
**When to use:** Sequence detail page analytics section.
**Example:**
```typescript
// Following existing ChartWidgetComponent pattern
const funnelData: ChartData<'bar'> = {
  labels: ['Step 1: Welcome', 'Step 2: Follow-up', 'Step 3: Offer', 'Completed'],
  datasets: [{
    data: [120, 95, 68, 42],
    backgroundColor: ['#F97316', '#FB923C', '#FDBA74', '#FED7AA'],
    borderRadius: 4,
  }]
};

const funnelOptions: ChartOptions<'bar'> = {
  indexAxis: 'y',  // Horizontal bars
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true },
    y: { grid: { display: false } }
  }
};
```

### Anti-Patterns to Avoid
- **Polling-based execution:** Do NOT use a recurring Hangfire job that checks all pending enrollments. Instead, schedule individual jobs per step (like WebhookDeliveryService schedules retries). Polling wastes resources and has poor time precision.
- **Storing tracking data in EmailMessage:** Keep tracking events in a separate `SequenceTrackingEvent` table. EmailMessage is for Gmail sync, not sequence tracking.
- **Thread-based reply detection only:** Gmail thread IDs can group unrelated messages. The custom header approach (X-Sequence-Id) is more reliable. Use thread ID as a secondary matching strategy.
- **Authenticated tracking endpoints:** Email clients will not send auth tokens. The tracking controller MUST be unauthenticated with rate limiting and token validation instead.
- **Re-rendering templates at execution time from template ID only:** If a template is edited between enrollment and step execution, the contact gets the updated version. This could be unexpected. Store a snapshot of the template subject at enrollment time or accept "always latest" as a design choice. Recommendation: Use latest template version (standard CRM behavior, simpler, and users expect edits to propagate).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom drag implementation | `@angular/cdk/drag-drop` (CdkDrag, CdkDropList, moveItemInArray) | Already used in pipeline-edit and kanban components; handles accessibility, touch, animations |
| Funnel visualization | Custom SVG drawing | Chart.js horizontal bar chart via ng2-charts | Already configured in project; ChartWidgetComponent shows the pattern |
| Template rendering with merge fields | Custom string replacement | `TemplateRenderService` (Fluid/Liquid) | Already handles all entity types, custom fields, nested objects |
| Email sending with threading | Raw HTTP to Gmail | `GmailSendService` (MimeKit + Gmail API) | Already handles base64url encoding, thread management, contact linking |
| Delayed job scheduling | setTimeout/cron polling | Hangfire `IBackgroundJobClient.Schedule` | Already configured with PostgreSQL persistence, tenant context propagation, named queues |
| Tenant context in background jobs | Manual tenant resolution | `TenantJobFilter` + `TenantScope` | Already globally registered; automatically captures/restores tenant context |
| Row selection for bulk operations | Custom checkbox tracking | `SelectionModel` from `@angular/cdk/collections` | CDK provides toggle, select-all, isSelected, clear -- works with Angular signals |

**Key insight:** This phase's infrastructure is almost entirely built. The novel work is the domain model, the execution engine (job orchestration), the tracking endpoints, and the reply detection hook. Everything else follows existing patterns.

## Common Pitfalls

### Pitfall 1: Hangfire Job Serialization with Entity References
**What goes wrong:** Passing entity objects to Hangfire jobs fails because EF Core DbContext is disposed by the time the job runs.
**Why it happens:** Hangfire serializes job arguments to JSON. Entity objects with navigation properties cause circular reference or lazy-loading exceptions.
**How to avoid:** Only pass primitive IDs (Guid, int, string) to Hangfire jobs. Load entities fresh inside the job method using the repository. This is the pattern used by WebhookDeliveryService.
**Warning signs:** `ObjectDisposedException` or `JsonException` in Hangfire dashboard.

### Pitfall 2: Race Condition on Enrollment Status Checks
**What goes wrong:** A scheduled step job executes after the enrollment was paused/unenrolled, sending an email to a contact who shouldn't receive it.
**Why it happens:** The job was already in the Hangfire queue when the status changed.
**How to avoid:** Always re-check enrollment status at the START of every step execution job. If status != Active, skip silently. This is the same pattern as WebhookDeliveryService checking `subscription.IsActive`.
**Warning signs:** Contacts reporting emails after they were unenrolled.

### Pitfall 3: Tracking Pixel Blocked by Email Clients
**What goes wrong:** Open tracking shows 0% opens because email clients block images by default.
**Why it happens:** Gmail, Outlook, Apple Mail proxy/block tracking pixels for privacy.
**How to avoid:** Accept that open tracking will be approximate (typically 30-60% accuracy). Do NOT rely on open events for sequence logic (e.g., don't use "opened email" as a condition). Display open rates with a disclaimer or "(estimated)" label.
**Warning signs:** Open rate consistently at 0% or suspiciously at 100% (Apple Mail Privacy Protection pre-fetches all images).

### Pitfall 4: Time Zone Handling for Preferred Send Time
**What goes wrong:** "Send at 9:00 AM" sends at 9 AM UTC instead of the user's or contact's local time.
**Why it happens:** Server runs in UTC. Without explicit timezone handling, all times are UTC.
**How to avoid:** Store preferred send time as a simple time (e.g., "09:00") and compute the actual UTC send time when scheduling. For v1 (no per-contact timezone -- this is deferred per CONTEXT), use the sequence creator's timezone or the organization's timezone as the reference. Store the organization timezone in settings or default to UTC with clear documentation.
**Warning signs:** Emails arriving in the middle of the night for users in certain time zones.

### Pitfall 5: Bulk Enrollment Database Contention
**What goes wrong:** Enrolling 1000 contacts at once creates 1000 Hangfire jobs and 1000 enrollment records in a single request, causing timeouts.
**Why it happens:** Single transaction with large batch insert + Hangfire enqueue for each.
**How to avoid:** Process bulk enrollment in batches (e.g., 50 at a time). Use a single Hangfire job for the bulk enrollment that processes in batches, rather than doing it all in the API request. Return 202 Accepted with a job ID for the frontend to poll.
**Warning signs:** HTTP 504 timeout on bulk enrollment requests.

### Pitfall 6: Template Deletion While Sequence is Active
**What goes wrong:** Deleting an email template that is referenced by an active sequence step causes a null reference when the step executes.
**Why it happens:** FK relationship with no protective cascade.
**How to avoid:** Two strategies: (1) Prevent deletion of templates used by active sequences (return 409 Conflict with a list of sequences using the template), or (2) Use ON DELETE SET NULL and check for null template at execution time, skipping the step with a log warning. Recommendation: Strategy 1 is safer.
**Warning signs:** NullReferenceException in SequenceExecutionService.

### Pitfall 7: Gmail API Rate Limits on Bulk Sends
**What goes wrong:** Sending many sequence emails in a short period hits Gmail API rate limits (250 emails/day for Gmail, higher for Workspace).
**Why it happens:** Multiple sequences with many enrollments can burst-send.
**How to avoid:** Add rate limiting per email account. Hangfire's queue with limited workers provides natural throttling. The existing "emails" queue with `WorkerCount = ProcessorCount * 2` workers helps. For production, consider a per-account daily send counter that pauses enrollment execution when approaching limits.
**Warning signs:** Google 429 errors in logs, emails stuck in "pending" state.

## Code Examples

### Domain Entities

```csharp
// EmailSequence.cs
public class EmailSequence
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public SequenceStatus Status { get; set; } = SequenceStatus.Draft;
    public Guid CreatedByUserId { get; set; }
    public ApplicationUser? CreatedByUser { get; set; }
    public List<EmailSequenceStep> Steps { get; set; } = [];
    public bool IsSeedData { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// EmailSequenceStep.cs
public class EmailSequenceStep
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SequenceId { get; set; }
    public EmailSequence Sequence { get; set; } = null!;
    public int StepNumber { get; set; }  // 1-based ordering
    public Guid EmailTemplateId { get; set; }
    public EmailTemplate? EmailTemplate { get; set; }
    public string? SubjectOverride { get; set; }  // Overrides template subject if set
    public int DelayDays { get; set; } = 0;  // Days to wait after previous step
    public TimeOnly? PreferredSendTime { get; set; }  // e.g., 09:00
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// SequenceEnrollment.cs
public class SequenceEnrollment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid SequenceId { get; set; }
    public EmailSequence? Sequence { get; set; }
    public Guid ContactId { get; set; }
    public Contact? Contact { get; set; }
    public EnrollmentStatus Status { get; set; } = EnrollmentStatus.Active;
    public int CurrentStepNumber { get; set; } = 0;  // 0 = not started, 1+ = last completed step
    public int StepsSent { get; set; } = 0;
    public int StartFromStep { get; set; } = 1;  // For re-enrollment from specific step
    public DateTimeOffset? LastStepSentAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? RepliedAt { get; set; }
    public int? ReplyStepNumber { get; set; }
    public DateTimeOffset? PausedAt { get; set; }
    public DateTimeOffset? BouncedAt { get; set; }
    public string? BounceReason { get; set; }
    public Guid CreatedByUserId { get; set; }
    public ApplicationUser? CreatedByUser { get; set; }
    public string? HangfireJobId { get; set; }  // Track scheduled job for pause/cancel
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// SequenceTrackingEvent.cs
public class SequenceTrackingEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid EnrollmentId { get; set; }
    public SequenceEnrollment? Enrollment { get; set; }
    public int StepNumber { get; set; }
    public string EventType { get; set; } = string.Empty;  // "sent", "open", "click", "bounce"
    public string? Url { get; set; }  // For click events: which link was clicked
    public string? GmailMessageId { get; set; }  // For sent events: Gmail message ID
    public string? GmailThreadId { get; set; }  // For reply detection
    public string? UserAgent { get; set; }  // For open/click events
    public string? IpAddress { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Enums

```csharp
// SequenceStatus.cs
public enum SequenceStatus { Draft, Active, Paused, Archived }

// EnrollmentStatus.cs
public enum EnrollmentStatus { Active, Paused, Completed, Replied, Bounced, Unenrolled }
```

### EF Configuration Pattern (following EmailTemplateConfiguration)

```csharp
public class EmailSequenceConfiguration : IEntityTypeConfiguration<EmailSequence>
{
    public void Configure(EntityTypeBuilder<EmailSequence> builder)
    {
        builder.ToTable("email_sequences");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");
        builder.Property(s => s.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(s => s.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(s => s.Description).HasColumnName("description").HasMaxLength(1000);
        builder.Property(s => s.Status).HasColumnName("status")
            .HasConversion<string>().HasMaxLength(50);
        builder.Property(s => s.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
        builder.Property(s => s.IsSeedData).HasColumnName("is_seed_data").HasDefaultValue(false);
        builder.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at").IsRequired();

        builder.HasOne(s => s.CreatedByUser).WithMany()
            .HasForeignKey(s => s.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(s => s.Steps).WithOne(st => st.Sequence)
            .HasForeignKey(st => st.SequenceId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.TenantId).HasDatabaseName("idx_email_sequences_tenant_id");
        builder.HasIndex(s => s.CreatedByUserId).HasDatabaseName("idx_email_sequences_created_by");
    }
}
```

### Angular Signal Store Pattern (following EmailTemplateStore)

```typescript
interface SequenceState {
  sequences: SequenceListItem[];
  selectedSequence: SequenceDetail | null;
  enrollments: EnrollmentListItem[];
  analytics: SequenceAnalytics | null;
  loading: boolean;
  error: string | null;
}

export const SequenceStore = signalStore(
  withState<SequenceState>({
    sequences: [],
    selectedSequence: null,
    enrollments: [],
    analytics: null,
    loading: false,
    error: null,
  }),
  withMethods((store) => {
    const service = inject(SequenceService);
    return {
      loadSequences(): void {
        patchState(store, { loading: true, error: null });
        service.getSequences().subscribe({
          next: (sequences) => patchState(store, { sequences, loading: false }),
          error: (err) => patchState(store, { loading: false, error: err?.message }),
        });
      },
      // ... additional methods
    };
  }),
);
```

### CDK Drag-Drop for Step Reordering (following pipeline-edit pattern)

```typescript
import { CdkDragDrop, CdkDrag, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';

// In component class:
onStepDrop(event: CdkDragDrop<EmailSequenceStep[]>) {
  moveItemInArray(this.steps(), event.previousIndex, event.currentIndex);
  // Reassign stepNumber values after reorder
  this.steps().forEach((step, index) => {
    step.stepNumber = index + 1;
  });
}
```

### Tracking Token Encoding

```csharp
// Simple base64url encoding of enrollmentId + stepNumber
// Not crypto-secure (by design -- tracking is best-effort, not security-critical)
public static string EncodeToken(Guid enrollmentId, int stepNumber)
{
    var data = $"{enrollmentId}:{stepNumber}";
    return Convert.ToBase64String(Encoding.UTF8.GetBytes(data))
        .Replace('+', '-').Replace('/', '_').TrimEnd('=');
}

public static (Guid enrollmentId, int stepNumber) DecodeToken(string token)
{
    var padded = token.Replace('-', '+').Replace('_', '/');
    switch (padded.Length % 4) { case 2: padded += "=="; break; case 3: padded += "="; break; }
    var data = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
    var parts = data.Split(':');
    return (Guid.Parse(parts[0]), int.Parse(parts[1]));
}
```

## Discretion Recommendations

### Bounce Handling Strategy
**Recommendation: Auto-unenroll on hard bounce, flag-and-continue on soft bounce.**
- Hard bounces (5xx SMTP, "mailbox not found"): Set enrollment status to `Bounced`, stop sending. Attempting further sends wastes API quota and damages sender reputation.
- Soft bounces (4xx SMTP, "mailbox full"): Log a warning but allow the next step to attempt delivery. After 3 consecutive soft bounces on the same enrollment, auto-unenroll.
- Detection: When GmailSendService throws an error or returns a bounce notification, the SequenceExecutionService catches it and updates enrollment status.

### Per-Step Metrics Display
**Recommendation: Inline summary with expandable detail panel.**
- Show compact inline metrics on each step card: sent count, open rate %, click rate % (three small badges).
- Click a step card to expand and show: detailed open/click counts, unique opens vs. total opens, top clicked links, bounce count.
- This balances information density with scannability.

### Sequence List Page Metric Density
**Recommendation: Key columns approach with 4 metric columns.**
- Columns: Name, Status, Steps, Total Enrolled, Active, Completed, Reply Rate
- Reply Rate is the most actionable metric (indicates sequence effectiveness).
- Keep columns compact with number formatting (e.g., "12.5%" not "12.50000%").

### Loading Skeleton and Empty State Designs
**Recommendation: Follow existing project patterns.**
- Loading: `<mat-spinner diameter="48">` centered (consistent with contact-detail, pipeline-edit).
- Empty state for sequence list: Icon (outgoing_mail or campaign), "No sequences yet" heading, "Create your first email sequence to automate outreach" subtext, primary CTA button "Create Sequence".
- Empty state for enrollment list: "No contacts enrolled" with "Add Contacts" button.

### Tracking Pixel and Link Wrapping Implementation
**Recommendation: HTML rewriting with HtmlAgilityPack or simple regex.**
- Tracking pixel: Append `<img src="/api/t/o/{token}" width="1" height="1" style="display:none" />` before closing `</body>` tag.
- Link wrapping: Replace `href="https://example.com"` with `href="/api/t/c/{token}?u=https%3A%2F%2Fexample.com"` for all `<a>` tags. Exclude mailto: and tel: links.
- Use simple string replacement rather than a full HTML parser -- email HTML is typically well-formed from the Unlayer editor.
- Token encoding: Base64url of `enrollmentId:stepNumber` (lightweight, no crypto needed since tracking is best-effort).

### Step Reorder Animation and Drag Handle Design
**Recommendation: Follow existing pipeline-edit pattern exactly.**
- Use `mat-icon` "drag_indicator" as the drag handle (consistent with pipeline stage reorder).
- CDK drag-drop provides built-in animation with `cdkDragPreview` and smooth placeholder insertion.
- Step cards should have a left-aligned drag handle, step number badge, template name, delay info, and action buttons (edit, delete).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling-based sequence engines (check every N minutes) | Event-driven per-step scheduling (Hangfire Schedule per step) | Standard since 2020+ | Better precision, lower resource usage |
| Gmail thread ID for reply detection | Custom email headers (X-Sequence-Id) | Recommended for precision | Thread IDs can group unrelated messages; custom headers are explicit |
| Image-based open tracking only | Accept open tracking is unreliable | Apple Mail Privacy Protection (2021) | Open rates are estimates, not facts; design accordingly |
| Separate tracking service | Embedded tracking endpoints in same API | Standard for B2B SaaS | Simpler deployment, data stays in-house |

**Deprecated/outdated:**
- Gmail API v1 message.insert for sending: Use messages.send instead (handles threading properly)
- Open tracking as a reliable metric: Since Apple Mail Privacy Protection (2021) and Gmail image proxy, open rates are approximate. Click tracking remains reliable.

## Open Questions

1. **Hangfire Job Cancellation on Pause**
   - What we know: When enrollment is paused, the already-scheduled next-step job should not execute. Checking status at job start handles this.
   - What's unclear: Should we also try to delete the scheduled Hangfire job for cleaner state? Hangfire supports `BackgroundJob.Delete(jobId)` if we store the job ID.
   - Recommendation: Store `HangfireJobId` on enrollment. On pause, attempt `BackgroundJob.Delete(jobId)` for cleanup, but also keep the status check at job start as defense-in-depth.

2. **Organization Timezone for Preferred Send Time**
   - What we know: Per-contact timezone is deferred. Preferred send time needs a reference timezone.
   - What's unclear: Does the Organization entity currently store a timezone?
   - Recommendation: Add an optional `Timezone` field to Organization settings (or use UTC as default). When computing send delay, convert the preferred time from org timezone to UTC.

3. **Email Account Selection for Sequence Sends**
   - What we know: Sequences send via Gmail. Users have personal Gmail accounts connected.
   - What's unclear: Should sequences use the sequence creator's Gmail account, or should there be a configurable "sending account" per sequence?
   - Recommendation: Use the sequence creator's Gmail account by default. If the creator doesn't have a connected account, fall back to SendGrid. Add a `SendingAccountId` field to EmailSequence for future flexibility.

4. **DynamicTable Row Selection Implementation Scope**
   - What we know: Bulk enrollment requires multi-select on the contacts list. DynamicTable currently has no selection support.
   - What's unclear: Should row selection be added as a generic DynamicTable feature (usable by all entity lists) or only for the contacts list?
   - Recommendation: Add it as a generic DynamicTable feature with an `enableSelection` input. This benefits future phases (bulk delete, bulk assign, etc.).

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/GlobCRM.Infrastructure/BackgroundJobs/` -- Hangfire configuration, TenantJobFilter, TenantScope
- Codebase analysis: `src/GlobCRM.Infrastructure/Webhooks/WebhookDeliveryService.cs` -- Hangfire job scheduling pattern with retry, queue, tenant context
- Codebase analysis: `src/GlobCRM.Infrastructure/Gmail/GmailSendService.cs` -- MimeKit message construction, Gmail API send
- Codebase analysis: `src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs` -- Email sync, header parsing, inbound message processing
- Codebase analysis: `src/GlobCRM.Infrastructure/EmailTemplates/TemplateRenderService.cs` -- Fluid/Liquid template rendering
- Codebase analysis: `src/GlobCRM.Infrastructure/EmailTemplates/MergeFieldService.cs` -- Entity data resolution for merge fields
- Codebase analysis: `src/GlobCRM.Api/Controllers/EmailTemplatesController.cs` -- Controller pattern with co-located DTOs
- Codebase analysis: `globcrm-web/src/app/features/email-templates/` -- Angular feature pattern (store, service, models, components)
- Codebase analysis: `globcrm-web/src/app/features/settings/pipelines/pipeline-edit.component.ts` -- CDK drag-drop reorderable list pattern
- Codebase analysis: `globcrm-web/src/app/features/dashboard/components/widgets/chart-widget/` -- Chart.js/ng2-charts usage pattern

### Secondary (MEDIUM confidence)
- MimeKit documentation: Custom header addition via `mimeMessage.Headers.Add()` -- widely documented and tested
- @angular/cdk/collections SelectionModel: Standard CDK utility for multi-select state management
- Email tracking pixel pattern: Standard approach (1x1 transparent GIF, unauthenticated endpoint, base64url token encoding)

### Tertiary (LOW confidence)
- Apple Mail Privacy Protection impact on open tracking accuracy: Generally documented as pre-fetching all images, but exact behavior varies by version and user settings. Open rates should be treated as estimates.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Everything is already installed and in use; no new dependencies needed
- Architecture: HIGH - All patterns follow established codebase conventions (WebhookDeliveryService, EmailTemplateController, pipeline-edit)
- Pitfalls: HIGH - Based on direct codebase analysis and well-known email infrastructure challenges
- Reply detection: MEDIUM - Custom header approach is well-established, but exact Gmail header preservation behavior during forwarding/reply needs testing
- Open tracking accuracy: MEDIUM - Known to be unreliable but the implementation pattern is standard

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain, no fast-moving dependencies)
