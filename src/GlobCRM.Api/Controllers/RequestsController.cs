using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.CustomFields;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Request CRUD, status workflow transitions, allowed transitions,
/// and timeline. Dual-ownership scope enforcement checks both OwnerId and AssignedToId
/// (users see requests they own OR are assigned to), matching the Activity pattern.
/// </summary>
[ApiController]
[Route("api/requests")]
[Authorize]
public class RequestsController : ControllerBase
{
    private readonly IRequestRepository _requestRepository;
    private readonly IPermissionService _permissionService;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly CustomFieldValidator _customFieldValidator;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<RequestsController> _logger;

    public RequestsController(
        IRequestRepository requestRepository,
        IPermissionService permissionService,
        ICustomFieldRepository customFieldRepository,
        CustomFieldValidator customFieldValidator,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<RequestsController> logger)
    {
        _requestRepository = requestRepository;
        _permissionService = permissionService;
        _customFieldRepository = customFieldRepository;
        _customFieldValidator = customFieldValidator;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    // ---- Core CRUD Endpoints ----

    /// <summary>
    /// Lists requests with server-side filtering, sorting, pagination, and ownership scope.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Request:View")]
    [ProducesResponseType(typeof(PagedResult<RequestListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Request", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var pagedResult = await _requestRepository.GetPagedAsync(
            queryParams, permission.Scope, userId, teamMemberIds);

        var dtoResult = new PagedResult<RequestListDto>
        {
            Items = pagedResult.Items.Select(RequestListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single request by ID with all fields and allowed transitions.
    /// Dual-ownership scope verified.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Request:View")]
    [ProducesResponseType(typeof(RequestDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var request = await _requestRepository.GetByIdAsync(id);
        if (request is null)
            return NotFound(new { error = "Request not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Request", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(request.OwnerId, request.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var allowedTransitions = RequestWorkflow.GetAllowedTransitions(request.Status)
            .Select(s => s.ToString())
            .ToList();

        var dto = RequestDetailDto.FromEntity(request, allowedTransitions);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new request. Status starts as New. OwnerId set to current user.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Request:Create")]
    [ProducesResponseType(typeof(RequestDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateRequestRequest request)
    {
        var validator = new CreateRequestRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Parse priority
        if (!Enum.TryParse<RequestPriority>(request.Priority, true, out var priority))
            return BadRequest(new { error = $"Invalid priority: {request.Priority}. Must be one of: Low, Medium, High, Urgent." });

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Request", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var userId = GetCurrentUserId();

        var entity = new Request
        {
            TenantId = tenantId,
            Subject = request.Subject,
            Description = request.Description,
            Status = RequestStatus.New,
            Priority = priority,
            Category = request.Category,
            OwnerId = userId,
            AssignedToId = request.AssignedToId,
            ContactId = request.ContactId,
            CompanyId = request.CompanyId,
            CustomFields = request.CustomFields ?? new Dictionary<string, object?>()
        };

        var created = await _requestRepository.CreateAsync(entity);

        _logger.LogInformation("Request created: {RequestId} - {Subject}", created.Id, created.Subject);

        // Reload for navigation properties
        var reloaded = await _requestRepository.GetByIdAsync(created.Id);
        var allowedTransitions = RequestWorkflow.GetAllowedTransitions(reloaded!.Status)
            .Select(s => s.ToString())
            .ToList();

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            RequestDetailDto.FromEntity(reloaded!, allowedTransitions));
    }

    /// <summary>
    /// Updates request fields. Does NOT allow status change via PUT (use PATCH /status).
    /// Dual-ownership scope check.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Request:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRequestRequest request)
    {
        var entity = await _requestRepository.GetByIdAsync(id);
        if (entity is null)
            return NotFound(new { error = "Request not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Request", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(entity.OwnerId, entity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Parse priority
        if (!Enum.TryParse<RequestPriority>(request.Priority, true, out var priority))
            return BadRequest(new { error = $"Invalid priority: {request.Priority}. Must be one of: Low, Medium, High, Urgent." });

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Request", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Update fields (NOT status -- use PATCH /status)
        entity.Subject = request.Subject;
        entity.Description = request.Description;
        entity.Priority = priority;
        entity.Category = request.Category;
        entity.AssignedToId = request.AssignedToId;
        entity.ContactId = request.ContactId;
        entity.CompanyId = request.CompanyId;

        if (request.CustomFields is not null)
            entity.CustomFields = request.CustomFields;

        await _requestRepository.UpdateAsync(entity);

        _logger.LogInformation("Request updated: {RequestId}", id);

        return NoContent();
    }

    /// <summary>
    /// Deletes a request with dual-ownership scope check.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Request:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await _requestRepository.GetByIdAsync(id);
        if (entity is null)
            return NotFound(new { error = "Request not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Request", "Delete");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(entity.OwnerId, entity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        await _requestRepository.DeleteAsync(id);

        _logger.LogInformation("Request deleted: {RequestId}", id);

        return NoContent();
    }

    // ---- Status Transition ----

    /// <summary>
    /// Changes request status using RequestWorkflow validation.
    /// Sets ResolvedAt on transition to Resolved, ClosedAt on transition to Closed.
    /// Clears ResolvedAt/ClosedAt when reopening.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = "Permission:Request:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateRequestStatusRequest request)
    {
        var entity = await _requestRepository.GetByIdAsync(id);
        if (entity is null)
            return NotFound(new { error = "Request not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Request", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(entity.OwnerId, entity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Parse target status
        if (!Enum.TryParse<RequestStatus>(request.Status, true, out var newStatus))
            return BadRequest(new { error = $"Invalid status: {request.Status}. Must be one of: New, InProgress, Resolved, Closed." });

        var currentStatus = entity.Status;

        // Validate transition via workflow
        if (!RequestWorkflow.CanTransition(currentStatus, newStatus))
            return BadRequest(new { error = $"Cannot transition from {currentStatus} to {newStatus}." });

        // Update timestamps based on transition
        entity.Status = newStatus;

        switch (newStatus)
        {
            case RequestStatus.Resolved:
                entity.ResolvedAt = DateTimeOffset.UtcNow;
                break;
            case RequestStatus.Closed:
                entity.ClosedAt = DateTimeOffset.UtcNow;
                break;
            case RequestStatus.New:
            case RequestStatus.InProgress:
                // Reopening -- clear resolved/closed timestamps
                entity.ResolvedAt = null;
                entity.ClosedAt = null;
                break;
        }

        await _requestRepository.UpdateAsync(entity);

        _logger.LogInformation("Request {RequestId} status changed from {From} to {To}", id, currentStatus, newStatus);

        return NoContent();
    }

    // ---- Allowed Transitions ----

    /// <summary>
    /// Returns the allowed status transitions for the request's current status.
    /// </summary>
    [HttpGet("{id:guid}/allowed-transitions")]
    [Authorize(Policy = "Permission:Request:View")]
    [ProducesResponseType(typeof(List<string>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAllowedTransitions(Guid id)
    {
        var entity = await _requestRepository.GetByIdAsync(id);
        if (entity is null)
            return NotFound(new { error = "Request not found." });

        var transitions = RequestWorkflow.GetAllowedTransitions(entity.Status)
            .Select(s => s.ToString())
            .ToList();

        return Ok(transitions);
    }

    // ---- Timeline ----

    /// <summary>
    /// Returns a simplified timeline for a request: creation event and status
    /// milestones inferred from ResolvedAt/ClosedAt timestamps (Requests don't
    /// have a separate status history table).
    /// </summary>
    [HttpGet("{id:guid}/timeline")]
    [Authorize(Policy = "Permission:Request:View")]
    [ProducesResponseType(typeof(List<RequestTimelineEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTimeline(Guid id)
    {
        var entity = await _requestRepository.GetByIdAsync(id);
        if (entity is null)
            return NotFound(new { error = "Request not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Request", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(entity.OwnerId, entity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var entries = new List<RequestTimelineEntryDto>();

        // 1. Creation event
        entries.Add(new RequestTimelineEntryDto
        {
            Id = Guid.NewGuid(),
            Type = "created",
            Title = "Request created",
            Description = $"Request '{entity.Subject}' was created with priority {entity.Priority}.",
            Timestamp = entity.CreatedAt,
            UserId = entity.OwnerId,
            UserName = entity.Owner != null
                ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
                : null
        });

        // 2. Resolved event (if applicable)
        if (entity.ResolvedAt.HasValue)
        {
            entries.Add(new RequestTimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "status_changed",
                Title = "Request resolved",
                Description = "Request was marked as resolved.",
                Timestamp = entity.ResolvedAt.Value,
            });
        }

        // 3. Closed event (if applicable)
        if (entity.ClosedAt.HasValue)
        {
            entries.Add(new RequestTimelineEntryDto
            {
                Id = Guid.NewGuid(),
                Type = "status_changed",
                Title = "Request closed",
                Description = "Request was closed.",
                Timestamp = entity.ClosedAt.Value,
            });
        }

        // Sort by timestamp descending
        var sorted = entries.OrderByDescending(e => e.Timestamp).ToList();

        return Ok(sorted);
    }

    // ---- Helper Methods ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    /// <summary>
    /// Checks if a request is within the user's ownership scope.
    /// Dual-ownership: checks both OwnerId and AssignedToId (matching Activity pattern).
    /// </summary>
    private static bool IsWithinScope(
        Guid? ownerId,
        Guid? assignedToId,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => true,
            PermissionScope.Team => ownerId == userId ||
                                    assignedToId == userId ||
                                    (ownerId.HasValue && teamMemberIds is not null && teamMemberIds.Contains(ownerId.Value)) ||
                                    (assignedToId.HasValue && teamMemberIds is not null && teamMemberIds.Contains(assignedToId.Value)),
            PermissionScope.Own => ownerId == userId || assignedToId == userId,
            PermissionScope.None => false,
            _ => false
        };
    }

    /// <summary>
    /// Gets team member user IDs for Team scope filtering.
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

// ---- DTOs ----

/// <summary>
/// Summary DTO for request list views.
/// </summary>
public record RequestListDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public string? Category { get; init; }
    public string? ContactName { get; init; }
    public string? CompanyName { get; init; }
    public string? OwnerName { get; init; }
    public string? AssignedToName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ResolvedAt { get; init; }

    public static RequestListDto FromEntity(Request entity) => new()
    {
        Id = entity.Id,
        Subject = entity.Subject,
        Status = entity.Status.ToString(),
        Priority = entity.Priority.ToString(),
        Category = entity.Category,
        ContactName = entity.Contact?.FullName,
        CompanyName = entity.Company?.Name,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        AssignedToName = entity.AssignedTo != null
            ? $"{entity.AssignedTo.FirstName} {entity.AssignedTo.LastName}".Trim()
            : null,
        CreatedAt = entity.CreatedAt,
        ResolvedAt = entity.ResolvedAt,
    };
}

/// <summary>
/// Detailed DTO for request detail view including allowed transitions.
/// </summary>
public record RequestDetailDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Status { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public string? Category { get; init; }
    public Guid? ContactId { get; init; }
    public string? ContactName { get; init; }
    public Guid? CompanyId { get; init; }
    public string? CompanyName { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public Guid? AssignedToId { get; init; }
    public string? AssignedToName { get; init; }
    public DateTimeOffset? ResolvedAt { get; init; }
    public DateTimeOffset? ClosedAt { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public List<string> AllowedTransitions { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static RequestDetailDto FromEntity(Request entity, List<string> allowedTransitions) => new()
    {
        Id = entity.Id,
        Subject = entity.Subject,
        Description = entity.Description,
        Status = entity.Status.ToString(),
        Priority = entity.Priority.ToString(),
        Category = entity.Category,
        ContactId = entity.ContactId,
        ContactName = entity.Contact?.FullName,
        CompanyId = entity.CompanyId,
        CompanyName = entity.Company?.Name,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        AssignedToId = entity.AssignedToId,
        AssignedToName = entity.AssignedTo != null
            ? $"{entity.AssignedTo.FirstName} {entity.AssignedTo.LastName}".Trim()
            : null,
        ResolvedAt = entity.ResolvedAt,
        ClosedAt = entity.ClosedAt,
        CustomFields = entity.CustomFields,
        AllowedTransitions = allowedTransitions,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt,
    };
}

/// <summary>
/// Request timeline entry DTO.
/// </summary>
public record RequestTimelineEntryDto
{
    public Guid Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public Guid? UserId { get; init; }
    public string? UserName { get; init; }
}

// ---- Request Bodies ----

/// <summary>
/// Request body for creating a request.
/// </summary>
public record CreateRequestRequest
{
    public string Subject { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Priority { get; init; } = "Medium";
    public string? Category { get; init; }
    public Guid? AssignedToId { get; init; }
    public Guid? ContactId { get; init; }
    public Guid? CompanyId { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for updating a request. Does NOT include status (use PATCH /status).
/// </summary>
public record UpdateRequestRequest
{
    public string Subject { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Priority { get; init; } = "Medium";
    public string? Category { get; init; }
    public Guid? AssignedToId { get; init; }
    public Guid? ContactId { get; init; }
    public Guid? CompanyId { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for changing a request's status.
/// </summary>
public record UpdateRequestStatusRequest
{
    public string Status { get; init; } = string.Empty;
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateRequestRequest.
/// Validates subject (3-500 chars), priority must be valid enum string.
/// </summary>
public class CreateRequestRequestValidator : AbstractValidator<CreateRequestRequest>
{
    public CreateRequestRequestValidator()
    {
        RuleFor(x => x.Subject)
            .NotEmpty().WithMessage("Request subject is required.")
            .MinimumLength(3).WithMessage("Request subject must be at least 3 characters.")
            .MaximumLength(500).WithMessage("Request subject must be at most 500 characters.");

        RuleFor(x => x.Priority)
            .NotEmpty().WithMessage("Priority is required.")
            .Must(p => Enum.TryParse<RequestPriority>(p, true, out _))
            .WithMessage("Priority must be one of: Low, Medium, High, Urgent.");
    }
}
