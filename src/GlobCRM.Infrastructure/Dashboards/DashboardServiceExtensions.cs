using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Dashboards;

/// <summary>
/// Extension methods for registering dashboard services in the DI container.
/// Follows the subsystem DI extension pattern (separate from DependencyInjection.cs).
/// </summary>
public static class DashboardServiceExtensions
{
    /// <summary>
    /// Registers DashboardRepository, TargetRepository, and DashboardAggregationService as scoped services.
    /// </summary>
    public static IServiceCollection AddDashboardServices(this IServiceCollection services)
    {
        services.AddScoped<IDashboardRepository, DashboardRepository>();
        services.AddScoped<ITargetRepository, TargetRepository>();
        services.AddScoped<DashboardAggregationService>();

        return services;
    }
}
