using Finbuckle.MultiTenant.Abstractions;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.MultiTenancy;

/// <summary>
/// ITenantProvider implementation using Finbuckle's multi-tenant context.
/// Registered as scoped so it resolves per-request tenant context.
/// Falls back to JWT organizationId claim when Finbuckle can't resolve a tenant.
/// </summary>
public class TenantProvider : ITenantProvider
{
    private readonly IMultiTenantContextAccessor<TenantInfo> _multiTenantContextAccessor;
    private readonly TenantDbContext _tenantDbContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantProvider(
        IMultiTenantContextAccessor<TenantInfo> multiTenantContextAccessor,
        TenantDbContext tenantDbContext,
        IHttpContextAccessor httpContextAccessor)
    {
        _multiTenantContextAccessor = multiTenantContextAccessor;
        _tenantDbContext = tenantDbContext;
        _httpContextAccessor = httpContextAccessor;
    }

    /// <summary>
    /// Gets the current tenant (organization) ID from the resolved Finbuckle context.
    /// Falls back to the organizationId JWT claim for authenticated requests where
    /// Finbuckle couldn't resolve the tenant (e.g., localhost without subdomain).
    /// Returns null if no tenant context is established (e.g., during org creation, CLI, or health checks).
    /// </summary>
    public Guid? GetTenantId()
    {
        // Primary: Finbuckle-resolved tenant (header or subdomain)
        var tenantInfo = _multiTenantContextAccessor.MultiTenantContext?.TenantInfo;
        if (tenantInfo != null)
        {
            if (tenantInfo.OrganizationId != Guid.Empty)
                return tenantInfo.OrganizationId;

            if (Guid.TryParse(tenantInfo.Id, out var parsedId))
                return parsedId;
        }

        // Fallback: extract organizationId from JWT claims
        var orgClaim = _httpContextAccessor.HttpContext?.User
            ?.FindFirst("organizationId")?.Value;
        if (orgClaim != null && Guid.TryParse(orgClaim, out var orgId))
            return orgId;

        return null;  // Legitimate for unauthenticated endpoints (register, login, health) and CLI
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
