using GlobCRM.Application.Common;
using GlobCRM.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Admin endpoint for re-seeding demo data.
/// Clears all existing seed data and re-creates it for testing.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminSeedController : ControllerBase
{
    private readonly ITenantSeeder _tenantSeeder;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<AdminSeedController> _logger;

    public AdminSeedController(
        ITenantSeeder tenantSeeder,
        ITenantProvider tenantProvider,
        ILogger<AdminSeedController> logger)
    {
        _tenantSeeder = tenantSeeder;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    /// <summary>
    /// Clears all seed data and re-seeds the current organization with demo data.
    /// Only available to Admin users.
    /// </summary>
    [HttpPost("reseed")]
    public async Task<IActionResult> Reseed()
    {
        var tenantId = _tenantProvider.GetTenantId();
        if (tenantId == null)
            return BadRequest(new { error = "No tenant context found." });

        _logger.LogInformation("Admin reseed requested for tenant {TenantId}", tenantId);

        await _tenantSeeder.ReseedOrganizationDataAsync(tenantId.Value);

        return Ok(new { message = "Seed data has been reset successfully.", tenantId = tenantId.Value });
    }
}
