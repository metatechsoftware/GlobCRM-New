using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Pipeline.
/// Maps to "pipelines" table with snake_case columns, tenant/team indexes,
/// and cascade delete to stages.
/// </summary>
public class PipelineConfiguration : IEntityTypeConfiguration<Pipeline>
{
    public void Configure(EntityTypeBuilder<Pipeline> builder)
    {
        builder.ToTable("pipelines");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnName("id");

        builder.Property(p => p.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(p => p.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(p => p.Description)
            .HasColumnName("description");

        builder.Property(p => p.TeamId)
            .HasColumnName("team_id");

        builder.Property(p => p.IsDefault)
            .HasColumnName("is_default")
            .HasDefaultValue(false);

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(p => p.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(p => p.Team)
            .WithMany()
            .HasForeignKey(p => p.TeamId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(p => p.Stages)
            .WithOne(s => s.Pipeline)
            .HasForeignKey(s => s.PipelineId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.Deals)
            .WithOne(d => d.Pipeline)
            .HasForeignKey(d => d.PipelineId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes
        builder.HasIndex(p => p.TenantId)
            .HasDatabaseName("idx_pipelines_tenant");
    }
}
