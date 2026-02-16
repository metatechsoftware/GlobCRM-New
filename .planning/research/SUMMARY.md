# Project Research Summary

**Project:** GlobCRM - Multi-Tenant SaaS CRM
**Domain:** Enterprise CRM Platform
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

GlobCRM is a multi-tenant SaaS CRM platform designed for mid-size organizations (10-50 concurrent users per tenant) with requirements spanning contact management, configurable deal pipelines, full activity workflows, two-way email integration, real-time collaboration, and native mobile apps. Research indicates this is a mature domain with well-established patterns, but success depends on architectural decisions made in the foundation phase - particularly around multi-tenancy isolation, custom field handling, and RBAC implementation.

The recommended approach uses a **shared database with tenant discriminator pattern** (PostgreSQL with Row-Level Security), **Angular 19 for web** with SignalR for real-time capabilities, **.NET Core 10 backend** following clean architecture principles, and **.NET MAUI for native mobile apps**. This stack is battle-tested for SaaS CRM systems and provides excellent performance, strong typing, and code sharing across platforms. Critical architectural elements include JSONB columns for custom fields (with proper indexing), triple-layer tenant isolation (middleware, EF Core filters, PostgreSQL RLS), OAuth-based email sync via background jobs, and API-first design to support both web and mobile clients.

The key risks are tenant data leakage (requires defense-in-depth), JSONB query performance (requires proper indexing strategy from day one), email sync complexity (OAuth token management, threading, data volume), and real-time connection state management. These risks are well-documented with proven mitigation strategies. The recommended build order starts with multi-tenancy and auth foundations, progresses through core CRM entities with custom fields, then adds deal pipelines and activities, followed by email integration, real-time features, and finally mobile apps. This sequence ensures foundational stability before adding complex features.

## Key Findings

### Recommended Stack

GlobCRM's technology stack follows enterprise SaaS best practices with modern, production-proven technologies. The combination of Angular 19, .NET Core 10, PostgreSQL 17, and .NET MAUI provides strong typing throughout the stack, excellent performance, and significant code sharing between web backend and mobile apps. The stack supports all required features including multi-tenancy, custom fields via JSONB, real-time updates via SignalR, and two-way email sync via OAuth.

**Core technologies:**
- **Angular 19**: Frontend framework with standalone components, signals for reactivity, excellent TypeScript support, and mature ecosystem (NgRx for state, Angular Material + PrimeNG for UI components)
- **.NET Core 10**: Backend framework with high performance, clean architecture support, first-class PostgreSQL integration via EF Core, built-in SignalR for real-time, excellent async/await model
- **PostgreSQL 17**: Database with JSONB for custom fields, Row-Level Security for tenant isolation, schema-based multi-tenancy support, full-text search, GIN/GiST indexes for performance
- **.NET MAUI**: Mobile framework for native iOS/Android apps with shared C# codebase, offline SQLite support, platform-specific capabilities (camera, contacts), push notifications via FCM
- **SignalR**: Real-time communication with WebSocket support, automatic fallback to long polling, Redis backplane for horizontal scaling, tenant-scoped groups for efficient broadcasting
- **Finbuckle.MultiTenant 8.x**: Multi-tenancy middleware with schema-per-tenant support, automatic EF Core filtering, subdomain/header/claim-based tenant resolution
- **OpenIddict 5.x**: OAuth2/OIDC provider (free, certified) for authentication across web and mobile apps, token management, refresh token flow
- **Hangfire 1.8.x**: Background job processing for email sync, scheduled reports, data imports, with persistent storage in PostgreSQL and monitoring dashboard
- **FluentValidation 11.x**: API validation framework with reusable validators, complex conditional logic, automatic ASP.NET Core integration
- **Serilog 4.x**: Structured logging with PostgreSQL sink, tenant context injection, queryable logs, multiple output targets

**Version confidence:** HIGH for most packages. Note that .NET 10 LTS release should be verified (expected November 2025) and all package versions should be checked against official sources before implementation.

### Expected Features

GlobCRM's feature set is comprehensive, covering all table stakes for CRM systems plus key differentiators. Research identified 35 table stakes features (users expect these), 18 differentiators (competitive advantages), and 8 anti-features to avoid.

**Must have (table stakes):**
- Contact & Company CRUD with relationships - foundation for all CRM operations
- Deal/opportunity tracking with pipeline stages, value, probability, expected close
- Activity logging (calls, meetings, tasks) with assignment, due dates, completion tracking
- Notes and attachments on all entities - users expect free-text notes and file uploads everywhere
- Search across entities - global search bar with cross-entity results
- List views with sorting/filtering - multi-column sort, quick filters, saved filters
- CSV data import with field mapping, duplicate detection, progress tracking, error handling
- Email + password authentication with registration, login, password reset
- User roles (Admin, Manager, Rep) with permission inheritance and access control
- Dashboard with at-a-glance summary - my activities, my deals, recent items
- Calendar view for activities - day/week/month views, drag-and-drop
- Basic reporting - pipeline value, conversion rates, activity summaries
- In-app notifications with bell icon, notification center, read/unread state
- Data export (CSV/Excel) - users need to get data out for analysis
- Responsive web design - mobile-usable web interface with touch-friendly controls
- Audit trail basics - who changed what, when on all records

**Should have (competitive differentiators):**
- **Dynamic table columns with saved Views** - core GlobCRM differentiator; per-user column selection, ordering, sizing, filters saved as Views; reusable across entities
- **Rich custom fields** (formula, relation, currency) - JSONB storage; formula fields compute from other fields; relation fields link entities; admins adapt CRM without developer help
- **Full activity workflow** (assigned → accepted → in progress → review → done) - state machine with role-based transitions, operational clarity beyond simple task tracking
- **Configurable deal pipelines per team** - different sales processes for different products/teams; admin-defined stages with probabilities, required fields per stage
- **Two-way email sync** (Gmail + Outlook) - OAuth integration with background sync, auto-link to contacts, send from CRM, messages automatically appear in timeline
- **Real-time live updates** (SignalR) - deal stage changes, new activities, notifications pushed instantly without page refresh
- **Combined news feed** (activity + social) - team communication + system events in one stream
- **Configurable dashboards with drill-down** - drag-and-drop widgets, chart types, date range filters, click-through to underlying data
- **Granular RBAC with field-level access** - custom roles, per-entity CRUD permissions, hide/read-only specific fields for regulated industries
- **Quote builder with line items + PDF** - product catalog, quantity, discount, tax calculation, PDF template, versioning
- **Native mobile apps** (.NET MAUI) - full CRM experience on the go with offline support, push notifications, camera for attachments
- **Kanban board view** for deals + activities - visual pipeline management with drag-and-drop stage changes
- **Targets/KPIs with leaderboards** - numeric goals, progress bars, team rankings, time-based (weekly/monthly/quarterly) for gamification

**Defer (v2+):**
- AI-powered lead scoring - requires large dataset to train, unreliable with small orgs, black box decisions (use manual scoring rules with formula fields instead)
- Workflow automation builder (visual) - high complexity to build well; start with configurable triggers in v1, build automation engine in v2
- Social media integration - APIs unreliable/expensive, data quality issues, privacy concerns (provide link fields to profiles instead)
- Marketplace/plugin system - enormous maintenance overhead, security risks, versioning nightmares (use webhooks + API for integrations)

### Architecture Approach

The architecture follows clean architecture principles with clear separation between domain logic, application coordination, infrastructure implementation, and presentation. The system uses a **shared database with tenant discriminator** approach (TenantId column on all tables) backed by PostgreSQL Row-Level Security for defense-in-depth. This provides cost-effective multi-tenancy for mid-size organizations while maintaining strong isolation guarantees. Custom fields are stored in JSONB columns with GIN indexes for query performance. Authentication uses OpenIddict for OAuth2/OIDC with JWT tokens. Authorization implements a layered RBAC model (role-based, field-level, record-level, action-level). Real-time features use SignalR with tenant-scoped groups and Redis backplane for horizontal scaling. Email integration uses OAuth with background job sync (Hangfire) and proper threading via Message-ID headers. The API is stateless to support horizontal scaling.

**Major components:**
1. **Multi-Tenancy Infrastructure** - Tenant resolution middleware, EF Core global query filters, PostgreSQL RLS policies; triple-layer defense ensures no cross-tenant data leakage
2. **Custom Fields System** - JSONB storage with type metadata (string, number, date, boolean, picklist, lookup), validation at write time, GIN indexes for query performance, cached schemas
3. **Authentication & Authorization** - OpenIddict OAuth2/OIDC provider, JWT tokens, layered RBAC (roles → field-level → record-level → action-level), permission caching in Redis
4. **Core CRM Entities** - Contact, Account, Deal, Activity (base class for tasks/meetings/calls/notes), CustomFieldDefinition, Pipeline, Role, AuditLog as aggregate roots
5. **Email Integration** - OAuth token management with proactive refresh, background sync jobs, Graph API (Outlook) and Gmail API services, email threading logic, attachment storage in blob storage
6. **Real-Time Layer** - SignalR hubs (Notification, Activity, Deal), tenant-scoped groups, connection state management, Redis backplane for scale-out
7. **CQRS Pattern** - Command handlers for writes (CreateContactCommand), Query handlers for reads (GetContactByIdQuery), separate read models for complex queries/reports
8. **Background Jobs** - Hangfire for email sync, notification digests, data exports, audit cleanup; persistent storage in PostgreSQL with monitoring dashboard

**Build dependencies:** Foundation (multi-tenancy + auth) must be complete before core entities. Core entities (Contact, Account, Product) with custom fields must exist before Deal pipeline. Deal pipeline required for Quote builder. Activities and email sync can be built in parallel after core entities. Real-time layer enhances all features and can be added incrementally. Mobile app requires stable API and should be built after web features mature.

### Critical Pitfalls

Research identified 58 domain-specific pitfalls across 12 categories. The Phase 1 (Foundation) pitfalls are architectural decisions that cannot be changed later without massive refactoring.

1. **Tenant Data Leakage Through Inadequate Isolation** - Failing to enforce tenant boundaries at every data access layer leads to cross-tenant data exposure and complete loss of customer trust. **Prevention:** Implement triple-layer defense (middleware sets tenant context, EF Core global query filters inject TenantId, PostgreSQL RLS policies enforce at database level). Add integration tests that attempt cross-tenant access. Never rely solely on application-level filtering.

2. **JSONB Query Performance Hell** - Treating JSONB as schemaless storage without proper indexing leads to full table scans and unusable custom fields. **Prevention:** Create GIN indexes on JSONB columns immediately (`CREATE INDEX idx_contacts_custom ON contacts USING gin (custom_fields jsonb_path_ops)`). Index frequently-queried paths with btree indexes. Limit custom field nesting depth to 2-3 levels. Cache custom field definitions. Consider materialized views for frequently-queried combinations.

3. **Over-Simplified Permission Model** - Implementing only role-based access without field-level, record-level, or action-level granularity creates inflexible security that cannot meet enterprise requirements. **Prevention:** Design layered permission model from start (role-based + field-level + record-level + action-level). Cache permission matrices per user session. Enforce permissions at database view layer where possible. Include permission context in all API responses.

4. **Email Sync Data Volume Explosion** - Syncing entire email history for all users without filtering overwhelms storage and processing. **Prevention:** Only sync emails from/to CRM contacts. Implement date range limits (last 6 months active, older archived). Set size limits per email. Provide user controls for sync preferences. Use separate database/schema for email data. Archive old emails to cold storage.

5. **Real-Time Connection State Management Chaos** - Poor handling of connection lifecycle (disconnects, reconnects, duplicate connections) breaks real-time features and causes memory leaks. **Prevention:** Implement connection state machine (connecting, connected, reconnecting, disconnected). Store connection mapping (user → connection IDs) with TTL. Clean up stale connections automatically. Implement connection groups by tenant for isolation. Add client-side reconnection logic with exponential backoff.

6. **N+1 Query Problem with Custom Fields** - Loading lists of records triggers hundreds of additional queries for custom fields, relationships, and permissions, making the application unusable. **Prevention:** Use EF Core Include() for eager loading. Batch load custom field definitions. Prefetch permissions for current user. Implement query result caching. Use pagination with proper cursor-based or offset pagination. Set up query performance budgets with alerts.

7. **Missing Database Indexing Strategy** - Inadequate indexes on foreign keys, filter columns, and sort columns cause full table scans and slow queries. **Prevention:** Index all foreign keys automatically (tenant_id, created_by, owner_id, account_id, contact_id). Index all filter/search columns (status, stage, type, category). Create composite indexes for common filter combinations like `(tenant_id, status, created_at)`. Create partial indexes for filtered queries. Monitor with pg_stat_statements.

8. **Insufficient Multi-Tenancy Testing** - Testing only with single tenant misses critical isolation and cross-tenant bugs that appear in production. **Prevention:** Every integration test runs with multiple tenants (tenant_a and tenant_b data). Assert queries never return cross-tenant data. Test concurrent operations across tenants. Test with different tenant configurations. Build automated tenant isolation verification tests.

## Implications for Roadmap

Based on research, suggested phase structure with 8 phases over approximately 20 weeks:

### Phase 1: Foundation (Weeks 1-3)
**Rationale:** Multi-tenancy, authentication, and database architecture are foundational decisions that cannot be changed later. All subsequent features depend on these being correct. Pitfalls P1.1, P1.2, P2.1, P2.3, P3.1, P7.1, P7.2, P7.3, P8.1, P8.2 must be addressed in this phase.

**Delivers:** Database schema with multi-tenancy (Tenants, Users, Roles, Permissions tables), PostgreSQL RLS policies, .NET Core project structure (Domain, Application, Infrastructure, API layers), tenant resolution middleware, EF Core tenant-scoped DbContext, JWT authentication, basic authorization policies, Angular project structure with auth module, HTTP interceptors, route guards.

**Addresses (from FEATURES.md):** Email + password auth, user roles (Admin, Manager, Rep), tenant isolation infrastructure.

**Avoids (from PITFALLS.md):** P1.1 (tenant data leakage), P7.1 (N+1 queries - architecture), P7.2 (missing indexes), P7.3 (unbounded results), P8.1 (missing validation), P8.2 (soft delete pattern), P11.1 (migration strategy), P11.2 (config management).

**Stack elements (from STACK.md):** PostgreSQL 17 with RLS, .NET Core 10 with EF Core, Finbuckle.MultiTenant, OpenIddict, Angular 19, FluentValidation, Serilog.

### Phase 2: Core CRM Entities (Weeks 4-6)
**Rationale:** Contact and Account entities are the foundation of all CRM functionality. Custom fields system must be built with proper JSONB indexing and type system before any entity can use it. RBAC implementation must be complete before feature development accelerates. Dependencies: Requires Phase 1 (auth + multi-tenancy) complete.

**Delivers:** Contact entity with CRUD operations, Account entity with CRUD operations, CustomFieldDefinition system with type metadata (string, number, date, boolean, picklist, lookup), JSONB handling in EF Core with GIN indexes, dynamic field validation service, permission evaluation service with caching, role management APIs, Angular modules for Contacts and Accounts with dynamic forms, admin UI for custom field and role configuration.

**Addresses (from FEATURES.md):** Contact & Company CRUD, contact-company relationships, search across entities, list views with sorting/filtering, notes on any entity, rich custom fields (differentiator), granular RBAC with field-level access (differentiator).

**Avoids (from PITFALLS.md):** P2.1 (JSONB performance), P2.2 (custom field proliferation - limits), P2.3 (type system mismatch), P3.1 (permission model), P3.2 (permission audit trail), P7.1 (N+1 queries - implementation), P8.3 (duplicate detection basics).

**Stack elements (from STACK.md):** EF Core with JSONB mapping, ngx-formly for dynamic forms, FluentValidation for custom field validation, Redis for permission caching.

### Phase 3: Deals & Pipelines (Weeks 7-8)
**Rationale:** Deal pipeline is core CRM functionality and a key differentiator with configurable stages. Must support multiple pipelines per tenant with stage-specific validation rules. Dependencies: Requires Phase 2 (Contacts, Accounts, Custom Fields).

**Delivers:** Pipeline and PipelineStage entities with configuration API, Deal entity with stage tracking and custom fields, deal CRUD operations with stage transition validation, deal stage transition logic with required field enforcement, Kanban board view with drag-and-drop, deal detail view, product catalog entity for quote builder foundation.

**Addresses (from FEATURES.md):** Deal/opportunity tracking, configurable deal pipelines per team (differentiator), Kanban board view (differentiator), pipeline stages with value and probability.

**Avoids (from PITFALLS.md):** P6.1 (hardcoded pipeline stages), P6.2 (lost activity history during pipeline changes), P6.3 (activity workflow state machine - design only).

**Stack elements (from STACK.md):** Angular Material + PrimeNG for Kanban UI, EF Core state tracking for deal stage history.

### Phase 4: Activities & Timeline (Weeks 9-10)
**Rationale:** Activity system is the operational backbone of CRM. Full workflow (assigned → accepted → in progress → review → done) is a key differentiator requiring proper state machine design. Dependencies: Requires Phase 2 (Contacts, Accounts), Phase 3 (Deals).

**Delivers:** Activity base entity with polymorphic types (Task, Meeting, Call, Note), activity CRUD operations with state machine validation, activity assignment and due dates, AuditLog entity with EF Core interceptor for automatic change tracking, timeline UI component with filtering and search, activity creation forms for each type, calendar view for activities (day/week/month with drag-and-drop).

**Addresses (from FEATURES.md):** Activity logging (calls, meetings, tasks), full activity workflow (differentiator), notes on any entity, calendar view, audit trail basics, activity assignment.

**Avoids (from PITFALLS.md):** P6.3 (activity state machine), P3.2 (audit trail for all changes).

**Stack elements (from STACK.md):** EF Core interceptors for audit logging, Angular Material calendar components, date-fns for date handling.

### Phase 5: Email Integration (Weeks 11-13)
**Rationale:** Email sync is complex (OAuth, threading, data volume, token refresh) and should not be rushed. Must be built after core entities are stable. This is the highest-risk phase with pitfalls P4.1-P4.4. Dependencies: Requires Phase 2 (Contacts), Phase 4 (Activities for email activity records).

**Delivers:** OAuth callback endpoints for Gmail and Outlook, token storage with encryption and proactive refresh logic, Graph API service for Outlook, Gmail API service, email sync background job (Hangfire) with incremental sync, email threading logic using Message-ID headers, EmailMessage entity with relationships, email list and detail views with sanitized HTML rendering, send email functionality, link emails to contacts/deals, attachment storage in blob storage (Azure Blob/S3).

**Addresses (from FEATURES.md):** Two-way email sync Gmail + Outlook (differentiator), email threading, email attachments, send from CRM.

**Avoids (from PITFALLS.md):** P4.1 (email data volume explosion), P4.2 (email threading failures), P4.3 (OAuth token management), P4.4 (email parsing vulnerabilities).

**Stack elements (from STACK.md):** Hangfire for background jobs, MailKit for IMAP/SMTP, Microsoft Graph SDK, Gmail API client, Azure Blob Storage/S3, HtmlSanitizer for XSS prevention.

**Research flag:** Needs deeper research during planning - OAuth flows are provider-specific, threading algorithms vary by provider, sanitization requires security review.

### Phase 6: Real-Time & Notifications (Weeks 14-15)
**Rationale:** Real-time features enhance all previous phases (deal updates, activity changes, email arrivals). SignalR integration is cross-cutting and should be added after core features are stable. Dependencies: Requires all previous phases (consumes their domain events).

**Delivers:** SignalR hubs (NotificationHub, ActivityHub, DealHub) with tenant-scoped groups, Redis backplane for scale-out, connection state management with automatic cleanup, Notification entity and service, domain event handlers that dispatch notifications, notification preferences per user, Angular SignalR client service with reconnection logic, toast notifications component, live updates in lists (contacts, deals show changes from other users), email and push notification infrastructure (send via SendGrid/SES, FCM for push).

**Addresses (from FEATURES.md):** Real-time live updates (differentiator), in-app notifications, email notifications, push notifications (mobile), combined news feed.

**Avoids (from PITFALLS.md):** P5.1 (connection state chaos), P5.2 (real-time race conditions), P5.3 (real-time performance degradation).

**Stack elements (from STACK.md):** SignalR with Redis backplane, @microsoft/signalr client, StackExchange.Redis, SendGrid/Amazon SES, Plugin.Firebase for FCM.

### Phase 7: Mobile App (Weeks 16-18)
**Rationale:** Mobile app requires stable API and should be built after web features are mature. .NET MAUI allows code sharing with backend. Dependencies: Requires Phases 1-5 (consumes existing APIs).

**Delivers:** .NET MAUI project structure with shared business logic, platform-specific implementations (iOS/Android), local SQLite database for offline data, sync engine with conflict resolution using version numbers, queue for offline operations, contact and deal views, activity logging with camera for attachments, push notifications via FCM, OAuth authentication flow for mobile, secure token storage (Keychain/KeyStore).

**Addresses (from FEATURES.md):** Native mobile apps (differentiator), offline support, push notifications, camera for attachments, mobile-first experience.

**Avoids (from PITFALLS.md):** P12.3 (poor mobile experience).

**Stack elements (from STACK.md):** .NET MAUI, sqlite-net-pcl, CommunityToolkit.Maui, Refit for API calls, IdentityModel.OidcClient, Plugin.Firebase.

**Research flag:** Needs testing on actual devices - offline sync conflict resolution requires validation with real-world scenarios.

### Phase 8: Reporting & Advanced Features (Weeks 19-20)
**Rationale:** Reporting, bulk operations, and admin tools complete the feature set for v1 launch. These are polish features that depend on data being in the system. Dependencies: Requires all previous phases.

**Delivers:** Configurable dashboard widgets (drag-and-drop), chart components for dashboards (PrimeNG charts), drill-down from charts to underlying data, KPIs and targets with leaderboards, CSV/Excel export with large dataset handling (background job + email link), CSV import with field mapping, duplicate detection, progress tracking, bulk operations (edit, delete, assign, status change) with preview, quote builder with line items, product catalog, PDF generation (QuestPDF), tenant settings management UI, user management UI, system health dashboard.

**Addresses (from FEATURES.md):** Configurable dashboards (differentiator), targets/KPIs with leaderboards (differentiator), quote builder with PDF (differentiator), bulk operations, data import, data export, basic reporting.

**Avoids (from PITFALLS.md):** P12.1 (over-engineering customization), P12.2 (missing bulk operations), P8.3 (duplicate detection).

**Stack elements (from STACK.md):** PrimeNG charts, QuestPDF for PDF generation, Hangfire for background export jobs, ngx-formly for import field mapping.

### Phase Ordering Rationale

- **Foundation first (Phase 1):** Multi-tenancy and auth are architectural foundations that cannot be retrofitted. All pitfalls marked "Phase 1" in PITFALLS.md are non-negotiable.
- **Core entities before workflows (Phase 2 → 3 → 4):** Contacts and Accounts must exist before Deals (deals link to contacts/accounts). Custom fields must be designed correctly before any entity uses them. Deals must exist before Activities can reference them.
- **Email after core (Phase 5):** Email integration is complex with many pitfalls. Building it early would delay core CRM value. Activities must exist to create email activity records.
- **Real-time enhancement (Phase 6):** SignalR enhances all previous features. Building it after core features are stable allows incremental enhancement without blocking progress.
- **Mobile after API maturity (Phase 7):** Mobile app consumes existing APIs. Don't start mobile until web API is stable and well-tested.
- **Polish last (Phase 8):** Reporting and bulk operations depend on data being in the system. Quote builder depends on deals and products existing.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Email Integration):** OAuth flows are provider-specific (Microsoft Graph API vs Gmail API have different token formats, scopes, refresh behavior). Email threading algorithms vary. HTML sanitization requires security review. Consider `/gsd:research-phase email-oauth` before implementation.
- **Phase 7 (Mobile App):** Offline sync conflict resolution strategies are complex. Test scenarios with real devices (network switching, app backgrounding, concurrent edits). Consider `/gsd:research-phase offline-sync` for conflict resolution algorithms.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Multi-tenancy with Finbuckle is well-documented. OpenIddict has extensive examples. PostgreSQL RLS is standard pattern.
- **Phase 2 (Core CRM):** CRUD with EF Core is standard. JSONB handling well-documented. NgRx state management has established patterns.
- **Phase 3 (Deals & Pipelines):** Kanban UI with drag-and-drop is solved problem (PrimeNG has components). State machine validation is straightforward.
- **Phase 4 (Activities & Timeline):** Calendar components exist in Angular Material. EF Core audit interceptors are standard pattern.
- **Phase 6 (Real-Time):** SignalR with Redis backplane is well-documented. Connection state management patterns are established.
- **Phase 8 (Reporting):** Dashboard libraries (PrimeNG charts) handle most complexity. CSV import/export is standard. QuestPDF has good documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are production-proven for SaaS CRM. Angular 19, .NET Core 10, PostgreSQL 17, .NET MAUI are mature with excellent documentation. Minor uncertainty around .NET 10 release date (expected Nov 2025) - verify before starting. Package versions need verification against official sources. |
| Features | HIGH | Feature research based on competitive analysis (HubSpot, Pipedrive, Salesforce, Zoho) and industry reports. Table stakes features are well-established. Differentiators (dynamic tables, rich custom fields, full activity workflow, configurable pipelines, real-time) are validated competitive advantages. Anti-features identified from common mistakes. |
| Architecture | HIGH | Shared database with tenant discriminator is proven pattern for this scale. Clean architecture with CQRS is well-documented. JSONB for custom fields is standard approach. SignalR with Redis backplane scales to thousands of concurrent users. Build dependencies are clear from ARCHITECTURE.md. |
| Pitfalls | HIGH | 58 pitfalls identified from domain expertise and real-world CRM projects. Each pitfall includes warning signs, prevention strategies, and phase mapping. Phase 1 pitfalls (16 total) are architectural foundations verified by multiple sources. Email integration pitfalls (P4.1-P4.4) are based on known OAuth and threading complexity. |

**Overall confidence:** HIGH

Research is comprehensive and based on proven patterns. The main areas requiring validation during implementation are:

### Gaps to Address

- **OAuth provider-specific behavior:** Microsoft Graph API and Gmail API have different token formats, refresh mechanisms, and scopes. Phase 5 planning should include research into specific API quirks and rate limits for each provider.

- **Offline sync conflict resolution:** Phase 7 (Mobile) needs validation of conflict resolution strategies with real devices and network conditions. Research during planning should explore operational transformation vs last-write-wins vs manual merge strategies.

- **Performance with realistic data volumes:** While indexing strategy is defined, actual query performance should be validated with realistic tenant data (100k contacts, 1M activities). Load testing in Phase 2 will reveal if additional materialized views or denormalization is needed.

- **.NET 10 release verification:** Research assumes .NET 10 LTS releases November 2025. If project starts before release, use .NET 8 LTS (supported until November 2026) and plan upgrade path. Verify all package versions support target .NET version.

- **Custom field formula engine:** FEATURES.md mentions formula custom fields, but implementation complexity not fully explored. Phase 2 planning should research formula parsing, circular reference detection, and performance implications. Consider starting with simple formulas only.

- **Email HTML rendering security:** Phase 5 must include security review of HTML sanitization approach. Test with known malicious email samples. Consider iframe sandbox vs sanitization library tradeoffs.

## Sources

### Primary (HIGH confidence)
- **STACK.md** - Comprehensive technology research with version numbers, rationale for each choice, confidence ratings, package recommendations, deployment architecture
- **FEATURES.md** - Feature analysis based on competitive research (HubSpot, Pipedrive, Salesforce, Zoho, Freshsales, Close CRM), G2 category reports, dependency mapping
- **ARCHITECTURE.md** - Architecture patterns for multi-tenant SaaS CRM, component boundaries, data flow, build order with detailed phase breakdown (8 phases, 20 weeks)
- **PITFALLS.md** - 58 domain-specific pitfalls across 12 categories with warning signs, prevention strategies, phase mapping, impact assessment
- Official documentation: Angular (angular.dev), .NET (learn.microsoft.com/dotnet), PostgreSQL (postgresql.org), .NET MAUI (learn.microsoft.com/dotnet/maui)
- Clean Architecture patterns: Jason Taylor's CleanArchitecture template (github.com/jasontaylordev/CleanArchitecture)
- Multi-tenancy patterns: Finbuckle.MultiTenant documentation (finbuckle.com/multitenant), PostgreSQL schemas (postgresql.org/docs)

### Secondary (MEDIUM confidence)
- Technology stack comparisons: Reddit r/dotnet, Angular community discussions, PostgreSQL mailing lists
- CRM industry patterns: Gartner and Forrester reports on CRM features and market trends
- Email integration patterns: OAuth2 implementation guides for Microsoft Graph and Gmail APIs
- SignalR scaling patterns: ASP.NET Core SignalR documentation on Redis backplane and scale-out

### Tertiary (LOW confidence, needs validation)
- Performance benchmarks: Assumes 200ms p95 for CRUD operations, 1000 req/s per tenant based on similar projects - should be validated with load testing
- Cost estimates: Monthly infrastructure costs ($500-1000 for 50 tenants) are rough estimates - actual costs depend on hosting choices and usage patterns
- Development timeline: 20-week estimate assumes experienced team - adjust based on actual team composition and part-time availability

---
*Research completed: 2026-02-16*
*Ready for roadmap: yes*
