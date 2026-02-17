# Phase 5: Activities & Workflow - Research

**Researched:** 2026-02-17
**Domain:** CRM activity management with state machine workflow, multi-entity linking, comments, attachments, time tracking, audit trail, and three view modes (list, Kanban, calendar)
**Confidence:** HIGH

## Summary

Phase 5 is the most feature-dense phase in GlobCRM so far, with 14 requirements spanning entity CRUD (ACTV-01), dynamic table (ACTV-02), state machine workflow (ACTV-03), user assignment (ACTV-04), comments (ACTV-05), attachments (ACTV-06), time tracking (ACTV-07), audit trail (ACTV-08), three view modes (ACTV-09), follow/watch (ACTV-10), priority (ACTV-11), multi-entity linking (ACTV-12), entity timeline integration (ACTV-13), and custom fields (ACTV-14). The good news is that the majority of these patterns have direct precedents in Phases 3-4: entity CRUD follows the Company/Contact pattern, Kanban reuses the CDK drag-drop pattern from deals, calendar reuses FullCalendar from deals, entity linking reuses the inline search panel pattern from deal detail, dynamic table reuses DynamicTable/ViewStore, and custom fields use the established JSONB pattern. The NEW patterns in Phase 5 are: (1) a formal activity workflow state machine (assigned -> accepted -> in progress -> review -> done), (2) child entity collections on activities (comments, attachments, time entries), (3) a follow/watch system for change notifications, and (4) an audit trail that tracks field-level changes.

The Activity entity is fundamentally different from Deal in one important way: it uses a **status workflow** (finite set of states with defined transitions) rather than a **pipeline** (admin-configurable stages). The workflow states are fixed (assigned, accepted, in_progress, review, done) and do not need admin configuration. The Kanban board for activities maps these fixed states to columns, rather than loading pipeline stages dynamically. This simplifies the Kanban implementation but introduces a state machine validation concern: not all transitions should be allowed (e.g., "done" cannot go back to "assigned" without explicit logic).

The secondary challenge is the sheer breadth of sub-entities: ActivityComment, ActivityAttachment, ActivityTimeEntry, ActivityFollower, and ActivityLink (polymorphic entity linking). Each needs its own API endpoints, DTOs, and UI components. The activity detail page will be the most complex detail page in the CRM, with tabs for Details, Comments, Attachments, Time Log, Links, and Timeline.

**Primary recommendation:** Build the Activity entity and workflow state machine first (backend domain + repository + controller), then the list/Kanban/calendar views reusing Phase 4 patterns, then the detail page with sub-entity tabs (comments, attachments, time tracking, links), then the follow/watch system, and finally enable the "Activities" tab on Company/Contact/Deal detail pages.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Angular | 19.2.x | Frontend framework | Already installed |
| Angular Material | 19.2.x | UI components (cards, buttons, tabs, dialogs, chips) | Already installed |
| Angular CDK | 19.2.x | Drag-drop for activity Kanban (same as Deal Kanban) | Already installed |
| @ngrx/signals | 19.2.x | Signal store for Activity state | Already installed |
| @fullcalendar/angular | 6.1.x | Calendar view for activities | Already installed (Phase 4) |
| @fullcalendar/core | 6.1.x | FullCalendar core | Already installed |
| @fullcalendar/daygrid | 6.1.x | Month/day grid | Already installed |
| @fullcalendar/interaction | 6.1.x | Click/drag interactions | Already installed |
| ASP.NET Core | 10.0.3 | Backend framework | Already installed |
| EF Core + Npgsql | 10.0.x | ORM with JSONB | Already installed |
| FluentValidation | 12.x | Request validation | Already installed |
| Finbuckle.MultiTenant | 10.0.3 | Tenant isolation | Already installed |

### New Dependencies
No new npm or NuGet packages are required. All libraries needed for Phase 5 are already installed from Phases 1-4:
- CDK drag-drop for Kanban (Phase 4)
- FullCalendar for calendar (Phase 4)
- File upload via Angular HttpClient (native)
- File storage via existing IFileStorageService (Phase 2 - LocalFileStorageService)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fixed workflow states as enum | Admin-configurable workflow (like pipeline stages) | Fixed states are simpler, match ACTV-03 requirement exactly. Admin-configurable workflow is a v2 feature (ADVN-01). |
| Polymorphic ActivityLink table | Separate join tables per entity type (ActivityContact, ActivityDeal, etc.) | Polymorphic link with EntityType + EntityId is simpler for ACTV-12 which links to 5 entity types. Separate tables would be 5 join tables. Trade: loses FK referential integrity, but ACTV-12 links are soft references anyway. |
| Local file storage (existing) | Cloud blob storage (S3/Azure) | Local storage is already implemented in Phase 2 (IFileStorageService). Cloud storage is a deployment concern, not a Phase 5 concern. The abstraction allows swapping later. |

## Architecture Patterns

### Recommended Project Structure

**Backend additions:**
```
src/GlobCRM.Domain/
  Entities/
    Activity.cs                # NEW: Activity entity (task, call, meeting)
    ActivityComment.cs         # NEW: Comment child entity
    ActivityAttachment.cs      # NEW: File attachment child entity
    ActivityTimeEntry.cs       # NEW: Time tracking child entity
    ActivityFollower.cs        # NEW: Follow/watch child entity
    ActivityLink.cs            # NEW: Polymorphic entity link (ContactId, CompanyId, DealId, etc.)
    ActivityStatusHistory.cs   # NEW: Status transition audit trail
  Enums/
    ActivityType.cs            # NEW: Task, Call, Meeting
    ActivityStatus.cs          # NEW: Assigned, Accepted, InProgress, Review, Done
    ActivityPriority.cs        # NEW: Low, Medium, High, Urgent
  Interfaces/
    IActivityRepository.cs     # NEW: Activity CRUD + query + status transitions
    IFileStorageService.cs     # EXISTING (Phase 2) -- reuse for attachments

src/GlobCRM.Infrastructure/
  Persistence/
    Configurations/
      ActivityConfiguration.cs            # NEW
      ActivityCommentConfiguration.cs     # NEW
      ActivityAttachmentConfiguration.cs  # NEW
      ActivityTimeEntryConfiguration.cs   # NEW
      ActivityFollowerConfiguration.cs    # NEW
      ActivityLinkConfiguration.cs        # NEW
      ActivityStatusHistoryConfiguration.cs # NEW
    Repositories/
      ActivityRepository.cs              # NEW
    Migrations/App/
      YYYYMMDDHHMMSS_AddActivities.cs   # NEW: Single migration for all activity tables

src/GlobCRM.Api/
  Controllers/
    ActivitiesController.cs    # NEW: Activity CRUD + status + comments + attachments + time + links + timeline
```

**Frontend additions:**
```
globcrm-web/src/app/
  features/
    activities/
      activities.routes.ts                       # NEW: List + Kanban + Calendar + detail routes
      activity.models.ts                         # NEW: Activity TypeScript models + DTOs
      activity.service.ts                        # NEW: API service
      activity.store.ts                          # NEW: NgRx signal store
      activity-list/
        activity-list.component.ts/html/scss     # NEW: Dynamic table list view (ACTV-02)
      activity-kanban/
        activity-kanban.component.ts/html/scss   # NEW: Workflow Kanban board (ACTV-09)
      activity-calendar/
        activity-calendar.component.ts/html/scss # NEW: FullCalendar view (ACTV-09)
      activity-detail/
        activity-detail.component.ts/html/scss   # NEW: Detail page with tabs (ACTV-05-08, ACTV-12)
      activity-form/
        activity-form.component.ts/html/scss     # NEW: Create/edit form (ACTV-01, ACTV-04, ACTV-11)
```

### Pattern 1: Activity Domain Entity with Workflow Status

**What:** Activity is a tenant-scoped CRM entity with a fixed workflow status (not admin-configurable like pipeline stages). It has an ActivityType enum (Task, Call, Meeting) and ActivityStatus enum (Assigned, Accepted, InProgress, Review, Done).

**When to use:** Activities represent work items that follow a predictable lifecycle.

**Example:**
```csharp
// Enums
public enum ActivityType
{
    Task,
    Call,
    Meeting
}

public enum ActivityStatus
{
    Assigned,
    Accepted,
    InProgress,
    Review,
    Done
}

public enum ActivityPriority
{
    Low,
    Medium,
    High,
    Urgent
}

// Activity entity
public class Activity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Core fields (ACTV-01)
    public string Subject { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ActivityType Type { get; set; } = ActivityType.Task;
    public ActivityStatus Status { get; set; } = ActivityStatus.Assigned;
    public ActivityPriority Priority { get; set; } = ActivityPriority.Medium; // ACTV-11
    public DateTimeOffset? DueDate { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    // Ownership and assignment (ACTV-04)
    public Guid? OwnerId { get; set; }        // Created by / responsible
    public ApplicationUser? Owner { get; set; }
    public Guid? AssignedToId { get; set; }    // Assigned user
    public ApplicationUser? AssignedTo { get; set; }

    // Custom fields (ACTV-14)
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    public bool IsSeedData { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Child collections
    public ICollection<ActivityComment> Comments { get; set; } = new List<ActivityComment>();
    public ICollection<ActivityAttachment> Attachments { get; set; } = new List<ActivityAttachment>();
    public ICollection<ActivityTimeEntry> TimeEntries { get; set; } = new List<ActivityTimeEntry>();
    public ICollection<ActivityFollower> Followers { get; set; } = new List<ActivityFollower>();
    public ICollection<ActivityLink> Links { get; set; } = new List<ActivityLink>();
}
```

### Pattern 2: Child Entities (Comments, Attachments, Time Entries)

**What:** Activities have multiple child entity types. All inherit tenant isolation from the Activity FK (no TenantId on child tables). This matches the pattern established in Phase 4 where DealContact, DealProduct, and DealStageHistory have no TenantId.

**Example:**
```csharp
// ActivityComment (ACTV-05)
public class ActivityComment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;
    public string Content { get; set; } = string.Empty;
    public Guid? AuthorId { get; set; }
    public ApplicationUser? Author { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// ActivityAttachment (ACTV-06)
public class ActivityAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;  // IFileStorageService path
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public Guid? UploadedById { get; set; }
    public ApplicationUser? UploadedBy { get; set; }
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
}

// ActivityTimeEntry (ACTV-07)
public class ActivityTimeEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;
    public decimal DurationMinutes { get; set; }  // Time spent in minutes
    public string? Description { get; set; }       // What was done
    public DateOnly EntryDate { get; set; }         // Date the work was performed
    public Guid? UserId { get; set; }
    public ApplicationUser? User { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// ActivityFollower (ACTV-10)
public class ActivityFollower
{
    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public DateTimeOffset FollowedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Pattern 3: Polymorphic Entity Linking (ACTV-12)

**What:** Activities can be linked to contacts, companies, deals, quotes, and requests. Rather than creating 5 separate join tables, use a single ActivityLink table with EntityType + EntityId. This sacrifices FK referential integrity but provides a simpler, more extensible model.

**When to use:** When an entity links to many different entity types (more than 2-3).

**Example:**
```csharp
// ActivityLink (ACTV-12) - polymorphic entity association
public class ActivityLink
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;
    public string EntityType { get; set; } = string.Empty;  // "Contact", "Company", "Deal", etc.
    public Guid EntityId { get; set; }                       // ID of the linked entity
    public string? EntityName { get; set; }                  // Denormalized name for display
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

**Why polymorphic over join tables:** ACTV-12 says "link activities to contacts, companies, deals, quotes, and requests." That is 5 entity types. Creating 5 separate join tables (ActivityContact, ActivityCompany, ActivityDeal, ActivityQuote, ActivityRequest) would be more normalized but adds significant implementation overhead. The polymorphic approach uses one table, one API endpoint pattern, and one frontend component. The denormalized EntityName field avoids expensive cross-entity joins for display.

**Integrity mitigation:** When entities are deleted, their ActivityLink records should be cleaned up. Use a simple check: when loading links, verify the entity still exists. Or add cascade logic in the delete endpoint of each entity type. Since entity deletion is rare and requires admin permissions, this is acceptable.

### Pattern 4: Activity Workflow Kanban (Fixed States)

**What:** Unlike deals which use admin-configurable pipeline stages, activities have fixed workflow states. The Kanban board for activities maps the ActivityStatus enum values to columns.

**Example:**
```typescript
// Fixed workflow columns for activity Kanban
const ACTIVITY_WORKFLOW_COLUMNS = [
  { status: 'Assigned', label: 'Assigned', color: '#2196f3' },
  { status: 'Accepted', label: 'Accepted', color: '#ff9800' },
  { status: 'InProgress', label: 'In Progress', color: '#9c27b0' },
  { status: 'Review', label: 'Review', color: '#00bcd4' },
  { status: 'Done', label: 'Done', color: '#4caf50' },
];

// Allowed transitions (state machine rules)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Assigned: ['Accepted', 'InProgress', 'Done'],   // Can skip to Done for quick tasks
  Accepted: ['InProgress', 'Done'],
  InProgress: ['Review', 'Done', 'Assigned'],     // Can go back to Assigned (reassign)
  Review: ['Done', 'InProgress'],                  // Can go back to InProgress (rejected)
  Done: ['InProgress'],                            // Reopen
};
```

**Key difference from Deal Kanban:** No pipeline selector dropdown needed. The columns are static. But drag-drop behavior, optimistic update, and API error revert are identical to the Deal Kanban pattern.

### Pattern 5: Status Transition Audit Trail (ACTV-08)

**What:** Every status change creates an ActivityStatusHistory record, similar to DealStageHistory. Additionally, the audit trail should capture field-level changes for full "who changed what, when" tracking.

**Example:**
```csharp
// ActivityStatusHistory
public class ActivityStatusHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActivityId { get; set; }
    public Activity Activity { get; set; } = null!;
    public ActivityStatus FromStatus { get; set; }
    public ActivityStatus ToStatus { get; set; }
    public Guid? ChangedByUserId { get; set; }
    public ApplicationUser? ChangedByUser { get; set; }
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

For full field-level audit (ACTV-08 "who changed what, when"), the timeline endpoint should aggregate:
1. Entity creation event
2. Status change events (from ActivityStatusHistory)
3. Comment added events (from ActivityComment.CreatedAt)
4. Attachment uploaded events (from ActivityAttachment.UploadedAt)
5. Time entry added events (from ActivityTimeEntry.CreatedAt)
6. Entity link events (from ActivityLink.LinkedAt)
7. Assignment change events (tracked via ActivityStatusHistory or a separate mechanism)

This provides a comprehensive audit trail without building a separate audit log table (which would be a Phase 8+ concern for system-wide audit logging).

### Pattern 6: Activity Calendar View

**What:** The activity calendar shows activities by DueDate, color-coded by priority or type. Reuses FullCalendar from Phase 4.

**Example:**
```typescript
// Map activities to FullCalendar events
private mapActivitiesToEvents(activities: ActivityListDto[]): EventInput[] {
  return activities
    .filter(a => a.dueDate != null)
    .map(a => ({
      id: a.id,
      title: a.subject,
      date: a.dueDate!,
      backgroundColor: this.getPriorityColor(a.priority),
      borderColor: this.getPriorityColor(a.priority),
      extendedProps: {
        type: a.type,
        status: a.status,
        assignedToName: a.assignedToName,
      },
    }));
}

private getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    Low: '#4caf50',
    Medium: '#2196f3',
    High: '#ff9800',
    Urgent: '#f44336',
  };
  return colors[priority] ?? '#757575';
}
```

### Anti-Patterns to Avoid

- **Admin-configurable workflow states:** ACTV-03 specifies a FIXED workflow (assigned -> accepted -> in progress -> review -> done). Do NOT build this as an admin-configurable system like pipeline stages. That is the v2 feature ADVN-01 (workflow automation).

- **Separate controllers per sub-entity:** Do NOT create CommentsController, AttachmentsController, TimeEntriesController. These are all sub-resources of Activity and should be nested under ActivitiesController: `POST /api/activities/{id}/comments`, `POST /api/activities/{id}/attachments`, etc.

- **Loading all child entities in list queries:** The activity list/Kanban views do NOT need comments, attachments, time entries, or links. Only load those on the detail page. The list DTO should be lightweight (subject, type, status, priority, dueDate, assignedTo, ownerName).

- **Storing file bytes in the database:** Attachments store metadata (filename, path, size, type) in the database. The actual file goes to IFileStorageService (local disk or cloud storage). Never store binary data in PostgreSQL.

- **Building a generic audit log system:** ACTV-08 says "full audit trail on activities." Build activity-specific audit by aggregating timestamps from child entities (comments, attachments, time entries, status history, links). Do NOT build a system-wide audit interceptor in Phase 5 -- that is a cross-cutting concern for a later phase.

- **Over-engineering the follow/watch system:** ACTV-10 says "follow/watch activities to receive notifications on changes." In Phase 5, implement the data model (ActivityFollower join table) and the follow/unfollow API. The actual notification delivery (in-app notifications via SignalR) is a Phase 8 feature (NOTF-01 through NOTF-06). Phase 5 just stores who is following.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar view | Custom month grid | @fullcalendar/angular (already installed) | Same reasoning as Phase 4. Already proven in deal calendar. |
| Kanban board | Custom column layout with drag handlers | Angular CDK drag-drop (already installed/proven) | Same reasoning as Phase 4. Already proven in deal Kanban. |
| File upload progress | Custom XMLHttpRequest handling | Angular HttpClient with reportProgress + HttpEventType | Built-in Angular feature, handles progress events cleanly |
| Time duration formatting | Custom minute-to-hours-minutes parser | Simple utility function (minutes -> "Xh Ym") | Too simple for a library; too easy to get wrong with ad-hoc math |
| State machine validation | Ad-hoc if/else chains | Simple allowed-transitions map lookup | Clean, testable, and extensible pattern |

**Key insight:** Phase 5 is large in scope but small in novelty. Nearly every pattern has a precedent in Phases 3-4. The risk is not technical complexity but implementation breadth -- there are many files to create, all following established patterns.

## Common Pitfalls

### Pitfall 1: Workflow State Validation on Kanban Drag-Drop
**What goes wrong:** User drags an activity from "Done" to "Assigned." Backend accepts the transition. Now a completed activity is back in "Assigned" with its CompletedAt timestamp still set.
**Why it happens:** No server-side validation of allowed transitions.
**How to avoid:** Define allowed transitions in a static map on the backend. Validate in the status change endpoint. Return 400 with clear error message. Frontend also validates before making the API call (grey out invalid drop targets or show a tooltip).
**Warning signs:** Activities in nonsensical states (e.g., "Assigned" with CompletedAt set, "Done" without CompletedAt).

### Pitfall 2: Activity Owner vs. AssignedTo Confusion
**What goes wrong:** OwnerId and AssignedToId serve different purposes but get conflated in permission checks or UI display.
**Why it happens:** Deals had only OwnerId. Activities add AssignedToId for delegation.
**How to avoid:** Clear naming: OwnerId = who created/is responsible for the activity (matches Company/Contact/Deal pattern). AssignedToId = who is working on it (ACTV-04). Ownership scope should filter by OwnerId (not AssignedToId) for consistency with other entities. The "My Activities" filter can use either OwnerId OR AssignedToId.
**Warning signs:** Users assigned to activities can't see them in their list because scope checks OwnerId only.

### Pitfall 3: Polymorphic Link Integrity on Entity Deletion
**What goes wrong:** A Contact is deleted. ActivityLink records pointing to that contact now reference a non-existent entity. The activity detail page shows broken links.
**Why it happens:** Polymorphic links have no FK constraint. Entity deletion doesn't cascade to ActivityLink.
**How to avoid:** Two strategies: (1) Clean up ActivityLinks when deleting an entity (add cleanup logic to Company/Contact/Deal delete endpoints). (2) On the activity detail page, gracefully handle missing entities (show "Entity deleted" instead of crashing).
**Warning signs:** "Entity not found" errors on activity detail pages, broken link lists.

### Pitfall 4: File Upload Without Size Limits
**What goes wrong:** User uploads a 2GB file. The server runs out of memory. The request times out.
**Why it happens:** No server-side or client-side file size validation.
**How to avoid:** Set a max file size (e.g., 25MB per file). Validate on both frontend (before upload) and backend (ASP.NET Core request size limits + manual check). Return clear error message.
**Warning signs:** Timeout errors on file upload, server memory spikes.

### Pitfall 5: N+1 Queries on Activity Timeline
**What goes wrong:** Loading the activity timeline triggers separate queries for each child entity type (comments, attachments, time entries, status history, links).
**Why it happens:** Naive implementation loads each child collection independently.
**How to avoid:** For the timeline endpoint, load the activity with all child collections in a single query using `.Include()` chains. Then aggregate all entries client-side. Alternatively, build the timeline from pre-loaded child entities on the detail page (which already loads them for tabs).
**Warning signs:** Slow timeline loading, many SQL queries in logs.

### Pitfall 6: Activity Tabs Not Enabled on Entity Detail Pages
**What goes wrong:** Phase 5 builds the Activities feature but forgets to enable the "Activities" tab on Company, Contact, and Deal detail pages.
**Why it happens:** Those tabs are currently `enabled: false` in COMPANY_TABS, CONTACT_TABS, and DEAL_TABS.
**How to avoid:** Include a dedicated plan step to: (1) enable Activities tabs on Company, Contact, Deal detail pages, (2) add the activities query endpoint for entity-scoped activities (e.g., `GET /api/activities?linkedEntityType=Company&linkedEntityId={id}`), and (3) render the activity list within the tab body.
**Warning signs:** "Activities" tab still shows "coming soon" after Phase 5 is complete.

### Pitfall 7: Calendar Duplication with Phase 11 Calendar Requirements
**What goes wrong:** ACTV-09 says "user can view activities as calendar." CALR-01 through CALR-05 (Phase 11) describe a more comprehensive calendar. Building a full calendar in Phase 5 duplicates effort.
**Why it happens:** Unclear scope boundary between ACTV-09 calendar and CALR-01+ calendar.
**How to avoid:** Phase 5 builds a simple activity calendar (dayGridMonth, activities by due date, click-to-navigate) following the exact same pattern as the deal calendar. Phase 11 builds a comprehensive calendar page that aggregates activities, deals, and other events with drag-to-reschedule. Keep Phase 5 calendar simple.
**Warning signs:** Over-engineering the calendar with week/day views, drag-to-reschedule, multi-entity aggregation.

## Code Examples

### Backend: Activity Entity Configuration
```csharp
// Source: Follows DealConfiguration pattern exactly
public class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> builder)
    {
        builder.ToTable("activities");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id");
        builder.Property(a => a.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(a => a.Subject).HasColumnName("subject").HasMaxLength(500).IsRequired();
        builder.Property(a => a.Description).HasColumnName("description");
        builder.Property(a => a.Type).HasColumnName("type").HasConversion<string>().HasMaxLength(50).IsRequired();
        builder.Property(a => a.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(50).IsRequired();
        builder.Property(a => a.Priority).HasColumnName("priority").HasConversion<string>().HasMaxLength(50).IsRequired();
        builder.Property(a => a.DueDate).HasColumnName("due_date");
        builder.Property(a => a.CompletedAt).HasColumnName("completed_at");
        builder.Property(a => a.OwnerId).HasColumnName("owner_id");
        builder.Property(a => a.AssignedToId).HasColumnName("assigned_to_id");
        builder.Property(a => a.CustomFields).HasColumnName("custom_fields").HasColumnType("jsonb").HasDefaultValueSql("'{}'::jsonb");
        builder.Property(a => a.IsSeedData).HasColumnName("is_seed_data").HasDefaultValue(false);
        builder.Property(a => a.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(a => a.UpdatedAt).HasColumnName("updated_at").IsRequired();

        // Relationships
        builder.HasOne(a => a.Owner).WithMany().HasForeignKey(a => a.OwnerId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(a => a.AssignedTo).WithMany().HasForeignKey(a => a.AssignedToId).OnDelete(DeleteBehavior.SetNull);

        // Child collections cascade delete (delete activity = delete all children)
        builder.HasMany(a => a.Comments).WithOne(c => c.Activity).HasForeignKey(c => c.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Attachments).WithOne(at => at.Activity).HasForeignKey(at => at.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.TimeEntries).WithOne(te => te.Activity).HasForeignKey(te => te.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Followers).WithOne(f => f.Activity).HasForeignKey(f => f.ActivityId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Links).WithOne(l => l.Activity).HasForeignKey(l => l.ActivityId).OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(a => a.TenantId).HasDatabaseName("idx_activities_tenant");
        builder.HasIndex(a => a.OwnerId).HasDatabaseName("idx_activities_owner");
        builder.HasIndex(a => a.AssignedToId).HasDatabaseName("idx_activities_assigned_to");
        builder.HasIndex(a => a.Status).HasDatabaseName("idx_activities_status");
        builder.HasIndex(a => a.DueDate).HasDatabaseName("idx_activities_due_date");
        builder.HasIndex(a => a.CustomFields).HasMethod("gin").HasDatabaseName("idx_activities_custom_fields_gin");
    }
}
```

### Backend: Status Transition Validation
```csharp
// Source: Static map approach for workflow validation
public static class ActivityWorkflow
{
    private static readonly Dictionary<ActivityStatus, ActivityStatus[]> AllowedTransitions = new()
    {
        [ActivityStatus.Assigned] = [ActivityStatus.Accepted, ActivityStatus.InProgress, ActivityStatus.Done],
        [ActivityStatus.Accepted] = [ActivityStatus.InProgress, ActivityStatus.Done],
        [ActivityStatus.InProgress] = [ActivityStatus.Review, ActivityStatus.Done, ActivityStatus.Assigned],
        [ActivityStatus.Review] = [ActivityStatus.Done, ActivityStatus.InProgress],
        [ActivityStatus.Done] = [ActivityStatus.InProgress],
    };

    public static bool CanTransition(ActivityStatus from, ActivityStatus to)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
    }
}
```

### Backend: Activity Controller Status Change Endpoint
```csharp
// Source: Follows DealController.UpdateStage pattern
[HttpPatch("{id:guid}/status")]
[Authorize(Policy = "Permission:Activity:Update")]
public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateActivityStatusRequest request)
{
    var activity = await _activityRepository.GetByIdAsync(id);
    if (activity is null) return NotFound(new { error = "Activity not found." });

    // Permission scope check...

    if (!Enum.TryParse<ActivityStatus>(request.Status, out var newStatus))
        return BadRequest(new { error = "Invalid status." });

    if (activity.Status == newStatus) return NoContent();

    if (!ActivityWorkflow.CanTransition(activity.Status, newStatus))
        return BadRequest(new { error = $"Cannot transition from {activity.Status} to {newStatus}." });

    // Create status history
    var history = new ActivityStatusHistory
    {
        ActivityId = activity.Id,
        FromStatus = activity.Status,
        ToStatus = newStatus,
        ChangedByUserId = GetCurrentUserId(),
    };
    _db.ActivityStatusHistories.Add(history);

    var oldStatus = activity.Status;
    activity.Status = newStatus;

    // Set CompletedAt when transitioning to Done
    if (newStatus == ActivityStatus.Done)
        activity.CompletedAt = DateTimeOffset.UtcNow;
    else
        activity.CompletedAt = null;

    await _activityRepository.UpdateAsync(activity);
    return NoContent();
}
```

### Frontend: Activity Models
```typescript
// Source: Follows Deal models pattern
export interface ActivityListDto {
  id: string;
  subject: string;
  type: 'Task' | 'Call' | 'Meeting';
  status: 'Assigned' | 'Accepted' | 'InProgress' | 'Review' | 'Done';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate: string | null;
  ownerName: string | null;
  assignedToName: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDetailDto extends ActivityListDto {
  description: string | null;
  completedAt: string | null;
  ownerId: string | null;
  assignedToId: string | null;
  comments: ActivityCommentDto[];
  attachments: ActivityAttachmentDto[];
  timeEntries: ActivityTimeEntryDto[];
  followers: ActivityFollowerDto[];
  links: ActivityLinkDto[];
  totalTimeMinutes: number;
}
```

### Frontend: Activity Kanban with Fixed Workflow Columns
```typescript
// Source: Adapts DealKanbanComponent pattern for fixed workflow states
// Key difference: No pipeline selector. Columns are static.
// Uses same CDK drag-drop pattern (CdkDropListGroup, CdkDropList, CdkDrag)
// Drop handler calls activityService.updateStatus(id, targetStatus)
// Before calling API, validate transition is allowed (client-side check)
// On error, revert card position (same optimistic pattern as deal Kanban)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc status strings | Enum-based workflow with static transition map | Best practice | Type-safe, prevents invalid states |
| Separate audit log table | Timeline aggregated from child entity timestamps | Project pattern (Phase 3-4) | Simpler, no separate audit infrastructure |
| Multiple join tables for entity links | Polymorphic link table (EntityType + EntityId) | Common CRM pattern | Fewer tables, simpler API, trades referential integrity |
| Separate controller per sub-resource | Nested routes under parent controller | REST best practice | `/activities/{id}/comments` not `/comments?activityId=...` |

**Deprecated/outdated:**
- None specific to Phase 5 -- all libraries already installed and verified in Phase 4.

## Integration Points with Existing Codebase

### Backend Integration

1. **EntityType enum:** `Activity` is already listed in the EntityType enum at position 3 (Contact=0, Company=1, Deal=2, Activity=3). No change needed.

2. **RoleTemplateSeeder:** `EnsurePermissionsForAllEntityTypesAsync` already iterates all EntityType values which includes `Activity`. Activity permissions (View, Create, Update, Delete) will auto-seed on startup.

3. **TenantSeeder:** Will need activity seed data added to the seed manifest. Create 5-10 sample activities linked to seeded contacts, companies, and deals.

4. **ApplicationDbContext:** Add DbSets for Activity, ActivityComment, ActivityAttachment, ActivityTimeEntry, ActivityFollower, ActivityLink, ActivityStatusHistory. Add global query filter for Activity (tenant-scoped). Child entities inherit via parent FK.

5. **RLS script:** Add RLS policy for `activities` table. Child tables (activity_comments, activity_attachments, etc.) do NOT need RLS (accessed via FK joins from tenant-filtered Activity).

6. **IFileStorageService:** Already exists from Phase 2. Reuse for ActivityAttachment file storage. Storage path pattern: `{tenantId}/activities/{activityId}/{filename}`.

### Frontend Integration

1. **App routes:** Add `activities` route with authGuard in app.routes.ts.

2. **Navbar:** Add "Activities" link in navbar. Position: Dashboard | Companies | Contacts | Products | Deals | **Activities** | Team | Settings.

3. **RelatedEntityTabs:** Enable the "Activities" tab on COMPANY_TABS, CONTACT_TABS, and DEAL_TABS (currently `enabled: false`).

4. **Dynamic table:** Activity list page reuses DynamicTableComponent and ViewStore.

5. **Entity timeline:** Activity detail page timeline aggregates: creation, status changes, comments, attachments, time entries, links. Extend TimelineEntry type union with new activity-specific types ('comment_added', 'attachment_uploaded', 'time_logged', 'follower_added', 'entity_linked', 'status_changed', 'assignment_changed').

6. **Permission directives:** Use `*appHasPermission="'Activity:Create'"` etc.

7. **Entity-scoped activity queries:** The entity detail pages (Company, Contact, Deal) need to show activities linked to them. Add a query parameter to the Activity list endpoint: `GET /api/activities?linkedEntityType=Company&linkedEntityId={id}`.

## Open Questions

1. **Ownership Scope: Owner or AssignedTo?**
   - What we know: Company/Contact/Deal use OwnerId for permission scope filtering (Own, Team, All). Activities have both OwnerId and AssignedToId.
   - What's unclear: Should "Own" scope show activities owned by the user, assigned to the user, or both?
   - Recommendation: Keep OwnerId for scope filtering (consistency with other entities). Add a separate "Assigned to me" filter in the UI. The list store can have an `assignedToMe` boolean filter.

2. **Follow/Watch Notification Delivery**
   - What we know: ACTV-10 says "follow/watch to receive notifications on changes." Phase 8 is the notifications phase (NOTF-01 through NOTF-06).
   - What's unclear: Should Phase 5 implement notification delivery or just the follow data model?
   - Recommendation: Phase 5 builds the follow/unfollow data model and API only. Notification delivery is Phase 8. The follow button on activity detail works immediately. The "who should be notified" logic is deferred.

3. **Activity Linking: Bidirectional or Unidirectional?**
   - What we know: ACTV-12 says "link activities to contacts, companies, deals." ACTV-13 says "entity detail pages show activity timeline."
   - What's unclear: When you view a Company detail page, should you see activities that are linked TO that company? This requires querying ActivityLink from the company's perspective.
   - Recommendation: Yes, bidirectional. The Activity owns the link (ActivityLink table). But entity detail pages query it in reverse: `GET /api/activities?linkedEntityType=Company&linkedEntityId={companyId}`. This supports both ACTV-12 (link from activity) and ACTV-13 (view from entity).

4. **Attachment Storage Limits**
   - What we know: IFileStorageService exists with LocalFileStorageService.
   - What's unclear: Max file size? Max total storage per tenant?
   - Recommendation: Set 25MB per file limit in Phase 5. Total storage limits are a subscription/billing concern for later. Document the limit in the upload endpoint.

5. **Activity Seed Data**
   - What we know: TenantSeeder creates companies, contacts, products, deals.
   - What's unclear: What seed activities should be created?
   - Recommendation: Create 5 activities of mixed types (2 Tasks, 2 Calls, 1 Meeting) with various statuses, linked to existing seeded contacts and deals. Include 2-3 sample comments and 1-2 time entries on one activity for demo purposes.

## Decomposition Guidance for Planner

Given the 14 requirements, the planner should decompose into approximately 12-15 plans:

1. **Domain entities + migration** (Activity, child entities, enums, configurations, migration) -- single plan, ~18 files
2. **Repository + repository interface** (ActivityRepository with filter/sort/pagination/status) -- single plan, ~2 files
3. **Controller: Core CRUD** (GET list, GET detail, POST create, PUT update, DELETE) -- single plan, ~1 file
4. **Controller: Status transition + comments** (PATCH status, POST/GET comments) -- single plan, extends controller
5. **Controller: Attachments + time entries** (POST/DELETE attachments, POST/GET time entries) -- single plan, extends controller
6. **Controller: Entity linking + timeline** (POST/DELETE links, GET timeline) -- single plan, extends controller
7. **Controller: Follow/watch + Kanban data** (POST/DELETE followers, GET kanban) -- single plan, extends controller
8. **Frontend: Models + service + store** (activity.models.ts, activity.service.ts, activity.store.ts) -- single plan, ~3 files
9. **Frontend: Activity list** (activity-list.component) -- single plan, ~3 files
10. **Frontend: Activity form** (activity-form.component) -- single plan, ~3 files
11. **Frontend: Activity Kanban** (activity-kanban.component) -- single plan, ~3 files
12. **Frontend: Activity calendar** (activity-calendar.component) -- single plan, ~3 files
13. **Frontend: Activity detail** (activity-detail.component with all tabs) -- single plan, ~3 files (largest)
14. **Integration: Routes, navbar, entity tab enablement, seed data** -- single plan, ~8 files
15. **RLS + custom field registration** -- single plan, extends scripts/rls-setup.sql

## Sources

### Primary (HIGH confidence)
- Existing codebase: Deal entity pattern (Deal.cs, DealConfiguration.cs, DealRepository.cs, DealsController.cs) -- establishes exact patterns for Activity
- Existing codebase: Deal Kanban component (deal-kanban.component.ts) -- CDK drag-drop pattern reusable for activity Kanban
- Existing codebase: Deal calendar component (deal-calendar.component.ts) -- FullCalendar pattern reusable for activity calendar
- Existing codebase: Deal detail component (deal-detail.component.ts) -- inline search panel pattern for entity linking
- Existing codebase: EntityType enum already includes `Activity` -- no enum changes needed
- Existing codebase: RoleTemplateSeeder.EnsurePermissionsForAllEntityTypesAsync iterates all EntityType values -- Activity permissions auto-seed
- Existing codebase: IFileStorageService with LocalFileStorageService (Phase 2) -- reuse for attachment file storage
- Existing codebase: RelatedEntityTabsComponent with COMPANY_TABS/CONTACT_TABS/DEAL_TABS having disabled Activities tabs -- ready to enable
- Existing codebase: DealStageHistory pattern -- reuse for ActivityStatusHistory
- Existing codebase: EntityTimelineComponent with TimelineEntry interface -- extend for activity-specific timeline types

### Secondary (MEDIUM confidence)
- Angular CDK drag-drop documentation -- cdkDropListGroup for connected columns (verified working in deal Kanban)
- FullCalendar Angular v6 documentation -- dayGridMonth view with eventClick (verified working in deal calendar)
- ASP.NET Core file upload documentation -- IFormFile with size limits, content type validation

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and proven in Phases 3-4; zero new dependencies
- Architecture: HIGH - entity CRUD pattern is identical to Deal/Company/Contact; Kanban/calendar are proven from Phase 4; child entities follow DealContact/DealProduct/DealStageHistory pattern
- Pitfalls: HIGH - identified from codebase analysis (state validation, polymorphic integrity, N+1 queries, tab enablement) and CRM activity management patterns

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- stable domain, no new dependencies, all patterns established)
