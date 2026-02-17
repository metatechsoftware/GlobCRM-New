using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Import;

/// <summary>
/// Detects potential duplicate entities before import to allow users to choose
/// skip/overwrite/merge strategy. Matches against existing entities using
/// normalized comparison (lowercase, trimmed) on type-specific fields.
///
/// Matching logic per entity type:
/// - Contact: Primary on email (exact, case-insensitive). Secondary on FirstName+LastName.
/// - Company: Primary on Name (normalized). Secondary on Email/Domain.
/// - Deal: Match on Title (normalized, case-insensitive).
/// </summary>
public class DuplicateDetector
{
    private readonly ApplicationDbContext _db;

    public DuplicateDetector(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Detects duplicates for a batch of import rows against existing entities.
    /// </summary>
    /// <param name="entityType">The type of entity being imported.</param>
    /// <param name="rows">The rows to check (from CSV sample or batch).</param>
    /// <param name="mappings">Field mappings to extract values from CSV columns.</param>
    /// <returns>List of duplicate matches with row index, existing entity ID, and match info.</returns>
    public async Task<List<DuplicateMatch>> DetectDuplicatesAsync(
        ImportEntityType entityType,
        List<Dictionary<string, string>> rows,
        List<ImportFieldMapping> mappings)
    {
        return entityType switch
        {
            ImportEntityType.Contact => await DetectContactDuplicatesAsync(rows, mappings),
            ImportEntityType.Company => await DetectCompanyDuplicatesAsync(rows, mappings),
            ImportEntityType.Deal => await DetectDealDuplicatesAsync(rows, mappings),
            _ => new List<DuplicateMatch>()
        };
    }

    private async Task<List<DuplicateMatch>> DetectContactDuplicatesAsync(
        List<Dictionary<string, string>> rows,
        List<ImportFieldMapping> mappings)
    {
        var duplicates = new List<DuplicateMatch>();

        var emailColumn = mappings.FirstOrDefault(m => m.EntityField.Equals("Email", StringComparison.OrdinalIgnoreCase))?.CsvColumn;
        var firstNameColumn = mappings.FirstOrDefault(m => m.EntityField.Equals("FirstName", StringComparison.OrdinalIgnoreCase))?.CsvColumn;
        var lastNameColumn = mappings.FirstOrDefault(m => m.EntityField.Equals("LastName", StringComparison.OrdinalIgnoreCase))?.CsvColumn;

        // Collect all emails and names from the rows
        var emails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (emailColumn != null && row.TryGetValue(emailColumn, out var email) && !string.IsNullOrWhiteSpace(email))
                emails.Add(email.Trim().ToLowerInvariant());

            if (firstNameColumn != null && lastNameColumn != null)
            {
                var fn = row.GetValueOrDefault(firstNameColumn, "").Trim().ToLowerInvariant();
                var ln = row.GetValueOrDefault(lastNameColumn, "").Trim().ToLowerInvariant();
                if (!string.IsNullOrWhiteSpace(fn) && !string.IsNullOrWhiteSpace(ln))
                    names.Add($"{fn}|{ln}");
            }
        }

        // Query existing contacts for email matches
        var emailMap = new Dictionary<string, Guid>();
        if (emailColumn != null && emails.Count > 0)
        {
            var existingByEmail = await _db.Contacts
                .Where(c => c.Email != null && emails.Contains(c.Email.ToLower()))
                .Select(c => new { c.Id, Email = c.Email!.ToLower() })
                .ToListAsync();

            emailMap = existingByEmail
                .GroupBy(c => c.Email)
                .ToDictionary(g => g.Key, g => g.First().Id);
        }

        // Query existing contacts for name matches
        var nameMap = new Dictionary<string, Guid>();
        if (firstNameColumn != null && lastNameColumn != null && names.Count > 0)
        {
            var existingByName = await _db.Contacts
                .Where(c => !string.IsNullOrWhiteSpace(c.FirstName) && !string.IsNullOrWhiteSpace(c.LastName))
                .Select(c => new { c.Id, Key = (c.FirstName.ToLower() + "|" + c.LastName.ToLower()) })
                .ToListAsync();

            nameMap = existingByName
                .Where(c => names.Contains(c.Key))
                .GroupBy(c => c.Key)
                .ToDictionary(g => g.Key, g => g.First().Id);
        }

        // Match each row
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];

            // Primary: email match
            if (emailColumn != null && row.TryGetValue(emailColumn, out var rowEmail) && !string.IsNullOrWhiteSpace(rowEmail))
            {
                var normalizedEmail = rowEmail.Trim().ToLowerInvariant();
                if (emailMap.TryGetValue(normalizedEmail, out var existingId))
                {
                    duplicates.Add(new DuplicateMatch(i, existingId, "Email", normalizedEmail));
                    continue; // Don't double-report
                }
            }

            // Secondary: name match
            if (firstNameColumn != null && lastNameColumn != null)
            {
                var fn = row.GetValueOrDefault(firstNameColumn, "").Trim().ToLowerInvariant();
                var ln = row.GetValueOrDefault(lastNameColumn, "").Trim().ToLowerInvariant();
                var nameKey = $"{fn}|{ln}";
                if (!string.IsNullOrWhiteSpace(fn) && !string.IsNullOrWhiteSpace(ln) && nameMap.TryGetValue(nameKey, out var existingId))
                {
                    duplicates.Add(new DuplicateMatch(i, existingId, "FirstName+LastName", $"{fn} {ln}"));
                }
            }
        }

        return duplicates;
    }

    private async Task<List<DuplicateMatch>> DetectCompanyDuplicatesAsync(
        List<Dictionary<string, string>> rows,
        List<ImportFieldMapping> mappings)
    {
        var duplicates = new List<DuplicateMatch>();

        var nameColumn = mappings.FirstOrDefault(m => m.EntityField.Equals("Name", StringComparison.OrdinalIgnoreCase))?.CsvColumn;
        var emailColumn = mappings.FirstOrDefault(m => m.EntityField.Equals("Email", StringComparison.OrdinalIgnoreCase))?.CsvColumn;

        // Collect all names and emails
        var companyNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var companyEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (nameColumn != null && row.TryGetValue(nameColumn, out var name) && !string.IsNullOrWhiteSpace(name))
                companyNames.Add(name.Trim().ToLowerInvariant());
            if (emailColumn != null && row.TryGetValue(emailColumn, out var email) && !string.IsNullOrWhiteSpace(email))
                companyEmails.Add(email.Trim().ToLowerInvariant());
        }

        // Query existing companies for name matches
        var nameMap = new Dictionary<string, Guid>();
        if (nameColumn != null && companyNames.Count > 0)
        {
            var existingByName = await _db.Companies
                .Where(c => companyNames.Contains(c.Name.ToLower()))
                .Select(c => new { c.Id, Name = c.Name.ToLower() })
                .ToListAsync();

            nameMap = existingByName
                .GroupBy(c => c.Name)
                .ToDictionary(g => g.Key, g => g.First().Id);
        }

        // Query existing companies for email matches
        var emailMap = new Dictionary<string, Guid>();
        if (emailColumn != null && companyEmails.Count > 0)
        {
            var existingByEmail = await _db.Companies
                .Where(c => c.Email != null && companyEmails.Contains(c.Email.ToLower()))
                .Select(c => new { c.Id, Email = c.Email!.ToLower() })
                .ToListAsync();

            emailMap = existingByEmail
                .GroupBy(c => c.Email)
                .ToDictionary(g => g.Key, g => g.First().Id);
        }

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];

            // Primary: name match
            if (nameColumn != null && row.TryGetValue(nameColumn, out var rowName) && !string.IsNullOrWhiteSpace(rowName))
            {
                var normalizedName = rowName.Trim().ToLowerInvariant();
                if (nameMap.TryGetValue(normalizedName, out var existingId))
                {
                    duplicates.Add(new DuplicateMatch(i, existingId, "Name", normalizedName));
                    continue;
                }
            }

            // Secondary: email/domain match
            if (emailColumn != null && row.TryGetValue(emailColumn, out var rowEmail) && !string.IsNullOrWhiteSpace(rowEmail))
            {
                var normalizedEmail = rowEmail.Trim().ToLowerInvariant();
                if (emailMap.TryGetValue(normalizedEmail, out var existingId))
                {
                    duplicates.Add(new DuplicateMatch(i, existingId, "Email", normalizedEmail));
                }
            }
        }

        return duplicates;
    }

    private async Task<List<DuplicateMatch>> DetectDealDuplicatesAsync(
        List<Dictionary<string, string>> rows,
        List<ImportFieldMapping> mappings)
    {
        var duplicates = new List<DuplicateMatch>();

        var titleColumn = mappings.FirstOrDefault(m => m.EntityField.Equals("Title", StringComparison.OrdinalIgnoreCase))?.CsvColumn;
        if (titleColumn == null)
            return duplicates;

        var titles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row.TryGetValue(titleColumn, out var title) && !string.IsNullOrWhiteSpace(title))
                titles.Add(title.Trim().ToLowerInvariant());
        }

        if (titles.Count == 0)
            return duplicates;

        var existingByTitle = await _db.Deals
            .Where(d => titles.Contains(d.Title.ToLower()))
            .Select(d => new { d.Id, Title = d.Title.ToLower() })
            .ToListAsync();

        var titleMap = existingByTitle
            .GroupBy(d => d.Title)
            .ToDictionary(g => g.Key, g => g.First().Id);

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row.TryGetValue(titleColumn, out var rowTitle) && !string.IsNullOrWhiteSpace(rowTitle))
            {
                var normalizedTitle = rowTitle.Trim().ToLowerInvariant();
                if (titleMap.TryGetValue(normalizedTitle, out var existingId))
                {
                    duplicates.Add(new DuplicateMatch(i, existingId, "Title", normalizedTitle));
                }
            }
        }

        return duplicates;
    }
}

/// <summary>
/// Represents a duplicate match found during import preview.
/// </summary>
/// <param name="RowIndex">Zero-based index of the CSV row that matches an existing entity.</param>
/// <param name="ExistingEntityId">ID of the existing entity in the database.</param>
/// <param name="MatchField">The field used for matching (e.g., "Email", "Name").</param>
/// <param name="MatchValue">The normalized value that matched.</param>
public record DuplicateMatch(
    int RowIndex,
    Guid ExistingEntityId,
    string MatchField,
    string MatchValue);
