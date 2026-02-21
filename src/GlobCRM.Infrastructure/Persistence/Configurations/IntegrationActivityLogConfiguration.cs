using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for IntegrationActivityLog.
/// Maps to "integration_activity_logs" table with snake_case columns.
/// FK to Integration with cascade delete.
/// Index on (integration_id, created_at DESC) for efficient activity log queries.
/// </summary>
public class IntegrationActivityLogConfiguration : IEntityTypeConfiguration<IntegrationActivityLog>
{
    public void Configure(EntityTypeBuilder<IntegrationActivityLog> builder)
    {
        builder.ToTable("integration_activity_logs");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnName("id");

        builder.Property(l => l.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(l => l.IntegrationId)
            .HasColumnName("integration_id")
            .IsRequired();

        builder.Property(l => l.Action)
            .HasColumnName("action")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(l => l.PerformedByUserId)
            .HasColumnName("performed_by_user_id")
            .IsRequired();

        builder.Property(l => l.PerformedByUserName)
            .HasColumnName("performed_by_user_name")
            .HasColumnType("varchar(200)")
            .IsRequired();

        builder.Property(l => l.Details)
            .HasColumnName("details")
            .HasColumnType("text");

        builder.Property(l => l.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Relationships
        builder.HasOne(l => l.Integration)
            .WithMany(i => i.ActivityLogs)
            .HasForeignKey(l => l.IntegrationId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(l => new { l.IntegrationId, l.CreatedAt })
            .IsDescending(false, true)
            .HasDatabaseName("idx_integration_activity_logs_integration_created");
    }
}
