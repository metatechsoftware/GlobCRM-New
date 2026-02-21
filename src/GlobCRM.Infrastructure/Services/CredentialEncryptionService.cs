using Microsoft.AspNetCore.DataProtection;

namespace GlobCRM.Infrastructure.Services;

/// <summary>
/// Encrypts and decrypts integration credential JSON blobs using ASP.NET Core DataProtection.
/// DataProtection handles key rotation automatically -- old keys are retained for decryption
/// while new keys are used for encryption. Purpose string ensures credential isolation.
/// Cloned from TokenEncryptionService pattern (Gmail OAuth tokens).
/// </summary>
public class CredentialEncryptionService
{
    private readonly IDataProtector _protector;

    public CredentialEncryptionService(IDataProtectionProvider dataProtectionProvider)
    {
        _protector = dataProtectionProvider.CreateProtector("GlobCRM.Integration.Credentials");
    }

    /// <summary>
    /// Encrypts a plain text credential JSON blob.
    /// </summary>
    public string Encrypt(string plainText)
    {
        return _protector.Protect(plainText);
    }

    /// <summary>
    /// Decrypts an encrypted credential JSON blob back to plain text.
    /// </summary>
    public string Decrypt(string encrypted)
    {
        return _protector.Unprotect(encrypted);
    }
}
