using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Notifications;

/// <summary>
/// Extension methods for registering notification services in the DI container.
/// Follows the subsystem DI extension pattern (separate from DependencyInjection.cs).
/// </summary>
public static class NotificationServiceExtensions
{
    /// <summary>
    /// Registers NotificationRepository and NotificationDispatcher as scoped services.
    /// </summary>
    public static IServiceCollection AddNotificationServices(this IServiceCollection services)
    {
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<NotificationDispatcher>();

        return services;
    }
}
