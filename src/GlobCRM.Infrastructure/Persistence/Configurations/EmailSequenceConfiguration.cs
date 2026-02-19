using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for EmailSequence.
/// Maps to "email_sequences" table with snake_case columns, string-converted status enum,
/// FK to ApplicationUser (creator), and cascade-delete for Steps collection.
/// </summary>
public class EmailSequenceConfiguration : IEntityTypeConfiguration<EmailSequence>
{
    public void Configure(EntityTypeBuilder<EmailSequence> builder)
    {
        builder.ToTable("email_sequences");

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

        builder.Property(s => s.Description)
            .HasColumnName("description")
            .HasMaxLength(1000);

        builder.Property(s => s.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(s => s.CreatedByUserId)
            .HasColumnName("created_by_user_id")
            .IsRequired();

        builder.Property(s => s.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(s => s.CreatedByUser)
            .WithMany()
            .HasForeignKey(s => s.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(s => s.Steps)
            .WithOne(step => step.Sequence)
            .HasForeignKey(step => step.SequenceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(s => s.TenantId)
            .HasDatabaseName("idx_email_sequences_tenant_id");

        builder.HasIndex(s => s.CreatedByUserId)
            .HasDatabaseName("idx_email_sequences_created_by");
    }
}
