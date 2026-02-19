using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NCalc;

namespace GlobCRM.Infrastructure.FormulaFields;

/// <summary>
/// Comprehensive formula validation service.
/// Validates formula syntax (via NCalc parser), field references (against registry),
/// and circular dependencies (via topological sort of the full dependency graph).
/// Also provides preview evaluation using sample or real entity data.
/// </summary>
public class FormulaValidationService
{
    private readonly ICustomFieldRepository _fieldRepo;
    private readonly FieldRegistryService _fieldRegistry;
    private readonly ApplicationDbContext _db;
    private readonly FormulaEvaluationService _evaluationService;
    private readonly ILogger<FormulaValidationService> _logger;

    public FormulaValidationService(
        ICustomFieldRepository fieldRepo,
        FieldRegistryService fieldRegistry,
        ApplicationDbContext db,
        FormulaEvaluationService evaluationService,
        ILogger<FormulaValidationService> logger)
    {
        _fieldRepo = fieldRepo;
        _fieldRegistry = fieldRegistry;
        _db = db;
        _evaluationService = evaluationService;
        _logger = logger;
    }

    /// <summary>
    /// Validates a formula expression for an entity type.
    /// Checks syntax, field references, and circular dependencies.
    /// </summary>
    /// <param name="entityType">Entity type (e.g., "Deal").</param>
    /// <param name="expression">The formula expression to validate.</param>
    /// <param name="excludeFieldId">When editing an existing field, exclude it from dep graph.</param>
    /// <param name="fieldName">Name of the field being created/edited (for dep graph).</param>
    /// <returns>List of error messages. Empty list means valid.</returns>
    public async Task<List<string>> ValidateAsync(
        string entityType,
        string expression,
        Guid? excludeFieldId = null,
        string? fieldName = null)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(expression))
        {
            errors.Add("Formula expression cannot be empty.");
            return errors;
        }

        // Step 1: Syntax validation
        Expression ncalcExpr;
        try
        {
            ncalcExpr = new Expression(expression);
            if (ncalcExpr.HasErrors())
            {
                errors.Add($"Syntax error: {ncalcExpr.Error}");
                return errors;
            }
        }
        catch (Exception ex)
        {
            errors.Add($"Syntax error: {ex.Message}");
            return errors;
        }

        // Step 2: Field reference validation
        List<string> paramNames;
        try
        {
            paramNames = ncalcExpr.GetParameterNames().ToList();
        }
        catch
        {
            // If GetParameterNames fails, the syntax check above should have caught it
            paramNames = new List<string>();
        }

        if (paramNames.Count > 0)
        {
            var allFields = await _fieldRepo.GetFieldsByEntityTypeAsync(entityType);
            var availableFields = _fieldRegistry.GetAvailableFields(entityType, allFields);
            var availableNames = availableFields.Select(f => f.Name).ToHashSet();

            foreach (var param in paramNames)
            {
                if (!availableNames.Contains(param))
                {
                    errors.Add($"Unknown field reference: [{param}]");
                }
            }
        }

        // Step 3: Circular dependency check
        if (errors.Count == 0 && fieldName != null)
        {
            var circularErrors = await CheckCircularDependenciesAsync(
                entityType, expression, fieldName, excludeFieldId, paramNames);
            errors.AddRange(circularErrors);
        }

        return errors;
    }

    /// <summary>
    /// Previews a formula's result using either real entity data or sample placeholder values.
    /// </summary>
    /// <param name="entityType">Entity type (e.g., "Deal").</param>
    /// <param name="expression">The formula expression to preview.</param>
    /// <param name="sampleEntityId">Optional real entity ID for preview with actual data.</param>
    /// <returns>Tuple of (result value, error message). One will be null.</returns>
    public async Task<(object? Value, string? Error)> PreviewAsync(
        string entityType,
        string expression,
        Guid? sampleEntityId = null)
    {
        try
        {
            Dictionary<string, object?> parameters;

            if (sampleEntityId.HasValue)
            {
                // Load real entity data
                parameters = await LoadEntityParametersAsync(entityType, sampleEntityId.Value);
                if (parameters.Count == 0)
                {
                    return (null, "Entity not found for preview.");
                }
            }
            else
            {
                // Use placeholder values
                var allFields = await _fieldRepo.GetFieldsByEntityTypeAsync(entityType);
                parameters = _fieldRegistry.GetPlaceholderValues(entityType, allFields);
            }

            var result = _evaluationService.EvaluateSingleExpression(expression, parameters);

            // Check for formula error
            if (result is Dictionary<string, object?> errorDict
                && errorDict.ContainsKey("__formulaError"))
            {
                return (null, errorDict["message"]?.ToString() ?? "Evaluation error");
            }

            return (result, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Formula preview failed: {Expression}", expression);
            return (null, ex.Message);
        }
    }

    /// <summary>
    /// Checks for circular dependencies by building the full formula dependency graph
    /// including the new/edited formula, then attempting topological sort.
    /// </summary>
    private async Task<List<string>> CheckCircularDependenciesAsync(
        string entityType,
        string expression,
        string fieldName,
        Guid? excludeFieldId,
        List<string> paramNames)
    {
        var errors = new List<string>();

        var allFields = await _fieldRepo.GetFieldsByEntityTypeAsync(entityType);
        var existingFormulas = allFields
            .Where(f => f.FieldType == CustomFieldType.Formula)
            .ToList();

        // Remove the field being edited (if updating)
        if (excludeFieldId.HasValue)
        {
            existingFormulas.RemoveAll(f => f.Id == excludeFieldId.Value);
        }

        // Add the current formula as a temporary entry
        var currentFormula = new CustomFieldDefinition
        {
            Id = excludeFieldId ?? Guid.NewGuid(),
            Name = fieldName,
            FieldType = CustomFieldType.Formula,
            FormulaExpression = expression,
            DependsOnFieldIds = paramNames
                .Where(p => existingFormulas.Any(f => f.Name == p))
                .ToList()
        };

        var allFormulas = new List<CustomFieldDefinition>(existingFormulas) { currentFormula };

        try
        {
            FormulaEvaluationService.TopologicalSort(allFormulas);
        }
        catch (InvalidOperationException)
        {
            errors.Add("Circular reference detected in formula dependencies.");
        }

        return errors;
    }

    /// <summary>
    /// Loads an actual entity from the database and extracts its system and custom field values
    /// as a parameter dictionary for preview evaluation.
    /// </summary>
    private async Task<Dictionary<string, object?>> LoadEntityParametersAsync(
        string entityType, Guid entityId)
    {
        object? entity = entityType switch
        {
            "Deal" => await _db.Deals.Include(d => d.Stage).FirstOrDefaultAsync(d => d.Id == entityId),
            "Contact" => await _db.Contacts.FirstOrDefaultAsync(c => c.Id == entityId),
            "Company" => await _db.Companies.FirstOrDefaultAsync(c => c.Id == entityId),
            "Lead" => await _db.Leads.FirstOrDefaultAsync(l => l.Id == entityId),
            "Activity" => await _db.Activities.FirstOrDefaultAsync(a => a.Id == entityId),
            "Quote" => await _db.Quotes.FirstOrDefaultAsync(q => q.Id == entityId),
            "Request" => await _db.Requests.FirstOrDefaultAsync(r => r.Id == entityId),
            "Product" => await _db.Products.FirstOrDefaultAsync(p => p.Id == entityId),
            _ => null
        };

        if (entity == null) return new Dictionary<string, object?>();

        // Extract system field values
        var systemValues = _fieldRegistry.ExtractEntityValues(entityType, entity);

        // Extract custom field values
        var customFields = entity switch
        {
            Deal d => d.CustomFields,
            Contact c => c.CustomFields,
            Company co => co.CustomFields,
            Lead l => l.CustomFields,
            Activity a => a.CustomFields,
            Quote q => q.CustomFields,
            Request r => r.CustomFields,
            Product p => p.CustomFields,
            _ => new Dictionary<string, object?>()
        };

        foreach (var (key, value) in customFields)
        {
            systemValues[key] = FormulaEvaluationService.ConvertJsonValue(value, null);
        }

        return systemValues;
    }
}
