using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Duplicates;

/// <summary>
/// Extension methods for registering duplicate detection and merge services in the DI container.
/// </summary>
public static class DuplicateServiceExtensions
{
    /// <summary>
    /// Registers DuplicateDetectionService, ContactMergeService, and CompanyMergeService as scoped.
    /// </summary>
    public static IServiceCollection AddDuplicateServices(this IServiceCollection services)
    {
        services.AddScoped<IDuplicateDetectionService, DuplicateDetectionService>();
        services.AddScoped<ContactMergeService>();
        services.AddScoped<CompanyMergeService>();

        return services;
    }
}
