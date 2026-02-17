using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for notification CRUD operations and user preference management.
/// Handles paged listing, unread counts, mark-as-read, and per-type delivery preferences.
/// </summary>
public interface INotificationRepository
{
    /// <summary>
    /// Gets a paged list of notifications for a user, ordered by CreatedAt descending.
    /// </summary>
    Task<PagedResult<Notification>> GetPagedAsync(Guid userId, int page, int pageSize);

    /// <summary>
    /// Gets the count of unread notifications for a user.
    /// </summary>
    Task<int> GetUnreadCountAsync(Guid userId);

    /// <summary>
    /// Marks a single notification as read, setting IsRead=true and ReadAt to current time.
    /// </summary>
    Task MarkAsReadAsync(Guid notificationId);

    /// <summary>
    /// Marks all unread notifications for a user as read.
    /// </summary>
    Task MarkAllAsReadAsync(Guid userId);

    /// <summary>
    /// Creates a new notification entity.
    /// </summary>
    Task CreateAsync(Notification notification);

    /// <summary>
    /// Gets all notification preferences for a user.
    /// </summary>
    Task<List<NotificationPreference>> GetPreferencesAsync(Guid userId);

    /// <summary>
    /// Creates or updates a notification preference for a user.
    /// </summary>
    Task UpdatePreferenceAsync(NotificationPreference preference);
}
