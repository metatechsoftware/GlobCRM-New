using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for WorkflowExecutionLog.
/// Maps to "workflow_execution_logs" table with snake_case columns.
/// FK to Workflow with Cascade delete. Index on (WorkflowId, StartedAt desc).
/// </summary>
public class WorkflowExecutionLogConfiguration : IEntityTypeConfiguration<WorkflowExecutionLog>
{
    public void Configure(EntityTypeBuilder<WorkflowExecutionLog> builder)
    {
        builder.ToTable("workflow_execution_logs");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnName("id");

        builder.Property(l => l.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(l => l.WorkflowId)
            .HasColumnName("workflow_id")
            .IsRequired();

        builder.Property(l => l.TriggerType)
            .HasColumnName("trigger_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.TriggerEvent)
            .HasColumnName("trigger_event")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(l => l.EntityId)
            .HasColumnName("entity_id")
            .IsRequired();

        builder.Property(l => l.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.ConditionsEvaluated)
            .HasColumnName("conditions_evaluated");

        builder.Property(l => l.ConditionsPassed)
            .HasColumnName("conditions_passed");

        builder.Property(l => l.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>();

        builder.Property(l => l.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(2000);

        builder.Property(l => l.StartedAt)
            .HasColumnName("started_at")
            .IsRequired();

        builder.Property(l => l.CompletedAt)
            .HasColumnName("completed_at")
            .IsRequired();

        builder.Property(l => l.DurationMs)
            .HasColumnName("duration_ms");

        builder.Property(l => l.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Navigation: action logs
        builder.HasMany(l => l.ActionLogs)
            .WithOne(a => a.ExecutionLog)
            .HasForeignKey(a => a.ExecutionLogId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(l => new { l.WorkflowId, l.StartedAt })
            .IsDescending(false, true)
            .HasDatabaseName("ix_workflow_execution_logs_workflow_started");

        builder.HasIndex(l => l.TenantId)
            .HasDatabaseName("ix_workflow_execution_logs_tenant");
    }
}
