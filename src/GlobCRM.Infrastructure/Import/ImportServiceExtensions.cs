using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.Import;

/// <summary>
/// Extension methods for registering import services in the DI container.
/// Follows the subsystem DI extension pattern (DashboardServiceExtensions, NotificationServiceExtensions, etc.).
/// </summary>
public static class ImportServiceExtensions
{
    /// <summary>
    /// Registers CsvParserService, DuplicateDetector, ImportRepository, and ImportService as scoped services.
    /// </summary>
    public static IServiceCollection AddImportServices(this IServiceCollection services)
    {
        services.AddScoped<CsvParserService>();
        services.AddScoped<DuplicateDetector>();
        services.AddScoped<IImportRepository, ImportRepository>();
        services.AddScoped<ImportService>();

        return services;
    }
}
