using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.DomainEvents;

/// <summary>
/// Extension methods for registering domain event infrastructure services.
/// </summary>
public static class DomainEventServiceExtensions
{
    /// <summary>
    /// Registers the DomainEventInterceptor and DomainEventDispatcher in DI.
    /// DomainEventInterceptor is scoped (one per request, matching DbContext lifetime).
    /// DomainEventDispatcher is scoped (needs to resolve handlers from current scope).
    /// </summary>
    public static IServiceCollection AddDomainEventServices(this IServiceCollection services)
    {
        services.AddScoped<DomainEventInterceptor>();
        services.AddScoped<IDomainEventDispatcher, DomainEventDispatcher>();

        return services;
    }
}
