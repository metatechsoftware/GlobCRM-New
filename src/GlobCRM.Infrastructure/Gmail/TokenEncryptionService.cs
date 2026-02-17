using Microsoft.AspNetCore.DataProtection;

namespace GlobCRM.Infrastructure.Gmail;

/// <summary>
/// Encrypts and decrypts OAuth tokens using ASP.NET Core DataProtection.
/// DataProtection handles key rotation automatically -- old keys are retained for decryption
/// while new keys are used for encryption. Purpose string ensures token isolation.
/// </summary>
public class TokenEncryptionService
{
    private readonly IDataProtector _protector;

    public TokenEncryptionService(IDataProtectionProvider dataProtectionProvider)
    {
        _protector = dataProtectionProvider.CreateProtector("GlobCRM.Gmail.Tokens");
    }

    /// <summary>
    /// Encrypts a plain text token value.
    /// </summary>
    public string Encrypt(string plainText)
    {
        return _protector.Protect(plainText);
    }

    /// <summary>
    /// Decrypts an encrypted token value back to plain text.
    /// </summary>
    public string Decrypt(string encrypted)
    {
        return _protector.Unprotect(encrypted);
    }
}
