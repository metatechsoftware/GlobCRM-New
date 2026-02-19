using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.EmailTemplates;

/// <summary>
/// Extension methods for registering email template services in DI.
/// </summary>
public static class EmailTemplateServiceExtensions
{
    /// <summary>
    /// Registers EmailTemplateRepository, TemplateRenderService, and MergeFieldService.
    /// - EmailTemplateRepository: scoped (needs DbContext per request)
    /// - TemplateRenderService: singleton (FluidParser is thread-safe)
    /// - MergeFieldService: scoped (needs DbContext per request)
    /// </summary>
    public static IServiceCollection AddEmailTemplateServices(this IServiceCollection services)
    {
        services.AddScoped<EmailTemplateRepository>();
        services.AddSingleton<TemplateRenderService>();
        services.AddScoped<MergeFieldService>();

        return services;
    }
}
