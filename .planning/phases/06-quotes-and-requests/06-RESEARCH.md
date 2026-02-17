# Phase 6: Quotes & Requests - Research

**Researched:** 2026-02-17
**Domain:** Quote line-item builder with PDF generation, request/ticket tracking with status workflow
**Confidence:** HIGH

## Summary

Phase 6 introduces two new top-level CRM entities: **Quotes** (with line items, calculations, PDF generation, and versioning) and **Requests** (support tickets with status workflow). Both follow well-established patterns already proven in the codebase -- Deals, Activities, Products, and the ActivityWorkflow state machine provide direct architectural precedents.

The Quote entity is the more complex of the two. It requires a parent-child relationship (Quote -> QuoteLineItem), automatic calculation of subtotals/discounts/taxes/grand totals, PDF generation via QuestPDF, and a versioning system where new versions clone an existing quote. The Request entity is simpler -- it follows the Activity pattern with a status workflow (New -> InProgress -> Resolved -> Closed) and links to Contacts/Companies.

Both entities fit cleanly into the existing triple-layer tenant isolation (TenantId property + EF global query filter + PostgreSQL RLS), RBAC permission system (EntityType enum already has `Quote` and `Request` entries), and custom fields infrastructure (JSONB + GIN indexing). The ActivityLink entity already allows linking activities to "Quote" and "Request" entity types. The frontend follows established patterns: feature module with models/service/store/routes, dynamic table for list views, and detail pages with RelatedEntityTabs.

**Primary recommendation:** Use QuestPDF 2026.2.0 for PDF generation (free for <$1M revenue), follow the DealProduct pattern for QuoteLineItem, and model RequestWorkflow after ActivityWorkflow using a static class with dictionary-based transition validation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| QuestPDF | 2026.2.0 | Server-side PDF generation for quotes | Fluent C# API, no external dependencies, no HTML-to-PDF conversion, high performance (1000s pages/sec), free Community license for <$1M revenue |
| FluentValidation | 11.3.1 (already installed) | Request DTO validation | Already used in DealsController and ActivitiesController for form validation |
| Angular Material | (already installed) | UI components for forms, tables, tabs | Already used across all feature modules |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| IFileStorageService | (already exists) | Store generated PDF files | When user generates PDF from quote -- save to tenant-partitioned storage |
| CustomFieldValidator | (already exists) | Validate JSONB custom fields | On quote/request create/update when custom fields provided |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| QuestPDF | iText7/iTextSharp | iText requires AGPL or commercial license ($); QuestPDF is free for small companies and has a more modern API |
| QuestPDF | PdfSharp | PdfSharp is lower-level -- no layout engine, no automatic pagination, more code needed for tables |
| QuestPDF | Razor + HTML-to-PDF (Puppeteer/wkhtmltopdf) | External process dependency, slower, harder to deploy in containers, no .NET-native |

**Installation:**
```bash
# In GlobCRM.Infrastructure project
dotnet add src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj package QuestPDF --version 2026.2.0
```

**License Configuration (required at startup):**
```csharp
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
```

## Architecture Patterns

### Recommended Project Structure

**Backend (new files):**
```
src/GlobCRM.Domain/
├── Entities/
│   ├── Quote.cs                    # Quote header entity
│   ├── QuoteLineItem.cs            # Line item child entity
│   ├── QuoteStatusHistory.cs       # Audit trail for status changes
│   ├── Request.cs                  # Support request entity
│   └── RequestWorkflow.cs          # Static workflow validator
├── Enums/
│   ├── QuoteStatus.cs              # Draft, Sent, Accepted, Rejected, Expired
│   └── RequestStatus.cs            # New, InProgress, Resolved, Closed
│   └── RequestPriority.cs          # Low, Medium, High, Urgent (reuse ActivityPriority pattern)
│   └── RequestCategory.cs          # General, Bug, Feature, Support, Billing
├── Interfaces/
│   ├── IQuoteRepository.cs         # Quote CRUD + version queries
│   └── IRequestRepository.cs       # Request CRUD + status queries

src/GlobCRM.Infrastructure/
├── Persistence/
│   ├── Configurations/
│   │   ├── QuoteConfiguration.cs
│   │   ├── QuoteLineItemConfiguration.cs
│   │   ├── QuoteStatusHistoryConfiguration.cs
│   │   └── RequestConfiguration.cs
│   ├── Repositories/
│   │   ├── QuoteRepository.cs
│   │   └── RequestRepository.cs
│   └── Migrations/App/
│       └── [timestamp]_AddQuotesAndRequests.cs
├── Pdf/
│   ├── QuotePdfDocument.cs          # QuestPDF IDocument implementation
│   └── PdfServiceExtensions.cs      # DI registration

src/GlobCRM.Api/Controllers/
├── QuotesController.cs              # Quote CRUD + PDF + versioning endpoints
└── RequestsController.cs            # Request CRUD + status workflow endpoints
```

**Frontend (new files):**
```
globcrm-web/src/app/features/
├── quotes/
│   ├── quote.models.ts              # TypeScript interfaces
│   ├── quote.service.ts             # API service
│   ├── quote.store.ts               # Signal store
│   ├── quotes.routes.ts             # Route definitions
│   ├── quote-list/
│   │   └── quote-list.component.ts  # Dynamic table list page
│   ├── quote-form/
│   │   └── quote-form.component.ts  # Quote header + line items form
│   └── quote-detail/
│       └── quote-detail.component.ts # Detail page with tabs
├── requests/
│   ├── request.models.ts
│   ├── request.service.ts
│   ├── request.store.ts
│   ├── requests.routes.ts
│   ├── request-list/
│   │   └── request-list.component.ts
│   ├── request-form/
│   │   └── request-form.component.ts
│   └── request-detail/
│       └── request-detail.component.ts
```

### Pattern 1: Quote Entity with Line Items (Parent-Child)

**What:** Quote is a parent entity with QuoteLineItem children, similar to Deal->DealProduct but with richer fields.
**When to use:** Any entity that has ordered child rows with calculations.

**Quote Entity Design:**
```csharp
// Source: Derived from existing Deal and Product entity patterns
public class Quote
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    // Core fields
    public string QuoteNumber { get; set; } = string.Empty;  // Auto-generated: Q-{tenant-seq}
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public QuoteStatus Status { get; set; } = QuoteStatus.Draft;

    // Dates
    public DateOnly IssueDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }

    // Versioning
    public int VersionNumber { get; set; } = 1;
    public Guid? OriginalQuoteId { get; set; }  // Self-referencing FK to original version
    public Quote? OriginalQuote { get; set; }

    // Entity Links (direct FKs, not polymorphic)
    public Guid? DealId { get; set; }
    public Deal? Deal { get; set; }
    public Guid? ContactId { get; set; }
    public Contact? Contact { get; set; }
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }

    // Ownership
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }

    // Calculated totals (stored, not computed on read)
    public decimal Subtotal { get; set; }         // Sum of line item totals before discount
    public decimal DiscountTotal { get; set; }     // Sum of line item discounts
    public decimal TaxTotal { get; set; }          // Sum of line item taxes
    public decimal GrandTotal { get; set; }        // Subtotal - DiscountTotal + TaxTotal

    // Notes for PDF
    public string? Notes { get; set; }             // Terms, conditions, notes shown on PDF

    // Custom fields
    public Dictionary<string, object?> CustomFields { get; set; } = new();
    public bool IsSeedData { get; set; } = false;

    // Audit
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public ICollection<QuoteLineItem> LineItems { get; set; } = new List<QuoteLineItem>();
}
```

**QuoteLineItem Entity Design:**
```csharp
// Source: Derived from DealProduct pattern, extended with discount/tax
public class QuoteLineItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Parent FK
    public Guid QuoteId { get; set; }
    public Quote Quote { get; set; } = null!;

    // Product link (optional -- can have custom line items)
    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }

    // Line item fields
    public string Description { get; set; } = string.Empty;  // From product name or custom
    public int SortOrder { get; set; }                       // Display order
    public decimal Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal DiscountPercent { get; set; }             // 0-100
    public decimal TaxPercent { get; set; }                  // 0-100

    // Computed amounts (stored for performance and PDF accuracy)
    public decimal LineTotal { get; set; }                   // Quantity * UnitPrice
    public decimal DiscountAmount { get; set; }              // LineTotal * DiscountPercent / 100
    public decimal TaxAmount { get; set; }                   // (LineTotal - DiscountAmount) * TaxPercent / 100
    public decimal NetTotal { get; set; }                    // LineTotal - DiscountAmount + TaxAmount
}
```

### Pattern 2: Request Status Workflow (Static State Machine)

**What:** Static class with dictionary-based transition validation, identical to ActivityWorkflow pattern.
**When to use:** Any entity with a fixed status progression.

```csharp
// Source: Direct reuse of ActivityWorkflow pattern from existing codebase
public enum RequestStatus
{
    New,
    InProgress,
    Resolved,
    Closed
}

public static class RequestWorkflow
{
    private static readonly Dictionary<RequestStatus, RequestStatus[]> AllowedTransitions = new()
    {
        [RequestStatus.New] = [RequestStatus.InProgress, RequestStatus.Closed],
        [RequestStatus.InProgress] = [RequestStatus.Resolved, RequestStatus.New],
        [RequestStatus.Resolved] = [RequestStatus.Closed, RequestStatus.InProgress],
        [RequestStatus.Closed] = [RequestStatus.InProgress],  // Reopen
    };

    public static bool CanTransition(RequestStatus from, RequestStatus to)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) && allowed.Contains(to);
    }

    public static RequestStatus[] GetAllowedTransitions(RequestStatus from)
    {
        return AllowedTransitions.TryGetValue(from, out var allowed) ? allowed : [];
    }
}
```

### Pattern 3: Quote Versioning

**What:** Creating a new version clones the quote with incremented VersionNumber and link to OriginalQuoteId.
**When to use:** QUOT-06 requirement for quote versioning.

```csharp
// Endpoint: POST /api/quotes/{id}/new-version
// Logic: Deep clone quote + line items, increment version, set OriginalQuoteId
public async Task<IActionResult> CreateNewVersion(Guid id)
{
    var original = await _quoteRepository.GetByIdWithLineItemsAsync(id);
    if (original is null) return NotFound();

    var newVersion = new Quote
    {
        TenantId = original.TenantId,
        Title = original.Title,
        // ... copy all fields ...
        VersionNumber = original.VersionNumber + 1,
        OriginalQuoteId = original.OriginalQuoteId ?? original.Id, // Point to root
        Status = QuoteStatus.Draft,  // New versions start as Draft
        QuoteNumber = original.QuoteNumber, // Same number, different version
        IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
    };

    // Deep clone line items
    foreach (var item in original.LineItems)
    {
        newVersion.LineItems.Add(new QuoteLineItem
        {
            QuoteId = newVersion.Id,
            ProductId = item.ProductId,
            Description = item.Description,
            SortOrder = item.SortOrder,
            Quantity = item.Quantity,
            UnitPrice = item.UnitPrice,
            DiscountPercent = item.DiscountPercent,
            TaxPercent = item.TaxPercent,
            LineTotal = item.LineTotal,
            DiscountAmount = item.DiscountAmount,
            TaxAmount = item.TaxAmount,
            NetTotal = item.NetTotal,
        });
    }

    // Copy totals
    newVersion.Subtotal = original.Subtotal;
    newVersion.DiscountTotal = original.DiscountTotal;
    newVersion.TaxTotal = original.TaxTotal;
    newVersion.GrandTotal = original.GrandTotal;

    var created = await _quoteRepository.CreateAsync(newVersion);
    return CreatedAtAction(nameof(GetById), new { id = created.Id }, ...);
}
```

### Pattern 4: QuestPDF Quote Document

**What:** IDocument implementation for generating quote PDFs using QuestPDF fluent API.
**When to use:** QUOT-05 -- user clicks "Generate PDF" button on quote detail page.

```csharp
// Source: QuestPDF official InvoiceDocument example pattern
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

public class QuotePdfDocument : IDocument
{
    private readonly QuotePdfModel _model;

    public QuotePdfDocument(QuotePdfModel model)
    {
        _model = model;
    }

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(40);
            page.DefaultTextStyle(x => x.FontSize(10));

            page.Header().Element(ComposeHeader);
            page.Content().Element(ComposeContent);
            page.Footer().Element(ComposeFooter);
        });
    }

    void ComposeHeader(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text(_model.OrganizationName).FontSize(18).Bold();
                col.Item().Text($"Quote #{_model.QuoteNumber} v{_model.VersionNumber}");
                col.Item().Text($"Date: {_model.IssueDate:MMM dd, yyyy}");
                if (_model.ExpiryDate.HasValue)
                    col.Item().Text($"Valid Until: {_model.ExpiryDate:MMM dd, yyyy}");
            });
        });
    }

    void ComposeContent(IContainer container)
    {
        container.PaddingVertical(20).Column(col =>
        {
            // Line items table
            col.Item().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(30);    // #
                    columns.RelativeColumn(3);     // Description
                    columns.RelativeColumn(1);     // Qty
                    columns.RelativeColumn(1);     // Unit Price
                    columns.RelativeColumn(1);     // Discount
                    columns.RelativeColumn(1);     // Tax
                    columns.RelativeColumn(1);     // Total
                });

                // Header row
                table.Header(header =>
                {
                    header.Cell().Text("#").Bold();
                    header.Cell().Text("Description").Bold();
                    header.Cell().AlignRight().Text("Qty").Bold();
                    header.Cell().AlignRight().Text("Unit Price").Bold();
                    header.Cell().AlignRight().Text("Discount").Bold();
                    header.Cell().AlignRight().Text("Tax").Bold();
                    header.Cell().AlignRight().Text("Total").Bold();
                });

                // Data rows
                foreach (var (item, index) in _model.LineItems.Select((li, i) => (li, i)))
                {
                    table.Cell().Text($"{index + 1}");
                    table.Cell().Text(item.Description);
                    table.Cell().AlignRight().Text($"{item.Quantity}");
                    table.Cell().AlignRight().Text($"{item.UnitPrice:C}");
                    table.Cell().AlignRight().Text($"{item.DiscountPercent}%");
                    table.Cell().AlignRight().Text($"{item.TaxPercent}%");
                    table.Cell().AlignRight().Text($"{item.NetTotal:C}");
                }
            });

            // Totals section
            col.Item().AlignRight().PaddingTop(10).Column(totals =>
            {
                totals.Item().Text($"Subtotal: {_model.Subtotal:C}");
                totals.Item().Text($"Discount: -{_model.DiscountTotal:C}");
                totals.Item().Text($"Tax: {_model.TaxTotal:C}");
                totals.Item().Text($"Grand Total: {_model.GrandTotal:C}").Bold().FontSize(14);
            });

            // Notes
            if (!string.IsNullOrWhiteSpace(_model.Notes))
            {
                col.Item().PaddingTop(20).Text("Notes").Bold();
                col.Item().Text(_model.Notes);
            }
        });
    }

    void ComposeFooter(IContainer container)
    {
        container.AlignCenter().Text(text =>
        {
            text.Span("Page ");
            text.CurrentPageNumber();
            text.Span(" of ");
            text.TotalPages();
        });
    }
}
```

### Pattern 5: Line Item Form (Angular FormArray)

**What:** Angular reactive form with FormArray for dynamic line items with add/remove/reorder.
**When to use:** Quote create/edit form for managing line items.

```typescript
// Source: Angular ReactiveFormsModule FormArray pattern
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';

// In component:
quoteForm = this.fb.group({
  title: ['', [Validators.required, Validators.maxLength(500)]],
  description: [''],
  dealId: [null as string | null],
  contactId: [null as string | null],
  companyId: [null as string | null],
  issueDate: [new Date(), Validators.required],
  expiryDate: [null as Date | null],
  notes: [''],
  lineItems: this.fb.array([], Validators.minLength(1)),
});

get lineItemsArray(): FormArray {
  return this.quoteForm.get('lineItems') as FormArray;
}

addLineItem(product?: ProductDto): void {
  this.lineItemsArray.push(this.fb.group({
    productId: [product?.id ?? null],
    description: [product?.name ?? '', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unitPrice: [product?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
    discountPercent: [0, [Validators.min(0), Validators.max(100)]],
    taxPercent: [0, [Validators.min(0), Validators.max(100)]],
  }));
}

removeLineItem(index: number): void {
  this.lineItemsArray.removeAt(index);
}

// Computed totals (use Angular signals or computed getter)
calculateTotals(): QuoteTotals {
  const items = this.lineItemsArray.value;
  let subtotal = 0, discountTotal = 0, taxTotal = 0;

  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    const discountAmount = lineTotal * (item.discountPercent / 100);
    const taxableAmount = lineTotal - discountAmount;
    const taxAmount = taxableAmount * (item.taxPercent / 100);

    subtotal += lineTotal;
    discountTotal += discountAmount;
    taxTotal += taxAmount;
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal: subtotal - discountTotal + taxTotal,
  };
}
```

### Anti-Patterns to Avoid
- **Computing totals only on the frontend:** Always recalculate and store totals server-side on create/update. The PDF and API responses should use the stored values, not recalculate. Frontend calculation is only for live preview.
- **Using polymorphic linking for Quote->Deal/Contact/Company:** Use direct FK columns instead. Unlike ActivityLink (which connects to many entity types dynamically), Quote has a fixed set of linked entities. Direct FKs enable proper JOIN navigation and cascade behavior.
- **Storing line items as JSONB:** Use a proper child table (QuoteLineItem) for line items. JSONB prevents relational queries, indexing, and makes migration harder.
- **Building custom PDF templates from scratch:** Use QuestPDF's component/fluent API. Don't concatenate strings or HTML.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | HTML-to-string, manual PDF byte streams | QuestPDF with IDocument pattern | Layout engine, automatic pagination, table support, fonts, images all handled |
| Form validation | Manual if/else in controllers | FluentValidation AbstractValidator | Already used for Deal/Activity validators, consistent patterns |
| Workflow state machine | Database-driven configurable workflows | Static class with Dictionary<Status, Status[]> | Already proven with ActivityWorkflow, simpler, no DB overhead, type-safe |
| Line item dynamic forms | Manual DOM manipulation | Angular FormArray with FormBuilder | Built-in validation, change detection, reactive value tracking |
| File download | Manual byte array response | `File(bytes, contentType, fileName)` return | Already used in ActivityAttachment download endpoint |

**Key insight:** Nearly every technical challenge in Phase 6 has a solved precedent in the existing codebase. The Quote entity is essentially a Deal + DealProduct hybrid with calculation logic. The Request entity is a simplified Activity with different status values.

## Common Pitfalls

### Pitfall 1: Floating-Point Arithmetic in Financial Calculations
**What goes wrong:** Using `float`/`double` for currency calculations causes rounding errors (e.g., 0.1 + 0.2 != 0.3).
**Why it happens:** IEEE 754 floating point cannot represent all decimal values exactly.
**How to avoid:** Use `decimal` type everywhere (already used for Product.UnitPrice, Deal.Value, DealProduct.UnitPrice). Ensure frontend uses precise arithmetic or rounds to 2 decimal places before sending to API.
**Warning signs:** Grand totals that are off by 1 cent, test assertions that fail on exact decimal comparisons.

### Pitfall 2: Quote Number Uniqueness Under Concurrency
**What goes wrong:** Two concurrent requests generate the same quote number (e.g., Q-0042 + Q-0042).
**Why it happens:** Read-increment-write race condition without database-level sequence.
**How to avoid:** Use a PostgreSQL SEQUENCE or generate quote numbers with `COALESCE(MAX(quote_number_seq), 0) + 1` inside a transaction. Alternatively, use a format like `Q-{YYYYMMDD}-{4-char-random}` to avoid contention entirely.
**Warning signs:** Duplicate constraint violations in production under load.

### Pitfall 3: Line Item SortOrder Gaps After Deletion
**What goes wrong:** Deleting line item at index 2 of 5 leaves gaps [0, 1, 3, 4], confusing PDF numbering.
**Why it happens:** Not re-indexing SortOrder after removal.
**How to avoid:** On every save, re-calculate SortOrder based on array position (0, 1, 2, ...). The frontend FormArray index IS the SortOrder.
**Warning signs:** Line item #1, #2, #4, #5 shown on PDF instead of #1, #2, #3, #4.

### Pitfall 4: Stale Totals After Line Item Changes
**What goes wrong:** Quote totals don't match the sum of line items because they were calculated once and not updated.
**Why it happens:** Updating line items without recalculating the parent Quote's totals.
**How to avoid:** Always recalculate ALL totals (line-level and quote-level) server-side in the Update endpoint. Treat line items as a batch replacement (delete old + insert new) rather than trying to diff individual changes.
**Warning signs:** GrandTotal on the quote list doesn't match what's shown on the detail page.

### Pitfall 5: PDF Generation Memory Pressure
**What goes wrong:** Generating PDFs for quotes with many line items uses excessive memory.
**Why it happens:** QuestPDF generates entire document in memory.
**How to avoid:** QuestPDF is highly optimized and handles thousands of pages efficiently. For this CRM use case (quotes typically < 10 pages), memory pressure is unlikely. If needed, generate PDFs asynchronously and cache the result. Use `document.GeneratePdf()` to get byte array, store via IFileStorageService, and return a download URL.
**Warning signs:** Memory spikes during PDF generation (unlikely for CRM quotes).

### Pitfall 6: Versioning Cascade Confusion
**What goes wrong:** Deleting the original quote cascades to delete all versions, or orphans them.
**Why it happens:** OriginalQuoteId FK with Cascade delete.
**How to avoid:** Use `DeleteBehavior.SetNull` on the OriginalQuoteId FK. When the original is deleted, versions survive with OriginalQuoteId = null. They still have their VersionNumber for identification.
**Warning signs:** All versions disappear when one quote is deleted.

### Pitfall 7: Missing RBAC Permissions for New Entity Types
**What goes wrong:** Users get 403 Forbidden on all Quote/Request operations after deployment.
**Why it happens:** EntityType enum has Quote and Request, but RoleTemplateSeeder hasn't run for existing tenants to seed permissions for these new types.
**How to avoid:** The existing `EnsurePermissionsForAllEntityTypesAsync` method already handles this -- it iterates `Enum.GetNames<EntityType>()` and adds missing permissions. It runs on startup via `SeedAllTenantsAsync`. Just ensure the startup code still calls this method.
**Warning signs:** All CRUD operations return 403 for non-admin users after deploying Phase 6.

## Code Examples

### Backend Controller Pattern (QuotesController skeleton)

```csharp
// Source: Follows DealsController and ActivitiesController patterns exactly
[ApiController]
[Route("api/quotes")]
[Authorize]
public class QuotesController : ControllerBase
{
    // Same DI pattern as DealsController:
    // IQuoteRepository, IPermissionService, ICustomFieldRepository,
    // CustomFieldValidator, ITenantProvider, IFileStorageService,
    // ApplicationDbContext, ILogger<QuotesController>

    [HttpGet]
    [Authorize(Policy = "Permission:Quote:View")]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams) { ... }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:View")]
    public async Task<IActionResult> GetById(Guid id) { ... }

    [HttpPost]
    [Authorize(Policy = "Permission:Quote:Create")]
    public async Task<IActionResult> Create([FromBody] CreateQuoteRequest request) { ... }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:Update")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateQuoteRequest request) { ... }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:Delete")]
    public async Task<IActionResult> Delete(Guid id) { ... }

    // Quote-specific endpoints
    [HttpGet("{id:guid}/pdf")]
    [Authorize(Policy = "Permission:Quote:View")]
    public async Task<IActionResult> GeneratePdf(Guid id) { ... }

    [HttpPost("{id:guid}/new-version")]
    [Authorize(Policy = "Permission:Quote:Create")]
    public async Task<IActionResult> CreateNewVersion(Guid id) { ... }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = "Permission:Quote:Update")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateQuoteStatusRequest request) { ... }
}
```

### Line Item Calculation Logic (Server-Side)

```csharp
// Source: Standard financial calculation pattern
public static class QuoteCalculator
{
    public static void RecalculateLineItem(QuoteLineItem item)
    {
        item.LineTotal = item.Quantity * item.UnitPrice;
        item.DiscountAmount = Math.Round(item.LineTotal * item.DiscountPercent / 100m, 2);
        item.TaxAmount = Math.Round((item.LineTotal - item.DiscountAmount) * item.TaxPercent / 100m, 2);
        item.NetTotal = item.LineTotal - item.DiscountAmount + item.TaxAmount;
    }

    public static void RecalculateQuoteTotals(Quote quote)
    {
        foreach (var item in quote.LineItems)
        {
            RecalculateLineItem(item);
        }

        quote.Subtotal = quote.LineItems.Sum(i => i.LineTotal);
        quote.DiscountTotal = quote.LineItems.Sum(i => i.DiscountAmount);
        quote.TaxTotal = quote.LineItems.Sum(i => i.TaxAmount);
        quote.GrandTotal = quote.Subtotal - quote.DiscountTotal + quote.TaxTotal;
    }
}
```

### EF Core Configuration Pattern (QuoteLineItem)

```csharp
// Source: Follows DealProductConfiguration pattern
public class QuoteLineItemConfiguration : IEntityTypeConfiguration<QuoteLineItem>
{
    public void Configure(EntityTypeBuilder<QuoteLineItem> builder)
    {
        builder.ToTable("quote_line_items");

        builder.HasKey(li => li.Id);

        builder.Property(li => li.Id).HasColumnName("id");
        builder.Property(li => li.QuoteId).HasColumnName("quote_id").IsRequired();
        builder.Property(li => li.ProductId).HasColumnName("product_id");
        builder.Property(li => li.Description).HasColumnName("description").HasMaxLength(500).IsRequired();
        builder.Property(li => li.SortOrder).HasColumnName("sort_order");
        builder.Property(li => li.Quantity).HasColumnName("quantity").HasPrecision(18, 4);
        builder.Property(li => li.UnitPrice).HasColumnName("unit_price").HasPrecision(18, 4);
        builder.Property(li => li.DiscountPercent).HasColumnName("discount_percent").HasPrecision(5, 2);
        builder.Property(li => li.TaxPercent).HasColumnName("tax_percent").HasPrecision(5, 2);
        builder.Property(li => li.LineTotal).HasColumnName("line_total").HasPrecision(18, 2);
        builder.Property(li => li.DiscountAmount).HasColumnName("discount_amount").HasPrecision(18, 2);
        builder.Property(li => li.TaxAmount).HasColumnName("tax_amount").HasPrecision(18, 2);
        builder.Property(li => li.NetTotal).HasColumnName("net_total").HasPrecision(18, 2);

        // Relationships
        builder.HasOne(li => li.Product)
            .WithMany()
            .HasForeignKey(li => li.ProductId)
            .OnDelete(DeleteBehavior.SetNull); // Keep line item if product deleted

        // Indexes
        builder.HasIndex(li => li.QuoteId).HasDatabaseName("idx_quote_line_items_quote");
        builder.HasIndex(li => li.ProductId).HasDatabaseName("idx_quote_line_items_product");
    }
}
```

### Request Entity Design

```csharp
// Source: Follows Activity entity pattern, simplified
public class Request
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public string Subject { get; set; } = string.Empty;
    public string? Description { get; set; }

    public RequestStatus Status { get; set; } = RequestStatus.New;
    public RequestPriority Priority { get; set; }
    public string? Category { get; set; }  // String for flexibility (user can type custom categories)

    // Ownership
    public Guid? OwnerId { get; set; }      // Who created/is responsible
    public ApplicationUser? Owner { get; set; }
    public Guid? AssignedToId { get; set; }  // Who is working on it
    public ApplicationUser? AssignedTo { get; set; }

    // Entity Links (direct FKs)
    public Guid? ContactId { get; set; }
    public Contact? Contact { get; set; }
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }

    // Resolution
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }

    // Custom fields
    public Dictionary<string, object?> CustomFields { get; set; } = new();
    public bool IsSeedData { get; set; } = false;

    // Audit
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Frontend PDF Download Pattern

```typescript
// Source: Follows attachment download pattern from ActivitiesController
// In QuoteService:
generatePdf(quoteId: string): Observable<Blob> {
  return this.api.getBlob(`${this.basePath}/${quoteId}/pdf`);
}

// In QuoteDetailComponent:
onGeneratePdf(): void {
  this.pdfGenerating.set(true);
  this.quoteService.generatePdf(this.quoteId).subscribe({
    next: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quote-${this.quote()?.quoteNumber}-v${this.quote()?.versionNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      this.pdfGenerating.set(false);
    },
    error: () => {
      this.snackBar.open('Failed to generate PDF', 'OK', { duration: 3000 });
      this.pdfGenerating.set(false);
    },
  });
}

// ApiService needs a getBlob method:
getBlob(path: string): Observable<Blob> {
  return this.http.get(`${this.baseUrl}${path}`, { responseType: 'blob' });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| iTextSharp for .NET PDF | QuestPDF fluent API | 2022-2023 | QuestPDF has become the de-facto standard for .NET PDF generation; iTextSharp has AGPL licensing issues |
| HTML-to-PDF via Puppeteer | Native .NET PDF with QuestPDF | 2023+ | No external process dependency, faster, no headless browser needed |
| Configurable workflow engines (database-driven) | Static state machine classes | Existing pattern | Simpler, type-safe, no DB queries for transition validation |

**Deprecated/outdated:**
- **iTextSharp/iText 5:** Essentially abandoned; iText 7 requires commercial license for closed-source
- **PdfSharp alone:** No layout engine, no automatic pagination for tables -- too low-level for document generation

## Open Questions

1. **Quote Number Format**
   - What we know: Quote numbers need to be unique per tenant and human-readable
   - What's unclear: Whether to use sequential (Q-0001, Q-0002) or date-based (Q-20260217-A1B2) format
   - Recommendation: Use sequential format with PostgreSQL SEQUENCE per tenant for simplicity. Format: `Q-{padded_number}` (e.g., Q-0001). Can be changed later without breaking existing data.

2. **Quote Status Workflow**
   - What we know: Quotes need states (Draft, Sent, Accepted, Rejected, Expired)
   - What's unclear: Whether status transitions should be as strict as Activity workflow
   - Recommendation: Use a simple progression: Draft -> Sent -> Accepted/Rejected/Expired. Allow Draft <- any state for revision. Use same static class pattern as ActivityWorkflow.

3. **Request Category - Enum vs Free Text**
   - What we know: REQS-04 says "requests have category"
   - What's unclear: Whether categories should be a fixed enum or free-text
   - Recommendation: Use a string field for Category with a set of suggested values in the frontend (dropdown with "Other" option). This avoids database migrations when new categories are needed.

4. **PDF Storage vs On-Demand Generation**
   - What we know: QUOT-05 requires PDF generation from quote
   - What's unclear: Whether PDFs should be stored (like attachments) or generated on-demand each time
   - Recommendation: Generate on-demand when user clicks "Download PDF". PDFs for quotes are typically small (<1MB) and quick to generate (<100ms). No need to store unless there's a specific requirement for immutable PDF snapshots.

## Sources

### Primary (HIGH confidence)
- **Existing codebase patterns** - Activity, ActivityWorkflow, Deal, DealProduct, Product entities directly inform Quote and Request design
- **EntityType enum** - Quote and Request already exist in the enum (Phase 2 planning prepared for this)
- **RoleTemplateSeeder.EnsurePermissionsForAllEntityTypesAsync** - Automatically adds RBAC permissions for new EntityType enum values
- **ActivityLink AllowedEntityTypes** - Already includes "Quote" and "Request" as valid link targets

### Secondary (MEDIUM confidence)
- [QuestPDF NuGet](https://www.nuget.org/packages/QuestPDF) - Version 2026.2.0 confirmed as latest
- [QuestPDF License](https://www.questpdf.com/license/) - Community license free for <$1M annual revenue
- [QuestPDF InvoiceDocument Example](https://github.com/QuestPDF/QuestPDF-ExampleInvoice) - Official example showing table/line-item pattern for invoices

### Tertiary (LOW confidence)
- None -- all findings verified through codebase inspection or official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - QuestPDF is well-established and verified; all other libraries already in use
- Architecture: HIGH - Every pattern directly extends existing codebase patterns (Deal, Activity, DealProduct)
- Pitfalls: HIGH - Financial calculation, concurrency, and versioning pitfalls are well-documented in industry

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable domain, patterns well-established)
