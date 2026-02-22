namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a custom quote PDF template in the CRM.
/// Templates store an Unlayer design JSON for re-editing and compiled HTML for rendering.
/// Each template has configurable page settings (size, orientation, margins) and an optional
/// PNG thumbnail for visual preview in the template gallery.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class QuoteTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the template (e.g., "Standard Quote", "Detailed Proposal").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Unlayer design state JSON for re-editing in the visual editor.
    /// Stored as JSONB in PostgreSQL.
    /// </summary>
    public string DesignJson { get; set; } = string.Empty;

    /// <summary>
    /// Compiled HTML output from Unlayer exportHtml.
    /// Contains merge tag placeholders (e.g., {{quote.number}}) and Fluid loop syntax
    /// (e.g., {% for item in line_items %}) that are rendered with real data at PDF generation time.
    /// Stored as text in PostgreSQL.
    /// </summary>
    public string HtmlBody { get; set; } = string.Empty;

    /// <summary>
    /// Whether this is the default template for the tenant.
    /// Only one template per tenant should be marked as default.
    /// </summary>
    public bool IsDefault { get; set; } = false;

    /// <summary>
    /// Page size for PDF generation. Supports "A4" (210x297mm) or "Letter" (8.5x11in).
    /// </summary>
    public string PageSize { get; set; } = "A4";

    /// <summary>
    /// Page orientation for PDF generation. Supports "portrait" or "landscape".
    /// </summary>
    public string PageOrientation { get; set; } = "portrait";

    /// <summary>
    /// Top margin for PDF page (e.g., "20mm", "0.75in").
    /// </summary>
    public string PageMarginTop { get; set; } = "20mm";

    /// <summary>
    /// Right margin for PDF page (e.g., "15mm", "0.75in").
    /// </summary>
    public string PageMarginRight { get; set; } = "15mm";

    /// <summary>
    /// Bottom margin for PDF page (e.g., "20mm", "0.75in").
    /// </summary>
    public string PageMarginBottom { get; set; } = "20mm";

    /// <summary>
    /// Left margin for PDF page (e.g., "15mm", "0.75in").
    /// </summary>
    public string PageMarginLeft { get; set; } = "15mm";

    /// <summary>
    /// File storage path to PNG thumbnail image.
    /// Generated server-side via Playwright screenshot when template is saved.
    /// Null if thumbnail has not been generated yet.
    /// </summary>
    public string? ThumbnailPath { get; set; }

    /// <summary>
    /// User who owns this template. Used for scope-based permission filtering (Own, Team, All).
    /// Set to null if the owner is deleted (SET NULL on delete).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Navigation property to the template owner.
    /// </summary>
    public ApplicationUser? Owner { get; set; }

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
