using GlobCRM.Infrastructure.Sequences;
using Microsoft.AspNetCore.Mvc;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// Unauthenticated tracking endpoints for email open pixel and click redirect.
/// Email clients don't send auth tokens, so these endpoints MUST NOT have [Authorize].
/// Tracking failures are silently swallowed -- they should NEVER affect email rendering or user experience.
/// </summary>
[ApiController]
[Route("api/t")]
public class TrackingController : ControllerBase
{
    /// <summary>
    /// 1x1 transparent GIF pixel (43 bytes) returned for open tracking.
    /// </summary>
    private static readonly byte[] TransparentPixel = Convert.FromBase64String(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

    private readonly EmailTrackingService _trackingService;
    private readonly ILogger<TrackingController> _logger;

    public TrackingController(
        EmailTrackingService trackingService,
        ILogger<TrackingController> logger)
    {
        _trackingService = trackingService;
        _logger = logger;
    }

    /// <summary>
    /// Tracking pixel endpoint - records an email open event.
    /// Returns a 1x1 transparent GIF regardless of whether tracking succeeds.
    /// URL: /api/t/o/{encodedToken}
    /// </summary>
    [HttpGet("o/{token}")]
    [ResponseCache(NoStore = true)]
    public async Task<IActionResult> TrackOpen(string token)
    {
        try
        {
            var decoded = EmailTrackingService.DecodeToken(token);
            if (decoded is not null)
            {
                var (enrollmentId, stepNumber) = decoded.Value;
                await _trackingService.RecordOpenAsync(
                    enrollmentId,
                    stepNumber,
                    Request.Headers.UserAgent.ToString(),
                    HttpContext.Connection.RemoteIpAddress?.ToString());
            }
        }
        catch (Exception ex)
        {
            // Tracking failures must NEVER affect email rendering
            _logger.LogDebug(ex, "Failed to record open event for token {Token}", token);
        }

        return File(TransparentPixel, "image/gif");
    }

    /// <summary>
    /// Link click redirect endpoint - records a click event and redirects to the original URL.
    /// Returns a redirect regardless of whether tracking succeeds.
    /// URL: /api/t/c/{encodedToken}?u={encodedUrl}
    /// </summary>
    [HttpGet("c/{token}")]
    public async Task<IActionResult> TrackClick(string token, [FromQuery] string u)
    {
        var decodedUrl = "https://globcrm.com"; // Safe fallback

        try
        {
            if (!string.IsNullOrEmpty(u))
            {
                decodedUrl = Uri.UnescapeDataString(u);
            }

            var decoded = EmailTrackingService.DecodeToken(token);
            if (decoded is not null)
            {
                var (enrollmentId, stepNumber) = decoded.Value;
                await _trackingService.RecordClickAsync(
                    enrollmentId,
                    stepNumber,
                    decodedUrl,
                    Request.Headers.UserAgent.ToString(),
                    HttpContext.Connection.RemoteIpAddress?.ToString());
            }
        }
        catch (Exception ex)
        {
            // Tracking failures must NEVER affect the redirect
            _logger.LogDebug(ex, "Failed to record click event for token {Token}", token);
        }

        return Redirect(decodedUrl);
    }
}
