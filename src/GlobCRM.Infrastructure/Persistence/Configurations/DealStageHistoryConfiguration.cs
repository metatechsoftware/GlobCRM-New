using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for DealStageHistory.
/// Maps to "deal_stage_histories" table with snake_case columns,
/// cascade delete from Deal, and restrict delete from stages.
/// </summary>
public class DealStageHistoryConfiguration : IEntityTypeConfiguration<DealStageHistory>
{
    public void Configure(EntityTypeBuilder<DealStageHistory> builder)
    {
        builder.ToTable("deal_stage_histories");

        builder.HasKey(h => h.Id);

        builder.Property(h => h.Id)
            .HasColumnName("id");

        builder.Property(h => h.DealId)
            .HasColumnName("deal_id")
            .IsRequired();

        builder.Property(h => h.FromStageId)
            .HasColumnName("from_stage_id")
            .IsRequired();

        builder.Property(h => h.ToStageId)
            .HasColumnName("to_stage_id")
            .IsRequired();

        builder.Property(h => h.ChangedByUserId)
            .HasColumnName("changed_by_user_id");

        builder.Property(h => h.ChangedAt)
            .HasColumnName("changed_at")
            .IsRequired();

        // Relationships
        builder.HasOne(h => h.Deal)
            .WithMany()
            .HasForeignKey(h => h.DealId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(h => h.FromStage)
            .WithMany()
            .HasForeignKey(h => h.FromStageId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(h => h.ToStage)
            .WithMany()
            .HasForeignKey(h => h.ToStageId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(h => h.ChangedByUser)
            .WithMany()
            .HasForeignKey(h => h.ChangedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(h => h.DealId)
            .HasDatabaseName("idx_deal_stage_histories_deal");

        builder.HasIndex(h => h.ChangedAt)
            .HasDatabaseName("idx_deal_stage_histories_changed_at");
    }
}
