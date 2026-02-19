using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.FormulaFields;
using GlobCRM.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.CustomFields;

/// <summary>
/// Extension methods for registering custom field and view services in the DI container.
/// Kept as a separate extension class to avoid merge conflicts with
/// DependencyInjection.cs which may be modified by other plans.
/// </summary>
public static class CustomFieldServiceExtensions
{
    /// <summary>
    /// Registers custom field repositories, view repository, and the custom field validator.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddCustomFieldServices(this IServiceCollection services)
    {
        // Repositories
        services.AddScoped<ICustomFieldRepository, CustomFieldRepository>();
        services.AddScoped<IViewRepository, ViewRepository>();

        // Validator
        services.AddScoped<CustomFieldValidator>();

        // Formula field services (evaluation, validation, field registry)
        services.AddFormulaFieldServices();

        return services;
    }
}
