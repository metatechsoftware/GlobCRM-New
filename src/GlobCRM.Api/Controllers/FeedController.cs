using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for activity feed: paged listing, social posts with @mention detection,
/// comments with real-time push, and feed item deletion.
/// All endpoints require authentication. Feed items are tenant-scoped.
/// </summary>
[ApiController]
[Route("api/feed")]
[Authorize]
public class FeedController : ControllerBase
{
    private readonly IFeedRepository _feedRepository;
    private readonly NotificationDispatcher _notificationDispatcher;
    private readonly IHubContext<CrmHub> _hubContext;
    private readonly ITenantProvider _tenantProvider;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<FeedController> _logger;

    public FeedController(
        IFeedRepository feedRepository,
        NotificationDispatcher notificationDispatcher,
        IHubContext<CrmHub> hubContext,
        ITenantProvider tenantProvider,
        ApplicationDbContext db,
        ILogger<FeedController> logger)
    {
        _feedRepository = feedRepository;
        _notificationDispatcher = notificationDispatcher;
        _hubContext = hubContext;
        _tenantProvider = tenantProvider;
        _db = db;
        _logger = logger;
    }

    // ---- Feed List / Detail ----

    /// <summary>
    /// Gets a paged activity feed with author info and comment count per item.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(FeedPagedResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        var pagedResult = await _feedRepository.GetFeedAsync(userId, page, pageSize);

        var response = new FeedPagedResponse
        {
            Items = pagedResult.Items.Select(FeedItemDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(response);
    }

    /// <summary>
    /// Gets a single feed item with all comments and author info.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(FeedItemDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var feedItem = await _feedRepository.GetByIdAsync(id);
        if (feedItem is null)
            return NotFound(new { error = "Feed item not found." });

        return Ok(FeedItemDetailDto.FromEntity(feedItem));
    }

    // ---- Social Posts ----

    /// <summary>
    /// Creates a social post. Detects @mentions and dispatches Mention notifications.
    /// Sends "FeedUpdate" to tenant group via SignalR for real-time update.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(FeedItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreatePost([FromBody] CreateFeedPostRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(new { error = "Content is required." });

        var userId = GetCurrentUserId();
        var tenantId = GetTenantId();

        var feedItem = new FeedItem
        {
            TenantId = tenantId,
            Type = FeedItemType.SocialPost,
            Content = request.Content,
            AuthorId = userId,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await _feedRepository.CreateFeedItemAsync(feedItem);

        // Reload with author navigation for DTO
        var created = await _feedRepository.GetByIdAsync(feedItem.Id);
        var dto = FeedItemDto.FromEntity(created ?? feedItem);

        // Push real-time update to tenant group
        await _hubContext.Clients
            .Group($"tenant_{tenantId}")
            .SendAsync("FeedUpdate", dto);

        // Detect @mentions and dispatch notifications
        await DispatchMentionNotificationsAsync(request.Content, userId, feedItem.Id, "FeedItem");

        _logger.LogInformation("Feed post created: Id={Id}, AuthorId={AuthorId}", feedItem.Id, userId);

        return StatusCode(StatusCodes.Status201Created, dto);
    }

    // ---- Comments ----

    /// <summary>
    /// Adds a comment to a feed item. Detects @mentions and dispatches notifications.
    /// Sends "FeedCommentAdded" to tenant group via SignalR.
    /// </summary>
    [HttpPost("{id:guid}/comments")]
    [ProducesResponseType(typeof(FeedCommentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] CreateCommentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(new { error = "Content is required." });

        var feedItem = await _feedRepository.GetByIdAsync(id);
        if (feedItem is null)
            return NotFound(new { error = "Feed item not found." });

        var userId = GetCurrentUserId();
        var tenantId = GetTenantId();

        var comment = new FeedComment
        {
            FeedItemId = id,
            Content = request.Content,
            AuthorId = userId,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await _feedRepository.AddCommentAsync(comment);

        // Load comment with author for DTO
        var author = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        var dto = new FeedCommentDto
        {
            Id = comment.Id,
            Content = comment.Content,
            AuthorId = comment.AuthorId,
            AuthorName = author?.FullName ?? string.Empty,
            AuthorAvatarUrl = author?.AvatarUrl,
            CreatedAt = comment.CreatedAt
        };

        // Push real-time update to tenant group
        await _hubContext.Clients
            .Group($"tenant_{tenantId}")
            .SendAsync("FeedCommentAdded", new { FeedItemId = id, Comment = dto });

        // Detect @mentions and dispatch notifications
        await DispatchMentionNotificationsAsync(request.Content, userId, id, "FeedItem");

        _logger.LogInformation("Feed comment added: CommentId={CommentId}, FeedItemId={FeedItemId}", comment.Id, id);

        return StatusCode(StatusCodes.Status201Created, dto);
    }

    // ---- Delete ----

    /// <summary>
    /// Deletes a feed item. Only the author or an Admin can delete.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var feedItem = await _feedRepository.GetByIdAsync(id);
        if (feedItem is null)
            return NotFound(new { error = "Feed item not found." });

        var userId = GetCurrentUserId();
        var isAdmin = User.IsInRole("Admin");

        if (feedItem.AuthorId != userId && !isAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Only the author or an admin can delete this feed item." });

        await _feedRepository.DeleteAsync(id);

        _logger.LogInformation("Feed item deleted: Id={Id}, DeletedBy={UserId}", id, userId);

        return NoContent();
    }

    // ---- Helpers ----

    /// <summary>
    /// Detects @mentions in content via regex and dispatches Mention notifications
    /// to matched users (looked up by first name, last name, or username).
    /// </summary>
    private async Task DispatchMentionNotificationsAsync(string content, Guid senderId, Guid entityId, string entityType)
    {
        try
        {
            var mentions = Regex.Matches(content, @"@(\w+)");
            if (mentions.Count == 0) return;

            var mentionedNames = mentions
                .Select(m => m.Groups[1].Value.ToLower())
                .Distinct()
                .ToList();

            // Look up users by first name or username matching mention text
            var users = await _db.Users
                .Where(u => mentionedNames.Contains(u.FirstName.ToLower())
                    || mentionedNames.Contains(u.UserName!.ToLower()))
                .ToListAsync();

            foreach (var user in users)
            {
                // Don't notify the sender about their own mention
                if (user.Id == senderId) continue;

                await _notificationDispatcher.DispatchAsync(new NotificationRequest
                {
                    RecipientId = user.Id,
                    Type = NotificationType.Mention,
                    Title = "You were mentioned",
                    Message = content.Length > 200 ? content[..200] + "..." : content,
                    EntityType = entityType,
                    EntityId = entityId,
                    CreatedById = senderId
                });
            }
        }
        catch (Exception ex)
        {
            // Mention dispatch failure should not fail the main operation
            _logger.LogError(ex, "Failed to dispatch mention notifications for entity {EntityId}", entityId);
        }
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    private Guid GetTenantId()
    {
        return _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("Tenant context not available.");
    }
}

// ---- DTOs ----

/// <summary>
/// DTO for feed item list views with author info and comment count.
/// </summary>
public record FeedItemDto
{
    public Guid Id { get; init; }
    public FeedItemType Type { get; init; }
    public string Content { get; init; } = string.Empty;
    public string? EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public Guid? AuthorId { get; init; }
    public string AuthorName { get; init; } = string.Empty;
    public string? AuthorAvatarUrl { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public int CommentCount { get; init; }

    public static FeedItemDto FromEntity(FeedItem entity) => new()
    {
        Id = entity.Id,
        Type = entity.Type,
        Content = entity.Content,
        EntityType = entity.EntityType,
        EntityId = entity.EntityId,
        AuthorId = entity.AuthorId,
        AuthorName = entity.Author?.FullName ?? string.Empty,
        AuthorAvatarUrl = entity.Author?.AvatarUrl,
        CreatedAt = entity.CreatedAt,
        CommentCount = entity.Comments?.Count ?? 0
    };
}

/// <summary>
/// DTO for feed item detail with full comments list.
/// </summary>
public record FeedItemDetailDto
{
    public Guid Id { get; init; }
    public FeedItemType Type { get; init; }
    public string Content { get; init; } = string.Empty;
    public string? EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public Guid? AuthorId { get; init; }
    public string AuthorName { get; init; } = string.Empty;
    public string? AuthorAvatarUrl { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public List<FeedCommentDto> Comments { get; init; } = new();

    public static FeedItemDetailDto FromEntity(FeedItem entity) => new()
    {
        Id = entity.Id,
        Type = entity.Type,
        Content = entity.Content,
        EntityType = entity.EntityType,
        EntityId = entity.EntityId,
        AuthorId = entity.AuthorId,
        AuthorName = entity.Author?.FullName ?? string.Empty,
        AuthorAvatarUrl = entity.Author?.AvatarUrl,
        CreatedAt = entity.CreatedAt,
        Comments = entity.Comments?
            .OrderBy(c => c.CreatedAt)
            .Select(c => new FeedCommentDto
            {
                Id = c.Id,
                Content = c.Content,
                AuthorId = c.AuthorId,
                AuthorName = c.Author?.FullName ?? string.Empty,
                AuthorAvatarUrl = c.Author?.AvatarUrl,
                CreatedAt = c.CreatedAt
            }).ToList() ?? new()
    };
}

/// <summary>
/// DTO for feed comments.
/// </summary>
public record FeedCommentDto
{
    public Guid Id { get; init; }
    public string Content { get; init; } = string.Empty;
    public Guid? AuthorId { get; init; }
    public string AuthorName { get; init; } = string.Empty;
    public string? AuthorAvatarUrl { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Request body for creating a social post.
/// </summary>
public record CreateFeedPostRequest
{
    public string Content { get; init; } = string.Empty;
}

/// <summary>
/// Request body for adding a comment to a feed item.
/// </summary>
public record CreateCommentRequest
{
    public string Content { get; init; } = string.Empty;
}

/// <summary>
/// Response wrapper for paged feed list.
/// </summary>
public record FeedPagedResponse
{
    public List<FeedItemDto> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}
