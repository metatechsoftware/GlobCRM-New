namespace GlobCRM.Infrastructure.Storage;

/// <summary>
/// Abstraction for file storage operations.
/// Phase 2 uses local filesystem; future phases can swap in cloud storage (S3, Azure Blob, etc.).
/// All paths are tenant-partitioned: {tenantId}/{category}/{fileName}.
/// </summary>
public interface IFileStorageService
{
    /// <summary>
    /// Saves a file to storage, creating directories as needed.
    /// </summary>
    /// <param name="tenantId">Tenant identifier for path partitioning.</param>
    /// <param name="category">File category (e.g., "avatars", "attachments").</param>
    /// <param name="fileName">Name of the file to save.</param>
    /// <param name="data">File contents as byte array.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Relative path to the saved file.</returns>
    Task<string> SaveFileAsync(string tenantId, string category, string fileName, byte[] data, CancellationToken ct = default);

    /// <summary>
    /// Reads a file from storage.
    /// </summary>
    /// <param name="path">Relative path to the file.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>File contents as byte array, or null if not found.</returns>
    Task<byte[]?> GetFileAsync(string path, CancellationToken ct = default);

    /// <summary>
    /// Deletes a file from storage. No error if file does not exist.
    /// </summary>
    /// <param name="path">Relative path to the file.</param>
    /// <param name="ct">Cancellation token.</param>
    Task DeleteFileAsync(string path, CancellationToken ct = default);
}
