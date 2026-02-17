using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for EmailMessage.
/// Maps to "email_messages" table with snake_case columns, JSONB address arrays,
/// Gmail ID deduplication via unique composite index, and proper FK constraints.
/// </summary>
public class EmailMessageConfiguration : IEntityTypeConfiguration<EmailMessage>
{
    public void Configure(EntityTypeBuilder<EmailMessage> builder)
    {
        builder.ToTable("email_messages");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id");

        builder.Property(e => e.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(e => e.EmailAccountId)
            .HasColumnName("email_account_id")
            .IsRequired();

        builder.Property(e => e.GmailMessageId)
            .HasColumnName("gmail_message_id")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.GmailThreadId)
            .HasColumnName("gmail_thread_id")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.Subject)
            .HasColumnName("subject")
            .HasMaxLength(1000);

        builder.Property(e => e.FromAddress)
            .HasColumnName("from_address")
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(e => e.FromName)
            .HasColumnName("from_name")
            .HasMaxLength(500);

        builder.Property(e => e.ToAddresses)
            .HasColumnName("to_addresses")
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(e => e.CcAddresses)
            .HasColumnName("cc_addresses")
            .HasColumnType("jsonb");

        builder.Property(e => e.BccAddresses)
            .HasColumnName("bcc_addresses")
            .HasColumnType("jsonb");

        builder.Property(e => e.BodyPreview)
            .HasColumnName("body_preview")
            .HasMaxLength(500);

        builder.Property(e => e.BodyHtml)
            .HasColumnName("body_html");

        builder.Property(e => e.BodyText)
            .HasColumnName("body_text");

        builder.Property(e => e.HasAttachments)
            .HasColumnName("has_attachments")
            .IsRequired();

        builder.Property(e => e.IsInbound)
            .HasColumnName("is_inbound")
            .IsRequired();

        builder.Property(e => e.IsRead)
            .HasColumnName("is_read")
            .IsRequired();

        builder.Property(e => e.IsStarred)
            .HasColumnName("is_starred")
            .IsRequired();

        builder.Property(e => e.LinkedContactId)
            .HasColumnName("linked_contact_id");

        builder.Property(e => e.LinkedCompanyId)
            .HasColumnName("linked_company_id");

        builder.Property(e => e.SentAt)
            .HasColumnName("sent_at")
            .IsRequired();

        builder.Property(e => e.SyncedAt)
            .HasColumnName("synced_at")
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(e => e.EmailAccount)
            .WithMany()
            .HasForeignKey(e => e.EmailAccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.LinkedContact)
            .WithMany(c => c.EmailMessages)
            .HasForeignKey(e => e.LinkedContactId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.LinkedCompany)
            .WithMany(c => c.EmailMessages)
            .HasForeignKey(e => e.LinkedCompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(e => new { e.TenantId, e.GmailMessageId })
            .IsUnique()
            .HasDatabaseName("idx_email_messages_tenant_gmail_id");

        builder.HasIndex(e => e.GmailThreadId)
            .HasDatabaseName("idx_email_messages_thread");

        builder.HasIndex(e => e.LinkedContactId)
            .HasDatabaseName("idx_email_messages_contact");

        builder.HasIndex(e => e.LinkedCompanyId)
            .HasDatabaseName("idx_email_messages_company");

        builder.HasIndex(e => new { e.TenantId, e.SentAt })
            .IsDescending(false, true)
            .HasDatabaseName("idx_email_messages_sent_at");

        builder.HasIndex(e => e.EmailAccountId)
            .HasDatabaseName("idx_email_messages_account");
    }
}
