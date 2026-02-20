# Roadmap: GlobCRM

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12 (shipped 2026-02-18)
- ✅ **v1.1 Automation & Intelligence** — Phases 13-21 (shipped 2026-02-20)
- 🚧 **v1.2 Connected Experience** — Phases 22-25 (in progress)

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

### 🚧 v1.2 Connected Experience (In Progress)

**Milestone Goal:** Make GlobCRM feel connected — entity links in feeds open preview sidebars, every detail page starts with a Summary tab, and a personal "My Day" dashboard replaces the home page.

- [x] **Phase 22: Shared Foundation + Entity Preview Sidebar** - Cross-cutting infrastructure (EntityTypeRegistry, tab index refactor, entity_name denormalization) and full entity preview sidebar with feed integration (completed 2026-02-19)
- [x] **Phase 23: Summary Tabs on Detail Pages** - Aggregated summary tab as default first tab on all 6 major entity detail pages with batched backend endpoints (completed 2026-02-20)
- [x] **Phase 24: My Day Personal Dashboard** - Personal daily workspace replacing home page with fixed-layout widgets, plus org dashboard relocation (completed 2026-02-20)
- [ ] **Phase 25: Preview Sidebar Polish + Cross-Feature Integration** - Quick actions in preview, global search preview, user profile preview, responsive mobile behavior, and performance indexes

## Phase Details

### Phase 22: Shared Foundation + Entity Preview Sidebar
**Goal**: Users can peek at any entity from the feed without losing context — clicking an entity name opens a slide-in preview with key details, associations, and recent activity
**Depends on**: Phase 21 (v1.1 complete)
**Requirements**: PREVIEW-01, PREVIEW-02, PREVIEW-03, PREVIEW-04, PREVIEW-05, PREVIEW-06, PREVIEW-07, PREVIEW-12, PREVIEW-13
**Success Criteria** (what must be TRUE):
  1. User clicks an entity name in the feed and a preview sidebar slides in from the right showing that entity's key properties, without the feed page navigating away or losing scroll position
  2. Preview sidebar displays entity-appropriate fields (name, status/stage, owner, primary info), association chips linking to related records, and the last 3 recent activities
  3. User can close the preview by clicking outside, pressing Escape, or clicking "Open full record" to navigate to the full detail page
  4. Preview shows a loading skeleton while data loads, and gracefully displays a "deleted/not found" message for entities that no longer exist
  5. All 6 entity detail pages use label-based tab switching (refactored from index-based), unblocking safe tab insertion in Phase 23
**Plans**: 4 plans

Plans:
- [ ] 22-01-PLAN.md — Shared infrastructure: EntityTypeRegistry, tab index refactor to label-based matching across all 6 detail pages, entity_name denormalization + ShowInPreview migration
- [ ] 22-02-PLAN.md — Backend preview endpoint: GET /api/entities/{type}/{id}/preview with RBAC scope checking, per-entity-type slim DTOs, associations, pipeline stages, recent activities
- [ ] 22-03-PLAN.md — Frontend preview sidebar: AppComponent layout refactor, PreviewSidebarStore, EntityPreviewSidebarComponent, 6 entity-type preview templates, mini-stage-bar, mini-timeline, association chips
- [ ] 22-04-PLAN.md — Feed integration: replace entity link navigation with sidebar open, Ctrl/Cmd+click, hover tooltips, scroll position preservation

### Phase 23: Summary Tabs on Detail Pages
**Goal**: Users see a rich at-a-glance overview as the default tab on every major entity detail page — key properties, association counts, recent and upcoming activities, stage indicators, and quick actions — all loaded in a single batched request
**Depends on**: Phase 22 (label-based tab handlers, EntityTypeRegistry)
**Requirements**: SUMMARY-01, SUMMARY-02, SUMMARY-03, SUMMARY-04, SUMMARY-05, SUMMARY-06, SUMMARY-07, SUMMARY-08, SUMMARY-09, SUMMARY-10, SUMMARY-11, SUMMARY-12
**Success Criteria** (what must be TRUE):
  1. Summary tab is the first (default) tab on Company, Contact, Deal, Lead, Quote, and Request detail pages, displaying 4-8 key properties, association counts that link to their respective tabs, and a stage/status indicator appropriate to the entity type
  2. Summary tab shows recent activities (last 3-5), upcoming activities (not done, due today or later), last 2-3 notes preview, "Last contacted" timestamp, and attachments count — all loaded via a single batched aggregation endpoint per entity
  3. Company and Contact summary tabs show a mini deal/pipeline summary (total value, deals by stage, win rate); Contact summary also shows email engagement summary (last sent/received, total exchanged)
  4. User can perform quick actions (Add Note, Log Activity, Send Email) directly from the summary tab via a shared QuickActionBarComponent
  5. Summary tab data refreshes automatically when the user performs mutations on sibling tabs (dirty-flag invalidation pattern)
**Plans**: 5 plans

Plans:
- [ ] 23-01-PLAN.md — Backend summary aggregation endpoints (GET /api/{entityType}/{id}/summary for all 6 entities using Task.WhenAll batching, RBAC-scope-filtered counts, deal/pipeline stats for Company/Contact, email stats for Contact)
- [ ] 23-02-PLAN.md — QuickActionBarComponent + EntitySummaryTabComponent shell (shared quick action bar with Add Note/Log Activity/Send Email, summary tab component with key properties card, association count chips, stage/status indicators)
- [ ] 23-03-PLAN.md — Summary tab content widgets (activities card, notes preview, last-contacted, attachments count, deal pipeline donut chart for Company/Contact, email engagement card for Contact)
- [ ] 23-04-PLAN.md — Detail page integration (insert Summary tab at index 0 on all 6 entity detail pages, dirty-flag invalidation wiring, quick action dialog handlers)
- [ ] 23-05-PLAN.md — Gap closure: fix lastContacted field name mismatch (SUMMARY-11) and wire markSummaryDirty() to mutation handlers on Company/Contact/Deal/Lead detail pages

### Phase 24: My Day Personal Dashboard
**Goal**: Users land on a personal daily workspace after login that shows their tasks, overdue items, upcoming events, pipeline, recent activity, and quick access to common actions — replacing the generic home page with a focused "what do I need to do today" view
**Depends on**: Phase 23 (aggregation endpoint pattern, QuickActionBarComponent)
**Requirements**: MYDAY-01, MYDAY-02, MYDAY-03, MYDAY-04, MYDAY-05, MYDAY-06, MYDAY-07, MYDAY-08, MYDAY-09, MYDAY-10, MYDAY-11, MYDAY-12
**Success Criteria** (what must be TRUE):
  1. After login, user lands on "My Day" page showing a personalized greeting with date/time context, and the org dashboard is accessible via a separate "Analytics" menu item in the sidebar navigation
  2. My Day displays today's tasks/activities assigned to the user (due today, not done) with overdue items highlighted by urgency indicators, plus an upcoming events agenda (today + next 2 days)
  3. My Day shows a personal pipeline summary (user's deals grouped by stage with values), a recent records widget (last 5-8 recently viewed entities), and an email summary widget (unread count, recent emails)
  4. My Day includes a quick actions row (New Contact, New Deal, Log Activity, New Note, Send Email), a feed preview widget (last 5 feed items), and a notification digest widget (today's notifications grouped by type)
  5. Route restructuring works correctly: "/" and "/dashboard" both redirect to "/my-day", org dashboard lives at "/analytics" with backward-compatible redirects preserving existing bookmarks
**Plans**: 5 plans

Plans:
- [ ] 24-01-PLAN.md — Route restructuring + org dashboard relocation to /analytics, navbar updates with My Day home icon, login redirect to /my-day
- [ ] 24-02-PLAN.md — Backend MyDay aggregation endpoint (GET /api/my-day), RecentlyViewedEntity domain model + migration, track-view and task-complete endpoints
- [ ] 24-03-PLAN.md — My Day page shell with CSS Grid, MyDayStore + MyDayService, greeting banner with stats + quick actions, tasks widget with overdue urgency + inline completion, upcoming events widget
- [ ] 24-04-PLAN.md — Secondary widgets: pipeline summary (stacked bar), email summary, feed preview, notification digest, recent records — completing the full grid layout
- [ ] 24-05-PLAN.md — Slide-in panel infrastructure (CDK Overlay), quick action wiring to greeting banner, post-creation refresh with highlight animation

### Phase 25: Preview Sidebar Polish + Cross-Feature Integration
**Goal**: The preview sidebar becomes a power-user tool — quick actions, global search integration, user profile previews, and polished responsive behavior across all viewport sizes
**Depends on**: Phase 22 (preview sidebar), Phase 23 (QuickActionBarComponent), Phase 24 (all features functional)
**Requirements**: PREVIEW-08, PREVIEW-09, PREVIEW-10, PREVIEW-11
**Success Criteria** (what must be TRUE):
  1. User can perform quick actions (Add Note, Log Call, Send Email, Create Activity) directly from the preview sidebar without closing it
  2. User can open entity preview from global search results (secondary action alongside navigate) and preview user profiles (name, role, email, avatar) by clicking author names in feed
  3. Preview sidebar displays full-width on mobile screens (< 768px) and closes automatically on route navigation to prevent stale data
**Plans**: 3 plans

Plans:
- [ ] 25-01-PLAN.md — Quick actions in preview sidebar (SlideInPanelService refactor to shared, context-aware mutual exclusion, QuickActionBarComponent wiring, silent refreshCurrent)
- [ ] 25-02-PLAN.md — User profile preview (backend activity-stats endpoint, CDK Overlay popover, feed author name clickable)
- [ ] 25-03-PLAN.md — Search preview-first + mobile responsive (preview-first search results, recently previewed entities, full-width mobile sidebar, swipe-right-to-close)

## Progress

**Execution Order:**
Phases execute in numeric order: 22 → 23 → 24 → 25

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
| 22. Shared Foundation + Entity Preview Sidebar | 5/5 | Complete    | 2026-02-20 | - |
| 23. Summary Tabs on Detail Pages | 5/5 | Complete    | 2026-02-20 | - |
| 24. My Day Personal Dashboard | 5/5 | Complete    | 2026-02-20 | - |
| 25. Preview Sidebar Polish + Cross-Feature Integration | v1.2 | 0/2 | Not started | - |

**Totals:** 25 phases, 153 plans (139 complete + 14 planned), ~234,600 LOC
