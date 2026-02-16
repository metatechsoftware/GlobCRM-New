using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Authorization;

/// <summary>
/// Extension methods for registering permission authorization services.
/// Registers the policy provider (singleton), authorization handler (scoped),
/// permission service (scoped), and memory cache.
/// </summary>
public static class AuthorizationServiceExtensions
{
    /// <summary>
    /// Adds the RBAC permission authorization services to the DI container.
    /// </summary>
    public static IServiceCollection AddPermissionAuthorization(this IServiceCollection services)
    {
        // Memory cache for permission caching (idempotent -- safe to call if already registered)
        services.AddMemoryCache();

        // Policy provider must be singleton (ASP.NET Core requirement)
        services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();

        // Authorization handler is scoped because it depends on IPermissionService
        // which in turn depends on scoped ApplicationDbContext
        services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

        // Permission service is scoped (depends on scoped ApplicationDbContext)
        services.AddScoped<IPermissionService, PermissionService>();

        return services;
    }
}
