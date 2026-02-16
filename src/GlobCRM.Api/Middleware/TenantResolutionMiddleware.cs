using Finbuckle.MultiTenant.Abstractions;
using TenantInfo = GlobCRM.Infrastructure.MultiTenancy.TenantInfo;

namespace GlobCRM.Api.Middleware;

/// <summary>
/// Custom middleware that wraps Finbuckle's tenant resolution to enforce tenant context
/// on tenant-scoped endpoints. Returns 404 "Organization not found" if no tenant was resolved
/// for non-exempt paths.
/// </summary>
public class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    /// <summary>
    /// Paths that do not require tenant context (org creation, auth registration, health checks).
    /// </summary>
    private static readonly string[] ExemptPaths =
    [
        "/api/auth/register",
        "/api/auth/confirmEmail",
        "/api/auth/resendConfirmationEmail",
        "/api/organizations",
        "/api/organizations/check-subdomain",
        "/health",
        "/api/auth/forgotPassword",
        "/api/auth/resetPassword"
    ];

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Skip tenant validation for exempt paths
        if (IsExemptPath(path))
        {
            await _next(context);
            return;
        }

        // Check if Finbuckle resolved a tenant
        var multiTenantContext = context.RequestServices
            .GetService<IMultiTenantContextAccessor<TenantInfo>>();

        var tenantInfo = multiTenantContext?.MultiTenantContext?.TenantInfo;

        if (tenantInfo == null)
        {
            // In development, allow requests without tenant context if X-Tenant-Id header is absent
            // This enables testing non-tenant endpoints without subdomain setup
            var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
            if (env.IsDevelopment())
            {
                // In development, only enforce tenant for paths that clearly need it
                // Let it pass through and let the individual endpoint handle the null tenant
                await _next(context);
                return;
            }

            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Organization not found",
                message = "The requested organization could not be found. Please check the URL."
            });
            return;
        }

        await _next(context);
    }

    private static bool IsExemptPath(string path)
    {
        foreach (var exemptPath in ExemptPaths)
        {
            if (path.StartsWith(exemptPath, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        // Exempt all Swagger / OpenAPI paths
        if (path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }
}

/// <summary>
/// Extension methods for registering TenantResolutionMiddleware.
/// </summary>
public static class TenantResolutionMiddlewareExtensions
{
    public static IApplicationBuilder UseTenantResolution(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<TenantResolutionMiddleware>();
    }
}
