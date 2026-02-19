using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for CustomFieldDefinition.
/// Maps JSONB columns for validation rules and dropdown options.
/// Includes soft-delete filtered unique constraint and tenant-entity index.
/// </summary>
public class CustomFieldDefinitionConfiguration : IEntityTypeConfiguration<CustomFieldDefinition>
{
    public void Configure(EntityTypeBuilder<CustomFieldDefinition> builder)
    {
        builder.ToTable("custom_field_definitions");

        builder.HasKey(f => f.Id);

        builder.Property(f => f.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(f => f.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(f => f.EntityType)
            .HasColumnName("entity_type")
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(f => f.Name)
            .HasColumnName("name")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(f => f.Label)
            .HasColumnName("label")
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(f => f.FieldType)
            .HasColumnName("field_type")
            .IsRequired()
            .HasColumnType("smallint");

        builder.Property(f => f.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.Property(f => f.SectionId)
            .HasColumnName("section_id");

        // JSONB column for validation rules
        builder.Property(f => f.Validation)
            .HasColumnName("validation")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        // JSONB column for dropdown/multi-select options (nullable)
        builder.Property(f => f.Options)
            .HasColumnName("options")
            .HasColumnType("jsonb");

        builder.Property(f => f.RelationEntityType)
            .HasColumnName("relation_entity_type")
            .HasMaxLength(50);

        // Formula field properties
        builder.Property(f => f.FormulaExpression)
            .HasColumnName("formula_expression")
            .HasMaxLength(2000);

        builder.Property(f => f.FormulaResultType)
            .HasColumnName("formula_result_type")
            .HasMaxLength(20);

        builder.Property(f => f.DependsOnFieldIds)
            .HasColumnName("depends_on_field_ids")
            .HasColumnType("jsonb");

        builder.Property(f => f.ShowInPreview)
            .HasColumnName("show_in_preview")
            .HasDefaultValue(false);

        builder.Property(f => f.IsDeleted)
            .HasColumnName("is_deleted")
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(f => f.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(f => f.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        builder.Property(f => f.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        // Unique constraint: (tenant_id, entity_type, name) only for non-deleted fields
        builder.HasIndex(f => new { f.TenantId, f.EntityType, f.Name })
            .IsUnique()
            .HasDatabaseName("idx_custom_field_definitions_tenant_entity_name")
            .HasFilter("NOT is_deleted");

        // Composite index for tenant + entity type queries (excluding deleted)
        builder.HasIndex(f => new { f.TenantId, f.EntityType })
            .HasDatabaseName("idx_custom_field_definitions_tenant_entity")
            .HasFilter("NOT is_deleted");

        // FK: SectionId to CustomFieldSection with SET NULL on delete
        builder.HasOne(f => f.Section)
            .WithMany(s => s.Fields)
            .HasForeignKey(f => f.SectionId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
