# Phase 31: Quote PDF Templates - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can design custom quote PDF templates with a visual drag-and-drop editor (Unlayer document mode) and generate professionally branded PDFs with real quote data. Includes template CRUD, clone, default selection, thumbnail previews, merge fields, configurable line items table, and Playwright-based PDF generation with QuestPDF fallback for the built-in default.

</domain>

<decisions>
## Implementation Decisions

### Template Editor UX
- Full-page editor layout: Unlayer takes full viewport width, toolbar on top, properties panel on right — dedicated design tool feel
- Merge field insertion via Unlayer's built-in merge tag toolbar dropdown — user clicks merge tag button, picks from categorized list (Quote, Company, Contact, Deal), inserts {{field_name}} placeholder
- Offer 2-3 pre-built starter templates with common quote structures (e.g., standard quote, detailed proposal, minimal invoice-style), but users can break out and go freeform
- Preview renders in a large modal overlay over the editor — shows rendered PDF with real quote data, dismiss to return to editing

### Line Items Table
- Configurable columns — user chooses which columns to show/hide per template (available: item name, description, quantity, unit price, discount %, tax rate, line total, SKU, notes)
- Summary rows: Claude's discretion based on existing quote model fields
- Table insertion method: Claude's discretion — pick the approach that works best with Unlayer document mode (custom block vs merge tag region)
- Table styling: Claude's discretion — balance between user control and consistency

### PDF Output & Branding
- Default page settings: A4 Portrait (210x297mm) for new templates, configurable to Letter and landscape per template
- Organization branding uses both with fallback: templates pull from org settings (logo, name, address) by default, but can override with per-template branding if needed
- Professional print-ready PDF quality — high-fidelity rendering matching the editor, suitable for printing and formal business use
- Playwright primary for custom templates (pixel-perfect HTML-to-PDF), QuestPDF fallback for the built-in default template (backward compatibility)

### Template Management
- Primary location under Settings > Quote Templates, with a "Manage Templates" shortcut link from the quote detail page
- Card grid layout with thumbnail previews — visual gallery showing template thumbnail, name, last modified, default badge
- Thumbnails generated server-side via Playwright PNG snapshot when template is saved — stored as file, served as image
- Clone creates instant copy with name "[Original] (Copy)" — no dialog, user can rename from the list

### Claude's Discretion
- Line items summary rows (based on existing quote model)
- Line items table insertion approach in Unlayer (custom block vs merge tags)
- Line items table styling approach (styleable vs inherited)
- Starter template designs and content
- Exact merge field categories and field names
- Template editor save behavior (auto-save vs manual)

</decisions>

<specifics>
## Specific Ideas

- Full-page editor should feel like a dedicated design tool (Mailchimp template editor reference)
- Starter templates provide good starting points but don't lock users into rigid structure
- Preview must show real quote data in a modal, not just placeholder text
- Thumbnail generation happens on save so the gallery always shows current state
- Clone is instant with auto-naming — optimized for speed, not ceremony

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-quote-pdf-templates*
*Context gathered: 2026-02-21*
