using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for PipelineStage.
/// Maps to "pipeline_stages" table with snake_case columns,
/// JSONB required fields, and composite index on (pipeline_id, sort_order).
/// </summary>
public class PipelineStageConfiguration : IEntityTypeConfiguration<PipelineStage>
{
    public void Configure(EntityTypeBuilder<PipelineStage> builder)
    {
        builder.ToTable("pipeline_stages");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id");

        builder.Property(s => s.PipelineId)
            .HasColumnName("pipeline_id")
            .IsRequired();

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(s => s.SortOrder)
            .HasColumnName("sort_order");

        builder.Property(s => s.Color)
            .HasColumnName("color")
            .HasMaxLength(7)
            .HasDefaultValue("#1976d2");

        builder.Property(s => s.DefaultProbability)
            .HasColumnName("default_probability")
            .HasPrecision(3, 2);

        builder.Property(s => s.IsWon)
            .HasColumnName("is_won")
            .HasDefaultValue(false);

        builder.Property(s => s.IsLost)
            .HasColumnName("is_lost")
            .HasDefaultValue(false);

        builder.Property(s => s.RequiredFields)
            .HasColumnName("required_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(s => new { s.PipelineId, s.SortOrder })
            .HasDatabaseName("idx_pipeline_stages_pipeline_sort");
    }
}
