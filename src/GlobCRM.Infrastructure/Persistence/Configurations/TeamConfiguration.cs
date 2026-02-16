using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Team.
/// Teams are tenant-scoped with unique (tenant_id, name) constraint.
/// </summary>
public class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.ToTable("teams");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(t => t.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(t => t.Name)
            .HasColumnName("name")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(t => t.Description)
            .HasColumnName("description")
            .HasMaxLength(500);

        builder.Property(t => t.DefaultRoleId)
            .HasColumnName("default_role_id");

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        builder.Property(t => t.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        // Unique constraint: one team name per tenant
        builder.HasIndex(t => new { t.TenantId, t.Name })
            .IsUnique()
            .HasDatabaseName("ix_teams_tenant_id_name");

        // Index for tenant-scoped queries
        builder.HasIndex(t => t.TenantId)
            .HasDatabaseName("idx_teams_tenant");

        // Foreign key to Organization (tenant)
        builder.HasOne(t => t.Organization)
            .WithMany()
            .HasForeignKey(t => t.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        // Foreign key to Role (default role) -- SET NULL on delete
        builder.HasOne(t => t.DefaultRole)
            .WithMany()
            .HasForeignKey(t => t.DefaultRoleId)
            .OnDelete(DeleteBehavior.SetNull);

        // Navigation: Team has many Members (cascade delete)
        builder.HasMany(t => t.Members)
            .WithOne(tm => tm.Team)
            .HasForeignKey(tm => tm.TeamId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
