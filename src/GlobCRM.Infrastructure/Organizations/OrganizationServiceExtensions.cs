using FluentValidation;
using GlobCRM.Application.Common;
using GlobCRM.Application.Organizations;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.MultiTenancy;
using GlobCRM.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Organizations;

/// <summary>
/// Extension methods for registering organization management services in the DI container.
/// Kept as a separate extension class to avoid merge conflicts with
/// DependencyInjection.cs which may be modified by other plans.
/// </summary>
public static class OrganizationServiceExtensions
{
    /// <summary>
    /// Registers organization management services including repository, seeder,
    /// command handlers, query handlers, and validators.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddOrganizationServices(this IServiceCollection services)
    {
        // Repository
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();

        // Seeder
        services.AddScoped<ITenantSeeder, TenantSeeder>();

        // Command handlers
        services.AddScoped<CreateOrganizationCommandHandler>();

        // Query handlers
        services.AddScoped<CheckSubdomainQueryHandler>();

        // Validators
        services.AddScoped<IValidator<CreateOrganizationRequest>, CreateOrganizationValidator>();

        return services;
    }
}
