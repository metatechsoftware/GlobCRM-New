using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Workflow.
/// Maps to "workflows" table with snake_case columns, JSONB definition,
/// JSONB trigger summary, and composite index for fast trigger matching.
/// </summary>
public class WorkflowConfiguration : IEntityTypeConfiguration<Workflow>
{
    public void Configure(EntityTypeBuilder<Workflow> builder)
    {
        builder.ToTable("workflows");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Id)
            .HasColumnName("id");

        builder.Property(w => w.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(w => w.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(w => w.Description)
            .HasColumnName("description")
            .HasMaxLength(1000);

        builder.Property(w => w.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();

        // JSONB definition column — stores full WorkflowDefinition as owned JSON
        builder.OwnsOne(w => w.Definition, d =>
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

        builder.Property(w => w.TriggerSummary)
            .HasColumnName("trigger_summary")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'[]'::jsonb");

        builder.Property(w => w.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .HasConversion<string>();

        builder.Property(w => w.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(false);

        builder.Property(w => w.CreatedByUserId)
            .HasColumnName("created_by_user_id")
            .IsRequired();

        builder.Property(w => w.ExecutionCount)
            .HasColumnName("execution_count")
            .HasDefaultValue(0);

        builder.Property(w => w.LastExecutedAt)
            .HasColumnName("last_executed_at");

        builder.Property(w => w.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(w => w.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(w => w.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Navigation: execution logs
        builder.HasMany(w => w.ExecutionLogs)
            .WithOne(l => l.Workflow)
            .HasForeignKey(l => l.WorkflowId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(w => new { w.TenantId, w.IsActive, w.EntityType })
            .HasDatabaseName("ix_workflows_tenant_active_entity");

        builder.HasIndex(w => w.TenantId)
            .HasDatabaseName("ix_workflows_tenant");
    }
}
