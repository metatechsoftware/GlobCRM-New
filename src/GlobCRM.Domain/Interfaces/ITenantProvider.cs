using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Provides the current tenant context for data isolation.
/// Implemented by infrastructure layer using Finbuckle and request context.
/// </summary>
public interface ITenantProvider
{
    /// <summary>
    /// Gets the current tenant (organization) ID from the request context.
    /// Returns null if no tenant context is established (e.g., during org creation).
    /// </summary>
    Guid? GetTenantId();

    /// <summary>
    /// Gets the full Organization entity for the current tenant.
    /// </summary>
    Task<Organization?> GetCurrentOrganizationAsync();
}
