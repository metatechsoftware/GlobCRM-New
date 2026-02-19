using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for workflow template gallery management: browse system and custom
/// templates, apply templates to create new workflows, and save workflows as reusable
/// templates. Co-located DTOs and request records.
/// Route: /api/workflow-templates
/// </summary>
[ApiController]
[Route("api/workflow-templates")]
[Authorize]
public class WorkflowTemplatesController : ControllerBase
{
    private readonly IWorkflowRepository _workflowRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<WorkflowTemplatesController> _logger;

    public WorkflowTemplatesController(
        IWorkflowRepository workflowRepository,
        ITenantProvider tenantProvider,
        ILogger<WorkflowTemplatesController> logger)
    {
        _workflowRepository = workflowRepository;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    /// <summary>
    /// 1. List templates for gallery. System templates first, then custom by name.
    /// Both system and tenant-scoped custom templates shown (custom with "Custom" badge per locked decision).
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Workflow:View")]
    [ProducesResponseType(typeof(List<WorkflowTemplateListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] string? category = null,
        [FromQuery] string? entityType = null)
    {
        var templates = await _workflowRepository.GetTemplatesAsync(category);

        // Filter by entity type if specified
        if (!string.IsNullOrWhiteSpace(entityType))
            templates = templates.Where(t => t.EntityType.Equals(entityType, StringComparison.OrdinalIgnoreCase)).ToList();

        // Sort: system first, then by name
        var sorted = templates
            .OrderByDescending(t => t.IsSystem)
            .ThenBy(t => t.Name)
            .Select(WorkflowTemplateListDto.FromEntity)
            .ToList();

        return Ok(sorted);
    }

    /// <summary>
    /// 2. Get template with full definition.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Workflow:View")]
    [ProducesResponseType(typeof(WorkflowTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var template = await _workflowRepository.GetTemplateByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Workflow template not found." });

        return Ok(WorkflowTemplateDto.FromEntity(template));
    }

    /// <summary>
    /// 3. Save a workflow as a template (WFLOW-13).
    /// Creates a tenant-scoped custom template from an existing workflow's definition.
    /// </summary>
    [HttpPost("from-workflow/{workflowId:guid}")]
    [Authorize(Policy = "Permission:Workflow:Create")]
    [ProducesResponseType(typeof(WorkflowTemplateDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SaveAsTemplate(Guid workflowId, [FromBody] SaveAsTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Template name is required." });

        if (request.Name.Length > 200)
            return BadRequest(new { error = "Template name must be 200 characters or fewer." });

        var workflow = await _workflowRepository.GetByIdAsync(workflowId);
        if (workflow is null)
            return NotFound(new { error = "Workflow not found." });

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();

        // Validate category
        var validCategories = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "sales", "engagement", "operational", "custom"
        };

        var category = !string.IsNullOrWhiteSpace(request.Category) && validCategories.Contains(request.Category)
            ? request.Category.ToLowerInvariant()
            : "custom";

        var template = new WorkflowTemplate
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            Category = category,
            EntityType = workflow.EntityType,
            Definition = CloneDefinition(workflow.Definition),
            IsSystem = false,
            CreatedByUserId = userId
        };

        var created = await _workflowRepository.CreateTemplateAsync(template);

        _logger.LogInformation(
            "Workflow {WorkflowId} saved as template {TemplateId} ({TemplateName})",
            workflowId, created.Id, created.Name);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            WorkflowTemplateDto.FromEntity(created));
    }

    /// <summary>
    /// 4. Apply template to create a new workflow (WFLOW-13).
    /// Creates a full copy of the template's definition as a new Draft workflow.
    /// No link to original per locked decision.
    /// </summary>
    [HttpPost("{id:guid}/apply")]
    [Authorize(Policy = "Permission:Workflow:Create")]
    [ProducesResponseType(typeof(WorkflowDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Apply(Guid id)
    {
        var template = await _workflowRepository.GetTemplateByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Workflow template not found." });

        var tenantId = GetTenantId();
        var userId = GetCurrentUserId();

        // Compute trigger summary from the template's definition
        var triggerSummary = template.Definition.Triggers.Select(t => t.TriggerType switch
        {
            WorkflowTriggerType.RecordCreated => "RecordCreated",
            WorkflowTriggerType.RecordUpdated => "RecordUpdated",
            WorkflowTriggerType.RecordDeleted => "RecordDeleted",
            WorkflowTriggerType.FieldChanged => string.IsNullOrWhiteSpace(t.FieldName)
                ? "FieldChanged"
                : $"FieldChanged:{t.FieldName}",
            WorkflowTriggerType.DateBased => string.IsNullOrWhiteSpace(t.FieldName)
                ? "DateBased"
                : $"DateBased:{t.FieldName}",
            _ => t.TriggerType.ToString()
        }).ToList();

        var workflow = new Workflow
        {
            TenantId = tenantId,
            Name = template.Name,
            Description = template.Description,
            EntityType = template.EntityType,
            Definition = CloneDefinition(template.Definition),
            TriggerSummary = triggerSummary,
            Status = WorkflowStatus.Draft,
            IsActive = false,
            CreatedByUserId = userId
        };

        var created = await _workflowRepository.CreateAsync(workflow);

        _logger.LogInformation(
            "Template {TemplateId} applied to create workflow {WorkflowId} ({WorkflowName})",
            id, created.Id, created.Name);

        return CreatedAtAction(
            "GetById",
            "Workflows",
            new { id = created.Id },
            WorkflowDto.FromEntity(created));
    }

    /// <summary>
    /// 5. Delete custom template. System templates cannot be deleted (403).
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Workflow:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var template = await _workflowRepository.GetTemplateByIdAsync(id);
        if (template is null)
            return NotFound(new { error = "Workflow template not found." });

        if (template.IsSystem)
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = "System templates cannot be deleted." });

        await _workflowRepository.DeleteTemplateAsync(id);

        _logger.LogInformation("Workflow template deleted: {TemplateId} ({TemplateName})", id, template.Name);

        return NoContent();
    }

    // ---- Private Helpers ----

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID not found in claims.");
        return Guid.Parse(userIdClaim);
    }

    private Guid GetTenantId()
    {
        return _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");
    }

    /// <summary>
    /// Deep clones a WorkflowDefinition by creating new instances of all nested objects.
    /// </summary>
    private static WorkflowDefinition CloneDefinition(WorkflowDefinition source)
    {
        return new WorkflowDefinition
        {
            Nodes = source.Nodes.Select(n => new WorkflowNode
            {
                Id = n.Id,
                Type = n.Type,
                Label = n.Label,
                Position = new WorkflowNodePosition { X = n.Position.X, Y = n.Position.Y },
                Config = n.Config
            }).ToList(),
            Connections = source.Connections.Select(c => new WorkflowConnection
            {
                Id = c.Id,
                SourceNodeId = c.SourceNodeId,
                TargetNodeId = c.TargetNodeId,
                SourceOutput = c.SourceOutput
            }).ToList(),
            Triggers = source.Triggers.Select(t => new WorkflowTriggerConfig
            {
                Id = t.Id,
                NodeId = t.NodeId,
                TriggerType = t.TriggerType,
                EventType = t.EventType,
                FieldName = t.FieldName,
                DateOffsetDays = t.DateOffsetDays,
                PreferredTime = t.PreferredTime
            }).ToList(),
            Conditions = source.Conditions.Select(cg => new WorkflowConditionGroup
            {
                Id = cg.Id,
                NodeId = cg.NodeId,
                Conditions = cg.Conditions.Select(c => new WorkflowCondition
                {
                    Field = c.Field,
                    Operator = c.Operator,
                    Value = c.Value,
                    FromValue = c.FromValue
                }).ToList()
            }).ToList(),
            Actions = source.Actions.Select(a => new WorkflowActionConfig
            {
                Id = a.Id,
                NodeId = a.NodeId,
                ActionType = a.ActionType,
                ContinueOnError = a.ContinueOnError,
                Order = a.Order,
                Config = a.Config
            }).ToList()
        };
    }
}

// ---- DTOs ----

/// <summary>
/// Full workflow template DTO with complete definition.
/// </summary>
public record WorkflowTemplateDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Category { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public bool IsSystem { get; init; }
    public WorkflowDefinitionDto Definition { get; init; } = new();
    public Guid? CreatedByUserId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static WorkflowTemplateDto FromEntity(WorkflowTemplate t) => new()
    {
        Id = t.Id,
        Name = t.Name,
        Description = t.Description,
        Category = t.Category,
        EntityType = t.EntityType,
        IsSystem = t.IsSystem,
        Definition = WorkflowDefinitionDto.FromEntity(t.Definition),
        CreatedByUserId = t.CreatedByUserId,
        CreatedAt = t.CreatedAt
    };
}

/// <summary>
/// Lightweight template DTO for gallery view — no full definition.
/// </summary>
public record WorkflowTemplateListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string Category { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public bool IsSystem { get; init; }
    public int NodeCount { get; init; }

    public static WorkflowTemplateListDto FromEntity(WorkflowTemplate t) => new()
    {
        Id = t.Id,
        Name = t.Name,
        Description = t.Description,
        Category = t.Category,
        EntityType = t.EntityType,
        IsSystem = t.IsSystem,
        NodeCount = t.Definition.Nodes.Count
    };
}

// ---- Request Records ----

public record SaveAsTemplateRequest(string Name, string? Description, string Category);
