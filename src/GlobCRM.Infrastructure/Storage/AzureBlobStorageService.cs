using Azure;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Configuration;

namespace GlobCRM.Infrastructure.Storage;

/// <summary>
/// Azure Blob Storage implementation of IFileStorageService.
/// Stores files in a single "attachments" container with tenant-partitioned virtual directories.
/// Blob path format: {tenantId}/{category}/{fileName}
/// </summary>
public class AzureBlobStorageService : IFileStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private const string ContainerName = "attachments";

    public AzureBlobStorageService(IConfiguration configuration)
    {
        var connectionString = configuration["FileStorage:Azure:ConnectionString"]
            ?? throw new InvalidOperationException("FileStorage:Azure:ConnectionString is not configured.");

        _blobServiceClient = new BlobServiceClient(connectionString);
    }

    /// <inheritdoc />
    public async Task<string> SaveFileAsync(string tenantId, string category, string fileName, byte[] data, CancellationToken ct = default)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
        await containerClient.CreateIfNotExistsAsync(cancellationToken: ct);

        var blobPath = $"{tenantId}/{category}/{fileName}";
        var blobClient = containerClient.GetBlobClient(blobPath);

        using var stream = new MemoryStream(data);
        await blobClient.UploadAsync(stream, overwrite: true, cancellationToken: ct);

        return blobPath;
    }

    /// <inheritdoc />
    public async Task<byte[]?> GetFileAsync(string path, CancellationToken ct = default)
    {
        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
            var blobClient = containerClient.GetBlobClient(path);

            var response = await blobClient.DownloadContentAsync(ct);
            return response.Value.Content.ToArray();
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }

    /// <inheritdoc />
    public async Task DeleteFileAsync(string path, CancellationToken ct = default)
    {
        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
            var blobClient = containerClient.GetBlobClient(path);

            await blobClient.DeleteIfExistsAsync(cancellationToken: ct);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // Blob already gone -- no-op
        }
    }
}
