---
phase: 16-duplicate-detection-merge
verified: 2026-02-19T10:30:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to /duplicates/scan, select Contacts, click Run Scan"
    expected: "Paginated list of duplicate pairs appears with colored score badges (green/amber/red). Each pair shows name and email for both records."
    why_human: "Requires running backend with seeded data and actual pg_trgm index to produce scan results"
  - test: "Create a contact with first/last name matching an existing record, blur the name field"
    expected: "Amber warning banner appears above the form showing matching contact name, email, score percentage, and clickable link"
    why_human: "Requires live backend and duplicate detection service to fire"
  - test: "Click Compare on a scan result, verify the side-by-side comparison page"
    expected: "Both records shown side-by-side with differing fields highlighted in amber, radio buttons per field row, relationship summary section, Merge Records button"
    why_human: "Visual layout and amber highlighting can only be verified by rendering in browser"
  - test: "Click Merge Records and complete confirmation dialog"
    expected: "Records merged, navigated to survivor's detail page, success snackbar shows"
    why_human: "End-to-end merge flow requires database transaction to verify relationship transfer counts"
  - test: "Navigate to a merged contact URL (e.g., /contacts/{mergedId})"
    expected: "Page shows snackbar 'This contact was merged into another record. Redirecting...' and URL changes to survivor's detail page"
    why_human: "Requires a merged record in the database to trigger the redirect path"
  - test: "Navigate to /settings/duplicate-rules as an Admin"
    expected: "Two cards shown (Contact and Company) with auto-detection toggle, threshold slider (50-100%), field checkboxes. Save button updates settings."
    why_human: "Requires Admin role and running backend to verify settings persistence"
---

# Phase 16: Duplicate Detection & Merge Verification Report

**Phase Goal:** Users can detect and merge duplicate contacts and companies with confidence, preserving all relationships and history on the surviving record
**Verified:** 2026-02-19T10:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DuplicateDetectionService returns scored duplicate matches for contacts using two-tier pg_trgm + FuzzySharp | VERIFIED | `DuplicateDetectionService.cs` uses `EF.Functions.TrigramsSimilarity` for Tier 1, `Fuzz.TokenSortRatio` + `Fuzz.Ratio` for Tier 2 weighted scoring |
| 2 | DuplicateDetectionService returns scored duplicate matches for companies using two-tier pg_trgm + FuzzySharp | VERIFIED | Same service: `FindCompanyDuplicatesAsync` with name 60%/domain 40% weights and URL domain extraction |
| 3 | ContactMergeService transfers all 12 FK/polymorphic references from loser to survivor in a single transaction | VERIFIED | `ContactMergeService.MergeAsync` transfers DealContacts, Quotes, Requests, EmailMessages, EmailThreads, Leads, LeadConversions, Notes, Attachments, ActivityLinks, FeedItems, Notifications — 12 references — inside `BeginTransactionAsync`/`CommitAsync` |
| 4 | CompanyMergeService transfers all 13 FK/polymorphic references from loser to survivor in a single transaction | VERIFIED | `CompanyMergeService.MergeAsync` transfers Contacts, Deals, Quotes, Requests, EmailMessages, EmailThreads, Leads, LeadConversions, Notes, Attachments, ActivityLinks, FeedItems, Notifications — 13 references — same transaction pattern |
| 5 | Merged contact/company records have MergedIntoId set and are excluded from list queries via global query filter | VERIFIED | `ApplicationDbContext` global query filters: `c.MergedIntoId == null` on both Contact and Company; loser has `MergedIntoId = survivorId` set in both merge services |
| 6 | POST /api/duplicates/check/contacts and /check/companies return scored matches for real-time create form warnings | VERIFIED | `DuplicatesController` exposes both endpoints with auto-detection config check and enriched DTOs; wired via `DuplicateService.checkContactDuplicates/checkCompanyDuplicates` in frontend |
| 7 | GET /api/duplicates/scan/contacts and /scan/companies return paginated results sorted by confidence | VERIFIED | Both scan endpoints in `DuplicatesController` delegate to `ScanContactDuplicatesAsync`/`ScanCompanyDuplicatesAsync` with page/pageSize params; `DuplicateScanComponent` calls these via `duplicateService.scanContacts/scanCompanies` |
| 8 | User can see side-by-side comparison and execute merge with field selection | VERIFIED | `MergeComparisonComponent` shows both records from comparison endpoint, radio buttons per field, confirmation dialog, calls `mergeContacts`/`mergeCompanies` and navigates to survivor on success |
| 9 | GET /api/contacts/{id} and /companies/{id} return redirect info when accessing a merged record | VERIFIED | `ContactsController` and `CompaniesController` perform secondary `IgnoreQueryFilters` query checking `MergedIntoId != null`, return `MergedRedirectDto { IsMerged: true, MergedIntoId }` |
| 10 | Contact and company detail pages redirect to survivor when loading a merged record URL | VERIFIED | Both detail components check `response?.isMerged && response?.mergedIntoId`, navigate with `replaceUrl: true` and show info snackbar |
| 11 | System warns user of potential duplicates via inline amber banner in contact/company create forms | VERIFIED | `contact-form.component.ts` and `company-form.component.ts` have `potentialDuplicates` signal, blur handlers calling `checkContactDuplicates`/`checkCompanyDuplicates`, dismissible banner — only in create mode |
| 12 | Admin can view and update matching rules per entity type | VERIFIED | `DuplicateSettingsController` GET/PUT endpoints, `DuplicateRulesComponent` with toggle/slider/checkboxes calling `duplicateService.getSettings()/updateSettings()`, route `/settings/duplicate-rules` |
| 13 | Duplicates nav item in sidebar | VERIFIED | `navbar.component.ts` line 100: `{ route: '/duplicates', icon: 'compare_arrows', label: 'Duplicates' }` |
| 14 | pg_trgm extension with 4 GIN trigram indexes applied in migration | VERIFIED | Migration `20260219084655_AddDuplicateDetection.cs` contains all 4 `CREATE INDEX ... USING gin ... gin_trgm_ops` statements with DROP INDEX in Down() |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Provides | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `src/GlobCRM.Domain/Entities/DuplicateMatchingConfig.cs` | Tenant-scoped matching rules | Yes | Yes — `SimilarityThreshold`, `AutoDetectionEnabled`, `MatchingFields` JSONB | Used by `DuplicatesController` and `DuplicateSettingsController` | VERIFIED |
| `src/GlobCRM.Domain/Entities/MergeAuditLog.cs` | Merge audit trail | Yes | Yes — `SurvivorId`, `LoserId`, `FieldSelections`/`TransferCounts` JSONB, `MergedByUser` nav | Created in both merge services on every merge | VERIFIED |
| `src/GlobCRM.Infrastructure/Duplicates/DuplicateDetectionService.cs` | Two-tier duplicate detection | Yes | Yes — `EF.Functions.TrigramsSimilarity` + `Fuzz.TokenSortRatio`/`Fuzz.Ratio`, 355 lines | Injected via `IDuplicateDetectionService` in `DuplicatesController` | VERIFIED |
| `src/GlobCRM.Infrastructure/Duplicates/ContactMergeService.cs` | Contact merge with 12 FK transfers | Yes | Yes — explicit transaction, 12 FK transfers, composite PK dedup for DealContacts/ActivityLinks | Injected in `DuplicatesController.MergeContacts` | VERIFIED |
| `src/GlobCRM.Infrastructure/Duplicates/CompanyMergeService.cs` | Company merge with 13 FK transfers | Yes | Yes — same pattern, 13 FK transfers | Injected in `DuplicatesController.MergeCompanies` | VERIFIED |
| `src/GlobCRM.Api/Controllers/DuplicatesController.cs` | 10 duplicate/merge endpoints | Yes | Yes — 10 endpoints (check x2, scan x2, merge-preview x2, comparison x2, merge x2), co-located DTOs, FluentValidation | Calls `DuplicateDetectionService`, `ContactMergeService`, `CompanyMergeService` | VERIFIED |
| `src/GlobCRM.Api/Controllers/DuplicateSettingsController.cs` | Admin matching config CRUD | Yes | Yes — 3 endpoints (GET all, GET by type, PUT), auto-create defaults | Calls `DuplicateMatchingConfig` via `ApplicationDbContext` | VERIFIED |
| `globcrm-web/src/app/features/duplicates/duplicate.models.ts` | TypeScript interfaces | Yes | Yes — `ContactDuplicateMatch`, `CompanyDuplicateMatch`, `DuplicatePair`, `MergePreview`, `MergeRequest`, `MergeResult`, `DuplicateSettings`, comparison types | Used by `DuplicateService`, `DuplicateScanComponent`, `MergeComparisonComponent`, `DuplicateRulesComponent` | VERIFIED |
| `globcrm-web/src/app/features/duplicates/duplicate.service.ts` | API client for all endpoints | Yes | Yes — 12 methods covering check, scan, merge-preview, merge, comparison, settings | Injected in scan/merge/form/rules components | VERIFIED |
| `globcrm-web/src/app/features/duplicates/duplicate-scan/duplicate-scan.component.ts` | On-demand scan page | Yes | Yes — entity type toggle, `runScan()` calling service, paginated pair cards with score badges, Compare/Dismiss actions | Route `/duplicates/scan`, nav item registered | VERIFIED |
| `globcrm-web/src/app/features/duplicates/merge-comparison/merge-comparison.component.ts` | Side-by-side comparison/merge page | Yes | Yes — field comparison table, radio selection, merge execution calling `mergeContacts`/`mergeCompanies`, confirmation dialog, navigate to survivor | Route `/duplicates/merge?entityType=&id1=&id2=`, navigated from `DuplicateScanComponent.onCompare` | VERIFIED |
| `globcrm-web/src/app/features/settings/duplicate-rules/duplicate-rules.component.ts` | Admin matching config page | Yes | Yes — `DuplicateRulesComponent` with toggle/slider/checkboxes, calls `getSettings()`/`updateSettings()` | Route `/settings/duplicate-rules`, settings hub card | VERIFIED |
| `globcrm-web/src/app/features/contacts/contact-form/contact-form.component.ts` | Contact form with duplicate warning | Yes | Yes — `potentialDuplicates` signal, blur handlers calling `checkContactDuplicates`, dismissible amber banner in create mode only | `DuplicateService` injected, `(blur)` events on name/email fields | VERIFIED |
| `globcrm-web/src/app/features/companies/company-form/company-form.component.ts` | Company form with duplicate warning | Yes | Yes — same pattern, `checkCompanyDuplicates` on name/website blur | `DuplicateService` injected, blur handlers wired | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DuplicateDetectionService` | `ApplicationDbContext` | `EF.Functions.TrigramsSimilarity() + Fuzz.*` | WIRED | Line 42: `EF.Functions.TrigramsSimilarity(c.FirstName + " " + c.LastName, fullName)`, line 269: `Fuzz.TokenSortRatio`, line 270: `Fuzz.Ratio` |
| `ContactMergeService` | `ApplicationDbContext` | Single transaction `BeginTransactionAsync`/`SaveChangesAsync`/`CommitAsync` | WIRED | Line 31: `await _db.Database.BeginTransactionAsync()`, line 128: `await _db.SaveChangesAsync()`, line 129: `await transaction.CommitAsync()` |
| `CompanyMergeService` | `ApplicationDbContext` | Same single-transaction pattern | WIRED | Lines 31/136/137: identical transaction pattern |
| `DuplicatesController` | `DuplicateDetectionService` | `FindContactDuplicatesAsync`/`FindCompanyDuplicatesAsync` | WIRED | Lines 65, 112 in `DuplicatesController.cs` |
| `DuplicatesController` | `ContactMergeService`/`CompanyMergeService` | `MergeAsync` | WIRED | Lines 411, 468 in `DuplicatesController.cs` |
| `contact-form.component.ts` | `DuplicateService.checkContactDuplicates` | Blur event handler | WIRED | Line 593: `this.duplicateService.checkContactDuplicates(...)` in blur handler, result stored in `potentialDuplicates` signal |
| `company-form.component.ts` | `DuplicateService.checkCompanyDuplicates` | Blur event handler | WIRED | Line 438: `this.duplicateService.checkCompanyDuplicates(...)` in blur handler |
| `DuplicateScanComponent` | `MergeComparisonComponent` | Router navigation with query params | WIRED | `this.router.navigate(['/duplicates/merge'], { queryParams: { entityType, id1, id2 } })` in `onCompare()` |
| `MergeComparisonComponent` | `DuplicateService.mergeContacts/mergeCompanies` | Merge button click | WIRED | Lines 935/940: `this.duplicateService.mergeContacts(request)` and `mergeCompanies(request)` on confirm |
| `ContactsController`/`CompaniesController` | `MergedRedirectDto` redirect | `IgnoreQueryFilters` check on `MergedIntoId != null` | WIRED | `ContactsController.cs` line 105: `c.MergedIntoId != null`, returns `MergedRedirectDto { IsMerged = true }` |
| `DuplicateRulesComponent` | `DuplicateService.getSettings/updateSettings` | API calls for config CRUD | WIRED | `loadSettings()` calls `this.duplicateService.getSettings()`, save calls `this.duplicateService.updateSettings(...)` |
| `DuplicateService` (frontend) | `/api/duplicates/*` | `ApiService` HTTP calls | WIRED | All 12 methods use `this.api.get/post/put` with correct paths `${this.basePath}/...` |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| DUP-01 | 16-02, 16-04 | System warns user of potential duplicates when creating a contact or company | SATISFIED | `contact-form` and `company-form` have blur-triggered `potentialDuplicates` signal with amber warning banner; only in create mode; backend check endpoints confirmed |
| DUP-02 | 16-02, 16-03 | User can run an on-demand duplicate scan for contacts and companies | SATISFIED | `DuplicateScanComponent` with entity type toggle and paginated results; `GET /api/duplicates/scan/contacts` and `/scan/companies` confirmed |
| DUP-03 | 16-02, 16-04 | Admin can configure matching rules and similarity thresholds | SATISFIED | `DuplicateSettingsController` with GET/PUT, `DuplicateRulesComponent` with toggle/slider/checkboxes, `/settings/duplicate-rules` route |
| DUP-04 | 16-01, 16-02, 16-03 | System uses fuzzy matching (handles typos, name variations) | SATISFIED | Two-tier detection: pg_trgm GIN indexed pre-filter + FuzzySharp `TokenSortRatio`/`Ratio` scoring; FuzzySharp 2.0.2 in csproj |
| DUP-05 | 16-02, 16-03 | User can view side-by-side comparison of duplicate records | SATISFIED | `MergeComparisonComponent` loads both records via `/api/duplicates/contacts/{id}/comparison`, shows field-by-field table with amber highlighting for differences |
| DUP-06 | 16-01, 16-02, 16-03 | User can merge duplicate contacts with relationship transfer | SATISFIED | `ContactMergeService` transfers all 12 FK/polymorphic references in single transaction; `POST /api/duplicates/merge/contacts` confirmed; frontend merge execution navigates to survivor |
| DUP-07 | 16-01, 16-02, 16-03 | User can merge duplicate companies with relationship transfer | SATISFIED | `CompanyMergeService` transfers all 13 FK/polymorphic references in single transaction; `POST /api/duplicates/merge/companies` confirmed |

All 7 requirements (DUP-01 through DUP-07) are SATISFIED. No orphaned requirements found.

---

### Anti-Patterns Found

No blockers or warnings detected.

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `DuplicatesController.cs` line 236 | `Website = m.Email, // DuplicateMatch.Email stores website for companies` | Info | Comment documents intentional reuse of the `Email` field in `DuplicateMatch` record for company website. Functional but the naming is misleading. Not a blocker — both the controller comment and the working enrichment logic address this. |

---

### Human Verification Required

#### 1. Duplicate Scan Page Functionality

**Test:** Start backend and frontend, seed demo data, navigate to `/duplicates/scan`, select Contacts, click "Run Scan"
**Expected:** Paginated list of pairs with colored score badges (green for score >= 85, amber for 70-84, red for < 70), each pair showing record names and email/company details
**Why human:** Requires running database with pg_trgm extension, seeded contacts with similar names/emails to produce results

#### 2. Real-time Duplicate Warning on Contact Create Form

**Test:** Navigate to `/contacts/new`, type a first and last name matching an existing contact, blur the field
**Expected:** Amber warning banner appears above the form with the matching contact's name, email, match percentage, and a clickable link opening the existing contact
**Why human:** Requires live backend, similarity threshold met by seed data, and visual confirmation of amber styling

#### 3. Merge Comparison Page Visual Layout

**Test:** From scan results, click Compare on a pair with differing fields
**Expected:** Two-column layout with field names on left, Record A values, radio buttons, Record B values. Amber background on rows where values differ. Relationship summary card showing non-zero counts.
**Why human:** CSS diff highlighting and responsive layout can only be verified in browser

#### 4. Full Merge Execution Flow

**Test:** On the comparison page, select some field values from each record, click "Merge Records", confirm the dialog
**Expected:** Loading overlay appears, merge executes, page navigates to `/contacts/{survivorId}` with "Records merged successfully" snackbar
**Why human:** Requires database write; transfer counts in dialog only meaningful with real relationship data

#### 5. Merged Record URL Redirect

**Test:** After a merge, navigate directly to the loser's detail URL (`/contacts/{loserId}`)
**Expected:** Brief snackbar "This contact was merged into another record. Redirecting..." and URL replaces to `/contacts/{survivorId}`
**Why human:** Requires a merged record in the database to trigger the redirect path in ContactsController

#### 6. Admin Settings Page Save

**Test:** As Admin, navigate to `/settings/duplicate-rules`, change the threshold slider for Contacts to 85%, toggle off auto-detection, save
**Expected:** Snackbar "Settings updated", threshold persists on page reload
**Why human:** Requires Admin role, running backend, and database write verification

---

## Summary

Phase 16 goal is **achieved**. All 14 observable truths are verified against actual code. The complete duplicate detection and merge system exists across four plans:

- **Plan 01 (Backend Foundation):** `DuplicateDetectionService` (two-tier pg_trgm + FuzzySharp), `ContactMergeService` (12 FK transfers), `CompanyMergeService` (13 FK transfers), domain entities, EF configurations, migration with 4 GIN trigram indexes, RLS policies. All substantive and wired.

- **Plan 02 (API Endpoints):** `DuplicatesController` with 10 endpoints (check x2, scan x2, merge-preview x2, comparison x2, merge x2), `DuplicateSettingsController` with 3 admin endpoints, merged-record redirect in `ContactsController` and `CompaniesController`. All wired to backend services.

- **Plan 03 (Frontend Scan/Merge):** `DuplicateScanComponent` with entity toggle, paginated results, colored score badges, and router navigation to merge page; `MergeComparisonComponent` with field comparison table, radio selection, confirmation dialog, and post-merge navigation to survivor. `DuplicateService` covering all 12 API methods.

- **Plan 04 (Warnings/Settings):** Blur-triggered duplicate warning banners in contact and company create forms (create mode only, dismissible, non-blocking); `DuplicateRulesComponent` with per-entity config cards; merged-record redirects in both detail components.

All 7 requirements (DUP-01 through DUP-07) are satisfied. No placeholder code, stubs, or blockers detected. Six items flagged for human verification covering visual/runtime behaviors that cannot be verified statically.

---

_Verified: 2026-02-19T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
