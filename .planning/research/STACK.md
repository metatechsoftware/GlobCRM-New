# Technology Stack Research: GlobCRM

**Research Date:** 2026-02-16
**Project:** Multi-tenant SaaS CRM
**Core Stack:** Angular + .NET Core 10 + PostgreSQL + .NET MAUI

---

## Executive Summary

This document defines the recommended technology stack for GlobCRM, a multi-tenant SaaS CRM platform. The stack is optimized for:
- **Scalability**: Support for 10-50 concurrent users per tenant with growth potential
- **Multi-tenancy**: Database-per-schema isolation with shared infrastructure
- **Real-time capabilities**: SignalR for notifications and live updates
- **Mobile-first**: .NET MAUI for native iOS/Android apps
- **Developer productivity**: Strong typing, modern tooling, and active communities

**Version Note**: Knowledge cutoff January 2025. Verify all versions against official documentation before implementation.

---

## 1. Frontend Stack (Angular)

### Core Framework
- **Angular 19** (Latest LTS as of Jan 2025)
  - **Rationale**: Standalone components (default), signals for reactivity, improved SSR, better DX
  - **Why NOT Angular 18**: Missing latest performance optimizations and signal-based APIs
  - **Confidence**: ⭐⭐⭐⭐⭐ (Production-ready, LTS support)

### State Management
- **NgRx 19** with SignalStore
  - `@ngrx/store`: ^19.0.0
  - `@ngrx/effects`: ^19.0.0
  - `@ngrx/entity`: ^19.0.0
  - `@ngrx/store-devtools`: ^19.0.0
  - `@ngrx/signals`: ^19.0.0 (NEW: signal-based state)
  - **Rationale**:
    - SignalStore provides simpler, more performant state management for feature stores
    - NgRx Store for global state (auth, tenant context, user preferences)
    - Strong TypeScript support, time-travel debugging, Redux DevTools integration
  - **Alternative**: TanStack Query (Angular Query) for server state only
  - **Why NOT**: Akita (stagnant), plain services (scales poorly), RxJS alone (boilerplate hell)
  - **Confidence**: ⭐⭐⭐⭐⭐

### UI Component Library
- **Angular Material 19** (Primary)
  - `@angular/material`: ^19.0.0
  - `@angular/cdk`: ^19.0.0
  - **Rationale**:
    - Official Angular components, excellent accessibility (WCAG 2.1 AA)
    - Customizable via theming, supports dynamic themes for multi-tenant branding
    - CDK provides low-level primitives for custom components
  - **Confidence**: ⭐⭐⭐⭐⭐

- **PrimeNG 19** (Supplemental for data-heavy components)
  - `primeng`: ^19.0.0
  - `primeicons`: ^7.0.0
  - **Rationale**:
    - Advanced data tables with virtual scrolling, filtering, sorting
    - Chart library for dashboards
    - Calendar/scheduler components for activity management
  - **Why NOT**: DevExtreme (expensive), AG Grid (overkill for CRM), Syncfusion (licensing complexity)
  - **Confidence**: ⭐⭐⭐⭐

### Forms & Validation
- **Angular Reactive Forms** (built-in)
- **ngx-formly 7.x**
  - `@ngx-formly/core`: ^7.0.0
  - `@ngx-formly/material`: ^7.0.0
  - **Rationale**:
    - Dynamic form generation for custom fields (JSONB-backed)
    - JSON-driven forms for configurable deal pipelines
    - Reduces boilerplate by 70%+
  - **Confidence**: ⭐⭐⭐⭐⭐

### HTTP & API Integration
- **Built-in HttpClient** with interceptors
- **@microsoft/signalr 8.x** for real-time
  - `@microsoft/signalr`: ^8.0.0
  - **Rationale**: Bi-directional communication for notifications, live activity updates
  - **Confidence**: ⭐⭐⭐⭐⭐

### Authentication & Security
- **angular-oauth2-oidc 18.x**
  - `angular-oauth2-oidc`: ^18.0.0
  - **Rationale**:
    - Standards-compliant OAuth2/OIDC client
    - Integrates with Identity Server or external providers (Auth0, Azure AD)
    - Token refresh handling, PKCE flow support
  - **Alternative**: Auth0 Angular SDK (if using Auth0)
  - **Confidence**: ⭐⭐⭐⭐

### Date/Time Handling
- **date-fns 4.x** (NOT moment.js)
  - `date-fns`: ^4.0.0
  - **Rationale**:
    - Tree-shakeable, immutable, 13KB vs moment's 67KB
    - Excellent timezone support via `date-fns-tz`
  - **Why NOT**: Moment.js (deprecated), Day.js (smaller community)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Rich Text Editing
- **Quill 2.x** or **TinyMCE 7.x**
  - `quill`: ^2.0.0 or `tinymce`: ^7.0.0
  - **Rationale**:
    - Quill: Lightweight, extensible, open-source (MIT)
    - TinyMCE: More features, commercial support available
    - Required for email composition, notes, descriptions
  - **Confidence**: ⭐⭐⭐⭐

### PDF Generation (Client-side)
- **jsPDF 2.x** + **html2canvas 1.x**
  - `jspdf`: ^2.5.0
  - `html2canvas`: ^1.4.0
  - **Rationale**: Client-side preview, server-side generation (primary)
  - **Confidence**: ⭐⭐⭐

### Email Integration UI
- **ngx-email-builder** or custom components
  - **Rationale**: Template builder for email campaigns
  - **Confidence**: ⭐⭐⭐ (May need customization)

### Testing
- **Jest 29.x** (NOT Karma/Jasmine)
  - `jest`: ^29.7.0
  - `@testing-library/angular`: ^17.0.0
  - **Rationale**:
    - 3x faster than Karma, better watch mode, snapshot testing
    - Testing Library promotes accessible, user-centric tests
  - **Why NOT**: Karma (deprecated in Angular 16+)
  - **Confidence**: ⭐⭐⭐⭐⭐

- **Playwright 1.x** (E2E)
  - `@playwright/test`: ^1.50.0
  - **Rationale**:
    - Cross-browser testing, auto-wait, network interception
    - Replaces Protractor (officially deprecated)
  - **Why NOT**: Cypress (licensing for parallelization), Protractor (dead)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Build & Tooling
- **Angular CLI 19** with esbuild
  - **Rationale**:
    - esbuild provides 10x faster builds vs webpack
    - Default in Angular 17+
  - **Confidence**: ⭐⭐⭐⭐⭐

- **ESLint 9.x** + **Prettier 3.x**
  - `eslint`: ^9.0.0
  - `prettier`: ^3.2.0
  - `@angular-eslint/eslint-plugin`: ^19.0.0
  - **Rationale**: Standard linting + formatting
  - **Confidence**: ⭐⭐⭐⭐⭐

### Performance Monitoring
- **@sentry/angular 8.x**
  - `@sentry/angular`: ^8.0.0
  - **Rationale**: Error tracking, performance monitoring, release tracking
  - **Alternative**: Application Insights (if Azure-hosted)
  - **Confidence**: ⭐⭐⭐⭐

---

## 2. Backend Stack (.NET Core 10)

### Core Framework
- **.NET 10** (LTS expected Nov 2025)
  - **Note**: As of Jan 2025, .NET 9 is current. Verify .NET 10 release status.
  - **Rationale**:
    - LTS support (3 years), improved performance, native AOT
    - Enhanced minimal APIs, better OpenAPI integration
  - **Confidence**: ⭐⭐⭐⭐ (Pending release verification)

### Web API
- **ASP.NET Core Web API** (minimal APIs for simple endpoints, controllers for complex)
  - **Rationale**:
    - Minimal APIs for CRUD operations (less boilerplate)
    - MVC controllers for complex business logic (better organization)
    - Built-in OpenAPI/Swagger support
  - **Confidence**: ⭐⭐⭐⭐⭐

### ORM & Database Access
- **Entity Framework Core 10**
  - `Microsoft.EntityFrameworkCore`: ^10.0.0
  - `Microsoft.EntityFrameworkCore.Design`: ^10.0.0
  - `Npgsql.EntityFrameworkCore.PostgreSQL`: ^10.0.0
  - **Rationale**:
    - First-class PostgreSQL support via Npgsql
    - JSONB column mapping for custom fields
    - Migrations for schema versioning
    - Interceptors for audit trail, soft deletes, tenant isolation
  - **Confidence**: ⭐⭐⭐⭐⭐

- **Dapper 2.x** (Supplemental for read-heavy queries)
  - `Dapper`: ^2.1.0
  - **Rationale**:
    - 10x faster than EF Core for complex reporting queries
    - Use for dashboards, reports, analytics
    - NOT for writes (EF handles change tracking, audit)
  - **Confidence**: ⭐⭐⭐⭐

### Multi-Tenancy
- **Finbuckle.MultiTenant 8.x**
  - `Finbuckle.MultiTenant`: ^8.0.0
  - `Finbuckle.MultiTenant.AspNetCore`: ^8.0.0
  - `Finbuckle.MultiTenant.EntityFrameworkCore`: ^8.0.0
  - **Rationale**:
    - Schema-per-tenant isolation (PostgreSQL schemas)
    - Middleware for tenant resolution (subdomain, header, claim)
    - EF Core integration for automatic tenant filtering
  - **Alternative**: Custom implementation (more control, more work)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Authentication & Authorization
- **ASP.NET Core Identity**
  - `Microsoft.AspNetCore.Identity.EntityFrameworkCore`: ^10.0.0
  - **Rationale**: Built-in user management, password hashing, lockout
  - **Confidence**: ⭐⭐⭐⭐⭐

- **IdentityServer/Duende IdentityServer 7.x** or **OpenIddict 5.x**
  - `Duende.IdentityServer`: ^7.0.0 (commercial license required for production)
  - `OpenIddict`: ^5.0.0 (open-source, free)
  - **Rationale**:
    - OAuth2/OIDC provider for SPA + mobile apps
    - OpenIddict recommended (free, actively maintained, certified)
  - **Alternative**: Auth0, Azure AD B2C (managed services)
  - **Why NOT**: IdentityServer4 (deprecated)
  - **Confidence**: ⭐⭐⭐⭐⭐ (OpenIddict), ⭐⭐⭐ (Duende licensing complexity)

- **PolicyServer or custom policy-based authorization**
  - Built-in: `[Authorize(Policy = "...")]`
  - **Rationale**: RBAC with field-level access via custom policies
  - **Confidence**: ⭐⭐⭐⭐

### Real-Time Communication
- **ASP.NET Core SignalR**
  - Built-in, no additional packages
  - **Rationale**:
    - WebSockets for notifications, live activity updates
    - Automatic fallback to long polling
    - Redis backplane for multi-server scaling
  - **Confidence**: ⭐⭐⭐⭐⭐

### Background Jobs
- **Hangfire 1.8.x** or **Quartz.NET 3.x**
  - `Hangfire.Core`: ^1.8.0
  - `Hangfire.AspNetCore`: ^1.8.0
  - `Hangfire.PostgreSql`: ^1.20.0
  - **Rationale**:
    - Persistent jobs (email sync, data imports, reports)
    - Dashboard for monitoring
    - Hangfire preferred (better UI, simpler setup)
  - **Alternative**: Azure Functions/AWS Lambda (serverless)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Email Sending
- **MailKit 4.x** (NOT SmtpClient)
  - `MailKit`: ^4.0.0
  - `MimeKit`: ^4.0.0
  - **Rationale**:
    - OAuth2 support (Gmail, Outlook)
    - IMAP for email sync (two-way)
    - SmtpClient is deprecated
  - **Confidence**: ⭐⭐⭐⭐⭐

- **SendGrid SDK 9.x** or **Amazon SES SDK** (transactional emails)
  - `SendGrid`: ^9.29.0
  - **Rationale**: Reliable delivery, tracking, templates
  - **Confidence**: ⭐⭐⭐⭐

### PDF Generation (Server-side)
- **QuestPDF 2024.x** (Recommended)
  - `QuestPDF`: ^2024.x
  - **Rationale**:
    - Fluent API, high-performance, modern
    - MIT license (verify for commercial use)
  - **Alternative**: DinkToPdf (wrapper for wkhtmltopdf), IronPdf (expensive)
  - **Why NOT**: SelectPdf (outdated), iTextSharp (AGPL licensing issues)
  - **Confidence**: ⭐⭐⭐⭐

### Validation
- **FluentValidation 11.x**
  - `FluentValidation.AspNetCore`: ^11.3.0
  - **Rationale**:
    - Cleaner validation rules vs data annotations
    - Reusable validators, complex conditional logic
    - Automatic integration with ASP.NET Core
  - **Confidence**: ⭐⭐⭐⭐⭐

### API Documentation
- **Swashbuckle.AspNetCore 6.x** or **NSwag 14.x**
  - `Swashbuckle.AspNetCore`: ^6.6.0
  - **Rationale**:
    - OpenAPI 3.0 spec generation
    - Swagger UI for interactive docs
    - Swashbuckle preferred (simpler, more popular)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Logging
- **Serilog 4.x**
  - `Serilog.AspNetCore`: ^8.0.0
  - `Serilog.Sinks.PostgreSQL`: ^2.3.0
  - `Serilog.Sinks.Console`: ^6.0.0
  - `Serilog.Sinks.Seq`: ^8.0.0 (optional, for centralized logs)
  - **Rationale**:
    - Structured logging, queryable logs in PostgreSQL
    - Sinks for console, file, Seq, Application Insights
  - **Why NOT**: Built-in logging (less powerful), NLog (less popular)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Caching
- **Redis (StackExchange.Redis 2.x)**
  - `StackExchange.Redis`: ^2.8.0
  - `Microsoft.Extensions.Caching.StackExchangeRedis`: ^10.0.0
  - **Rationale**:
    - Distributed cache for multi-server deployments
    - Session storage, SignalR backplane
  - **Alternative**: In-memory cache (single-server only)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Mapping
- **Mapster 7.x** (NOT AutoMapper)
  - `Mapster`: ^7.4.0
  - `Mapster.DependencyInjection`: ^1.0.0
  - **Rationale**:
    - 3x faster than AutoMapper, better DX
    - Source generators for compile-time mappings
  - **Why NOT**: AutoMapper (slower, more magic), manual mapping (tedious)
  - **Confidence**: ⭐⭐⭐⭐

### Testing
- **xUnit 2.x**
  - `xunit`: ^2.9.0
  - `xunit.runner.visualstudio`: ^2.8.0
  - **Rationale**: Standard for .NET, better DX than NUnit
  - **Confidence**: ⭐⭐⭐⭐⭐

- **Moq 4.x** or **NSubstitute 5.x**
  - `Moq`: ^4.20.0
  - **Rationale**: Mocking framework for unit tests
  - **Confidence**: ⭐⭐⭐⭐⭐

- **Testcontainers 3.x** (integration tests)
  - `Testcontainers`: ^3.9.0
  - `Testcontainers.PostgreSql`: ^3.9.0
  - **Rationale**: Real PostgreSQL in Docker for integration tests
  - **Confidence**: ⭐⭐⭐⭐⭐

### Monitoring
- **Application Insights SDK** (if Azure)
  - `Microsoft.ApplicationInsights.AspNetCore`: ^2.22.0
  - **Alternative**: Sentry, Datadog, Prometheus + Grafana
  - **Confidence**: ⭐⭐⭐⭐

---

## 3. Database Stack (PostgreSQL)

### Core Database
- **PostgreSQL 17.x** (verify latest stable version)
  - **Rationale**:
    - JSONB for custom fields (indexable, queryable)
    - Row-level security for fine-grained access control
    - Schemas for multi-tenant isolation
    - Full-text search, GIN/GiST indexes, CTEs
  - **Why NOT**: MySQL (weaker JSON support), SQL Server (expensive at scale)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Extensions
- **pgcrypto** (encryption functions)
- **pg_trgm** (trigram similarity for fuzzy search)
- **uuid-ossp** (UUID generation)
- **pg_stat_statements** (query performance monitoring)

### Connection Pooling
- **Npgsql 10.x** (built-in pooling)
  - `Npgsql`: ^10.0.0
  - **Rationale**: Built-in ADO.NET provider, excellent EF Core integration
  - **Confidence**: ⭐⭐⭐⭐⭐

- **PgBouncer** (external pooler for high concurrency)
  - **Rationale**: Connection multiplexing, reduces database load
  - **Use when**: >1000 concurrent connections expected
  - **Confidence**: ⭐⭐⭐⭐

### Migration Tools
- **EF Core Migrations** (primary)
  - **Rationale**: Version-controlled schema changes, integrated with EF
  - **Confidence**: ⭐⭐⭐⭐⭐

- **DbUp 5.x** or **FluentMigrator 5.x** (alternative for complex migrations)
  - `DbUp`: ^5.0.0
  - **Rationale**: SQL-based migrations, better for data migrations
  - **Confidence**: ⭐⭐⭐

### Backup & Recovery
- **pgBackRest** or **WAL-G**
  - **Rationale**: Point-in-time recovery, incremental backups
  - **Alternative**: Managed backups (Azure Database for PostgreSQL, AWS RDS)
  - **Confidence**: ⭐⭐⭐⭐

### Monitoring
- **pgAdmin 4** (GUI)
- **pg_stat_statements** + **pgBadger** (query analysis)
- **Prometheus + postgres_exporter** (metrics)

---

## 4. Mobile Stack (.NET MAUI)

### Core Framework
- **.NET MAUI 10** (ships with .NET 10)
  - **Rationale**:
    - Single codebase for iOS + Android
    - Native performance, native UI controls
    - Shared business logic with backend (C#)
  - **Confidence**: ⭐⭐⭐⭐

### UI Framework
- **MAUI Built-in Controls** + **Community Toolkit**
  - `CommunityToolkit.Maui`: ^9.0.0
  - `CommunityToolkit.Mvvm`: ^8.3.0
  - **Rationale**:
    - Community Toolkit adds missing controls (popup, toast, etc.)
    - MVVM source generators reduce boilerplate
  - **Confidence**: ⭐⭐⭐⭐⭐

### State Management
- **MVVM Toolkit** (built-in via Community Toolkit)
  - `CommunityToolkit.Mvvm`: ^8.3.0
  - **Rationale**: Source generators, observable properties, commands
  - **Confidence**: ⭐⭐⭐⭐⭐

### API Communication
- **Refit 7.x**
  - `Refit`: ^7.0.0
  - `Refit.HttpClientFactory`: ^7.0.0
  - **Rationale**:
    - Type-safe REST client from OpenAPI spec
    - Automatic serialization, retry policies
  - **Confidence**: ⭐⭐⭐⭐⭐

### Real-Time
- **Microsoft.AspNetCore.SignalR.Client 10.x**
  - `Microsoft.AspNetCore.SignalR.Client`: ^10.0.0
  - **Rationale**: Same as web client, consistent API
  - **Confidence**: ⭐⭐⭐⭐⭐

### Local Database
- **SQLite (built-in)** via **sqlite-net-pcl**
  - `sqlite-net-pcl`: ^1.9.0
  - **Rationale**:
    - Offline data storage (contacts, activities)
    - Sync with server when online
  - **Confidence**: ⭐⭐⭐⭐⭐

### Authentication
- **IdentityModel.OidcClient 6.x**
  - `IdentityModel.OidcClient`: ^6.0.0
  - **Rationale**: OAuth2/OIDC client for mobile
  - **Confidence**: ⭐⭐⭐⭐

### Secure Storage
- **MAUI SecureStorage API** (built-in)
  - **Rationale**: Keychain (iOS), KeyStore (Android)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Push Notifications
- **Firebase Cloud Messaging (FCM)** via **Plugin.Firebase**
  - `Plugin.Firebase`: ^3.0.0
  - **Rationale**: Cross-platform push notifications
  - **Alternative**: Azure Notification Hubs
  - **Confidence**: ⭐⭐⭐⭐

### Charts & Graphs
- **Syncfusion MAUI Charts** (free with community license)
  - `Syncfusion.Maui.Charts`: ^27.1.0
  - **Rationale**: Rich charting for dashboard
  - **Alternative**: Microcharts (simpler), LiveCharts (open-source)
  - **Confidence**: ⭐⭐⭐⭐

### Camera & Media
- **MAUI MediaPicker API** (built-in)
- **Plugin.Maui.Audio** for voice memos
  - **Rationale**: Attach photos, documents to activities
  - **Confidence**: ⭐⭐⭐⭐

### Testing
- **xUnit** + **Appium 5.x** (UI automation)
  - `Appium.WebDriver`: ^5.0.0
  - **Rationale**: Cross-platform mobile UI testing
  - **Confidence**: ⭐⭐⭐

---

## 5. DevOps & Infrastructure

### Version Control
- **Git** with **GitHub** or **Azure DevOps**
  - **Rationale**: Standard, CI/CD integrations
  - **Confidence**: ⭐⭐⭐⭐⭐

### CI/CD
- **GitHub Actions** or **Azure Pipelines**
  - **Rationale**:
    - Automated builds, tests, deployments
    - Docker image building
    - Database migrations
  - **Confidence**: ⭐⭐⭐⭐⭐

### Containerization
- **Docker** + **Docker Compose** (dev)
  - **Rationale**: Consistent dev environments
  - **Confidence**: ⭐⭐⭐⭐⭐

- **Kubernetes** (production, optional)
  - **Alternative**: Azure Container Apps, AWS ECS, managed services
  - **Rationale**: Auto-scaling, rolling deployments
  - **When**: >100 tenants or complex microservices
  - **Confidence**: ⭐⭐⭐

### API Gateway (optional)
- **YARP 2.x** (Yet Another Reverse Proxy)
  - `Yarp.ReverseProxy`: ^2.0.0
  - **Rationale**:
    - .NET-native reverse proxy
    - Rate limiting, load balancing, routing
  - **Alternative**: Nginx, Traefik, Azure API Management
  - **Confidence**: ⭐⭐⭐⭐

### Monitoring & Observability
- **Sentry** (errors) or **Application Insights** (Azure)
- **Prometheus + Grafana** (metrics)
- **Seq** or **Elasticsearch + Kibana** (logs)
  - **Rationale**: Full observability stack
  - **Confidence**: ⭐⭐⭐⭐

### CDN
- **Cloudflare** or **Azure CDN**
  - **Rationale**: Static assets (Angular build), DDoS protection
  - **Confidence**: ⭐⭐⭐⭐

### Email Infrastructure
- **SendGrid** or **Amazon SES** (sending)
- **Mailgun** or **Postmark** (alternative)
- **MailKit** (receiving via IMAP)
  - **Rationale**: Reliable, scalable, affordable
  - **Confidence**: ⭐⭐⭐⭐⭐

### File Storage
- **Azure Blob Storage** or **AWS S3**
  - `Azure.Storage.Blobs`: ^12.22.0
  - **Rationale**:
    - Document attachments, email attachments
    - Scalable, cheap, CDN integration
  - **Alternative**: MinIO (self-hosted)
  - **Confidence**: ⭐⭐⭐⭐⭐

### Search (optional, for full-text)
- **Elasticsearch 8.x** or **Typesense**
  - **Rationale**: Advanced search (fuzzy, faceted, ranking)
  - **When**: >10k records, complex search requirements
  - **Alternative**: PostgreSQL full-text search (good enough for MVP)
  - **Confidence**: ⭐⭐⭐

---

## 6. Development Tools

### IDEs
- **Visual Studio 2025** (backend, mobile)
- **Visual Studio Code** + **Angular Language Service** (frontend)
  - **Rationale**: Best-in-class tooling for each platform
  - **Confidence**: ⭐⭐⭐⭐⭐

### API Testing
- **Postman** or **Insomnia** or **REST Client (VS Code)**
  - **Rationale**: Interactive API testing
  - **Confidence**: ⭐⭐⭐⭐⭐

### Database GUI
- **pgAdmin 4** or **DBeaver** or **DataGrip**
  - **Rationale**: Visual query builder, schema design
  - **Confidence**: ⭐⭐⭐⭐

### Code Quality
- **SonarQube** or **SonarCloud**
  - **Rationale**: Static analysis, code coverage, security scanning
  - **Confidence**: ⭐⭐⭐⭐

---

## 7. Architecture Patterns

### Backend Patterns
- **Clean Architecture** (recommended)
  - Layers: Domain → Application → Infrastructure → Presentation
  - **Rationale**: Testability, maintainability, low coupling
  - **Confidence**: ⭐⭐⭐⭐⭐

- **CQRS** (optional, for complex read/write patterns)
  - Use with **MediatR 12.x**
  - **When**: Complex queries, event sourcing
  - **Confidence**: ⭐⭐⭐

- **Repository Pattern** (with EF Core)
  - **Rationale**: Abstracts data access, easier testing
  - **Note**: Generic repositories are an anti-pattern with EF Core
  - **Confidence**: ⭐⭐⭐⭐

### Frontend Patterns
- **Feature Module Pattern** (Angular)
  - **Rationale**: Code organization, lazy loading
  - **Confidence**: ⭐⭐⭐⭐⭐

- **Presentational vs Container Components**
  - **Rationale**: Separation of concerns, reusability
  - **Confidence**: ⭐⭐⭐⭐⭐

### Multi-Tenancy Pattern
- **Schema-per-Tenant** (PostgreSQL schemas)
  - **Rationale**:
    - Data isolation, compliance (GDPR, HIPAA)
    - Per-tenant backups, easier migrations
  - **Alternative**: Row-level (TenantId column) - simpler but less isolated
  - **Confidence**: ⭐⭐⭐⭐⭐

---

## 8. What NOT to Use

### Avoid These Libraries/Patterns

1. **AutoMapper** → Use Mapster (faster, better DX)
2. **Moment.js** → Use date-fns (smaller, maintained)
3. **Angular Universal SSR** → Unless SEO is critical (adds complexity)
4. **Karma** → Use Jest (faster, modern)
5. **Protractor** → Use Playwright (actively maintained)
6. **IdentityServer4** → Use OpenIddict (free, certified)
7. **iTextSharp/iText 7** → Use QuestPDF (licensing issues)
8. **Generic Repositories with EF Core** → Use DbContext directly (less abstraction overhead)
9. **Angular ViewChild queries everywhere** → Use signals + model inputs
10. **RxJS for everything** → Use signals for state, RxJS for async events only
11. **Microservices on day 1** → Start monolith, extract services as needed
12. **GraphQL** → Unless client needs extreme flexibility (adds complexity)
13. **MongoDB** → PostgreSQL JSONB provides same benefits with ACID guarantees
14. **SignalR for all API calls** → Use HTTP for request/response, SignalR for push only

---

## 9. Deployment Architecture

### Recommended Hosting (MVP)

**Option A: Azure (Integrated Stack)**
- **Frontend**: Azure Static Web Apps or Azure App Service
- **Backend**: Azure App Service (Linux) with auto-scaling
- **Database**: Azure Database for PostgreSQL Flexible Server
- **Mobile**: App Store + Google Play
- **Cache**: Azure Cache for Redis
- **Storage**: Azure Blob Storage
- **Monitoring**: Application Insights

**Option B: AWS (Cost-optimized)**
- **Frontend**: AWS Amplify or S3 + CloudFront
- **Backend**: AWS ECS Fargate or App Runner
- **Database**: AWS RDS for PostgreSQL
- **Mobile**: App Store + Google Play
- **Cache**: Amazon ElastiCache (Redis)
- **Storage**: Amazon S3
- **Monitoring**: CloudWatch + X-Ray

**Option C: Hybrid (Best of both)**
- **Frontend**: Vercel (Angular)
- **Backend**: Fly.io or Railway (Docker)
- **Database**: Neon or Supabase (managed PostgreSQL)
- **Mobile**: App Store + Google Play
- **Cache**: Upstash (serverless Redis)
- **Storage**: Cloudflare R2 or Backblaze B2
- **Monitoring**: Sentry + Betterstack

**Confidence**: ⭐⭐⭐⭐ (all options proven for SaaS at this scale)

---

## 10. Migration Path & Versioning Strategy

### Version Compatibility
- **Backend & Frontend**: Semantic versioning (semver)
- **API**: Versioning via URL (`/api/v1/...`) or headers
- **Database**: EF Core migrations with rollback plans
- **Mobile**: Minimum supported version enforcement

### Breaking Change Strategy
- **API**: Deprecation period (3 months), sunset notifications
- **Database**: Backward-compatible migrations (add columns, don't drop)
- **Mobile**: Force update for critical security issues

---

## 11. Security Considerations

### OWASP Top 10 Mitigations
1. **Injection**: Parameterized queries (EF Core), input validation (FluentValidation)
2. **Broken Authentication**: OAuth2/OIDC, MFA support, secure token storage
3. **Sensitive Data Exposure**: HTTPS everywhere, encryption at rest (Azure/AWS), pgcrypto
4. **XML External Entities**: N/A (JSON APIs)
5. **Broken Access Control**: Policy-based auth, row-level security (PostgreSQL)
6. **Security Misconfiguration**: Least privilege, security headers (HSTS, CSP)
7. **XSS**: Angular sanitization (built-in), Content Security Policy
8. **Insecure Deserialization**: Use System.Text.Json, avoid BinaryFormatter
9. **Components with Known Vulnerabilities**: Dependabot, npm audit, dotnet list package --vulnerable
10. **Insufficient Logging**: Structured logging (Serilog), audit trail (EF interceptors)

### Additional Security
- **Rate Limiting**: ASP.NET Core middleware or YARP
- **CORS**: Configured per environment
- **CSRF**: Anti-forgery tokens for state-changing operations
- **SQL Injection**: EF Core parameterization, no raw SQL
- **Secrets Management**: Azure Key Vault, AWS Secrets Manager, or .NET User Secrets (dev)

---

## 12. Performance Targets

### Frontend
- **First Contentful Paint**: <1.5s
- **Time to Interactive**: <3.5s
- **Lighthouse Score**: >90

### Backend
- **API Response Time (p95)**: <200ms (CRUD), <1s (reports)
- **Throughput**: 1000 req/s per tenant
- **Database Queries**: <50ms (indexed), <500ms (complex aggregations)

### Mobile
- **App Launch**: <2s
- **Sync Time**: <5s for 1000 records

---

## 13. Cost Estimates (MVP, 50 tenants @ 20 users each)

### Monthly Infrastructure
- **Hosting**: $200-500 (App Service/ECS + Database + Redis)
- **Storage**: $20-50 (100GB files)
- **Email**: $50-100 (SendGrid, 100k emails/mo)
- **Monitoring**: $50-100 (Sentry, Application Insights)
- **CDN**: $20-50 (bandwidth)
- **Total**: ~$500-1000/month

### Scaling (500 tenants)
- **Total**: ~$2000-4000/month

---

## 14. Verification Checklist

- [ ] **.NET 10 Release Status**: Verify LTS release date and version (expected Nov 2025)
- [ ] **Angular 19 Stability**: Confirm LTS status (expected May 2025)
- [ ] **PostgreSQL 17**: Check latest stable version
- [ ] **Duende IdentityServer Licensing**: Confirm commercial license requirements
- [ ] **QuestPDF Licensing**: Verify MIT license for commercial use
- [ ] **OpenIddict Certification**: Confirm OAuth2/OIDC certification
- [ ] **All Package Versions**: Run `npm outdated` and `dotnet list package --outdated` before implementation

---

## 15. References & Further Reading

### Official Documentation
- [Angular Docs](https://angular.dev)
- [.NET Documentation](https://learn.microsoft.com/en-us/dotnet/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [.NET MAUI Documentation](https://learn.microsoft.com/en-us/dotnet/maui/)

### Stack Patterns
- [Clean Architecture (Jason Taylor)](https://github.com/jasontaylordev/CleanArchitecture)
- [Multi-tenancy in ASP.NET Core](https://www.finbuckle.com/multitenant)
- [PostgreSQL Multi-tenancy Patterns](https://www.postgresql.org/docs/current/ddl-schemas.html)

### Community
- [Angular Community](https://community.angular.dev)
- [.NET Reddit](https://reddit.com/r/dotnet)
- [PostgreSQL Mailing Lists](https://www.postgresql.org/list/)

---

## 16. Next Steps

1. **Verify Versions**: Check all package versions against official sources (priority)
2. **Prototype Auth Flow**: Implement OpenIddict + angular-oauth2-oidc (high-risk)
3. **Test Multi-tenancy**: Validate Finbuckle with PostgreSQL schemas (high-risk)
4. **SignalR POC**: Test real-time notifications across web + mobile (medium-risk)
5. **Email Integration POC**: MailKit OAuth2 flow for Gmail/Outlook (medium-risk)

---

**Document Status**: Draft for review
**Confidence Level**: ⭐⭐⭐⭐ (High, pending version verification)
**Last Updated**: 2026-02-16
**Reviewed By**: Pending

---

## Appendix: Confidence Level Key

- ⭐⭐⭐⭐⭐ **Production-proven**: Battle-tested, widely adopted, stable APIs
- ⭐⭐⭐⭐ **Recommended**: Solid choice, minor caveats or less mature
- ⭐⭐⭐ **Viable**: Works but has trade-offs or requires customization
- ⭐⭐ **Experimental**: Use with caution, may change significantly
- ⭐ **Avoid**: Not recommended for this use case
