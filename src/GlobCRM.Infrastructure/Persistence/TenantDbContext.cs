using Finbuckle.MultiTenant.EntityFrameworkCore.Stores;
using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.MultiTenancy;
using GlobCRM.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence;

/// <summary>
/// Tenant catalog DbContext. NOT tenant-scoped.
/// Extends Finbuckle's EFCoreStoreDbContext to serve as the Finbuckle tenant store.
/// Holds the Organization (tenant) table for lookup and management.
/// This context is used for operations that span all tenants
/// (e.g., subdomain resolution, org creation, admin operations).
/// </summary>
public class TenantDbContext : EFCoreStoreDbContext<TenantInfo>
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

        // Exclude entities managed by ApplicationDbContext (discovered via Organization navigations)
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.ToTable("AspNetUsers", t => t.ExcludeFromMigrations());

            // Ignore complex properties not needed in TenantDbContext —
            // prevents EF Core from interpreting Dictionary<string,bool> as navigation
            entity.Ignore(u => u.Preferences);
            entity.Ignore(u => u.WorkSchedule);
            entity.Ignore(u => u.SocialLinks);
            entity.Ignore(u => u.Skills);
        });
        modelBuilder.Entity<Invitation>().ToTable("invitations", t => t.ExcludeFromMigrations());

        // Configure the Finbuckle TenantInfo entity
        modelBuilder.Entity<TenantInfo>(entity =>
        {
            entity.ToTable("tenant_info");

            entity.Property(t => t.OrganizationId)
                .HasColumnName("organization_id");
        });
    }
}
