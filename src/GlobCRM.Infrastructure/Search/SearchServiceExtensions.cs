using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Search;

/// <summary>
/// Extension methods for registering search services in the DI container.
/// </summary>
public static class SearchServiceExtensions
{
    /// <summary>
    /// Adds the global search service to the service collection.
    /// </summary>
    public static IServiceCollection AddSearchServices(this IServiceCollection services)
    {
        services.AddScoped<ISearchService, GlobalSearchService>();
        return services;
    }
}
