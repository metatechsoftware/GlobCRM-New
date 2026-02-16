namespace GlobCRM.Application.Common;

/// <summary>
/// Seeds initial data for a newly created organization.
/// Creates sample contacts, companies, deals, and default pipeline
/// to help users explore the CRM immediately after org creation.
/// </summary>
public interface ITenantSeeder
{
    /// <summary>
    /// Seeds default data for a new organization.
    /// Includes sample contacts, companies, a demo deal, and a default pipeline.
    /// Seed data is marked with is_seed_data flag for bulk deletion.
    /// </summary>
    /// <param name="organizationId">The ID of the newly created organization.</param>
    Task SeedOrganizationDataAsync(Guid organizationId);
}
