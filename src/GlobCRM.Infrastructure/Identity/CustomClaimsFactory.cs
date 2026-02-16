using System.Security.Claims;
using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GlobCRM.Infrastructure.Identity;

/// <summary>
/// Custom claims principal factory that adds organizationId and organizationName claims
/// to the user's identity. These claims are used in JWT tokens and authorization.
/// </summary>
public class CustomClaimsFactory : UserClaimsPrincipalFactory<ApplicationUser, IdentityRole<Guid>>
{
    private readonly TenantDbContext _tenantDbContext;

    public CustomClaimsFactory(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        IOptions<IdentityOptions> optionsAccessor,
        TenantDbContext tenantDbContext)
        : base(userManager, roleManager, optionsAccessor)
    {
        _tenantDbContext = tenantDbContext;
    }

    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(ApplicationUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);

        // Add organizationId claim
        identity.AddClaim(new Claim("organizationId", user.OrganizationId.ToString()));

        // Add organizationName claim by querying from Organization table
        var organization = await _tenantDbContext.Organizations
            .FirstOrDefaultAsync(o => o.Id == user.OrganizationId);

        if (organization != null)
        {
            identity.AddClaim(new Claim("organizationName", organization.Name));
        }

        // Add user's role(s) as claims
        var roles = await UserManager.GetRolesAsync(user);
        foreach (var role in roles)
        {
            identity.AddClaim(new Claim(ClaimTypes.Role, role));
        }

        return identity;
    }
}
