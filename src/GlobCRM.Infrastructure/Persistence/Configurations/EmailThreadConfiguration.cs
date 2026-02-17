using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for EmailThread.
/// Maps to "email_threads" table with snake_case columns, unique composite index on
/// (tenant_id, gmail_thread_id), and proper FK constraints for contact/company auto-linking.
/// </summary>
public class EmailThreadConfiguration : IEntityTypeConfiguration<EmailThread>
{
    public void Configure(EntityTypeBuilder<EmailThread> builder)
    {
        builder.ToTable("email_threads");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id");

        builder.Property(e => e.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(e => e.GmailThreadId)
            .HasColumnName("gmail_thread_id")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.Subject)
            .HasColumnName("subject")
            .HasMaxLength(1000);

        builder.Property(e => e.Snippet)
            .HasColumnName("snippet")
            .HasMaxLength(500);

        builder.Property(e => e.MessageCount)
            .HasColumnName("message_count")
            .HasDefaultValue(0);

        builder.Property(e => e.LastMessageAt)
            .HasColumnName("last_message_at")
            .IsRequired();

        builder.Property(e => e.LinkedContactId)
            .HasColumnName("linked_contact_id");

        builder.Property(e => e.LinkedCompanyId)
            .HasColumnName("linked_company_id");

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(e => e.LinkedContact)
            .WithMany()
            .HasForeignKey(e => e.LinkedContactId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.LinkedCompany)
            .WithMany()
            .HasForeignKey(e => e.LinkedCompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(e => new { e.TenantId, e.GmailThreadId })
            .IsUnique()
            .HasDatabaseName("idx_email_threads_tenant_gmail_id");

        builder.HasIndex(e => e.LinkedContactId)
            .HasDatabaseName("idx_email_threads_contact");

        builder.HasIndex(e => e.LinkedCompanyId)
            .HasDatabaseName("idx_email_threads_company");

        builder.HasIndex(e => new { e.TenantId, e.LastMessageAt })
            .IsDescending(false, true)
            .HasDatabaseName("idx_email_threads_last_message");
    }
}
