using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for WebhookDeliveryLog.
/// Maps to "webhook_delivery_logs" table with snake_case columns.
/// FK to WebhookSubscription with cascade delete.
/// Indexes optimized for per-subscription and global (tenant-wide) log queries.
/// </summary>
public class WebhookDeliveryLogConfiguration : IEntityTypeConfiguration<WebhookDeliveryLog>
{
    public void Configure(EntityTypeBuilder<WebhookDeliveryLog> builder)
    {
        builder.ToTable("webhook_delivery_logs");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnName("id");

        builder.Property(l => l.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(l => l.SubscriptionId)
            .HasColumnName("subscription_id")
            .IsRequired();

        builder.Property(l => l.EventType)
            .HasColumnName("event_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.EntityId)
            .HasColumnName("entity_id")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.AttemptNumber)
            .HasColumnName("attempt_number")
            .HasDefaultValue(1);

        builder.Property(l => l.Success)
            .HasColumnName("success")
            .IsRequired();

        builder.Property(l => l.HttpStatusCode)
            .HasColumnName("http_status_code");

        builder.Property(l => l.ResponseBody)
            .HasColumnName("response_body")
            .HasMaxLength(1024);

        builder.Property(l => l.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(2000);

        builder.Property(l => l.RequestPayload)
            .HasColumnName("request_payload")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(l => l.DurationMs)
            .HasColumnName("duration_ms")
            .IsRequired();

        builder.Property(l => l.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Relationships
        builder.HasOne(l => l.Subscription)
            .WithMany()
            .HasForeignKey(l => l.SubscriptionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(l => new { l.SubscriptionId, l.CreatedAt })
            .IsDescending(false, true)
            .HasDatabaseName("idx_webhook_delivery_logs_subscription_created");

        builder.HasIndex(l => new { l.TenantId, l.CreatedAt })
            .IsDescending(false, true)
            .HasDatabaseName("idx_webhook_delivery_logs_tenant_created");
    }
}
