# Technology Stack: GlobCRM v1.3 Platform & Polish

**Project:** GlobCRM v1.3 -- Integration Marketplace, Free-Form Kanban, Quote PDF Templates (Unlayer), Localization (EN+TR)
**Researched:** 2026-02-20
**Scope:** Stack ADDITIONS/CHANGES for v1.3 features only. Core stack (Angular 19, .NET 10, PostgreSQL 17) and all v1.0-v1.2 additions are validated and unchanged.

---

## Executive Summary

v1.3 adds four distinct capabilities. Unlike v1.2 (which required zero new packages), v1.3 requires **2 new frontend packages and 1 new backend package**, plus strategic reuse of existing infrastructure:

1. **Integration Marketplace** -- No new libraries. Pure UI feature using existing Angular Material card grid, existing `@angular/cdk` drag-drop for category filtering, existing API patterns. Backend stores integration configs in PostgreSQL JSONB.

2. **Free-Form Kanban Boards** -- No new libraries. Reuse existing `@angular/cdk/drag-drop` (`CdkDrag`, `CdkDropList`, `transferArrayItem`, `moveItemInArray`) already proven in deal, lead, and activity kanban boards. New entities (Board, List, Card) with JSONB for card metadata.

3. **Quote PDF Templates via Unlayer** -- The existing `angular-email-editor` (Unlayer wrapper) v15.2.0 already works in the project despite being built for Angular 15. For quote templates, switch Unlayer's `displayMode` from `'email'` to `'web'` to unlock full-width, non-email-constrained layout suitable for document/PDF templates. On the backend, add **`Microsoft.Playwright`** (v1.58.0) to convert the Unlayer-exported HTML into PDF, replacing the current hardcoded `QuotePdfDocument` (QuestPDF) with a template-driven approach. Reuse existing **Fluid** (Liquid) template engine for merge field resolution in the HTML before PDF conversion.

4. **Localization** -- Add **`@jsverse/transloco`** (v8.2.1) for runtime i18n with Signal API support, lazy-loaded JSON translation files, and a `TranslocoPipe` / `TranslocoDirective` for templates. Add **`@jsverse/transloco-locale`** for date/number/currency formatting per locale. Backend uses .NET's built-in `IStringLocalizer` with RESX files (no new NuGet package needed).

---

## Recommended Stack Additions

### Frontend -- New Packages (2)

| Technology | Version | Purpose | Why This |
|---|---|---|---|
| `@jsverse/transloco` | ^8.2.1 | Runtime i18n: translation pipe/directive, JSON translation files, lazy loading per route, Signal API (`translateSignal`) | Best Angular i18n library for runtime language switching. Standalone-first design. Signal API aligns with project's signal-based architecture. Successor to ngx-translate with better DX, lazy loading, and active maintenance under @jsverse scope. |
| `@jsverse/transloco-locale` | ^8.2.1 | Locale-aware formatting: `translocoDate`, `translocoCurrency`, `translocoDecimal`, `translocoPercent` pipes | Companion to Transloco for locale-specific number/date/currency formatting. Uses native `Intl` APIs. Needed because Turkish formatting differs significantly (e.g., `1.234,56` vs `1,234.56`, date formats). |

### Backend -- New Packages (1)

| Technology | Version | Purpose | Why This |
|---|---|---|---|
| `Microsoft.Playwright` | ^1.58.0 | HTML-to-PDF conversion for Unlayer-designed quote templates | Official Microsoft port of Playwright. Renders Unlayer's exported HTML (which uses modern CSS, flexbox, media queries) with pixel-perfect Chrome rendering, then exports to PDF via `Page.PdfAsync()`. Better than PuppeteerSharp (abandoned PlaywrightSharp namespace confusion), DinkToPdf (dead/crashes), or IronPDF (paid). QuestPDF stays for any non-template PDF needs. |

### Dev Dependencies (0)

No new dev dependencies required.

---

## What We Already Have (DO NOT Add)

These existing packages fully cover v1.3 feature needs:

| Existing Package | v1.3 Usage | Confidence |
|---|---|---|
| **`@angular/cdk/drag-drop`** (^19.2.19) | Free-form Kanban: `CdkDropList` for card lists, `CdkDrag` for cards, `CdkDropListGroup` for inter-list transfers. Already proven in `deal-kanban.component.ts`, `lead-kanban.component.ts`, `activity-kanban.component.ts`. Same directives, same patterns. | HIGH |
| **`@angular/material`** (^19.2.19) | Integration marketplace: `MatCard` for integration tiles, `MatChip` for category filters, `MatSlideToggle` for connect/disconnect. Kanban boards: `MatCard` for board cards, `MatMenu` for card actions, `MatDialog` for card detail. | HIGH |
| **`angular-email-editor`** (^15.2.0) | Quote PDF template builder: Same Unlayer component, but with `displayMode: 'web'` instead of `'email'`. The `[options]` input accepts any Unlayer config. Already working in `email-template-editor.component.ts`. | HIGH |
| **`@ngrx/signals`** (^19.2.1) | Signal stores for: `BoardStore` (kanban), `IntegrationStore` (marketplace), `QuoteTemplateStore` (PDF templates). Same patterns as existing stores. | HIGH |
| **Fluid.Core** (2.12.0, backend) | Merge field resolution in quote templates. The existing `TemplateRenderService` already parses Liquid templates and resolves merge data. Reuse directly for quote PDF templates: render `{{ quote.number }}`, `{{ contact.full_name }}`, etc. | HIGH |
| **QuestPDF** (2026.2.0, backend) | Stays as fallback PDF generator. The current `QuotePdfDocument` continues to work for quotes without custom templates. Template-based PDFs use Playwright instead. | HIGH |
| **Hangfire** (1.8.18, backend) | Background PDF generation for bulk operations (e.g., "export all quotes as PDF"). PDF rendering is CPU-intensive; offload to Hangfire job. | HIGH |
| **SignalR** (^10.0.0) | Real-time Kanban updates: broadcast card moves across connected users viewing the same board. Same pattern as existing deal stage change broadcasts. | HIGH |
| **`@angular/cdk` Overlay** (^19.2.19) | Kanban card quick-edit popover (reuse existing overlay patterns from entity preview sidebar). | HIGH |

---

## Feature-by-Feature Stack Mapping

### 1. Integration Marketplace

**Frontend: Zero new packages.**

| Aspect | Technology | Notes |
|---|---|---|
| Card grid layout | CSS Grid + `MatCard` | Responsive grid of integration tiles with logo, name, description, status badge |
| Category filtering | `MatChipListbox` | Horizontal chip bar for category selection (CRM, Email, Storage, etc.) |
| Search | `MatFormField` + `MatInput` | Client-side filter over integration list |
| Connect/Disconnect | `MatSlideToggle` or `MatButton` | Calls API to toggle integration status |
| Config dialog | `MatDialog` | Per-integration settings (API keys, OAuth redirect, etc.) |
| State | `@ngrx/signals` `IntegrationStore` | List of integrations, filtered list, connection status |

**Backend: Zero new packages.**

| Aspect | Technology | Notes |
|---|---|---|
| Integration registry | PostgreSQL table + JSONB `Config` column | Each integration row: id, name, category, provider, configSchema (JSONB), isEnabled |
| Tenant integration config | PostgreSQL table + JSONB `Settings` column | Per-tenant integration settings (API keys, tokens, enabled status) |
| OAuth flows | Existing `HttpClient` | For integrations that need OAuth (redirect to provider, exchange code for token) |
| Webhook receiver | Existing webhook infrastructure | Inbound webhooks from connected integrations reuse v1.1 webhook system |

### 2. Free-Form Kanban Boards

**Frontend: Zero new packages.**

The existing CDK drag-drop usage in `deal-kanban.component.ts` is the exact pattern needed. The key difference: deal kanban is pipeline-bound (stages are fixed by pipeline config). Free-form kanban boards let users create arbitrary lists and cards.

| Aspect | Technology | Notes |
|---|---|---|
| Board layout | `CdkDropListGroup` + horizontal flex | Board container with horizontally scrollable lists |
| List columns | `CdkDropList` (vertical) | Each list is a vertical drop zone for cards |
| Card drag | `CdkDrag` | Cards draggable between lists and within lists |
| Card reorder | `moveItemInArray` | Within-list reorder (same as deal kanban) |
| Card transfer | `transferArrayItem` | Cross-list move (same as deal kanban) |
| Card detail | `MatDialog` or CDK Overlay | Click card to open detail panel with description, entity links, labels, due date |
| Entity linking | Existing entity picker pattern | Link cards to CRM entities (contacts, deals, companies) using existing picker components |
| Board visibility | `MatSelect` (Private/Team/Public) | Board-level visibility control |
| Add list | Inline `MatFormField` | "+ Add List" button at end of board |
| Add card | Inline `MatFormField` | "+ Add Card" button at bottom of each list |
| Labels/colors | `MatChip` with colored backgrounds | Card labels for categorization |

**Backend: Zero new packages.**

| Aspect | Entity | Key Fields |
|---|---|---|
| Board | `Board` entity | Id, Name, Description, Visibility (enum), OwnerId, TenantId, CreatedAt |
| List | `BoardList` entity | Id, BoardId (FK), Name, SortOrder, Color, CreatedAt |
| Card | `BoardCard` entity | Id, ListId (FK), Title, Description, SortOrder, DueDate, Labels (JSONB), AssigneeId, CreatedAt |
| Entity link | `BoardCardEntity` entity | Id, CardId (FK), EntityType (enum), EntityId (Guid) |

PostgreSQL handles all of this with existing EF Core patterns. Card labels stored as JSONB array. SortOrder for drag-drop persistence.

### 3. Quote PDF Templates (Unlayer Document Mode)

**Frontend: Zero new packages (reuse existing `angular-email-editor`).**

The existing Unlayer integration at `email-template-editor.component.ts` already demonstrates the full pattern: load design JSON, export HTML, save design + HTML. For quote PDF templates, create a parallel `QuoteTemplateEditorComponent` that:

1. Uses the same `<email-editor>` component (despite the name, it wraps the full Unlayer editor)
2. Sets `displayMode: 'web'` instead of `'email'` -- this removes email-specific constraints (600px max width, email-safe CSS) and enables full-width page layout suitable for A4/Letter documents
3. Configures quote-specific merge tags (quote number, line items table, totals, company info)
4. Saves design JSON + rendered HTML to a `QuoteTemplate` entity

| Aspect | Technology | Notes |
|---|---|---|
| Template editor | `angular-email-editor` (Unlayer) | `displayMode: 'web'` for document-width layouts. Same `[options]`, `(ready)`, `exportHtml()`, `loadDesign()` API. |
| Merge tags | Unlayer `mergeTags` config | Configure quote-specific tags: `{{ quote.number }}`, `{{ quote.title }}`, `{{ contact.full_name }}`, `{{ line_items_table }}` |
| Template storage | Backend API | Save `designJson` (for re-editing) + `htmlBody` (for rendering) -- same pattern as email templates |
| Preview | `MatDialog` with iframe | Render merged HTML in an iframe for visual preview |

**Backend: 1 new package (`Microsoft.Playwright`).**

The PDF generation pipeline for template-based quotes:

```
1. Load QuoteTemplate.HtmlBody (Unlayer-exported HTML)
2. Resolve merge fields via existing TemplateRenderService (Fluid/Liquid)
3. Render merged HTML to PDF via Playwright (headless Chromium)
4. Return PDF bytes
```

| Aspect | Technology | Notes |
|---|---|---|
| Merge field resolution | Fluid.Core (existing) | `TemplateRenderService.RenderAsync(htmlTemplate, mergeData)` -- already built and working for email templates |
| HTML-to-PDF | Microsoft.Playwright | `Page.SetContentAsync(mergedHtml)` then `Page.PdfAsync(new PdfOptions { Format = "A4" })` |
| Browser lifecycle | Singleton `IPlaywrightPdfService` | Create browser instance once at startup, reuse across requests. Pool pages for concurrency. |
| Fallback | QuestPDF (existing) | Quotes without a custom template use the existing `QuotePdfDocument` hardcoded layout |
| Background generation | Hangfire (existing) | Optional: generate PDFs in background for bulk export |

**Why Playwright over alternatives for HTML-to-PDF:**

| Option | Verdict | Reason |
|---|---|---|
| **Microsoft.Playwright** | RECOMMENDED | Official Microsoft package. Best CSS/HTML rendering (real Chrome). Active development. .NET-native API. Supports PDF options (margins, format, headers/footers). |
| PuppeteerSharp | Acceptable alternative | Same Chrome-based approach. v21.1.1 on NuGet. Slightly less .NET-idiomatic than Playwright. |
| QuestPDF | NOT suitable for templates | QuestPDF builds PDFs programmatically (C# fluent API), not from HTML. Cannot render Unlayer's HTML output. Stays for non-template quotes. |
| DinkToPdf | AVOID | Based on abandoned wkhtmltopdf. Crashes under load. No modern CSS support. Officially dead. |
| IronPDF | AVOID | Commercial license required ($749+). Unnecessary cost when Playwright is free and equally capable. |

**Line Items Table Challenge:**

Unlayer's drag-and-drop editor does not natively support dynamic repeating rows (like a quote's line items). Two approaches:

- **Approach A (Recommended): Fluid-rendered HTML table.** Define a merge tag `{{ line_items_table }}` that the backend's `TemplateRenderService` resolves to a pre-rendered HTML `<table>` with all line items. The Unlayer template includes a placeholder text block with `{{ line_items_table }}`. Fluid replaces it with the full table HTML.
- **Approach B: Custom Unlayer tool.** Register a custom "Line Items" tool in Unlayer that renders as a placeholder in the editor and gets replaced server-side. More complex, requires Unlayer custom tool API.

Approach A is simpler and leverages the existing Fluid infrastructure. The rendered table inherits CSS styles from the Unlayer-designed template.

### 4. Localization (English + Turkish)

**Frontend: 2 new packages.**

| Aspect | Technology | Notes |
|---|---|---|
| Translation library | `@jsverse/transloco` ^8.2.1 | Runtime i18n with lazy-loaded JSON files. `TranslocoDirective` for templates, `TranslocoPipe` for inline, `translateSignal()` for TypeScript. |
| Locale formatting | `@jsverse/transloco-locale` ^8.2.1 | Pipes for locale-aware date/number/currency: `translocoDate`, `translocoCurrency`, `translocoDecimal`. Turkish uses `,` for decimal, `.` for thousands. |
| Language switcher | `MatSelect` or `MatButtonToggle` | In navbar or settings page. Stores preference in `localStorage` + user profile API. |
| Translation files | JSON files in `assets/i18n/` | `en.json`, `tr.json`. Lazy-loaded per feature module for smaller bundles. |

**Why Transloco over alternatives:**

| Option | Verdict | Reason |
|---|---|---|
| **@jsverse/transloco** | RECOMMENDED | Signal API (`translateSignal`), standalone-first, lazy loading built-in, active maintenance. Best DX for modern Angular. |
| @angular/localize (built-in) | NOT suitable | Compile-time i18n: requires separate builds per language, no runtime switching. Users cannot toggle EN/TR without page reload. |
| ngx-translate | Acceptable but dated | Works but is the predecessor to Transloco. Less maintained, no Signal API, lazy loading requires manual config. |

**Transloco setup for standalone Angular:**

```typescript
// app.config.ts
import { provideTransloco, TranslocoHttpLoader } from '@jsverse/transloco';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing providers
    provideTransloco({
      config: {
        availableLangs: ['en', 'tr'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
```

**Translation file structure (feature-scoped lazy loading):**

```
assets/i18n/
  en.json          # Shared/global translations
  tr.json
  contacts/
    en.json        # Contact feature translations
    tr.json
  deals/
    en.json
    tr.json
  ... per feature
```

**Backend: Zero new packages (use built-in .NET localization).**

.NET 10 includes `Microsoft.Extensions.Localization` in the framework. No additional NuGet package needed.

| Aspect | Technology | Notes |
|---|---|---|
| String localization | `IStringLocalizer<T>` | Built into .NET. Register with `builder.Services.AddLocalization()`. |
| Resource files | `.resx` files | `Resources/Controllers/QuotesController.en.resx`, `Resources/Controllers/QuotesController.tr.resx` |
| Request culture | `UseRequestLocalization` middleware | Reads `Accept-Language` header or `culture` query param. Frontend sends preferred locale. |
| Validation messages | FluentValidation + `IStringLocalizer` | Inject localizer into validators for localized error messages. |
| Email templates | Fluid + locale-aware formatting | Format dates/numbers in merge fields using `CultureInfo` from request. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| i18n library | `@jsverse/transloco` | `@angular/localize` | No runtime language switching. Requires separate builds per locale. |
| i18n library | `@jsverse/transloco` | `ngx-translate` | Less maintained, no Signal API, predecessor to Transloco. |
| HTML-to-PDF | `Microsoft.Playwright` | `PuppeteerSharp` | Both work, but Playwright is Microsoft-maintained, more actively developed, better .NET integration. |
| HTML-to-PDF | `Microsoft.Playwright` | `DinkToPdf` | Dead project based on abandoned wkhtmltopdf. Crashes, no modern CSS. |
| HTML-to-PDF | `Microsoft.Playwright` | `IronPDF` | Commercial license ($749+). Unnecessary cost. |
| Kanban drag-drop | `@angular/cdk/drag-drop` (existing) | Third-party Kanban lib (e.g., Syncfusion) | Already have CDK drag-drop working in 3 kanban views. Adding a commercial component library is unnecessary. |
| Kanban drag-drop | `@angular/cdk/drag-drop` (existing) | `ngx-sortablejs` / SortableJS | Extra dependency for functionality already provided by CDK. |
| Quote template editor | Unlayer (`angular-email-editor`, existing) | GrapeJS | Would require new integration, new learning curve. Unlayer already integrated and working. |
| Quote template editor | Unlayer (`displayMode: 'web'`) | Build custom template editor | Massive effort. Unlayer provides drag-and-drop layout design for free (open-source wrapper). |
| Locale formatting | `@jsverse/transloco-locale` | Angular's built-in `DatePipe`, `CurrencyPipe` with locale | Angular's built-in pipes change formatting only when the app locale changes at bootstrap. Transloco-locale dynamically reacts to language switches. |

---

## Integration Points with Existing Stack

### Unlayer: Email Templates vs Quote Templates

The project already has a complete Unlayer integration for email templates. Quote templates reuse this with config changes:

| Aspect | Email Templates (Existing) | Quote Templates (New) |
|---|---|---|
| Component | `EmailTemplateEditorComponent` | `QuoteTemplateEditorComponent` (new) |
| `displayMode` | `'email'` | `'web'` |
| Merge tags | Contact, Company, Deal, Lead fields | Quote, Contact, Company fields + `line_items_table` |
| Export | HTML for email sending | HTML for Playwright PDF conversion |
| Backend entity | `EmailTemplate` | `QuoteTemplate` (new entity) |
| Rendering | `TemplateRenderService` (Fluid) | Same `TemplateRenderService` (Fluid) |
| Output | Rendered HTML email | Rendered HTML -> Playwright -> PDF bytes |

### CDK Drag-Drop: Deal Kanban vs Free-Form Kanban

| Aspect | Deal Kanban (Existing) | Free-Form Kanban (New) |
|---|---|---|
| Component | `DealKanbanComponent` | `BoardViewComponent` (new) |
| Columns | Pipeline stages (fixed by config) | User-created lists (fully custom) |
| Cards | Deal entities | Custom cards (with optional entity links) |
| Drop rules | Forward-only (stage order enforcement) | Any direction (no restrictions) |
| Card data | Deal fields (value, close date, owner) | Title, description, labels, due date, assignee |
| API on drop | `dealService.updateStage()` | `boardService.moveCard(cardId, targetListId, newSortOrder)` |

### Localization: Incremental Adoption

Transloco supports incremental adoption. You do NOT need to translate the entire app at once:

1. **Phase 1:** Install Transloco, configure with EN as default. All existing hardcoded strings continue working (they just are not translated yet).
2. **Phase 2:** Extract strings for shared components (navbar, sidebar, common buttons) into `en.json` / `tr.json`.
3. **Phase 3:** Extract strings per feature (contacts, deals, etc.) into scoped translation files.
4. **Phase 4:** Full coverage.

The `TranslocoDirective` (`*transloco="let t"`) wraps a template block and provides a `t()` function for translation lookup. Components without `*transloco` continue rendering their hardcoded English strings.

### Playwright Browser Management

Playwright requires a Chromium browser binary. Key operational concerns:

| Concern | Solution |
|---|---|
| Browser download | `playwright install chromium` CLI command during deployment. Or `BrowserType.LaunchAsync()` auto-downloads on first use. |
| Memory | Chromium process uses ~100-200MB. Use a singleton browser with page pooling. |
| Container deployment | Add Playwright's Chromium dependencies to Dockerfile. Official `mcr.microsoft.com/playwright/dotnet` base image includes everything. |
| Concurrency | Pool `IPage` instances. Create page per request, close after PDF generated. Browser stays alive. |
| Cold start | First PDF takes ~2s (browser launch). Subsequent PDFs take ~200-500ms (page reuse). |

---

## Installation

```bash
# Frontend -- new packages
cd globcrm-web
npm install @jsverse/transloco@^8.2.1 @jsverse/transloco-locale@^8.2.1

# Backend -- new package (run from src/GlobCRM.Infrastructure)
cd src/GlobCRM.Infrastructure
dotnet add package Microsoft.Playwright --version 1.58.0

# Install Playwright's Chromium browser (one-time, or add to CI/CD)
# After building the project:
pwsh bin/Debug/net10.0/playwright.ps1 install chromium
# Or on Linux/macOS without PowerShell:
dotnet tool install --global Microsoft.Playwright.CLI
playwright install chromium
```

---

## Version Matrix

### New Packages

| Package | Version | Layer | Purpose |
|---|---|---|---|
| `@jsverse/transloco` | ^8.2.1 | Frontend | Runtime i18n translations |
| `@jsverse/transloco-locale` | ^8.2.1 | Frontend | Locale-aware date/number/currency formatting |
| `Microsoft.Playwright` | ^1.58.0 | Backend | HTML-to-PDF conversion for quote templates |

### Existing Packages (Unchanged, Reused for v1.3)

| Package | Version | v1.3 Usage |
|---|---|---|
| `@angular/cdk` | ^19.2.19 | Drag-drop for free-form Kanban boards |
| `@angular/material` | ^19.2.19 | Cards, chips, dialogs, toggles for marketplace + Kanban |
| `angular-email-editor` | ^15.2.0 | Unlayer editor for quote templates (displayMode: 'web') |
| `@ngrx/signals` | ^19.2.1 | Signal stores for boards, integrations, quote templates |
| `@microsoft/signalr` | ^10.0.0 | Real-time Kanban board sync |
| `chart.js` / `ng2-charts` | ^4.5.1 / ^8.0.0 | Integration marketplace usage charts (optional) |
| Fluid.Core | 2.12.0 | Merge field resolution in quote templates |
| QuestPDF | 2026.2.0 | Fallback PDF generation for non-templated quotes |
| Hangfire | 1.8.18 | Background PDF generation for bulk operations |
| FluentValidation | 12.1.1 | Validation for new entities (Board, Card, QuoteTemplate) |

---

## Confidence Assessment

| Area | Confidence | Rationale |
|---|---|---|
| CDK drag-drop for Kanban | HIGH | Already used in 3 existing kanban views with identical patterns. Verified in codebase. |
| Transloco for i18n | HIGH | Well-documented, actively maintained, Signal API verified on npm/GitHub, standalone Angular support confirmed. |
| Transloco-locale for formatting | HIGH | Companion package, same maintainers, uses native Intl APIs. |
| Unlayer `displayMode: 'web'` | MEDIUM | Unlayer documentation confirms `'web'` mode exists (GitHub issues, PRs, wrapper libs). Not personally verified with the exact `angular-email-editor` wrapper version in this project. Existing `displayMode: 'email'` usage proves the config mechanism works -- changing to `'web'` should be a single property change. Flag for early validation in Phase 1. |
| Microsoft.Playwright for PDF | HIGH | Official Microsoft NuGet package (v1.58.0), well-documented PDF generation API, widely used in .NET ecosystem. Verified on NuGet. |
| Playwright browser management | MEDIUM | Operational concern: Chromium binary deployment needs testing in target environment (Docker, bare metal). Standard solution but needs verification. |
| Integration marketplace (no new libs) | HIGH | Pure CRUD + UI. All required Material components already installed. |
| .NET built-in localization | HIGH | `IStringLocalizer` is part of the .NET framework. No additional package needed. |

---

## Gaps and Risks

### 1. Unlayer `displayMode: 'web'` Validation (MEDIUM risk)
The `angular-email-editor` wrapper is at v15.2.0 (built for Angular 15, running on Angular 19 via compatibility). Changing `displayMode` to `'web'` should work (the option is passed through to the Unlayer embed script), but needs early validation. If `'web'` mode does not work as expected in this wrapper version, fallback is to use the Unlayer embed script directly (create a thin Angular wrapper around `unlayer.init()`, `unlayer.loadDesign()`, `unlayer.exportHtml()`).

### 2. Playwright Chromium in Production (MEDIUM risk)
Running headless Chromium in production requires: sufficient memory (200MB+), Chromium system dependencies (fonts, shared libraries), and a strategy for browser lifecycle. The official `mcr.microsoft.com/playwright/dotnet` Docker image handles this. For non-Docker deployments, `playwright install --with-deps chromium` installs everything.

### 3. Translation Coverage Scope (LOW risk)
Full i18n coverage of a 275K LOC app is a multi-milestone effort. v1.3 should scope to: navbar, sidebar, common actions (Save, Cancel, Delete, etc.), the 4 new features, and validation messages. Existing features can be translated incrementally in subsequent milestones.

### 4. Line Items Table in Unlayer (LOW risk)
Unlayer cannot render dynamic repeating rows natively. The `{{ line_items_table }}` merge tag approach (Fluid renders a full HTML table, Unlayer template includes it as raw HTML) is the proven pattern. The only risk is CSS styling of the injected table -- it needs to match the template's visual style. Mitigated by providing a default CSS stylesheet for line item tables.

---

## Sources

- Transloco documentation: https://jsverse.gitbook.io/transloco
- Transloco npm: https://www.npmjs.com/package/@jsverse/transloco (v8.2.1, published 1 month ago)
- Transloco Signal API: https://jsverse.gitbook.io/transloco/core-concepts/signals
- Transloco Locale: https://jsverse.gitbook.io/transloco/plugins-and-extensions/locale-l10n
- Transloco GitHub: https://github.com/jsverse/transloco
- Microsoft.Playwright NuGet: https://www.nuget.org/packages/microsoft.playwright (v1.58.0)
- Playwright .NET PDF guide: https://pdfnoodle.com/blog/how-to-generate-pdf-from-html-with-playwright-in-c-sharp
- Playwright .NET PDF blog: https://blog.hompus.nl/2025/08/18/playwright-pdf-generation-in-dotnet/
- Angular CDK Drag-Drop: https://angular.dev/guide/drag-drop
- Unlayer Angular editor: https://github.com/unlayer/angular-email-editor
- Unlayer displayMode discussion: https://github.com/unlayer/react-email-editor/issues/79
- .NET PDF library comparison: https://pdfbolt.com/blog/top-csharp-pdf-generation-libraries
- Phrase Angular i18n comparison: https://phrase.com/blog/posts/best-libraries-for-angular-i18n/
- Existing codebase analysis: `package.json`, `GlobCRM.Infrastructure.csproj`, `email-template-editor.component.ts`, `deal-kanban.component.ts`, `QuotePdfDocument.cs`, `TemplateRenderService.cs`
