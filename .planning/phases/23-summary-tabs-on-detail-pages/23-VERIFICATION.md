---
phase: 23-summary-tabs-on-detail-pages
verified: 2026-02-20T10:00:00Z
status: gaps_found
score: 8/10 must-haves verified
re_verification: false
gaps:
  - truth: "Summary tab displays 'Last Contacted' timestamp prominently (SUMMARY-11)"
    status: failed
    reason: "Frontend model field 'lastContactedAt' does not match backend JSON field 'lastContacted'. Backend C# property LastContacted serializes to JSON key 'lastContacted', but BaseSummaryFields interface declares 'lastContactedAt'. The template accesses data().lastContactedAt which is always undefined at runtime — the card always shows 'Never' regardless of actual data."
    artifacts:
      - path: "globcrm-web/src/app/shared/components/summary-tab/summary.models.ts"
        issue: "BaseSummaryFields.lastContactedAt (line 92) should be lastContacted to match backend JSON key"
      - path: "globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.html"
        issue: "Lines 416-417 reference data().lastContactedAt — will always be undefined"
    missing:
      - "Rename lastContactedAt to lastContacted in summary.models.ts BaseSummaryFields interface"
      - "Update entity-summary-tab.component.html references from lastContactedAt to lastContacted"
  - truth: "Summary data auto-refreshes when user performs mutations on sibling tabs (dirty-flag invalidation)"
    status: partial
    reason: "markSummaryDirty() is defined but never called on Company, Contact, Deal, and Lead detail pages. The dirty-flag infrastructure exists (markSummaryDirty method, summaryDirty signal, onTabChanged check), but no mutation handlers in those 4 components actually set the flag. Quote and Request correctly call markSummaryDirty() after status transitions. For Company/Contact/Deal/Lead, switching tabs and performing mutations (adding contacts, linking deals, creating activities from other tabs) will NOT auto-refresh the summary — users must manually navigate away and back."
    artifacts:
      - path: "globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts"
        issue: "markSummaryDirty() defined at line 164 but never called from any mutation handler"
      - path: "globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts"
        issue: "markSummaryDirty() defined at line 162 but never called from any mutation handler"
      - path: "globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts"
        issue: "markSummaryDirty() defined at line 178 but never called from any mutation handler"
      - path: "globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.ts"
        issue: "markSummaryDirty() defined at line 188 but never called from any mutation handler"
    missing:
      - "Call markSummaryDirty() in Company detail after: adding/removing contacts, linking deals, creating activities from Activities tab, creating quotes/requests"
      - "Call markSummaryDirty() in Contact detail after: linking companies, adding deals, creating activities"
      - "Call markSummaryDirty() in Deal detail after: linking contacts, adding products, creating activities"
      - "Call markSummaryDirty() in Lead detail after: creating activities from Activities tab"
human_verification:
  - test: "Open Company detail page and navigate to Summary tab"
    expected: "Summary tab is displayed by default as first tab; key properties card shows company name, industry, phone, email, website, owner, location, size"
    why_human: "Visual rendering and tab defaulting cannot be verified programmatically"
  - test: "Open a Company with linked deals and observe Deal Pipeline card"
    expected: "CSS donut chart renders with stage-colored segments, total value, win rate, and stage legend"
    why_human: "CSS conic-gradient rendering and visual accuracy require browser"
  - test: "Open a Contact with email history and observe Email Engagement card"
    expected: "Sent/received/total counts display, timestamps show, sequence badge appears if enrolled"
    why_human: "Requires live data and browser rendering"
  - test: "Click 'Add Note' on the quick action bar in any Summary tab"
    expected: "EntityFormDialogComponent opens with NoteFormComponent pre-filled with entity context; saving closes the dialog and Summary data refreshes immediately"
    why_human: "Dialog open/close flow and prefill behavior require user interaction"
  - test: "Click an association chip (e.g., '5 Contacts') on the Company Summary tab"
    expected: "Active tab switches to the Contacts tab"
    why_human: "Tab navigation behavior requires browser interaction"
---

# Phase 23: Summary Tabs on Detail Pages — Verification Report

**Phase Goal:** Users see a rich at-a-glance overview as the default tab on every major entity detail page — key properties, association counts, recent and upcoming activities, stage indicators, and quick actions — all loaded in a single batched request

**Verified:** 2026-02-20T10:00:00Z
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | GET /api/companies/{id}/summary returns key properties, association counts, recent/upcoming activities, notes preview, attachment count, last contacted date, and deal pipeline summary in a single batched request | VERIFIED | CompaniesController.GetSummary (line 389) uses Task.WhenAll (line 493) batching 13 parallel queries. CompanySummaryDto confirmed at line 530. |
| 2  | GET /api/contacts/{id}/summary returns Company data plus email engagement (last sent/received, total emails, sequence enrollment) | VERIFIED | ContactsController.GetSummary (line 402) uses Task.WhenAll (line 528) batching 15 parallel queries including emailStatsTask and activeEnrollmentTask. ContactEmailEngagementDto assembled at line 567. |
| 3  | GET /api/deals/{id}/summary, /api/leads/{id}/summary, /api/quotes/{id}/summary, /api/requests/{id}/summary all return aggregated summary data | VERIFIED | All 4 controllers have GetSummary endpoints with [HttpGet("{id:guid}/summary")] and Task.WhenAll: Deals line 966, Leads line 827, Quotes line 720, Requests line 547. |
| 4  | All summary endpoints use Task.WhenAll for parallel data fetching | VERIFIED | All 6 controllers confirmed with "Parallel queries via Task.WhenAll" comment pattern and actual Task.WhenAll calls. |
| 5  | All summary endpoints enforce RBAC scope checks | VERIFIED | Each endpoint calls GetEffectivePermissionAsync, GetTeamMemberIds, and IsWithinScope matching existing GetById pattern. |
| 6  | Summary tab is the first (default, index 0) tab on all 6 entity detail pages | VERIFIED | COMPANY_TABS[0], CONTACT_TABS[0], DEAL_TABS[0] all have {label:'Summary'} (related-entity-tabs.component.ts lines 27, 40, 58). Lead computed tabs() prepends Summary at index 0 (lead-detail.component.ts line 149). Quote and Request use mat-tab-group with Summary mat-tab as first child. |
| 7  | Summary tab loads data via SummaryService on initial page load | VERIFIED | All 6 detail components call loadSummary() in ngOnInit (or equivalent). Company line 147, Contact line 145, Deal line 159, Lead line 171, Quote line 143, Request line 481. |
| 8  | Quick action Add Note opens a dialog, and on close summary data refreshes immediately | VERIFIED | All 6 detail pages call dialog.open(EntityFormDialogComponent, { data: { entityType: 'Note', prefill: {...} } }). afterClosed subscribes and calls loadSummary() when result.entity exists. |
| 9  | Summary tab displays 'Last Contacted' timestamp prominently (SUMMARY-11) | FAILED | Backend serializes LastContacted to JSON key 'lastContacted'. Frontend BaseSummaryFields declares 'lastContactedAt'. Template accesses data().lastContactedAt which is always undefined. The meta card always renders "Never" regardless of actual last contact data. |
| 10 | Summary data auto-refreshes when user performs mutations on sibling tabs (dirty-flag invalidation) | PARTIAL | markSummaryDirty() is defined in all 6 detail components but is called from mutation handlers in ONLY Quote (line 375) and Request (line 668). Company, Contact, Deal, and Lead never call markSummaryDirty() from their mutation handlers — the dirty flag stays false until the quick action dialogs run. |

**Score: 8/10 truths verified** (1 failed, 1 partial)

---

## Required Artifacts

### Backend (Plan 23-01)

| Artifact | Status | Details |
|----------|--------|---------|
| `src/GlobCRM.Api/Controllers/CompaniesController.cs` | VERIFIED | GetSummary at line 389, Task.WhenAll at line 493, CompanySummaryDto assembled at line 530 |
| `src/GlobCRM.Api/Controllers/ContactsController.cs` | VERIFIED | GetSummary at line 402, Task.WhenAll at line 528, ContactEmailEngagementDto at line 567 |
| `src/GlobCRM.Api/Controllers/DealsController.cs` | VERIFIED | GetSummary at line 866, Task.WhenAll at line 966, DealStageInfoDto included |
| `src/GlobCRM.Api/Controllers/LeadsController.cs` | VERIFIED | GetSummary at line 721, Task.WhenAll at line 827, LeadStageInfoDto included |
| `src/GlobCRM.Api/Controllers/QuotesController.cs` | VERIFIED | GetSummary at line 628, Task.WhenAll at line 720 |
| `src/GlobCRM.Api/Controllers/RequestsController.cs` | VERIFIED | GetSummary at line 456, Task.WhenAll at line 547, dual-ownership RBAC |

### Frontend Shared Components (Plans 23-02, 23-03)

| Artifact | Status | Details |
|----------|--------|---------|
| `globcrm-web/src/app/shared/components/summary-tab/summary.models.ts` | STUB (partial) | All 6 entity DTOs defined with correct structure. Bug: BaseSummaryFields.lastContactedAt (line 92) is wrong field name — should be lastContacted to match backend JSON. |
| `globcrm-web/src/app/shared/components/summary-tab/summary.service.ts` | VERIFIED | 6 get methods, each calls api.get() with correct endpoint path |
| `globcrm-web/src/app/shared/components/quick-action-bar/quick-action-bar.component.ts` | VERIFIED | 3 buttons with *appHasPermission guards, showSendEmail input, 3 output signals |
| `globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.ts` | VERIFIED | All inputs/outputs, computed type-narrowing signals, getRelativeTime helper |
| `globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.html` | VERIFIED | Full card grid: key properties @switch for all 6 types, stage cards (MiniStageBar for Deal/Lead, chips for Quote/Request), activities hero card, associations, notes, meta, pipeline, email engagement |
| `globcrm-web/src/app/shared/components/summary-tab/entity-summary-tab.component.scss` | VERIFIED | summary-grid, summary-card, key-properties-card, full-width, upcoming-section styles present |
| `globcrm-web/src/app/shared/components/summary-tab/deal-pipeline-chart.component.ts` | VERIFIED | DealPipelineChartComponent with conic-gradient computed signal, hasDeals empty state |
| `globcrm-web/src/app/shared/components/summary-tab/email-engagement-card.component.ts` | VERIFIED | EmailEngagementCardComponent with hasEmails, sentCount, receivedCount, sequence badge |

### Detail Page Integration (Plan 23-04)

| Artifact | Status | Details |
|----------|--------|---------|
| `globcrm-web/src/app/shared/components/entity-form-dialog/entity-form-dialog.models.ts` | VERIFIED | 'Note' added to CreateDialogEntityType union, prefill object in EntityFormDialogData |
| `globcrm-web/src/app/shared/components/entity-form-dialog/entity-form-dialog.component.ts` | VERIFIED | NoteFormComponent imported, @case('Note') in switch, viewChild(NoteFormComponent), getActiveForm |
| `globcrm-web/src/app/features/notes/note-form/note-form.component.ts` | VERIFIED | dialogMode input (line 306), entityCreated/entityCreateError outputs (lines 309, 312), triggerSubmit (line 372), prefillFromDialogData logic (line 357) |
| `globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts` | VERIFIED | Summary tab at index 0 of COMPANY_TABS, CONTACT_TABS, DEAL_TABS (lines 27, 40, 58) |
| `globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts` | VERIFIED | summaryData/summaryLoading/summaryDirty/activeTabIndex signals, loadSummary, onSummaryAddNote, onSummaryLogActivity, onAssociationClicked |
| `globcrm-web/src/app/features/companies/company-detail/company-detail.component.html` | VERIFIED | app-entity-summary-tab at tab slot 0, [activeTabIndex] bound, (associationClicked) wired |
| `globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts` | VERIFIED | Same pattern, plus onSummarySendEmail navigating to /emails/compose |
| `globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.html` | VERIFIED | Summary tab ng-template at index 0 |
| `globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts` | VERIFIED | summaryData signals, loadSummary, quick action handlers |
| `globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.html` | VERIFIED | Summary tab at index 0 |
| `globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.ts` | VERIFIED | Computed tabs() prepends Summary, summaryData signals, onSummarySendEmail |
| `globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.html` | VERIFIED | Summary tab ng-template at index 0 |
| `globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.ts` | VERIFIED | summaryData signals, loadSummary, markSummaryDirty called on status transitions (line 375) |
| `globcrm-web/src/app/features/quotes/quote-detail/quote-detail.component.html` | VERIFIED | Summary mat-tab first in mat-tab-group |
| `globcrm-web/src/app/features/requests/request-detail/request-detail.component.ts` | VERIFIED | Inline template with Summary mat-tab at index 0, markSummaryDirty called (line 668) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SummaryService | /api/{entity}/{id}/summary | ApiService.get() calls | WIRED | 6 methods confirmed: getCompanySummary, getContactSummary, getDealSummary, getLeadSummary, getQuoteSummary, getRequestSummary |
| EntitySummaryTabComponent | DealPipelineChartComponent | @if(isCompanyOrContact() && dealPipeline()) with [pipeline] binding | WIRED | app-deal-pipeline-chart in template with dealPipeline()! binding |
| EntitySummaryTabComponent | EmailEngagementCardComponent | @if(isContact() && emailEngagement()) with [engagement] binding | WIRED | app-email-engagement-card in template with emailEngagement()! binding |
| company-detail.ts | SummaryService | inject(SummaryService).getCompanySummary() | WIRED | Lines 42 and 147 confirmed |
| company-detail.ts onTabChanged | summaryDirty check | loads on Summary tab activation if dirty | WIRED | Lines 226-229 confirmed |
| EntitySummaryTabComponent associationClicked | detail activeTabIndex signal | (associationClicked)="onAssociationClicked($event)" → activeTabIndex.set(index) | WIRED | All 4 RelatedEntityTabs detail components confirmed |
| company-detail.ts onSummaryAddNote | EntityFormDialogComponent with Note | dialog.open() → afterClosed → loadSummary() | WIRED | Lines 423-438 confirmed |
| BaseSummaryFields.lastContactedAt | backend JSON 'lastContacted' | direct JSON deserialization | NOT WIRED | Backend serializes 'lastContacted', frontend reads 'lastContactedAt' — field name mismatch causes null at runtime |
| markSummaryDirty (Company/Contact/Deal/Lead) | mutation handlers | called after sibling-tab mutations | NOT WIRED | Method defined but never called in 4 of 6 detail pages |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SUMMARY-01 | 23-04 | Summary tab as first default tab on all 6 detail pages | SATISFIED | Summary at index 0 in COMPANY_TABS, CONTACT_TABS, DEAL_TABS, Lead's computed tabs(), Quote and Request mat-tab-group first position |
| SUMMARY-02 | 23-01, 23-02 | Key properties card with 4-8 highlighted fields per entity | SATISFIED | @switch block in entity-summary-tab.component.html covers all 6 entity types with 7-8 fields each |
| SUMMARY-03 | 23-01, 23-02 | Association counts linking to respective tabs | SATISFIED | associations array from backend, mat-chip-set with (click) → onAssociationClicked → activeTabIndex.set() |
| SUMMARY-04 | 23-01, 23-03 | Last 3-5 recent activities in condensed format | SATISFIED | Backend .Take(5) recent activities; template activities-card with recentActivities @for block |
| SUMMARY-05 | 23-01, 23-03 | Upcoming activities (not done, due today+) | SATISFIED | Backend filter: Status != Done AND DueDate >= now; template upcoming-section with accent border |
| SUMMARY-06 | 23-02 | Stage/status indicators per entity type | SATISFIED | MiniStageBarComponent for Deal/Lead; mat-chip for Quote status; mat-chip for Request status+priority |
| SUMMARY-07 | 23-02, 23-04 | Quick action bar (Add Note, Log Activity, Send Email) | SATISFIED | QuickActionBarComponent with *appHasPermission guards; all detail pages wire outputs to dialog handlers |
| SUMMARY-08 | 23-01, 23-03 | Company/Contact mini deal pipeline summary with chart | SATISFIED | DealPipelineChartComponent with CSS conic-gradient donut; backend DealPipelineSummaryDto with stage grouping |
| SUMMARY-09 | 23-01, 23-03 | Contact email engagement summary | SATISFIED | EmailEngagementCardComponent; backend ContactEmailEngagementDto with TotalEmails, SentCount, ReceivedCount, LastSentAt, LastReceivedAt, IsEnrolledInSequence |
| SUMMARY-10 | 23-01, 23-03 | Last 2-3 notes preview truncated to ~100 chars | SATISFIED | Backend .Take(3) + Substring(0, Math.Min(n.PlainTextBody.Length, 100)); template notes-card with note-preview class (-webkit-line-clamp) |
| SUMMARY-11 | 23-01, 23-03 | Last Contacted timestamp displayed prominently | BLOCKED | Field name mismatch: backend JSON key 'lastContacted', frontend model 'lastContactedAt'. Data never populates — always shows "Never" |
| SUMMARY-12 | 23-01, 23-03 | Attachments count badge | SATISFIED | Backend _db.Attachments.CountAsync per entity; template meta-card shows attachmentCount |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `globcrm-web/src/app/shared/components/summary-tab/summary.models.ts` | 92 | Wrong field name `lastContactedAt` | Blocker | Last Contacted always shows "Never" — SUMMARY-11 broken at runtime |
| `globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts` | 164 | `markSummaryDirty()` defined but never called | Warning | Dirty-flag auto-refresh does not fire for Company mutations on sibling tabs |
| `globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts` | 162 | `markSummaryDirty()` defined but never called | Warning | Dirty-flag auto-refresh does not fire for Contact mutations on sibling tabs |
| `globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts` | 178 | `markSummaryDirty()` defined but never called | Warning | Dirty-flag auto-refresh does not fire for Deal mutations on sibling tabs |
| `globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.ts` | 188 | `markSummaryDirty()` defined but never called | Warning | Dirty-flag auto-refresh does not fire for Lead mutations on sibling tabs |

---

## Human Verification Required

### 1. Summary tab default display

**Test:** Open any entity detail page (Company, Contact, Deal, Lead, Quote, Request)
**Expected:** Summary tab is shown by default; card grid renders with quick action bar, key properties, stage indicator, activities, associations, notes, and meta sections
**Why human:** Visual rendering and correct tab defaulting require browser

### 2. Deal Pipeline donut chart

**Test:** Open a Company or Contact detail page that has linked deals; view Summary tab
**Expected:** CSS conic-gradient donut chart renders with stage-colored segments, shows total value in abbreviated format ($1.2M / $45K), win rate as integer percentage, and stage legend below
**Why human:** CSS visual rendering requires browser; empty-state path if no deals

### 3. Email engagement card

**Test:** Open a Contact detail page that has sent/received emails; view Summary tab
**Expected:** Sent, Received, Total counts shown; Last Sent and Last Received timestamps; sequence enrollment badge if enrolled
**Why human:** Requires live data and browser

### 4. Add Note quick action dialog

**Test:** Click "Add Note" button on Summary tab of any entity
**Expected:** EntityFormDialogComponent opens with NoteFormComponent; entity type, entity ID, and entity name are pre-filled; saving note closes dialog and Summary tab data reloads
**Why human:** Dialog flow requires user interaction; prefill verification requires inspection

### 5. Association chip tab navigation

**Test:** On Company Summary tab, click the "N Contacts" association chip
**Expected:** Active tab switches to the Contacts tab
**Why human:** Tab navigation requires browser interaction

---

## Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — Last Contacted field name mismatch (Blocker, affects SUMMARY-11):**
The frontend `BaseSummaryFields` interface declares `lastContactedAt: string | null` but the backend serializes the C# property `LastContacted` to the JSON key `lastContacted`. Since there is no transformation in `SummaryService`, the `lastContactedAt` field on every frontend DTO is always `undefined` at runtime. The meta card in `entity-summary-tab.component.html` (lines 416-417) checks `data().lastContactedAt` and always falls to the "Never" branch. Fix: rename `lastContactedAt` to `lastContacted` in `summary.models.ts` and update the two template references.

**Gap 2 — Dirty-flag not wired to mutation handlers on 4 of 6 detail pages (Warning, affects SUMMARY-06 truth):**
`markSummaryDirty()` exists and is correctly checked in `onTabChanged()` on Company, Contact, Deal, and Lead detail pages. However, no mutation handler in those 4 components ever calls `markSummaryDirty()`. Quote and Request do call it (on status transitions). For Company, Contact, Deal, and Lead, a user who creates a note from the Notes tab, links a contact from the Contacts tab, or adds a product from the Products tab will NOT see the summary update when they switch back to the Summary tab — the dirty flag is never raised. Fix: call `markSummaryDirty()` in afterClosed handlers for any mutation operation on each of the 4 detail components.

These two gaps share a common trait: the infrastructure is in place (field defined in the interface, method defined in the component) but the final wiring step is missing in each case.

---

_Verified: 2026-02-20T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
