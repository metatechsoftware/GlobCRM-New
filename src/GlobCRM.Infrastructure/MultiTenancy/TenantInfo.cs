using Finbuckle.MultiTenant.Abstractions;

namespace GlobCRM.Infrastructure.MultiTenancy;

/// <summary>
/// Finbuckle tenant info class mapping to the Organization table.
/// Extends Finbuckle's base TenantInfo with OrganizationId (the actual Guid primary key).
/// Identifier = subdomain string used for tenant resolution.
/// </summary>
public class TenantInfo : Finbuckle.MultiTenant.Abstractions.TenantInfo
{
    /// <summary>
    /// The Organization's Guid primary key.
    /// Maps from Organization.Id for use in tenant-scoped queries.
    /// </summary>
    public Guid OrganizationId { get; set; }
}
