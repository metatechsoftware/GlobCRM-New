using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for SequenceEnrollment.
/// Maps to "sequence_enrollments" table with snake_case columns, string-converted status enum,
/// FKs to EmailSequence (Restrict), Contact (Restrict), and ApplicationUser (Restrict).
/// </summary>
public class SequenceEnrollmentConfiguration : IEntityTypeConfiguration<SequenceEnrollment>
{
    public void Configure(EntityTypeBuilder<SequenceEnrollment> builder)
    {
        builder.ToTable("sequence_enrollments");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id");

        builder.Property(e => e.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(e => e.SequenceId)
            .HasColumnName("sequence_id")
            .IsRequired();

        builder.Property(e => e.ContactId)
            .HasColumnName("contact_id")
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(e => e.CurrentStepNumber)
            .HasColumnName("current_step_number");

        builder.Property(e => e.StepsSent)
            .HasColumnName("steps_sent");

        builder.Property(e => e.StartFromStep)
            .HasColumnName("start_from_step");

        builder.Property(e => e.LastStepSentAt)
            .HasColumnName("last_step_sent_at");

        builder.Property(e => e.CompletedAt)
            .HasColumnName("completed_at");

        builder.Property(e => e.RepliedAt)
            .HasColumnName("replied_at");

        builder.Property(e => e.ReplyStepNumber)
            .HasColumnName("reply_step_number");

        builder.Property(e => e.PausedAt)
            .HasColumnName("paused_at");

        builder.Property(e => e.BouncedAt)
            .HasColumnName("bounced_at");

        builder.Property(e => e.BounceReason)
            .HasColumnName("bounce_reason")
            .HasMaxLength(500);

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("created_by_user_id")
            .IsRequired();

        builder.Property(e => e.HangfireJobId)
            .HasColumnName("hangfire_job_id")
            .HasMaxLength(100);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(e => e.Sequence)
            .WithMany()
            .HasForeignKey(e => e.SequenceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Contact)
            .WithMany()
            .HasForeignKey(e => e.ContactId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.CreatedByUser)
            .WithMany()
            .HasForeignKey(e => e.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes
        builder.HasIndex(e => e.TenantId)
            .HasDatabaseName("idx_sequence_enrollments_tenant_id");

        builder.HasIndex(e => e.SequenceId)
            .HasDatabaseName("idx_sequence_enrollments_sequence_id");

        builder.HasIndex(e => e.ContactId)
            .HasDatabaseName("idx_sequence_enrollments_contact_id");

        builder.HasIndex(e => e.Status)
            .HasDatabaseName("idx_sequence_enrollments_status");
    }
}
