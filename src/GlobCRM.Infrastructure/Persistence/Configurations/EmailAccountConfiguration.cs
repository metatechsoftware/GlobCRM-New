using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for EmailAccount.
/// Maps to "email_accounts" table with snake_case columns, string conversion for SyncStatus enum,
/// encrypted token fields, and proper FK constraints. One account per user per tenant enforced by unique index.
/// </summary>
public class EmailAccountConfiguration : IEntityTypeConfiguration<EmailAccount>
{
    public void Configure(EntityTypeBuilder<EmailAccount> builder)
    {
        builder.ToTable("email_accounts");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id");

        builder.Property(e => e.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(e => e.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(e => e.GmailAddress)
            .HasColumnName("gmail_address")
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(e => e.EncryptedAccessToken)
            .HasColumnName("encrypted_access_token")
            .IsRequired();

        builder.Property(e => e.EncryptedRefreshToken)
            .HasColumnName("encrypted_refresh_token")
            .IsRequired();

        builder.Property(e => e.TokenIssuedAt)
            .HasColumnName("token_issued_at")
            .IsRequired();

        builder.Property(e => e.TokenExpiresAt)
            .HasColumnName("token_expires_at")
            .IsRequired();

        builder.Property(e => e.LastHistoryId)
            .HasColumnName("last_history_id")
            .HasColumnType("bigint");

        builder.Property(e => e.LastSyncAt)
            .HasColumnName("last_sync_at");

        builder.Property(e => e.SyncStatus)
            .HasColumnName("sync_status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(2000);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(e => e.TenantId)
            .HasDatabaseName("idx_email_accounts_tenant");

        builder.HasIndex(e => new { e.TenantId, e.UserId })
            .IsUnique()
            .HasDatabaseName("idx_email_accounts_user");

        builder.HasIndex(e => e.SyncStatus)
            .HasDatabaseName("idx_email_accounts_sync_status");
    }
}
