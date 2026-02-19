using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for EmailSequence CRUD operations.
/// Implementations use ApplicationDbContext with tenant-scoped global query filters.
/// </summary>
public interface IEmailSequenceRepository
{
    /// <summary>
    /// Gets all sequences for the current tenant, ordered by CreatedAt descending.
    /// </summary>
    Task<List<EmailSequence>> GetAllAsync(Guid tenantId);

    /// <summary>
    /// Gets a sequence by ID with Steps eagerly loaded (ordered by StepNumber).
    /// </summary>
    Task<EmailSequence?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets a specific step within a sequence by step number.
    /// </summary>
    Task<EmailSequenceStep?> GetStepAsync(Guid sequenceId, int stepNumber);

    /// <summary>
    /// Gets a sequence by ID with Steps and each Step's EmailTemplate eagerly loaded.
    /// Used by the sequence builder view to display template details inline.
    /// </summary>
    Task<EmailSequence?> GetByIdWithStepsAndTemplatesAsync(Guid id);

    /// <summary>
    /// Creates a new email sequence.
    /// </summary>
    Task<EmailSequence> CreateAsync(EmailSequence sequence);

    /// <summary>
    /// Updates an existing email sequence.
    /// </summary>
    Task UpdateAsync(EmailSequence sequence);

    /// <summary>
    /// Deletes an email sequence by ID. Cascade-deletes steps.
    /// </summary>
    Task DeleteAsync(Guid id);
}
