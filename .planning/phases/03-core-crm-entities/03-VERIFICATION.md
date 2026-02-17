---
phase: 03-core-crm-entities
verified: 2026-02-17T06:44:58Z
status: gaps_found
score: 5/6 must-haves verified
gaps:
  - truth: "User can navigate from company to related contacts, deals, quotes, and activities"
    status: partial
    reason: "Company->Contacts tab is fully wired and loads live data. Deals, Quotes, and Activities tabs exist in COMPANY_TABS but are disabled with 'coming soon' text. No navigation to those entities is possible from the company detail page."
    artifacts:
      - path: "globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts"
        issue: "COMPANY_TABS has Deals/Quotes/Activities as { enabled: false } -- clicking shows placeholder text, no navigation"
      - path: "globcrm-web/src/app/features/companies/company-detail/company-detail.component.html"
        issue: "Only the Contacts tab (index 1) has live data wiring; Deals/Quotes/Activities tabs render disabled-tab-content placeholder"
    missing:
      - "Deals, Quotes, and Activities entities are not yet implemented (Phase 4+). This gap is expected and will be closed in future phases when those entities are built."
      - "Consider whether SC5 should be scoped to 'contacts only' for Phase 3, with deals/quotes/activities deferred to Phase 4+"
human_verification:
  - test: "Verify company detail Contacts tab loads correctly at runtime"
    expected: "Clicking Contacts tab on company detail should load the contacts list via lazy fetch from /api/companies/{id}/contacts"
    why_human: "Lazy loading trigger on tab switch (index 1) requires runtime verification"
  - test: "Verify company autocomplete in contact form"
    expected: "Typing 3+ characters in Company field on contact create/edit form shows debounced typeahead results from /api/companies"
    why_human: "Debounced search with 300ms delay and HTTP call requires runtime testing"
  - test: "Verify custom fields render in company/contact/product forms and detail pages"
    expected: "Custom field definitions for each entity type appear in forms and readonly in detail views"
    why_human: "Requires custom field definitions to exist in the tenant's database"
  - test: "Verify entity timeline shows events on company and contact detail pages"
    expected: "Timeline sidebar shows creation event on first load; update event appears after edit"
    why_human: "Timeline data requires backend to return actual entity lifecycle events"
---

# Phase 3: Core CRM Entities Verification Report

**Phase Goal:** Companies, contacts, and products with full CRUD and relational navigation
**Verified:** 2026-02-17T06:44:58Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| #  | Truth                                                                                      | Status      | Evidence                                                               |
|----|-------------------------------------------------------------------------------------------|-------------|------------------------------------------------------------------------|
| 1  | User can create, view, edit, and delete companies with custom fields                       | VERIFIED  | CompaniesController has 4 CRUD endpoints + CustomFieldValidator wired; CompanyFormComponent uses CustomFieldFormComponent with two-way binding |
| 2  | Company list page uses dynamic table and company detail shows entity timeline              | VERIFIED  | CompanyListComponent imports DynamicTableComponent; CompanyDetailComponent calls getTimeline() and passes entries to EntityTimelineComponent |
| 3  | User can create, view, edit, and delete contacts and link them to companies                | VERIFIED  | ContactsController has full CRUD with CompanyId FK; ContactFormComponent has debounced autocomplete selector wired to CompanyService.getList() |
| 4  | Contact list page uses dynamic table and contact detail shows entity timeline              | VERIFIED  | ContactListComponent imports DynamicTableComponent; ContactDetailComponent loads and renders EntityTimelineComponent with timeline data |
| 5  | User can navigate from company to related contacts, deals, quotes, and activities          | PARTIAL   | Contacts tab: fully wired (lazy-loads from /api/companies/{id}/contacts). Deals/Quotes/Activities: tabs exist but are disabled with "coming soon" placeholder |
| 6  | User can create products with name, description, unit price, SKU, and category             | VERIFIED  | ProductsController Create endpoint accepts all fields; ProductFormComponent has all field inputs; Product entity has UnitPrice decimal(18,4), SKU, Category |

**Score:** 5/6 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/GlobCRM.Domain/Entities/Company.cs` | Company entity with TenantId, JSONB CustomFields, Contacts navigation | VERIFIED | 57-line file with all fields, Dictionary<string,object?> CustomFields, ICollection<Contact> Contacts |
| `src/GlobCRM.Domain/Entities/Contact.cs` | Contact entity with nullable CompanyId FK, FullName computed | VERIFIED | 58-line file, CompanyId nullable Guid, FullName computed property |
| `src/GlobCRM.Domain/Entities/Product.cs` | Product with UnitPrice decimal, SKU, Category, IsActive | VERIFIED | 51-line file, all fields present including decimal UnitPrice |
| `src/GlobCRM.Api/Controllers/CompaniesController.cs` | 7 endpoints: CRUD + timeline + company-contacts | VERIFIED | 581-line file with all 7 endpoints, DTOs, FluentValidation |
| `src/GlobCRM.Api/Controllers/ContactsController.cs` | 6 endpoints: CRUD + timeline | VERIFIED | 573-line file with all 6 endpoints, CompanyId validation, DTOs |
| `src/GlobCRM.Api/Controllers/ProductsController.cs` | 5 endpoints: CRUD | VERIFIED | 345-line file with all 5 endpoints, no ownership scope as expected |
| `globcrm-web/src/app/features/companies/company-list/company-list.component.ts` | List page with DynamicTable, ViewStore, CompanyStore | VERIFIED | DynamicTableComponent imported and used; companyStore.loadPage() called in ngOnInit |
| `globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts` | Detail with tabs, timeline, contacts lazy load | VERIFIED | EntityTimelineComponent and RelatedEntityTabsComponent imported; loadTimeline() and loadContacts() implemented |
| `globcrm-web/src/app/features/companies/company-form/company-form.component.ts` | Create/edit form with custom fields | VERIFIED | ReactiveFormsModule, CustomFieldFormComponent imported; onSubmit() calls service.create() or service.update() |
| `globcrm-web/src/app/features/contacts/contact-form/contact-form.component.ts` | Contact form with company autocomplete | VERIFIED | MatAutocompleteModule imported; companySearchControl + companySearch$ Subject with 300ms debounce wired to CompanyService |
| `globcrm-web/src/app/features/products/product-form/product-form.component.ts` | Product form with unit price, SKU, category | VERIFIED | All fields present including UnitPrice, SKU, Category, isActive checkbox |
| `globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts` | Tab component with COMPANY_TABS, CONTACT_TABS | VERIFIED | COMPANY_TABS (6 tabs: Details+Contacts active, Deals/Quotes/Activities/Notes disabled), CONTACT_TABS (7 tabs), PRODUCT_TABS |
| `globcrm-web/src/app/shared/components/entity-timeline/entity-timeline.component.ts` | Timeline with type-specific icons, sorted entries | VERIFIED | sortedEntries computed signal, TIMELINE_ICONS map, CSS vertical layout |
| `globcrm-web/src/app/app.routes.ts` | Lazy-loaded routes for companies, contacts, products | VERIFIED | All 3 routes present with authGuard and loadChildren |
| `globcrm-web/src/app/shared/components/navbar/navbar.component.html` | Navbar with Companies/Contacts/Products links | VERIFIED | routerLink="/companies", "/contacts", "/products" all present |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| CompanyListComponent | CompanyStore | inject(CompanyStore) + loadPage() | WIRED | companyStore.loadPage() called in ngOnInit; DynamicTableComponent bound to store data |
| CompanyDetailComponent | CompanyService.getTimeline() | loadTimeline() -> subscribe -> timelineEntries.set() | WIRED | EntityTimelineComponent receives [entries]="timelineEntries()" |
| CompanyDetailComponent | CompanyService.getCompanyContacts() | loadContacts() -> subscribe -> contacts.set() | WIRED | Contacts tab template renders contacts() signal |
| CompanyFormComponent | CompanyService.create/update | onSubmit() -> service.create() or service.update() | WIRED | Form submission calls API and navigates on success |
| ContactFormComponent | CompanyService.getList() | companySearch$ Subject -> debounceTime -> switchMap -> companyService.getList() | WIRED | Debounced search wired to autocomplete results |
| ContactFormComponent | ContactService.create/update | onSubmit() -> service.create() or service.update() with selectedCompanyId() | WIRED | companyId from signal included in request |
| ContactDetailComponent | ContactService.getTimeline() | loadTimeline() -> subscribe | WIRED | Timeline entries flow to EntityTimelineComponent |
| ProductDetailComponent | ProductService.getById() | loadProduct() -> subscribe -> product.set() | WIRED | Product signal bound to template |
| app.routes.ts | companies/contacts/products routes | loadChildren lazy imports | WIRED | All 3 lazy routes verified in app.routes.ts |
| navbar.component.html | /companies, /contacts, /products | routerLink | WIRED | All 3 nav links present |
| Company->Deals/Quotes/Activities | (none) | COMPANY_TABS disabled tabs | NOT WIRED | These tabs are disabled placeholders; no navigation possible |

### Requirements Coverage

| Requirement | Status | Notes |
|---|---|---|
| SC1: Companies CRUD with custom fields | SATISFIED | Full backend + frontend CRUD chain verified |
| SC2: Dynamic table + entity timeline | SATISFIED | DynamicTableComponent wired on list; timeline wired on detail |
| SC3: Contacts CRUD with company linking | SATISFIED | Company autocomplete selector fully wired |
| SC4: Contact list + timeline | SATISFIED | DynamicTable on list; timeline on detail |
| SC5: Company relational navigation | PARTIAL | Contacts: wired. Deals/Quotes/Activities: disabled tabs (future phases) |
| SC6: Products with all required fields | SATISFIED | All fields present in entity, controller, and form |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `ContactsController.cs` | 341 | `company_linked` type not in frontend TypeScript union | Info | Contact timeline will show generic `circle` icon for company-linked events (cosmetic only; no crash due to fallback in getIcon/getColor) |
| `product-detail.component.ts` | 289 | `console.error('Failed to delete product:', err)` | Info | Non-blocking; error is logged but user gets no feedback from UI (native `confirm()` dialog used instead of MatDialog) |

No blockers found.

### Human Verification Required

#### 1. Company Detail Contacts Tab

**Test:** On a company detail page, switch to the Contacts tab.
**Expected:** Tab triggers loadContacts() which calls GET /api/companies/{id}/contacts; linked contacts render as a list; unlinked shows "No contacts" empty state.
**Why human:** Lazy-loading is triggered by tab index change at runtime.

#### 2. Company Autocomplete in Contact Form

**Test:** On the New Contact form, type at least 1 character in the Company field.
**Expected:** After 300ms debounce, a dropdown appears with company names matching the search term from the API.
**Why human:** Requires running backend; debounce timing and HTTP call cannot be verified statically.

#### 3. Custom Fields Render in Entity Forms

**Test:** Navigate to New Company, New Contact, or New Product form.
**Expected:** If custom field definitions exist for the entity type, they appear below the core fields via CustomFieldFormComponent.
**Why human:** Requires custom field definitions seeded/created in the tenant's database.

#### 4. Entity Timeline Populates

**Test:** Open a company or contact detail page that has been created and then edited.
**Expected:** Timeline sidebar shows "Company created" event, and if UpdatedAt > CreatedAt + 1s, also shows "Company updated" event.
**Why human:** Timeline events require actual database records with meaningful timestamps.

### Gaps Summary

**One partial gap** blocking full goal achievement:

**Success Criterion 5 is partially met.** The requirement states "User can navigate from company to related contacts, deals, quotes, and activities." The company-to-contacts path is fully functional — the Contacts tab lazy-loads live data from the API on first switch. However, the Deals, Quotes, and Activities tabs are disabled placeholder tabs that show "coming soon" text with no navigation.

This gap is structurally expected: deals, quotes, and activities are Phase 4+ entities that don't exist yet. The tab infrastructure (COMPANY_TABS with disabled slots) is correctly set up to accept those entities in future phases. The gap is not a code quality issue but a scope question: SC5 as written requires future-phase work to be complete.

**Recommendation:** If the intent of SC5 was to verify the tab structure is in place (correct) and that contacts navigation works (correct), then this can be accepted as complete. If the intent was that all four entity types must be navigable, then SC5 requires Phases 4-5 to be complete first, and this verification should be marked as deferred pending those phases.

---

_Verified: 2026-02-17T06:44:58Z_
_Verifier: Claude (gsd-verifier)_
