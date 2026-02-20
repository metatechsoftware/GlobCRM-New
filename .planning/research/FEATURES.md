# Feature Landscape: GlobCRM v1.3 Platform & Polish

**Domain:** Integration marketplace, free-form Kanban boards, PDF template builder, localization
**Researched:** 2026-02-20
**Overall Confidence:** MEDIUM (Unlayer document mode LOW -- limited official docs found; Kanban patterns HIGH -- well-established; Integration marketplace MEDIUM -- CRM patterns well-known but infrastructure-only scope; Localization HIGH -- mature Angular ecosystem)

---

## Feature Area 1: Integration Marketplace

Infrastructure-only integration marketplace (no actual third-party API integrations yet). The goal is a settings page where admins can browse available integrations, see their connection status, and manage credentials. This lays the groundwork for future real integrations.

### Table Stakes

Features users expect from an integration settings/marketplace page. Missing = page feels like a placeholder.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Card-based grid layout with integration tiles | HubSpot Marketplace, Pipedrive Marketplace, Zoho Marketplace all show integrations as visual cards with logo, name, short description, and status badge. This is the universal pattern. | Low | Reuse card grid pattern from Settings Hub (already built with themed sections and card grid). Each card shows: icon/logo placeholder, name, one-line description, status badge (Not Connected / Connected / Error). |
| Category filtering | Every marketplace has categories (Communication, Accounting, Marketing, Storage, Calendar, etc.). Users need to narrow the list. HubSpot has sidebar filters; Pipedrive uses horizontal tabs. | Low | Horizontal chip/tab bar at top. Categories: Communication, Accounting, Marketing, File Storage, Calendar, Developer Tools. "All" as default. Filter is client-side since total integration count is small (10-20 seed entries). |
| Search by name | Basic text search across integration names. Every marketplace has a search bar. | Low | Simple `signal<string>` filter on integration name/description. Same pattern as Settings Hub search. |
| Connect / Disconnect buttons | The primary action. HubSpot shows "Connect app" button that opens OAuth or credential entry. Disconnect removes stored credentials. | Medium | "Connect" opens a dialog with credential form (varies by integration type: API Key, OAuth, or API Key + Secret). "Disconnect" shows confirmation dialog, then removes stored credentials. Backend: encrypted credential storage. |
| Connection status badges | Visual indicator: Connected (green), Not Connected (gray), Error (red). HubSpot Connected Apps page shows status per integration. Pipedrive shows toggle switches. | Low | Badge on each card. Three states: `notConnected`, `connected`, `error`. Status stored in backend `Integration` entity per tenant. |
| Integration detail panel/page | Clicking a card shows more information: full description, what it does, required credentials, connection status, last sync time (if applicable). HubSpot shows a full detail page per integration. | Medium | Use CDK Overlay slide-in panel (existing SlideInPanelService pattern from v1.2) or a dialog. Shows: full description, credential form, connection status, "What this integration does" section, link to documentation. |
| Admin-only access | Integration management is an admin function. Non-admins should see connected integrations (read-only awareness) but not be able to connect/disconnect. | Low | Reuse existing `[Authorize(Roles = "Admin")]` on write endpoints. Frontend: `HasPermissionDirective` hides Connect/Disconnect for non-admins. Read-only view for members shows status only. |
| Credential masking | API keys and secrets must be masked in the UI (show last 4 chars only). Never return full credentials from API. HubSpot shows masked keys. | Low | Backend: never return full credential values in DTOs. Return `isConfigured: true` and `maskedKey: "****abcd"`. Frontend: display masked value with "Update" button to re-enter. |

### Differentiators

Features that set the integration marketplace apart. Not universally expected in a v1.0 integration page.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Connection health check / test button | "Test Connection" button that validates stored credentials against the external service. HubSpot shows last sync status. Pipedrive shows health indicators. Reduces "is it working?" anxiety. | Medium | Backend endpoint that attempts a lightweight API call (e.g., list accounts, validate token). Returns success/failure. UI shows result inline with timestamp. Similar pattern to existing webhook "Test" button. |
| Integration activity log | Show last N credential operations: "Connected by John on Feb 20", "Disconnected by Admin on Feb 19", "Connection test failed on Feb 18". Audit trail for security. | Low-Medium | `IntegrationEvent` table: `integrationId`, `eventType` (Connected/Disconnected/TestSuccess/TestFailed), `userId`, `timestamp`. Display as compact timeline in detail panel. |
| Popular/Recommended badge | Highlight integrations that are most commonly used. Social proof guides new users. "Popular" badges are standard in HubSpot Marketplace. | Low | Static `isPopular` / `isFeatured` flags on seed integration records. Render as badge on card. No actual usage analytics needed for infrastructure phase. |
| Webhook integration auto-creation | When connecting an integration, optionally auto-create a webhook subscription for relevant events. Bridges existing webhook system with new marketplace. | Medium | Optional enhancement. When an integration defines `webhookEvents` in its config, offer to auto-subscribe. Uses existing webhook infrastructure. |

### Anti-Features

Features to explicitly NOT build for the integration marketplace.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Actual third-party API integrations | This is infrastructure only. Building real Mailchimp, QuickBooks, Slack integrations requires per-provider OAuth flows, data mapping, sync logic, error handling. Enormous scope. | Build the marketplace UI and credential storage infrastructure. Seed with 10-15 placeholder integrations showing what future integrations would look like. Real integrations are v2+. |
| OAuth redirect flow implementation | Real OAuth requires registered apps with each provider, redirect URIs, token refresh, scope management. Not needed for infrastructure phase. | Support API Key and API Key + Secret credential types only. OAuth placeholder shows "OAuth integration -- coming soon" status. |
| Bidirectional data sync | Sync engines (contact sync between CRM and Mailchimp, deal sync with accounting) are each a major feature. | Integration infrastructure stores credentials. Actual sync logic is per-integration future work. |
| Marketplace app submission / third-party plugins | Allowing external developers to submit integrations requires app review, sandboxing, security audit. | Integrations are admin-seeded catalog entries only. No external submission system. |
| Per-integration configuration UI | Each real integration needs unique configuration (field mapping, sync direction, filters). Building a config UI framework is premature. | Integration detail panel shows description and credentials only. Per-integration config screens built when real integrations ship. |

### Feature Dependencies

```
Settings Hub --> New "Integrations" card entry (route: /settings/integrations)
Integration list page --> IntegrationService (new API service)
Integration cards --> IntegrationDto (id, name, description, category, iconName, status, isPopular)
Connect button --> Credential dialog (API Key / API Key+Secret entry)
Credential storage --> Backend: encrypted JSONB column on IntegrationConnection entity
Disconnect button --> Confirmation dialog + delete IntegrationConnection
Detail panel --> SlideInPanelService (existing from v1.2) or MatDialog
Test connection --> New endpoint per integration type (basic HTTP call validation)
Admin guard --> Existing RBAC system (Permission:Integration:Manage)
```

---

## Feature Area 2: Free-Form Kanban Boards

User-created Kanban boards alongside existing system boards (deal pipeline, activity workflow). Users can create boards for any purpose (project tracking, sprint planning, content calendar) with free-form and entity-linked cards.

### Table Stakes

Features users expect from a Kanban board tool. Benchmarked against Trello, Notion boards, monday.com, ClickUp, and WeKan.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create/edit/delete boards | Fundamental CRUD. Trello: unlimited boards. Every Kanban tool starts here. Board has: name, optional description, optional color/icon, visibility setting. | Low | `Board` entity: `id`, `tenantId`, `name`, `description`, `color`, `icon`, `visibility` (Private/Team/Public), `createdBy`, `boardType` (Custom/SystemDeal/SystemActivity). |
| Add/rename/reorder/delete columns (lists) | Trello: create lists, drag to reorder. Columns represent workflow stages. A board without configurable columns is useless. | Low-Medium | `BoardColumn` entity: `id`, `boardId`, `name`, `sortOrder`, `color`, `wipLimit`. Reorder via drag-and-drop on column headers using CDK DragDrop (already used in deal/activity Kanban). |
| Create/edit/archive cards | Cards are the work items. Trello cards have: title, description, labels, due date, assignees, checklist, attachments, comments. For GlobCRM, cards are either free-form OR entity-linked. | Medium | `BoardCard` entity: `id`, `columnId`, `title`, `description`, `sortOrder`, `dueDate`, `assigneeId`, `color`, `labelIds[]`, `linkedEntityType`, `linkedEntityId`, `isArchived`. Free-form cards have all fields user-entered. Entity-linked cards auto-populate title/description from linked entity. |
| Drag-and-drop cards between columns | THE core Kanban interaction. Cards move between columns to represent workflow progress. Must feel instant (optimistic UI). GlobCRM already has this pattern in deal and activity Kanbans. | Medium | Reuse existing CDK DragDrop pattern (`CdkDropListGroup`, `CdkDropList`, `CdkDrag`, `transferArrayItem`). Optimistic update with API revert on failure. Same pattern as `DealKanbanComponent` and `ActivityKanbanComponent`. |
| Drag-and-drop card reordering within column | Trello: drag cards up/down within a list to set priority. Cards need a `sortOrder` that updates on drop. | Low | `moveItemInArray` from CDK. Already implemented in existing Kanbans. Update `sortOrder` via PATCH endpoint. |
| Card detail dialog/panel | Clicking a card opens a detail view. Trello: full-screen card modal. Shows all card fields, allows editing. | Medium | MatDialog with card detail form: title, description (rich text via ngx-quill), due date picker, assignee picker, labels, linked entity display. For entity-linked cards, show entity preview alongside card data. |
| Labels/tags with colors | Trello: colored labels for categorization. 6-8 predefined colors with optional text. Board-scoped labels. | Low-Medium | `BoardLabel` entity: `id`, `boardId`, `name`, `color`. Many-to-many with cards. Display as colored chips on card face. |
| Assignee on cards | Every Kanban tool shows who owns a card. Trello shows member avatars. | Low | `assigneeId` FK to User. Display as avatar circle on card face (same pattern as deal Kanban owner initials). Picker uses existing user list endpoint. |
| Due date on cards | Trello: due date with overdue visual indicator (yellow approaching, red overdue). | Low | `dueDate` on card. Display as text with urgency color. Reuse existing `getDueDateClass()` / `isOverdue()` patterns from activity Kanban. |
| Board visibility: Private / Team / Public | Trello: Private (creator only), Workspace (team members), Public. CRM needs tenant-scoped visibility control. | Medium | Three levels: `Private` (only creator), `Team` (creator's team members), `Public` (all tenant users). Backend query filter based on visibility + current user's team memberships. |
| System boards for existing pipelines | The Kanban page should aggregate: (1) existing deal pipeline boards, (2) existing activity status board, and (3) user-created boards. One unified Kanban page. | Medium | Route `/boards` shows all boards: system boards (read-only structure, linked to existing pipeline/activity endpoints) + custom boards. System boards rendered using existing `DealKanbanComponent` / `ActivityKanbanComponent` data but within new unified page shell. |
| Empty state with create prompt | When user has no custom boards, show "Create your first board" prompt. Trello shows templates. | Low | Standard empty state pattern used across GlobCRM (icon + message + CTA button). |

### Differentiators

Features that add value beyond basic Kanban. Not expected in v1.0 of a CRM Kanban feature.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Entity-linked cards | Cards that reference a CRM entity (Contact, Deal, Lead, etc.). Card auto-displays entity name, key data, and links to the entity. This bridges project management with CRM -- the unique GlobCRM value prop. | Medium | Card has optional `linkedEntityType` + `linkedEntityId`. When set, card renders entity chip (icon + name) with click-to-preview (reuse preview sidebar from v1.2). Entity data fetched alongside card data via join or separate lookup. |
| Card description with rich text | Trello uses Markdown. ClickUp supports rich text. For GlobCRM, use ngx-quill (already in project) for card descriptions. | Low | Reuse existing `RichTextEditorComponent` in card detail dialog. Store HTML in `description` column. Display as rendered HTML on card preview (truncated). |
| WIP (Work-in-Progress) limits | Kanban best practice. Column shows visual warning when card count exceeds WIP limit. Trello doesn't have this (Trello alternative apps like Kanban Tool do). | Low | `wipLimit` nullable int on `BoardColumn`. When `cards.length > wipLimit`, column header shows red count. Visual-only enforcement (no blocking). |
| Board templates | Pre-configured boards: "Sprint Board" (To Do / In Progress / Testing / Done), "Content Calendar" (Ideas / Writing / Review / Published), "Sales Follow-up" (New / Contacted / Meeting / Proposal). | Low | Seed data boards with `isTemplate: true`. "Create from template" clones board structure (columns + labels, no cards). |
| Card checklist | Trello checklist: checkbox items within a card. Shows progress "2/5 completed" on card face. | Medium | `BoardCardChecklistItem` entity: `id`, `cardId`, `text`, `isCompleted`, `sortOrder`. Display as progress bar on card face. Full checklist in card detail dialog. |
| Card comments | Trello: comment thread on each card. Threaded discussion within a card context. | Medium | `BoardCardComment` entity: `id`, `cardId`, `userId`, `content`, `createdAt`. Reuse feed comment UI pattern. Display comment count on card face. |
| Filter cards by label/assignee/due date | Trello: filter by label, member, due date. Reduces visual clutter on busy boards. | Low-Medium | Client-side filter chips above board columns. Cards not matching filter get `opacity: 0.3` or hidden. Toggle behavior. |

### Anti-Features

Features to explicitly NOT build for the Kanban boards.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Card attachments | File upload on cards adds storage complexity, S3/Azure integration per card, preview rendering. Trello has this but it's a heavyweight feature. | Link to entity attachments for entity-linked cards. Free-form cards: include URLs in description via rich text editor. File attachments on cards is v2+. |
| Card time tracking | Time tracking on Kanban cards (Toggl integration, manual time entry) is a separate product domain. ClickUp has it, Trello doesn't. | CRM activities already have time tracking. Entity-linked cards inherit time tracking from linked activities. Free-form cards: no time tracking. |
| Automations on board events | "When card moves to Done, send email" -- board-level automation rules. Trello has Butler automations. | Use existing workflow automation system. Board events can trigger workflows in a future version. No board-specific automation engine. |
| Calendar view of board cards | Alternative visualization of cards as calendar events (by due date). | Cards with due dates appear in existing Calendar page alongside activities. No dedicated board calendar view. |
| Board permissions (per-column, per-card) | Granular ACLs on columns or individual cards. Over-engineering. | Board-level visibility (Private/Team/Public) is sufficient. All board members have equal read/write access to all columns and cards. |
| Swimlanes | Horizontal rows within columns (by priority, assignee, category). Adds significant UI complexity. | Use labels and filtering for categorization. Swimlanes deferred to future. |
| Infinite scroll / virtualization for large boards | Boards with 500+ cards per column. | Reasonable column card limit of ~50 visible cards. Archive old cards. Paginate if needed in future. |

### Feature Dependencies

```
Boards page component --> New route (/boards)
Board list --> BoardService (new API service)
Board detail --> BoardStore (signal store, component-provided)
Columns --> CDK DragDrop (existing, column reorder)
Cards --> CDK DragDrop (existing, card drag between columns)
Card detail dialog --> MatDialog + RichTextEditorComponent (existing)
Entity-linked cards --> EntityTypeRegistry (existing from v1.2) + entity services
Card assignee --> User list endpoint (existing)
Board labels --> BoardLabelService (new, board-scoped)
System boards --> DealService.getKanban() + ActivityService.getKanban() (existing)
Board visibility --> AuthStore.currentUser() + TeamService (existing)
```

---

## Feature Area 3: Quote PDF Template Builder (Unlayer Document Mode)

Replace the fixed QuestPDF layout with user-designed PDF templates using Unlayer's document editor mode. Users design quote PDFs with drag-and-drop, insert CRM merge fields, preview with real data, and generate PDFs from their custom layouts.

### Table Stakes

Features users expect from a PDF template builder in a CRM. Missing = template builder feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop document layout editor | Unlayer's document mode provides page-aware editing (A4/Letter sizing, margins, headers, footers). Users expect the same visual editing experience as the existing email template editor. S-Docs (Salesforce) and PandaDoc provide similar drag-and-drop document builders. | Medium | Set Unlayer `displayMode: 'document'` instead of `'email'`. This enables page-aware layout with headers, footers, page breaks, and fixed page dimensions. Reuse existing `angular-email-editor` package (same Unlayer component, different mode). |
| Merge field insertion for CRM data | Existing email templates already use Unlayer merge tags with `{{contact.firstName}}` syntax. Quote PDF templates need the same merge fields PLUS quote-specific fields: line items table, totals, quote number, dates, etc. | Medium | Extend existing merge field API endpoint to include quote-specific fields. Groups: Quote (number, title, status, dates), Line Items (handled as a repeating section or pre-rendered table), Company, Contact, Deal. Use same `setMergeTags()` pattern from email template editor. |
| Template list with create/edit/delete | CRUD for PDF templates. Each template has name, design JSON, and metadata. Same pattern as email template list. | Low | `QuoteTemplate` entity: `id`, `tenantId`, `name`, `designJson`, `thumbnailHtml`, `isDefault`, `isShared`, `createdBy`, `createdAt`, `updatedAt`. List page mirrors existing email template list UI pattern. |
| Default template selection | One template should be the default for new quote PDFs. When generating a PDF, use the default unless user picks another. | Low | `isDefault` boolean flag on `QuoteTemplate`. Only one per tenant. Toggle in list view. |
| Preview with real quote data | "Show me what this template looks like with actual quote data." Existing email template editor has a preview dialog that renders with real entity data. Same pattern needed here. | Medium | Backend endpoint: `POST /api/quote-templates/{id}/preview?quoteId={quoteId}`. Renders merge fields with actual quote data, returns HTML. Frontend: preview dialog showing rendered result (same pattern as `EmailTemplatePreviewComponent`). |
| PDF generation from template | Replace existing fixed QuestPDF layout with template-driven generation. When user clicks "Download PDF" on a quote, system renders the Unlayer HTML with merge field data, then converts HTML to PDF. | High | Backend: (1) Load template design JSON, (2) Export to HTML using Unlayer export or stored HTML, (3) Replace merge tags with Fluid (already in project), (4) Convert HTML to PDF. Options for HTML-to-PDF: Puppeteer/Playwright headless browser, IronPDF, or continue using QuestPDF with template-informed layout. Recommend: HTML string with Fluid merge rendering + HTML-to-PDF library. |
| Line items table in template | Quote PDFs must include a table of line items (description, qty, unit price, discount, tax, total). This is a repeating data structure that needs special handling in the template. | High | Two approaches: (1) Custom Unlayer tool/block that renders a dynamic table from line item data at generation time, or (2) Pre-render the line items table as HTML and inject it as a merge field `{{quote.lineItemsTable}}`. Approach 2 is simpler: backend builds an HTML table string from line items data and injects it as a single merge field value. |
| Totals section in template | Subtotal, discount, tax, grand total. Users expect these in a structured format. | Low-Medium | Merge fields: `{{quote.subtotal}}`, `{{quote.discountTotal}}`, `{{quote.taxTotal}}`, `{{quote.grandTotal}}`. Format as currency strings on backend before injection. Totals can be placed anywhere in the template via merge fields. |
| Organization branding | Company logo, name, address in template header. Basic branding is table stakes for professional quotes. | Low | Merge fields: `{{organization.name}}`, `{{organization.logo}}` (as image URL injected into `<img>` tag). Logo upload already exists in tenant settings (or needs to be added as part of this feature). |

### Differentiators

Features that elevate the template builder beyond basic functionality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multiple templates per tenant | Not just one default -- users can create different templates for different quote types (Standard Quote, Enterprise Quote, Service Agreement). Select template when generating PDF. | Low | Already supported by the template CRUD design. Template picker dropdown on quote detail page when generating PDF. |
| Template cloning | Clone an existing template to create a variant. Same as existing email template clone. | Low | Reuse clone pattern from `CloneTemplateDialogComponent`. Copy design JSON with new name. |
| Template thumbnail preview | Show a rendered thumbnail in the template list so users can visually identify templates without opening them. | Medium | On save, generate a small preview image (or use the stored HTML rendered in an iframe at reduced scale). Alternatively, store first-page HTML and render in a small container. |
| Page configuration options | A4 vs. Letter page size, portrait vs. landscape orientation, custom margins. | Low-Medium | Unlayer document mode supports page size configuration via editor options. Expose these as settings in the template editor toolbar. Store in template metadata. |
| Conditional sections | Show/hide template sections based on quote data (e.g., hide discount column if no discounts, show special terms only for quotes above a threshold). | High | Requires template logic engine. Could use Fluid conditional syntax `{% if quote.discountTotal > 0 %}` in the rendered HTML. Backend Fluid engine already supports conditionals. Complexity is in making this user-friendly in the Unlayer editor. Defer detailed conditional UI. |
| Version history for templates | Track template changes over time. Useful when templates are shared across the team. | Medium | `QuoteTemplateVersion` entity storing previous `designJson` snapshots. "Revert to version" capability. Similar to quote versioning already in the system. |

### Anti-Features

Features to explicitly NOT build for the PDF template builder.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom Unlayer blocks/tools for line items | Building a custom Unlayer block that dynamically renders line item rows in the editor preview is very complex (custom tool registration, React rendering within Unlayer's iframe, dynamic row count). | Use pre-rendered HTML injection: backend builds the line items table as an HTML string and injects it as a merge field `{{quote.lineItemsTable}}`. In the editor, this shows as a merge tag placeholder. In the rendered PDF, it expands to the full table. |
| Real-time data preview in editor | Showing actual quote data live within the Unlayer editor as users design the template (WYSIWYG with real data). Requires tight integration between editor state and backend data. | Separate "Preview" button that opens a dialog showing the template rendered with selected quote data. Same pattern as email template preview. |
| E-signature integration | Digital signatures on PDF quotes (DocuSign, Adobe Sign). Significant third-party integration scope. | Generate PDF only. E-signature is a future integration marketplace item. |
| Multi-page template designer | Designing page breaks, headers/footers that repeat across pages, page numbering within Unlayer. Unlayer document mode has limited multi-page design support. | Template designs are for the content area. Page headers/footers/numbering handled at PDF generation time by the HTML-to-PDF engine (not in Unlayer). Configuration options for header/footer content stored separately. |
| Template marketplace / sharing between tenants | Sharing templates across organizations adds complexity (data isolation, template versioning, approval process). | Templates are per-tenant only. Provide 2-3 seed templates as starting points. |
| Replacing QuestPDF entirely | Keep QuestPDF as a fallback for tenants that haven't created custom templates. The default system template can still use QuestPDF. | If no custom template exists or is selected, fall back to existing QuestPDF-generated PDF. This ensures backward compatibility. |

### Feature Dependencies

```
Quote template editor --> Unlayer angular-email-editor (existing package, displayMode: 'document')
Template CRUD --> QuoteTemplateService (new API service)
Merge fields --> Existing MergeFieldService (extend with quote-specific fields)
Merge field panel --> Existing MergeFieldPanelComponent (reuse from email templates)
Template preview --> Fluid template engine (existing in backend for email rendering)
PDF generation --> HTML-to-PDF conversion library (new backend dependency)
Line items table --> Backend HTML table builder (new utility)
Quote detail integration --> Template picker + "Generate PDF" button (modify existing)
Organization branding --> Tenant/Organization settings (existing, may need logo upload)
Default template --> QuoteTemplate.isDefault flag
Fallback to QuestPDF --> Existing QuotePdfDocument (keep as fallback)
```

---

## Feature Area 4: Localization (English + Turkish)

Add localization infrastructure to support multiple languages, starting with English (default) and Turkish. Runtime language switching without page reload. JSON-based translation files.

### Table Stakes

Features users expect from a localized application. Missing = localization feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Translation pipe for template strings | All hardcoded UI strings (labels, buttons, messages, tooltips) need to render in the selected language. This is the core i18n mechanism. | High (volume) | Use Transloco (recommended over ngx-translate -- better maintained, first-class standalone component support, lazy loading built-in, active development by jsverse). Transloco pipe: `{{ 'feature.label' | transloco }}`. Must touch every component template -- large surface area. |
| JSON translation files per locale | Translations stored as JSON files keyed by dot-notation paths. `en.json` and `tr.json` as the two initial locales. | Medium | Structure: `src/assets/i18n/en.json`, `src/assets/i18n/tr.json`. Organized by feature scope: `{ "nav": { "home": "Home", "contacts": "Contacts" }, "common": { "save": "Save", "cancel": "Cancel" } }`. Transloco supports scope-based lazy loading per feature. |
| Language selector in UI | User needs a way to switch languages. Standard pattern: dropdown in navbar or user profile menu. | Low | Dropdown in user profile menu (existing profile dropdown in navbar). Shows available languages with native names: "English", "Turkce". Selection persisted to user preferences. |
| Runtime language switching without reload | Users switch language and the entire UI updates immediately. Transloco supports this natively. ngx-translate also supports it. Angular built-in i18n does NOT (requires separate builds per locale). | Low | Transloco's `TranslocoService.setActiveLang('tr')` triggers reactive updates across all pipes and directives. No page reload needed. This is a key reason to use Transloco over Angular built-in i18n. |
| User language preference persistence | Selected language saved to user profile. On login, app loads the user's preferred language. | Low | New `preferredLocale` field on User entity (or UserPreferences JSONB). Backend: `PATCH /api/profile/preferences` with `{ locale: 'tr' }`. Frontend: `AuthStore` loads locale on init, passes to `TranslocoService.setActiveLang()`. |
| Date/number/currency formatting per locale | Turkish uses different date format (dd.MM.yyyy vs. MM/dd/yyyy), decimal separator (comma vs. period), currency symbol placement. Angular pipes (`DatePipe`, `CurrencyPipe`, `DecimalPipe`) support locale-aware formatting natively. | Medium | Angular's `LOCALE_ID` provider and `registerLocaleData()` for Turkish (`tr`). Import `@angular/common/locales/tr`. Existing pipes (`DatePipe`, `CurrencyPipe`) automatically respect active locale. Must ensure all dates/numbers use pipes, not manual formatting. |
| Fallback to English for missing translations | If a Turkish translation is missing, show English instead of a broken key like `nav.home`. Transloco supports fallback configuration. | Low | Transloco config: `fallbackLang: 'en'`, `missingHandler` logs warnings in dev mode. Ensures no broken UI even with incomplete translations. |
| Backend error messages in user locale | API validation errors and user-facing messages should return in the user's language. Backend needs locale awareness. | Medium | Accept-Language header from frontend (set by `authInterceptor`). Backend: resource files or dictionary lookup for error messages. FluentValidation messages can be localized. For v1.3, focus on frontend first; backend error localization can be a follow-up polish item. |
| RTL consideration: NOT needed | Turkish is LTR (left-to-right), same as English. No RTL layout changes needed for EN + TR. | N/A | If Arabic/Hebrew added later, RTL support would be needed. Not a concern for EN + TR. |

### Differentiators

Features that go beyond basic localization.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Scoped lazy loading of translation files | Instead of one giant JSON file per language, split translations by feature. The contacts page only loads contact translations. Reduces initial bundle size. | Low-Medium | Transloco scopes: `provideTranslocoScope('contacts')` in route providers. Translation files: `src/assets/i18n/contacts/en.json`, `src/assets/i18n/contacts/tr.json`. Loaded on-demand when route activates. |
| Admin configurable default locale for tenant | Tenant admin sets the default language for the organization. New users inherit this default. | Low | `defaultLocale` field on Organization entity. New user creation sets `preferredLocale = organization.defaultLocale`. UI: dropdown in organization settings. |
| Translation coverage report (dev tool) | Developer utility that compares `en.json` and `tr.json` to find missing keys. Helps maintain translation completeness. | Low | Build-time script comparing JSON key sets. Report missing keys. Can be a simple Node.js script in `scripts/`. Not a user-facing feature. |
| Locale-aware Unlayer editor | Email and quote template editors respect the active locale for their toolbar/UI. Unlayer supports locale configuration. | Low | Unlayer `options.locale` set to active language. Unlayer provides built-in translations for its UI chrome (toolbar labels, menu items) in many languages including Turkish. |
| Pluralization support | Turkish has different pluralization rules than English. Transloco supports ICU MessageFormat for plural handling. | Low-Medium | Transloco `@jsverse/transloco-messageformat` plugin. Handles `{count, plural, one {# item} other {# items}}` syntax per locale rules. Important for Turkish where pluralization differs (noun doesn't pluralize when preceded by a number). |

### Anti-Features

Features to explicitly NOT build for localization.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Build-time locale compilation (Angular built-in i18n) | Angular's built-in `@angular/localize` compiles separate application bundles per locale. Doubles build time, doubles deployment artifacts, no runtime switching. Overkill for 2 languages and conflicts with single SPA deployment model. | Use Transloco for runtime translation. Single build, single deployment, runtime language switching. |
| Machine translation integration | Auto-translate from English to Turkish via Google Translate API. Quality is poor for domain-specific CRM terminology. | Professional human translations for all strings. Machine translation creates more work fixing bad translations than it saves. |
| Per-field locale on CRM entities | Storing entity data (contact names, deal titles, company descriptions) in multiple languages. This is data-level i18n, completely different from UI i18n. | UI i18n only (labels, buttons, messages). CRM entity data stays in whatever language users enter it. |
| Translating dynamic content (feed posts, notes, comments) | User-generated content should not be auto-translated. It's personal expression. | Dynamic content displays as-is in the language it was written. Only system-generated labels and UI chrome are translated. |
| More than 2 languages in v1.3 | Each language requires complete translation of 500-1000+ keys. Adding 5 languages multiplies QA effort 5x. | English + Turkish only. Architecture supports adding more languages later by adding new JSON files and registering locales. |
| Translating email templates and PDF templates | Template content is user-designed. Translating the Unlayer editor content (the templates themselves) is user responsibility, not system responsibility. | System UI around the editor is translated (toolbar, buttons, labels). Template content (the email/document being designed) stays as user-entered. |

### Feature Dependencies

```
Transloco installation --> npm install @jsverse/transloco
Transloco provider --> provideTransloco() in app.config.ts
Root translation files --> assets/i18n/en.json, assets/i18n/tr.json
Translation pipe --> Every component template with hardcoded strings (HIGH effort, ALL components)
Language selector --> Navbar profile dropdown (existing)
User preference --> New preferredLocale field on User/UserPreferences
Auth interceptor --> Set Accept-Language header (existing interceptor, extend)
Angular locale data --> registerLocaleData(localeTr) in app bootstrapping
Date/number pipes --> Already used across app, need LOCALE_ID dynamic update
Scoped translations --> Per-feature i18n JSON files + Transloco scope providers
Backend messages --> FluentValidation localization (optional, can defer)
```

---

## Cross-Feature Dependencies

```
Integration Marketplace ----uses----> Settings Hub (new section entry)
Integration Marketplace ----uses----> SlideInPanelService (detail panel, existing from v1.2)
Integration Marketplace ----uses----> RBAC permission system (admin-only write access)

Kanban Boards ----uses----> CDK DragDrop (existing, proven in deal + activity Kanbans)
Kanban Boards ----uses----> EntityTypeRegistry (entity-linked card rendering)
Kanban Boards ----uses----> Preview Sidebar (click entity-linked card to preview entity)
Kanban Boards ----uses----> RichTextEditorComponent (card descriptions)
Kanban Boards ----uses----> User list endpoint (card assignee picker)

Quote PDF Templates ----uses----> Unlayer angular-email-editor (existing, change displayMode)
Quote PDF Templates ----uses----> MergeFieldService + MergeFieldPanelComponent (existing)
Quote PDF Templates ----uses----> Fluid template engine (existing in backend)
Quote PDF Templates ----uses----> QuotesController (modify PDF generation endpoint)
Quote PDF Templates ----replaces----> Fixed QuestPDF layout (keep as fallback)

Localization ----touches----> Every frontend component (translation pipe/directive)
Localization ----touches----> Navbar (language selector)
Localization ----touches----> AuthStore (locale preference loading)
Localization ----touches----> Auth interceptor (Accept-Language header)
Localization ----touches----> Angular date/number/currency pipes (LOCALE_ID)

ALL FEATURES ----need----> Localization strings from day one (if built in parallel)
```

---

## Complexity Assessment

| Feature Area | Frontend Complexity | Backend Complexity | Total Effort | Risk |
|--------------|--------------------|--------------------|--------------|------|
| Integration Marketplace | Medium (new settings page, card grid, credential dialog) | Medium (encrypted credential storage, integration catalog, health check) | Medium | Low -- infrastructure-only, no external API integration |
| Free-Form Kanban | High (full Kanban UI, card detail dialog, system board integration) | Medium (Board/Column/Card CRUD, visibility filtering, sort order management) | High | Medium -- CDK DragDrop patterns proven but new entity model is substantial |
| Quote PDF Templates | Medium (Unlayer document mode reuse, template list, preview) | High (HTML-to-PDF conversion, merge field expansion, line items rendering) | High | HIGH -- HTML-to-PDF conversion is the riskiest technical area. Unlayer document mode capabilities need verification. |
| Localization | High (every component needs translation keys) | Low-Medium (locale preference, Accept-Language, error messages) | High | Medium -- volume work, not complexity. Risk is in completeness (missing translations) and formatting (text expansion in Turkish) |

## MVP Recommendation

### Priority Order

1. **Localization Infrastructure** (build first, even minimally)
   - Install Transloco, set up provider, create root en.json/tr.json with common keys
   - Add language selector to navbar
   - This way, ALL subsequent features are built with translation keys from the start
   - Do NOT do full-app string extraction first -- just set up the infrastructure and translate new features as they're built. Full extraction of existing strings can be phased.

2. **Integration Marketplace** (smallest scope, lowest risk)
   - Settings page with integration catalog
   - Connect/disconnect with credential storage
   - Good "quick win" to show v1.3 progress

3. **Free-Form Kanban Boards** (medium scope, proven patterns)
   - Board CRUD + column management + card drag-and-drop
   - Entity-linked cards as the CRM differentiator
   - System board aggregation (deal + activity pipelines)

4. **Quote PDF Templates** (highest risk, depends on HTML-to-PDF solution)
   - Template editor with Unlayer document mode
   - Merge field integration
   - PDF generation pipeline (the risky part -- HTML-to-PDF library selection and integration)

### Defer to v1.4+

| Feature | Reason |
|---------|--------|
| Real third-party integrations (Mailchimp, Slack, QuickBooks) | Each integration is its own project. Infrastructure only for v1.3. |
| Card attachments on Kanban | File management per card is heavyweight. Use entity-linked cards for attachment access. |
| Board automations (when card moves, trigger action) | Build on top of existing workflow engine in future. |
| Conditional sections in PDF templates | Fluid supports it, but user-friendly conditional UI in Unlayer is complex. |
| Full backend error message localization | Frontend-first approach. Backend i18n is follow-up. |
| Full extraction of existing hardcoded strings | Extract and translate existing v1.0-v1.2 strings incrementally. New v1.3 features built translated from start. |
| E-signature on quote PDFs | Future integration marketplace item. |
| Template version history | Nice-to-have for team environments. Not MVP. |

---

## Sources

- [HubSpot App Marketplace](https://ecosystem.hubspot.com/marketplace) -- MEDIUM confidence (observed patterns)
- [Pipedrive Marketplace](https://www.pipedrive.com/en/marketplace) -- MEDIUM confidence (observed patterns)
- [Trello Feature Overview](https://trello.com/tour) -- HIGH confidence (well-established Kanban patterns)
- [Kan.bn -- Open Source Trello Alternative](https://kan.bn/) -- MEDIUM confidence
- [WeKan Open Source Kanban](https://wekan.fi/) -- MEDIUM confidence
- [Kanban Card Best Practices -- Wrike](https://www.wrike.com/kanban-guide/kanban-cards/) -- MEDIUM confidence
- [Kanban Board Components -- Kanban Tool](https://kanbantool.com/main-components-of-the-kanban-board) -- MEDIUM confidence
- [Unlayer Angular Email Editor -- npm](https://www.npmjs.com/package/angular-email-editor) -- MEDIUM confidence
- [Unlayer displayMode issue -- GitHub](https://github.com/unlayer/react-email-editor/issues/79) -- LOW confidence (limited details)
- [Unlayer Review -- Stripo](https://stripo.email/unlayer-review-pricing-features-alternatives/) -- LOW confidence (third-party review)
- [Transloco GitHub](https://github.com/jsverse/transloco) -- HIGH confidence (official repo)
- [Transloco Documentation](https://jsverse.gitbook.io/transloco) -- HIGH confidence (official docs)
- [Transloco Scope Configuration](https://jsverse.gitbook.io/transloco/advanced-features/lazy-load/scope-configuration) -- HIGH confidence
- [Angular i18n Guide](https://angular.dev/guide/i18n) -- HIGH confidence (official Angular docs)
- [Phrase: Best Angular i18n Libraries](https://phrase.com/blog/posts/best-libraries-for-angular-i18n/) -- MEDIUM confidence
- [Lokalise: Angular Transloco Guide](https://lokalise.com/blog/angular-localization-with-transloco/) -- MEDIUM confidence
- [SaaS API Authentication Best Practices -- ScaleKit](https://www.scalekit.com/blog/api-authentication-b2b-saas) -- MEDIUM confidence
- [Prismatic: SaaS Integration Auth Decisions](https://prismatic.io/blog/making-best-auth-decisions-saas-integrations/) -- MEDIUM confidence
- Existing codebase analysis: `deal-kanban.component.ts`, `activity-kanban.component.ts`, `email-template-editor.component.ts`, `merge-field-panel.component.ts`, `QuotePdfDocument.cs`, `settings-hub.component.ts`, `package.json` -- HIGH confidence
