using System.Text;
using Finbuckle.MultiTenant.AspNetCore.Extensions;
using Finbuckle.MultiTenant.EntityFrameworkCore.Extensions;
using Finbuckle.MultiTenant.Extensions;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Identity;
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

        // ---- EF Core interceptors ----
        services.AddScoped<TenantDbConnectionInterceptor>();
        services.AddScoped<AuditableEntityInterceptor>();

        // ---- Database contexts ----

        // TenantDbContext (tenant catalog -- not tenant-scoped)
        services.AddDbContext<TenantDbContext>(options =>
            options.UseNpgsql(connectionString));

        // ApplicationDbContext (tenant-scoped) with interceptors
        services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
        {
            options.UseNpgsql(connectionString);
            options.AddInterceptors(
                serviceProvider.GetRequiredService<TenantDbConnectionInterceptor>(),
                serviceProvider.GetRequiredService<AuditableEntityInterceptor>());
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
        });

        // ---- Authorization ----
        services.AddAuthorization();

        return services;
    }
}
