# Phase 15: Formula / Computed Custom Fields - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can define formula-based custom fields that automatically compute values from other fields on the same entity. Values are computed on-read (server-side) and displayed as read-only columns in dynamic tables, detail pages, and all existing views. Formula fields extend the existing custom field system — no new entity types or pages are introduced.

</domain>

<decisions>
## Implementation Decisions

### Formula Editor UX
- Text input with autocomplete — typing `[` triggers a dropdown of available fields
- Real-time validation as admin types — syntax errors, unknown field references, and circular dependencies flagged inline immediately
- Live preview panel shows computed result using sample/real entity data, updating as the formula changes
- Autocomplete dropdown groups fields by category: System Fields (Value, Status, CreatedAt...) then Custom Fields

### Expression Syntax & Functions
- Field reference syntax: square brackets — `[deal_value] * [probability] / 100`
- Essential function library only (~10 functions): arithmetic operators (+, -, *, /), IF/THEN/ELSE conditional, DATEDIFF for date differences, CONCAT for string concatenation
- Keep scope tight at launch — can extend function library in future iterations

### Result Display & Formatting
- Errors display as '#ERR' with tooltip showing the reason (e.g., "Division by zero", "Missing field value") — spreadsheet-familiar pattern
- Formula results are UI only for now — excluded from CSV exports. Phase 20 (Advanced Reporting) will handle formula fields in reports
- Formula columns appear as read-only in dynamic tables and detail pages

### Field References & Chaining
- Formulas can reference both system fields (Value, CreatedAt, Status, etc.) and custom JSONB fields on the same entity
- Formula chaining supported — Formula A can reference Formula B's result
- Dependency graph tracked with circular reference detection via topological sort
- Autocomplete groups fields by category (System Fields, Custom Fields, Formula Fields) for easy discovery

### Claude's Discretion
- Editor location in admin UI (inline in custom field dialog vs. dedicated page)
- Output format configuration approach (admin-selected vs. auto-detected from expression)
- Whether formula columns are sortable/filterable in dynamic tables or display-only
- Nested conditional support (IF inside IF) vs. flat only
- In-editor help/documentation approach (collapsible panel vs. tooltip hints)
- Cross-entity field references (same entity only vs. allow parent entity fields)

</decisions>

<specifics>
## Specific Ideas

- Excel/spreadsheet feel for the formula experience — square brackets, '#ERR' errors, autocomplete on typing
- Live preview with sample data so admins see the result before saving
- Grouped field picker mirrors how fields are organized elsewhere in the system

</specifics>

<deferred>
## Deferred Ideas

- Formula fields in CSV exports — extend when export infrastructure is revisited
- Formula fields in reports — Phase 20 (Advanced Reporting Builder) will integrate formula columns
- Extended function library (ROUND, ABS, MIN, MAX, etc.) — future iteration based on user demand

</deferred>

---

*Phase: 15-formula-computed-custom-fields*
*Context gathered: 2026-02-19*
