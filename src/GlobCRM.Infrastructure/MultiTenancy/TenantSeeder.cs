using System.Text.Json;
using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.MultiTenancy;

/// <summary>
/// Seeds initial data for newly created organizations.
/// Creates Company, Contact, Product, Pipeline, PipelineStage, Deal, Activity, Quote, Request, and Note entities from a seed manifest.
/// </summary>
public class TenantSeeder : ITenantSeeder
{
    private readonly IOrganizationRepository _organizationRepository;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<TenantSeeder> _logger;

    public TenantSeeder(
        IOrganizationRepository organizationRepository,
        ApplicationDbContext db,
        ILogger<TenantSeeder> logger)
    {
        _organizationRepository = organizationRepository;
        _db = db;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task ReseedOrganizationDataAsync(Guid organizationId)
    {
        _logger.LogInformation("Clearing seed data for organization {OrgId}", organizationId);

        // Delete in reverse dependency order to avoid FK violations
        // Child records first, then parent records

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
            // Check if any non-seed deals reference this pipeline
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

        var seedManifest = CreateSeedManifest();

        _logger.LogInformation(
            "Seed manifest created for organization {OrgId}: {CompanyCount} companies, {ContactCount} contacts, {ProductCount} products, {DealCount} deals, {ActivityCount} activities",
            organizationId,
            seedManifest.Companies.Count,
            seedManifest.Contacts.Count,
            seedManifest.Products.Count,
            seedManifest.Deals.Count,
            seedManifest.Activities.Count);

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

        // ── Deals ────────────────────────────────────────────────
        var dealMap = new Dictionary<string, Deal>();
        var dealOffset = 0;
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
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(dealSeed.CreatedDaysAgo),
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Deals.Add(deal);
            dealMap[dealSeed.Title] = deal;
            dealOffset++;
        }

        // ── Activities ───────────────────────────────────────────
        var activityList = new List<Activity>();
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
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(activitySeed.CreatedDaysAgo),
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Activities.Add(activity);
            activityList.Add(activity);
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

        // Link activities to various entities
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

        // ── Activity Comments ────────────────────────────────────
        if (activityList.Count >= 2)
        {
            _db.ActivityComments.Add(new ActivityComment
            {
                ActivityId = activityList[0].Id,
                Content = "Initial contact made, they seem interested in the enterprise plan",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-48),
                UpdatedAt = DateTimeOffset.UtcNow.AddHours(-48)
            });
            _db.ActivityComments.Add(new ActivityComment
            {
                ActivityId = activityList[0].Id,
                Content = "Sent follow-up email with pricing details and case studies",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-24),
                UpdatedAt = DateTimeOffset.UtcNow.AddHours(-24)
            });
            _db.ActivityComments.Add(new ActivityComment
            {
                ActivityId = activityList[1].Id,
                Content = "Discussed Q3 metrics, customer is satisfied with growth trends",
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

        // Quote 1: Website Redesign Proposal - Draft
        var q1 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0001",
            Title = "Website Redesign Proposal",
            Description = "Complete website redesign including UX research, frontend development, and QA testing.",
            Status = QuoteStatus.Draft, IssueDate = seedDate, ExpiryDate = seedDate.AddDays(30),
            VersionNumber = 1,
            CompanyId = companyMap.GetValueOrDefault("TechVision Inc.")?.Id,
            ContactId = contactMap.GetValueOrDefault("sarah.chen@example.com")?.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        };
        AddQuoteWithLines(q1,
            CreateLineItem(q1.Id, "UI/UX Design", 1, 1m, 5000m, 0m, 10m),
            CreateLineItem(q1.Id, "Frontend Development", 2, 80m, 150m, 5m, 10m),
            CreateLineItem(q1.Id, "QA Testing", 3, 20m, 100m, 0m, 10m));

        // Quote 2: Annual Support Contract - Sent
        var q2 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0002",
            Title = "Annual Support Contract",
            Description = "24/7 premium support with dedicated account manager for one year.",
            Status = QuoteStatus.Sent, IssueDate = seedDate.AddDays(-5), ExpiryDate = seedDate.AddDays(25),
            VersionNumber = 1,
            CompanyId = companyMap.GetValueOrDefault("CloudScale Solutions")?.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-5), UpdatedAt = DateTimeOffset.UtcNow.AddDays(-3)
        };
        AddQuoteWithLines(q2,
            CreateLineItem(q2.Id, "Premium Support (Annual)", 1, 12m, 99.99m, 10m, 10m),
            CreateLineItem(q2.Id, "Dedicated Account Manager", 2, 1m, 2400m, 0m, 10m));
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q2.Id, FromStatus = QuoteStatus.Draft, ToStatus = QuoteStatus.Sent, ChangedAt = DateTimeOffset.UtcNow.AddDays(-3) });

        // Quote 3: Product Bundle Offer - Accepted
        var q3 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0003",
            Title = "Product Bundle Offer",
            Description = "Enterprise license bundle with premium support at special pricing.",
            Status = QuoteStatus.Accepted, IssueDate = seedDate.AddDays(-10), ExpiryDate = seedDate.AddDays(20),
            VersionNumber = 1,
            DealId = dealMap.GetValueOrDefault("Enterprise CRM License")?.Id,
            CompanyId = companyMap.GetValueOrDefault("TechVision Inc.")?.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-10), UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2)
        };
        AddQuoteWithLines(q3,
            CreateLineItem(q3.Id, "CRM Enterprise License", 1, 10m, 499.99m, 15m, 10m, productMap.GetValueOrDefault("CRM Enterprise License")?.Id),
            CreateLineItem(q3.Id, "Premium Support", 2, 10m, 99.99m, 10m, 10m, productMap.GetValueOrDefault("Premium Support")?.Id));
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q3.Id, FromStatus = QuoteStatus.Draft, ToStatus = QuoteStatus.Sent, ChangedAt = DateTimeOffset.UtcNow.AddDays(-7) });
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q3.Id, FromStatus = QuoteStatus.Sent, ToStatus = QuoteStatus.Accepted, ChangedAt = DateTimeOffset.UtcNow.AddDays(-2) });

        // Quote 4: Healthcare Data Platform - Sent
        var q4 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0004",
            Title = "Healthcare Data Platform License",
            Description = "Enterprise data analytics platform tailored for healthcare compliance needs.",
            Status = QuoteStatus.Sent, IssueDate = seedDate.AddDays(-3), ExpiryDate = seedDate.AddDays(27),
            VersionNumber = 1,
            CompanyId = companyMap.GetValueOrDefault("Meridian Healthcare")?.Id,
            ContactId = contactMap.GetValueOrDefault("david.kim@example.com")?.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-3), UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        AddQuoteWithLines(q4,
            CreateLineItem(q4.Id, "Data Analytics Platform (Annual)", 1, 1m, 18000m, 5m, 10m),
            CreateLineItem(q4.Id, "HIPAA Compliance Module", 2, 1m, 4500m, 0m, 10m),
            CreateLineItem(q4.Id, "Training & Onboarding", 3, 3m, 800m, 0m, 10m));
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q4.Id, FromStatus = QuoteStatus.Draft, ToStatus = QuoteStatus.Sent, ChangedAt = DateTimeOffset.UtcNow.AddDays(-1) });

        // Quote 5: Robotics Automation Package - Rejected
        var q5 = new Quote
        {
            TenantId = organizationId, QuoteNumber = "Q-0005",
            Title = "Robotics Automation Package",
            Description = "Factory floor automation software suite with IoT integration.",
            Status = QuoteStatus.Rejected, IssueDate = seedDate.AddDays(-15), ExpiryDate = seedDate.AddDays(15),
            VersionNumber = 1,
            CompanyId = companyMap.GetValueOrDefault("Nova Robotics Ltd")?.Id,
            IsSeedData = true, CreatedAt = DateTimeOffset.UtcNow.AddDays(-15), UpdatedAt = DateTimeOffset.UtcNow.AddDays(-5)
        };
        AddQuoteWithLines(q5,
            CreateLineItem(q5.Id, "Automation Suite License", 1, 5m, 3200m, 0m, 10m),
            CreateLineItem(q5.Id, "IoT Sensor Integration", 2, 20m, 150m, 10m, 10m));
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q5.Id, FromStatus = QuoteStatus.Draft, ToStatus = QuoteStatus.Sent, ChangedAt = DateTimeOffset.UtcNow.AddDays(-12) });
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory { QuoteId = q5.Id, FromStatus = QuoteStatus.Sent, ToStatus = QuoteStatus.Rejected, ChangedAt = DateTimeOffset.UtcNow.AddDays(-5) });

        // ── Requests ─────────────────────────────────────────────
        var requests = new List<(string Subject, string Desc, RequestStatus Status, RequestPriority Priority, string Category, string? ContactRef, string? CompanyRef, int DaysAgo)>
        {
            ("Login page not loading on mobile", "Users report the login page does not render properly on mobile Safari and Chrome. White screen after splash.", RequestStatus.New, RequestPriority.High, "Bug", "sarah.chen@example.com", "TechVision Inc.", 0),
            ("Need export to CSV feature", "Customer requests ability to export contact and deal lists to CSV for reporting purposes.", RequestStatus.InProgress, RequestPriority.Medium, "Feature", null, "TechVision Inc.", 2),
            ("Billing inquiry for Q3", "Customer has questions about Q3 invoice discrepancy. Resolved after review of payment records.", RequestStatus.Resolved, RequestPriority.Low, "Billing", "aisha.patel@example.com", "CloudScale Solutions", 5),
            ("API rate limiting too aggressive", "Integration partner reports 429 errors during batch sync operations. Need higher rate limits.", RequestStatus.New, RequestPriority.High, "Technical", "thomas.wright@example.com", "Global Logistics Corp", 1),
            ("Custom dashboard request", "Manager wants a custom dashboard view showing team pipeline metrics and conversion rates.", RequestStatus.InProgress, RequestPriority.Medium, "Feature", "david.kim@example.com", "Meridian Healthcare", 3),
            ("Password reset not sending email", "Multiple users report not receiving password reset emails. Checked spam folders.", RequestStatus.New, RequestPriority.Urgent, "Bug", "nina.johansson@example.com", "Alpine Digital Agency", 0),
            ("Data import from legacy system", "Need assistance importing 5000+ contacts from old CRM. Mapping fields to GlobCRM schema.", RequestStatus.InProgress, RequestPriority.Medium, "Technical", "priya.sharma@example.com", "Quantum Financial Services", 4),
            ("Onboarding training for new team", "New sales team of 8 members needs onboarding training session on CRM best practices.", RequestStatus.Closed, RequestPriority.Low, "General", "carlos.mendez@example.com", "GreenLeaf Organics", 10),
        };

        foreach (var (subject, desc, status, priority, category, contactRef, companyRef, daysAgo) in requests)
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
                ResolvedAt = status == RequestStatus.Resolved ? DateTimeOffset.UtcNow.AddHours(-3) : null,
                ClosedAt = status == RequestStatus.Closed ? DateTimeOffset.UtcNow.AddDays(-2) : null,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo / 2)
            });
        }

        // ── Notes ────────────────────────────────────────────────
        var notes = new List<(string Title, string Body, string EntityType, string EntityRef, int DaysAgo)>
        {
            ("Initial meeting notes", "<p>Met with <strong>Sarah Chen</strong> to discuss CRM requirements. Key points:</p><ul><li>Need for multi-user access with role-based permissions</li><li>Integration with existing email system is a must</li><li>Budget approved for Q2 implementation</li></ul><p>Follow-up scheduled for next week.</p>", "Company", "TechVision Inc.", 7),
            ("Technical requirements", "<p>Aisha outlined the following technical requirements for the CloudScale integration:</p><ol><li>REST API with OAuth 2.0 authentication</li><li>Webhook support for real-time events</li><li>Rate limiting: minimum 1000 req/min</li><li>Data export in JSON and CSV formats</li></ol><p><em>Priority: High</em></p>", "Company", "CloudScale Solutions", 5),
            ("Pricing discussion summary", "<p>Discussed pricing tiers with the procurement team. They're comparing us against two competitors.</p><p><strong>Our advantages:</strong></p><ul><li>Better customization options</li><li>Lower total cost of ownership over 3 years</li><li>Superior mobile experience</li></ul><p>Need to send formal proposal by <strong>Friday</strong>.</p>", "Deal", "Enterprise CRM License", 3),
            ("Healthcare compliance review", "<p>Completed initial compliance review for Meridian Healthcare integration:</p><ul><li>HIPAA BAA required before data exchange</li><li>All PHI must be encrypted at rest and in transit</li><li>Audit logging must capture all data access events</li><li>Data retention policy: 7 years minimum</li></ul><p>Legal team reviewing BAA template.</p>", "Company", "Meridian Healthcare", 4),
            ("Quarterly business review", "<p>Q3 business review with Global Logistics:</p><h3>Metrics</h3><ul><li>Usage up 23% quarter-over-quarter</li><li>User satisfaction score: 4.2/5</li><li>Support tickets down 15%</li></ul><h3>Action Items</h3><ol><li>Schedule advanced training for power users</li><li>Review API integration performance</li><li>Discuss renewal terms in Q4</li></ol>", "Company", "Global Logistics Corp", 2),
            ("Product demo feedback", "<p>Feedback from yesterday's product demo with the Alpine team:</p><p><strong>Positive:</strong></p><ul><li>Clean, modern interface</li><li>Drag-and-drop pipeline view was a hit</li><li>Reporting capabilities exceeded expectations</li></ul><p><strong>Concerns:</strong></p><ul><li>Would like more email template options</li><li>Asked about WhatsApp integration timeline</li></ul>", "Company", "Alpine Digital Agency", 1),
            ("Contract negotiation status", "<p>Current status of the Quantum Financial deal:</p><ul><li>Legal review: <strong>Complete</strong></li><li>Security assessment: <strong>In Progress</strong></li><li>Budget approval: <strong>Pending CFO sign-off</strong></li></ul><p>Expected close date: end of month. Deal value: $42,000/year.</p>", "Deal", "Financial Analytics Platform", 1),
            ("Organic certification integration", "<p>Notes from call with Carlos about organic certification tracking:</p><ul><li>Need to track certification expiry dates</li><li>Custom field for certification body (USDA, EU Organic, etc.)</li><li>Automated reminders 90 days before expiry</li><li>Document upload for certificate copies</li></ul><p>Will create custom fields in next sprint.</p>", "Company", "GreenLeaf Organics", 6),
        };

        foreach (var (title, body, entityType, entityRef, daysAgo) in notes)
        {
            Guid? entityId = null;
            string? entityName = entityRef;

            if (entityType == "Company" && companyMap.TryGetValue(entityRef, out var noteCompany))
                entityId = noteCompany.Id;
            else if (entityType == "Deal" && dealMap.TryGetValue(entityRef, out var noteDeal))
                entityId = noteDeal.Id;

            if (entityId.HasValue)
            {
                // Strip HTML tags for plain text
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
                    IsSeedData = true,
                    CreatedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo),
                    UpdatedAt = DateTimeOffset.UtcNow.AddDays(-daysAgo)
                });
            }
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Seed data created for organization {OrgId}: {CompanyCount} companies, {ContactCount} contacts, {ProductCount} products, 1 pipeline with {StageCount} stages, {DealCount} deals, {ActivityCount} activities, 5 quotes, {RequestCount} requests, {NoteCount} notes",
            organizationId,
            seedManifest.Companies.Count,
            seedManifest.Contacts.Count,
            seedManifest.Products.Count,
            seedManifest.Pipeline.Stages.Count,
            seedManifest.Deals.Count,
            seedManifest.Activities.Count,
            requests.Count,
            notes.Count);
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
