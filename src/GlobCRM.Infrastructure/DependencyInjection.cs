using System.Text;
using Finbuckle.MultiTenant.AspNetCore.Extensions;
using Finbuckle.MultiTenant.EntityFrameworkCore.Extensions;
using Finbuckle.MultiTenant.Extensions;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Authorization;
using GlobCRM.Infrastructure.DomainEvents;
using GlobCRM.Infrastructure.Duplicates;
using GlobCRM.Infrastructure.EmailTemplates;
using GlobCRM.Infrastructure.Webhooks;
using GlobCRM.Infrastructure.Identity;
using GlobCRM.Infrastructure.Images;
using GlobCRM.Infrastructure.MultiTenancy;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Persistence.Interceptors;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

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

        // ---- Npgsql DataSource with EnableDynamicJson ----
        // Required for JSONB serialization of Dictionary<string, object?> and List<T> types
        // used by CustomFieldDefinition (Validation, Options) and SavedView (Columns, Filters, Sorts)
        var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
        dataSourceBuilder.EnableDynamicJson();
        var dataSource = dataSourceBuilder.Build();

        // ---- EF Core interceptors ----
        services.AddScoped<TenantDbConnectionInterceptor>();
        services.AddScoped<AuditableEntityInterceptor>();

        // ---- Domain event infrastructure ----
        services.AddDomainEventServices();

        // ---- Database contexts ----

        // TenantDbContext (tenant catalog -- not tenant-scoped)
        services.AddDbContext<TenantDbContext>(options =>
            options.UseNpgsql(dataSource));

        // ApplicationDbContext (tenant-scoped) with interceptors
        // Interceptor order matters: TenantDbConnection sets RLS context,
        // AuditableEntity sets timestamps, DomainEvent captures final entity state
        services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
        {
            options.UseNpgsql(dataSource);
            options.AddInterceptors(
                serviceProvider.GetRequiredService<TenantDbConnectionInterceptor>(),
                serviceProvider.GetRequiredService<AuditableEntityInterceptor>(),
                serviceProvider.GetRequiredService<DomainEventInterceptor>());
        });

        // ---- Finbuckle multi-tenancy ----
        var multiTenantBuilder = services
            .AddMultiTenant<TenantInfo>()
            .WithHostStrategy("__tenant__.globcrm.com")
            .WithEFCoreStore<TenantDbContext, TenantInfo>();

        // In development: add header strategy as fallback for dev/testing without subdomains
        if (environment.IsDevelopment())
        {
            multiTenantBuilder.WithHeaderStrategy("X-Tenant-Id");
        }

        // TenantProvider as ITenantProvider (scoped, resolves per-request)
        // HttpContextAccessor is needed by TenantProvider for JWT claim fallback
        services.AddHttpContextAccessor();
        services.AddScoped<ITenantProvider, TenantProvider>();

        // ---- ASP.NET Core Identity ----
        services.AddIdentityApiEndpoints<ApplicationUser>()
            .AddRoles<IdentityRole<Guid>>()
            .AddClaimsPrincipalFactory<CustomClaimsFactory>()
            .AddEntityFrameworkStores<ApplicationDbContext>();

        // Identity options: password policy, lockout, email confirmation
        services.Configure<IdentityOptions>(options =>
        {
            // Require email confirmation before login
            options.SignIn.RequireConfirmedEmail = true;

            // Password policy per locked decisions
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Password.RequiredLength = 8;

            // Lockout: 15 minutes after 5 failed attempts
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.AllowedForNewUsers = true;
        });

        // Email confirmation / password reset token lifespan: 24 hours
        services.Configure<DataProtectionTokenProviderOptions>(options =>
        {
            options.TokenLifespan = TimeSpan.FromHours(24);
        });

        // Bearer token configuration for built-in Identity API endpoints
        services.Configure<BearerTokenOptions>(IdentityConstants.BearerScheme, options =>
        {
            options.BearerTokenExpiration = TimeSpan.FromMinutes(30);  // Default session
            options.RefreshTokenExpiration = TimeSpan.FromDays(30);    // Max with "Remember me"
        });

        // ---- JWT Bearer authentication (for validating custom login tokens) ----
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = configuration["Jwt:Issuer"],
                ValidAudience = configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!))
            };

            // SignalR WebSocket connections pass JWT via query string (not headers).
            // Read access_token from query string when path starts with /hubs.
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    var path = context.HttpContext.Request.Path;

                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    {
                        context.Token = accessToken;
                    }

                    return Task.CompletedTask;
                }
            };
        });

        // ---- Authorization ----
        services.AddAuthorization();

        // ---- RBAC permission authorization (policy provider, handler, permission service, cache) ----
        services.AddPermissionAuthorization();

        // ---- Image processing and file storage ----
        services.AddImageServices(configuration);

        // ---- Email template services (repository, render, merge fields) ----
        services.AddEmailTemplateServices();

        // ---- Duplicate detection and merge services ----
        services.AddDuplicateServices();

        // ---- Webhook delivery pipeline (handler, delivery service, SSRF validator, payload builder) ----
        services.AddWebhookServices();

        return services;
    }
}
