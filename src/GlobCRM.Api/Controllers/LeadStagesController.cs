using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Admin REST endpoints for managing lead pipeline stages.
/// All endpoints require Admin role. Lead stages define the pipeline
/// that leads move through (e.g., New -> Contacted -> Qualified -> Converted/Lost).
/// </summary>
[ApiController]
[Route("api/lead-stages")]
[Authorize(Roles = "Admin")]
public class LeadStagesController : ControllerBase
{
    private readonly ILeadRepository _leadRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<LeadStagesController> _logger;

    public LeadStagesController(
        ILeadRepository leadRepository,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<LeadStagesController> logger)
    {
        _leadRepository = leadRepository;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Lists all lead stages ordered by SortOrder, with lead counts.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<LeadStageAdminDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList()
    {
        var stages = await _leadRepository.GetStagesAsync();

        // Load lead counts in a single query
        var stageIds = stages.Select(s => s.Id).ToList();
        var leadCounts = await _db.Leads
            .Where(l => stageIds.Contains(l.LeadStageId))
            .GroupBy(l => l.LeadStageId)
            .Select(g => new { StageId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StageId, x => x.Count);

        var dtos = stages.Select(s => new LeadStageAdminDto
        {
            Id = s.Id,
            Name = s.Name,
            SortOrder = s.SortOrder,
            Color = s.Color,
            IsConverted = s.IsConverted,
            IsLost = s.IsLost,
            LeadCount = leadCounts.GetValueOrDefault(s.Id, 0)
        }).ToList();

        return Ok(dtos);
    }

    /// <summary>
    /// Creates a new lead stage.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(LeadStageAdminDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateLeadStageRequest request)
    {
        var validator = new CreateLeadStageRequestValidator();
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

        var stage = new LeadStage
        {
            TenantId = tenantId,
            Name = request.Name,
            SortOrder = request.SortOrder,
            Color = request.Color ?? "#1976d2",
            IsConverted = request.IsConverted,
            IsLost = request.IsLost
        };

        _db.LeadStages.Add(stage);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead stage created: {StageName} ({StageId})", stage.Name, stage.Id);

        var dto = new LeadStageAdminDto
        {
            Id = stage.Id,
            Name = stage.Name,
            SortOrder = stage.SortOrder,
            Color = stage.Color,
            IsConverted = stage.IsConverted,
            IsLost = stage.IsLost,
            LeadCount = 0
        };

        return CreatedAtAction(nameof(GetList), dto);
    }

    /// <summary>
    /// Updates a lead stage. Cannot change IsConverted/IsLost on existing stages.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdateLeadStageRequest request)
    {
        var stage = await _db.LeadStages.FindAsync(id);
        if (stage is null)
            return NotFound(new { error = "Lead stage not found." });

        var validator = new AdminAdminUpdateLeadStageRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Cannot change terminal flags on existing stages
        if (request.IsConverted != stage.IsConverted || request.IsLost != stage.IsLost)
            return BadRequest(new { error = "Cannot change IsConverted or IsLost flags on existing stages." });

        stage.Name = request.Name;
        stage.SortOrder = request.SortOrder;
        stage.Color = request.Color ?? stage.Color;
        stage.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead stage updated: {StageId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a lead stage. Blocks if any leads reference this stage.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var stage = await _db.LeadStages.FindAsync(id);
        if (stage is null)
            return NotFound(new { error = "Lead stage not found." });

        var leadCount = await _db.Leads.CountAsync(l => l.LeadStageId == id);
        if (leadCount > 0)
        {
            return BadRequest(new
            {
                error = $"Stage '{stage.Name}' has {leadCount} lead(s). Reassign leads before deleting."
            });
        }

        _db.LeadStages.Remove(stage);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead stage deleted: {StageId}", id);

        return NoContent();
    }

    /// <summary>
    /// Reorders lead stages. Accepts an ordered list of stage IDs and updates SortOrder values.
    /// Terminal stages cannot be reordered before non-terminal stages.
    /// </summary>
    [HttpPost("reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Reorder([FromBody] ReorderLeadStagesRequest request)
    {
        if (request.StageIds is null || request.StageIds.Count == 0)
            return BadRequest(new { error = "Stage IDs are required." });

        var stages = await _db.LeadStages
            .Where(s => request.StageIds.Contains(s.Id))
            .ToListAsync();

        if (stages.Count != request.StageIds.Count)
            return BadRequest(new { error = "One or more stage IDs are invalid." });

        var stageMap = stages.ToDictionary(s => s.Id);

        // Validate terminal stages are not reordered before non-terminal stages
        var lastNonTerminalIndex = -1;
        for (var i = 0; i < request.StageIds.Count; i++)
        {
            var stage = stageMap[request.StageIds[i]];
            if (!stage.IsConverted && !stage.IsLost)
            {
                // Non-terminal: check that no terminal came before
                lastNonTerminalIndex = i;
            }
        }

        // Find first terminal stage index
        for (var i = 0; i < request.StageIds.Count; i++)
        {
            var stage = stageMap[request.StageIds[i]];
            if (stage.IsConverted || stage.IsLost)
            {
                if (i < lastNonTerminalIndex)
                {
                    return BadRequest(new { error = "Terminal stages (Converted/Lost) cannot be reordered before non-terminal stages." });
                }
            }
        }

        // Update sort orders
        for (var i = 0; i < request.StageIds.Count; i++)
        {
            var stage = stageMap[request.StageIds[i]];
            stage.SortOrder = i;
            stage.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Lead stages reordered: {Count} stages", request.StageIds.Count);

        return NoContent();
    }
}

// ---- DTOs ----

/// <summary>
/// Admin DTO for lead stage with lead count.
/// </summary>
public record LeadStageAdminDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string Color { get; init; } = string.Empty;
    public bool IsConverted { get; init; }
    public bool IsLost { get; init; }
    public int LeadCount { get; init; }
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a lead stage.
/// </summary>
public record CreateLeadStageRequest
{
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string? Color { get; init; }
    public bool IsConverted { get; init; }
    public bool IsLost { get; init; }
}

/// <summary>
/// Request body for updating a lead stage.
/// </summary>
public record AdminUpdateLeadStageRequest
{
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string? Color { get; init; }
    public bool IsConverted { get; init; }
    public bool IsLost { get; init; }
}

/// <summary>
/// Request body for reordering lead stages.
/// </summary>
public record ReorderLeadStagesRequest
{
    public List<Guid> StageIds { get; init; } = new();
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateLeadStageRequest.
/// </summary>
public class CreateLeadStageRequestValidator : AbstractValidator<CreateLeadStageRequest>
{
    public CreateLeadStageRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Stage name is required.")
            .MaximumLength(100).WithMessage("Stage name must be at most 100 characters.");
    }
}

/// <summary>
/// FluentValidation validator for AdminUpdateLeadStageRequest.
/// </summary>
public class AdminAdminUpdateLeadStageRequestValidator : AbstractValidator<AdminUpdateLeadStageRequest>
{
    public AdminAdminUpdateLeadStageRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Stage name is required.")
            .MaximumLength(100).WithMessage("Stage name must be at most 100 characters.");
    }
}
