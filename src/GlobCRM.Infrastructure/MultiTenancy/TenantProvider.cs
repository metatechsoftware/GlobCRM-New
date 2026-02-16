using Finbuckle.MultiTenant.Abstractions;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.MultiTenancy;

/// <summary>
/// ITenantProvider implementation using Finbuckle's multi-tenant context.
/// Registered as scoped so it resolves per-request tenant context.
/// </summary>
public class TenantProvider : ITenantProvider
{
    private readonly IMultiTenantContextAccessor<TenantInfo> _multiTenantContextAccessor;
    private readonly TenantDbContext _tenantDbContext;

    public TenantProvider(
        IMultiTenantContextAccessor<TenantInfo> multiTenantContextAccessor,
        TenantDbContext tenantDbContext)
    {
        _multiTenantContextAccessor = multiTenantContextAccessor;
        _tenantDbContext = tenantDbContext;
    }

    /// <summary>
    /// Gets the current tenant (organization) ID from the resolved Finbuckle context.
    /// Returns null if no tenant context is established (e.g., during org creation or health checks).
    /// </summary>
    public Guid? GetTenantId()
    {
        var tenantInfo = _multiTenantContextAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo == null)
            return null;

        // Use the OrganizationId if set, otherwise try to parse the Finbuckle Id string
        if (tenantInfo.OrganizationId != Guid.Empty)
            return tenantInfo.OrganizationId;

        if (Guid.TryParse(tenantInfo.Id, out var parsedId))
            return parsedId;

        return null;
    }

    /// <summary>
    /// Gets the full Organization entity for the current tenant by querying TenantDbContext.
    /// </summary>
    public async Task<Organization?> GetCurrentOrganizationAsync()
    {
        var tenantId = GetTenantId();
        if (tenantId == null)
            return null;

        return await _tenantDbContext.Organizations
            .FirstOrDefaultAsync(o => o.Id == tenantId.Value);
    }
}
