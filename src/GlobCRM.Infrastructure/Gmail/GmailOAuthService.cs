using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Gmail;

/// <summary>
/// Handles Gmail OAuth 2.0 authorization flow: URL generation, code exchange, and token revocation.
/// Uses Google.Apis.Auth for standards-compliant OAuth with offline access and forced consent
/// to ensure refresh tokens are always obtained (even on re-authorization).
/// </summary>
public class GmailOAuthService
{
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly string _redirectUri;
    private readonly ILogger<GmailOAuthService> _logger;

    private const string GmailModifyScope = "https://www.googleapis.com/auth/gmail.modify";

    public GmailOAuthService(IConfiguration configuration, ILogger<GmailOAuthService> logger)
    {
        _clientId = configuration["Gmail:ClientId"]
            ?? throw new InvalidOperationException("Gmail:ClientId not configured");
        _clientSecret = configuration["Gmail:ClientSecret"]
            ?? throw new InvalidOperationException("Gmail:ClientSecret not configured");
        _redirectUri = configuration["Gmail:RedirectUri"]
            ?? "http://localhost:5233/api/email-accounts/callback";
        _logger = logger;
    }

    /// <summary>
    /// Generates the Google OAuth authorization URL that the user will be redirected to.
    /// Includes access_type=offline and prompt=consent to always receive a refresh token.
    /// </summary>
    /// <param name="state">CSRF protection token to validate on callback.</param>
    /// <returns>The full authorization URL to redirect the user to.</returns>
    public string GetAuthorizationUrl(string state)
    {
        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _clientId,
                ClientSecret = _clientSecret
            },
            Scopes = [GmailModifyScope]
        });

        // Build the authorization code request URL
        var codeRequestUrl = flow.CreateAuthorizationCodeRequest(_redirectUri);
        codeRequestUrl.State = state;

        // Force consent screen and offline access to always get refresh token
        var url = codeRequestUrl.Build().ToString();
        url += "&access_type=offline&prompt=consent";

        _logger.LogDebug("Generated Gmail OAuth authorization URL for state {State}", state);
        return url;
    }

    /// <summary>
    /// Exchanges an authorization code for OAuth tokens (access + refresh).
    /// The refresh token is only provided on first authorization or when consent is forced.
    /// </summary>
    /// <param name="authCode">The authorization code from Google's OAuth callback.</param>
    /// <returns>TokenResponse containing AccessToken, RefreshToken, ExpiresInSeconds, IssuedUtc.</returns>
    public async Task<TokenResponse> ExchangeCodeAsync(string authCode)
    {
        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = _clientId,
                ClientSecret = _clientSecret
            },
            Scopes = [GmailModifyScope]
        });

        var tokenResponse = await flow.ExchangeCodeForTokenAsync(
            userId: "user",
            code: authCode,
            redirectUri: _redirectUri,
            CancellationToken.None);

        _logger.LogInformation("Successfully exchanged authorization code for tokens");
        return tokenResponse;
    }

    /// <summary>
    /// Revokes a refresh token at Google, invalidating all associated access tokens.
    /// Called when a user disconnects their Gmail account from the CRM.
    /// </summary>
    /// <param name="refreshToken">The refresh token to revoke.</param>
    public async Task RevokeTokenAsync(string refreshToken)
    {
        using var httpClient = new HttpClient();
        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["token"] = refreshToken
        });

        var response = await httpClient.PostAsync("https://oauth2.googleapis.com/revoke", content);

        if (response.IsSuccessStatusCode)
        {
            _logger.LogInformation("Successfully revoked Gmail refresh token");
        }
        else
        {
            var body = await response.Content.ReadAsStringAsync();
            _logger.LogWarning("Failed to revoke Gmail refresh token: {StatusCode} {Body}",
                response.StatusCode, body);
        }
    }
}
