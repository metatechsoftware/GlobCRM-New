using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Integration.
/// Maps to "integrations" table with snake_case columns.
/// Unique composite index on (tenant_id, integration_key) ensures one connection per integration per tenant.
/// Status stored as string to match JsonStringEnumConverter convention.
/// </summary>
public class IntegrationConfiguration : IEntityTypeConfiguration<Integration>
{
    public void Configure(EntityTypeBuilder<Integration> builder)
    {
        builder.ToTable("integrations");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnName("id");

        builder.Property(i => i.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(i => i.IntegrationKey)
            .HasColumnName("integration_key")
            .HasColumnType("varchar(50)")
            .IsRequired();

        builder.Property(i => i.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(i => i.EncryptedCredentials)
            .HasColumnName("encrypted_credentials")
            .HasColumnType("text");

        builder.Property(i => i.CredentialMask)
            .HasColumnName("credential_mask")
            .HasColumnType("varchar(50)");

        builder.Property(i => i.ConnectedByUserId)
            .HasColumnName("connected_by_user_id")
            .IsRequired();

        builder.Property(i => i.ConnectedAt)
            .HasColumnName("connected_at")
            .IsRequired();

        builder.Property(i => i.DisconnectedAt)
            .HasColumnName("disconnected_at");

        builder.Property(i => i.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(i => i.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        // Unique: one connection per integration per tenant
        builder.HasIndex(i => new { i.TenantId, i.IntegrationKey })
            .IsUnique()
            .HasDatabaseName("idx_integrations_tenant_key");

        builder.HasIndex(i => i.TenantId)
            .HasDatabaseName("idx_integrations_tenant");
    }
}
