using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Reporting;

/// <summary>
/// DI registration for all reporting services.
/// Called from DependencyInjection.cs in the Infrastructure layer.
/// </summary>
public static class ReportingServiceExtensions
{
    public static IServiceCollection AddReportingServices(this IServiceCollection services)
    {
        services.AddScoped<ReportFieldMetadataService>();
        services.AddScoped<ReportQueryEngine>();
        return services;
    }
}
