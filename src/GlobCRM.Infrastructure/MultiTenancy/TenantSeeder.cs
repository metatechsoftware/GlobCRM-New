using System.Text.Json;
using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Authorization;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.MultiTenancy;

/// <summary>
/// Seeds initial data for newly created organizations.
/// Creates team members, companies, contacts, products, pipelines, deals, activities, quotes,
/// requests, notes, deal links, stage history, feed items, and targets from a seed manifest.
/// </summary>
public class TenantSeeder : ITenantSeeder
{
    private readonly IOrganizationRepository _organizationRepository;
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<TenantSeeder> _logger;

    public TenantSeeder(
        IOrganizationRepository organizationRepository,
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        ILogger<TenantSeeder> logger)
    {
        _organizationRepository = organizationRepository;
        _db = db;
        _userManager = userManager;
        _logger = logger;
    }

    /// <summary>
    /// Creates a user if one doesn't already exist with that email. Idempotent.
    /// Returns the existing or newly created user.
    /// </summary>
    private async Task<ApplicationUser> EnsureUserExistsAsync(ApplicationUser user, string password)
    {
        var existing = await _userManager.FindByEmailAsync(user.Email!);
        if (existing != null)
            return existing;

        var result = await _userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            _logger.LogWarning("Failed to create seed user {Email}: {Errors}", user.Email, errors);
        }

        return user;
    }

    /// <inheritdoc />
    public async Task ReseedOrganizationDataAsync(Guid organizationId)
    {
        _logger.LogInformation("Clearing seed data for organization {OrgId}", organizationId);

        // ── Resolve seed user IDs by email pattern ────────────────
        var organization = await _organizationRepository.GetByIdAsync(organizationId);
        if (organization == null) return;

        var subdomain = organization.Subdomain;
        var seedEmails = new[]
        {
            $"emily.carter@{subdomain}.example.com",
            $"jake.martinez@{subdomain}.example.com",
            $"priya.nair@{subdomain}.example.com",
            $"olivia.brooks@{subdomain}.example.com",
            $"daniel.lee@{subdomain}.example.com"
        };

        var seedUserIds = await _db.Users
            .IgnoreQueryFilters()
            .Where(u => seedEmails.Contains(u.Email))
            .Select(u => u.Id)
            .ToListAsync();

        // ── Clean up seed-user-related data ───────────────────────
        if (seedUserIds.Count > 0)
        {
            // FeedComments on feed items authored by seed users
            var seedFeedItemIds = await _db.FeedItems
                .IgnoreQueryFilters()
                .Where(f => f.TenantId == organizationId && f.AuthorId != null && seedUserIds.Contains(f.AuthorId.Value))
                .Select(f => f.Id)
                .ToListAsync();

            if (seedFeedItemIds.Count > 0)
            {
                await _db.FeedComments
                    .Where(fc => seedFeedItemIds.Contains(fc.FeedItemId))
                    .ExecuteDeleteAsync();
                await _db.FeedItems
                    .IgnoreQueryFilters()
                    .Where(f => seedFeedItemIds.Contains(f.Id))
                    .ExecuteDeleteAsync();
            }

            // Also delete system-event feed items with null author in this tenant
            var systemFeedIds = await _db.FeedItems
                .IgnoreQueryFilters()
                .Where(f => f.TenantId == organizationId && f.AuthorId == null)
                .Select(f => f.Id)
                .ToListAsync();

            if (systemFeedIds.Count > 0)
            {
                await _db.FeedComments
                    .Where(fc => systemFeedIds.Contains(fc.FeedItemId))
                    .ExecuteDeleteAsync();
                await _db.FeedItems
                    .IgnoreQueryFilters()
                    .Where(f => systemFeedIds.Contains(f.Id))
                    .ExecuteDeleteAsync();
            }

            // Targets owned by seed users or team-wide (null owner)
            await _db.Targets
                .IgnoreQueryFilters()
                .Where(t => t.TenantId == organizationId &&
                    (t.OwnerId == null || seedUserIds.Contains(t.OwnerId.Value)))
                .ExecuteDeleteAsync();

            // TeamMembers → Teams
            var seedTeamNames = new[] { "Sales Team", "Customer Success Team" };
            var seedTeamIds = await _db.Teams
                .IgnoreQueryFilters()
                .Where(t => t.TenantId == organizationId && seedTeamNames.Contains(t.Name))
                .Select(t => t.Id)
                .ToListAsync();

            if (seedTeamIds.Count > 0)
            {
                await _db.TeamMembers
                    .Where(tm => seedTeamIds.Contains(tm.TeamId))
                    .ExecuteDeleteAsync();
                await _db.Teams
                    .IgnoreQueryFilters()
                    .Where(t => seedTeamIds.Contains(t.Id))
                    .ExecuteDeleteAsync();
            }

            // UserRoleAssignments for seed users
            await _db.UserRoleAssignments
                .IgnoreQueryFilters()
                .Where(ura => seedUserIds.Contains(ura.UserId))
                .ExecuteDeleteAsync();
        }

        // ── Delete existing Report seed data ──────────────────────
        // Reports before categories (FK constraint)
        await _db.Reports.Where(r => r.TenantId == organizationId && r.IsSeedData).ExecuteDeleteAsync();
        await _db.ReportCategories.Where(c => c.TenantId == organizationId && c.IsSeedData).ExecuteDeleteAsync();

        // ── Delete existing Workflow seed data ────────────────────
        // Execution logs and action logs cascade-delete with workflow, but templates are separate
        await _db.WorkflowTemplates.Where(t => t.TenantId == organizationId && t.IsSeedData).ExecuteDeleteAsync();

        var seedWorkflowIds = await _db.Workflows
            .Where(w => w.TenantId == organizationId && w.IsSeedData)
            .Select(w => w.Id)
            .ToListAsync();

        if (seedWorkflowIds.Count > 0)
        {
            // Action logs cascade from execution logs, execution logs cascade from workflows
            // but ExecuteDeleteAsync doesn't cascade, so delete explicitly
            var seedExecLogIds = await _db.WorkflowExecutionLogs
                .Where(l => seedWorkflowIds.Contains(l.WorkflowId))
                .Select(l => l.Id)
                .ToListAsync();

            if (seedExecLogIds.Count > 0)
            {
                await _db.WorkflowActionLogs
                    .Where(a => seedExecLogIds.Contains(a.ExecutionLogId))
                    .ExecuteDeleteAsync();
            }

            await _db.WorkflowExecutionLogs
                .Where(l => seedWorkflowIds.Contains(l.WorkflowId))
                .ExecuteDeleteAsync();
        }

        await _db.Workflows.Where(w => w.TenantId == organizationId && w.IsSeedData).ExecuteDeleteAsync();

        // ── Delete existing Email Sequence seed data ────────────────
        // Tracking events and enrollments first (children), then steps (cascade), then sequences
        var seedSequenceIds = await _db.EmailSequences
            .Where(s => s.TenantId == organizationId && s.IsSeedData)
            .Select(s => s.Id)
            .ToListAsync();

        if (seedSequenceIds.Count > 0)
        {
            var seedEnrollmentIds = await _db.SequenceEnrollments
                .Where(e => seedSequenceIds.Contains(e.SequenceId))
                .Select(e => e.Id)
                .ToListAsync();

            if (seedEnrollmentIds.Count > 0)
            {
                await _db.SequenceTrackingEvents
                    .Where(t => seedEnrollmentIds.Contains(t.EnrollmentId))
                    .ExecuteDeleteAsync();
            }

            await _db.SequenceEnrollments
                .Where(e => seedSequenceIds.Contains(e.SequenceId))
                .ExecuteDeleteAsync();
        }

        await _db.EmailSequences.Where(s => s.TenantId == organizationId && s.IsSeedData).ExecuteDeleteAsync();

        // ── Delete existing Email Template seed data ────────────────
        await _db.EmailTemplates.Where(t => t.TenantId == organizationId && t.IsSeedData).ExecuteDeleteAsync();
        await _db.EmailTemplateCategories.Where(c => c.TenantId == organizationId && c.IsSeedData).ExecuteDeleteAsync();

        // ── Delete existing Lead seed data ──────────────────────────
        // Lead children first
        var seedLeadIds = await _db.Leads
            .Where(l => l.TenantId == organizationId && l.IsSeedData)
            .Select(l => l.Id)
            .ToListAsync();

        if (seedLeadIds.Count > 0)
        {
            await _db.LeadConversions
                .Where(lc => seedLeadIds.Contains(lc.LeadId))
                .ExecuteDeleteAsync();
            await _db.LeadStageHistories
                .Where(lsh => seedLeadIds.Contains(lsh.LeadId))
                .ExecuteDeleteAsync();
        }

        await _db.Leads.Where(l => l.TenantId == organizationId && l.IsSeedData).ExecuteDeleteAsync();
        await _db.LeadSources.Where(s => s.TenantId == organizationId && s.IsSeedData).ExecuteDeleteAsync();
        await _db.LeadStages.Where(s => s.TenantId == organizationId && s.IsSeedData).ExecuteDeleteAsync();

        // ── Delete existing CRM seed data (original cleanup) ──────
        // Delete in reverse dependency order to avoid FK violations

        // Quote children
        var seedQuoteIds = await _db.Quotes
            .Where(q => q.TenantId == organizationId && q.IsSeedData)
            .Select(q => q.Id)
            .ToListAsync();

        if (seedQuoteIds.Count > 0)
        {
            await _db.QuoteStatusHistories
                .Where(h => seedQuoteIds.Contains(h.QuoteId))
                .ExecuteDeleteAsync();
            await _db.QuoteLineItems
                .Where(li => seedQuoteIds.Contains(li.QuoteId))
                .ExecuteDeleteAsync();
        }

        // Activity children
        var seedActivityIds = await _db.Activities
            .Where(a => a.TenantId == organizationId && a.IsSeedData)
            .Select(a => a.Id)
            .ToListAsync();

        if (seedActivityIds.Count > 0)
        {
            await _db.ActivityLinks
                .Where(l => seedActivityIds.Contains(l.ActivityId))
                .ExecuteDeleteAsync();
            await _db.ActivityComments
                .Where(c => seedActivityIds.Contains(c.ActivityId))
                .ExecuteDeleteAsync();
            await _db.ActivityTimeEntries
                .Where(t => seedActivityIds.Contains(t.ActivityId))
                .ExecuteDeleteAsync();
        }

        // Deal children
        var seedDealIds = await _db.Deals
            .Where(d => d.TenantId == organizationId && d.IsSeedData)
            .Select(d => d.Id)
            .ToListAsync();

        if (seedDealIds.Count > 0)
        {
            await _db.DealContacts
                .Where(dc => seedDealIds.Contains(dc.DealId))
                .ExecuteDeleteAsync();
            await _db.DealProducts
                .Where(dp => seedDealIds.Contains(dp.DealId))
                .ExecuteDeleteAsync();
            await _db.DealStageHistories
                .Where(dsh => seedDealIds.Contains(dsh.DealId))
                .ExecuteDeleteAsync();
        }

        // Main entities (order matters for FK constraints)
        await _db.Notes.Where(n => n.TenantId == organizationId && n.IsSeedData).ExecuteDeleteAsync();
        await _db.Quotes.Where(q => q.TenantId == organizationId && q.IsSeedData).ExecuteDeleteAsync();
        await _db.Requests.Where(r => r.TenantId == organizationId && r.IsSeedData).ExecuteDeleteAsync();
        await _db.Activities.Where(a => a.TenantId == organizationId && a.IsSeedData).ExecuteDeleteAsync();
        await _db.Deals.Where(d => d.TenantId == organizationId && d.IsSeedData).ExecuteDeleteAsync();
        await _db.Contacts.Where(c => c.TenantId == organizationId && c.IsSeedData).ExecuteDeleteAsync();
        await _db.Products.Where(p => p.TenantId == organizationId && p.IsSeedData).ExecuteDeleteAsync();
        await _db.Companies.Where(c => c.TenantId == organizationId && c.IsSeedData).ExecuteDeleteAsync();

        // Pipeline + stages (created by seeder, no IsSeedData flag -- delete if default)
        var defaultPipeline = await _db.Pipelines
            .Include(p => p.Stages)
            .FirstOrDefaultAsync(p => p.TenantId == organizationId && p.IsDefault);

        if (defaultPipeline != null)
        {
            var hasNonSeedDeals = await _db.Deals
                .AnyAsync(d => d.TenantId == organizationId && d.PipelineId == defaultPipeline.Id && !d.IsSeedData);

            if (!hasNonSeedDeals)
            {
                _db.PipelineStages.RemoveRange(defaultPipeline.Stages);
                _db.Pipelines.Remove(defaultPipeline);
                await _db.SaveChangesAsync();
            }
        }

        _logger.LogInformation("Seed data cleared for organization {OrgId}, re-seeding...", organizationId);

        await SeedOrganizationDataAsync(organizationId);
    }

    /// <inheritdoc />
    public async Task SeedOrganizationDataAsync(Guid organizationId)
    {
        _logger.LogInformation(
            "Starting seed data provisioning for organization {OrgId}", organizationId);

        var organization = await _organizationRepository.GetByIdAsync(organizationId);
        if (organization == null)
        {
            _logger.LogWarning(
                "Cannot seed data: organization {OrgId} not found", organizationId);
            return;
        }

        // Idempotency guard: skip if seed data already exists
        var alreadySeeded = await _db.Companies
            .AnyAsync(c => c.TenantId == organizationId && c.IsSeedData);
        if (alreadySeeded)
        {
            _logger.LogInformation(
                "Seed data already exists for organization {OrgId}, skipping", organizationId);
            return;
        }

        var subdomain = organization.Subdomain;
        var seedManifest = CreateSeedManifest();

        _logger.LogInformation(
            "Seed manifest created for organization {OrgId}: {CompanyCount} companies, {ContactCount} contacts, {ProductCount} products, {DealCount} deals, {ActivityCount} activities",
            organizationId,
            seedManifest.Companies.Count,
            seedManifest.Contacts.Count,
            seedManifest.Products.Count,
            seedManifest.Deals.Count,
            seedManifest.Activities.Count);

        // ══════════════════════════════════════════════════════════
        // STEP 1: Create 5 seed team members
        // ══════════════════════════════════════════════════════════
        const string seedPassword = "Test1234!";

        var emily = await EnsureUserExistsAsync(new ApplicationUser
        {
            UserName = $"emily.carter@{subdomain}.example.com",
            Email = $"emily.carter@{subdomain}.example.com",
            EmailConfirmed = true,
            OrganizationId = organizationId,
            FirstName = "Emily",
            LastName = "Carter",
            IsActive = true,
            Phone = "+1-555-2001",
            JobTitle = "Sales Manager",
            Department = "Sales",
            AvatarColor = "#1976d2",
            Bio = "Experienced sales leader driving revenue growth through strategic partnerships and team development.",
            Skills = new List<string> { "Sales Strategy", "Team Leadership", "Pipeline Management", "Negotiation", "CRM" },
            Timezone = "America/New_York",
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-60)
        }, seedPassword);

        var jake = await EnsureUserExistsAsync(new ApplicationUser
        {
            UserName = $"jake.martinez@{subdomain}.example.com",
            Email = $"jake.martinez@{subdomain}.example.com",
            EmailConfirmed = true,
            OrganizationId = organizationId,
            FirstName = "Jake",
            LastName = "Martinez",
            IsActive = true,
            Phone = "+1-555-2002",
            JobTitle = "Account Executive",
            Department = "Sales",
            AvatarColor = "#388e3c",
            Bio = "Top-performing account executive specializing in enterprise software deals.",
            Skills = new List<string> { "Enterprise Sales", "Cold Outreach", "Demo Presentations", "Salesforce" },
            Timezone = "America/Chicago",
            ReportingManagerId = emily.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-55)
        }, seedPassword);

        var priya = await EnsureUserExistsAsync(new ApplicationUser
        {
            UserName = $"priya.nair@{subdomain}.example.com",
            Email = $"priya.nair@{subdomain}.example.com",
            EmailConfirmed = true,
            OrganizationId = organizationId,
            FirstName = "Priya",
            LastName = "Nair",
            IsActive = true,
            Phone = "+1-555-2003",
            JobTitle = "Sales Development Rep",
            Department = "Sales",
            AvatarColor = "#f57c00",
            Bio = "Energetic SDR building pipeline through creative prospecting and social selling.",
            Skills = new List<string> { "Lead Generation", "Social Selling", "Email Campaigns", "Qualification" },
            Timezone = "America/Los_Angeles",
            ReportingManagerId = emily.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-50)
        }, seedPassword);

        var olivia = await EnsureUserExistsAsync(new ApplicationUser
        {
            UserName = $"olivia.brooks@{subdomain}.example.com",
            Email = $"olivia.brooks@{subdomain}.example.com",
            EmailConfirmed = true,
            OrganizationId = organizationId,
            FirstName = "Olivia",
            LastName = "Brooks",
            IsActive = true,
            Phone = "+1-555-2004",
            JobTitle = "Customer Success Manager",
            Department = "Customer Success",
            AvatarColor = "#7b1fa2",
            Bio = "Dedicated CSM ensuring customer satisfaction and driving product adoption.",
            Skills = new List<string> { "Customer Success", "Onboarding", "Retention", "Product Training", "Upselling" },
            Timezone = "America/New_York",
            ReportingManagerId = emily.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-45)
        }, seedPassword);

        var daniel = await EnsureUserExistsAsync(new ApplicationUser
        {
            UserName = $"daniel.lee@{subdomain}.example.com",
            Email = $"daniel.lee@{subdomain}.example.com",
            EmailConfirmed = true,
            OrganizationId = organizationId,
            FirstName = "Daniel",
            LastName = "Lee",
            IsActive = true,
            Phone = "+1-555-2005",
            JobTitle = "Sales Analyst",
            Department = "Operations",
            AvatarColor = "#0097a7",
            Bio = "Data-driven analyst providing insights to optimize sales performance and forecasting.",
            Skills = new List<string> { "Data Analysis", "Forecasting", "Excel", "SQL", "Reporting" },
            Timezone = "America/New_York",
            ReportingManagerId = emily.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-40)
        }, seedPassword);

        var seedUsers = new[] { emily, jake, priya, olivia, daniel };

        // ══════════════════════════════════════════════════════════
        // STEP 2: Assign Identity roles (Member) to all seed users
        // ══════════════════════════════════════════════════════════
        foreach (var user in seedUsers)
        {
            if (!await _userManager.IsInRoleAsync(user, Roles.Member))
                await _userManager.AddToRoleAsync(user, Roles.Member);
        }

        // ══════════════════════════════════════════════════════════
        // STEP 3: Assign RBAC template roles
        // ══════════════════════════════════════════════════════════
        await RoleTemplateSeeder.SeedTemplateRolesAsync(_db, organizationId);
        await RoleTemplateSeeder.EnsurePermissionsForAllEntityTypesAsync(_db, organizationId);

        var rbacRoles = await _db.Roles
            .IgnoreQueryFilters()
            .Where(r => r.TenantId == organizationId && r.IsTemplate)
            .ToListAsync();

        var rbacRoleMap = rbacRoles.ToDictionary(r => r.Name);

        var userRolePairs = new (ApplicationUser User, string RoleName)[]
        {
            (emily, "Manager"),
            (jake, "Sales Rep"),
            (priya, "Sales Rep"),
            (olivia, "Sales Rep"),
            (daniel, "Viewer")
        };

        foreach (var (user, roleName) in userRolePairs)
        {
            if (rbacRoleMap.TryGetValue(roleName, out var rbacRole))
            {
                var alreadyAssigned = await _db.UserRoleAssignments
                    .IgnoreQueryFilters()
                    .AnyAsync(ura => ura.UserId == user.Id && ura.RoleId == rbacRole.Id);

                if (!alreadyAssigned)
                {
                    _db.UserRoleAssignments.Add(new UserRoleAssignment
                    {
                        Id = Guid.NewGuid(),
                        UserId = user.Id,
                        RoleId = rbacRole.Id
                    });
                }
            }
        }

        await _db.SaveChangesAsync();

        // ══════════════════════════════════════════════════════════
        // STEP 4: Create 2 Teams + TeamMembers
        // ══════════════════════════════════════════════════════════
        var salesTeam = new Team
        {
            TenantId = organizationId,
            Name = "Sales Team",
            Description = "Core sales team responsible for pipeline generation and deal closure.",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _db.Teams.Add(salesTeam);

        var csTeam = new Team
        {
            TenantId = organizationId,
            Name = "Customer Success Team",
            Description = "Customer success and retention team ensuring client satisfaction.",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _db.Teams.Add(csTeam);

        // Sales Team: Emily, Jake, Priya, Daniel
        foreach (var user in new[] { emily, jake, priya, daniel })
        {
            _db.TeamMembers.Add(new TeamMember
            {
                TeamId = salesTeam.Id,
                UserId = user.Id
            });
        }

        // Customer Success Team: Olivia, Emily (cross-team)
        foreach (var user in new[] { olivia, emily })
        {
            _db.TeamMembers.Add(new TeamMember
            {
                TeamId = csTeam.Id,
                UserId = user.Id
            });
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Seed users and teams created for organization {OrgId}: 5 users, 2 teams", organizationId);

        // ══════════════════════════════════════════════════════════
        // STEP 5: Seed CRM data WITH ownership
        // ══════════════════════════════════════════════════════════

        // -- Company-to-owner mapping --
        var companyOwnerMap = new Dictionary<string, Guid>
        {
            ["TechVision Inc."] = jake.Id,
            ["CloudScale Solutions"] = jake.Id,
            ["Global Logistics Corp"] = priya.Id,
            ["Meridian Healthcare"] = priya.Id,
            ["Alpine Digital Agency"] = olivia.Id,
            ["Nova Robotics Ltd"] = olivia.Id,
            ["Quantum Financial Services"] = emily.Id,
            ["GreenLeaf Organics"] = emily.Id,
        };

        // ── Companies ────────────────────────────────────────────
        var companyMap = new Dictionary<string, Company>();
        foreach (var companySeed in seedManifest.Companies)
        {
            var company = new Company
            {
                TenantId = organizationId,
                Name = companySeed.Name,
                Industry = companySeed.Industry,
                Website = companySeed.Website,
                Phone = companySeed.Phone,
                Email = companySeed.Email,
                City = companySeed.City,
                Country = companySeed.Country,
                Size = companySeed.Size,
                Description = companySeed.Description,
                OwnerId = companyOwnerMap.GetValueOrDefault(companySeed.Name),
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(companySeed.CreatedDaysAgo),
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Companies.Add(company);
            companyMap[companySeed.Name] = company;
        }

        // ── Contacts ─────────────────────────────────────────────
        var contactMap = new Dictionary<string, Contact>();
        foreach (var contactSeed in seedManifest.Contacts)
        {
            // Contact owner = parent company's owner (or round-robin for unaffiliated)
            Guid? contactOwner = null;
            if (!string.IsNullOrEmpty(contactSeed.CompanyRef) &&
                companyOwnerMap.TryGetValue(contactSeed.CompanyRef, out var cOwner))
            {
                contactOwner = cOwner;
            }
            else if (string.IsNullOrEmpty(contactSeed.CompanyRef))
            {
                contactOwner = priya.Id; // unaffiliated -> Priya (SDR)
            }

            var contact = new Contact
            {
                TenantId = organizationId,
                FirstName = contactSeed.FirstName,
                LastName = contactSeed.LastName,
                Email = contactSeed.Email,
                Phone = contactSeed.Phone,
                JobTitle = contactSeed.Title,
                Department = contactSeed.Department,
                CompanyId = companyMap.TryGetValue(contactSeed.CompanyRef, out var company)
                    ? company.Id
                    : null,
                OwnerId = contactOwner,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(contactSeed.CreatedDaysAgo),
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Contacts.Add(contact);
            contactMap[contactSeed.Email] = contact;
        }

        // ── Products ─────────────────────────────────────────────
        var productMap = new Dictionary<string, Product>();
        foreach (var productSeed in seedManifest.Products)
        {
            var product = new Product
            {
                TenantId = organizationId,
                Name = productSeed.Name,
                Description = productSeed.Description,
                UnitPrice = productSeed.UnitPrice,
                SKU = productSeed.SKU,
                Category = productSeed.Category,
                IsActive = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Products.Add(product);
            productMap[productSeed.Name] = product;
        }

        // ── Pipeline + Stages ────────────────────────────────────
        var pipeline = new Pipeline
        {
            TenantId = organizationId,
            Name = seedManifest.Pipeline.Name,
            IsDefault = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _db.Pipelines.Add(pipeline);

        var stageMap = new Dictionary<string, PipelineStage>();
        foreach (var stageSeed in seedManifest.Pipeline.Stages)
        {
            var stage = new PipelineStage
            {
                PipelineId = pipeline.Id,
                Name = stageSeed.Name,
                SortOrder = stageSeed.Order,
                Color = stageSeed.Color,
                DefaultProbability = stageSeed.DefaultProbability,
                IsWon = stageSeed.IsWon,
                IsLost = stageSeed.IsLost,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.PipelineStages.Add(stage);
            stageMap[stageSeed.Name] = stage;
        }

        // -- Deal-to-owner mapping (follows company owner) --
        var dealOwnerMap = new Dictionary<string, Guid>
        {
            ["Enterprise CRM License"] = jake.Id,
            ["Cloud Migration Project"] = jake.Id,
            ["Logistics Platform Integration"] = priya.Id,
            ["Healthcare Data Analytics"] = priya.Id,
            ["Digital Marketing Suite"] = olivia.Id,
            ["Financial Analytics Platform"] = emily.Id,
            ["Farm-to-Table Tracking"] = emily.Id,
            ["Robotics Fleet Management"] = olivia.Id,
        };

        // ── Deals ────────────────────────────────────────────────
        var dealMap = new Dictionary<string, Deal>();
        foreach (var dealSeed in seedManifest.Deals)
        {
            var dealStage = stageMap.GetValueOrDefault(dealSeed.Stage);
            var dealCompany = companyMap.GetValueOrDefault(dealSeed.CompanyRef);

            var deal = new Deal
            {
                TenantId = organizationId,
                Title = dealSeed.Title,
                Value = dealSeed.Value,
                PipelineId = pipeline.Id,
                PipelineStageId = dealStage?.Id ?? stageMap.Values.First().Id,
                Probability = dealStage?.DefaultProbability ?? 0.10m,
                CompanyId = dealCompany?.Id,
                ExpectedCloseDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(dealSeed.ExpectedCloseDaysFromNow)),
                Description = dealSeed.Description,
                OwnerId = dealOwnerMap.GetValueOrDefault(dealSeed.Title),
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(dealSeed.CreatedDaysAgo),
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Deals.Add(deal);
            dealMap[dealSeed.Title] = deal;
        }

        // ── Activities ───────────────────────────────────────────
        var assignees = new[] { jake, priya, olivia, jake, priya, olivia, jake, priya, olivia, jake, priya, olivia, jake, priya, olivia };
        var activityList = new List<Activity>();
        var activityIdx = 0;
        foreach (var activitySeed in seedManifest.Activities)
        {
            var activity = new Activity
            {
                TenantId = organizationId,
                Subject = activitySeed.Subject,
                Description = activitySeed.Description,
                Type = Enum.Parse<ActivityType>(activitySeed.Type),
                Status = Enum.Parse<ActivityStatus>(activitySeed.Status),
                Priority = Enum.Parse<ActivityPriority>(activitySeed.Priority),
                DueDate = DateTimeOffset.UtcNow.AddDays(activitySeed.DueDateOffset),
                CompletedAt = activitySeed.Status == "Done"
                    ? DateTimeOffset.UtcNow.AddDays(activitySeed.DueDateOffset)
                    : null,
                OwnerId = emily.Id,
                AssignedToId = assignees[activityIdx % assignees.Length].Id,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(activitySeed.CreatedDaysAgo),
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Activities.Add(activity);
            activityList.Add(activity);
            activityIdx++;
        }

        // ── Activity Links ───────────────────────────────────────
        void LinkActivity(int index, string entityType, string entityName, Guid entityId)
        {
            if (index < activityList.Count)
            {
                _db.ActivityLinks.Add(new ActivityLink
                {
                    ActivityId = activityList[index].Id,
                    EntityType = entityType,
                    EntityId = entityId,
                    EntityName = entityName,
                    LinkedAt = DateTimeOffset.UtcNow
                });
            }
        }

        if (companyMap.TryGetValue("TechVision Inc.", out var techVision))
            LinkActivity(0, "Company", techVision.Name, techVision.Id);
        if (contactMap.TryGetValue("sarah.chen@example.com", out var sarahChen))
            LinkActivity(1, "Contact", $"{sarahChen.FirstName} {sarahChen.LastName}", sarahChen.Id);
        if (dealMap.TryGetValue("Enterprise CRM License", out var crmDeal))
            LinkActivity(2, "Deal", crmDeal.Title, crmDeal.Id);
        if (companyMap.TryGetValue("Meridian Healthcare", out var meridian))
            LinkActivity(4, "Company", meridian.Name, meridian.Id);
        if (contactMap.TryGetValue("david.kim@example.com", out var davidKim))
            LinkActivity(5, "Contact", $"{davidKim.FirstName} {davidKim.LastName}", davidKim.Id);
        if (dealMap.TryGetValue("Cloud Migration Project", out var cloudDeal))
            LinkActivity(7, "Deal", cloudDeal.Title, cloudDeal.Id);
        if (companyMap.TryGetValue("Alpine Digital Agency", out var alpine))
            LinkActivity(9, "Company", alpine.Name, alpine.Id);
        if (companyMap.TryGetValue("Nova Robotics Ltd", out var nova))
            LinkActivity(11, "Company", nova.Name, nova.Id);

        // ── Activity Comments (with AuthorId) ─────────────────────
        if (activityList.Count >= 2)
        {
            _db.ActivityComments.Add(new ActivityComment
            {
                ActivityId = activityList[0].Id,
                Content = "Initial contact made, they seem interested in the enterprise plan",
                AuthorId = jake.Id,
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-48),
                UpdatedAt = DateTimeOffset.UtcNow.AddHours(-48)
            });
            _db.ActivityComments.Add(new ActivityComment
            {
                ActivityId = activityList[0].Id,
                Content = "Sent follow-up email with pricing details and case studies",
                AuthorId = emily.Id,
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-24),
                UpdatedAt = DateTimeOffset.UtcNow.AddHours(-24)
            });
            _db.ActivityComments.Add(new ActivityComment
            {
                ActivityId = activityList[1].Id,
                Content = "Discussed Q3 metrics, customer is satisfied with growth trends",
                AuthorId = priya.Id,
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-12),
                UpdatedAt = DateTimeOffset.UtcNow.AddHours(-12)
            });
        }

        // ── Activity Time Entries ────────────────────────────────
        if (activityList.Count >= 3)
        {
            _db.ActivityTimeEntries.Add(new ActivityTimeEntry
            {
                ActivityId = activityList[1].Id,
                DurationMinutes = 45,
                Description = "Reviewed quarterly metrics and prepared talking points",
                EntryDate = DateOnly.FromDateTime(DateTime.UtcNow),
                CreatedAt = DateTimeOffset.UtcNow
            });
            _db.ActivityTimeEntries.Add(new ActivityTimeEntry
            {
                ActivityId = activityList[2].Id,
                DurationMinutes = 90,
                Description = "Full product demo with Q&A session",
                EntryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        // ── Quotes ───────────────────────────────────────────────
        var seedDate = DateOnly.FromDateTime(DateTime.UtcNow);

        static QuoteLineItem CreateLineItem(Guid quoteId, string description, int sortOrder,
            decimal quantity, decimal unitPrice, decimal discountPercent, decimal taxPercent, Guid? productId = null)
        {
            var lineTotal = quantity * unitPrice;
            var discountAmount = lineTotal * discountPercent / 100m;
            var taxAmount = (lineTotal - discountAmount) * taxPercent / 100m;
            var netTotal = lineTotal - discountAmount + taxAmount;

            return new QuoteLineItem
            {
                QuoteId = quoteId,
                ProductId = productId,
                Description = description,
                SortOrder = sortOrder,
                Quantity = quantity,
                UnitPrice = unitPrice,
                DiscountPercent = discountPercent,
                TaxPercent = taxPercent,
                LineTotal = lineTotal,
                DiscountAmount = discountAmount,
                TaxAmount = taxAmount,
                NetTotal = netTotal
            };
        }

        void AddQuoteWithLines(Quote quote, params QuoteLineItem[] lines)
        {
            quote.Subtotal = lines.Sum(l => l.LineTotal);
            quote.DiscountTotal = lines.Sum(l => l.DiscountAmount);
            quote.TaxTotal = lines.Sum(l => l.TaxAmount);
            quote.GrandTotal = quote.Subtotal - quote.DiscountTotal + quote.TaxTotal;
            _db.Quotes.Add(quote);
            foreach (var line in lines)
                _db.QuoteLineItems.Add(line);
        }

        // Quote 1: Website Redesign Proposal - Draft (owner: Jake)
        var q1 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0001",
            Title = "Website Redesign Proposal",
            Description = "Complete website redesign including UX research, frontend development, and QA testing.",
            Status = QuoteStatus.Draft, IssueDate = seedDate, ExpiryDate = seedDate.AddDays(30),
            VersionNumber = 1,
            CompanyId = companyMap.GetValueOrDefault("TechVision Inc.")?.Id,
            ContactId = contactMap.GetValueOrDefault("sarah.chen@example.com")?.Id,
            OwnerId = jake.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        };
        AddQuoteWithLines(q1,
            CreateLineItem(q1.Id, "UI/UX Design", 1, 1m, 5000m, 0m, 10m),
            CreateLineItem(q1.Id, "Frontend Development", 2, 80m, 150m, 5m, 10m),
            CreateLineItem(q1.Id, "QA Testing", 3, 20m, 100m, 0m, 10m));

        // Quote 2: Annual Support Contract - Sent (owner: Jake)
        var q2 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0002",
            Title = "Annual Support Contract",
            Description = "24/7 premium support with dedicated account manager for one year.",
            Status = QuoteStatus.Sent, IssueDate = seedDate.AddDays(-5), ExpiryDate = seedDate.AddDays(25),
            VersionNumber = 1,
            CompanyId = companyMap.GetValueOrDefault("CloudScale Solutions")?.Id,
            OwnerId = jake.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-5), UpdatedAt = DateTimeOffset.UtcNow.AddDays(-3)
        };
        AddQuoteWithLines(q2,
            CreateLineItem(q2.Id, "Premium Support (Annual)", 1, 12m, 99.99m, 10m, 10m),
            CreateLineItem(q2.Id, "Dedicated Account Manager", 2, 1m, 2400m, 0m, 10m));
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q2.Id, FromStatus = QuoteStatus.Draft, ToStatus = QuoteStatus.Sent, ChangedAt = DateTimeOffset.UtcNow.AddDays(-3) });

        // Quote 3: Product Bundle Offer - Accepted (owner: Jake - deal owner)
        var q3 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0003",
            Title = "Product Bundle Offer",
            Description = "Enterprise license bundle with premium support at special pricing.",
            Status = QuoteStatus.Accepted, IssueDate = seedDate.AddDays(-10), ExpiryDate = seedDate.AddDays(20),
            VersionNumber = 1,
            DealId = dealMap.GetValueOrDefault("Enterprise CRM License")?.Id,
            CompanyId = companyMap.GetValueOrDefault("TechVision Inc.")?.Id,
            OwnerId = jake.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-10), UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2)
        };
        AddQuoteWithLines(q3,
            CreateLineItem(q3.Id, "CRM Enterprise License", 1, 10m, 499.99m, 15m, 10m, productMap.GetValueOrDefault("CRM Enterprise License")?.Id),
            CreateLineItem(q3.Id, "Premium Support", 2, 10m, 99.99m, 10m, 10m, productMap.GetValueOrDefault("Premium Support")?.Id));
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q3.Id, FromStatus = QuoteStatus.Draft, ToStatus = QuoteStatus.Sent, ChangedAt = DateTimeOffset.UtcNow.AddDays(-7) });
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q3.Id, FromStatus = QuoteStatus.Sent, ToStatus = QuoteStatus.Accepted, ChangedAt = DateTimeOffset.UtcNow.AddDays(-2) });

        // Quote 4: Healthcare Data Platform - Sent (owner: Priya)
        var q4 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0004",
            Title = "Healthcare Data Platform License",
            Description = "Enterprise data analytics platform tailored for healthcare compliance needs.",
            Status = QuoteStatus.Sent, IssueDate = seedDate.AddDays(-3), ExpiryDate = seedDate.AddDays(27),
            VersionNumber = 1,
            CompanyId = companyMap.GetValueOrDefault("Meridian Healthcare")?.Id,
            ContactId = contactMap.GetValueOrDefault("david.kim@example.com")?.Id,
            OwnerId = priya.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-3), UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        AddQuoteWithLines(q4,
            CreateLineItem(q4.Id, "Data Analytics Platform (Annual)", 1, 1m, 18000m, 5m, 10m),
            CreateLineItem(q4.Id, "HIPAA Compliance Module", 2, 1m, 4500m, 0m, 10m),
            CreateLineItem(q4.Id, "Training & Onboarding", 3, 3m, 800m, 0m, 10m));
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q4.Id, FromStatus = QuoteStatus.Draft, ToStatus = QuoteStatus.Sent, ChangedAt = DateTimeOffset.UtcNow.AddDays(-1) });

        // Quote 5: Robotics Automation Package - Rejected (owner: Olivia)
        var q5 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0005",
            Title = "Robotics Automation Package",
            Description = "Factory floor automation software suite with IoT integration.",
            Status = QuoteStatus.Rejected, IssueDate = seedDate.AddDays(-15), ExpiryDate = seedDate.AddDays(15),
            VersionNumber = 1,
            CompanyId = companyMap.GetValueOrDefault("Nova Robotics Ltd")?.Id,
            OwnerId = olivia.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-15), UpdatedAt = DateTimeOffset.UtcNow.AddDays(-5)
        };
        AddQuoteWithLines(q5,
            CreateLineItem(q5.Id, "Automation Suite License", 1, 5m, 3200m, 0m, 10m),
            CreateLineItem(q5.Id, "IoT Sensor Integration", 2, 20m, 150m, 10m, 10m));
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q5.Id, FromStatus = QuoteStatus.Draft, ToStatus = QuoteStatus.Sent, ChangedAt = DateTimeOffset.UtcNow.AddDays(-12) });
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q5.Id, FromStatus = QuoteStatus.Sent, ToStatus = QuoteStatus.Rejected, ChangedAt = DateTimeOffset.UtcNow.AddDays(-5) });

        // ── Requests ─────────────────────────────────────────────
        var requests = new List<(string Subject, string Desc, RequestStatus Status, RequestPriority Priority, string Category, string? ContactRef, string? CompanyRef, int DaysAgo, Guid OwnerId, Guid AssignedToId)>
        {
            ("Login page not loading on mobile", "Users report the login page does not render properly on mobile Safari and Chrome. White screen after splash.", RequestStatus.New, RequestPriority.High, "Bug", "sarah.chen@example.com", "TechVision Inc.", 0, olivia.Id, olivia.Id),
            ("Need export to CSV feature", "Customer requests ability to export contact and deal lists to CSV for reporting purposes.", RequestStatus.InProgress, RequestPriority.Medium, "Feature", null, "TechVision Inc.", 2, emily.Id, jake.Id),
            ("Billing inquiry for Q3", "Customer has questions about Q3 invoice discrepancy. Resolved after review of payment records.", RequestStatus.Resolved, RequestPriority.Low, "Billing", "aisha.patel@example.com", "CloudScale Solutions", 5, olivia.Id, olivia.Id),
            ("API rate limiting too aggressive", "Integration partner reports 429 errors during batch sync operations. Need higher rate limits.", RequestStatus.New, RequestPriority.High, "Technical", "thomas.wright@example.com", "Global Logistics Corp", 1, emily.Id, priya.Id),
            ("Custom dashboard request", "Manager wants a custom dashboard view showing team pipeline metrics and conversion rates.", RequestStatus.InProgress, RequestPriority.Medium, "Feature", "david.kim@example.com", "Meridian Healthcare", 3, emily.Id, daniel.Id),
            ("Password reset not sending email", "Multiple users report not receiving password reset emails. Checked spam folders.", RequestStatus.New, RequestPriority.Urgent, "Bug", "nina.johansson@example.com", "Alpine Digital Agency", 0, olivia.Id, olivia.Id),
            ("Data import from legacy system", "Need assistance importing 5000+ contacts from old CRM. Mapping fields to GlobCRM schema.", RequestStatus.InProgress, RequestPriority.Medium, "Technical", "priya.sharma@example.com", "Quantum Financial Services", 4, emily.Id, jake.Id),
            ("Onboarding training for new team", "New sales team of 8 members needs onboarding training session on CRM best practices.", RequestStatus.Closed, RequestPriority.Low, "General", "carlos.mendez@example.com", "GreenLeaf Organics", 10, olivia.Id, olivia.Id),
        };

        foreach (var (subject, desc, status, priority, category, contactRef, companyRef, daysAgo, ownerId, assignedToId) in requests)
        {
            _db.Requests.Add(new Request
            {
                TenantId = organizationId,
                Subject = subject,
                Description = desc,
                Status = status,
                Priority = priority,
                Category = category,
                ContactId = contactRef != null && contactMap.TryGetValue(contactRef, out var rc) ? rc.Id : null,
                CompanyId = companyRef != null && companyMap.TryGetValue(companyRef, out var rco) ? rco.Id : null,
                OwnerId = ownerId,
                AssignedToId = assignedToId,
                ResolvedAt = status == RequestStatus.Resolved ? DateTimeOffset.UtcNow.AddHours(-3) : null,
                ClosedAt = status == RequestStatus.Closed ? DateTimeOffset.UtcNow.AddDays(-2) : null,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo / 2)
            });
        }

        // ── Notes ────────────────────────────────────────────────
        var notes = new List<(string Title, string Body, string EntityType, string EntityRef, int DaysAgo, Guid AuthorId)>
        {
            ("Initial meeting notes", "<p>Met with <strong>Sarah Chen</strong> to discuss CRM requirements. Key points:</p><ul><li>Need for multi-user access with role-based permissions</li><li>Integration with existing email system is a must</li><li>Budget approved for Q2 implementation</li></ul><p>Follow-up scheduled for next week.</p>", "Company", "TechVision Inc.", 7, jake.Id),
            ("Technical requirements", "<p>Aisha outlined the following technical requirements for the CloudScale integration:</p><ol><li>REST API with OAuth 2.0 authentication</li><li>Webhook support for real-time events</li><li>Rate limiting: minimum 1000 req/min</li><li>Data export in JSON and CSV formats</li></ol><p><em>Priority: High</em></p>", "Company", "CloudScale Solutions", 5, jake.Id),
            ("Pricing discussion summary", "<p>Discussed pricing tiers with the procurement team. They're comparing us against two competitors.</p><p><strong>Our advantages:</strong></p><ul><li>Better customization options</li><li>Lower total cost of ownership over 3 years</li><li>Superior mobile experience</li></ul><p>Need to send formal proposal by <strong>Friday</strong>.</p>", "Deal", "Enterprise CRM License", 3, jake.Id),
            ("Healthcare compliance review", "<p>Completed initial compliance review for Meridian Healthcare integration:</p><ul><li>HIPAA BAA required before data exchange</li><li>All PHI must be encrypted at rest and in transit</li><li>Audit logging must capture all data access events</li><li>Data retention policy: 7 years minimum</li></ul><p>Legal team reviewing BAA template.</p>", "Company", "Meridian Healthcare", 4, priya.Id),
            ("Quarterly business review", "<p>Q3 business review with Global Logistics:</p><h3>Metrics</h3><ul><li>Usage up 23% quarter-over-quarter</li><li>User satisfaction score: 4.2/5</li><li>Support tickets down 15%</li></ul><h3>Action Items</h3><ol><li>Schedule advanced training for power users</li><li>Review API integration performance</li><li>Discuss renewal terms in Q4</li></ol>", "Company", "Global Logistics Corp", 2, priya.Id),
            ("Product demo feedback", "<p>Feedback from yesterday's product demo with the Alpine team:</p><p><strong>Positive:</strong></p><ul><li>Clean, modern interface</li><li>Drag-and-drop pipeline view was a hit</li><li>Reporting capabilities exceeded expectations</li></ul><p><strong>Concerns:</strong></p><ul><li>Would like more email template options</li><li>Asked about WhatsApp integration timeline</li></ul>", "Company", "Alpine Digital Agency", 1, olivia.Id),
            ("Contract negotiation status", "<p>Current status of the Quantum Financial deal:</p><ul><li>Legal review: <strong>Complete</strong></li><li>Security assessment: <strong>In Progress</strong></li><li>Budget approval: <strong>Pending CFO sign-off</strong></li></ul><p>Expected close date: end of month. Deal value: $42,000/year.</p>", "Deal", "Financial Analytics Platform", 1, emily.Id),
            ("Organic certification integration", "<p>Notes from call with Carlos about organic certification tracking:</p><ul><li>Need to track certification expiry dates</li><li>Custom field for certification body (USDA, EU Organic, etc.)</li><li>Automated reminders 90 days before expiry</li><li>Document upload for certificate copies</li></ul><p>Will create custom fields in next sprint.</p>", "Company", "GreenLeaf Organics", 6, emily.Id),
        };

        foreach (var (title, body, entityType, entityRef, daysAgo, authorId) in notes)
        {
            Guid? entityId = null;
            string? entityName = entityRef;

            if (entityType == "Company" && companyMap.TryGetValue(entityRef, out var noteCompany))
                entityId = noteCompany.Id;
            else if (entityType == "Deal" && dealMap.TryGetValue(entityRef, out var noteDeal))
                entityId = noteDeal.Id;

            if (entityId.HasValue)
            {
                var plainText = System.Text.RegularExpressions.Regex.Replace(body, "<[^>]+>", " ").Trim();
                if (plainText.Length > 500) plainText = plainText[..500];

                _db.Notes.Add(new Note
                {
                    TenantId = organizationId,
                    Title = title,
                    Body = body,
                    PlainTextBody = plainText,
                    EntityType = entityType,
                    EntityId = entityId.Value,
                    EntityName = entityName,
                    AuthorId = authorId,
                    IsSeedData = true,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo),
                    UpdatedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo)
                });
            }
        }

        // ── Lead Stages ─────────────────────────────────────────────
        var leadStageMap = new Dictionary<string, LeadStage>();
        var leadStages = new (string Name, int Order, string Color, bool IsConverted, bool IsLost)[]
        {
            ("New", 0, "#2196f3", false, false),
            ("Contacted", 1, "#ff9800", false, false),
            ("Qualified", 2, "#4caf50", false, false),
            ("Lost", 3, "#f44336", false, true),
            ("Converted", 4, "#9c27b0", true, false)
        };

        foreach (var (name, order, color, isConverted, isLost) in leadStages)
        {
            var leadStage = new LeadStage
            {
                TenantId = organizationId,
                Name = name,
                SortOrder = order,
                Color = color,
                IsConverted = isConverted,
                IsLost = isLost,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.LeadStages.Add(leadStage);
            leadStageMap[name] = leadStage;
        }

        // ── Lead Sources ────────────────────────────────────────────
        var leadSourceMap = new Dictionary<string, LeadSource>();
        var leadSources = new (string Name, int Order, bool IsDefault)[]
        {
            ("Website", 0, true),
            ("Referral", 1, false),
            ("LinkedIn", 2, false),
            ("Cold Call", 3, false),
            ("Trade Show", 4, false),
            ("Email Campaign", 5, false),
            ("Other", 6, false)
        };

        foreach (var (name, order, isDefault) in leadSources)
        {
            var leadSource = new LeadSource
            {
                TenantId = organizationId,
                Name = name,
                SortOrder = order,
                IsDefault = isDefault,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.LeadSources.Add(leadSource);
            leadSourceMap[name] = leadSource;
        }

        // ── Leads ─────────────────────────────────────────────────
        var leadList = new (string First, string Last, string Email, string? Phone, string? Mobile, string? Company, string? JobTitle, string Stage, string Source, LeadTemperature Temp, string? Desc, Guid OwnerId, int DaysAgo)[]
        {
            // New leads (fresh inbound)
            ("Alex", "Turner", "alex.turner@horizontech.com", "+1-555-3001", null, "Horizon Tech", "VP Engineering", "New", "Website", LeadTemperature.Hot, "Filled out pricing form for 50-seat deployment. Mentioned current tool is Salesforce but looking to switch.", jake.Id, -2),
            ("Maria", "Gonzalez", "maria.gonzalez@brightsolutions.com", "+1-555-3002", "+1-555-3012", "Bright Solutions", "Head of Sales", "New", "LinkedIn", LeadTemperature.Warm, "Connected via LinkedIn post about CRM automation. Interested in workflow features for 15-person sales team.", priya.Id, -1),
            ("Rafael", "Santos", "rafael.santos@sunpeak.vc", "+55-11-5503007", null, "SunPeak Ventures", "Investment Director", "New", "Referral", LeadTemperature.Cold, "Referred by existing customer at Alpine Digital. Exploring CRM options for portfolio company.", emily.Id, -3),
            ("Raj", "Patel", "raj.patel@indussys.com", "+91-22-5503009", "+91-98-55503019", "Indus Systems", "CTO", "New", "LinkedIn", LeadTemperature.Hot, "Downloaded whitepaper on API integrations. Company has 200+ employees and growing fast.", priya.Id, 0),
            ("Lena", "Kowalski", "lena.k@novadesign.io", "+48-22-5503011", null, "Nova Design Studio", "Creative Director", "New", "Website", LeadTemperature.Warm, "Signed up for free trial. Small agency (8 people) looking for project + client management.", olivia.Id, -1),

            // Contacted leads (initial outreach done)
            ("Wei", "Zhang", "wei.zhang@eastwind-mfg.com", "+86-10-5503003", null, "Eastwind Manufacturing", "Procurement Director", "Contacted", "Trade Show", LeadTemperature.Hot, "Met at SaaS Connect 2026. Manages procurement for 3 factories. Budget approved for Q2. Follow-up call scheduled for next week.", jake.Id, -5),
            ("Fatima", "Al-Hassan", "fatima.alhassan@gulfcommerce.ae", "+971-4-5503004", "+971-50-5503014", "Gulf Commerce Ltd", "CEO", "Contacted", "Referral", LeadTemperature.Warm, "Referred by Wei Zhang. Running legacy CRM, wants modern cloud solution. Had intro call — interested in demo.", emily.Id, -4),
            ("Hannah", "Mueller", "hannah.mueller@eurotech.de", "+49-30-5503008", null, "Eurotech GmbH", "IT Manager", "Contacted", "Website", LeadTemperature.Warm, "Requested demo via contact form. Company uses SAP for ERP, needs standalone CRM. Sent product overview deck.", jake.Id, -8),
            ("Yuki", "Tanaka", "yuki.tanaka@sakurafinance.jp", "+81-3-5503012", null, "Sakura Finance", "Operations Manager", "Contacted", "Email Campaign", LeadTemperature.Cold, "Opened 3 emails in nurture sequence. Replied asking about data residency options.", priya.Id, -6),
            ("Carlos", "Mendez", "carlos.m@latamlogistics.com", "+52-55-5503013", "+52-55-5503023", "LatAm Logistics", "Regional Sales Manager", "Contacted", "Cold Call", LeadTemperature.Warm, "Cold call went well — has 25 sales reps using spreadsheets. Wants to see Kanban pipeline features.", olivia.Id, -7),

            // Qualified leads (budget, authority, need confirmed)
            ("James", "O'Brien", "james.obrien@celticanalytics.ie", "+353-1-5503005", null, "Celtic Analytics", "Data Science Lead", "Qualified", "Email Campaign", LeadTemperature.Hot, "Completed demo. Budget: $40K/yr. Decision timeline: 30 days. Needs API access for data warehouse integration. Sending proposal this week.", priya.Id, -7),
            ("Sophia", "Petrova", "sophia.petrova@nexgensoftware.ru", "+7-495-5503006", null, "NexGen Software", "COO", "Qualified", "Cold Call", LeadTemperature.Warm, "Two demos completed with technical team. 80 users. Main concern is migration from HubSpot. Proposal under review.", olivia.Id, -6),
            ("Emma", "Wilson", "emma.wilson@sterlingpartners.co.uk", "+44-20-5503010", "+44-77-5503020", "Sterling Partners", "Managing Partner", "Qualified", "Trade Show", LeadTemperature.Hot, "Met at London SaaS Summit. Partnership firm with 12 partners and 40 staff. Needs deal tracking + reporting. Final approval from board next Tuesday.", olivia.Id, -10),
            ("David", "Kim", "david.kim@pacificretail.com", "+1-415-5503014", null, "Pacific Retail Group", "VP Sales Operations", "Qualified", "Referral", LeadTemperature.Hot, "Referred by James O'Brien. 150 sales reps across 5 regions. Currently evaluating us vs Pipedrive. Budget allocated.", jake.Id, -12),
            ("Amara", "Okafor", "amara.okafor@savannatech.ng", "+234-1-5503015", null, "Savanna Technologies", "Head of Business Development", "Qualified", "Website", LeadTemperature.Warm, "Applied for enterprise pilot program. 60-person BizDev team. Needs multi-currency support and custom reporting.", emily.Id, -9),

            // Lost leads
            ("Tom", "Baker", "tom.baker@oldguardconsulting.com", "+1-212-5503016", null, "Old Guard Consulting", "Senior Partner", "Lost", "Cold Call", LeadTemperature.Cold, "Decided to stay with existing Dynamics 365 setup. Budget was reallocated to internal IT projects. May revisit in 6 months.", jake.Id, -20),
            ("Nina", "Bergstrom", "nina.b@nordicshipping.se", "+46-8-5503017", null, "Nordic Shipping AB", "Digital Transformation Lead", "Lost", "Trade Show", LeadTemperature.Cold, "Went with competitor (Freshsales) due to built-in phone dialer. Price was not the issue — feature gap on telephony.", emily.Id, -18),

            // Converted leads
            ("Priya", "Sharma", "priya.sharma@zenithcloud.in", "+91-80-5503018", "+91-98-5503028", "Zenith Cloud Services", "Founder & CEO", "Converted", "Referral", LeadTemperature.Hot, "Converted to contact + company + deal. Signed 25-seat annual contract. Onboarding in progress.", priya.Id, -25),
            ("Lucas", "Dubois", "lucas.dubois@parismedia.fr", "+33-1-5503019", null, "Paris Media Group", "Marketing Director", "Converted", "LinkedIn", LeadTemperature.Warm, "Converted to contact + company. Started with 10 seats. Interested in email sequences once available.", olivia.Id, -22),
        };

        var leadMap = new Dictionary<string, Lead>();
        foreach (var (first, last, email, phone, mobile, company, jobTitle, stage, source, temp, desc, ownerId, daysAgo) in leadList)
        {
            var lead = new Lead
            {
                TenantId = organizationId,
                FirstName = first,
                LastName = last,
                Email = email,
                Phone = phone,
                MobilePhone = mobile,
                CompanyName = company,
                JobTitle = jobTitle,
                LeadStageId = leadStageMap[stage].Id,
                LeadSourceId = leadSourceMap[source].Id,
                Temperature = temp,
                Description = desc,
                OwnerId = ownerId,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(daysAgo),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(daysAgo + 1 > 0 ? 0 : daysAgo + 1)
            };
            _db.Leads.Add(lead);
            leadMap[$"{first} {last}"] = lead;
        }

        // ── Lead Stage History ────────────────────────────────────
        void AddLeadStageHistory(string leadRef, string? fromStage, string toStage, Guid changedByUserId, int daysAgo)
        {
            if (leadMap.TryGetValue(leadRef, out var lead) &&
                leadStageMap.TryGetValue(toStage, out var to))
            {
                Guid? fromId = fromStage != null && leadStageMap.TryGetValue(fromStage, out var from) ? from.Id : null;
                _db.LeadStageHistories.Add(new LeadStageHistory
                {
                    LeadId = lead.Id,
                    FromStageId = fromId,
                    ToStageId = to.Id,
                    ChangedByUserId = changedByUserId,
                    ChangedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo)
                });
            }
        }

        // Contacted leads: New -> Contacted
        AddLeadStageHistory("Wei Zhang", null, "New", jake.Id, 5);
        AddLeadStageHistory("Wei Zhang", "New", "Contacted", jake.Id, 3);
        AddLeadStageHistory("Fatima Al-Hassan", null, "New", emily.Id, 4);
        AddLeadStageHistory("Fatima Al-Hassan", "New", "Contacted", emily.Id, 2);
        AddLeadStageHistory("Hannah Mueller", null, "New", jake.Id, 8);
        AddLeadStageHistory("Hannah Mueller", "New", "Contacted", jake.Id, 5);
        AddLeadStageHistory("Yuki Tanaka", null, "New", priya.Id, 6);
        AddLeadStageHistory("Yuki Tanaka", "New", "Contacted", priya.Id, 3);
        AddLeadStageHistory("Carlos Mendez", null, "New", olivia.Id, 7);
        AddLeadStageHistory("Carlos Mendez", "New", "Contacted", olivia.Id, 4);

        // Qualified leads: New -> Contacted -> Qualified
        AddLeadStageHistory("James O'Brien", null, "New", priya.Id, 7);
        AddLeadStageHistory("James O'Brien", "New", "Contacted", priya.Id, 5);
        AddLeadStageHistory("James O'Brien", "Contacted", "Qualified", priya.Id, 3);
        AddLeadStageHistory("Sophia Petrova", null, "New", olivia.Id, 6);
        AddLeadStageHistory("Sophia Petrova", "New", "Contacted", olivia.Id, 4);
        AddLeadStageHistory("Sophia Petrova", "Contacted", "Qualified", olivia.Id, 2);
        AddLeadStageHistory("Emma Wilson", null, "New", olivia.Id, 10);
        AddLeadStageHistory("Emma Wilson", "New", "Contacted", olivia.Id, 7);
        AddLeadStageHistory("Emma Wilson", "Contacted", "Qualified", olivia.Id, 4);
        AddLeadStageHistory("David Kim", null, "New", jake.Id, 12);
        AddLeadStageHistory("David Kim", "New", "Contacted", jake.Id, 9);
        AddLeadStageHistory("David Kim", "Contacted", "Qualified", jake.Id, 5);
        AddLeadStageHistory("Amara Okafor", null, "New", emily.Id, 9);
        AddLeadStageHistory("Amara Okafor", "New", "Contacted", emily.Id, 6);
        AddLeadStageHistory("Amara Okafor", "Contacted", "Qualified", emily.Id, 3);

        // Lost leads: New -> Contacted -> Qualified -> Lost
        AddLeadStageHistory("Tom Baker", null, "New", jake.Id, 20);
        AddLeadStageHistory("Tom Baker", "New", "Contacted", jake.Id, 16);
        AddLeadStageHistory("Tom Baker", "Contacted", "Qualified", jake.Id, 12);
        AddLeadStageHistory("Tom Baker", "Qualified", "Lost", jake.Id, 8);
        AddLeadStageHistory("Nina Bergstrom", null, "New", emily.Id, 18);
        AddLeadStageHistory("Nina Bergstrom", "New", "Contacted", emily.Id, 14);
        AddLeadStageHistory("Nina Bergstrom", "Contacted", "Qualified", emily.Id, 10);
        AddLeadStageHistory("Nina Bergstrom", "Qualified", "Lost", emily.Id, 6);

        // Converted leads: New -> Contacted -> Qualified -> Converted
        AddLeadStageHistory("Priya Sharma", null, "New", priya.Id, 25);
        AddLeadStageHistory("Priya Sharma", "New", "Contacted", priya.Id, 20);
        AddLeadStageHistory("Priya Sharma", "Contacted", "Qualified", priya.Id, 15);
        AddLeadStageHistory("Priya Sharma", "Qualified", "Converted", priya.Id, 10);
        AddLeadStageHistory("Lucas Dubois", null, "New", olivia.Id, 22);
        AddLeadStageHistory("Lucas Dubois", "New", "Contacted", olivia.Id, 17);
        AddLeadStageHistory("Lucas Dubois", "Contacted", "Qualified", olivia.Id, 12);
        AddLeadStageHistory("Lucas Dubois", "Qualified", "Converted", olivia.Id, 7);

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Seed data created for organization {OrgId}: {CompanyCount} companies, {ContactCount} contacts, {ProductCount} products, 1 pipeline with {StageCount} stages, {DealCount} deals, {ActivityCount} activities, 5 quotes, {RequestCount} requests, {NoteCount} notes, {LeadStageCount} lead stages, {LeadSourceCount} lead sources, {LeadCount} leads",
            organizationId,
            seedManifest.Companies.Count,
            seedManifest.Contacts.Count,
            seedManifest.Products.Count,
            seedManifest.Pipeline.Stages.Count,
            seedManifest.Deals.Count,
            seedManifest.Activities.Count,
            requests.Count,
            notes.Count,
            leadStages.Length,
            leadSources.Length,
            leadList.Length);

        // ══════════════════════════════════════════════════════════
        // STEP 6: DealContacts - link contacts to deals
        // ══════════════════════════════════════════════════════════
        var dealContacts = new (string DealRef, string ContactEmail)[]
        {
            ("Enterprise CRM License", "sarah.chen@example.com"),
            ("Enterprise CRM License", "marcus.r@example.com"),
            ("Cloud Migration Project", "aisha.patel@example.com"),
            ("Cloud Migration Project", "james.t@example.com"),
            ("Logistics Platform Integration", "thomas.wright@example.com"),
            ("Logistics Platform Integration", "lisa.nakamura@example.com"),
            ("Healthcare Data Analytics", "david.kim@example.com"),
            ("Digital Marketing Suite", "nina.johansson@example.com"),
            ("Financial Analytics Platform", "priya.sharma@example.com"),
            ("Financial Analytics Platform", "robert.chang@example.com"),
            ("Farm-to-Table Tracking", "carlos.mendez@example.com"),
            ("Robotics Fleet Management", "yuki.tanaka@example.com"),
            ("Robotics Fleet Management", "kenji.watanabe@example.com"),
        };

        foreach (var (dealRef, contactEmail) in dealContacts)
        {
            if (dealMap.TryGetValue(dealRef, out var deal) && contactMap.TryGetValue(contactEmail, out var contact))
            {
                _db.DealContacts.Add(new DealContact
                {
                    DealId = deal.Id,
                    ContactId = contact.Id,
                    LinkedAt = DateTimeOffset.UtcNow.AddDays(-7)
                });
            }
        }

        // ══════════════════════════════════════════════════════════
        // STEP 7: DealProducts - link products to deals
        // ══════════════════════════════════════════════════════════
        var dealProducts = new (string DealRef, string ProductName, int Qty)[]
        {
            ("Enterprise CRM License", "CRM Enterprise License", 10),
            ("Enterprise CRM License", "Premium Support", 10),
            ("Enterprise CRM License", "Data Migration Service", 1),
            ("Cloud Migration Project", "API Integration Package", 2),
            ("Cloud Migration Project", "Training Workshop", 3),
            ("Cloud Migration Project", "Premium Support", 12),
            ("Logistics Platform Integration", "API Integration Package", 1),
            ("Logistics Platform Integration", "CRM Professional License", 5),
            ("Digital Marketing Suite", "CRM Professional License", 5),
            ("Digital Marketing Suite", "Analytics Add-on", 5),
            ("Financial Analytics Platform", "CRM Enterprise License", 8),
            ("Financial Analytics Platform", "Analytics Add-on", 8),
            ("Farm-to-Table Tracking", "CRM Professional License", 3),
            ("Farm-to-Table Tracking", "Mobile App License", 10),
            ("Robotics Fleet Management", "CRM Enterprise License", 15),
            ("Robotics Fleet Management", "API Integration Package", 3),
        };

        foreach (var (dealRef, productName, qty) in dealProducts)
        {
            if (dealMap.TryGetValue(dealRef, out var deal) && productMap.TryGetValue(productName, out var product))
            {
                _db.DealProducts.Add(new DealProduct
                {
                    DealId = deal.Id,
                    ProductId = product.Id,
                    Quantity = qty,
                    LinkedAt = DateTimeOffset.UtcNow.AddDays(-5)
                });
            }
        }

        // ══════════════════════════════════════════════════════════
        // STEP 8: DealStageHistory - realistic stage progressions
        // ══════════════════════════════════════════════════════════
        void AddStageHistory(string dealRef, string fromStage, string toStage, Guid changedByUserId, int daysAgo)
        {
            if (dealMap.TryGetValue(dealRef, out var deal) &&
                stageMap.TryGetValue(fromStage, out var from) &&
                stageMap.TryGetValue(toStage, out var to))
            {
                _db.DealStageHistories.Add(new DealStageHistory
                {
                    DealId = deal.Id,
                    FromStageId = from.Id,
                    ToStageId = to.Id,
                    ChangedByUserId = changedByUserId,
                    ChangedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo)
                });
            }
        }

        // Enterprise CRM License (Proposal): Lead -> Qualified -> Proposal
        AddStageHistory("Enterprise CRM License", "Lead", "Qualified", jake.Id, 10);
        AddStageHistory("Enterprise CRM License", "Qualified", "Proposal", jake.Id, 5);

        // Cloud Migration Project (Negotiation): Lead -> Qualified -> Proposal -> Negotiation
        AddStageHistory("Cloud Migration Project", "Lead", "Qualified", jake.Id, 16);
        AddStageHistory("Cloud Migration Project", "Qualified", "Proposal", jake.Id, 12);
        AddStageHistory("Cloud Migration Project", "Proposal", "Negotiation", emily.Id, 7);

        // Digital Marketing Suite (Closed Won): Full journey
        AddStageHistory("Digital Marketing Suite", "Lead", "Qualified", olivia.Id, 22);
        AddStageHistory("Digital Marketing Suite", "Qualified", "Proposal", olivia.Id, 18);
        AddStageHistory("Digital Marketing Suite", "Proposal", "Negotiation", olivia.Id, 12);
        AddStageHistory("Digital Marketing Suite", "Negotiation", "Closed Won", emily.Id, 5);

        // Robotics Fleet Management (Closed Lost): Lead -> Qualified -> Proposal -> Closed Lost
        AddStageHistory("Robotics Fleet Management", "Lead", "Qualified", olivia.Id, 25);
        AddStageHistory("Robotics Fleet Management", "Qualified", "Proposal", olivia.Id, 20);
        AddStageHistory("Robotics Fleet Management", "Proposal", "Closed Lost", emily.Id, 10);

        // Financial Analytics Platform (Proposal): Lead -> Qualified -> Proposal
        AddStageHistory("Financial Analytics Platform", "Lead", "Qualified", emily.Id, 8);
        AddStageHistory("Financial Analytics Platform", "Qualified", "Proposal", emily.Id, 4);

        // ══════════════════════════════════════════════════════════
        // STEP 9: FeedItems + FeedComments
        // ══════════════════════════════════════════════════════════

        // Social Post 1: Deal closure celebration
        var feed1 = new FeedItem
        {
            TenantId = organizationId,
            Type = FeedItemType.SocialPost,
            Content = "Just closed the Digital Marketing Suite deal with Alpine Digital Agency! Great teamwork from everyone involved. This brings our Q4 pipeline to a strong start.",
            AuthorId = olivia.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-5),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-5)
        };
        _db.FeedItems.Add(feed1);

        // Social Post 2: Pipeline review reminder
        var feed2 = new FeedItem
        {
            TenantId = organizationId,
            Type = FeedItemType.SocialPost,
            Content = "Reminder: Q4 pipeline review meeting tomorrow at 2 PM. Please update your deal stages and forecasts before the meeting. Looking forward to hearing about your progress!",
            AuthorId = emily.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-3),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-3)
        };
        _db.FeedItems.Add(feed2);

        // Social Post 3: Intro call update
        var feed3 = new FeedItem
        {
            TenantId = organizationId,
            Type = FeedItemType.SocialPost,
            Content = "Had a fantastic intro call with Quantum Financial Services today. They're looking for a comprehensive analytics solution. Scheduling a deep-dive demo for next week.",
            AuthorId = emily.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        _db.FeedItems.Add(feed3);

        // System Event 1: Deal stage change
        var feed4 = new FeedItem
        {
            TenantId = organizationId,
            Type = FeedItemType.SystemEvent,
            Content = "Deal 'Cloud Migration Project' moved from Proposal to Negotiation stage.",
            EntityType = "Deal",
            EntityId = dealMap.GetValueOrDefault("Cloud Migration Project")?.Id,
            EntityName = "Cloud Migration Project",
            AuthorId = emily.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-7),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-7)
        };
        _db.FeedItems.Add(feed4);

        // System Event 2: New contact added
        var feed5 = new FeedItem
        {
            TenantId = organizationId,
            Type = FeedItemType.SystemEvent,
            Content = "New contact 'Sophie Laurent' (Freelance Consultant) added to the system.",
            EntityType = "Contact",
            EntityId = contactMap.GetValueOrDefault("sophie.laurent@example.com")?.Id,
            EntityName = "Sophie Laurent",
            AuthorId = priya.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-5),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-5)
        };
        _db.FeedItems.Add(feed5);

        // Feed Comments
        _db.FeedComments.Add(new FeedComment
        {
            FeedItemId = feed1.Id,
            Content = "Congrats Olivia! Great work on that deal.",
            AuthorId = emily.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-5).AddHours(1),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-5).AddHours(1)
        });
        _db.FeedComments.Add(new FeedComment
        {
            FeedItemId = feed1.Id,
            Content = "Well deserved! The demo you gave was excellent.",
            AuthorId = jake.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-5).AddHours(2),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-5).AddHours(2)
        });
        _db.FeedComments.Add(new FeedComment
        {
            FeedItemId = feed2.Id,
            Content = "Updated all my deals. Looking good for Q4!",
            AuthorId = jake.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-3).AddHours(4),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-3).AddHours(4)
        });
        _db.FeedComments.Add(new FeedComment
        {
            FeedItemId = feed2.Id,
            Content = "I have two deals moving to Proposal this week. Will update before the meeting.",
            AuthorId = priya.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-3).AddHours(5),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-3).AddHours(5)
        });
        _db.FeedComments.Add(new FeedComment
        {
            FeedItemId = feed3.Id,
            Content = "I worked with their risk team before - happy to join the demo if helpful.",
            AuthorId = daniel.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1).AddHours(3),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1).AddHours(3)
        });
        _db.FeedComments.Add(new FeedComment
        {
            FeedItemId = feed3.Id,
            Content = "Great initiative! Let me know if you need the analytics pitch deck.",
            AuthorId = olivia.Id,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1).AddHours(5),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1).AddHours(5)
        });

        // ══════════════════════════════════════════════════════════
        // STEP 10: Targets
        // ══════════════════════════════════════════════════════════
        var now = DateTimeOffset.UtcNow;
        var quarterStart = new DateTimeOffset(now.Year, ((now.Month - 1) / 3) * 3 + 1, 1, 0, 0, 0, TimeSpan.Zero);
        var quarterEnd = quarterStart.AddMonths(3).AddSeconds(-1);
        var monthStart = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var monthEnd = monthStart.AddMonths(1).AddSeconds(-1);
        var weekStart = now.AddDays(-(int)now.DayOfWeek);
        weekStart = new DateTimeOffset(weekStart.Year, weekStart.Month, weekStart.Day, 0, 0, 0, TimeSpan.Zero);
        var weekEnd = weekStart.AddDays(7).AddSeconds(-1);

        var targets = new Target[]
        {
            // Team-wide: Quarterly pipeline value $200K
            new()
            {
                TenantId = organizationId,
                OwnerId = null,
                MetricType = MetricType.DealPipelineValue,
                Period = TargetPeriod.Quarterly,
                TargetValue = 200000m,
                Name = "Q4 Pipeline Target",
                StartDate = quarterStart,
                EndDate = quarterEnd,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
                UpdatedAt = DateTimeOffset.UtcNow
            },
            // Team-wide: Quarterly win rate 35%
            new()
            {
                TenantId = organizationId,
                OwnerId = null,
                MetricType = MetricType.WinRate,
                Period = TargetPeriod.Quarterly,
                TargetValue = 35m,
                Name = "Q4 Win Rate Goal",
                StartDate = quarterStart,
                EndDate = quarterEnd,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-30),
                UpdatedAt = DateTimeOffset.UtcNow
            },
            // Personal: Jake - monthly deals won
            new()
            {
                TenantId = organizationId,
                OwnerId = jake.Id,
                MetricType = MetricType.DealsWon,
                Period = TargetPeriod.Monthly,
                TargetValue = 3m,
                Name = "Monthly Deals Won",
                StartDate = monthStart,
                EndDate = monthEnd,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-15),
                UpdatedAt = DateTimeOffset.UtcNow
            },
            // Personal: Priya - monthly contacts created
            new()
            {
                TenantId = organizationId,
                OwnerId = priya.Id,
                MetricType = MetricType.ContactsCreated,
                Period = TargetPeriod.Monthly,
                TargetValue = 20m,
                Name = "Monthly New Contacts",
                StartDate = monthStart,
                EndDate = monthEnd,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-15),
                UpdatedAt = DateTimeOffset.UtcNow
            },
            // Personal: Emily - weekly activities completed
            new()
            {
                TenantId = organizationId,
                OwnerId = emily.Id,
                MetricType = MetricType.ActivitiesCompleted,
                Period = TargetPeriod.Weekly,
                TargetValue = 10m,
                Name = "Weekly Activities Goal",
                StartDate = weekStart,
                EndDate = weekEnd,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-7),
                UpdatedAt = DateTimeOffset.UtcNow
            },
        };

        _db.Targets.AddRange(targets);

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Extended seed data created for organization {OrgId}: 13 deal-contacts, 16 deal-products, 14 stage histories, 5 feed items, 6 feed comments, 5 targets",
            organizationId);

        // ── Default Dashboard ─────────────────────────────────────
        var hasDashboards = await _db.Dashboards.AnyAsync(d => d.TenantId == organizationId);
        if (!hasDashboards)
        {
            var dashboard = new Dashboard
            {
                TenantId = organizationId,
                Name = "Sales Overview",
                IsDefault = true,
                OwnerId = null, // team-wide
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Dashboards.Add(dashboard);

            var widgets = new List<DashboardWidget>
            {
                new() { DashboardId = dashboard.Id, Type = WidgetType.KpiCard, Title = "Total Deals", X = 0, Y = 0, Cols = 3, Rows = 1, SortOrder = 0, Config = new Dictionary<string, object> { ["metricType"] = "DealCount", ["format"] = "number", ["icon"] = "handshake", ["color"] = "primary" } },
                new() { DashboardId = dashboard.Id, Type = WidgetType.KpiCard, Title = "Pipeline Value", X = 3, Y = 0, Cols = 3, Rows = 1, SortOrder = 1, Config = new Dictionary<string, object> { ["metricType"] = "DealPipelineValue", ["format"] = "currency", ["icon"] = "payments", ["color"] = "info" } },
                new() { DashboardId = dashboard.Id, Type = WidgetType.KpiCard, Title = "Win Rate", X = 6, Y = 0, Cols = 3, Rows = 1, SortOrder = 2, Config = new Dictionary<string, object> { ["metricType"] = "WinRate", ["format"] = "percent", ["icon"] = "emoji_events", ["color"] = "success" } },
                new() { DashboardId = dashboard.Id, Type = WidgetType.KpiCard, Title = "Activities Done", X = 9, Y = 0, Cols = 3, Rows = 1, SortOrder = 3, Config = new Dictionary<string, object> { ["metricType"] = "ActivitiesCompleted", ["format"] = "number", ["icon"] = "check_circle", ["color"] = "accent" } },
                new() { DashboardId = dashboard.Id, Type = WidgetType.BarChart, Title = "Deals by Stage", X = 0, Y = 1, Cols = 6, Rows = 2, SortOrder = 4, Config = new Dictionary<string, object> { ["metricType"] = "DealsByStage" } },
                new() { DashboardId = dashboard.Id, Type = WidgetType.PieChart, Title = "Activities by Type", X = 6, Y = 1, Cols = 6, Rows = 2, SortOrder = 5, Config = new Dictionary<string, object> { ["metricType"] = "ActivitiesByType" } },
                new() { DashboardId = dashboard.Id, Type = WidgetType.Leaderboard, Title = "Sales Leaderboard", X = 0, Y = 3, Cols = 4, Rows = 2, SortOrder = 6, Config = new Dictionary<string, object> { ["metricType"] = "SalesLeaderboard", ["valueFormat"] = "currency" } },
                new() { DashboardId = dashboard.Id, Type = WidgetType.KpiCard, Title = "New Contacts", X = 4, Y = 3, Cols = 4, Rows = 1, SortOrder = 7, Config = new Dictionary<string, object> { ["metricType"] = "ContactsCreated", ["format"] = "number", ["icon"] = "person_add", ["color"] = "secondary" } },
            };

            _db.DashboardWidgets.AddRange(widgets);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Default dashboard seeded for organization {OrgId}: 'Sales Overview' with {WidgetCount} widgets",
                organizationId, widgets.Count);
        }

        // ══════════════════════════════════════════════════════════
        // STEP 11: Email Template Categories + Starter Templates
        // ══════════════════════════════════════════════════════════
        await SeedEmailTemplatesAsync(organizationId);

        // ══════════════════════════════════════════════════════════
        // STEP 12: Email Sequences (depends on templates from Step 11)
        // ══════════════════════════════════════════════════════════
        await SeedEmailSequencesAsync(organizationId);

        // ══════════════════════════════════════════════════════════
        // STEP 13: Workflow Automations + System Templates
        // ══════════════════════════════════════════════════════════
        await SeedWorkflowsAsync(organizationId);

        // ══════════════════════════════════════════════════════════
        // STEP 14: Report Categories + Starter Reports
        // ══════════════════════════════════════════════════════════
        await SeedReportsAsync(organizationId);
    }

    /// <summary>
    /// Seeds starter email template categories and templates for a new organization.
    /// Creates 4 system categories and 5 shared starter templates.
    /// </summary>
    private async Task SeedEmailTemplatesAsync(Guid organizationId)
    {
        // ── Categories ──────────────────────────────────────────
        var salesCategory = new EmailTemplateCategory
        {
            TenantId = organizationId,
            Name = "Sales",
            SortOrder = 1,
            IsSystem = true,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var marketingCategory = new EmailTemplateCategory
        {
            TenantId = organizationId,
            Name = "Marketing",
            SortOrder = 2,
            IsSystem = true,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var supportCategory = new EmailTemplateCategory
        {
            TenantId = organizationId,
            Name = "Support",
            SortOrder = 3,
            IsSystem = true,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var generalCategory = new EmailTemplateCategory
        {
            TenantId = organizationId,
            Name = "General",
            SortOrder = 4,
            IsSystem = true,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.EmailTemplateCategories.AddRange(salesCategory, marketingCategory, supportCategory, generalCategory);
        await _db.SaveChangesAsync();

        // ── Starter Templates ────────────────────────────────────
        var templates = new EmailTemplate[]
        {
            // 1. Welcome Email (General)
            new()
            {
                TenantId = organizationId,
                Name = "Welcome Email",
                Subject = "Welcome to {{ company.name }}!",
                HtmlBody = BuildWelcomeEmailHtml(),
                DesignJson = "{}",
                CategoryId = generalCategory.Id,
                IsShared = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            // 2. Follow-up (Sales)
            new()
            {
                TenantId = organizationId,
                Name = "Follow-up",
                Subject = "Following up on our conversation",
                HtmlBody = BuildFollowUpEmailHtml(),
                DesignJson = "{}",
                CategoryId = salesCategory.Id,
                IsShared = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            // 3. Meeting Request (Sales)
            new()
            {
                TenantId = organizationId,
                Name = "Meeting Request",
                Subject = "Let's schedule a meeting",
                HtmlBody = BuildMeetingRequestEmailHtml(),
                DesignJson = "{}",
                CategoryId = salesCategory.Id,
                IsShared = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            // 4. Deal Won (Sales)
            new()
            {
                TenantId = organizationId,
                Name = "Deal Won",
                Subject = "Congratulations on {{ deal.title }}!",
                HtmlBody = BuildDealWonEmailHtml(),
                DesignJson = "{}",
                CategoryId = salesCategory.Id,
                IsShared = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            // 5. Support Follow-up (Support)
            new()
            {
                TenantId = organizationId,
                Name = "Support Follow-up",
                Subject = "How was your experience?",
                HtmlBody = BuildSupportFollowUpEmailHtml(),
                DesignJson = "{}",
                CategoryId = supportCategory.Id,
                IsShared = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
        };

        _db.EmailTemplates.AddRange(templates);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Email template seed data created for organization {OrgId}: 4 categories, 5 templates",
            organizationId);
    }

    /// <summary>
    /// Seeds a sample email sequence with steps and enrollments for a new organization.
    /// Creates 1 "New Customer Onboarding" sequence (Active, 3 steps) and 3 sample enrollments.
    /// Must be called AFTER SeedEmailTemplatesAsync (steps reference templates).
    /// </summary>
    private async Task SeedEmailSequencesAsync(Guid organizationId)
    {
        // ── Get first seed user and first 3 seed templates ──────────
        var seedUser = await _db.Users
            .Where(u => u.OrganizationId == organizationId)
            .OrderBy(u => u.CreatedAt)
            .FirstOrDefaultAsync();

        if (seedUser == null)
        {
            _logger.LogWarning("No users found for organization {OrgId}, skipping sequence seeding", organizationId);
            return;
        }

        var seedTemplates = await _db.EmailTemplates
            .Where(t => t.TenantId == organizationId && t.IsSeedData)
            .OrderBy(t => t.CreatedAt)
            .Take(3)
            .ToListAsync();

        if (seedTemplates.Count < 3)
        {
            _logger.LogWarning("Not enough seed templates ({Count}) for organization {OrgId}, skipping sequence seeding",
                seedTemplates.Count, organizationId);
            return;
        }

        // ── Create Sequence ─────────────────────────────────────────
        var sequence = new EmailSequence
        {
            TenantId = organizationId,
            Name = "New Customer Onboarding",
            Description = "A 3-step welcome sequence for newly onboarded customers. Sends a welcome email immediately, a follow-up after 2 days, and a meeting request after 5 days.",
            Status = SequenceStatus.Active,
            CreatedByUserId = seedUser.Id,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.EmailSequences.Add(sequence);
        await _db.SaveChangesAsync();

        // ── Create Steps ─────────────────────────────────────────
        var steps = new List<EmailSequenceStep>
        {
            new()
            {
                SequenceId = sequence.Id,
                StepNumber = 1,
                EmailTemplateId = seedTemplates[0].Id,
                DelayDays = 0,
                PreferredSendTime = new TimeOnly(9, 0),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                SequenceId = sequence.Id,
                StepNumber = 2,
                EmailTemplateId = seedTemplates[1].Id,
                SubjectOverride = "Checking in - how's everything going?",
                DelayDays = 2,
                PreferredSendTime = new TimeOnly(9, 0),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },
            new()
            {
                SequenceId = sequence.Id,
                StepNumber = 3,
                EmailTemplateId = seedTemplates[2].Id,
                DelayDays = 5,
                PreferredSendTime = new TimeOnly(9, 0),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }
        };

        _db.EmailSequenceSteps.AddRange(steps);
        await _db.SaveChangesAsync();

        // ── Create Sample Enrollments ──────────────────────────────
        var seedContacts = await _db.Contacts
            .Where(c => c.TenantId == organizationId && c.IsSeedData)
            .OrderBy(c => c.CreatedAt)
            .Take(3)
            .ToListAsync();

        if (seedContacts.Count >= 3)
        {
            var enrollments = new List<SequenceEnrollment>
            {
                // Active enrollment - currently on step 2
                new()
                {
                    TenantId = organizationId,
                    SequenceId = sequence.Id,
                    ContactId = seedContacts[0].Id,
                    Status = EnrollmentStatus.Active,
                    CurrentStepNumber = 2,
                    StepsSent = 2,
                    LastStepSentAt = DateTimeOffset.UtcNow.AddDays(-1),
                    CreatedByUserId = seedUser.Id,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-3),
                    UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
                },
                // Completed enrollment - all steps sent
                new()
                {
                    TenantId = organizationId,
                    SequenceId = sequence.Id,
                    ContactId = seedContacts[1].Id,
                    Status = EnrollmentStatus.Completed,
                    CurrentStepNumber = 3,
                    StepsSent = 3,
                    LastStepSentAt = DateTimeOffset.UtcNow.AddDays(-2),
                    CompletedAt = DateTimeOffset.UtcNow.AddDays(-2),
                    CreatedByUserId = seedUser.Id,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-10),
                    UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2)
                },
                // Replied enrollment - contact replied at step 1
                new()
                {
                    TenantId = organizationId,
                    SequenceId = sequence.Id,
                    ContactId = seedContacts[2].Id,
                    Status = EnrollmentStatus.Replied,
                    CurrentStepNumber = 1,
                    StepsSent = 1,
                    LastStepSentAt = DateTimeOffset.UtcNow.AddDays(-5),
                    RepliedAt = DateTimeOffset.UtcNow.AddDays(-4),
                    ReplyStepNumber = 1,
                    CreatedByUserId = seedUser.Id,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-6),
                    UpdatedAt = DateTimeOffset.UtcNow.AddDays(-4)
                }
            };

            _db.SequenceEnrollments.AddRange(enrollments);
            await _db.SaveChangesAsync();
        }

        _logger.LogInformation(
            "Email sequence seed data created for organization {OrgId}: 1 sequence, 3 steps, {EnrollmentCount} enrollments",
            organizationId, seedContacts.Count >= 3 ? 3 : 0);
    }

    /// <summary>
    /// Seeds demo workflow automations and system workflow templates.
    /// Creates 2 active demo workflows and 3 system templates for the template gallery.
    /// </summary>
    private async Task SeedWorkflowsAsync(Guid organizationId)
    {
        // ── Get first seed user ──────────────────────────────────────
        var seedUser = await _db.Users
            .Where(u => u.OrganizationId == organizationId)
            .OrderBy(u => u.CreatedAt)
            .FirstOrDefaultAsync();

        if (seedUser == null)
        {
            _logger.LogWarning("No users found for organization {OrgId}, skipping workflow seeding", organizationId);
            return;
        }

        // ── Demo Workflow 1: New Deal Notification ────────────────────
        var dealNotificationWorkflow = new Workflow
        {
            TenantId = organizationId,
            Name = "New Deal Notification",
            Description = "Automatically sends a notification to the deal owner when a new deal is created.",
            EntityType = "Deal",
            Definition = new WorkflowDefinition
            {
                Nodes =
                [
                    new WorkflowNode { Id = "trigger-1", Type = "trigger", Label = "Deal Created", Position = new WorkflowNodePosition { X = 250, Y = 50 } },
                    new WorkflowNode { Id = "action-1", Type = "action", Label = "Notify Deal Owner", Position = new WorkflowNodePosition { X = 250, Y = 200 } }
                ],
                Connections =
                [
                    new WorkflowConnection { Id = "conn-1", SourceNodeId = "trigger-1", TargetNodeId = "action-1" }
                ],
                Triggers =
                [
                    new WorkflowTriggerConfig { Id = "trig-1", NodeId = "trigger-1", TriggerType = WorkflowTriggerType.RecordCreated, EventType = "Created" }
                ],
                Conditions = [],
                Actions =
                [
                    new WorkflowActionConfig
                    {
                        Id = "act-1", NodeId = "action-1", ActionType = WorkflowActionType.SendNotification, Order = 1,
                        Config = "{\"Title\":\"New Deal Created\",\"Message\":\"A new deal has been created and assigned to you.\",\"RecipientType\":\"deal_owner\"}"
                    }
                ]
            },
            TriggerSummary = ["RecordCreated"],
            Status = WorkflowStatus.Active,
            IsActive = true,
            CreatedByUserId = seedUser.Id,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        // ── Demo Workflow 2: Lead Follow-Up Task ──────────────────────
        var leadFollowUpWorkflow = new Workflow
        {
            TenantId = organizationId,
            Name = "Lead Follow-Up Task",
            Description = "Creates a follow-up activity when a lead status changes to Qualified.",
            EntityType = "Lead",
            Definition = new WorkflowDefinition
            {
                Nodes =
                [
                    new WorkflowNode { Id = "trigger-1", Type = "trigger", Label = "Lead Updated", Position = new WorkflowNodePosition { X = 250, Y = 50 } },
                    new WorkflowNode { Id = "condition-1", Type = "condition", Label = "Status = Qualified", Position = new WorkflowNodePosition { X = 250, Y = 180 } },
                    new WorkflowNode { Id = "action-1", Type = "action", Label = "Create Follow-Up Task", Position = new WorkflowNodePosition { X = 250, Y = 330 } }
                ],
                Connections =
                [
                    new WorkflowConnection { Id = "conn-1", SourceNodeId = "trigger-1", TargetNodeId = "condition-1" },
                    new WorkflowConnection { Id = "conn-2", SourceNodeId = "condition-1", TargetNodeId = "action-1" }
                ],
                Triggers =
                [
                    new WorkflowTriggerConfig { Id = "trig-1", NodeId = "trigger-1", TriggerType = WorkflowTriggerType.FieldChanged, EventType = "Updated", FieldName = "Status" }
                ],
                Conditions =
                [
                    new WorkflowConditionGroup
                    {
                        Id = "cg-1", NodeId = "condition-1",
                        Conditions = [new WorkflowCondition { Field = "Status", Operator = "changed_to", Value = "Qualified" }]
                    }
                ],
                Actions =
                [
                    new WorkflowActionConfig
                    {
                        Id = "act-1", NodeId = "action-1", ActionType = WorkflowActionType.CreateActivity, Order = 1,
                        Config = "{\"Subject\":\"Follow up with qualified lead\",\"Type\":\"Task\",\"Priority\":\"High\",\"DueDateOffsetDays\":1,\"AssigneeType\":\"record_owner\"}"
                    }
                ]
            },
            TriggerSummary = ["FieldChanged:Status"],
            Status = WorkflowStatus.Active,
            IsActive = true,
            CreatedByUserId = seedUser.Id,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };

        _db.Workflows.AddRange(dealNotificationWorkflow, leadFollowUpWorkflow);
        await _db.SaveChangesAsync();

        // ── System Workflow Templates ──────────────────────────────────
        var templates = new WorkflowTemplate[]
        {
            // 1. Deal Won Celebration (sales)
            new()
            {
                TenantId = organizationId,
                Name = "Deal Won Celebration",
                Description = "Notify the team and send a congratulatory email when a deal stage changes to Won.",
                Category = "sales",
                EntityType = "Deal",
                Definition = new WorkflowDefinition
                {
                    Nodes =
                    [
                        new WorkflowNode { Id = "trigger-1", Type = "trigger", Label = "Deal Updated", Position = new WorkflowNodePosition { X = 250, Y = 50 } },
                        new WorkflowNode { Id = "condition-1", Type = "condition", Label = "Stage = Won", Position = new WorkflowNodePosition { X = 250, Y = 180 } },
                        new WorkflowNode { Id = "action-1", Type = "action", Label = "Notify Team", Position = new WorkflowNodePosition { X = 100, Y = 330 } },
                        new WorkflowNode { Id = "action-2", Type = "action", Label = "Send Email", Position = new WorkflowNodePosition { X = 400, Y = 330 } }
                    ],
                    Connections =
                    [
                        new WorkflowConnection { Id = "conn-1", SourceNodeId = "trigger-1", TargetNodeId = "condition-1" },
                        new WorkflowConnection { Id = "conn-2", SourceNodeId = "condition-1", TargetNodeId = "action-1" },
                        new WorkflowConnection { Id = "conn-3", SourceNodeId = "condition-1", TargetNodeId = "action-2" }
                    ],
                    Triggers =
                    [
                        new WorkflowTriggerConfig { Id = "trig-1", NodeId = "trigger-1", TriggerType = WorkflowTriggerType.FieldChanged, EventType = "Updated", FieldName = "Stage" }
                    ],
                    Conditions =
                    [
                        new WorkflowConditionGroup
                        {
                            Id = "cg-1", NodeId = "condition-1",
                            Conditions = [new WorkflowCondition { Field = "Stage", Operator = "changed_to", Value = "Won" }]
                        }
                    ],
                    Actions =
                    [
                        new WorkflowActionConfig
                        {
                            Id = "act-1", NodeId = "action-1", ActionType = WorkflowActionType.SendNotification, Order = 1,
                            Config = "{\"Title\":\"Deal Won!\",\"Message\":\"A deal has been marked as Won. Congratulations!\",\"RecipientType\":\"team\"}"
                        },
                        new WorkflowActionConfig
                        {
                            Id = "act-2", NodeId = "action-2", ActionType = WorkflowActionType.SendEmail, Order = 2, ContinueOnError = true,
                            Config = "{\"RecipientField\":\"PrimaryContact.Email\"}"
                        }
                    ]
                },
                IsSystem = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },

            // 2. Welcome New Contact (engagement)
            new()
            {
                TenantId = organizationId,
                Name = "Welcome New Contact",
                Description = "Send a welcome email and create an introduction call activity when a new contact is added.",
                Category = "engagement",
                EntityType = "Contact",
                Definition = new WorkflowDefinition
                {
                    Nodes =
                    [
                        new WorkflowNode { Id = "trigger-1", Type = "trigger", Label = "Contact Created", Position = new WorkflowNodePosition { X = 250, Y = 50 } },
                        new WorkflowNode { Id = "action-1", Type = "action", Label = "Send Welcome Email", Position = new WorkflowNodePosition { X = 100, Y = 200 } },
                        new WorkflowNode { Id = "action-2", Type = "action", Label = "Create Intro Call", Position = new WorkflowNodePosition { X = 400, Y = 200 } }
                    ],
                    Connections =
                    [
                        new WorkflowConnection { Id = "conn-1", SourceNodeId = "trigger-1", TargetNodeId = "action-1" },
                        new WorkflowConnection { Id = "conn-2", SourceNodeId = "trigger-1", TargetNodeId = "action-2" }
                    ],
                    Triggers =
                    [
                        new WorkflowTriggerConfig { Id = "trig-1", NodeId = "trigger-1", TriggerType = WorkflowTriggerType.RecordCreated, EventType = "Created" }
                    ],
                    Conditions = [],
                    Actions =
                    [
                        new WorkflowActionConfig
                        {
                            Id = "act-1", NodeId = "action-1", ActionType = WorkflowActionType.SendEmail, Order = 1, ContinueOnError = true,
                            Config = "{\"RecipientField\":\"Email\"}"
                        },
                        new WorkflowActionConfig
                        {
                            Id = "act-2", NodeId = "action-2", ActionType = WorkflowActionType.CreateActivity, Order = 2,
                            Config = "{\"Subject\":\"Introduction call with new contact\",\"Type\":\"Call\",\"Priority\":\"Medium\",\"DueDateOffsetDays\":2,\"AssigneeType\":\"record_owner\"}"
                        }
                    ]
                },
                IsSystem = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },

            // 3. High-Value Deal Alert (operational)
            new()
            {
                TenantId = organizationId,
                Name = "High-Value Deal Alert",
                Description = "Alert the team when a deal with value over $10,000 is created.",
                Category = "operational",
                EntityType = "Deal",
                Definition = new WorkflowDefinition
                {
                    Nodes =
                    [
                        new WorkflowNode { Id = "trigger-1", Type = "trigger", Label = "Deal Created", Position = new WorkflowNodePosition { X = 250, Y = 50 } },
                        new WorkflowNode { Id = "condition-1", Type = "condition", Label = "Value > $10,000", Position = new WorkflowNodePosition { X = 250, Y = 180 } },
                        new WorkflowNode { Id = "action-1", Type = "action", Label = "Notify Team", Position = new WorkflowNodePosition { X = 250, Y = 330 } }
                    ],
                    Connections =
                    [
                        new WorkflowConnection { Id = "conn-1", SourceNodeId = "trigger-1", TargetNodeId = "condition-1" },
                        new WorkflowConnection { Id = "conn-2", SourceNodeId = "condition-1", TargetNodeId = "action-1" }
                    ],
                    Triggers =
                    [
                        new WorkflowTriggerConfig { Id = "trig-1", NodeId = "trigger-1", TriggerType = WorkflowTriggerType.RecordCreated, EventType = "Created" }
                    ],
                    Conditions =
                    [
                        new WorkflowConditionGroup
                        {
                            Id = "cg-1", NodeId = "condition-1",
                            Conditions = [new WorkflowCondition { Field = "Value", Operator = "gt", Value = "10000" }]
                        }
                    ],
                    Actions =
                    [
                        new WorkflowActionConfig
                        {
                            Id = "act-1", NodeId = "action-1", ActionType = WorkflowActionType.SendNotification, Order = 1,
                            Config = "{\"Title\":\"High-Value Deal Alert\",\"Message\":\"A new deal worth over $10,000 has been created.\",\"RecipientType\":\"team\"}"
                        }
                    ]
                },
                IsSystem = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },

            // 4. Lead Qualified Alert (sales)
            new()
            {
                TenantId = organizationId,
                Name = "Lead Qualified Alert",
                Description = "Alert the team when a lead status changes to Qualified.",
                Category = "sales",
                EntityType = "Lead",
                Definition = new WorkflowDefinition
                {
                    Nodes =
                    [
                        new WorkflowNode { Id = "trigger-1", Type = "trigger", Label = "Lead Updated", Position = new WorkflowNodePosition { X = 250, Y = 50 } },
                        new WorkflowNode { Id = "condition-1", Type = "condition", Label = "Status = Qualified", Position = new WorkflowNodePosition { X = 250, Y = 180 } },
                        new WorkflowNode { Id = "action-1", Type = "action", Label = "Notify Team", Position = new WorkflowNodePosition { X = 250, Y = 330 } }
                    ],
                    Connections =
                    [
                        new WorkflowConnection { Id = "conn-1", SourceNodeId = "trigger-1", TargetNodeId = "condition-1" },
                        new WorkflowConnection { Id = "conn-2", SourceNodeId = "condition-1", TargetNodeId = "action-1" }
                    ],
                    Triggers =
                    [
                        new WorkflowTriggerConfig { Id = "trig-1", NodeId = "trigger-1", TriggerType = WorkflowTriggerType.FieldChanged, EventType = "Updated", FieldName = "Status" }
                    ],
                    Conditions =
                    [
                        new WorkflowConditionGroup
                        {
                            Id = "cg-1", NodeId = "condition-1",
                            Conditions = [new WorkflowCondition { Field = "Status", Operator = "changed_to", Value = "Qualified" }]
                        }
                    ],
                    Actions =
                    [
                        new WorkflowActionConfig
                        {
                            Id = "act-1", NodeId = "action-1", ActionType = WorkflowActionType.SendNotification, Order = 1,
                            Config = "{\"Title\":\"Lead Qualified\",\"Message\":\"A lead has been qualified and is ready for follow-up.\",\"RecipientType\":\"team\"}"
                        }
                    ]
                },
                IsSystem = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            },

            // 5. New Company Enrichment Task (operational)
            new()
            {
                TenantId = organizationId,
                Name = "New Company Enrichment Task",
                Description = "Create a research task when a new company is added to enrich its data.",
                Category = "operational",
                EntityType = "Company",
                Definition = new WorkflowDefinition
                {
                    Nodes =
                    [
                        new WorkflowNode { Id = "trigger-1", Type = "trigger", Label = "Company Created", Position = new WorkflowNodePosition { X = 250, Y = 50 } },
                        new WorkflowNode { Id = "action-1", Type = "action", Label = "Create Research Task", Position = new WorkflowNodePosition { X = 250, Y = 200 } }
                    ],
                    Connections =
                    [
                        new WorkflowConnection { Id = "conn-1", SourceNodeId = "trigger-1", TargetNodeId = "action-1" }
                    ],
                    Triggers =
                    [
                        new WorkflowTriggerConfig { Id = "trig-1", NodeId = "trigger-1", TriggerType = WorkflowTriggerType.RecordCreated, EventType = "Created" }
                    ],
                    Conditions = [],
                    Actions =
                    [
                        new WorkflowActionConfig
                        {
                            Id = "act-1", NodeId = "action-1", ActionType = WorkflowActionType.CreateActivity, Order = 1,
                            Config = "{\"Subject\":\"Research and enrich company data\",\"Type\":\"Task\",\"Priority\":\"Medium\",\"DueDateOffsetDays\":3,\"AssigneeType\":\"record_owner\"}"
                        }
                    ]
                },
                IsSystem = true,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            }
        };

        _db.WorkflowTemplates.AddRange(templates);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Workflow seed data created for organization {OrgId}: 2 demo workflows, 5 system templates",
            organizationId);
    }

    // ── Starter Template HTML Builders ─────────────────────────

    private static string BuildEmailWrapper(string bodyContent)
    {
        return $@"<!DOCTYPE html>
<html>
<head><meta charset=""utf-8""><meta name=""viewport"" content=""width=device-width, initial-scale=1.0""></head>
<body style=""margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;"">
<table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" width=""100%"" style=""background-color: #f4f4f5;"">
<tr>
<td style=""padding: 40px 20px;"">
<table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" width=""560"" style=""margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"">
    <tr>
        <td style=""padding: 32px 40px 24px; border-bottom: 1px solid #e4e4e7;"">
            <span style=""font-size: 20px; font-weight: 700; color: #ea580c;"">{{{{ company.name | default: 'Your Company' }}}}</span>
        </td>
    </tr>
    <tr>
        <td style=""padding: 32px 40px;"">
            <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" width=""100%"">
{bodyContent}
            </table>
        </td>
    </tr>
    <tr>
        <td style=""padding: 24px 40px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #a1a1aa; text-align: center;"">
            Sent via GlobCRM
        </td>
    </tr>
</table>
</td>
</tr>
</table>
</body>
</html>";
    }

    private static string BuildWelcomeEmailHtml()
    {
        return BuildEmailWrapper(@"
                <tr>
                    <td style=""font-size: 18px; font-weight: 600; color: #18181b; padding-bottom: 16px;"">
                        Welcome!
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        Hi {{ contact.first_name | default: 'there' }},
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        Thank you for connecting with us! We're excited to have you on board and look forward to working together.
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 24px;"">
                        If you have any questions or need assistance getting started, don't hesitate to reach out. Our team is here to help you every step of the way.
                    </td>
                </tr>
                <tr>
                    <td>
                        <a href=""#"" style=""display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;"">
                            Get Started
                        </a>
                    </td>
                </tr>");
    }

    private static string BuildFollowUpEmailHtml()
    {
        return BuildEmailWrapper(@"
                <tr>
                    <td style=""font-size: 18px; font-weight: 600; color: #18181b; padding-bottom: 16px;"">
                        Following Up
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        Hi {{ contact.first_name | default: 'there' }},
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        I wanted to follow up on our recent conversation. It was great learning about your needs and I believe we can provide significant value to your team.
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        <strong>Next steps:</strong>
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.8; padding-bottom: 24px;"">
                        1. Review the proposal we discussed<br>
                        2. Schedule a follow-up call to address any questions<br>
                        3. Finalize the timeline for implementation
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6;"">
                        Looking forward to hearing from you!
                    </td>
                </tr>");
    }

    private static string BuildMeetingRequestEmailHtml()
    {
        return BuildEmailWrapper(@"
                <tr>
                    <td style=""font-size: 18px; font-weight: 600; color: #18181b; padding-bottom: 16px;"">
                        Let's Connect
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        Hi {{ contact.first_name | default: 'there' }},
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        I'd love to schedule a meeting to discuss {{ deal.title | default: 'our upcoming project' }} in more detail. I have some ideas that I think could be really valuable for your team.
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 24px;"">
                        Would any of these times work for you this week? I'm flexible and happy to work around your schedule.
                    </td>
                </tr>
                <tr>
                    <td>
                        <a href=""#"" style=""display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;"">
                            Schedule Meeting
                        </a>
                    </td>
                </tr>");
    }

    private static string BuildDealWonEmailHtml()
    {
        return BuildEmailWrapper(@"
                <tr>
                    <td style=""font-size: 18px; font-weight: 600; color: #18181b; padding-bottom: 16px;"">
                        Congratulations!
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        Hi {{ contact.first_name | default: 'there' }},
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        We're thrilled to officially welcome you as a partner! The {{ deal.title | default: 'deal' }} is now finalized and we're ready to get started.
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        <strong>Deal summary:</strong><br>
                        Deal: {{ deal.title | default: 'N/A' }}<br>
                        Value: ${{ deal.value | default: '0' }}
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 24px;"">
                        Our onboarding team will reach out shortly to schedule the kickoff and ensure a smooth transition. We're committed to making this a success!
                    </td>
                </tr>
                <tr>
                    <td>
                        <a href=""#"" style=""display: inline-block; background-color: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;"">
                            View Onboarding Guide
                        </a>
                    </td>
                </tr>");
    }

    private static string BuildSupportFollowUpEmailHtml()
    {
        return BuildEmailWrapper(@"
                <tr>
                    <td style=""font-size: 18px; font-weight: 600; color: #18181b; padding-bottom: 16px;"">
                        How Was Your Experience?
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        Hi {{ contact.first_name | default: 'there' }},
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 16px;"">
                        We recently assisted you with a support request and wanted to check in. Your satisfaction is important to us and we'd love to hear your feedback.
                    </td>
                </tr>
                <tr>
                    <td style=""font-size: 14px; color: #3f3f46; line-height: 1.6; padding-bottom: 24px;"">
                        If there's anything else we can help with, please don't hesitate to reach out. Our support team is always here for you.
                    </td>
                </tr>
                <tr>
                    <td>
                        <a href=""#"" style=""display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;"">
                            Share Feedback
                        </a>
                    </td>
                </tr>");
    }

    /// <summary>
    /// Creates the default seed data manifest for new organizations.
    /// </summary>
    private static SeedManifest CreateSeedManifest()
    {
        return new SeedManifest
        {
            Pipeline = new PipelineSeed
            {
                Name = "Sales Pipeline",
                Stages =
                [
                    new PipelineStageSeed { Name = "Lead", Order = 1, Color = "#90caf9", DefaultProbability = 0.10m },
                    new PipelineStageSeed { Name = "Qualified", Order = 2, Color = "#42a5f5", DefaultProbability = 0.25m },
                    new PipelineStageSeed { Name = "Proposal", Order = 3, Color = "#1976d2", DefaultProbability = 0.50m },
                    new PipelineStageSeed { Name = "Negotiation", Order = 4, Color = "#1565c0", DefaultProbability = 0.75m },
                    new PipelineStageSeed { Name = "Closed Won", Order = 5, Color = "#00897b", DefaultProbability = 1.00m, IsWon = true },
                    new PipelineStageSeed { Name = "Closed Lost", Order = 6, Color = "#ef5350", DefaultProbability = 0.00m, IsLost = true }
                ]
            },
            Companies =
            [
                new CompanySeed { Name = "TechVision Inc.", Industry = "Technology", Website = "https://techvision-example.com", Size = "51-200", Phone = "+1-555-0101", Email = "info@techvision-example.com", City = "San Francisco", Country = "USA", Description = "Enterprise software solutions provider specializing in AI-powered business tools.", CreatedDaysAgo = -30 },
                new CompanySeed { Name = "CloudScale Solutions", Industry = "Cloud Services", Website = "https://cloudscale-example.com", Size = "11-50", Phone = "+1-555-0102", Email = "hello@cloudscale-example.com", City = "Seattle", Country = "USA", Description = "Cloud infrastructure and DevOps consulting for growing startups.", CreatedDaysAgo = -25 },
                new CompanySeed { Name = "Global Logistics Corp", Industry = "Transportation", Website = "https://globallogistics-example.com", Size = "201-500", Phone = "+44-20-5550103", Email = "sales@globallogistics-example.com", City = "London", Country = "UK", Description = "International freight and supply chain management with real-time tracking.", CreatedDaysAgo = -20 },
                new CompanySeed { Name = "Meridian Healthcare", Industry = "Healthcare", Website = "https://meridianhc-example.com", Size = "500+", Phone = "+1-555-0104", Email = "partnerships@meridianhc-example.com", City = "Boston", Country = "USA", Description = "Leading provider of electronic health records and telehealth solutions.", CreatedDaysAgo = -18 },
                new CompanySeed { Name = "Alpine Digital Agency", Industry = "Marketing", Website = "https://alpinedigital-example.com", Size = "1-10", Phone = "+41-44-5550105", Email = "team@alpinedigital-example.com", City = "Zurich", Country = "Switzerland", Description = "Boutique digital marketing agency specializing in B2B tech companies.", CreatedDaysAgo = -15 },
                new CompanySeed { Name = "Quantum Financial Services", Industry = "Finance", Website = "https://quantumfs-example.com", Size = "51-200", Phone = "+1-555-0106", Email = "info@quantumfs-example.com", City = "New York", Country = "USA", Description = "Fintech company offering algorithmic trading and portfolio management platforms.", CreatedDaysAgo = -12 },
                new CompanySeed { Name = "GreenLeaf Organics", Industry = "Agriculture", Website = "https://greenleaf-example.com", Size = "11-50", Phone = "+1-555-0107", Email = "farm@greenleaf-example.com", City = "Portland", Country = "USA", Description = "Organic food distributor connecting local farms to urban retailers.", CreatedDaysAgo = -10 },
                new CompanySeed { Name = "Nova Robotics Ltd", Industry = "Manufacturing", Website = "https://novarobotics-example.com", Size = "201-500", Phone = "+81-3-5550108", Email = "business@novarobotics-example.com", City = "Tokyo", Country = "Japan", Description = "Industrial robotics and factory automation solutions for manufacturing.", CreatedDaysAgo = -8 },
            ],
            Contacts =
            [
                // TechVision Inc.
                new ContactSeed { FirstName = "Sarah", LastName = "Chen", Email = "sarah.chen@example.com", Title = "CEO", Department = "Executive", Phone = "+1-555-1001", CompanyRef = "TechVision Inc.", CreatedDaysAgo = -28 },
                new ContactSeed { FirstName = "Marcus", LastName = "Rivera", Email = "marcus.r@example.com", Title = "Sales Manager", Department = "Sales", Phone = "+1-555-1002", CompanyRef = "TechVision Inc.", CreatedDaysAgo = -28 },
                new ContactSeed { FirstName = "Elena", LastName = "Kowalski", Email = "elena.k@example.com", Title = "Support Manager", Department = "Support", Phone = "+1-555-1003", CompanyRef = "TechVision Inc.", CreatedDaysAgo = -25 },
                // CloudScale Solutions
                new ContactSeed { FirstName = "Aisha", LastName = "Patel", Email = "aisha.patel@example.com", Title = "Lead Developer", Department = "Engineering", Phone = "+1-555-1004", CompanyRef = "CloudScale Solutions", CreatedDaysAgo = -24 },
                new ContactSeed { FirstName = "James", LastName = "Thompson", Email = "james.t@example.com", Title = "Marketing Lead", Department = "Marketing", Phone = "+1-555-1005", CompanyRef = "CloudScale Solutions", CreatedDaysAgo = -22 },
                // Global Logistics Corp
                new ContactSeed { FirstName = "Thomas", LastName = "Wright", Email = "thomas.wright@example.com", Title = "CTO", Department = "Technology", Phone = "+44-20-5551006", CompanyRef = "Global Logistics Corp", CreatedDaysAgo = -19 },
                new ContactSeed { FirstName = "Lisa", LastName = "Nakamura", Email = "lisa.nakamura@example.com", Title = "Operations Director", Department = "Operations", Phone = "+44-20-5551007", CompanyRef = "Global Logistics Corp", CreatedDaysAgo = -18 },
                // Meridian Healthcare
                new ContactSeed { FirstName = "David", LastName = "Kim", Email = "david.kim@example.com", Title = "VP of Partnerships", Department = "Business Development", Phone = "+1-555-1008", CompanyRef = "Meridian Healthcare", CreatedDaysAgo = -16 },
                // Alpine Digital Agency
                new ContactSeed { FirstName = "Nina", LastName = "Johansson", Email = "nina.johansson@example.com", Title = "Creative Director", Department = "Creative", Phone = "+41-44-5551009", CompanyRef = "Alpine Digital Agency", CreatedDaysAgo = -14 },
                // Quantum Financial Services
                new ContactSeed { FirstName = "Priya", LastName = "Sharma", Email = "priya.sharma@example.com", Title = "Head of Product", Department = "Product", Phone = "+1-555-1010", CompanyRef = "Quantum Financial Services", CreatedDaysAgo = -11 },
                new ContactSeed { FirstName = "Robert", LastName = "Chang", Email = "robert.chang@example.com", Title = "Risk Analyst", Department = "Risk Management", Phone = "+1-555-1011", CompanyRef = "Quantum Financial Services", CreatedDaysAgo = -10 },
                // GreenLeaf Organics
                new ContactSeed { FirstName = "Carlos", LastName = "Mendez", Email = "carlos.mendez@example.com", Title = "Co-Founder", Department = "Executive", Phone = "+1-555-1012", CompanyRef = "GreenLeaf Organics", CreatedDaysAgo = -9 },
                // Nova Robotics Ltd
                new ContactSeed { FirstName = "Yuki", LastName = "Tanaka", Email = "yuki.tanaka@example.com", Title = "Engineering Manager", Department = "Engineering", Phone = "+81-3-5551013", CompanyRef = "Nova Robotics Ltd", CreatedDaysAgo = -7 },
                new ContactSeed { FirstName = "Kenji", LastName = "Watanabe", Email = "kenji.watanabe@example.com", Title = "Sales Director", Department = "Sales", Phone = "+81-3-5551014", CompanyRef = "Nova Robotics Ltd", CreatedDaysAgo = -6 },
                // Unaffiliated
                new ContactSeed { FirstName = "Sophie", LastName = "Laurent", Email = "sophie.laurent@example.com", Title = "Freelance Consultant", Department = "", Phone = "+33-1-5551015", CompanyRef = "", CreatedDaysAgo = -5 },
            ],
            Products =
            [
                new ProductSeed { Name = "CRM Enterprise License", Description = "Annual enterprise license with unlimited users", UnitPrice = 499.99m, SKU = "CRM-ENT-001", Category = "Software" },
                new ProductSeed { Name = "Premium Support", Description = "24/7 premium support package with dedicated account manager", UnitPrice = 99.99m, SKU = "SUP-PREM-001", Category = "Support" },
                new ProductSeed { Name = "Data Migration Service", Description = "One-time data migration from legacy CRM systems", UnitPrice = 1500.00m, SKU = "SVC-MIG-001", Category = "Services" },
                new ProductSeed { Name = "API Integration Package", Description = "Custom API integration setup and configuration", UnitPrice = 2500.00m, SKU = "SVC-API-001", Category = "Services" },
                new ProductSeed { Name = "CRM Professional License", Description = "Annual professional license for up to 25 users", UnitPrice = 249.99m, SKU = "CRM-PRO-001", Category = "Software" },
                new ProductSeed { Name = "Training Workshop", Description = "Half-day training workshop for team onboarding (up to 15 people)", UnitPrice = 800.00m, SKU = "SVC-TRN-001", Category = "Services" },
                new ProductSeed { Name = "Analytics Add-on", Description = "Advanced analytics and reporting module", UnitPrice = 149.99m, SKU = "ADD-ANL-001", Category = "Software" },
                new ProductSeed { Name = "Mobile App License", Description = "Native mobile app access for iOS and Android", UnitPrice = 49.99m, SKU = "ADD-MOB-001", Category = "Software" },
            ],
            Deals =
            [
                new DealSeed { Title = "Enterprise CRM License", Value = 25000.00m, Stage = "Proposal", CompanyRef = "TechVision Inc.", Description = "10-seat enterprise CRM deployment with custom integrations", ExpectedCloseDaysFromNow = 30, CreatedDaysAgo = -14 },
                new DealSeed { Title = "Cloud Migration Project", Value = 42000.00m, Stage = "Negotiation", CompanyRef = "CloudScale Solutions", Description = "Full cloud migration including data transfer and training", ExpectedCloseDaysFromNow = 15, CreatedDaysAgo = -20 },
                new DealSeed { Title = "Logistics Platform Integration", Value = 18500.00m, Stage = "Qualified", CompanyRef = "Global Logistics Corp", Description = "API integration with existing logistics management platform", ExpectedCloseDaysFromNow = 45, CreatedDaysAgo = -12 },
                new DealSeed { Title = "Healthcare Data Analytics", Value = 55000.00m, Stage = "Lead", CompanyRef = "Meridian Healthcare", Description = "HIPAA-compliant analytics dashboard for patient data insights", ExpectedCloseDaysFromNow = 60, CreatedDaysAgo = -8 },
                new DealSeed { Title = "Digital Marketing Suite", Value = 8500.00m, Stage = "Closed Won", CompanyRef = "Alpine Digital Agency", Description = "CRM Professional + Analytics for marketing team", ExpectedCloseDaysFromNow = -5, CreatedDaysAgo = -25 },
                new DealSeed { Title = "Financial Analytics Platform", Value = 38000.00m, Stage = "Proposal", CompanyRef = "Quantum Financial Services", Description = "Custom analytics platform with real-time market data feeds", ExpectedCloseDaysFromNow = 35, CreatedDaysAgo = -10 },
                new DealSeed { Title = "Farm-to-Table Tracking", Value = 12000.00m, Stage = "Lead", CompanyRef = "GreenLeaf Organics", Description = "Supply chain tracking system for organic produce distribution", ExpectedCloseDaysFromNow = 50, CreatedDaysAgo = -6 },
                new DealSeed { Title = "Robotics Fleet Management", Value = 67000.00m, Stage = "Closed Lost", CompanyRef = "Nova Robotics Ltd", Description = "IoT-based fleet management for factory robots (lost to competitor)", ExpectedCloseDaysFromNow = -10, CreatedDaysAgo = -30 },
            ],
            Activities =
            [
                new ActivitySeed { Subject = "Follow up with TechVision on CRM proposal", Type = "Task", Status = "Assigned", Priority = "High", DueDateOffset = 3, Description = "Send updated pricing and feature comparison document", CreatedDaysAgo = -2 },
                new ActivitySeed { Subject = "Quarterly review call with CloudScale", Type = "Call", Status = "InProgress", Priority = "Medium", DueDateOffset = 1, Description = "Discuss Q3 metrics, usage trends, and renewal timeline", CreatedDaysAgo = -5 },
                new ActivitySeed { Subject = "Product demo for Meridian Healthcare", Type = "Meeting", Status = "Accepted", Priority = "High", DueDateOffset = 7, Description = "Full platform demo focusing on HIPAA compliance features", CreatedDaysAgo = -3 },
                new ActivitySeed { Subject = "Prepare proposal document for Quantum", Type = "Task", Status = "Review", Priority = "Medium", DueDateOffset = -1, Description = "Draft proposal including analytics platform specs and pricing", CreatedDaysAgo = -4 },
                new ActivitySeed { Subject = "Send contract to Global Logistics", Type = "Task", Status = "Assigned", Priority = "High", DueDateOffset = 2, Description = "Finalize contract terms and send for legal review", CreatedDaysAgo = -1 },
                new ActivitySeed { Subject = "Onboarding call with David Kim", Type = "Call", Status = "Assigned", Priority = "Urgent", DueDateOffset = 0, Description = "Walk through platform setup and admin configuration", CreatedDaysAgo = -1 },
                new ActivitySeed { Subject = "Update CRM records for Q3 pipeline", Type = "Task", Status = "Done", Priority = "Low", DueDateOffset = -3, Description = "Cleaned up stale leads and updated deal stages", CreatedDaysAgo = -7 },
                new ActivitySeed { Subject = "Strategy meeting for Nova Robotics deal", Type = "Meeting", Status = "Done", Priority = "Medium", DueDateOffset = -5, Description = "Reviewed competitive analysis and pricing strategy", CreatedDaysAgo = -10 },
                new ActivitySeed { Subject = "Follow up on Alpine contract signing", Type = "Task", Status = "Done", Priority = "Medium", DueDateOffset = -7, Description = "Contract signed and countersigned, deal closed won", CreatedDaysAgo = -12 },
                new ActivitySeed { Subject = "Marketing campaign review with Nina", Type = "Call", Status = "Accepted", Priority = "Low", DueDateOffset = 5, Description = "Review campaign performance metrics and plan Q4 strategy", CreatedDaysAgo = -2 },
                new ActivitySeed { Subject = "Technical architecture review", Type = "Meeting", Status = "Assigned", Priority = "High", DueDateOffset = 4, Description = "Review API integration architecture for logistics platform", CreatedDaysAgo = -1 },
                new ActivitySeed { Subject = "Prepare training materials for GreenLeaf", Type = "Task", Status = "InProgress", Priority = "Medium", DueDateOffset = 6, Description = "Create onboarding guide and video tutorials for organic tracking module", CreatedDaysAgo = -3 },
                new ActivitySeed { Subject = "Security assessment follow-up", Type = "Task", Status = "Assigned", Priority = "High", DueDateOffset = 2, Description = "Address findings from Quantum Financial security review", CreatedDaysAgo = -2 },
                new ActivitySeed { Subject = "Customer success check-in with Sophie", Type = "Call", Status = "Assigned", Priority = "Low", DueDateOffset = 8, Description = "Monthly check-in on consulting engagement satisfaction", CreatedDaysAgo = 0 },
                new ActivitySeed { Subject = "Sprint planning for Q4 features", Type = "Meeting", Status = "Accepted", Priority = "Medium", DueDateOffset = 3, Description = "Plan Q4 product features based on customer feedback and roadmap priorities", CreatedDaysAgo = -1 },
            ]
        };
    }
    /// <summary>
    /// Seeds 3 report categories and 6 starter reports demonstrating all chart types
    /// and common reporting patterns (deals by stage, revenue by month, etc.).
    /// </summary>
    private async Task SeedReportsAsync(Guid organizationId)
    {
        // ── Categories ──────────────────────────────────────────
        var salesCategory = new ReportCategory
        {
            TenantId = organizationId,
            Name = "Sales Reports",
            Description = "Revenue, deal, and sales performance reports",
            SortOrder = 1,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var pipelineCategory = new ReportCategory
        {
            TenantId = organizationId,
            Name = "Pipeline Analysis",
            Description = "Deal pipeline funnel and stage analysis reports",
            SortOrder = 2,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var teamCategory = new ReportCategory
        {
            TenantId = organizationId,
            Name = "Team Performance",
            Description = "Team activity and performance tracking reports",
            SortOrder = 3,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.ReportCategories.AddRange(salesCategory, pipelineCategory, teamCategory);

        // ── Report 1: Deals by Stage (Funnel) ──────────────────
        _db.Reports.Add(new Report
        {
            TenantId = organizationId,
            Name = "Deals by Stage",
            Description = "Funnel visualization of deal count and total value grouped by pipeline stage.",
            EntityType = "Deal",
            ChartType = ReportChartType.Funnel,
            CategoryId = pipelineCategory.Id,
            IsShared = true,
            IsSeedData = true,
            Definition = new ReportDefinition
            {
                Fields =
                [
                    new ReportField { FieldId = "related.Stage.name", Label = "Stage", FieldType = "related", SortOrder = 0 },
                    new ReportField { FieldId = "id", Label = "Count", FieldType = "system", Aggregation = AggregationType.Count, SortOrder = 1 },
                    new ReportField { FieldId = "value", Label = "Total Value", FieldType = "system", Aggregation = AggregationType.Sum, SortOrder = 2 }
                ],
                FilterGroup = null,
                Groupings =
                [
                    new ReportGrouping { FieldId = "related.Stage.name" }
                ],
                ChartConfig = new ReportChartConfig
                {
                    ChartType = ReportChartType.Funnel,
                    ShowLegend = true,
                    ShowDataLabels = true
                }
            },
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // ── Report 2: Revenue by Month (Bar) ───────────────────
        _db.Reports.Add(new Report
        {
            TenantId = organizationId,
            Name = "Revenue by Month",
            Description = "Monthly revenue trend showing deal value and count over time.",
            EntityType = "Deal",
            ChartType = ReportChartType.Bar,
            CategoryId = salesCategory.Id,
            IsShared = true,
            IsSeedData = true,
            Definition = new ReportDefinition
            {
                Fields =
                [
                    new ReportField { FieldId = "createdAt", Label = "Month", FieldType = "system", SortOrder = 0 },
                    new ReportField { FieldId = "value", Label = "Total Value", FieldType = "system", Aggregation = AggregationType.Sum, SortOrder = 1 },
                    new ReportField { FieldId = "id", Label = "Count", FieldType = "system", Aggregation = AggregationType.Count, SortOrder = 2 }
                ],
                FilterGroup = null,
                Groupings =
                [
                    new ReportGrouping { FieldId = "createdAt", DateTruncation = "month" }
                ],
                ChartConfig = new ReportChartConfig
                {
                    ChartType = ReportChartType.Bar,
                    ShowLegend = true,
                    ShowDataLabels = false
                }
            },
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // ── Report 3: Contacts by Company Industry (Pie) ───────
        _db.Reports.Add(new Report
        {
            TenantId = organizationId,
            Name = "Contacts by Company Industry",
            Description = "Distribution of contacts across company industries.",
            EntityType = "Contact",
            ChartType = ReportChartType.Pie,
            CategoryId = salesCategory.Id,
            IsShared = true,
            IsSeedData = true,
            Definition = new ReportDefinition
            {
                Fields =
                [
                    new ReportField { FieldId = "related.Company.industry", Label = "Industry", FieldType = "related", SortOrder = 0 },
                    new ReportField { FieldId = "id", Label = "Count", FieldType = "system", Aggregation = AggregationType.Count, SortOrder = 1 }
                ],
                FilterGroup = null,
                Groupings =
                [
                    new ReportGrouping { FieldId = "related.Company.industry" }
                ],
                ChartConfig = new ReportChartConfig
                {
                    ChartType = ReportChartType.Pie,
                    ShowLegend = true,
                    ShowDataLabels = true
                }
            },
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // ── Report 4: Activities This Week (Bar) ───────────────
        _db.Reports.Add(new Report
        {
            TenantId = organizationId,
            Name = "Activities This Week",
            Description = "Breakdown of activities by status for the current week.",
            EntityType = "Activity",
            ChartType = ReportChartType.Bar,
            CategoryId = teamCategory.Id,
            IsShared = true,
            IsSeedData = true,
            Definition = new ReportDefinition
            {
                Fields =
                [
                    new ReportField { FieldId = "status", Label = "Status", FieldType = "system", SortOrder = 0 },
                    new ReportField { FieldId = "id", Label = "Count", FieldType = "system", Aggregation = AggregationType.Count, SortOrder = 1 }
                ],
                FilterGroup = new ReportFilterGroup
                {
                    Logic = FilterLogic.And,
                    Conditions =
                    [
                        new ReportFilterCondition
                        {
                            FieldId = "dueDate",
                            Operator = "greater_than_or_equal",
                            Value = DateTimeOffset.UtcNow.AddDays(-(int)DateTimeOffset.UtcNow.DayOfWeek).Date.ToString("o")
                        }
                    ],
                    Groups = []
                },
                Groupings =
                [
                    new ReportGrouping { FieldId = "status" }
                ],
                ChartConfig = new ReportChartConfig
                {
                    ChartType = ReportChartType.Bar,
                    ShowLegend = true,
                    ShowDataLabels = true
                }
            },
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // ── Report 5: Quotes by Status (Pie) ──────────────────
        _db.Reports.Add(new Report
        {
            TenantId = organizationId,
            Name = "Quotes by Status",
            Description = "Quote distribution by status with total amounts.",
            EntityType = "Quote",
            ChartType = ReportChartType.Pie,
            CategoryId = salesCategory.Id,
            IsShared = true,
            IsSeedData = true,
            Definition = new ReportDefinition
            {
                Fields =
                [
                    new ReportField { FieldId = "status", Label = "Status", FieldType = "system", SortOrder = 0 },
                    new ReportField { FieldId = "id", Label = "Count", FieldType = "system", Aggregation = AggregationType.Count, SortOrder = 1 },
                    new ReportField { FieldId = "totalAmount", Label = "Total Amount", FieldType = "system", Aggregation = AggregationType.Sum, SortOrder = 2 }
                ],
                FilterGroup = null,
                Groupings =
                [
                    new ReportGrouping { FieldId = "status" }
                ],
                ChartConfig = new ReportChartConfig
                {
                    ChartType = ReportChartType.Pie,
                    ShowLegend = true,
                    ShowDataLabels = true
                }
            },
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        // ── Report 6: Top Deal Owners (Bar) ────────────────────
        _db.Reports.Add(new Report
        {
            TenantId = organizationId,
            Name = "Top Deal Owners",
            Description = "Deal count and total value grouped by deal owner.",
            EntityType = "Deal",
            ChartType = ReportChartType.Bar,
            CategoryId = teamCategory.Id,
            IsShared = true,
            IsSeedData = true,
            Definition = new ReportDefinition
            {
                Fields =
                [
                    new ReportField { FieldId = "related.Owner.lastName", Label = "Owner", FieldType = "related", SortOrder = 0 },
                    new ReportField { FieldId = "id", Label = "Count", FieldType = "system", Aggregation = AggregationType.Count, SortOrder = 1 },
                    new ReportField { FieldId = "value", Label = "Total Value", FieldType = "system", Aggregation = AggregationType.Sum, SortOrder = 2 }
                ],
                FilterGroup = null,
                Groupings =
                [
                    new ReportGrouping { FieldId = "related.Owner.lastName" }
                ],
                ChartConfig = new ReportChartConfig
                {
                    ChartType = ReportChartType.Bar,
                    ShowLegend = true,
                    ShowDataLabels = false
                }
            },
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Report seed data created for organization {OrgId}: 3 categories, 6 starter reports",
            organizationId);
    }
}

#region Seed Manifest Models

public class SeedManifest
{
    public PipelineSeed Pipeline { get; set; } = new();
    public List<ContactSeed> Contacts { get; set; } = [];
    public List<CompanySeed> Companies { get; set; } = [];
    public List<ProductSeed> Products { get; set; } = [];
    public List<DealSeed> Deals { get; set; } = [];
    public List<ActivitySeed> Activities { get; set; } = [];
}

public class PipelineSeed
{
    public string Name { get; set; } = string.Empty;
    public List<PipelineStageSeed> Stages { get; set; } = [];
}

public class PipelineStageSeed
{
    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }
    public string Color { get; set; } = string.Empty;
    public decimal DefaultProbability { get; set; }
    public bool IsWon { get; set; }
    public bool IsLost { get; set; }
}

public class ContactSeed
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string CompanyRef { get; set; } = string.Empty;
    public int CreatedDaysAgo { get; set; }
}

public class CompanySeed
{
    public string Name { get; set; } = string.Empty;
    public string Industry { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int CreatedDaysAgo { get; set; }
}

public class ProductSeed
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}

public class DealSeed
{
    public string Title { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public string Stage { get; set; } = string.Empty;
    public string ContactRef { get; set; } = string.Empty;
    public string CompanyRef { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int ExpectedCloseDaysFromNow { get; set; }
    public int CreatedDaysAgo { get; set; }
}

public class ActivitySeed
{
    public string Subject { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public int DueDateOffset { get; set; }
    public string Description { get; set; } = string.Empty;
    public int CreatedDaysAgo { get; set; }
}

#endregion
