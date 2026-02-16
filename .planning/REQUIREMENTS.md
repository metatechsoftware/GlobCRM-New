# Requirements: GlobCRM

**Defined:** 2026-02-16
**Core Value:** Every entity page is a dynamic, user-configurable table with rich custom fields, saved Views, and relational navigation — making GlobCRM the single workspace where teams manage all customer relationships and operational work.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Multi-Tenancy

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: User session persists across browser refresh (JWT)
- [ ] **AUTH-05**: User can enable optional two-factor authentication (TOTP)
- [ ] **AUTH-06**: System resolves tenant from subdomain and isolates all data per organization
- [ ] **AUTH-07**: Admin can invite users to their organization via email
- [ ] **AUTH-08**: User can log out from any page

### User Management & RBAC

- [ ] **RBAC-01**: Admin can create custom roles with per-entity permissions (view/create/edit/delete)
- [ ] **RBAC-02**: Admin can set field-level access (hidden/read-only/editable) per role
- [ ] **RBAC-03**: Admin can assign roles to users
- [ ] **RBAC-04**: User can view and edit their own profile (name, avatar, preferences)
- [ ] **RBAC-05**: Admin can assign users to teams/departments
- [ ] **RBAC-06**: System enforces permissions across all API endpoints and UI elements

### Companies

- [ ] **COMP-01**: User can create, view, edit, and delete companies
- [ ] **COMP-02**: Company list page uses dynamic table with adjustable columns
- [ ] **COMP-03**: User can navigate from company to related contacts, deals, quotes, activities, and notes
- [ ] **COMP-04**: Company detail page shows entity timeline (activities, notes, emails, deals)
- [ ] **COMP-05**: Admin can define custom fields for companies

### Contacts

- [ ] **CONT-01**: User can create, view, edit, and delete contacts
- [ ] **CONT-02**: Contact list page uses dynamic table with adjustable columns
- [ ] **CONT-03**: User can link contacts to companies
- [ ] **CONT-04**: User can navigate from contact to related deals, activities, emails, quotes, and notes
- [ ] **CONT-05**: Contact detail page shows entity timeline
- [ ] **CONT-06**: Admin can define custom fields for contacts

### Products

- [ ] **PROD-01**: User can create, view, edit, and delete products
- [ ] **PROD-02**: Product list page uses dynamic table with adjustable columns
- [ ] **PROD-03**: Products have name, description, unit price, SKU, and category
- [ ] **PROD-04**: Admin can define custom fields for products
- [ ] **PROD-05**: Products are selectable as line items in quotes

### Deals (Pipeline)

- [ ] **DEAL-01**: User can create, view, edit, and delete deals
- [ ] **DEAL-02**: Deal list page uses dynamic table with adjustable columns
- [ ] **DEAL-03**: Admin can configure multiple pipelines with custom stages per team
- [ ] **DEAL-04**: User can view deals as Kanban board with drag-and-drop stage changes
- [ ] **DEAL-05**: User can view deals as list and calendar views
- [ ] **DEAL-06**: Deal tracks value, probability, expected close date, and assigned owner
- [ ] **DEAL-07**: User can link deals to contacts, companies, and products
- [ ] **DEAL-08**: Deal detail page shows entity timeline
- [ ] **DEAL-09**: Admin can define custom fields for deals
- [ ] **DEAL-10**: Pipeline stages have configurable probabilities and required fields

### Quotes

- [ ] **QUOT-01**: User can create, view, edit, and delete quotes
- [ ] **QUOT-02**: Quote list page uses dynamic table with adjustable columns
- [ ] **QUOT-03**: Quote has line items with product, quantity, unit price, discount, and tax
- [ ] **QUOT-04**: Quote calculates subtotal, discount total, tax total, and grand total
- [ ] **QUOT-05**: User can generate PDF from quote
- [ ] **QUOT-06**: User can version quotes (create new version from existing)
- [ ] **QUOT-07**: User can link quotes to deals and contacts
- [ ] **QUOT-08**: Admin can define custom fields for quotes

### Activities & Workflow

- [ ] **ACTV-01**: User can create activities (tasks, calls, meetings) with subject, description, and due date
- [ ] **ACTV-02**: Activity list page uses dynamic table with adjustable columns
- [ ] **ACTV-03**: Activities follow full workflow: assigned → accepted → in progress → review → done
- [ ] **ACTV-04**: User can assign activities to other users
- [ ] **ACTV-05**: User can add comments to activities
- [ ] **ACTV-06**: User can add attachments to activities
- [ ] **ACTV-07**: User can track time spent on activities
- [ ] **ACTV-08**: System maintains full audit trail on activities (who changed what, when)
- [ ] **ACTV-09**: User can view activities as list, board (Kanban), and calendar
- [ ] **ACTV-10**: User can follow/watch activities to receive notifications on changes
- [ ] **ACTV-11**: User can set priority levels on activities
- [ ] **ACTV-12**: User can link activities to contacts, companies, deals, quotes, and requests
- [ ] **ACTV-13**: Entity detail pages show activity timeline
- [ ] **ACTV-14**: Admin can define custom fields for activities

### Requests

- [ ] **REQS-01**: User can create, view, edit, and delete requests
- [ ] **REQS-02**: Request list page uses dynamic table with adjustable columns
- [ ] **REQS-03**: Requests have status workflow (new → in progress → resolved → closed)
- [ ] **REQS-04**: Requests have priority, category, and assigned owner
- [ ] **REQS-05**: User can link requests to contacts and companies
- [ ] **REQS-06**: Admin can define custom fields for requests

### Calendar

- [ ] **CALR-01**: User can view activities and events in day, week, and month calendar views
- [ ] **CALR-02**: User can create activities directly from calendar (click on time slot)
- [ ] **CALR-03**: User can drag-and-drop to reschedule activities on calendar
- [ ] **CALR-04**: Calendar shows activities from all linked entities (deals, contacts, etc.)
- [ ] **CALR-05**: User can filter calendar by activity type, owner, or entity

### Notes

- [ ] **NOTE-01**: User can create, view, edit, and delete notes with rich text
- [ ] **NOTE-02**: Notes list page uses dynamic table with adjustable columns
- [ ] **NOTE-03**: Notes can be linked to any entity (company, contact, deal, quote, request)
- [ ] **NOTE-04**: Notes appear in entity timelines

### Attachments

- [ ] **ATCH-01**: User can upload files to any entity (company, contact, deal, quote, activity, request)
- [ ] **ATCH-02**: User can preview and download attached files
- [ ] **ATCH-03**: Attachments are stored in cloud storage with tenant isolation
- [ ] **ATCH-04**: System tracks file metadata (name, size, type, uploaded by, date)

### Email Integration

- [ ] **MAIL-01**: User can connect Gmail account via OAuth
- [ ] **MAIL-02**: System syncs emails bidirectionally (inbox appears in CRM, sent from CRM appears in Gmail)
- [ ] **MAIL-03**: User can view emails in CRM linked to contacts and companies
- [ ] **MAIL-04**: User can send emails from CRM with tracked delivery
- [ ] **MAIL-05**: System auto-links emails to known contacts by email address
- [ ] **MAIL-06**: Emails appear in contact and company entity timelines
- [ ] **MAIL-07**: User can view email threads with proper conversation threading

### News Feed

- [ ] **FEED-01**: User can view activity stream showing system events (deals moved, tasks completed, contacts added)
- [ ] **FEED-02**: User can create social posts visible to team (announcements, updates)
- [ ] **FEED-03**: User can comment on feed items
- [ ] **FEED-04**: Feed combines activity stream and social posts in chronological order
- [ ] **FEED-05**: Feed respects RBAC (users only see events they have permission to view)

### Notifications

- [ ] **NOTF-01**: User receives in-app notifications (bell icon with notification center)
- [ ] **NOTF-02**: User can mark notifications as read/unread
- [ ] **NOTF-03**: User receives email notifications for important events (assignment, mention, due date)
- [ ] **NOTF-04**: System delivers real-time notifications via SignalR (no page refresh needed)
- [ ] **NOTF-05**: User can configure notification preferences (which events, which channels)
- [ ] **NOTF-06**: Notifications fire on: activity assignment, deal stage change, mention, approaching due date, email received

### Dashboards & KPIs

- [ ] **DASH-01**: User can view configurable dashboards with drag-and-drop widgets
- [ ] **DASH-02**: Dashboard widgets include: charts (bar, line, pie), KPI cards, leaderboards, tables
- [ ] **DASH-03**: User can set numeric targets (e.g., 50 calls/week, $100K pipeline) and track progress
- [ ] **DASH-04**: Dashboard supports date range filters and drill-down into underlying data
- [ ] **DASH-05**: Admin can create team-wide dashboards visible to all users
- [ ] **DASH-06**: User can create personal dashboards

### Dynamic Tables & Views

- [ ] **VIEW-01**: Every list page supports user-adjustable columns (show/hide, reorder, resize)
- [ ] **VIEW-02**: List pages display both core fields and custom fields in table columns
- [ ] **VIEW-03**: User can save column layouts, sorting, filters, and grouping as named Views
- [ ] **VIEW-04**: Admin can set team-wide default Views per entity
- [ ] **VIEW-05**: User can create personal Views that override team defaults
- [ ] **VIEW-06**: Views are switchable via dropdown on list pages

### Custom Fields

- [ ] **CUST-01**: Admin can define custom fields for any entity type
- [ ] **CUST-02**: Supported field types: text, number, date, dropdown, checkbox
- [ ] **CUST-03**: Supported field types: multi-select, currency, file attachment
- [ ] **CUST-04**: Supported field type: relation (link to another entity)
- [ ] **CUST-05**: Custom fields are filterable and sortable in dynamic tables
- [ ] **CUST-06**: Custom fields appear in entity detail pages and forms
- [ ] **CUST-07**: Custom field values stored in PostgreSQL JSONB with GIN indexing

### Import

- [ ] **IMPT-01**: User can import contacts, companies, and deals from CSV files
- [ ] **IMPT-02**: Import supports field mapping (CSV columns → entity fields including custom fields)
- [ ] **IMPT-03**: Import shows preview before executing
- [ ] **IMPT-04**: Import provides progress tracking and error reporting
- [ ] **IMPT-05**: Import detects potential duplicates and offers skip/overwrite/merge

### Global Search

- [ ] **SRCH-01**: User can search across all entity types from a single search bar
- [ ] **SRCH-02**: Search returns results grouped by entity type (contacts, companies, deals, etc.)
- [ ] **SRCH-03**: Search supports partial matching and is responsive (results as you type)
- [ ] **SRCH-04**: Recent searches are saved for quick access

### Responsive Web

- [ ] **RESP-01**: Angular web app works on desktop browsers (Chrome, Firefox, Safari, Edge)
- [ ] **RESP-02**: Web app is responsive and usable on tablet screen sizes
- [ ] **RESP-03**: Core navigation and entity views are functional on mobile browsers

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Mobile App

- **MOBL-01**: Native iOS app via .NET MAUI with full CRM functionality
- **MOBL-02**: Native Android app via .NET MAUI with full CRM functionality
- **MOBL-03**: Push notifications on mobile devices
- **MOBL-04**: Offline support for recently viewed records with sync when online
- **MOBL-05**: Camera integration for document/photo attachments

### Email (Extended)

- **MAIL-08**: User can connect Outlook/Microsoft 365 account via OAuth (Microsoft Graph API)
- **MAIL-09**: Email templates for common responses
- **MAIL-10**: Email sequences (automated follow-up chains)

### Custom Fields (Extended)

- **CUST-08**: Formula/computed custom fields that calculate from other fields
- **CUST-09**: Conditional field visibility (show/hide fields based on other field values)

### Advanced Features

- **ADVN-01**: Workflow automation (trigger-based actions: if deal stage changes, assign task)
- **ADVN-02**: Duplicate detection and merge for contacts and companies
- **ADVN-03**: Webhooks for external integrations
- **ADVN-04**: Advanced reporting builder with custom queries
- **ADVN-05**: SSO/SAML/OIDC integration for enterprise clients
- **ADVN-06**: Bulk operations (edit, delete, assign) across list views

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time chat/messaging | Not core to CRM value; integrate with Slack/Teams instead |
| Video calls | Integrate with external tools (Zoom, Teams) |
| AI/ML features (lead scoring, auto-categorization) | Requires large dataset, defer until data volume supports it |
| Third-party marketplace/plugins | Enormous maintenance overhead; webhooks + API sufficient |
| White-labeling | Single brand for v1; enterprise feature for later |
| Social media integration | APIs unreliable/expensive; link fields to social profiles instead |
| Full email client | Competing with Gmail/Outlook is futile; sync + send-from-CRM is the right scope |
| Visual workflow automation builder | High complexity; configurable triggers sufficient for v1 |
| Multi-language/i18n | English-only for v1; add when international expansion begins |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| AUTH-08 | Phase 1 | Pending |
| RBAC-01 | Phase 2 | Pending |
| RBAC-02 | Phase 2 | Pending |
| RBAC-03 | Phase 2 | Pending |
| RBAC-04 | Phase 2 | Pending |
| RBAC-05 | Phase 2 | Pending |
| RBAC-06 | Phase 2 | Pending |
| CUST-01 | Phase 2 | Pending |
| CUST-02 | Phase 2 | Pending |
| CUST-03 | Phase 2 | Pending |
| CUST-04 | Phase 2 | Pending |
| CUST-05 | Phase 2 | Pending |
| CUST-06 | Phase 2 | Pending |
| CUST-07 | Phase 2 | Pending |
| VIEW-01 | Phase 2 | Pending |
| VIEW-02 | Phase 2 | Pending |
| VIEW-03 | Phase 2 | Pending |
| VIEW-04 | Phase 2 | Pending |
| VIEW-05 | Phase 2 | Pending |
| VIEW-06 | Phase 2 | Pending |
| COMP-01 | Phase 3 | Pending |
| COMP-02 | Phase 3 | Pending |
| COMP-03 | Phase 3 | Pending |
| COMP-04 | Phase 3 | Pending |
| COMP-05 | Phase 3 | Pending |
| CONT-01 | Phase 3 | Pending |
| CONT-02 | Phase 3 | Pending |
| CONT-03 | Phase 3 | Pending |
| CONT-04 | Phase 3 | Pending |
| CONT-05 | Phase 3 | Pending |
| CONT-06 | Phase 3 | Pending |
| PROD-01 | Phase 3 | Pending |
| PROD-02 | Phase 3 | Pending |
| PROD-03 | Phase 3 | Pending |
| PROD-04 | Phase 3 | Pending |
| PROD-05 | Phase 3 | Pending |
| DEAL-01 | Phase 4 | Pending |
| DEAL-02 | Phase 4 | Pending |
| DEAL-03 | Phase 4 | Pending |
| DEAL-04 | Phase 4 | Pending |
| DEAL-05 | Phase 4 | Pending |
| DEAL-06 | Phase 4 | Pending |
| DEAL-07 | Phase 4 | Pending |
| DEAL-08 | Phase 4 | Pending |
| DEAL-09 | Phase 4 | Pending |
| DEAL-10 | Phase 4 | Pending |
| ACTV-01 | Phase 5 | Pending |
| ACTV-02 | Phase 5 | Pending |
| ACTV-03 | Phase 5 | Pending |
| ACTV-04 | Phase 5 | Pending |
| ACTV-05 | Phase 5 | Pending |
| ACTV-06 | Phase 5 | Pending |
| ACTV-07 | Phase 5 | Pending |
| ACTV-08 | Phase 5 | Pending |
| ACTV-09 | Phase 5 | Pending |
| ACTV-10 | Phase 5 | Pending |
| ACTV-11 | Phase 5 | Pending |
| ACTV-12 | Phase 5 | Pending |
| ACTV-13 | Phase 5 | Pending |
| ACTV-14 | Phase 5 | Pending |
| QUOT-01 | Phase 6 | Pending |
| QUOT-02 | Phase 6 | Pending |
| QUOT-03 | Phase 6 | Pending |
| QUOT-04 | Phase 6 | Pending |
| QUOT-05 | Phase 6 | Pending |
| QUOT-06 | Phase 6 | Pending |
| QUOT-07 | Phase 6 | Pending |
| QUOT-08 | Phase 6 | Pending |
| REQS-01 | Phase 6 | Pending |
| REQS-02 | Phase 6 | Pending |
| REQS-03 | Phase 6 | Pending |
| REQS-04 | Phase 6 | Pending |
| REQS-05 | Phase 6 | Pending |
| REQS-06 | Phase 6 | Pending |
| MAIL-01 | Phase 7 | Pending |
| MAIL-02 | Phase 7 | Pending |
| MAIL-03 | Phase 7 | Pending |
| MAIL-04 | Phase 7 | Pending |
| MAIL-05 | Phase 7 | Pending |
| MAIL-06 | Phase 7 | Pending |
| MAIL-07 | Phase 7 | Pending |
| NOTF-01 | Phase 8 | Pending |
| NOTF-02 | Phase 8 | Pending |
| NOTF-03 | Phase 8 | Pending |
| NOTF-04 | Phase 8 | Pending |
| NOTF-05 | Phase 8 | Pending |
| NOTF-06 | Phase 8 | Pending |
| FEED-01 | Phase 8 | Pending |
| FEED-02 | Phase 8 | Pending |
| FEED-03 | Phase 8 | Pending |
| FEED-04 | Phase 8 | Pending |
| FEED-05 | Phase 8 | Pending |
| DASH-01 | Phase 9 | Pending |
| DASH-02 | Phase 9 | Pending |
| DASH-03 | Phase 9 | Pending |
| DASH-04 | Phase 9 | Pending |
| DASH-05 | Phase 9 | Pending |
| DASH-06 | Phase 9 | Pending |
| IMPT-01 | Phase 10 | Pending |
| IMPT-02 | Phase 10 | Pending |
| IMPT-03 | Phase 10 | Pending |
| IMPT-04 | Phase 10 | Pending |
| IMPT-05 | Phase 10 | Pending |
| SRCH-01 | Phase 10 | Pending |
| SRCH-02 | Phase 10 | Pending |
| SRCH-03 | Phase 10 | Pending |
| SRCH-04 | Phase 10 | Pending |
| CALR-01 | Phase 11 | Pending |
| CALR-02 | Phase 11 | Pending |
| CALR-03 | Phase 11 | Pending |
| CALR-04 | Phase 11 | Pending |
| CALR-05 | Phase 11 | Pending |
| NOTE-01 | Phase 11 | Pending |
| NOTE-02 | Phase 11 | Pending |
| NOTE-03 | Phase 11 | Pending |
| NOTE-04 | Phase 11 | Pending |
| ATCH-01 | Phase 11 | Pending |
| ATCH-02 | Phase 11 | Pending |
| ATCH-03 | Phase 11 | Pending |
| ATCH-04 | Phase 11 | Pending |
| RESP-01 | Phase 11 | Pending |
| RESP-02 | Phase 11 | Pending |
| RESP-03 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 107 total
- Mapped to phases: 107
- Unmapped: 0

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after roadmap creation*
