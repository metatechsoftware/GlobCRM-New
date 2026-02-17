using System.Text.Json;
using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.MultiTenancy;

/// <summary>
/// Seeds initial data for newly created organizations.
/// Creates Company, Contact, Product, Pipeline, PipelineStage, Deal, Activity, Quote, and Request entities from a seed manifest.
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

        // Create Company entities from manifest
        var companyMap = new Dictionary<string, Company>();
        foreach (var companySeed in seedManifest.Companies)
        {
            var company = new Company
            {
                TenantId = organizationId,
                Name = companySeed.Name,
                Industry = companySeed.Industry,
                Website = companySeed.Website,
                Size = companySeed.Size,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Companies.Add(company);
            companyMap[companySeed.Name] = company;
        }

        // Create Contact entities from manifest, linking to companies
        var contactMap = new Dictionary<string, Contact>();
        foreach (var contactSeed in seedManifest.Contacts)
        {
            var contact = new Contact
            {
                TenantId = organizationId,
                FirstName = contactSeed.FirstName,
                LastName = contactSeed.LastName,
                Email = contactSeed.Email,
                JobTitle = contactSeed.Title,
                CompanyId = companyMap.TryGetValue(contactSeed.CompanyRef, out var company)
                    ? company.Id
                    : null,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Contacts.Add(contact);
            contactMap[contactSeed.Email] = contact;
        }

        // Create Product entities from manifest
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

        // Create Pipeline entity from manifest
        var pipeline = new Pipeline
        {
            TenantId = organizationId,
            Name = seedManifest.Pipeline.Name,
            IsDefault = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _db.Pipelines.Add(pipeline);

        // Create PipelineStage entities from manifest
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

        // Create Deal entities from manifest
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
                ExpectedCloseDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30 + (dealOffset * 30))),
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Deals.Add(deal);
            dealMap[dealSeed.Title] = deal;
            dealOffset++;
        }

        // Create Activity entities from manifest (after deals, so we can link to seeded entities)
        var activityList = new List<Activity>();
        foreach (var activitySeed in seedManifest.Activities)
        {
            var activity = new Activity
            {
                TenantId = organizationId,
                Subject = activitySeed.Subject,
                Type = Enum.Parse<ActivityType>(activitySeed.Type),
                Status = Enum.Parse<ActivityStatus>(activitySeed.Status),
                Priority = Enum.Parse<ActivityPriority>(activitySeed.Priority),
                DueDate = DateTimeOffset.UtcNow.AddDays(activitySeed.DueDateOffset),
                CompletedAt = activitySeed.Status == "Done"
                    ? DateTimeOffset.UtcNow.AddDays(activitySeed.DueDateOffset)
                    : null,
                IsSeedData = true,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            _db.Activities.Add(activity);
            activityList.Add(activity);
        }

        // Create ActivityLink records linking activities to seeded entities
        var firstCompany = companyMap.GetValueOrDefault("TechVision Inc.");
        var firstContact = contactMap.GetValueOrDefault("sarah.chen@example.com");
        var firstDeal = dealMap.GetValueOrDefault("Enterprise CRM License");

        if (activityList.Count >= 3)
        {
            // Activity 1 linked to first company
            if (firstCompany != null)
            {
                _db.ActivityLinks.Add(new ActivityLink
                {
                    ActivityId = activityList[0].Id,
                    EntityType = "Company",
                    EntityId = firstCompany.Id,
                    EntityName = firstCompany.Name,
                    LinkedAt = DateTimeOffset.UtcNow
                });
            }

            // Activity 2 linked to first contact
            if (firstContact != null)
            {
                _db.ActivityLinks.Add(new ActivityLink
                {
                    ActivityId = activityList[1].Id,
                    EntityType = "Contact",
                    EntityId = firstContact.Id,
                    EntityName = $"{firstContact.FirstName} {firstContact.LastName}",
                    LinkedAt = DateTimeOffset.UtcNow
                });
            }

            // Activity 3 linked to first deal
            if (firstDeal != null)
            {
                _db.ActivityLinks.Add(new ActivityLink
                {
                    ActivityId = activityList[2].Id,
                    EntityType = "Deal",
                    EntityId = firstDeal.Id,
                    EntityName = firstDeal.Title,
                    LinkedAt = DateTimeOffset.UtcNow
                });
            }
        }

        // Create ActivityComment records on Activity 1
        if (activityList.Count >= 1)
        {
            _db.ActivityComments.Add(new ActivityComment
            {
                ActivityId = activityList[0].Id,
                Content = "Initial contact made, they seem interested",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-2),
                UpdatedAt = DateTimeOffset.UtcNow.AddHours(-2)
            });

            _db.ActivityComments.Add(new ActivityComment
            {
                ActivityId = activityList[0].Id,
                Content = "Sent follow-up email with pricing details",
                CreatedAt = DateTimeOffset.UtcNow.AddHours(-1),
                UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1)
            });
        }

        // Create ActivityTimeEntry on Activity 2
        if (activityList.Count >= 2)
        {
            _db.ActivityTimeEntries.Add(new ActivityTimeEntry
            {
                ActivityId = activityList[1].Id,
                DurationMinutes = 45,
                Description = "Reviewed quarterly metrics and prepared talking points",
                EntryDate = DateOnly.FromDateTime(DateTime.UtcNow),
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        // Create Quote entities with line items
        var seedDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var seedFirstCompany = companyMap.GetValueOrDefault("TechVision Inc.");
        var seedSecondCompany = companyMap.GetValueOrDefault("CloudScale Solutions");
        var seedFirstContact = contactMap.GetValueOrDefault("sarah.chen@example.com");
        var seedSecondContact = contactMap.GetValueOrDefault("aisha.patel@example.com");
        var seedFirstDeal = dealMap.GetValueOrDefault("Enterprise CRM License");
        var seedProduct1 = productMap.GetValueOrDefault("CRM Enterprise License");
        var seedProduct2 = productMap.GetValueOrDefault("Premium Support");

        // Helper: compute line item totals
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

        // Quote 1: "Website Redesign Proposal" -- Draft, linked to first company and contact
        var quote1 = new Quote
        {
            TenantId = organizationId,
            QuoteNumber = "Q-0001",
            Title = "Website Redesign Proposal",
            Description = "Complete website redesign including UX research, frontend development, and QA testing.",
            Status = QuoteStatus.Draft,
            IssueDate = seedDate,
            ExpiryDate = seedDate.AddDays(30),
            VersionNumber = 1,
            CompanyId = seedFirstCompany?.Id,
            ContactId = seedFirstContact?.Id,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var q1Line1 = CreateLineItem(quote1.Id, "UI/UX Design", 1, 1m, 5000m, 0m, 10m);
        var q1Line2 = CreateLineItem(quote1.Id, "Frontend Development", 2, 80m, 150m, 5m, 10m);
        var q1Line3 = CreateLineItem(quote1.Id, "QA Testing", 3, 20m, 100m, 0m, 10m);

        quote1.Subtotal = q1Line1.LineTotal + q1Line2.LineTotal + q1Line3.LineTotal;
        quote1.DiscountTotal = q1Line1.DiscountAmount + q1Line2.DiscountAmount + q1Line3.DiscountAmount;
        quote1.TaxTotal = q1Line1.TaxAmount + q1Line2.TaxAmount + q1Line3.TaxAmount;
        quote1.GrandTotal = quote1.Subtotal - quote1.DiscountTotal + quote1.TaxTotal;

        _db.Quotes.Add(quote1);
        _db.QuoteLineItems.Add(q1Line1);
        _db.QuoteLineItems.Add(q1Line2);
        _db.QuoteLineItems.Add(q1Line3);

        // Quote 2: "Annual Support Contract" -- Sent, linked to second company
        var quote2 = new Quote
        {
            TenantId = organizationId,
            QuoteNumber = "Q-0002",
            Title = "Annual Support Contract",
            Description = "24/7 premium support with dedicated account manager for one year.",
            Status = QuoteStatus.Sent,
            IssueDate = seedDate.AddDays(-5),
            ExpiryDate = seedDate.AddDays(25),
            VersionNumber = 1,
            CompanyId = seedSecondCompany?.Id,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-5),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-3)
        };

        var q2Line1 = CreateLineItem(quote2.Id, "Premium Support (Annual)", 1, 12m, 99.99m, 10m, 10m);
        var q2Line2 = CreateLineItem(quote2.Id, "Dedicated Account Manager", 2, 1m, 2400m, 0m, 10m);

        quote2.Subtotal = q2Line1.LineTotal + q2Line2.LineTotal;
        quote2.DiscountTotal = q2Line1.DiscountAmount + q2Line2.DiscountAmount;
        quote2.TaxTotal = q2Line1.TaxAmount + q2Line2.TaxAmount;
        quote2.GrandTotal = quote2.Subtotal - quote2.DiscountTotal + quote2.TaxTotal;

        _db.Quotes.Add(quote2);
        _db.QuoteLineItems.Add(q2Line1);
        _db.QuoteLineItems.Add(q2Line2);

        // QuoteStatusHistory for Quote 2: Draft -> Sent
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory
        {
            QuoteId = quote2.Id,
            FromStatus = QuoteStatus.Draft,
            ToStatus = QuoteStatus.Sent,
            ChangedAt = DateTimeOffset.UtcNow.AddDays(-3)
        });

        // Quote 3: "Product Bundle Offer" -- Accepted, linked to first deal, uses seeded products
        var quote3 = new Quote
        {
            TenantId = organizationId,
            QuoteNumber = "Q-0003",
            Title = "Product Bundle Offer",
            Description = "Enterprise license bundle with premium support at special pricing.",
            Status = QuoteStatus.Accepted,
            IssueDate = seedDate.AddDays(-10),
            ExpiryDate = seedDate.AddDays(20),
            VersionNumber = 1,
            DealId = seedFirstDeal?.Id,
            CompanyId = seedFirstCompany?.Id,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-10),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2)
        };

        var q3Line1 = CreateLineItem(quote3.Id, "CRM Enterprise License", 1, 10m, 499.99m, 15m, 10m,
            seedProduct1?.Id);
        var q3Line2 = CreateLineItem(quote3.Id, "Premium Support", 2, 10m, 99.99m, 10m, 10m,
            seedProduct2?.Id);

        quote3.Subtotal = q3Line1.LineTotal + q3Line2.LineTotal;
        quote3.DiscountTotal = q3Line1.DiscountAmount + q3Line2.DiscountAmount;
        quote3.TaxTotal = q3Line1.TaxAmount + q3Line2.TaxAmount;
        quote3.GrandTotal = quote3.Subtotal - quote3.DiscountTotal + quote3.TaxTotal;

        _db.Quotes.Add(quote3);
        _db.QuoteLineItems.Add(q3Line1);
        _db.QuoteLineItems.Add(q3Line2);

        // QuoteStatusHistory for Quote 3: Draft -> Sent, Sent -> Accepted
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory
        {
            QuoteId = quote3.Id,
            FromStatus = QuoteStatus.Draft,
            ToStatus = QuoteStatus.Sent,
            ChangedAt = DateTimeOffset.UtcNow.AddDays(-7)
        });
        _db.QuoteStatusHistories.Add(new QuoteStatusHistory
        {
            QuoteId = quote3.Id,
            FromStatus = QuoteStatus.Sent,
            ToStatus = QuoteStatus.Accepted,
            ChangedAt = DateTimeOffset.UtcNow.AddDays(-2)
        });

        // Create Request entities
        // Request 1: "Login page not loading on mobile" -- New, High, Bug, linked to first contact
        _db.Requests.Add(new Request
        {
            TenantId = organizationId,
            Subject = "Login page not loading on mobile",
            Description = "Users report the login page does not render properly on mobile Safari and Chrome. White screen after splash.",
            Status = RequestStatus.New,
            Priority = RequestPriority.High,
            Category = "Bug",
            ContactId = seedFirstContact?.Id,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-6),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-6)
        });

        // Request 2: "Need export to CSV feature" -- InProgress, Medium, Feature, linked to first company
        _db.Requests.Add(new Request
        {
            TenantId = organizationId,
            Subject = "Need export to CSV feature",
            Description = "Customer requests ability to export contact and deal lists to CSV for reporting purposes.",
            Status = RequestStatus.InProgress,
            Priority = RequestPriority.Medium,
            Category = "Feature",
            CompanyId = seedFirstCompany?.Id,
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        });

        // Request 3: "Billing inquiry for Q3" -- Resolved, Low, Billing, linked to second contact and company
        _db.Requests.Add(new Request
        {
            TenantId = organizationId,
            Subject = "Billing inquiry for Q3",
            Description = "Customer has questions about Q3 invoice discrepancy. Resolved after review of payment records.",
            Status = RequestStatus.Resolved,
            Priority = RequestPriority.Low,
            Category = "Billing",
            ContactId = seedSecondContact?.Id,
            CompanyId = seedSecondCompany?.Id,
            ResolvedAt = DateTimeOffset.UtcNow.AddHours(-3),
            IsSeedData = true,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-5),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-3)
        });

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Seed data created for organization {OrgId}: {CompanyCount} companies, {ContactCount} contacts, {ProductCount} products, 1 pipeline with {StageCount} stages, {DealCount} deals, {ActivityCount} activities, 3 quotes, 3 requests",
            organizationId,
            seedManifest.Companies.Count,
            seedManifest.Contacts.Count,
            seedManifest.Products.Count,
            seedManifest.Pipeline.Stages.Count,
            seedManifest.Deals.Count,
            seedManifest.Activities.Count);

        _logger.LogDebug(
            "Seed manifest details for {OrgId}: {Manifest}",
            organizationId,
            JsonSerializer.Serialize(seedManifest, new JsonSerializerOptions { WriteIndented = true }));
    }

    /// <summary>
    /// Creates the default seed data manifest for new organizations.
    /// This manifest defines what data will be provisioned.
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
            Contacts =
            [
                new ContactSeed
                {
                    FirstName = "Sarah", LastName = "Chen",
                    Email = "sarah.chen@example.com", Title = "CEO",
                    CompanyRef = "TechVision Inc."
                },
                new ContactSeed
                {
                    FirstName = "Marcus", LastName = "Rivera",
                    Email = "marcus.r@example.com", Title = "Sales Manager",
                    CompanyRef = "TechVision Inc."
                },
                new ContactSeed
                {
                    FirstName = "Aisha", LastName = "Patel",
                    Email = "aisha.patel@example.com", Title = "Lead Developer",
                    CompanyRef = "CloudScale Solutions"
                },
                new ContactSeed
                {
                    FirstName = "James", LastName = "Thompson",
                    Email = "james.t@example.com", Title = "Marketing Lead",
                    CompanyRef = "CloudScale Solutions"
                },
                new ContactSeed
                {
                    FirstName = "Elena", LastName = "Kowalski",
                    Email = "elena.k@example.com", Title = "Support Manager",
                    CompanyRef = "TechVision Inc."
                }
            ],
            Companies =
            [
                new CompanySeed
                {
                    Name = "TechVision Inc.",
                    Industry = "Technology",
                    Website = "https://techvision-example.com",
                    Size = "51-200"
                },
                new CompanySeed
                {
                    Name = "CloudScale Solutions",
                    Industry = "Cloud Services",
                    Website = "https://cloudscale-example.com",
                    Size = "11-50"
                }
            ],
            Products =
            [
                new ProductSeed
                {
                    Name = "CRM Enterprise License",
                    Description = "Annual enterprise license",
                    UnitPrice = 499.99m,
                    SKU = "CRM-ENT-001",
                    Category = "Software"
                },
                new ProductSeed
                {
                    Name = "Premium Support",
                    Description = "24/7 premium support package",
                    UnitPrice = 99.99m,
                    SKU = "SUP-PREM-001",
                    Category = "Support"
                },
                new ProductSeed
                {
                    Name = "Data Migration Service",
                    Description = "One-time data migration assistance",
                    UnitPrice = 1500.00m,
                    SKU = "SVC-MIG-001",
                    Category = "Services"
                }
            ],
            Deals =
            [
                new DealSeed
                {
                    Title = "Enterprise CRM License",
                    Value = 25000.00m,
                    Stage = "Proposal",
                    ContactRef = "sarah.chen@example.com",
                    CompanyRef = "TechVision Inc."
                }
            ],
            Activities =
            [
                new ActivitySeed
                {
                    Subject = "Follow up with Acme Corp",
                    Type = "Task",
                    Status = "Assigned",
                    Priority = "High",
                    DueDateOffset = 3
                },
                new ActivitySeed
                {
                    Subject = "Quarterly review call",
                    Type = "Call",
                    Status = "InProgress",
                    Priority = "Medium",
                    DueDateOffset = 1
                },
                new ActivitySeed
                {
                    Subject = "Product demo for new client",
                    Type = "Meeting",
                    Status = "Accepted",
                    Priority = "High",
                    DueDateOffset = 7
                },
                new ActivitySeed
                {
                    Subject = "Prepare proposal document",
                    Type = "Task",
                    Status = "Review",
                    Priority = "Medium",
                    DueDateOffset = -1
                },
                new ActivitySeed
                {
                    Subject = "Update CRM records",
                    Type = "Task",
                    Status = "Done",
                    Priority = "Low",
                    DueDateOffset = -3
                },
                new ActivitySeed
                {
                    Subject = "Onboarding call with new contact",
                    Type = "Call",
                    Status = "Assigned",
                    Priority = "Urgent",
                    DueDateOffset = 2
                }
            ]
        };
    }
}

#region Seed Manifest Models

/// <summary>
/// Defines the complete seed data set for a new organization.
/// All seed data is marked with IsSeedData = true for bulk deletion.
/// </summary>
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
    public string CompanyRef { get; set; } = string.Empty;
}

public class CompanySeed
{
    public string Name { get; set; } = string.Empty;
    public string Industry { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
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
}

/// <summary>
/// Seed data record for Activity entities.
/// Type, Status, and Priority are strings parsed to enums at creation time.
/// DueDateOffset is days from now (negative = overdue).
/// </summary>
public class ActivitySeed
{
    public string Subject { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public int DueDateOffset { get; set; }
}

#endregion
