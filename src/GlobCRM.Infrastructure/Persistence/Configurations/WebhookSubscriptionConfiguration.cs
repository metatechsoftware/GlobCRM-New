using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for WebhookSubscription.
/// Maps to "webhook_subscriptions" table with snake_case columns, JSONB event subscriptions,
/// and composite index on (tenant_id, is_active, is_disabled) for subscription matching queries.
/// </summary>
public class WebhookSubscriptionConfiguration : IEntityTypeConfiguration<WebhookSubscription>
{
    public void Configure(EntityTypeBuilder<WebhookSubscription> builder)
    {
        builder.ToTable("webhook_subscriptions");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id");

        builder.Property(s => s.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(s => s.Url)
            .HasColumnName("url")
            .HasMaxLength(2048)
            .IsRequired();

        builder.Property(s => s.Secret)
            .HasColumnName("secret")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(s => s.EventSubscriptions)
            .HasColumnName("event_subscriptions")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'[]'::jsonb");

        builder.Property(s => s.IncludeCustomFields)
            .HasColumnName("include_custom_fields")
            .HasDefaultValue(false);

        builder.Property(s => s.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(s => s.IsDisabled)
            .HasColumnName("is_disabled")
            .HasDefaultValue(false);

        builder.Property(s => s.ConsecutiveFailureCount)
            .HasColumnName("consecutive_failure_count")
            .HasDefaultValue(0);

        builder.Property(s => s.LastDeliveryAt)
            .HasColumnName("last_delivery_at");

        builder.Property(s => s.DisabledAt)
            .HasColumnName("disabled_at");

        builder.Property(s => s.DisabledReason)
            .HasColumnName("disabled_reason")
            .HasMaxLength(500);

        builder.Property(s => s.CreatedByUserId)
            .HasColumnName("created_by_user_id")
            .IsRequired();

        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(s => new { s.TenantId, s.IsActive, s.IsDisabled })
            .HasDatabaseName("idx_webhook_subscriptions_tenant_active");

        builder.HasIndex(s => s.TenantId)
            .HasDatabaseName("idx_webhook_subscriptions_tenant");
    }
}
