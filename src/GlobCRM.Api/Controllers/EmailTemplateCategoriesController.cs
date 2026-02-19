using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for email template category CRUD operations.
/// Categories organize email templates into groups (e.g., Sales, Marketing, Support).
/// System categories (seeded) cannot be modified or deleted.
/// </summary>
[ApiController]
[Route("api/email-template-categories")]
[Authorize]
public class EmailTemplateCategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<EmailTemplateCategoriesController> _logger;

    public EmailTemplateCategoriesController(
        ApplicationDbContext db,
        ITenantProvider tenantProvider,
        ILogger<EmailTemplateCategoriesController> logger)
    {
        _db = db;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    /// <summary>
    /// Lists all email template categories for the current tenant.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<EmailTemplateCategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _db.EmailTemplateCategories
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();

        var dtos = categories.Select(EmailTemplateCategoryDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Creates a new email template category.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(EmailTemplateCategoryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Name is required." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var category = new EmailTemplateCategory
        {
            TenantId = tenantId,
            Name = request.Name,
            SortOrder = request.SortOrder ?? 0,
            IsSystem = false,
            IsSeedData = false
        };

        _db.EmailTemplateCategories.Add(category);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Email template category created: {CategoryName} ({CategoryId})", category.Name, category.Id);

        return CreatedAtAction(
            nameof(GetAll),
            null,
            EmailTemplateCategoryDto.FromEntity(category));
    }

    /// <summary>
    /// Updates an email template category. System categories cannot be updated.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCategoryRequest request)
    {
        var category = await _db.EmailTemplateCategories.FindAsync(id);
        if (category is null)
            return NotFound(new { error = "Category not found." });

        if (category.IsSystem)
            return BadRequest(new { error = "System categories cannot be modified." });

        category.Name = request.Name;
        if (request.SortOrder.HasValue)
            category.SortOrder = request.SortOrder.Value;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Email template category updated: {CategoryId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes an email template category. System categories cannot be deleted.
    /// Templates in the deleted category get CategoryId set to null.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var category = await _db.EmailTemplateCategories.FindAsync(id);
        if (category is null)
            return NotFound(new { error = "Category not found." });

        if (category.IsSystem)
            return BadRequest(new { error = "System categories cannot be deleted." });

        // Set CategoryId to null for templates in this category
        await _db.EmailTemplates
            .Where(t => t.CategoryId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.CategoryId, (Guid?)null));

        _db.EmailTemplateCategories.Remove(category);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Email template category deleted: {CategoryId}", id);

        return NoContent();
    }
}

// ---- DTOs ----

public record EmailTemplateCategoryDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsSystem { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static EmailTemplateCategoryDto FromEntity(EmailTemplateCategory entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        SortOrder = entity.SortOrder,
        IsSystem = entity.IsSystem,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- Request Records ----

public record CreateCategoryRequest(string Name, int? SortOrder);

public record UpdateCategoryRequest(string Name, int? SortOrder);
