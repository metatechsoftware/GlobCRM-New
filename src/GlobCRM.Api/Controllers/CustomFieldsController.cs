using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for custom field definition and section management.
/// Admin-only: all endpoints require the "Admin" role.
/// Supports CRUD for field definitions with soft-delete/restore,
/// and CRUD for field sections with hard-delete.
/// </summary>
[ApiController]
[Route("api/custom-fields")]
[Authorize(Roles = "Admin")]
public class CustomFieldsController : ControllerBase
{
    private readonly ICustomFieldRepository _repository;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<CustomFieldsController> _logger;

    public CustomFieldsController(
        ICustomFieldRepository repository,
        ITenantProvider tenantProvider,
        ILogger<CustomFieldsController> logger)
    {
        _repository = repository;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- Field Definition Endpoints ----

    /// <summary>
    /// Lists all active (non-deleted) custom field definitions for an entity type.
    /// </summary>
    [HttpGet("{entityType}")]
    [ProducesResponseType(typeof(List<CustomFieldDefinitionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFieldsByEntityType(string entityType)
    {
        var fields = await _repository.GetFieldsByEntityTypeAsync(entityType);
        var dtos = fields.Select(CustomFieldDefinitionDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Lists all soft-deleted custom field definitions for an entity type.
    /// Used by the admin restore UI to show deletable fields.
    /// </summary>
    [HttpGet("{entityType}/deleted")]
    [ProducesResponseType(typeof(List<CustomFieldDefinitionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDeletedFields(string entityType)
    {
        var fields = await _repository.GetDeletedFieldsAsync(entityType);
        var dtos = fields.Select(CustomFieldDefinitionDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Gets a single custom field definition by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CustomFieldDefinitionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var field = await _repository.GetByIdAsync(id);
        if (field is null)
            return NotFound(new { error = "Custom field not found." });

        return Ok(CustomFieldDefinitionDto.FromEntity(field));
    }

    /// <summary>
    /// Creates a new custom field definition.
    /// Sets TenantId from the current tenant context.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CustomFieldDefinitionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateCustomFieldRequest request)
    {
        // Validate request
        var validator = new CreateCustomFieldRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
            return BadRequest(new { message = "No tenant context. Please log in again." });

        var field = new CustomFieldDefinition
        {
            TenantId = tenantId.Value,
            EntityType = request.EntityType,
            Name = request.Name,
            Label = request.Label,
            FieldType = request.FieldType,
            SortOrder = request.SortOrder,
            SectionId = request.SectionId,
            Validation = request.Validation ?? new CustomFieldValidation(),
            Options = request.Options,
            RelationEntityType = request.RelationEntityType
        };

        // Map formula-specific properties when FieldType is Formula
        if (request.FieldType == CustomFieldType.Formula)
        {
            field.FormulaExpression = request.FormulaExpression;
            field.FormulaResultType = request.FormulaResultType;
        }

        try
        {
            var created = await _repository.CreateAsync(field);

            _logger.LogInformation(
                "Custom field created: {FieldName} ({FieldType}) for {EntityType}",
                created.Name, created.FieldType, created.EntityType);

            return CreatedAtAction(
                nameof(GetById),
                new { id = created.Id },
                CustomFieldDefinitionDto.FromEntity(created));
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
            when (ex.InnerException is Npgsql.PostgresException pgEx && pgEx.SqlState == "23505")
        {
            _logger.LogWarning(
                "Duplicate custom field: {FieldName} for {EntityType}",
                request.Name, request.EntityType);
            return Conflict(new { message = $"A field named '{request.Name}' already exists for {request.EntityType}." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to create custom field: {FieldName} for {EntityType}",
                request.Name, request.EntityType);
            return StatusCode(500, new { message = "Failed to create custom field. Please try again." });
        }
    }

    /// <summary>
    /// Updates an existing custom field definition.
    /// Name and FieldType cannot be changed after creation.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CustomFieldDefinitionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomFieldRequest request)
    {
        var field = await _repository.GetByIdAsync(id);
        if (field is null)
            return NotFound(new { error = "Custom field not found." });

        // Apply updates (Name and FieldType are immutable after creation)
        if (request.Label is not null)
            field.Label = request.Label;

        if (request.SortOrder.HasValue)
            field.SortOrder = request.SortOrder.Value;

        if (request.SectionId.HasValue)
            field.SectionId = request.SectionId.Value == Guid.Empty ? null : request.SectionId.Value;

        if (request.Validation is not null)
            field.Validation = request.Validation;

        if (request.Options is not null)
            field.Options = request.Options;

        // Allow updating formula expression and result type for Formula fields
        if (field.FieldType == CustomFieldType.Formula)
        {
            if (request.FormulaExpression is not null)
                field.FormulaExpression = request.FormulaExpression;

            if (request.FormulaResultType is not null)
                field.FormulaResultType = request.FormulaResultType;
        }

        await _repository.UpdateAsync(field);

        _logger.LogInformation("Custom field updated: {FieldId}", id);

        return Ok(CustomFieldDefinitionDto.FromEntity(field));
    }

    /// <summary>
    /// Soft-deletes a custom field definition. Data is preserved for potential restoration.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var field = await _repository.GetByIdAsync(id);
        if (field is null)
            return NotFound(new { error = "Custom field not found." });

        await _repository.SoftDeleteAsync(id);

        _logger.LogInformation("Custom field soft-deleted: {FieldId} ({FieldName})", id, field.Name);

        return NoContent();
    }

    /// <summary>
    /// Restores a soft-deleted custom field definition.
    /// </summary>
    [HttpPost("{id:guid}/restore")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore(Guid id)
    {
        await _repository.RestoreAsync(id);

        _logger.LogInformation("Custom field restored: {FieldId}", id);

        // Fetch the restored field to return it
        var field = await _repository.GetByIdAsync(id);
        if (field is null)
            return NotFound(new { error = "Custom field not found after restore." });

        return Ok(CustomFieldDefinitionDto.FromEntity(field));
    }

    // ---- Section Endpoints ----

    /// <summary>
    /// Lists all sections for an entity type.
    /// </summary>
    [HttpGet("sections/{entityType}")]
    [ProducesResponseType(typeof(List<CustomFieldSectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSections(string entityType)
    {
        var sections = await _repository.GetSectionsAsync(entityType);
        var dtos = sections.Select(CustomFieldSectionDto.FromEntity).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Creates a new section for grouping custom fields.
    /// </summary>
    [HttpPost("sections")]
    [ProducesResponseType(typeof(CustomFieldSectionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSection([FromBody] CreateSectionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.EntityType) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { error = "EntityType and Name are required." });
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var section = new CustomFieldSection
        {
            TenantId = tenantId,
            EntityType = request.EntityType,
            Name = request.Name,
            SortOrder = request.SortOrder,
            IsCollapsedByDefault = request.IsCollapsedByDefault
        };

        var created = await _repository.CreateSectionAsync(section);

        _logger.LogInformation(
            "Section created: {SectionName} for {EntityType}", created.Name, created.EntityType);

        return CreatedAtAction(
            nameof(GetSections),
            new { entityType = created.EntityType },
            CustomFieldSectionDto.FromEntity(created));
    }

    /// <summary>
    /// Updates an existing section.
    /// </summary>
    [HttpPut("sections/{id:guid}")]
    [ProducesResponseType(typeof(CustomFieldSectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSection(Guid id, [FromBody] UpdateSectionRequest request)
    {
        var sections = await _repository.GetSectionsAsync(request.EntityType ?? string.Empty);
        var section = sections.FirstOrDefault(s => s.Id == id);

        if (section is null)
        {
            // Try to find across all entity types in case EntityType wasn't provided
            // We need to look it up differently
            return NotFound(new { error = "Section not found." });
        }

        if (request.Name is not null)
            section.Name = request.Name;

        if (request.SortOrder.HasValue)
            section.SortOrder = request.SortOrder.Value;

        if (request.IsCollapsedByDefault.HasValue)
            section.IsCollapsedByDefault = request.IsCollapsedByDefault.Value;

        await _repository.UpdateSectionAsync(section);

        _logger.LogInformation("Section updated: {SectionId}", id);

        return Ok(CustomFieldSectionDto.FromEntity(section));
    }

    /// <summary>
    /// Hard-deletes a section. Fields in the section get their SectionId set to null.
    /// </summary>
    [HttpDelete("sections/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteSection(Guid id)
    {
        await _repository.DeleteSectionAsync(id);

        _logger.LogInformation("Section deleted: {SectionId}", id);

        return NoContent();
    }
}

// ---- DTOs ----

/// <summary>
/// Response DTO for custom field definitions. Does not expose domain entities directly.
/// </summary>
public record CustomFieldDefinitionDto
{
    public Guid Id { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public CustomFieldType FieldType { get; init; }
    public int SortOrder { get; init; }
    public Guid? SectionId { get; init; }
    public string? SectionName { get; init; }
    public CustomFieldValidation Validation { get; init; } = new();
    public List<FieldOption>? Options { get; init; }
    public string? RelationEntityType { get; init; }
    public string? FormulaExpression { get; init; }
    public string? FormulaResultType { get; init; }
    public List<string>? DependsOnFieldIds { get; init; }
    public bool IsDeleted { get; init; }
    public DateTimeOffset? DeletedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static CustomFieldDefinitionDto FromEntity(CustomFieldDefinition entity) => new()
    {
        Id = entity.Id,
        EntityType = entity.EntityType,
        Name = entity.Name,
        Label = entity.Label,
        FieldType = entity.FieldType,
        SortOrder = entity.SortOrder,
        SectionId = entity.SectionId,
        SectionName = entity.Section?.Name,
        Validation = entity.Validation,
        Options = entity.Options,
        RelationEntityType = entity.RelationEntityType,
        FormulaExpression = entity.FormulaExpression,
        FormulaResultType = entity.FormulaResultType,
        DependsOnFieldIds = entity.DependsOnFieldIds,
        IsDeleted = entity.IsDeleted,
        DeletedAt = entity.DeletedAt,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Response DTO for custom field sections.
/// </summary>
public record CustomFieldSectionDto
{
    public Guid Id { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsCollapsedByDefault { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static CustomFieldSectionDto FromEntity(CustomFieldSection entity) => new()
    {
        Id = entity.Id,
        EntityType = entity.EntityType,
        Name = entity.Name,
        SortOrder = entity.SortOrder,
        IsCollapsedByDefault = entity.IsCollapsedByDefault,
        CreatedAt = entity.CreatedAt
    };
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a custom field definition.
/// </summary>
public record CreateCustomFieldRequest
{
    public string EntityType { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public CustomFieldType FieldType { get; init; }
    public int SortOrder { get; init; }
    public Guid? SectionId { get; init; }
    public CustomFieldValidation? Validation { get; init; }
    public List<FieldOption>? Options { get; init; }
    public string? RelationEntityType { get; init; }
    public string? FormulaExpression { get; init; }
    public string? FormulaResultType { get; init; }
}

/// <summary>
/// Request body for updating a custom field definition.
/// Name and FieldType are immutable after creation.
/// </summary>
public record UpdateCustomFieldRequest
{
    public string? Label { get; init; }
    public int? SortOrder { get; init; }
    public Guid? SectionId { get; init; }
    public CustomFieldValidation? Validation { get; init; }
    public List<FieldOption>? Options { get; init; }
    public string? FormulaExpression { get; init; }
    public string? FormulaResultType { get; init; }
}

/// <summary>
/// Request body for creating a custom field section.
/// </summary>
public record CreateSectionRequest
{
    public string EntityType { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsCollapsedByDefault { get; init; }
}

/// <summary>
/// Request body for updating a custom field section.
/// </summary>
public record UpdateSectionRequest
{
    public string? EntityType { get; init; }
    public string? Name { get; init; }
    public int? SortOrder { get; init; }
    public bool? IsCollapsedByDefault { get; init; }
}

// ---- FluentValidation Validator ----

/// <summary>
/// FluentValidation validator for CreateCustomFieldRequest.
/// Enforces: Name required (1-100 chars), Label required (1-200 chars),
/// EntityType required, FieldType valid, Options required for Dropdown/MultiSelect.
/// </summary>
public class CreateCustomFieldRequestValidator : AbstractValidator<CreateCustomFieldRequest>
{
    public CreateCustomFieldRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MinimumLength(1).WithMessage("Name must be at least 1 character.")
            .MaximumLength(100).WithMessage("Name must be at most 100 characters.");

        RuleFor(x => x.Label)
            .NotEmpty().WithMessage("Label is required.")
            .MinimumLength(1).WithMessage("Label must be at least 1 character.")
            .MaximumLength(200).WithMessage("Label must be at most 200 characters.");

        RuleFor(x => x.EntityType)
            .NotEmpty().WithMessage("EntityType is required.");

        RuleFor(x => x.FieldType)
            .IsInEnum().WithMessage("FieldType must be a valid enum value.");

        RuleFor(x => x.Options)
            .NotEmpty().WithMessage("Options are required for Dropdown fields.")
            .When(x => x.FieldType == CustomFieldType.Dropdown);

        RuleFor(x => x.Options)
            .NotEmpty().WithMessage("Options are required for MultiSelect fields.")
            .When(x => x.FieldType == CustomFieldType.MultiSelect);

        RuleFor(x => x.RelationEntityType)
            .NotEmpty().WithMessage("RelationEntityType is required for Relation fields.")
            .When(x => x.FieldType == CustomFieldType.Relation);

        // Formula field validation rules
        RuleFor(x => x.FormulaExpression)
            .NotEmpty().WithMessage("FormulaExpression is required for Formula fields.")
            .When(x => x.FieldType == CustomFieldType.Formula);

        RuleFor(x => x.FormulaResultType)
            .NotEmpty().WithMessage("FormulaResultType is required for Formula fields.")
            .Must(rt => rt is "number" or "text" or "date")
            .WithMessage("FormulaResultType must be one of: number, text, date.")
            .When(x => x.FieldType == CustomFieldType.Formula);

        RuleFor(x => x.Options)
            .Null().WithMessage("Options must be null for Formula fields.")
            .When(x => x.FieldType == CustomFieldType.Formula);
    }
}
