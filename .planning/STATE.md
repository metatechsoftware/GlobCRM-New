# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.
**Current focus:** v1.3 Platform & Polish — Phase 30 (Free-form Kanban Boards)

## Current Position

Phase: 30 of 31 (Free-form Kanban Boards)
Plan: 2 of 6 complete
Status: In progress
Last activity: 2026-02-21 — Completed 30-02-PLAN.md (Kanban API endpoints)

Progress: [████████████████████] 98% (187/~191 plans estimated)

## Milestones

- ✅ v1.0 MVP — 12 phases, 96 plans (2026-02-18)
- ✅ v1.1 Automation & Intelligence — 9 phases, 43 plans (2026-02-20)
- ✅ v1.2 Connected Experience — 5 phases, 19 plans (2026-02-20)
- ◆ v1.3 Platform & Polish — 5 phases (27-31), 52 requirements, ready to plan

## Performance Metrics

**Velocity:**
- Total plans completed: 186
- v1.0: 96 plans across 12 phases
- v1.1: 43 plans across 9 phases
- v1.2: 19 plans across 5 phases
- v1.3: 25 plans across 4 phases (Phase 27-30)

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
- 28-09: common.summaryTab.fields.* dedicated namespace for entity-summary-tab field labels (separate from common.preview.fields.*)
- 28-09: common.preview.fields.* dedicated namespace for entity-preview field labels (separate from summaryTab)
- 28-09: Added SKU key to preview.fields for product-preview completeness beyond original plan
- 28-09: Added nav.expandSidebar/collapseSidebar keys for sidebar aria-labels (Rule 2 - accessibility)
- 28-08: emailAccountSnack separate JSON section for email account snackbar messages to avoid collision with emailAccounts template keys
- 28-08: TranslocoService.translate() with interpolation params for member add/remove snackbar messages containing user names
- 28-08: window.confirm() disconnect prompt uses transloco.translate() for runtime i18n of browser native dialog
- 28-10: workflow-canvas getTriggerBadge/getActionBadge refactored to use existing nodes.* translation keys via transloco.translate()
- 28-10: i18n baseline reduced from 347 to 2 false-positive entries (numeric threshold expressions, not translatable strings)
- 29-01: CredentialEncryptionService uses DataProtection with purpose string 'GlobCRM.Integration.Credentials' (same pattern as Gmail TokenEncryptionService)
- 29-01: IntegrationActivityLog has its own TenantId and global query filter for direct query capability
- 29-01: Unique composite index on (tenant_id, integration_key) enforces one connection per integration per tenant
- 29-03: Card component uses custom CSS badges instead of Material chips for lighter weight and better brand-color control
- 29-03: Category filter uses custom pill buttons instead of MatChipListbox for visual consistency with settings hub
- 29-03: Placeholder methods for connect/viewDetails prepared for Plan 04 wiring
- 29-02: ITenantProvider used for tenant context (consistent with WebhooksController) instead of IHttpContextAccessor
- 29-02: User name from firstName/lastName JWT claims with email fallback for activity log denormalization
- 29-02: Re-connect flow reuses existing disconnected Integration entity to avoid unique index violation
- 29-04: IntegrationStore uses callback pattern (onSuccess/onError) consistent with WebhookStore for async result handling
- 29-04: Connect dialog builds FormGroup dynamically from CredentialFieldDef array with required validators per field definition
- 29-04: Card component uses MatMenu three-dot pattern for connected state actions (Test/Disconnect) to keep card clean
- 29-05: Detail panel uses template-driven right-side drawer (not CDK Overlay) with CSS transform slide animation for simplicity
- 29-05: Test connection result displayed inline in detail panel (not toast) for immediate contextual visibility
- 29-05: Transloco interpolation params used for snackbar messages with dynamic integration names
- 29-05: Category chip labels use labelKey pattern translated via TranslocoPipe for reactive language switching
- 28-11: TranslocoLoaderData.scope used to construct scoped file path (assets/i18n/{scope}/{lang}.json)
- 28-11: LanguageService.switchLanguage() called in settings success handler for immediate UI update
- 28-11: labelKey checked before label in getColumnLabel/getLabel for backward-compatible translation
- 28-12: Dual-key notification types (PascalCase enum + snake_case API) for universal resolution in my-day scope
- 28-12: toLocaleUpperCase() replaces toUpperCase() in notification widget fallback for Turkish I/i safety
- 28-12: Products uses module-level PRODUCT_CORE_COLUMNS const; emails skips labelKey for icon-only columns
- 28-12: Settings notification prefs use transloco.translate() with typeLabels/typeDescriptions namespace replacing hardcoded consts
- 30-01: CreatorId made nullable (Guid?) to support SetNull FK delete behavior when user is deleted
- 30-02: Renamed CreateCommentRequest to CreateCardCommentRequest to avoid namespace collision with FeedController
- 30-02: Added MoveCardValidator and UpdateCardValidator beyond plan spec for input validation completeness

### Pending Todos

None.

### Blockers/Concerns

- Phase 31 (Quote PDF Templates) requires `/gsd:research-phase` before planning — Unlayer document mode and Playwright production deployment need proof-of-concept validation
- v1.2 tech debt: `any[]` types in preview-notes-tab and preview-activities-tab components (fix in Phase 27 or 28)
- v1.2 tech debt: EntityPreviewController missing Quote/Request backend handlers

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 30-02-PLAN.md (Kanban API endpoints)
Resume file: .planning/phases/30-free-form-kanban-boards/30-02-SUMMARY.md
Next step: Execute 30-03-PLAN.md (Kanban frontend service & store)
