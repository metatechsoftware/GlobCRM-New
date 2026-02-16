# Architecture Research: Multi-Tenant SaaS CRM

**Project:** GlobCRM
**Stack:** Angular + .NET Core 10 + PostgreSQL + .NET MAUI + SignalR
**Research Date:** 2026-02-16
**Dimension:** Architecture

## Executive Summary

Multi-tenant SaaS CRM systems require careful architectural planning to balance tenant isolation, performance, scalability, and maintainability. For GlobCRM with Angular frontend, .NET Core 10 backend, and PostgreSQL database, the recommended architecture follows a **shared database with tenant discriminator** pattern, organized into distinct layers with clear boundaries and responsibilities.

**Key Architectural Decisions:**
- Tenant isolation via discriminator column + Row-Level Security (RLS)
- API-first design with clean architecture principles
- CQRS pattern for complex queries and custom field handling
- Real-time capabilities via SignalR hubs
- OAuth-based email integration with background job processing

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
├──────────────────────┬──────────────────────────────────────┤
│  Angular Web App     │  .NET MAUI Mobile App                │
│  - Tenant-aware UI   │  - Offline-first sync                │
│  - SignalR client    │  - Push notifications                │
│  - State management  │  - Camera/contacts integration       │
└──────────────────────┴──────────────────────────────────────┘
                              ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│                     API GATEWAY / LOAD BALANCER             │
│  - SSL termination                                          │
│  - Tenant resolution (subdomain/header)                     │
│  - Rate limiting per tenant                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  .NET CORE 10 WEB API                       │
├─────────────────────────────────────────────────────────────┤
│  Presentation Layer                                         │
│  ├─ REST Controllers (CRUD operations)                      │
│  ├─ SignalR Hubs (real-time notifications)                  │
│  └─ Middleware (tenant resolution, auth, logging)           │
├─────────────────────────────────────────────────────────────┤
│  Application Layer                                          │
│  ├─ Use Cases / Command Handlers (CQRS)                     │
│  ├─ Query Handlers (read models)                            │
│  ├─ DTOs / ViewModels                                       │
│  ├─ Validators (FluentValidation)                           │
│  └─ Application Services                                    │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer                                               │
│  ├─ Entities (Contact, Deal, Account, Activity, etc.)       │
│  ├─ Value Objects                                           │
│  ├─ Domain Events                                           │
│  ├─ Aggregate Roots                                         │
│  ├─ Domain Services                                         │
│  └─ Repository Interfaces                                   │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                       │
│  ├─ EF Core DbContext (tenant-scoped)                       │
│  ├─ Repository Implementations                              │
│  ├─ Email Integration Services (Graph API, Gmail API)       │
│  ├─ Background Jobs (Hangfire/Quartz.NET)                   │
│  ├─ Caching (Redis)                                         │
│  ├─ File Storage (Azure Blob/S3)                            │
│  └─ External Service Integrations                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                               │
├──────────────────────┬──────────────────────────────────────┤
│  PostgreSQL Database │  Redis Cache         │  File Storage │
│  - Multi-tenant data │  - Session data      │  - Attachments│
│  - JSONB for custom  │  - Query cache       │  - Exports    │
│  - Row-Level Security│  - Real-time state   │  - Imports    │
└──────────────────────┴──────────────────────┴───────────────┘
```

## Component Boundaries

### 1. Frontend Layer

#### 1.1 Angular Web Application
**Responsibility:** User interface for desktop/web access

**Key Components:**
- **Core Module:** Singleton services (AuthService, TenantService, SignalRService)
- **Shared Module:** Reusable components, directives, pipes
- **Feature Modules:**
  - Contacts Module
  - Deals Module
  - Accounts Module
  - Activities Module
  - Email Integration Module
  - Settings/Admin Module
- **State Management:** NgRx or Akita for complex state
- **Real-time Connection:** SignalR client for live updates

**Dependencies:**
- Consumes: REST API, SignalR Hubs
- Provides: User interface, client-side validation

#### 1.2 .NET MAUI Mobile Application
**Responsibility:** Native mobile experience with offline capabilities

**Key Components:**
- Shared business logic (cross-platform)
- Platform-specific implementations (iOS/Android)
- Local SQLite database for offline data
- Sync engine for conflict resolution
- Push notification handler

**Dependencies:**
- Consumes: REST API, Push notification service
- Provides: Mobile UI, offline-first experience

### 2. API Layer (.NET Core 10)

#### 2.1 Presentation Layer

**Controllers:**
- `ContactsController`: CRUD for contacts, custom fields, bulk operations
- `DealsController`: Deal management, pipeline operations
- `AccountsController`: Account/company management
- `ActivitiesController`: Tasks, meetings, calls, notes
- `EmailsController`: Email sync, send, threading
- `UsersController`: User management, profile
- `TenantsController`: Tenant configuration, settings
- `AuthController`: Authentication, token management

**SignalR Hubs:**
- `NotificationHub`: Real-time notifications
- `ActivityHub`: Live activity updates
- `DealHub`: Pipeline stage changes

**Middleware (Pipeline Order):**
1. Exception handling
2. Request logging
3. Tenant resolution (subdomain/header)
4. Authentication (JWT)
5. Authorization
6. Tenant context injection
7. Request validation

**Dependencies:**
- Consumes: Application layer use cases
- Provides: HTTP endpoints, WebSocket connections

#### 2.2 Application Layer

**Use Cases / Command Handlers:**
- `CreateContactCommand` / `CreateContactHandler`
- `UpdateDealStageCommand` / `UpdateDealStageHandler`
- `SyncEmailsCommand` / `SyncEmailsHandler`
- `AssignPermissionsCommand` / `AssignPermissionsHandler`

**Query Handlers:**
- `GetContactByIdQuery` / `GetContactByIdHandler`
- `GetDealsPipelineQuery` / `GetDealsPipelineHandler`
- `GetActivityTimelineQuery` / `GetActivityTimelineHandler`

**Application Services:**
- `CustomFieldService`: Dynamic field management
- `PermissionService`: RBAC evaluation, field-level access
- `AuditService`: Activity trail logging
- `NotificationService`: Real-time notification dispatch
- `EmailSyncService`: OAuth token management, sync orchestration

**Dependencies:**
- Consumes: Domain layer, Infrastructure services
- Provides: Business logic coordination, DTOs

#### 2.3 Domain Layer

**Entities (Aggregate Roots):**
- `Tenant`: Tenant configuration, settings, subscription
- `User`: User profile, roles, permissions
- `Contact`: Person entity with standard and custom fields
- `Account`: Company/organization entity
- `Deal`: Sales opportunity with pipeline stage
- `Activity`: Base class for tasks, meetings, calls, notes, emails
- `EmailMessage`: Email with threading, attachments
- `CustomFieldDefinition`: Dynamic field schema
- `Pipeline`: Configurable deal stages
- `Role`: RBAC role with permissions
- `AuditLog`: Activity trail entry

**Value Objects:**
- `Email`, `PhoneNumber`, `Address`
- `Money`, `DateRange`
- `CustomFieldValue` (JSONB wrapper)

**Domain Events:**
- `ContactCreated`, `DealStageChanged`, `EmailReceived`
- `PermissionGranted`, `CustomFieldAdded`

**Domain Services:**
- `TenantIsolationService`: Ensure data access rules
- `PermissionEvaluator`: Complex permission logic
- `DealPipelineService`: Stage transition rules

**Dependencies:**
- Consumes: None (pure domain logic)
- Provides: Business rules, invariants

#### 2.4 Infrastructure Layer

**Persistence:**
- `ApplicationDbContext`: EF Core context with tenant filter
- Generic `Repository<T>` implementations
- `UnitOfWork` pattern for transactions
- Tenant-scoped connection strings (if schema-per-tenant)

**External Integrations:**
- `GraphApiEmailService`: Microsoft Graph for Outlook/O365
- `GmailApiService`: Gmail API for Google email
- `OAuthTokenManager`: Token refresh, storage

**Background Jobs:**
- `EmailSyncJob`: Periodic email synchronization
- `NotificationJob`: Digest notifications
- `DataExportJob`: Report generation
- `AuditCleanupJob`: Archive old audit logs

**Caching:**
- `RedisCacheService`: Distributed cache for permissions, custom fields
- Cache invalidation strategy

**File Storage:**
- `BlobStorageService`: Document/attachment storage
- Virus scanning integration

**Dependencies:**
- Consumes: Domain repositories, application services
- Provides: Technical implementations

### 3. Data Layer

#### 3.1 PostgreSQL Database

**Multi-Tenancy Strategy:** Shared database with tenant discriminator

**Schema Design:**

**Core Tables:**
```sql
-- Tenant isolation
Tenants (Id, Name, Subdomain, Settings JSONB, SubscriptionTier, IsActive)
Users (Id, TenantId, Email, PasswordHash, RoleId, Settings JSONB)

-- CRM Entities
Contacts (Id, TenantId, FirstName, LastName, Email, AccountId, OwnerId,
          CustomFields JSONB, CreatedAt, ModifiedAt)
Accounts (Id, TenantId, Name, Industry, CustomFields JSONB, ...)
Deals (Id, TenantId, Title, Value, PipelineStageId, ContactId,
       CustomFields JSONB, ExpectedCloseDate, ...)
Activities (Id, TenantId, Type, Subject, Description, ContactId, DealId,
            DueDate, CompletedAt, AssignedToId, CustomFields JSONB)
EmailMessages (Id, TenantId, MessageId, ThreadId, From, To, Subject,
               Body, ReceivedAt, SyncedAt, Attachments JSONB)

-- Dynamic Configuration
CustomFieldDefinitions (Id, TenantId, EntityType, FieldName, DataType,
                        Required, Options JSONB)
Pipelines (Id, TenantId, Name, IsDefault)
PipelineStages (Id, PipelineId, Name, Order, Probability)

-- RBAC
Roles (Id, TenantId, Name, IsSystemRole)
Permissions (Id, RoleId, Resource, Action, FieldLevelPermissions JSONB)

-- Audit
AuditLogs (Id, TenantId, UserId, EntityType, EntityId, Action,
           Changes JSONB, Timestamp)
```

**Indexing Strategy:**
- Composite indexes on (TenantId, CreatedAt)
- GIN indexes on JSONB custom fields
- Full-text search indexes on contact/account names
- Partial indexes for active/deleted records

**Row-Level Security (RLS):**
```sql
CREATE POLICY tenant_isolation ON Contacts
  USING (TenantId = current_setting('app.current_tenant')::uuid);
```

**Dependencies:**
- Consumed by: EF Core DbContext
- Provides: Persistent data storage

#### 3.2 Redis Cache

**Use Cases:**
- Session storage
- Permission cache (reduce DB hits)
- Custom field definitions cache
- Real-time notification queues
- Rate limiting counters

#### 3.3 File Storage

**Structure:**
- `{tenantId}/contacts/{contactId}/{filename}`
- `{tenantId}/emails/attachments/{emailId}/{filename}`
- `{tenantId}/exports/{exportId}.csv`

**Dependencies:**
- Consumed by: API controllers, background jobs
- Provides: Blob storage

## Data Flow

### 1. Request Flow (Read Operation)

```
User (Angular)
  → HTTP GET /api/contacts/123
  → Load Balancer (resolve tenant from subdomain)
  → API Controller (authenticated, authorized)
  → Query Handler (GetContactByIdQuery)
  → Repository (EF Core with tenant filter)
  → PostgreSQL (RLS applied)
  ← Contact entity
  ← Map to DTO
  ← Permission filter (field-level)
  ← JSON response
  ← Update UI
```

### 2. Request Flow (Write Operation with Domain Event)

```
User (Angular)
  → HTTP POST /api/deals {title, value, stageId}
  → API Controller (validate, authorize)
  → Command Handler (CreateDealCommand)
  → Domain Service (validate business rules)
  → Deal entity created
  → Domain Event raised (DealCreated)
  → Repository.Add(deal)
  → UnitOfWork.SaveChanges()
  → PostgreSQL (insert with TenantId)
  → Event Handler (DealCreatedHandler)
    → NotificationService (create notification)
    → SignalR Hub (broadcast to connected clients)
    → AuditService (log creation)
  ← Deal DTO
  ← JSON response
  ← Update UI
  ← Real-time notification appears
```

### 3. Email Sync Flow

```
Background Job (every 5 minutes)
  → EmailSyncService.SyncAllTenants()
  → For each tenant with email integration:
    → Retrieve OAuth token from secure storage
    → Refresh token if expired
    → Call Graph API / Gmail API
    → Get new messages since last sync
    → For each message:
      → Map to EmailMessage entity
      → Attempt to match sender/recipient to Contacts
      → Create Activity record
      → Store attachments in blob storage
      → Repository.Add(emailMessage)
    → UnitOfWork.SaveChanges()
    → Raise EmailReceived event
    → NotificationService (notify assigned users)
    → SignalR Hub (real-time update)
  → Update last sync timestamp
```

### 4. Real-Time Notification Flow

```
Server-side event (deal stage changed)
  → Domain Event Handler
  → NotificationService.Create()
  → Persist to database
  → Determine recipients (deal owner, followers)
  → SignalR Hub.Clients.User(userId).SendAsync("DealUpdated", payload)
  → Angular SignalR client receives message
  → NgRx action dispatched
  → State updated
  → UI component receives update via selector
  → Toast notification displayed
```

### 5. Custom Field Handling

```
Admin creates custom field
  → POST /api/custom-fields
  → CustomFieldDefinition created
  → Cache invalidated (Redis)
  → Broadcast schema change via SignalR

User enters custom field value
  → POST /api/contacts {standardFields, customFields: {field1: value1}}
  → Controller validates against cached schema
  → Command handler validates data types
  → Entity.CustomFields (JSONB) updated
  → PostgreSQL stores as JSONB
  → GIN index updated for searchability

Query contacts by custom field
  → GET /api/contacts?customField.Industry=Healthcare
  → Query handler builds JSONB query
  → PostgreSQL: WHERE CustomFields @> '{"Industry": "Healthcare"}'
  → Return results
```

## Multi-Tenancy Implementation

### Tenant Isolation Strategies

**Chosen Approach: Shared Database with Discriminator Column**

**Rationale:**
- Cost-effective for mid-size organizations
- Easier to maintain and backup
- Good performance with proper indexing
- Supports thousands of tenants on single database

**Implementation:**

1. **Tenant Resolution (Middleware):**
```csharp
public class TenantResolutionMiddleware
{
    public async Task InvokeAsync(HttpContext context)
    {
        var tenantId = ExtractTenantId(context.Request);
        context.Items["TenantId"] = tenantId;

        // Set PostgreSQL session variable for RLS
        await _dbContext.Database.ExecuteSqlRawAsync(
            "SELECT set_config('app.current_tenant', {0}, false)",
            tenantId);

        await _next(context);
    }
}
```

2. **Global Query Filter (EF Core):**
```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Contact>()
        .HasQueryFilter(c => c.TenantId == _tenantProvider.GetTenantId());

    // Apply to all tenant-scoped entities
}
```

3. **Row-Level Security (PostgreSQL):**
```sql
ALTER TABLE Contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON Contacts
  USING (TenantId = current_setting('app.current_tenant')::uuid)
  WITH CHECK (TenantId = current_setting('app.current_tenant')::uuid);
```

**Defense in Depth:**
- Application-level filtering (EF Core query filters)
- Database-level enforcement (RLS)
- API-level validation (middleware)

### Tenant-Specific Customization

**Custom Fields:**
- Stored in JSONB column per entity
- Schema defined in CustomFieldDefinitions table
- Validated at application layer
- Indexed with GIN for query performance

**Pipelines:**
- Each tenant has custom pipeline stages
- Stored in Pipelines and PipelineStages tables
- Referenced by Deals

**Permissions:**
- Tenant-specific roles and permissions
- Cached in Redis with TTL
- Field-level permissions stored in JSONB

## Security Architecture

### Authentication & Authorization

**Authentication Flow:**
1. User submits credentials to `/api/auth/login`
2. Validate tenant + email + password
3. Generate JWT with claims (userId, tenantId, roleId)
4. Return access token (15 min) + refresh token (7 days)
5. Frontend stores in httpOnly cookie or localStorage

**Authorization Layers:**
1. **Controller-level:** `[Authorize(Roles = "Admin")]`
2. **Resource-level:** Permission service checks CRUD permissions
3. **Field-level:** Filter DTO fields based on permissions

**RBAC Implementation:**
```csharp
public class PermissionService
{
    public async Task<bool> CanAccess(
        string resource,
        string action,
        string field = null)
    {
        var permissions = await GetUserPermissions();

        var permission = permissions.FirstOrDefault(
            p => p.Resource == resource && p.Action == action);

        if (permission == null) return false;

        if (field != null)
        {
            var fieldPermissions = permission.FieldLevelPermissions;
            return fieldPermissions.Contains(field);
        }

        return true;
    }
}
```

### Email Integration Security

**OAuth 2.0 Flow:**
1. User initiates connection in Settings
2. Redirect to OAuth provider (Microsoft/Google)
3. User consents to permissions
4. Receive authorization code
5. Exchange for access + refresh tokens
6. Encrypt and store tokens in database
7. Background job refreshes tokens before expiry

**Token Storage:**
- Encrypted at rest using ASP.NET Core Data Protection
- Scoped to user + tenant
- Revocable by user

## Performance & Scalability

### Database Optimization

**Indexing Strategy:**
```sql
-- Tenant isolation queries
CREATE INDEX idx_contacts_tenantid_createdat
  ON Contacts(TenantId, CreatedAt DESC);

-- Custom field searches
CREATE INDEX idx_contacts_customfields
  ON Contacts USING GIN (CustomFields jsonb_path_ops);

-- Full-text search
CREATE INDEX idx_contacts_search
  ON Contacts USING GIN (to_tsvector('english',
    FirstName || ' ' || LastName || ' ' || Email));

-- Foreign key lookups
CREATE INDEX idx_activities_contactid
  ON Activities(ContactId) WHERE ContactId IS NOT NULL;
```

**Query Optimization:**
- Use compiled queries for frequent operations
- Implement CQRS for complex read models
- Denormalize data where appropriate (e.g., contact name on activities)
- Pagination with cursor-based approach for large datasets

### Caching Strategy

**Cache Layers:**
1. **Application Memory Cache:** Hot data (current user permissions)
2. **Redis Distributed Cache:** Shared data (custom field schemas)
3. **HTTP Cache:** Static resources (Angular bundles)

**Cache Invalidation:**
- Time-based: TTL on permissions (5 min), custom fields (15 min)
- Event-based: Invalidate on schema changes via domain events
- Tag-based: Invalidate all tenant data on tenant setting change

### Real-Time Performance

**SignalR Scaling:**
- Use Redis backplane for multi-server scenarios
- Group connections by tenant for efficient broadcasting
- Implement connection throttling per tenant

**Connection Management:**
```csharp
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var tenantId = Context.User.GetTenantId();
        var userId = Context.User.GetUserId();

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            $"tenant:{tenantId}");
        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            $"user:{userId}");

        await base.OnConnectedAsync();
    }
}
```

### Horizontal Scaling

**Stateless API Design:**
- No in-memory session state
- JWT tokens for authentication (no server-side sessions)
- Redis for distributed cache
- SignalR with Redis backplane

**Database Scaling:**
- Read replicas for reporting queries
- Connection pooling (max 100 per instance)
- Consider partitioning by TenantId for very large deployments

## Build Order & Dependencies

### Phase 1: Foundation (Weeks 1-3)

**Goal:** Establish core infrastructure and authentication

**Components to Build:**
1. **Database Schema**
   - Create Tenants, Users, Roles, Permissions tables
   - Implement RLS policies
   - Seed system roles

2. **.NET Core Project Structure**
   - Set up solution with layered architecture
   - Domain, Application, Infrastructure, API projects
   - Configure dependency injection

3. **Multi-Tenancy Infrastructure**
   - Tenant resolution middleware
   - EF Core tenant scoped DbContext
   - Tenant provider service

4. **Authentication & Authorization**
   - JWT authentication
   - Authorization policies
   - User registration/login endpoints

5. **Basic Angular Setup**
   - Project structure with modules
   - Auth module (login, register)
   - HTTP interceptors (auth token, tenant header)
   - Route guards

**Deliverable:** Users can register, login, and access tenant-scoped API

### Phase 2: Core CRM Entities (Weeks 4-6)

**Goal:** Implement basic CRUD for main entities

**Components to Build:**
1. **Contact Management**
   - Contact entity, repository, use cases
   - Contacts API endpoints
   - Angular contacts module (list, create, edit, delete)

2. **Account Management**
   - Account entity, repository, use cases
   - Accounts API endpoints
   - Angular accounts module

3. **Custom Fields System**
   - CustomFieldDefinition entity
   - Dynamic field validation service
   - JSONB handling in EF Core
   - Admin UI for field configuration

4. **RBAC Implementation**
   - Permission evaluation service
   - Role management APIs
   - Admin UI for role configuration

**Deliverable:** Users can manage contacts and accounts with custom fields

**Dependencies:** Phase 1 must be complete

### Phase 3: Deals & Pipelines (Weeks 7-8)

**Goal:** Implement sales pipeline functionality

**Components to Build:**
1. **Pipeline Configuration**
   - Pipeline and PipelineStage entities
   - Pipeline management APIs
   - Admin UI for pipeline setup

2. **Deal Management**
   - Deal entity with stage tracking
   - Deal CRUD operations
   - Deal stage transition logic with validation

3. **Deal Pipeline UI**
   - Kanban board view
   - Drag-and-drop stage changes
   - Deal detail view

**Deliverable:** Users can configure pipelines and manage deals

**Dependencies:** Phase 2 (Contacts, Accounts)

### Phase 4: Activities & Timeline (Weeks 9-10)

**Goal:** Activity management and audit trail

**Components to Build:**
1. **Activity System**
   - Activity base entity (tasks, meetings, calls, notes)
   - Activity CRUD operations
   - Activity assignment and due dates

2. **Audit Logging**
   - AuditLog entity
   - Audit interceptor for EF Core
   - Change tracking logic

3. **Timeline UI**
   - Activity timeline component
   - Filtering and search
   - Activity creation forms

**Deliverable:** Users can log activities and view audit trail

**Dependencies:** Phase 2 (Contacts, Accounts), Phase 3 (Deals)

### Phase 5: Email Integration (Weeks 11-13)

**Goal:** Two-way email sync with Gmail and Outlook

**Components to Build:**
1. **OAuth Integration**
   - OAuth callback endpoints
   - Token storage and refresh logic
   - Settings UI for email connection

2. **Email Sync Engine**
   - Graph API service (Outlook)
   - Gmail API service
   - Email sync background job
   - Message threading logic

3. **Email UI**
   - Email list and detail views
   - Send email functionality
   - Link emails to contacts/deals

**Deliverable:** Users can connect email accounts and sync messages

**Dependencies:** Phase 2 (Contacts), Phase 4 (Activities)

### Phase 6: Real-Time & Notifications (Weeks 14-15)

**Goal:** Live updates and notification system

**Components to Build:**
1. **SignalR Infrastructure**
   - SignalR hubs (Notification, Activity, Deal)
   - Redis backplane setup
   - Connection management

2. **Notification System**
   - Notification entity and service
   - Event handlers for domain events
   - Notification preferences

3. **Real-Time UI**
   - Angular SignalR client service
   - Toast notifications component
   - Live updates in lists (contacts, deals)

**Deliverable:** Users receive real-time notifications and live updates

**Dependencies:** All previous phases (consumes their domain events)

### Phase 7: Mobile App (Weeks 16-18)

**Goal:** .NET MAUI mobile application

**Components to Build:**
1. **MAUI Project Setup**
   - Cross-platform project structure
   - Shared business logic
   - Platform-specific services

2. **Offline Sync**
   - Local SQLite database
   - Sync engine with conflict resolution
   - Queue for offline operations

3. **Mobile UI**
   - Contact and deal views
   - Activity logging
   - Push notifications

**Deliverable:** Mobile app with offline capabilities

**Dependencies:** Phases 1-5 (consumes existing APIs)

### Phase 8: Reporting & Advanced Features (Weeks 19-20)

**Goal:** Reporting, bulk operations, and admin tools

**Components to Build:**
1. **Reporting**
   - Report builder with custom fields
   - Export to CSV/Excel
   - Scheduled reports

2. **Bulk Operations**
   - Bulk import (CSV)
   - Bulk edit
   - Bulk delete with confirmation

3. **Admin Tools**
   - Tenant settings management
   - User management
   - System health dashboard

**Deliverable:** Complete feature set for production

**Dependencies:** All previous phases

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────┐
│  CDN (Static Assets)                        │
│  - Angular bundles, images, fonts           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Load Balancer (nginx/AWS ALB)              │
│  - SSL termination                          │
│  - Tenant routing                           │
└─────────────────────────────────────────────┘
         ↓                    ↓
┌──────────────────┐  ┌──────────────────┐
│  API Server 1    │  │  API Server 2    │
│  (.NET Core 10)  │  │  (.NET Core 10)  │
│  - Docker        │  │  - Docker        │
│  - SignalR       │  │  - SignalR       │
└──────────────────┘  └──────────────────┘
         ↓                    ↓
    ┌────────────────────────────┐
    │  Redis (Backplane + Cache) │
    └────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│  PostgreSQL (Primary)                       │
│  - Multi-tenant data                        │
│  - RLS enabled                              │
│  - Connection pooling                       │
└─────────────────────────────────────────────┘
         ↓ Replication
┌─────────────────────────────────────────────┐
│  PostgreSQL (Read Replica)                  │
│  - Reporting queries                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Background Job Server (Hangfire)           │
│  - Email sync jobs                          │
│  - Notification digests                     │
│  - Scheduled reports                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Blob Storage (S3/Azure Blob)               │
│  - Attachments, exports, imports            │
└─────────────────────────────────────────────┘
```

### Monitoring & Observability

**Application Monitoring:**
- Application Insights / ELK stack
- Structured logging (Serilog)
- Performance counters (response times, error rates)
- Custom metrics (active tenants, API usage per tenant)

**Database Monitoring:**
- Query performance
- Connection pool utilization
- RLS policy performance
- JSONB query optimization

**Alert Thresholds:**
- API error rate > 1%
- Average response time > 500ms
- Database connection pool > 80%
- Email sync failures per tenant

## Risk Mitigation

### Data Isolation Risks

**Risk:** Tenant data leakage due to missing TenantId filter

**Mitigation:**
- Triple-layer defense (middleware, EF Core filter, RLS)
- Integration tests for all queries
- Regular security audits
- Automated tests that verify tenant isolation

### Performance Risks

**Risk:** N+1 query problems with custom fields

**Mitigation:**
- Eager loading strategies
- Compiled queries
- Query performance monitoring
- CQRS for complex reads

### Email Sync Risks

**Risk:** Token expiration, API rate limits, sync conflicts

**Mitigation:**
- Automatic token refresh
- Exponential backoff on failures
- Rate limit per tenant
- Last-sync-timestamp tracking
- Manual re-sync option

### Scalability Risks

**Risk:** Single database bottleneck with many tenants

**Mitigation:**
- Read replicas for reporting
- Redis caching layer
- Connection pooling
- Future option: shard by TenantId for enterprise tier

## Technology Stack Justification

| Component | Technology | Justification |
|-----------|------------|---------------|
| Frontend | Angular | Enterprise-grade SPA framework, strong typing with TypeScript, excellent tooling |
| Backend | .NET Core 10 | High performance, cross-platform, strong ecosystem, excellent async/await support |
| Database | PostgreSQL | JSONB for custom fields, RLS for multi-tenancy, excellent performance, ACID compliance |
| ORM | Entity Framework Core | Mature, type-safe, good migration support, query filters for multi-tenancy |
| Real-time | SignalR | Native .NET integration, automatic fallback, scales with Redis backplane |
| Cache | Redis | Fast, distributed, supports pub/sub for SignalR, widely adopted |
| Mobile | .NET MAUI | Code sharing with backend, native performance, single codebase for iOS/Android |
| Background Jobs | Hangfire | Built for .NET, persistent jobs, dashboard, distributed locks |
| Validation | FluentValidation | Expressive, testable, reusable validation rules |
| Logging | Serilog | Structured logging, many sinks, excellent .NET integration |

## Conclusion

The proposed architecture for GlobCRM follows industry best practices for multi-tenant SaaS applications while addressing the specific requirements of a CRM system. Key architectural decisions include:

1. **Shared database with tenant discriminator** for cost-effectiveness and maintainability
2. **Clean architecture with CQRS** for separation of concerns and scalability
3. **JSONB for custom fields** to enable tenant-specific customization without schema changes
4. **Triple-layer tenant isolation** (app, ORM, database) for security
5. **API-first design** to support both web and mobile clients
6. **SignalR for real-time** to enhance user experience
7. **Background jobs for email sync** to maintain responsiveness

The phased build order ensures that foundational components (multi-tenancy, auth, core entities) are stable before adding complex features (email integration, real-time, mobile). Each phase delivers tangible value and can be validated before moving forward.

This architecture supports the initial target of mid-size organizations while maintaining a path to scale for enterprise customers through database sharding, microservices extraction, or dedicated database instances for large tenants.

---

**Next Steps:**
1. Validate this architecture with stakeholders
2. Create detailed API specifications based on component boundaries
3. Set up development environment and CI/CD pipeline
4. Begin Phase 1 implementation
