using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.BackgroundJobs;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using GlobCRM.Infrastructure.Storage;
using Hangfire;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text;

namespace GlobCRM.Infrastructure.Reporting;

/// <summary>
/// Hangfire background job for full-dataset CSV generation and file storage.
/// Follows the TenantScope pattern for tenant isolation in background jobs.
/// After generating the CSV, sends a SignalR notification to the requesting user.
/// </summary>
public class ReportCsvExportJob
{
    private readonly ApplicationDbContext _db;
    private readonly ReportQueryEngine _queryEngine;
    private readonly IFileStorageService _fileStorage;
    private readonly IHubContext<CrmHub> _hubContext;
    private readonly ILogger<ReportCsvExportJob> _logger;

    /// <summary>
    /// Hard limit for CSV export rows to prevent memory exhaustion.
    /// </summary>
    private const int MaxExportRows = 100_000;

    public ReportCsvExportJob(
        ApplicationDbContext db,
        ReportQueryEngine queryEngine,
        IFileStorageService fileStorage,
        IHubContext<CrmHub> hubContext,
        ILogger<ReportCsvExportJob> logger)
    {
        _db = db;
        _queryEngine = queryEngine;
        _fileStorage = fileStorage;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Executes the CSV export job. Loads the report, runs the query engine with no pagination,
    /// generates RFC 4180 compliant CSV, stores the file, and sends a SignalR notification.
    /// </summary>
    [Queue("default")]
    public async Task ExecuteAsync(Guid reportId, Guid userId, Guid tenantId)
    {
        TenantScope.SetCurrentTenant(tenantId);
        try
        {
            _logger.LogInformation(
                "CSV export started: Report={ReportId}, User={UserId}, Tenant={TenantId}",
                reportId, userId, tenantId);

            // 1. Load report
            var report = await _db.Reports
                .Include(r => r.Category)
                .FirstOrDefaultAsync(r => r.Id == reportId);

            if (report is null)
            {
                _logger.LogWarning("CSV export aborted: Report {ReportId} not found", reportId);
                return;
            }

            // 2. Execute full query with no pagination (PermissionScope.All -- already authorized at controller level)
            var result = await _queryEngine.ExecuteReportAsync(
                report,
                page: 1,
                pageSize: MaxExportRows,
                userId: userId,
                scope: PermissionScope.All,
                teamMemberIds: null,
                drillDownFilter: null);

            if (!string.IsNullOrEmpty(result.Error))
            {
                _logger.LogWarning("CSV export query failed for report {ReportId}: {Error}", reportId, result.Error);
                await NotifyUserAsync(userId, reportId, report.Name, null, 0, result.Error);
                return;
            }

            // 3. Build CSV content with RFC 4180 escaping
            var csv = BuildCsvContent(result.ColumnHeaders, result.Rows, report.Definition.Fields);

            // 4. Store CSV via IFileStorageService
            var timestamp = DateTimeOffset.UtcNow.ToString("yyyyMMdd_HHmmss");
            var fileName = $"{reportId}_{timestamp}.csv";
            var csvBytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();

            var downloadPath = await _fileStorage.SaveFileAsync(
                tenantId.ToString(),
                $"exports/reports",
                fileName,
                csvBytes);

            _logger.LogInformation(
                "CSV export complete: Report={ReportId}, Rows={RowCount}, Path={Path}",
                reportId, result.Rows.Count, downloadPath);

            // 5. Send SignalR notification to user
            await NotifyUserAsync(userId, reportId, report.Name, downloadPath, result.Rows.Count, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CSV export failed: Report={ReportId}, User={UserId}", reportId, userId);

            try
            {
                await NotifyUserAsync(userId, reportId, "Report", null, 0, "CSV export failed. Please try again.");
            }
            catch
            {
                // Swallow notification error -- primary error already logged
            }
        }
        finally
        {
            TenantScope.ClearCurrentTenant();
        }
    }

    /// <summary>
    /// Builds RFC 4180 compliant CSV content from column headers and row data.
    /// </summary>
    private static string BuildCsvContent(
        List<string> columnHeaders,
        List<Dictionary<string, object?>> rows,
        List<ReportField> fields)
    {
        var sb = new StringBuilder();

        // Use field labels from definition if available, fall back to column headers
        var headers = fields.Count > 0
            ? fields.OrderBy(f => f.SortOrder).Select(f => f.Label).ToList()
            : columnHeaders;

        var fieldIds = fields.Count > 0
            ? fields.OrderBy(f => f.SortOrder).Select(f => f.FieldId).ToList()
            : columnHeaders;

        // Header row
        sb.AppendLine(string.Join(",", headers.Select(EscapeCsvValue)));

        // Data rows
        foreach (var row in rows)
        {
            var values = fieldIds.Select(fieldId =>
            {
                row.TryGetValue(fieldId, out var value);
                return EscapeCsvValue(value?.ToString() ?? "");
            });
            sb.AppendLine(string.Join(",", values));
        }

        return sb.ToString();
    }

    /// <summary>
    /// Escapes a CSV value per RFC 4180:
    /// - Quotes values containing commas, quotes, or newlines
    /// - Escapes quotes by doubling them
    /// </summary>
    private static string EscapeCsvValue(string value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }

    /// <summary>
    /// Sends a SignalR notification to the user when export completes or fails.
    /// </summary>
    private async Task NotifyUserAsync(
        Guid userId, Guid reportId, string reportName,
        string? downloadUrl, int rowCount, string? error)
    {
        await _hubContext.Clients.Group($"user_{userId}").SendAsync("ReportExportComplete", new
        {
            reportId,
            reportName,
            downloadUrl,
            rowCount,
            error,
            completedAt = DateTimeOffset.UtcNow
        });
    }
}
