using System.Net;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Webhooks;

/// <summary>
/// Validates webhook URLs against SSRF (Server-Side Request Forgery) attacks.
/// Resolves DNS fresh on every call to prevent DNS rebinding bypasses.
/// Blocks private, loopback, link-local, and reserved IP ranges.
/// </summary>
public class WebhookSsrfValidator
{
    private readonly ILogger<WebhookSsrfValidator> _logger;

    /// <summary>
    /// Blocked IPv4 and IPv6 networks that must not be reached by webhook delivery.
    /// </summary>
    private static readonly IPNetwork[] BlockedNetworks =
    [
        // IPv4 private ranges (RFC1918)
        new IPNetwork(IPAddress.Parse("10.0.0.0"), 8),
        new IPNetwork(IPAddress.Parse("172.16.0.0"), 12),
        new IPNetwork(IPAddress.Parse("192.168.0.0"), 16),
        // IPv4 loopback
        new IPNetwork(IPAddress.Parse("127.0.0.0"), 8),
        // IPv4 link-local
        new IPNetwork(IPAddress.Parse("169.254.0.0"), 16),
        // IPv4 "this" network
        new IPNetwork(IPAddress.Parse("0.0.0.0"), 8),
        // IPv6 loopback
        new IPNetwork(IPAddress.Parse("::1"), 128),
        // IPv6 unique local address (ULA)
        new IPNetwork(IPAddress.Parse("fc00::"), 7),
        // IPv6 link-local
        new IPNetwork(IPAddress.Parse("fe80::"), 10),
    ];

    public WebhookSsrfValidator(ILogger<WebhookSsrfValidator> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Validates that a webhook URL is safe to deliver to.
    /// Checks URL format, HTTPS requirement, and resolved IP addresses against blocked ranges.
    /// DNS is resolved fresh every time to prevent DNS rebinding attacks.
    /// </summary>
    /// <param name="url">The webhook target URL to validate.</param>
    /// <returns>Tuple of (IsValid, Error) where Error describes the validation failure if IsValid is false.</returns>
    public async Task<(bool IsValid, string? Error)> ValidateUrlAsync(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return (false, "Invalid URL format.");

        if (uri.Scheme != "https")
            return (false, "Only HTTPS URLs are allowed for webhook delivery.");

        IPAddress[] addresses;
        try
        {
            // Resolve DNS fresh every time (prevents DNS rebinding)
            addresses = await Dns.GetHostAddressesAsync(uri.Host);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "DNS resolution failed for webhook URL host: {Host}", uri.Host);
            return (false, $"DNS resolution failed for host: {uri.Host}");
        }

        if (addresses.Length == 0)
            return (false, $"No DNS records found for host: {uri.Host}");

        foreach (var address in addresses)
        {
            if (IsPrivateIp(address))
            {
                _logger.LogWarning(
                    "SSRF blocked: webhook URL {Url} resolves to private/blocked IP {Address}",
                    url, address);
                return (false, $"URL resolves to blocked IP range: {address}");
            }
        }

        return (true, null);
    }

    /// <summary>
    /// Checks whether an IP address falls within any blocked private/reserved network.
    /// Static for reuse in other validation contexts.
    /// </summary>
    /// <param name="address">The IP address to check.</param>
    /// <returns>True if the address is private/reserved and should be blocked.</returns>
    public static bool IsPrivateIp(IPAddress address)
    {
        foreach (var network in BlockedNetworks)
        {
            if (network.Contains(address))
                return true;
        }

        return false;
    }
}
