using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Import;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for the CSV import wizard: upload, field mapping, preview, execute, and status.
/// Follows the multi-step import workflow: Upload -> Map -> Preview -> Execute -> Status.
/// All endpoints require authentication. Upload requires Create permission for the target entity type.
/// </summary>
[ApiController]
[Route("api/imports")]
[Authorize]
public class ImportsController : ControllerBase
{
    private readonly ImportService _importService;
    private readonly IImportRepository _importRepository;
    private readonly IPermissionService _permissionService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<ImportsController> _logger;

    public ImportsController(
        ImportService importService,
        IImportRepository importRepository,
        IPermissionService permissionService,
        ITenantProvider tenantProvider,
        ILogger<ImportsController> logger)
    {
        _importService = importService;
        _importRepository = importRepository;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    /// <summary>
    /// Step 1: Upload a CSV file. Parses headers and returns sample rows for mapping.
    /// Requires Create permission on the target entity type.
    /// Max file size: 10MB.
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10MB
    [ProducesResponseType(typeof(UploadResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upload(IFormFile file, [FromQuery] string entityType)
    {
        // Validate file
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file provided." });

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Only CSV files are supported." });

        // Parse entity type
        if (!Enum.TryParse<ImportEntityType>(entityType, true, out var importEntityType))
            return BadRequest(new { error = $"Invalid entity type: {entityType}. Must be one of: Contact, Company, Deal." });

        // Check Create permission for the target entity type
        var userId = GetCurrentUserId();
        var entityTypeName = importEntityType.ToString();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, entityTypeName, "Create");
        if (permission.Scope == PermissionScope.None)
            return Forbid();

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        // Upload and parse
        using var stream = file.OpenReadStream();
        var (job, parseResult) = await _importService.UploadAndParseAsync(
            stream, file.FileName, importEntityType, userId, tenantId);

        var response = new UploadResponse
        {
            ImportJobId = job.Id,
            Headers = parseResult.Headers,
            SampleRows = parseResult.SampleRows,
            TotalRows = parseResult.TotalRowCount
        };

        _logger.LogInformation("CSV uploaded for import: {FileName}, {TotalRows} rows", file.FileName, parseResult.TotalRowCount);

        return CreatedAtAction(nameof(GetById), new { id = job.Id }, response);
    }

    /// <summary>
    /// Step 2: Submit field mappings for an import job.
    /// Maps CSV columns to entity fields (core fields or custom fields).
    /// </summary>
    [HttpPost("{id:guid}/mapping")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SaveMapping(Guid id, [FromBody] MappingRequest request)
    {
        var job = await _importRepository.GetByIdAsync(id);
        if (job is null)
            return NotFound(new { error = "Import job not found." });

        // Verify ownership
        var userId = GetCurrentUserId();
        if (job.UserId != userId)
            return Forbid();

        if (request.Mappings == null || request.Mappings.Count == 0)
            return BadRequest(new { error = "At least one field mapping is required." });

        var mappings = request.Mappings.Select(m => new ImportFieldMapping
        {
            CsvColumn = m.CsvColumn,
            EntityField = m.EntityField,
            IsCustomField = m.IsCustomField
        }).ToList();

        var strategy = request.DuplicateStrategy ?? "skip";
        if (strategy is not ("skip" or "overwrite" or "merge"))
            return BadRequest(new { error = "Duplicate strategy must be 'skip', 'overwrite', or 'merge'." });

        await _importService.SaveMappingAsync(id, mappings, strategy);

        return Ok(new { message = "Mapping saved." });
    }

    /// <summary>
    /// Step 3: Preview import with dry-run validation and duplicate detection.
    /// Returns counts and error details without modifying data.
    /// </summary>
    [HttpPost("{id:guid}/preview")]
    [ProducesResponseType(typeof(PreviewResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Preview(Guid id)
    {
        var job = await _importRepository.GetByIdAsync(id);
        if (job is null)
            return NotFound(new { error = "Import job not found." });

        var userId = GetCurrentUserId();
        if (job.UserId != userId)
            return Forbid();

        var result = await _importService.PreviewAsync(id);

        var response = new PreviewResponse
        {
            ValidCount = result.ValidCount,
            InvalidCount = result.InvalidCount,
            DuplicateCount = result.DuplicateCount,
            Errors = result.Errors.Select(e => new PreviewErrorDto
            {
                RowIndex = e.RowIndex,
                FieldName = e.FieldName,
                ErrorMessage = e.ErrorMessage
            }).ToList(),
            Duplicates = result.Duplicates.Select(d => new DuplicateMatchDto
            {
                RowIndex = d.RowIndex,
                ExistingEntityId = d.ExistingEntityId,
                MatchField = d.MatchField,
                MatchValue = d.MatchValue
            }).ToList()
        };

        return Ok(response);
    }

    /// <summary>
    /// Step 4: Execute the import. Starts batch processing in background.
    /// Returns 202 Accepted immediately. Progress sent via SignalR "ImportProgress" events.
    /// </summary>
    [HttpPost("{id:guid}/execute")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Execute(Guid id)
    {
        var job = await _importRepository.GetByIdAsync(id);
        if (job is null)
            return NotFound(new { error = "Import job not found." });

        var userId = GetCurrentUserId();
        if (job.UserId != userId)
            return Forbid();

        if (job.Mappings.Count == 0)
            return BadRequest(new { error = "Field mappings must be saved before executing." });

        if (job.Status == ImportStatus.Processing)
            return BadRequest(new { error = "Import is already processing." });

        if (job.Status == ImportStatus.Completed)
            return BadRequest(new { error = "Import has already completed." });

        await _importService.ExecuteAsync(id, userId);

        _logger.LogInformation("Import job {JobId} execution started", id);

        return Accepted(new { importJobId = id, message = "Import execution started. Progress will be sent via SignalR." });
    }

    /// <summary>
    /// Gets the status and details of an import job including progress counts and errors.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ImportJobDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var job = await _importRepository.GetByIdAsync(id);
        if (job is null)
            return NotFound(new { error = "Import job not found." });

        var userId = GetCurrentUserId();
        if (job.UserId != userId && !User.IsInRole("Admin"))
            return Forbid();

        return Ok(ImportJobDto.FromEntity(job));
    }

    /// <summary>
    /// Lists the current user's import jobs with pagination. Ordered by CreatedAt descending.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<ImportJobDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        var jobs = await _importRepository.GetByUserAsync(userId, page, pageSize);
        var dtos = jobs.Select(ImportJobDto.FromEntity).ToList();
        return Ok(dtos);
    }

    // ---- Helpers ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }
}

// ---- DTOs ----

/// <summary>
/// Response from CSV upload with parsed headers and sample data.
/// </summary>
public record UploadResponse
{
    public Guid ImportJobId { get; init; }
    public string[] Headers { get; init; } = Array.Empty<string>();
    public List<Dictionary<string, string>> SampleRows { get; init; } = new();
    public int TotalRows { get; init; }
}

/// <summary>
/// Request body for submitting field mappings.
/// </summary>
public record MappingRequest
{
    public List<FieldMappingDto> Mappings { get; init; } = new();
    public string? DuplicateStrategy { get; init; }
}

/// <summary>
/// A single field mapping from CSV column to entity field.
/// </summary>
public record FieldMappingDto
{
    public string CsvColumn { get; init; } = string.Empty;
    public string EntityField { get; init; } = string.Empty;
    public bool IsCustomField { get; init; }
}

/// <summary>
/// Preview response with validation and duplicate detection results.
/// </summary>
public record PreviewResponse
{
    public int ValidCount { get; init; }
    public int InvalidCount { get; init; }
    public int DuplicateCount { get; init; }
    public List<PreviewErrorDto> Errors { get; init; } = new();
    public List<DuplicateMatchDto> Duplicates { get; init; } = new();
}

/// <summary>
/// Preview validation error for a specific row.
/// </summary>
public record PreviewErrorDto
{
    public int RowIndex { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string ErrorMessage { get; init; } = string.Empty;
}

/// <summary>
/// Duplicate match found during preview.
/// </summary>
public record DuplicateMatchDto
{
    public int RowIndex { get; init; }
    public Guid ExistingEntityId { get; init; }
    public string MatchField { get; init; } = string.Empty;
    public string MatchValue { get; init; } = string.Empty;
}

/// <summary>
/// DTO for import job status and details.
/// </summary>
public record ImportJobDto
{
    public Guid Id { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string OriginalFileName { get; init; } = string.Empty;
    public int TotalRows { get; init; }
    public int ProcessedRows { get; init; }
    public int SuccessCount { get; init; }
    public int ErrorCount { get; init; }
    public int DuplicateCount { get; init; }
    public string DuplicateStrategy { get; init; } = string.Empty;
    public Guid? UserId { get; init; }
    public string? UserName { get; init; }
    public List<ImportJobErrorDto> Errors { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }

    public static ImportJobDto FromEntity(ImportJob entity) => new()
    {
        Id = entity.Id,
        EntityType = entity.EntityType.ToString(),
        Status = entity.Status.ToString(),
        OriginalFileName = entity.OriginalFileName,
        TotalRows = entity.TotalRows,
        ProcessedRows = entity.ProcessedRows,
        SuccessCount = entity.SuccessCount,
        ErrorCount = entity.ErrorCount,
        DuplicateCount = entity.DuplicateCount,
        DuplicateStrategy = entity.DuplicateStrategy,
        UserId = entity.UserId,
        UserName = entity.User != null
            ? $"{entity.User.FirstName} {entity.User.LastName}".Trim()
            : null,
        Errors = entity.Errors.Select(e => new ImportJobErrorDto
        {
            Id = e.Id,
            RowNumber = e.RowNumber,
            FieldName = e.FieldName,
            ErrorMessage = e.ErrorMessage,
            RawValue = e.RawValue
        }).ToList(),
        CreatedAt = entity.CreatedAt,
        StartedAt = entity.StartedAt,
        CompletedAt = entity.CompletedAt
    };
}

/// <summary>
/// DTO for an individual import job error.
/// </summary>
public record ImportJobErrorDto
{
    public Guid Id { get; init; }
    public int RowNumber { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string ErrorMessage { get; init; } = string.Empty;
    public string? RawValue { get; init; }
}
