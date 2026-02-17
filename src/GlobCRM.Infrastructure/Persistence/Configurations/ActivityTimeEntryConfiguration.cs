using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ActivityTimeEntry.
/// Maps to "activity_time_entries" table with cascade delete from Activity
/// and SetNull delete from User. Decimal precision for DurationMinutes.
/// </summary>
public class ActivityTimeEntryConfiguration : IEntityTypeConfiguration<ActivityTimeEntry>
{
    public void Configure(EntityTypeBuilder<ActivityTimeEntry> builder)
    {
        builder.ToTable("activity_time_entries");

        builder.HasKey(te => te.Id);

        builder.Property(te => te.Id)
            .HasColumnName("id");

        builder.Property(te => te.ActivityId)
            .HasColumnName("activity_id")
            .IsRequired();

        builder.Property(te => te.DurationMinutes)
            .HasColumnName("duration_minutes")
            .HasPrecision(10, 2)
            .IsRequired();

        builder.Property(te => te.Description)
            .HasColumnName("description");

        builder.Property(te => te.EntryDate)
            .HasColumnName("entry_date")
            .IsRequired();

        builder.Property(te => te.UserId)
            .HasColumnName("user_id");

        builder.Property(te => te.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Relationships
        builder.HasOne(te => te.User)
            .WithMany()
            .HasForeignKey(te => te.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(te => te.ActivityId)
            .HasDatabaseName("idx_activity_time_entries_activity");
    }
}
