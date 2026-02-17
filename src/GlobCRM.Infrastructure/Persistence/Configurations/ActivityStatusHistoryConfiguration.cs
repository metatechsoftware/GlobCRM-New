using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ActivityStatusHistory.
/// Maps to "activity_status_histories" table with snake_case columns,
/// cascade delete from Activity, and string conversions for status enums.
/// Follows DealStageHistoryConfiguration pattern exactly.
/// </summary>
public class ActivityStatusHistoryConfiguration : IEntityTypeConfiguration<ActivityStatusHistory>
{
    public void Configure(EntityTypeBuilder<ActivityStatusHistory> builder)
    {
        builder.ToTable("activity_status_histories");

        builder.HasKey(h => h.Id);

        builder.Property(h => h.Id)
            .HasColumnName("id");

        builder.Property(h => h.ActivityId)
            .HasColumnName("activity_id")
            .IsRequired();

        builder.Property(h => h.FromStatus)
            .HasColumnName("from_status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(h => h.ToStatus)
            .HasColumnName("to_status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(h => h.ChangedByUserId)
            .HasColumnName("changed_by_user_id");

        builder.Property(h => h.ChangedAt)
            .HasColumnName("changed_at")
            .IsRequired();

        // Relationships
        builder.HasOne(h => h.Activity)
            .WithMany()
            .HasForeignKey(h => h.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(h => h.ChangedByUser)
            .WithMany()
            .HasForeignKey(h => h.ChangedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(h => h.ActivityId)
            .HasDatabaseName("idx_activity_status_histories_activity");

        builder.HasIndex(h => h.ChangedAt)
            .HasDatabaseName("idx_activity_status_histories_changed_at");
    }
}
