using FluentValidation;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Reporting;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for report CRUD, execution, field metadata, sharing, cloning,
/// CSV export trigger, and category management. DTOs, request records, and validators
/// co-located in this file. Route: /api/reports
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportRepository _reportRepository;
    private readonly ReportQueryEngine _queryEngine;
    private readonly ReportFieldMetadataService _fieldMetadataService;
    private readonly IPermissionService _permissionService;
    private readonly IBackgroundJobClient _jobClient;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(
        IReportRepository reportRepository,
        ReportQueryEngine queryEngine,
        ReportFieldMetadataService fieldMetadataService,
        IPermissionService permissionService,
        IBackgroundJobClient jobClient,
        ITenantProvider tenantProvider,
        ILogger<ReportsController> logger)
    {
        _reportRepository = reportRepository;
        _queryEngine = queryEngine;
        _fieldMetadataService = fieldMetadataService;
        _permissionService = permissionService;
        _jobClient = jobClient;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- Report CRUD Endpoints ----

    /// <summary>
    /// 1. List reports with optional filters. Includes shared reports and seed data.
    /// Paginated. Returns PagedResponse of ReportListDto.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Report:View")]
    [ProducesResponseType(typeof(ReportPaginatedResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] string? categoryId = null,
        [FromQuery] string? entityType = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var userId = GetCurrentUserId();
        var (items, totalCount) = await _reportRepository.GetAllAsync(
            categoryId, entityType, search, includeShared: true, userId, page, pageSize);

        return Ok(new ReportPaginatedResponse
        {
            Items = items.Select(ReportListDto.FromEntity).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }

    /// <summary>
    /// 2. Get single report with full definition.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Report:View")]
    [ProducesResponseType(typeof(ReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var report = await _reportRepository.GetByIdAsync(id);
        if (report is null)
            return NotFound(new { error = "Report not found." });

        return Ok(ReportDto.FromEntity(report));
    }

    /// <summary>
    /// 3. Create report. Sets OwnerId to current user.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Report:Create")]
    [ProducesResponseType(typeof(ReportDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateReportRequest request)
    {
        var validator = new CreateReportRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();

        var report = new Report
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            EntityType = request.EntityType,
            CategoryId = request.CategoryId,
            ChartType = request.ChartType,
            Definition = MapDefinition(request.Definition),
            OwnerId = userId,
            IsShared = false,
            IsSeedData = false
        };

        var created = await _reportRepository.CreateAsync(report);

        _logger.LogInformation("Report created: {ReportName} ({ReportId})", created.Name, created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            ReportDto.FromEntity(created));
    }

    /// <summary>
    /// 4. Update report. Only owner or admin can update.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Report:Edit")]
    [ProducesResponseType(typeof(ReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReportRequest request)
    {
        var validator = new UpdateReportRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
            return BadRequest(new { errors = validationResult.Errors.Select(e => e.ErrorMessage) });

        var report = await _reportRepository.GetByIdAsync(id);
        if (report is null)
            return NotFound(new { error = "Report not found." });

        var userId = GetCurrentUserId();
        if (report.OwnerId != userId && !User.IsInRole("Admin"))
            return Forbid();

        report.Name = request.Name;
        report.Description = request.Description;
        report.CategoryId = request.CategoryId;
        report.ChartType = request.ChartType;
        report.Definition = MapDefinition(request.Definition);

        var updated = await _reportRepository.UpdateAsync(report);

        _logger.LogInformation("Report updated: {ReportId}", id);

        return Ok(ReportDto.FromEntity(updated));
    }

    /// <summary>
    /// 5. Delete report. Only owner or admin can delete. Cannot delete seed data.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Report:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var report = await _reportRepository.GetByIdAsync(id);
        if (report is null)
            return NotFound(new { error = "Report not found." });

        if (report.IsSeedData)
            return BadRequest(new { error = "Cannot delete seed data reports." });

        var userId = GetCurrentUserId();
        if (report.OwnerId != userId && !User.IsInRole("Admin"))
            return Forbid();

        await _reportRepository.DeleteAsync(id);

        _logger.LogInformation("Report deleted: {ReportId}", id);

        return NoContent();
    }

    /// <summary>
    /// 6. Execute report. Runs the query engine with pagination and permission scope.
    /// Updates LastRunAt and LastRunRowCount on the report.
    /// </summary>
    [HttpPost("{id:guid}/execute")]
    [Authorize(Policy = "Permission:Report:View")]
    [ProducesResponseType(typeof(ReportExecutionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Execute(Guid id, [FromBody] ExecuteReportRequest request)
    {
        var report = await _reportRepository.GetByIdAsync(id);
        if (report is null)
            return NotFound(new { error = "Report not found." });

        var userId = GetCurrentUserId();
        var page = request.Page ?? 1;
        var pageSize = request.PageSize ?? 50;
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 500) pageSize = 500;

        // Resolve user's permission scope for the report's entity type
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, report.EntityType, "View");
        var scope = permission.Scope;

        // For team scope, get team member IDs
        List<Guid>? teamMemberIds = null;
        if (scope == PermissionScope.Team)
        {
            // Team members handled within the query engine via scope
            teamMemberIds = null; // Engine handles this internally
        }

        // Map drill-down filter if provided
        ReportFilterCondition? drillDownFilter = null;
        if (request.DrillDownFilter != null)
        {
            drillDownFilter = new ReportFilterCondition
            {
                FieldId = request.DrillDownFilter.FieldId,
                Operator = request.DrillDownFilter.Operator,
                Value = request.DrillDownFilter.Value,
                ValueTo = request.DrillDownFilter.ValueTo
            };
        }

        var result = await _queryEngine.ExecuteReportAsync(
            report, page, pageSize, userId, scope, teamMemberIds, drillDownFilter);

        // Update report execution stats
        report.LastRunAt = DateTimeOffset.UtcNow;
        report.LastRunRowCount = result.TotalCount;
        await _reportRepository.UpdateAsync(report);

        return Ok(new ReportExecutionResultDto
        {
            Rows = result.Rows,
            TotalCount = result.TotalCount,
            Aggregates = result.Aggregates?.Select(a => new ReportAggregateResultDto
            {
                FieldId = a.FieldId,
                Label = a.Label,
                Aggregation = a.Aggregation.ToString(),
                Value = a.Value
            }).ToList(),
            ColumnHeaders = result.ColumnHeaders,
            Error = result.Error
        });
    }

    /// <summary>
    /// 7. Get available fields for entity type.
    /// </summary>
    [HttpGet("fields/{entityType}")]
    [Authorize(Policy = "Permission:Report:View")]
    [ProducesResponseType(typeof(ReportFieldMetadataResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetFieldMetadata(string entityType)
    {
        var validEntityTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Contact", "Deal", "Company", "Lead", "Activity", "Quote", "Request", "Product"
        };

        if (!validEntityTypes.Contains(entityType))
            return BadRequest(new { error = $"Invalid entity type: {entityType}. Must be one of: {string.Join(", ", validEntityTypes)}" });

        var result = await _fieldMetadataService.GetFieldsForEntityTypeAsync(entityType);

        return Ok(result);
    }

    /// <summary>
    /// 8. Toggle share. Only owner can share.
    /// </summary>
    [HttpPatch("{id:guid}/share")]
    [Authorize(Policy = "Permission:Report:Edit")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleShare(Guid id, [FromBody] ToggleShareRequest request)
    {
        var report = await _reportRepository.GetByIdAsync(id);
        if (report is null)
            return NotFound(new { error = "Report not found." });

        var userId = GetCurrentUserId();
        if (report.OwnerId != userId && !User.IsInRole("Admin"))
            return Forbid();

        report.IsShared = request.IsShared;
        await _reportRepository.UpdateAsync(report);

        _logger.LogInformation("Report share toggled: {ReportId} IsShared={IsShared}", id, request.IsShared);

        return Ok(new { isShared = report.IsShared });
    }

    /// <summary>
    /// 9. Clone report. Creates copy with new owner, IsShared = false, IsSeedData = false.
    /// </summary>
    [HttpPost("{id:guid}/clone")]
    [Authorize(Policy = "Permission:Report:Create")]
    [ProducesResponseType(typeof(ReportDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Clone(Guid id, [FromBody] CloneReportRequest request)
    {
        var report = await _reportRepository.GetByIdAsync(id);
        if (report is null)
            return NotFound(new { error = "Report not found." });

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();

        var clone = new Report
        {
            TenantId = tenantId,
            Name = request.Name ?? $"{report.Name} (Copy)",
            Description = report.Description,
            EntityType = report.EntityType,
            CategoryId = report.CategoryId,
            ChartType = report.ChartType,
            Definition = CloneDefinition(report.Definition),
            OwnerId = userId,
            IsShared = false,
            IsSeedData = false
        };

        var created = await _reportRepository.CreateAsync(clone);

        _logger.LogInformation("Report cloned: {OriginalId} -> {CloneId}", id, created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            ReportDto.FromEntity(created));
    }

    /// <summary>
    /// 10. Trigger CSV export. Enqueues ReportCsvExportJob via Hangfire.
    /// </summary>
    [HttpPost("{id:guid}/export-csv")]
    [Authorize(Policy = "Permission:Report:View")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ExportCsv(Guid id)
    {
        var report = await _reportRepository.GetByIdAsync(id);
        if (report is null)
            return NotFound(new { error = "Report not found." });

        var userId = GetCurrentUserId();
        var tenantId = GetTenantId();

        var jobId = _jobClient.Enqueue<ReportCsvExportJob>(
            job => job.ExecuteAsync(id, userId, tenantId));

        _logger.LogInformation("CSV export enqueued for report {ReportId}: job {JobId}", id, jobId);

        return AcceptedAtAction(nameof(GetById), new { id }, new { jobId });
    }

    // ---- Category Endpoints ----

    /// <summary>
    /// 11. List all report categories.
    /// </summary>
    [HttpGet("categories")]
    [Authorize(Policy = "Permission:Report:View")]
    [ProducesResponseType(typeof(List<ReportCategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _reportRepository.GetCategoriesAsync();
        return Ok(categories.Select(ReportCategoryDto.FromEntity).ToList());
    }

    /// <summary>
    /// 12. Create category. Admin only.
    /// </summary>
    [HttpPost("categories")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReportCategoryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateReportCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Category name is required." });

        var tenantId = GetTenantId();

        var category = new ReportCategory
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            Description = request.Description,
            SortOrder = request.SortOrder
        };

        var created = await _reportRepository.CreateCategoryAsync(category);

        return CreatedAtAction(nameof(GetCategories), null, ReportCategoryDto.FromEntity(created));
    }

    /// <summary>
    /// 13. Update category. Admin only.
    /// </summary>
    [HttpPut("categories/{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ReportCategoryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] UpdateReportCategoryRequest request)
    {
        var categories = await _reportRepository.GetCategoriesAsync();
        var category = categories.FirstOrDefault(c => c.Id == id);
        if (category is null)
            return NotFound(new { error = "Category not found." });

        if (!string.IsNullOrWhiteSpace(request.Name))
            category.Name = request.Name.Trim();
        category.Description = request.Description;
        category.SortOrder = request.SortOrder;

        var updated = await _reportRepository.UpdateCategoryAsync(category);

        return Ok(ReportCategoryDto.FromEntity(updated));
    }

    /// <summary>
    /// 14. Delete category. Admin only.
    /// </summary>
    [HttpDelete("categories/{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCategory(Guid id)
    {
        var categories = await _reportRepository.GetCategoriesAsync();
        var category = categories.FirstOrDefault(c => c.Id == id);
        if (category is null)
            return NotFound(new { error = "Category not found." });

        await _reportRepository.DeleteCategoryAsync(id);

        return NoContent();
    }

    // ---- Private Helpers ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    private Guid GetTenantId()
    {
        return _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
    }

    /// <summary>
    /// Maps a ReportDefinitionDto to the domain ReportDefinition.
    /// </summary>
    private static ReportDefinition MapDefinition(ReportDefinitionDto dto)
    {
        return new ReportDefinition
        {
            Fields = dto.Fields.Select(f => new ReportField
            {
                FieldId = f.FieldId,
                Label = f.Label,
                FieldType = f.FieldType,
                Aggregation = f.Aggregation,
                SortOrder = f.SortOrder
            }).ToList(),
            FilterGroup = dto.FilterGroup != null ? MapFilterGroup(dto.FilterGroup) : null,
            Groupings = dto.Groupings.Select(g => new ReportGrouping
            {
                FieldId = g.FieldId,
                DateTruncation = g.DateTruncation
            }).ToList(),
            ChartConfig = dto.ChartConfig != null ? new ReportChartConfig
            {
                ChartType = dto.ChartConfig.ChartType,
                ColorScheme = dto.ChartConfig.ColorScheme,
                ShowLegend = dto.ChartConfig.ShowLegend,
                ShowDataLabels = dto.ChartConfig.ShowDataLabels
            } : null
        };
    }

    private static ReportFilterGroup MapFilterGroup(ReportFilterGroupDto dto)
    {
        return new ReportFilterGroup
        {
            Logic = dto.Logic,
            Conditions = dto.Conditions.Select(c => new ReportFilterCondition
            {
                FieldId = c.FieldId,
                Operator = c.Operator,
                Value = c.Value,
                ValueTo = c.ValueTo
            }).ToList(),
            Groups = dto.Groups.Select(MapFilterGroup).ToList()
        };
    }

    /// <summary>
    /// Deep clones a ReportDefinition.
    /// </summary>
    private static ReportDefinition CloneDefinition(ReportDefinition source)
    {
        return new ReportDefinition
        {
            Fields = source.Fields.Select(f => new ReportField
            {
                FieldId = f.FieldId,
                Label = f.Label,
                FieldType = f.FieldType,
                Aggregation = f.Aggregation,
                SortOrder = f.SortOrder
            }).ToList(),
            FilterGroup = source.FilterGroup != null ? CloneFilterGroup(source.FilterGroup) : null,
            Groupings = source.Groupings.Select(g => new ReportGrouping
            {
                FieldId = g.FieldId,
                DateTruncation = g.DateTruncation
            }).ToList(),
            ChartConfig = source.ChartConfig != null ? new ReportChartConfig
            {
                ChartType = source.ChartConfig.ChartType,
                ColorScheme = source.ChartConfig.ColorScheme,
                ShowLegend = source.ChartConfig.ShowLegend,
                ShowDataLabels = source.ChartConfig.ShowDataLabels
            } : null
        };
    }

    private static ReportFilterGroup CloneFilterGroup(ReportFilterGroup source)
    {
        return new ReportFilterGroup
        {
            Logic = source.Logic,
            Conditions = source.Conditions.Select(c => new ReportFilterCondition
            {
                FieldId = c.FieldId,
                Operator = c.Operator,
                Value = c.Value,
                ValueTo = c.ValueTo
            }).ToList(),
            Groups = source.Groups.Select(CloneFilterGroup).ToList()
        };
    }
}

// ---- DTOs ----

/// <summary>
/// Full report DTO with complete definition for editor/detail views.
/// </summary>
public record ReportDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public Guid? CategoryId { get; init; }
    public string? CategoryName { get; init; }
    public string ChartType { get; init; } = string.Empty;
    public ReportDefinitionDto Definition { get; init; } = new();
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public bool IsShared { get; init; }
    public bool IsSeedData { get; init; }
    public DateTimeOffset? LastRunAt { get; init; }
    public int? LastRunRowCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ReportDto FromEntity(Report r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Description = r.Description,
        EntityType = r.EntityType,
        CategoryId = r.CategoryId,
        CategoryName = r.Category?.Name,
        ChartType = r.ChartType.ToString().ToLowerInvariant(),
        Definition = ReportDefinitionDto.FromEntity(r.Definition),
        OwnerId = r.OwnerId,
        OwnerName = r.Owner != null ? $"{r.Owner.FirstName} {r.Owner.LastName}".Trim() : null,
        IsShared = r.IsShared,
        IsSeedData = r.IsSeedData,
        LastRunAt = r.LastRunAt,
        LastRunRowCount = r.LastRunRowCount,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };
}

/// <summary>
/// Lightweight report DTO for list page -- no full definition.
/// </summary>
public record ReportListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string ChartType { get; init; } = string.Empty;
    public string? CategoryName { get; init; }
    public string? OwnerName { get; init; }
    public bool IsShared { get; init; }
    public bool IsSeedData { get; init; }
    public DateTimeOffset? LastRunAt { get; init; }
    public int? LastRunRowCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ReportListDto FromEntity(Report r) => new()
    {
        Id = r.Id,
        Name = r.Name,
        Description = r.Description,
        EntityType = r.EntityType,
        ChartType = r.ChartType.ToString().ToLowerInvariant(),
        CategoryName = r.Category?.Name,
        OwnerName = r.Owner != null ? $"{r.Owner.FirstName} {r.Owner.LastName}".Trim() : null,
        IsShared = r.IsShared,
        IsSeedData = r.IsSeedData,
        LastRunAt = r.LastRunAt,
        LastRunRowCount = r.LastRunRowCount,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };
}

/// <summary>
/// Report definition DTO mirroring the JSONB ReportDefinition structure.
/// </summary>
public record ReportDefinitionDto
{
    public List<ReportFieldDto> Fields { get; init; } = [];
    public ReportFilterGroupDto? FilterGroup { get; init; }
    public List<ReportGroupingDto> Groupings { get; init; } = [];
    public ReportChartConfigDto? ChartConfig { get; init; }

    public static ReportDefinitionDto FromEntity(ReportDefinition d) => new()
    {
        Fields = d.Fields.Select(f => new ReportFieldDto
        {
            FieldId = f.FieldId,
            Label = f.Label,
            FieldType = f.FieldType,
            Aggregation = f.Aggregation,
            SortOrder = f.SortOrder
        }).ToList(),
        FilterGroup = d.FilterGroup != null ? ReportFilterGroupDto.FromEntity(d.FilterGroup) : null,
        Groupings = d.Groupings.Select(g => new ReportGroupingDto
        {
            FieldId = g.FieldId,
            DateTruncation = g.DateTruncation
        }).ToList(),
        ChartConfig = d.ChartConfig != null ? new ReportChartConfigDto
        {
            ChartType = d.ChartConfig.ChartType,
            ColorScheme = d.ChartConfig.ColorScheme,
            ShowLegend = d.ChartConfig.ShowLegend,
            ShowDataLabels = d.ChartConfig.ShowDataLabels
        } : null
    };
}

public record ReportFieldDto
{
    public string FieldId { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string FieldType { get; init; } = string.Empty;
    public AggregationType? Aggregation { get; init; }
    public int SortOrder { get; init; }
}

public record ReportFilterGroupDto
{
    public FilterLogic Logic { get; init; } = FilterLogic.And;
    public List<ReportFilterConditionDto> Conditions { get; init; } = [];
    public List<ReportFilterGroupDto> Groups { get; init; } = [];

    public static ReportFilterGroupDto FromEntity(ReportFilterGroup g) => new()
    {
        Logic = g.Logic,
        Conditions = g.Conditions.Select(c => new ReportFilterConditionDto
        {
            FieldId = c.FieldId,
            Operator = c.Operator,
            Value = c.Value,
            ValueTo = c.ValueTo
        }).ToList(),
        Groups = g.Groups.Select(FromEntity).ToList()
    };
}

public record ReportFilterConditionDto
{
    public string FieldId { get; init; } = string.Empty;
    public string Operator { get; init; } = string.Empty;
    public string? Value { get; init; }
    public string? ValueTo { get; init; }
}

public record ReportGroupingDto
{
    public string FieldId { get; init; } = string.Empty;
    public string? DateTruncation { get; init; }
}

public record ReportChartConfigDto
{
    public ReportChartType ChartType { get; init; } = ReportChartType.Bar;
    public string? ColorScheme { get; init; }
    public bool ShowLegend { get; init; } = true;
    public bool ShowDataLabels { get; init; } = false;
}

/// <summary>
/// Category DTO.
/// </summary>
public record ReportCategoryDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int SortOrder { get; init; }
    public bool IsSeedData { get; init; }

    public static ReportCategoryDto FromEntity(ReportCategory c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Description = c.Description,
        SortOrder = c.SortOrder,
        IsSeedData = c.IsSeedData
    };
}

/// <summary>
/// Report execution result DTO.
/// </summary>
public record ReportExecutionResultDto
{
    public List<Dictionary<string, object?>> Rows { get; init; } = [];
    public int TotalCount { get; init; }
    public List<ReportAggregateResultDto>? Aggregates { get; init; }
    public List<string> ColumnHeaders { get; init; } = [];
    public string? Error { get; init; }
}

public record ReportAggregateResultDto
{
    public string FieldId { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string Aggregation { get; init; } = string.Empty;
    public object? Value { get; init; }
}

/// <summary>
/// Paginated report list response.
/// </summary>
public record ReportPaginatedResponse
{
    public List<ReportListDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

// ---- Request Records ----

public record CreateReportRequest(
    string Name,
    string? Description,
    string EntityType,
    Guid? CategoryId,
    ReportChartType ChartType,
    ReportDefinitionDto Definition);

public record UpdateReportRequest(
    string Name,
    string? Description,
    Guid? CategoryId,
    ReportChartType ChartType,
    ReportDefinitionDto Definition);

public record ExecuteReportRequest(
    int? Page,
    int? PageSize,
    ReportFilterConditionDto? DrillDownFilter);

public record ToggleShareRequest(bool IsShared);

public record CloneReportRequest(string? Name);

public record CreateReportCategoryRequest(string Name, string? Description, int SortOrder = 0);

public record UpdateReportCategoryRequest(string? Name, string? Description, int SortOrder = 0);

// ---- Validators ----

/// <summary>
/// Validates CreateReportRequest: Name required 1-200 chars, EntityType required and valid.
/// </summary>
public class CreateReportRequestValidator : AbstractValidator<CreateReportRequest>
{
    private static readonly HashSet<string> ValidEntityTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Contact", "Deal", "Company", "Lead", "Activity", "Quote", "Request", "Product"
    };

    public CreateReportRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must be 200 characters or fewer.");

        RuleFor(x => x.EntityType)
            .NotEmpty().WithMessage("Entity type is required.")
            .Must(et => ValidEntityTypes.Contains(et))
            .WithMessage("Entity type must be one of: Contact, Deal, Company, Lead, Activity, Quote, Request, Product.");

        RuleFor(x => x.Definition)
            .NotNull().WithMessage("Definition is required.");
    }
}

/// <summary>
/// Validates UpdateReportRequest: Name required 1-200 chars.
/// </summary>
public class UpdateReportRequestValidator : AbstractValidator<UpdateReportRequest>
{
    public UpdateReportRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must be 200 characters or fewer.");

        RuleFor(x => x.Definition)
            .NotNull().WithMessage("Definition is required.");
    }
}
