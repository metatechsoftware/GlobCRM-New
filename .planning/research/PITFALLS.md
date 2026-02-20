# Domain Pitfalls

**Domain:** v1.3 Platform & Polish -- Integration marketplace, free-form Kanban boards, quote PDF template builder (Unlayer document mode), and localization (English + Turkish)
**Researched:** 2026-02-20
**Scope:** Adding four major feature areas to an existing ~275K LOC multi-tenant SaaS CRM (Angular 19, .NET 10, PostgreSQL 17) with triple-layer tenant isolation, granular RBAC, 20+ lazy-loaded feature areas, existing Unlayer email template editor, existing CDK drag-drop deal/activity/lead Kanbans, existing QuestPDF quote generation, and 415+ hardcoded UI strings across 59 files.

---

## Critical Pitfalls

Mistakes that cause security breaches, data leaks, severe performance degradation, or architectural rewrites.

---

### Pitfall 1: Integration Marketplace Credential Storage Leaks Across Tenants

**What goes wrong:** The integration marketplace stores OAuth tokens, API keys, and webhook secrets for third-party services (e.g., Zapier, Mailchimp, Slack). These credentials are stored in a new `IntegrationCredential` entity. If this entity lacks `TenantId` column and corresponding RLS policy, or if the EF Core global query filter is not applied, a tenant admin in Org A can access credentials belonging to Org B. Worse: if credentials are stored in a shared table without tenant isolation, a bug in the credential lookup could return another tenant's OAuth token, granting the attacker full API access to the victim's third-party account.

**Why it happens:** The existing `TokenEncryptionService` (used for Gmail OAuth in `GlobCRM.Infrastructure.Gmail`) encrypts tokens with ASP.NET Core DataProtection using a fixed purpose string `"GlobCRM.Gmail.Tokens"`. This encryption is tenant-agnostic -- all tenants share the same encryption key. If the integration marketplace reuses this pattern without adding tenant scoping, encrypted tokens from any tenant can be decrypted by any tenant's request context. The triple-layer defense (Finbuckle middleware, EF Core filters, PostgreSQL RLS) protects entities that have `TenantId`, but a new entity that omits `TenantId` bypasses all three layers.

**Consequences:**
- Cross-tenant credential leakage: attacker gains OAuth tokens for victim's Salesforce, Mailchimp, etc.
- Regulatory violation: credentials are PII-adjacent; cross-tenant access is a GDPR/SOC2 failure
- Cascading breach: compromised OAuth token gives attacker access to the victim's data in the third-party service, not just in GlobCRM

**Prevention:**
1. **Mandatory `TenantId` on every integration entity:** `IntegrationCredential`, `IntegrationConfig`, `IntegrationLog` must all have `Guid TenantId` following the exact pattern in `WebhookSubscription.cs`. Add EF Core configuration with `.HasQueryFilter(e => e.TenantId == _tenantProvider.GetTenantId())`.
2. **Extend RLS script:** Add `ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;` and corresponding policy to `scripts/rls-setup.sql`. This is Layer 3 -- it protects even if Layers 1 and 2 fail.
3. **Tenant-scoped encryption purpose:** Use `_dataProtectionProvider.CreateProtector($"GlobCRM.Integrations.{tenantId}")` so each tenant's credentials are encrypted with a tenant-specific purpose. Even if an attacker accesses another tenant's encrypted blob, it cannot be decrypted without the correct purpose string.
4. **Never store credentials in plaintext:** All API keys and tokens must pass through `DataProtector.Protect()` before persistence. The encrypted column should use PostgreSQL `bytea` type, not `text`.
5. **Integration test:** Seed credentials for Tenant A, authenticate as Tenant B admin, attempt to list/access credentials -- must return empty/403.

**Detection:**
- Automated test: cross-tenant credential access returns 403
- Database audit: `SELECT * FROM integration_credentials WHERE tenant_id != current_setting('app.current_tenant')::uuid` should return zero rows
- Penetration testing: attempt credential enumeration via API

**Phase to address:** Integration Marketplace phase -- must be the first thing designed, before any credential storage code is written.
**Confidence:** HIGH -- direct inspection of `TokenEncryptionService.cs` shows tenant-agnostic encryption, and `WebhookSubscription.cs` shows the correct `TenantId` pattern that must be followed.

---

### Pitfall 2: Unlayer Document Mode Produces Email-Optimized HTML, Not Print-Ready PDF HTML

**What goes wrong:** The existing email template editor uses Unlayer with `displayMode: 'email'` (visible at line 93 of `email-template-editor.component.ts`). The plan is to switch to `displayMode: 'document'` for quote PDF templates. However, Unlayer's `exportHtml()` always produces table-based email HTML with inline styles optimized for email client rendering (Outlook, Gmail). This HTML renders poorly when converted to PDF: fixed-width tables, email-specific media queries, and table-based layouts produce PDFs with unexpected margins, broken layouts on A4/Letter page sizes, and no page break control.

**Why it happens:** Unlayer's `document` display mode changes the editor's visual presentation (removes mobile preview, shows A4-like canvas) but the underlying HTML export remains fundamentally email-oriented. Unlayer does not produce print-ready HTML with CSS `@page` rules, `page-break-before/after`, or proper margin handling for PDF generation. The `exportHtml()` output is the same email-optimized HTML regardless of display mode.

**Consequences:**
- PDF output from Unlayer HTML has wrong page margins, content overflow, and no page breaks
- Line item tables in quotes may split across pages at awkward positions (mid-row)
- Headers and footers (company logo, page numbers) cannot be added via Unlayer -- they are not email concepts
- Users design a beautiful template in the editor, but the PDF output looks nothing like the editor preview
- The existing QuestPDF `QuotePdfDocument.cs` (which produces well-structured PDFs with proper pagination) would need to be replaced with a significantly worse output

**Prevention:**
1. **Keep QuestPDF for final PDF rendering. Use Unlayer for template design only.** The Unlayer editor captures the visual template design (layout, styling, merge tag placement) as a design JSON. Export the design JSON (not HTML) and use it to drive QuestPDF rendering. This is the architectural decision that prevents the most problems.
2. **Design JSON to QuestPDF mapper:** Build a server-side service (`TemplatePdfRenderer`) that reads Unlayer design JSON, extracts content blocks (text, images, tables, merge tags), and maps them to QuestPDF fluent API calls. This mapper handles: text blocks -> `container.Text()`, image blocks -> `container.Image()`, column layouts -> `container.Row()`, merge tags -> Fluid template rendering (reuse existing `TemplateRenderService`).
3. **Alternative: HTML-to-PDF with a headless browser.** If the Unlayer design JSON mapping is too complex, use a headless Chromium approach (Playwright or Puppeteer via a .NET wrapper like `PuppeteerSharp`) to render the Unlayer HTML to PDF. Inject a print-specific CSS stylesheet that overrides email styles: `@page { size: A4; margin: 20mm; }`, `table { page-break-inside: avoid; }`, `body { width: 100% !important; }`. This is simpler but introduces a Chromium dependency.
4. **Do NOT replace the existing `QuotePdfDocument.cs` with Unlayer HTML export.** The existing QuestPDF implementation produces reliable, well-paginated PDFs. Unlayer templates should be an *additional* option ("Use custom template" vs. "Use default template"), not a replacement.
5. **Merge field alignment:** The existing `MergeFieldService.cs` provides merge fields for Contact, Company, Deal, and Lead entities. Quote PDF templates need additional merge fields: `quote.number`, `quote.title`, `quote.issue_date`, `quote.expiry_date`, `quote.subtotal`, `quote.grand_total`, `quote.line_items` (as a repeating block). Extend `MergeFieldService.GetAvailableFieldsAsync()` to include a `quote` group. The line items merge field is the hardest -- Unlayer merge tags are single-value replacements, not repeating blocks. Use Fluid's `{% for item in quote.line_items %}` loop syntax in the design JSON, not Unlayer merge tags, for the line items table.
6. **Preview parity:** The in-editor preview (Unlayer's visual canvas) will NOT match the PDF output (QuestPDF or headless browser). This is unavoidable. Add a "Preview PDF" button that generates an actual PDF preview server-side and returns it as a downloadable/viewable file, so users can see the real output before saving.

**Detection:**
- Visual QA: compare Unlayer editor preview side-by-side with generated PDF
- Automated test: generate PDFs from 5 template designs, verify page count, margin integrity, and that all merge fields resolved
- If the PDF is blank or shows raw HTML tags, the rendering pipeline is broken

**Phase to address:** Quote PDF Template Builder phase -- the Unlayer-to-PDF rendering architecture must be decided before writing any UI code. This is the single most important architectural decision in v1.3.
**Confidence:** HIGH -- direct inspection of the Unlayer editor options (`displayMode: 'email'`) in the existing codebase, and web research confirming Unlayer's HTML export is email-oriented. LOW confidence on document mode specifics (official Unlayer docs not accessible for verification), but the fundamental issue (email HTML is not print HTML) is well-established.

---

### Pitfall 3: Localization Retrofit Creates 1000+ Untranslated String Regressions

**What goes wrong:** The codebase has 415+ occurrences of hardcoded English strings across 59 files (snackbar messages, error messages, success confirmations, button labels). Plus 24+ occurrences of inline labels/placeholders in just the Contacts feature templates alone. Across 20+ feature areas, this means roughly 1,000-1,500 individual strings that need extraction to translation files. If localization is implemented feature-by-feature (translating Contacts first, then Companies, then Deals...), users switching to Turkish see a mix of Turkish and English throughout the app for weeks/months during the rollout. Worse: new features added during the localization rollout (e.g., Kanban boards, integration marketplace) will be written with hardcoded English strings, creating an ever-growing backlog.

**Why it happens:** The app was built English-only for 275K LOC across v1.0-v1.2. There is zero i18n infrastructure -- no `TranslateService`, no translation pipe, no JSON translation files, no `LOCALE_ID` configuration (confirmed by grep showing zero matches for `i18n|translate|localize|TranslateService|LOCALE_ID` in the codebase). Retrofitting i18n into a codebase this large is fundamentally a string extraction problem, not a library integration problem. The library setup takes hours; the string extraction takes weeks.

**Consequences:**
- Mixed-language UI during extended rollout period (poor user experience)
- Missed strings discovered by users in production ("this button is still in English")
- New features added during localization period bypass the translation system
- Backend error messages and API validation messages (`FluentValidation` `.WithMessage()` strings) remain in English even after frontend localization
- Date, number, and currency formatting inconsistencies between English and Turkish locales

**Prevention:**
1. **Use Transloco (not ngx-translate, not Angular built-in i18n).** Transloco is the most actively maintained Angular runtime i18n library with first-class standalone component support, lazy-loaded scope feature, and a migration tool. ngx-translate is in maintenance mode. Angular built-in i18n requires a build per locale (impractical for a SaaS app where users switch languages at runtime).
2. **Extract ALL strings in a single sprint before any translation.** Use a systematic extraction approach:
   - Grep all `.component.ts` and `.component.html` files for string literals in templates
   - Grep all `.store.ts` files for error/success message strings
   - Grep all `MatSnackBar.open()` calls (415 occurrences across 59 files)
   - Extract to a flat JSON structure: `{ "common.save": "Save", "common.cancel": "Cancel", "contacts.form.firstName": "First Name", ... }`
   - Use a consistent key hierarchy: `{feature}.{component}.{element}` (e.g., `deals.kanban.moveForwardOnly`)
3. **Backend strings stay English (for now).** FluentValidation error messages, API error responses, and exception messages should NOT be localized in v1.3. Backend localization is a separate concern that requires `IStringLocalizer` integration, resource files, and content negotiation. Attempting both frontend and backend localization simultaneously doubles the scope. Frontend-only localization covers 90% of user-visible strings.
4. **Mandate translation keys in all new code immediately.** Before writing any new feature code (Kanban, integrations, PDF templates), establish the Transloco infrastructure and require all new UI strings to use `{{ t('key') }}` syntax from day one. This prevents the backlog from growing.
5. **Turkish locale formatting:** Angular's `DatePipe`, `CurrencyPipe`, and `DecimalPipe` use `LOCALE_ID` for formatting. Register the Turkish locale data (`import localeTr from '@angular/common/locales/tr'`) and set `LOCALE_ID` based on user preference. Turkish uses comma as decimal separator (1.234,56 vs 1,234.56) and different date format (20.02.2026 vs 02/20/2026). Existing templates using `| currency:'USD'` will need review for locale-aware formatting.
6. **Create a translation completeness CI check:** A script that compares `en.json` and `tr.json` keys, failing the build if any key exists in one but not the other. This catches missing translations before deployment.

**Detection:**
- CI script comparing translation file key counts
- Visual QA: switch to Turkish locale, navigate every page, screenshot for untranslated strings
- Pseudo-localization pass: replace all English strings with accented equivalents ([Saaavvee] instead of [Save]) to identify hardcoded strings that bypassed the translation system

**Phase to address:** Localization phase -- must be the FIRST phase executed in v1.3 (or at minimum, the Transloco infrastructure must be set up before any other v1.3 feature development begins) to prevent new features from adding untranslatable strings.
**Confidence:** HIGH -- confirmed 415+ hardcoded strings across 59 files, zero i18n infrastructure in codebase.

---

### Pitfall 4: Free-Form Kanban Board Entities Missing Tenant Isolation Create Cross-Tenant Data Leak

**What goes wrong:** The free-form Kanban feature introduces new entities: `Board`, `BoardList` (column), `BoardCard`, and `BoardCardEntityLink` (linking cards to CRM entities). Each entity needs `TenantId`. If `BoardCard` has `TenantId` but `BoardCardEntityLink` does not (because it is a junction table and the developer assumes tenant isolation is inherited from the parent `BoardCard`), a query like `SELECT * FROM board_card_entity_links WHERE entity_id = @id` without tenant filtering could return links from other tenants. Similarly, if `BoardList` relies on FK to `Board` for isolation but the `BoardList` itself lacks `TenantId` and RLS policy, a direct query on `board_lists` bypasses isolation.

**Why it happens:** In the existing codebase, some junction entities (like `DealContact`, `ActivityLink`) do NOT have their own `TenantId` -- they inherit isolation from their parent entities via FK. This works because EF Core's Include queries automatically apply the parent's query filter. But direct queries on the junction table (e.g., `_db.ActivityLinks.Where(al => al.EntityId == id)`) bypass the parent's filter. The existing code works because junction queries always go through the parent entity. But the Kanban feature introduces new query patterns: "show all cards linked to this Contact across all boards" requires querying `BoardCardEntityLink` directly, not through `BoardCard`.

**Consequences:**
- Cross-tenant card visibility: user in Tenant A sees cards from Tenant B
- Entity link leakage: querying "what boards reference this Contact" returns boards from other tenants
- RLS gap: if `board_card_entity_links` table has no RLS policy, it is completely unprotected at Layer 3

**Prevention:**
1. **Add `TenantId` to ALL new Kanban entities:** `Board`, `BoardList`, `BoardCard`, and `BoardCardEntityLink`. Even junction tables. This follows the defensive pattern -- every row in every tenant-scoped table has an explicit `TenantId`.
2. **Add RLS policies for all four tables:** Extend `scripts/rls-setup.sql` with `ENABLE ROW LEVEL SECURITY` and tenant-matching policies for each table.
3. **EF Core configuration:** Add `HasQueryFilter` for each entity type in `ApplicationDbContext`. Ensure the `TenantId` is set automatically by the `AuditableEntityInterceptor` or a dedicated `TenantIdInterceptor`.
4. **Validate FK integrity:** A `BoardCard.BoardListId` must reference a `BoardList` in the same tenant. Add a composite check: the `BoardList` must belong to a `Board` in the same tenant. Consider a trigger or application-level check.
5. **Integration test:** Create a board in Tenant A, switch to Tenant B, verify the board is invisible. Create an entity link in Tenant A, verify it is not returned when querying from Tenant B.

**Detection:**
- Cross-tenant test suite (mandatory for all new entities)
- Database audit query: `SELECT * FROM boards b1 JOIN board_lists bl ON b1.id = bl.board_id WHERE b1.tenant_id != bl.tenant_id` should return zero rows

**Phase to address:** Free-form Kanban phase -- entity design must include `TenantId` from the first migration.
**Confidence:** HIGH -- confirmed by inspection that existing junction tables (`DealContact`, `ActivityLink`) lack `TenantId`, establishing a pattern that developers will follow for new junction tables.

---

## Moderate Pitfalls

Mistakes that cause significant bugs, poor performance, or user confusion, but are recoverable without rewrite.

---

### Pitfall 5: CDK Drag-Drop Conflicts Between Existing Kanbans and New Free-Form Kanban

**What goes wrong:** The app already has three CDK drag-drop Kanban implementations: `DealKanbanComponent`, `ActivityKanbanComponent`, and `LeadKanbanComponent`. Each uses `CdkDropListGroup`, `CdkDropList`, and `CdkDrag` with `connectedTo` relationships. The free-form Kanban board introduces a fourth drag-drop context with more complex requirements: cards can move between lists, lists can be reordered, and cards may contain nested draggable elements (checklists, assignees). CDK's known issue with nested drop lists (GitHub issue #16671, #18503, #25333) causes the outer drop zone to capture events intended for inner zones. If the free-form Kanban component is loaded on the same page as a deal Kanban (e.g., via a sidebar or dialog), CDK drop list IDs can collide.

**Why it happens:** CDK drag-drop uses globally-scoped `connectedTo` IDs. The existing deal Kanban uses `id="stage-{uuid}"` format (visible at line 174 of `deal-kanban.component.ts`). If the free-form Kanban uses similar ID patterns without namespacing, CDK may try to connect drop lists across unrelated Kanban instances. Additionally, the nested drag-drop issue is a fundamental CDK limitation: when drop zones are nested, the parent intercepts the drop event.

**Consequences:**
- Cards dropped in the wrong list or wrong Kanban instance
- Dragging within a card's nested area (e.g., checklist reorder) triggers the card-level drag instead
- Performance degradation: CDK scans all connected drop lists on every drag start; with 3 existing Kanbans + new free-form boards, this scan grows

**Prevention:**
1. **Namespace all drop list IDs:** Free-form Kanban must use IDs like `board-{boardId}-list-{listId}`, not `list-{listId}`. Existing Kanbans already use `stage-{stageId}`, which is safe, but verify there are no collisions.
2. **Isolate `CdkDropListGroup` per board:** Each free-form board component should have its own `CdkDropListGroup` wrapping only its lists. Do not connect free-form Kanban lists to deal/activity Kanban lists.
3. **Avoid nested drag-drop for v1.3:** Do not implement draggable elements inside cards (checklist reordering, assignee reordering). If needed later, use a dialog for card detail editing rather than inline nested drag-drop. The CDK nested list issues (#16671) have been open for years without resolution.
4. **Use `cdkDragDisabled` on card content areas:** Prevent card drag from initiating when the user interacts with interactive elements inside the card (buttons, checkboxes, text inputs). Use `cdkDragHandle` to restrict drag initiation to a specific grab handle area.
5. **Performance: limit connected lists.** If a board has 10+ lists, connecting all lists to all other lists creates O(n^2) relationship scanning. Use `cdkDropListConnectedTo` with explicit list references rather than `CdkDropListGroup` auto-connection when boards have many columns.

**Detection:**
- Manual QA: drag cards between lists on a board with 8+ columns, verify correct drop targets
- Test: open a deal Kanban and a free-form board simultaneously (if possible via sidebar), verify no cross-contamination
- Performance profiling: measure drag start latency on boards with 10+ columns and 50+ cards

**Phase to address:** Free-form Kanban phase -- ID namespacing and drag isolation must be designed before building the board component.
**Confidence:** HIGH -- confirmed CDK nested list issues via GitHub issues, and confirmed existing ID pattern (`stage-{uuid}`) in `deal-kanban.component.ts`.

---

### Pitfall 6: Kanban Board Card Ordering Becomes Inconsistent Under Concurrent Edits

**What goes wrong:** Free-form Kanban cards have a `SortOrder` (position within a list). When User A drags Card X from position 2 to position 5, the backend updates SortOrder for Card X and all cards between positions 2-5. Simultaneously, User B drags Card Y (which was at position 3) to a different list. User A's reorder assumes Card Y was at position 3, but User B already moved it. The resulting sort orders have gaps, duplicates, or cards in unexpected positions.

**Why it happens:** The existing deal Kanban uses optimistic updates with rollback on failure (visible in `deal-kanban.component.ts` at line 192: `transferArrayItem` then API call, revert on error). But it only moves cards between stages (changing `StageId`), not reordering within a stage. The free-form Kanban requires both inter-list moves AND intra-list reordering, which is a more complex concurrency problem.

**Consequences:**
- Cards appear in wrong order after concurrent edits
- "Ghost" cards: a card appears in two lists briefly during a race condition
- Sort order gaps accumulate over time (1, 2, 5, 8, 12 instead of 1, 2, 3, 4, 5)

**Prevention:**
1. **Use fractional ordering (not integer SortOrder).** Instead of `SortOrder: 1, 2, 3, 4, 5`, use decimal positions: `SortOrder: 1.0, 2.0, 3.0`. When inserting Card X between positions 2.0 and 3.0, assign it `SortOrder: 2.5`. This eliminates the need to update multiple rows on every reorder. Only the moved card's SortOrder changes.
2. **Periodic normalization:** When sort order precision gets too fine (e.g., 2.00000001), run a background normalization that reassigns integer positions. This can happen on board load, not on every card move.
3. **Optimistic UI with server reconciliation:** On drag-drop, immediately update the UI (optimistic). Send the new position to the server. The server computes the actual SortOrder based on neighboring cards' current positions and returns the authoritative card list. If the server response differs from the optimistic state, silently reconcile.
4. **SignalR board sync:** Broadcast card moves via SignalR to other users viewing the same board. Use a `BoardCard.Moved` event with `{ cardId, fromListId, toListId, newSortOrder }`. Other clients apply the move to their local state. Use the existing SignalR group pattern: `board_{boardId}`.
5. **Last-write-wins for position conflicts:** Do not use optimistic locking (ETags) for card positions. Position conflicts are cosmetic, not data-loss scenarios. Last-write-wins with SignalR reconciliation is sufficient.

**Detection:**
- Automated test: simulate concurrent card moves by two users, verify final sort order is consistent
- Monitor for sort order gaps exceeding threshold (e.g., max gap > 100 between adjacent cards)
- User reports of "cards jumping around" indicate a concurrency issue

**Phase to address:** Free-form Kanban phase -- data model must use fractional ordering from the initial migration.
**Confidence:** MEDIUM -- based on common Kanban concurrency patterns. The specific severity depends on how many concurrent users edit the same board.

---

### Pitfall 7: Integration Marketplace RBAC Not Integrated With Existing Permission System

**What goes wrong:** The integration marketplace has settings pages (install integrations, configure credentials, enable/disable) that should be admin-only. The existing RBAC system uses `[Authorize(Policy = "Permission:Entity:Action")]` with scope-level enforcement (None/Own/Team/All). But integrations are not "entities" in the CRM sense -- they are org-level configuration, more like pipelines or custom fields. If the integration endpoints use simple `[Authorize(Roles = "Admin")]` (like the existing settings routes use `adminGuard`), they bypass the granular permission system. This means: if a future RBAC update adds a "Settings Admin" role that is separate from the global "Admin" role, integration management will not respect it.

**Why it happens:** The existing settings routes (`settings.routes.ts`) all use `adminGuard` (which checks `authStore.userRole() === 'Admin'`), not `permissionGuard`. This is a binary check -- you are Admin or you are not. The RBAC system supports more granular control (`Permission:Pipeline:Edit` with scopes), but settings features were built before the granular system was fully utilized. Integration marketplace would naturally follow the same `adminGuard` pattern.

**Consequences:**
- All-or-nothing admin access to integrations (no granular "can view but not configure" permission)
- Cannot delegate integration management to a non-admin user or team
- Inconsistent with the granular RBAC pattern used for CRM entities
- Future RBAC expansion requires retrofitting integration endpoints

**Prevention:**
1. **Add integration permissions to the RBAC system:** Define `Permission:Integration:View`, `Permission:Integration:Create`, `Permission:Integration:Edit`, `Permission:Integration:Delete` in the permission seed data. This follows the exact pattern used for Deal, Report, Workflow permissions.
2. **Use `[Authorize(Policy = "Permission:Integration:View")]` on backend endpoints,** not `[Authorize(Roles = "Admin")]`. Default the integration permissions to `All` scope for the Admin role and `None` for Member role, matching current behavior but allowing future flexibility.
3. **Frontend: use `permissionGuard('Integration', 'View')` on routes,** not `adminGuard`. Use `*appHasPermission="'Integration:Edit'"` on configuration buttons and forms.
4. **Settings hub integration:** Add the integration marketplace card to the `SettingsHubComponent.sections` array with `adminOnly: true` initially. When RBAC is checked, replace `adminOnly` with a permission check.
5. **Separate "install" from "configure" permissions:** Consider two permission levels: `Integration:View` (see installed integrations and their status), `Integration:Edit` (modify credentials, enable/disable, install new). This gives admins the option to let team leads view integration status without modifying configuration.

**Detection:**
- Test: create a non-admin user with `Integration:View` permission, verify they can see integrations but not modify them
- Test: create a non-admin user with `Integration:Edit` permission, verify they can configure integrations
- Review: no endpoint should use `[Authorize(Roles = "Admin")]` -- all should use policy-based authorization

**Phase to address:** Integration Marketplace phase -- permission definitions must be added before building any endpoints.
**Confidence:** HIGH -- confirmed that all existing settings use `adminGuard` / `Roles = "Admin"`, and the granular RBAC system exists but is not used for settings.

---

### Pitfall 8: Unlayer Merge Tags Do Not Support Repeating Blocks (Quote Line Items)

**What goes wrong:** Unlayer merge tags are single-value substitutions: `{{contact.first_name}}` becomes `"John"`. Quote PDF templates need a repeating block for line items: a table where each row represents a `QuoteLineItem` with description, quantity, unit price, discount, tax, and total. Unlayer has no native concept of repeating merge tag blocks -- you cannot define a merge tag that expands into multiple table rows. If the developer tries to work around this by creating merge tags like `{{quote.line_item_1_description}}`, `{{quote.line_item_2_description}}`, etc., the template is limited to a fixed number of line items and the tags are ugly and unmaintainable.

**Why it happens:** Unlayer was designed for email templates where content structure is fixed. A "Hello {{first_name}}" email has a known structure at design time. Quote PDFs have dynamic structure -- the line items table varies from 1 to 50+ rows. This is a fundamentally different templating model that Unlayer does not support.

**Consequences:**
- Templates cannot render variable-length line item tables
- Workarounds (fixed-count merge tags) limit functionality and produce empty rows for quotes with fewer items
- Users expect a WYSIWYG template that shows a dynamic table, but Unlayer cannot render one

**Prevention:**
1. **Hybrid approach: Unlayer for layout + Fluid for dynamic sections.** The template stores both the Unlayer design JSON (for the visual editor) and a Fluid/Liquid template string (for the line items section). The PDF generation pipeline: (a) extract the Unlayer design JSON, (b) render static merge fields with `TemplateRenderService` (existing Fluid-based service), (c) inject the line items table using a Fluid `{% for item in quote.line_items %}` loop that generates HTML table rows, (d) compose the final HTML, (e) convert to PDF.
2. **Custom Unlayer tool for the line items block:** Register a custom tool in Unlayer that renders as a placeholder block in the editor ("Line Items Table -- rows will be generated from quote data"). The tool's design JSON stores column configuration (which fields to show, column widths). At render time, the backend reads this configuration and generates the actual table HTML using Fluid templates. This gives users control over table layout without requiring Unlayer to handle the repeating logic.
3. **Expose line items as a Fluid object:** Extend `MergeFieldService.ResolveEntityDataAsync()` for `"quote"` type to return: `["line_items"] = lineItems.Select(li => new Dictionary<string, object?> { ["description"] = li.Description, ["quantity"] = li.Quantity.ToString("G"), ... }).ToList()`. Fluid natively supports iterating over lists.
4. **Table styling in the Fluid template:** The Fluid template for line items should produce styled HTML matching the Unlayer template's visual theme. Extract colors, fonts, and border styles from the Unlayer design JSON to generate consistent table styling.

**Detection:**
- Test: create a quote with 1, 5, and 20 line items; generate PDF from the same template; verify all line items render
- Visual QA: line items table styling matches the surrounding template design
- Edge case: quote with zero line items should show "No line items" message, not an empty table

**Phase to address:** Quote PDF Template Builder phase -- the line items rendering architecture must be designed before building the template editor UI.
**Confidence:** HIGH -- confirmed by examining existing Unlayer merge tag implementation (lines 270-312 of `email-template-editor.component.ts`) that merge tags are flat key-value pairs with no repeating block support.

---

### Pitfall 9: Localization Breaks Angular Material Component Labels and ARIA Attributes

**What goes wrong:** Angular Material components have built-in English labels: `MatPaginator` shows "Items per page", `MatSort` uses "Sort ascending"/"Sort descending" screen reader text, `MatDatepicker` shows month/day names, `MatSidenav` uses "Open"/"Close" labels. These labels are controlled by Material's `MatPaginatorIntl`, `MatSortHeaderIntl`, `MatDatepickerIntl`, and other intl providers. If the localization effort only translates custom template strings (via Transloco) but does not configure Material intl providers, Material components remain in English even when the app is in Turkish.

**Why it happens:** Angular Material intl providers are separate from any third-party i18n library. Transloco translates your custom strings. Material intl providers must be configured independently. Developers focus on visible UI text and miss Material's built-in strings because they are not in template files -- they are injected by Material components at runtime.

**Consequences:**
- Material paginator shows "Items per page" in English while surrounding UI is in Turkish
- Screen readers announce Material components in English, breaking accessibility for Turkish users
- Date pickers show English month names in a Turkish locale
- Inconsistent language mix undermines user trust in the localization quality

**Prevention:**
1. **Provide custom Material intl classes:** For each Material intl provider, create a localized subclass that reads from Transloco:
   ```typescript
   @Injectable()
   export class LocalizedPaginatorIntl extends MatPaginatorIntl {
     private transloco = inject(TranslocoService);
     itemsPerPageLabel = this.transloco.translate('material.paginator.itemsPerPage');
     // ... override all properties
   }
   ```
   Register in `app.config.ts`: `{ provide: MatPaginatorIntl, useClass: LocalizedPaginatorIntl }`.
2. **Register Turkish locale for Angular common pipes:** In `app.config.ts`:
   ```typescript
   import localeTr from '@angular/common/locales/tr';
   registerLocaleData(localeTr);
   ```
   And provide `LOCALE_ID` dynamically based on user preference (stored in `AuthStore` or `TenantStore`).
3. **DateAdapter for Turkish:** Provide `MAT_DATE_LOCALE` as `'tr-TR'` when the user selects Turkish. The `MatNativeDateModule` or `MatMomentDateModule` will automatically use Turkish month/day names.
4. **Create a checklist of all Material intl providers used in the app:** `MatPaginatorIntl`, `MatSortHeaderIntl`, `MatDatepickerIntl`, `MatStepperIntl`. For each, verify that all properties have Turkish translations.
5. **Test with screen reader:** Navigate the app in Turkish locale with VoiceOver/NVDA and verify that Material components announce in Turkish.

**Detection:**
- Visual QA: paginator, sort headers, date pickers show Turkish text
- Accessibility audit: screen reader announces Material components in the correct language
- CI: snapshot test of paginator labels in both locales

**Phase to address:** Localization phase -- Material intl configuration must happen alongside Transloco setup, not as an afterthought.
**Confidence:** HIGH -- Angular Material intl providers are separate from template localization; this is a well-documented Angular localization gap.

---

### Pitfall 10: Existing `any[]` Tech Debt in Preview Components Causes Runtime Errors When Adding Board/Integration Previews

**What goes wrong:** The entity preview system has known `any[]` type usage: `preview-notes-tab.component.ts` uses `signal<any[]>([])` (line 120) and `preview-activities-tab.component.ts` uses `signal<any[]>([])` (line 141). The `EntityPreviewDto` has `fields: Record<string, any>` and `CustomFieldPreviewDto.value: any`. When adding preview support for new entity types (KanbanBoard, Integration), the `any` types mask shape mismatches. A board preview might return `{ fields: { columns: [...] } }` where the preview component expects `{ fields: { value: 123 } }`. The `any` type compiles successfully but crashes at runtime with "Cannot read property 'toFixed' of undefined" or similar.

**Why it happens:** This is listed as known tech debt from v1.2. The `any` types were used as a shortcut when building the preview system quickly. The debt compounds because each new entity type added to the preview sidebar encounters the same `any` trap -- the compiler provides no guidance on the expected shape.

**Consequences:**
- Runtime `TypeError` when opening previews for new entity types
- No compiler assistance when refactoring preview DTOs
- Regression risk: changing the preview DTO shape for one entity type silently breaks others

**Prevention:**
1. **Fix the `any[]` types before adding new entity types.** Replace `signal<any[]>([])` with typed signals: `signal<NotePreviewDto[]>([])`, `signal<ActivityPreviewDto[]>([])`. Define specific DTOs for each preview tab data type.
2. **Type the `fields` record:** Replace `Record<string, any>` with a discriminated union or per-entity-type field interfaces:
   ```typescript
   type DealPreviewFields = { value: number; probability: number; expectedCloseDate: string; companyName: string; };
   type BoardPreviewFields = { columnCount: number; cardCount: number; lastUpdated: string; };
   ```
3. **Add EntityPreviewController handlers for new entity types:** The milestone context notes that `EntityPreviewController` is missing Quote/Request handlers. Add handlers for Quote, Request, Board, and Integration before building their preview UI.
4. **Update ENTITY_TABS constants:** Add tab entries for Quote, Request, Board, and Integration to the relevant tab constants.

**Detection:**
- TypeScript strict mode: `any` usage should trigger linter warnings (`@typescript-eslint/no-explicit-any`)
- Runtime: open preview sidebar for each entity type, verify no console errors
- Unit test: verify preview DTO shapes match expected interfaces

**Phase to address:** First phase of v1.3 (as tech debt cleanup) -- fix `any[]` types and add missing Preview handlers before building new features.
**Confidence:** HIGH -- confirmed `any[]` usage at specific line numbers in preview components.

---

## Minor Pitfalls

Mistakes that cause annoyance, polish issues, or minor bugs, but are easily fixable.

---

### Pitfall 11: Unlayer Component Reuse Creates Configuration Conflicts Between Email and Document Editors

**What goes wrong:** The existing `EmailTemplateEditorComponent` wraps the `angular-email-editor` package with `displayMode: 'email'`, merge tag configuration, and email-specific toolbar options. The quote PDF template editor will also use `angular-email-editor` but with `displayMode: 'document'` and different merge tags (quote-specific fields instead of contact/company/deal fields). If both editors share the same component or import the same `EmailEditorModule`, configuration conflicts can occur: the editor instance may cache the email configuration and apply it to the document editor, or the merge tag color scheme may bleed between contexts.

**Why it happens:** The `angular-email-editor` package loads the Unlayer script globally (via a `<script>` tag injection). The editor instance is created with `window.unlayer.createEditor()`, and configuration is applied at creation time. If two editor components exist in memory (even if one is in a lazy-loaded route), the global Unlayer script may share state.

**Prevention:**
1. **Create a separate `QuoteTemplateEditorComponent`** that wraps `EmailEditorModule` with document-specific configuration. Do NOT try to make a generic "Unlayer editor" component that switches between email and document mode. The configuration differences (display mode, merge tags, tools, toolbar) are substantial enough to warrant separate components.
2. **Different merge tag groups:** Quote template merge tags should include `quote.*` and `organization.*` fields. Email template merge tags include `contact.*`, `company.*`, `deal.*`, `lead.*` fields. Keep these as separate `buildMergeTags()` methods, not a shared utility that tries to combine both.
3. **Verify editor cleanup on route change:** When navigating away from either editor, ensure `ngOnDestroy` properly destroys the Unlayer instance (`this.emailEditor.editor.destroy()` if available) to prevent global state leaks.
4. **Lazy loading isolation:** Both editors should be in separate lazy-loaded routes. The `EmailEditorModule` import in each route chunk will create separate instances of the Angular module.

**Detection:**
- Test: open email template editor, navigate to quote template editor, verify merge tags are correct for each
- Test: save and reload a quote template, verify design JSON is properly loaded without email-specific artifacts
- Memory profiling: verify Unlayer instances are cleaned up on route change

**Phase to address:** Quote PDF Template Builder phase -- separate component from the start.
**Confidence:** MEDIUM -- depends on `angular-email-editor` internal implementation details.

---

### Pitfall 12: Kanban Board Entity Links Create Orphaned References When CRM Entities Are Deleted

**What goes wrong:** A Kanban card can be linked to CRM entities (Contact, Deal, Company, etc.) via `BoardCardEntityLink`. When the linked CRM entity is deleted, the entity link becomes orphaned. The card still shows "Linked to: Acme Corp Deal #42" but clicking it navigates to a 404 page. This is the same pattern as the Feed entity link problem from v1.2 (Pitfall 3 in the previous PITFALLS.md), but now applied to Kanban cards.

**Why it happens:** `BoardCardEntityLink` uses a polymorphic reference (`EntityType` + `EntityId`) with no FK constraint, matching the existing pattern for Notes, Attachments, and FeedItems. No FK means no cascade delete.

**Prevention:**
1. **Store entity name at link creation time:** `BoardCardEntityLink` should include `EntityName` (denormalized from the CRM entity). When the entity is deleted, the card shows "[Deleted] Acme Corp Deal #42" with a disabled link.
2. **Graceful handling in the UI:** When a user clicks an entity link, check if the entity exists before navigating. If 404, show a toast "This entity has been deleted" and offer to remove the link from the card.
3. **Optional: clean up links on entity deletion.** In the entity deletion handlers (e.g., `DealsController.Delete()`), fire an event that a background job processes to mark or remove `BoardCardEntityLink` references. This is optional because the denormalized name provides a degraded-but-usable experience without cleanup.

**Phase to address:** Free-form Kanban phase -- include `EntityName` in the entity link data model from the first migration.
**Confidence:** HIGH -- confirmed by the identical pattern and known issue from v1.2 feed entity links.

---

### Pitfall 13: Turkish Character Encoding Issues in PDF Generation

**What goes wrong:** Turkish has characters not in the basic Latin alphabet: c-cedilla, g-breve, i-dotless, o-umlaut, s-cedilla, u-umlaut (uppercase equivalents). If the PDF font used by QuestPDF does not include Turkish glyphs, or if the font file is loaded with the wrong encoding, Turkish text in quote PDFs renders as boxes, question marks, or garbled characters. The existing `QuotePdfDocument.cs` uses the default QuestPDF font, which may not include full Turkish glyph support.

**Why it happens:** QuestPDF's default font (Lato or system fallback) typically supports Latin Extended-A characters (which includes Turkish). But if a custom font is specified in a template (e.g., a branding font from Unlayer), and that font does not have Turkish glyphs, the PDF will have missing characters. This is a silent failure -- no error is thrown, the characters simply render as empty/replacement.

**Prevention:**
1. **Embed a font with full Turkish support** in the PDF generation service. Use `QuestPDF.Drawing.FontManager.RegisterFont()` with a font like Noto Sans (which covers all Latin Extended characters).
2. **Font fallback chain:** Configure QuestPDF to fall back to Noto Sans if the template-specified font is missing glyphs.
3. **Test with Turkish content:** Generate a test PDF with the string "Cesur Cevikcicar" (containing c-cedilla, s-cedilla, Turkish i variations) and verify all characters render correctly.
4. **Unlayer template fonts:** If Unlayer templates specify web fonts (via Google Fonts), the PDF renderer must download and embed those fonts. Not all web fonts support Turkish. Validate font coverage at template save time and warn the user if the selected font lacks Turkish glyphs.

**Phase to address:** Quote PDF Template Builder phase (if Unlayer-based rendering) or Localization phase (if the default QuestPDF template is Turkish-ified).
**Confidence:** MEDIUM -- QuestPDF's default font likely supports Turkish, but custom fonts are a risk.

---

### Pitfall 14: Integration Marketplace Settings Page Not Added to Settings Hub Navigation

**What goes wrong:** The developer builds the integration marketplace pages (`/settings/integrations`, `/settings/integrations/:id`) with proper routes in `settings.routes.ts`, but forgets to add the corresponding card to the `SettingsHubComponent.sections` array. Users cannot discover the feature because it does not appear in the settings hub. The integration pages are accessible only via direct URL.

**Why it happens:** The settings hub uses a hardcoded array of settings cards (lines 589-673 in `settings-hub.component.ts`). It is not dynamically generated from routes. Adding a new settings route requires updating two files: `settings.routes.ts` (route registration) and `settings-hub.component.ts` (hub card). This is easy to forget.

**Prevention:**
1. **Add the integration marketplace card when adding the route.** Include it in the "Organization" section:
   ```typescript
   { icon: 'extension', label: 'Integrations', description: 'Connect third-party services and manage API credentials', route: '/settings/integrations', adminOnly: true }
   ```
2. **Consider deriving hub cards from routes:** A longer-term improvement would be to define settings metadata (icon, label, description) as route data and dynamically generate the hub cards. This eliminates the two-file update problem.

**Phase to address:** Integration Marketplace phase -- add the settings hub card in the same PR as the route.
**Confidence:** HIGH -- confirmed hardcoded settings array in `settings-hub.component.ts`.

---

### Pitfall 15: Kanban Board Background Colors and Theming Conflict With Existing Design Token System

**What goes wrong:** Free-form Kanban boards typically allow users to set list/card background colors for visual organization. If these colors are hardcoded (e.g., `style="background: #ff5733"`) instead of using the existing CSS custom property system (`var(--color-surface)`, `var(--color-primary-soft)`), the Kanban boards will not respect dark mode (if added later) or the existing design token system. Worse: user-chosen colors may clash with the app's orange primary theme, making cards unreadable.

**Why it happens:** Kanban boards in products like Trello and Notion use vibrant, user-selectable background colors. Developers naturally implement this with inline color values. The existing app uses a three-layer styling system (CSS tokens -> Material M3 theme -> Tailwind config), but user-selected colors bypass all three layers.

**Prevention:**
1. **Provide a curated palette, not a color picker.** Offer 8-10 predefined colors for list/card backgrounds, each defined as a CSS custom property pair (background + foreground for contrast). Example: `--board-color-red-bg: #fee2e2; --board-color-red-text: #991b1b;`.
2. **Store the palette key, not the hex value.** The `BoardList.color` column stores `"red"`, `"blue"`, `"green"`, not `"#fee2e2"`. The frontend maps palette keys to CSS custom properties. This allows future dark mode support by redefining the custom properties.
3. **Default to the existing surface tokens:** Lists without a custom color should use `var(--color-surface)` and `var(--color-text)`, matching the existing card/list styling throughout the app.

**Phase to address:** Free-form Kanban phase -- color system design decision during UI component development.
**Confidence:** MEDIUM -- design token system exists but no dark mode requirement stated for v1.3.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Localization | 1000+ untranslated strings during rollout (P3) | Critical | Extract ALL strings first, mandate translation keys in new code |
| Localization | Material component labels remain English (P9) | Moderate | Configure Material intl providers alongside Transloco |
| Integration Marketplace | Cross-tenant credential leakage (P1) | Critical | TenantId + RLS + tenant-scoped encryption |
| Integration Marketplace | RBAC not integrated (P7) | Moderate | Add Permission:Integration:* to RBAC system |
| Integration Marketplace | Missing from settings hub (P14) | Minor | Add hub card with route |
| Quote PDF Templates | Unlayer HTML not print-ready (P2) | Critical | Use QuestPDF for rendering, Unlayer for design only |
| Quote PDF Templates | No repeating block for line items (P8) | Moderate | Hybrid Unlayer + Fluid approach for dynamic sections |
| Quote PDF Templates | Unlayer config conflicts with email editor (P11) | Minor | Separate component, separate config |
| Quote PDF Templates | Turkish characters in PDFs (P13) | Minor | Embed font with Turkish glyph support |
| Free-form Kanban | Missing tenant isolation on entities (P4) | Critical | TenantId + RLS on ALL new entities including junction tables |
| Free-form Kanban | CDK drag-drop conflicts (P5) | Moderate | Namespace IDs, isolate CdkDropListGroup per board |
| Free-form Kanban | Card ordering concurrency (P6) | Moderate | Fractional ordering + SignalR sync |
| Free-form Kanban | Orphaned entity links (P12) | Minor | Denormalize entity name, graceful 404 handling |
| Free-form Kanban | Color theming conflicts (P15) | Minor | Curated palette with CSS custom properties |
| Cross-cutting | any[] tech debt in previews (P10) | Moderate | Fix before adding new entity type previews |

---

## Recommended Pitfall Resolution Order

1. **Before any v1.3 feature coding:**
   - Set up Transloco infrastructure and extraction tooling (P3 prevention)
   - Fix `any[]` types in preview components (P10)
   - Add missing EntityPreviewController handlers for Quote/Request (P10)

2. **Localization phase (execute first or in parallel):**
   - Extract all strings to `en.json` (P3)
   - Configure Material intl providers (P9)
   - Register Turkish locale and date/currency formatting
   - Create translation completeness CI check (P3)

3. **Integration Marketplace phase:**
   - Design entities with TenantId first, add RLS policies (P1)
   - Add RBAC permissions before building endpoints (P7)
   - Implement tenant-scoped encryption for credentials (P1)
   - Add settings hub card (P14)

4. **Quote PDF Template Builder phase:**
   - Decide Unlayer-to-PDF architecture (design JSON mapping vs headless browser) (P2)
   - Design line items rendering with Fluid loops (P8)
   - Build separate QuoteTemplateEditorComponent (P11)
   - Embed Turkish-supporting font (P13)

5. **Free-form Kanban phase:**
   - Design entities with TenantId + RLS from first migration (P4)
   - Namespace CDK drag-drop IDs (P5)
   - Use fractional ordering for card positions (P6)
   - Include EntityName in entity link data model (P12)
   - Curated color palette with CSS custom properties (P15)

---

## Sources

- Direct codebase inspection: `email-template-editor.component.ts` (Unlayer config at lines 90-104), `deal-kanban.component.ts` (CDK drag-drop pattern), `QuotePdfDocument.cs` (QuestPDF implementation), `TemplateRenderService.cs` (Fluid merge field rendering), `MergeFieldService.cs` (merge field definitions), `TokenEncryptionService.cs` (DataProtection encryption), `WebhookSubscription.cs` (TenantId pattern), `settings-hub.component.ts` (hardcoded settings array), `settings.routes.ts` (adminGuard pattern), `entity-preview.models.ts` (any types), `preview-notes-tab.component.ts` and `preview-activities-tab.component.ts` (any[] signals)
- [Angular CDK Drag Drop Nested List Issues - GitHub #16671](https://github.com/angular/components/issues/16671)
- [Angular CDK Drag Drop Nested List Issues - GitHub #18503](https://github.com/angular/components/issues/18503)
- [Angular CDK Drag Drop Nested List Issues - GitHub #25333](https://github.com/angular/components/issues/25333)
- [Transloco Documentation](https://jsverse.gitbook.io/transloco)
- [Transloco Migration from ngx-translate](https://jsverse.gitbook.io/transloco/migration-guides/migrate-from-ngx-translate)
- [Angular Internationalization Guide](https://angular.dev/guide/i18n)
- [Phrase: 10 Common Mistakes in Software Localization](https://phrase.com/blog/posts/10-common-mistakes-in-software-localization/)
- [Issues Configuring i18n in Angular 19](https://sourcebae.com/blog/issues-configuring-internationalization-i18n-in-angular-19/)
- [Unlayer Angular Email Editor - GitHub](https://github.com/unlayer/angular-email-editor)
- [HTMLToQPDF Extension for QuestPDF](https://github.com/Relorer/HTMLToQPDF)
- [QuestPDF Official Documentation](https://www.questpdf.com/)
- [SaaS Security Vulnerabilities 2025](https://www.appsecure.security/blog/saas-security-vulnerabilities-2025)
- [AWS Multi-Tenant Security Practices](https://aws.amazon.com/blogs/security/security-practices-in-aws-multi-tenant-saas-environments/)
- [Multi-Tenant Architecture Guide](https://www.future-processing.com/blog/multi-tenant-architecture/)
