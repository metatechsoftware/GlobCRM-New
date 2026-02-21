# Roadmap: GlobCRM

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped 2026-02-18)
- ✅ **v1.1 Automation & Intelligence** — Phases 13-21 (shipped 2026-02-20)
- ✅ **v1.2 Connected Experience** — Phases 22-26 (shipped 2026-02-20)
- **v1.3 Platform & Polish** — Phases 27-31 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-12) — SHIPPED 2026-02-18</summary>

- [x] Phase 1: Foundation (8/8 plans) — Multi-tenant infrastructure, authentication, database architecture
- [x] Phase 2: Core Infrastructure (14/14 plans) — RBAC, custom fields, dynamic tables
- [x] Phase 3: Core CRM Entities (9/9 plans) — Companies, contacts, products with CRUD
- [x] Phase 4: Deals & Pipelines (10/10 plans) — Configurable pipelines with Kanban board
- [x] Phase 5: Activities & Workflow (10/10 plans) — Full activity lifecycle with state machine
- [x] Phase 6: Quotes & Requests (7/7 plans) — Line-item quotes with PDF generation
- [x] Phase 7: Email Integration (7/7 plans) — Two-way Gmail sync with OAuth
- [x] Phase 8: Real-Time & Notifications (8/8 plans) — SignalR live updates and notifications
- [x] Phase 9: Dashboards & Reporting (8/8 plans) — Configurable dashboards with KPIs
- [x] Phase 10: Data Operations (6/6 plans) — CSV import and global search
- [x] Phase 11: Polish & Completeness (7/7 plans) — Calendar, notes, attachments, responsive design
- [x] Phase 12: Bug Fixes & Integration Polish (2/2 plans) — Gap closure from v1.0 audit

**Total:** 12 phases, 96 plans, ~124,200 LOC

</details>

<details>
<summary>✅ v1.1 Automation & Intelligence (Phases 13-21) — SHIPPED 2026-02-20</summary>

- [x] Phase 13: Leads (4/4 plans) — Full lead management with pipeline stages and lead-to-contact conversion
- [x] Phase 14: Foundation Infrastructure & Email Templates (4/4 plans) — Hangfire, DomainEventInterceptor, Fluid template engine, rich email templates
- [x] Phase 15: Formula / Computed Custom Fields (4/4 plans) — NCalc expression engine with arithmetic/date/string/conditional support
- [x] Phase 16: Duplicate Detection & Merge (4/4 plans) — Two-tier fuzzy matching, side-by-side merge UI, relationship transfer
- [x] Phase 17: Webhooks (4/4 plans) — HMAC-signed delivery with retry, SSRF prevention, delivery logs
- [x] Phase 18: Email Sequences (5/5 plans) — Multi-step drip campaigns with tracking and reply-based auto-unenroll
- [x] Phase 19: Workflow Automation (8/8 plans) — Trigger-based engine with 6 action types, visual builder, execution logs
- [x] Phase 20: Advanced Reporting Builder (8/8 plans) — Dynamic report builder with charts, drill-down, CSV export
- [x] Phase 21: Integration Polish & Tech Debt Closure (2/2 plans) — Audit gap closure (DI fixes, picker UX, cleanup)

**Total:** 9 phases, 43 plans, ~110,400 new LOC

</details>

<details>
<summary>✅ v1.2 Connected Experience (Phases 22-26) — SHIPPED 2026-02-20</summary>

- [x] Phase 22: Shared Foundation + Entity Preview Sidebar (5/5 plans) — EntityTypeRegistry, tab refactor, entity preview sidebar with feed integration
- [x] Phase 23: Summary Tabs on Detail Pages (5/5 plans) — Aggregated summary tab as default first tab on all 6 entity detail pages
- [x] Phase 24: My Day Personal Dashboard (5/5 plans) — Personal daily workspace replacing home page with fixed-layout widgets
- [x] Phase 25: Preview Sidebar Polish + Cross-Feature Integration (3/3 plans) — Quick actions, global search preview, user profile popover, mobile responsive
- [x] Phase 26: Integration Fix — Preview Sidebar + My Day Wiring (1/1 plan) — Gap closure: pushPreview isOpen, trackView wiring, EntityTypeRegistry icons

**Total:** 5 phases, 19 plans, ~40,700 new LOC

</details>

### v1.3 Platform & Polish (In Progress)

**Milestone Goal:** Add localization support (English + Turkish), integration marketplace infrastructure, free-form Kanban boards, and quote PDF template builder to the CRM platform.

- [x] **Phase 27: Localization Foundation** (6 plans) — Transloco infrastructure, language switcher, locale formatting, Material intl, lazy-loading scopes, gap closures
- [x] **Phase 28: Localization String Extraction** (10 plans) — Extract all hardcoded strings to EN/TR JSON files across 21 feature scopes, shared components, CI coverage check (completed 2026-02-21) (completed 2026-02-21)
- [ ] **Phase 29: Integration Marketplace** (5 plans) — Backend entities + encryption, API controller, frontend catalog grid, connect/disconnect dialogs, detail panel + activity log + i18n
- [ ] **Phase 30: Free-Form Kanban Boards** — Board/column/card CRUD, drag-drop, entity-linked cards, labels, comments, templates
- [ ] **Phase 31: Quote PDF Templates** — Unlayer document mode editor, merge fields, line items, Playwright PDF, preview, QuestPDF fallback

## Phase Details

### Phase 27: Localization Foundation
**Goal**: Users can switch the CRM interface between English and Turkish at runtime, with locale-aware formatting and persistent language preference
**Depends on**: Phase 26 (v1.2 complete)
**Requirements**: LOCL-01, LOCL-02, LOCL-04, LOCL-05, LOCL-06, LOCL-07, LOCL-08
**Success Criteria** (what must be TRUE):
  1. User can click a language selector in the navbar and the entire UI switches between English and Turkish without page reload
  2. User's selected language persists across browser sessions (saved to user profile, restored on login)
  3. Date, number, and currency values render in locale-appropriate format (Turkish: 20.02.2026, 1.234,56; English: 02/20/2026, 1,234.56)
  4. Angular Material components (paginator "of", sort headers, date picker) display labels in the selected language
  5. Translation files lazy-load per feature scope (navigating to contacts loads only contact translations), and missing keys fall back to English without showing raw keys
**Plans**: 6 plans
Plans:
- [x] 27-01-PLAN.md — Transloco infrastructure setup (packages, loader, LanguageService, global EN/TR translations, app config)
- [x] 27-02-PLAN.md — Language switcher UI in navbar + persistence (toggle in user menu, lang badge, backend/localStorage sync)
- [x] 27-03-PLAN.md — Material intl + locale formatting (TranslatedPaginatorIntl, DateAdapter consolidation, DynamicTable locale-aware dates)
- [x] 27-04-PLAN.md — Scoped translations + org default language (contacts/settings scopes, Organization.DefaultLanguage, settings hub card)
- [x] 27-05-PLAN.md — Gap closure: wire syncFromProfile() into auth login flow (LOCL-02/LOCL-07 persistence read path)
- [x] 27-06-PLAN.md — Gap closure: reactive navbar translations + paginator race condition fix

### Phase 28: Localization String Extraction
**Goal**: Every user-visible string in the application renders in the user's selected language via translation keys, with CI enforcement preventing regressions
**Depends on**: Phase 27
**Requirements**: LOCL-03, LOCL-09, LOCL-10
**Success Criteria** (what must be TRUE):
  1. All UI strings across all ~80+ component templates (labels, buttons, messages, tooltips, validation errors, snackbar messages) render via the Transloco translation pipe in the selected language
  2. A CI script validates that EN and TR translation JSON files have identical key sets and fails the build on mismatch
  3. No hardcoded English strings remain in any component template (verified by pseudo-localization test pass or grep audit)
**Plans**: 10 plans
Plans:
- [x] 28-01-PLAN.md — Shared/global components: extend global EN/TR JSON, wire TranslocoPipe in ~25+ shared components
- [x] 28-02-PLAN.md — Core CRM entities: deals, companies, leads scopes + complete contacts template wiring
- [x] 28-03-PLAN.md — CRM operations: activities, products, quotes, requests scopes
- [x] 28-04-PLAN.md — Communication features: emails, email-templates, sequences, notes, feed scopes
- [x] 28-05-PLAN.md — Analytics & workflow: dashboard, my-day, calendar, reports, workflows scopes
- [x] 28-06-PLAN.md — Users & admin: auth, onboarding, profile, import, duplicates scopes + settings extension
- [x] 28-07-PLAN.md — CI enforcement script (key parity, hardcoded string detection, unused keys) + final audit
- [x] 28-08-PLAN.md — Gap closure: settings sub-pages (webhooks, custom-fields, pipelines, duplicate-rules, email-accounts, notifications) full transloco wiring
- [x] 28-09-PLAN.md — Gap closure: shared entity-preview + summary-tab components + misc shared components transloco wiring
- [x] 28-10-PLAN.md — Gap closure: remaining feature template strings + baseline regeneration + requirements update

### Phase 29: Integration Marketplace
**Goal**: Admins can browse, connect, and manage third-party integrations from a dedicated marketplace settings page with secure credential storage
**Depends on**: Phase 28
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06, INTG-07, INTG-08, INTG-09, INTG-10, INTG-11, INTG-12
**Success Criteria** (what must be TRUE):
  1. User can browse a card-based grid of available integrations with logos, descriptions, status badges, and "Popular" badges on featured integrations
  2. User can filter integrations by category (Communication, Accounting, Marketing, Storage, Calendar, Developer Tools) and search by name
  3. Admin can connect an integration by entering API key credentials via a dialog, test the connection, and disconnect with confirmation — while non-admin users see read-only status
  4. Stored credentials are AES-256 encrypted with tenant-scoped isolation, and the API never returns full credentials (only masked last-4-chars values)
  5. User can view integration details in a slide-in panel showing description, connection status, credential info, and a chronological activity log of connect/disconnect/test events
**Plans**: 5 plans
Plans:
- [ ] 29-01-PLAN.md — Backend domain entities, enums, EF Core config, migration, CredentialEncryptionService, repository
- [ ] 29-02-PLAN.md — IntegrationsController with 5 API endpoints, DTOs with credential masking, validators
- [ ] 29-03-PLAN.md — Frontend integration catalog constant, models, card grid, category filter, search, 12 SVG brand icons
- [ ] 29-04-PLAN.md — IntegrationService, IntegrationStore, connect/disconnect dialogs, RBAC wiring
- [ ] 29-05-PLAN.md — Detail panel with activity log, settings hub card, route registration, Transloco i18n

### Phase 30: Free-Form Kanban Boards
**Goal**: Users can create custom Kanban boards with free-form and entity-linked cards for organizing any type of work beyond the existing deal and activity pipelines
**Depends on**: Phase 29
**Requirements**: KANB-01, KANB-02, KANB-03, KANB-04, KANB-05, KANB-06, KANB-07, KANB-08, KANB-09, KANB-10, KANB-11, KANB-12, KANB-13, KANB-14, KANB-15, KANB-16, KANB-17, KANB-18
**Success Criteria** (what must be TRUE):
  1. User can create, edit, and delete custom Kanban boards with name, description, color, and visibility (Private/Team/Public), including creating boards from predefined templates (Sprint, Content Calendar, Sales Follow-up)
  2. User can add/rename/reorder/delete columns on a board, create/edit/archive cards with title, description, due date, and assignee, and drag-and-drop cards between columns and within columns with optimistic UI updates
  3. Cards display due date urgency indicators (yellow approaching, red overdue), assignee avatars, colored labels, checklist progress, and WIP column limits with visual warnings when exceeded
  4. User can link a card to any CRM entity (Contact, Company, Deal, Lead, etc.) with the entity name and icon displayed on the card face, clickable to open the existing preview sidebar
  5. User can write rich text descriptions on cards, add checklist items with progress tracking, comment on cards with threaded discussion, and filter visible cards by label, assignee, or due date
**Plans**: TBD

### Phase 31: Quote PDF Templates
**Goal**: Users can design custom quote PDF templates with a visual drag-and-drop editor and generate professionally branded PDFs with real quote data
**Depends on**: Phase 30
**Requirements**: QTPL-01, QTPL-02, QTPL-03, QTPL-04, QTPL-05, QTPL-06, QTPL-07, QTPL-08, QTPL-09, QTPL-10, QTPL-11, QTPL-12
**Success Criteria** (what must be TRUE):
  1. User can create quote PDF templates using a drag-and-drop visual editor (Unlayer document mode) with CRM merge fields (quote, company, contact, deal fields) and organization branding (logo, name, address)
  2. Templates include a line items table that auto-expands with quote products, quantities, discounts, and totals, and support configurable page size (A4/Letter) and orientation (portrait/landscape)
  3. User can preview a template rendered with real quote data before generating, and then generate and download a PDF from a quote using a selected template
  4. User can manage multiple templates from a dedicated templates section under quotes, set one as default for new quotes, clone existing templates, and identify templates by thumbnail previews
  5. Quotes without a custom template fall back to the existing QuestPDF-generated layout, preserving backward compatibility
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 8/8 | Complete | 2026-02-16 |
| 2. Core Infrastructure | v1.0 | 14/14 | Complete | 2026-02-16 |
| 3. Core CRM Entities | v1.0 | 9/9 | Complete | 2026-02-16 |
| 4. Deals & Pipelines | v1.0 | 10/10 | Complete | 2026-02-17 |
| 5. Activities & Workflow | v1.0 | 10/10 | Complete | 2026-02-17 |
| 6. Quotes & Requests | v1.0 | 7/7 | Complete | 2026-02-17 |
| 7. Email Integration | v1.0 | 7/7 | Complete | 2026-02-17 |
| 8. Real-Time & Notifications | v1.0 | 8/8 | Complete | 2026-02-17 |
| 9. Dashboards & Reporting | v1.0 | 8/8 | Complete | 2026-02-17 |
| 10. Data Operations | v1.0 | 6/6 | Complete | 2026-02-17 |
| 11. Polish & Completeness | v1.0 | 7/7 | Complete | 2026-02-18 |
| 12. Bug Fixes & Integration Polish | v1.0 | 2/2 | Complete | 2026-02-18 |
| 13. Leads | v1.1 | 4/4 | Complete | 2026-02-18 |
| 14. Foundation & Email Templates | v1.1 | 4/4 | Complete | 2026-02-19 |
| 15. Formula Custom Fields | v1.1 | 4/4 | Complete | 2026-02-19 |
| 16. Duplicate Detection & Merge | v1.1 | 4/4 | Complete | 2026-02-19 |
| 17. Webhooks | v1.1 | 4/4 | Complete | 2026-02-19 |
| 18. Email Sequences | v1.1 | 5/5 | Complete | 2026-02-19 |
| 19. Workflow Automation | v1.1 | 8/8 | Complete | 2026-02-19 |
| 20. Advanced Reporting Builder | v1.1 | 8/8 | Complete | 2026-02-19 |
| 21. Integration Polish & Tech Debt | v1.1 | 2/2 | Complete | 2026-02-19 |
| 22. Shared Foundation + Entity Preview Sidebar | v1.2 | 5/5 | Complete | 2026-02-20 |
| 23. Summary Tabs on Detail Pages | v1.2 | 5/5 | Complete | 2026-02-20 |
| 24. My Day Personal Dashboard | v1.2 | 5/5 | Complete | 2026-02-20 |
| 25. Preview Sidebar Polish + Cross-Feature Integration | v1.2 | 3/3 | Complete | 2026-02-20 |
| 26. Integration Fix — Preview Sidebar + My Day Wiring | v1.2 | 1/1 | Complete | 2026-02-20 |
| 27. Localization Foundation | v1.3 | 6/6 | Complete | 2026-02-21 |
| 28. Localization String Extraction | v1.3 | 10/10 | Complete | 2026-02-21 |
| 29. Integration Marketplace | v1.3 | 0/5 | Not started | - |
| 30. Free-Form Kanban Boards | v1.3 | 0/? | Not started | - |
| 31. Quote PDF Templates | v1.3 | 0/? | Not started | - |

**Totals:** 31 phases, 177 plans complete (v1.0-v1.2 + Phase 27 + Phase 28), v1.3 plans TBD
