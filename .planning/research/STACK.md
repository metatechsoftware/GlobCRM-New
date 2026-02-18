# Technology Stack: GlobCRM v1.1 Automation & Intelligence

**Project:** GlobCRM v1.1 -- Automation, Intelligence, and Extensibility
**Researched:** 2026-02-18
**Scope:** Stack ADDITIONS for v1.1 features only. Core stack (Angular 19, .NET 10, PostgreSQL 17) is validated and unchanged.

---

## Executive Summary

v1.1 adds six interconnected capabilities: workflow automation, email templates/sequences, formula/computed custom fields, duplicate detection & merge, webhooks, and advanced reporting. The existing stack handles most of the infrastructure needs. The key additions are:

1. **Hangfire** for reliable background job processing (workflow actions, webhook delivery, email sequences)
2. **Fluid** (Liquid) for user-editable email templates (replacing RazorLight for user-facing templates only)
3. **NCalc** for formula/computed field evaluation
4. **FuzzySharp** + PostgreSQL `pg_trgm` for duplicate detection
5. **Microsoft.Extensions.Http.Resilience** (built on Polly) for resilient webhook delivery
6. **@foblex/flow** for the visual workflow builder UI

No architectural changes to the existing 4-layer Clean Architecture. All new features plug into the existing Infrastructure and Application layers.

---

## What We Already Have (DO NOT Add)

These existing components cover significant v1.1 needs with zero additions:

| Existing Component | v1.1 Usage |
|---|---|
| **RazorLight 2.3.1** | System email templates (verification, password reset). Keep for these. |
| **SendGrid 9.29.3** | Email sending for sequences and workflow-triggered emails. |
| **SignalR** | Real-time notifications when workflows trigger, webhook delivery status updates. |
| **BackgroundService pattern** | Already used for EmailSync and DueDateNotification. Pattern extends to workflow processing. |
| **EF Core 10.0.3 + Npgsql 10.0.0** | All new entities (workflows, templates, webhooks, reports) store in PostgreSQL. |
| **JSONB + GIN indexes** | Workflow definitions, template variables, report configs store as JSONB. |
| **tsvector full-text search** | Existing on Company, Contact, Deal. Complemented by pg_trgm for fuzzy duplicate matching. |
| **FluentValidation 12.1.1** | Validates workflow definitions, template content, formula syntax. |
| **Angular CDK Drag-Drop** | Already used in Kanban boards. Reused for workflow step reordering. |
| **Chart.js + ng2-charts** | Advanced reports render through existing chart infrastructure. |
| **@ngrx/signals** | Signal stores for workflow builder, template editor, report builder features. |
| **Angular Material M3** | All new UI forms, dialogs, and editors use existing Material components. |
| **Serilog** | Structured logging for workflow execution audit trails. |
| **IHttpClientFactory** | Not currently registered but available in .NET 10. Needed for webhook HTTP calls. |

---

## Recommended Stack Additions

### 1. Background Job Processing: Hangfire

| Technology | Version | Layer | Purpose |
|---|---|---|---|
| Hangfire.AspNetCore | 1.8.23 | Infrastructure | Job server integration with ASP.NET Core DI |
| Hangfire.PostgreSql | 1.21.1 | Infrastructure | PostgreSQL storage for job persistence |

**Why Hangfire over continuing with BackgroundService:**
- The existing `BackgroundService` pattern works for simple periodic tasks (email sync every 5 min). Workflow automation needs **delayed jobs** (send email in 3 days), **fire-and-forget jobs** (trigger webhook now), **recurring jobs** (check conditions hourly), and **continuations** (after step A completes, run step B). BackgroundService cannot do any of these without reinventing a job queue.
- Hangfire persists jobs in PostgreSQL (reuses existing database), survives app restarts, provides automatic retries with configurable backoff, and includes a built-in monitoring dashboard at `/hangfire`.
- No new infrastructure dependency -- uses the same PostgreSQL 17 connection string.

**Why NOT Quartz.NET:** Quartz is better for complex cron-based scheduling but lacks Hangfire's persistence model, retry mechanism, and monitoring dashboard. Workflow automation needs job persistence and retry more than complex cron expressions.

**Why NOT Temporal:** Overkill for CRM workflows. Temporal is for long-running distributed workflows across microservices. GlobCRM is a monolith.

**Integration points:**
- Workflow engine enqueues Hangfire jobs for each action step
- Email sequences schedule delayed jobs for follow-up emails
- Webhook delivery uses fire-and-forget with automatic retry
- Report generation runs as background jobs for large datasets

**Multi-tenancy consideration:** Every Hangfire job must carry `TenantId` as a job parameter. Create a `TenantJobFilter` that sets the tenant context before job execution, following the same pattern as `EmailSyncBackgroundService` (create scope, resolve scoped services).

**Confidence:** HIGH -- Hangfire 1.8.23 released 2026-02-05, actively maintained, PostgreSQL storage mature at v1.21.1. Widely used in .NET CRM/SaaS applications.

---

### 2. User-Editable Email Templates: Fluid (Liquid)

| Technology | Version | Layer | Purpose |
|---|---|---|---|
| Fluid.Core | 2.31.0 | Infrastructure | Liquid template parsing and rendering |

**Why Fluid for user templates vs keeping RazorLight for everything:**
- RazorLight (already in project at 2.3.1) compiles Razor/C# templates. This is powerful but **unsafe for user-editable content** -- users could inject C# code. RazorLight also has not had a release since 2023-01-16.
- Fluid implements the Liquid template language (originally from Shopify), which is **sandboxed by design** -- no arbitrary code execution, only variable substitution and simple logic (`{% if %}`, `{% for %}`). This is exactly what CRM email templates need: `Hello {{contact.first_name}}, your deal {{deal.name}} has moved to {{deal.stage}}`.
- Fluid is 8x faster than DotLiquid and allocates 14x less memory. Actively maintained (v2.31.0 released 2025-11-07).
- Template syntax is widely known from Shopify, HubSpot, and other CRM/marketing tools, so users will recognize it.

**What stays with RazorLight:** System templates (verification emails, password reset, notification emails) that are developer-controlled `.cshtml` files remain on RazorLight. These are not user-editable.

**What uses Fluid:** User-created email templates, email sequences, workflow notification content, merge field rendering in any user-facing template.

**Why NOT Scriban:** Scriban is also excellent but Liquid syntax is more widely known among CRM users. Scriban's extended syntax adds power users don't need and that could confuse them.

**Why NOT Handlebars.NET:** Less actively maintained, no sandboxing guarantees, fewer built-in filters.

**Integration points:**
- `FluidTemplateRenderer` service in Infrastructure layer renders user templates with entity data as context
- Workflow "Send Email" action resolves template, renders with Fluid, sends via SendGrid
- Template editor UI provides merge field picker (e.g., `{{contact.email}}`, `{{deal.amount | currency}}`)

**Confidence:** HIGH -- Fluid.Core 2.31.0 verified on NuGet, targets .NET Standard 2.0+ (compatible with .NET 10). Liquid is the de facto standard for user-editable templates in SaaS products.

---

### 3. Formula/Computed Field Evaluation: NCalc

| Technology | Version | Layer | Purpose |
|---|---|---|---|
| NCalcSync | 5.11.0 | Application | Expression parsing and evaluation for computed fields |

**Why NCalc:**
- NCalc evaluates mathematical and logical expressions with custom functions and variables: `[deal_amount] * [discount_percentage] / 100`, `IF([status] = 'Won', [amount], 0)`, `DATEDIFF([close_date], TODAY())`.
- Supports custom function registration -- we can add CRM-specific functions like `COALESCE()`, `CONCATENATE()`, `DATEDIFF()`, `TODAY()`, `NOW()`, `UPPER()`, `LOWER()`, `ROUND()`, `SUM()` (aggregate over related entities).
- Lightweight, zero external dependencies, fast evaluation (no compilation step).
- NCalcSync (synchronous) is correct for field evaluation -- no I/O involved, pure computation.

**Why NOT mXparser:** mXparser is focused on mathematical expressions only. NCalc handles string operations, boolean logic, and custom functions needed for CRM computed fields.

**Why NOT CodingSeb.ExpressionEvaluator:** Evaluates C# expressions -- too powerful, security risk for user-defined formulas.

**Why NOT Z.Expressions.Eval:** Commercial license required, evaluates full C# (unsafe for user input).

**Integration points:**
- New `CustomFieldType.Formula = 9` enum value added to existing `CustomFieldType`
- `FormulaEvaluator` service in Application layer takes formula string + entity data, returns computed value
- `CustomFieldDefinition` gets a `FormulaExpression` property (nullable, only for Formula type fields)
- Computed values are calculated on read (not stored) -- they reference other field values that may change
- Frontend formula editor provides function autocomplete and field reference picker

**Where it lives:** Application layer (not Infrastructure) because formula evaluation is pure business logic with no external dependencies. NCalc has no infrastructure concerns.

**Confidence:** HIGH -- NCalcSync 5.11.0 on NuGet, targets .NET 8+ and .NET Standard 2.0, actively maintained (ncalc/ncalc GitHub org). Well-established library with 10+ years of production use.

---

### 4. Duplicate Detection: FuzzySharp + PostgreSQL pg_trgm

| Technology | Version | Layer | Purpose |
|---|---|---|---|
| FuzzySharp | 2.0.2 | Infrastructure | In-memory fuzzy string matching (Levenshtein, Jaro-Winkler) |
| PostgreSQL pg_trgm | Built-in extension | Database | Database-level trigram similarity with GIN indexing |

**Two-tier approach (database pre-filter + application-level scoring):**

**Tier 1 -- pg_trgm at the database level:**
- PostgreSQL's `pg_trgm` extension provides `similarity()` and `%` operator for trigram-based fuzzy matching, with GIN index support for fast lookups on large datasets.
- Use `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (one-time migration).
- Create GIN trigram indexes on `contacts.first_name`, `contacts.last_name`, `contacts.email`, `companies.name`, `companies.domain`.
- SQL query: `SELECT * FROM contacts WHERE similarity(email, @email) > 0.6 OR (first_name % @first_name AND last_name % @last_name)` -- returns candidates quickly using the index.
- This handles the "find candidates" step efficiently even with 100K+ records per tenant.

**Tier 2 -- FuzzySharp for scoring and ranking:**
- FuzzySharp (C# port of Python FuzzyWuzzy) provides `Fuzz.Ratio()`, `Fuzz.PartialRatio()`, `Fuzz.TokenSortRatio()`, `Fuzz.WeightedRatio()` for nuanced string comparison.
- After pg_trgm returns candidates (typically 10-50 rows), FuzzySharp computes a weighted composite score across multiple fields (name: 40%, email: 30%, phone: 20%, company: 10%).
- Scoring thresholds: >90 = auto-flag as duplicate, 70-90 = suggest for review, <70 = not a duplicate.

**Why NOT FuzzySharp alone:** Cannot use FuzzySharp at the database level -- would require loading all records into memory. pg_trgm pre-filters using indexes.

**Why NOT pg_trgm alone:** Trigram similarity is a blunt instrument. FuzzySharp's weighted ratio and token sort handle transpositions ("John Smith" vs "Smith, John") and partial matches better.

**Why NOT Elasticsearch:** Adding a full search engine for duplicate detection is overkill. PostgreSQL pg_trgm with GIN indexes handles the scale (10K-100K contacts per tenant) efficiently.

**Integration points:**
- `DuplicateDetectionService` in Infrastructure runs pg_trgm query, then FuzzySharp scoring
- Called on contact/company create and import (existing CSV import already has basic duplicate detection)
- Background job (Hangfire) for full-scan duplicate detection across all records
- Merge UI presents duplicates with confidence score and field-by-field comparison

**Confidence:** HIGH -- pg_trgm is a core PostgreSQL extension (not third-party). FuzzySharp 2.0.2 is stable, no dependencies, well-tested port of proven Python library.

---

### 5. Webhook Delivery: Microsoft.Extensions.Http.Resilience (Polly-based)

| Technology | Version | Layer | Purpose |
|---|---|---|---|
| Microsoft.Extensions.Http.Resilience | 10.3.0 | Infrastructure | Resilient HttpClient with retry, circuit breaker, timeout for webhook delivery |

**Why Microsoft.Extensions.Http.Resilience:**
- Webhook delivery requires retry with exponential backoff + jitter (industry standard: 5s, 25s, 125s, 625s, 3125s), circuit breaker (stop sending to consistently failing endpoints), and timeout (don't wait forever for slow endpoints).
- `Microsoft.Extensions.Http.Resilience` is Microsoft's official resilience layer for `IHttpClientFactory`, built on Polly 8.x. It provides pre-configured resilience pipelines (standard resilience handler) with sensible defaults that can be customized.
- This replaces the deprecated `Microsoft.Extensions.Http.Polly` package. The new package offers a higher-level API with built-in standard resilience patterns.
- The project currently has no resilience library -- this fills the gap for webhooks and could also benefit other HTTP calls (Gmail API, SendGrid API).

**Why Microsoft.Extensions.Http.Resilience over raw Polly:**
- `Microsoft.Extensions.Http.Resilience` wraps Polly 8.x and integrates directly with `IHttpClientFactory` and ASP.NET Core DI. It provides a `AddStandardResilienceHandler()` method that configures retry, circuit breaker, and timeout in one call. For custom configurations, it exposes the full Polly pipeline builder.
- No need to separately install `Polly` -- it is a transitive dependency of `Microsoft.Extensions.Http.Resilience`.

**Why IHttpClientFactory (not raw HttpClient):**
- The project currently uses `HttpClient` directly only in Gmail services. For webhook delivery, `IHttpClientFactory` provides proper connection pooling, DNS rotation, and resilience pipeline integration.
- Register a named client `"WebhookClient"` with resilience pipeline.

**Why NOT building retry from scratch:** Exponential backoff with jitter, circuit breaker state management, and timeout composition are tricky to get right. The Microsoft resilience package is battle-tested and the recommended .NET approach.

**Webhook delivery architecture:**
1. Entity event fires (create, update, delete) or workflow triggers webhook action
2. `WebhookDispatcher` enqueues a Hangfire fire-and-forget job
3. Hangfire job resolves `IHttpClientFactory`, creates request with HMAC-SHA256 signature
4. Resilience pipeline handles retry (5 attempts, exponential backoff + jitter, max 1 hour)
5. After all retries exhausted, log to `webhook_delivery_logs` table with failure details
6. Dead letter: admin can view failed deliveries and manually retry from UI

**Confidence:** HIGH -- Microsoft.Extensions.Http.Resilience 10.3.0 is Microsoft-maintained, built on Polly 8.x (.NET Foundation project). This is the officially recommended approach for resilient HTTP in .NET 10.

---

### 6. Visual Workflow Builder UI: @foblex/flow

| Technology | Version | Layer | Purpose |
|---|---|---|---|
| @foblex/flow | 18.1.2 | Frontend | Flow-based visual editor for workflow trigger-condition-action chains |

**Why @foblex/flow:**
- Angular-native library built for exactly this use case: visual node-based editors with drag-and-drop nodes and connections.
- Supports standalone components, Angular Signals, SSR, and zoneless mode -- aligns perfectly with the project's Angular 19 patterns.
- Provides drag-and-drop node placement, connection drawing between nodes, zoom/pan, customizable node templates (use Angular Material components inside nodes), and event-driven architecture.
- MIT licensed, actively maintained (v18.1.2 as of Feb 2026).

**Why NOT building from scratch with CDK Drag-Drop:**
- Angular CDK Drag-Drop handles list reordering and free-form dragging, but does NOT handle connection lines between nodes, path routing, zoom/pan canvas, or the visual graph data model. Building a workflow canvas from CDK primitives would take weeks.

**Why NOT react-flow / xyflow:** React-only library. Would require a React wrapper inside Angular, creating an impedance mismatch.

**Why NOT Joint.js / mxGraph:** jQuery-based or vanilla JS libraries that don't integrate well with Angular's change detection and signals. Wrapper components would be brittle.

**Integration points:**
- Workflow builder page renders @foblex/flow canvas
- Custom node components (Trigger, Condition, Action) use Angular Material forms inside flow nodes
- Workflow definition serializes to JSON (stored as JSONB in `workflow_definitions` table)
- Flow canvas is read-only when viewing workflow execution history

**Confidence:** MEDIUM -- @foblex/flow is the best Angular-native option but is a smaller community library. Verify that v18.1.2 works with Angular 19.2.x before committing. Fallback: build a simpler list-based workflow builder (trigger -> conditions -> actions as a vertical list) using existing Angular Material + CDK, upgrade to visual flow later.

---

### 7. Formula Editor UI (Frontend)

| Technology | Version | Layer | Purpose |
|---|---|---|---|
| No new dependency | -- | Frontend | Build with Angular Material + custom component |

**Recommendation: Custom formula editor, NOT Monaco Editor.**

Monaco Editor is 5MB+ and designed for code editing. Formula fields in a CRM need a simple text input with:
- Autocomplete for field references (`[deal_amount]`, `[contact.email]`)
- Function autocomplete (`SUM()`, `IF()`, `CONCATENATE()`)
- Syntax validation feedback (red border + error message)
- Preview of computed result

This is achievable with Angular Material's `mat-form-field` + a custom `mat-autocomplete` overlay triggered by `[` or function names. Total custom code: ~200-300 lines of TypeScript. Adding Monaco for this would be 50x the bundle size for 5% of the functionality.

**If formula complexity grows later** (nested functions, multi-line expressions): add `ngx-monaco-editor-v2` (latest version supports Angular 19) at that point. Not needed for v1.1 MVP.

**Confidence:** HIGH -- custom approach is simpler, lighter, and consistent with existing UI patterns.

---

### 8. Advanced Report Builder (Frontend)

| Technology | Version | Layer | Purpose |
|---|---|---|---|
| No new dependency | -- | Frontend | Build with existing Angular Material + reactive forms |

**Recommendation: Custom query/filter builder using Angular Material, NOT angular2-query-builder.**

`angular2-query-builder` (v0.6.2) was last published 6 years ago and only supports Angular 10-15. The maintained fork `@eliot-ragueneau/ngx-query-builder` exists but brings PrimeNG as a dependency, conflicting with our Angular Material design system.

The report builder needs:
- Entity/field selector (mat-select)
- Filter condition builder (field + operator + value rows, add/remove with Angular CDK)
- Aggregation picker (count, sum, avg, min, max)
- Grouping selector
- Chart type selector
- Date range picker (mat-date-range-input)

All of these are standard Angular Material form components. The filter condition builder pattern already exists in the project's `FilterPanelComponent`. Extend that pattern for the report builder.

**Backend report engine:** No new dependency needed. Use EF Core for simple reports and raw SQL via `Npgsql` (already in Domain project) for complex aggregation queries. The report definition (entity, filters, grouping, aggregation) serializes to JSON, and a `ReportQueryBuilder` service in Infrastructure translates it to parameterized SQL.

**Confidence:** HIGH -- custom approach reuses existing patterns and avoids dependency on unmaintained or incompatible libraries.

---

## Complete Additions Summary

### Backend (.NET) -- Add to GlobCRM.Infrastructure.csproj

```xml
<!-- Background job processing -->
<PackageReference Include="Hangfire.AspNetCore" Version="1.8.23" />
<PackageReference Include="Hangfire.PostgreSql" Version="1.21.1" />

<!-- User-editable email templates (Liquid syntax) -->
<PackageReference Include="Fluid.Core" Version="2.31.0" />

<!-- Resilient HTTP for webhook delivery (built on Polly 8.x) -->
<PackageReference Include="Microsoft.Extensions.Http.Resilience" Version="10.3.0" />

<!-- Fuzzy string matching for duplicate detection -->
<PackageReference Include="FuzzySharp" Version="2.0.2" />
```

### Backend (.NET) -- Add to GlobCRM.Application.csproj

```xml
<!-- Formula/computed field expression evaluation -->
<PackageReference Include="NCalcSync" Version="5.11.0" />
```

### Frontend (Angular) -- npm install

```bash
npm install @foblex/flow@18.1.2
```

### Database (PostgreSQL) -- Migration

```sql
-- Enable trigram extension for fuzzy duplicate detection
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram GIN indexes for duplicate detection
CREATE INDEX idx_contacts_name_trgm ON contacts USING GIN (
  (first_name || ' ' || last_name) gin_trgm_ops
);
CREATE INDEX idx_contacts_email_trgm ON contacts USING GIN (email gin_trgm_ops);
CREATE INDEX idx_companies_name_trgm ON companies USING GIN (name gin_trgm_ops);
CREATE INDEX idx_companies_domain_trgm ON companies USING GIN (domain gin_trgm_ops);
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Background Jobs | Hangfire 1.8.23 | Quartz.NET 3.x | No built-in persistence dashboard, no retry mechanism, more complex setup |
| Background Jobs | Hangfire 1.8.23 | BackgroundService (existing) | Cannot schedule delayed/recurring jobs, no persistence across restarts |
| Background Jobs | Hangfire 1.8.23 | Temporal | Overkill for monolith CRM, requires separate server |
| User Templates | Fluid 2.31.0 | RazorLight (existing) | Unsafe for user-editable content (C# injection), last release 2023 |
| User Templates | Fluid 2.31.0 | DotLiquid | 8x slower, 14x more memory, less actively maintained |
| User Templates | Fluid 2.31.0 | Scriban | Good library but Liquid syntax more recognized by CRM users |
| Formula Engine | NCalcSync 5.11.0 | mXparser 6.1.0 | Math-only, no string/boolean operations or custom functions |
| Formula Engine | NCalcSync 5.11.0 | Z.Expressions.Eval | Commercial license, evaluates full C# (security risk) |
| Formula Engine | NCalcSync 5.11.0 | CodingSeb.ExpressionEvaluator | Too powerful (full C# eval), security risk for user formulas |
| Duplicate Detection | FuzzySharp 2.0.2 + pg_trgm | Elasticsearch | New infrastructure dependency for a focused use case |
| Duplicate Detection | FuzzySharp 2.0.2 + pg_trgm | FuzzySharp only | Cannot index at DB level, requires loading all records to memory |
| Webhook Resilience | Http.Resilience 10.3.0 | Microsoft.Extensions.Http.Polly | Deprecated in favor of Http.Resilience |
| Webhook Resilience | Http.Resilience 10.3.0 | Custom retry loop | Error-prone, missing circuit breaker, reinventing the wheel |
| Workflow UI | @foblex/flow 18.1.2 | CDK Drag-Drop only | No connection lines, zoom/pan, or graph data model |
| Workflow UI | @foblex/flow 18.1.2 | react-flow / xyflow | React-only, would need wrapper in Angular app |
| Workflow UI | @foblex/flow 18.1.2 | Joint.js | jQuery-based, poor Angular integration |
| Report Query Builder | Custom (Angular Material) | angular2-query-builder 0.6.2 | Last updated 6 years ago, max Angular 15 |
| Report Query Builder | Custom (Angular Material) | Syncfusion QueryBuilder | Commercial license, heavy bundle, design system mismatch |
| Formula Editor | Custom (mat-autocomplete) | Monaco Editor | 5MB+ for a simple formula input, massive overkill |

---

## What NOT to Add

| Do NOT Add | Reason |
|---|---|
| **MediatR** | The project uses hand-rolled command/handler pattern. Adding MediatR for v1.1 would require refactoring all existing commands. Workflow events use Hangfire job dispatch instead. |
| **Event Bus (MassTransit, NServiceBus)** | Monolith architecture. Workflow actions dispatch directly via Hangfire. Event bus is for microservices. |
| **Elasticsearch** | PostgreSQL pg_trgm + tsvector handles duplicate detection and search at CRM scale. |
| **Redis** | Not needed yet. Hangfire uses PostgreSQL storage. SignalR runs in-process. Add Redis when scaling to multiple server instances. |
| **Dapper** | Mentioned in v1.0 research but never adopted. Report queries can use raw SQL via Npgsql (already in Domain project) or EF Core's `FromSqlRaw()`. |
| **PrimeNG** | Mentioned in v1.0 research but never adopted. All UI is Angular Material. Keep it that way. |
| **ngx-formly** | Mentioned in v1.0 research but never adopted. Custom field forms are hand-built with Angular Material. |
| **Monaco Editor** | Formula editor is a simple input with autocomplete, not a code editor. |
| **Quill extensions** | Email template editor uses Liquid syntax (plain text with merge fields), not rich text. The existing ngx-quill is for notes/descriptions, not templates. |
| **GraphQL** | REST API serves all report builder needs. Report definitions are stored as JSON, executed server-side. |
| **Polly (standalone)** | Use Microsoft.Extensions.Http.Resilience instead -- it wraps Polly 8.x and integrates with IHttpClientFactory. No need to install Polly separately. |
| **Microsoft.Extensions.Http.Polly** | Deprecated. Use Microsoft.Extensions.Http.Resilience (its replacement). |

---

## Integration Map: How New Libraries Connect

```
User Action (Frontend)
  |
  v
API Controller
  |
  v
Workflow Engine (Application Layer)
  |--- Evaluates conditions using NCalcSync
  |--- Dispatches actions:
  |      |--- "Send Email" --> Fluid renders template --> SendGrid sends
  |      |--- "Fire Webhook" --> Hangfire job --> Resilient HttpClient
  |      |--- "Update Field" --> EF Core entity update
  |      |--- "Create Activity" --> Existing activity service
  |
  v
Hangfire (Infrastructure Layer)
  |--- Persists jobs in PostgreSQL
  |--- Handles retry, scheduling, delayed execution
  |--- Email sequence: schedules next email as delayed job

Duplicate Detection (Infrastructure Layer)
  |--- pg_trgm SQL query (Tier 1: database pre-filter)
  |--- FuzzySharp scoring (Tier 2: in-memory ranking)
  |--- Returns scored candidates to UI

Report Builder (Infrastructure Layer)
  |--- Reads report definition JSON
  |--- Builds parameterized SQL from definition
  |--- Executes via EF Core / raw Npgsql
  |--- Returns aggregated data to Chart.js frontend
```

---

## Version Verification Status

| Package | Version | Verified Source | Status |
|---|---|---|---|
| Hangfire.AspNetCore | 1.8.23 | NuGet.org (released 2026-02-05) | VERIFIED |
| Hangfire.PostgreSql | 1.21.1 | NuGet.org | VERIFIED |
| Fluid.Core | 2.31.0 | NuGet.org (released 2025-11-07) | VERIFIED |
| NCalcSync | 5.11.0 | NuGet.org | VERIFIED |
| FuzzySharp | 2.0.2 | NuGet.org | VERIFIED |
| Microsoft.Extensions.Http.Resilience | 10.3.0 | NuGet.org | VERIFIED |
| @foblex/flow | 18.1.2 | npm registry (checked live) | VERIFIED |
| pg_trgm | Built-in | PostgreSQL 17 docs | VERIFIED |

---

## Dependency Impact Assessment

### Bundle Size Impact (Frontend)

| Addition | Estimated Size | Impact |
|---|---|---|
| @foblex/flow | ~80-120 KB (gzipped) | Moderate -- only loaded in workflow builder route (lazy-loaded) |
| No Monaco Editor | 0 KB saved | Avoided 5MB+ addition |
| No PrimeNG / QueryBuilder | 0 KB saved | Avoided 200KB+ addition |

**Total frontend addition: ~100 KB** (lazy-loaded, not on critical path).

### Package Count Impact (Backend)

| Current NuGet packages | 17 |
|---|---|
| New packages | 5 |
| Total after v1.1 | 22 |

All new packages are well-maintained, MIT/Apache licensed, and have no conflicting transitive dependencies with existing packages.

### Database Impact

| Addition | Impact |
|---|---|
| pg_trgm extension | One-time `CREATE EXTENSION`, no schema changes |
| Trigram GIN indexes | 4 new indexes on existing tables, small storage overhead |
| Hangfire schema | Hangfire auto-creates its tables (hangfire.job, hangfire.state, etc.) in a `hangfire` schema |
| New entity tables | ~8-10 new tables for workflows, templates, webhooks, reports |

---

## Sources

### NuGet Packages
- [Hangfire.AspNetCore 1.8.23](https://www.nuget.org/packages/hangfire.aspnetcore/)
- [Hangfire.PostgreSql 1.21.1](https://www.nuget.org/packages/Hangfire.PostgreSql/)
- [Fluid.Core 2.31.0](https://www.nuget.org/packages/Fluid.Core/)
- [NCalcSync 5.11.0](https://www.nuget.org/packages/NCalcSync)
- [FuzzySharp 2.0.2](https://www.nuget.org/packages/FuzzySharp)
- [Microsoft.Extensions.Http.Resilience 10.3.0](https://www.nuget.org/packages/Microsoft.Extensions.Http.Resilience/)

### npm Packages
- [@foblex/flow](https://www.npmjs.com/package/@foblex/flow) -- Angular flow-based UI library
- [Foblex Flow Documentation](https://flow.foblex.com/)

### PostgreSQL
- [pg_trgm Documentation](https://www.postgresql.org/docs/current/pgtrgm.html)

### Architecture References
- [Hangfire Documentation](https://docs.hangfire.io/en/latest/)
- [Fluid Template Engine (GitHub)](https://github.com/sebastienros/fluid)
- [NCalc Documentation](https://ncalc.github.io/ncalc/)
- [Polly Documentation](https://www.pollydocs.org/)
- [Microsoft Resilient HTTP Apps (.NET)](https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience)
- [Webhook Retry Best Practices (Svix)](https://www.svix.com/resources/webhook-best-practices/retries/)
- [Webhook Delivery Platform Architecture](https://james-carr.org/posts/2025-12-31-advent-of-eip-day-8-webhook-delivery-platform/)
- [FuzzySharp (GitHub)](https://github.com/JakeBayer/FuzzySharp)
- [Microsoft.Extensions.Http.Polly deprecation (GitHub Issue)](https://github.com/dotnet/aspnetcore/issues/57209)
