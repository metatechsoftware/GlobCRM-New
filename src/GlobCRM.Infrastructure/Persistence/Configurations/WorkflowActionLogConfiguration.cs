using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for WorkflowActionLog.
/// Maps to "workflow_action_logs" table with snake_case columns.
/// FK to WorkflowExecutionLog with Cascade delete.
/// No separate tenant query filter needed — inherits via ExecutionLog FK cascade.
/// </summary>
public class WorkflowActionLogConfiguration : IEntityTypeConfiguration<WorkflowActionLog>
{
    public void Configure(EntityTypeBuilder<WorkflowActionLog> builder)
    {
        builder.ToTable("workflow_action_logs");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id");

        builder.Property(a => a.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(a => a.ExecutionLogId)
            .HasColumnName("execution_log_id")
            .IsRequired();

        builder.Property(a => a.ActionType)
            .HasColumnName("action_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(a => a.ActionNodeId)
            .HasColumnName("action_node_id")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.Order)
            .HasColumnName("order");

        builder.Property(a => a.Status)
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(a => a.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(2000);

        builder.Property(a => a.StartedAt)
            .HasColumnName("started_at");

        builder.Property(a => a.CompletedAt)
            .HasColumnName("completed_at");

        builder.Property(a => a.DurationMs)
            .HasColumnName("duration_ms");

        // Indexes
        builder.HasIndex(a => a.ExecutionLogId)
            .HasDatabaseName("ix_workflow_action_logs_execution_log");
    }
}
