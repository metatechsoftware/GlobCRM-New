# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** Phase 9 in progress -- Dashboards & Reporting

## Current Position

Phase: 9 of 11 (Dashboards & Reporting)
Plan: 1 of 8 in current phase
Status: In Progress
Last activity: 2026-02-17 — Completed 09-01 (Domain Entities, Enums, Configs, Migration, RLS)

Progress: [████░░░░░░░░░░░░░░░░░░░░░░░░░░] 1/8 plans (Phase 9)

## Performance Metrics

**Velocity:**
- Total plans completed: 43
- Average duration: 6 min
- Total execution time: ~2.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 8 | ~56min | 7min |
| 02-core-infrastructure | 11 | ~73min | 7min |
| 03-core-crm-entities | 9 | ~40min | 4min |
| 04-deals-and-pipelines | 10 | ~30min | 3min |

**Recent Trend:**
- Last 5 plans: 01-04 (7min), 01-05 (7min), 01-06 (7min), 01-07 (8min), 01-08 (E2E verify)
- Trend: Consistent ~7min per plan

*Updated after each plan completion*
| Phase 02 P01 | 7min | 2 tasks | 18 files |
| Phase 02 P03 | 12min | 2 tasks | 12 files |
| Phase 02 P04 | 5min | 2 tasks | 9 files |
| Phase 02 P05 | 8min | 2 tasks | 9 files |
| Phase 02 P07 | 4min | 2 tasks | 2 files |
| Phase 02 P08 | 5min | 2 tasks | 14 files |
| Phase 02 P09 | 6min | 2 tasks | 7 files |
| Phase 02 P10 | 8min | 2 tasks | 13 files |
| Phase 02 P11 | 10min | 2 tasks | 17 files |
| Phase 02 P13 | 2min | 1 task | 8 files |
| Phase 02 P14 | 2min | 1 task | 2 files |
| Phase 03 P01 | 3min | 2 tasks | 10 files |
| Phase 03 P02 | 2min | 2 tasks | 10 files |
| Phase 03 P03 | 4min | 2 tasks | 3 files |
| Phase 03 P04 | 9min | 2 tasks | 13 files |
| Phase 03 P05 | 4min | 2 tasks | 3 files |
| Phase 03 P06 | 8min | 2 tasks | 8 files |
| Phase 03 P07 | 12min | 2 tasks | 8 files |
| Phase 03 P08 | 5min | 2 tasks | 8 files |
| Phase 03 P09 | 2min | 1 task | 2 files |
| Phase 04 P01 | 3min | 2 tasks | 18 files |
| Phase 04 P04 | 2min | 2 tasks | 4 files |
| Phase 04 P02 | 4min | 2 tasks | 6 files |
| Phase 04 P05 | 4min | 2 tasks | 3 files |
| Phase 04 P06 | 6min | 2 tasks | 6 files |
| Phase 04 P08 | 4min | 2 tasks | 4 files |
| Phase 04 P03 | 4min | 2 tasks | 3 files |
| Phase 04 P07 | 5min | 2 tasks | 7 files |
| Phase 04 P09 | 4min | 2 tasks | 10 files |
| Phase 04 P10 | 1min | 1 task | 1 files |
| Phase 05 P01 | 3min | 2 tasks | 22 files |
| Phase 05 P05 | 2min | 2 tasks | 3 files |
| Phase 05 P02 | 3min | 2 tasks | 4 files |
| Phase 05 P03 | 3min | 2 tasks | 2 files |
| Phase 05 P04 | 4min | 2 tasks | 1 files |
| Phase 05 P06 | 3min | 2 tasks | 6 files |
| Phase 05 P08 | 3min | 1 task | 4 files |
| Phase 05 P09 | 2min | 1 task | 4 files |
| Phase 05 P07 | 6min | 2 tasks | 4 files |
| Phase 05 P10 | 7min | 2 tasks | 9 files |
| Phase 06 P04 | 3min | 2 tasks | 6 files |
| Phase 06 P01 | 4min | 2 tasks | 21 files |
| Phase 06 P02 | 5min | 2 tasks | 4 files |
| Phase 06 P05 | 5min | 2 tasks | 2 files |
| Phase 06 P06 | 5min | 2 tasks | 3 files |
| Phase 07 P01 | 3min | 2 tasks | 18 files |
| Phase 07 P04 | 2min | 2 tasks | 3 files |
| Phase 07 P05 | 3min | 2 tasks | 4 files |
| Phase 07 P02 | 6min | 2 tasks | 9 files |
| Phase 07 P06 | 5min | 2 tasks | 9 files |
| Phase 07 P03 | 5min | 2 tasks | 7 files |
| Phase 08 P01 | 4min | 2 tasks | 18 files |
| Phase 08 P02 | 4min | 2 tasks | 10 files |
| Phase 08 P03 | 3min | 2 tasks | 8 files |
| Phase 08 P04 | 4min | 2 tasks | 4 files |
| Phase 08 P05 | 4min | 2 tasks | 9 files |
| Phase 08 P06 | 4min | 2 tasks | 8 files |
| Phase 08 P07 | 2min | 2 tasks | 3 files |
| Phase 08 P08 | 1min | 1 task | 2 files |
| Phase 09 P01 | 4min | 2 tasks | 16 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Multi-tenancy: PostgreSQL with Row-Level Security for tenant isolation (triple-layer defense)
- Custom fields: JSONB storage with GIN indexing for query performance
- Stack: Angular 19 (web), .NET Core 10 (backend), PostgreSQL 17 (database), .NET MAUI (mobile)
- Authentication: Email + password with optional 2FA (SSO deferred to v2)
- Real-time: SignalR for live updates and notifications
- [01-02] @ngrx/signals v19 for Angular 19 compatibility (v21 requires Angular 21)
- [01-02] Access token in memory (signal), refresh token in localStorage only with rememberMe
- [01-02] Token refresh at 80% of expiry; uniform GlobCRM branding for Phase 1
- [Phase 01]: Used .slnx solution format (new .NET 10 default)
- [Phase 01]: Added Identity.Stores to Domain for IdentityUser base class
- [Phase 01]: FORCE ROW LEVEL SECURITY on tenant-scoped tables for defense-in-depth
- [01-04] Self-contained HTML email templates with inline CSS for email client compatibility (no Razor layout inheritance)
- [01-04] Separate DI extension methods per subsystem for parallel-safe registration
- [01-04] TenantSeeder uses seed manifest pattern -- data structure now, entity creation in Phase 3
- [Phase 01-03]: TenantDbContext extends EFCoreStoreDbContext for Finbuckle EF Core store integration
- [Phase 01-03]: JWT bearer as default auth scheme; custom login endpoint generates JWTs with organizationId claim
- [Phase 01-03]: Development mode uses WithHeaderStrategy('X-Tenant-Id') fallback for local testing without subdomains
- [01-05] Cross-tenant invitation token lookup uses IgnoreQueryFilters() since accepting user has no tenant context
- [01-08-E2E] Dual DbContext requires ExcludeFromMigrations() for shared entities to prevent duplicate tables
- [01-08-E2E] Global query filters need null tenant bypass for login/org creation to work without tenant context
- [01-08-E2E] Angular must import environment.development.ts (not environment.ts); fileReplacements swaps for production
- [01-08-E2E] Angular login uses /api/auth/login-extended (custom JWT), not /api/auth/login (Identity opaque tokens)
- [01-08-E2E] Backend runs on port 5233 (launchSettings.json), Angular dev env updated accordingly
- [02-02] JSONB value types mapped via HasColumnType('jsonb') -- not separate tables
- [02-02] Soft-delete unique constraint uses HasFilter('NOT is_deleted') for field name reuse
- [02-02] NpgsqlDataSourceBuilder with EnableDynamicJson() shared across both DbContexts
- [02-02] CustomFieldDefinition query filter combines tenant isolation AND soft-delete
- [Phase 02-01]: Child RBAC entities inherit tenant isolation via parent FK -- no TenantId or query filter needed
- [Phase 02-01]: UserPreferencesData uses explicit JSON value converter (not OwnsOne.ToJson) due to Dictionary property limitation in EF Core
- [02-03] SkiaSharp 3.119.2 for avatar processing (MIT license, free -- not ImageSharp $4999)
- [02-03] IFileStorageService abstraction with LocalFileStorageService for tenant-partitioned local storage
- [02-03] JSONB columns use System.Text.Json HasConversion for Dictionary<> property support
- [02-04] Per-user HashSet cache key tracking for targeted permission cache invalidation
- [02-04] Field access defaults to Editable when no RoleFieldPermission exists (open by default)
- [02-04] Startup seeding for existing tenants; new org seeding deferred to CreateOrganization handler
- [02-05] DI registration via separate CustomFieldServiceExtensions (Program.cs subsystem pattern)
- [02-05] CustomFieldValidator handles JsonElement values from System.Text.Json deserialization
- [02-05] Unique field validation deferred to Phase 3 when entity instances exist
- [02-05] Soft-delete restore uses IgnoreQueryFilters to bypass combined tenant+soft-delete filter
- [02-07] Permission/field-permission updates use full-replacement strategy (delete all + insert new) for simplicity
- [02-07] Role deletion blocked when assigned to users via direct assignment or team default role
- [02-07] my-permissions endpoint overrides controller Admin auth -- any authenticated user can query own permissions
- [02-07] TeamMemberInfoDto renamed to avoid namespace collision with TeamDirectoryController's TeamMemberDto
- [02-08] ViewStore is component-provided (not root) so each entity list page gets its own instance
- [02-08] FilterOperator union type covers all comparison operators including null checks and between/in
- [02-08] Column resize uses native DOM events (mousedown/move/up) on thin handle div for performance
- [02-08] Filter operators adapt dynamically based on field type: text, number, date, select
- [02-09] PermissionStore uses computed Map<string,string> for O(1) permission lookups (not array scanning)
- [02-09] Directives use effect() for reactive signal-based permission checks, avoiding per-cycle method calls
- [02-09] permissionGuard uses polling with 5s timeout to wait for PermissionStore before checking access
- [02-09] Field access defaults to fallback parameter (default: editable) when no permission defined
- [02-10] Permission matrix uses signal-based 2D Record for efficient reactive entity x CRUD grid rendering
- [02-10] ConfirmDeleteDialogComponent exported from role-list and reused by team-list for DRY dialog sharing
- [02-10] AddMemberDialog uses team directory API with 300ms debounced autocomplete for user search
- [02-10] Angular permission models updated to match backend DTOs: defaultRoleId, avatarUrl, avatarColor
- [02-11] Avatar color generation uses deterministic name hash with 12 predefined colors for consistent initials display
- [02-11] Profile save dispatches updateProfile and updatePreferences in parallel with coordinated completion tracking
- [02-11] Team directory uses Subject-based debounced search (300ms) with distinctUntilChanged for efficient API calls
- [02-11] Avatar crop dialog uses ngx-image-cropper with 1:1 aspect ratio, 256px resize, and WebP output format
- [02-13] adminGuard (role-based) for settings route protection -- backend uses Authorize(Roles = "Admin"), not entity permissions
- [02-13] Contact entity permissions as proxy for *appHasPermission on settings buttons -- Admin has All scope on all entity CRUD
- [02-14] Raw SQL migration via migrationBuilder.Sql() for GIN indexes (EF Core has no native GIN index API)
- [03-01] No Organization navigation on CRM entities -- TenantId is raw Guid with query filter only (avoids ExcludeFromMigrations cross-context issues)
- [03-01] Contact-Company is nullable FK (not join table) per CONT-03 requirement
- [03-01] Product has no OwnerId -- products are shared tenant resources
- [03-02] Shared query models (PagedResult, EntityQueryParams, FilterParam, TimelineEntry) in shared/models/query.models.ts
- [03-02] Product detail uses ProductDto directly (no separate ProductDetailDto) -- fewer fields than Company/Contact
- [03-02] Entity signal stores are component-provided (not root), matching ViewStore pattern for per-page isolation
- [03-03] provideNativeDateAdapter at component level (not app-wide) for datepicker in custom field form
- [03-03] Timeline CSS-only layout with vertical connector lines (no third-party library)
- [03-03] Tab content projection via contentChildren(TemplateRef) indexed by tab position
- [03-03] File and Relation custom field types are placeholder implementations (deferred to later phases)
- [03-04] PagedResult<T> and EntityQueryParams in Domain/Common (not Api) so repository interfaces can reference them
- [03-04] Switch-based field sorting (no System.Linq.Dynamic.Core dependency) per research recommendation
- [03-04] Custom field sorting unsupported (documented limitation -- needs raw SQL OrderBy for JSONB key extraction)
- [03-04] EnsurePermissionsForAllEntityTypesAsync runs on every startup (idempotent, handles pre-Phase-3 tenants)
- [03-05] Ownership scope checked on both list (via repository) AND detail endpoints (via IsWithinScope helper)
- [03-05] Team member IDs resolved via ApplicationDbContext.TeamMembers directly (IPermissionService doesn't expose team queries)
- [03-05] Products have no ownership scope -- shared tenant resources, any user with Product:View sees all
- [03-05] CompanyId validated on Contact create/update via GetByIdAsync for referential integrity
- [03-06] Reused ConfirmDeleteDialogComponent from role-list for company delete (DRY dialog sharing across features)
- [03-06] Contacts tab lazy-loads on first tab switch for better initial load performance
- [03-06] FilterPanel bindings use activeFilters/filtersChanged (actual API) not filters/filtersApplied (plan names)
- [03-08] Product list formats unitPrice via Intl.NumberFormat before passing to DynamicTable (no custom cell renderer)
- [03-08] Product detail uses simple card layout (no tabs, no timeline) -- simpler entity pattern for flat entities
- [03-08] Entity-timeline date format uses comma separator instead of escaped 'at' for Angular template compatibility
- [03-07] Company autocomplete uses separate FormControl (not in main FormGroup) with Subject-based debounced search for CONT-03 linking
- [03-07] Company tab data from ContactDetailDto (no separate API call) -- companyId/companyName included in detail response
- [03-07] Added Emails disabled tab to CONTACT_TABS per plan specification (Phase 7 placeholder)
- [03-09] Navbar link order: Dashboard | Companies | Contacts | Products | Team | Settings (entity pages between dashboard and admin)
- [03-09] All entity routes use authGuard; permission enforcement at component level via directives
- [04-01] Child entities (PipelineStage, DealContact, DealProduct, DealStageHistory) have no TenantId -- tenant isolation inherited via parent FK
- [04-01] Pipeline.TeamId uses SetNull delete behavior -- pipeline survives team deletion but loses team scope
- [04-01] Deal uses Restrict delete on PipelineId and PipelineStageId -- prevents pipeline/stage deletion with active deals
- [04-01] DealProduct.UnitPrice is nullable decimal(18,4) -- null means use Product.UnitPrice as default
- [04-04] DealService.getList extends EntityQueryParams with pipelineId/stageId for pipeline-scoped list and Kanban views
- [04-04] DealStore adds pipelineId to state with setPipelineId method for pipeline-specific deal loading
- [04-04] PipelineService is a separate service from DealService (pipeline admin vs deal operations)
- [04-02] DealRepository follows CompanyRepository pattern exactly for filter/sort/pagination with ParameterReplacer expression composition
- [04-02] Kanban query excludes terminal stages (IsWon/IsLost) by default with includeTerminal toggle
- [04-02] PipelineStageSeed extended with DefaultProbability, IsWon, IsLost for complete stage metadata
- [04-02] Deal seed data links to seeded companies and pipeline stages with future ExpectedCloseDate
- [04-05] Pipeline components use inline templates (single .ts file) for minimal file scope
- [04-05] Stage probability stored as 0-100 percentage in form, converted to 0-1 decimal on save for backend compatibility
- [04-05] Required fields per stage use MatExpansionPanel with checkbox grid for deal field requirements (DEAL-10)
- [04-06] View mode switcher uses mat-button-toggle-group with routerLink for Kanban/Calendar navigation (placeholder until those components built)
- [04-06] Owner selection loads team directory via ProfileService.getTeamDirectory (pageSize: 100) for simple mat-select dropdown
- [04-06] Pipeline-Stage cascade uses PipelineService.getStages(pipelineId) for lightweight stage loading on pipeline change
- [04-06] provideNativeDateAdapter at component level for deal form datepicker (consistent with CustomFieldFormComponent pattern)
- [04-08] CDK drag-drop with transferArrayItem for cross-column moves and moveItemInArray for within-column reorder
- [04-08] Optimistic UI update pattern: move card immediately, revert on API failure with snackbar notification
- [04-08] Pipeline selector loads all pipelines on init, selects default (isDefault=true) or first pipeline
- [Phase 04-03]: Pipeline controller uses admin-only Authorize(Roles = Admin) at controller level, not per-endpoint permission policies
- [Phase 04-03]: Added Pipeline include to DealRepository GetPagedAsync and GetByIdAsync for PipelineName in DTOs
- [04-07] Inline search panel for contact/product linking instead of separate MatDialog components -- simpler UX, fewer files
- [04-07] Products table uses CSS grid layout (not mat-table) for lightweight rendering with subtotal/total computation
- [04-07] Deal detail route (:id) updated from DealFormComponent to DealDetailComponent
- [04-07] Timeline shown redundantly in Tab 4 and sidebar for access from any active tab
- [04-09] FullCalendar dayGridMonth as default view with stage-color-coded events and click-to-navigate
- [04-09] Deals navbar link positioned between Products and Team (Dashboard | Companies | Contacts | Products | Deals | Team | Settings)
- [04-09] Deals tab on Company/Contact detail pages uses placeholder with View Deals link passing companyId/contactId as query params
- [04-10] Backend string fix only (stage_change -> stage_changed); no frontend changes needed since frontend already used correct key
- [05-01] ActivityStatusHistory uses enum values (not FK) unlike DealStageHistory -- activities have fixed workflow states, not configurable stages
- [05-01] ActivityLink is polymorphic (EntityType string + EntityId Guid) with no FK constraints for flexible entity linking
- [05-01] ActivityFollower uses Cascade delete on User FK (user removal clears follows) unlike other user FKs which use SetNull
- [05-05] ActivityService uses HttpClient directly for FormData upload and blob download (ApiService only handles JSON)
- [05-05] ActivityStore default sort is createdAt desc (most recent first), component-provided with ViewFilter-based filters
- [05-05] Sub-entity API methods nested under parent path (/activities/{id}/comments, /attachments, /time-entries, /links, /followers)
- [05-02] Activity ownership scope checks both OwnerId and AssignedToId (users see activities they own OR are assigned to, unlike Company/Deal)
- [05-02] Entity-scoped filtering via LINQ Any() on ActivityLink navigation collection (not separate join query)
- [05-02] TenantSeeder uses contactMap and dealMap alongside companyMap for cross-entity linking of ActivityLink records
- [05-03] ActivityWorkflow is a static class in Domain/Entities (not a service) for zero-dependency transition validation
- [05-03] IsWithinScope checks both OwnerId and AssignedToId for activity dual-ownership scope (matching repository pattern)
- [05-03] Status changes only via dedicated PATCH /status endpoint (PUT update does not allow status change)
- [05-03] Create/Update requests accept type/priority as strings with Enum.TryParse for flexible API input
- [05-04] IFileStorageService injected for attachment upload/download/delete with tenant-partitioned paths
- [05-04] Dangerous extensions (.exe, .bat, .cmd, .ps1, .sh) blocked at attachment upload time
- [05-04] Entity link accepts Quote/Request types for forward compatibility alongside Contact/Company/Deal
- [05-04] Author-only edit/delete on comments/time entries with admin override via User.IsInRole("Admin")
- [05-04] Follow/unfollow uses Activity:View permission (not Update) so any viewer can follow
- [05-06] Activity form uses inline template/styles (single .ts file) matching deal-form pattern rather than separate .html/.scss files
- [05-06] Kanban/Calendar route placeholders point to ActivityListComponent until dedicated components are built
- [05-06] Activity form defaults: type=Task, priority=Medium for ergonomic quick creation
- [05-08] Fixed workflow columns from ACTIVITY_STATUSES constant (no pipeline selector needed, unlike Deal Kanban)
- [05-08] Client-side ALLOWED_TRANSITIONS validation with snackbar feedback before API call
- [05-08] Priority color as 4px left border on Kanban cards for visual priority indication
- [05-09] Activity calendar is month-only (no day/week) -- Phase 11 CALR-01+ adds comprehensive multi-entity calendar
- [05-09] Priority-based coloring (Low=green, Medium=blue, High=orange, Urgent=red) instead of stage-based coloring
- [Phase 05-07]: Activity detail uses mat-tab-group directly (not RelatedEntityTabsComponent) for full control over 6 custom tabs with dynamic badge counts
- [Phase 05-07]: Timeline rendered inline with activity-specific event type icons (status_changed, comment_added, attachment_uploaded, time_logged, entity_linked) rather than reusing EntityTimelineComponent
- [05-10] Activities tab reordered before disabled tabs (Quotes, Notes) in COMPANY_TABS/CONTACT_TABS for correct contentChildren template indexing
- [05-10] Entity-scoped activity loading uses activitiesLoaded signal guard to prevent redundant API calls on tab re-selection
- [06-04] QuoteService uses HttpClient directly for PDF blob download (matching ActivityService attachment pattern)
- [06-04] Both Quote and Request stores are component-provided with createdAt desc default sort
- [Phase 06]: Quote versioning uses self-referencing FK (OriginalQuoteId) with SetNull delete -- versions survive original deletion
- [Phase 06]: QuoteLineItem stores computed amounts (LineTotal, DiscountAmount, TaxAmount, NetTotal) rather than computing on read
- [Phase 06]: RequestWorkflow uses same static dictionary pattern as ActivityWorkflow for zero-dependency transition validation
- [Phase 06]: QuoteLineItem child entity has no TenantId -- inherits tenant isolation via Quote FK (matching DealProduct pattern)
- [06-02] QuoteRepository and RequestRepository DI registration in CrmEntityServiceExtensions (existing pattern) not DependencyInjection.cs
- [06-02] RequestRepository uses dual-ownership scope (OwnerId + AssignedToId) matching Activity pattern for assigned entities
- [06-05] Quote list uses inline template/styles with currency-formatted grandTotal via Intl.NumberFormat (matching product list pattern)
- [06-05] Quote form line item totals use signal + valueChanges subscription for reactive computed display via calculateQuoteTotals
- [06-05] Product search adds line item directly (auto-fill pattern) rather than per-row product dropdown
- [06-06] Quote detail uses inline template with mat-tab-group for 4 tabs (Line Items, Details, Versions, Timeline)
- [06-06] PDF download uses URL.createObjectURL with filename pattern Quote-{number}-v{version}.pdf
- [06-06] Request form uses separate FormControl for contact/company autocomplete (not in main FormGroup) with Subject-based debounced search

- [07-01] ulong LastHistoryId maps to bigint in PostgreSQL for Gmail incremental sync history tracking
- [07-01] Email address arrays (To/Cc/Bcc) stored as jsonb columns, not separate tables
- [07-01] One EmailAccount per user per tenant enforced by unique composite index on (tenant_id, user_id)
- [07-04] EmailService uses ApiService for all endpoints (no HttpClient blob downloads needed for email)
- [07-04] EmailStore includes selectedThread and accountStatus alongside standard list/detail state
- [07-04] Optimistic list updates for markAsRead and toggleStar (update list item locally after API success)
- [07-05] Email account settings route has no adminGuard -- email connection is per-user, not admin-only
- [07-05] Compose dialog uses optional MAT_DIALOG_DATA injection for both new compose and reply scenarios
- [07-05] OAuth redirect pattern: EmailService.connect() returns authorizationUrl, component redirects via window.location.href
- [Phase 07-02]: GmailOAuthService uses GoogleAuthorizationCodeFlow.CreateAuthorizationCodeRequest (not GoogleAuthorizationCodeRequestUrl which doesn't exist)
- [Phase 07-02]: GmailSyncService uses ApplicationDbContext directly for contact auto-linking (simpler than adding IContactRepository methods for infrastructure-level service)
- [07-06] Email detail uses setTimeout polling to wait for detail load before loading thread by gmailThreadId
- [07-06] Most recent message expanded by default in thread view, older messages collapsed
- [07-06] Entity email tabs use EmailService directly (not EmailStore) for simple lazy-loaded list
- [07-06] Emails tab at index 6 in both CONTACT_TABS and COMPANY_TABS, before Notes
- [07-06] Navbar Emails link between Requests and Team (Dashboard | Companies | Contacts | Products | Deals | Activities | Quotes | Requests | Emails | Team | Settings)
- [07-03] OAuth callback is AllowAnonymous since Google redirects directly (not through SPA auth flow)
- [07-03] OAuth state parameter encodes userId|nonce for CSRF protection and user identification in callback
- [07-03] Tenant resolution fallback in OAuth callback queries ApplicationUser.OrganizationId when subdomain not resolved
- [07-03] EmailsController has no permission policies -- email access scoped by tenant query filter

- [08-01] Notification.UserId is nullable Guid? to support SetNull FK delete behavior (non-nullable Guid incompatible with SetNull)
- [08-01] FeedComment has no TenantId -- inherits tenant isolation via FeedItem FK (matching child entity pattern)
- [08-01] NotificationPreference uses Cascade delete on UserId (prefs removed with user)
- [08-02] CrmHub placed in Infrastructure (not Api) to avoid circular dependency with NotificationDispatcher
- [08-02] NotificationDispatcher email is fire-and-forget (try/catch) -- email failure does not fail dispatch
- [08-02] Default notification email preference is enabled when no NotificationPreference record exists
- [08-03] Controller DTOs defined as records in controller file (matching EmailsController pattern, not separate Dtos folder)
- [08-03] Feed delete restricted to author or Admin role (matching ActivityComment author-only pattern)
- [08-03] @mention detection uses regex matching first name or username with fire-and-forget dispatch
- [08-03] DueDateNotificationService uses IgnoreQueryFilters for cross-tenant scanning (background service has no tenant context)
- [08-04] NotificationDispatcher gets explicit tenantId overload for background services where tenant context unavailable
- [08-04] Deal stage notifications only sent to owner when owner differs from current user (no self-notifications)
- [08-04] Activity assignment notifications only sent when assignee differs from current user and assignment changed
- [08-05] SignalRService uses promise-based start/stop for simpler lifecycle management from AppComponent effect()
- [08-05] NotificationStore subscribes to SignalR notification$ in withMethods factory for immediate real-time push
- [08-05] Notification panel lazy-loads on open (togglePanel) rather than on app init for reduced initial API calls
- [08-05] Outside-click panel dismiss via HostListener document:click with ElementRef.contains check
- [08-06] FeedStore is component-provided (not root) for per-page instance isolation matching EmailStore pattern
- [08-06] Real-time FeedCommentAdded events reload expanded feed item detail rather than manual comment array patching
- [08-06] SignalRService created in 08-06 as Rule 3 blocking dependency since 08-05 and 08-06 are wave 4 parallel plans
- [08-06] Feed item delete restricted to author or Admin role on frontend matching backend FeedController authorization
- [08-07] No adminGuard on notification-preferences route -- per-user settings, not admin-only (matching email-accounts pattern)
- [08-07] Default notification preferences generated client-side with all toggles enabled when API returns empty
- [08-07] Feed navbar link between Emails and Team: Dashboard | Companies | Contacts | Products | Deals | Activities | Quotes | Requests | Emails | Feed | Team | Settings

- [09-01] Dashboard follows SavedView OwnerId pattern (null = team-wide, non-null = personal)
- [09-01] DashboardWidget is child entity with no TenantId -- inherits tenant isolation via Dashboard FK
- [09-01] Widget Config stored as Dictionary<string,object> with System.Text.Json HasConversion for JSONB
- [09-01] MetricType enum covers 20 metrics across Deals, Activities, Quotes, Contacts, Companies, Requests

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed 09-01-PLAN.md (Domain Entities, Enums, Configs, Migration, RLS)
Resume file: .planning/phases/09-dashboards-and-reporting/09-01-SUMMARY.md
