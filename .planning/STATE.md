# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.3 Platform & Polish — Phase 28 (Localization String Extraction)

## Current Position

Phase: 28 of 31 (Localization String Extraction)
Plan: 6 of 7 complete
Status: Executing Phase 28
Last activity: 2026-02-21 — Completed 28-05 (Dashboard/My-Day/Calendar/Reports/Workflows i18n)

Progress: [███████████████████░] 92% (171/~188 plans estimated)

## Milestones

- ✅ v1.0 MVP — 12 phases, 96 plans (2026-02-18)
- ✅ v1.1 Automation & Intelligence — 9 phases, 43 plans (2026-02-20)
- ✅ v1.2 Connected Experience — 5 phases, 19 plans (2026-02-20)
- ◆ v1.3 Platform & Polish — 5 phases (27-31), 52 requirements, ready to plan

## Performance Metrics

**Velocity:**
- Total plans completed: 169
- v1.0: 96 plans across 12 phases
- v1.1: 43 plans across 9 phases
- v1.2: 19 plans across 5 phases
- v1.3: 12 plans across 2 phases (Phase 27-28)

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

- 27-01: LanguageService uses localStorage-only persistence; backend profile API integration deferred to Plan 02
- 27-01: missingHandler configured with useFallbackTranslation: true for graceful fallback (LOCL-06)
- 27-01: Language detection priority: localStorage > navigator.language > default 'en'
- 27-02: Backend persistence is fire-and-forget with silent error handling to never block the UI
- 27-02: Language toggle uses self-translating label (Language/Dil) for bootstrap reliability
- 27-02: stopPropagation keeps mat-menu open during language toggle interaction
- 27-03: Used Intl.DateTimeFormat with TranslocoService locale mapping instead of TranslocoLocaleService pipe for synchronous DynamicTable formatting
- 27-03: DateAdapter.setLocale() centralized in LanguageService.switchLanguage() as single locale switch point
- 27-03: Consolidated provideNativeDateAdapter from 7 component-level providers to root app.config.ts
- 27-04: Per-feature lazy-loading uses provideTranslocoScope in route providers with parent route wrapper
- 27-04: Translation files at assets/i18n/{scope}/{lang}.json, compatible with existing TranslocoHttpLoader
- 27-04: Org default language fetched via API in syncFromProfile fallback (TenantStore not yet populated)
- 27-04: Language resolution order: user profile > org default (API) > browser detection > 'en'
- 27-05: syncLanguage parameter on handleLoginSuccess skips language sync during automatic token refresh
- 27-05: Language sync is fire-and-forget after login, does not block navigation or UI rendering
- 27-05: On preferences fetch failure, syncFromProfile(null) triggers org default fallback chain
- 28-01: Entity-specific property labels deferred to feature-scoped plans (not global keys)
- 28-01: Filter operator labels remain hardcoded in TS (computed values, not template strings)
- 28-01: Summary tab section titles translated globally; entity property labels left for feature scopes
- 28-02: Contacts scope JSON extended from ~50 to ~145 keys (Phase 27 only had initial keys)
- 28-02: Lead conversion dialog uses scoped leads keys (convert.*) since opened within leads route scope
- 28-02: Temperature values translated in form but kanban card values from model kept as-is
- 28-02: Stage/source/pipeline names are API-provided data, not translated in scope JSON
- 28-03: TranslocoService.translate() used for snackBar messages and getTransitionLabel methods (programmatic TS calls)
- 28-03: mat-tab labels use [label] property binding with transloco pipe for dynamic translation
- 28-05: Module-level const arrays (operators, aggregation) use labelKey pattern translated dynamically via TranslocoService.translate() at call time
- 28-05: entityTypes/statuses arrays in workflow-list converted to computed() signals for reactive language switching
- 28-05: Workflow node badges use TranslocoService.translate() with Record keyMap for clean translation code
- 28-06: Settings hub data model refactored to use translation key references (titleKey/labelKey/descriptionKey)
- 28-06: TranslocoService.translate() used in computed filteredSections for live search against translated labels
- 28-06: Webhook/email/notifications/duplicate-rules inline templates got TranslocoPipe in imports for future template updates

### Pending Todos

None.

### Blockers/Concerns

- Phase 31 (Quote PDF Templates) requires `/gsd:research-phase` before planning — Unlayer document mode and Playwright production deployment need proof-of-concept validation
- v1.2 tech debt: `any[]` types in preview-notes-tab and preview-activities-tab components (fix in Phase 27 or 28)
- v1.2 tech debt: EntityPreviewController missing Quote/Request backend handlers

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 28-05-PLAN.md (Dashboard/My-Day/Calendar/Reports/Workflows i18n)
Resume file: .planning/phases/28-localization-string-extraction/28-05-SUMMARY.md
Next step: Execute remaining plans (28-04 pending summary, 28-07)
