---
name: globcrm-domain-map
description: Background knowledge: required GlobCRM page map + reusable shared modules.
user-invocable: false
---
This skill provides the **required GlobCRM feature map** (derived from the reference directory `src/app/pages/globcrm/`) and the cross-cutting modules that should remain reusable.

## Required GlobCRM pages (feature-level)

### Auth
- `auth/login`: login UI and basic auth gating entrypoint.

### Dashboards
- `dashboards/my-account`: personal dashboard (KPIs, quick links, “my work”).
- `dashboards/company`: company-centric dashboard (company KPIs, recent activity).

### Core CRM data
- `companylist`: companies listing with create/edit, filtering/search, and the ability to link related contacts; supports attachments.
- `contacts`: contacts sidebar list + details pane; create/edit/delete; company association; import support.

### Work and collaboration
- `activities`: activity/task management with assignees, due dates, status, rich text notes, and attachments.
- `notes`: notes with status/tags, attachments, confirmation prompts; can generate/emit an activity from a note.
- `calendar`: schedule view with a desktop grid + mobile view; create/edit events; attendee assignment; drag-and-drop; event colors.

### Commercial objects
- `products`: product listing with search, pagination, stock/status tags, price display; add/edit via product form; supports image attachments and importing.
- `products/product-form`: add/edit product.
- `quotes`: quotes listing with search; add/edit via dialog; supports PDF attachments and preview; links to companies/contacts and quote line items.
- `sales-kanban`: board-based pipeline (boards, lists, cards) with dialogs for labels, members, dates, checklists, attachments; supports Trello import; board create/update and switching.

### Requests and tracking
- `requests`: templated requests (form-driven), dates, options, and recipient assignment.
- `targets`: targets dashboard with KPI cards and tracking charts.

### Communication
- `mail`: mailbox-style UI with accounts, folders/categories, search, read view, compose with rich editor, drafts.
- `news-feed`: internal feed with posts, comments, attachments, polls, and interactions (like/share style behavior).

### Admin / configurability
- `dynamic-tables`: manage dynamic table definitions (create/update/delete) and render them via a shared dynamic table component.

## Shared reusable modules (must be portable)
- Attachments system: picker + preview + facade + entity attachment binding.
- Notifications: notification model/service + center dialog + detail dialog + notifications page.
- Import: generic import button and Trello import mapping/model.
- List search: consistent filtering/search UX used across lists.
- Relation input: reusable relation picker input.
- Users: assignee input + avatar stack (used in activities, calendar, requests, kanban, etc.).

## Modularity rules
- Treat `shared/*` as a reusable library. Domain pages should depend on shared, not vice versa.
- Integrations (email/whatsapp/etc.) must sit behind ports/adapters so they can be reused and mocked.
- Keep UI workflows consistent across pages (list → create/edit → attach/assign → notify).

Use this map whenever you:
- create requirements,
- plan routes,
- scaffold pages,
- or design reusable modules.
