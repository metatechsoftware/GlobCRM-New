using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Notifications;
using GlobCRM.Infrastructure.Persistence;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Sequences;

/// <summary>
/// Detects replies to sequence emails by matching inbound message thread IDs
/// against sent sequence email tracking events. On reply detection, auto-unenrolls
/// the contact and dispatches an in-app notification.
///
/// Called from GmailSyncService.SyncSingleMessageAsync after inbound message is saved.
/// Failures in reply detection must NEVER break email sync (wrapped in try/catch by caller).
/// </summary>
public class SequenceReplyDetector
{
    private readonly ApplicationDbContext _db;
    private readonly ISequenceEnrollmentRepository _enrollmentRepository;
    private readonly NotificationDispatcher _notificationDispatcher;
    private readonly ILogger<SequenceReplyDetector> _logger;

    public SequenceReplyDetector(
        ApplicationDbContext db,
        ISequenceEnrollmentRepository enrollmentRepository,
        NotificationDispatcher notificationDispatcher,
        ILogger<SequenceReplyDetector> logger)
    {
        _db = db;
        _enrollmentRepository = enrollmentRepository;
        _notificationDispatcher = notificationDispatcher;
        _logger = logger;
    }

    /// <summary>
    /// Checks if an inbound email message is a reply to a sequence email.
    /// If so, auto-unenrolls the contact and dispatches a notification.
    /// </summary>
    /// <param name="inboundMessage">The synced inbound email message.</param>
    public async Task CheckForSequenceReplyAsync(EmailMessage inboundMessage)
    {
        // Only process inbound messages
        if (!inboundMessage.IsInbound)
            return;

        if (string.IsNullOrEmpty(inboundMessage.GmailThreadId))
            return;

        // Strategy: Check if this message's GmailThreadId matches a sent sequence email's GmailThreadId
        var sequenceEmail = await _db.SequenceTrackingEvents
            .Where(e => e.GmailThreadId == inboundMessage.GmailThreadId
                        && e.EventType == "sent")
            .OrderByDescending(e => e.CreatedAt)
            .FirstOrDefaultAsync();

        if (sequenceEmail is null)
            return;

        // Load enrollment
        var enrollment = await _enrollmentRepository.GetByIdAsync(sequenceEmail.EnrollmentId);
        if (enrollment is null || enrollment.Status != EnrollmentStatus.Active)
            return;

        _logger.LogInformation(
            "Reply detected: enrollment {EnrollmentId} step {StepNumber} from thread {ThreadId}",
            enrollment.Id, sequenceEmail.StepNumber, inboundMessage.GmailThreadId);

        // Auto-unenroll per locked decision
        enrollment.Status = EnrollmentStatus.Replied;
        enrollment.RepliedAt = DateTimeOffset.UtcNow;
        enrollment.ReplyStepNumber = sequenceEmail.StepNumber;

        // Cancel pending next-step job (defense-in-depth, per research recommendation)
        if (!string.IsNullOrEmpty(enrollment.HangfireJobId))
        {
            try
            {
                BackgroundJob.Delete(enrollment.HangfireJobId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to cancel Hangfire job {JobId} for enrollment {EnrollmentId}",
                    enrollment.HangfireJobId, enrollment.Id);
            }
        }

        await _enrollmentRepository.UpdateAsync(enrollment);

        // Dispatch notification
        try
        {
            // Load sequence name and contact name for notification message
            var sequence = await _db.EmailSequences
                .AsNoTracking()
                .Where(s => s.Id == enrollment.SequenceId)
                .Select(s => new { s.Name })
                .FirstOrDefaultAsync();

            var contact = await _db.Contacts
                .AsNoTracking()
                .Where(c => c.Id == enrollment.ContactId)
                .Select(c => new { FullName = c.FirstName + " " + c.LastName })
                .FirstOrDefaultAsync();

            var contactName = contact?.FullName?.Trim() ?? "Contact";
            var sequenceName = sequence?.Name ?? "Sequence";

            await _notificationDispatcher.DispatchAsync(new NotificationRequest
            {
                RecipientId = enrollment.CreatedByUserId,
                Type = NotificationType.SequenceReply,
                Title = "Sequence Reply Received",
                Message = $"{contactName} replied to Step {sequenceEmail.StepNumber} of {sequenceName} and was unenrolled",
                EntityType = "SequenceEnrollment",
                EntityId = enrollment.Id
            }, enrollment.TenantId);
        }
        catch (Exception ex)
        {
            // Notification failure must not fail the reply detection flow
            _logger.LogError(ex,
                "Failed to dispatch reply notification for enrollment {EnrollmentId}",
                enrollment.Id);
        }
    }
}
