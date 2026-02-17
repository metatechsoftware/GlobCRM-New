using GlobCRM.Domain.Entities;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Gmail.v1;
using Google.Apis.Services;
using Microsoft.Extensions.Configuration;

namespace GlobCRM.Infrastructure.Gmail;

/// <summary>
/// Creates authenticated GmailService instances for a given EmailAccount.
/// Decrypts stored tokens, builds a UserCredential, and returns a ready-to-use GmailService.
/// The Google SDK automatically refreshes expired access tokens using the refresh token.
/// </summary>
public class GmailServiceFactory
{
    private readonly IConfiguration _configuration;
    private readonly TokenEncryptionService _tokenEncryption;

    public GmailServiceFactory(IConfiguration configuration, TokenEncryptionService tokenEncryption)
    {
        _configuration = configuration;
        _tokenEncryption = tokenEncryption;
    }

    /// <summary>
    /// Creates an authenticated GmailService for the given email account.
    /// Decrypts stored OAuth tokens and creates a UserCredential that auto-refreshes.
    /// </summary>
    /// <param name="account">The email account with encrypted tokens.</param>
    /// <returns>A GmailService ready for API calls.</returns>
    public Task<GmailService> CreateForAccountAsync(EmailAccount account)
    {
        var accessToken = _tokenEncryption.Decrypt(account.EncryptedAccessToken);
        var refreshToken = _tokenEncryption.Decrypt(account.EncryptedRefreshToken);

        var tokenResponse = new TokenResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresInSeconds = 3600,
            IssuedUtc = account.TokenIssuedAt.UtcDateTime
        };

        var clientId = _configuration["Gmail:ClientId"]
            ?? throw new InvalidOperationException("Gmail:ClientId not configured");
        var clientSecret = _configuration["Gmail:ClientSecret"]
            ?? throw new InvalidOperationException("Gmail:ClientSecret not configured");

        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = new ClientSecrets
            {
                ClientId = clientId,
                ClientSecret = clientSecret
            },
            Scopes = ["https://www.googleapis.com/auth/gmail.modify"]
        });

        var credential = new UserCredential(flow, account.GmailAddress, tokenResponse);

        var gmailService = new GmailService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "GlobCRM"
        });

        return Task.FromResult(gmailService);
    }
}
