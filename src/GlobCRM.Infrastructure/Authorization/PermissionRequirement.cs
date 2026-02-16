using Microsoft.AspNetCore.Authorization;

namespace GlobCRM.Infrastructure.Authorization;

/// <summary>
/// Authorization requirement for dynamic permission checks.
/// Used with PermissionPolicyProvider to parse "Permission:{Entity}:{Operation}" policy names
/// into typed requirements that PermissionAuthorizationHandler can evaluate.
/// </summary>
public class PermissionRequirement : IAuthorizationRequirement
{
    /// <summary>
    /// The entity type being accessed (e.g., "Contact", "Deal", "Company").
    /// </summary>
    public string EntityType { get; }

    /// <summary>
    /// The operation being performed (e.g., "View", "Create", "Edit", "Delete").
    /// </summary>
    public string Operation { get; }

    public PermissionRequirement(string entityType, string operation)
    {
        EntityType = entityType;
        Operation = operation;
    }
}
