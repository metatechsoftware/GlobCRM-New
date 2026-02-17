using System.Text.Json;
using GlobCRM.Application.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.MultiTenancy;

/// <summary>
/// Seeds initial data for newly created organizations.
/// Creates Company, Contact, Product, Pipeline, PipelineStage, and Deal entities from a seed manifest.
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
            "Seed manifest created for organization {OrgId}: {CompanyCount} companies, {ContactCount} contacts, {ProductCount} products, {DealCount} deals",
            organizationId,
            seedManifest.Companies.Count,
            seedManifest.Contacts.Count,
            seedManifest.Products.Count,
            seedManifest.Deals.Count);

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
        }

        // Create Product entities from manifest
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
            dealOffset++;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Seed data created for organization {OrgId}: {CompanyCount} companies, {ContactCount} contacts, {ProductCount} products, 1 pipeline with {StageCount} stages, {DealCount} deals",
            organizationId,
            seedManifest.Companies.Count,
            seedManifest.Contacts.Count,
            seedManifest.Products.Count,
            seedManifest.Pipeline.Stages.Count,
            seedManifest.Deals.Count);

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

#endregion
