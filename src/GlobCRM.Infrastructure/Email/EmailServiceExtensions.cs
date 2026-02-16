using GlobCRM.Application.Common;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Email;

/// <summary>
/// Extension methods for registering email services in the DI container.
/// Kept as a separate extension class to avoid merge conflicts with
/// DependencyInjection.cs which may be modified by other plans.
/// </summary>
public static class EmailServiceExtensions
{
    /// <summary>
    /// Registers the email rendering and sending services.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddEmailServices(this IServiceCollection services)
    {
        // RazorLight engine caches compiled templates, singleton is appropriate
        services.AddSingleton<RazorEmailRenderer>();

        // SendGridEmailSender reads config per-request context, scoped is appropriate
        services.AddScoped<IEmailService, SendGridEmailSender>();

        return services;
    }
}
