using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Gmail;

/// <summary>
/// Background service that periodically polls Gmail for new emails across all active accounts.
/// Runs as a hosted service, creating a new DI scope per sync cycle to resolve scoped services.
/// Configurable polling interval via Gmail:SyncIntervalMinutes (default 5).
/// Never crashes the host on sync failure -- all exceptions are caught and logged.
/// </summary>
public class EmailSyncBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmailSyncBackgroundService> _logger;
    private readonly TimeSpan _syncInterval;

    public EmailSyncBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<EmailSyncBackgroundService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var intervalMinutes = configuration.GetValue("Gmail:SyncIntervalMinutes", 5);
        _syncInterval = TimeSpan.FromMinutes(intervalMinutes);
    }

    /// <summary>
    /// Main execution loop. Runs sync cycles at the configured interval until cancellation is requested.
    /// Each cycle creates a new DI scope, resolves GmailSyncService, and calls SyncAllAccountsAsync.
    /// </summary>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Email sync background service started. Interval: {Interval} minutes",
            _syncInterval.TotalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            var sw = Stopwatch.StartNew();

            try
            {
                _logger.LogInformation("Email sync cycle started");

                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<GmailSyncService>();
                await syncService.SyncAllAccountsAsync(stoppingToken);

                sw.Stop();
                _logger.LogInformation("Email sync cycle completed in {Elapsed}ms", sw.ElapsedMilliseconds);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Graceful shutdown -- do not log as error
                _logger.LogInformation("Email sync background service shutting down");
                break;
            }
            catch (Exception ex)
            {
                sw.Stop();
                _logger.LogError(ex, "Email sync cycle failed: {Message}", ex.Message);
            }

            try
            {
                await Task.Delay(_syncInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Graceful shutdown during delay
                break;
            }
        }

        _logger.LogInformation("Email sync background service stopped");
    }
}
