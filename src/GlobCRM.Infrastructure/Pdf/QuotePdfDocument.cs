using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace GlobCRM.Infrastructure.Pdf;

/// <summary>
/// QuestPDF IDocument implementation for generating quote PDFs.
/// Renders an A4 document with header, line items table, totals, and notes.
/// </summary>
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

    private void ComposeHeader(IContainer container)
    {
        container.PaddingBottom(15).Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text(_model.OrganizationName).FontSize(18).Bold();
                col.Item().PaddingTop(5).Text($"Quote #{_model.QuoteNumber} v{_model.VersionNumber}");
                col.Item().Text($"Status: {_model.Status}");
                col.Item().PaddingTop(5).Text($"Date: {_model.IssueDate:MMM dd, yyyy}");
                if (_model.ExpiryDate.HasValue)
                    col.Item().Text($"Valid Until: {_model.ExpiryDate.Value:MMM dd, yyyy}");
            });

            row.RelativeItem().AlignRight().Column(col =>
            {
                if (!string.IsNullOrWhiteSpace(_model.ContactName))
                    col.Item().Text($"Contact: {_model.ContactName}");
                if (!string.IsNullOrWhiteSpace(_model.CompanyName))
                    col.Item().Text($"Company: {_model.CompanyName}");
            });
        });
    }

    private void ComposeContent(IContainer container)
    {
        container.PaddingVertical(10).Column(col =>
        {
            // Title
            col.Item().Text(_model.Title).FontSize(14).Bold();

            // Description
            if (!string.IsNullOrWhiteSpace(_model.Description))
            {
                col.Item().PaddingTop(5).Text(_model.Description);
            }

            // Line items table
            col.Item().PaddingTop(15).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(30);    // #
                    columns.RelativeColumn(3);     // Description
                    columns.RelativeColumn(1);     // Qty
                    columns.RelativeColumn(1);     // Unit Price
                    columns.RelativeColumn(1);     // Discount %
                    columns.RelativeColumn(1);     // Tax %
                    columns.RelativeColumn(1);     // Total
                });

                // Header row
                table.Header(header =>
                {
                    header.Cell().BorderBottom(1).Padding(5).Text("#").Bold();
                    header.Cell().BorderBottom(1).Padding(5).Text("Description").Bold();
                    header.Cell().BorderBottom(1).Padding(5).AlignRight().Text("Qty").Bold();
                    header.Cell().BorderBottom(1).Padding(5).AlignRight().Text("Unit Price").Bold();
                    header.Cell().BorderBottom(1).Padding(5).AlignRight().Text("Discount%").Bold();
                    header.Cell().BorderBottom(1).Padding(5).AlignRight().Text("Tax%").Bold();
                    header.Cell().BorderBottom(1).Padding(5).AlignRight().Text("Total").Bold();
                });

                // Data rows
                foreach (var (item, index) in _model.LineItems.Select((li, i) => (li, i)))
                {
                    var bgColor = index % 2 == 0 ? Colors.White : Colors.Grey.Lighten4;

                    table.Cell().Background(bgColor).Padding(5).Text($"{index + 1}");
                    table.Cell().Background(bgColor).Padding(5).Text(item.Description);
                    table.Cell().Background(bgColor).Padding(5).AlignRight().Text($"{item.Quantity:G}");
                    table.Cell().Background(bgColor).Padding(5).AlignRight().Text($"{item.UnitPrice:N2}");
                    table.Cell().Background(bgColor).Padding(5).AlignRight().Text($"{item.DiscountPercent:G}%");
                    table.Cell().Background(bgColor).Padding(5).AlignRight().Text($"{item.TaxPercent:G}%");
                    table.Cell().Background(bgColor).Padding(5).AlignRight().Text($"{item.NetTotal:N2}");
                }
            });

            // Totals section
            col.Item().AlignRight().PaddingTop(15).Column(totals =>
            {
                totals.Item().Text($"Subtotal: {_model.Subtotal:N2}");
                totals.Item().Text($"Discount: -{_model.DiscountTotal:N2}");
                totals.Item().Text($"Tax: {_model.TaxTotal:N2}");
                totals.Item().PaddingTop(5).Text($"Grand Total: {_model.GrandTotal:N2}").Bold().FontSize(14);
            });

            // Notes section
            if (!string.IsNullOrWhiteSpace(_model.Notes))
            {
                col.Item().PaddingTop(25).Text("Notes").Bold().FontSize(11);
                col.Item().PaddingTop(5).Text(_model.Notes);
            }
        });
    }

    private void ComposeFooter(IContainer container)
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

/// <summary>
/// Data model for the quote PDF document.
/// Built from the Quote entity and its line items in the controller.
/// </summary>
public record QuotePdfModel
{
    public string OrganizationName { get; init; } = string.Empty;
    public string QuoteNumber { get; init; } = string.Empty;
    public int VersionNumber { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? ContactName { get; init; }
    public string? CompanyName { get; init; }
    public DateOnly IssueDate { get; init; }
    public DateOnly? ExpiryDate { get; init; }
    public List<QuotePdfLineItem> LineItems { get; init; } = new();
    public decimal Subtotal { get; init; }
    public decimal DiscountTotal { get; init; }
    public decimal TaxTotal { get; init; }
    public decimal GrandTotal { get; init; }
    public string? Notes { get; init; }
    public string Status { get; init; } = string.Empty;
}

/// <summary>
/// Line item model for the quote PDF.
/// </summary>
public record QuotePdfLineItem
{
    public string Description { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal DiscountPercent { get; init; }
    public decimal TaxPercent { get; init; }
    public decimal NetTotal { get; init; }
}
