import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import {
  RelatedEntityTabsComponent,
  CONTACT_TABS,
} from '../../../shared/components/related-entity-tabs/related-entity-tabs.component';
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { ContactService } from '../contact.service';
import { ContactDetailDto } from '../contact.models';
import { ActivityListDto, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES } from '../../activities/activity.models';
import { ActivityService } from '../../activities/activity.service';
import { QuoteService } from '../../quotes/quote.service';
import { QuoteListDto, QUOTE_STATUSES } from '../../quotes/quote.models';
import { RequestService } from '../../requests/request.service';
import { RequestListDto, REQUEST_STATUSES, REQUEST_PRIORITIES } from '../../requests/request.models';
import { EmailService } from '../../emails/email.service';
import { EmailListDto } from '../../emails/email.models';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';

/**
 * Contact detail page with tabs (Details, Company, and disabled future tabs)
 * and a timeline sidebar showing entity events.
 */
@Component({
  selector: 'app-contact-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    HasPermissionDirective,
    RelatedEntityTabsComponent,
    EntityTimelineComponent,
    CustomFieldFormComponent,
  ],
  templateUrl: './contact-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .detail-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 64px;
    }

    .detail-page {
      padding: 16px 24px;
    }

    .detail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-left h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .detail-subheader {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 24px;
      padding-left: 48px;
    }

    .subheader-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .subheader-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .subheader-item a {
      color: var(--mat-sys-primary, #1976d2);
      text-decoration: none;
    }

    .subheader-item a:hover {
      text-decoration: underline;
    }

    .detail-content {
      display: flex;
      gap: 24px;
    }

    .detail-main {
      flex: 1;
      min-width: 0;
    }

    .detail-sidebar {
      width: 320px;
      flex-shrink: 0;
    }

    .sidebar-title {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 500;
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .detail-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-field.full-width {
      grid-column: 1 / -1;
    }

    .field-label {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .field-value {
      font-size: 14px;
      color: var(--mat-sys-on-surface, rgba(0, 0, 0, 0.87));
    }

    .field-value a {
      color: var(--mat-sys-primary, #1976d2);
      text-decoration: none;
    }

    .field-value a:hover {
      text-decoration: underline;
    }

    .section-title {
      margin: 24px 0 12px;
      font-size: 16px;
      font-weight: 500;
    }

    .company-tab {
      min-height: 100px;
    }

    .company-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .no-company {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 32px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .no-company mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.5;
    }

    .tab-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 24px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      text-align: center;
    }

    .tab-placeholder mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.4;
    }

    .tab-loading, .tab-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .tab-empty mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.5;
    }

    .activities-table {
      width: 100%;
      border-collapse: collapse;
    }

    .activities-table th {
      text-align: left;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      padding: 8px 12px;
      border-bottom: 2px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }

    .activities-table td {
      padding: 10px 12px;
      font-size: 14px;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.08));
      vertical-align: middle;
    }

    .activities-table a {
      color: var(--mat-sys-primary, #1976d2);
      text-decoration: none;
    }

    .activities-table a:hover {
      text-decoration: underline;
    }

    .detail-not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 64px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .detail-not-found mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
    }

    @media (max-width: 1024px) {
      .detail-content {
        flex-direction: column;
      }

      .detail-sidebar {
        width: 100%;
      }

      .details-grid, .company-info-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ContactDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contactService = inject(ContactService);
  private readonly activityService = inject(ActivityService);
  private readonly quoteService = inject(QuoteService);
  private readonly requestService = inject(RequestService);
  private readonly emailService = inject(EmailService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly dialog = inject(MatDialog);

  /** Contact detail data. */
  contact = signal<ContactDetailDto | null>(null);
  isLoading = signal(true);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Activities linked to this contact. */
  linkedActivities = signal<ActivityListDto[]>([]);
  activitiesLoading = signal(false);
  activitiesLoaded = signal(false);

  /** Quotes linked to this contact. */
  linkedQuotes = signal<QuoteListDto[]>([]);
  quotesLoading = signal(false);
  quotesLoaded = signal(false);

  /** Requests linked to this contact. */
  linkedRequests = signal<RequestListDto[]>([]);
  requestsLoading = signal(false);
  requestsLoaded = signal(false);

  /** Emails linked to this contact. */
  contactEmails = signal<EmailListDto[]>([]);
  emailsLoading = signal(false);
  emailsLoaded = signal(false);

  /** Tab configuration for contact detail. */
  readonly tabs = CONTACT_TABS;

  /** Current contact ID from route. */
  private contactId = '';

  ngOnInit(): void {
    this.contactId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.contactId) {
      this.isLoading.set(false);
      return;
    }

    this.loadContact();
    this.loadTimeline();
  }

  /** Load contact detail data. */
  private loadContact(): void {
    this.isLoading.set(true);
    this.contactService.getById(this.contactId).subscribe({
      next: (contact) => {
        this.contact.set(contact);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /** Load timeline entries. */
  private loadTimeline(): void {
    this.timelineLoading.set(true);
    this.contactService.getTimeline(this.contactId).subscribe({
      next: (entries) => {
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Handle tab change -- lazy load activities/quotes/requests/emails when tab is selected. */
  onTabChanged(index: number): void {
    // Company tab data comes from the contact detail DTO itself.
    if (index === 3) {
      this.loadLinkedActivities();
    }
    if (index === 4) {
      this.loadLinkedQuotes();
    }
    if (index === 5) {
      this.loadLinkedRequests();
    }
    if (index === 6) {
      this.loadContactEmails();
    }
  }

  /** Load activities linked to this contact (lazy on tab switch). */
  private loadLinkedActivities(): void {
    if (this.activitiesLoaded() || this.activitiesLoading()) return;

    this.activitiesLoading.set(true);
    this.activityService
      .getList({ linkedEntityType: 'Contact', linkedEntityId: this.contactId, page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedActivities.set(result.items);
          this.activitiesLoading.set(false);
          this.activitiesLoaded.set(true);
        },
        error: () => {
          this.activitiesLoading.set(false);
        },
      });
  }

  /** Get status color for activity chip. */
  getStatusColor(status: string): string {
    return ACTIVITY_STATUSES.find(s => s.value === status)?.color ?? '#757575';
  }

  /** Get priority color for activity chip. */
  getPriorityColor(priority: string): string {
    return ACTIVITY_PRIORITIES.find(p => p.value === priority)?.color ?? '#757575';
  }

  /** Get quote status color. */
  getQuoteStatusColor(status: string): string {
    return QUOTE_STATUSES.find(s => s.value === status)?.color ?? '#757575';
  }

  /** Get request status color. */
  getRequestStatusColor(status: string): string {
    return REQUEST_STATUSES.find(s => s.value === status)?.color ?? '#757575';
  }

  /** Get request priority color. */
  getRequestPriorityColor(priority: string): string {
    return REQUEST_PRIORITIES.find(p => p.value === priority)?.color ?? '#757575';
  }

  /** Format currency value. */
  formatCurrency(value: number | null): string {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /** Load quotes linked to this contact (lazy on tab switch). */
  private loadLinkedQuotes(): void {
    if (this.quotesLoaded() || this.quotesLoading()) return;

    this.quotesLoading.set(true);
    this.quoteService
      .getList({ filters: [{ fieldId: 'contactId', operator: 'eq', value: this.contactId }], page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedQuotes.set(result.items);
          this.quotesLoading.set(false);
          this.quotesLoaded.set(true);
        },
        error: () => {
          this.quotesLoading.set(false);
        },
      });
  }

  /** Load requests linked to this contact (lazy on tab switch). */
  private loadLinkedRequests(): void {
    if (this.requestsLoaded() || this.requestsLoading()) return;

    this.requestsLoading.set(true);
    this.requestService
      .getList({ filters: [{ fieldId: 'contactId', operator: 'eq', value: this.contactId }], page: 1, pageSize: 50 })
      .subscribe({
        next: (result) => {
          this.linkedRequests.set(result.items);
          this.requestsLoading.set(false);
          this.requestsLoaded.set(true);
        },
        error: () => {
          this.requestsLoading.set(false);
        },
      });
  }

  /** Load emails linked to this contact (lazy on tab switch). */
  private loadContactEmails(): void {
    if (this.emailsLoaded() || this.emailsLoading()) return;

    this.emailsLoading.set(true);
    this.emailService
      .getByContact(this.contactId, { pageSize: 20, sortField: 'sentAt', sortDirection: 'desc' })
      .subscribe({
        next: (result) => {
          this.contactEmails.set(result.items);
          this.emailsLoading.set(false);
          this.emailsLoaded.set(true);
        },
        error: () => {
          this.emailsLoading.set(false);
        },
      });
  }

  /** Format email date for display. */
  formatEmailDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateStr));
  }

  /** Handle delete with confirmation dialog. */
  onDelete(): void {
    const contact = this.contact();
    if (!contact) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: contact.fullName, type: 'contact' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.contactService.delete(this.contactId).subscribe({
          next: () => {
            this.router.navigate(['/contacts']);
          },
          error: () => {
            // Error is handled by ApiService interceptor
          },
        });
      }
    });
  }
}
