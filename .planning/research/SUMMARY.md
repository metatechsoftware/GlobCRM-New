# Project Research Summary

**Project:** GlobCRM v1.3 — Platform & Polish
**Domain:** Integration marketplace, free-form Kanban boards, Quote PDF template builder (Unlayer), Localization (EN + TR)
**Researched:** 2026-02-20
**Confidence:** MEDIUM-HIGH (HIGH for Kanban and Localization patterns; MEDIUM for PDF rendering pipeline; LOW-MEDIUM for Unlayer document mode specifics)

## Executive Summary

GlobCRM v1.3 adds four distinct platform capabilities to an existing 275K LOC multi-tenant SaaS CRM. Unlike v1.2, which was frontend-heavy UX work with zero new dependencies, v1.3 introduces new domain entities, a cross-cutting i18n concern, and significant backend infrastructure including an HTML-to-PDF rendering pipeline and an encrypted credential store. The key strategic insight across all four features is that each builds heavily on existing codebase patterns: CDK drag-drop (already proven in 3 Kanban views), the Unlayer editor (already integrated for email templates), the Fluid/Liquid template engine (already used for email rendering), and Hangfire (already used for background jobs). This dramatically reduces unknown risk — only 3 new packages are required across the entire milestone, and the primary uncertainties are Unlayer document mode HTML export behavior and Playwright/Chromium production deployment.

The recommended approach is to execute features in dependency order: Localization infrastructure first (because it affects every component built after it), then Integration Marketplace (smallest scope, highest business visibility, establishes security patterns), then Kanban Boards (proven CDK patterns, medium scope), then Quote PDF Templates last (highest technical risk due to the HTML-to-PDF pipeline). The single most consequential architectural decision in v1.3 is how to convert Unlayer-designed templates to PDF — using Playwright with print-specific CSS injection is the recommended path, but this needs early proof-of-concept validation before the phase begins.

The top risks are all security-related: integration credential storage without proper tenant isolation could cause cross-tenant OAuth token leakage (a GDPR/SOC2 violation), and Kanban board entities missing TenantId would bypass the triple-layer tenant defense. Both risks are fully preventable by following existing patterns (TenantId on all entities, RLS policies in `scripts/rls-setup.sql`, EF Core global query filters). The localization effort carries a different risk: the codebase has 415+ hardcoded English strings across 59 files with zero i18n infrastructure. Setting up Transloco before building any other v1.3 feature prevents the string-extraction backlog from growing.

## Key Findings

### Recommended Stack

v1.3 requires **2 new frontend packages and 1 new backend package** — a remarkably minimal dependency footprint for four major features. All other functionality reuses existing libraries already proven in the codebase.

**Core technology additions:**
- `@jsverse/transloco` ^8.2.1: Runtime i18n with Signal API, lazy-loaded JSON files, standalone-first design. Chosen over ngx-translate (maintenance mode, no Signal API) and Angular built-in i18n (compile-time only, no runtime language switching). Required because users must toggle EN/TR at runtime without a page reload.
- `@jsverse/transloco-locale` ^8.2.1: Companion for locale-aware date/number/currency formatting via native `Intl` APIs. Required because Turkish uses comma as decimal separator and different date formats (20.02.2026 vs 02/20/2026).
- `Microsoft.Playwright` ^1.58.0: HTML-to-PDF conversion for Unlayer-designed quote templates. Official Microsoft package with headless Chromium and well-documented .NET PDF API. Preferred over PuppeteerSharp (less .NET-native), DinkToPdf (dead project), and IronPDF (commercial license required).

**Reused existing packages (zero additions needed):**
- `@angular/cdk/drag-drop`: Already proven in DealKanban, ActivityKanban, LeadKanban — same directives, same patterns for free-form Kanban.
- `angular-email-editor` (Unlayer): Already integrated for email templates. Quote PDF templates reuse the same component with `displayMode: 'web'` or `'document'` instead of `'email'`.
- `Fluid.Core` + `TemplateRenderService`: Already handles Liquid merge field resolution for email templates. Reused identically for PDF template merge field rendering.
- `@ngrx/signals`, `@angular/material`, SignalR, Hangfire, QuestPDF: All reused for new features with existing patterns.

See `.planning/research/STACK.md` for full version matrix, installation commands, and feature-by-feature stack mapping.

### Expected Features

**Must have (table stakes — cannot ship v1.3 without):**
- Integration Marketplace: card grid layout with status badges, category filtering, connect/disconnect with API key credential entry and masking, connection status display, admin-only write access, integration detail panel
- Kanban Boards: full board/column/card CRUD, drag-and-drop between columns and within columns (with sort order persistence), card detail dialog, labels with colors, assignees, due dates with urgency indicators, board visibility controls (Private/Team/Public)
- Quote PDF Templates: Unlayer document-mode editor (WYSIWYG), merge field insertion panel, template CRUD with default selection, line items table support, PDF preview with real data, PDF download from quote detail
- Localization: Transloco translation pipe/directive in all component templates, EN/TR JSON files, runtime language switcher in navbar, user language preference persistence, locale-aware date/number/currency formatting, Material component label localization (paginator, sort, date picker)

**Should have (differentiators):**
- Integration: connection health check/test button, integration activity log, popular/featured badges
- Kanban: entity-linked cards (the CRM-unique differentiator linking cards to Contacts/Deals/Companies with preview sidebar integration), WIP column limits, board templates (3 seed templates), card checklists, card comments, client-side card filtering by label/assignee/due date
- PDF Templates: multiple templates per tenant, template cloning, page size/orientation configuration, thumbnail preview in template list
- Localization: scoped lazy-loading of translation files per feature, admin-configurable tenant default locale, CI translation coverage check script

**Defer to v1.4+:**
- Real third-party API integrations (Mailchimp, Slack, QuickBooks) — each is its own project; v1.3 is infrastructure only
- Card file attachments on Kanban (heavyweight per-card storage)
- Board automations (trigger actions on card moves)
- Conditional sections in PDF templates (Fluid supports it; user-friendly UI in Unlayer is complex)
- Full backend error message localization (frontend-first approach covers 90% of user-visible strings)
- E-signature on quote PDFs (future integration marketplace item)

See `.planning/research/FEATURES.md` for full feature tables with complexity ratings, MVP recommendations, and dependency maps.

### Architecture Approach

All four features follow existing Clean Architecture patterns without exception: new entities in Domain, repositories and services in Infrastructure with `Add{Feature}Services()` extension methods, controllers in Api with co-located DTOs, and standalone Signal-based Angular components with lazy-loaded routes. The architecture research confirmed clear component boundaries with minimal cross-feature coupling — each feature area can be built in parallel after the localization foundation is in place. The most architecturally complex new subsystem is the Integration Marketplace (OAuth credential management, AES-256 encrypted storage, Hangfire sync jobs). The simplest is free-form Kanban, which is pattern-identical to existing deal/activity Kanban views with user-defined columns instead of pipeline-stage columns.

**Major new components:**
1. `IntegrationsController` + `IntegrationOAuthService` + `IntegrationEncryptionService` — credential storage with AES-256 encryption using tenant-scoped DataProtection purpose strings (`GlobCRM.Integrations.{tenantId}`) and full RLS coverage
2. `BoardsController` + `BoardRepository` — Board/BoardColumn/BoardCard entities in separate normalized tables (not JSONB) to enable FK integrity for entity links and assignees; labels stored as JSONB array on card
3. `QuoteTemplatesController` + `HtmlToPdfService` (Playwright singleton browser) + `QuoteTemplateRenderer` (Fluid merge fields) — PDF pipeline extending existing TemplateRenderService; QuestPDF preserved as fallback
4. Transloco providers in `app.config.ts` + `assets/i18n/en.json` + `tr.json` + Material intl provider overrides — cross-cutting i18n layer touching all ~80+ component templates

**Key patterns that must be followed:**
- Every new tenant-scoped entity requires `TenantId`, EF Core `HasQueryFilter`, and an RLS policy in `scripts/rls-setup.sql` — no exceptions, including junction tables like `BoardCardEntityLink`
- New backend features use `Add{Feature}Services()` extension methods registered in `Program.cs`
- New frontend features follow `features/{name}/` structure: `feature.routes.ts`, `feature.store.ts`, `feature.service.ts`, `feature.models.ts`
- Per-page Signal stores provided in component `providers: []`, root stores for cross-cutting state (language preference lives in AuthStore)
- Kanban drag-drop IDs must be namespaced as `board-{boardId}-list-{listId}` to avoid collisions with existing `stage-{uuid}` IDs

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, component boundary tables, and the suggested build order.

### Critical Pitfalls

1. **Cross-tenant credential leakage (Integration Marketplace)** — The existing `TokenEncryptionService` uses tenant-agnostic DataProtection. New `IntegrationCredential` entity must have `TenantId`, its own RLS policy, AND use `_dataProtectionProvider.CreateProtector($"GlobCRM.Integrations.{tenantId}")` for tenant-scoped encryption. A shared encryption key means one tenant's encrypted blob could theoretically be decrypted in another tenant's request context. Integration test is mandatory: authenticate as Tenant B, attempt to read Tenant A credentials — must return 403 or empty.

2. **Unlayer HTML export is not print-ready PDF HTML** — Unlayer's `exportHtml()` always produces email-optimized table-based HTML with inline styles, regardless of `displayMode`. Converting this directly to PDF via Playwright produces wrong margins, broken layouts, and no page break control. The correct architecture: inject a print-specific CSS stylesheet server-side (`@page { size: A4; margin: 20mm; }`, `table { page-break-inside: avoid; }`, `body { width: 100% !important; }`) before passing HTML to Playwright. Keep QuestPDF as fallback for non-templated quotes — do not remove the existing `QuotePdfDocument`.

3. **Localization retrofit creates 1000+ untranslated string regressions** — 415+ hardcoded English strings confirmed across 59 files with zero i18n infrastructure currently in the codebase. Prevention: set up Transloco infrastructure FIRST, mandate translation keys in ALL new code, complete a full string extraction sprint, and add a CI key-count comparison script that fails the build if `en.json` and `tr.json` have different key sets.

4. **Kanban entities missing tenant isolation on junction tables** — All new entities (Board, BoardColumn, BoardCard, BoardCardEntityLink) need explicit `TenantId`. Junction tables are NOT exempted — querying `board_card_entity_links` directly (e.g., "all boards that reference this Contact") bypasses the parent entity's EF Core query filter. Add RLS for all four tables in `scripts/rls-setup.sql`.

5. **Unlayer merge tags do not support repeating blocks (line items)** — Unlayer merge tags are flat key-value substitutions only. Quote line items require a dynamic table with variable row count. Use hybrid approach: Unlayer handles static layout design, Fluid's `{% for item in quote.line_items %}` loop generates the HTML table server-side, and the result is injected as the value of a single `{{quote.line_items_table}}` merge field.

Additional moderate pitfalls: CDK drag-drop ID namespace collisions with existing Kanbans (namespace all IDs), fractional SortOrder for concurrent card position updates (use float values, not integers), Material intl provider localization independent of Transloco (configure `MatPaginatorIntl`, `MatDatepickerIntl`, etc.), and `any[]` type tech debt in preview components (fix before adding new entity preview types to prevent runtime TypeErrors).

See `.planning/research/PITFALLS.md` for all 15 pitfalls with full prevention strategies, detection methods, and phase-specific warning table.

## Implications for Roadmap

Based on combined research, the dependency graph is clear: Localization is a foundation layer that must precede all feature development, Integration Marketplace and Kanban Boards can run in parallel after that foundation, and Quote PDF Templates should come last due to the highest technical risk and the requirement for a Playwright proof-of-concept spike. The research supports 5 phases: a pre-work cleanup phase, then the four features in priority order.

### Phase 1: Foundation — Pre-work and Tech Debt Cleanup

**Rationale:** Two mandatory pre-requisites block all subsequent feature development. First, Transloco i18n infrastructure must be wired before any new UI code is written so no new hardcoded English strings are introduced. Second, the `any[]` type tech debt in preview components (`preview-notes-tab.component.ts` line 120, `preview-activities-tab.component.ts` line 141) causes runtime TypeErrors when adding new entity preview types — this must be fixed before any v1.3 entity types are added to the preview sidebar.
**Delivers:** Transloco configured with EN/TR skeleton JSON files, language switcher in navbar, Material intl providers wired (paginator, sort, date picker), preview component `any[]` types replaced with typed interfaces (`NotePreviewDto[]`, `ActivityPreviewDto[]`), missing `EntityPreviewController` handlers for Quote and Request entities added.
**Addresses:** Pitfalls P3 (localization regression prevention), P10 (preview type errors)
**Avoids:** Building any of the 4 features with hardcoded English strings that must later be extracted.
**Research flag:** Standard patterns — no phase research needed. Transloco docs are comprehensive (HIGH confidence). `any[]` fix is internal refactor.

### Phase 2: Localization — Complete String Extraction (EN + TR)

**Rationale:** Once the infrastructure is wired, the string extraction across all 59 files with 415+ hardcoded strings must happen before new features add more strings. This is the highest-volume but lowest-complexity task in v1.3. Doing it now means all subsequent phases build on a clean, fully-translated foundation. The research strongly recommends NOT deferring this — each week of delay adds more strings to extract.
**Delivers:** Complete `en.json` and `tr.json` coverage of all existing v1.0-v1.2 UI strings, all new v1.3 feature strings added to JSON files as each feature is built, Turkish locale registration for Angular date/number/currency pipes (`registerLocaleData(localeTr)`), CI translation coverage check (script comparing JSON key sets, fails build on mismatch), pseudo-localization test pass to find any remaining hardcoded strings.
**Addresses:** Transloco pipe in all ~80+ component templates, locale-aware Material date pickers and paginator labels in Turkish.
**Avoids:** Pitfall P3 (mixed-language UI during rollout), Pitfall P9 (Material labels remaining in English).
**Research flag:** Standard patterns — Transloco documentation is thorough (HIGH confidence) and Angular locale registration is well-documented.

### Phase 3: Integration Marketplace

**Rationale:** Smallest technical scope among the four features (API Key credential type only — no OAuth in v1.3), uses all existing infrastructure patterns, and delivers high business visibility. This is the "quick win" phase that demonstrates v1.3 progress. Building it before Kanban and PDF Templates also establishes the `IntegrationEncryptionService` and granular RBAC permission patterns that other features can reference.
**Delivers:** Settings page at `/settings/integrations` with card grid of 10-15 seed integrations (placeholder implementations), connect/disconnect with API Key credential storage (AES-256 encrypted, tenant-isolated via DataProtection purpose strings), connection status badges, admin RBAC via `Permission:Integration:*` (NOT role-based — must use policy-based authorization), integration detail panel via existing `SlideInPanelService`, connection health test button, integration activity log, settings hub card entry added to `settings-hub.component.ts`.
**Uses:** Existing `@angular/material` card grid, `SlideInPanelService`, RBAC permission system, webhook infrastructure, Hangfire (optional: background health checks).
**Avoids:** Pitfall P1 (credential leakage — tenant-scoped encryption + RLS), Pitfall P7 (RBAC bypass — policy-based not role-based), Pitfall P14 (missing settings hub card — added in same PR as route).
**Research flag:** No phase research needed for infrastructure-only scope. Real OAuth integration implementation is deferred to v1.4 and will need research at that time.

### Phase 4: Free-Form Kanban Boards

**Rationale:** CDK drag-drop patterns are fully proven in 3 existing Kanban implementations — implementation risk is low. The new entity model is well-defined with clear FK relationships. Building after Integration Marketplace means tenant isolation and RBAC patterns are already fresh in the team's mind. The unique CRM differentiator — entity-linked cards — leverages the `EntityTypeRegistry` from v1.2 without additional infrastructure.
**Delivers:** New `/boards` route with board list page (grid of boards with create/edit/delete), board detail with free-form Kanban (CDK drag-drop with namespaced IDs), card detail dialog (rich text descriptions via existing `RichTextEditorComponent`), entity-linked cards with preview sidebar integration, board labels, assignees, due dates with overdue indicators, board visibility (Private/Team/Public), board templates (3 seed templates: Sprint, Content Calendar, Sales Follow-up), WIP column limits (visual-only enforcement), SignalR real-time sync for concurrent edits via `board_{boardId}` group, fractional SortOrder for concurrent position updates.
**Uses:** `@angular/cdk/drag-drop` (existing), `@ngrx/signals` BoardStore (per-page), `@microsoft/signalr` for board sync, `EntityTypeRegistry` from v1.2, `RichTextEditorComponent` (existing).
**Avoids:** Pitfall P4 (TenantId on ALL entities including junction tables, all with RLS), Pitfall P5 (CDK ID namespace as `board-{boardId}-list-{listId}`), Pitfall P6 (fractional SortOrder not integers), Pitfall P12 (denormalize EntityName in link model), Pitfall P15 (curated color palette as CSS custom properties, store key not hex value).
**Research flag:** No phase research needed. CDK patterns are exhaustively documented in existing Kanban components within the codebase. Fractional sort ordering is a well-known algorithmic pattern.

### Phase 5: Quote PDF Template Builder

**Rationale:** Highest technical risk phase due to Unlayer document mode behavior uncertainty and Playwright production deployment requirements. Placed last so prior phases validate the v1.3 delivery cadence before committing to this complex work, and so the team has time to run the mandatory Playwright proof-of-concept spike before formal phase planning. The `TemplateRenderService` and `MergeFieldService` patterns are already established by email templates and confirmed working.
**Delivers:** `QuoteTemplateEditorComponent` (separate from `EmailTemplateEditorComponent`, Unlayer `displayMode: 'document'`, document-specific merge tags), quote template CRUD with thumbnail preview, merge field panel (extended with quote-specific fields: number, title, dates, subtotal, totals), line items table via Fluid `{% for item in quote.line_items %}` loop injected as pre-rendered merge field value, Playwright-based `HtmlToPdfService` with singleton browser and page pooling (print CSS injected server-side), PDF preview endpoint returning actual rendered PDF, template picker on quote detail page, QuestPDF fallback preserved for quotes without custom templates.
**Uses:** `Microsoft.Playwright` (new), `angular-email-editor` (existing, different mode config), `Fluid.Core`/`TemplateRenderService` (existing), `MergeFieldService` (extended with quote fields), QuestPDF (existing, kept as fallback).
**Avoids:** Pitfall P2 (inject print CSS before Playwright, do not use Unlayer HTML as-is), Pitfall P8 (Fluid loop for line items, not Unlayer merge tags), Pitfall P11 (separate QuoteTemplateEditorComponent with separate config), Pitfall P13 (embed Noto Sans font for Turkish glyph support in QuestPDF fallback).
**Research flag:** THIS PHASE REQUIRES RESEARCH before planning. Two specific uncertainties must be resolved via proof-of-concept spikes: (1) Unlayer `displayMode: 'document'` behavior in the existing `angular-email-editor` v15.2.0 wrapper — does it produce a page-oriented editor, and does the HTML export differ from email mode? (2) Playwright Chromium production deployment — memory requirements, system library dependencies, Docker image strategy. Run `/gsd:research-phase` when planning this phase. Do not begin planning until both spikes are completed.

### Phase Ordering Rationale

- Localization infrastructure (Phase 1) must precede all feature phases to prevent growing the string-extraction backlog — every component built in Phases 3-5 adds new UI strings, and building them with translation keys from the start avoids a second extraction pass.
- String extraction (Phase 2) before feature development so all subsequent phases build on a fully-translated foundation. The high volume of this work (415+ strings, 59 files) means it will consume a full sprint; front-loading it avoids blocking features later.
- Integration Marketplace (Phase 3) before Kanban and PDF Templates because it establishes shared security patterns (tenant-scoped credential encryption, policy-based RBAC for settings-area features) at the smallest scope where mistakes are cheapest to fix, and delivers a visible "quick win."
- Kanban (Phase 4) before PDF Templates because Kanban patterns are fully validated by existing codebase implementations while PDF Templates have unvalidated technical assumptions that require proof-of-concept work.
- Tech debt pre-work (Phase 1) before everything else because the `any[]` types in preview components will cause runtime TypeErrors the first time any new entity type is previewed, and Transloco setup enables the subsequent string extraction phase.

### Research Flags

**Requires `/gsd:research-phase` when planning:**
- Phase 5 (Quote PDF Templates): Unlayer `displayMode: 'document'` behavior in v15.2.0 wrapper needs proof-of-concept validation (30-min spike). Playwright Chromium production deployment needs environment-specific verification. Do not plan this phase until both spikes are complete.

**Standard patterns — skip research-phase:**
- Phase 1 (Foundation pre-work): Transloco setup is well-documented (official docs), `any[]` fix is internal refactor with no external dependencies.
- Phase 2 (Localization string extraction): Mechanical extraction work with established tooling (grep + JSON, Transloco CLI tools).
- Phase 3 (Integration Marketplace): Infrastructure-only scope. All patterns established in existing codebase (`TokenEncryptionService`, RBAC system, Hangfire, `SlideInPanelService`).
- Phase 4 (Kanban Boards): CDK drag-drop patterns exhaustively documented in 3 existing Kanban implementations within the codebase. Zero external unknowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `@jsverse/transloco` v8.2.1 verified on npm (published 1 month ago). `Microsoft.Playwright` v1.58.0 verified on NuGet. CDK drag-drop and Unlayer reuse are codebase-verified. Only Unlayer `displayMode: 'document'` in the specific v15.2.0 Angular wrapper is unverified (MEDIUM for that item alone). |
| Features | HIGH | Integration Marketplace patterns benchmarked against HubSpot Marketplace and Pipedrive Marketplace. Kanban patterns benchmarked against Trello, WeKan, monday.com (well-established domain). Localization patterns from official Transloco docs (HIGH). PDF template patterns from S-Docs/PandaDoc conceptual research (MEDIUM). MVP scope recommendations are defensible with clear rationale. |
| Architecture | HIGH | All patterns derived from direct codebase inspection of specific files with specific line numbers cited. Component boundaries, data flows, and integration points verified against existing implementations. No speculative architecture. |
| Pitfalls | HIGH | 4 of 5 critical pitfalls confirmed via direct codebase inspection with specific file and line references (`TokenEncryptionService.cs`, `WebhookSubscription.cs`, `email-template-editor.component.ts`, `preview-notes-tab.component.ts`). Security pitfalls are verified by reading actual source. CDK nested list issues confirmed via GitHub issue numbers (#16671, #18503, #25333). |

**Overall confidence:** HIGH for implementation patterns. MEDIUM for Unlayer document mode HTML export behavior and Playwright production deployment specifics.

### Gaps to Address

- **Unlayer `displayMode: 'document'` in v15.2.0 wrapper:** The Angular wrapper is built for Angular 15, running on Angular 19 via compatibility. Changing `displayMode` is a single config property change, but its effect on the HTML export format is unverified. Resolution: run a 30-minute spike before Phase 5 planning — create a test component with `displayMode: 'document'`, call `exportHtml()`, examine the output structure and compare to `displayMode: 'email'` output.

- **Playwright Chromium production deployment:** Running headless Chromium requires 200MB+ memory, specific system font and library dependencies, and a singleton browser lifecycle strategy. The official `mcr.microsoft.com/playwright/dotnet` Docker image includes everything, but the actual target production environment needs verification. Resolution: spike before Phase 5 planning — build `HtmlToPdfService` minimally, call `Page.PdfAsync()` in a local Docker container, confirm PDF output and memory usage.

- **Translation coverage scope vs. sprint capacity:** Full extraction of 415+ strings across 59 files is a significant sprint. If this proves too large for Phase 2, the fallback strategy is: extract shared/common strings first (nav, buttons, snackbars), then extract per feature as each area is touched during normal development. New features (Phases 3-5) must always use translation keys from the start regardless — this is non-negotiable.

- **Kanban card fractional ordering implementation:** Float arithmetic (e.g., midpoint between 2.0 and 3.0 = 2.5) is recommended for typical CRM usage patterns. LexoRank (string-based ordering used by Jira) is unnecessary at this scale. The specific implementation detail (double vs. decimal precision, normalization trigger threshold) should be decided at Phase 4 planning time.

- **Line items table CSS styling in PDF templates:** The Fluid-rendered `{{quote.line_items_table}}` HTML table must visually match the Unlayer template's design (fonts, colors, borders). A default CSS stylesheet for the line items table must be defined and injected at PDF generation time. This is a design-implementation collaboration decision for Phase 5.

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection: `deal-kanban.component.ts`, `activity-kanban.component.ts`, `email-template-editor.component.ts`, `QuotePdfDocument.cs`, `TemplateRenderService.cs`, `MergeFieldService.cs`, `TokenEncryptionService.cs`, `WebhookSubscription.cs`, `settings-hub.component.ts`, `settings.routes.ts`, `entity-preview.models.ts`, `preview-notes-tab.component.ts`, `preview-activities-tab.component.ts`, `package.json`, `GlobCRM.Infrastructure.csproj`
- Transloco documentation: https://jsverse.gitbook.io/transloco
- Transloco npm: https://www.npmjs.com/package/@jsverse/transloco (v8.2.1 verified)
- Transloco locale plugin docs: https://jsverse.gitbook.io/transloco/plugins-and-extensions/locale-l10n
- Microsoft.Playwright NuGet: https://www.nuget.org/packages/microsoft.playwright (v1.58.0 verified)
- Angular CDK Drag Drop official docs: https://angular.dev/guide/drag-drop
- Angular i18n Guide: https://angular.dev/guide/i18n

### Secondary (MEDIUM confidence)
- HubSpot App Marketplace — integration card grid and category filter patterns
- Pipedrive Marketplace — integration tile and connection status patterns
- Trello Feature Overview — Kanban board table stakes (create/edit columns, drag-and-drop, labels, assignees)
- WeKan Open Source Kanban — feature benchmark
- Phrase: Best Angular i18n Libraries — Transloco vs ngx-translate comparison
- Playwright .NET PDF guide: https://pdfnoodle.com/blog/how-to-generate-pdf-from-html-with-playwright-in-c-sharp
- Playwright .NET PDF blog: https://blog.hompus.nl/2025/08/18/playwright-pdf-generation-in-dotnet/
- .NET PDF library comparison: https://pdfbolt.com/blog/top-csharp-pdf-generation-libraries
- AWS Multi-Tenant Security Practices: https://aws.amazon.com/blogs/security/security-practices-in-aws-multi-tenant-saas-environments/
- SaaS Security Vulnerabilities 2025: https://www.appsecure.security/blog/saas-security-vulnerabilities-2025
- Angular CDK Drag Drop nested list GitHub issues: #16671, #18503, #25333

### Tertiary (LOW confidence — needs validation)
- Unlayer `displayMode: 'document'` specifics: https://github.com/unlayer/react-email-editor/issues/79 — only informal GitHub discussion, not official Unlayer documentation; the exact behavior in the `angular-email-editor` v15.2.0 wrapper is unverified and requires a proof-of-concept spike
- Unlayer HTML export behavior in document vs email mode: inference from general Unlayer architecture knowledge plus email HTML structure analysis; not tested against the specific wrapper version in this project

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
