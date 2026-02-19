using GlobCRM.Infrastructure.EmailTemplates;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoint for retrieving available merge fields grouped by entity type.
/// Used by the email template editor to show available personalization fields.
/// </summary>
[ApiController]
[Route("api/merge-fields")]
[Authorize]
public class MergeFieldsController : ControllerBase
{
    private readonly MergeFieldService _mergeFieldService;

    public MergeFieldsController(MergeFieldService mergeFieldService)
    {
        _mergeFieldService = mergeFieldService;
    }

    /// <summary>
    /// Returns available merge fields grouped by entity type (contact, company, deal, lead).
    /// Each field includes its key, display label, group, and whether it's a custom field.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(Dictionary<string, List<MergeFieldDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAvailableFields()
    {
        var fields = await _mergeFieldService.GetAvailableFieldsAsync();

        var result = fields.ToDictionary(
            kvp => kvp.Key,
            kvp => kvp.Value.Select(f => new MergeFieldDto(f.Key, f.Label, f.Group, f.IsCustomField)).ToList());

        return Ok(result);
    }
}

// ---- DTOs ----

public record MergeFieldDto(string Key, string Label, string Group, bool IsCustomField);
