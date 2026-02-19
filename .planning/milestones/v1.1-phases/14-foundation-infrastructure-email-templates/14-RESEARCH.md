# Phase 14: Foundation Infrastructure & Email Templates - Research

**Researched:** 2026-02-19
**Domain:** Background job infrastructure, EF Core domain events, drag-and-drop email template builder with Liquid merge fields
**Confidence:** HIGH

## Summary

This phase delivers two distinct workstreams: (1) shared infrastructure — Hangfire background jobs with PostgreSQL storage, a TenantScope wrapper for tenant-safe job execution, and a DomainEventInterceptor for entity lifecycle events; and (2) a user-facing email template builder with drag-and-drop editing, merge field support, categories, preview, and test send.

The infrastructure workstream is well-understood. Hangfire.PostgreSql 1.21.1 provides PostgreSQL storage with automatic schema management. The TenantScope wrapper pattern uses Hangfire's `IClientFilter`/`IServerFilter` job filter mechanism to stamp a tenant ID when enqueuing and restore it during execution. The DomainEventInterceptor follows the established `SaveChangesInterceptor` pattern already used by `AuditableEntityInterceptor` in this codebase, capturing entity state changes in `SavingChangesAsync` and dispatching events in `SavedChangesAsync`.

For the email template builder, the recommendation is **Unlayer** (`angular-email-editor`). It provides an official Angular wrapper with standalone component support, iframe-based isolation (no CSS conflicts), a polished Mailchimp-like drag-and-drop experience, and supports custom merge tags and design JSON format. The free tier works without an API key for development, and the editor is embeddable without a paid plan. GrapesJS (`ngx-grapesjs`) is a viable open-source alternative but requires significantly more integration effort for email-specific features. For server-side template rendering, **Fluid** (Fluid.Core 2.31.0) is the recommended Liquid template engine — it is 40-60% faster than Scriban, purpose-built for Liquid, and supports async filters for database-backed merge field resolution.

**Primary recommendation:** Use Unlayer for the visual email builder (Angular), Fluid for server-side Liquid rendering (.NET), Hangfire.PostgreSql for background jobs, and build a simple DomainEventInterceptor alongside the existing AuditableEntityInterceptor.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use an existing open-source email builder library (e.g. Unlayer, GrapeJS, EmailBuilder.js) embedded in Angular — not a custom build
- Full HTML email builder with drag-and-drop blocks (header, columns, image, button, divider) — like Mailchimp's editor
- Merge field insertion via both: toolbar dropdown menu (browse fields grouped by entity) AND inline {{ typing with autocomplete (for power users)
- Merge fields render as styled chip/badge pills inside the editor (e.g. colored [Contact: First Name]) — visually distinct from regular text
- Available merge field sources: core CRM entities — Contact, Company, Deal, Lead
- Custom fields (JSONB) are available as merge fields — any admin-defined custom field on Contact, Company, Deal, Lead can be used in templates
- Configurable fallback values per merge field — template author sets fallback (e.g. {{first_name | 'there'}}) so missing data renders gracefully
- Categories: predefined starter categories (Sales, Support, Marketing, General) plus user-created custom categories
- Seeded starter templates included out of the box — common scenarios (welcome email, follow-up, meeting request, deal won) that users can clone and customize
- Permissions follow existing RBAC system — new permission like 'EmailTemplate:Create/Edit/Delete' with scope control
- Preview defaults to sample data for quick preview, with option to select a real CRM entity for accurate merge field resolution
- "Send test" button sends the rendered template to the user's own email address for inbox testing
- Desktop + mobile preview toggle — switch between desktop (600px+) and mobile (320px) widths to check responsiveness
- Template list page shows visual thumbnails/rendered previews of each email template for easy scanning

### Claude's Discretion
- Nested merge field depth (one level vs full dot notation) — balance complexity vs real-world usefulness
- Personal vs shared template visibility model — align with existing codebase permission patterns
- Specific email builder library choice — research Angular 19 compatibility and pick the best fit
- Infrastructure details: Hangfire queue configuration, DomainEventInterceptor ordering with AuditableEntityInterceptor, TenantScope implementation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ETMPL-01 | User can create rich text email templates with a WYSIWYG editor | Unlayer provides drag-and-drop HTML email builder with Angular wrapper; editor stores design as JSON + exports HTML |
| ETMPL-02 | User can insert merge fields (contact, deal, company fields) into templates | Unlayer supports custom merge tags via `mergeTags` config and `setMergeTags()` API; Fluid renders Liquid `{{ }}` syntax server-side |
| ETMPL-03 | User can organize templates into categories (Sales, Support, Follow-up, etc.) | EmailTemplateCategory entity with tenant-scoped categories; seeded starter categories (Sales, Support, Marketing, General) |
| ETMPL-04 | User can preview a template with real entity data before sending | Fluid `TemplateContext` renders merge fields with entity data; preview endpoint loads entity by ID and renders template |
| ETMPL-05 | User can clone/duplicate an existing template | Clone endpoint copies EmailTemplate entity with design JSON, resets audit fields; straightforward CRUD operation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hangfire.AspNetCore | 1.8.x | Background job framework for .NET | Industry-standard .NET background processing; dashboard, retries, scheduling built-in |
| Hangfire.PostgreSql | 1.21.1 | PostgreSQL storage for Hangfire | Uses existing PostgreSQL database; automatic schema management; no Redis needed |
| Fluid.Core | 2.31.0 | Liquid template engine for .NET | 40-60% faster than Scriban for Liquid; purpose-built; async filter support for DB queries |
| angular-email-editor | 15.2.0+ | Unlayer Angular wrapper for drag-and-drop email builder | Official Angular wrapper; standalone component support; iframe isolation; rich merge tag API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Hangfire.Console | latest | Logging within Hangfire jobs | Optional: helpful for debugging job execution in dashboard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Unlayer | GrapesJS (ngx-grapesjs v21) | Fully open-source; but email-specific features require more plugins and configuration; newsletter preset less polished than Unlayer |
| Unlayer | EmailBuilder.js | React-first; Angular integration requires iframe or web components; less mature Angular support |
| Fluid | Scriban | More powerful scripting; but Fluid is faster for pure Liquid use and simpler API |
| Hangfire | Quartz.NET | More lightweight; but lacks dashboard, PostgreSQL storage adapter, retry policies out of box |

**Installation:**

Backend:
```bash
cd src/GlobCRM.Infrastructure
dotnet add package Hangfire.AspNetCore
dotnet add package Hangfire.PostgreSql
dotnet add package Fluid.Core
```

Frontend:
```bash
cd globcrm-web
npm install angular-email-editor
```

## Architecture Patterns

### Recommended Project Structure

Backend additions:
```
src/GlobCRM.Domain/Entities/
├── EmailTemplate.cs              # Template entity with design JSON, HTML, metadata
├── EmailTemplateCategory.cs      # Category entity (tenant-scoped)
src/GlobCRM.Domain/Enums/
├── EntityType.cs                 # Add EmailTemplate value
src/GlobCRM.Domain/Interfaces/
├── IDomainEvent.cs               # Marker interface for domain events
├── IDomainEventDispatcher.cs     # Dispatcher abstraction
src/GlobCRM.Infrastructure/
├── BackgroundJobs/
│   ├── HangfireServiceExtensions.cs    # AddHangfireServices() DI extension
│   ├── TenantJobFilter.cs              # IClientFilter + IServerFilter for tenant propagation
│   ├── TenantScope.cs                  # Static helper for enqueueing tenant-scoped jobs
│   └── TenantJobActivator.cs           # Optional: custom activator for tenant scope
├── DomainEvents/
│   ├── DomainEventInterceptor.cs       # SaveChangesInterceptor for domain events
│   ├── DomainEventDispatcher.cs        # Dispatches events to handlers
│   └── DomainEventServiceExtensions.cs # AddDomainEventServices()
├── EmailTemplates/
│   ├── EmailTemplateRepository.cs      # Repository implementation
│   ├── MergeFieldService.cs            # Resolves merge fields from entity data
│   ├── TemplateRenderService.cs        # Uses Fluid to render templates
│   └── EmailTemplateServiceExtensions.cs
├── Persistence/Configurations/
│   ├── EmailTemplateConfiguration.cs
│   └── EmailTemplateCategoryConfiguration.cs
src/GlobCRM.Api/Controllers/
├── EmailTemplatesController.cs         # CRUD + preview + test-send + clone
├── EmailTemplateCategoriesController.cs # Category CRUD
├── MergeFieldsController.cs            # Available merge fields endpoint
```

Frontend additions:
```
globcrm-web/src/app/features/email-templates/
├── email-templates.routes.ts
├── email-template.models.ts
├── email-template.service.ts
├── email-template.store.ts
├── email-template-list/
│   ├── email-template-list.component.ts
│   └── email-template-list.component.html
├── email-template-editor/
│   ├── email-template-editor.component.ts    # Unlayer editor wrapper
│   └── email-template-editor.component.html
├── email-template-preview/
│   ├── email-template-preview.component.ts   # Desktop/mobile preview toggle
│   └── email-template-preview.component.html
└── merge-field-panel/
    ├── merge-field-panel.component.ts        # Grouped merge field browser
    └── merge-field-panel.component.html
```

### Pattern 1: DomainEventInterceptor (capture before save, dispatch after save)

**What:** A `SaveChangesInterceptor` that captures entity state changes (Added/Modified/Deleted) in `SavingChangesAsync` (before commit) and dispatches domain events in `SavedChangesAsync` (after successful commit).

**When to use:** For cross-cutting concerns triggered by entity lifecycle events — webhooks, workflows, duplicate detection, audit trails.

**Example:**
```csharp
// Pattern follows existing AuditableEntityInterceptor in codebase
public class DomainEventInterceptor : SaveChangesInterceptor
{
    private readonly IDomainEventDispatcher _dispatcher;
    // Thread-local storage for captured events during SavingChanges
    private static readonly AsyncLocal<List<DomainEvent>> _pendingEvents = new();

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not null)
        {
            // Capture entity states BEFORE save (states reset after SaveChanges)
            var events = new List<DomainEvent>();
            foreach (var entry in eventData.Context.ChangeTracker.Entries())
            {
                if (entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
                {
                    events.Add(new DomainEvent(
                        entry.Entity.GetType().Name,
                        entry.State,
                        entry.Entity));
                }
            }
            _pendingEvents.Value = events;
        }
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        // Dispatch AFTER successful save
        var events = _pendingEvents.Value;
        if (events?.Count > 0)
        {
            foreach (var evt in events)
                await _dispatcher.DispatchAsync(evt, cancellationToken);
            _pendingEvents.Value = null;
        }
        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }
}
```

**Key insight:** Entity states are reset after `SaveChanges` completes, so you MUST capture them in `SavingChangesAsync` and dispatch in `SavedChangesAsync`. Use `AsyncLocal<T>` to bridge the two phases safely across async boundaries.

### Pattern 2: TenantJobFilter (Hangfire tenant context propagation)

**What:** A Hangfire job filter that stamps the current tenant ID when a job is enqueued (client side) and restores it when the job executes (server side).

**When to use:** Every background job in a multi-tenant system. Without this, jobs execute without tenant context, causing RLS failures and incorrect data access.

**Example:**
```csharp
public class TenantJobFilter : IClientFilter, IServerFilter
{
    public void OnCreating(CreatingContext context)
    {
        // Stamp tenant ID when job is enqueued (HTTP request context is available)
        var tenantProvider = GetService<ITenantProvider>(context);
        var tenantId = tenantProvider?.GetTenantId();
        if (tenantId.HasValue)
            context.SetJobParameter("TenantId", tenantId.Value.ToString());
    }

    public void OnPerforming(PerformingContext context)
    {
        // Restore tenant ID when job executes (no HTTP context)
        var tenantIdStr = context.GetJobParameter<string>("TenantId");
        if (Guid.TryParse(tenantIdStr, out var tenantId))
        {
            // Set tenant context for this execution scope
            // This could set a static AsyncLocal or resolve via DI
            TenantScope.SetCurrentTenant(tenantId);
        }
    }

    // OnCreated, OnPerformed — no-op
}
```

### Pattern 3: EmailTemplate Entity with Unlayer Design JSON

**What:** The `EmailTemplate` entity stores both the Unlayer design JSON (for editing) and the rendered HTML (for sending). The design JSON preserves the full editor state; the HTML is the compiled output.

**When to use:** Every template save operation should store both formats.

**Example:**
```csharp
public class EmailTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subject { get; set; }  // Email subject line (also supports merge fields)
    public string DesignJson { get; set; } = "{}";  // Unlayer editor state
    public string HtmlBody { get; set; } = string.Empty;  // Compiled HTML output
    public Guid? CategoryId { get; set; }
    public EmailTemplateCategory? Category { get; set; }
    public Guid? OwnerId { get; set; }  // Creator/owner for RBAC scope
    public ApplicationUser? Owner { get; set; }
    public bool IsShared { get; set; } = true;  // false = personal template
    public bool IsSeedData { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
```

### Pattern 4: Merge Field Resolution with Fluid

**What:** A service that builds a `TemplateContext` from CRM entity data and renders merge fields using Fluid's Liquid parser.

**When to use:** Template preview, test send, and actual email sending.

**Example:**
```csharp
public class TemplateRenderService
{
    private readonly FluidParser _parser = new();

    public string Render(string htmlTemplate, Dictionary<string, object?> mergeData)
    {
        if (!_parser.TryParse(htmlTemplate, out var template, out var error))
            throw new InvalidOperationException($"Template parse error: {error}");

        var context = new TemplateContext();

        // Register merge fields as nested objects: contact.first_name, company.name
        foreach (var (key, value) in mergeData)
            context.SetValue(key, value);

        return template.Render(context);
    }
}
```

### Anti-Patterns to Avoid

- **Don't dispatch domain events inside SavingChangesAsync:** Events would fire even if the save fails. Always dispatch in `SavedChangesAsync`.
- **Don't use HttpContext in background jobs:** There is no HTTP context in Hangfire jobs. Use the TenantJobFilter pattern to propagate tenant context via job parameters.
- **Don't store only HTML without design JSON:** The Unlayer editor needs its own JSON format to reload designs. Storing only HTML means templates cannot be edited after creation.
- **Don't render merge fields client-side:** Merge field resolution must happen server-side (Fluid) to access real entity data, custom fields, and related entities securely.
- **Don't use MediatR for domain events:** The codebase uses hand-rolled command/handler classes (no MediatR). Domain events should follow the same hand-rolled pattern for consistency.

## Discretion Decisions (Recommendations)

### 1. Nested Merge Field Depth
**Recommendation: One level of dot notation (e.g., `contact.company.name`)**

Supporting evidence from codebase: Contact has a `CompanyId` FK, Deal has `CompanyId` and `DealContacts`. One level of related entity access covers the most common use cases:
- `contact.company.name` — contact's company
- `deal.company.name` — deal's company
- `lead.source.name` — lead's source

Going deeper (e.g., `contact.company.deals[0].title`) adds significant complexity with diminishing returns. Available merge fields should be:
- Direct entity fields: `contact.first_name`, `contact.email`, etc.
- One-level relations: `contact.company.name`, `deal.company.industry`
- Custom fields: `contact.custom.field_name` (using the custom field definition's Name property)

### 2. Personal vs Shared Template Visibility
**Recommendation: Shared by default, with personal option via `IsShared` boolean + OwnerId**

Evidence from codebase: The existing RBAC system uses `OwnerId` with `PermissionScope` (None/Own/Team/All). The pattern is:
- Templates have an `OwnerId` (creator) and `IsShared` flag
- `IsShared = true`: visible to all users with `EmailTemplate:View` permission (scope applies)
- `IsShared = false`: visible only to the owner (personal template)
- RBAC scoping works identically to Contact/Deal/Company: `Own` scope sees own templates, `Team` sees team templates, `All` sees all shared templates

This aligns with the existing `SavedView` entity which has both `IsShared` and `CreatedByUserId` for the same pattern.

### 3. Email Builder Library Choice
**Recommendation: Unlayer (`angular-email-editor`)**

| Criterion | Unlayer | GrapesJS | EmailBuilder.js |
|-----------|---------|----------|-----------------|
| Angular wrapper | Official (`angular-email-editor`) | Community (`ngx-grapesjs` v21) | None (React-first, iframe needed) |
| Standalone component | Yes (import `EmailEditorModule`) | Yes (import `NgxNewsletterEditorComponent`) | N/A |
| Email-specific blocks | Built-in (header, columns, button, image, divider) | Via `grapesjs-preset-newsletter` plugin | Built-in |
| Merge tag support | Native `mergeTags` config + `setMergeTags()` API | Custom implementation needed | Limited |
| Design JSON format | Proprietary but well-documented | Custom | JSON |
| Free tier | Works without API key; watermark in free mode | Fully open source | Fully open source |
| Integration effort | Low (drop-in component) | Medium (plugin assembly) | High (no Angular wrapper) |
| Production UX polish | High (Mailchimp-like) | Medium (general web builder adapted for email) | Medium |

Unlayer wins on: official Angular support, merge tag API, email-specific UX, and lowest integration effort. The free tier works for development. For production, a project ID can optionally be configured for premium features, but the core editor functions without one.

**Risk mitigation:** The Unlayer design JSON is stored alongside rendered HTML. If the library is ever swapped, existing templates retain their HTML output. The design JSON becomes non-editable but content is preserved.

### 4. Infrastructure Details

**Hangfire queue configuration:**
```
Queues: ["default", "emails", "webhooks", "workflows"]
```
- `default` — general background jobs
- `emails` — email sending (sequence steps, template test sends)
- `webhooks` — webhook delivery (Phase 15)
- `workflows` — workflow execution (Phase 19)

Each queue can be scaled independently by adding dedicated Hangfire servers later.

**DomainEventInterceptor ordering with AuditableEntityInterceptor:**
- `AuditableEntityInterceptor` runs in `SavingChangesAsync` (before save) — sets audit timestamps
- `DomainEventInterceptor` runs in both `SavingChangesAsync` (captures state) and `SavedChangesAsync` (dispatches)
- Registration order in DI: `AuditableEntityInterceptor` first, then `DomainEventInterceptor`
- This ensures audit timestamps are set before the DomainEventInterceptor captures entity snapshots

**TenantScope implementation:**
- `TenantJobFilter` implements `IClientFilter` + `IServerFilter`
- On enqueue: reads tenant ID from `ITenantProvider` (HTTP context available), stores as job parameter
- On execute: reads tenant ID from job parameter, sets it on an `AsyncLocal<Guid?>` in a static `TenantScope` class
- The existing `TenantProvider` is modified to check `TenantScope.CurrentTenantId` as a fallback when `HttpContext` is not available (background job scenario)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop email builder | Custom block editor with contenteditable | Unlayer (`angular-email-editor`) | Email rendering across 50+ email clients is extremely complex; Unlayer handles this |
| Liquid template rendering | Custom `{{ }}` regex parser | Fluid.Core 2.31.0 | Edge cases in Liquid syntax (filters, nested objects, conditionals, loops) are enormous; Fluid is battle-tested |
| Background job scheduling | Custom `Task.Delay` loops or `BackgroundService` | Hangfire.AspNetCore + Hangfire.PostgreSql | Retry policies, dead-letter queues, monitoring dashboard, distributed locking are all built-in |
| Email HTML rendering | Custom inline CSS tool | Unlayer's `exportHtml()` | Unlayer inlines CSS and produces email-client-compatible HTML automatically |
| Responsive email layout | Custom media queries | Unlayer's responsive design mode | Email client CSS support is wildly inconsistent; Unlayer handles table-based layouts for compatibility |

**Key insight:** Email template building is a deceptively complex problem domain. Email clients (Outlook, Gmail, Apple Mail, Yahoo) all render HTML/CSS differently. Building a custom editor that produces reliably rendering emails would consume the entire phase budget. Use Unlayer for the builder and Fluid for the server-side rendering.

## Common Pitfalls

### Pitfall 1: Entity State Lost After SaveChanges
**What goes wrong:** The DomainEventInterceptor tries to read entity states in `SavedChangesAsync` but all entries are `Unchanged` because EF Core resets state after a successful save.
**Why it happens:** EF Core marks all tracked entities as `Unchanged` after `SaveChangesAsync` completes. By the time `SavedChangesAsync` fires, the original `Added`/`Modified`/`Deleted` states are gone.
**How to avoid:** Capture entity states and changed properties in `SavingChangesAsync`, store them in `AsyncLocal<T>`, and read from `AsyncLocal` in `SavedChangesAsync`.
**Warning signs:** Domain events always report "Modified" or events never fire for "Added" entities.

### Pitfall 2: Hangfire Jobs Without Tenant Context
**What goes wrong:** Background jobs query the database without tenant context, bypassing EF Core global query filters and PostgreSQL RLS policies. Jobs either see no data (RLS blocks access) or see all tenants' data (if RLS is not enforced).
**Why it happens:** Hangfire jobs execute outside HTTP request context. `ITenantProvider.GetTenantId()` returns null because there is no `HttpContext`.
**How to avoid:** Use `TenantJobFilter` to stamp tenant ID on every enqueued job. Modify `TenantProvider` to check `TenantScope.CurrentTenantId` (AsyncLocal) as fallback when HttpContext is unavailable.
**Warning signs:** Jobs silently return empty results or throw RLS-related PostgreSQL errors.

### Pitfall 3: Unlayer Design JSON vs HTML Mismatch
**What goes wrong:** Template HTML is regenerated from design JSON but doesn't match the preview because merge field placeholders weren't properly escaped or Unlayer's `exportHtml()` wasn't called.
**Why it happens:** Saving only HTML from the preview (which has rendered merge fields) instead of the raw template HTML with Liquid placeholders.
**How to avoid:** Always save from `exportHtml()` callback, which returns the raw HTML with merge field tokens intact. Preview rendering is a separate server-side operation that resolves merge fields via Fluid.
**Warning signs:** Templates show "John Smith" instead of `{{ contact.first_name }}` when edited.

### Pitfall 4: Merge Fields for Custom Fields Referencing Deleted Definitions
**What goes wrong:** A template references a custom field that was later soft-deleted by an admin. Rendering throws an error or produces empty output.
**Why it happens:** Custom field definitions have `IsDeleted` soft-delete. The merge field reference in the template still exists.
**How to avoid:** Use Fluid's fallback value syntax: `{{ contact.custom.revenue_target | default: '' }}`. The `MergeFieldService` should gracefully handle missing custom fields by returning an empty string or the configured fallback.
**Warning signs:** Template preview errors when using templates created before custom field changes.

### Pitfall 5: Interceptor Order Matters
**What goes wrong:** DomainEventInterceptor captures entity state before `AuditableEntityInterceptor` has set timestamps, resulting in events with stale `UpdatedAt` values.
**Why it happens:** EF Core interceptors execute in registration order. If `DomainEventInterceptor` is registered before `AuditableEntityInterceptor`, it sees pre-audit entity state.
**How to avoid:** Register interceptors in order: `AuditableEntityInterceptor` first, `DomainEventInterceptor` second. Both run in `SavingChangesAsync` but order matters for consistent snapshots.
**Warning signs:** Domain events contain incorrect timestamps.

### Pitfall 6: Hangfire Dashboard Exposed Without Authorization
**What goes wrong:** The Hangfire dashboard (`/hangfire`) is publicly accessible, exposing job details, queue information, and the ability to trigger retries.
**Why it happens:** `app.UseHangfireDashboard()` defaults to allowing all connections in development.
**How to avoid:** Configure `DashboardOptions` with `Authorization = [new AdminDashboardAuthorizationFilter()]` that requires the Admin Identity role.
**Warning signs:** Anyone with the URL can view and manage background jobs.

## Code Examples

### Hangfire Registration with PostgreSQL Storage
```csharp
// Source: Hangfire.PostgreSql GitHub + official Hangfire docs
public static class HangfireServiceExtensions
{
    public static IServiceCollection AddHangfireServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")!;

        services.AddHangfire(config => config
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(options =>
                options.UseNpgsqlConnection(connectionString),
                new PostgreSqlStorageOptions
                {
                    SchemaName = "hangfire",
                    PrepareSchemaIfNecessary = true,
                    QueuePollInterval = TimeSpan.FromSeconds(15)
                }));

        services.AddHangfireServer(options =>
        {
            options.Queues = ["default", "emails", "webhooks", "workflows"];
            options.WorkerCount = Environment.ProcessorCount * 2;
        });

        // Register tenant job filter globally
        GlobalJobFilters.Filters.Add(new TenantJobFilter());

        return services;
    }
}
```

### Unlayer Editor Angular Integration
```typescript
// Source: unlayer/angular-email-editor GitHub README
import { Component, ViewChild, inject, ChangeDetectionStrategy } from '@angular/core';
import { EmailEditorModule, EmailEditorComponent } from 'angular-email-editor';

@Component({
  selector: 'app-email-template-editor',
  standalone: true,
  imports: [EmailEditorModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <email-editor
      #editor
      [options]="editorOptions"
      (loaded)="onEditorLoaded()"
      (ready)="onEditorReady()"
      minHeight="700px"
    ></email-editor>
  `
})
export class EmailTemplateEditorComponent {
  @ViewChild('editor') editor!: EmailEditorComponent;

  editorOptions = {
    mergeTags: {
      contact: {
        name: 'Contact',
        mergeTags: {
          first_name: { name: 'First Name', value: '{{contact.first_name}}' },
          last_name: { name: 'Last Name', value: '{{contact.last_name}}' },
          email: { name: 'Email', value: '{{contact.email}}' },
        }
      },
      company: {
        name: 'Company',
        mergeTags: {
          name: { name: 'Company Name', value: '{{company.name}}' },
          industry: { name: 'Industry', value: '{{company.industry}}' },
        }
      }
    },
    features: {
      textEditor: {
        spellChecker: true,
      }
    }
  };

  onEditorReady(): void {
    // Load existing design if editing
    // this.editor.loadDesign(existingDesignJson);
  }

  save(): void {
    this.editor.exportHtml((data: any) => {
      const designJson = data.design;  // Save this for future editing
      const html = data.html;          // Save this for rendering/sending
    });
  }
}
```

### Fluid Template Rendering with Merge Fields
```csharp
// Source: sebastienros/fluid GitHub
public class TemplateRenderService
{
    private readonly FluidParser _parser = new();
    private readonly TemplateOptions _options;

    public TemplateRenderService()
    {
        _options = new TemplateOptions();
        // Register 'default' filter for fallback values: {{ field | default: 'fallback' }}
        // Fluid includes this built-in via Liquid standard filters
    }

    public async Task<string> RenderAsync(string htmlTemplate, MergeFieldData data)
    {
        if (!_parser.TryParse(htmlTemplate, out var template, out var error))
            throw new InvalidOperationException($"Template parse error: {error}");

        var context = new TemplateContext(_options);

        // Set merge field groups as nested objects
        context.SetValue("contact", data.Contact);   // { first_name, last_name, email, ... }
        context.SetValue("company", data.Company);    // { name, industry, website, ... }
        context.SetValue("deal", data.Deal);          // { title, value, stage, ... }
        context.SetValue("lead", data.Lead);          // { first_name, last_name, ... }

        return await template.RenderAsync(context);
    }
}
```

### Merge Field Service (resolving entity data to merge field dictionary)
```csharp
public class MergeFieldService
{
    private readonly ApplicationDbContext _db;

    // Returns available merge fields for the editor (grouped by entity)
    public async Task<Dictionary<string, List<MergeFieldDefinition>>> GetAvailableFieldsAsync()
    {
        var result = new Dictionary<string, List<MergeFieldDefinition>>();

        // Core entity fields (hardcoded)
        result["contact"] = GetContactFields();
        result["company"] = GetCompanyFields();
        result["deal"] = GetDealFields();
        result["lead"] = GetLeadFields();

        // Custom fields from CustomFieldDefinition (dynamic)
        var customFields = await _db.CustomFieldDefinitions
            .Where(f => f.EntityType == "Contact" || f.EntityType == "Company"
                     || f.EntityType == "Deal" || f.EntityType == "Lead")
            .ToListAsync();

        foreach (var cf in customFields)
        {
            var entityKey = cf.EntityType.ToLower();
            result[entityKey].Add(new MergeFieldDefinition(
                $"{entityKey}.custom.{cf.Name}",
                cf.Label,
                isCustomField: true));
        }

        return result;
    }

    // Resolves actual entity data for preview/send
    public async Task<MergeFieldData> ResolveAsync(
        string entityType, Guid entityId)
    {
        // Load entity and build merge data dictionary
        // Includes custom field values from JSONB CustomFields property
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BackgroundService for periodic jobs | Hangfire for reliable background processing | Standard for 5+ years | Retry policies, monitoring, persistence, scheduled jobs |
| Custom regex for `{{ }}` replacement | Liquid template engine (Fluid) | Shopify standardized Liquid; Fluid is .NET port | Industry-standard template syntax; filters, conditionals, loops |
| Custom drag-and-drop editors | Embedded email builder SDKs (Unlayer, GrapesJS) | 2020+ | Email client compatibility handled by library |
| MediatR for domain events | Hand-rolled domain events (project convention) | N/A (this project) | Consistency with existing codebase patterns |

**Deprecated/outdated:**
- `BackgroundService` for one-off jobs: Still valid for periodic polling, but Hangfire is better for fire-and-forget, scheduled, and recurring jobs with reliability requirements
- Custom HTML email templates with manual CSS inlining: Email builder libraries handle this automatically

## Open Questions

1. **Unlayer free tier watermark/branding**
   - What we know: Unlayer works without an API key. The free tier includes a "Powered by Unlayer" badge.
   - What's unclear: Whether the badge can be hidden in the free tier or requires a paid plan.
   - Recommendation: Start with free tier for development; assess paid tier need during UAT. The Angular wrapper accepts a `projectId` option for premium features.

2. **Hangfire schema isolation**
   - What we know: Hangfire.PostgreSql creates tables in a configurable schema (default: `hangfire`).
   - What's unclear: Whether the Hangfire schema should be in the same database as the application or a separate one.
   - Recommendation: Same database, separate `hangfire` schema. Keeps operational simplicity while avoiding table name conflicts. The `PrepareSchemaIfNecessary` option handles schema creation automatically.

3. **Domain event handler registration pattern**
   - What we know: The codebase uses hand-rolled commands/handlers, not MediatR.
   - What's unclear: How domain event handlers should be discovered and registered.
   - Recommendation: Use a simple `IDomainEventHandler<TEvent>` interface with DI registration. The dispatcher resolves handlers from the service provider. This keeps it simple and consistent with the codebase's non-MediatR approach. Downstream phases (webhooks, workflows) register their own handlers.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `AuditableEntityInterceptor.cs`, `TenantProvider.cs`, `TenantDbConnectionInterceptor.cs`, `PermissionService.cs`, `RoleTemplateSeeder.cs`, `EntityType.cs`, entity files (Contact, Company, Deal, Lead), `ApplicationDbContext.cs`, `DependencyInjection.cs`, `Program.cs`
- [Hangfire.PostgreSql GitHub](https://github.com/hangfire-postgres/Hangfire.PostgreSql) — version 1.21.1, configuration, schema management
- [Fluid GitHub](https://github.com/sebastienros/fluid) — API, performance benchmarks, template rendering patterns
- [Unlayer Angular Email Editor GitHub](https://github.com/unlayer/angular-email-editor) — Angular wrapper, standalone component support, merge tags API
- [Fluid.Core NuGet](https://www.nuget.org/packages/Fluid.Core/) — version 2.31.0 confirmed

### Secondary (MEDIUM confidence)
- [Milan Jovanovic - EF Core Interceptors](https://www.milanjovanovic.tech/blog/how-to-use-ef-core-interceptors) — DomainEventInterceptor pattern with SavingChanges/SavedChanges
- [Hangfire Documentation - Job Filters](https://docs.hangfire.io/en/latest/extensibility/using-job-filters.html) — IClientFilter/IServerFilter for context propagation
- [GrapesJS preset-newsletter](https://github.com/GrapesJS/preset-newsletter) — Email builder alternative assessment
- [Hangfire multi-tenant discussions](https://discuss.hangfire.io/t/hangfire-multi-tenancy-implementation-feedback/5211) — TenantJobFilter patterns from community

### Tertiary (LOW confidence)
- Unlayer pricing details — sourced from review sites, not official pricing page; free tier capabilities may vary
- ngx-grapesjs Angular 19 compatibility — inferred from v21 release date (Jan 2026) but not explicitly confirmed for Angular 19

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified via official repos/NuGet; versions confirmed
- Architecture: HIGH — Patterns derived from existing codebase conventions (interceptors, DI extensions, entity config, RBAC)
- Infrastructure (Hangfire/DomainEvents): HIGH — Well-documented patterns with multiple sources
- Email builder choice: MEDIUM — Unlayer is well-documented but Angular 19 specific compatibility not explicitly confirmed; ngx-grapesjs alternative available as fallback
- Pitfalls: HIGH — Derived from codebase analysis (entity state reset, tenant context in jobs) and verified documentation

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days — libraries are stable)
