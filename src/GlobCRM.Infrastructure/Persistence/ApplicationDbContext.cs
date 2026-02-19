using Finbuckle.MultiTenant.Abstractions;
using Finbuckle.MultiTenant.EntityFrameworkCore;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence.Configurations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TenantInfo = GlobCRM.Infrastructure.MultiTenancy.TenantInfo;

namespace GlobCRM.Infrastructure.Persistence;

/// <summary>
/// Tenant-scoped DbContext extending IdentityDbContext.
/// Implements Finbuckle IMultiTenantDbContext for automatic tenant filtering.
/// This is Layer 2 of the triple-layer tenant isolation defense:
///   Layer 1: Middleware (Finbuckle subdomain resolution)
///   Layer 2: EF Core global query filters (this context)
///   Layer 3: PostgreSQL Row-Level Security (scripts/rls-setup.sql)
/// </summary>
public class ApplicationDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>, IMultiTenantDbContext
{
    private readonly IMultiTenantContextAccessor<TenantInfo> _multiTenantContextAccessor;
    private readonly ITenantProvider? _tenantProvider;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        IMultiTenantContextAccessor<TenantInfo> multiTenantContextAccessor,
        ITenantProvider? tenantProvider = null)
        : base(options)
    {
        _multiTenantContextAccessor = multiTenantContextAccessor;
        _tenantProvider = tenantProvider;
    }

    public ITenantInfo? TenantInfo => _multiTenantContextAccessor.MultiTenantContext?.TenantInfo;

    /// <summary>
    /// Not using Finbuckle's built-in TenantMismatchMode for this implementation.
    /// We handle tenant filtering via global query filters directly.
    /// </summary>
    public TenantMismatchMode TenantMismatchMode => TenantMismatchMode.Throw;

    /// <summary>
    /// Not tracked entities should be treated as unresolved.
    /// </summary>
    public TenantNotSetMode TenantNotSetMode => TenantNotSetMode.Throw;

    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<CustomFieldDefinition> CustomFieldDefinitions => Set<CustomFieldDefinition>();
    public DbSet<CustomFieldSection> CustomFieldSections => Set<CustomFieldSection>();
    public DbSet<SavedView> SavedViews => Set<SavedView>();

    // RBAC DbSets
    // 'new' keyword: intentionally hides IdentityDbContext.Roles (DbSet<IdentityRole<Guid>>)
    // because our custom Role entity is a different type from IdentityRole.
    public new DbSet<Role> Roles => Set<Role>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<RoleFieldPermission> RoleFieldPermissions => Set<RoleFieldPermission>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<UserRoleAssignment> UserRoleAssignments => Set<UserRoleAssignment>();

    // CRM Entity DbSets
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<Product> Products => Set<Product>();

    // Deals & Pipelines DbSets
    public DbSet<Pipeline> Pipelines => Set<Pipeline>();
    public DbSet<PipelineStage> PipelineStages => Set<PipelineStage>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<DealContact> DealContacts => Set<DealContact>();
    public DbSet<DealProduct> DealProducts => Set<DealProduct>();
    public DbSet<DealStageHistory> DealStageHistories => Set<DealStageHistory>();

    // Activities DbSets
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<ActivityComment> ActivityComments => Set<ActivityComment>();
    public DbSet<ActivityAttachment> ActivityAttachments => Set<ActivityAttachment>();
    public DbSet<ActivityTimeEntry> ActivityTimeEntries => Set<ActivityTimeEntry>();
    public DbSet<ActivityFollower> ActivityFollowers => Set<ActivityFollower>();
    public DbSet<ActivityLink> ActivityLinks => Set<ActivityLink>();
    public DbSet<ActivityStatusHistory> ActivityStatusHistories => Set<ActivityStatusHistory>();

    // Quotes & Requests DbSets
    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<QuoteLineItem> QuoteLineItems => Set<QuoteLineItem>();
    public DbSet<QuoteStatusHistory> QuoteStatusHistories => Set<QuoteStatusHistory>();
    public DbSet<Request> Requests => Set<Request>();

    // Email Integration DbSets
    public DbSet<EmailAccount> EmailAccounts => Set<EmailAccount>();
    public DbSet<EmailMessage> EmailMessages => Set<EmailMessage>();
    public DbSet<EmailThread> EmailThreads => Set<EmailThread>();

    // Notifications & Feed DbSets
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<FeedItem> FeedItems => Set<FeedItem>();
    public DbSet<FeedComment> FeedComments => Set<FeedComment>();

    // Dashboards & Reporting DbSets
    public DbSet<Dashboard> Dashboards => Set<Dashboard>();
    public DbSet<DashboardWidget> DashboardWidgets => Set<DashboardWidget>();
    public DbSet<Target> Targets => Set<Target>();

    // Import DbSets
    public DbSet<ImportJob> ImportJobs => Set<ImportJob>();
    public DbSet<ImportJobError> ImportJobErrors => Set<ImportJobError>();

    // Leads DbSets
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadStage> LeadStages => Set<LeadStage>();
    public DbSet<LeadSource> LeadSources => Set<LeadSource>();
    public DbSet<LeadStageHistory> LeadStageHistories => Set<LeadStageHistory>();
    public DbSet<LeadConversion> LeadConversions => Set<LeadConversion>();

    // Notes & Attachments DbSets
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Attachment> Attachments => Set<Attachment>();

    // Email Templates DbSets
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<EmailTemplateCategory> EmailTemplateCategories => Set<EmailTemplateCategory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply entity type configurations
        // Organization table is owned by TenantDbContext - apply config for mapping but exclude from migrations
        modelBuilder.ApplyConfiguration(new OrganizationConfiguration());
        modelBuilder.Entity<Organization>().ToTable("organizations", t => t.ExcludeFromMigrations());

        modelBuilder.ApplyConfiguration(new ApplicationUserConfiguration());
        modelBuilder.ApplyConfiguration(new InvitationConfiguration());
        modelBuilder.ApplyConfiguration(new CustomFieldDefinitionConfiguration());
        modelBuilder.ApplyConfiguration(new CustomFieldSectionConfiguration());
        modelBuilder.ApplyConfiguration(new SavedViewConfiguration());

        // RBAC entity configurations
        modelBuilder.ApplyConfiguration(new RoleConfiguration());
        modelBuilder.ApplyConfiguration(new RolePermissionConfiguration());
        modelBuilder.ApplyConfiguration(new RoleFieldPermissionConfiguration());
        modelBuilder.ApplyConfiguration(new TeamConfiguration());
        modelBuilder.ApplyConfiguration(new TeamMemberConfiguration());
        modelBuilder.ApplyConfiguration(new UserRoleAssignmentConfiguration());

        // CRM entity configurations
        modelBuilder.ApplyConfiguration(new CompanyConfiguration());
        modelBuilder.ApplyConfiguration(new ContactConfiguration());
        modelBuilder.ApplyConfiguration(new ProductConfiguration());

        // Deals & Pipelines entity configurations
        modelBuilder.ApplyConfiguration(new PipelineConfiguration());
        modelBuilder.ApplyConfiguration(new PipelineStageConfiguration());
        modelBuilder.ApplyConfiguration(new DealConfiguration());
        modelBuilder.ApplyConfiguration(new DealContactConfiguration());
        modelBuilder.ApplyConfiguration(new DealProductConfiguration());
        modelBuilder.ApplyConfiguration(new DealStageHistoryConfiguration());

        // Activities entity configurations
        modelBuilder.ApplyConfiguration(new ActivityConfiguration());
        modelBuilder.ApplyConfiguration(new ActivityCommentConfiguration());
        modelBuilder.ApplyConfiguration(new ActivityAttachmentConfiguration());
        modelBuilder.ApplyConfiguration(new ActivityTimeEntryConfiguration());
        modelBuilder.ApplyConfiguration(new ActivityFollowerConfiguration());
        modelBuilder.ApplyConfiguration(new ActivityLinkConfiguration());
        modelBuilder.ApplyConfiguration(new ActivityStatusHistoryConfiguration());

        // Quotes & Requests entity configurations
        modelBuilder.ApplyConfiguration(new QuoteConfiguration());
        modelBuilder.ApplyConfiguration(new QuoteLineItemConfiguration());
        modelBuilder.ApplyConfiguration(new QuoteStatusHistoryConfiguration());
        modelBuilder.ApplyConfiguration(new RequestConfiguration());

        // Email Integration entity configurations
        modelBuilder.ApplyConfiguration(new EmailAccountConfiguration());
        modelBuilder.ApplyConfiguration(new EmailMessageConfiguration());
        modelBuilder.ApplyConfiguration(new EmailThreadConfiguration());

        // Notifications & Feed entity configurations
        modelBuilder.ApplyConfiguration(new NotificationConfiguration());
        modelBuilder.ApplyConfiguration(new NotificationPreferenceConfiguration());
        modelBuilder.ApplyConfiguration(new FeedItemConfiguration());
        modelBuilder.ApplyConfiguration(new FeedCommentConfiguration());

        // Dashboards & Reporting entity configurations
        modelBuilder.ApplyConfiguration(new DashboardConfiguration());
        modelBuilder.ApplyConfiguration(new DashboardWidgetConfiguration());
        modelBuilder.ApplyConfiguration(new TargetConfiguration());

        // Import entity configurations
        modelBuilder.ApplyConfiguration(new ImportJobConfiguration());
        modelBuilder.ApplyConfiguration(new ImportJobErrorConfiguration());

        // Leads entity configurations
        modelBuilder.ApplyConfiguration(new LeadConfiguration());
        modelBuilder.ApplyConfiguration(new LeadStageConfiguration());
        modelBuilder.ApplyConfiguration(new LeadSourceConfiguration());
        modelBuilder.ApplyConfiguration(new LeadStageHistoryConfiguration());
        modelBuilder.ApplyConfiguration(new LeadConversionConfiguration());

        // Notes & Attachments entity configurations
        modelBuilder.ApplyConfiguration(new NoteConfiguration());
        modelBuilder.ApplyConfiguration(new AttachmentConfiguration());

        // Email Templates entity configurations
        modelBuilder.ApplyConfiguration(new EmailTemplateCategoryConfiguration());
        modelBuilder.ApplyConfiguration(new EmailTemplateConfiguration());

        // Global query filter: filter Invitations by TenantId matching current tenant
        // When no tenant is resolved (e.g., login, org creation), filter is bypassed
        modelBuilder.Entity<Invitation>().HasQueryFilter(
            i => _tenantProvider == null || _tenantProvider.GetTenantId() == null || i.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter ApplicationUser by OrganizationId
        // When no tenant is resolved (e.g., login, org creation), filter is bypassed
        modelBuilder.Entity<ApplicationUser>().HasQueryFilter(
            u => _tenantProvider == null || _tenantProvider.GetTenantId() == null || u.OrganizationId == _tenantProvider.GetTenantId());

        // Global query filter: CustomFieldDefinition — tenant-scoped AND soft-delete filtered
        modelBuilder.Entity<CustomFieldDefinition>().HasQueryFilter(
            f => (_tenantProvider == null || _tenantProvider.GetTenantId() == null || f.TenantId == _tenantProvider.GetTenantId()) && !f.IsDeleted);

        // Global query filter: CustomFieldSection — tenant-scoped
        modelBuilder.Entity<CustomFieldSection>().HasQueryFilter(
            s => _tenantProvider == null || _tenantProvider.GetTenantId() == null || s.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: SavedView — tenant-scoped
        modelBuilder.Entity<SavedView>().HasQueryFilter(
            v => _tenantProvider == null || _tenantProvider.GetTenantId() == null || v.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Roles by TenantId (tenant-scoped)
        modelBuilder.Entity<Role>().HasQueryFilter(
            r => _tenantProvider == null || _tenantProvider.GetTenantId() == null || r.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Teams by TenantId (tenant-scoped)
        modelBuilder.Entity<Team>().HasQueryFilter(
            t => _tenantProvider == null || _tenantProvider.GetTenantId() == null || t.TenantId == _tenantProvider.GetTenantId());

        // Note: RolePermission, RoleFieldPermission, TeamMember, UserRoleAssignment
        // do NOT need their own query filters -- they are filtered through their
        // parent's FK relationship (Role or Team) which is already tenant-filtered.

        // Global query filter: filter Companies by TenantId (tenant-scoped)
        modelBuilder.Entity<Company>().HasQueryFilter(
            c => _tenantProvider == null || _tenantProvider.GetTenantId() == null || c.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Contacts by TenantId (tenant-scoped)
        modelBuilder.Entity<Contact>().HasQueryFilter(
            c => _tenantProvider == null || _tenantProvider.GetTenantId() == null || c.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Products by TenantId (tenant-scoped)
        modelBuilder.Entity<Product>().HasQueryFilter(
            p => _tenantProvider == null || _tenantProvider.GetTenantId() == null || p.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Pipelines by TenantId (tenant-scoped)
        modelBuilder.Entity<Pipeline>().HasQueryFilter(
            p => _tenantProvider == null || _tenantProvider.GetTenantId() == null || p.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Deals by TenantId (tenant-scoped)
        modelBuilder.Entity<Deal>().HasQueryFilter(
            d => _tenantProvider == null || _tenantProvider.GetTenantId() == null || d.TenantId == _tenantProvider.GetTenantId());

        // Note: PipelineStage, DealContact, DealProduct, DealStageHistory
        // do NOT need their own query filters -- they are filtered through their
        // parent's FK relationship (Pipeline or Deal) which is already tenant-filtered.

        // Global query filter: filter Activities by TenantId (tenant-scoped)
        modelBuilder.Entity<Activity>().HasQueryFilter(
            a => _tenantProvider == null || _tenantProvider.GetTenantId() == null || a.TenantId == _tenantProvider.GetTenantId());

        // Note: ActivityComment, ActivityAttachment, ActivityTimeEntry, ActivityFollower,
        // ActivityLink, ActivityStatusHistory do NOT need their own query filters --
        // they are filtered through their parent Activity FK which is already tenant-filtered.

        // Global query filter: filter Quotes by TenantId (tenant-scoped)
        modelBuilder.Entity<Quote>().HasQueryFilter(
            q => _tenantProvider == null || _tenantProvider.GetTenantId() == null || q.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Requests by TenantId (tenant-scoped)
        modelBuilder.Entity<Request>().HasQueryFilter(
            r => _tenantProvider == null || _tenantProvider.GetTenantId() == null || r.TenantId == _tenantProvider.GetTenantId());

        // Note: QuoteLineItem, QuoteStatusHistory do NOT need their own query filters --
        // they are filtered through their parent Quote FK which is already tenant-filtered.

        // Global query filter: filter EmailAccounts by TenantId (tenant-scoped)
        modelBuilder.Entity<EmailAccount>().HasQueryFilter(
            e => _tenantProvider == null || _tenantProvider.GetTenantId() == null || e.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter EmailMessages by TenantId (tenant-scoped)
        modelBuilder.Entity<EmailMessage>().HasQueryFilter(
            e => _tenantProvider == null || _tenantProvider.GetTenantId() == null || e.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter EmailThreads by TenantId (tenant-scoped)
        modelBuilder.Entity<EmailThread>().HasQueryFilter(
            e => _tenantProvider == null || _tenantProvider.GetTenantId() == null || e.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Notifications by TenantId (tenant-scoped)
        modelBuilder.Entity<Notification>().HasQueryFilter(
            n => _tenantProvider == null || _tenantProvider.GetTenantId() == null || n.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter NotificationPreferences by TenantId (tenant-scoped)
        modelBuilder.Entity<NotificationPreference>().HasQueryFilter(
            np => _tenantProvider == null || _tenantProvider.GetTenantId() == null || np.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter FeedItems by TenantId (tenant-scoped)
        modelBuilder.Entity<FeedItem>().HasQueryFilter(
            f => _tenantProvider == null || _tenantProvider.GetTenantId() == null || f.TenantId == _tenantProvider.GetTenantId());

        // Note: FeedComment does NOT need its own query filter --
        // it is filtered through its parent FeedItem FK which is already tenant-filtered.

        // Global query filter: filter Dashboards by TenantId (tenant-scoped)
        modelBuilder.Entity<Dashboard>().HasQueryFilter(
            d => _tenantProvider == null || _tenantProvider.GetTenantId() == null || d.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Targets by TenantId (tenant-scoped)
        modelBuilder.Entity<Target>().HasQueryFilter(
            t => _tenantProvider == null || _tenantProvider.GetTenantId() == null || t.TenantId == _tenantProvider.GetTenantId());

        // Note: DashboardWidget does NOT need its own query filter --
        // it is filtered through its parent Dashboard FK which is already tenant-filtered.

        // Global query filter: filter ImportJobs by TenantId (tenant-scoped)
        modelBuilder.Entity<ImportJob>().HasQueryFilter(
            j => _tenantProvider == null || _tenantProvider.GetTenantId() == null || j.TenantId == _tenantProvider.GetTenantId());

        // Note: ImportJobError does NOT need its own query filter --
        // it is filtered through its parent ImportJob FK which is already tenant-filtered.

        // Global query filter: filter Leads by TenantId (tenant-scoped)
        modelBuilder.Entity<Lead>().HasQueryFilter(
            l => _tenantProvider == null || _tenantProvider.GetTenantId() == null || l.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter LeadStages by TenantId (tenant-scoped)
        modelBuilder.Entity<LeadStage>().HasQueryFilter(
            s => _tenantProvider == null || _tenantProvider.GetTenantId() == null || s.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter LeadSources by TenantId (tenant-scoped)
        modelBuilder.Entity<LeadSource>().HasQueryFilter(
            s => _tenantProvider == null || _tenantProvider.GetTenantId() == null || s.TenantId == _tenantProvider.GetTenantId());

        // Note: LeadStageHistory and LeadConversion do NOT need their own query filters --
        // they are filtered through their parent Lead FK which is already tenant-filtered.

        // Global query filter: filter Notes by TenantId (tenant-scoped)
        modelBuilder.Entity<Note>().HasQueryFilter(
            n => _tenantProvider == null || _tenantProvider.GetTenantId() == null || n.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter Attachments by TenantId (tenant-scoped)
        modelBuilder.Entity<Attachment>().HasQueryFilter(
            a => _tenantProvider == null || _tenantProvider.GetTenantId() == null || a.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter EmailTemplates by TenantId (tenant-scoped)
        modelBuilder.Entity<EmailTemplate>().HasQueryFilter(
            et => _tenantProvider == null || _tenantProvider.GetTenantId() == null || et.TenantId == _tenantProvider.GetTenantId());

        // Global query filter: filter EmailTemplateCategories by TenantId (tenant-scoped)
        modelBuilder.Entity<EmailTemplateCategory>().HasQueryFilter(
            etc => _tenantProvider == null || _tenantProvider.GetTenantId() == null || etc.TenantId == _tenantProvider.GetTenantId());
    }
}
