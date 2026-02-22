using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.EmailTemplates;
using GlobCRM.Infrastructure.Services;
using GlobCRM.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for quote template CRUD, clone, set-default, thumbnail serving,
/// and merge field definitions. Templates store Unlayer design JSON and compiled HTML
/// for Playwright-based PDF generation with Fluid merge field rendering.
/// </summary>
[ApiController]
[Route("api/quote-templates")]
[Authorize]
public class QuoteTemplatesController : ControllerBase
{
    private readonly IQuoteTemplateRepository _templateRepository;
    private readonly IQuoteRepository _quoteRepository;
    private readonly PlaywrightPdfService _playwrightPdfService;
    private readonly TemplateRenderService _renderService;
    private readonly IFileStorageService _fileStorageService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<QuoteTemplatesController> _logger;

    public QuoteTemplatesController(
        IQuoteTemplateRepository templateRepository,
        IQuoteRepository quoteRepository,
        PlaywrightPdfService playwrightPdfService,
        TemplateRenderService renderService,
        IFileStorageService fileStorageService,
        ITenantProvider tenantProvider,
        ILogger<QuoteTemplatesController> logger)
    {
        _templateRepository = templateRepository;
        _quoteRepository = quoteRepository;
        _playwrightPdfService = playwrightPdfService;
        _renderService = renderService;
        _fileStorageService = fileStorageService;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- CRUD Endpoints ----

    /// <summary>
    /// Lists all quote templates for the current tenant.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(List<QuoteTemplateListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList()
    {
        var templates = await _templateRepository.GetAllAsync();
        var dtos = templates.Select(t => QuoteTemplateListDto.FromEntity(t, Url)).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Gets a single quote template by ID with full design JSON.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(QuoteTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Quote template not found." });

        return Ok(QuoteTemplateDto.FromEntity(template, Url));
    }

    /// <summary>
    /// Creates a new quote template. Generates a thumbnail asynchronously (fire-and-forget).
    /// If IsDefault=true, clears existing default first.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Quote:Edit")]
    [ProducesResponseType(typeof(QuoteTemplateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateQuoteTemplateRequest request)
    {
        var validator = new CreateQuoteTemplateValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        if (request.IsDefault)
        {
            await _templateRepository.ClearDefaultAsync();
        }

        var template = new QuoteTemplate
        {
            TenantId = tenantId,
            Name = request.Name,
            DesignJson = request.DesignJson,
            HtmlBody = request.HtmlBody,
            PageSize = request.PageSize,
            PageOrientation = request.PageOrientation,
            PageMarginTop = request.PageMarginTop,
            PageMarginRight = request.PageMarginRight,
            PageMarginBottom = request.PageMarginBottom,
            PageMarginLeft = request.PageMarginLeft,
            IsDefault = request.IsDefault,
            OwnerId = userId
        };

        await _templateRepository.AddAsync(template);

        _logger.LogInformation("Quote template created: {TemplateName} ({TemplateId})", template.Name, template.Id);

        // Fire-and-forget thumbnail generation
        _ = GenerateThumbnailAsync(template, tenantId);

        return CreatedAtAction(
            nameof(GetById),
            new { id = template.Id },
            QuoteTemplateDto.FromEntity(template, Url));
    }

    /// <summary>
    /// Updates an existing quote template. Re-generates thumbnail asynchronously.
    /// If IsDefault changed to true, clears existing default first.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:Edit")]
    [ProducesResponseType(typeof(QuoteTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateQuoteTemplateRequest request)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Quote template not found." });

        var validator = new UpdateQuoteTemplateValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        if (request.IsDefault && !template.IsDefault)
        {
            await _templateRepository.ClearDefaultAsync();
        }

        template.Name = request.Name;
        template.DesignJson = request.DesignJson;
        template.HtmlBody = request.HtmlBody;
        template.PageSize = request.PageSize;
        template.PageOrientation = request.PageOrientation;
        template.PageMarginTop = request.PageMarginTop;
        template.PageMarginRight = request.PageMarginRight;
        template.PageMarginBottom = request.PageMarginBottom;
        template.PageMarginLeft = request.PageMarginLeft;
        template.IsDefault = request.IsDefault;

        await _templateRepository.UpdateAsync(template);

        _logger.LogInformation("Quote template updated: {TemplateId}", id);

        // Fire-and-forget thumbnail re-generation
        _ = GenerateThumbnailAsync(template, tenantId);

        return Ok(QuoteTemplateDto.FromEntity(template, Url));
    }

    /// <summary>
    /// Deletes a quote template. Also removes the thumbnail file if present.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Quote:Edit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Quote template not found." });

        // Delete thumbnail file if present
        if (!string.IsNullOrEmpty(template.ThumbnailPath))
        {
            try
            {
                await _fileStorageService.DeleteFileAsync(template.ThumbnailPath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete thumbnail for template {TemplateId}", id);
            }
        }

        await _templateRepository.DeleteAsync(id);

        _logger.LogInformation("Quote template deleted: {TemplateId}", id);

        return NoContent();
    }

    // ---- Clone ----

    /// <summary>
    /// Clones a quote template with name "[OriginalName] (Copy)".
    /// IsDefault is always false on the clone. Generates thumbnail for the clone.
    /// </summary>
    [HttpPost("{id:guid}/clone")]
    [Authorize(Policy = "Permission:Quote:Edit")]
    [ProducesResponseType(typeof(QuoteTemplateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Clone(Guid id)
    {
        var original = await _templateRepository.GetByIdAsync(id);
        if (original is null)
            return NotFound(new { error = "Quote template not found." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        var clone = new QuoteTemplate
        {
            TenantId = tenantId,
            Name = $"{original.Name} (Copy)",
            DesignJson = original.DesignJson,
            HtmlBody = original.HtmlBody,
            PageSize = original.PageSize,
            PageOrientation = original.PageOrientation,
            PageMarginTop = original.PageMarginTop,
            PageMarginRight = original.PageMarginRight,
            PageMarginBottom = original.PageMarginBottom,
            PageMarginLeft = original.PageMarginLeft,
            IsDefault = false,
            OwnerId = userId
        };

        await _templateRepository.AddAsync(clone);

        _logger.LogInformation("Quote template cloned: {SourceId} -> {CloneId} ({CloneName})",
            id, clone.Id, clone.Name);

        // Fire-and-forget thumbnail generation
        _ = GenerateThumbnailAsync(clone, tenantId);

        return CreatedAtAction(
            nameof(GetById),
            new { id = clone.Id },
            QuoteTemplateDto.FromEntity(clone, Url));
    }

    // ---- Set Default ----

    /// <summary>
    /// Sets a quote template as the default for the tenant.
    /// Clears existing default first, then marks this template.
    /// </summary>
    [HttpPut("{id:guid}/set-default")]
    [Authorize(Policy = "Permission:Quote:Edit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetDefault(Guid id)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Quote template not found." });

        await _templateRepository.ClearDefaultAsync();

        template.IsDefault = true;
        await _templateRepository.UpdateAsync(template);

        _logger.LogInformation("Quote template set as default: {TemplateId}", id);

        return Ok(new { message = "Template set as default." });
    }

    // ---- Thumbnail ----

    /// <summary>
    /// Serves the PNG thumbnail for a quote template.
    /// Returns 404 if no thumbnail has been generated.
    /// </summary>
    [HttpGet("{id:guid}/thumbnail")]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetThumbnail(Guid id)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Quote template not found." });

        if (string.IsNullOrEmpty(template.ThumbnailPath))
            return NotFound(new { error = "No thumbnail available for this template." });

        var imageBytes = await _fileStorageService.GetFileAsync(template.ThumbnailPath);
        if (imageBytes is null)
            return NotFound(new { error = "Thumbnail file not found." });

        return File(imageBytes, "image/png");
    }

    // ---- Preview ----

    /// <summary>
    /// Renders a quote template with real quote data and returns HTML for preview display.
    /// If quoteId is not provided, uses sample placeholder data.
    /// </summary>
    [HttpGet("{templateId:guid}/preview")]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(typeof(ContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Preview(Guid templateId, [FromQuery] Guid? quoteId)
    {
        var template = await _templateRepository.GetByIdAsync(templateId);
        if (template is null)
            return NotFound(new { error = "Quote template not found." });

        Dictionary<string, object?> mergeData;

        if (quoteId.HasValue)
        {
            var quote = await _quoteRepository.GetByIdWithLineItemsAsync(quoteId.Value);
            if (quote is null)
                return NotFound(new { error = "Quote not found." });

            mergeData = await BuildQuoteMergeDataForPreviewAsync(quote);
        }
        else
        {
            mergeData = GetSampleMergeData();
        }

        var renderedHtml = await _renderService.RenderAsync(template.HtmlBody, mergeData);

        return Content(renderedHtml, "text/html");
    }

    /// <summary>
    /// Builds merge data from a real quote entity for preview rendering.
    /// </summary>
    private async Task<Dictionary<string, object?>> BuildQuoteMergeDataForPreviewAsync(Quote quote)
    {
        var org = await _tenantProvider.GetCurrentOrganizationAsync();

        var mergeData = new Dictionary<string, object?>
        {
            ["quote"] = new Dictionary<string, object?>
            {
                ["number"] = quote.QuoteNumber,
                ["title"] = quote.Title,
                ["description"] = quote.Description ?? string.Empty,
                ["status"] = quote.Status.ToString(),
                ["issue_date"] = quote.IssueDate.ToString("MMM dd, yyyy"),
                ["expiry_date"] = quote.ExpiryDate?.ToString("MMM dd, yyyy") ?? string.Empty,
                ["version"] = quote.VersionNumber.ToString(),
                ["subtotal"] = quote.Subtotal.ToString("N2"),
                ["discount_total"] = quote.DiscountTotal.ToString("N2"),
                ["tax_total"] = quote.TaxTotal.ToString("N2"),
                ["grand_total"] = quote.GrandTotal.ToString("N2"),
                ["notes"] = quote.Notes ?? string.Empty
            },
            ["line_items"] = quote.LineItems
                .OrderBy(li => li.SortOrder)
                .Select(li => new Dictionary<string, object?>
                {
                    ["description"] = li.Description,
                    ["quantity"] = li.Quantity.ToString("G"),
                    ["unit_price"] = li.UnitPrice.ToString("N2"),
                    ["discount_percent"] = li.DiscountPercent.ToString("G"),
                    ["tax_percent"] = li.TaxPercent.ToString("G"),
                    ["line_total"] = li.LineTotal.ToString("N2"),
                    ["discount_amount"] = li.DiscountAmount.ToString("N2"),
                    ["tax_amount"] = li.TaxAmount.ToString("N2"),
                    ["net_total"] = li.NetTotal.ToString("N2")
                })
                .ToList()
        };

        if (quote.Contact != null)
        {
            mergeData["contact"] = new Dictionary<string, object?>
            {
                ["first_name"] = quote.Contact.FirstName,
                ["last_name"] = quote.Contact.LastName,
                ["email"] = quote.Contact.Email,
                ["phone"] = quote.Contact.Phone,
                ["job_title"] = quote.Contact.JobTitle
            };
        }
        else
        {
            mergeData["contact"] = new Dictionary<string, object?>();
        }

        if (quote.Company != null)
        {
            mergeData["company"] = new Dictionary<string, object?>
            {
                ["name"] = quote.Company.Name,
                ["industry"] = quote.Company.Industry,
                ["website"] = quote.Company.Website,
                ["phone"] = quote.Company.Phone,
                ["address"] = quote.Company.Address
            };
        }
        else
        {
            mergeData["company"] = new Dictionary<string, object?>();
        }

        if (quote.Deal != null)
        {
            mergeData["deal"] = new Dictionary<string, object?>
            {
                ["title"] = quote.Deal.Title,
                ["value"] = quote.Deal.Value?.ToString("N2") ?? string.Empty,
                ["stage"] = quote.Deal.Stage?.Name,
                ["close_date"] = quote.Deal.ExpectedCloseDate?.ToString("MMM dd, yyyy") ?? string.Empty,
                ["description"] = quote.Deal.Description
            };
        }
        else
        {
            mergeData["deal"] = new Dictionary<string, object?>();
        }

        mergeData["organization"] = new Dictionary<string, object?>
        {
            ["name"] = org?.Name ?? string.Empty,
            ["logo_url"] = org?.LogoUrl ?? string.Empty,
            ["address"] = org?.Address ?? string.Empty,
            ["phone"] = org?.Phone ?? string.Empty,
            ["email"] = org?.Email ?? string.Empty,
            ["website"] = org?.Website ?? string.Empty
        };

        return mergeData;
    }

    // ---- Merge Fields ----

    /// <summary>
    /// Returns available merge field definitions for the quote template editor.
    /// Organized by category for Unlayer merge tag dropdown integration.
    /// </summary>
    [HttpGet("merge-fields")]
    [Authorize(Policy = "Permission:Quote:View")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetMergeFields()
    {
        var mergeFields = new Dictionary<string, List<QuoteMergeFieldDefinition>>
        {
            ["quote"] = new()
            {
                new("quote.number", "Quote Number"),
                new("quote.title", "Title"),
                new("quote.description", "Description"),
                new("quote.status", "Status"),
                new("quote.issue_date", "Issue Date"),
                new("quote.expiry_date", "Expiry Date"),
                new("quote.subtotal", "Subtotal"),
                new("quote.discount_total", "Discount Total"),
                new("quote.tax_total", "Tax Total"),
                new("quote.grand_total", "Grand Total"),
                new("quote.notes", "Notes"),
                new("quote.version", "Version"),
            },
            ["line_items"] = new()
            {
                new("description", "Description", true),
                new("quantity", "Quantity", true),
                new("unit_price", "Unit Price", true),
                new("discount_percent", "Discount %", true),
                new("tax_percent", "Tax %", true),
                new("line_total", "Line Total", true),
                new("discount_amount", "Discount Amount", true),
                new("tax_amount", "Tax Amount", true),
                new("net_total", "Net Total", true),
            },
            ["contact"] = new()
            {
                new("contact.first_name", "First Name"),
                new("contact.last_name", "Last Name"),
                new("contact.email", "Email"),
                new("contact.phone", "Phone"),
                new("contact.job_title", "Job Title"),
            },
            ["company"] = new()
            {
                new("company.name", "Company Name"),
                new("company.industry", "Industry"),
                new("company.website", "Website"),
                new("company.phone", "Phone"),
                new("company.address", "Address"),
            },
            ["deal"] = new()
            {
                new("deal.title", "Deal Title"),
                new("deal.value", "Value"),
                new("deal.stage", "Stage"),
                new("deal.close_date", "Close Date"),
                new("deal.description", "Description"),
            },
            ["organization"] = new()
            {
                new("organization.name", "Organization Name"),
                new("organization.logo_url", "Logo URL"),
                new("organization.address", "Address"),
                new("organization.phone", "Phone"),
                new("organization.email", "Email"),
                new("organization.website", "Website"),
            }
        };

        return Ok(mergeFields);
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Generates a PNG thumbnail for a template and saves it to file storage.
    /// Non-blocking: logs warning on failure but does not propagate exceptions.
    /// </summary>
    private async Task GenerateThumbnailAsync(QuoteTemplate template, Guid tenantId)
    {
        try
        {
            var sampleData = GetSampleMergeData();
            var renderedHtml = await _renderService.RenderAsync(template.HtmlBody, sampleData);
            var thumbnailBytes = await _playwrightPdfService.GenerateThumbnailAsync(renderedHtml);

            var fileName = $"{template.Id}.png";
            var storagePath = await _fileStorageService.SaveFileAsync(
                tenantId.ToString(), "quote-templates", fileName, thumbnailBytes);

            template.ThumbnailPath = storagePath;
            await _templateRepository.UpdateAsync(template);

            _logger.LogInformation("Thumbnail generated for quote template {TemplateId}", template.Id);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate thumbnail for quote template {TemplateId}", template.Id);
        }
    }

    /// <summary>
    /// Returns sample merge data for thumbnail generation and preview rendering.
    /// Uses realistic placeholder values for all merge field categories.
    /// </summary>
    private Dictionary<string, object?> GetSampleMergeData()
    {
        var org = _tenantProvider.GetCurrentOrganizationAsync().GetAwaiter().GetResult();
        var orgName = org?.Name ?? "Your Organization";

        return new Dictionary<string, object?>
        {
            ["quote"] = new Dictionary<string, object?>
            {
                ["number"] = "Q-0042",
                ["title"] = "Enterprise Software License",
                ["description"] = "Annual enterprise software licensing and support agreement",
                ["status"] = "Draft",
                ["issue_date"] = DateTime.UtcNow.ToString("MMM dd, yyyy"),
                ["expiry_date"] = DateTime.UtcNow.AddDays(30).ToString("MMM dd, yyyy"),
                ["subtotal"] = "10,000.00",
                ["discount_total"] = "500.00",
                ["tax_total"] = "1,710.00",
                ["grand_total"] = "11,210.00",
                ["notes"] = "Payment terms: Net 30 days from invoice date.",
                ["version"] = "1"
            },
            ["line_items"] = new List<Dictionary<string, object?>>
            {
                new()
                {
                    ["description"] = "Enterprise Software License (Annual)",
                    ["quantity"] = "5",
                    ["unit_price"] = "1,200.00",
                    ["discount_percent"] = "5",
                    ["tax_percent"] = "18",
                    ["line_total"] = "6,000.00",
                    ["discount_amount"] = "300.00",
                    ["tax_amount"] = "1,026.00",
                    ["net_total"] = "6,726.00"
                },
                new()
                {
                    ["description"] = "Premium Support Package",
                    ["quantity"] = "1",
                    ["unit_price"] = "4,000.00",
                    ["discount_percent"] = "5",
                    ["tax_percent"] = "18",
                    ["line_total"] = "4,000.00",
                    ["discount_amount"] = "200.00",
                    ["tax_amount"] = "684.00",
                    ["net_total"] = "4,484.00"
                }
            },
            ["contact"] = new Dictionary<string, object?>
            {
                ["first_name"] = "John",
                ["last_name"] = "Doe",
                ["email"] = "john.doe@example.com",
                ["phone"] = "+1-555-0100",
                ["job_title"] = "VP of Procurement"
            },
            ["company"] = new Dictionary<string, object?>
            {
                ["name"] = "Acme Corporation",
                ["industry"] = "Technology",
                ["website"] = "https://acme-example.com",
                ["phone"] = "+1-555-0200",
                ["address"] = "123 Main St, San Francisco, CA 94105"
            },
            ["deal"] = new Dictionary<string, object?>
            {
                ["title"] = "Enterprise License Deal",
                ["value"] = "50,000.00",
                ["stage"] = "Proposal",
                ["close_date"] = DateTime.UtcNow.AddDays(45).ToString("MMM dd, yyyy"),
                ["description"] = "Enterprise software licensing deal"
            },
            ["organization"] = new Dictionary<string, object?>
            {
                ["name"] = orgName,
                ["logo_url"] = org?.LogoUrl ?? "",
                ["address"] = org?.Address ?? "456 Business Ave, New York, NY 10001",
                ["phone"] = org?.Phone ?? "+1-555-0300",
                ["email"] = org?.Email ?? "info@example.com",
                ["website"] = org?.Website ?? "https://example.com"
            }
        };
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for quote template list views.
/// </summary>
public record QuoteTemplateListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public bool IsDefault { get; init; }
    public string PageSize { get; init; } = string.Empty;
    public string PageOrientation { get; init; } = string.Empty;
    public string? ThumbnailUrl { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static QuoteTemplateListDto FromEntity(QuoteTemplate entity, IUrlHelper url) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        IsDefault = entity.IsDefault,
        PageSize = entity.PageSize,
        PageOrientation = entity.PageOrientation,
        ThumbnailUrl = !string.IsNullOrEmpty(entity.ThumbnailPath)
            ? url.Action("GetThumbnail", "QuoteTemplates", new { id = entity.Id })
            : null,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for quote template detail view including DesignJson and HtmlBody.
/// </summary>
public record QuoteTemplateDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public bool IsDefault { get; init; }
    public string DesignJson { get; init; } = string.Empty;
    public string HtmlBody { get; init; } = string.Empty;
    public string PageSize { get; init; } = string.Empty;
    public string PageOrientation { get; init; } = string.Empty;
    public string PageMarginTop { get; init; } = string.Empty;
    public string PageMarginRight { get; init; } = string.Empty;
    public string PageMarginBottom { get; init; } = string.Empty;
    public string PageMarginLeft { get; init; } = string.Empty;
    public string? ThumbnailUrl { get; init; }
    public Guid? OwnerId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static QuoteTemplateDto FromEntity(QuoteTemplate entity, IUrlHelper url) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        IsDefault = entity.IsDefault,
        DesignJson = entity.DesignJson,
        HtmlBody = entity.HtmlBody,
        PageSize = entity.PageSize,
        PageOrientation = entity.PageOrientation,
        PageMarginTop = entity.PageMarginTop,
        PageMarginRight = entity.PageMarginRight,
        PageMarginBottom = entity.PageMarginBottom,
        PageMarginLeft = entity.PageMarginLeft,
        ThumbnailUrl = !string.IsNullOrEmpty(entity.ThumbnailPath)
            ? url.Action("GetThumbnail", "QuoteTemplates", new { id = entity.Id })
            : null,
        OwnerId = entity.OwnerId,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- Request Records ----

/// <summary>
/// Request body for creating a quote template.
/// </summary>
public record CreateQuoteTemplateRequest
{
    public string Name { get; init; } = string.Empty;
    public string DesignJson { get; init; } = string.Empty;
    public string HtmlBody { get; init; } = string.Empty;
    public string PageSize { get; init; } = "A4";
    public string PageOrientation { get; init; } = "portrait";
    public string PageMarginTop { get; init; } = "20mm";
    public string PageMarginRight { get; init; } = "15mm";
    public string PageMarginBottom { get; init; } = "20mm";
    public string PageMarginLeft { get; init; } = "15mm";
    public bool IsDefault { get; init; }
}

/// <summary>
/// Request body for updating a quote template.
/// </summary>
public record UpdateQuoteTemplateRequest
{
    public string Name { get; init; } = string.Empty;
    public string DesignJson { get; init; } = string.Empty;
    public string HtmlBody { get; init; } = string.Empty;
    public string PageSize { get; init; } = "A4";
    public string PageOrientation { get; init; } = "portrait";
    public string PageMarginTop { get; init; } = "20mm";
    public string PageMarginRight { get; init; } = "15mm";
    public string PageMarginBottom { get; init; } = "20mm";
    public string PageMarginLeft { get; init; } = "15mm";
    public bool IsDefault { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateQuoteTemplateRequest.
/// </summary>
public class CreateQuoteTemplateValidator : AbstractValidator<CreateQuoteTemplateRequest>
{
    private static readonly string[] ValidPageSizes = ["A4", "Letter"];
    private static readonly string[] ValidOrientations = ["portrait", "landscape"];

    public CreateQuoteTemplateValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Template name is required.")
            .MaximumLength(200).WithMessage("Template name must be at most 200 characters.");

        RuleFor(x => x.DesignJson)
            .NotEmpty().WithMessage("Design JSON is required.");

        RuleFor(x => x.HtmlBody)
            .NotEmpty().WithMessage("HTML body is required.");

        RuleFor(x => x.PageSize)
            .Must(s => ValidPageSizes.Contains(s))
            .WithMessage("Page size must be 'A4' or 'Letter'.");

        RuleFor(x => x.PageOrientation)
            .Must(o => ValidOrientations.Contains(o))
            .WithMessage("Page orientation must be 'portrait' or 'landscape'.");
    }
}

/// <summary>
/// FluentValidation validator for UpdateQuoteTemplateRequest.
/// </summary>
public class UpdateQuoteTemplateValidator : AbstractValidator<UpdateQuoteTemplateRequest>
{
    private static readonly string[] ValidPageSizes = ["A4", "Letter"];
    private static readonly string[] ValidOrientations = ["portrait", "landscape"];

    public UpdateQuoteTemplateValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Template name is required.")
            .MaximumLength(200).WithMessage("Template name must be at most 200 characters.");

        RuleFor(x => x.DesignJson)
            .NotEmpty().WithMessage("Design JSON is required.");

        RuleFor(x => x.HtmlBody)
            .NotEmpty().WithMessage("HTML body is required.");

        RuleFor(x => x.PageSize)
            .Must(s => ValidPageSizes.Contains(s))
            .WithMessage("Page size must be 'A4' or 'Letter'.");

        RuleFor(x => x.PageOrientation)
            .Must(o => ValidOrientations.Contains(o))
            .WithMessage("Page orientation must be 'portrait' or 'landscape'.");
    }
}

/// <summary>
/// Merge field definition for the template editor.
/// </summary>
/// <param name="Key">Merge tag key (e.g., "quote.number", "description" for line items).</param>
/// <param name="Label">Human-readable label for the editor UI.</param>
/// <param name="IsLineItem">Whether this field is used inside a line_items loop.</param>
public record QuoteMergeFieldDefinition(string Key, string Label, bool IsLineItem = false);
