---
status: testing
phase: 13-leads
source: 13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md
started: 2026-02-19T10:00:00Z
updated: 2026-02-19T10:00:00Z
---

## Current Test

number: 1
name: Leads in Navbar and List Page Load
expected: |
  Clicking "Leads" in the navbar CRM group (should appear between Contacts and Products with a person_search icon) navigates to /leads. The page loads a dynamic table showing seed leads with columns: Name, Email, Company, Stage, Source, Temperature, Owner, Created. Pagination, sorting, and search are functional.
awaiting: user response

## Tests

### 1. Leads in Navbar and List Page Load
expected: Clicking "Leads" in the navbar CRM group navigates to /leads. Dynamic table loads with seed leads showing columns (Name, Email, Company, Stage, Source, Temperature, Owner, Created). Pagination, sorting, and search are available.
result: [pending]

### 2. Kanban Board View
expected: Toggle to Kanban view from the list page. Leads appear organized in stage columns (New, Contacted, Qualified, Lost, Converted). Each card shows lead name, company, source, temperature badge (colored pill: red=Hot, orange=Warm, blue=Cold), owner initials, and days-in-stage.
result: [pending]

### 3. Kanban Forward-Only Drag
expected: Drag a lead card from an earlier stage (e.g., New) to a later stage (e.g., Contacted) — the move succeeds. Try dragging a lead backward (e.g., Contacted to New) — a snackbar message rejects the move. Try dropping a lead on the Converted column — it is rejected with a message to use the Convert Lead action.
result: [pending]

### 4. Create New Lead
expected: Click "New Lead" (or + button). A form appears with fields for First Name, Last Name, Email, Phone, Company Name, Stage selector, Source selector, Temperature toggle (Hot/Warm/Cold with color coding), Owner dropdown (defaults to current user), and custom fields. Submitting creates the lead and it appears in the list.
result: [pending]

### 5. Lead Detail Page with Stage Stepper
expected: Click on a lead name in the list or Kanban. Detail page loads showing lead name, temperature badge, source chip, owner info, and a horizontal pipeline stepper. Past stages show checkmarks, current stage is highlighted, future stages are clickable. Clicking a future stage advances the lead with a confirmation prompt.
result: [pending]

### 6. Lead Detail Entity Tabs
expected: The detail page has tabs: Overview (lead details grid), Activities, Notes, Attachments, and Timeline. Each tab loads its respective content. The Conversion tab only appears for converted leads.
result: [pending]

### 7. Edit Existing Lead
expected: From the detail page, click Edit. The form loads pre-filled with the lead's current data. Change a field (e.g., temperature or company name), save. The detail page reflects the updated values.
result: [pending]

### 8. Convert Lead to Contact
expected: On a qualified lead's detail page, click "Convert Lead". A dialog opens with three sections: Contact (required, pre-filled from lead data), Company (optional toggle — link existing via autocomplete or create new), and Deal (optional toggle with pipeline selection). Duplicate warnings may appear for matching emails/company names. Submitting converts the lead.
result: [pending]

### 9. Converted Lead State
expected: After conversion, the lead shows a green "Converted" banner. The stage stepper shows the Converted stage as terminal. A Conversion tab appears with links to the created Contact (and Company/Deal if created). The lead becomes read-only — Edit and Convert buttons are hidden/disabled.
result: [pending]

### 10. Saved Views on Lead List
expected: On the lead list page, configure a filter or column arrangement, then save it as a View. The saved View appears in the sidebar and can be re-selected to restore the configuration.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
