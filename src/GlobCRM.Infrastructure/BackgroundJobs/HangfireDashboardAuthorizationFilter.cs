using Hangfire.Dashboard;
using Microsoft.AspNetCore.Http;

namespace GlobCRM.Infrastructure.BackgroundJobs;

/// <summary>
/// Authorization filter for the Hangfire dashboard.
/// In development, allows all access. In production, requires Admin Identity role.
/// </summary>
public class HangfireDashboardAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();

        // In development, allow all access for debugging
        var env = httpContext.RequestServices.GetService(typeof(Microsoft.AspNetCore.Hosting.IWebHostEnvironment))
            as Microsoft.AspNetCore.Hosting.IWebHostEnvironment;

        if (env != null && env.EnvironmentName == "Development")
            return true;

        // In production, require authenticated Admin user
        return httpContext.User.Identity?.IsAuthenticated == true
            && httpContext.User.IsInRole("Admin");
    }
}
