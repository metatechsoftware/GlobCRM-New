# Requirements: GlobCRM

**Defined:** 2026-02-20
**Core Value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.

## v1.3 Requirements

Requirements for v1.3 Platform & Polish. Each maps to roadmap phases.

### Localization

- [ ] **LOCL-01**: User can switch UI language between English and Turkish at runtime without page reload
- [ ] **LOCL-02**: User's language preference persists across sessions (saved to profile)
- [ ] **LOCL-03**: All UI strings (labels, buttons, messages, tooltips) render in the selected language via translation pipe
- [ ] **LOCL-04**: Date, number, and currency values format according to selected locale (Turkish: dd.MM.yyyy, comma decimal)
- [ ] **LOCL-05**: Translation files lazy-load per feature scope (only load contact translations when on contacts page)
- [ ] **LOCL-06**: Missing translations fall back to English without showing broken keys
- [ ] **LOCL-07**: Admin can set a default language for the organization (new users inherit it)
- [ ] **LOCL-08**: Angular Material components (paginator, sort headers, date picker) display labels in selected language
- [ ] **LOCL-09**: CI check validates EN and TR translation files have matching key sets
- [ ] **LOCL-10**: All existing v1.0-v1.2 hardcoded strings extracted to translation files (EN + TR)

### Integration Marketplace

- [ ] **INTG-01**: User can browse available integrations as a card-based grid with logos, descriptions, and status badges
- [ ] **INTG-02**: User can filter integrations by category (Communication, Accounting, Marketing, Storage, Calendar, Developer Tools)
- [ ] **INTG-03**: User can search integrations by name
- [ ] **INTG-04**: Admin can connect an integration by entering API key credentials via a dialog
- [ ] **INTG-05**: Admin can disconnect an integration with confirmation
- [ ] **INTG-06**: Stored credentials are AES-256 encrypted with tenant-scoped isolation
- [ ] **INTG-07**: API never returns full credentials — only masked values (last 4 chars)
- [ ] **INTG-08**: User can view integration details in a slide-in panel (description, status, credential info, activity log)
- [ ] **INTG-09**: Admin can test an integration connection (validates stored credentials)
- [ ] **INTG-10**: Integration activity log records connect/disconnect/test events with user and timestamp
- [ ] **INTG-11**: Popular/featured integrations display a badge on their cards
- [ ] **INTG-12**: Non-admin users can view integration status (read-only) but cannot connect/disconnect

### Kanban Boards

- [ ] **KANB-01**: User can create, edit, and delete custom Kanban boards with name, description, and color
- [ ] **KANB-02**: User can add, rename, reorder, and delete columns on a board
- [ ] **KANB-03**: User can create, edit, and archive cards with title, description, due date, and assignee
- [ ] **KANB-04**: User can drag-and-drop cards between columns and reorder within columns (optimistic UI)
- [ ] **KANB-05**: User can set board visibility: Private (creator only), Team (team members), or Public (all tenant users)
- [ ] **KANB-06**: User can assign colored labels to cards for categorization
- [ ] **KANB-07**: User can assign a team member to a card (avatar displayed on card face)
- [ ] **KANB-08**: Cards display due date with urgency indicator (yellow approaching, red overdue)
- [ ] **KANB-09**: Existing deal pipeline and activity boards appear as System Boards on the unified boards page
- [ ] **KANB-10**: User can optionally link a card to any CRM entity (Contact, Company, Deal, Lead, etc.)
- [ ] **KANB-11**: Entity-linked cards display entity name and icon, with click-to-preview via existing sidebar
- [ ] **KANB-12**: User can write rich text descriptions on cards via the existing rich text editor
- [ ] **KANB-13**: Columns display WIP (work-in-progress) limit with visual warning when exceeded
- [ ] **KANB-14**: User can create a board from predefined templates (Sprint, Content Calendar, Sales Follow-up)
- [ ] **KANB-15**: User can add checklist items to a card with progress indicator on card face
- [ ] **KANB-16**: User can comment on cards with threaded discussion
- [ ] **KANB-17**: User can filter visible cards by label, assignee, or due date
- [ ] **KANB-18**: Empty boards page shows a create prompt with template suggestions

### Quote PDF Templates

- [ ] **QTPL-01**: User can create quote PDF templates using a drag-and-drop visual editor (Unlayer document mode)
- [ ] **QTPL-02**: User can insert CRM merge fields into templates (quote, company, contact, deal fields)
- [ ] **QTPL-03**: Templates include a line items table that auto-expands with quote products, quantities, discounts, and totals
- [ ] **QTPL-04**: User can preview a template rendered with real quote data before generating the PDF
- [ ] **QTPL-05**: User can generate and download a PDF from a quote using a selected template
- [ ] **QTPL-06**: User can create multiple templates and set one as default for new quotes
- [ ] **QTPL-07**: User can clone an existing template to create a variant
- [ ] **QTPL-08**: Template list shows thumbnail previews for visual identification
- [ ] **QTPL-09**: User can configure page size (A4/Letter) and orientation (portrait/landscape) per template
- [ ] **QTPL-10**: Organization branding (logo, name, address) available as merge fields in templates
- [ ] **QTPL-11**: Quotes without a custom template fall back to the existing QuestPDF-generated layout
- [ ] **QTPL-12**: User can manage quote templates from a dedicated templates section under quotes

## Future Requirements

Deferred to v1.4+. Tracked but not in current roadmap.

### Integrations

- **INTG-F01**: Real third-party API integrations (WhatsApp, Instagram, Slack, Mailchimp, QuickBooks)
- **INTG-F02**: OAuth redirect flow for OAuth-based integrations
- **INTG-F03**: Bidirectional data sync between CRM and external services
- **INTG-F04**: Webhook auto-creation when connecting an integration

### Kanban Boards

- **KANB-F01**: Card file attachments (upload files directly to cards)
- **KANB-F02**: Board automations (trigger actions on card moves)
- **KANB-F03**: Calendar view of board cards by due date
- **KANB-F04**: Swimlanes (horizontal rows within columns)

### Quote PDF Templates

- **QTPL-F01**: Conditional sections based on quote data (show/hide sections)
- **QTPL-F02**: E-signature integration (DocuSign, Adobe Sign)
- **QTPL-F03**: Template version history with revert capability
- **QTPL-F04**: Template sharing across tenants (marketplace)

### Localization

- **LOCL-F01**: Additional languages beyond English + Turkish
- **LOCL-F02**: Full backend error message localization
- **LOCL-F03**: Pluralization support via ICU MessageFormat

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real third-party API integrations | Each integration is its own project; v1.3 is infrastructure only |
| OAuth redirect flows | Only API key credential type in v1.3; OAuth when real integrations ship |
| Per-integration configuration UI | Build when real integrations ship, not for infrastructure phase |
| Marketplace app submission / third-party plugins | Integrations are admin-seeded catalog entries only |
| Card file attachments on Kanban | Storage complexity; use entity-linked cards for attachment access |
| Board automations (card move triggers) | Build on workflow engine in future version |
| Swimlanes on Kanban boards | Use labels and filtering for categorization |
| Custom Unlayer blocks for line items | Use pre-rendered HTML injection via Fluid loop instead |
| Real-time data preview in Unlayer editor | Separate preview button/dialog instead |
| E-signature on quote PDFs | Future integration marketplace item |
| Template sharing across tenants | Templates are per-tenant only |
| Machine translation | Professional human translations for domain-specific CRM terminology |
| Per-field locale on CRM entities | UI i18n only; entity data stays as-entered |
| Translating user-generated content | Feed posts, notes, comments display as-is |
| More than 2 languages in v1.3 | English + Turkish only; architecture supports adding more later |
| RTL layout support | Turkish is LTR; RTL needed only if Arabic/Hebrew added later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOCL-01 | Phase 27 | Pending |
| LOCL-02 | Phase 27 | Pending |
| LOCL-03 | Phase 28 | Pending |
| LOCL-04 | Phase 27 | Pending |
| LOCL-05 | Phase 27 | Pending |
| LOCL-06 | Phase 27 | Pending |
| LOCL-07 | Phase 27 | Pending |
| LOCL-08 | Phase 27 | Pending |
| LOCL-09 | Phase 28 | Pending |
| LOCL-10 | Phase 28 | Pending |
| INTG-01 | Phase 29 | Pending |
| INTG-02 | Phase 29 | Pending |
| INTG-03 | Phase 29 | Pending |
| INTG-04 | Phase 29 | Pending |
| INTG-05 | Phase 29 | Pending |
| INTG-06 | Phase 29 | Pending |
| INTG-07 | Phase 29 | Pending |
| INTG-08 | Phase 29 | Pending |
| INTG-09 | Phase 29 | Pending |
| INTG-10 | Phase 29 | Pending |
| INTG-11 | Phase 29 | Pending |
| INTG-12 | Phase 29 | Pending |
| KANB-01 | Phase 30 | Pending |
| KANB-02 | Phase 30 | Pending |
| KANB-03 | Phase 30 | Pending |
| KANB-04 | Phase 30 | Pending |
| KANB-05 | Phase 30 | Pending |
| KANB-06 | Phase 30 | Pending |
| KANB-07 | Phase 30 | Pending |
| KANB-08 | Phase 30 | Pending |
| KANB-09 | Phase 30 | Pending |
| KANB-10 | Phase 30 | Pending |
| KANB-11 | Phase 30 | Pending |
| KANB-12 | Phase 30 | Pending |
| KANB-13 | Phase 30 | Pending |
| KANB-14 | Phase 30 | Pending |
| KANB-15 | Phase 30 | Pending |
| KANB-16 | Phase 30 | Pending |
| KANB-17 | Phase 30 | Pending |
| KANB-18 | Phase 30 | Pending |
| QTPL-01 | Phase 31 | Pending |
| QTPL-02 | Phase 31 | Pending |
| QTPL-03 | Phase 31 | Pending |
| QTPL-04 | Phase 31 | Pending |
| QTPL-05 | Phase 31 | Pending |
| QTPL-06 | Phase 31 | Pending |
| QTPL-07 | Phase 31 | Pending |
| QTPL-08 | Phase 31 | Pending |
| QTPL-09 | Phase 31 | Pending |
| QTPL-10 | Phase 31 | Pending |
| QTPL-11 | Phase 31 | Pending |
| QTPL-12 | Phase 31 | Pending |

**Coverage:**
- v1.3 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-21 after roadmap creation (traceability populated)*
