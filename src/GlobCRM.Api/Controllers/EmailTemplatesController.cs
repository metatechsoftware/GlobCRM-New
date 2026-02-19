using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.EmailTemplates;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for email template CRUD operations with preview, test send, and clone.
/// Templates support Liquid merge fields rendered via Fluid library.
/// </summary>
[ApiController]
[Route("api/email-templates")]
[Authorize]
public class EmailTemplatesController : ControllerBase
{
    private readonly EmailTemplateRepository _templateRepository;
    private readonly TemplateRenderService _renderService;
    private readonly MergeFieldService _mergeFieldService;
    private readonly IEmailService _emailService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<EmailTemplatesController> _logger;

    public EmailTemplatesController(
        EmailTemplateRepository templateRepository,
        TemplateRenderService renderService,
        MergeFieldService mergeFieldService,
        IEmailService emailService,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<EmailTemplatesController> logger)
    {
        _templateRepository = templateRepository;
        _renderService = renderService;
        _mergeFieldService = mergeFieldService;
        _emailService = emailService;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Lists email templates with optional filtering by category, shared status, and search text.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:EmailTemplate:View")]
    [ProducesResponseType(typeof(List<EmailTemplateListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] Guid? categoryId,
        [FromQuery] bool? isShared,
        [FromQuery] string? search)
    {
        var templates = await _templateRepository.GetAllAsync(categoryId, isShared, search);
        var dtos = templates.Select(EmailTemplateListDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Gets a single email template by ID with full design JSON.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:EmailTemplate:View")]
    [ProducesResponseType(typeof(EmailTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Email template not found." });

        return Ok(EmailTemplateDto.FromEntity(template));
    }

    /// <summary>
    /// Creates a new email template. Sets OwnerId from current user claims.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:EmailTemplate:Create")]
    [ProducesResponseType(typeof(EmailTemplateListDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateEmailTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Name is required." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        var template = new EmailTemplate
        {
            TenantId = tenantId,
            Name = request.Name,
            Subject = request.Subject,
            DesignJson = request.DesignJson ?? "{}",
            HtmlBody = request.HtmlBody ?? string.Empty,
            CategoryId = request.CategoryId,
            IsShared = request.IsShared,
            OwnerId = userId
        };

        var created = await _templateRepository.CreateAsync(template);

        _logger.LogInformation("Email template created: {TemplateName} ({TemplateId})", created.Name, created.Id);

        // Re-fetch with includes for DTO mapping
        var fetched = await _templateRepository.GetByIdAsync(created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            EmailTemplateListDto.FromEntity(fetched!));
    }

    /// <summary>
    /// Updates an existing email template.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:EmailTemplate:Edit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateEmailTemplateRequest request)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Email template not found." });

        template.Name = request.Name;
        template.Subject = request.Subject;
        template.DesignJson = request.DesignJson ?? "{}";
        template.HtmlBody = request.HtmlBody ?? string.Empty;
        template.CategoryId = request.CategoryId;
        template.IsShared = request.IsShared;

        await _templateRepository.UpdateAsync(template);

        _logger.LogInformation("Email template updated: {TemplateId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes an email template.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:EmailTemplate:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Email template not found." });

        await _templateRepository.DeleteAsync(id);

        _logger.LogInformation("Email template deleted: {TemplateId}", id);

        return NoContent();
    }

    /// <summary>
    /// Clones an existing email template with a new name.
    /// </summary>
    [HttpPost("{id:guid}/clone")]
    [Authorize(Policy = "Permission:EmailTemplate:Create")]
    [ProducesResponseType(typeof(EmailTemplateListDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Clone(Guid id, [FromBody] CloneEmailTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Name is required for clone." });

        var cloned = await _templateRepository.CloneAsync(id, request.Name);
        if (cloned is null)
            return NotFound(new { error = "Email template not found." });

        // Set owner to current user
        cloned.OwnerId = GetCurrentUserId();
        await _templateRepository.UpdateAsync(cloned);

        _logger.LogInformation("Email template cloned: {SourceId} -> {CloneId} ({CloneName})", id, cloned.Id, cloned.Name);

        // Re-fetch with includes for DTO mapping
        var fetched = await _templateRepository.GetByIdAsync(cloned.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = cloned.Id },
            EmailTemplateListDto.FromEntity(fetched!));
    }

    /// <summary>
    /// Previews a rendered email template. If EntityType and EntityId are provided,
    /// resolves real entity data for rendering. Otherwise, uses sample placeholder data.
    /// </summary>
    [HttpPost("{id:guid}/preview")]
    [Authorize(Policy = "Permission:EmailTemplate:View")]
    [ProducesResponseType(typeof(EmailTemplatePreviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Preview(Guid id, [FromBody] PreviewEmailTemplateRequest request)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Email template not found." });

        var mergeData = await BuildMergeDataAsync(request.EntityType, request.EntityId);

        var renderedHtml = await _renderService.RenderAsync(template.HtmlBody, mergeData);
        var renderedSubject = template.Subject != null
            ? await _renderService.RenderAsync(template.Subject, mergeData)
            : string.Empty;

        return Ok(new EmailTemplatePreviewResponse(renderedHtml, renderedSubject));
    }

    /// <summary>
    /// Sends a test email of the rendered template to the current user's email address.
    /// </summary>
    [HttpPost("{id:guid}/test-send")]
    [Authorize(Policy = "Permission:EmailTemplate:View")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> TestSend(Guid id, [FromBody] TestSendRequest request)
    {
        var template = await _templateRepository.GetByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Email template not found." });

        var mergeData = await BuildMergeDataAsync(request.EntityType, request.EntityId);

        var renderedHtml = await _renderService.RenderAsync(template.HtmlBody, mergeData);
        var renderedSubject = template.Subject != null
            ? await _renderService.RenderAsync(template.Subject, mergeData)
            : "Test Email - " + template.Name;

        var userEmail = User.FindFirstValue(ClaimTypes.Email)
            ?? throw new InvalidOperationException("User email not found in claims.");

        try
        {
            await _emailService.SendRawEmailAsync(userEmail, renderedSubject, renderedHtml);

            _logger.LogInformation(
                "Test email sent for template {TemplateId} to {Email}", id, userEmail);

            return Ok(new { message = $"Test email sent to {userEmail}." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send test email for template {TemplateId}", id);
            return StatusCode(500, new { error = "Failed to send test email.", detail = ex.Message });
        }
    }

    /// <summary>
    /// Returns the count and list of workflows that reference this email template in their definition.
    /// Used to warn users before deleting a template that is used by active workflows.
    /// </summary>
    [HttpGet("{id:guid}/usage")]
    [Authorize(Policy = "Permission:EmailTemplate:View")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTemplateUsage(Guid id)
    {
        var templateIdStr = id.ToString();
        // Search workflows whose JSONB definition column contains this template ID as text
        var workflows = await _db.Database
            .SqlQueryRaw<WorkflowUsageResult>(
                "SELECT id AS \"Id\", name AS \"Name\" FROM workflows WHERE CAST(definition AS text) ILIKE {0}",
                $"%{templateIdStr}%")
            .ToListAsync();

        return Ok(new { usedByCount = workflows.Count, workflows });
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Builds merge data dictionary for template rendering.
    /// Uses real entity data if EntityType and EntityId are provided,
    /// otherwise returns sample placeholder data.
    /// </summary>
    private async Task<Dictionary<string, object?>> BuildMergeDataAsync(
        string? entityType, Guid? entityId)
    {
        if (!string.IsNullOrEmpty(entityType) && entityId.HasValue)
        {
            var entityData = await _mergeFieldService.ResolveEntityDataAsync(entityType, entityId.Value);
            return new Dictionary<string, object?>
            {
                [entityType.ToLower()] = entityData
            };
        }

        // Return sample/placeholder data for all entity types
        return GetSampleMergeData();
    }

    /// <summary>
    /// Returns sensible sample data for all supported entity types.
    /// Used when no specific entity is provided for preview.
    /// </summary>
    private static Dictionary<string, object?> GetSampleMergeData()
    {
        return new Dictionary<string, object?>
        {
            ["contact"] = new Dictionary<string, object?>
            {
                ["first_name"] = "John",
                ["last_name"] = "Doe",
                ["email"] = "john.doe@example.com",
                ["phone"] = "+1-555-0100",
                ["job_title"] = "VP of Sales",
                ["company"] = new Dictionary<string, object?>
                {
                    ["name"] = "Acme Corp"
                }
            },
            ["company"] = new Dictionary<string, object?>
            {
                ["name"] = "Acme Corp",
                ["industry"] = "Technology",
                ["website"] = "https://acme-example.com",
                ["phone"] = "+1-555-0100",
                ["address"] = "123 Main St, San Francisco, CA"
            },
            ["deal"] = new Dictionary<string, object?>
            {
                ["title"] = "Enterprise License Deal",
                ["value"] = 50000m,
                ["stage"] = "Proposal",
                ["probability"] = 0.50m,
                ["close_date"] = "2026-03-31",
                ["description"] = "Enterprise software licensing deal",
                ["company"] = new Dictionary<string, object?>
                {
                    ["name"] = "Acme Corp"
                }
            },
            ["lead"] = new Dictionary<string, object?>
            {
                ["first_name"] = "Jane",
                ["last_name"] = "Smith",
                ["email"] = "jane.smith@example.com",
                ["phone"] = "+1-555-0200",
                ["company_name"] = "TechStart Inc",
                ["title"] = "Marketing Director",
                ["source"] = new Dictionary<string, object?>
                {
                    ["name"] = "Website"
                }
            }
        };
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for email template list views.
/// </summary>
public record EmailTemplateListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Subject { get; init; }
    public Guid? CategoryId { get; init; }
    public string? CategoryName { get; init; }
    public bool IsShared { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public string HtmlBody { get; init; } = string.Empty;
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static EmailTemplateListDto FromEntity(EmailTemplate entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Subject = entity.Subject,
        CategoryId = entity.CategoryId,
        CategoryName = entity.Category?.Name,
        IsShared = entity.IsShared,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        HtmlBody = entity.HtmlBody,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for email template detail view including DesignJson.
/// </summary>
public record EmailTemplateDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Subject { get; init; }
    public string DesignJson { get; init; } = "{}";
    public string HtmlBody { get; init; } = string.Empty;
    public Guid? CategoryId { get; init; }
    public string? CategoryName { get; init; }
    public bool IsShared { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public bool IsSeedData { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static EmailTemplateDto FromEntity(EmailTemplate entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Subject = entity.Subject,
        DesignJson = entity.DesignJson,
        HtmlBody = entity.HtmlBody,
        CategoryId = entity.CategoryId,
        CategoryName = entity.Category?.Name,
        IsShared = entity.IsShared,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        IsSeedData = entity.IsSeedData,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- Request Records ----

public record CreateEmailTemplateRequest(
    string Name,
    string? Subject,
    string? DesignJson,
    string? HtmlBody,
    Guid? CategoryId,
    bool IsShared = true);

public record UpdateEmailTemplateRequest(
    string Name,
    string? Subject,
    string? DesignJson,
    string? HtmlBody,
    Guid? CategoryId,
    bool IsShared = true);

public record CloneEmailTemplateRequest(string Name);

public record PreviewEmailTemplateRequest(
    string? EntityType,
    Guid? EntityId);

public record TestSendRequest(
    string? EntityType,
    Guid? EntityId);

public record EmailTemplatePreviewResponse(
    string RenderedHtml,
    string RenderedSubject);

/// <summary>
/// Result type for raw SQL workflow usage queries.
/// </summary>
public record WorkflowUsageResult(Guid Id, string Name);
