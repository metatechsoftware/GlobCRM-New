namespace GlobCRM.Infrastructure.Workflows;

/// <summary>
/// Prevents infinite workflow cascading by tracking execution depth and processed pairs.
/// Uses AsyncLocal for within-request cascading (when an action's SaveChanges re-enters
/// the handler synchronously). For cross-Hangfire-job depth tracking, the current depth
/// is passed as a job parameter and restored at the start of WorkflowExecutionService.
/// </summary>
public class WorkflowLoopGuard
{
    /// <summary>
    /// Maximum allowed execution depth before blocking further workflow triggers.
    /// Conservative limit for CRM workflows — prevents infinite cascading.
    /// </summary>
    public const int MaxDepth = 5;

    private static readonly AsyncLocal<int> _currentDepth = new();
    private static readonly AsyncLocal<HashSet<string>?> _processedPairs = new();

    /// <summary>
    /// Gets the current execution depth from AsyncLocal context.
    /// </summary>
    public int CurrentDepth => _currentDepth.Value;

    /// <summary>
    /// Checks whether execution is allowed at the current depth.
    /// Returns false if depth limit has been reached.
    /// </summary>
    public bool CanExecute()
    {
        return _currentDepth.Value < MaxDepth;
    }

    /// <summary>
    /// Attempts to mark a workflow+entity pair as processed in the current execution chain.
    /// Returns false if this pair has already been processed (preventing duplicate execution).
    /// </summary>
    /// <param name="workflowId">The workflow being executed.</param>
    /// <param name="entityId">The entity that triggered the workflow.</param>
    /// <returns>True if the pair was newly added; false if it was already processed.</returns>
    public bool TryMarkProcessed(Guid workflowId, Guid entityId)
    {
        var pairs = _processedPairs.Value;
        if (pairs is null)
        {
            pairs = new HashSet<string>();
            _processedPairs.Value = pairs;
        }

        var key = $"{workflowId}:{entityId}";
        return pairs.Add(key);
    }

    /// <summary>
    /// Increments the execution depth and returns a disposable scope
    /// that decrements the depth when disposed.
    /// </summary>
    public IDisposable IncrementDepth()
    {
        _currentDepth.Value++;
        return new DepthScope();
    }

    /// <summary>
    /// Sets the current depth explicitly. Used to restore depth from Hangfire job parameters
    /// across job boundaries (since AsyncLocal does not survive serialization).
    /// </summary>
    /// <param name="depth">The depth value to restore.</param>
    public void SetDepth(int depth)
    {
        _currentDepth.Value = depth;
    }

    /// <summary>
    /// Disposable scope that decrements the execution depth when disposed.
    /// </summary>
    private sealed class DepthScope : IDisposable
    {
        public void Dispose()
        {
            _currentDepth.Value--;
            if (_currentDepth.Value <= 0)
            {
                _currentDepth.Value = 0;
                _processedPairs.Value = null;
            }
        }
    }
}
