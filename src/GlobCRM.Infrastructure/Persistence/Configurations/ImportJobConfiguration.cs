using System.Text.Json;
using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ImportJob.
/// Maps to "import_jobs" table with snake_case columns, JSONB field mappings,
/// tenant/user indexes, and cascade delete to ImportJobErrors.
/// </summary>
public class ImportJobConfiguration : IEntityTypeConfiguration<ImportJob>
{
    public void Configure(EntityTypeBuilder<ImportJob> builder)
    {
        builder.ToTable("import_jobs");

        builder.HasKey(j => j.Id);

        builder.Property(j => j.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(j => j.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(j => j.UserId)
            .HasColumnName("user_id");

        builder.Property(j => j.EntityType)
            .HasColumnName("entity_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(j => j.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(j => j.OriginalFileName)
            .HasColumnName("original_file_name")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(j => j.StoredFilePath)
            .HasColumnName("stored_file_path")
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(j => j.TotalRows)
            .HasColumnName("total_rows")
            .IsRequired();

        builder.Property(j => j.ProcessedRows)
            .HasColumnName("processed_rows")
            .IsRequired();

        builder.Property(j => j.SuccessCount)
            .HasColumnName("success_count")
            .IsRequired();

        builder.Property(j => j.ErrorCount)
            .HasColumnName("error_count")
            .IsRequired();

        builder.Property(j => j.DuplicateCount)
            .HasColumnName("duplicate_count")
            .IsRequired();

        // JSONB column for field mappings array
        builder.Property(j => j.Mappings)
            .HasColumnName("mappings")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'[]'::jsonb")
            .HasConversion(
                v => JsonSerializer.Serialize(v, JsonSerializerOptions.Default),
                v => JsonSerializer.Deserialize<List<ImportFieldMapping>>(v, JsonSerializerOptions.Default) ?? new());

        builder.Property(j => j.DuplicateStrategy)
            .HasColumnName("duplicate_strategy")
            .HasMaxLength(20)
            .HasDefaultValue("skip")
            .IsRequired();

        builder.Property(j => j.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(j => j.StartedAt)
            .HasColumnName("started_at");

        builder.Property(j => j.CompletedAt)
            .HasColumnName("completed_at");

        // Relationships
        builder.HasOne(j => j.User)
            .WithMany()
            .HasForeignKey(j => j.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(j => j.Errors)
            .WithOne(e => e.ImportJob)
            .HasForeignKey(e => e.ImportJobId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(j => j.TenantId)
            .HasDatabaseName("idx_import_jobs_tenant");

        builder.HasIndex(j => new { j.TenantId, j.UserId })
            .HasDatabaseName("idx_import_jobs_tenant_user");

        builder.HasIndex(j => j.Status)
            .HasDatabaseName("idx_import_jobs_status");
    }
}
