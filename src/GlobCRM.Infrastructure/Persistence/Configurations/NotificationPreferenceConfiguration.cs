using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for NotificationPreference.
/// Maps to "notification_preferences" table with snake_case columns,
/// unique index on (tenant_id, user_id, notification_type), and Cascade delete from ApplicationUser.
/// </summary>
public class NotificationPreferenceConfiguration : IEntityTypeConfiguration<NotificationPreference>
{
    public void Configure(EntityTypeBuilder<NotificationPreference> builder)
    {
        builder.ToTable("notification_preferences");

        builder.HasKey(np => np.Id);

        builder.Property(np => np.Id)
            .HasColumnName("id");

        builder.Property(np => np.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(np => np.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(np => np.NotificationType)
            .HasColumnName("notification_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(np => np.InAppEnabled)
            .HasColumnName("in_app_enabled")
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(np => np.EmailEnabled)
            .HasColumnName("email_enabled")
            .HasDefaultValue(true)
            .IsRequired();

        // Relationships
        builder.HasOne(np => np.User)
            .WithMany()
            .HasForeignKey(np => np.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(np => new { np.TenantId, np.UserId, np.NotificationType })
            .HasDatabaseName("idx_notification_preferences_tenant_user_type")
            .IsUnique();
    }
}
