using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace GlobCRM.Infrastructure.Authorization;

/// <summary>
/// Dynamic policy provider that parses "Permission:{Entity}:{Operation}" policy names
/// into PermissionRequirements. This enables [Authorize(Policy = "Permission:Contact:View")]
/// without registering every possible policy at startup.
///
/// Any policy name not starting with "Permission:" is delegated to the default provider.
/// </summary>
public class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    /// <summary>
    /// Prefix for permission-based policy names.
    /// Format: "Permission:{EntityType}:{Operation}"
    /// </summary>
    public const string PolicyPrefix = "Permission:";

    private readonly DefaultAuthorizationPolicyProvider _fallbackProvider;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallbackProvider = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(PolicyPrefix, StringComparison.OrdinalIgnoreCase))
        {
            // Parse "Permission:{Entity}:{Operation}" into a PermissionRequirement
            var parts = policyName[PolicyPrefix.Length..].Split(':');
            if (parts.Length == 2)
            {
                var entityType = parts[0];
                var operation = parts[1];

                var policy = new AuthorizationPolicyBuilder()
                    .AddRequirements(new PermissionRequirement(entityType, operation))
                    .Build();

                return Task.FromResult<AuthorizationPolicy?>(policy);
            }
        }

        // Delegate to default provider for non-permission policies
        return _fallbackProvider.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync()
    {
        return _fallbackProvider.GetDefaultPolicyAsync();
    }

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync()
    {
        return _fallbackProvider.GetFallbackPolicyAsync();
    }
}
