using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for workflow automation CRUD, execution log queries,
/// and template management. Implementations use ApplicationDbContext with
/// tenant-scoped global query filters.
/// </summary>
public interface IWorkflowRepository
{
    // ── Workflow CRUD ────────────────────────────────────────────

    /// <summary>
    /// Gets a workflow by ID (definition is JSONB, loaded automatically).
    /// </summary>
    Task<Workflow?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Gets a workflow by ID with execution logs and their action logs included.
    /// </summary>
    Task<Workflow?> GetByIdWithLogsAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Gets a paginated list of workflows, optionally filtered by entity type and status.
    /// </summary>
    Task<(List<Workflow> Items, int TotalCount)> GetAllAsync(
        string? entityType, WorkflowStatus? status, int page, int pageSize, CancellationToken ct = default);

    /// <summary>
    /// Gets active workflows for trigger matching: IsActive == true AND Status == Active,
    /// filtered by the specified entity type.
    /// </summary>
    Task<List<Workflow>> GetActiveWorkflowsAsync(string entityType, CancellationToken ct = default);

    /// <summary>
    /// Gets all active workflows with date-based triggers (cross-entity-type).
    /// Used by the date trigger scan job.
    /// </summary>
    Task<List<Workflow>> GetActiveWorkflowsWithDateTriggersAsync(CancellationToken ct = default);

    /// <summary>
    /// Creates a new workflow.
    /// </summary>
    Task<Workflow> CreateAsync(Workflow workflow, CancellationToken ct = default);

    /// <summary>
    /// Updates an existing workflow.
    /// </summary>
    Task UpdateAsync(Workflow workflow, CancellationToken ct = default);

    /// <summary>
    /// Deletes a workflow by ID. Cascade deletes execution logs and action logs.
    /// </summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    // ── Execution Logs ──────────────────────────────────────────

    /// <summary>
    /// Gets paginated execution logs for a specific workflow, ordered by StartedAt descending.
    /// </summary>
    Task<(List<WorkflowExecutionLog> Items, int TotalCount)> GetExecutionLogsAsync(
        Guid workflowId, int page, int pageSize, CancellationToken ct = default);

    /// <summary>
    /// Gets a single execution log with its action logs.
    /// </summary>
    Task<WorkflowExecutionLog?> GetExecutionLogDetailAsync(Guid logId, CancellationToken ct = default);

    // ── Templates ───────────────────────────────────────────────

    /// <summary>
    /// Gets workflow templates, optionally filtered by category.
    /// System templates are listed first, then alphabetically by name.
    /// </summary>
    Task<List<WorkflowTemplate>> GetTemplatesAsync(string? category, CancellationToken ct = default);

    /// <summary>
    /// Gets a single template by ID.
    /// </summary>
    Task<WorkflowTemplate?> GetTemplateByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Creates a new workflow template.
    /// </summary>
    Task<WorkflowTemplate> CreateTemplateAsync(WorkflowTemplate template, CancellationToken ct = default);

    /// <summary>
    /// Deletes a template by ID.
    /// </summary>
    Task DeleteTemplateAsync(Guid id, CancellationToken ct = default);
}
