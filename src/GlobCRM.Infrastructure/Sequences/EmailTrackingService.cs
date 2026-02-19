using System.Text;
using System.Text.RegularExpressions;
using GlobCRM.Domain.Entities;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Sequences;

/// <summary>
/// Handles email tracking infrastructure: tracking pixel injection, link URL rewriting,
/// base64url token encode/decode, and open/click event recording.
/// Tracking is best-effort -- tokens are not crypto-secure by design.
/// </summary>
public class EmailTrackingService
{
    private readonly ApplicationDbContext _db;
    private readonly string _baseUrl;
    private readonly ILogger<EmailTrackingService> _logger;

    public EmailTrackingService(
        ApplicationDbContext db,
        IConfiguration configuration,
        ILogger<EmailTrackingService> logger)
    {
        _db = db;
        _baseUrl = configuration["App:BaseUrl"]?.TrimEnd('/')
            ?? configuration["Jwt:Issuer"]?.TrimEnd('/')
            ?? "http://localhost:5233";
        _logger = logger;
    }

    /// <summary>
    /// Injects a tracking pixel and rewrites links in the HTML body for open/click tracking.
    /// </summary>
    /// <param name="html">The rendered HTML email body.</param>
    /// <param name="enrollmentId">The enrollment this email belongs to.</param>
    /// <param name="stepNumber">The step number within the sequence.</param>
    /// <returns>Modified HTML with tracking pixel and wrapped links.</returns>
    public string InjectTracking(string html, Guid enrollmentId, int stepNumber)
    {
        if (string.IsNullOrEmpty(html))
            return html;

        var token = EncodeToken(enrollmentId, stepNumber);

        // 1. Wrap links: replace href="https://..." in <a> tags with tracking redirect
        //    Skip mailto: and tel: links
        var linkPattern = new Regex(
            @"href=""(https?://[^""]+)""",
            RegexOptions.IgnoreCase);

        html = linkPattern.Replace(html, match =>
        {
            var originalUrl = match.Groups[1].Value;
            var encodedUrl = Uri.EscapeDataString(originalUrl);
            return $@"href=""{_baseUrl}/api/t/c/{token}?u={encodedUrl}""";
        });

        // 2. Inject tracking pixel before </body> tag (or append at end)
        var pixelTag = $@"<img src=""{_baseUrl}/api/t/o/{token}"" width=""1"" height=""1"" style=""display:none"" alt="""" />";

        var bodyCloseIndex = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        if (bodyCloseIndex >= 0)
        {
            html = html.Insert(bodyCloseIndex, pixelTag);
        }
        else
        {
            html += pixelTag;
        }

        return html;
    }

    /// <summary>
    /// Encodes an enrollment ID and step number into a base64url token for tracking URLs.
    /// Not crypto-secure by design -- tracking is best-effort, not security-critical.
    /// </summary>
    public static string EncodeToken(Guid enrollmentId, int stepNumber)
    {
        var data = $"{enrollmentId}:{stepNumber}";
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(data))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    /// <summary>
    /// Decodes a base64url token back into enrollment ID and step number.
    /// Returns null if the token is invalid.
    /// </summary>
    public static (Guid enrollmentId, int stepNumber)? DecodeToken(string token)
    {
        try
        {
            var padded = token.Replace('-', '+').Replace('_', '/');
            switch (padded.Length % 4)
            {
                case 2: padded += "=="; break;
                case 3: padded += "="; break;
            }

            var data = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
            var parts = data.Split(':');
            if (parts.Length != 2) return null;

            return (Guid.Parse(parts[0]), int.Parse(parts[1]));
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Records an email open event. Deduplicated: only one "open" event per enrollment+step.
    /// </summary>
    public async Task RecordOpenAsync(
        Guid enrollmentId, int stepNumber, string? userAgent, string? ipAddress)
    {
        try
        {
            // Deduplicate: only record unique opens per enrollment+step
            var exists = await _db.SequenceTrackingEvents
                .AnyAsync(e => e.EnrollmentId == enrollmentId
                    && e.StepNumber == stepNumber
                    && e.EventType == "open");

            if (exists) return;

            // Look up the enrollment to get tenantId
            var enrollment = await _db.SequenceEnrollments
                .AsNoTracking()
                .Where(e => e.Id == enrollmentId)
                .Select(e => new { e.TenantId })
                .FirstOrDefaultAsync();

            if (enrollment == null) return;

            var trackingEvent = new SequenceTrackingEvent
            {
                TenantId = enrollment.TenantId,
                EnrollmentId = enrollmentId,
                StepNumber = stepNumber,
                EventType = "open",
                UserAgent = userAgent,
                IpAddress = ipAddress
            };

            _db.SequenceTrackingEvents.Add(trackingEvent);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to record open event for enrollment {EnrollmentId} step {StepNumber}",
                enrollmentId, stepNumber);
        }
    }

    /// <summary>
    /// Records an email click event. No deduplication -- each click is valuable data.
    /// </summary>
    public async Task RecordClickAsync(
        Guid enrollmentId, int stepNumber, string url, string? userAgent, string? ipAddress)
    {
        try
        {
            // Look up the enrollment to get tenantId
            var enrollment = await _db.SequenceEnrollments
                .AsNoTracking()
                .Where(e => e.Id == enrollmentId)
                .Select(e => new { e.TenantId })
                .FirstOrDefaultAsync();

            if (enrollment == null) return;

            var trackingEvent = new SequenceTrackingEvent
            {
                TenantId = enrollment.TenantId,
                EnrollmentId = enrollmentId,
                StepNumber = stepNumber,
                EventType = "click",
                Url = url,
                UserAgent = userAgent,
                IpAddress = ipAddress
            };

            _db.SequenceTrackingEvents.Add(trackingEvent);
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to record click event for enrollment {EnrollmentId} step {StepNumber}",
                enrollmentId, stepNumber);
        }
    }
}
