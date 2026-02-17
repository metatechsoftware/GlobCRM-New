using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ActivityAttachment.
/// Maps to "activity_attachments" table with cascade delete from Activity
/// and SetNull delete from UploadedBy. Max lengths for file metadata fields.
/// </summary>
public class ActivityAttachmentConfiguration : IEntityTypeConfiguration<ActivityAttachment>
{
    public void Configure(EntityTypeBuilder<ActivityAttachment> builder)
    {
        builder.ToTable("activity_attachments");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id");

        builder.Property(a => a.ActivityId)
            .HasColumnName("activity_id")
            .IsRequired();

        builder.Property(a => a.FileName)
            .HasColumnName("file_name")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(a => a.StoragePath)
            .HasColumnName("storage_path")
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(a => a.ContentType)
            .HasColumnName("content_type")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(a => a.FileSizeBytes)
            .HasColumnName("file_size_bytes")
            .IsRequired();

        builder.Property(a => a.UploadedById)
            .HasColumnName("uploaded_by_id");

        builder.Property(a => a.UploadedAt)
            .HasColumnName("uploaded_at")
            .IsRequired();

        // Relationships
        builder.HasOne(a => a.UploadedBy)
            .WithMany()
            .HasForeignKey(a => a.UploadedById)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(a => a.ActivityId)
            .HasDatabaseName("idx_activity_attachments_activity");
    }
}
