using System.Text;
using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace GlobCRM.Infrastructure.Identity;

/// <summary>
/// Custom refresh endpoint that validates stored refresh tokens and issues new JWT + refresh token pairs.
/// Mapped at POST /api/auth/refresh. Replaces the built-in Identity refresh which is incompatible
/// with our custom JWT login flow.
/// </summary>
public static class CustomRefreshEndpoint
{
    public record RefreshRequest(string RefreshToken);

    public static async Task<IResult> Handle(
        RefreshRequest request,
        UserManager<ApplicationUser> userManager,
        TenantDbContext tenantDbContext,
        IConfiguration configuration)
    {
        if (string.IsNullOrEmpty(request.RefreshToken))
        {
            return Results.Unauthorized();
        }

        var hashedToken = CustomLoginEndpoint.HashToken(request.RefreshToken);

        // Find user by hashed refresh token
        var user = await userManager.Users
            .FirstOrDefaultAsync(u => u.RefreshToken == hashedToken);

        if (user == null || user.RefreshTokenExpiresAt < DateTimeOffset.UtcNow)
        {
            return Results.Unauthorized();
        }

        if (!user.IsActive)
        {
            return Results.Unauthorized();
        }

        // Get organization and roles for new JWT
        var organization = await tenantDbContext.Organizations
            .FirstOrDefaultAsync(o => o.Id == user.OrganizationId);
        var roles = await userManager.GetRolesAsync(user);

        // Issue new tokens (rotate refresh token)
        var accessTokenExpiration = TimeSpan.FromMinutes(30);
        var isRememberMe = user.RefreshTokenExpiresAt > DateTimeOffset.UtcNow.AddHours(1);
        var refreshTokenExpiration = isRememberMe
            ? TimeSpan.FromDays(30)
            : TimeSpan.FromMinutes(30);

        var newAccessToken = CustomLoginEndpoint.GenerateJwtToken(user, organization, roles, accessTokenExpiration, configuration);
        var newRefreshToken = CustomLoginEndpoint.GenerateRefreshToken();

        // Store new refresh token
        user.RefreshToken = CustomLoginEndpoint.HashToken(newRefreshToken);
        user.RefreshTokenExpiresAt = DateTimeOffset.UtcNow.Add(refreshTokenExpiration);
        await userManager.UpdateAsync(user);

        return Results.Ok(new CustomLoginEndpoint.LoginResponse(
            TokenType: "Bearer",
            AccessToken: newAccessToken,
            ExpiresIn: (int)accessTokenExpiration.TotalSeconds,
            RefreshToken: newRefreshToken));
    }
}
