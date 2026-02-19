using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// EF Core implementation of IWorkflowRepository.
/// All queries are automatically tenant-scoped via ApplicationDbContext global query filters.
/// </summary>
public class WorkflowRepository : IWorkflowRepository
{
    private readonly ApplicationDbContext _context;

    public WorkflowRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    // ── Workflow CRUD ────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<Workflow?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Workflows
            .FirstOrDefaultAsync(w => w.Id == id, ct);
    }

    /// <inheritdoc />
    public async Task<Workflow?> GetByIdWithLogsAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Workflows
            .Include(w => w.ExecutionLogs.OrderByDescending(l => l.StartedAt).Take(50))
                .ThenInclude(l => l.ActionLogs.OrderBy(a => a.Order))
            .FirstOrDefaultAsync(w => w.Id == id, ct);
    }

    /// <inheritdoc />
    public async Task<(List<Workflow> Items, int TotalCount)> GetAllAsync(
        string? entityType, WorkflowStatus? status, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _context.Workflows.AsQueryable();

        if (!string.IsNullOrEmpty(entityType))
        {
            query = query.Where(w => w.EntityType == entityType);
        }

        if (status.HasValue)
        {
            query = query.Where(w => w.Status == status.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(w => w.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    /// <inheritdoc />
    public async Task<List<Workflow>> GetActiveWorkflowsAsync(string entityType, CancellationToken ct = default)
    {
        return await _context.Workflows
            .Where(w => w.IsActive && w.Status == WorkflowStatus.Active && w.EntityType == entityType)
            .ToListAsync(ct);
    }

    /// <inheritdoc />
    public async Task<List<Workflow>> GetActiveWorkflowsWithDateTriggersAsync(CancellationToken ct = default)
    {
        // Load all active workflows and filter in-memory for date triggers
        // (TriggerSummary is JSONB; filtering for "DateBased:" prefix is more reliable in-memory)
        var activeWorkflows = await _context.Workflows
            .Where(w => w.IsActive && w.Status == WorkflowStatus.Active)
            .ToListAsync(ct);

        return activeWorkflows
            .Where(w => w.TriggerSummary.Any(ts => ts.StartsWith("DateBased:")))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<Workflow> CreateAsync(Workflow workflow, CancellationToken ct = default)
    {
        _context.Workflows.Add(workflow);
        await _context.SaveChangesAsync(ct);
        return workflow;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Workflow workflow, CancellationToken ct = default)
    {
        workflow.UpdatedAt = DateTimeOffset.UtcNow;
        _context.Workflows.Update(workflow);
        await _context.SaveChangesAsync(ct);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var workflow = await _context.Workflows
            .FirstOrDefaultAsync(w => w.Id == id, ct);

        if (workflow is not null)
        {
            _context.Workflows.Remove(workflow);
            await _context.SaveChangesAsync(ct);
        }
    }

    // ── Execution Logs ──────────────────────────────────────────

    /// <inheritdoc />
    public async Task<(List<WorkflowExecutionLog> Items, int TotalCount)> GetExecutionLogsAsync(
        Guid workflowId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = _context.WorkflowExecutionLogs
            .Include(l => l.ActionLogs.OrderBy(a => a.Order))
            .Where(l => l.WorkflowId == workflowId);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(l => l.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    /// <inheritdoc />
    public async Task<WorkflowExecutionLog?> GetExecutionLogDetailAsync(Guid logId, CancellationToken ct = default)
    {
        return await _context.WorkflowExecutionLogs
            .Include(l => l.ActionLogs.OrderBy(a => a.Order))
            .Include(l => l.Workflow)
            .FirstOrDefaultAsync(l => l.Id == logId, ct);
    }

    // ── Templates ───────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<List<WorkflowTemplate>> GetTemplatesAsync(string? category, CancellationToken ct = default)
    {
        var query = _context.WorkflowTemplates.AsQueryable();

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(t => t.Category == category);
        }

        return await query
            .OrderByDescending(t => t.IsSystem)
            .ThenBy(t => t.Name)
            .ToListAsync(ct);
    }

    /// <inheritdoc />
    public async Task<WorkflowTemplate?> GetTemplateByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.WorkflowTemplates
            .FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    /// <inheritdoc />
    public async Task<WorkflowTemplate> CreateTemplateAsync(WorkflowTemplate template, CancellationToken ct = default)
    {
        _context.WorkflowTemplates.Add(template);
        await _context.SaveChangesAsync(ct);
        return template;
    }

    /// <inheritdoc />
    public async Task DeleteTemplateAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _context.WorkflowTemplates
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        if (template is not null)
        {
            _context.WorkflowTemplates.Remove(template);
            await _context.SaveChangesAsync(ct);
        }
    }
}
