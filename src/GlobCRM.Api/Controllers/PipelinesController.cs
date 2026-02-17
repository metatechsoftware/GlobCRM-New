using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Pipeline admin management with stage CRUD.
/// All endpoints require Admin role. Pipelines are admin-configured entities
/// that define the stages deals move through.
/// </summary>
[ApiController]
[Route("api/pipelines")]
[Authorize(Roles = "Admin")]
public class PipelinesController : ControllerBase
{
    private readonly IPipelineRepository _pipelineRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<PipelinesController> _logger;

    public PipelinesController(
        IPipelineRepository pipelineRepository,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<PipelinesController> logger)
    {
        _pipelineRepository = pipelineRepository;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    // ---- Pipeline CRUD ----

    /// <summary>
    /// Lists all pipelines with stages for the current tenant.
    /// No pagination needed (few pipelines per tenant).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<PipelineDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList()
    {
        var pipelines = await _pipelineRepository.GetAllAsync();

        var dtos = pipelines.Select(p => new PipelineDto
        {
            Id = p.Id,
            Name = p.Name,
            Description = p.Description,
            TeamId = p.TeamId,
            TeamName = p.Team?.Name,
            IsDefault = p.IsDefault,
            StageCount = p.Stages.Count,
            DealCount = 0, // Lightweight list — deal count loaded separately if needed
            CreatedAt = p.CreatedAt
        }).ToList();

        // Load deal counts in a single query
        var pipelineIds = pipelines.Select(p => p.Id).ToList();
        var dealCounts = await _db.Deals
            .Where(d => pipelineIds.Contains(d.PipelineId))
            .GroupBy(d => d.PipelineId)
            .Select(g => new { PipelineId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PipelineId, x => x.Count);

        foreach (var dto in dtos)
        {
            dto.DealCount = dealCounts.GetValueOrDefault(dto.Id, 0);
        }

        return Ok(dtos);
    }

    /// <summary>
    /// Gets a single pipeline with ordered stages.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PipelineDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var pipeline = await _pipelineRepository.GetByIdWithStagesAsync(id);
        if (pipeline is null)
            return NotFound(new { error = "Pipeline not found." });

        var dealCount = await _db.Deals.CountAsync(d => d.PipelineId == id);

        var dto = new PipelineDetailDto
        {
            Id = pipeline.Id,
            Name = pipeline.Name,
            Description = pipeline.Description,
            TeamId = pipeline.TeamId,
            TeamName = pipeline.Team?.Name,
            IsDefault = pipeline.IsDefault,
            StageCount = pipeline.Stages.Count,
            DealCount = dealCount,
            CreatedAt = pipeline.CreatedAt,
            Stages = pipeline.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto
            {
                Id = s.Id,
                Name = s.Name,
                SortOrder = s.SortOrder,
                Color = s.Color,
                DefaultProbability = s.DefaultProbability,
                IsWon = s.IsWon,
                IsLost = s.IsLost,
                RequiredFields = s.RequiredFields
            }).ToList()
        };

        return Ok(dto);
    }

    /// <summary>
    /// Creates a new pipeline with stages.
    /// If isDefault is true, unsets other pipeline's IsDefault.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(PipelineDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreatePipelineRequest request)
    {
        var validator = new CreatePipelineRequestValidator();
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

        // If marking as default, unset other pipelines' IsDefault
        if (request.IsDefault)
        {
            var existingPipelines = await _pipelineRepository.GetAllAsync();
            foreach (var existing in existingPipelines.Where(p => p.IsDefault))
            {
                existing.IsDefault = false;
                await _pipelineRepository.UpdateAsync(existing);
            }
        }

        var pipeline = new Pipeline
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            TeamId = request.TeamId,
            IsDefault = request.IsDefault,
            Stages = request.Stages.Select(s => new PipelineStage
            {
                Name = s.Name,
                SortOrder = s.SortOrder,
                Color = s.Color ?? "#1976d2",
                DefaultProbability = s.DefaultProbability,
                IsWon = s.IsWon,
                IsLost = s.IsLost,
                RequiredFields = s.RequiredFields ?? new Dictionary<string, object?>()
            }).ToList()
        };

        var created = await _pipelineRepository.CreateAsync(pipeline);

        _logger.LogInformation("Pipeline created: {PipelineName} ({PipelineId})", created.Name, created.Id);

        var dto = new PipelineDetailDto
        {
            Id = created.Id,
            Name = created.Name,
            Description = created.Description,
            TeamId = created.TeamId,
            IsDefault = created.IsDefault,
            StageCount = created.Stages.Count,
            DealCount = 0,
            CreatedAt = created.CreatedAt,
            Stages = created.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto
            {
                Id = s.Id,
                Name = s.Name,
                SortOrder = s.SortOrder,
                Color = s.Color,
                DefaultProbability = s.DefaultProbability,
                IsWon = s.IsWon,
                IsLost = s.IsLost,
                RequiredFields = s.RequiredFields
            }).ToList()
        };

        return CreatedAtAction(nameof(GetById), new { id = created.Id }, dto);
    }

    /// <summary>
    /// Updates a pipeline and its stages. Full replacement of stages array.
    /// Checks HasDealsInStageAsync before removing a stage that has deals.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePipelineRequest request)
    {
        var pipeline = await _pipelineRepository.GetByIdWithStagesAsync(id);
        if (pipeline is null)
            return NotFound(new { error = "Pipeline not found." });

        var validator = new UpdatePipelineRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // If marking as default, unset other pipelines' IsDefault
        if (request.IsDefault && !pipeline.IsDefault)
        {
            var existingPipelines = await _pipelineRepository.GetAllAsync();
            foreach (var existing in existingPipelines.Where(p => p.IsDefault && p.Id != id))
            {
                existing.IsDefault = false;
                await _pipelineRepository.UpdateAsync(existing);
            }
        }

        // Check for stages being removed that have deals
        var existingStageIds = pipeline.Stages.Select(s => s.Id).ToHashSet();
        var newStageIds = request.Stages
            .Where(s => s.Id.HasValue)
            .Select(s => s.Id!.Value)
            .ToHashSet();

        var removedStageIds = existingStageIds.Except(newStageIds).ToList();
        foreach (var removedStageId in removedStageIds)
        {
            var hasDeals = await _pipelineRepository.HasDealsInStageAsync(removedStageId);
            if (hasDeals)
            {
                var stageName = pipeline.Stages.First(s => s.Id == removedStageId).Name;
                return BadRequest(new
                {
                    error = $"Stage '{stageName}' has active deals. Reassign deals before removing."
                });
            }
        }

        // Update pipeline properties
        pipeline.Name = request.Name;
        pipeline.Description = request.Description;
        pipeline.TeamId = request.TeamId;
        pipeline.IsDefault = request.IsDefault;

        // Remove deleted stages
        var stagesToRemove = pipeline.Stages.Where(s => removedStageIds.Contains(s.Id)).ToList();
        foreach (var stage in stagesToRemove)
        {
            _db.PipelineStages.Remove(stage);
            pipeline.Stages.Remove(stage);
        }

        // Update existing and add new stages
        foreach (var stageReq in request.Stages)
        {
            if (stageReq.Id.HasValue)
            {
                // Update existing stage
                var existing = pipeline.Stages.FirstOrDefault(s => s.Id == stageReq.Id.Value);
                if (existing is not null)
                {
                    existing.Name = stageReq.Name;
                    existing.SortOrder = stageReq.SortOrder;
                    existing.Color = stageReq.Color ?? "#1976d2";
                    existing.DefaultProbability = stageReq.DefaultProbability;
                    existing.IsWon = stageReq.IsWon;
                    existing.IsLost = stageReq.IsLost;
                    existing.RequiredFields = stageReq.RequiredFields ?? new Dictionary<string, object?>();
                    existing.UpdatedAt = DateTimeOffset.UtcNow;
                }
            }
            else
            {
                // Add new stage
                pipeline.Stages.Add(new PipelineStage
                {
                    PipelineId = pipeline.Id,
                    Name = stageReq.Name,
                    SortOrder = stageReq.SortOrder,
                    Color = stageReq.Color ?? "#1976d2",
                    DefaultProbability = stageReq.DefaultProbability,
                    IsWon = stageReq.IsWon,
                    IsLost = stageReq.IsLost,
                    RequiredFields = stageReq.RequiredFields ?? new Dictionary<string, object?>()
                });
            }
        }

        await _pipelineRepository.UpdateAsync(pipeline);

        _logger.LogInformation("Pipeline updated: {PipelineId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a pipeline. Blocks if pipeline has any deals.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var pipeline = await _pipelineRepository.GetByIdWithStagesAsync(id);
        if (pipeline is null)
            return NotFound(new { error = "Pipeline not found." });

        var dealCount = await _db.Deals.CountAsync(d => d.PipelineId == id);
        if (dealCount > 0)
        {
            return BadRequest(new
            {
                error = $"Pipeline '{pipeline.Name}' has {dealCount} deal(s). Remove all deals before deleting."
            });
        }

        await _pipelineRepository.DeleteAsync(id);

        _logger.LogInformation("Pipeline deleted: {PipelineId}", id);

        return NoContent();
    }

    // ---- Stage Listing ----

    /// <summary>
    /// Lists stages for a pipeline (useful for dropdowns).
    /// </summary>
    [HttpGet("{id:guid}/stages")]
    [ProducesResponseType(typeof(List<PipelineStageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStages(Guid id)
    {
        var pipeline = await _pipelineRepository.GetByIdWithStagesAsync(id);
        if (pipeline is null)
            return NotFound(new { error = "Pipeline not found." });

        var dtos = pipeline.Stages.OrderBy(s => s.SortOrder).Select(s => new PipelineStageDto
        {
            Id = s.Id,
            Name = s.Name,
            SortOrder = s.SortOrder,
            Color = s.Color,
            DefaultProbability = s.DefaultProbability,
            IsWon = s.IsWon,
            IsLost = s.IsLost,
            RequiredFields = s.RequiredFields
        }).ToList();

        return Ok(dtos);
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for pipeline list views.
/// </summary>
public record PipelineDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? TeamId { get; init; }
    public string? TeamName { get; init; }
    public bool IsDefault { get; init; }
    public int StageCount { get; init; }
    public int DealCount { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Detailed DTO for pipeline detail view including ordered stages.
/// </summary>
public record PipelineDetailDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? TeamId { get; init; }
    public string? TeamName { get; init; }
    public bool IsDefault { get; init; }
    public int StageCount { get; init; }
    public int DealCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public List<PipelineStageDto> Stages { get; init; } = new();
}

/// <summary>
/// DTO for pipeline stage information.
/// </summary>
public record PipelineStageDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string Color { get; init; } = "#1976d2";
    public decimal DefaultProbability { get; init; }
    public bool IsWon { get; init; }
    public bool IsLost { get; init; }
    public Dictionary<string, object?> RequiredFields { get; init; } = new();
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a pipeline with stages.
/// </summary>
public record CreatePipelineRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? TeamId { get; init; }
    public bool IsDefault { get; init; }
    public List<CreateStageRequest> Stages { get; init; } = new();
}

/// <summary>
/// Request body for creating a pipeline stage.
/// </summary>
public record CreateStageRequest
{
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string? Color { get; init; }
    public decimal DefaultProbability { get; init; }
    public bool IsWon { get; init; }
    public bool IsLost { get; init; }
    public Dictionary<string, object?>? RequiredFields { get; init; }
}

/// <summary>
/// Request body for updating a pipeline with stages.
/// </summary>
public record UpdatePipelineRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? TeamId { get; init; }
    public bool IsDefault { get; init; }
    public List<UpdateStageRequest> Stages { get; init; } = new();
}

/// <summary>
/// Request body for updating a pipeline stage.
/// Existing stages have an Id; new stages have null Id.
/// </summary>
public record UpdateStageRequest
{
    public Guid? Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public string? Color { get; init; }
    public decimal DefaultProbability { get; init; }
    public bool IsWon { get; init; }
    public bool IsLost { get; init; }
    public Dictionary<string, object?>? RequiredFields { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreatePipelineRequest.
/// </summary>
public class CreatePipelineRequestValidator : AbstractValidator<CreatePipelineRequest>
{
    public CreatePipelineRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Pipeline name is required.")
            .MaximumLength(200).WithMessage("Pipeline name must be at most 200 characters.");

        RuleFor(x => x.Stages)
            .NotEmpty().WithMessage("At least one stage is required.");

        RuleForEach(x => x.Stages).ChildRules(stage =>
        {
            stage.RuleFor(s => s.Name)
                .NotEmpty().WithMessage("Stage name is required.")
                .MaximumLength(100).WithMessage("Stage name must be at most 100 characters.");
        });
    }
}

/// <summary>
/// FluentValidation validator for UpdatePipelineRequest.
/// </summary>
public class UpdatePipelineRequestValidator : AbstractValidator<UpdatePipelineRequest>
{
    public UpdatePipelineRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Pipeline name is required.")
            .MaximumLength(200).WithMessage("Pipeline name must be at most 200 characters.");

        RuleFor(x => x.Stages)
            .NotEmpty().WithMessage("At least one stage is required.");

        RuleForEach(x => x.Stages).ChildRules(stage =>
        {
            stage.RuleFor(s => s.Name)
                .NotEmpty().WithMessage("Stage name is required.")
                .MaximumLength(100).WithMessage("Stage name must be at most 100 characters.");
        });
    }
}
