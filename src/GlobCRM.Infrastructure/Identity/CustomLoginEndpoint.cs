using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace GlobCRM.Infrastructure.Identity;

/// <summary>
/// Custom login endpoint that returns JWT with organizationId claim and handles rememberMe flag.
/// Mapped at POST /api/auth/login-extended.
///
/// The built-in MapIdentityApi login returns opaque bearer tokens without custom claims.
/// This endpoint generates proper JWTs with organizationId, role, email, and name claims.
/// Keeps MapIdentityApi for other endpoints (register, forgot-password, 2FA management, email confirmation).
/// </summary>
public static class CustomLoginEndpoint
{
    /// <summary>
    /// Login request DTO.
    /// </summary>
    public record LoginRequest(
        string Email,
        string Password,
        bool RememberMe = false,
        string? TwoFactorCode = null);

    /// <summary>
    /// Login response DTO matching the ASP.NET Core Identity bearer token format.
    /// </summary>
    public record LoginResponse(
        string TokenType,
        string AccessToken,
        int ExpiresIn,
        string RefreshToken);

    /// <summary>
    /// Handles the custom login flow with JWT claims and rememberMe support.
    /// </summary>
    public static async Task<IResult> HandleLogin(
        LoginRequest request,
        SignInManager<ApplicationUser> signInManager,
        UserManager<ApplicationUser> userManager,
        TenantDbContext tenantDbContext,
        IConfiguration configuration)
    {
        // Find user by email
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            return Results.Unauthorized();
        }

        // Check if email is confirmed
        if (!await userManager.IsEmailConfirmedAsync(user))
        {
            return Results.Problem(
                detail: "Email not confirmed. Please check your email for the confirmation link.",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        // Check if user is active
        if (!user.IsActive)
        {
            return Results.Problem(
                detail: "Account is deactivated. Please contact your organization administrator.",
                statusCode: StatusCodes.Status403Forbidden);
        }

        // Validate credentials
        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);

        if (result.IsLockedOut)
        {
            return Results.Problem(
                detail: "Account is locked. Please try again later.",
                statusCode: StatusCodes.Status423Locked);
        }

        if (result.RequiresTwoFactor)
        {
            if (string.IsNullOrEmpty(request.TwoFactorCode))
            {
                return Results.Ok(new { requiresTwoFactor = true });
            }

            // Validate 2FA code
            var twoFactorResult = await signInManager.TwoFactorAuthenticatorSignInAsync(
                request.TwoFactorCode, isPersistent: false, rememberClient: false);

            if (!twoFactorResult.Succeeded)
            {
                return Results.Problem(
                    detail: "Invalid two-factor authentication code.",
                    statusCode: StatusCodes.Status401Unauthorized);
            }
        }
        else if (!result.Succeeded)
        {
            return Results.Unauthorized();
        }

        // Get organization details for claims
        var organization = await tenantDbContext.Organizations
            .FirstOrDefaultAsync(o => o.Id == user.OrganizationId);

        // Get user roles
        var roles = await userManager.GetRolesAsync(user);

        // Generate JWT with custom claims
        var accessTokenExpiration = TimeSpan.FromMinutes(30);
        var refreshTokenExpiration = request.RememberMe
            ? TimeSpan.FromDays(30)
            : TimeSpan.FromMinutes(30);

        var accessToken = GenerateJwtToken(user, organization, roles, accessTokenExpiration, configuration);
        var refreshToken = GenerateRefreshToken();

        // Store refresh token and update LastLoginAt
        user.RefreshToken = HashToken(refreshToken);
        user.RefreshTokenExpiresAt = DateTimeOffset.UtcNow.Add(refreshTokenExpiration);
        user.LastLoginAt = DateTimeOffset.UtcNow;
        await userManager.UpdateAsync(user);

        return Results.Ok(new LoginResponse(
            TokenType: "Bearer",
            AccessToken: accessToken,
            ExpiresIn: (int)accessTokenExpiration.TotalSeconds,
            RefreshToken: refreshToken));
    }

    internal static string GenerateJwtToken(
        ApplicationUser user,
        Organization? organization,
        IList<string> roles,
        TimeSpan expiration,
        IConfiguration configuration)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("organizationId", user.OrganizationId.ToString()),
            new("firstName", user.FirstName),
            new("lastName", user.LastName)
        };

        if (organization != null)
        {
            claims.Add(new Claim("organizationName", organization.Name));
        }

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"],
            audience: configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.Add(expiration),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Generates a cryptographically random refresh token.
    /// </summary>
    internal static string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    /// <summary>
    /// SHA256 hash of token for secure storage (never store raw refresh tokens).
    /// </summary>
    internal static string HashToken(string token)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }
}
