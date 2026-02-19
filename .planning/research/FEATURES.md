# Feature Landscape: GlobCRM v1.2 Connected Experience

**Domain:** CRM entity connectivity, preview panels, summary dashboards, personal workspace
**Researched:** 2026-02-20
**Overall Confidence:** MEDIUM-HIGH (patterns well-established across HubSpot, Salesforce, Pipedrive, Dynamics 365; validated against existing codebase)

---

## Feature Area 1: Entity Preview Sidebar (Feed Integration)

### Table Stakes

Features users expect when entity references are clickable in a feed/activity stream. Missing = feels broken or half-built.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clickable entity names in feed items | HubSpot, Salesforce, Pipedrive all make entity references clickable inline. Currently feed items show "View [Entity]" link that navigates away. Users expect to peek without losing context. | Low | Feed items already have `entityType`/`entityId`. Need to change navigation behavior from `router.navigate` to sidebar open. |
| Slide-in preview panel (not full navigation) | HubSpot's preview panel, Salesforce's hover cards, Dynamics 365's side panel forms -- every major CRM lets you peek at a record without leaving context. Full navigation breaks workflow. | Medium | Use Angular CDK Overlay with `GlobalPositionStrategy` (right-anchored). Panel slides from right, ~400px wide. Overlays the page without displacing content. Alternative: MatDrawer with `mode="over"` (simpler, already in Material). |
| Key properties display | HubSpot shows up to 6 preview properties per entity type. Salesforce compact layouts show 4 key fields in highlights panel. Users expect name, status/stage, owner, and primary contact info at minimum. | Low | Existing `*ListDto` models already contain these fields (e.g., `DealListDto` has title, value, stageName, companyName, ownerName). No new API endpoint needed for basic preview -- list DTOs are sufficient. |
| "Open full record" link | Every CRM preview panel has a clear path to the full detail page. The escape hatch when preview is insufficient. | Low | Simple `routerLink` to `/{entityType}s/{id}`. Prominent button at top or bottom of preview. |
| Close on outside click / Escape key | Standard overlay behavior. HubSpot, Salesforce, all dismiss on click-outside or Escape. | Low | CDK Overlay provides this via `hasBackdrop` and keyboard handling. MatDrawer handles natively with `mode="over"`. |
| Loading skeleton while fetching | Salesforce shows shimmer/skeleton placeholders. Empty panel while loading feels broken. | Low | Reuse existing skeleton pattern from dashboard loading. Show 4-5 placeholder bars. |
| Scroll-position preservation | When user closes preview, feed must maintain its scroll position. This is fundamental -- reopening at the top after closing a preview is infuriating. | Low | MatDrawer `mode="over"` handles by default (no layout shift). CDK Overlay also avoids page reflow. |
| Responsive: full-width on mobile | On mobile, a 400px sidebar leaves no room. HubSpot goes full-width on small screens. | Low | `BreakpointObserver` already in use in navbar. Conditionally set width to `100vw` at `(max-width: 768px)`. |
| Entity preview from global search | Global search results currently navigate to full page. Quick-look preview from search results is expected in HubSpot and Salesforce. | Medium | Same sidebar component triggered from `GlobalSearchComponent` hits. Requires adding a "preview" action alongside existing "navigate" action on search results. |

### Differentiators

Features that set the product apart. Not universally expected, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Quick actions in preview (Call, Email, Note, Activity) | HubSpot's preview sidebar includes quick action buttons. Lets users act without navigating. This is the "connected" in "Connected Experience." See a mention, take action, stay in feed. | Medium | 3-4 action buttons opening small forms (existing `entity-form-dialog` for notes, compose for email). Each action needs entity context (type + id). |
| User preview (click author names) | Feed shows author names. Clicking to see their profile (name, role, email, avatar, recent activity count) adds social/team context. HubSpot workspace shows user cards. | Low-Medium | Lightweight user preview. Requires new endpoint `GET /api/users/{id}/preview` returning name, role, email, avatar, activity count. |
| Association chips in preview | HubSpot preview shows associated records as clickable chips (Company on a Contact preview, Contacts on a Deal preview). Enables "drill across" without full navigation. | Medium | Existing detail DTOs include associations (e.g., `DealDetailDto.linkedContacts`). Fetch detail DTO for preview and render associations as chips. Clicking navigates to full record (not nested preview -- see anti-features). |
| Recent activity summary in preview | HubSpot's preview sidebar shows "Recent activities" card with last 3 activities. Quick temporal context for the record. | Medium | Reuse existing timeline endpoint with `pageSize=3`. Display as compact list (icon + description + relative time). |
| Inline entity references in feed content | Rather than just "View Deal" below content, make entity names clickable inline (e.g., "Closed deal **Acme Corp Renewal**"). HubSpot does this for all entity mentions. | Medium-High | Backend needs structured entity references alongside content (array of `{type, id, name, startIndex, endIndex}`). Frontend renders as clickable `<span>` elements within content. Defer to later in v1.2 or v1.3 if time-constrained. |

### Anti-Features

Features to explicitly NOT build for the preview sidebar.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full entity editing in preview | Preview is for quick context, not a form editor replacement. Editing in a narrow ~400px panel creates poor UX for complex entities with many fields. Pipedrive's sidebar summary is read-only for good reason. | Read-only field display + "Open full record" for editing. Quick actions (add note, log call) are the exception since they are small, focused forms. |
| Nested preview-within-preview | Clicking an association in a preview opens another preview, which has its own associations... leads to confusion and z-index nightmares. HubSpot limits preview to one level. | Allow one level of preview. Association clicks in a preview navigate to the full detail page. |
| Custom field display in preview | Custom fields are user-configured and variable-length. Including them makes the preview unpredictable in height and content density. | Show only core system fields. Custom fields live on the full detail page. |
| Preview panel resizing/docking | Over-engineering. HubSpot's preview is fixed-width. Dynamics 365 side panel is fixed. Resize/dock adds complexity for minimal UX gain. | Fixed ~400px width. Users needing more space click "Open full record." |
| Real-time updates while preview is open | If the entity changes while preview is open, pushing updates is over-engineering for v1.2. | Refresh on re-open. Simple stale-on-close pattern. |
| App-wide MatSidenav replacement | Do NOT replace the existing custom left sidebar with MatSidenav. The current sidebar works well and is deeply integrated (SidebarStateService, responsive behavior). | Use MatDrawer (scoped) or CDK Overlay only for the right-side preview panel. Keep existing left sidebar untouched. |

### Feature Dependencies

```
Feed entity references (structured) --> Clickable mentions in feed content
Clickable mentions --> Preview sidebar trigger
Preview sidebar component (MatDrawer/CDK Overlay) --> Key properties display
Preview sidebar --> Quick action buttons
Quick action buttons --> Existing entity-form-dialog / email compose
User preview --> New user preview API endpoint
Association chips --> Detail DTO fetch (existing endpoints)
Global search preview --> Same sidebar component
```

---

## Feature Area 2: Summary Tabs on Detail Pages

### Table Stakes

Features users expect on a Summary/Overview tab. HubSpot ships this as their "Overview" tab (first tab on every record, default landing). Salesforce provides a "highlights panel" at the top of every record page.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Key properties card | HubSpot Overview starts with "About this [entity]" card showing 4-8 key fields. Salesforce highlights panel shows compact layout fields. This anchors the summary. | Low | Already have all fields in `*DetailDto`. Create a card component displaying a configured subset per entity type. |
| Association counts with tab links | "5 Contacts, 3 Deals, 2 Quotes" -- each clickable to jump to the respective tab. HubSpot shows this prominently on Overview. Salesforce shows related list counts. | Low | Existing detail pages lazy-load associations per tab. Add a lightweight count-only mechanism: either `pageSize=0` returning `totalCount` from existing endpoints, or new summary count endpoint. |
| Recent activities card (3-5 items) | HubSpot Overview shows "Recent activities" card with last 3 activities. Salesforce shows "Activity Timeline" component. Users land on Summary and immediately see "what happened recently." | Low-Medium | Reuse existing activity list endpoint with `linkedEntityType` + `pageSize=5`. Display as condensed timeline (simpler than full `EntityTimelineComponent`). |
| Upcoming activities card | HubSpot shows "Upcoming activities" alongside recent. Salesforce Home has "Today's Events." Gives "what's next" at a glance. | Low-Medium | Filter activities by `status != done` AND `dueDate >= today`, sorted ascending, limit 3-5. |
| Stage/status indicator | For Deals: pipeline stage progress bar (stages as steps, current highlighted). For Leads: stage indicator with temperature badge. For Quotes: status badge with transition options. For Requests: status + priority badges. Per-entity visual indicator at top of summary. | Medium | Each entity type has different status semantics. Need per-entity summary header configs. Deals get a stage stepper (pipeline stages), Leads get stage + temperature chip, Quotes/Requests get status badges. |
| Quick action bar | HubSpot Overview has "Actions" row: Create Task, Create Note, Log Call, Send Email. Salesforce has quick action buttons on the record header. Saves navigating to another tab for common operations. | Medium | 4-5 contextual action buttons at top of Summary tab. Actions open existing dialogs. Actions vary by entity type (e.g., Deals get "Add Contact" + "Add Product" alongside generic actions). |
| Summary tab as first/default tab | HubSpot's Overview is the first tab and the default landing. Salesforce's highlights panel is always visible. Summary must be tab index 0. | Low | Modify `COMPANY_TABS`, `CONTACT_TABS`, `DEAL_TABS`, `LEAD_TABS` (need to add), `QUOTE_TABS` (need to add), `REQUEST_TABS` (need to add) to insert Summary at index 0. Shift existing "Details" to index 1. Update `onTabChanged` index logic. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mini deal/pipeline summary on Company/Contact | For Companies: total deal value, deals by stage (mini bar chart), win rate. For Contacts: associated deals value summary. HubSpot's company Overview includes deal summaries with pipeline visualization. | Medium | New backend endpoint: `GET /api/companies/{id}/summary` returning aggregated deal stats (total value, count by stage, win rate). Chart.js mini bar chart. |
| Email engagement summary | On Contact Summary: last email sent/received, total emails exchanged, last open timestamp. HubSpot tracks email engagement prominently on contact records. | Medium | Aggregation query against email entities filtered by contact. Compact stats row display. |
| Notes preview | Last 2-3 notes (truncated to ~100 chars) on Summary tab. HubSpot includes pinned notes on Overview. Context without tab-switching. | Low | Reuse `NoteService.getEntityNotes()` with limit. Truncate content display. |
| Sparkline trend charts | Visual trend of deal values, activity volume, email engagement over 30/60/90 days. Goes beyond static numbers to show trajectory. | Medium | Chart.js sparkline configuration (line chart, no axes, small). Backend needs time-series aggregation endpoint. |
| Last interaction timestamp | "Last contacted: 3 days ago" -- prominently displayed. HubSpot shows this on company record summary. Helps users identify records needing attention. | Low-Medium | Compute from most recent activity/email/note timestamp. Could be a computed field on backend or assembled from timeline data. |
| Attachments count badge | "12 files" as context, not a full list. Pipedrive's sidebar shows attachment count. | Low | Count from existing attachment endpoint. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Editable fields on Summary tab | Summary is read-oriented. Inline editing on Summary creates confusion about what's saved vs. not saved, and duplicates the Details tab's editing capability. Salesforce Dynamic Forms tried mixing edit + read and it fragments the experience. | Summary is read-only. "Edit" button navigates to Details tab. Quick actions (note, call, email) are the exception since they create new records, not edit existing fields. |
| Full timeline duplicate on Summary | Summary tab should NOT replicate the Activities tab. It shows a condensed "recent" view (3-5 items). Full timeline is its own tab. | Show 3-5 recent items with "View all activities" link that switches to the Activities tab. |
| Configurable Summary layout per user/admin | HubSpot lets admins customize Overview cards. This is significant build/maintain effort (card ordering, visibility toggles, per-team configs). Overkill for v1.2. | Ship a well-designed default layout per entity type. Admin customization deferred to future milestone. |
| AI-generated record summaries | HubSpot Breeze generates AI record summaries with sentiment analysis. Requires AI infrastructure, token costs, prompt engineering. | Focus on data-driven cards surfacing existing information. AI summaries deferred to v2+. |
| Summary tabs for Products only | Products have minimal connected data (no activities, no emails, no notes linked by default). A summary tab would be nearly empty. | Products keep current tab structure. Add Summary to Products later when they have richer connections. |

### Feature Dependencies

```
Summary tab addition --> RelatedEntityTabsComponent (insert tab at index 0)
Tab index shift --> ALL existing detail components (onTabChanged index logic must update)
Key properties card --> *DetailDto (existing, no new endpoint)
Association counts --> Lightweight count mechanism (pageSize=0 or new endpoint)
Recent activities card --> Activity list endpoint (filtered, existing)
Upcoming activities card --> Activity list endpoint (filtered by date, existing)
Stage/status indicator --> Pipeline stages (deals), Lead stages, Quote/Request statuses (existing)
Quick action bar --> Existing entity-form-dialog, email compose
Mini deal summary --> New aggregation endpoint (backend work)
Sparkline charts --> Chart.js (existing) + new time-series aggregation (backend)
```

---

## Feature Area 3: Personal "My Day" Dashboard

### Table Stakes

Every major CRM has evolved their homepage to be personal. Salesforce Lightning Home: Assistant + Key Deals + Today's Tasks + Today's Events + Performance. HubSpot Sales Workspace: tasks + leads + deals + guided actions + prospecting queue. Pipedrive: personal pipeline + activities due today.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Greeting with date/time context | HubSpot and existing GlobCRM dashboard already have "Good morning, [Name]." Salesforce Home doesn't but most modern apps do. Sets personal tone. Already built in current `DashboardComponent`. | Low | Move/reuse existing greeting from `DashboardComponent` (it has `greeting()`, `timeIcon()`, `firstName()` computeds). |
| Today's tasks/activities widget | Salesforce: "Today's Tasks" is a standard Home component. HubSpot workspace: task queue with type sorting. THE core of a personal dashboard -- "what do I need to do today?" | Medium | Query activities where `assignedTo = currentUser` AND `dueDate = today` AND `status != done`. Display as checklist with status toggle buttons and priority indicators. |
| Overdue tasks widget / section | Salesforce Assistant surfaces overdue tasks prominently. HubSpot shows overdue counts with urgency indicators. Users need to see what slipped. | Low | Query activities where `assignedTo = currentUser` AND `dueDate < today` AND `status != done`. Can be a red-highlighted section within the tasks widget rather than separate. |
| Upcoming events/calendar widget | Salesforce: "Today's Events." HubSpot: calendar integration. Shows today's meetings and upcoming appointments as compact agenda. | Medium | Use existing activity data filtered by type (meeting/call). Display as compact agenda list (time + title + linked entity) for today + next 2 days. NOT a full FullCalendar embed -- just a simple agenda. |
| My pipeline summary widget | Salesforce: "Key Deals" and "Performance" components. Pipedrive: personal pipeline view on homepage. Sales reps need their deals at a glance -- count by stage, total value, deals closing soon. | Medium | Query deals where `ownerId = currentUser` and status is open. Group by stage, show total value per stage, highlight deals closing this week. Mini horizontal bar chart or stage-pill visualization. |
| Quick actions row | Salesforce Home has global "New" actions. HubSpot workspace has create dropdown. Fast paths to create entities from homepage. | Low | Row of icon buttons: New Contact, New Deal, Log Activity, New Note, Send Email. Each opens respective create form/dialog (all already built). |
| Recent records widget | Salesforce: "Recent Records" standard component. Shows what user was working on recently. Reduces navigation friction. | Low-Medium | Track recently viewed entities client-side (localStorage keyed by userId) or server-side (new `RecentRecords` table). Show last 5-8 with entity type icon, name, and relative time. Client-side is simpler and avoids backend changes. |
| Org dashboard relocation | Moving existing org dashboard from `/dashboard` (current home) to its own menu item. My Day takes over as the default landing page. | Low-Medium | Route change: `''` redirects to My Day page. Org dashboard moves to `/dashboards` or `/analytics`. Update navbar to show both: "My Day" (home icon) and "Dashboards" (grid_view icon). |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Configurable widget layout (gridster) | Existing org dashboard uses angular-gridster2. Bringing the same drag-and-drop configurability to My Day lets each user arrange their workspace. HubSpot Sales Workspace is NOT user-configurable in layout; Salesforce Lightning Home is admin-only configurable. User-configurable is a genuine differentiator. | Medium | Reuse `DashboardGridComponent` and widget infrastructure. Backend: `UserDashboardPreferences` entity scoped to user (not team). New widget types for My Day-specific data. |
| Email summary widget | Unread count, recent emails, emails needing response. HubSpot Sales Workspace shows inbox preview inline. | Medium | Query existing email service for current user's recent emails. Compact list: sender avatar, subject (truncated), time, read/unread dot. |
| Feed preview widget | Last 3-5 feed items inline on My Day. Social awareness without navigating to Feed page. Team pulse at a glance. | Low | Reuse `FeedService` with `pageSize=5`. Compact card format showing author + content preview + relative time. |
| Notification digest widget | Today's notifications grouped by type. Not just the bell icon, but "4 deal updates, 2 mentions, 1 assignment" as a summary card. | Low-Medium | Reuse existing notification data. Group by type, show counts with expand/collapse to see individual items. |
| Smart nudges (rule-based) | Simpler version of HubSpot's "Guided Actions": "You have 3 deals closing this week," "5 activities are overdue," "Lead X has been idle for 14 days." Rule-based, not AI. | Medium | Business rules checking overdue counts, deals closing soon, idle leads, unread emails. Generate prioritized action cards with direct links to the relevant records. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Replacing org dashboard entirely | My Day is personal (my tasks, my pipeline, my activities). Org dashboard is team-level (KPIs, leaderboards, targets). They serve different audiences. HubSpot and Salesforce both maintain separate personal and team views. | My Day = personal starting page. Org Dashboard = team/admin metrics view. Both accessible from navbar as separate items. |
| Real-time auto-refresh polling on all widgets | Polling every widget every 30 seconds creates unnecessary server load. My Day data is relatively static (tasks don't change every 30s unless someone else updates them). | Refresh on page load + manual refresh button. SignalR push for specific events only (new assignment, deal stage change on my deal, new mention). |
| Embedding external calendar (Google/Outlook widget) | Deep external calendar integration requires OAuth for each provider, bidirectional sync, and complex rendering. Existing FullCalendar shows CRM activities already. | Show CRM activities/events as the calendar widget content. External calendar sync is a separate future feature (already noted in PROJECT.md as future). |
| Admin-controlled My Day layouts | My Day is personal. Admins should NOT force a layout on individual users. This is fundamentally different from the org dashboard where admin control makes sense. | Users own their My Day layout. Provide sensible defaults that users can customize. Admin can influence only through the org dashboard. |
| Full FullCalendar embed as a widget | FullCalendar is heavyweight (~200KB) and already available at `/calendar`. Embedding it again in My Day is redundant and slow. | Compact agenda-style list showing today's events and next 2 days. "View full calendar" link to the Calendar page. |

### Feature Dependencies

```
My Day page component --> New route (/ or /my-day)
Org Dashboard relocation --> Route change (/dashboard --> /dashboards or /analytics)
Navbar update --> Two entries: "My Day" (home) + "Dashboards" (analytics)
Widget infrastructure --> Reuse angular-gridster2 + DashboardGridComponent
Today's tasks widget --> Activity list endpoint (filtered by user + today)
Overdue tasks section --> Activity list endpoint (filtered by user + overdue)
Calendar widget --> Activity list endpoint (filtered by user + date range)
My pipeline widget --> Deal list endpoint (filtered by user + open)
Quick actions --> Existing create form dialogs
Recent records widget --> New tracking mechanism (localStorage preferred)
Email widget --> Existing EmailService endpoints
Feed widget --> Existing FeedService
Widget persistence --> New user preferences endpoint or extend existing dashboard API
```

---

## Cross-Feature Dependencies

```
Entity Preview Sidebar ----depends-on----> Existing entity services + list/detail DTOs
Summary Tabs ----depends-on----> Existing RelatedEntityTabsComponent + entity detail pages
My Day Dashboard ----depends-on----> Existing widget infrastructure (angular-gridster2, Chart.js)

Summary Tabs (quick action bar) ----shares-pattern-with----> Preview Sidebar (quick actions)
Summary Tabs (recent activities card) ----shares-pattern-with----> My Day (tasks widget)
Summary Tabs (association counts) ----shares-data-with----> Preview Sidebar (association chips)

All three ----should-share----> EntityPreviewService (lightweight entity lookups by type+id)
All three ----should-share----> QuickActionBarComponent (reusable action buttons per entity type)
```

## Entity Coverage Matrix

Which entity types get which features in v1.2:

| Entity | Preview Sidebar | Summary Tab | Notes |
|--------|----------------|-------------|-------|
| Company | Yes | Yes | Rich: contacts, deals, activities, emails, quotes, requests |
| Contact | Yes | Yes | Rich: company link, deals, activities, emails |
| Deal | Yes | Yes | Rich: pipeline progress, contacts, products, activities, quotes |
| Lead | Yes | Yes | Moderate: stage progress, temperature, source, activities |
| Quote | Yes | Yes | Moderate: status badge, line item summary, linked deal/company/contact |
| Request | Yes | Yes | Moderate: status + priority badges, linked contact/company |
| Product | Yes (basic) | No | Preview shows name, price, description. No summary tab -- insufficient connected data. |
| User/Team Member | Yes (feed only) | No | Preview from feed author names. Shows name, role, email, avatar. |

## MVP Recommendation

### Phase 1: Summary Tabs on Detail Pages

**Rationale:** Summary tabs add value to the most-used part of the app (detail pages) with the least risk. They build entirely on existing infrastructure (RelatedEntityTabsComponent, detail DTOs, entity services) without introducing new UX paradigms. Every user benefits immediately on pages they already visit daily.

Build order:
1. Summary tab skeleton -- add "Summary" as tab index 0 on all 6 entity types (Companies, Contacts, Deals, Leads, Quotes, Requests)
2. Key properties card -- read-only highlight fields per entity type
3. Association counts with tab links -- "5 Contacts, 3 Deals" clickable to switch tabs
4. Recent activities card -- last 3-5 activities in condensed format
5. Stage/status indicator -- pipeline progress for Deals, stage+temperature for Leads, status badges for Quotes/Requests
6. Quick action bar -- Add Note, Log Activity, Send Email (shared component)

### Phase 2: Entity Preview Sidebar + Feed Integration

**Rationale:** Preview sidebar is a new UX paradigm (CDK Overlay or MatDrawer slide-in) requiring careful implementation. It depends on having a reusable preview panel component. Ships after Summary tabs because the preview panel benefits from the Summary tab's "key properties card" pattern (same data, different container).

Build order:
1. Reusable slide-in panel component (MatDrawer `mode="over"` or CDK Overlay)
2. Per-entity preview content templates (name, key fields, associations, actions)
3. Feed entity link integration -- replace `navigateToEntity()` with sidebar open
4. Quick actions in preview -- Add Note, Log Call, Send Email (reuse from Summary)
5. User preview for feed author names
6. Global search preview integration (optional, if time allows)

### Phase 3: My Day Personal Dashboard

**Rationale:** My Day is the most complex feature (new page, new widget types, route restructuring, navbar changes, user preference persistence). It also requires relocating the org dashboard, which is a coordination risk. Ships last because it touches the most infrastructure.

Build order:
1. Route restructuring -- `/` goes to My Day page, org dashboard moves to `/dashboards`
2. Navbar update -- add "My Day" and rename/move "Dashboard"
3. My Day page with gridster -- reuse existing widget infrastructure
4. Today's tasks widget (core personal productivity view)
5. My pipeline summary widget
6. Quick actions row + recent records widget
7. User preference persistence for widget layout

### Defer to v1.3+

| Feature | Reason |
|---------|--------|
| Inline entity references in feed content | Requires backend content parsing and structured mention system |
| Cross-entity relationship map visualization | Custom SVG/canvas rendering, high complexity |
| Admin-customizable Summary tab layout | Default layout sufficient for v1.2 |
| AI-generated record summaries | Requires AI infrastructure |
| Smart nudges / guided actions | Rule engine is medium complexity, better standalone |
| Sparkline trend charts on summary | Needs time-series aggregation endpoints, better as polish |
| Feed entity mentions with hover preview (@mention) | Requires mention parsing system |

## CRM Benchmark References

| Feature | HubSpot | Salesforce | Pipedrive | Dynamics 365 |
|---------|---------|------------|-----------|--------------|
| **Entity preview** | Preview panel: customizable cards, up to 6 properties, associations, attachments, quick actions. Customizable per team. | Compact layout hover cards (4 fields), mini page layouts on lookup hover. Side panel available in some contexts. | Detail view sidebar: summary section (customizable field order, drag-reorder), collapsible sections. | Quick view forms (read-only lookup preview), side panel forms for editing. |
| **Summary/Overview tab** | Overview tab (first tab by default): "About this record" properties, recent/upcoming activities, associations cards, Breeze AI summary, sentiment card, challenges card. Customizable by admins. | Highlights panel (compact layout at page top, always visible). Dynamic Forms for inline sections. Related lists with counts. Lightning record page templates. | Summary section at top of detail sidebar (always visible, not a tab). Customizable field order with drag-reorder. | Quick view forms embedded in related record lookups. Main form sections. |
| **Personal homepage** | Sales Workspace: personal task queue (by type: email, call, LinkedIn), lead management, deal tracking, guided actions (AI-recommended next steps), prospecting agent. Separate from team dashboard. | Lightning Home: Assistant (overdue/ignored items), Key Deals (filterable opportunities), Today's Tasks, Today's Events, Performance (quarterly), Recent Records. Customizable per app/profile by admins. | Pipeline view (personal deals) + activities due today as default landing. Clean, sales-focused. | Personal dashboards + activity feeds. Home page with charts, activity stream, queues. |

## Sources

- [HubSpot: Preview a record](https://knowledge.hubspot.com/records/preview-a-record) -- MEDIUM confidence
- [HubSpot: Customize record previews](https://knowledge.hubspot.com/object-settings/customize-record-previews) -- MEDIUM confidence
- [HubSpot: View and customize record overviews](https://knowledge.hubspot.com/crm-setup/view-and-customize-record-overviews) -- MEDIUM confidence
- [HubSpot: View a company record summary](https://knowledge.hubspot.com/records/view-a-company-record-summary) -- MEDIUM confidence
- [HubSpot: Sales Workspace activities](https://knowledge.hubspot.com/prospecting/review-sales-activity-in-the-sales-workspace) -- MEDIUM confidence
- [HubSpot: Customize preview sidebar in workspace](https://knowledge.hubspot.com/customize-the-record-preview-sidebar-in-the-customer-success-workspace) -- MEDIUM confidence
- [HubSpot Spring 2025 Spotlight: Workspaces](https://www.hubspot.com/company-news/spring-2025-spotlight-workspaces) -- MEDIUM confidence
- [Salesforce: Custom Lightning Home Page](https://trailhead.salesforce.com/content/learn/modules/lightning_app_builder/lightning_app_builder_homepage) -- MEDIUM confidence
- [Salesforce: Compact Layouts](https://trailhead.salesforce.com/content/learn/modules/lex_customization/lex_customization_compact_layouts) -- MEDIUM confidence
- [Salesforce: Tasks and Events management](https://trailhead.salesforce.com/content/learn/modules/lightning-experience-productivity/manage-your-tasks-events-and-email) -- MEDIUM confidence
- [Salesforce: Customize Lightning Home Page](https://www.salesforceben.com/customize-your-salesforce-home-page-with-the-lightning-app-builder/) -- MEDIUM confidence
- [Salesforce: Today's Tasks in Lightning](https://help.salesforce.com/s/articleView?id=000382898&language=en_US&type=1) -- MEDIUM confidence
- [Pipedrive: Detail view sidebar](https://support.pipedrive.com/en/article/detail-view-sidebar) -- MEDIUM confidence
- [Pipedrive: Deal detail view](https://support.pipedrive.com/en/article/deal-detail-view) -- MEDIUM confidence
- [Pipedrive: Contact detail view](https://support.pipedrive.com/en/article/contact-detail-view) -- MEDIUM confidence
- [Dynamics 365: Quick view forms](https://learn.microsoft.com/en-us/dynamics365/customerengagement/on-premises/customize/create-edit-quick-view-forms?view=op-9-1) -- MEDIUM confidence
- [Dynamics 365: Side panel forms](https://learn.microsoft.com/en-us/dynamics365-release-plan/2021wave1/sales/dynamics365-sales/enhanced-productivity-new-record-side-panel-form) -- MEDIUM confidence
- [Angular CDK Overlay](https://material.angular.dev/cdk/overlay) -- HIGH confidence (official docs)
- [Angular CDK Overlay Tutorial (v19+)](https://briantree.se/angular-cdk-overlay-tutorial-learn-the-basics/) -- MEDIUM confidence
- [Adobe: Slide-out Panels Pattern Library](https://developer.adobe.com/commerce/admin-developer/pattern-library/containers/slideouts-modals-overlays) -- MEDIUM confidence (design pattern reference)
- [Everything About CRM Record Overview Tab in HubSpot](https://www.mergeyourdata.com/blog/everything-about-the-crm-record-overview-tab-in-hubspot) -- LOW confidence (third-party blog)
- Existing codebase analysis: `feed-list.component.ts`, `company-detail.component.ts`, `related-entity-tabs.component.ts`, `dashboard.component.ts`, `dashboard.models.ts`, entity model files -- HIGH confidence
