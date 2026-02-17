# Phase 11: Polish & Completeness - Research

**Researched:** 2026-02-17
**Domain:** Calendar views (FullCalendar), rich text notes, generic file attachments, responsive web design
**Confidence:** HIGH

## Summary

Phase 11 covers four distinct feature areas: (1) upgrading the existing FullCalendar month-only views to support day/week views with drag-and-drop rescheduling, (2) creating a new Notes entity with rich text editing linked to any CRM entity, (3) generalizing the existing activity-only attachment system to support file uploads on any entity, and (4) making the Angular app responsive on tablet and mobile screens.

The project already has strong foundations for each area. FullCalendar v6.1.20 is installed with `@fullcalendar/angular`, `@fullcalendar/core`, `@fullcalendar/daygrid`, and `@fullcalendar/interaction` -- only `@fullcalendar/timegrid` needs to be added for day/week views. The `IFileStorageService` abstraction with `LocalFileStorageService` already handles tenant-partitioned file storage for activity attachments. The `ActivityLink` entity demonstrates the polymorphic entity-linking pattern (EntityType + EntityId) needed for notes and generic attachments. The navbar and entity list layouts already have basic responsive breakpoints.

**Primary recommendation:** Extend existing patterns rather than introducing new ones. Add `@fullcalendar/timegrid` for day/week views. Use `ngx-quill` v27.x (Quill 2) for rich text notes. Generalize the existing `ActivityAttachment` pattern into a standalone `Attachment` entity with EntityType/EntityId polymorphic linking. Implement cloud storage via `AzureBlobStorageService` as a second `IFileStorageService` implementation. Use Angular CDK `BreakpointObserver` with signals for responsive layout adaptations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fullcalendar/timegrid | ^6.1.20 | Day and week time-grid views | Official FullCalendar plugin, required for timeGridDay/timeGridWeek views |
| ngx-quill | ^27.0.0 | Rich text editor for Angular 19 | Most mature Angular wrapper for Quill 2, used by Slack/LinkedIn/Figma, v27.x is the Angular 19-compatible line |
| quill | ^2.0.0 | Rich text editing engine | Peer dependency of ngx-quill, rewritten in TypeScript, modern API |
| Azure.Storage.Blobs | ^12.27.0 | Cloud blob storage for file attachments | Official Microsoft SDK, tenant-isolated containers, proven at scale |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @angular/cdk/layout | (already installed via @angular/cdk ^19.2.19) | BreakpointObserver for programmatic responsive logic | When CSS media queries alone are insufficient and component logic must change |

### Already Installed (No New Packages)
| Library | Version | In Use Since |
|---------|---------|-------------|
| @fullcalendar/angular | ^6.1.20 | Phase 4 |
| @fullcalendar/core | ^6.1.20 | Phase 4 |
| @fullcalendar/daygrid | ^6.1.20 | Phase 4 |
| @fullcalendar/interaction | ^6.1.20 | Phase 4 |
| @angular/cdk | ^19.2.19 | Phase 2 |
| @angular/material | ^19.2.19 | Phase 1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ngx-quill | ngx-editor (ProseMirror-based) | ngx-editor v18 uncertain Angular 19 support; ngx-quill v27 explicitly supports Angular 19 |
| ngx-quill | ngx-tiptap | Tiptap is more extensible but adds complexity; Quill is simpler for basic rich text notes |
| Azure.Storage.Blobs | AWS S3 SDK | Either works; Azure chosen because .NET ecosystem alignment. IFileStorageService abstraction makes swapping trivial |
| BreakpointObserver | CSS-only media queries | Some components need logic changes (hide sidebar, collapse tabs), not just style changes |

**Installation (frontend):**
```bash
cd globcrm-web
npm install @fullcalendar/timegrid@^6.1.20 ngx-quill@^27.0.0 quill@^2.0.0
```

**Installation (backend):**
```bash
cd src/GlobCRM.Infrastructure
dotnet add package Azure.Storage.Blobs --version 12.27.0
```

## Architecture Patterns

### Recommended Project Structure

**Frontend -- new features:**
```
src/app/features/
  calendar/                      # Unified calendar page (CALR-01 to CALR-05)
    calendar.component.ts        # Main calendar page with day/week/month views
    calendar.component.html
    calendar.component.scss
    calendar.service.ts           # API service for calendar-specific queries
    calendar.routes.ts
  notes/                         # Notes feature (NOTE-01 to NOTE-04)
    note.models.ts
    note.service.ts
    note.store.ts                 # Signal store (component-provided)
    note-list/                    # DynamicTable list page
    note-form/                    # Create/edit with rich text editor
    note-detail/                  # View note detail
    notes.routes.ts
src/app/shared/components/
  entity-attachments/             # Reusable attachment panel (ATCH-01 to ATCH-04)
    entity-attachments.component.ts  # Upload/preview/download for any entity
  rich-text-editor/               # Quill wrapper component
    rich-text-editor.component.ts
```

**Backend -- new entities and services:**
```
src/GlobCRM.Domain/Entities/
  Note.cs                        # New entity with rich text body + polymorphic link
  Attachment.cs                  # Generic attachment entity (EntityType + EntityId)
src/GlobCRM.Infrastructure/
  Storage/
    AzureBlobStorageService.cs   # IFileStorageService implementation for Azure Blob
  Persistence/
    Configurations/
      NoteConfiguration.cs
      AttachmentConfiguration.cs
    Repositories/
      NoteRepository.cs
src/GlobCRM.Api/Controllers/
  NotesController.cs
  AttachmentsController.cs       # Generic entity attachment endpoints
  CalendarController.cs          # Aggregated calendar endpoint
```

### Pattern 1: Unified Calendar with Multi-Source Data
**What:** A single calendar page that aggregates activities from all entities, supporting day/week/month views with filters.
**When to use:** CALR-01 through CALR-05 requirements.
**Approach:**
- Enhance the existing `ActivityCalendarComponent` (or create a new unified `CalendarComponent`) that uses `@fullcalendar/timegrid` in addition to `@fullcalendar/daygrid`
- Configure `headerToolbar.right` with `dayGridMonth,timeGridWeek,timeGridDay` for view switching
- Enable `editable: true` on the FullCalendar options for drag-and-drop rescheduling
- Use `eventDrop` callback to PATCH the activity's dueDate on the backend
- Use `dateClick` callback to open the activity creation form pre-filled with the clicked date/time
- Add filter controls (by type, owner, entity) above the calendar that filter the API query
- The existing `ActivityService.getList()` already supports `linkedEntityType` and `linkedEntityId` query params

**Example:**
```typescript
// Enhanced calendar options with day/week/month views and drag-and-drop
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

calendarOptions = signal<CalendarOptions>({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay',
  },
  editable: true,
  droppable: false,
  eventDrop: (info) => this.handleEventDrop(info),
  dateClick: (info) => this.handleDateClick(info),
  events: [],
  height: 'auto',
});

handleEventDrop(info: EventDropArg): void {
  const activityId = info.event.id;
  const newDate = info.event.start?.toISOString();
  this.activityService.updateDueDate(activityId, newDate).subscribe({
    error: () => info.revert(), // Revert on failure
  });
}

handleDateClick(info: DateClickArg): void {
  // Navigate to activity creation form with pre-filled date
  this.router.navigate(['/activities/new'], {
    queryParams: { dueDate: info.dateStr },
  });
}
```

### Pattern 2: Polymorphic Entity Linking for Notes and Attachments
**What:** Use EntityType (string) + EntityId (Guid) columns to link notes/attachments to any CRM entity, following the existing `ActivityLink` and `FeedItem` patterns.
**When to use:** NOTE-03, NOTE-04, ATCH-01 requirements.
**Example:**
```csharp
// Note.cs - follows ActivityLink pattern for polymorphic linking
public class Note
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;        // Rich text HTML content
    public string? PlainTextBody { get; set; }                // Stripped text for search
    public string EntityType { get; set; } = string.Empty;    // "Company", "Contact", "Deal", etc.
    public Guid EntityId { get; set; }                        // ID of the linked entity
    public string? EntityName { get; set; }                   // Denormalized display name
    public Guid? AuthorId { get; set; }
    public ApplicationUser? Author { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsSeedData { get; set; } = false;
}
```

```csharp
// Generic Attachment.cs - extends ActivityAttachment pattern to all entities
public class Attachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string EntityType { get; set; } = string.Empty;    // "Company", "Contact", "Deal", etc.
    public Guid EntityId { get; set; }                        // ID of the parent entity
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public Guid? UploadedById { get; set; }
    public ApplicationUser? UploadedBy { get; set; }
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Pattern 3: Cloud Storage with IFileStorageService Abstraction
**What:** Implement `AzureBlobStorageService` as a second `IFileStorageService` implementation, switched via configuration.
**When to use:** ATCH-03 (cloud storage with tenant isolation).
**Approach:**
- Create `AzureBlobStorageService : IFileStorageService` that uses Azure Blob containers partitioned by tenant
- Container naming: `tenant-{tenantId}` or single container with virtual directories `{tenantId}/{category}/{file}`
- Register conditionally in DI: `if (config["FileStorage:Provider"] == "Azure")` use Azure, else use Local
- Existing code using `IFileStorageService` needs zero changes

**Example:**
```csharp
public class AzureBlobStorageService : IFileStorageService
{
    private readonly BlobServiceClient _blobClient;

    public AzureBlobStorageService(IConfiguration config)
    {
        var connectionString = config["FileStorage:Azure:ConnectionString"];
        _blobClient = new BlobServiceClient(connectionString);
    }

    public async Task<string> SaveFileAsync(string tenantId, string category,
        string fileName, byte[] data, CancellationToken ct = default)
    {
        var containerName = "attachments";
        var container = _blobClient.GetBlobContainerClient(containerName);
        await container.CreateIfNotExistsAsync(cancellationToken: ct);

        var blobPath = $"{tenantId}/{category}/{fileName}";
        var blob = container.GetBlobClient(blobPath);
        await blob.UploadAsync(new BinaryData(data), overwrite: true, ct);
        return blobPath;
    }
    // ... GetFileAsync, DeleteFileAsync follow same pattern
}
```

### Pattern 4: Responsive Design with BreakpointObserver + Signals
**What:** Use Angular CDK's `BreakpointObserver` converted to signals for responsive UI logic.
**When to use:** RESP-01 to RESP-03 when component behavior (not just style) needs to change.
**Example:**
```typescript
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({ ... })
export class NavbarComponent {
  private breakpointObserver = inject(BreakpointObserver);

  isMobile = toSignal(
    this.breakpointObserver.observe([Breakpoints.Handset])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  isTablet = toSignal(
    this.breakpointObserver.observe([Breakpoints.Tablet])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );
}
```

### Pattern 5: Reusable Entity Attachments Component
**What:** A shared component that handles file upload, preview, download, and delete for any entity type.
**When to use:** ATCH-01, ATCH-02. Embedded in entity detail pages.
**Approach:**
- Accepts `entityType` and `entityId` as inputs
- Handles file selection, validation (size, extension), upload progress
- Shows file list with icons based on MIME type
- Preview images inline, download others
- Follows existing activity attachment UI patterns from Phase 5

### Anti-Patterns to Avoid
- **Separate calendar components per entity:** Don't create a separate calendar for deals, activities, etc. Use one unified calendar component with filters. The existing deal-calendar and activity-calendar are separate because Phase 4/5 were limited scope -- Phase 11 should unify them.
- **Storing rich text as JSON:** Store HTML string from Quill directly. Don't serialize Quill's Delta format -- HTML is more portable and searchable.
- **Entity-specific attachment tables:** Don't create CompanyAttachment, ContactAttachment, DealAttachment, etc. Use one generic `Attachment` table with EntityType/EntityId columns, following the ActivityLink pattern.
- **CSS-only responsive approach:** Some components genuinely need different behavior on mobile (collapsed navbar, simplified tables). Use BreakpointObserver for these cases, not just CSS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich text editing | Custom contenteditable implementation | ngx-quill (Quill 2) | XSS sanitization, clipboard handling, toolbar, undo/redo, mobile support -- all handled |
| Calendar views | Custom date grid with drag-and-drop | @fullcalendar/timegrid + interaction | Time slot rendering, event overlap, drag-and-drop snap-to-slot, timezone handling |
| File preview | Custom file viewer for images/PDFs | Browser-native preview + object URLs | `<img>` for images, `<iframe>` or `<object>` for PDFs, download for everything else |
| Cloud storage abstraction | Custom HTTP client for blob storage | Azure.Storage.Blobs SDK | Retry policies, streaming uploads, SAS token generation, error handling |
| Responsive breakpoints | Manual window.innerWidth checks | @angular/cdk BreakpointObserver | Handles SSR, debouncing, cleanup, predefined breakpoint constants |
| HTML sanitization for notes | Custom regex-based sanitizer | Angular DomSanitizer + server-side HtmlSanitizer | XSS prevention requires battle-tested solutions |

**Key insight:** Each of these domains (rich text, calendar, file storage, responsive design) has deep edge cases that make custom solutions fragile. The existing codebase already demonstrates this wisdom -- it uses FullCalendar rather than a custom calendar, Angular CDK drag-drop rather than custom D&D, etc.

## Common Pitfalls

### Pitfall 1: FullCalendar Event Mutation on Drag-and-Drop
**What goes wrong:** Event data becomes stale after drag-and-drop because the local event object is mutated but the server update fails, leaving UI and server out of sync.
**Why it happens:** FullCalendar mutates the event in place when dropped. If the API call fails, the UI shows the event at the new position.
**How to avoid:** Use `info.revert()` in the `eventDrop` error handler to snap the event back to its original position on API failure.
**Warning signs:** Events appear to move successfully but show old dates after page refresh.

### Pitfall 2: Quill Editor Content Sanitization
**What goes wrong:** Rich text from Quill contains potentially unsafe HTML that could lead to XSS when rendered.
**Why it happens:** Quill produces HTML output that may include script tags or event handlers from paste operations.
**How to avoid:** Sanitize HTML on the server before storage using a whitelist-based sanitizer (e.g., HtmlSanitizer NuGet). On the frontend, use Angular's `[innerHTML]` binding which auto-sanitizes, or use `DomSanitizer.bypassSecurityTrustHtml()` only after server-side sanitization.
**Warning signs:** Pasting from external sources produces unexpected rendering or script execution.

### Pitfall 3: File Upload Size Limits in Multiple Layers
**What goes wrong:** File uploads fail with 413 or timeout errors even though the application code allows the file size.
**Why it happens:** File size limits exist at multiple layers: Kestrel (28.6MB default), IIS/nginx reverse proxy, Angular HttpClient, and Azure Blob limits.
**How to avoid:** Configure `MaxRequestBodySize` in Kestrel, set `[RequestSizeLimit]` attribute on controller actions, match frontend validation limits (already 25MB in existing code), and ensure proxy configuration allows the same size.
**Warning signs:** Small files upload fine but files over ~28MB fail silently or with cryptic errors.

### Pitfall 4: Navbar Overflow on Mobile
**What goes wrong:** The navbar with 13+ links overflows horizontally on mobile screens, becoming unusable.
**Why it happens:** The current navbar renders all links inline. At 640px and below, even with small font sizes, 13 links don't fit.
**How to avoid:** On mobile breakpoints, replace the inline link list with a hamburger menu (MatSidenav or MatMenu). The existing navbar already hides some elements at 768px and 640px breakpoints, but this isn't sufficient for 13 links on phone screens.
**Warning signs:** Horizontal scrollbar appears on mobile, links are cut off or overlapping.

### Pitfall 5: Missing Tenant Isolation on Generic Attachments
**What goes wrong:** Attachments from one tenant are accessible to another tenant due to missing tenant filtering.
**Why it happens:** The generic `Attachment` entity is new and might not be added to the EF Core tenant filter and RLS policy.
**How to avoid:** Follow the triple-layer isolation pattern used for all other tenant-scoped entities: (1) TenantId property, (2) EF Core global query filter, (3) PostgreSQL RLS policy. Also partition cloud storage by tenant ID in the blob path.
**Warning signs:** Data leak in multi-tenant scenarios. Test by creating attachments in two different tenants and verifying isolation.

### Pitfall 6: Calendar Performance with Large Activity Counts
**What goes wrong:** Calendar becomes slow with hundreds of events loaded for a month view.
**Why it happens:** Loading all activities upfront (current pattern uses `pageSize: 200`) doesn't scale when users have thousands of activities.
**How to avoid:** Use FullCalendar's `events` as a function (or `eventSources` with a fetcher) that queries the backend with date range parameters. FullCalendar provides `start` and `end` dates automatically when the view changes. Create a dedicated calendar endpoint that accepts date range params.
**Warning signs:** Slow page load, browser lag when switching months.

### Pitfall 7: Rich Text Display in Dynamic Tables
**What goes wrong:** Rich text HTML renders as raw HTML tags in the notes list table.
**Why it happens:** The DynamicTable component displays text content, not HTML. Rich text body content needs to be stripped to plain text for list views.
**How to avoid:** Store both `Body` (HTML) and `PlainTextBody` (stripped text) on the Note entity. Use `PlainTextBody` for list display and search. Generate `PlainTextBody` server-side when saving.
**Warning signs:** HTML tags visible in table cells, search not finding content within formatting tags.

## Code Examples

### FullCalendar TimeGrid with Day/Week/Month + Drag-and-Drop
```typescript
// Source: https://fullcalendar.io/docs/timegrid-view + https://fullcalendar.io/docs/event-dragging-resizing
import { CalendarOptions, EventDropArg, DateClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

calendarOptions = signal<CalendarOptions>({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay',
  },
  editable: true,                // Enable drag-and-drop
  eventStartEditable: true,      // Allow moving event start
  eventDurationEditable: true,   // Allow resizing
  snapDuration: '00:15:00',      // Snap to 15-min intervals
  slotDuration: '00:30:00',      // 30-min time slots
  allDaySlot: true,              // Show all-day row
  height: 'auto',
  eventDrop: (info: EventDropArg) => { /* PATCH dueDate */ },
  dateClick: (info: DateClickArg) => { /* Navigate to create form */ },
  eventClick: (info) => { /* Navigate to activity detail */ },
});
```

### ngx-quill Rich Text Editor in Angular 19 Standalone Component
```typescript
// Source: https://github.com/KillerCodeMonkey/ngx-quill
import { QuillModule } from 'ngx-quill';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, QuillModule],
  template: `
    <quill-editor
      formControlName="body"
      [styles]="{ height: '200px' }"
      [modules]="quillModules"
      placeholder="Write your note..."
    ></quill-editor>
  `,
})
export class NoteFormComponent {
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ header: [1, 2, 3, false] }],
      ['link'],
      ['clean'],
    ],
  };
}
```

**Note:** Quill 2 CSS must be imported in `angular.json` styles array:
```json
"styles": [
  "node_modules/quill/dist/quill.snow.css",
  "src/styles.scss"
]
```

### Generic Attachment Upload Endpoint
```csharp
// Source: Existing pattern from ActivitiesController.cs attachment endpoints
[HttpPost("api/{entityType}/{entityId:guid}/attachments")]
[RequestSizeLimit(25 * 1024 * 1024)] // 25MB
public async Task<IActionResult> Upload(string entityType, Guid entityId, IFormFile file)
{
    // Validate entity type is allowed
    var allowedTypes = new[] { "company", "contact", "deal", "quote", "activity", "request" };
    if (!allowedTypes.Contains(entityType.ToLower()))
        return BadRequest(new { error = $"Invalid entity type: {entityType}" });

    // Validate entity exists (query correct table based on entityType)
    // Validate file size, extension (reuse existing 25MB/blocked-extension logic)

    var storageName = $"{Guid.NewGuid()}_{file.FileName}";
    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);
    var storagePath = await _fileStorageService.SaveFileAsync(
        tenantId.ToString(), "attachments", storageName, ms.ToArray());

    var attachment = new Attachment
    {
        EntityType = entityType,
        EntityId = entityId,
        FileName = file.FileName,
        StoragePath = storagePath,
        ContentType = file.ContentType,
        FileSizeBytes = file.Length,
        UploadedById = userId,
    };
    _db.Attachments.Add(attachment);
    await _db.SaveChangesAsync();
    return Created($"api/{entityType}/{entityId}/attachments/{attachment.Id}", ...);
}
```

### BreakpointObserver with Signals for Responsive Logic
```typescript
// Source: https://material.angular.dev/cdk/layout/api
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({ ... })
export class NavbarComponent {
  private breakpoints = inject(BreakpointObserver);

  isMobile = toSignal(
    this.breakpoints.observe(['(max-width: 768px)'])
      .pipe(map(r => r.matches)),
    { initialValue: false }
  );

  // In template: @if (isMobile()) { hamburger menu } @else { inline links }
}
```

### Entity Attachments Shared Component
```typescript
// Reusable attachment panel for any entity detail page
@Component({
  selector: 'app-entity-attachments',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="attachments-panel">
      <div class="attachments-header">
        <h3>Attachments</h3>
        <button mat-flat-button (click)="fileInput.click()">
          <mat-icon>upload_file</mat-icon> Upload
        </button>
        <input #fileInput type="file" hidden (change)="onFileSelected($event)" />
      </div>
      @if (isUploading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }
      @for (file of attachments(); track file.id) {
        <div class="attachment-item">
          <mat-icon>{{ getFileIcon(file.contentType) }}</mat-icon>
          <span>{{ file.fileName }}</span>
          <span class="file-size">{{ formatSize(file.fileSizeBytes) }}</span>
          <button mat-icon-button (click)="download(file)">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button (click)="delete(file)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
})
export class EntityAttachmentsComponent {
  entityType = input.required<string>();
  entityId = input.required<string>();
  // ... upload/download/delete methods using AttachmentService
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FullCalendar dayGridMonth only | dayGrid + timeGrid with day/week/month views | Phase 11 upgrade | Users get proper hourly scheduling |
| Activity-only attachments | Generic entity attachments (any entity) | Phase 11 extension | Unified file management across CRM |
| No notes entity | Rich text notes linked to any entity | Phase 11 addition | Enables freeform documentation on entities |
| Desktop-only layout | Responsive with tablet/mobile breakpoints | Phase 11 enhancement | Broader device support |
| Quill 1.x (old ngx-quill) | Quill 2.0 (TypeScript rewrite) | April 2024 | Better clipboard, better mobile, TypeScript types |
| LocalFileStorageService only | IFileStorageService with Azure Blob option | Phase 11 addition | Production-ready cloud storage |

**Deprecated/outdated:**
- Quill 1.x: Replaced by Quill 2.0 which is a TypeScript rewrite. ngx-quill v27+ requires Quill ^2.0.0.
- FullCalendar v5: Project uses v6.1.20. v7 is in beta but not needed -- v6 is fully capable.

## Existing Codebase Assets to Leverage

This section documents what already exists and should be extended, not replaced.

### Calendar
- `ActivityCalendarComponent` at `features/activities/activity-calendar/` -- uses dayGridMonth, priority coloring, eventClick navigation. **Extend or replace** with unified calendar supporting all views.
- `DealCalendarComponent` at `features/deals/deal-calendar/` -- uses dayGridMonth with pipeline filter. **Replace** with unified calendar.
- Backend `ActivitiesController.GetList` already supports `linkedEntityType` and `linkedEntityId` query params for entity-scoped activity queries.
- Activity `DueDate` field is the calendar event date.

### Attachments
- `IFileStorageService` interface at `Infrastructure/Storage/` with `SaveFileAsync`, `GetFileAsync`, `DeleteFileAsync` -- all tenant-partitioned.
- `LocalFileStorageService` implementation -- works for development, Azure for production.
- `ActivityAttachment` entity -- provides the model for generic `Attachment` entity.
- `ActivitiesController` attachment endpoints (upload/download/delete) -- provides the pattern for generic attachment endpoints.
- File validation: 25MB max, blocked extensions (.exe, .bat, .cmd, .ps1, .sh) -- reuse these rules.

### Timeline
- `EntityTimelineComponent` at `shared/components/entity-timeline/` -- already supports `note` type in its icon/color maps.
- `TimelineEntry` interface in `shared/models/query.models.ts` -- already has `note` as a valid type.
- All entity controllers (Companies, Contacts, Deals, Quotes, Requests) have `/timeline` endpoints.

### Responsive
- Navbar has responsive breakpoints at 1024px, 768px, 640px -- needs extension for hamburger menu on mobile.
- Entity list layout (`_entity-list.scss`) has basic responsive at 768px.
- Tailwind CSS is configured with design tokens.
- Angular CDK already installed.

### Related Entity Tabs
- `RelatedEntityTabsComponent` has `Notes` tab defined but disabled (`enabled: false`) for COMPANY_TABS and CONTACT_TABS.
- Entity type enum includes: Contact, Company, Deal, Activity, Quote, Request, Product.
- `Note` entity type needs to be added to the EntityType enum.

## Open Questions

1. **Cloud Storage Provider Decision**
   - What we know: The IFileStorageService abstraction already exists. Azure Blob SDK is the standard for .NET.
   - What's unclear: Whether the user wants Azure Blob, AWS S3, or to keep LocalFileStorageService for now and just design for future cloud swap.
   - Recommendation: Implement AzureBlobStorageService as a concrete implementation, but keep LocalFileStorageService as default for development. The abstraction makes this a configuration choice, not a code change. If no Azure account is available, the planner should make AzureBlobStorageService code-complete but defaulting to local storage.

2. **Navbar Responsive Strategy**
   - What we know: 13 nav links need to fit on mobile. Current approach just shrinks fonts. The navbar already has responsive breakpoints.
   - What's unclear: Whether to use a hamburger menu (MatSidenav), a bottom tab bar, or horizontal scrolling.
   - Recommendation: Use a hamburger menu with MatSidenav on mobile (<768px). This is the standard CRM pattern. Keep the top navbar for desktop.

3. **Calendar vs Activities Calendar Route**
   - What we know: Current `/activities/calendar` route exists with month-only view. Phase 11 adds day/week views.
   - What's unclear: Whether to add a top-level `/calendar` route (new navbar item) or upgrade the existing `/activities/calendar`.
   - Recommendation: Add a top-level `/calendar` route with its own navbar link. The unified calendar shows activities from ALL entities, not just the activities module. Keep `/activities/calendar` as a redirect or remove it in favor of the new top-level page. Add "Calendar" to the navbar between "Activities" and "Quotes" (or between "Feed" and "Team").

4. **Notes in Navbar**
   - What we know: Notes are a new entity with list/detail/form pages and DynamicTable.
   - What's unclear: Whether Notes should appear in the main navbar or only be accessible from entity detail tabs.
   - Recommendation: Add "Notes" to the navbar. The NOTE-02 requirement explicitly says "Notes list page uses dynamic table" implying a standalone list page. Place it after "Requests" in the navbar.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis -- ActivityCalendarComponent, DealCalendarComponent, IFileStorageService, ActivityAttachment, EntityTimelineComponent, RelatedEntityTabsComponent, NavbarComponent
- FullCalendar official docs (https://fullcalendar.io/docs/timegrid-view) -- TimeGrid view setup and options
- FullCalendar plugin index (https://fullcalendar.io/docs/plugin-index) -- Confirmed @fullcalendar/timegrid provides timeGridWeek/timeGridDay views
- FullCalendar event dragging docs (https://fullcalendar.io/docs/event-dragging-resizing) -- editable, eventDrop, eventResize, info.revert()
- FullCalendar Angular connector (https://fullcalendar.io/docs/angular) -- Supports Angular 12-20, CalendarOptions binding

### Secondary (MEDIUM confidence)
- ngx-quill GitHub README (https://github.com/KillerCodeMonkey/ngx-quill) -- v27.x for Angular 19, peer dependency quill ^2.0.0
- ngx-quill releases (https://github.com/KillerCodeMonkey/ngx-quill/releases) -- v27.x confirmed for Angular 19 support until May 2026
- Azure.Storage.Blobs NuGet (https://www.nuget.org/packages/Azure.Storage.Blobs) -- v12.27.0 stable, .NET 10 compatible
- Angular CDK BreakpointObserver (https://material.angular.dev/cdk/layout/api) -- observe(), isMatched(), Breakpoints constants

### Tertiary (LOW confidence)
- Rich text editor comparison (https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) -- Quill recommended as "fastest to implement" with smaller bundle

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- FullCalendar timegrid is the obvious extension of existing setup; ngx-quill v27 explicitly supports Angular 19; Azure Blob SDK is the .NET standard
- Architecture: HIGH -- All patterns extend existing codebase conventions (polymorphic linking, IFileStorageService, signal stores, shared components)
- Pitfalls: HIGH -- Identified from existing codebase patterns and official documentation (revert on drag failure, HTML sanitization, multi-layer upload limits, tenant isolation)
- Responsive design: MEDIUM -- BreakpointObserver approach is well-documented but the specific navbar strategy (hamburger menu) is a recommendation, not a verified pattern in this codebase

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- all libraries are stable releases)
