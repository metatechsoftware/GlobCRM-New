using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Admin endpoints for managing duplicate matching configuration per entity type.
/// Controls auto-detection, similarity thresholds, and matching field weights.
/// </summary>
[ApiController]
[Route("api/duplicate-settings")]
[Authorize(Roles = "Admin")]
public class DuplicateSettingsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<DuplicateSettingsController> _logger;

    public DuplicateSettingsController(
        ApplicationDbContext db,
        ITenantProvider tenantProvider,
        ILogger<DuplicateSettingsController> logger)
    {
        _db = db;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    /// <summary>
    /// List all duplicate matching configs for the current tenant.
    /// If no configs exist, creates defaults for Contact and Company.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<DuplicateSettingsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var configs = await _db.DuplicateMatchingConfigs.ToListAsync();

        // Auto-create defaults if none exist
        if (configs.Count == 0)
        {
            var tenantId = _tenantProvider.GetTenantId()
                ?? throw new InvalidOperationException("No tenant context.");

            configs = CreateDefaultConfigs(tenantId);
            _db.DuplicateMatchingConfigs.AddRange(configs);
            await _db.SaveChangesAsync();
        }

        var dtos = configs.Select(DuplicateSettingsDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Get duplicate matching config for a specific entity type ("Contact" or "Company").
    /// Creates default config if none exists.
    /// </summary>
    [HttpGet("{entityType}")]
    [ProducesResponseType(typeof(DuplicateSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetByEntityType(string entityType)
    {
        if (entityType != "Contact" && entityType != "Company")
            return BadRequest(new { error = "Entity type must be 'Contact' or 'Company'." });

        var config = await _db.DuplicateMatchingConfigs
            .FirstOrDefaultAsync(c => c.EntityType == entityType);

        if (config is null)
        {
            var tenantId = _tenantProvider.GetTenantId()
                ?? throw new InvalidOperationException("No tenant context.");

            config = CreateDefaultConfig(tenantId, entityType);
            _db.DuplicateMatchingConfigs.Add(config);
            await _db.SaveChangesAsync();
        }

        return Ok(DuplicateSettingsDto.FromEntity(config));
    }

    /// <summary>
    /// Update duplicate matching config for a specific entity type.
    /// Creates config if it doesn't exist.
    /// </summary>
    [HttpPut("{entityType}")]
    [ProducesResponseType(typeof(DuplicateSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(string entityType, [FromBody] UpdateDuplicateSettingsRequest request)
    {
        if (entityType != "Contact" && entityType != "Company")
            return BadRequest(new { error = "Entity type must be 'Contact' or 'Company'." });

        var validator = new UpdateDuplicateSettingsRequestValidator();
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

        var config = await _db.DuplicateMatchingConfigs
            .FirstOrDefaultAsync(c => c.EntityType == entityType);

        if (config is null)
        {
            config = new DuplicateMatchingConfig
            {
                TenantId = tenantId,
                EntityType = entityType
            };
            _db.DuplicateMatchingConfigs.Add(config);
        }

        config.AutoDetectionEnabled = request.AutoDetectionEnabled;
        config.SimilarityThreshold = request.SimilarityThreshold;
        config.MatchingFields = request.MatchingFields ?? config.MatchingFields;
        config.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Duplicate settings updated for {EntityType}: threshold={Threshold}, autoDetect={AutoDetect}",
            entityType, config.SimilarityThreshold, config.AutoDetectionEnabled);

        return Ok(DuplicateSettingsDto.FromEntity(config));
    }

    // ---- Helpers ----

    private static List<DuplicateMatchingConfig> CreateDefaultConfigs(Guid tenantId)
    {
        return new List<DuplicateMatchingConfig>
        {
            CreateDefaultConfig(tenantId, "Contact"),
            CreateDefaultConfig(tenantId, "Company")
        };
    }

    private static DuplicateMatchingConfig CreateDefaultConfig(Guid tenantId, string entityType)
    {
        var matchingFields = entityType == "Contact"
            ? new List<string> { "firstName", "lastName", "email" }
            : new List<string> { "name", "website" };

        return new DuplicateMatchingConfig
        {
            TenantId = tenantId,
            EntityType = entityType,
            AutoDetectionEnabled = true,
            SimilarityThreshold = 70,
            MatchingFields = matchingFields
        };
    }
}

// ---- DTOs ----

/// <summary>
/// DTO for duplicate matching configuration.
/// </summary>
public record DuplicateSettingsDto
{
    public Guid Id { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public bool AutoDetectionEnabled { get; init; }
    public int SimilarityThreshold { get; init; }
    public List<string> MatchingFields { get; init; } = new();
    public DateTimeOffset UpdatedAt { get; init; }

    public static DuplicateSettingsDto FromEntity(DuplicateMatchingConfig entity) => new()
    {
        Id = entity.Id,
        EntityType = entity.EntityType,
        AutoDetectionEnabled = entity.AutoDetectionEnabled,
        SimilarityThreshold = entity.SimilarityThreshold,
        MatchingFields = entity.MatchingFields,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- Request DTOs ----

/// <summary>
/// Request body for updating duplicate matching config.
/// </summary>
public record UpdateDuplicateSettingsRequest
{
    public bool AutoDetectionEnabled { get; init; }
    public int SimilarityThreshold { get; init; }
    public List<string>? MatchingFields { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for UpdateDuplicateSettingsRequest.
/// </summary>
public class UpdateDuplicateSettingsRequestValidator : AbstractValidator<UpdateDuplicateSettingsRequest>
{
    public UpdateDuplicateSettingsRequestValidator()
    {
        RuleFor(x => x.SimilarityThreshold)
            .InclusiveBetween(50, 100)
            .WithMessage("Similarity threshold must be between 50 and 100.");
    }
}
