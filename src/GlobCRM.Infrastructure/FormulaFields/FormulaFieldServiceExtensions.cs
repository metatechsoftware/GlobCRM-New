using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.FormulaFields;

/// <summary>
/// Extension methods for registering formula field services in the DI container.
/// </summary>
public static class FormulaFieldServiceExtensions
{
    /// <summary>
    /// Registers the formula field evaluation, validation, and field registry services.
    /// All services are scoped to match the per-request lifecycle of DbContext and repositories.
    /// </summary>
    public static IServiceCollection AddFormulaFieldServices(this IServiceCollection services)
    {
        services.AddScoped<FieldRegistryService>();
        services.AddScoped<FormulaEvaluationService>();
        services.AddScoped<FormulaValidationService>();

        return services;
    }
}
