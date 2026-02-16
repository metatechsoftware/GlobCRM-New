using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence;

/// <summary>
/// Tenant catalog DbContext. NOT tenant-scoped.
/// Holds the Organization (tenant) table for lookup and management.
/// This context is used for operations that span all tenants
/// (e.g., subdomain resolution, org creation, admin operations).
/// </summary>
public class TenantDbContext : DbContext
{
    public TenantDbContext(DbContextOptions<TenantDbContext> options)
        : base(options)
    {
    }

    public DbSet<Organization> Organizations => Set<Organization>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfiguration(new OrganizationConfiguration());
    }
}
