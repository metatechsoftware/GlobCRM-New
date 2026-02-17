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
    /// Registers Company, Contact, Product, Pipeline, Deal, Activity, Quote, Request,
    /// EmailAccount, and EmailMessage repository implementations as scoped services.
    /// </summary>
    public static IServiceCollection AddCrmEntityServices(this IServiceCollection services)
    {
        services.AddScoped<ICompanyRepository, CompanyRepository>();
        services.AddScoped<IContactRepository, ContactRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IPipelineRepository, PipelineRepository>();
        services.AddScoped<IDealRepository, DealRepository>();
        services.AddScoped<IActivityRepository, ActivityRepository>();
        services.AddScoped<IQuoteRepository, QuoteRepository>();
        services.AddScoped<IRequestRepository, RequestRepository>();
        services.AddScoped<IEmailAccountRepository, EmailAccountRepository>();
        services.AddScoped<IEmailMessageRepository, EmailMessageRepository>();

        return services;
    }
}
