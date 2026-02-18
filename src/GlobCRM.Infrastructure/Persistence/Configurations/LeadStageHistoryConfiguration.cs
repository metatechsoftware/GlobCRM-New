using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for LeadStageHistory.
/// Maps to "lead_stage_histories" table with snake_case columns,
/// cascade delete from Lead, and restrict delete from stages.
/// </summary>
public class LeadStageHistoryConfiguration : IEntityTypeConfiguration<LeadStageHistory>
{
    public void Configure(EntityTypeBuilder<LeadStageHistory> builder)
    {
        builder.ToTable("lead_stage_histories");

        builder.HasKey(h => h.Id);

        builder.Property(h => h.Id)
            .HasColumnName("id");

        builder.Property(h => h.LeadId)
            .HasColumnName("lead_id")
            .IsRequired();

        builder.Property(h => h.FromStageId)
            .HasColumnName("from_stage_id");

        builder.Property(h => h.ToStageId)
            .HasColumnName("to_stage_id")
            .IsRequired();

        builder.Property(h => h.ChangedByUserId)
            .HasColumnName("changed_by_user_id");

        builder.Property(h => h.ChangedAt)
            .HasColumnName("changed_at")
            .IsRequired();

        builder.Property(h => h.Notes)
            .HasColumnName("notes");

        // Relationships
        builder.HasOne(h => h.Lead)
            .WithMany()
            .HasForeignKey(h => h.LeadId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(h => h.FromStage)
            .WithMany()
            .HasForeignKey(h => h.FromStageId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(h => h.ToStage)
            .WithMany()
            .HasForeignKey(h => h.ToStageId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(h => h.ChangedByUser)
            .WithMany()
            .HasForeignKey(h => h.ChangedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(h => h.LeadId)
            .HasDatabaseName("idx_lead_stage_histories_lead");

        builder.HasIndex(h => h.ChangedAt)
            .HasDatabaseName("idx_lead_stage_histories_changed_at");
    }
}
