using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for MergeAuditLog.
/// Maps to "merge_audit_logs" table with snake_case columns.
/// JSONB columns for FieldSelections and TransferCounts.
/// </summary>
public class MergeAuditLogConfiguration : IEntityTypeConfiguration<MergeAuditLog>
{
    public void Configure(EntityTypeBuilder<MergeAuditLog> builder)
    {
        builder.ToTable("merge_audit_logs");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .HasColumnName("id");

        builder.Property(m => m.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(m => m.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(m => m.SurvivorId)
            .HasColumnName("survivor_id")
            .IsRequired();

        builder.Property(m => m.LoserId)
            .HasColumnName("loser_id")
            .IsRequired();

        builder.Property(m => m.MergedByUserId)
            .HasColumnName("merged_by_user_id")
            .IsRequired();

        builder.Property(m => m.FieldSelections)
            .HasColumnName("field_selections")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(m => m.TransferCounts)
            .HasColumnName("transfer_counts")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(m => m.MergedAt)
            .HasColumnName("merged_at")
            .IsRequired();

        // Relationships
        builder.HasOne(m => m.MergedByUser)
            .WithMany()
            .HasForeignKey(m => m.MergedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes
        builder.HasIndex(m => m.TenantId)
            .HasDatabaseName("idx_merge_audit_logs_tenant");

        builder.HasIndex(m => new { m.TenantId, m.EntityType })
            .HasDatabaseName("idx_merge_audit_logs_tenant_entity");

        builder.HasIndex(m => m.SurvivorId)
            .HasDatabaseName("idx_merge_audit_logs_survivor");

        builder.HasIndex(m => m.LoserId)
            .HasDatabaseName("idx_merge_audit_logs_loser");
    }
}
