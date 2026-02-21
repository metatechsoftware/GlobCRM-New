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

## Design System — "Warm Modern" CRM Theme

All frontend UI must follow the design system defined in `crm-design-system.html`. Key rules:

### Color Philosophy

- **Dark mode**: Warm chocolate-brown surfaces (`#141110` → `#1C1917` → `#231F1C` → `#2C2623` → `#342D29`). Brown ≠ mud — use warm undertones, not muddy grays.
- **Light mode**: Warm linen-to-sand beiges (`#FAF7F4` → `#F5F0EB` → `#EDE7DF` → `#E5DDD4` → `#DDD4C9`). Beige ≠ washed out — not gray-yellow. WCAG AA minimum on all text.
- **Single accent**: Orange is the ONLY accent color. No secondary accent colors ever. Orange marks interactive, active, and high-priority elements. Everything else is monochrome.
- **Orange scale**: `--orange-600: #EA580C`, `--orange-500: #F97316` (primary), `--orange-400: #FB923C`, `--orange-300: #FDBA74`, `--orange-glow: rgba(249,115,22,0.12)`.
- **Semantic colors** (shared across modes): positive `#34D399`, negative `#FB7185`, caution `#FBBF24`, info `#60A5FA`.

### Typography — 3 Fonts Only

1. **Plus Jakarta Sans** — Primary UI font. Headers (weight 600–800), buttons/labels/body (weight 400–500). Letter-spacing: `-0.03em` for display, `-0.02em` for section titles.
2. **Fraunces** — Accent serif, use sparingly. Only for empty states, onboarding screens, marketing pages. Italic, weight 300–600.
3. **JetBrains Mono** — Monospace for data. Deal values, currency, dates, IDs, timestamps, metadata, overline labels, code references. Weight 400–600.

### Design Tokens

- **Text hierarchy** (4 tiers): `--text-primary` (headings, names), `--text-secondary` (body, values), `--text-muted` (labels, descriptions), `--text-faint` (timestamps, disabled).
- **Borders**: `--border-subtle` (6% opacity, card borders), `--border-default` (10–12%, inputs/dividers), `--border-hover` (16–20%, hover states).
- **Radii**: `sm: 6px` (buttons, inputs), `md: 10px` (cards, tabs), `lg: 14px` (large cards, panels), `xl: 20px`, `full: 100px` (pills, badges, avatars).
- **Shadows**: `sm` (subtle lift), `md` (card hover), `lg` (modals/overlays), `glow` (orange focus ring: `0 0 24px var(--orange-glow)`).
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions. Theme transitions: `0.5s`. Interactive hovers: `0.25–0.35s`.

### Component Patterns

- **Cards**: `bg-card` background + `border-subtle` border. On hover: `border-hover` + `translateY(-2px)` + `shadow-md`.
- **Buttons**: Primary = `orange-500` bg, white text, `radius-sm`. Ghost = transparent, `border-default`, `text-muted`.
- **Inputs**: `bg-input` background, `border-default`. On focus: `border-color: orange-500` + `box-shadow: 0 0 0 3px var(--orange-glow)`.
- **Avatars**: Gradient `orange-400 → orange-600`, circular, white initials, 42px default.
- **Status chips/badges**: Monochrome `bg-elevated` + `border-subtle` by default. Active/hot variants use `orange-glow` bg + `orange-500` text.
- **Tabs**: Pill-style inside a `bg-card` container. Active tab gets `bg-elevated` + `text-primary` + `shadow-sm`.
- **Pipeline dots**: done = `--positive`, active = `--orange-500` + glow shadow, pending = `--text-faint`.
- **Feed icons**: Circular with 12% opacity semantic background (email = info, call = positive, deal = orange).
- **KPI numbers**: `JetBrains Mono`, large weight-600, separators/units in `orange-500`.
- **Overline labels**: `JetBrains Mono`, `0.58–0.62rem`, uppercase, `letter-spacing: 0.08–0.1em`, `orange-500` color.

### Design Principles

1. **Comfortable density**: Cards use 20–28px padding, 12–16px gaps. Dense enough for power users, breathable enough for all-day usage.
2. **Soft radius, sharp data**: Round corners (10–14px) on containers for warmth. Crisp, aligned text and monospace numbers for scannability.
3. **Seamless mode switch**: Both modes share identical layouts, spacing, and component structure. Only surface colors and text shades change — users must never feel disoriented switching.
4. **Orange is the only heat**: Constraint creates brand recognition. No blue/green/purple accents for interactive states.

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
- **Styling**: Three-layer system — CSS custom properties in `src/styles/tokens.css` (source of truth) → Angular Material M3 theme in `styles.scss` → Tailwind config in `tailwind.config.js` (all reference the same token vars). Must follow the "Warm Modern" design system above (brown/beige surfaces, orange-only accent, 3-font type system).
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
