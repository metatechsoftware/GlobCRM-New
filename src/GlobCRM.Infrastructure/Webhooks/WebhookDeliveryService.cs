using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.BackgroundJobs;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using Hangfire;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Webhooks;

/// <summary>
/// Delivers webhook payloads to external URLs with HMAC-SHA256 signing.
/// Handles retry scheduling with exponential backoff + jitter, delivery logging,
/// and auto-disable after 50 consecutive failures.
///
/// Uses manual retry management (not Hangfire AutomaticRetry) for:
/// - Custom delay schedule with jitter to prevent stampede effect
/// - Per-subscription consecutive failure counting
/// - Auto-disable threshold checking after each failure
/// - Delivery log creation per attempt
/// </summary>
public class WebhookDeliveryService
{
    /// <summary>
    /// Hangfire queue name for webhook delivery jobs.
    /// </summary>
    public const string QueueName = "webhooks";

    /// <summary>
    /// Maximum consecutive failures before auto-disabling a subscription.
    /// </summary>
    private const int AutoDisableThreshold = 50;

    /// <summary>
    /// Maximum number of retry attempts (0-based: attempt 0 through attempt 6 = 7 total).
    /// </summary>
    private const int MaxRetryAttempts = 7;

    /// <summary>
    /// Retry delay schedule in seconds: immediate, 1min, 5min, 30min, 2hr, 8hr, 24hr.
    /// </summary>
    private static readonly int[] RetryDelaysSeconds = [0, 60, 300, 1800, 7200, 28800, 86400];

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IWebhookRepository _webhookRepository;
    private readonly WebhookSsrfValidator _ssrfValidator;
    private readonly NotificationDispatcher _notificationDispatcher;
    private readonly IBackgroundJobClient _jobClient;
    private readonly ILogger<WebhookDeliveryService> _logger;

    public WebhookDeliveryService(
        IHttpClientFactory httpClientFactory,
        IWebhookRepository webhookRepository,
        WebhookSsrfValidator ssrfValidator,
        NotificationDispatcher notificationDispatcher,
        IBackgroundJobClient jobClient,
        ILogger<WebhookDeliveryService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _webhookRepository = webhookRepository;
        _ssrfValidator = ssrfValidator;
        _notificationDispatcher = notificationDispatcher;
        _jobClient = jobClient;
        _logger = logger;
    }

    /// <summary>
    /// Delivers a webhook payload to the subscription's URL.
    /// Called by Hangfire from the "webhooks" queue.
    /// </summary>
    /// <param name="subscriptionId">The subscription to deliver to.</param>
    /// <param name="jsonPayload">The pre-serialized JSON payload (never re-serialize for HMAC fidelity).</param>
    /// <param name="tenantId">The tenant ID for scoping.</param>
    /// <param name="attemptNumber">Current attempt (0-based). Used for retry scheduling.</param>
    [Queue(QueueName)]
    [AutomaticRetry(Attempts = 0)] // Disable Hangfire auto-retry; we manage retries manually
    public async Task DeliverAsync(Guid subscriptionId, string jsonPayload, Guid tenantId, int attemptNumber)
    {
        // 1. Set tenant scope for DbContext filtering in Hangfire job context
        TenantScope.SetCurrentTenant(tenantId);

        var deliveryId = Guid.NewGuid();
        var stopwatch = Stopwatch.StartNew();

        try
        {
            // 2. Load subscription
            var subscription = await _webhookRepository.GetSubscriptionByIdAsync(subscriptionId, CancellationToken.None);
            if (subscription is null || !subscription.IsActive || subscription.IsDisabled)
            {
                _logger.LogInformation(
                    "Webhook delivery skipped for subscription {SubscriptionId}: not found, inactive, or disabled",
                    subscriptionId);
                return;
            }

            // 3. SSRF validate the URL (re-resolve DNS every time per research)
            var (isValid, ssrfError) = await _ssrfValidator.ValidateUrlAsync(subscription.Url);
            if (!isValid)
            {
                _logger.LogWarning(
                    "SSRF validation failed for subscription {SubscriptionId} URL {Url}: {Error}",
                    subscriptionId, subscription.Url, ssrfError);

                // Log the failure but do NOT retry (permanent error)
                await LogDelivery(subscription, deliveryId, jsonPayload, attemptNumber,
                    success: false, statusCode: null, responseBody: null,
                    errorMessage: $"SSRF validation failed: {ssrfError}",
                    durationMs: stopwatch.ElapsedMilliseconds, tenantId);
                return;
            }

            // 4. Sign the payload
            var signature = SignPayload(jsonPayload, subscription.Secret);
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            // 5. Create HTTP request
            var httpClient = _httpClientFactory.CreateClient("WebhookDelivery");
            var request = new HttpRequestMessage(HttpMethod.Post, subscription.Url)
            {
                Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
            };
            request.Headers.Add("X-Webhook-Signature", signature);
            request.Headers.Add("X-Webhook-Id", deliveryId.ToString());
            request.Headers.Add("X-Webhook-Timestamp", timestamp.ToString());

            // 6. Send the request
            HttpResponseMessage? response = null;
            string? responseBody = null;
            string? errorMessage = null;
            bool success = false;
            int? statusCode = null;

            try
            {
                response = await httpClient.SendAsync(request, CancellationToken.None);
                statusCode = (int)response.StatusCode;
                success = response.IsSuccessStatusCode;

                // Read response body, truncated to 1KB
                responseBody = await ReadTruncatedResponseAsync(response);
            }
            catch (TaskCanceledException)
            {
                errorMessage = "Request timed out";
            }
            catch (HttpRequestException ex)
            {
                errorMessage = $"Connection failed: {ex.Message}";
            }
            catch (Exception ex)
            {
                errorMessage = $"Unexpected error: {ex.Message}";
            }

            stopwatch.Stop();

            // 7. Create delivery log entry
            await LogDelivery(subscription, deliveryId, jsonPayload, attemptNumber,
                success, statusCode, responseBody, errorMessage, stopwatch.ElapsedMilliseconds, tenantId);

            // 8. Handle success
            if (success)
            {
                subscription.ConsecutiveFailureCount = 0;
                subscription.LastDeliveryAt = DateTimeOffset.UtcNow;
                await _webhookRepository.UpdateSubscriptionAsync(subscription, CancellationToken.None);

                _logger.LogInformation(
                    "Webhook delivered successfully: subscription {SubscriptionId}, attempt {Attempt}, status {StatusCode}",
                    subscriptionId, attemptNumber, statusCode);
                return;
            }

            // 9. Handle failure
            subscription.ConsecutiveFailureCount++;
            subscription.LastDeliveryAt = DateTimeOffset.UtcNow;

            _logger.LogWarning(
                "Webhook delivery failed: subscription {SubscriptionId}, attempt {Attempt}, status {StatusCode}, error {Error}",
                subscriptionId, attemptNumber, statusCode, errorMessage);

            // 9a. Check auto-disable threshold
            if (subscription.ConsecutiveFailureCount >= AutoDisableThreshold)
            {
                subscription.IsDisabled = true;
                subscription.DisabledAt = DateTimeOffset.UtcNow;
                subscription.DisabledReason = "Auto-disabled after 50 consecutive delivery failures";
                await _webhookRepository.UpdateSubscriptionAsync(subscription, CancellationToken.None);

                _logger.LogWarning(
                    "Webhook subscription {SubscriptionId} ({SubscriptionName}) auto-disabled after {FailureCount} consecutive failures",
                    subscriptionId, subscription.Name, subscription.ConsecutiveFailureCount);

                // Dispatch notifications (email + in-app) to subscription creator
                await DispatchAutoDisableNotification(subscription, tenantId);
                return;
            }

            await _webhookRepository.UpdateSubscriptionAsync(subscription, CancellationToken.None);

            // 9b. Schedule retry (only for retryable errors)
            bool isRetryable = IsRetryableFailure(statusCode, errorMessage);
            if (isRetryable && attemptNumber < MaxRetryAttempts - 1)
            {
                var nextAttempt = attemptNumber + 1;
                var baseDelay = RetryDelaysSeconds[nextAttempt];
                var jitter = Random.Shared.Next(0, baseDelay / 10 + 1); // 10% jitter
                var delay = TimeSpan.FromSeconds(baseDelay + jitter);

                _jobClient.Schedule<WebhookDeliveryService>(
                    QueueName,
                    svc => svc.DeliverAsync(subscriptionId, jsonPayload, tenantId, nextAttempt),
                    delay);

                _logger.LogInformation(
                    "Webhook retry scheduled for subscription {SubscriptionId}: attempt {NextAttempt} in {Delay}s",
                    subscriptionId, nextAttempt, baseDelay + jitter);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Unhandled error in webhook delivery for subscription {SubscriptionId}",
                subscriptionId);
        }
    }

    /// <summary>
    /// Signs a payload with HMAC-SHA256 using the subscription's secret.
    /// Returns the signature in "sha256={hexHash}" format.
    /// </summary>
    private static string SignPayload(string payload, string secret)
    {
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(payloadBytes);
        return $"sha256={Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    /// <summary>
    /// Generates a cryptographically secure webhook secret with "whsec_" prefix.
    /// </summary>
    public static string GenerateSecret()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return $"whsec_{Convert.ToBase64String(bytes)}";
    }

    /// <summary>
    /// Determines if a failure is retryable.
    /// Only retry on 5xx, timeout, and connection failures. Do NOT retry on 4xx (permanent errors).
    /// </summary>
    private static bool IsRetryableFailure(int? statusCode, string? errorMessage)
    {
        // Timeout or connection failure (no status code)
        if (!statusCode.HasValue)
            return true;

        // 5xx server errors are retryable
        if (statusCode.Value >= 500)
            return true;

        // 429 Too Many Requests is retryable
        if (statusCode.Value == 429)
            return true;

        // 4xx client errors are permanent (except 429)
        return false;
    }

    /// <summary>
    /// Reads and truncates an HTTP response body to 1KB maximum.
    /// </summary>
    private static async Task<string?> ReadTruncatedResponseAsync(HttpResponseMessage response)
    {
        try
        {
            var body = await response.Content.ReadAsStringAsync();
            if (body.Length > 1024)
                return body[..1024];
            return body;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Creates a WebhookDeliveryLog entry for the delivery attempt.
    /// </summary>
    private async Task LogDelivery(
        WebhookSubscription subscription,
        Guid deliveryId,
        string jsonPayload,
        int attemptNumber,
        bool success,
        int? statusCode,
        string? responseBody,
        string? errorMessage,
        long durationMs,
        Guid tenantId)
    {
        try
        {
            // Extract event type from the payload envelope
            var eventType = ExtractEventType(jsonPayload);
            var entityId = ExtractEntityId(jsonPayload);

            var log = new WebhookDeliveryLog
            {
                Id = deliveryId,
                TenantId = tenantId,
                SubscriptionId = subscription.Id,
                EventType = eventType,
                EntityId = entityId,
                AttemptNumber = attemptNumber + 1, // Convert 0-based to 1-based for display
                Success = success,
                HttpStatusCode = statusCode,
                ResponseBody = responseBody,
                ErrorMessage = errorMessage,
                RequestPayload = jsonPayload,
                DurationMs = durationMs,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _webhookRepository.CreateDeliveryLogAsync(log, CancellationToken.None);
        }
        catch (Exception ex)
        {
            // Delivery log failure should not affect the delivery pipeline
            _logger.LogError(ex, "Failed to create webhook delivery log for subscription {SubscriptionId}", subscription.Id);
        }
    }

    /// <summary>
    /// Dispatches email + in-app notifications when a subscription is auto-disabled.
    /// </summary>
    private async Task DispatchAutoDisableNotification(WebhookSubscription subscription, Guid tenantId)
    {
        try
        {
            await _notificationDispatcher.DispatchAsync(new NotificationRequest
            {
                RecipientId = subscription.CreatedByUserId,
                Type = NotificationType.WebhookAutoDisabled,
                Title = "Webhook subscription auto-disabled",
                Message = $"Webhook \"{subscription.Name}\" has been auto-disabled after 50 consecutive delivery failures to {subscription.Url}. Please check the endpoint and re-enable the subscription.",
                EntityType = "WebhookSubscription",
                EntityId = subscription.Id
            }, tenantId);
        }
        catch (Exception ex)
        {
            // Notification failure should not affect the delivery pipeline
            _logger.LogError(ex,
                "Failed to dispatch auto-disable notification for subscription {SubscriptionId}",
                subscription.Id);
        }
    }

    /// <summary>
    /// Extracts the "event" field from the JSON payload envelope.
    /// </summary>
    private static string ExtractEventType(string jsonPayload)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(jsonPayload);
            if (doc.RootElement.TryGetProperty("event", out var eventProp))
                return eventProp.GetString() ?? "unknown";
        }
        catch { }
        return "unknown";
    }

    /// <summary>
    /// Extracts the entity ID from the "data.id" path in the JSON payload envelope.
    /// </summary>
    private static string ExtractEntityId(string jsonPayload)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(jsonPayload);
            if (doc.RootElement.TryGetProperty("data", out var dataProp) &&
                dataProp.TryGetProperty("id", out var idProp))
                return idProp.GetString() ?? "unknown";
        }
        catch { }
        return "unknown";
    }
}
