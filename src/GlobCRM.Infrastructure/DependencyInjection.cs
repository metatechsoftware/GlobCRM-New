using Finbuckle.MultiTenant.AspNetCore.Extensions;
using Finbuckle.MultiTenant.EntityFrameworkCore.Extensions;
using Finbuckle.MultiTenant.Extensions;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.MultiTenancy;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace GlobCRM.Infrastructure;

/// <summary>
/// Extension method registering all Infrastructure services.
/// Called from Program.cs via builder.Services.AddInfrastructure(builder.Configuration, builder.Environment).
/// NOTE: Email service and organization repository registrations are handled by Plan 04.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

        // Register EF Core interceptors
        services.AddScoped<TenantDbConnectionInterceptor>();
        services.AddScoped<AuditableEntityInterceptor>();

        // Register TenantDbContext (tenant catalog -- not tenant-scoped)
        services.AddDbContext<TenantDbContext>(options =>
            options.UseNpgsql(connectionString));

        // Register ApplicationDbContext (tenant-scoped) with interceptors
        services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
        {
            options.UseNpgsql(connectionString);
            options.AddInterceptors(
                serviceProvider.GetRequiredService<TenantDbConnectionInterceptor>(),
                serviceProvider.GetRequiredService<AuditableEntityInterceptor>());
        });

        // Register Finbuckle multi-tenancy
        var multiTenantBuilder = services
            .AddMultiTenant<TenantInfo>()
            .WithHostStrategy("__tenant__.globcrm.com")
            .WithEFCoreStore<TenantDbContext, TenantInfo>();

        // In development: add header strategy as fallback for dev/testing without subdomains
        if (environment.IsDevelopment())
        {
            multiTenantBuilder.WithHeaderStrategy("X-Tenant-Id");
        }

        // Register TenantProvider as ITenantProvider (scoped, resolves per-request)
        services.AddScoped<ITenantProvider, TenantProvider>();

        return services;
    }
}
