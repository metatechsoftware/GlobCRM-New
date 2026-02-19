using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for SequenceTrackingEvent.
/// Maps to "sequence_tracking_events" table with snake_case columns,
/// FK to SequenceEnrollment (Cascade delete), and indexes for analytics queries.
/// </summary>
public class SequenceTrackingEventConfiguration : IEntityTypeConfiguration<SequenceTrackingEvent>
{
    public void Configure(EntityTypeBuilder<SequenceTrackingEvent> builder)
    {
        builder.ToTable("sequence_tracking_events");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id");

        builder.Property(e => e.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(e => e.EnrollmentId)
            .HasColumnName("enrollment_id")
            .IsRequired();

        builder.Property(e => e.StepNumber)
            .HasColumnName("step_number")
            .IsRequired();

        builder.Property(e => e.EventType)
            .HasColumnName("event_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Url)
            .HasColumnName("url")
            .HasMaxLength(2000);

        builder.Property(e => e.GmailMessageId)
            .HasColumnName("gmail_message_id")
            .HasMaxLength(200);

        builder.Property(e => e.GmailThreadId)
            .HasColumnName("gmail_thread_id")
            .HasMaxLength(200);

        builder.Property(e => e.UserAgent)
            .HasColumnName("user_agent")
            .HasMaxLength(500);

        builder.Property(e => e.IpAddress)
            .HasColumnName("ip_address")
            .HasMaxLength(50);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Relationships
        builder.HasOne(e => e.Enrollment)
            .WithMany()
            .HasForeignKey(e => e.EnrollmentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(e => e.EnrollmentId)
            .HasDatabaseName("idx_sequence_tracking_events_enrollment_id");

        builder.HasIndex(e => e.EventType)
            .HasDatabaseName("idx_sequence_tracking_events_event_type");
    }
}
