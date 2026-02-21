import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EmailStore } from '../email.store';
import { EmailDetailDto } from '../email.models';
import { EmailComposeComponent, ComposeDialogData } from '../email-compose/email-compose.component';

/**
 * Email thread detail view showing chronological messages with expand/collapse.
 * Provides EmailStore at component level for isolated state.
 * Loads email detail by ID, then loads full thread by gmailThreadId.
 * Supports reply (opens compose dialog), mark as read/unread, and star toggle.
 */
@Component({
  selector: 'app-email-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  providers: [EmailStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .detail-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .header-left h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 500;
      word-break: break-word;
    }

    .thread-meta {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-left: 48px;
      margin-bottom: 24px;
      font-size: 13px;
      color: var(--color-text-secondary);
    }

    .thread-meta a {
      color: var(--color-primary);
      text-decoration: none;
    }

    .thread-meta a:hover {
      text-decoration: underline;
    }

    .action-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .message-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message-card {
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--color-border);
      transition: box-shadow 0.2s ease;
    }

    .message-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .message-card.inbound {
      border-left: 4px solid var(--color-primary);
    }

    .message-card.outbound {
      border-left: 4px solid #4caf50;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      user-select: none;
    }

    .message-header:hover {
      background: var(--color-surface-hover);
    }

    .direction-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .direction-icon.inbound {
      color: var(--color-primary);
    }

    .direction-icon.outbound {
      color: #4caf50;
    }

    .message-sender-info {
      flex: 1;
      min-width: 0;
    }

    .sender-line {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
    }

    .sender-address {
      color: var(--color-text-secondary);
      font-weight: 400;
      font-size: 12px;
    }

    .message-preview {
      font-size: 13px;
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 2px;
    }

    .message-date {
      font-size: 12px;
      color: var(--color-text-secondary);
      white-space: nowrap;
    }

    .message-status-icons {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .message-status-icons mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .status-unread {
      color: var(--color-primary);
    }

    .status-starred {
      color: var(--color-warning);
    }

    .status-attachment {
      color: var(--color-text-muted);
    }

    .message-body {
      padding: 0 16px 16px;
    }

    .message-recipients {
      font-size: 12px;
      color: var(--color-text-secondary);
      margin-bottom: 12px;
    }

    .message-recipients span {
      margin-right: 16px;
    }

    .message-content {
      font-size: 14px;
      line-height: 1.6;
      word-break: break-word;
      overflow: hidden;
    }

    .message-content img {
      max-width: 100%;
      height: auto;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--color-text-secondary);
    }

    @media (max-width: 768px) {
      .detail-header {
        flex-direction: column;
        gap: 12px;
      }

      .action-bar {
        flex-wrap: wrap;
      }

      .thread-meta {
        padding-left: 0;
        flex-wrap: wrap;
      }
    }
  `,
  template: `
    @if (store.isDetailLoading() && !store.selectedItem()) {
      <div class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
      </div>
    } @else if (store.selectedItem()) {
      <div class="detail-container">
        <!-- Header -->
        <div class="detail-header">
          <div class="header-left">
            <a mat-icon-button routerLink="/emails" [attr.aria-label]="'emails.detail.backToEmails' | transloco">
              <mat-icon>arrow_back</mat-icon>
            </a>
            <h1>{{ threadSubject() }}</h1>
          </div>
        </div>

        <!-- Thread metadata -->
        <div class="thread-meta">
          <span>{{ (threadMessageCount() === 1 ? 'emails.detail.messages' : 'emails.detail.messagesPlural') | transloco:{ count: threadMessageCount() } }}</span>
          @if (store.selectedItem()!.linkedContactId) {
            <span>
              {{ 'emails.detail.contact' | transloco }}: <a [routerLink]="['/contacts', store.selectedItem()!.linkedContactId]">
                {{ store.selectedItem()!.linkedContactName }}
              </a>
            </span>
          }
          @if (store.selectedItem()!.linkedCompanyName) {
            <span>{{ 'emails.detail.company' | transloco }}: {{ store.selectedItem()!.linkedCompanyName }}</span>
          }
        </div>

        <!-- Action Bar -->
        <div class="action-bar">
          <button mat-raised-button color="primary" (click)="onReply()">
            <mat-icon>reply</mat-icon> {{ 'emails.detail.reply' | transloco }}
          </button>
          <button mat-stroked-button (click)="onToggleRead()">
            <mat-icon>{{ store.selectedItem()!.isRead ? 'mark_email_unread' : 'mark_email_read' }}</mat-icon>
            {{ (store.selectedItem()!.isRead ? 'emails.detail.markUnread' : 'emails.detail.markRead') | transloco }}
          </button>
          <button mat-stroked-button (click)="onToggleStar()">
            <mat-icon>{{ store.selectedItem()!.isStarred ? 'star' : 'star_border' }}</mat-icon>
            {{ (store.selectedItem()!.isStarred ? 'emails.detail.unstar' : 'emails.detail.star') | transloco }}
          </button>
        </div>

        <!-- Message Chain -->
        @if (store.isDetailLoading() && !store.selectedThread()) {
          <div class="loading-container">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else {
          <div class="message-list">
            @for (message of threadMessages(); track message.gmailMessageId; let i = $index) {
              <div class="message-card" [class.inbound]="message.isInbound" [class.outbound]="!message.isInbound">
                <!-- Message Header (clickable to expand/collapse) -->
                <div class="message-header" (click)="toggleMessage(i)">
                  <mat-icon class="direction-icon" [class.inbound]="message.isInbound" [class.outbound]="!message.isInbound">
                    {{ message.isInbound ? 'arrow_downward' : 'arrow_upward' }}
                  </mat-icon>

                  <div class="message-sender-info">
                    <div class="sender-line">
                      <span>{{ message.fromName || message.fromAddress }}</span>
                      @if (message.fromName) {
                        <span class="sender-address">&lt;{{ message.fromAddress }}&gt;</span>
                      }
                    </div>
                    @if (!expandedMessages()[i]) {
                      <div class="message-preview">
                        {{ message.bodyPreview || message.subject }}
                      </div>
                    }
                  </div>

                  <div class="message-status-icons">
                    @if (!message.isRead) {
                      <mat-icon class="status-unread">fiber_manual_record</mat-icon>
                    }
                    @if (message.isStarred) {
                      <mat-icon class="status-starred">star</mat-icon>
                    }
                    @if (message.hasAttachments) {
                      <mat-icon class="status-attachment">attach_file</mat-icon>
                    }
                  </div>

                  <span class="message-date">{{ formatDate(message.sentAt) }}</span>
                </div>

                <!-- Message Body (shown when expanded) -->
                @if (expandedMessages()[i]) {
                  <div class="message-body">
                    <div class="message-recipients">
                      <span>{{ 'emails.detail.to' | transloco }}: {{ message.toAddresses?.join(', ') }}</span>
                      @if (message.ccAddresses && message.ccAddresses.length > 0) {
                        <span>{{ 'emails.detail.cc' | transloco }}: {{ message.ccAddresses.join(', ') }}</span>
                      }
                    </div>
                    <mat-divider></mat-divider>
                    <div class="message-content" style="margin-top: 12px;">
                      @if (message.bodyHtml) {
                        <div [innerHTML]="message.bodyHtml"></div>
                      } @else {
                        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">{{ message.bodyText || ('emails.detail.noContent' | transloco) }}</pre>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <div class="empty-state">
        <h2>{{ 'emails.detail.notFound' | transloco }}</h2>
        <a mat-button routerLink="/emails">{{ 'emails.detail.backToList' | transloco }}</a>
      </div>
    }
  `,
})
export class EmailDetailComponent implements OnInit {
  readonly store = inject(EmailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** Tracks which messages are expanded (by index). */
  expandedMessages = signal<Record<number, boolean>>({});

  /** Thread subject from first message or selected email. */
  threadSubject = computed(() => {
    const thread = this.store.selectedThread();
    if (thread?.subject) return thread.subject;
    return this.store.selectedItem()?.subject ?? '';
  });

  /** Count of messages in thread. */
  threadMessageCount = computed(() => {
    const thread = this.store.selectedThread();
    return thread?.messageCount ?? 1;
  });

  /** Messages in chronological order (oldest first). */
  threadMessages = computed(() => {
    const thread = this.store.selectedThread();
    if (thread?.messages?.length) {
      return [...thread.messages].sort(
        (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
      );
    }
    // Fallback to single selected email if thread not loaded yet
    const selected = this.store.selectedItem();
    return selected ? [selected] : [];
  });

  /** Date formatter for message timestamps. */
  private readonly dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  /** Email ID from route. */
  private emailId = '';

  ngOnInit(): void {
    this.emailId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.emailId) return;

    // Load email detail by ID
    this.store.loadById(this.emailId);

    // Watch for selectedItem to load thread once we have the gmailThreadId
    // Using a simple polling approach since we need to wait for the detail to load
    this.waitForDetailAndLoadThread();
  }

  /** Wait for detail to be loaded, then load the thread. */
  private waitForDetailAndLoadThread(): void {
    const check = () => {
      const detail = this.store.selectedItem();
      if (detail?.gmailThreadId) {
        this.store.loadThread(detail.gmailThreadId);
        // Expand the most recent message by default
        this.expandLatestMessage();
      } else if (this.store.isDetailLoading()) {
        setTimeout(check, 100);
      }
    };
    setTimeout(check, 100);
  }

  /** Expand the most recent (last) message by default. */
  private expandLatestMessage(): void {
    // Small delay to let thread load
    const expandCheck = () => {
      const messages = this.threadMessages();
      if (messages.length > 0) {
        const expanded: Record<number, boolean> = {};
        expanded[messages.length - 1] = true;
        this.expandedMessages.set(expanded);
      } else if (this.store.isDetailLoading()) {
        setTimeout(expandCheck, 100);
      }
    };
    setTimeout(expandCheck, 200);
  }

  /** Toggle expand/collapse of a message by index. */
  toggleMessage(index: number): void {
    const current = this.expandedMessages();
    this.expandedMessages.set({
      ...current,
      [index]: !current[index],
    });
  }

  /** Format a date string for display. */
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return this.dateFormatter.format(new Date(dateStr));
  }

  /** Open reply compose dialog. */
  onReply(): void {
    const detail = this.store.selectedItem();
    if (!detail) return;

    const data: ComposeDialogData = {
      replyToThreadId: detail.gmailThreadId,
      to: detail.isInbound ? detail.fromAddress : detail.toAddresses?.[0] ?? '',
      subject: detail.subject.startsWith('Re: ')
        ? detail.subject
        : `Re: ${detail.subject}`,
    };

    const dialogRef = this.dialog.open(EmailComposeComponent, {
      width: '600px',
      disableClose: true,
      data,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && detail.gmailThreadId) {
        // Reload thread to show new reply
        this.store.loadThread(detail.gmailThreadId);
      }
    });
  }

  /** Toggle read/unread status. */
  onToggleRead(): void {
    const detail = this.store.selectedItem();
    if (!detail) return;

    // Currently only markAsRead is supported by the API
    // For unread, we would need markAsUnread endpoint -- using markAsRead for now
    this.store.markAsRead(detail.id);
    this.snackBar.open(this.transloco.translate('emails.messages.markedRead'), 'OK', { duration: 3000 });
  }

  /** Toggle star status. */
  onToggleStar(): void {
    const detail = this.store.selectedItem();
    if (!detail) return;

    this.store.toggleStar(detail.id);
    this.snackBar.open(
      detail.isStarred ? this.transloco.translate('emails.messages.starRemoved') : this.transloco.translate('emails.messages.starred'),
      'OK',
      { duration: 3000 },
    );
  }
}
