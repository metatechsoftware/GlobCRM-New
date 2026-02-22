---
phase: 31-quote-pdf-templates
plan: 01
subsystem: database, api, infra
tags: [playwright, pdf, entity-framework, postgresql, quote-templates, playwright-chromium]

# Dependency graph
requires:
  - phase: 08-quotes-requests
    provides: Quote entity, QuoteLineItem, QuoteConfiguration, QuotePdfDocument (QuestPDF)
provides:
  - QuoteTemplate entity with DesignJson, HtmlBody, page config, and thumbnail support
  - PlaywrightPdfService singleton for HTML-to-PDF and PNG thumbnail generation
  - IQuoteTemplateRepository interface and EF Core repository implementation
  - Organization branding fields (LogoUrl, Address, Phone, Email, Website)
  - EF Core migrations for quote_templates table and organization branding columns
  - RLS policy for quote_templates table
affects: [31-02, 31-03, 31-04, 31-05]

# Tech tracking
tech-stack:
  added: [Microsoft.Playwright 1.58.0]
  patterns: [singleton browser with context-per-request, PdfGenerationOptions record, partial unique index for default enforcement]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/QuoteTemplate.cs
    - src/GlobCRM.Domain/Interfaces/IQuoteTemplateRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/QuoteTemplateConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/QuoteTemplateRepository.cs
    - src/GlobCRM.Infrastructure/Services/PlaywrightPdfService.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260222060459_AddQuoteTemplates.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/Tenant/20260222060521_AddOrganizationBrandingFields.cs
  modified:
    - src/GlobCRM.Domain/Entities/Organization.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/OrganizationConfiguration.cs
    - src/GlobCRM.Infrastructure/Pdf/PdfServiceExtensions.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
    - scripts/rls-setup.sql

key-decisions:
  - "PlaywrightPdfService registered as singleton with lazy-init Chromium browser and context-per-request pattern for performance"
  - "Organization branding fields added directly to existing entity (not a separate OrganizationBranding entity) for simplicity"
  - "Partial unique index on (tenant_id, is_default) WHERE is_default = true enforces one default template per tenant at database level"
  - "PdfGenerationOptions as C# record type for immutable PDF settings"
  - "Dual migration: ApplicationDbContext for quote_templates, TenantDbContext for organization branding fields"

patterns-established:
  - "Singleton PlaywrightPdfService: lazy-init browser with SemaphoreSlim double-check locking, NewContextAsync per operation, context disposed in finally"
  - "PdfGenerationOptions record for clean PDF configuration passing"

requirements-completed: [QTPL-01, QTPL-09, QTPL-11]

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 31 Plan 01: Backend Foundation Summary

**QuoteTemplate entity with page config and thumbnail support, PlaywrightPdfService singleton for HTML-to-PDF/PNG generation, Organization branding fields, EF migrations, and RLS policy**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T05:59:35Z
- **Completed:** 2026-02-22T06:08:34Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- QuoteTemplate entity with full page configuration (size, orientation, margins), DesignJson (JSONB), HtmlBody (text), and ThumbnailPath for visual previews
- PlaywrightPdfService singleton with lazy-initialized Chromium browser, GeneratePdfAsync (configurable page format/margins), and GenerateThumbnailAsync (viewport-sized PNG screenshot)
- Organization entity extended with branding fields (LogoUrl, Address, Phone, Email, Website) for quote template merge data
- Complete EF Core infrastructure: configuration with partial unique index, repository with ClearDefault, DbSet, query filter, RLS policy, and two migrations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create QuoteTemplate entity, Organization branding fields, and repository interface** - `a0377e7` (feat)
2. **Task 2: Create EF Core configuration, repository, PlaywrightPdfService, migration, RLS, and DI registration** - `ca8865e` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/QuoteTemplate.cs` - QuoteTemplate entity with all properties including page config and thumbnail
- `src/GlobCRM.Domain/Entities/Organization.cs` - Added LogoUrl, Address, Phone, Email, Website branding fields
- `src/GlobCRM.Domain/Interfaces/IQuoteTemplateRepository.cs` - Repository interface with CRUD, GetDefault, ClearDefault
- `src/GlobCRM.Infrastructure/Persistence/Configurations/QuoteTemplateConfiguration.cs` - EF config with snake_case, JSONB, partial unique index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/OrganizationConfiguration.cs` - Added branding field column mappings
- `src/GlobCRM.Infrastructure/Persistence/Repositories/QuoteTemplateRepository.cs` - EF Core repository implementation
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added QuoteTemplate DbSet, configuration, and query filter
- `src/GlobCRM.Infrastructure/Services/PlaywrightPdfService.cs` - Singleton PDF/thumbnail service with PdfGenerationOptions record
- `src/GlobCRM.Infrastructure/Pdf/PdfServiceExtensions.cs` - Added PlaywrightPdfService singleton registration
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Added QuoteTemplateRepository scoped registration
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - Added Microsoft.Playwright 1.58.0 package reference
- `scripts/rls-setup.sql` - Added quote_templates RLS policy with FORCE and tenant isolation
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260222060459_AddQuoteTemplates.cs` - Creates quote_templates table
- `src/GlobCRM.Infrastructure/Persistence/Migrations/Tenant/20260222060521_AddOrganizationBrandingFields.cs` - Adds branding columns to organizations

## Decisions Made
- PlaywrightPdfService uses singleton with lazy browser initialization and SemaphoreSlim for thread-safe double-check locking -- consistent with research recommendation for singleton browser with context-per-request
- Organization branding fields added directly to the existing Organization entity rather than a separate entity -- simpler, avoids extra join in merge field resolution
- Partial unique index `idx_quote_templates_tenant_default` uses `HasFilter("is_default = true")` to enforce one default per tenant at the database level
- PdfGenerationOptions defined as a C# record type for clean, immutable parameter passing
- Generated two separate migrations (ApplicationDbContext for quote_templates, TenantDbContext for organization branding) since Organization is owned by TenantDbContext

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added TenantDbContext migration for Organization branding fields**
- **Found during:** Task 2 (migration generation)
- **Issue:** Plan only specified ApplicationDbContext migration for QuoteTemplates. Organization entity is owned by TenantDbContext for migrations, so branding field changes also need a TenantDbContext migration.
- **Fix:** Generated additional migration `AddOrganizationBrandingFields` via TenantDbContext
- **Files modified:** Persistence/Migrations/Tenant/20260222060521_AddOrganizationBrandingFields.cs
- **Verification:** Both migrations generated correctly, build succeeds
- **Committed in:** ca8865e (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added OrganizationConfiguration mapping for branding fields**
- **Found during:** Task 2 (EF configuration)
- **Issue:** Plan didn't explicitly mention updating OrganizationConfiguration.cs, but new properties need column mappings for snake_case convention
- **Fix:** Added Property mappings for LogoUrl, Address, Phone, Email, Website with proper column names and MaxLength
- **Files modified:** OrganizationConfiguration.cs
- **Verification:** Migration generates correct column definitions, build succeeds
- **Committed in:** ca8865e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for correct database schema. No scope creep.

## Issues Encountered
- GlobCRM.Api process was running and locking DLLs during initial build -- killed the process and build succeeded
- Playwright Chromium browser installation completed silently (no output) but was verified as working

## User Setup Required
Playwright Chromium browsers must be installed on any development or deployment machine:
```bash
cd src/GlobCRM.Api && dotnet build
pwsh bin/Debug/net10.0/playwright.ps1 install chromium
```
For Docker deployments, use `mcr.microsoft.com/playwright/dotnet:v1.58.0-noble` base image.

## Next Phase Readiness
- QuoteTemplate entity, repository, and PlaywrightPdfService are ready for API controller (Plan 02+)
- Organization branding fields available for merge field resolution in template rendering
- All domain layer and infrastructure layer foundations complete for Plans 02-05

## Self-Check: PASSED

All 9 key files verified as existing. Both task commits (a0377e7, ca8865e) verified in git log.

---
*Phase: 31-quote-pdf-templates*
*Completed: 2026-02-22*
