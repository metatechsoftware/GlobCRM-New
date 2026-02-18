using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Dashboards;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for dashboard CRUD, batched widget metric data, and KPI target management.
/// Dashboard ownership: personal (OwnerId set) or team-wide (OwnerId null, admin-only create/edit).
/// Widget data endpoint batches multiple metric requests to avoid N+1 API calls.
/// All endpoints require authentication.
/// </summary>
[ApiController]
[Route("api/dashboards")]
[Authorize]
public class DashboardsController : ControllerBase
{
    private readonly IDashboardRepository _dashboardRepository;
    private readonly ITargetRepository _targetRepository;
    private readonly DashboardAggregationService _aggregationService;
    private readonly IPermissionService _permissionService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<DashboardsController> _logger;

    public DashboardsController(
        IDashboardRepository dashboardRepository,
        ITargetRepository targetRepository,
        DashboardAggregationService aggregationService,
        IPermissionService permissionService,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<DashboardsController> logger)
    {
        _dashboardRepository = dashboardRepository;
        _targetRepository = targetRepository;
        _aggregationService = aggregationService;
        _permissionService = permissionService;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    // ---- Dashboard CRUD ----

    /// <summary>
    /// Lists all dashboards visible to the current user (personal + team-wide).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<DashboardDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList()
    {
        var userId = GetCurrentUserId();
        var dashboards = await _dashboardRepository.GetAllAsync(userId);

        var dtos = dashboards.Select(d => DashboardDto.FromEntity(d)).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Creates a new dashboard. Team-wide dashboards (IsTeamWide=true) require Admin role.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(DashboardDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateDashboardRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Dashboard name is required." });

        var userId = GetCurrentUserId();
        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        Guid? ownerId;
        if (request.IsTeamWide)
        {
            if (!User.IsInRole("Admin"))
                return Forbid();
            ownerId = null;
        }
        else
        {
            ownerId = userId;
        }

        var dashboard = new Dashboard
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            OwnerId = ownerId,
            IsDefault = request.IsDefault,
            Widgets = request.Widgets?.Select((w, i) => new DashboardWidget
            {
                Type = Enum.TryParse<WidgetType>(w.Type, true, out var wt) ? wt : WidgetType.KpiCard,
                Title = w.Title ?? string.Empty,
                X = w.X,
                Y = w.Y,
                Cols = w.Cols > 0 ? w.Cols : 2,
                Rows = w.Rows > 0 ? w.Rows : 2,
                Config = w.Config,
                SortOrder = w.SortOrder ?? i
            }).ToList() ?? new List<DashboardWidget>()
        };

        await _dashboardRepository.CreateAsync(dashboard);

        _logger.LogInformation("Dashboard created: {DashboardName} ({DashboardId})", dashboard.Name, dashboard.Id);

        // Reload with navigations for owner name
        var created = await _dashboardRepository.GetByIdAsync(dashboard.Id);
        return CreatedAtAction(
            nameof(GetById),
            new { id = dashboard.Id },
            DashboardDto.FromEntity(created!));
    }

    /// <summary>
    /// Gets a dashboard by ID with its widgets. Verifies ownership (personal=owner only, admin override).
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DashboardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var dashboard = await _dashboardRepository.GetByIdAsync(id);
        if (dashboard is null)
            return NotFound(new { error = "Dashboard not found." });

        var userId = GetCurrentUserId();
        if (!CanAccessDashboard(dashboard, userId))
            return Forbid();

        return Ok(DashboardDto.FromEntity(dashboard));
    }

    /// <summary>
    /// Updates a dashboard. Same ownership check. For team-wide dashboards, Admin role required.
    /// Widget updates use full-replacement via repository.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDashboardRequest request)
    {
        var dashboard = await _dashboardRepository.GetByIdAsync(id);
        if (dashboard is null)
            return NotFound(new { error = "Dashboard not found." });

        var userId = GetCurrentUserId();
        if (!CanEditDashboard(dashboard, userId))
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Dashboard name is required." });

        dashboard.Name = request.Name;
        dashboard.Description = request.Description;
        dashboard.IsDefault = request.IsDefault;
        dashboard.UpdatedAt = DateTimeOffset.UtcNow;

        // Full-replacement of widgets
        dashboard.Widgets = request.Widgets?.Select((w, i) => new DashboardWidget
        {
            DashboardId = dashboard.Id,
            Type = Enum.TryParse<WidgetType>(w.Type, true, out var wt) ? wt : WidgetType.KpiCard,
            Title = w.Title ?? string.Empty,
            X = w.X,
            Y = w.Y,
            Cols = w.Cols > 0 ? w.Cols : 2,
            Rows = w.Rows > 0 ? w.Rows : 2,
            Config = w.Config,
            SortOrder = w.SortOrder ?? i
        }).ToList() ?? new List<DashboardWidget>();

        await _dashboardRepository.UpdateAsync(dashboard);

        _logger.LogInformation("Dashboard updated: {DashboardId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a dashboard. Same ownership/admin check.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var dashboard = await _dashboardRepository.GetByIdAsync(id);
        if (dashboard is null)
            return NotFound(new { error = "Dashboard not found." });

        var userId = GetCurrentUserId();
        if (!CanEditDashboard(dashboard, userId))
            return Forbid();

        await _dashboardRepository.DeleteAsync(id);

        _logger.LogInformation("Dashboard deleted: {DashboardId}", id);

        return NoContent();
    }

    // ---- Widget Data Endpoint (CRITICAL -- batched) ----

    /// <summary>
    /// Fetches batched widget metric data for a dashboard with date range.
    /// Resolves current user's RBAC scope per entity type via IPermissionService.
    /// Returns results keyed by WidgetId.
    /// </summary>
    [HttpPost("{id:guid}/widget-data")]
    [ProducesResponseType(typeof(WidgetDataResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetWidgetData(Guid id, [FromBody] WidgetDataRequest request)
    {
        var dashboard = await _dashboardRepository.GetByIdAsync(id);
        if (dashboard is null)
            return NotFound(new { error = "Dashboard not found." });

        var userId = GetCurrentUserId();
        if (!CanAccessDashboard(dashboard, userId))
            return Forbid();

        // Normalize dates: detect date-only input (midnight) BEFORE converting to UTC,
        // then push end date to end-of-day so the full day is included.
        // Npgsql requires offset 0 (UTC) for timestamptz columns.
        var effectiveStart = request.StartDate.ToUniversalTime();
        var effectiveEnd = request.EndDate.TimeOfDay == TimeSpan.Zero
            ? new DateTimeOffset(request.EndDate.Date.AddDays(1).AddTicks(-1), request.EndDate.Offset).ToUniversalTime()
            : request.EndDate.ToUniversalTime();

        var results = new Dictionary<string, MetricResultDto>();

        foreach (var widget in request.Widgets)
        {
            if (!Enum.TryParse<MetricType>(widget.MetricType, true, out var metricType))
            {
                results[widget.WidgetId] = new MetricResultDto
                {
                    Value = 0,
                    Label = "Unknown Metric"
                };
                continue;
            }

            // Determine entity type for RBAC scope resolution
            var entityType = GetEntityTypeForMetric(metricType);
            var scope = PermissionScope.None;
            List<Guid>? teamMemberIds = null;

            if (entityType is not null)
            {
                var permission = await _permissionService.GetEffectivePermissionAsync(userId, entityType, "View");
                scope = permission.Scope;
                teamMemberIds = await GetTeamMemberIds(userId, scope);
            }
            else
            {
                // Leaderboard metrics: use deal/activity scope
                var dealPermission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
                scope = dealPermission.Scope;
                teamMemberIds = await GetTeamMemberIds(userId, scope);
            }

            try
            {
                var metricResult = await _aggregationService.ComputeMetricAsync(
                    metricType, effectiveStart, effectiveEnd,
                    userId, scope, teamMemberIds);

                results[widget.WidgetId] = new MetricResultDto
                {
                    Value = metricResult.Value,
                    Label = metricResult.Label,
                    Series = metricResult.Series?.Select(s => new ChartDataPointDto
                    {
                        Label = s.Label,
                        Value = s.Value
                    }).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to compute metric {MetricType} for widget {WidgetId}", metricType, widget.WidgetId);
                results[widget.WidgetId] = new MetricResultDto
                {
                    Value = 0,
                    Label = "Error"
                };
            }
        }

        return Ok(new WidgetDataResponse { Results = results });
    }

    // ---- Target CRUD ----

    /// <summary>
    /// Lists all targets (personal + team-wide) for the current user.
    /// For each target, computes current value from aggregation service.
    /// </summary>
    [HttpGet("/api/targets")]
    [ProducesResponseType(typeof(List<TargetDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTargets()
    {
        var userId = GetCurrentUserId();
        var targets = await _targetRepository.GetAllAsync(userId);

        var dtos = new List<TargetDto>();
        foreach (var target in targets)
        {
            // Determine scope for the target's metric
            var entityType = GetEntityTypeForMetric(target.MetricType);
            var scope = PermissionScope.None;
            List<Guid>? teamMemberIds = null;

            if (entityType is not null)
            {
                var permission = await _permissionService.GetEffectivePermissionAsync(userId, entityType, "View");
                scope = permission.Scope;
                teamMemberIds = await GetTeamMemberIds(userId, scope);
            }
            else
            {
                var dealPermission = await _permissionService.GetEffectivePermissionAsync(userId, "Deal", "View");
                scope = dealPermission.Scope;
                teamMemberIds = await GetTeamMemberIds(userId, scope);
            }

            decimal currentValue = 0;
            try
            {
                var metricResult = await _aggregationService.ComputeMetricAsync(
                    target.MetricType, target.StartDate, target.EndDate,
                    userId, scope, teamMemberIds);
                currentValue = metricResult.Value;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to compute current value for target {TargetId}", target.Id);
            }

            var progressPercent = target.TargetValue > 0
                ? Math.Round(currentValue / target.TargetValue * 100, 1)
                : 0;

            dtos.Add(new TargetDto
            {
                Id = target.Id,
                Name = target.Name,
                MetricType = target.MetricType.ToString(),
                Period = target.Period.ToString(),
                TargetValue = target.TargetValue,
                CurrentValue = currentValue,
                OwnerId = target.OwnerId,
                OwnerName = target.Owner != null
                    ? $"{target.Owner.FirstName} {target.Owner.LastName}".Trim()
                    : null,
                StartDate = target.StartDate,
                EndDate = target.EndDate,
                ProgressPercent = progressPercent,
                CreatedAt = target.CreatedAt,
                UpdatedAt = target.UpdatedAt
            });
        }

        return Ok(dtos);
    }

    /// <summary>
    /// Creates a KPI target. Team-wide targets (IsTeamWide=true) require Admin role.
    /// </summary>
    [HttpPost("/api/targets")]
    [ProducesResponseType(typeof(TargetDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateTarget([FromBody] CreateTargetRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Target name is required." });

        if (!Enum.TryParse<MetricType>(request.MetricType, true, out var metricType))
            return BadRequest(new { error = "Invalid metric type." });

        if (!Enum.TryParse<TargetPeriod>(request.Period, true, out var period))
            return BadRequest(new { error = "Invalid period." });

        var userId = GetCurrentUserId();
        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        Guid? ownerId;
        if (request.IsTeamWide)
        {
            if (!User.IsInRole("Admin"))
                return Forbid();
            ownerId = null;
        }
        else
        {
            ownerId = userId;
        }

        var target = new Target
        {
            TenantId = tenantId,
            Name = request.Name,
            MetricType = metricType,
            Period = period,
            TargetValue = request.TargetValue,
            OwnerId = ownerId,
            StartDate = request.StartDate,
            EndDate = request.EndDate
        };

        await _targetRepository.CreateAsync(target);

        _logger.LogInformation("Target created: {TargetName} ({TargetId})", target.Name, target.Id);

        // Reload for owner navigation
        var created = await _targetRepository.GetByIdAsync(target.Id);
        var dto = new TargetDto
        {
            Id = created!.Id,
            Name = created.Name,
            MetricType = created.MetricType.ToString(),
            Period = created.Period.ToString(),
            TargetValue = created.TargetValue,
            CurrentValue = 0,
            OwnerId = created.OwnerId,
            OwnerName = created.Owner != null
                ? $"{created.Owner.FirstName} {created.Owner.LastName}".Trim()
                : null,
            StartDate = created.StartDate,
            EndDate = created.EndDate,
            ProgressPercent = 0,
            CreatedAt = created.CreatedAt,
            UpdatedAt = created.UpdatedAt
        };

        return CreatedAtAction(nameof(GetTargets), new { id = created.Id }, dto);
    }

    /// <summary>
    /// Updates a KPI target. Ownership check enforced.
    /// </summary>
    [HttpPut("/api/targets/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateTarget(Guid id, [FromBody] UpdateTargetRequest request)
    {
        var target = await _targetRepository.GetByIdAsync(id);
        if (target is null)
            return NotFound(new { error = "Target not found." });

        var userId = GetCurrentUserId();
        if (!CanEditTarget(target, userId))
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Target name is required." });

        target.Name = request.Name;
        target.TargetValue = request.TargetValue;
        target.StartDate = request.StartDate;
        target.EndDate = request.EndDate;
        target.UpdatedAt = DateTimeOffset.UtcNow;

        await _targetRepository.UpdateAsync(target);

        _logger.LogInformation("Target updated: {TargetId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a KPI target. Ownership check enforced.
    /// </summary>
    [HttpDelete("/api/targets/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteTarget(Guid id)
    {
        var target = await _targetRepository.GetByIdAsync(id);
        if (target is null)
            return NotFound(new { error = "Target not found." });

        var userId = GetCurrentUserId();
        if (!CanEditTarget(target, userId))
            return Forbid();

        await _targetRepository.DeleteAsync(id);

        _logger.LogInformation("Target deleted: {TargetId}", id);

        return NoContent();
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Checks if a user can view a dashboard. Team-wide dashboards are visible to all.
    /// Personal dashboards are visible only to the owner or an admin.
    /// </summary>
    private bool CanAccessDashboard(Dashboard dashboard, Guid userId)
    {
        // Team-wide dashboards (OwnerId null) are visible to everyone
        if (dashboard.OwnerId is null)
            return true;

        // Personal dashboard: owner or admin
        return dashboard.OwnerId == userId || User.IsInRole("Admin");
    }

    /// <summary>
    /// Checks if a user can edit/delete a dashboard. Personal dashboards: owner only.
    /// Team-wide dashboards: admin only.
    /// </summary>
    private bool CanEditDashboard(Dashboard dashboard, Guid userId)
    {
        // Team-wide dashboards: admin only
        if (dashboard.OwnerId is null)
            return User.IsInRole("Admin");

        // Personal dashboard: owner or admin
        return dashboard.OwnerId == userId || User.IsInRole("Admin");
    }

    /// <summary>
    /// Checks if a user can edit/delete a target. Personal targets: owner only.
    /// Team-wide targets: admin only.
    /// </summary>
    private bool CanEditTarget(Target target, Guid userId)
    {
        // Team-wide targets: admin only
        if (target.OwnerId is null)
            return User.IsInRole("Admin");

        // Personal target: owner or admin
        return target.OwnerId == userId || User.IsInRole("Admin");
    }

    /// <summary>
    /// Maps a MetricType to its source entity type for RBAC scope resolution.
    /// Returns null for cross-entity metrics (leaderboards).
    /// </summary>
    private static string? GetEntityTypeForMetric(MetricType metricType)
    {
        return metricType switch
        {
            MetricType.DealCount => "Deal",
            MetricType.DealPipelineValue => "Deal",
            MetricType.DealsByStage => "Deal",
            MetricType.DealsWon => "Deal",
            MetricType.DealsLost => "Deal",
            MetricType.WinRate => "Deal",
            MetricType.AverageDealValue => "Deal",
            MetricType.ActivityCount => "Activity",
            MetricType.ActivitiesByType => "Activity",
            MetricType.ActivitiesByStatus => "Activity",
            MetricType.ActivitiesCompleted => "Activity",
            MetricType.OverdueActivities => "Activity",
            MetricType.QuoteTotal => "Quote",
            MetricType.QuotesByStatus => "Quote",
            MetricType.ContactsCreated => "Contact",
            MetricType.CompaniesCreated => "Company",
            MetricType.RequestsByStatus => "Request",
            MetricType.RequestsByPriority => "Request",
            MetricType.SalesLeaderboard => null,    // Cross-entity
            MetricType.ActivityLeaderboard => null,  // Cross-entity
            _ => null
        };
    }

    /// <summary>
    /// Gets team member user IDs for Team scope filtering.
    /// Only queries when scope is Team.
    /// </summary>
    private async Task<List<Guid>?> GetTeamMemberIds(Guid userId, PermissionScope scope)
    {
        if (scope != PermissionScope.Team)
            return null;

        var userTeamIds = await _db.TeamMembers
            .Where(tm => tm.UserId == userId)
            .Select(tm => tm.TeamId)
            .ToListAsync();

        if (userTeamIds.Count == 0)
            return new List<Guid>();

        var memberIds = await _db.TeamMembers
            .Where(tm => userTeamIds.Contains(tm.TeamId))
            .Select(tm => tm.UserId)
            .Distinct()
            .ToListAsync();

        return memberIds;
    }
}

// ---- Dashboard DTOs ----

/// <summary>
/// DTO for dashboard list and detail views.
/// </summary>
public record DashboardDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public bool IsDefault { get; init; }
    public bool IsTeamWide { get; init; }
    public List<WidgetDto> Widgets { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static DashboardDto FromEntity(Dashboard entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        IsDefault = entity.IsDefault,
        IsTeamWide = entity.OwnerId is null,
        Widgets = entity.Widgets.OrderBy(w => w.SortOrder).Select(w => new WidgetDto
        {
            Id = w.Id,
            Type = w.Type.ToString(),
            Title = w.Title,
            X = w.X,
            Y = w.Y,
            Cols = w.Cols,
            Rows = w.Rows,
            Config = w.Config,
            SortOrder = w.SortOrder
        }).ToList(),
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for a widget within a dashboard.
/// </summary>
public record WidgetDto
{
    public Guid Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public int X { get; init; }
    public int Y { get; init; }
    public int Cols { get; init; }
    public int Rows { get; init; }
    public Dictionary<string, object>? Config { get; init; }
    public int SortOrder { get; init; }
}

/// <summary>
/// Request body for creating a dashboard.
/// </summary>
public record CreateDashboardRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsTeamWide { get; init; }
    public bool IsDefault { get; init; }
    public List<CreateWidgetRequest>? Widgets { get; init; }
}

/// <summary>
/// Request body for creating a widget within a dashboard.
/// </summary>
public record CreateWidgetRequest
{
    public string Type { get; init; } = string.Empty;
    public string? Title { get; init; }
    public int X { get; init; }
    public int Y { get; init; }
    public int Cols { get; init; }
    public int Rows { get; init; }
    public Dictionary<string, object>? Config { get; init; }
    public int? SortOrder { get; init; }
}

/// <summary>
/// Request body for updating a dashboard.
/// </summary>
public record UpdateDashboardRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsDefault { get; init; }
    public List<CreateWidgetRequest>? Widgets { get; init; }
}

// ---- Widget Data DTOs ----

/// <summary>
/// Request body for fetching batched widget data.
/// </summary>
public record WidgetDataRequest
{
    public List<WidgetMetricRequest> Widgets { get; init; } = new();
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset EndDate { get; init; }
}

/// <summary>
/// A single widget metric request within a batch.
/// </summary>
public record WidgetMetricRequest
{
    public string WidgetId { get; init; } = string.Empty;
    public string MetricType { get; init; } = string.Empty;
    public Dictionary<string, object?>? Config { get; init; }
}

/// <summary>
/// Response containing batched metric results keyed by WidgetId.
/// </summary>
public record WidgetDataResponse
{
    public Dictionary<string, MetricResultDto> Results { get; init; } = new();
}

/// <summary>
/// DTO for a computed metric result.
/// </summary>
public record MetricResultDto
{
    public decimal Value { get; init; }
    public string Label { get; init; } = string.Empty;
    public List<ChartDataPointDto>? Series { get; init; }
}

/// <summary>
/// A single chart data point.
/// </summary>
public record ChartDataPointDto
{
    public string Label { get; init; } = string.Empty;
    public decimal Value { get; init; }
}

// ---- Target DTOs ----

/// <summary>
/// DTO for KPI target display with computed current value and progress.
/// </summary>
public record TargetDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string MetricType { get; init; } = string.Empty;
    public string Period { get; init; } = string.Empty;
    public decimal TargetValue { get; init; }
    public decimal CurrentValue { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset EndDate { get; init; }
    public decimal ProgressPercent { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>
/// Request body for creating a KPI target.
/// </summary>
public record CreateTargetRequest
{
    public string Name { get; init; } = string.Empty;
    public string MetricType { get; init; } = string.Empty;
    public string Period { get; init; } = string.Empty;
    public decimal TargetValue { get; init; }
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset EndDate { get; init; }
    public bool IsTeamWide { get; init; }
}

/// <summary>
/// Request body for updating a KPI target.
/// </summary>
public record UpdateTargetRequest
{
    public string Name { get; init; } = string.Empty;
    public decimal TargetValue { get; init; }
    public DateTimeOffset StartDate { get; init; }
    public DateTimeOffset EndDate { get; init; }
}
