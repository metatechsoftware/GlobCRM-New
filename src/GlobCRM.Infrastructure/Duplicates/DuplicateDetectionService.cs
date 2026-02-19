using FuzzySharp;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Duplicates;

/// <summary>
/// Two-tier duplicate detection service.
/// Tier 1: pg_trgm database pre-filter via EF.Functions.TrigramsSimilarity()
/// Tier 2: FuzzySharp weighted in-memory scoring (TokenSortRatio, Ratio)
/// </summary>
public class DuplicateDetectionService : IDuplicateDetectionService
{
    private readonly ApplicationDbContext _db;

    public DuplicateDetectionService(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<List<DuplicateMatch>> FindContactDuplicatesAsync(
        string? firstName, string? lastName, string? email,
        int threshold, Guid? excludeId = null)
    {
        var fullName = $"{firstName} {lastName}".Trim();
        if (string.IsNullOrWhiteSpace(fullName) && string.IsNullOrWhiteSpace(email))
            return new List<DuplicateMatch>();

        // Tier 1: pg_trgm database pre-filter
        // Use a lower threshold than final to be inclusive (50% of configured threshold)
        var dbThreshold = (threshold / 100.0) * 0.5;

        var query = _db.Contacts
            .Where(c => excludeId == null || c.Id != excludeId);

        // Build the similarity filter
        if (!string.IsNullOrWhiteSpace(fullName) && !string.IsNullOrWhiteSpace(email))
        {
            query = query.Where(c =>
                EF.Functions.TrigramsSimilarity(c.FirstName + " " + c.LastName, fullName) > dbThreshold
                || (c.Email != null && EF.Functions.TrigramsSimilarity(c.Email, email) > dbThreshold));
        }
        else if (!string.IsNullOrWhiteSpace(fullName))
        {
            query = query.Where(c =>
                EF.Functions.TrigramsSimilarity(c.FirstName + " " + c.LastName, fullName) > dbThreshold);
        }
        else // email only
        {
            query = query.Where(c =>
                c.Email != null && EF.Functions.TrigramsSimilarity(c.Email, email!) > dbThreshold);
        }

        var candidates = await query
            .Select(c => new
            {
                c.Id,
                c.FirstName,
                c.LastName,
                c.Email,
                c.UpdatedAt
            })
            .Take(50)
            .ToListAsync();

        // Tier 2: FuzzySharp composite scoring
        var scored = new List<DuplicateMatch>();
        foreach (var c in candidates)
        {
            var candidateName = $"{c.FirstName} {c.LastName}".Trim();
            var score = CalculateContactScore(fullName, email, candidateName, c.Email);

            if (score >= threshold)
            {
                scored.Add(new DuplicateMatch(
                    c.Id,
                    candidateName,
                    c.Email,
                    score,
                    c.UpdatedAt));
            }
        }

        return scored
            .OrderByDescending(m => m.Score)
            .Take(10)
            .ToList();
    }

    /// <inheritdoc />
    public async Task<List<DuplicateMatch>> FindCompanyDuplicatesAsync(
        string? name, string? website,
        int threshold, Guid? excludeId = null)
    {
        if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(website))
            return new List<DuplicateMatch>();

        // Tier 1: pg_trgm database pre-filter
        var dbThreshold = (threshold / 100.0) * 0.5;

        var query = _db.Companies
            .Where(c => excludeId == null || c.Id != excludeId);

        if (!string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(website))
        {
            query = query.Where(c =>
                EF.Functions.TrigramsSimilarity(c.Name, name) > dbThreshold
                || (c.Website != null && EF.Functions.TrigramsSimilarity(c.Website, website) > dbThreshold));
        }
        else if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(c =>
                EF.Functions.TrigramsSimilarity(c.Name, name) > dbThreshold);
        }
        else // website only
        {
            query = query.Where(c =>
                c.Website != null && EF.Functions.TrigramsSimilarity(c.Website, website!) > dbThreshold);
        }

        var candidates = await query
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Website,
                c.UpdatedAt
            })
            .Take(50)
            .ToListAsync();

        // Tier 2: FuzzySharp composite scoring
        var scored = new List<DuplicateMatch>();
        foreach (var c in candidates)
        {
            var score = CalculateCompanyScore(name, website, c.Name, c.Website);

            if (score >= threshold)
            {
                scored.Add(new DuplicateMatch(
                    c.Id,
                    c.Name,
                    c.Website,
                    score,
                    c.UpdatedAt));
            }
        }

        return scored
            .OrderByDescending(m => m.Score)
            .Take(10)
            .ToList();
    }

    /// <inheritdoc />
    public async Task<List<DuplicatePair>> ScanContactDuplicatesAsync(
        int threshold, int page, int pageSize)
    {
        // Load contacts in batches for comparison
        var contacts = await _db.Contacts
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.FirstName,
                c.LastName,
                c.Email,
                c.UpdatedAt
            })
            .ToListAsync();

        var pairs = new List<DuplicatePair>();

        // Compare each contact against subsequent contacts
        for (var i = 0; i < contacts.Count; i++)
        {
            var a = contacts[i];
            var aName = $"{a.FirstName} {a.LastName}".Trim();

            for (var j = i + 1; j < contacts.Count; j++)
            {
                var b = contacts[j];
                var bName = $"{b.FirstName} {b.LastName}".Trim();

                var score = CalculateContactScore(aName, a.Email, bName, b.Email);

                if (score >= threshold)
                {
                    pairs.Add(new DuplicatePair(
                        new DuplicateMatch(a.Id, aName, a.Email, score, a.UpdatedAt),
                        new DuplicateMatch(b.Id, bName, b.Email, score, b.UpdatedAt),
                        score));
                }
            }
        }

        return pairs
            .OrderByDescending(p => p.Score)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();
    }

    /// <inheritdoc />
    public async Task<List<DuplicatePair>> ScanCompanyDuplicatesAsync(
        int threshold, int page, int pageSize)
    {
        var companies = await _db.Companies
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Website,
                c.UpdatedAt
            })
            .ToListAsync();

        var pairs = new List<DuplicatePair>();

        for (var i = 0; i < companies.Count; i++)
        {
            var a = companies[i];

            for (var j = i + 1; j < companies.Count; j++)
            {
                var b = companies[j];

                var score = CalculateCompanyScore(a.Name, a.Website, b.Name, b.Website);

                if (score >= threshold)
                {
                    pairs.Add(new DuplicatePair(
                        new DuplicateMatch(a.Id, a.Name, a.Website, score, a.UpdatedAt),
                        new DuplicateMatch(b.Id, b.Name, b.Website, score, b.UpdatedAt),
                        score));
                }
            }
        }

        return pairs
            .OrderByDescending(p => p.Score)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();
    }

    /// <summary>
    /// Calculate weighted contact duplicate score.
    /// Name weight: 50%, Email weight: 50%.
    /// If email is null on either side, name gets 100%.
    /// </summary>
    private static int CalculateContactScore(
        string? sourceName, string? sourceEmail,
        string? candidateName, string? candidateEmail)
    {
        var hasName = !string.IsNullOrWhiteSpace(sourceName) && !string.IsNullOrWhiteSpace(candidateName);
        var hasEmail = !string.IsNullOrWhiteSpace(sourceEmail) && !string.IsNullOrWhiteSpace(candidateEmail);

        if (!hasName && !hasEmail) return 0;

        double score = 0;

        if (hasName && hasEmail)
        {
            // Both fields available: 50/50 weight
            var nameScore = Fuzz.TokenSortRatio(sourceName!, candidateName!) / 100.0;
            var emailScore = Fuzz.Ratio(sourceEmail!.ToLowerInvariant(), candidateEmail!.ToLowerInvariant()) / 100.0;
            score = (0.5 * nameScore) + (0.5 * emailScore);
        }
        else if (hasName)
        {
            // Name only: 100% name weight
            score = Fuzz.TokenSortRatio(sourceName!, candidateName!) / 100.0;
        }
        else // hasEmail only
        {
            // Email only: 100% email weight
            score = Fuzz.Ratio(sourceEmail!.ToLowerInvariant(), candidateEmail!.ToLowerInvariant()) / 100.0;
        }

        return (int)Math.Round(score * 100);
    }

    /// <summary>
    /// Calculate weighted company duplicate score.
    /// Company name weight: 60%, Domain/Website weight: 40%.
    /// If website is null on either side, name gets 100%.
    /// </summary>
    private static int CalculateCompanyScore(
        string? sourceName, string? sourceWebsite,
        string? candidateName, string? candidateWebsite)
    {
        var hasName = !string.IsNullOrWhiteSpace(sourceName) && !string.IsNullOrWhiteSpace(candidateName);
        var hasWebsite = !string.IsNullOrWhiteSpace(sourceWebsite) && !string.IsNullOrWhiteSpace(candidateWebsite);

        if (!hasName && !hasWebsite) return 0;

        double score = 0;

        if (hasName && hasWebsite)
        {
            // Both fields available: 60/40 weight
            var nameScore = Fuzz.TokenSortRatio(sourceName!, candidateName!) / 100.0;
            var domainScore = Fuzz.Ratio(
                ExtractDomain(sourceWebsite!).ToLowerInvariant(),
                ExtractDomain(candidateWebsite!).ToLowerInvariant()) / 100.0;
            score = (0.6 * nameScore) + (0.4 * domainScore);
        }
        else if (hasName)
        {
            // Name only: 100% name weight
            score = Fuzz.TokenSortRatio(sourceName!, candidateName!) / 100.0;
        }
        else // hasWebsite only
        {
            // Website only: 100% domain weight
            score = Fuzz.Ratio(
                ExtractDomain(sourceWebsite!).ToLowerInvariant(),
                ExtractDomain(candidateWebsite!).ToLowerInvariant()) / 100.0;
        }

        return (int)Math.Round(score * 100);
    }

    /// <summary>
    /// Extract domain from a URL or website string.
    /// Strips protocol (http/https), www prefix, and path.
    /// e.g., "https://www.example.com/about" -> "example.com"
    /// </summary>
    private static string ExtractDomain(string websiteOrUrl)
    {
        if (string.IsNullOrWhiteSpace(websiteOrUrl))
            return string.Empty;

        var domain = websiteOrUrl.Trim();

        // Strip protocol
        if (domain.Contains("://"))
            domain = domain[(domain.IndexOf("://") + 3)..];

        // Strip path
        var slashIndex = domain.IndexOf('/');
        if (slashIndex >= 0)
            domain = domain[..slashIndex];

        // Strip www prefix
        if (domain.StartsWith("www.", StringComparison.OrdinalIgnoreCase))
            domain = domain[4..];

        return domain;
    }
}
