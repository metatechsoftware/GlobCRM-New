using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.CrmEntities;

/// <summary>
/// Extension methods for registering CRM entity repositories in the DI container.
/// Follows the subsystem pattern established by CustomFieldServiceExtensions,
/// EmailServiceExtensions, etc.
/// </summary>
public static class CrmEntityServiceExtensions
{
    /// <summary>
    /// Registers Company, Contact, and Product repository implementations as scoped services.
    /// </summary>
    public static IServiceCollection AddCrmEntityServices(this IServiceCollection services)
    {
        services.AddScoped<ICompanyRepository, CompanyRepository>();
        services.AddScoped<IContactRepository, ContactRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();

        return services;
    }
}
