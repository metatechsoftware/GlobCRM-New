using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for EmailTemplate.
/// Maps to "email_templates" table with snake_case columns, JSONB design column,
/// FKs to email_template_categories and users, and full-text search vector.
/// </summary>
public class EmailTemplateConfiguration : IEntityTypeConfiguration<EmailTemplate>
{
    public void Configure(EntityTypeBuilder<EmailTemplate> builder)
    {
        builder.ToTable("email_templates");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnName("id");

        builder.Property(t => t.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(t => t.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(t => t.Subject)
            .HasColumnName("subject")
            .HasMaxLength(500);

        builder.Property(t => t.DesignJson)
            .HasColumnName("design_json")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(t => t.HtmlBody)
            .HasColumnName("html_body")
            .HasColumnType("text")
            .HasDefaultValue(string.Empty);

        builder.Property(t => t.CategoryId)
            .HasColumnName("category_id");

        builder.Property(t => t.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(t => t.IsShared)
            .HasColumnName("is_shared")
            .HasDefaultValue(true);

        builder.Property(t => t.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(t => t.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(t => t.Category)
            .WithMany(c => c.Templates)
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Owner)
            .WithMany()
            .HasForeignKey(t => t.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(t => t.TenantId)
            .HasDatabaseName("idx_email_templates_tenant_id");

        builder.HasIndex(t => t.CategoryId)
            .HasDatabaseName("idx_email_templates_category_id");

        builder.HasIndex(t => t.OwnerId)
            .HasDatabaseName("idx_email_templates_owner_id");
    }
}
