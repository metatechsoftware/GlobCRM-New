using System.Security.Claims;

namespace GlobCRM.Api.Auth;

/// <summary>
/// Handles the POST /api/auth/logout endpoint.
/// For Phase 1: logout is primarily client-side (clear tokens).
/// Server-side: logs the logout event for audit trail.
/// Future: refresh token blacklisting/invalidation.
/// Per locked decision: user can log out from any page (frontend implementation in Plan 07).
/// </summary>
public static class LogoutEndpoint
{
    public static IResult Handle(HttpContext httpContext, ILogger<LogoutEndpoint_> logger)
    {
        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var email = httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        logger.LogInformation(
            "User {UserId} ({Email}) logged out",
            userId ?? "unknown", email ?? "unknown");

        // Phase 1: Logout is primarily client-side (clear JWT from memory/localStorage).
        // Server-side acknowledges the logout for audit trail purposes.
        // Future: Invalidate refresh token in database, add token to blacklist.

        return Results.Ok(new { message = "Logged out successfully" });
    }
}

/// <summary>
/// Marker class for ILogger generic type parameter.
/// Required because static classes cannot be used as generic type arguments.
/// </summary>
public class LogoutEndpoint_ { }
