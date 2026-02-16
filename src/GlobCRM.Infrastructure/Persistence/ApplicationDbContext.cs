using Finbuckle.MultiTenant.Abstractions;
using Finbuckle.MultiTenant.EntityFrameworkCore;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence.Configurations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TenantInfo = GlobCRM.Infrastructure.MultiTenancy.TenantInfo;

namespace GlobCRM.Infrastructure.Persistence;

/// <summary>
/// Tenant-scoped DbContext extending IdentityDbContext.
/// Implements Finbuckle IMultiTenantDbContext for automatic tenant filtering.
/// This is Layer 2 of the triple-layer tenant isolation defense:
///   Layer 1: Middleware (Finbuckle subdomain resolution)
///   Layer 2: EF Core global query filters (this context)
///   Layer 3: PostgreSQL Row-Level Security (scripts/rls-setup.sql)
/// </summary>
public class ApplicationDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>, IMultiTenantDbContext
{
    private readonly IMultiTenantContextAccessor<TenantInfo> _multiTenantContextAccessor;
    private readonly ITenantProvider? _tenantProvider;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        IMultiTenantContextAccessor<TenantInfo> multiTenantContextAccessor,
        ITenantProvider? tenantProvider = null)
        : base(options)
    {
        _multiTenantContextAccessor = multiTenantContextAccessor;
        _tenantProvider = tenantProvider;
    }

    public ITenantInfo? TenantInfo => _multiTenantContextAccessor.MultiTenantContext?.TenantInfo;

    /// <summary>
    /// Not using Finbuckle's built-in TenantMismatchMode for this implementation.
    /// We handle tenant filtering via global query filters directly.
    /// </summary>
    public TenantMismatchMode TenantMismatchMode => TenantMismatchMode.Throw;

    /// <summary>
    /// Not tracked entities should be treated as unresolved.
    /// </summary>
    public TenantNotSetMode TenantNotSetMode => TenantNotSetMode.Throw;

    public DbSet<Invitation> Invitations => Set<Invitation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply entity type configurations
        // Organization table is owned by TenantDbContext - apply config for mapping but exclude from migrations
        modelBuilder.ApplyConfiguration(new OrganizationConfiguration());
        modelBuilder.Entity<Organization>().ToTable("organizations", t => t.ExcludeFromMigrations());

        modelBuilder.ApplyConfiguration(new ApplicationUserConfiguration());
        modelBuilder.ApplyConfiguration(new InvitationConfiguration());

        // Global query filter: filter Invitations by TenantId matching current tenant
        // When no tenant is resolved (e.g., login, org creation), filter is bypassed
        modelBuilder.Entity<Invitation>().HasQueryFilter(
            i => _tenantProvider == null || _tenantProvider.GetTenantId() == null || i.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter ApplicationUser by OrganizationId
        // When no tenant is resolved (e.g., login, org creation), filter is bypassed
        modelBuilder.Entity<ApplicationUser>().HasQueryFilter(
            u => _tenantProvider == null || _tenantProvider.GetTenantId() == null || u.OrganizationId == _tenantProvider.GetTenantId());
    }
}
