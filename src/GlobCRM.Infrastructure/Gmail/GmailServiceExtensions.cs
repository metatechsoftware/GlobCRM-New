using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Gmail;

/// <summary>
/// Extension methods for registering Gmail integration services in the DI container.
/// Follows the EmailServiceExtensions pattern of separate extension classes per subsystem.
/// NOTE: Background sync service registration is in Plan 03 (depends on repository implementations).
/// </summary>
public static class GmailServiceExtensions
{
    /// <summary>
    /// Registers all Gmail integration services: token encryption, OAuth, service factory, sync, and send.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddGmailServices(this IServiceCollection services)
    {
        // TokenEncryptionService is stateless (uses IDataProtectionProvider), singleton is appropriate
        services.AddSingleton<TokenEncryptionService>();

        // OAuth, factory, sync, and send services need per-request DI resolution
        services.AddScoped<GmailOAuthService>();
        services.AddScoped<GmailServiceFactory>();
        services.AddScoped<GmailSyncService>();
        services.AddScoped<GmailSendService>();

        return services;
    }
}
