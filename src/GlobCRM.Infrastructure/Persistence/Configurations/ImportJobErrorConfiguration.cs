using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ImportJobError.
/// Maps to "import_job_errors" table with snake_case columns.
/// Child entity -- no TenantId (inherits tenant isolation via ImportJob FK).
/// </summary>
public class ImportJobErrorConfiguration : IEntityTypeConfiguration<ImportJobError>
{
    public void Configure(EntityTypeBuilder<ImportJobError> builder)
    {
        builder.ToTable("import_job_errors");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(e => e.ImportJobId)
            .HasColumnName("import_job_id")
            .IsRequired();

        builder.Property(e => e.RowNumber)
            .HasColumnName("row_number")
            .IsRequired();

        builder.Property(e => e.FieldName)
            .HasColumnName("field_name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(e => e.RawValue)
            .HasColumnName("raw_value")
            .HasMaxLength(2000);

        // Indexes
        builder.HasIndex(e => e.ImportJobId)
            .HasDatabaseName("idx_import_job_errors_job");
    }
}
