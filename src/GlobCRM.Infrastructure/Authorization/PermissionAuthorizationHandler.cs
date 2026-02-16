using System.Security.Claims;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace GlobCRM.Infrastructure.Authorization;

/// <summary>
/// ASP.NET Core authorization handler that evaluates PermissionRequirements
/// against the effective permissions resolved by IPermissionService.
///
/// Usage: Apply [Authorize(Policy = "Permission:Contact:View")] to any controller action.
/// The PermissionPolicyProvider creates a PermissionRequirement from the policy name,
/// and this handler evaluates it.
/// </summary>
public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IPermissionService _permissionService;

    public PermissionAuthorizationHandler(IPermissionService permissionService)
    {
        _permissionService = permissionService;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        // Get userId from claims
        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            // No valid user identity -- leave requirement unfulfilled (unauthorized)
            return;
        }

        var effectivePermission = await _permissionService.GetEffectivePermissionAsync(
            userId, requirement.EntityType, requirement.Operation);

        if (effectivePermission.Scope != PermissionScope.None)
        {
            context.Succeed(requirement);
        }
    }
}
