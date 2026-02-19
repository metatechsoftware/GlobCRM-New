using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GlobCRM.Infrastructure.BackgroundJobs;

/// <summary>
/// Extension methods for registering Hangfire background job infrastructure.
/// Configures PostgreSQL storage, named queues, and tenant context propagation.
/// </summary>
public static class HangfireServiceExtensions
{
    /// <summary>
    /// Registers Hangfire services with PostgreSQL storage.
    /// Configures 4 named queues: default, emails, webhooks, workflows.
    /// Registers TenantJobFilter for automatic tenant context propagation.
    /// </summary>
    public static IServiceCollection AddHangfireServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

        services.AddHangfire(config => config
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(options =>
                options.UseNpgsqlConnection(connectionString),
                new PostgreSqlStorageOptions
                {
                    SchemaName = "hangfire",
                    PrepareSchemaIfNecessary = true,
                    QueuePollInterval = TimeSpan.FromSeconds(15)
                }));

        services.AddHangfireServer(options =>
        {
            options.Queues = ["default", "emails", "webhooks", "workflows"];
            options.WorkerCount = Environment.ProcessorCount * 2;
        });

        // Register tenant context propagation filter globally
        GlobalJobFilters.Filters.Add(new TenantJobFilter());

        return services;
    }
}
