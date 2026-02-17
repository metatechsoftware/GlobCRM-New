using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.CustomFields;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Activity CRUD, workflow status transitions, Kanban data,
/// timeline aggregation, allowed transitions, and sub-resource endpoints for
/// comments, attachments, time entries, entity links, and followers.
/// Ownership scope enforcement checks both OwnerId and AssignedToId
/// (users see activities they own OR are assigned to).
/// </summary>
[ApiController]
[Route("api/activities")]
[Authorize]
public class ActivitiesController : ControllerBase
{
    private readonly IActivityRepository _activityRepository;
    private readonly IPermissionService _permissionService;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly CustomFieldValidator _customFieldValidator;
    private readonly ITenantProvider _tenantProvider;
    private readonly IFileStorageService _fileStorageService;
    private readonly ICompanyRepository _companyRepository;
    private readonly IContactRepository _contactRepository;
    private readonly IDealRepository _dealRepository;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ActivitiesController> _logger;

    public ActivitiesController(
        IActivityRepository activityRepository,
        IPermissionService permissionService,
        ICustomFieldRepository customFieldRepository,
        CustomFieldValidator customFieldValidator,
        ITenantProvider tenantProvider,
        IFileStorageService fileStorageService,
        ICompanyRepository companyRepository,
        IContactRepository contactRepository,
        IDealRepository dealRepository,
        ApplicationDbContext db,
        ILogger<ActivitiesController> logger)
    {
        _activityRepository = activityRepository;
        _permissionService = permissionService;
        _customFieldRepository = customFieldRepository;
        _customFieldValidator = customFieldValidator;
        _tenantProvider = tenantProvider;
        _fileStorageService = fileStorageService;
        _companyRepository = companyRepository;
        _contactRepository = contactRepository;
        _dealRepository = dealRepository;
        _db = db;
        _logger = logger;
    }

    // ---- Core CRUD Endpoints ----

    /// <summary>
    /// Lists activities with server-side filtering, sorting, pagination, and ownership scope.
    /// Supports optional linkedEntityType and linkedEntityId for entity-scoped queries (ACTV-13).
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(typeof(PagedResult<ActivityListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] EntityQueryParams queryParams,
        [FromQuery] string? linkedEntityType = null,
        [FromQuery] Guid? linkedEntityId = null)
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var pagedResult = await _activityRepository.GetPagedAsync(
            queryParams, userId, permission.Scope, teamMemberIds,
            linkedEntityType, linkedEntityId);

        var dtoResult = new PagedResult<ActivityListDto>
        {
            Items = pagedResult.Items.Select(ActivityListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single activity by ID with full details including comments, attachments,
    /// time entries, followers, and links. Ownership scope verified.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(typeof(ActivityDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var activity = await _activityRepository.GetByIdWithDetailsAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var dto = ActivityDetailDto.FromEntity(activity);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new activity. Status always starts as Assigned.
    /// OwnerId set from JWT claims (current user).
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Activity:Create")]
    [ProducesResponseType(typeof(ActivityDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateActivityRequest request)
    {
        var validator = new CreateActivityRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Parse enums
        if (!Enum.TryParse<ActivityType>(request.Type, true, out var activityType))
            return BadRequest(new { error = $"Invalid activity type: {request.Type}. Must be one of: Task, Call, Meeting." });

        if (!Enum.TryParse<ActivityPriority>(request.Priority, true, out var activityPriority))
            return BadRequest(new { error = $"Invalid activity priority: {request.Priority}. Must be one of: Low, Medium, High, Urgent." });

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Activity", request.CustomFields);
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

        var activity = new Activity
        {
            TenantId = tenantId,
            Subject = request.Subject,
            Description = request.Description,
            Type = activityType,
            Status = ActivityStatus.Assigned,
            Priority = activityPriority,
            DueDate = request.DueDate,
            OwnerId = userId,
            AssignedToId = request.AssignedToId,
            CustomFields = request.CustomFields ?? new Dictionary<string, object?>()
        };

        var created = await _activityRepository.CreateAsync(activity);

        _logger.LogInformation("Activity created: {Subject} ({ActivityId})", created.Subject, created.Id);

        // Reload with full navigations for DTO
        var reloaded = await _activityRepository.GetByIdWithDetailsAsync(created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            ActivityDetailDto.FromEntity(reloaded!));
    }

    /// <summary>
    /// Updates an activity. Does NOT allow changing Status via PUT (use PATCH status endpoint).
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(typeof(ActivityDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateActivityRequest request)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Parse enums
        if (!Enum.TryParse<ActivityType>(request.Type, true, out var activityType))
            return BadRequest(new { error = $"Invalid activity type: {request.Type}. Must be one of: Task, Call, Meeting." });

        if (!Enum.TryParse<ActivityPriority>(request.Priority, true, out var activityPriority))
            return BadRequest(new { error = $"Invalid activity priority: {request.Priority}. Must be one of: Low, Medium, High, Urgent." });

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Activity", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Update fields (NOT status -- use PATCH /status for that)
        activity.Subject = request.Subject;
        activity.Description = request.Description;
        activity.Type = activityType;
        activity.Priority = activityPriority;
        activity.DueDate = request.DueDate;
        activity.AssignedToId = request.AssignedToId;

        if (request.CustomFields is not null)
            activity.CustomFields = request.CustomFields;

        await _activityRepository.UpdateAsync(activity);

        _logger.LogInformation("Activity updated: {ActivityId}", id);

        // Reload with full navigations for DTO
        var reloaded = await _activityRepository.GetByIdWithDetailsAsync(id);
        return Ok(ActivityDetailDto.FromEntity(reloaded!));
    }

    /// <summary>
    /// Deletes an activity with ownership scope verification. Cascade deletes all children.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Activity:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Delete");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        await _activityRepository.DeleteAsync(activity);

        _logger.LogInformation("Activity deleted: {ActivityId}", id);

        return NoContent();
    }

    // ---- Status Transition ----

    /// <summary>
    /// Transitions an activity's status using the workflow state machine.
    /// Validates allowed transitions via ActivityWorkflow.CanTransition.
    /// Creates ActivityStatusHistory audit record.
    /// Sets/clears CompletedAt when transitioning to/from Done.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateActivityStatusRequest request)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Parse target status
        if (!Enum.TryParse<ActivityStatus>(request.Status, true, out var newStatus))
            return BadRequest(new { error = $"Invalid status: {request.Status}. Must be one of: Assigned, Accepted, InProgress, Review, Done." });

        var currentStatus = activity.Status;

        // Validate transition via workflow state machine
        if (!ActivityWorkflow.CanTransition(currentStatus, newStatus))
            return BadRequest(new { error = $"Cannot transition from {currentStatus} to {newStatus}." });

        // Create status history audit record
        var history = new ActivityStatusHistory
        {
            ActivityId = activity.Id,
            FromStatus = currentStatus,
            ToStatus = newStatus,
            ChangedByUserId = userId,
        };
        _db.ActivityStatusHistories.Add(history);

        // Set/clear CompletedAt based on Done transition
        if (newStatus == ActivityStatus.Done)
        {
            activity.CompletedAt = DateTimeOffset.UtcNow;
        }
        else if (currentStatus == ActivityStatus.Done)
        {
            activity.CompletedAt = null;
        }

        // Update status
        activity.Status = newStatus;
        await _activityRepository.UpdateAsync(activity);

        _logger.LogInformation("Activity {ActivityId} status changed from {From} to {To}", id, currentStatus, newStatus);

        return NoContent();
    }

    // ---- Kanban Data ----

    /// <summary>
    /// Gets all non-Done activities grouped by status for Kanban board display.
    /// Respects ownership scope.
    /// </summary>
    [HttpGet("kanban")]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(typeof(ActivityKanbanDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetKanban()
    {
        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        var activities = await _activityRepository.GetByStatusGroupAsync(
            userId, permission.Scope, teamMemberIds);

        // Group activities by status
        var activitiesByStatus = activities
            .GroupBy(a => a.Status)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Build Kanban columns for all non-Done statuses
        var statusOrder = new[]
        {
            ActivityStatus.Assigned,
            ActivityStatus.Accepted,
            ActivityStatus.InProgress,
            ActivityStatus.Review
        };

        var columns = statusOrder.Select(status => new ActivityKanbanColumnDto
        {
            Status = status.ToString(),
            Cards = activitiesByStatus.GetValueOrDefault(status, new List<Activity>())
                .Select(a => new ActivityKanbanCardDto
                {
                    Id = a.Id,
                    Subject = a.Subject,
                    Type = a.Type.ToString(),
                    Priority = a.Priority.ToString(),
                    DueDate = a.DueDate,
                    AssignedToName = a.AssignedTo != null
                        ? $"{a.AssignedTo.FirstName} {a.AssignedTo.LastName}".Trim()
                        : null,
                    OwnerName = a.Owner != null
                        ? $"{a.Owner.FirstName} {a.Owner.LastName}".Trim()
                        : null
                }).ToList()
        }).ToList();

        var kanban = new ActivityKanbanDto
        {
            Columns = columns
        };

        return Ok(kanban);
    }

    // ---- Timeline ----

    /// <summary>
    /// Returns chronological timeline for an activity aggregating:
    /// creation, status changes, comments, attachments, time entries, and entity links.
    /// Sorted by timestamp descending.
    /// </summary>
    [HttpGet("{id:guid}/timeline")]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(typeof(List<ActivityTimelineEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTimeline(Guid id)
    {
        var activity = await _activityRepository.GetByIdWithDetailsAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var entries = new List<ActivityTimelineEntryDto>();

        // 1. Entity creation event
        entries.Add(new ActivityTimelineEntryDto
        {
            Id = Guid.NewGuid(),
            Type = "created",
            Title = "Activity created",
            Description = $"Activity '{activity.Subject}' was created.",
            Timestamp = activity.CreatedAt,
            UserId = activity.OwnerId,
            UserName = activity.Owner != null
                ? $"{activity.Owner.FirstName} {activity.Owner.LastName}".Trim()
                : null
        });

        // 2. Status changes (from ActivityStatusHistory)
        var statusHistory = await _activityRepository.GetStatusHistoryAsync(id);
        foreach (var history in statusHistory)
        {
            entries.Add(new ActivityTimelineEntryDto
            {
                Id = history.Id,
                Type = "status_changed",
                Title = $"Status changed: {history.FromStatus} -> {history.ToStatus}",
                Description = $"Status moved from '{history.FromStatus}' to '{history.ToStatus}'.",
                Timestamp = history.ChangedAt,
                UserId = history.ChangedByUserId,
                UserName = history.ChangedByUser != null
                    ? $"{history.ChangedByUser.FirstName} {history.ChangedByUser.LastName}".Trim()
                    : null
            });
        }

        // 3. Comments
        foreach (var comment in activity.Comments)
        {
            entries.Add(new ActivityTimelineEntryDto
            {
                Id = comment.Id,
                Type = "comment_added",
                Title = "Comment added",
                Description = comment.Content.Length > 200
                    ? comment.Content[..200] + "..."
                    : comment.Content,
                Timestamp = comment.CreatedAt,
                UserId = comment.AuthorId,
                UserName = comment.Author != null
                    ? $"{comment.Author.FirstName} {comment.Author.LastName}".Trim()
                    : null
            });
        }

        // 4. Attachments
        foreach (var attachment in activity.Attachments)
        {
            entries.Add(new ActivityTimelineEntryDto
            {
                Id = attachment.Id,
                Type = "attachment_uploaded",
                Title = $"File uploaded: {attachment.FileName}",
                Description = $"'{attachment.FileName}' ({attachment.ContentType}) was uploaded.",
                Timestamp = attachment.UploadedAt,
                UserId = attachment.UploadedById,
                UserName = attachment.UploadedBy != null
                    ? $"{attachment.UploadedBy.FirstName} {attachment.UploadedBy.LastName}".Trim()
                    : null
            });
        }

        // 5. Time entries
        foreach (var timeEntry in activity.TimeEntries)
        {
            entries.Add(new ActivityTimelineEntryDto
            {
                Id = timeEntry.Id,
                Type = "time_logged",
                Title = $"Time logged: {timeEntry.DurationMinutes} min",
                Description = timeEntry.Description ?? $"{timeEntry.DurationMinutes} minutes logged.",
                Timestamp = timeEntry.CreatedAt,
                UserId = timeEntry.UserId,
                UserName = timeEntry.User != null
                    ? $"{timeEntry.User.FirstName} {timeEntry.User.LastName}".Trim()
                    : null
            });
        }

        // 6. Entity links
        foreach (var link in activity.Links)
        {
            entries.Add(new ActivityTimelineEntryDto
            {
                Id = link.Id,
                Type = "entity_linked",
                Title = $"{link.EntityType} linked: {link.EntityName ?? link.EntityId.ToString()}",
                Description = $"{link.EntityType} '{link.EntityName ?? link.EntityId.ToString()}' was linked to this activity.",
                Timestamp = link.LinkedAt,
            });
        }

        // Sort by timestamp descending
        var sorted = entries.OrderByDescending(e => e.Timestamp).ToList();

        return Ok(sorted);
    }

    // ---- Allowed Transitions ----

    /// <summary>
    /// Returns allowed status transitions for an activity.
    /// Frontend uses this to show valid drop targets on Kanban board.
    /// </summary>
    [HttpGet("{id:guid}/allowed-transitions")]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(typeof(string[]), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAllowedTransitions(Guid id)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var allowed = ActivityWorkflow.GetAllowedTransitions(activity.Status)
            .Select(s => s.ToString())
            .ToArray();

        return Ok(allowed);
    }

    // ---- Comments (ACTV-05) ----

    /// <summary>
    /// Adds a comment to an activity. AuthorId set from JWT.
    /// </summary>
    [HttpPost("{id:guid}/comments")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(typeof(ActivityCommentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] AddCommentRequest request)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Content) || request.Content.Length < 1 || request.Content.Length > 5000)
            return BadRequest(new { error = "Comment content must be between 1 and 5000 characters." });

        var comment = new ActivityComment
        {
            ActivityId = id,
            Content = request.Content.Trim(),
            AuthorId = userId,
        };

        _db.ActivityComments.Add(comment);
        await _db.SaveChangesAsync();

        // Reload with Author navigation
        var saved = await _db.ActivityComments
            .Include(c => c.Author)
            .FirstAsync(c => c.Id == comment.Id);

        var dto = new ActivityCommentDto
        {
            Id = saved.Id,
            Content = saved.Content,
            AuthorName = saved.Author != null
                ? $"{saved.Author.FirstName} {saved.Author.LastName}".Trim()
                : null,
            AuthorId = saved.AuthorId,
            CreatedAt = saved.CreatedAt,
            UpdatedAt = saved.UpdatedAt
        };

        _logger.LogInformation("Comment added to activity {ActivityId}", id);

        return StatusCode(StatusCodes.Status201Created, dto);
    }

    /// <summary>
    /// Edits a comment on an activity. Only the original author can edit their own comment.
    /// </summary>
    [HttpPut("{id:guid}/comments/{commentId:guid}")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(typeof(ActivityCommentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateComment(Guid id, Guid commentId, [FromBody] AddCommentRequest request)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var comment = await _db.ActivityComments
            .Include(c => c.Author)
            .FirstOrDefaultAsync(c => c.Id == commentId && c.ActivityId == id);

        if (comment is null)
            return NotFound(new { error = "Comment not found." });

        // Only the author can edit their own comment
        if (comment.AuthorId != userId)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the comment author can edit this comment." });

        if (string.IsNullOrWhiteSpace(request.Content) || request.Content.Length < 1 || request.Content.Length > 5000)
            return BadRequest(new { error = "Comment content must be between 1 and 5000 characters." });

        comment.Content = request.Content.Trim();
        comment.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        var dto = new ActivityCommentDto
        {
            Id = comment.Id,
            Content = comment.Content,
            AuthorName = comment.Author != null
                ? $"{comment.Author.FirstName} {comment.Author.LastName}".Trim()
                : null,
            AuthorId = comment.AuthorId,
            CreatedAt = comment.CreatedAt,
            UpdatedAt = comment.UpdatedAt
        };

        _logger.LogInformation("Comment {CommentId} updated on activity {ActivityId}", commentId, id);

        return Ok(dto);
    }

    /// <summary>
    /// Deletes a comment from an activity. Only the author or admin can delete.
    /// </summary>
    [HttpDelete("{id:guid}/comments/{commentId:guid}")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteComment(Guid id, Guid commentId)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var comment = await _db.ActivityComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.ActivityId == id);

        if (comment is null)
            return NotFound(new { error = "Comment not found." });

        // Only the author or admin can delete
        var isAdmin = User.IsInRole("Admin");
        if (comment.AuthorId != userId && !isAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the comment author or admin can delete this comment." });

        _db.ActivityComments.Remove(comment);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Comment {CommentId} deleted from activity {ActivityId}", commentId, id);

        return NoContent();
    }

    // ---- Time Entries (ACTV-07) ----

    /// <summary>
    /// Logs a time entry on an activity. UserId set from JWT.
    /// Duration must be > 0 and <= 1440 (max 24 hours).
    /// </summary>
    [HttpPost("{id:guid}/time-entries")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(typeof(ActivityTimeEntryDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddTimeEntry(Guid id, [FromBody] AddTimeEntryRequest request)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        if (request.DurationMinutes <= 0 || request.DurationMinutes > 1440)
            return BadRequest(new { error = "Duration must be between 1 and 1440 minutes (max 24 hours)." });

        var timeEntry = new ActivityTimeEntry
        {
            ActivityId = id,
            DurationMinutes = request.DurationMinutes,
            Description = request.Description?.Trim(),
            EntryDate = request.EntryDate,
            UserId = userId,
        };

        _db.ActivityTimeEntries.Add(timeEntry);
        await _db.SaveChangesAsync();

        // Reload with User navigation
        var saved = await _db.ActivityTimeEntries
            .Include(te => te.User)
            .FirstAsync(te => te.Id == timeEntry.Id);

        var dto = new ActivityTimeEntryDto
        {
            Id = saved.Id,
            DurationMinutes = saved.DurationMinutes,
            Description = saved.Description,
            EntryDate = saved.EntryDate,
            UserName = saved.User != null
                ? $"{saved.User.FirstName} {saved.User.LastName}".Trim()
                : null,
            CreatedAt = saved.CreatedAt
        };

        _logger.LogInformation("Time entry of {Duration}min added to activity {ActivityId}", request.DurationMinutes, id);

        return StatusCode(StatusCodes.Status201Created, dto);
    }

    /// <summary>
    /// Deletes a time entry from an activity. Only the creator or admin can delete.
    /// </summary>
    [HttpDelete("{id:guid}/time-entries/{entryId:guid}")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteTimeEntry(Guid id, Guid entryId)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var timeEntry = await _db.ActivityTimeEntries
            .FirstOrDefaultAsync(te => te.Id == entryId && te.ActivityId == id);

        if (timeEntry is null)
            return NotFound(new { error = "Time entry not found." });

        // Only the creator or admin can delete
        var isAdmin = User.IsInRole("Admin");
        if (timeEntry.UserId != userId && !isAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the time entry creator or admin can delete this entry." });

        _db.ActivityTimeEntries.Remove(timeEntry);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Time entry {EntryId} deleted from activity {ActivityId}", entryId, id);

        return NoContent();
    }

    // ---- Followers (ACTV-10) ----

    /// <summary>
    /// Follows an activity. Any user with Activity:View can follow.
    /// Idempotent: returns 200 if already following, 201 on new follow.
    /// </summary>
    [HttpPost("{id:guid}/followers")]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Follow(Guid id)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Check if already following (idempotent)
        var existing = await _db.ActivityFollowers
            .FirstOrDefaultAsync(f => f.ActivityId == id && f.UserId == userId);

        if (existing is not null)
            return Ok(new { message = "Already following this activity." });

        var follower = new ActivityFollower
        {
            ActivityId = id,
            UserId = userId,
        };

        _db.ActivityFollowers.Add(follower);
        await _db.SaveChangesAsync();

        _logger.LogInformation("User {UserId} followed activity {ActivityId}", userId, id);

        return StatusCode(StatusCodes.Status201Created);
    }

    /// <summary>
    /// Unfollows an activity. Removes the current user's follower record.
    /// </summary>
    [HttpDelete("{id:guid}/followers")]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Unfollow(Guid id)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var follower = await _db.ActivityFollowers
            .FirstOrDefaultAsync(f => f.ActivityId == id && f.UserId == userId);

        if (follower is not null)
        {
            _db.ActivityFollowers.Remove(follower);
            await _db.SaveChangesAsync();
        }

        _logger.LogInformation("User {UserId} unfollowed activity {ActivityId}", userId, id);

        return NoContent();
    }

    // ---- Attachments (ACTV-06) ----

    /// <summary>
    /// Uploads a file attachment to an activity.
    /// Max file size: 25MB. Dangerous extensions (.exe, .bat, .cmd, .ps1, .sh) rejected.
    /// Uses IFileStorageService for tenant-partitioned file storage.
    /// </summary>
    [HttpPost("{id:guid}/attachments")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [RequestSizeLimit(26_214_400)] // 25MB + overhead
    [ProducesResponseType(typeof(ActivityAttachmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UploadAttachment(Guid id, IFormFile file)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "File is required." });

        const long maxFileSize = 25 * 1024 * 1024; // 25MB
        if (file.Length > maxFileSize)
            return BadRequest(new { error = "File size exceeds the 25MB limit." });

        // Reject dangerous extensions
        var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant();
        var dangerousExtensions = new[] { ".exe", ".bat", ".cmd", ".ps1", ".sh" };
        if (dangerousExtensions.Contains(extension))
            return BadRequest(new { error = $"File type '{extension}' is not allowed." });

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        // Build storage path: {tenantId}/activities/{activityId}/{guid}_{originalFileName}
        var storageName = $"{Guid.NewGuid()}_{file.FileName}";
        var category = $"activities/{id}";

        // Read file data
        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var fileData = memoryStream.ToArray();

        var storagePath = await _fileStorageService.SaveFileAsync(
            tenantId.ToString(), category, storageName, fileData);

        var attachment = new ActivityAttachment
        {
            ActivityId = id,
            FileName = file.FileName,
            StoragePath = storagePath,
            ContentType = file.ContentType,
            FileSizeBytes = file.Length,
            UploadedById = userId,
        };

        _db.ActivityAttachments.Add(attachment);
        await _db.SaveChangesAsync();

        var dto = new ActivityAttachmentDto
        {
            Id = attachment.Id,
            FileName = attachment.FileName,
            ContentType = attachment.ContentType,
            FileSizeBytes = attachment.FileSizeBytes,
            UploadedByName = null, // Will be populated from Author nav on detail load
            UploadedAt = attachment.UploadedAt
        };

        _logger.LogInformation("Attachment '{FileName}' uploaded to activity {ActivityId}", file.FileName, id);

        return StatusCode(StatusCodes.Status201Created, dto);
    }

    /// <summary>
    /// Downloads an attachment file from an activity.
    /// Returns FileContentResult with correct ContentType and Content-Disposition header.
    /// </summary>
    [HttpGet("{id:guid}/attachments/{attachmentId:guid}/download")]
    [Authorize(Policy = "Permission:Activity:View")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DownloadAttachment(Guid id, Guid attachmentId)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "View");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var attachment = await _db.ActivityAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.ActivityId == id);

        if (attachment is null)
            return NotFound(new { error = "Attachment not found." });

        var fileData = await _fileStorageService.GetFileAsync(attachment.StoragePath);
        if (fileData is null)
            return NotFound(new { error = "Attachment file not found in storage." });

        return File(fileData, attachment.ContentType, attachment.FileName);
    }

    /// <summary>
    /// Deletes an attachment from an activity. Only the uploader or admin can delete.
    /// Removes both the file from storage and the database record.
    /// </summary>
    [HttpDelete("{id:guid}/attachments/{attachmentId:guid}")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteAttachment(Guid id, Guid attachmentId)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var attachment = await _db.ActivityAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.ActivityId == id);

        if (attachment is null)
            return NotFound(new { error = "Attachment not found." });

        // Only the uploader or admin can delete
        var isAdmin = User.IsInRole("Admin");
        if (attachment.UploadedById != userId && !isAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the uploader or admin can delete this attachment." });

        // Delete file from storage first, then remove record
        await _fileStorageService.DeleteFileAsync(attachment.StoragePath);

        _db.ActivityAttachments.Remove(attachment);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Attachment {AttachmentId} deleted from activity {ActivityId}", attachmentId, id);

        return NoContent();
    }

    // ---- Entity Links (ACTV-12) ----

    private static readonly string[] AllowedEntityTypes = { "Contact", "Company", "Deal", "Quote", "Request" };

    /// <summary>
    /// Links an entity (Contact, Company, Deal) to an activity.
    /// If entityName is not provided, looks up the entity name for denormalization.
    /// Prevents duplicate links (same entityType + entityId on same activity).
    /// </summary>
    [HttpPost("{id:guid}/links")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(typeof(ActivityLinkDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddLink(Guid id, [FromBody] AddActivityLinkRequest request)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        // Validate entityType
        if (!AllowedEntityTypes.Contains(request.EntityType, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { error = $"Invalid entityType: {request.EntityType}. Must be one of: {string.Join(", ", AllowedEntityTypes)}." });

        // Prevent duplicate links
        var duplicate = await _db.ActivityLinks
            .AnyAsync(l => l.ActivityId == id &&
                           l.EntityType == request.EntityType &&
                           l.EntityId == request.EntityId);

        if (duplicate)
            return BadRequest(new { error = $"This {request.EntityType} is already linked to this activity." });

        // Resolve entity name for denormalization if not provided
        var entityName = request.EntityName;
        if (string.IsNullOrWhiteSpace(entityName))
        {
            entityName = await ResolveEntityNameAsync(request.EntityType, request.EntityId);
        }

        var link = new ActivityLink
        {
            ActivityId = id,
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            EntityName = entityName,
        };

        _db.ActivityLinks.Add(link);
        await _db.SaveChangesAsync();

        var dto = new ActivityLinkDto
        {
            Id = link.Id,
            EntityType = link.EntityType,
            EntityId = link.EntityId,
            EntityName = link.EntityName,
            LinkedAt = link.LinkedAt
        };

        _logger.LogInformation("{EntityType} {EntityId} linked to activity {ActivityId}",
            request.EntityType, request.EntityId, id);

        return StatusCode(StatusCodes.Status201Created, dto);
    }

    /// <summary>
    /// Removes an entity link from an activity.
    /// </summary>
    [HttpDelete("{id:guid}/links/{linkId:guid}")]
    [Authorize(Policy = "Permission:Activity:Update")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RemoveLink(Guid id, Guid linkId)
    {
        var activity = await _activityRepository.GetByIdAsync(id);
        if (activity is null)
            return NotFound(new { error = "Activity not found." });

        var userId = GetCurrentUserId();
        var permission = await _permissionService.GetEffectivePermissionAsync(userId, "Activity", "Update");
        var teamMemberIds = await GetTeamMemberIds(userId, permission.Scope);

        if (!IsWithinScope(activity.OwnerId, activity.AssignedToId, permission.Scope, userId, teamMemberIds))
            return Forbid();

        var link = await _db.ActivityLinks
            .FirstOrDefaultAsync(l => l.Id == linkId && l.ActivityId == id);

        if (link is null)
            return NotFound(new { error = "Link not found." });

        _db.ActivityLinks.Remove(link);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Link {LinkId} removed from activity {ActivityId}", linkId, id);

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
    /// Checks if an activity is within the user's ownership scope.
    /// Activity deviation: checks both OwnerId AND AssignedToId because
    /// users see activities they own OR are assigned to (ACTV-04).
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
            PermissionScope.Team =>
                ownerId == userId ||
                assignedToId == userId ||
                (ownerId.HasValue && teamMemberIds is not null && teamMemberIds.Contains(ownerId.Value)) ||
                (assignedToId.HasValue && teamMemberIds is not null && teamMemberIds.Contains(assignedToId.Value)),
            PermissionScope.Own =>
                ownerId == userId || assignedToId == userId,
            PermissionScope.None => false,
            _ => false
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

    /// <summary>
    /// Resolves an entity name for denormalization in ActivityLink.
    /// Looks up the entity by type and ID from the appropriate repository.
    /// Returns null if entity not found.
    /// </summary>
    private async Task<string?> ResolveEntityNameAsync(string entityType, Guid entityId)
    {
        return entityType switch
        {
            "Company" => (await _companyRepository.GetByIdAsync(entityId))?.Name,
            "Contact" => (await _contactRepository.GetByIdAsync(entityId))?.FullName,
            "Deal" => (await _dealRepository.GetByIdAsync(entityId))?.Title,
            _ => null
        };
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for activity list views.
/// </summary>
public record ActivityListDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public string? OwnerName { get; init; }
    public string? AssignedToName { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ActivityListDto FromEntity(Activity entity) => new()
    {
        Id = entity.Id,
        Subject = entity.Subject,
        Type = entity.Type.ToString(),
        Status = entity.Status.ToString(),
        Priority = entity.Priority.ToString(),
        DueDate = entity.DueDate,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        AssignedToName = entity.AssignedTo != null
            ? $"{entity.AssignedTo.FirstName} {entity.AssignedTo.LastName}".Trim()
            : null,
        CustomFields = entity.CustomFields,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for activity detail view including all sub-resources.
/// </summary>
public record ActivityDetailDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
    public Guid? OwnerId { get; init; }
    public string? OwnerName { get; init; }
    public Guid? AssignedToId { get; init; }
    public string? AssignedToName { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public List<ActivityCommentDto> Comments { get; init; } = new();
    public List<ActivityAttachmentDto> Attachments { get; init; } = new();
    public List<ActivityTimeEntryDto> TimeEntries { get; init; } = new();
    public List<ActivityFollowerDto> Followers { get; init; } = new();
    public List<ActivityLinkDto> Links { get; init; } = new();
    public decimal TotalTimeMinutes { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ActivityDetailDto FromEntity(Activity entity) => new()
    {
        Id = entity.Id,
        Subject = entity.Subject,
        Description = entity.Description,
        Type = entity.Type.ToString(),
        Status = entity.Status.ToString(),
        Priority = entity.Priority.ToString(),
        DueDate = entity.DueDate,
        CompletedAt = entity.CompletedAt,
        OwnerId = entity.OwnerId,
        OwnerName = entity.Owner != null
            ? $"{entity.Owner.FirstName} {entity.Owner.LastName}".Trim()
            : null,
        AssignedToId = entity.AssignedToId,
        AssignedToName = entity.AssignedTo != null
            ? $"{entity.AssignedTo.FirstName} {entity.AssignedTo.LastName}".Trim()
            : null,
        CustomFields = entity.CustomFields,
        Comments = entity.Comments.Select(c => new ActivityCommentDto
        {
            Id = c.Id,
            Content = c.Content,
            AuthorName = c.Author != null
                ? $"{c.Author.FirstName} {c.Author.LastName}".Trim()
                : null,
            AuthorId = c.AuthorId,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt
        }).ToList(),
        Attachments = entity.Attachments.Select(a => new ActivityAttachmentDto
        {
            Id = a.Id,
            FileName = a.FileName,
            ContentType = a.ContentType,
            FileSizeBytes = a.FileSizeBytes,
            UploadedByName = a.UploadedBy != null
                ? $"{a.UploadedBy.FirstName} {a.UploadedBy.LastName}".Trim()
                : null,
            UploadedAt = a.UploadedAt
        }).ToList(),
        TimeEntries = entity.TimeEntries.Select(te => new ActivityTimeEntryDto
        {
            Id = te.Id,
            DurationMinutes = te.DurationMinutes,
            Description = te.Description,
            EntryDate = te.EntryDate,
            UserName = te.User != null
                ? $"{te.User.FirstName} {te.User.LastName}".Trim()
                : null,
            CreatedAt = te.CreatedAt
        }).ToList(),
        Followers = entity.Followers.Select(f => new ActivityFollowerDto
        {
            UserId = f.UserId,
            UserName = f.User != null
                ? $"{f.User.FirstName} {f.User.LastName}".Trim()
                : null,
            FollowedAt = f.FollowedAt
        }).ToList(),
        Links = entity.Links.Select(l => new ActivityLinkDto
        {
            Id = l.Id,
            EntityType = l.EntityType,
            EntityId = l.EntityId,
            EntityName = l.EntityName,
            LinkedAt = l.LinkedAt
        }).ToList(),
        TotalTimeMinutes = entity.TimeEntries.Sum(te => te.DurationMinutes),
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// DTO for activity comments.
/// </summary>
public record ActivityCommentDto
{
    public Guid Id { get; init; }
    public string Content { get; init; } = string.Empty;
    public string? AuthorName { get; init; }
    public Guid? AuthorId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>
/// DTO for activity attachments.
/// </summary>
public record ActivityAttachmentDto
{
    public Guid Id { get; init; }
    public string FileName { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public long FileSizeBytes { get; init; }
    public string? UploadedByName { get; init; }
    public DateTimeOffset UploadedAt { get; init; }
}

/// <summary>
/// DTO for activity time entries.
/// </summary>
public record ActivityTimeEntryDto
{
    public Guid Id { get; init; }
    public decimal DurationMinutes { get; init; }
    public string? Description { get; init; }
    public DateOnly EntryDate { get; init; }
    public string? UserName { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// DTO for activity followers.
/// </summary>
public record ActivityFollowerDto
{
    public Guid UserId { get; init; }
    public string? UserName { get; init; }
    public DateTimeOffset FollowedAt { get; init; }
}

/// <summary>
/// DTO for activity entity links.
/// </summary>
public record ActivityLinkDto
{
    public Guid Id { get; init; }
    public string EntityType { get; init; } = string.Empty;
    public Guid EntityId { get; init; }
    public string? EntityName { get; init; }
    public DateTimeOffset LinkedAt { get; init; }
}

/// <summary>
/// Activity timeline entry DTO.
/// </summary>
public record ActivityTimelineEntryDto
{
    public Guid Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public DateTimeOffset Timestamp { get; init; }
    public Guid? UserId { get; init; }
    public string? UserName { get; init; }
}

/// <summary>
/// Kanban board data for activities grouped by status.
/// </summary>
public record ActivityKanbanDto
{
    public List<ActivityKanbanColumnDto> Columns { get; init; } = new();
}

/// <summary>
/// A status column in the Activity Kanban board.
/// </summary>
public record ActivityKanbanColumnDto
{
    public string Status { get; init; } = string.Empty;
    public List<ActivityKanbanCardDto> Cards { get; init; } = new();
}

/// <summary>
/// Compact activity card for Kanban board display.
/// </summary>
public record ActivityKanbanCardDto
{
    public Guid Id { get; init; }
    public string Subject { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public string? AssignedToName { get; init; }
    public string? OwnerName { get; init; }
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating an activity.
/// </summary>
public record CreateActivityRequest
{
    public string Subject { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public Guid? AssignedToId { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for updating an activity.
/// </summary>
public record UpdateActivityRequest
{
    public string Subject { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public DateTimeOffset? DueDate { get; init; }
    public Guid? AssignedToId { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for changing an activity's status via the workflow state machine.
/// </summary>
public record UpdateActivityStatusRequest
{
    public string Status { get; init; } = string.Empty;
}

/// <summary>
/// Request body for adding or editing a comment on an activity.
/// </summary>
public record AddCommentRequest
{
    public string Content { get; init; } = string.Empty;
}

/// <summary>
/// Request body for logging a time entry on an activity.
/// </summary>
public record AddTimeEntryRequest
{
    public decimal DurationMinutes { get; init; }
    public string? Description { get; init; }
    public DateOnly EntryDate { get; init; }
}

/// <summary>
/// Request body for linking an entity to an activity.
/// </summary>
public record AddActivityLinkRequest
{
    public string EntityType { get; init; } = string.Empty;
    public Guid EntityId { get; init; }
    public string? EntityName { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateActivityRequest.
/// Validates subject (3-500 chars), type must be valid enum string, priority must be valid enum string.
/// </summary>
public class CreateActivityRequestValidator : AbstractValidator<CreateActivityRequest>
{
    private static readonly string[] ValidTypes = Enum.GetNames<ActivityType>();
    private static readonly string[] ValidPriorities = Enum.GetNames<ActivityPriority>();

    public CreateActivityRequestValidator()
    {
        RuleFor(x => x.Subject)
            .NotEmpty().WithMessage("Activity subject is required.")
            .MinimumLength(3).WithMessage("Activity subject must be at least 3 characters.")
            .MaximumLength(500).WithMessage("Activity subject must be at most 500 characters.");

        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Activity type is required.")
            .Must(t => ValidTypes.Contains(t, StringComparer.OrdinalIgnoreCase))
            .WithMessage($"Activity type must be one of: {string.Join(", ", ValidTypes)}.");

        RuleFor(x => x.Priority)
            .NotEmpty().WithMessage("Activity priority is required.")
            .Must(p => ValidPriorities.Contains(p, StringComparer.OrdinalIgnoreCase))
            .WithMessage($"Activity priority must be one of: {string.Join(", ", ValidPriorities)}.");
    }
}
