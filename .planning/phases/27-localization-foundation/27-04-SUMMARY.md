---
phase: 27-localization-foundation
plan: 04
subsystem: ui
tags: [transloco, i18n, localization, angular, lazy-loading, organization, settings, turkish]

# Dependency graph
requires:
  - phase: 27-01
    provides: "Transloco i18n foundation with TranslocoHttpLoader and LanguageService"
provides:
  - "Per-feature scoped translation lazy-loading pattern (contacts + settings as proof)"
  - "Contacts EN/TR translation files with list, detail, form keys"
  - "Settings EN/TR translation files with hub, language, items keys"
  - "Organization.DefaultLanguage column in database with 'en' default"
  - "GET /api/organizations/default-language endpoint"
  - "PUT /api/organizations/settings/language endpoint (Admin only)"
  - "Language settings page at /settings/language"
  - "Language card in settings hub Organization section"
  - "LanguageService.syncFromProfile() org default fallback for new users"
affects: [28-localization-rollout]

# Tech tracking
tech-stack:
  added: []
  patterns: ["provideTranslocoScope('scopeName') in route providers for per-feature lazy-loading", "Translation files at src/assets/i18n/{scope}/{lang}.json"]

key-files:
  created:
    - "globcrm-web/src/assets/i18n/contacts/en.json"
    - "globcrm-web/src/assets/i18n/contacts/tr.json"
    - "globcrm-web/src/assets/i18n/settings/en.json"
    - "globcrm-web/src/assets/i18n/settings/tr.json"
    - "globcrm-web/src/app/features/settings/language/language-settings.component.ts"
    - "src/GlobCRM.Infrastructure/Persistence/Migrations/Tenant/20260221072053_AddOrganizationDefaultLanguage.cs"
  modified:
    - "globcrm-web/src/app/features/contacts/contacts.routes.ts"
    - "globcrm-web/src/app/features/settings/settings.routes.ts"
    - "globcrm-web/src/app/features/settings/settings-hub.component.ts"
    - "globcrm-web/src/app/core/i18n/language.service.ts"
    - "src/GlobCRM.Domain/Entities/Organization.cs"
    - "src/GlobCRM.Infrastructure/Persistence/Configurations/OrganizationConfiguration.cs"
    - "src/GlobCRM.Api/Controllers/OrganizationsController.cs"
    - "src/GlobCRM.Application/Organizations/OrganizationDto.cs"

key-decisions:
  - "Per-feature lazy-loading uses provideTranslocoScope in route providers array with parent route wrapper"
  - "Translation files organized as assets/i18n/{scope}/{lang}.json, compatible with existing TranslocoHttpLoader"
  - "Organization default language fetched via API call in syncFromProfile fallback (TenantStore not yet populated)"
  - "Language settings component saves on selection change (no separate Save button) for streamlined UX"

patterns-established:
  - "Feature scope pattern: wrap routes in parent with providers: [provideTranslocoScope('featureName')] and create assets/i18n/{featureName}/en.json + tr.json"
  - "Language resolution order: user profile preference > org default (API) > browser detection > 'en'"

requirements-completed: [LOCL-05, LOCL-07]

# Metrics
duration: 7min
completed: 2026-02-21
---

# Phase 27 Plan 04: Feature Scoped Translation Lazy-Loading & Organization Default Language Summary

**Per-feature Transloco scope lazy-loading for contacts and settings with Organization.DefaultLanguage backend support, admin language settings page, and syncFromProfile org-default fallback**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-21T07:16:35Z
- **Completed:** 2026-02-21T07:23:36Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Established the per-feature translation lazy-loading pattern using provideTranslocoScope, proven with contacts and settings scopes
- Created complete EN and TR translation files for contacts (list, detail, form) and settings (hub, language, items) features
- Added Organization.DefaultLanguage to the domain model with EF Core migration, GET/PUT API endpoints, and admin-only language settings page
- Updated LanguageService.syncFromProfile() to fall back to org default language for new users with no personal preference

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scoped translation files and configure lazy-loading in feature routes** - `6c78dbd` (feat)
2. **Task 2: Add Organization DefaultLanguage backend support and settings hub language card** - `488d0a2` (feat)

## Files Created/Modified
- `globcrm-web/src/assets/i18n/contacts/en.json` - Contacts feature English translations (list, detail, form keys)
- `globcrm-web/src/assets/i18n/contacts/tr.json` - Contacts feature Turkish translations
- `globcrm-web/src/assets/i18n/settings/en.json` - Settings feature English translations (hub, language, items keys)
- `globcrm-web/src/assets/i18n/settings/tr.json` - Settings feature Turkish translations
- `globcrm-web/src/app/features/contacts/contacts.routes.ts` - Wrapped with provideTranslocoScope('contacts')
- `globcrm-web/src/app/features/settings/settings.routes.ts` - Wrapped with provideTranslocoScope('settings'), added language route
- `globcrm-web/src/app/features/settings/settings-hub.component.ts` - Added Language card to Organization section
- `globcrm-web/src/app/features/settings/language/language-settings.component.ts` - Language settings page with select and save-on-change
- `globcrm-web/src/app/core/i18n/language.service.ts` - Added org default language fallback in syncFromProfile()
- `src/GlobCRM.Domain/Entities/Organization.cs` - Added DefaultLanguage property
- `src/GlobCRM.Infrastructure/Persistence/Configurations/OrganizationConfiguration.cs` - Added default_language column config
- `src/GlobCRM.Infrastructure/Persistence/Migrations/Tenant/20260221072053_AddOrganizationDefaultLanguage.cs` - Migration adding default_language column
- `src/GlobCRM.Api/Controllers/OrganizationsController.cs` - Added GET default-language and PUT settings/language endpoints
- `src/GlobCRM.Application/Organizations/OrganizationDto.cs` - Added DefaultLanguage to DTO and FromEntity mapping

## Decisions Made
- Per-feature lazy-loading uses provideTranslocoScope in route providers array, wrapping all feature routes under a parent route -- this keeps the scope injection at the route level rather than per-component
- Translation files organized as assets/i18n/{scope}/{lang}.json which works automatically with the existing TranslocoHttpLoader (lang param becomes "contacts/en")
- Organization default language fetched via direct API call in syncFromProfile rather than via TenantStore, since TenantStore is not yet populated with org data in the codebase
- Language settings component uses save-on-change pattern (no explicit Save button) for a streamlined admin experience

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Per-feature translation scope pattern fully established and documented for Phase 28 rollout
- Pattern: provideTranslocoScope in route providers + assets/i18n/{scope}/{lang}.json
- Organization default language infrastructure complete (domain, migration, API, UI, service fallback)
- Ready to replicate the scoped translation pattern across all remaining features in Phase 28

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 27-localization-foundation*
*Completed: 2026-02-21*
