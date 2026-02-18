# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GlobCRM is a multi-tenant SaaS CRM with a .NET 10 backend, Angular 19 frontend, and PostgreSQL 17 database. The project uses a GSD (Get Stuff Done) workflow managed through `.planning/` directory files.

## Build & Run Commands

### Backend (.NET 10)

```bash
# Build
cd src/GlobCRM.Api && dotnet build

# Run (dev server on port 5233)
cd src/GlobCRM.Api && dotnet run

# Reseed demo data for all tenants
cd src/GlobCRM.Api && dotnet run -- --reseed

# EF Core migrations (run from src/GlobCRM.Api)
dotnet ef migrations add <Name> --context ApplicationDbContext --output-dir Persistence/Migrations/App --project ../GlobCRM.Infrastructure
dotnet ef migrations add <Name> --context TenantDbContext --output-dir Persistence/Migrations/Tenant --project ../GlobCRM.Infrastructure
dotnet ef database update --context ApplicationDbContext --project ../GlobCRM.Infrastructure
dotnet ef database update --context TenantDbContext --project ../GlobCRM.Infrastructure
```

### Frontend (Angular 19)

```bash
cd globcrm-web

npm start          # Dev server on http://localhost:4200
npm run build      # Production build → dist/globcrm-web/
npm run watch      # Dev build with watch mode
npm test           # Unit tests (Karma + Jasmine)
```

No lint script is configured. No proxy config — the Angular dev server calls the .NET API directly at `http://localhost:5233` (CORS enabled in dev).

## Architecture

### Backend — Clean Architecture (4 layers)

```
GlobCRM.Api → GlobCRM.Infrastructure → GlobCRM.Application → GlobCRM.Domain
```

- **Domain**: Pure entities, enums, repository interfaces. No EF Core dependency.
- **Application**: Command/handler classes (hand-rolled, no MediatR), `IEmailService`/`ITenantSeeder` abstractions, FluentValidation validators.
- **Infrastructure**: EF Core, all repository implementations, external services (Gmail, SendGrid, QuestPDF, file storage). Each subsystem registers via `Add{Feature}Services()` extensions.
- **Api**: Controllers call services/repositories directly. DTOs, request records, and validators are co-located in the same controller file (no separate DTO project). DTOs use static `FromEntity()` factory methods.

### Frontend — Standalone Angular with Signals

- **No NgModules** — everything is standalone components with `ChangeDetectionStrategy.OnPush`.
- **State**: `@ngrx/signals` (Signal Store). Root stores (`AuthStore`, `PermissionStore`, `NotificationStore`, `TenantStore`) are `providedIn: 'root'`. Per-page stores (e.g., `ContactStore`) are listed in component `providers: []`.
- **Modern Angular APIs**: `input()`, `output()`, `viewChild()`, `inject()`, `effect()`, `toSignal()` — not decorators.
- **Routing**: All features lazy-loaded via `loadChildren`/`loadComponent` in `app.routes.ts`. Route params bound as inputs via `withComponentInputBinding()`.
- **API layer**: `ApiService` wraps `HttpClient`, prepends `environment.apiUrl`. `authInterceptor` attaches JWT and handles 401 → refresh → retry.

### Multi-Tenancy — Triple-Layer Defense

1. **Finbuckle middleware**: Subdomain strategy in production, `X-Tenant-Id` header in development.
2. **EF Core global query filters**: Every tenant-scoped entity filtered by `TenantId`. Child entities (e.g., `DealContact`) inherit isolation via parent FK.
3. **PostgreSQL Row-Level Security**: `TenantDbConnectionInterceptor` sets `app.current_tenant` session variable on every connection open. RLS policies in `scripts/rls-setup.sql`.

Two DbContexts: `TenantDbContext` (organization catalog, not tenant-scoped) and `ApplicationDbContext` (all CRM data, tenant-scoped).

### RBAC Permission System

Two parallel role systems:
- **Identity Roles** (`Admin`, `Member`): Used for `[Authorize(Roles = "Admin")]`.
- **Custom RBAC Roles** (tenant-scoped): Permission policies like `[Authorize(Policy = "Permission:Contact:View")]`. Scopes: `None`, `Own`, `Team`, `All`. Field-level permissions: `Editable`, `ReadOnly`, `Hidden`.

Frontend mirrors this with `HasPermissionDirective` (`*appHasPermission`), `FieldAccessDirective` (`[appFieldAccess]`), `permissionGuard`, and `adminGuard`.

## Key Conventions

### Backend

- **Table/column names**: PostgreSQL snake_case (`deals`, `tenant_id`, `created_at`).
- **JSONB columns**: `CustomFields` on all CRM entities, with GIN indexes. `EnableDynamicJson()` on NpgsqlDataSource.
- **Full-text search**: `HasGeneratedTsVectorColumn()` creates GIN-indexed `tsvector` columns for searchable text fields.
- **Seed data**: Every CRM entity has `bool IsSeedData`. `TenantSeeder` sets it to `true` for bulk cleanup during reseed.
- **Auditing**: `AuditableEntityInterceptor` auto-sets `CreatedAt`/`UpdatedAt` on any entity with those properties.
- **Timeline endpoints**: `GET /{id}/timeline` assembles chronological events from entity timestamps, histories, relationships, and notes.
- **Feed + Notifications**: Write operations dispatch `FeedItem` creation and `NotificationDispatcher.DispatchAsync()` inside try/catch (failures don't fail the primary operation).
- **SignalR**: Hub at `/hubs/crm`, groups by `tenant_{tenantId}` and `user_{userId}`. JWT via `?access_token=` query param.
- **JSON serialization**: Enums as camelCase strings (`JsonStringEnumConverter`).

### Frontend

- **Feature structure**: Each entity has `feature.routes.ts`, `feature-list/`, `feature-detail/`, `feature-form/`, `feature.store.ts`, `feature.service.ts`, `feature.models.ts`.
- **Styling**: Three-layer system — CSS custom properties in `src/styles/tokens.css` (source of truth) → Angular Material M3 theme in `styles.scss` → Tailwind config in `tailwind.config.js` (all reference the same token vars). Primary color: orange.
- **Shared components**: `DynamicTableComponent` (all list pages), `FilterPanelComponent`, `RelatedEntityTabsComponent` (all detail pages with tab constants like `COMPANY_TABS`), `EntityTimelineComponent`, `EntityAttachmentsComponent`, `RichTextEditorComponent`, `CrmButtonComponent`.
- **Entity list pattern**: All list pages share `src/styles/_entity-list.scss` via `styleUrl`.
- **Pagination/filtering**: Services build `HttpParams` from `EntityQueryParams`. Filters serialized as `JSON.stringify(filters[])` in a `filters` query param.
- **SignalR**: `SignalRService` connects to `/hubs/crm` with auto-reconnect `[0, 2s, 10s, 30s]`. Events: `ReceiveNotification`, `FeedUpdate`, `FeedCommentAdded`, `ImportProgress`.

## Project Structure

```
src/
  GlobCRM.Domain/          # Entities/, Enums/, Interfaces/
  GlobCRM.Application/     # Organizations/, Invitations/, Common/
  GlobCRM.Infrastructure/  # Persistence/, Services/, Authorization/, MultiTenancy/
  GlobCRM.Api/             # Controllers/, Middleware/, Hubs/
globcrm-web/src/app/
  core/                    # api/, auth/, permissions/, signalr/, tenant/
  features/                # 18 lazy-loaded feature areas
  shared/                  # components/, directives/, models/, services/
.planning/                 # PROJECT.md, ROADMAP.md, REQUIREMENTS.md, STATE.md, phases/
scripts/                   # rls-setup.sql
```

## Configuration

Key config sections in `appsettings.json`: `ConnectionStrings:DefaultConnection`, `Jwt` (Issuer/Audience/Key), `SendGrid`, `Gmail`, `FileStorage:Provider` (Local | Azure), `Serilog`.

Frontend environments: `environment.development.ts` (`apiUrl: http://localhost:5233`), `environment.ts` (`apiUrl: https://api.globcrm.com`). File replacement happens at build time.
