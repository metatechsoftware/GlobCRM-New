---
name: scaffold-crm-page
description: Manual command: generate a modular scaffold plan for a CRM page/feature (list/forms/search/attachments/assignments).
disable-model-invocation: true
---
You are being asked to scaffold a CRM page/feature.

ARGUMENTS: $ARGUMENTS

## What to generate
Produce a *tech-agnostic* scaffold plan (no framework assumptions) that the developer can implement in any stack later.

Output exactly these sections:

1) **Purpose**
- What this page does and who uses it.

2) **User stories**
- 3 to 8 short stories.

3) **UI layout**
- Mobile layout
- Desktop layout
- Primary actions
- Empty states
- Error states

4) **Data & state**
- Entities involved
- Local state vs shared state
- Sorting/filtering/pagination/search behavior

5) **Core interactions**
- Create
- Edit
- Delete
- View details
- Import (if applicable)
- Attachments (if applicable)
- Assign users / relations (if applicable)

6) **Reusability hooks**
- Which parts should be generic components usable in other pages.

7) **Acceptance criteria**
- Bullet list with testable statements.

Notes:
- If the page resembles one of the GlobCRM required pages, align it to the GlobCRM domain map.
- Prefer consistent patterns (list + search + dialogs/forms) across the app.
