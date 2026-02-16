using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for saved view management.
/// Authenticated users can manage personal views.
/// Admins can manage team-wide views and set team defaults.
/// Personal views override team defaults per locked decision.
/// </summary>
[ApiController]
[Route("api/views")]
[Authorize]
public class ViewsController : ControllerBase
{
    private readonly IViewRepository _repository;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<ViewsController> _logger;

    public ViewsController(
        IViewRepository repository,
        ITenantProvider tenantProvider,
        ILogger<ViewsController> logger)
    {
        _repository = repository;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    /// <summary>
    /// Lists views for an entity type: personal views for the current user + all team-wide views.
    /// Returns SavedViewDto with computed IsPersonal property.
    /// </summary>
    [HttpGet("{entityType}")]
    [ProducesResponseType(typeof(List<SavedViewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetViewsByEntityType(string entityType)
    {
        var userId = GetCurrentUserId();
        var views = await _repository.GetViewsByEntityTypeAsync(entityType, userId);
        var dtos = views.Select(v => SavedViewDto.FromEntity(v, userId)).ToList();
        return Ok(dtos);
    }

    /// <summary>
    /// Gets a single view by ID.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SavedViewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var view = await _repository.GetByIdAsync(id);
        if (view is null)
            return NotFound(new { error = "View not found." });

        var userId = GetCurrentUserId();
        return Ok(SavedViewDto.FromEntity(view, userId));
    }

    /// <summary>
    /// Creates a new saved view.
    /// OwnerId is set from the current user's claims.
    /// If IsTeamDefault=true, the Admin role is required.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(SavedViewDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateViewRequest request)
    {
        // Validate: at least one column required
        if (request.Columns is null || request.Columns.Count == 0)
        {
            return BadRequest(new { error = "At least one column is required." });
        }

        if (string.IsNullOrWhiteSpace(request.EntityType))
        {
            return BadRequest(new { error = "EntityType is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { error = "Name is required." });
        }

        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole("Admin");

        // Team default views can only be created by admins
        if (request.IsTeamDefault && !isAdmin)
        {
            return Forbid();
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var view = new SavedView
        {
            TenantId = tenantId,
            EntityType = request.EntityType,
            Name = request.Name,
            OwnerId = request.IsTeamDefault ? null : userId,
            IsTeamDefault = request.IsTeamDefault,
            Columns = request.Columns,
            Filters = request.Filters ?? new List<ViewFilter>(),
            Sorts = request.Sorts ?? new List<ViewSort>(),
            PageSize = request.PageSize ?? 25
        };

        var created = await _repository.CreateAsync(view);

        _logger.LogInformation(
            "View created: {ViewName} for {EntityType} (team-wide: {IsTeamWide})",
            created.Name, created.EntityType, created.OwnerId == null);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            SavedViewDto.FromEntity(created, userId));
    }

    /// <summary>
    /// Updates a saved view.
    /// Personal views (OwnerId != null) can only be updated by the owner.
    /// Team-wide views (OwnerId == null) can only be updated by admins.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SavedViewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateViewRequest request)
    {
        var view = await _repository.GetByIdAsync(id);
        if (view is null)
            return NotFound(new { error = "View not found." });

        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole("Admin");

        // Authorization: owner can update personal views, admins can update team-wide views
        if (!CanModifyView(view, userId, isAdmin))
            return Forbid();

        // Apply updates
        if (request.Name is not null)
            view.Name = request.Name;

        if (request.Columns is not null)
        {
            if (request.Columns.Count == 0)
                return BadRequest(new { error = "At least one column is required." });
            view.Columns = request.Columns;
        }

        if (request.Filters is not null)
            view.Filters = request.Filters;

        if (request.Sorts is not null)
            view.Sorts = request.Sorts;

        if (request.PageSize.HasValue)
            view.PageSize = request.PageSize.Value;

        await _repository.UpdateAsync(view);

        _logger.LogInformation("View updated: {ViewId}", id);

        return Ok(SavedViewDto.FromEntity(view, userId));
    }

    /// <summary>
    /// Deletes a saved view.
    /// Personal views can only be deleted by the owner.
    /// Team-wide views can only be deleted by admins.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var view = await _repository.GetByIdAsync(id);
        if (view is null)
            return NotFound(new { error = "View not found." });

        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole("Admin");

        if (!CanModifyView(view, userId, isAdmin))
            return Forbid();

        await _repository.DeleteAsync(id);

        _logger.LogInformation("View deleted: {ViewId}", id);

        return NoContent();
    }

    /// <summary>
    /// Sets a view as the team default for its entity type. Admin only.
    /// Unsets the previous team default for that entity type.
    /// </summary>
    [HttpPost("{id:guid}/set-default")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetTeamDefault(Guid id)
    {
        var view = await _repository.GetByIdAsync(id);
        if (view is null)
            return NotFound(new { error = "View not found." });

        await _repository.SetTeamDefaultAsync(id);

        _logger.LogInformation(
            "View set as team default: {ViewId} for {EntityType}", id, view.EntityType);

        // Re-fetch to get updated state
        var updated = await _repository.GetByIdAsync(id);
        var userId = GetCurrentUserId();

        return Ok(SavedViewDto.FromEntity(updated!, userId));
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Checks if the current user can modify a view.
    /// Personal views (OwnerId != null): only the owner can modify.
    /// Team-wide views (OwnerId == null): only admins can modify.
    /// </summary>
    private static bool CanModifyView(SavedView view, Guid userId, bool isAdmin)
    {
        if (view.OwnerId is not null)
        {
            // Personal view: only owner can modify
            return view.OwnerId == userId;
        }

        // Team-wide view: only admin can modify
        return isAdmin;
    }
}

// ---- DTOs ----

/// <summary>
/// Response DTO for saved views with computed IsPersonal property.
/// </summary>
public record SavedViewDto
{
    public Guid Id { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid? OwnerId { get; init; }
    public bool IsPersonal { get; init; }
    public bool IsTeamDefault { get; init; }
    public List<ViewColumn> Columns { get; init; } = new();
    public List<ViewFilter> Filters { get; init; } = new();
    public List<ViewSort> Sorts { get; init; } = new();
    public int PageSize { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static SavedViewDto FromEntity(SavedView entity, Guid currentUserId) => new()
    {
        Id = entity.Id,
        EntityType = entity.EntityType,
        Name = entity.Name,
        OwnerId = entity.OwnerId,
        IsPersonal = entity.OwnerId is not null,
        IsTeamDefault = entity.IsTeamDefault,
        Columns = entity.Columns,
        Filters = entity.Filters,
        Sorts = entity.Sorts,
        PageSize = entity.PageSize,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a saved view.
/// </summary>
public record CreateViewRequest
{
    public string EntityType { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public List<ViewColumn> Columns { get; init; } = new();
    public List<ViewFilter>? Filters { get; init; }
    public List<ViewSort>? Sorts { get; init; }
    public int? PageSize { get; init; }
    public bool IsTeamDefault { get; init; }
}

/// <summary>
/// Request body for updating a saved view.
/// </summary>
public record UpdateViewRequest
{
    public string? Name { get; init; }
    public List<ViewColumn>? Columns { get; init; }
    public List<ViewFilter>? Filters { get; init; }
    public List<ViewSort>? Sorts { get; init; }
    public int? PageSize { get; init; }
}
