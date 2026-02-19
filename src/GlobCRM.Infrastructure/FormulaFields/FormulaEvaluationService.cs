using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using NCalc;

namespace GlobCRM.Infrastructure.FormulaFields;

/// <summary>
/// Core NCalc-based formula evaluation engine.
/// Evaluates formula fields for an entity by loading definitions, sorting them topologically,
/// and evaluating each expression in dependency order. Supports chained formulas where
/// one formula references the result of another.
/// </summary>
public class FormulaEvaluationService
{
    private readonly ICustomFieldRepository _fieldRepo;
    private readonly FieldRegistryService _fieldRegistry;
    private readonly ILogger<FormulaEvaluationService> _logger;

    public FormulaEvaluationService(
        ICustomFieldRepository fieldRepo,
        FieldRegistryService fieldRegistry,
        ILogger<FormulaEvaluationService> logger)
    {
        _fieldRepo = fieldRepo;
        _fieldRegistry = fieldRegistry;
        _logger = logger;
    }

    /// <summary>
    /// Evaluates all formula fields for the given entity, enriching the custom fields dictionary
    /// with computed values. Formulas are evaluated in topological (dependency) order.
    /// </summary>
    /// <param name="entityType">Entity type (e.g., "Deal", "Contact").</param>
    /// <param name="entity">The domain entity instance for system field extraction.</param>
    /// <param name="customFields">Existing custom field values (will be cloned, not mutated).</param>
    /// <returns>Enriched custom fields dictionary with formula results included.</returns>
    public async Task<Dictionary<string, object?>> EvaluateFormulasForEntityAsync(
        string entityType,
        object entity,
        Dictionary<string, object?> customFields)
    {
        var allFields = await _fieldRepo.GetFieldsByEntityTypeAsync(entityType);
        var formulas = allFields
            .Where(f => f.FieldType == CustomFieldType.Formula)
            .ToList();

        if (formulas.Count == 0)
            return customFields;

        // Topological sort for dependency order
        var sorted = TopologicalSort(formulas);

        // Build system field parameters from entity
        var systemParams = _fieldRegistry.ExtractEntityValues(entityType, entity);

        // Build parameter dictionary: system fields + custom fields
        var allParams = new Dictionary<string, object?>(systemParams);
        foreach (var (key, value) in customFields)
        {
            allParams[key] = ConvertJsonValue(value, null);
        }

        // Evaluate each formula in dependency order
        var result = new Dictionary<string, object?>(customFields);
        foreach (var formula in sorted)
        {
            var evaluated = EvaluateSingle(formula, allParams);
            result[formula.Name] = evaluated;
            // Make result available for chained formulas
            allParams[formula.Name] = evaluated is Dictionary<string, object?> errDict
                && errDict.ContainsKey("__formulaError")
                ? null
                : evaluated;
        }

        return result;
    }

    /// <summary>
    /// Evaluates a single formula expression against the given parameter dictionary.
    /// Used for preview evaluation and direct evaluation.
    /// </summary>
    public object? EvaluateSingleExpression(string expression, Dictionary<string, object?> parameters)
    {
        try
        {
            var expr = new Expression(expression);

            foreach (var (key, value) in parameters)
            {
                expr.Parameters[key] = value ?? 0;
            }

            RegisterCustomFunctions(expr);

            return expr.Evaluate();
        }
        catch (Exception ex)
        {
            return new Dictionary<string, object?>
            {
                ["__formulaError"] = true,
                ["message"] = ex.Message
            };
        }
    }

    private object? EvaluateSingle(CustomFieldDefinition formula, Dictionary<string, object?> parameters)
    {
        try
        {
            var expr = new Expression(formula.FormulaExpression!);

            foreach (var (key, value) in parameters)
            {
                // NCalc needs non-null values for arithmetic; use sensible defaults
                expr.Parameters[key] = value ?? 0;
            }

            RegisterCustomFunctions(expr);

            var result = expr.Evaluate();
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Formula evaluation failed for field {FieldName} ({FieldId}): {Expression}",
                formula.Name, formula.Id, formula.FormulaExpression);

            return new Dictionary<string, object?>
            {
                ["__formulaError"] = true,
                ["message"] = ex.Message
            };
        }
    }

    /// <summary>
    /// Registers custom functions for NCalc expression evaluation.
    /// DATEDIFF(date1, date2) returns days between dates.
    /// CONCAT(args...) joins all arguments as strings.
    /// NCalc has built-in if(condition, trueValue, falseValue) -- no registration needed.
    /// </summary>
    private static void RegisterCustomFunctions(Expression expr)
    {
        expr.EvaluateFunction += (name, args) =>
        {
            switch (name.ToUpperInvariant())
            {
                case "DATEDIFF":
                {
                    var parameters = args.Parameters;
                    if (parameters.Length < 2)
                    {
                        args.Result = 0;
                        return;
                    }

                    var val1 = parameters[0].Evaluate();
                    var val2 = parameters[1].Evaluate();

                    if (val1 == null || val2 == null)
                    {
                        args.Result = 0;
                        return;
                    }

                    try
                    {
                        var date1 = Convert.ToDateTime(val1);
                        var date2 = Convert.ToDateTime(val2);
                        args.Result = (date2 - date1).Days;
                    }
                    catch
                    {
                        args.Result = 0;
                    }
                    break;
                }

                case "CONCAT":
                {
                    var parts = args.Parameters
                        .Select(p => p.Evaluate()?.ToString() ?? "")
                        .ToArray();
                    args.Result = string.Join("", parts);
                    break;
                }
            }
        };
    }

    /// <summary>
    /// Topologically sorts formula fields by their dependencies using Kahn's algorithm.
    /// Formulas with no dependencies are evaluated first, then formulas that depend on those, etc.
    /// Throws InvalidOperationException if a circular reference is detected.
    /// </summary>
    internal static List<CustomFieldDefinition> TopologicalSort(List<CustomFieldDefinition> formulas)
    {
        if (formulas.Count <= 1) return new List<CustomFieldDefinition>(formulas);

        var formulaByName = formulas.ToDictionary(f => f.Name, f => f);
        var formulaIds = formulas.Select(f => f.Name).ToHashSet();

        // Build adjacency: formula -> set of formula names it depends on
        var dependencies = new Dictionary<string, HashSet<string>>();
        foreach (var formula in formulas)
        {
            var deps = new HashSet<string>();
            if (formula.DependsOnFieldIds != null)
            {
                foreach (var depName in formula.DependsOnFieldIds)
                {
                    if (formulaIds.Contains(depName))
                    {
                        deps.Add(depName);
                    }
                }
            }
            dependencies[formula.Name] = deps;
        }

        // Kahn's algorithm
        var inDegree = formulas.ToDictionary(f => f.Name, _ => 0);
        foreach (var (_, deps) in dependencies)
        {
            foreach (var dep in deps)
            {
                if (inDegree.ContainsKey(dep))
                    inDegree[dep]++;
            }
        }

        var queue = new Queue<string>(
            inDegree.Where(kv => kv.Value == 0).Select(kv => kv.Key));
        var sorted = new List<CustomFieldDefinition>();

        while (queue.Count > 0)
        {
            var name = queue.Dequeue();
            sorted.Add(formulaByName[name]);

            // Find formulas that depend on this one and decrement their in-degree
            foreach (var (dependent, deps) in dependencies)
            {
                if (deps.Contains(name))
                {
                    inDegree[dependent]--;
                    if (inDegree[dependent] == 0)
                        queue.Enqueue(dependent);
                }
            }
        }

        if (sorted.Count != formulas.Count)
            throw new InvalidOperationException("Circular reference detected in formula fields.");

        return sorted;
    }

    /// <summary>
    /// Converts a value that may be a System.Text.Json.JsonElement to a proper .NET type.
    /// JSONB values from PostgreSQL come back as JsonElement; NCalc needs native types.
    /// </summary>
    internal static object? ConvertJsonValue(object? value, string? expectedType)
    {
        if (value is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.Number => je.TryGetDecimal(out var d) ? d : (object)je.GetDouble(),
                JsonValueKind.String => expectedType == "date" && DateTime.TryParse(je.GetString(), out var dt)
                    ? dt
                    : je.GetString(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => expectedType switch
                {
                    "number" => 0m,
                    "text" => "",
                    _ => null
                },
                _ => je.ToString()
            };
        }

        if (value is null)
        {
            return expectedType switch
            {
                "number" => 0m,
                "text" => "",
                _ => null
            };
        }

        // Already a .NET primitive
        return value;
    }
}
