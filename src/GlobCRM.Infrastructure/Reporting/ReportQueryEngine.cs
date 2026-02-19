using System.Linq.Dynamic.Core;
using System.Linq.Expressions;
using System.Reflection;
using System.Text.Json;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.FormulaFields;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Reporting;

/// <summary>
/// Dynamic query builder for report execution. Resolves base IQueryable per entity type,
/// applies ownership scope, builds Expression trees for nested AND/OR filter groups,
/// and uses System.Linq.Dynamic.Core for grouping with aggregation.
///
/// Execution modes:
/// 1. Flat query: filter -> paginate -> project fields -> evaluate formulas
/// 2. Grouped query: filter -> group by -> aggregate -> project results
/// </summary>
public class ReportQueryEngine
{
    private readonly ApplicationDbContext _db;
    private readonly FormulaEvaluationService _formulaService;
    private readonly ICustomFieldRepository _customFieldRepo;
    private readonly ILogger<ReportQueryEngine> _logger;

    /// <summary>
    /// Maximum rows loaded for in-memory aggregation of custom fields.
    /// </summary>
    private const int InMemoryAggregationRowLimit = 10_000;

    public ReportQueryEngine(
        ApplicationDbContext db,
        FormulaEvaluationService formulaService,
        ICustomFieldRepository customFieldRepo,
        ILogger<ReportQueryEngine> logger)
    {
        _db = db;
        _formulaService = formulaService;
        _customFieldRepo = customFieldRepo;
        _logger = logger;
    }

    /// <summary>
    /// Executes a report definition and returns paginated results.
    /// </summary>
    public async Task<ReportExecutionResult> ExecuteReportAsync(
        Report report, int page, int pageSize,
        Guid userId, PermissionScope scope, List<Guid>? teamMemberIds,
        ReportFilterCondition? drillDownFilter = null)
    {
        try
        {
            return report.EntityType switch
            {
                "Contact" => await ExecuteForEntity<Contact>(
                    BuildContactQuery(report), report, page, pageSize,
                    c => c.OwnerId, userId, scope, teamMemberIds, drillDownFilter),
                "Deal" => await ExecuteForEntity<Deal>(
                    BuildDealQuery(report), report, page, pageSize,
                    d => d.OwnerId, userId, scope, teamMemberIds, drillDownFilter),
                "Company" => await ExecuteForEntity<Company>(
                    _db.Companies.AsQueryable(), report, page, pageSize,
                    c => c.OwnerId, userId, scope, teamMemberIds, drillDownFilter),
                "Lead" => await ExecuteForEntity<Lead>(
                    BuildLeadQuery(report), report, page, pageSize,
                    l => l.OwnerId, userId, scope, teamMemberIds, drillDownFilter),
                "Activity" => await ExecuteForEntity<Activity>(
                    BuildActivityQuery(report), report, page, pageSize,
                    a => a.OwnerId, userId, scope, teamMemberIds, drillDownFilter),
                "Quote" => await ExecuteForEntity<Quote>(
                    BuildQuoteQuery(report), report, page, pageSize,
                    q => q.OwnerId, userId, scope, teamMemberIds, drillDownFilter),
                "Request" => await ExecuteForEntity<Request>(
                    BuildRequestQuery(report), report, page, pageSize,
                    r => r.OwnerId, userId, scope, teamMemberIds, drillDownFilter),
                "Product" => await ExecuteForEntity<Product>(
                    _db.Products.AsQueryable(), report, page, pageSize,
                    _ => (Guid?)null, userId, scope, teamMemberIds, drillDownFilter),
                _ => new ReportExecutionResult
                {
                    Rows = [],
                    TotalCount = 0,
                    Aggregates = null,
                    ColumnHeaders = [],
                    Error = $"Unknown entity type: {report.EntityType}"
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Report execution failed for report {ReportId} entity {EntityType}",
                report.Id, report.EntityType);

            return new ReportExecutionResult
            {
                Rows = [],
                TotalCount = 0,
                Aggregates = null,
                ColumnHeaders = [],
                Error = "Report execution failed. Please check your filter configuration and try again."
            };
        }
    }

    #region Base Query Builders with Conditional Includes

    private IQueryable<Contact> BuildContactQuery(Report report)
    {
        var query = _db.Contacts.AsQueryable();
        var fieldIds = GetAllFieldIds(report);

        if (fieldIds.Any(f => f.StartsWith("related.Company.")))
            query = query.Include(c => c.Company);
        if (fieldIds.Any(f => f.StartsWith("related.Owner.")))
            query = query.Include(c => c.Owner);

        return query;
    }

    private IQueryable<Deal> BuildDealQuery(Report report)
    {
        var query = _db.Deals.AsQueryable();
        var fieldIds = GetAllFieldIds(report);

        if (fieldIds.Any(f => f.StartsWith("related.Stage.")))
            query = query.Include(d => d.Stage);
        if (fieldIds.Any(f => f.StartsWith("related.Pipeline.")))
            query = query.Include(d => d.Pipeline);
        if (fieldIds.Any(f => f.StartsWith("related.Company.")))
            query = query.Include(d => d.Company);
        if (fieldIds.Any(f => f.StartsWith("related.Owner.")))
            query = query.Include(d => d.Owner);

        return query;
    }

    private IQueryable<Lead> BuildLeadQuery(Report report)
    {
        var query = _db.Leads.AsQueryable();
        var fieldIds = GetAllFieldIds(report);

        if (fieldIds.Any(f => f.StartsWith("related.Stage.")))
            query = query.Include(l => l.Stage);
        if (fieldIds.Any(f => f.StartsWith("related.Source.")))
            query = query.Include(l => l.Source);
        if (fieldIds.Any(f => f.StartsWith("related.Owner.")))
            query = query.Include(l => l.Owner);

        return query;
    }

    private IQueryable<Activity> BuildActivityQuery(Report report)
    {
        var query = _db.Activities.AsQueryable();
        var fieldIds = GetAllFieldIds(report);

        if (fieldIds.Any(f => f.StartsWith("related.Owner.")))
            query = query.Include(a => a.Owner);
        if (fieldIds.Any(f => f.StartsWith("related.AssignedTo.")))
            query = query.Include(a => a.AssignedTo);

        return query;
    }

    private IQueryable<Quote> BuildQuoteQuery(Report report)
    {
        var query = _db.Quotes.AsQueryable();
        var fieldIds = GetAllFieldIds(report);

        if (fieldIds.Any(f => f.StartsWith("related.Contact.")))
            query = query.Include(q => q.Contact);
        if (fieldIds.Any(f => f.StartsWith("related.Company.")))
            query = query.Include(q => q.Company);
        if (fieldIds.Any(f => f.StartsWith("related.Deal.")))
            query = query.Include(q => q.Deal);
        if (fieldIds.Any(f => f.StartsWith("related.Owner.")))
            query = query.Include(q => q.Owner);

        return query;
    }

    private IQueryable<Request> BuildRequestQuery(Report report)
    {
        var query = _db.Requests.AsQueryable();
        var fieldIds = GetAllFieldIds(report);

        if (fieldIds.Any(f => f.StartsWith("related.Contact.")))
            query = query.Include(r => r.Contact);
        if (fieldIds.Any(f => f.StartsWith("related.Company.")))
            query = query.Include(r => r.Company);
        if (fieldIds.Any(f => f.StartsWith("related.Owner.")))
            query = query.Include(r => r.Owner);
        if (fieldIds.Any(f => f.StartsWith("related.AssignedTo.")))
            query = query.Include(r => r.AssignedTo);

        return query;
    }

    /// <summary>
    /// Collects all field IDs referenced in the report (fields, filters, groupings).
    /// </summary>
    private static HashSet<string> GetAllFieldIds(Report report)
    {
        var ids = new HashSet<string>();

        foreach (var f in report.Definition.Fields)
            ids.Add(f.FieldId);

        if (report.Definition.FilterGroup != null)
            CollectFilterFieldIds(report.Definition.FilterGroup, ids);

        foreach (var g in report.Definition.Groupings)
            ids.Add(g.FieldId);

        return ids;
    }

    private static void CollectFilterFieldIds(ReportFilterGroup group, HashSet<string> ids)
    {
        foreach (var c in group.Conditions)
            ids.Add(c.FieldId);
        foreach (var g in group.Groups)
            CollectFilterFieldIds(g, ids);
    }

    #endregion

    #region Generic Execution Pipeline

    private async Task<ReportExecutionResult> ExecuteForEntity<T>(
        IQueryable<T> baseQuery,
        Report report,
        int page, int pageSize,
        Expression<Func<T, Guid?>> ownerSelector,
        Guid userId, PermissionScope scope, List<Guid>? teamMemberIds,
        ReportFilterCondition? drillDownFilter) where T : class
    {
        // 1. Apply ownership scope
        var query = ApplyOwnershipScope(baseQuery, ownerSelector, userId, scope, teamMemberIds);

        // 2. Apply filter groups (system/related fields only -- SQL-translatable)
        if (report.Definition.FilterGroup != null)
        {
            var filterExpr = BuildFilterGroupExpression<T>(report.Definition.FilterGroup);
            if (filterExpr != null)
                query = query.Where(filterExpr);
        }

        // 3. Apply drill-down filter
        if (drillDownFilter != null)
        {
            var drillExpr = BuildConditionExpression<T>(drillDownFilter);
            if (drillExpr != null)
                query = query.Where(drillExpr);
        }

        // 4. Choose execution mode
        if (report.Definition.Groupings.Count > 0)
            return await ExecuteGroupedQuery(query, report);

        return await ExecuteFlatQuery(query, report, page, pageSize);
    }

    #endregion

    #region Ownership Scope

    private static IQueryable<T> ApplyOwnershipScope<T>(
        IQueryable<T> query,
        Expression<Func<T, Guid?>> ownerSelector,
        Guid userId, PermissionScope scope, List<Guid>? teamMemberIds) where T : class
    {
        return scope switch
        {
            PermissionScope.Own => query.Where(BuildOwnerFilter(ownerSelector, userId)),
            PermissionScope.Team when teamMemberIds?.Count > 0 =>
                query.Where(BuildTeamFilter(ownerSelector, teamMemberIds)),
            // PermissionScope.All or no filter
            _ => query
        };
    }

    private static Expression<Func<T, bool>> BuildOwnerFilter<T>(
        Expression<Func<T, Guid?>> ownerSelector, Guid userId)
    {
        var param = ownerSelector.Parameters[0];
        var ownerAccess = ownerSelector.Body;
        var userIdConst = Expression.Constant((Guid?)userId, typeof(Guid?));
        var equals = Expression.Equal(ownerAccess, userIdConst);
        return Expression.Lambda<Func<T, bool>>(equals, param);
    }

    private static Expression<Func<T, bool>> BuildTeamFilter<T>(
        Expression<Func<T, Guid?>> ownerSelector, List<Guid> teamMemberIds)
    {
        var param = ownerSelector.Parameters[0];
        var ownerAccess = ownerSelector.Body;

        // Build: teamMemberIds.Contains(entity.OwnerId.Value)
        var valueAccess = Expression.Property(ownerAccess, nameof(Nullable<Guid>.Value));
        var listConst = Expression.Constant(teamMemberIds);
        var containsMethod = typeof(List<Guid>).GetMethod("Contains", [typeof(Guid)])!;
        var hasValue = Expression.Property(ownerAccess, nameof(Nullable<Guid>.HasValue));
        var contains = Expression.Call(listConst, containsMethod, valueAccess);
        var combined = Expression.AndAlso(hasValue, contains);

        return Expression.Lambda<Func<T, bool>>(combined, param);
    }

    #endregion

    #region Filter Expression Builder

    /// <summary>
    /// Recursively builds an Expression from a ReportFilterGroup.
    /// Returns null if group has no conditions.
    /// </summary>
    private Expression<Func<T, bool>>? BuildFilterGroupExpression<T>(ReportFilterGroup group) where T : class
    {
        var param = Expression.Parameter(typeof(T), "e");
        var body = BuildFilterGroupBody<T>(group, param);

        if (body == null)
            return null;

        return Expression.Lambda<Func<T, bool>>(body, param);
    }

    private Expression? BuildFilterGroupBody<T>(ReportFilterGroup group, ParameterExpression param) where T : class
    {
        var expressions = new List<Expression>();

        foreach (var condition in group.Conditions)
        {
            var condExpr = BuildConditionBody<T>(condition, param);
            if (condExpr != null)
                expressions.Add(condExpr);
        }

        foreach (var childGroup in group.Groups)
        {
            var childExpr = BuildFilterGroupBody<T>(childGroup, param);
            if (childExpr != null)
                expressions.Add(childExpr);
        }

        if (expressions.Count == 0)
            return null;

        return group.Logic == FilterLogic.And
            ? expressions.Aggregate(Expression.AndAlso)
            : expressions.Aggregate(Expression.OrElse);
    }

    private Expression<Func<T, bool>>? BuildConditionExpression<T>(ReportFilterCondition condition) where T : class
    {
        var param = Expression.Parameter(typeof(T), "e");
        var body = BuildConditionBody<T>(condition, param);
        if (body == null) return null;
        return Expression.Lambda<Func<T, bool>>(body, param);
    }

    private Expression? BuildConditionBody<T>(ReportFilterCondition condition, ParameterExpression param) where T : class
    {
        // Skip custom field and formula field conditions -- these require in-memory evaluation
        if (IsCustomOrFormulaField(condition.FieldId))
            return null;

        try
        {
            var memberAccess = BuildMemberAccess(param, typeof(T), condition.FieldId);
            if (memberAccess == null) return null;

            var memberType = memberAccess.Type;
            var underlyingType = Nullable.GetUnderlyingType(memberType) ?? memberType;

            return condition.Operator switch
            {
                "equals" => BuildEqualsExpression(memberAccess, condition.Value, underlyingType),
                "not_equals" => Expression.Not(BuildEqualsExpression(memberAccess, condition.Value, underlyingType)),
                "contains" => BuildContainsExpression(memberAccess, condition.Value),
                "not_contains" => Expression.Not(BuildContainsExpression(memberAccess, condition.Value)),
                "greater_than" => BuildComparisonExpression(memberAccess, condition.Value, underlyingType, ExpressionType.GreaterThan),
                "less_than" => BuildComparisonExpression(memberAccess, condition.Value, underlyingType, ExpressionType.LessThan),
                "greater_than_or_equal" => BuildComparisonExpression(memberAccess, condition.Value, underlyingType, ExpressionType.GreaterThanOrEqual),
                "less_than_or_equal" => BuildComparisonExpression(memberAccess, condition.Value, underlyingType, ExpressionType.LessThanOrEqual),
                "between" => BuildBetweenExpression(memberAccess, condition.Value, condition.ValueTo, underlyingType),
                "is_empty" => BuildIsEmptyExpression(memberAccess, memberType),
                "is_not_empty" => Expression.Not(BuildIsEmptyExpression(memberAccess, memberType)),
                _ => null
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to build filter expression for field {FieldId} operator {Operator}",
                condition.FieldId, condition.Operator);
            return null;
        }
    }

    /// <summary>
    /// Builds a member access chain from a field ID.
    /// Handles "related.Company.name" -> entity.Company.Name (with PascalCase property resolution).
    /// Handles simple fields like "firstName" -> entity.FirstName.
    /// </summary>
    private static Expression? BuildMemberAccess(Expression root, Type entityType, string fieldId)
    {
        if (fieldId.StartsWith("related."))
        {
            // Parse "related.Company.name" -> ["Company", "name"]
            var parts = fieldId.Split('.');
            if (parts.Length != 3) return null;

            var navigationName = parts[1]; // "Company", "Stage", "Owner", etc.
            var fieldName = parts[2];       // "name", "firstName", etc.

            // Resolve navigation property
            var navProp = FindProperty(entityType, navigationName);
            if (navProp == null) return null;

            var navAccess = Expression.Property(root, navProp);

            // Resolve field on the navigation type
            var fieldProp = FindProperty(navProp.PropertyType, fieldName);
            if (fieldProp == null) return null;

            return Expression.Property(navAccess, fieldProp);
        }

        // Direct system field -- resolve with case-insensitive matching
        var prop = FindProperty(entityType, fieldId);
        if (prop == null) return null;

        return Expression.Property(root, prop);
    }

    /// <summary>
    /// Finds a property on a type by name (case-insensitive).
    /// </summary>
    private static PropertyInfo? FindProperty(Type type, string name)
    {
        return type.GetProperty(name, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
    }

    private static bool IsCustomOrFormulaField(string fieldId)
    {
        // Custom and formula fields use snake_case names; system fields use camelCase
        // Related fields start with "related."
        if (fieldId.StartsWith("related.")) return false;

        // System field names are camelCase (no underscores)
        // Custom/formula field names are snake_case (contain underscores)
        return fieldId.Contains('_');
    }

    #endregion

    #region Filter Expression Helpers

    private static Expression BuildEqualsExpression(Expression member, string? value, Type underlyingType)
    {
        var constant = ConvertToConstant(value, member.Type, underlyingType);
        return Expression.Equal(member, constant);
    }

    private static Expression BuildContainsExpression(Expression member, string? value)
    {
        // String.Contains for string types
        if (member.Type == typeof(string))
        {
            var containsMethod = typeof(string).GetMethod("Contains", [typeof(string)])!;
            var valueExpr = Expression.Constant(value ?? "", typeof(string));

            // Handle null: coalesce to ""
            var coalesced = Expression.Coalesce(member, Expression.Constant("", typeof(string)));
            return Expression.Call(coalesced, containsMethod, valueExpr);
        }

        // For nullable string properties (via navigation)
        if (Nullable.GetUnderlyingType(member.Type) == typeof(string))
        {
            var toString = Expression.Call(member, "ToString", Type.EmptyTypes);
            var containsMethod = typeof(string).GetMethod("Contains", [typeof(string)])!;
            var valueExpr = Expression.Constant(value ?? "", typeof(string));
            return Expression.Call(toString, containsMethod, valueExpr);
        }

        // For enums displayed as strings, convert to string and contains
        var memberString = Expression.Call(member, "ToString", Type.EmptyTypes);
        var containsStr = typeof(string).GetMethod("Contains", [typeof(string)])!;
        var valExpr = Expression.Constant(value ?? "", typeof(string));
        return Expression.Call(memberString, containsStr, valExpr);
    }

    private static Expression BuildComparisonExpression(
        Expression member, string? value, Type underlyingType, ExpressionType comparison)
    {
        var constant = ConvertToConstant(value, member.Type, underlyingType);

        // For nullable types, compare using Value properties
        if (Nullable.GetUnderlyingType(member.Type) != null)
        {
            var hasValue = Expression.Property(member, "HasValue");
            var memberValue = Expression.Property(member, "Value");
            Expression constValue = Nullable.GetUnderlyingType(constant.Type) != null
                ? Expression.Property(constant, "Value")
                : constant;

            var compare = Expression.MakeBinary(comparison, memberValue, constValue);
            return Expression.AndAlso(hasValue, compare);
        }

        return Expression.MakeBinary(comparison, member, constant);
    }

    private static Expression BuildBetweenExpression(
        Expression member, string? valueFrom, string? valueTo, Type underlyingType)
    {
        var gte = BuildComparisonExpression(member, valueFrom, underlyingType, ExpressionType.GreaterThanOrEqual);
        var lte = BuildComparisonExpression(member, valueTo, underlyingType, ExpressionType.LessThanOrEqual);
        return Expression.AndAlso(gte, lte);
    }

    private static Expression BuildIsEmptyExpression(Expression member, Type memberType)
    {
        if (memberType == typeof(string))
        {
            var isNull = Expression.Equal(member, Expression.Constant(null, typeof(string)));
            var isEmpty = Expression.Equal(member, Expression.Constant("", typeof(string)));
            return Expression.OrElse(isNull, isEmpty);
        }

        if (Nullable.GetUnderlyingType(memberType) != null)
        {
            return Expression.Equal(member, Expression.Constant(null, memberType));
        }

        return Expression.Constant(false);
    }

    private static ConstantExpression ConvertToConstant(string? value, Type targetType, Type underlyingType)
    {
        if (value == null)
            return Expression.Constant(null, targetType);

        object? converted;

        if (underlyingType == typeof(string))
            converted = value;
        else if (underlyingType == typeof(int))
            converted = int.Parse(value);
        else if (underlyingType == typeof(decimal))
            converted = decimal.Parse(value);
        else if (underlyingType == typeof(double))
            converted = double.Parse(value);
        else if (underlyingType == typeof(float))
            converted = float.Parse(value);
        else if (underlyingType == typeof(bool))
            converted = bool.Parse(value);
        else if (underlyingType == typeof(Guid))
            converted = Guid.Parse(value);
        else if (underlyingType == typeof(DateTime))
            converted = DateTime.Parse(value);
        else if (underlyingType == typeof(DateTimeOffset))
            converted = DateTimeOffset.Parse(value);
        else if (underlyingType == typeof(DateOnly))
            converted = DateOnly.Parse(value);
        else if (underlyingType.IsEnum)
            converted = Enum.Parse(underlyingType, value, ignoreCase: true);
        else
            converted = Convert.ChangeType(value, underlyingType);

        // Wrap in nullable if target is nullable
        if (Nullable.GetUnderlyingType(targetType) != null)
            return Expression.Constant(converted, targetType);

        return Expression.Constant(converted, underlyingType);
    }

    #endregion

    #region Flat Query Execution

    private async Task<ReportExecutionResult> ExecuteFlatQuery<T>(
        IQueryable<T> query, Report report, int page, int pageSize) where T : class
    {
        var totalCount = await query.CountAsync();

        // Order by creation date descending as default
        query = query.OrderBy("CreatedAt desc");

        // Apply pagination
        var entities = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Project entities to row dictionaries
        var selectedFields = report.Definition.Fields.OrderBy(f => f.SortOrder).ToList();
        var hasFormulaFields = selectedFields.Any(f => f.FieldType == "formula");

        // Get custom field definitions if we need formula evaluation
        var customFieldDefs = hasFormulaFields
            ? await _customFieldRepo.GetFieldsByEntityTypeAsync(report.EntityType)
            : null;

        var rows = new List<Dictionary<string, object?>>();
        foreach (var entity in entities)
        {
            var row = new Dictionary<string, object?>();

            // Evaluate formula fields if any
            Dictionary<string, object?>? enrichedCustomFields = null;
            if (hasFormulaFields)
            {
                var customFieldValues = GetCustomFields(entity);
                enrichedCustomFields = await _formulaService.EvaluateFormulasForEntityAsync(
                    report.EntityType, entity, customFieldValues);
            }

            foreach (var field in selectedFields)
            {
                row[field.FieldId] = field.FieldType switch
                {
                    "formula" => enrichedCustomFields?.GetValueOrDefault(field.FieldId),
                    "custom" => GetCustomFieldValue(entity, field.FieldId),
                    "related" => GetRelatedFieldValue(entity, field.FieldId),
                    _ => GetSystemFieldValue(entity, field.FieldId)
                };
            }

            rows.Add(row);
        }

        return new ReportExecutionResult
        {
            Rows = rows,
            TotalCount = totalCount,
            Aggregates = null,
            ColumnHeaders = selectedFields.Select(f => f.Label).ToList()
        };
    }

    #endregion

    #region Grouped Query Execution

    private async Task<ReportExecutionResult> ExecuteGroupedQuery<T>(
        IQueryable<T> query, Report report) where T : class
    {
        var groupings = report.Definition.Groupings;
        var aggregateFields = report.Definition.Fields
            .Where(f => f.Aggregation.HasValue)
            .ToList();

        // Build the GroupBy key expression for System.Linq.Dynamic.Core
        var groupByParts = new List<string>();
        foreach (var grouping in groupings)
        {
            var propPath = ResolvePropertyPath(grouping.FieldId, typeof(T));
            if (propPath == null) continue;

            // Date truncation for date fields
            if (!string.IsNullOrEmpty(grouping.DateTruncation))
            {
                propPath = grouping.DateTruncation switch
                {
                    "year" => $"{propPath}.Year",
                    "month" => $"new({propPath}.Year as Year, {propPath}.Month as Month)",
                    "day" => $"{propPath}.Date",
                    _ => propPath
                };
            }

            groupByParts.Add(propPath);
        }

        if (groupByParts.Count == 0)
        {
            return new ReportExecutionResult
            {
                Rows = [],
                TotalCount = 0,
                Aggregates = null,
                ColumnHeaders = [],
                Error = "No valid grouping fields found."
            };
        }

        // Build Dynamic LINQ GroupBy key
        var groupByKey = groupByParts.Count == 1
            ? groupByParts[0]
            : $"new({string.Join(", ", groupByParts.Select((p, i) => $"{p} as Key{i}"))})";

        // Build Select with aggregations
        var selectParts = new List<string> { "Key" };
        selectParts.Add("Count() as __count");

        foreach (var aggField in aggregateFields)
        {
            var propPath = ResolvePropertyPath(aggField.FieldId, typeof(T));
            if (propPath == null) continue;

            var alias = SanitizeAlias(aggField.FieldId);
            var aggExpr = aggField.Aggregation switch
            {
                AggregationType.Sum => $"Sum({propPath}) as sum_{alias}",
                AggregationType.Average => $"Average({propPath}) as avg_{alias}",
                AggregationType.Min => $"Min({propPath}) as min_{alias}",
                AggregationType.Max => $"Max({propPath}) as max_{alias}",
                AggregationType.Count => $"Count() as count_{alias}",
                _ => null
            };

            if (aggExpr != null)
                selectParts.Add(aggExpr);
        }

        var selectExpr = $"new({string.Join(", ", selectParts)})";

        try
        {
            // Execute Dynamic LINQ grouping
            var grouped = query
                .GroupBy(groupByKey)
                .Select(selectExpr);

            var dynamicResults = await grouped.ToDynamicListAsync();

            // Project dynamic results to row dictionaries
            var rows = new List<Dictionary<string, object?>>();
            var aggregates = new List<ReportAggregateResult>();

            // Track aggregate totals across all groups
            var aggregateSums = new Dictionary<string, (AggregationType Agg, decimal Sum, int Count, decimal? Min, decimal? Max)>();

            foreach (var result in dynamicResults)
            {
                var row = new Dictionary<string, object?>();

                // Extract group key
                var keyValue = GetDynamicProperty(result, "Key");
                if (groupByParts.Count == 1)
                {
                    var groupField = groupings[0];
                    row[groupField.FieldId] = keyValue?.ToString();
                }
                else
                {
                    for (var i = 0; i < groupings.Count; i++)
                    {
                        var groupField = groupings[i];
                        var keyPart = GetDynamicProperty(keyValue, $"Key{i}");
                        row[groupField.FieldId] = keyPart?.ToString();
                    }
                }

                // Extract count
                var count = Convert.ToInt32(GetDynamicProperty(result, "__count") ?? 0);
                row["__count"] = count;

                // Extract aggregation values
                foreach (var aggField in aggregateFields)
                {
                    var alias = SanitizeAlias(aggField.FieldId);
                    var prefix = aggField.Aggregation switch
                    {
                        AggregationType.Sum => "sum",
                        AggregationType.Average => "avg",
                        AggregationType.Min => "min",
                        AggregationType.Max => "max",
                        AggregationType.Count => "count",
                        _ => "val"
                    };

                    var propName = $"{prefix}_{alias}";
                    var value = GetDynamicProperty(result, propName);
                    row[$"{aggField.FieldId}_{prefix}"] = value;

                    // Accumulate for summary aggregates
                    var decValue = value != null ? Convert.ToDecimal(value) : 0m;
                    if (!aggregateSums.ContainsKey(propName))
                        aggregateSums[propName] = (aggField.Aggregation!.Value, 0m, 0, null, null);

                    var current = aggregateSums[propName];
                    aggregateSums[propName] = (
                        current.Agg,
                        current.Sum + decValue,
                        current.Count + 1,
                        current.Min.HasValue ? Math.Min(current.Min.Value, decValue) : decValue,
                        current.Max.HasValue ? Math.Max(current.Max.Value, decValue) : decValue
                    );
                }

                rows.Add(row);
            }

            // Build summary aggregate results
            foreach (var aggField in aggregateFields)
            {
                var alias = SanitizeAlias(aggField.FieldId);
                var prefix = aggField.Aggregation switch
                {
                    AggregationType.Sum => "sum",
                    AggregationType.Average => "avg",
                    AggregationType.Min => "min",
                    AggregationType.Max => "max",
                    AggregationType.Count => "count",
                    _ => "val"
                };

                var propName = $"{prefix}_{alias}";
                if (aggregateSums.TryGetValue(propName, out var totals))
                {
                    object? summaryValue = aggField.Aggregation switch
                    {
                        AggregationType.Sum => totals.Sum,
                        AggregationType.Average => totals.Count > 0 ? totals.Sum / totals.Count : 0m,
                        AggregationType.Min => totals.Min,
                        AggregationType.Max => totals.Max,
                        AggregationType.Count => totals.Sum,
                        _ => null
                    };

                    aggregates.Add(new ReportAggregateResult
                    {
                        FieldId = aggField.FieldId,
                        Label = aggField.Label,
                        Aggregation = aggField.Aggregation!.Value,
                        Value = summaryValue
                    });
                }
            }

            // Build column headers
            var headers = new List<string>();
            foreach (var g in groupings)
                headers.Add(g.FieldId);
            headers.Add("Count");
            foreach (var a in aggregateFields)
                headers.Add($"{a.Label} ({a.Aggregation})");

            return new ReportExecutionResult
            {
                Rows = rows,
                TotalCount = rows.Count,
                Aggregates = aggregates.Count > 0 ? aggregates : null,
                ColumnHeaders = headers
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Grouped query execution failed for report {ReportId}", report.Id);

            return new ReportExecutionResult
            {
                Rows = [],
                TotalCount = 0,
                Aggregates = null,
                ColumnHeaders = [],
                Error = "Grouped query execution failed. This may be caused by unsupported field combinations in grouping."
            };
        }
    }

    /// <summary>
    /// Resolves a field ID to a C# property path for Dynamic LINQ.
    /// "related.Company.name" -> "Company.Name"
    /// "firstName" -> "FirstName"
    /// </summary>
    private static string? ResolvePropertyPath(string fieldId, Type entityType)
    {
        if (fieldId.StartsWith("related."))
        {
            var parts = fieldId.Split('.');
            if (parts.Length != 3) return null;

            var navProp = FindProperty(entityType, parts[1]);
            if (navProp == null) return null;

            var fieldProp = FindProperty(navProp.PropertyType, parts[2]);
            if (fieldProp == null) return null;

            return $"{navProp.Name}.{fieldProp.Name}";
        }

        // Direct property
        var prop = FindProperty(entityType, fieldId);
        return prop?.Name;
    }

    private static string SanitizeAlias(string fieldId)
    {
        return fieldId.Replace(".", "_").Replace("-", "_");
    }

    private static object? GetDynamicProperty(object? obj, string propertyName)
    {
        if (obj == null) return null;

        var type = obj.GetType();
        var prop = type.GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
        return prop?.GetValue(obj);
    }

    #endregion

    #region Value Extraction

    /// <summary>
    /// Extracts a system field value from an entity using reflection.
    /// </summary>
    private static object? GetSystemFieldValue(object entity, string fieldId)
    {
        var prop = FindProperty(entity.GetType(), fieldId);
        if (prop == null) return null;

        var value = prop.GetValue(entity);

        // Convert enums to their string name
        if (value != null && prop.PropertyType.IsEnum)
            return value.ToString();

        // Convert enum? to string
        var underlying = Nullable.GetUnderlyingType(prop.PropertyType);
        if (value != null && underlying?.IsEnum == true)
            return value.ToString();

        return value;
    }

    /// <summary>
    /// Extracts a related entity field value by navigating the entity graph.
    /// </summary>
    private static object? GetRelatedFieldValue(object entity, string fieldId)
    {
        if (!fieldId.StartsWith("related.")) return null;

        var parts = fieldId.Split('.');
        if (parts.Length != 3) return null;

        var navigationName = parts[1];
        var fieldName = parts[2];

        // Navigate to related entity
        var navProp = FindProperty(entity.GetType(), navigationName);
        if (navProp == null) return null;

        var relatedEntity = navProp.GetValue(entity);
        if (relatedEntity == null) return null;

        // Get field from related entity
        var fieldProp = FindProperty(relatedEntity.GetType(), fieldName);
        if (fieldProp == null) return null;

        var value = fieldProp.GetValue(relatedEntity);

        if (value != null && fieldProp.PropertyType.IsEnum)
            return value.ToString();

        return value;
    }

    /// <summary>
    /// Extracts a custom field value from the entity's CustomFields JSONB dictionary.
    /// </summary>
    private static object? GetCustomFieldValue(object entity, string fieldId)
    {
        var customFieldsProp = FindProperty(entity.GetType(), "CustomFields");
        if (customFieldsProp == null) return null;

        var customFields = customFieldsProp.GetValue(entity) as Dictionary<string, object?>;
        if (customFields == null) return null;

        customFields.TryGetValue(fieldId, out var value);

        // Convert JsonElement to native type
        if (value is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.String => je.GetString(),
                JsonValueKind.Number => je.TryGetDecimal(out var d) ? d : (object)je.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                _ => je.ToString()
            };
        }

        return value;
    }

    /// <summary>
    /// Gets the CustomFields dictionary from an entity.
    /// </summary>
    private static Dictionary<string, object?> GetCustomFields(object entity)
    {
        var prop = FindProperty(entity.GetType(), "CustomFields");
        return prop?.GetValue(entity) as Dictionary<string, object?> ?? new Dictionary<string, object?>();
    }

    #endregion
}

/// <summary>
/// Result of executing a report query.
/// </summary>
public record ReportExecutionResult
{
    /// <summary>
    /// Flat row data — each row is a dictionary of field ID to value.
    /// </summary>
    public List<Dictionary<string, object?>> Rows { get; init; } = [];

    /// <summary>
    /// Total rows before pagination (for flat queries) or total groups (for grouped queries).
    /// </summary>
    public int TotalCount { get; init; }

    /// <summary>
    /// Aggregate summary values when grouping is active. Null for flat queries.
    /// </summary>
    public List<ReportAggregateResult>? Aggregates { get; init; }

    /// <summary>
    /// Ordered column headers for display.
    /// </summary>
    public List<string> ColumnHeaders { get; init; } = [];

    /// <summary>
    /// Error message if query execution failed. Null on success.
    /// </summary>
    public string? Error { get; init; }
}

/// <summary>
/// A single aggregate summary value from a grouped report.
/// </summary>
public record ReportAggregateResult
{
    public string FieldId { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public AggregationType Aggregation { get; init; }
    public object? Value { get; init; }
}
