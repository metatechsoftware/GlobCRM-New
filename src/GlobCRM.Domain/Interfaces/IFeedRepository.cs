using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for activity feed CRUD operations.
/// Handles paged feed listing, feed item creation, and comment management.
/// </summary>
public interface IFeedRepository
{
    /// <summary>
    /// Gets a paged activity feed, ordered by CreatedAt descending.
    /// Includes Author navigation for display.
    /// </summary>
    Task<PagedResult<FeedItem>> GetFeedAsync(Guid userId, int page, int pageSize);

    /// <summary>
    /// Creates a new feed item (system event or social post).
    /// </summary>
    Task CreateFeedItemAsync(FeedItem item);

    /// <summary>
    /// Gets a single feed item by ID with Author and Comments loaded.
    /// </summary>
    Task<FeedItem?> GetByIdAsync(Guid id);

    /// <summary>
    /// Adds a comment to a feed item.
    /// </summary>
    Task AddCommentAsync(FeedComment comment);

    /// <summary>
    /// Gets all comments for a feed item, ordered by CreatedAt ascending.
    /// Includes Author navigation for display.
    /// </summary>
    Task<List<FeedComment>> GetCommentsAsync(Guid feedItemId);
}
