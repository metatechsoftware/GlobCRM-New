using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Admin REST endpoints for managing lead sources.
/// All endpoints require Admin role. Lead sources define where leads come from
/// (e.g., Website, Referral, LinkedIn, Cold Call).
/// </summary>
[ApiController]
[Route("api/lead-sources")]
[Authorize(Roles = "Admin")]
public class LeadSourcesController : ControllerBase
{
    private readonly ILeadRepository _leadRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<LeadSourcesController> _logger;

    public LeadSourcesController(
        ILeadRepository leadRepository,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<LeadSourcesController> logger)
    {
        _leadRepository = leadRepository;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Lists all lead sources ordered by SortOrder, with lead counts.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<LeadSourceAdminDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList()
    {
        var sources = await _leadRepository.GetSourcesAsync();

        // Load lead counts in a single query
        var sourceIds = sources.Select(s => s.Id).ToList();
        var leadCounts = await _db.Leads
            .Where(l => l.LeadSourceId.HasValue && sourceIds.Contains(l.LeadSourceId.Value))
            .GroupBy(l => l.LeadSourceId!.Value)
            .Select(g => new { SourceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SourceId, x => x.Count);

        var dtos = sources.Select(s => new LeadSourceAdminDto
        {
            Id = s.Id,
            Name = s.Name,
            SortOrder = s.SortOrder,
            IsDefault = s.IsDefault,
            LeadCount = leadCounts.GetValueOrDefault(s.Id, 0)
        }).ToList();

        return Ok(dtos);
    }

    /// <summary>
    /// Creates a new lead source.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(LeadSourceAdminDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateLeadSourceRequest request)
    {
        var validator = new CreateLeadSourceRequestValidator();
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

        // If marking as default, unset other sources' IsDefault
        if (request.IsDefault)
        {
            var existingSources = await _leadRepository.GetSourcesAsync();
            foreach (var existing in existingSources.Where(s => s.IsDefault))
            {
                existing.IsDefault = false;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        var source = new LeadSource
        {
            TenantId = tenantId,
            Name = request.Name,
            SortOrder = request.SortOrder,
            IsDefault = request.IsDefault
        };

        _db.LeadSources.Add(source);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead source created: {SourceName} ({SourceId})", source.Name, source.Id);

        var dto = new LeadSourceAdminDto
        {
            Id = source.Id,
            Name = source.Name,
            SortOrder = source.SortOrder,
            IsDefault = source.IsDefault,
            LeadCount = 0
        };

        return CreatedAtAction(nameof(GetList), dto);
    }

    /// <summary>
    /// Updates a lead source name and settings.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLeadSourceRequest request)
    {
        var source = await _db.LeadSources.FindAsync(id);
        if (source is null)
            return NotFound(new { error = "Lead source not found." });

        var validator = new UpdateLeadSourceRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // If marking as default, unset other sources' IsDefault
        if (request.IsDefault && !source.IsDefault)
        {
            var existingSources = await _leadRepository.GetSourcesAsync();
            foreach (var existing in existingSources.Where(s => s.IsDefault && s.Id != id))
            {
                existing.IsDefault = false;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        source.Name = request.Name;
        source.SortOrder = request.SortOrder;
        source.IsDefault = request.IsDefault;
        source.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead source updated: {SourceId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a lead source. If leads reference it, sets their SourceId to null.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var source = await _db.LeadSources.FindAsync(id);
        if (source is null)
            return NotFound(new { error = "Lead source not found." });

        // Set leads' SourceId to null before deleting
        var affectedLeads = await _db.Leads
            .Where(l => l.LeadSourceId == id)
            .ToListAsync();

        foreach (var lead in affectedLeads)
        {
            lead.LeadSourceId = null;
            lead.UpdatedAt = DateTimeOffset.UtcNow;
        }

        _db.LeadSources.Remove(source);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead source deleted: {SourceId}. {Count} leads updated.", id, affectedLeads.Count);

        return NoContent();
    }
}

// ---- DTOs ----

/// <summary>
/// Admin DTO for lead source with lead count.
/// </summary>
public record LeadSourceAdminDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsDefault { get; init; }
    public int LeadCount { get; init; }
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a lead source.
/// </summary>
public record CreateLeadSourceRequest
{
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsDefault { get; init; }
}

/// <summary>
/// Request body for updating a lead source.
/// </summary>
public record UpdateLeadSourceRequest
{
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsDefault { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateLeadSourceRequest.
/// </summary>
public class CreateLeadSourceRequestValidator : AbstractValidator<CreateLeadSourceRequest>
{
    public CreateLeadSourceRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Source name is required.")
            .MaximumLength(100).WithMessage("Source name must be at most 100 characters.");
    }
}

/// <summary>
/// FluentValidation validator for UpdateLeadSourceRequest.
/// </summary>
public class UpdateLeadSourceRequestValidator : AbstractValidator<UpdateLeadSourceRequest>
{
    public UpdateLeadSourceRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Source name is required.")
            .MaximumLength(100).WithMessage("Source name must be at most 100 characters.");
    }
}
