# Phase 31 Research: Quote PDF Templates

**Researched:** 2026-02-21
**Mode:** Ecosystem (phase-specific implementation research)
**Overall Confidence:** HIGH

---

## Executive Summary

Phase 31 builds a quote PDF template system with three layers: a visual template editor (Unlayer in `web` display mode), server-side HTML-to-PDF rendering (Playwright), and a merge field system (Fluid/Liquid, already in codebase). The project already has proven patterns for all three from Phase 14 (Email Templates): the `angular-email-editor` package (v15.2.0) is installed and working in Angular 19, the `Fluid.Core` library (v2.12.0) handles Liquid merge field rendering, and the `MergeFieldService` + `TemplateRenderService` infrastructure exists. The new work is: (1) switching Unlayer from `email` to `web` displayMode for full-page document layout, (2) adding Playwright for pixel-perfect HTML-to-PDF conversion and PNG thumbnail generation, (3) extending merge fields to include quote-specific data with line items loop support, and (4) building the template management CRUD with card grid UI.

The highest-risk area is Playwright deployment and browser management. Browser instances are heavy (~150-300MB RAM each). The solution is a singleton `IBrowser` instance registered in DI with browser context pooling per request. Chromium binaries must be installed via the Playwright PowerShell script at build time.

The line items table approach uses Fluid's `{% for %}` loop in the exported HTML rather than a custom Unlayer block (per REQUIREMENTS.md Out of Scope). The template designer places a merge tag placeholder region; the server replaces it with a Fluid-rendered HTML table during PDF generation.

---

## Standard Stack

### Already in Project (reuse as-is)

| Technology | Version | Purpose | Location |
|---|---|---|---|
| angular-email-editor | 15.2.0 | Unlayer Angular wrapper | globcrm-web/package.json |
| Fluid.Core | 2.12.0 | Liquid template rendering | Infrastructure.csproj |
| QuestPDF | 2026.2.0 | Fallback PDF for default template | Infrastructure/Pdf/ |
| IFileStorageService | - | Tenant-partitioned file storage | Infrastructure/Storage/ |
| MergeFieldService | - | Merge field definitions + entity data resolution | Infrastructure/EmailTemplates/ |
| TemplateRenderService | - | Fluid parser (singleton, thread-safe) | Infrastructure/EmailTemplates/ |

### New Additions

| Technology | Version | Purpose | Why This |
|---|---|---|---|
| Microsoft.Playwright | 1.58.0 | HTML-to-PDF + PNG screenshot | Only headless browser solution with official .NET SDK. Chromium renders CSS perfectly for print. SetContentAsync + PdfAsync pattern. No file I/O needed -- works in-memory. |
| (No new frontend packages) | - | - | angular-email-editor already supports `web` displayMode via options |

### NuGet Installation

```bash
cd src/GlobCRM.Api
dotnet add package Microsoft.Playwright --version 1.58.0

# After build, install Chromium browsers (one-time setup):
pwsh bin/Debug/net10.0/playwright.ps1 install chromium
```

### NPM Installation

No new packages needed. `angular-email-editor@15.2.0` is already installed.

---

## Architecture Patterns

### Overall Data Flow

```
[Angular Unlayer Editor] --save--> [QuoteTemplate entity: designJson + htmlBody]
                                         |
[Quote Detail "Generate PDF"] --click--> [QuoteTemplatesController]
                                         |
                                    [Load template HTML]
                                         |
                                    [Resolve quote + entity merge data]
                                         |
                                    [Fluid renders HTML with data (including {% for %} line items)]
                                         |
                                    [Playwright: SetContentAsync + PdfAsync]
                                         |
                                    [Return PDF bytes as FileContentResult]
```

### Entity Model

```
QuoteTemplate
  - Id (Guid)
  - TenantId (Guid)
  - Name (string)
  - DesignJson (string, JSONB) -- Unlayer design state for re-editing
  - HtmlBody (string, text) -- Compiled HTML from Unlayer exportHtml
  - IsDefault (bool) -- One default per tenant
  - PageSize (string: "A4" | "Letter")
  - PageOrientation (string: "portrait" | "landscape")
  - PageMarginTop (string: "20mm")
  - PageMarginRight (string: "15mm")
  - PageMarginBottom (string: "20mm")
  - PageMarginLeft (string: "15mm")
  - ThumbnailPath (string?, nullable) -- File storage path to PNG thumbnail
  - OwnerId (Guid?)
  - IsSeedData (bool)
  - CreatedAt / UpdatedAt (DateTimeOffset)
```

This mirrors the `EmailTemplate` entity pattern (DesignJson + HtmlBody) but adds page configuration fields and thumbnail storage.

### Unlayer Configuration for Document Mode

The existing email template editor uses `displayMode: 'email'`. For quote templates, use `displayMode: 'web'` which gives full-page layout (no 600px email width constraint).

```typescript
readonly editorOptions = computed(() => ({
  displayMode: 'web' as const,  // Full-page layout, not email
  features: {
    textEditor: { spellChecker: true },
  },
  appearance: {
    theme: 'light' as const,
  },
  mergeTags: this.buildMergeTags(),
}));
```

Key difference: `web` mode renders full-width content suitable for A4/Letter pages. `email` mode constrains content to ~600px for email client compatibility.

### Merge Tags Configuration (with Line Items Loop)

Unlayer supports grouped merge tags with `rules` for repeat sections. This is how line items are handled:

```typescript
private buildMergeTags(): Record<string, unknown> {
  return {
    quote: {
      name: 'Quote',
      mergeTags: {
        number: { name: 'Quote Number', value: '{{quote.number}}', sample: 'Q-0042' },
        title: { name: 'Title', value: '{{quote.title}}', sample: 'Enterprise License' },
        status: { name: 'Status', value: '{{quote.status}}', sample: 'Draft' },
        issue_date: { name: 'Issue Date', value: '{{quote.issue_date}}', sample: '2026-02-21' },
        expiry_date: { name: 'Expiry Date', value: '{{quote.expiry_date}}', sample: '2026-03-21' },
        subtotal: { name: 'Subtotal', value: '{{quote.subtotal}}', sample: '10,000.00' },
        discount_total: { name: 'Discount Total', value: '{{quote.discount_total}}', sample: '500.00' },
        tax_total: { name: 'Tax Total', value: '{{quote.tax_total}}', sample: '1,710.00' },
        grand_total: { name: 'Grand Total', value: '{{quote.grand_total}}', sample: '11,210.00' },
        notes: { name: 'Notes', value: '{{quote.notes}}', sample: 'Payment due within 30 days.' },
        version: { name: 'Version', value: '{{quote.version}}', sample: '1' },
      },
    },
    line_items: {
      name: 'Line Items',
      // Rules define the repeat loop for the line items table
      rules: {
        repeat: {
          name: 'Repeat for Each Line Item',
          before: '{% for item in line_items %}',
          after: '{% endfor %}',
        },
      },
      mergeTags: {
        description: { name: 'Description', value: '{{item.description}}', sample: 'Enterprise License' },
        quantity: { name: 'Quantity', value: '{{item.quantity}}', sample: '10' },
        unit_price: { name: 'Unit Price', value: '{{item.unit_price}}', sample: '1,000.00' },
        discount_percent: { name: 'Discount %', value: '{{item.discount_percent}}', sample: '5' },
        tax_percent: { name: 'Tax %', value: '{{item.tax_percent}}', sample: '18' },
        line_total: { name: 'Line Total', value: '{{item.line_total}}', sample: '10,000.00' },
        net_total: { name: 'Net Total', value: '{{item.net_total}}', sample: '10,710.00' },
      },
    },
    company: {
      name: 'Company',
      mergeTags: {
        name: { name: 'Company Name', value: '{{company.name}}', sample: 'Acme Corp' },
        // ... additional company fields
      },
    },
    contact: {
      name: 'Contact',
      mergeTags: {
        first_name: { name: 'First Name', value: '{{contact.first_name}}', sample: 'John' },
        last_name: { name: 'Last Name', value: '{{contact.last_name}}', sample: 'Doe' },
        email: { name: 'Email', value: '{{contact.email}}', sample: 'john@acme.com' },
        // ... additional contact fields
      },
    },
    organization: {
      name: 'Organization',
      mergeTags: {
        name: { name: 'Org Name', value: '{{organization.name}}', sample: 'My CRM Company' },
        // ... branding fields
      },
    },
  };
}
```

### Playwright Browser Management (Singleton Pattern)

**Confidence: HIGH** -- Multiple authoritative sources confirm singleton browser with context-per-request.

```csharp
// Register as singleton in DI
public class PlaywrightPdfService : IAsyncDisposable
{
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    public async Task<IBrowser> GetBrowserAsync()
    {
        if (_browser != null) return _browser;

        await _initLock.WaitAsync();
        try
        {
            if (_browser != null) return _browser;
            _playwright = await Playwright.CreateAsync();
            _browser = await _playwright.Chromium.LaunchAsync(new() { Headless = true });
            return _browser;
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task<byte[]> GeneratePdfAsync(string html, PdfOptions options)
    {
        var browser = await GetBrowserAsync();
        var context = await browser.NewContextAsync();
        var page = await context.NewPageAsync();

        try
        {
            await page.SetContentAsync(html, new() { WaitUntil = WaitUntilState.NetworkIdle });
            return await page.PdfAsync(new PagePdfOptions
            {
                Format = options.PageSize,      // "A4" or "Letter"
                Landscape = options.Landscape,
                PrintBackground = true,
                Margin = new Margin
                {
                    Top = options.MarginTop,     // e.g., "20mm"
                    Right = options.MarginRight,
                    Bottom = options.MarginBottom,
                    Left = options.MarginLeft,
                },
            });
        }
        finally
        {
            await context.CloseAsync();
        }
    }

    public async Task<byte[]> GenerateThumbnailAsync(string html, int width = 800, int height = 1132)
    {
        var browser = await GetBrowserAsync();
        var context = await browser.NewContextAsync(new()
        {
            ViewportSize = new ViewportSize { Width = width, Height = height }
        });
        var page = await context.NewPageAsync();

        try
        {
            await page.SetContentAsync(html, new() { WaitUntil = WaitUntilState.NetworkIdle });
            return await page.ScreenshotAsync(new PageScreenshotOptions
            {
                Type = ScreenshotType.Png,
                FullPage = false, // Capture only viewport (first page)
            });
        }
        finally
        {
            await context.CloseAsync();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_browser != null) await _browser.CloseAsync();
        _playwright?.Dispose();
    }
}
```

### PDF Generation Flow (Server-Side)

```csharp
// In QuoteTemplatesController or QuotesController:
public async Task<IActionResult> GeneratePdf(Guid quoteId, Guid? templateId)
{
    var quote = await _quoteRepo.GetByIdWithLineItemsAsync(quoteId);

    // If no template specified or templateId is null, use QuestPDF fallback
    if (templateId == null)
    {
        // Existing QuestPDF path (backward compatibility)
        var doc = new QuotePdfDocument(BuildQuestPdfModel(quote));
        return File(doc.GeneratePdf(), "application/pdf", filename);
    }

    var template = await _templateRepo.GetByIdAsync(templateId.Value);

    // Build Fluid merge data dictionary
    var mergeData = await BuildQuoteMergeData(quote);

    // Render Liquid template with Fluid
    var renderedHtml = await _renderService.RenderAsync(template.HtmlBody, mergeData);

    // Generate PDF via Playwright
    var pdfBytes = await _pdfService.GeneratePdfAsync(renderedHtml, new PdfOptions
    {
        PageSize = template.PageSize,       // "A4" or "Letter"
        Landscape = template.PageOrientation == "landscape",
        MarginTop = template.PageMarginTop,
        MarginRight = template.PageMarginRight,
        MarginBottom = template.PageMarginBottom,
        MarginLeft = template.PageMarginLeft,
    });

    return File(pdfBytes, "application/pdf", filename);
}
```

### Fluid Merge Data for Quotes (with Line Items Array)

The existing `MergeFieldService.ResolveEntityDataAsync` handles contact/company/deal/lead. For quote templates, add a `ResolveQuoteDataAsync` method:

```csharp
private async Task<Dictionary<string, object?>> BuildQuoteMergeData(Quote quote)
{
    var data = new Dictionary<string, object?>
    {
        ["quote"] = new Dictionary<string, object?>
        {
            ["number"] = quote.QuoteNumber,
            ["title"] = quote.Title,
            ["description"] = quote.Description,
            ["status"] = quote.Status.ToString(),
            ["issue_date"] = quote.IssueDate.ToString("MMM dd, yyyy"),
            ["expiry_date"] = quote.ExpiryDate?.ToString("MMM dd, yyyy"),
            ["version"] = quote.VersionNumber,
            ["subtotal"] = quote.Subtotal.ToString("N2"),
            ["discount_total"] = quote.DiscountTotal.ToString("N2"),
            ["tax_total"] = quote.TaxTotal.ToString("N2"),
            ["grand_total"] = quote.GrandTotal.ToString("N2"),
            ["notes"] = quote.Notes,
        },
        // Line items as array for Fluid {% for %} loop
        ["line_items"] = quote.LineItems.OrderBy(li => li.SortOrder).Select(li =>
            new Dictionary<string, object?>
            {
                ["description"] = li.Description,
                ["quantity"] = li.Quantity.ToString("G"),
                ["unit_price"] = li.UnitPrice.ToString("N2"),
                ["discount_percent"] = li.DiscountPercent.ToString("G"),
                ["tax_percent"] = li.TaxPercent.ToString("G"),
                ["line_total"] = li.LineTotal.ToString("N2"),
                ["discount_amount"] = li.DiscountAmount.ToString("N2"),
                ["tax_amount"] = li.TaxAmount.ToString("N2"),
                ["net_total"] = li.NetTotal.ToString("N2"),
            }).ToList(),
    };

    // Add contact data if quote has a contact
    if (quote.Contact != null)
    {
        data["contact"] = new Dictionary<string, object?>
        {
            ["first_name"] = quote.Contact.FirstName,
            ["last_name"] = quote.Contact.LastName,
            ["email"] = quote.Contact.Email,
            ["phone"] = quote.Contact.Phone,
            ["job_title"] = quote.Contact.JobTitle,
        };
    }

    // Add company data
    if (quote.Company != null)
    {
        data["company"] = new Dictionary<string, object?>
        {
            ["name"] = quote.Company.Name,
            ["address"] = quote.Company.Address,
            ["phone"] = quote.Company.Phone,
        };
    }

    // Add organization branding
    var org = await _tenantProvider.GetCurrentOrganizationAsync();
    data["organization"] = new Dictionary<string, object?>
    {
        ["name"] = org?.Name,
    };

    return data;
}
```

### Thumbnail Generation on Save

When a template is saved (create or update), generate a PNG thumbnail in the background:

```csharp
// After saving the template entity:
try
{
    // Generate thumbnail from the HTML with sample merge data
    var sampleHtml = await _renderService.RenderAsync(template.HtmlBody, GetSampleQuoteMergeData());
    var thumbnailBytes = await _pdfService.GenerateThumbnailAsync(sampleHtml);

    // Save to file storage under tenant-partitioned path
    var thumbnailPath = await _fileStorage.SaveFileAsync(
        tenantId.ToString(), "quote-templates", $"{template.Id}.png", thumbnailBytes);

    template.ThumbnailPath = thumbnailPath;
    await _db.SaveChangesAsync();
}
catch (Exception ex)
{
    _logger.LogWarning(ex, "Failed to generate thumbnail for template {TemplateId}", template.Id);
    // Non-blocking: thumbnail failure doesn't fail the save
}
```

### Frontend Component Structure

```
features/quote-templates/
  quote-template.models.ts          -- QuoteTemplate, QuoteTemplateListItem, etc.
  quote-template.service.ts         -- API calls
  quote-template.store.ts           -- @ngrx/signals store
  quote-templates.routes.ts         -- Lazy routes
  quote-template-list/              -- Card grid with thumbnails
    quote-template-list.component.ts/html/scss
  quote-template-editor/            -- Full-page Unlayer editor (web mode)
    quote-template-editor.component.ts/html/scss
  quote-template-preview/           -- Modal with rendered PDF preview
    quote-template-preview.component.ts/html/scss
```

This mirrors the existing `features/email-templates/` structure.

---

## Don't Hand-Roll

| Need | Use This | Why |
|------|----------|-----|
| Visual template editor | Unlayer via `angular-email-editor` (already installed) | Battle-tested drag-and-drop with merge tag support, design JSON persistence, HTML export |
| Liquid template rendering | `Fluid.Core` (already installed) | Existing `TemplateRenderService` is singleton, thread-safe, handles `{% for %}` loops for line items |
| HTML-to-PDF conversion | `Microsoft.Playwright` PdfAsync | Chromium renders CSS perfectly; supports page size, margins, headers/footers, backgrounds |
| PNG thumbnail generation | `Microsoft.Playwright` ScreenshotAsync | Same browser instance, viewport-sized screenshot |
| File storage for thumbnails | `IFileStorageService` (already exists) | Tenant-partitioned, supports Local and Azure Blob |
| Merge field definitions | Extend existing `MergeFieldService` | Already has the pattern for grouped fields with custom field support |
| Design JSON storage | PostgreSQL JSONB column | Same pattern as `EmailTemplate.DesignJson` |
| Page size/margin config | Playwright `PagePdfOptions` | Native support for A4, Letter, custom dimensions in mm, margin strings |

---

## Common Pitfalls

### Critical: Playwright Browser Lifecycle

**What goes wrong:** Creating a new Playwright + Browser instance per request. Each Chromium launch takes 1-3 seconds and ~200MB RAM. Under load, this causes memory exhaustion and timeouts.

**Prevention:** Register `PlaywrightPdfService` as a **singleton** with lazy-initialized browser. Use `NewContextAsync()` per request (cheap, ~5ms) and dispose context after use. Never dispose the browser until app shutdown via `IAsyncDisposable`.

**Detection:** If PDF generation takes >3 seconds consistently, the browser is being recreated per request.

### Critical: Playwright Chromium Binary Not Installed

**What goes wrong:** NuGet installs the SDK, but Chromium binaries require a separate `playwright.ps1 install chromium` step. Forgetting this causes `PlaywrightException: Executable doesn't exist` at runtime.

**Prevention:** Add the install step to build/deploy scripts. For Docker: use `mcr.microsoft.com/playwright/dotnet:v1.58.0-noble` base image or run the install script in Dockerfile.

**Detection:** First PDF generation attempt throws `PlaywrightException`.

### Critical: Unlayer displayMode Must Be "web" Not "email"

**What goes wrong:** Using `displayMode: 'email'` (the existing email template setting) constrains content to ~600px width, making PDF output look like a narrow column on A4 paper.

**Prevention:** Quote template editor must use `displayMode: 'web'` in Unlayer options. This enables full-page-width content suitable for document/PDF output.

**Detection:** Generated PDFs have a narrow content column with large margins on both sides.

### Moderate: Fluid Template Syntax in Unlayer-Exported HTML

**What goes wrong:** Unlayer exports HTML with merge tags like `{{quote.number}}`. The `{% for item in line_items %}` / `{% endfor %}` repeat rules from merge tag rules get injected as raw text. If Unlayer HTML-encodes the curly braces or wraps them in span elements, Fluid cannot parse them.

**Prevention:** After `exportHtml()`, the backend must sanitize the HTML to ensure Fluid tags are not HTML-encoded. Check that `{%` and `{{` are not converted to `&lbrace;%` or similar. Unlayer's merge tag rules output the `before`/`after` values as raw text in the HTML, which is the correct behavior.

**Detection:** Fluid throws `InvalidOperationException: Failed to parse Liquid template` or merge fields render as literal `{{quote.number}}` text.

### Moderate: Thumbnail Generation Blocking Save

**What goes wrong:** Generating a PNG thumbnail on every save takes 2-5 seconds (Playwright screenshot). If done synchronously in the save request, users wait too long.

**Prevention:** Generate thumbnail in a fire-and-forget pattern (try/catch, log warning on failure, don't block the save response). Consider Hangfire background job for better reliability if needed.

**Detection:** Template save takes >3 seconds.

### Moderate: Organization Branding Fields Missing

**What goes wrong:** The `Organization` entity currently has only `Name`, `Subdomain`, `Industry`, `CompanySize`. Quote templates need logo URL, address, phone, email, and website for professional headers.

**Prevention:** Either add branding fields to Organization entity (migration) or store them in a separate `OrganizationBranding` entity/table. The template merge fields need actual data to populate.

**Detection:** `{{organization.logo}}`, `{{organization.address}}` render as empty strings.

### Minor: A4 vs Letter Margin Mismatch

**What goes wrong:** Using the same margin values for both A4 (210x297mm) and Letter (216x279mm) can cause content to be clipped or have uneven whitespace.

**Prevention:** Store margins per-template in the database. Default to sensible values: A4 = 20mm all sides, Letter = 0.75in all sides.

### Minor: angular-email-editor Version Staleness

**What goes wrong:** The `angular-email-editor` package (v15.2.0) hasn't been updated in ~2 years. It works with Angular 19 (project already uses it) but may not expose newer Unlayer features.

**Prevention:** This is not a blocker -- the package is a thin wrapper that loads Unlayer via CDN script. The actual Unlayer editor is always the latest CDN version. Use `options.version: 'latest'` to get current features.

**Detection:** If a needed Unlayer API method is missing from the Angular wrapper, access it directly via `this.emailEditor.editor` (the raw Unlayer instance).

---

## Code Examples

### Unlayer Editor Component (Quote Template)

```typescript
@Component({
  selector: 'app-quote-template-editor',
  standalone: true,
  imports: [EmailEditorModule, /* ... material modules */],
  templateUrl: './quote-template-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteTemplateEditorComponent implements OnInit {
  @ViewChild('emailEditor') emailEditor!: EmailEditorComponent;

  readonly editorOptions = computed(() => ({
    displayMode: 'web' as const,
    features: { textEditor: { spellChecker: true } },
    appearance: { theme: 'light' as const },
    mergeTags: this.buildQuoteMergeTags(),
  }));

  save(): void {
    this.emailEditor.exportHtml((data: { design: object; html: string }) => {
      const request = {
        name: this.templateName().trim(),
        designJson: JSON.stringify(data.design),
        htmlBody: data.html,
        pageSize: this.pageSize(),
        pageOrientation: this.pageOrientation(),
        // ... margins, isDefault
      };
      this.store.saveTemplate(request, () => { /* success callback */ });
    });
  }

  onEditorReady(): void {
    this.editorReady.set(true);
    // Load existing design in edit mode
    const template = this.store.selectedTemplate();
    if (template) {
      const design = JSON.parse(template.designJson);
      this.emailEditor.loadDesign(design);
    }
  }
}
```

### Playwright Service Registration

```csharp
// In Program.cs or a service extension:
public static IServiceCollection AddPlaywrightPdfServices(this IServiceCollection services)
{
    services.AddSingleton<PlaywrightPdfService>();
    return services;
}

// In app shutdown (Program.cs):
app.Lifetime.ApplicationStopping.Register(async () =>
{
    var pdfService = app.Services.GetRequiredService<PlaywrightPdfService>();
    await pdfService.DisposeAsync();
});
```

### Fluid Line Items Loop in Template HTML

The exported HTML from Unlayer (with merge tag rules) will contain something like:

```html
<table>
  <thead>
    <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
  </thead>
  <tbody>
    {% for item in line_items %}
    <tr>
      <td>{{item.description}}</td>
      <td>{{item.quantity}}</td>
      <td>{{item.unit_price}}</td>
      <td>{{item.net_total}}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>
```

Fluid processes this and expands the `{% for %}` loop into actual rows, one per line item.

### Template List Card Grid

```html
<div class="template-grid">
  @for (template of store.templates(); track template.id) {
    <div class="template-card" [class.is-default]="template.isDefault">
      <div class="thumbnail-wrapper">
        @if (template.thumbnailUrl) {
          <img [src]="template.thumbnailUrl" [alt]="template.name" />
        } @else {
          <div class="thumbnail-placeholder">
            <mat-icon>description</mat-icon>
          </div>
        }
      </div>
      <div class="card-info">
        <span class="template-name">{{ template.name }}</span>
        <span class="template-meta">{{ template.updatedAt | date }}</span>
        @if (template.isDefault) {
          <span class="default-badge">Default</span>
        }
      </div>
      <button mat-icon-button [matMenuTriggerFor]="menu">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="editTemplate(template.id)">Edit</button>
        <button mat-menu-item (click)="cloneTemplate(template.id)">Clone</button>
        <button mat-menu-item (click)="setDefault(template.id)">Set as Default</button>
        <button mat-menu-item (click)="deleteTemplate(template.id)">Delete</button>
      </mat-menu>
    </div>
  }
</div>
```

---

## Starter Templates

Provide 2-3 seed templates as Unlayer design JSON + HTML pairs:

1. **Standard Quote** -- Clean layout with org header, quote details, line items table, totals, and notes section.
2. **Detailed Proposal** -- Extended layout with cover section, description block, line items with all columns, terms and conditions footer.
3. **Minimal Invoice-Style** -- Compact layout focused on line items and totals with minimal branding.

These are stored as `IsSeedData = true` in the `QuoteTemplate` table via `TenantSeeder`.

---

## Phase Structure Recommendation

Based on dependencies and complexity:

### Plan 1: Backend Foundation (Entity + Migration + Playwright Service)
- QuoteTemplate entity, EF configuration, migration
- PlaywrightPdfService singleton with PDF + thumbnail generation
- QuoteTemplateMergeFieldService (extends existing pattern)
- CRUD API endpoints for QuoteTemplate
- Rationale: All frontend work depends on the API existing

### Plan 2: Template Editor (Unlayer Web Mode + Merge Tags)
- QuoteTemplateEditorComponent with Unlayer `web` displayMode
- Merge tag configuration for quote fields + line items loop rules
- Save flow (exportHtml -> API -> entity + thumbnail generation)
- Page settings UI (page size, orientation, margins)
- Rationale: Editor is the core UX; needs API from Plan 1

### Plan 3: Template Management (List + CRUD + Clone + Default)
- QuoteTemplateListComponent with card grid and thumbnails
- Clone, delete, set-default actions
- Template preview dialog (render with real quote data)
- Settings route integration (Settings > Quote Templates)
- Shortcut link from quote detail page
- Rationale: Management UI wraps editor; needs both API and editor

### Plan 4: PDF Generation + Preview + Starter Templates
- PDF generation endpoint on quotes (Playwright or QuestPDF fallback)
- Preview dialog with quote selector and rendered HTML
- 2-3 starter seed templates (design JSON + HTML)
- Seeder integration for demo tenants
- Rationale: End-to-end flow; needs all prior plans

### Plan 5: i18n + Polish
- Transloco scope for quote-templates (EN + TR)
- Edge case handling, error states, loading states
- Accessibility review
- Final design system alignment

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Unlayer web mode in Angular | HIGH | Same package already working in project; displayMode is a simple option change |
| Merge tags with rules/loops | HIGH | Unlayer docs confirm rules.repeat with before/after; Fluid handles {% for %} natively |
| Playwright PDF generation | HIGH | Official .NET SDK, well-documented API, multiple production usage examples |
| Playwright thumbnail generation | HIGH | Same API, ScreenshotAsync is a core Playwright feature |
| Singleton browser management | HIGH | Recommended pattern from multiple sources; browser context per request is documented best practice |
| Fluid line items rendering | HIGH | Already in codebase; {% for %} loops are basic Liquid syntax |
| Organization branding fields | MEDIUM | Organization entity needs additional fields (logo, address); migration needed but straightforward |
| angular-email-editor Angular 19 compat | HIGH | Already working in the project at v15.2.0 |

## Open Questions (for plan-phase to resolve)

1. **Organization branding fields**: The Organization entity lacks logo, address, phone, email, website. Should these be added to the existing entity or a new OrganizationBranding entity? (Recommendation: add to Organization directly -- simpler, follows existing pattern)

2. **Line items table approach**: The REQUIREMENTS.md Out of Scope says "Use pre-rendered HTML injection via Fluid loop instead" of custom Unlayer blocks. The merge tag rules approach (documented above) achieves this without a custom block -- the designer uses the Repeat rule in a text block with an HTML table. Verify this is sufficient vs needing a specialized UI in the editor.

3. **Thumbnail dimensions**: A4 aspect ratio is ~1:1.414. A sensible thumbnail would be 400x566px for the card grid. Confirm desired dimensions.

---

## Sources

- [Unlayer Angular Email Editor - GitHub](https://github.com/unlayer/angular-email-editor)
- [Unlayer Merge Tags Documentation](https://docs.unlayer.com/docs/merge-tags)
- [Unlayer Custom Tools Documentation](https://docs.unlayer.com/docs/custom-tools)
- [Unlayer displayMode discussion - GitHub Issue #79](https://github.com/unlayer/react-email-editor/issues/79)
- [Microsoft.Playwright NuGet (v1.58.0)](https://www.nuget.org/packages/microsoft.playwright)
- [Playwright .NET Page API Reference](https://playwright.dev/dotnet/docs/api/class-page)
- [Playwright .NET Docker Documentation](https://playwright.dev/dotnet/docs/docker)
- [HTML to PDF with Playwright C# - PDFBolt](https://pdfbolt.com/blog/html-to-pdf-playwright-csharp-dotnet)
- [Playwright PDF Generation in .NET - Hompus Blog](https://blog.hompus.nl/2025/08/18/playwright-pdf-generation-in-dotnet/)
- [Playwright PDF from HTML Template - Meziantou](https://www.meziantou.net/generate-pdf-files-using-an-html-template-and-playwright.htm)
- [Fluid Template Engine - GitHub](https://github.com/sebastienros/fluid)
- [Browser Pool Pattern for Playwright - Medium](https://medium.com/@devcriston/building-a-robust-browser-pool-for-web-automation-with-playwright-2c750eb0a8e7)
- [Playwright .NET PagePdfOptions - LambdaTest](https://www.lambdatest.com/automation-testing-advisor/csharp/classes/Microsoft.Playwright.PagePdfOptions)

---

*Research completed: 2026-02-21*
*Phase: 31-quote-pdf-templates*
