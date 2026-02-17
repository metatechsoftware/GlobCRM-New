using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Notifications;

/// <summary>
/// EF Core implementation of INotificationRepository.
/// Handles paged listing, unread counts, mark-as-read, and preference management.
/// Tenant isolation enforced by ApplicationDbContext global query filter.
/// </summary>
public class NotificationRepository : INotificationRepository
{
    private readonly ApplicationDbContext _db;

    public NotificationRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Notification>> GetPagedAsync(Guid userId, int page, int pageSize)
    {
        var query = _db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt);

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<Notification>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    /// <inheritdoc />
    public async Task<Notification?> GetByIdAsync(Guid notificationId)
    {
        return await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId);
    }

    /// <inheritdoc />
    public async Task<int> GetUnreadCountAsync(Guid userId)
    {
        return await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .CountAsync();
    }

    /// <inheritdoc />
    public async Task MarkAsReadAsync(Guid notificationId)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId);

        if (notification != null)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task MarkAsUnreadAsync(Guid notificationId)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId);

        if (notification != null)
        {
            notification.IsRead = false;
            notification.ReadAt = null;
            await _db.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task MarkAllAsReadAsync(Guid userId)
    {
        await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(n => n.IsRead, true)
                .SetProperty(n => n.ReadAt, DateTimeOffset.UtcNow));
    }

    /// <inheritdoc />
    public async Task CreateAsync(Notification notification)
    {
        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task<List<NotificationPreference>> GetPreferencesAsync(Guid userId)
    {
        return await _db.NotificationPreferences
            .Where(p => p.UserId == userId)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task UpdatePreferenceAsync(NotificationPreference preference)
    {
        var existing = await _db.NotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == preference.UserId
                && p.NotificationType == preference.NotificationType);

        if (existing != null)
        {
            existing.InAppEnabled = preference.InAppEnabled;
            existing.EmailEnabled = preference.EmailEnabled;
        }
        else
        {
            _db.NotificationPreferences.Add(preference);
        }

        await _db.SaveChangesAsync();
    }
}
