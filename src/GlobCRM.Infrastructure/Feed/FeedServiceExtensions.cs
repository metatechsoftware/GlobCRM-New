using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Feed;

/// <summary>
/// Extension methods for registering feed services in the DI container.
/// Follows the subsystem DI extension pattern (separate from DependencyInjection.cs).
/// </summary>
public static class FeedServiceExtensions
{
    /// <summary>
    /// Registers FeedRepository as a scoped service.
    /// </summary>
    public static IServiceCollection AddFeedServices(this IServiceCollection services)
    {
        services.AddScoped<IFeedRepository, FeedRepository>();

        return services;
    }
}
