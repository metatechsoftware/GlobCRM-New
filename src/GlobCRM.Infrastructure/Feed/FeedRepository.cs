using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Feed;

/// <summary>
/// EF Core implementation of IFeedRepository.
/// Handles paged feed listing, feed item creation, and comment management.
/// Tenant isolation enforced by ApplicationDbContext global query filter on FeedItem.
/// For v1, all tenant users see all feed items (social posts visible to all,
/// system events included without RBAC filtering since tenant isolation already
/// enforces org-level access).
/// </summary>
public class FeedRepository : IFeedRepository
{
    private readonly ApplicationDbContext _db;

    public FeedRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<FeedItem>> GetFeedAsync(Guid userId, int page, int pageSize)
    {
        var query = _db.FeedItems
            .Include(f => f.Author)
            .OrderByDescending(f => f.CreatedAt);

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<FeedItem>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    /// <inheritdoc />
    public async Task CreateFeedItemAsync(FeedItem item)
    {
        _db.FeedItems.Add(item);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task<FeedItem?> GetByIdAsync(Guid id)
    {
        return await _db.FeedItems
            .Include(f => f.Author)
            .Include(f => f.Comments)
                .ThenInclude(c => c.Author)
            .FirstOrDefaultAsync(f => f.Id == id);
    }

    /// <inheritdoc />
    public async Task AddCommentAsync(FeedComment comment)
    {
        _db.FeedComments.Add(comment);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task<List<FeedComment>> GetCommentsAsync(Guid feedItemId)
    {
        return await _db.FeedComments
            .Where(c => c.FeedItemId == feedItemId)
            .Include(c => c.Author)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var feedItem = await _db.FeedItems
            .FirstOrDefaultAsync(f => f.Id == id);

        if (feedItem != null)
        {
            _db.FeedItems.Remove(feedItem);
            await _db.SaveChangesAsync();
        }
    }
}
