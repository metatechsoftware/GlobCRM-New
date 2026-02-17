using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Activity.
/// Maps to "activities" table with snake_case columns, JSONB custom fields with GIN index,
/// string conversions for Type/Status/Priority enums, and proper FK constraints.
/// </summary>
public class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> builder)
    {
        builder.ToTable("activities");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id");

        builder.Property(a => a.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(a => a.Subject)
            .HasColumnName("subject")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(a => a.Description)
            .HasColumnName("description");

        builder.Property(a => a.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(a => a.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(a => a.Priority)
            .HasColumnName("priority")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(a => a.DueDate)
            .HasColumnName("due_date");

        builder.Property(a => a.CompletedAt)
            .HasColumnName("completed_at");

        builder.Property(a => a.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(a => a.AssignedToId)
            .HasColumnName("assigned_to_id");

        builder.Property(a => a.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(a => a.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(a => a.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(a => a.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(a => a.Owner)
            .WithMany()
            .HasForeignKey(a => a.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(a => a.AssignedTo)
            .WithMany()
            .HasForeignKey(a => a.AssignedToId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(a => a.Comments)
            .WithOne(c => c.Activity)
            .HasForeignKey(c => c.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.Attachments)
            .WithOne(att => att.Activity)
            .HasForeignKey(att => att.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.TimeEntries)
            .WithOne(te => te.Activity)
            .HasForeignKey(te => te.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.Followers)
            .WithOne(f => f.Activity)
            .HasForeignKey(f => f.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.Links)
            .WithOne(l => l.Activity)
            .HasForeignKey(l => l.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(a => a.TenantId)
            .HasDatabaseName("idx_activities_tenant");

        builder.HasIndex(a => a.OwnerId)
            .HasDatabaseName("idx_activities_owner");

        builder.HasIndex(a => a.AssignedToId)
            .HasDatabaseName("idx_activities_assigned_to");

        builder.HasIndex(a => a.Status)
            .HasDatabaseName("idx_activities_status");

        builder.HasIndex(a => a.DueDate)
            .HasDatabaseName("idx_activities_due_date");

        builder.HasIndex(a => a.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_activities_custom_fields_gin");
    }
}
