# Architecture Patterns: v1.3 Platform & Polish

**Domain:** Integration marketplace, free-form Kanban boards, Unlayer document-mode PDF templates, localization (EN + TR)
**Researched:** 2026-02-20
**Confidence:** HIGH (codebase-verified integration points, MEDIUM for Unlayer document mode specifics)

## Executive Summary

The v1.3 "Platform & Polish" milestone adds four distinct capabilities that span different architectural layers. Unlike v1.2's frontend-heavy UX improvements, v1.3 introduces **new domain entities** (boards, integration configs, quote templates), a **cross-cutting concern** (localization), and **significant backend infrastructure** (integration marketplace OAuth flows, HTML-to-PDF rendering pipeline). Each feature has clear integration points with the existing architecture but minimal overlap with each other, making them parallelizable after a shared foundation phase.

The key architectural challenge is that these four features touch different layers of the stack:

- **Integration Marketplace** introduces a new backend subsystem (`Infrastructure/Integrations/`) with OAuth credential storage, third-party API adapters, a Hangfire sync queue, and a new settings UI section. It extends the existing webhook/domain-event pattern but adds bidirectional data flow.
- **Free-form Kanban Boards** is primarily a frontend feature that creates a new top-level entity (`Board`) with JSONB column/card storage. It reuses Angular CDK drag-drop patterns from existing Kanban views but replaces the entity-bound column model with user-defined columns.
- **Unlayer PDF Templates** extends the existing Unlayer email template editor (already integrated as `angular-email-editor`) by switching `displayMode` from `'email'` to `'document'`, creating a new `QuoteTemplate` entity, and replacing the hardcoded `QuotePdfDocument` with an HTML-to-PDF pipeline using PuppeteerSharp on the backend.
- **Localization** is a cross-cutting concern that touches every Angular component's template text. It uses `@ngx-translate/core` for runtime language switching (user's `Language` preference already exists on `ApplicationUser`), with JSON translation files for English and Turkish.

**Critical dependency:** Localization should be wired first as a foundation because it affects every component built in the other three features. Building features without i18n and then retrofitting translations is significantly more work than building with `translate` pipes from day one.

## Recommended Architecture

### System-Level View: v1.3 Components

```
EXISTING (unchanged)                    NEW (v1.3)
============================           ============================

Backend Layers:
  Domain/Entities/                     + Board, BoardColumn, BoardCard
  Domain/Entities/                     + IntegrationConfig, IntegrationSyncLog
  Domain/Entities/                     + QuoteTemplate
  Domain/Interfaces/                   + IBoardRepository, IIntegrationRepository
  Domain/Interfaces/                   + IQuoteTemplateRepository
  Infrastructure/Webhooks/             + Infrastructure/Integrations/
  Infrastructure/Pdf/QuotePdfDocument    Infrastructure/Pdf/HtmlToPdfService (NEW)
  Infrastructure/Pdf/                  + Infrastructure/Pdf/QuoteTemplateRenderer
  Infrastructure/EmailTemplates/         (reuse TemplateRenderService for merge fields)
  Api/Controllers/QuotesController     + Api/Controllers/BoardsController
  Api/Controllers/                     + Api/Controllers/IntegrationsController
  Api/Controllers/                     + Api/Controllers/QuoteTemplatesController

Frontend Layers:
  angular-email-editor (existing)        (reused with displayMode: 'document')
  features/email-templates/              (pattern cloned for quote-templates/)
  features/deals/deal-kanban/            (pattern reference for boards/)
  features/settings/                   + features/settings/integrations/
  features/                            + features/boards/
  features/                            + features/quote-templates/
  core/                                + core/i18n/ (TranslateModule config)
  shared/components/navbar/              (modified: language switcher)
  core/auth/auth.store.ts                (modified: expose user.language)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `IntegrationsController` | CRUD for integration configs, OAuth callback handler, manual sync trigger | `IntegrationRepository`, `IntegrationSyncService`, Hangfire |
| `IntegrationSyncService` | Bidirectional data sync with third-party APIs (Google Contacts, Outlook, etc.) | `ApplicationDbContext`, third-party HTTP clients |
| `IntegrationOAuthService` | OAuth 2.0 flow management, token storage/refresh | `IntegrationConfig` entity, external OAuth providers |
| `BoardsController` | CRUD for boards, columns, cards; drag-drop reorder | `BoardRepository`, `PermissionService` |
| `QuoteTemplatesController` | CRUD for Unlayer document templates, PDF preview generation | `QuoteTemplateRepository`, `QuoteTemplateRenderer`, `HtmlToPdfService` |
| `HtmlToPdfService` | Converts rendered HTML to PDF bytes using PuppeteerSharp | PuppeteerSharp (headless Chromium) |
| `QuoteTemplateRenderer` | Merges quote data into Unlayer HTML using Fluid templates | `TemplateRenderService` (existing), `MergeFieldService` (extended) |
| `TranslateModule` (FE) | Runtime i18n with lazy-loaded JSON translation files | `HttpClient` (loads JSON), `AuthStore` (user language) |
| `BoardFeature` (FE) | Board list, board detail with Kanban UI, card dialogs | `BoardService`, Angular CDK drag-drop |
| `IntegrationFeature` (FE) | Integration marketplace grid, config forms, OAuth redirect | `IntegrationService`, settings routes |
| `QuoteTemplateFeature` (FE) | Template list, Unlayer document editor, PDF preview | `QuoteTemplateService`, `angular-email-editor` |

### Data Flow

#### 1. Integration Marketplace

```
                       OAuth Flow
User clicks "Connect" ──────────────> External Provider (Google, etc.)
                                           |
                      OAuth callback  <────┘
                           |
                    IntegrationsController
                           |
                   IntegrationConfig entity
                   (encrypted tokens in JSONB)
                           |
           ┌───────────────┴───────────────┐
     Hangfire recurring job            Manual sync trigger
           |                                |
     IntegrationSyncService ───────────────>┘
           |
    ┌──────┴──────┐
    │ Pull data   │ Push data
    │ from 3rd    │ to 3rd party
    │ party API   │ (future)
    └──────┬──────┘
           |
    ApplicationDbContext
    (Contact/Company creates via domain events)
```

#### 2. Free-form Kanban Boards

```
Board Entity (JSONB structure)
┌─────────────────────────────┐
│ Board                       │
│  ├─ id, name, tenantId      │
│  ├─ ownerId                 │
│  └─ isShared                │
├─────────────────────────────┤
│ BoardColumn[]               │
│  ├─ id, title, color        │
│  ├─ sortOrder               │
│  └─ boardId (FK)            │
├─────────────────────────────┤
│ BoardCard[]                 │
│  ├─ id, title, description  │
│  ├─ columnId (FK)           │
│  ├─ sortOrder               │
│  ├─ color, dueDate          │
│  ├─ assigneeId              │
│  ├─ labels (JSONB)          │
│  └─ linkedEntityType/Id     │
└─────────────────────────────┘

Frontend CDK drag-drop:
- Column reorder: PATCH /api/boards/{id}/columns/reorder
- Card move:      PATCH /api/boards/{id}/cards/{cardId}/move
                  (body: { columnId, sortOrder })
```

#### 3. Quote PDF Templates (Unlayer Document Mode)

```
Unlayer Editor (displayMode: 'document')
           |
    exportHtml() callback
           |
    ┌──────┴──────┐
    │ designJson  │  htmlBody
    │ (for re-    │  (for PDF
    │  editing)   │   rendering)
    └──────┬──────┘
           |
    QuoteTemplate entity
    (same pattern as EmailTemplate)
           |
    POST /api/quote-templates/{id}/preview
           |
    QuoteTemplateRenderer
    (extends MergeFieldService with quote-specific merge fields)
           |
    TemplateRenderService (existing Fluid engine)
           |
    Rendered HTML with resolved merge fields
           |
    HtmlToPdfService (PuppeteerSharp)
           |
    PDF bytes → FileContentResult

Integration with existing QuotesController:
    GET /api/quotes/{id}/pdf?templateId={templateId}
    (Modified: if templateId provided, use template pipeline;
     if omitted, fall back to existing QuotePdfDocument)
```

#### 4. Localization

```
User Language Preference
(ApplicationUser.Language / Preferences.Language)
           |
    AuthStore.language signal (frontend)
           |
    TranslateService.use(lang) on login/preference change
           |
    HTTP GET /assets/i18n/{lang}.json
           |
    All components: {{ 'key' | translate }}
    or translate.instant('key')
           |
    Backend: Accept-Language header for
    error messages / email subjects (future)
```

## Detailed Component Architecture

### Feature 1: Integration Marketplace

**New backend components:**

| Layer | File | Purpose |
|-------|------|---------|
| Domain | `Entities/IntegrationConfig.cs` | Tenant-scoped entity: provider type, encrypted OAuth tokens, sync settings, status |
| Domain | `Entities/IntegrationSyncLog.cs` | Audit log per sync run: records synced, errors, duration |
| Domain | `Enums/IntegrationProvider.cs` | `GoogleContacts`, `OutlookContacts`, `Slack`, `Zapier` (initial set) |
| Domain | `Interfaces/IIntegrationRepository.cs` | CRUD + GetByProvider |
| Infrastructure | `Integrations/IntegrationRepository.cs` | EF Core implementation |
| Infrastructure | `Integrations/IntegrationOAuthService.cs` | OAuth 2.0 authorization code flow, token exchange, refresh |
| Infrastructure | `Integrations/IntegrationSyncService.cs` | Orchestrates pull/push sync per provider |
| Infrastructure | `Integrations/Providers/GoogleContactsAdapter.cs` | Google People API adapter |
| Infrastructure | `Integrations/IntegrationServiceExtensions.cs` | `AddIntegrationServices()` DI registration |
| Infrastructure | `Integrations/IntegrationEncryptionService.cs` | AES-256 encrypt/decrypt OAuth tokens at rest |
| Api | `Controllers/IntegrationsController.cs` | CRUD, OAuth initiate/callback, manual sync trigger |

**RBAC integration:** New permission entity `Integration` with `View`, `Create`, `Update`, `Delete` actions. Admin-only by default (integration config affects entire tenant). Add to `RoleTemplateSeeder`.

**Hangfire integration:** Add `"integrations"` queue to `HangfireServiceExtensions`. Register recurring sync jobs per active integration. Use existing `TenantJobFilter` for tenant context propagation.

**New frontend components:**

| Path | Component | Purpose |
|------|-----------|---------|
| `features/settings/integrations/` | `integration-marketplace.component.ts` | Grid of available integrations with connect/disconnect |
| `features/settings/integrations/` | `integration-config.component.ts` | Config form per integration (sync interval, field mapping) |
| `features/settings/integrations/` | `integration-sync-log.component.ts` | Sync history with status, records, errors |
| `features/settings/integrations/` | `integration.service.ts` | API service |
| `features/settings/integrations/` | `integration.models.ts` | TypeScript interfaces |

**Settings hub integration:** Add new card to the "Organization" section in `SettingsHubComponent.sections`.

**Settings routes integration:** Add routes under `settings.routes.ts` with `adminGuard`.

### Feature 2: Free-form Kanban Boards

**New backend components:**

| Layer | File | Purpose |
|-------|------|---------|
| Domain | `Entities/Board.cs` | Tenant-scoped board: name, description, ownerId, isShared |
| Domain | `Entities/BoardColumn.cs` | Column: title, color, sortOrder, boardId FK |
| Domain | `Entities/BoardCard.cs` | Card: title, description, color, dueDate, assigneeId, labels (JSONB), sortOrder, columnId FK, optional linkedEntityType/Id |
| Domain | `Interfaces/IBoardRepository.cs` | CRUD + GetWithColumnsAndCards |
| Infrastructure | `Boards/BoardRepository.cs` | EF Core implementation with eager loading |
| Infrastructure | `Boards/BoardServiceExtensions.cs` | `AddBoardServices()` DI registration |
| Api | `Controllers/BoardsController.cs` | Full CRUD + column/card reorder endpoints |

**Why separate entities vs JSONB:** Columns and cards are separate database tables (not JSONB) because:
1. Cards can be linked to CRM entities via `LinkedEntityType`/`LinkedEntityId` (FK integrity)
2. Cards can be assigned to users via `AssigneeId` (FK integrity)
3. Individual card CRUD without full board replacement
4. Future: card comments, attachments, history

**RBAC integration:** New permission entity `Board` with `View`, `Create`, `Update`, `Delete`. Scope-based: users see their own boards + shared boards. Board owners can manage columns/cards; other users with `Update` permission can move cards.

**Existing Kanban pattern reuse:** The deal/lead/activity Kanban components all follow the same CDK drag-drop pattern. The free-form board differs:
- Columns are user-defined (not pipeline stages or fixed statuses)
- No forward-only constraint
- Cards are generic (not entity-specific DTOs)
- Column reorder is supported (not supported in existing Kanbans)

**New frontend components:**

| Path | Component | Purpose |
|------|-----------|---------|
| `features/boards/board-list/` | `board-list.component.ts` | Grid/list of boards with create/edit/delete |
| `features/boards/board-detail/` | `board-detail.component.ts` | Kanban view with CDK drag-drop |
| `features/boards/board-detail/` | `card-dialog.component.ts` | Card create/edit dialog with fields |
| `features/boards/board-detail/` | `column-dialog.component.ts` | Column create/edit dialog |
| `features/boards/` | `board.service.ts` | API service |
| `features/boards/` | `board.store.ts` | Signal store for board state |
| `features/boards/` | `board.models.ts` | TypeScript interfaces |
| `features/boards/` | `boards.routes.ts` | Feature routes |

**Navbar integration:** Add "Boards" to the navbar CRM section with `view_kanban` icon.

**App routes integration:** Add lazy-loaded route with `permissionGuard('Board', 'View')`.

### Feature 3: Unlayer PDF Templates

**Key insight:** The existing `angular-email-editor` package already wraps Unlayer and is installed at version 15.2.0. Unlayer supports `displayMode: 'email' | 'web' | 'document'` in its options. Switching to `'document'` gives a page-oriented editor suitable for PDF documents (A4/Letter sizing, page breaks, no email-specific features like preheader).

**New backend components:**

| Layer | File | Purpose |
|-------|------|---------|
| Domain | `Entities/QuoteTemplate.cs` | Tenant-scoped template: name, designJson, htmlBody, isDefault, ownerId |
| Domain | `Interfaces/IQuoteTemplateRepository.cs` | CRUD + GetDefaultForTenant |
| Infrastructure | `Pdf/QuoteTemplateRepository.cs` | EF Core implementation |
| Infrastructure | `Pdf/QuoteTemplateRenderer.cs` | Combines Fluid merge fields with quote data for template rendering |
| Infrastructure | `Pdf/HtmlToPdfService.cs` | PuppeteerSharp-based HTML-to-PDF conversion |
| Infrastructure | `Pdf/PdfServiceExtensions.cs` | **Modified:** add HtmlToPdfService and QuoteTemplateRenderer registrations |
| Api | `Controllers/QuoteTemplatesController.cs` | CRUD + preview endpoint |
| Api | `Controllers/QuotesController.cs` | **Modified:** add `templateId` query param to PDF endpoint |

**MergeFieldService extension:** Add `quote` entity type to the existing `MergeFieldService.GetAvailableFieldsAsync()` with fields: `quote.number`, `quote.title`, `quote.status`, `quote.issue_date`, `quote.expiry_date`, `quote.subtotal`, `quote.discount_total`, `quote.tax_total`, `quote.grand_total`, `quote.notes`, `quote.contact.*`, `quote.company.*`, `quote.line_items[]` (array merge field for Fluid `{% for item in quote.line_items %}` loops).

**PuppeteerSharp integration:**
- Add `PuppeteerSharp` NuGet package to `GlobCRM.Infrastructure`
- `HtmlToPdfService` launches headless Chromium, sets HTML content, generates PDF
- Configuration: page size (A4/Letter), margins, landscape/portrait
- Browser instance management: singleton `BrowserLauncher` that reuses a single Chromium process
- First-use: auto-downloads Chromium binary via `BrowserFetcher` (configure path in `appsettings.json`)

**Backward compatibility:** The existing `QuotePdfDocument` (QuestPDF) remains as the default. When `GET /api/quotes/{id}/pdf` is called without `?templateId=`, the existing QuestPDF path runs. When `?templateId={guid}` is provided, the new template pipeline runs.

**New frontend components:**

| Path | Component | Purpose |
|------|-----------|---------|
| `features/quote-templates/` | `quote-template-list.component.ts` | List of templates with create/edit/delete |
| `features/quote-templates/` | `quote-template-editor.component.ts` | Unlayer editor with `displayMode: 'document'` |
| `features/quote-templates/` | `quote-template-preview.component.ts` | PDF preview dialog (iframe or embedded viewer) |
| `features/quote-templates/` | `quote-template.service.ts` | API service |
| `features/quote-templates/` | `quote-template.store.ts` | Signal store |
| `features/quote-templates/` | `quote-template.models.ts` | TypeScript interfaces |
| `features/quote-templates/` | `quote-templates.routes.ts` | Feature routes |
| `features/quotes/` | **Modified:** quote detail add template selector before PDF download | Template picker dropdown |

**Pattern clone from email templates:** The quote template editor follows the same architecture as `EmailTemplateEditorComponent`:
- Same `EmailEditorModule` import (it IS the Unlayer Angular wrapper regardless of mode)
- Same `exportHtml()` save pattern (designJson + htmlBody)
- Same merge tag builder (extended with quote fields)
- Different `editorOptions.displayMode`: `'document'` instead of `'email'`
- Additional document options: `pageSize`, `pageOrientation`, `pageMargins`

### Feature 4: Localization (EN + TR)

**Library choice: `@ngx-translate/core`** over Angular's built-in `@angular/localize` because:
1. Runtime language switching without app reload (user changes language in profile, immediate effect)
2. The app already uses standalone components; ngx-translate's `TranslateModule` is easy to add to imports
3. JSON translation files are simpler to manage than Angular's XLIFF format
4. The user's `Language` preference already exists on `ApplicationUser` (defaults to "en")

**Why not Transloco:** While Transloco is the newer alternative, ngx-translate has broader ecosystem support, simpler API for a project of this size, and the team already has `angular-email-editor` and other third-party integrations working. Transloco's plugin system adds complexity without proportional benefit for a 2-language implementation.

**New backend components:**

| Layer | File | Purpose |
|-------|------|---------|
| None | N/A | Backend remains English-only for v1.3. Error messages stay in English. |

Backend localization is deferred because: (1) API error messages are developer-facing and rarely shown verbatim to users, (2) the frontend already handles user-visible strings, (3) email template content is user-authored. Future: localize system email templates (verification, password reset) via Razor view localization.

**New frontend components:**

| Path | File | Purpose |
|------|------|---------|
| `core/i18n/` | `translate-config.ts` | `TranslateModule.forRoot()` with `HttpTranslateLoader` |
| `assets/i18n/` | `en.json` | English translation keys (source of truth) |
| `assets/i18n/` | `tr.json` | Turkish translations |
| `core/auth/` | **Modified:** `auth.store.ts` | Expose `language` signal, call `TranslateService.use()` on auth |
| `shared/components/navbar/` | **Modified:** `navbar.component.ts` | Add language switcher dropdown |
| `features/profile/` | **Modified:** profile settings | Language preference selector |

**Translation key structure:**

```json
{
  "nav": {
    "myDay": "My Day",
    "analytics": "Analytics",
    "companies": "Companies",
    "contacts": "Contacts"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading...",
    "noData": "No data available"
  },
  "contacts": {
    "title": "Contacts",
    "newContact": "New Contact",
    "firstName": "First Name",
    "lastName": "Last Name"
  }
}
```

**Component modification pattern:** Every component template that has hardcoded English text needs updating:
- `<h1>Contacts</h1>` becomes `<h1>{{ 'contacts.title' | translate }}</h1>`
- `placeholder="Search..."` becomes `[placeholder]="'common.search' | translate"`
- Material button text: `New Deal` becomes `{{ 'deals.newDeal' | translate }}`
- Snackbar messages: `this.snackBar.open('Failed to load')` becomes `this.snackBar.open(this.translate.instant('errors.loadFailed'))`

**Scope of modification:** Every existing component template (~80+ components across 25 feature areas) needs translation key replacement. This is the highest-volume change in v1.3 but low complexity per component.

## Patterns to Follow

### Pattern 1: Feature Module Registration (Backend)

**What:** Each new feature follows the `Add{Feature}Services()` extension method pattern.
**When:** Every new backend feature.
**Example:**
```csharp
// Infrastructure/Integrations/IntegrationServiceExtensions.cs
public static class IntegrationServiceExtensions
{
    public static IServiceCollection AddIntegrationServices(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IIntegrationRepository, IntegrationRepository>();
        services.AddScoped<IntegrationOAuthService>();
        services.AddScoped<IntegrationSyncService>();
        services.AddScoped<IntegrationEncryptionService>();

        // Named HttpClient for third-party API calls
        services.AddHttpClient("IntegrationApi", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(60);
        });

        return services;
    }
}
```
Then in `Program.cs`:
```csharp
builder.Services.AddIntegrationServices(builder.Configuration);
```

### Pattern 2: Lazy-Loaded Feature Routes (Frontend)

**What:** Every new feature area follows the lazy-loaded route pattern.
**When:** Boards, Quote Templates, Integration settings.
**Example:**
```typescript
// app.routes.ts (add to routes array)
{
  path: 'boards',
  canActivate: [authGuard, permissionGuard('Board', 'View')],
  loadChildren: () =>
    import('./features/boards/boards.routes').then(m => m.BOARD_ROUTES),
},
```

### Pattern 3: Controller + DTOs Co-location

**What:** DTOs, request records, validators are co-located in the same controller file.
**When:** Every new controller.
**Example:** Follow the exact pattern of `QuotesController.cs` -- entity DTOs with static `FromEntity()` factory methods, FluentValidation validators, request records all in one file.

### Pattern 4: Signal Store Per Feature

**What:** Per-page signal stores listed in component `providers: []`, root stores for cross-cutting state.
**When:** Board detail gets per-page store; i18n language state goes in AuthStore (root).
**Example:**
```typescript
// board.store.ts
export const BoardStore = signalStore(
  { providedIn: undefined }, // per-page, not root
  withState({ board: null, loading: false }),
  // ... withMethods, withComputed
);

// board-detail.component.ts
@Component({
  providers: [BoardStore],
  // ...
})
```

### Pattern 5: Unlayer Editor Reuse

**What:** Reuse the same `angular-email-editor` package for both email and document modes.
**When:** Quote template editor.
**Example:**
```typescript
readonly editorOptions = computed(() => ({
  displayMode: 'document' as const, // KEY DIFFERENCE from email templates
  features: {
    textEditor: { spellChecker: true },
  },
  appearance: { theme: 'light' },
  // Document-specific options
  document: {
    page: {
      width: '210mm',  // A4
      height: '297mm',
    },
  },
  mergeTags: this.buildMergeTags(this.store.mergeFields()),
}));
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Shared JSONB Columns for Board State

**What:** Storing all columns and cards as a single JSONB blob on the Board entity.
**Why bad:** Prevents individual card CRUD, breaks FK integrity for linked entities and assignees, makes concurrent edits destructive (last-write-wins on entire board), prevents efficient queries like "find all cards assigned to me across boards."
**Instead:** Use separate `BoardColumn` and `BoardCard` tables with proper FKs. JSONB is only for card-level metadata (labels, custom attributes).

### Anti-Pattern 2: Storing OAuth Tokens in Plaintext

**What:** Saving integration OAuth access/refresh tokens as plain strings in the database.
**Why bad:** Database breach exposes all connected third-party accounts. Tokens grant access to customer data in external systems.
**Instead:** Use `IntegrationEncryptionService` with AES-256-GCM encryption. Store encrypted blob + nonce. Encryption key in `appsettings.json` secrets (or Azure Key Vault in production).

### Anti-Pattern 3: Loading Chromium Per PDF Request

**What:** Launching a new Chromium browser instance for every PDF generation request.
**Why bad:** Chromium startup takes 2-5 seconds per launch; memory leaks from abandoned processes; concurrent requests exhaust system resources.
**Instead:** Use a singleton `BrowserLauncher` service that maintains a warm browser instance. Create new pages (tabs) per request, dispose pages after rendering. Configure max concurrent pages.

### Anti-Pattern 4: Hardcoding Translation Strings

**What:** Using `translate.instant()` with string literals scattered throughout component code instead of constants.
**Why bad:** No compile-time verification of key existence, hard to find missing translations, easy to introduce typos.
**Instead:** Define translation key constants per feature module and reference them. The JSON files are the source of truth; the constants file mirrors the structure for IDE autocomplete.

### Anti-Pattern 5: Retroactive i18n

**What:** Building all v1.3 features with hardcoded English strings, then doing a translation pass at the end.
**Why bad:** Double work (write strings, then replace them); easy to miss strings in snackbars, tooltips, and dynamic text; template structure changes during replacement introduce bugs.
**Instead:** Wire up `TranslateModule` first, then build all new features with `{{ 'key' | translate }}` from the start.

## Integration Points: New vs Modified Components

### New Components (create from scratch)

| Layer | Component | Notes |
|-------|-----------|-------|
| Backend | `Board`, `BoardColumn`, `BoardCard` entities | New domain entities with TenantId |
| Backend | `IntegrationConfig`, `IntegrationSyncLog` entities | New domain entities with TenantId |
| Backend | `QuoteTemplate` entity | Pattern: clone `EmailTemplate` entity structure |
| Backend | `BoardsController` | Full CRUD + reorder endpoints |
| Backend | `IntegrationsController` | CRUD + OAuth flow + sync trigger |
| Backend | `QuoteTemplatesController` | Pattern: clone `EmailTemplatesController` |
| Backend | `HtmlToPdfService` | PuppeteerSharp wrapper |
| Backend | `QuoteTemplateRenderer` | Fluid template merge for quote data |
| Backend | `IntegrationOAuthService` | OAuth 2.0 code flow |
| Backend | `IntegrationSyncService` | Provider-specific sync adapters |
| Backend | `IntegrationEncryptionService` | AES-256 token encryption |
| Frontend | `features/boards/*` | Entire new feature area (7+ components) |
| Frontend | `features/quote-templates/*` | Entire new feature area (6+ components) |
| Frontend | `features/settings/integrations/*` | Settings sub-feature (4+ components) |
| Frontend | `core/i18n/translate-config.ts` | TranslateModule configuration |
| Frontend | `assets/i18n/en.json`, `tr.json` | Translation files |

### Modified Components (touch existing code)

| Layer | Component | Modification |
|-------|-----------|-------------|
| Backend | `Program.cs` | Add `AddIntegrationServices()`, `AddBoardServices()`, `AddQuoteTemplateServices()` |
| Backend | `PdfServiceExtensions.cs` | Register `HtmlToPdfService`, `QuoteTemplateRenderer` |
| Backend | `MergeFieldService.cs` | Add `quote` entity type to merge field definitions |
| Backend | `QuotesController.cs` | Add `templateId` query param to `GeneratePdf` endpoint |
| Backend | `HangfireServiceExtensions.cs` | Add `"integrations"` queue |
| Backend | `appsettings.json` | Add integration OAuth client IDs, Chromium path |
| Backend | EF Core migrations | New tables for Board*, IntegrationConfig, QuoteTemplate |
| Backend | `RoleTemplateSeeder` | Add `Board`, `Integration`, `QuoteTemplate` permission entities |
| Backend | `scripts/rls-setup.sql` | Add RLS policies for new tenant-scoped tables |
| Frontend | `app.routes.ts` | Add `boards` and `quote-templates` lazy routes |
| Frontend | `settings.routes.ts` | Add integration settings routes |
| Frontend | `settings-hub.component.ts` | Add "Integrations" card to Organization section |
| Frontend | `navbar.component.ts` | Add "Boards" nav item, add language switcher |
| Frontend | `auth.store.ts` | Expose `language` signal, init TranslateService |
| Frontend | `app.component.ts` | Import `TranslateModule`, init default language |
| Frontend | `package.json` | Add `@ngx-translate/core`, `@ngx-translate/http-loader`, `puppeteer` dev dep |
| Frontend | `environment.ts` / `environment.development.ts` | Add `defaultLang: 'en'` |
| Frontend | **All ~80+ component templates** | Replace hardcoded strings with translate pipe |
| Frontend | Quote detail component | Add template selector for PDF download |

## Suggested Build Order (Dependency-Driven)

### Phase 1: Localization Foundation
**Rationale:** Cross-cutting concern that affects all other features. Must be first so features 2-4 build with i18n from day one.
1. Install `@ngx-translate/core` + `@ngx-translate/http-loader`
2. Create `core/i18n/translate-config.ts`
3. Wire into `app.component.ts` and `app.config.ts`
4. Create `en.json` skeleton with all existing component strings
5. Create `tr.json` with Turkish translations
6. Add language switcher to navbar
7. Migrate existing components to use translate pipe (can be parallelized by feature area)

### Phase 2: Free-form Kanban Boards
**Rationale:** Self-contained feature with no external dependencies. Backend entities, controller, frontend feature -- all new code with clear patterns to follow from deal Kanban.

### Phase 3: Unlayer PDF Templates
**Rationale:** Depends on understanding the Unlayer editor integration (already validated via email templates). Extends existing PDF and merge field infrastructure. PuppeteerSharp is the only new backend dependency.

### Phase 4: Integration Marketplace
**Rationale:** Most complex feature with OAuth flows, encrypted credential storage, background sync jobs, and third-party API adapters. Benefits from having the other features stable so debugging focuses on integration-specific issues.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Board cards per board | In-memory fine (< 500 cards) | Paginate cards per column (50 per page) | Archive columns, virtual scroll |
| PDF generation | On-demand, single Chromium instance | Queue via Hangfire, pool of 4 Chromium instances | Dedicated PDF worker service, pre-render cache |
| Integration sync | Per-tenant cron jobs | Rate-limit per provider, stagger schedules | Separate integration worker service, event-driven sync |
| Translation files | Single JSON loaded at startup (~50KB) | Same (cached in memory) | CDN for translation files, lazy per-feature loading |
| OAuth tokens | AES-256 in DB, fine for 100 | Same, add token rotation | Move to dedicated secrets manager (Vault/KMS) |

## Sources

- Codebase analysis: `QuotesController.cs`, `EmailTemplatesController.cs`, `EmailTemplateEditorComponent`, `DealKanbanComponent`, `LeadKanbanComponent`, `ActivityKanbanComponent`, `SignalRService`, `MergeFieldService`, `TemplateRenderService`, `QuotePdfDocument`, `WebhookServiceExtensions`, `HangfireServiceExtensions`, `ApplicationUser` entity, `UserPreferencesData` entity
- [ngx-translate GitHub](https://github.com/ngx-translate/core) - Angular i18n library (MEDIUM confidence - training data verified by search results)
- [angular-email-editor npm](https://www.npmjs.com/package/angular-email-editor) - Unlayer Angular wrapper, v15.2.0 installed (HIGH confidence - verified in package.json)
- [PuppeteerSharp](https://pdfbolt.com/blog/top-csharp-pdf-generation-libraries) - .NET HTML-to-PDF via headless Chromium (MEDIUM confidence - WebSearch)
- Unlayer displayMode options: `'email'`, `'web'`, `'document'` (LOW confidence - from GitHub issues and training data, not verified against official docs)
