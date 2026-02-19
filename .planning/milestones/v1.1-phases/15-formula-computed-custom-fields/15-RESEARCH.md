# Phase 15: Formula / Computed Custom Fields - Research

**Researched:** 2026-02-19
**Domain:** Expression parsing, custom field system extension, server-side formula evaluation
**Confidence:** HIGH

## Summary

This phase extends the existing custom field system (`CustomFieldDefinition`, `CustomFieldType` enum, `ICustomFieldRepository`) with a new `Formula` field type. The core technical challenge is building a server-side expression evaluator that (1) parses formula strings with field references like `[deal_value] * [probability] / 100`, (2) evaluates them against entity data on-read, and (3) validates formulas at definition time (syntax, field references, circular dependencies via topological sort).

The existing architecture maps cleanly to this feature. Every entity (Deal, Contact, Company, etc.) already carries a `Dictionary<string, object?> CustomFields` JSONB column, and every DTO's `FromEntity()` method already passes `CustomFields` through to the API response. Formula fields will inject computed values into this dictionary on-read, before the DTO is built. The frontend already renders custom fields as read-only columns in `DynamicTableComponent.getCellValue()` and in `CustomFieldFormComponent` -- formula fields simply appear as another read-only custom field.

**Primary recommendation:** Use NCalc (NuGet: `NCalcSync`) as the expression evaluation engine. It provides built-in `if()` conditional, bracket parameter syntax `[paramName]`, `HasErrors()` for syntax validation, `GetParametersNames()` for dependency extraction, and supports custom functions for DATEDIFF/CONCAT. Build a `FormulaEvaluationService` that takes an entity's system fields + custom fields, loads formula definitions (sorted topologically), and evaluates them in dependency order. Inject computed values into the entity's `CustomFields` dictionary in the DTO `FromEntity()` call path.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Text input with autocomplete -- typing `[` triggers a dropdown of available fields
- Real-time validation as admin types -- syntax errors, unknown field references, and circular dependencies flagged inline immediately
- Live preview panel shows computed result using sample/real entity data, updating as the formula changes
- Autocomplete dropdown groups fields by category: System Fields (Value, Status, CreatedAt...) then Custom Fields
- Field reference syntax: square brackets -- `[deal_value] * [probability] / 100`
- Essential function library only (~10 functions): arithmetic operators (+, -, *, /), IF/THEN/ELSE conditional, DATEDIFF for date differences, CONCAT for string concatenation
- Errors display as '#ERR' with tooltip showing the reason (e.g., "Division by zero", "Missing field value") -- spreadsheet-familiar pattern
- Formula results are UI only for now -- excluded from CSV exports. Phase 20 (Advanced Reporting) will handle formula fields in reports
- Formula columns appear as read-only in dynamic tables and detail pages
- Formulas can reference both system fields (Value, CreatedAt, Status, etc.) and custom JSONB fields on the same entity
- Formula chaining supported -- Formula A can reference Formula B's result
- Dependency graph tracked with circular reference detection via topological sort
- Autocomplete groups fields by category (System Fields, Custom Fields, Formula Fields) for easy discovery

### Claude's Discretion
- Editor location in admin UI (inline in custom field dialog vs. dedicated page)
- Output format configuration approach (admin-selected vs. auto-detected from expression)
- Whether formula columns are sortable/filterable in dynamic tables or display-only
- Nested conditional support (IF inside IF) vs. flat only
- In-editor help/documentation approach (collapsible panel vs. tooltip hints)
- Cross-entity field references (same entity only vs. allow parent entity fields)

### Deferred Ideas (OUT OF SCOPE)
- Formula fields in CSV exports -- extend when export infrastructure is revisited
- Formula fields in reports -- Phase 20 (Advanced Reporting Builder) will integrate formula columns
- Extended function library (ROUND, ABS, MIN, MAX, etc.) -- future iteration based on user demand
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FORM-01 | Admin can create formula custom fields with arithmetic expressions and field references | NCalc expression evaluator handles arithmetic; `CustomFieldType.Formula` extends existing enum; field references via bracket syntax `[field_name]` map to NCalc parameters |
| FORM-02 | Formula fields support date difference calculations (days between dates) | Custom `DATEDIFF` function registered in NCalc; accepts two date parameters and returns numeric days |
| FORM-03 | Formula fields support string concatenation and conditional logic (IF) | NCalc has built-in `if()` function; custom `CONCAT` function registered; nested IF supported natively by NCalc |
| FORM-04 | Formula values are computed on-read and displayed as read-only in all views | `FormulaEvaluationService` injects computed values into `CustomFields` dictionary in DTO mapping layer; frontend already renders custom fields read-only |
| FORM-05 | Admin receives validation feedback when creating invalid formulas (syntax errors, circular references) | NCalc `HasErrors()` for syntax; `GetParametersNames()` for field reference validation; topological sort on formula dependency graph for circular detection |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NCalcSync | 5.11.0 | Expression parsing and evaluation | Active .NET project, supports bracket parameters, custom functions, built-in `if()`, syntax validation via `HasErrors()`, parameter extraction via `GetParametersNames()`. Parlot-based parser. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none -- all supporting tech is already in the project) | -- | -- | -- |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NCalc | Hand-rolled expression parser | NCalc handles operator precedence, parentheses, syntax validation, parameter resolution out of the box. Hand-rolling would take 10x longer and have more bugs. |
| NCalc | DynamicExpresso | DynamicExpresso evaluates C# syntax which is too complex for end-user formulas. NCalc's simpler syntax is more appropriate for admin-facing formula fields. |
| NCalc | Flee | Flee is less actively maintained, last NuGet update was 2021. NCalc is actively maintained (5.11.0 as of late 2025). |

**Installation:**
```bash
cd src/GlobCRM.Api && dotnet add package NCalcSync
```

Note: The package should be added to `GlobCRM.Infrastructure` since that's where the evaluation service will live, following the existing subsystem pattern.

```bash
cd src/GlobCRM.Infrastructure && dotnet add package NCalcSync
```

## Architecture Patterns

### Recommended Project Structure
```
src/GlobCRM.Domain/
  Enums/
    CustomFieldType.cs              # Add Formula = 10
  Entities/
    CustomFieldDefinition.cs        # Add FormulaExpression, FormulaResultType, DependsOnFieldIds

src/GlobCRM.Infrastructure/
  FormulaFields/
    FormulaEvaluationService.cs     # Core evaluation engine
    FormulaValidationService.cs     # Syntax + field ref + circular dependency validation
    FormulaFieldServiceExtensions.cs # DI registration
    FieldRegistryService.cs         # System field + custom field registry per entity type
  CustomFields/
    CustomFieldServiceExtensions.cs # Already exists, register new services

src/GlobCRM.Api/
  Controllers/
    CustomFieldsController.cs       # Extend with formula-specific validation endpoint

globcrm-web/src/app/
  core/custom-fields/
    custom-field.models.ts          # Add 'formula' to CustomFieldType enum
    custom-field.service.ts         # Add formula validation endpoint
  features/settings/custom-fields/
    custom-field-edit-dialog.component.ts   # Add formula editor section
    formula-editor.component.ts             # NEW: formula input with autocomplete + preview
  shared/components/dynamic-table/
    dynamic-table.component.html    # Handle '#ERR' display with tooltip for formula errors
```

### Pattern 1: Formula Evaluation on DTO Mapping (Compute-on-Read)
**What:** Formulas are evaluated when building DTOs, not stored. The `FormulaEvaluationService` takes an entity plus its formula field definitions, evaluates them in topological order, and injects results into the `CustomFields` dictionary.
**When to use:** Every entity retrieval path (list, detail, Kanban).
**Example:**
```csharp
// In FormulaEvaluationService
public Dictionary<string, object?> EvaluateFormulas(
    string entityType,
    Dictionary<string, object?> entityProperties,   // system fields as dict
    Dictionary<string, object?> customFields,        // existing custom field values
    List<CustomFieldDefinition> formulaFields)       // sorted topologically
{
    var result = new Dictionary<string, object?>(customFields);

    foreach (var formula in formulaFields) // already in dependency order
    {
        try
        {
            var expression = new Expression(formula.FormulaExpression);

            // Register system field parameters
            foreach (var (key, value) in entityProperties)
                expression.Parameters[key] = value;

            // Register custom field parameters (including previously computed formulas)
            foreach (var (key, value) in result)
                expression.Parameters[key] = value;

            // Register custom functions
            RegisterCustomFunctions(expression);

            var evaluated = expression.Evaluate();
            result[formula.Id.ToString()] = evaluated;
        }
        catch (Exception ex)
        {
            result[formula.Id.ToString()] = new FormulaError(ex.Message);
        }
    }
    return result;
}
```

### Pattern 2: Field Registry for System Fields
**What:** A static registry mapping entity type -> system field names with their types. Used by (a) the formula editor autocomplete, (b) formula validation to verify field references exist, (c) formula evaluation to build the parameter dictionary.
**When to use:** Formula creation/edit, formula evaluation, autocomplete API.
**Example:**
```csharp
// FieldRegistryService -- similar to MergeFieldService pattern already in codebase
public record FieldInfo(string Name, string Label, string DataType, string Category);

public List<FieldInfo> GetSystemFields(string entityType) => entityType switch
{
    "Deal" => new()
    {
        new("title", "Title", "text", "System"),
        new("value", "Value", "number", "System"),
        new("probability", "Probability", "number", "System"),
        new("expectedCloseDate", "Close Date", "date", "System"),
        new("createdAt", "Created At", "date", "System"),
        new("updatedAt", "Updated At", "date", "System"),
        // ...
    },
    "Contact" => new() { /* ... */ },
    // etc.
};
```

### Pattern 3: Topological Sort for Formula Chaining
**What:** When multiple formula fields exist for an entity, they must be evaluated in dependency order. Formula A referencing Formula B's output requires B to be evaluated first. A directed graph of formula dependencies is built, then topologically sorted. Cycles are detected and reported as errors.
**When to use:** (a) Validation at formula creation time, (b) Evaluation ordering at read time.
**Example:**
```csharp
public List<CustomFieldDefinition> TopologicalSort(List<CustomFieldDefinition> formulas)
{
    // Build adjacency: formula -> set of formula IDs it depends on
    var graph = new Dictionary<Guid, HashSet<Guid>>();
    var formulaIds = formulas.Select(f => f.Id).ToHashSet();

    foreach (var formula in formulas)
    {
        var deps = new HashSet<Guid>();
        var referencedParams = GetReferencedParameters(formula.FormulaExpression);
        foreach (var param in referencedParams)
        {
            // Check if this parameter refers to another formula field
            var dep = formulas.FirstOrDefault(f => f.Id.ToString() == param || f.Name == param);
            if (dep != null) deps.Add(dep.Id);
        }
        graph[formula.Id] = deps;
    }

    // Kahn's algorithm for topological sort
    var inDegree = formulas.ToDictionary(f => f.Id, _ => 0);
    foreach (var (_, deps) in graph)
        foreach (var dep in deps)
            if (inDegree.ContainsKey(dep)) inDegree[dep]++;

    var queue = new Queue<Guid>(inDegree.Where(kv => kv.Value == 0).Select(kv => kv.Key));
    var sorted = new List<CustomFieldDefinition>();

    while (queue.Count > 0)
    {
        var id = queue.Dequeue();
        sorted.Add(formulas.First(f => f.Id == id));
        foreach (var dependent in graph.Where(g => g.Value.Contains(id)).Select(g => g.Key))
        {
            inDegree[dependent]--;
            if (inDegree[dependent] == 0) queue.Enqueue(dependent);
        }
    }

    if (sorted.Count != formulas.Count)
        throw new CircularDependencyException("Circular reference detected in formula fields.");

    return sorted;
}
```

### Pattern 4: Formula Error Serialization
**What:** When formula evaluation fails (division by zero, null field, type mismatch), the value in `CustomFields` is set to a serializable error marker. The frontend renders it as `#ERR` with a tooltip.
**When to use:** Any evaluation failure.
**Example:**
```csharp
// Backend: error stored as special dictionary in CustomFields
result[formula.Id.ToString()] = new Dictionary<string, object?>
{
    ["__formulaError"] = true,
    ["message"] = "Division by zero"
};

// Frontend: in dynamic-table getCellValue or via pipe
if (value?.__formulaError) {
    return { display: '#ERR', tooltip: value.message };
}
```

### Pattern 5: Formula Editor with Autocomplete (Frontend)
**What:** A text input where typing `[` triggers a dropdown of available fields. Real-time validation calls a backend API endpoint. Live preview shows the computed result.
**When to use:** Admin custom field creation/edit dialog when FieldType is Formula.
**Example structure:**
```typescript
// formula-editor.component.ts
@Component({
  selector: 'app-formula-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormulaEditorComponent {
  entityType = input.required<string>();
  formula = input<string>('');
  formulaChange = output<string>();

  // Available fields loaded from FieldRegistry API
  availableFields = signal<FieldInfo[]>([]);
  showAutocomplete = signal(false);
  autocompleteFilter = signal('');

  // Validation state
  validationErrors = signal<string[]>([]);
  previewResult = signal<any>(null);
  previewError = signal<string | null>(null);

  // Group fields by category for autocomplete dropdown
  groupedFields = computed(() => {
    const fields = this.availableFields();
    return {
      system: fields.filter(f => f.category === 'System'),
      custom: fields.filter(f => f.category === 'Custom'),
      formula: fields.filter(f => f.category === 'Formula'),
    };
  });
}
```

### Anti-Patterns to Avoid
- **Client-side formula evaluation:** Explicitly listed as an anti-feature in FEATURES.md. Always compute server-side. Client only displays read-only results.
- **Cross-entity field references:** Explicitly deferred. Formulas reference only fields on the same entity type. No `[deal.company.name]` references.
- **Storing computed values in JSONB:** The decision is compute-on-read, not compute-on-write. Do not persist formula results. This keeps data consistent but means formula evaluation happens on every read.
- **Exposing NCalc syntax directly to users:** The user-facing syntax is square brackets `[field_name]` with simple functions (IF, DATEDIFF, CONCAT). Internally these map to NCalc parameters and custom functions, but the admin never sees NCalc internals.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expression parsing | Custom tokenizer/lexer/parser | NCalc (Parlot-based) | Operator precedence, parenthesis nesting, type coercion, error handling -- all solved |
| Syntax validation | Regex-based formula checking | NCalc `HasErrors()` + `Error` property | NCalc's parser catches all syntax errors with clear messages |
| Parameter extraction | Regex to find `[field_name]` patterns | NCalc `GetParametersNames()` | Handles edge cases like nested expressions, function arguments containing parameters |
| Circular dependency detection | Manual graph walking | Kahn's algorithm (topological sort) | Well-known O(V+E) algorithm, handles all cycle shapes, simple to implement |
| Autocomplete dropdown | Custom dropdown from scratch | Angular CDK Overlay + MatAutocomplete | Already used elsewhere in the codebase (e.g., contact linking in deal-detail), consistent UX |

**Key insight:** The expression evaluation problem is deceptively complex. Edge cases include: operator precedence, nested parentheses, type coercion (string vs number), null handling, date arithmetic, division by zero, and circular references. NCalc handles the first 6; we only need to add custom functions and circular detection.

## Common Pitfalls

### Pitfall 1: Null Field Values Causing Evaluation Failures
**What goes wrong:** A formula `[value] * [probability]` fails when `value` is null (deal has no value set). Every evaluation throws an exception.
**Why it happens:** NCalc treats null parameters as missing, which causes `EvaluationException`.
**How to avoid:** Before evaluation, coerce null numeric fields to 0, null strings to empty string, null dates to a sentinel. Or use NCalc's `DynamicParameters` to provide lazy defaults. Document that `#ERR` with "Missing field value" is the expected result for null references.
**Warning signs:** Lots of `#ERR` values in tables where fields are optional.

### Pitfall 2: Performance Degradation on List Pages
**What goes wrong:** A list page loads 25-100 entities. Each entity requires loading formula definitions, building parameters, and evaluating expressions. With 5 formula fields and 100 rows, that's 500 NCalc evaluations per page load.
**Why it happens:** Compute-on-read means no caching. Every API call re-evaluates.
**How to avoid:** (a) Load formula definitions once per request, not per entity. (b) Pre-compile NCalc expressions (they are cached automatically via WeakReference). (c) For list endpoints, batch-evaluate: load all formulas for the entity type once, then iterate rows. (d) Consider per-request caching of formula definitions using HttpContext.Items or a scoped service.
**Warning signs:** List page API response times increasing with more formula fields.

### Pitfall 3: Circular Dependency Not Caught at Save Time
**What goes wrong:** Admin creates Formula A referencing Formula B, then later edits Formula B to reference Formula A. No validation catches this because each was valid when saved.
**Why it happens:** Validation only checks the formula being saved, not the entire dependency graph.
**How to avoid:** On every formula save, rebuild the FULL dependency graph for all formulas on that entity type, then run topological sort. If the sort fails, reject the save with "Circular reference detected: A -> B -> A".
**Warning signs:** Infinite loops or stack overflows during evaluation.

### Pitfall 4: Field Reference Resolution Ambiguity
**What goes wrong:** A system field and a custom field have the same name (e.g., admin creates custom field named "value" on Deal entity which already has a `Value` system field). Formula `[value]` is ambiguous.
**Why it happens:** System fields use camelCase property names, custom fields use GUID IDs or snake_case names, but the admin might create a custom field with the same display name.
**How to avoid:** Use distinct namespacing in the formula syntax. System fields use their property name: `[value]`, `[probability]`. Custom fields use their definition ID (GUID): `[<guid>]`. Formula fields also use their ID. The autocomplete populates the correct reference. Alternatively, use `[cf_fieldname]` prefix for custom fields.
**Warning signs:** Wrong field value used in formula computation.

### Pitfall 5: Formula Expression Stored but NCalc Syntax Differs from User Display
**What goes wrong:** The user sees `[Deal Value] * [Probability]` but NCalc stores `[value] * [probability]`. If the display-to-internal mapping is inconsistent, formulas break silently.
**Why it happens:** The autocomplete inserts human-readable labels but the backend expects internal names.
**How to avoid:** The autocomplete inserts internal field references (the parameter name), NOT the display label. The editor shows `[value] * [probability]` not `[Deal Value] * [Probability]`. Display labels appear in the autocomplete dropdown but the inserted text is the field reference key.
**Warning signs:** Formulas that worked in preview fail after save.

### Pitfall 6: Type Coercion Between Different Field Types
**What goes wrong:** Formula `IF([status] == "won", [value], 0)` fails because `status` is an enum/string and the comparison doesn't work as expected.
**Why it happens:** NCalc uses .NET type comparison rules. JSONB values come back as `JsonElement` objects, not native .NET types.
**How to avoid:** When building the parameter dictionary, convert all values to their expected .NET types: numbers to `decimal`, dates to `DateTime`, strings to `string`, booleans to `bool`. Do this conversion in the parameter-building step, not in the expression itself.
**Warning signs:** Formulas returning unexpected results for comparisons.

## Code Examples

### Backend: Extending CustomFieldDefinition Entity
```csharp
// Domain/Entities/CustomFieldDefinition.cs -- new properties
public class CustomFieldDefinition
{
    // ... existing properties ...

    /// <summary>
    /// Formula expression string (only for Formula field type).
    /// e.g., "[value] * [probability] / 100"
    /// </summary>
    public string? FormulaExpression { get; set; }

    /// <summary>
    /// Expected result type for the formula (number, text, date).
    /// Used for display formatting on the frontend.
    /// </summary>
    public string? FormulaResultType { get; set; }

    /// <summary>
    /// Cached list of field IDs this formula depends on.
    /// Used for topological sorting and dependency validation.
    /// Stored as JSONB array.
    /// </summary>
    public List<string>? DependsOnFieldIds { get; set; }
}
```

### Backend: FormulaEvaluationService Core
```csharp
// Source: NCalc documentation + codebase patterns
using NCalc;

public class FormulaEvaluationService
{
    private readonly ICustomFieldRepository _fieldRepo;
    private readonly FieldRegistryService _fieldRegistry;

    public async Task<Dictionary<string, object?>> EvaluateFormulasForEntityAsync(
        string entityType,
        object entity,  // the domain entity
        Dictionary<string, object?> customFields)
    {
        var formulaFields = await _fieldRepo.GetFieldsByEntityTypeAsync(entityType);
        var formulas = formulaFields
            .Where(f => f.FieldType == CustomFieldType.Formula)
            .ToList();

        if (formulas.Count == 0) return customFields;

        // Topological sort for dependency order
        var sorted = TopologicalSort(formulas);

        // Build system field parameters from entity reflection
        var systemParams = _fieldRegistry.ExtractEntityValues(entityType, entity);

        // Merge custom fields into parameter dictionary
        var allParams = new Dictionary<string, object?>(systemParams);
        foreach (var (key, value) in customFields)
            allParams[key] = ConvertJsonValue(value);

        // Evaluate each formula in order
        var result = new Dictionary<string, object?>(customFields);
        foreach (var formula in sorted)
        {
            var evaluated = EvaluateSingle(formula, allParams);
            result[formula.Id.ToString()] = evaluated;
            allParams[formula.Id.ToString()] = evaluated; // available for chained formulas
        }

        return result;
    }

    private object? EvaluateSingle(CustomFieldDefinition formula, Dictionary<string, object?> parameters)
    {
        try
        {
            var expr = new Expression(formula.FormulaExpression!);

            foreach (var (key, value) in parameters)
                expr.Parameters[key] = value ?? DBNull.Value;

            RegisterCustomFunctions(expr);

            var result = expr.Evaluate();
            return result;
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

    private void RegisterCustomFunctions(Expression expr)
    {
        expr.Functions["DATEDIFF"] = (args) =>
        {
            var date1 = Convert.ToDateTime(args[0].Evaluate());
            var date2 = Convert.ToDateTime(args[1].Evaluate());
            return (date2 - date1).Days;
        };

        expr.Functions["CONCAT"] = (args) =>
        {
            return string.Join("", args.Select(a => a.Evaluate()?.ToString() ?? ""));
        };
    }
}
```

### Backend: Validation Endpoint
```csharp
// Added to CustomFieldsController
[HttpPost("validate-formula")]
[Authorize(Roles = "Admin")]
public async Task<IActionResult> ValidateFormula([FromBody] ValidateFormulaRequest request)
{
    var errors = await _formulaValidationService.ValidateAsync(
        request.EntityType, request.Expression, request.ExcludeFieldId);

    if (errors.Count > 0)
        return Ok(new { valid = false, errors });

    // Try evaluating with sample data
    var preview = await _formulaValidationService.PreviewAsync(
        request.EntityType, request.Expression, request.SampleEntityId);

    return Ok(new { valid = true, preview = preview.Value, previewError = preview.Error });
}
```

### Frontend: Formula Editor Component (Skeleton)
```typescript
// formula-editor.component.ts
@Component({
  selector: 'app-formula-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="formula-editor">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Formula Expression</mat-label>
        <textarea matInput
                  [formControl]="formulaControl"
                  (keyup)="onKeyUp($event)"
                  rows="3"
                  placeholder="e.g. [value] * [probability] / 100">
        </textarea>
        @if (validationErrors().length > 0) {
          <mat-error>{{ validationErrors()[0] }}</mat-error>
        }
        <mat-hint>Type [ to insert a field reference</mat-hint>
      </mat-form-field>

      <!-- Autocomplete dropdown -->
      @if (showAutocomplete()) {
        <div class="autocomplete-panel">
          <!-- System Fields group -->
          <!-- Custom Fields group -->
          <!-- Formula Fields group -->
        </div>
      }

      <!-- Live Preview -->
      <div class="formula-preview">
        @if (isValidating()) {
          <mat-spinner diameter="16"></mat-spinner>
        } @else if (previewError()) {
          <span class="preview-error">#ERR: {{ previewError() }}</span>
        } @else if (previewResult() !== null) {
          <span class="preview-result">Result: {{ previewResult() }}</span>
        }
      </div>
    </div>
  `,
})
export class FormulaEditorComponent { /* ... */ }
```

## Discretion Recommendations

### Editor Location: Inline in Custom Field Dialog
**Recommendation:** Extend the existing `custom-field-edit-dialog.component.ts` with a formula-specific section (like `showOptions()` for Dropdown). This is consistent with how other field types show type-specific configuration inline. No need for a dedicated page.
**Rationale:** The dialog already handles type-specific sections (`showTextValidation`, `showNumberValidation`, `showOptions`, `showRelation`). Adding `showFormula` follows the same pattern. A separate page would break the admin's mental model.

### Output Format: Admin-Selected Result Type
**Recommendation:** Add a `FormulaResultType` dropdown with options: Number, Text, Date. This controls frontend display formatting (currency pipe, date pipe, etc.). Auto-detection is unreliable (is `365` a number or days?).
**Rationale:** Simple, explicit, and covers all cases. The admin knows the expected output type when writing the formula.

### Formula Columns: Display-Only (Not Sortable/Filterable)
**Recommendation:** Formula columns should be display-only in dynamic tables -- not sortable or filterable. This is already the pattern for custom fields (`sortable: false` in `buildColumnDefinitions()`).
**Rationale:** Formula values are computed on-read and not stored in the database. Server-side sorting/filtering would require evaluating every formula for every row in the table, which is prohibitively expensive for large datasets. This matches Pipedrive's behavior where formula fields are display-only.

### Nested Conditionals: Support IF inside IF
**Recommendation:** Support nested IF. NCalc handles this natively (`if(if(x>1,true,false), 'a', 'b')` works). No extra work needed.
**Rationale:** Users expect it from spreadsheet experience. NCalc handles it for free.

### In-Editor Help: Tooltip Hints + Collapsible Cheat Sheet
**Recommendation:** Show a collapsible "Formula Help" panel below the editor with: (a) available functions and syntax, (b) example formulas, (c) field type notes. Also show inline tooltip hints on the autocomplete items.
**Rationale:** Balances discoverability with space efficiency. The help panel can be collapsed once the admin is familiar.

### Cross-Entity References: Same Entity Only
**Recommendation:** Same entity only, as decided. A Deal formula can reference Deal fields, not Company fields.
**Rationale:** Explicitly listed as an anti-feature in FEATURES.md. Cross-entity requires joins, cache invalidation, and dependency tracking across entities. Same-entity keeps it simple and performant.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NCalc 1.x (old Codeplex fork) | NCalcSync 5.x (Parlot parser, active development) | 2023 (major rewrite) | New package name, better performance, .NET 8/9 support |
| Store computed values on write | Compute on read (virtual) | Current consensus in CRM space | Simpler, always consistent, but compute cost on every read |

**Deprecated/outdated:**
- `ncalc` NuGet package (1.3.8) -- this is the OLD version. Use `NCalcSync` (5.x) which is the actively maintained successor.
- `NCalc2` (sklose/NCalc2) -- abandoned fork. Use the official `ncalc/ncalc` repository.

## Open Questions

1. **Field Reference Syntax: ID vs Name**
   - What we know: System fields will use camelCase property names (`value`, `probability`, `createdAt`). Custom fields could use either their GUID ID or their snake_case `name`.
   - What's unclear: Using GUIDs in formulas (`[3fa85f64-5717-4562-b3fc-2c963f66afa6]`) is ugly and fragile if definitions are recreated. Using names (`[custom_revenue]`) is readable but could conflict with system field names.
   - Recommendation: Use the custom field's `name` property (snake_case, unique per entity type per tenant) for readability. System fields use camelCase. No conflict because system fields are camelCase and custom fields are snake_case by convention (auto-generated from label). For formula fields referencing other formula fields, use the formula field's `name`. The `DependsOnFieldIds` stores resolved GUIDs for internal graph operations.

2. **NCalcSync .NET 10 Compatibility**
   - What we know: NCalcSync 5.11.0 targets .NET 8 and .NET Standard 2.0. GitHub shows .NET 10 work in progress (v5.9.0 release notes).
   - What's unclear: Whether the current NuGet release works on .NET 10 out of the box via .NET Standard 2.0 compatibility.
   - Recommendation: .NET Standard 2.0 packages are compatible with all .NET versions. Install and test -- if any issues, the active repo will have a fix quickly.

3. **Caching Formula Definitions**
   - What we know: Formula definitions are loaded from the database on every entity read. For list pages with 100 rows, this is one query (formulas are per entity type, not per entity).
   - What's unclear: Whether a per-request scoped cache is sufficient or if a short-TTL memory cache is needed.
   - Recommendation: Start with per-request loading (scoped service with memoization). The query is cheap (small table, indexed by entity type). Add memory caching only if profiling shows it's a bottleneck.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `CustomFieldDefinition.cs`, `CustomFieldType.cs`, `CustomFieldsController.cs`, `CustomFieldRepository.cs`, `DynamicTableComponent`, `CustomFieldFormComponent`, `MergeFieldService.cs` -- direct file reads of the existing custom field system
- [NCalc GitHub repository](https://github.com/ncalc/ncalc) -- project overview, feature list, .NET target frameworks
- [NCalc official documentation](https://ncalc.github.io/ncalc/articles/index.html) -- Expression class API, parameters, custom functions
- [NCalc functions documentation](https://ncalc.github.io/ncalc/articles/functions.html) -- built-in if(), math functions
- [NCalc wiki - Description](https://github.com/ncalc/ncalc/wiki/Description) -- HasErrors(), Error property, caching

### Secondary (MEDIUM confidence)
- [NCalcSync NuGet](https://www.nuget.org/packages/NCalcSync) -- version 5.11.0, framework targets verified
- [NCalc parameters documentation](https://ncalc.github.io/ncalc/articles/parameters.html) -- bracket syntax, GetParametersNames()
- [PanoramicData.NCalcExtensions](https://github.com/panoramicdata/PanoramicData.NCalcExtensions) -- reference for CONCAT and DATEDIFF custom function patterns
- `.planning/research/FEATURES.md` -- prior research on formula fields including anti-features and dependency analysis

### Tertiary (LOW confidence)
- NCalc .NET 10 support -- inferred from GitHub release notes mentioning .NET 10 in v5.9.0, not verified on NuGet

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - NCalc is the de facto .NET expression evaluator, actively maintained, well-documented. Codebase patterns are clear and consistent.
- Architecture: HIGH - The compute-on-read pattern is well-understood. The existing custom field system provides a clean extension point. MergeFieldService demonstrates the field registry pattern.
- Pitfalls: HIGH - Based on direct analysis of the codebase's DTO mapping patterns, JSONB value types, and NCalc's known limitations with null handling and type coercion.

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain, NCalc is mature)
