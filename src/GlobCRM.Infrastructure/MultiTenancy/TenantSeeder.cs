using System.Text.Json;
using GlobCRM.Application.Common;
using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.MultiTenancy;

/// <summary>
/// Seeds initial data for newly created organizations.
/// Phase 1 creates default pipeline configuration as JSON metadata.
/// Phase 3 (Core CRM Entities) will execute the full seed with contacts, companies, and deals.
/// </summary>
public class TenantSeeder : ITenantSeeder
{
    private readonly IOrganizationRepository _organizationRepository;
    private readonly ILogger<TenantSeeder> _logger;

    public TenantSeeder(
        IOrganizationRepository organizationRepository,
        ILogger<TenantSeeder> logger)
    {
        _organizationRepository = organizationRepository;
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

        // Phase 1: Store default pipeline configuration as seed manifest
        // Phase 3 will create the actual Contact, Company, Deal, and Pipeline entities
        // and use this manifest to provision them
        var seedManifest = CreateSeedManifest();

        _logger.LogInformation(
            "Seed manifest created for organization {OrgId}: {PipelineStageCount} pipeline stages, {ContactCount} contacts, {CompanyCount} companies, {DealCount} deals",
            organizationId,
            seedManifest.Pipeline.Stages.Count,
            seedManifest.Contacts.Count,
            seedManifest.Companies.Count,
            seedManifest.Deals.Count);

        // For now, log the manifest. In Phase 3, this will be executed against the CRM entities.
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
                    new PipelineStageSeed { Name = "Lead", Order = 1, Color = "#90caf9" },
                    new PipelineStageSeed { Name = "Qualified", Order = 2, Color = "#42a5f5" },
                    new PipelineStageSeed { Name = "Proposal", Order = 3, Color = "#1976d2" },
                    new PipelineStageSeed { Name = "Negotiation", Order = 4, Color = "#1565c0" },
                    new PipelineStageSeed { Name = "Closed Won", Order = 5, Color = "#00897b" },
                    new PipelineStageSeed { Name = "Closed Lost", Order = 6, Color = "#ef5350" }
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

public class DealSeed
{
    public string Title { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public string Stage { get; set; } = string.Empty;
    public string ContactRef { get; set; } = string.Empty;
    public string CompanyRef { get; set; } = string.Empty;
}

#endregion
