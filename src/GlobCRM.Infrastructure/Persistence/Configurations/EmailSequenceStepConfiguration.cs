using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for EmailSequenceStep.
/// Maps to "email_sequence_steps" table with snake_case columns, FK to EmailTemplate (Restrict delete
/// to prevent template deletion while used by active sequence), and unique composite index on
/// (sequence_id, step_number) for ordering integrity.
/// </summary>
public class EmailSequenceStepConfiguration : IEntityTypeConfiguration<EmailSequenceStep>
{
    public void Configure(EntityTypeBuilder<EmailSequenceStep> builder)
    {
        builder.ToTable("email_sequence_steps");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id");

        builder.Property(s => s.SequenceId)
            .HasColumnName("sequence_id")
            .IsRequired();

        builder.Property(s => s.StepNumber)
            .HasColumnName("step_number")
            .IsRequired();

        builder.Property(s => s.EmailTemplateId)
            .HasColumnName("email_template_id")
            .IsRequired();

        builder.Property(s => s.SubjectOverride)
            .HasColumnName("subject_override")
            .HasMaxLength(500);

        builder.Property(s => s.DelayDays)
            .HasColumnName("delay_days")
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(s => s.PreferredSendTime)
            .HasColumnName("preferred_send_time");

        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        // FK to EmailSequence is configured via parent HasMany (cascade delete)
        builder.HasOne(s => s.EmailTemplate)
            .WithMany()
            .HasForeignKey(s => s.EmailTemplateId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes
        builder.HasIndex(s => s.SequenceId)
            .HasDatabaseName("idx_email_sequence_steps_sequence_id");

        builder.HasIndex(s => s.EmailTemplateId)
            .HasDatabaseName("idx_email_sequence_steps_template_id");

        // Unique composite: each step number is unique within a sequence
        builder.HasIndex(s => new { s.SequenceId, s.StepNumber })
            .IsUnique()
            .HasDatabaseName("idx_email_sequence_steps_sequence_step_unique");
    }
}
