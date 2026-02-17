using System.Globalization;
using System.Runtime.CompilerServices;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;

namespace GlobCRM.Infrastructure.Import;

/// <summary>
/// CsvHelper-based CSV parsing service for import workflows.
/// Provides header detection with sample rows for preview, and streaming row-by-row
/// reading for large file processing during import execution.
/// Uses RFC 4180 compliant parsing via CsvHelper for proper quoting, encoding, and escaping.
/// </summary>
public class CsvParserService
{
    private static readonly CsvConfiguration CsvConfig = new(CultureInfo.InvariantCulture)
    {
        HasHeaderRecord = true,
        MissingFieldFound = null,    // Don't throw on missing columns
        BadDataFound = null,         // Collect errors instead of throwing
        TrimOptions = TrimOptions.Trim
    };

    /// <summary>
    /// Parses a CSV stream to extract headers and the first N sample rows.
    /// Used in the upload step to show users column names and sample data for mapping.
    /// </summary>
    /// <param name="stream">CSV file stream.</param>
    /// <param name="sampleSize">Maximum number of sample rows to return (default 100).</param>
    /// <returns>Parse result with headers, sample rows, and total row count.</returns>
    public async Task<CsvParseResult> ParseHeadersAndSampleAsync(Stream stream, int sampleSize = 100)
    {
        // Reset stream position if possible
        if (stream.CanSeek)
            stream.Position = 0;

        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        using var csv = new CsvReader(reader, CsvConfig);

        await csv.ReadAsync();
        csv.ReadHeader();
        var headers = csv.HeaderRecord ?? Array.Empty<string>();

        var sampleRows = new List<Dictionary<string, string>>();
        var totalRowCount = 0;

        while (await csv.ReadAsync())
        {
            totalRowCount++;

            if (sampleRows.Count < sampleSize)
            {
                var record = new Dictionary<string, string>();
                foreach (var header in headers)
                {
                    record[header] = csv.GetField(header) ?? string.Empty;
                }
                sampleRows.Add(record);
            }
        }

        return new CsvParseResult(headers, sampleRows, totalRowCount);
    }

    /// <summary>
    /// Streams CSV rows one at a time for large file processing during import execution.
    /// Yields rows as dictionaries keyed by header name for memory-efficient processing.
    /// </summary>
    /// <param name="stream">CSV file stream.</param>
    /// <returns>Async enumerable of row dictionaries.</returns>
    public async IAsyncEnumerable<Dictionary<string, string>> StreamRowsAsync(
        Stream stream,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Reset stream position if possible
        if (stream.CanSeek)
            stream.Position = 0;

        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        using var csv = new CsvReader(reader, CsvConfig);

        await csv.ReadAsync();
        csv.ReadHeader();
        var headers = csv.HeaderRecord ?? Array.Empty<string>();

        while (await csv.ReadAsync())
        {
            cancellationToken.ThrowIfCancellationRequested();

            var record = new Dictionary<string, string>();
            foreach (var header in headers)
            {
                record[header] = csv.GetField(header) ?? string.Empty;
            }
            yield return record;
        }
    }
}

/// <summary>
/// Result of CSV header and sample parsing.
/// </summary>
/// <param name="Headers">Column header names from the first row.</param>
/// <param name="SampleRows">First N rows as column-name-keyed dictionaries.</param>
/// <param name="TotalRowCount">Total number of data rows in the CSV.</param>
public record CsvParseResult(
    string[] Headers,
    List<Dictionary<string, string>> SampleRows,
    int TotalRowCount);
