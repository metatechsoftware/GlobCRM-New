using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for WorkflowTemplate.
/// Maps to "workflow_templates" table with snake_case columns, JSONB definition,
/// and indexes for gallery filtering and unique template names per tenant.
/// </summary>
public class WorkflowTemplateConfiguration : IEntityTypeConfiguration<WorkflowTemplate>
{
    public void Configure(EntityTypeBuilder<WorkflowTemplate> builder)
    {
        builder.ToTable("workflow_templates");

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

        builder.Property(t => t.Description)
            .HasColumnName("description")
            .HasMaxLength(1000);

        builder.Property(t => t.Category)
            .HasColumnName("category")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(t => t.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();

        // JSONB definition column — stores full WorkflowDefinition as owned JSON
        builder.OwnsOne(t => t.Definition, d =>
        {
            d.ToJson("definition");
            d.OwnsMany(def => def.Nodes, n =>
            {
                n.OwnsOne(node => node.Position);
            });
            d.OwnsMany(def => def.Connections);
            d.OwnsMany(def => def.Triggers);
            d.OwnsMany(def => def.Conditions, cg =>
            {
                cg.OwnsMany(g => g.Conditions);
            });
            d.OwnsMany(def => def.Actions);
        });

        builder.Property(t => t.IsSystem)
            .HasColumnName("is_system")
            .HasDefaultValue(false);

        builder.Property(t => t.CreatedByUserId)
            .HasColumnName("created_by_user_id");

        builder.Property(t => t.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(t => t.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(t => new { t.TenantId, t.Category })
            .HasDatabaseName("ix_workflow_templates_tenant_category");

        builder.HasIndex(t => new { t.TenantId, t.Name })
            .IsUnique()
            .HasDatabaseName("ix_workflow_templates_tenant_name_unique");
    }
}
