using Microsoft.Extensions.Configuration;

namespace GlobCRM.Infrastructure.Storage;

/// <summary>
/// Local filesystem implementation of IFileStorageService.
/// Stores files in a tenant-partitioned directory structure under a configurable base path.
/// Directory structure: {basePath}/{tenantId}/{category}/{fileName}
/// </summary>
public class LocalFileStorageService : IFileStorageService
{
    private readonly string _basePath;

    public LocalFileStorageService(IConfiguration configuration)
    {
        _basePath = configuration["FileStorage:BasePath"] ?? "./uploads";
    }

    /// <inheritdoc />
    public async Task<string> SaveFileAsync(string tenantId, string category, string fileName, byte[] data, CancellationToken ct = default)
    {
        var relativePath = Path.Combine(tenantId, category, fileName);
        var fullPath = Path.Combine(_basePath, relativePath);

        var directory = Path.GetDirectoryName(fullPath)!;
        Directory.CreateDirectory(directory);

        await File.WriteAllBytesAsync(fullPath, data, ct);

        return relativePath;
    }

    /// <inheritdoc />
    public async Task<byte[]?> GetFileAsync(string path, CancellationToken ct = default)
    {
        var fullPath = Path.Combine(_basePath, path);

        if (!File.Exists(fullPath))
            return null;

        return await File.ReadAllBytesAsync(fullPath, ct);
    }

    /// <inheritdoc />
    public Task DeleteFileAsync(string path, CancellationToken ct = default)
    {
        var fullPath = Path.Combine(_basePath, path);

        if (File.Exists(fullPath))
            File.Delete(fullPath);

        return Task.CompletedTask;
    }
}
