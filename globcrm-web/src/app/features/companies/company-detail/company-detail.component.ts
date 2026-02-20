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
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionStore } from '../../../core/permissions/permission.store';
import {
  RelatedEntityTabsComponent,
  COMPANY_TABS,
} from '../../../shared/components/related-entity-tabs/related-entity-tabs.component';
import { EntityTimelineComponent } from '../../../shared/components/entity-timeline/entity-timeline.component';
import { CustomFieldFormComponent } from '../../../shared/components/custom-field-form/custom-field-form.component';
import { CompanyService } from '../company.service';
import { CompanyDetailDto } from '../company.models';
import { ContactDto } from '../../contacts/contact.models';
import { ActivityListDto, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES } from '../../activities/activity.models';
import { ActivityService } from '../../activities/activity.service';
import { QuoteService } from '../../quotes/quote.service';
import { QuoteListDto, QUOTE_STATUSES } from '../../quotes/quote.models';
import { RequestService } from '../../requests/request.service';
import { RequestListDto, REQUEST_STATUSES, REQUEST_PRIORITIES } from '../../requests/request.models';
import { EmailService } from '../../emails/email.service';
import { EmailListDto } from '../../emails/email.models';
import { NoteService } from '../../notes/note.service';
import { NoteListDto } from '../../notes/note.models';
import { EntityAttachmentsComponent } from '../../../shared/components/entity-attachments/entity-attachments.component';
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { EntitySummaryTabComponent } from '../../../shared/components/summary-tab/entity-summary-tab.component';
import { EntityFormDialogComponent } from '../../../shared/components/entity-form-dialog/entity-form-dialog.component';
import { EntityFormDialogData, EntityFormDialogResult } from '../../../shared/components/entity-form-dialog/entity-form-dialog.models';
import { SummaryService } from '../../../shared/components/summary-tab/summary.service';
import { CompanySummaryDto } from '../../../shared/components/summary-tab/summary.models';

/**
 * Company detail page with tabs (Details, Contacts, and disabled future tabs)
 * and a timeline sidebar showing entity events.
 */
@Component({
  selector: 'app-company-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    HasPermissionDirective,
    RelatedEntityTabsComponent,
    EntityTimelineComponent,
    CustomFieldFormComponent,
    EntityAttachmentsComponent,
    EntitySummaryTabComponent,
  ],
  templateUrl: './company-detail.component.html',
  styleUrl: './company-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly companyService = inject(CompanyService);
  private readonly activityService = inject(ActivityService);
  private readonly quoteService = inject(QuoteService);
  private readonly requestService = inject(RequestService);
  private readonly emailService = inject(EmailService);
  private readonly noteService = inject(NoteService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly summaryService = inject(SummaryService);

  /** Company detail data. */
  company = signal<CompanyDetailDto | null>(null);
  isLoading = signal(true);

  /** Contacts linked to this company. */
  contacts = signal<ContactDto[]>([]);
  contactsLoading = signal(false);

  /** Activities linked to this company. */
  linkedActivities = signal<ActivityListDto[]>([]);
  activitiesLoading = signal(false);
  activitiesLoaded = signal(false);

  /** Quotes linked to this company. */
  linkedQuotes = signal<QuoteListDto[]>([]);
  quotesLoading = signal(false);
  quotesLoaded = signal(false);

  /** Requests linked to this company. */
  linkedRequests = signal<RequestListDto[]>([]);
  requestsLoading = signal(false);
  requestsLoaded = signal(false);

  /** Emails linked to this company. */
  companyEmails = signal<EmailListDto[]>([]);
  emailsLoading = signal(false);
  emailsLoaded = signal(false);

  /** Notes linked to this company. */
  companyNotes = signal<NoteListDto[]>([]);
  notesLoading = signal(false);
  notesLoaded = signal(false);

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

  /** Summary tab data. */
  summaryData = signal<CompanySummaryDto | null>(null);
  summaryLoading = signal(false);
  summaryDirty = signal(false);
  activeTabIndex = signal(0);

  /** Tab configuration for company detail. */
  readonly tabs = COMPANY_TABS;

  /** Current company ID from route. */
  private companyId = '';

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.companyId) {
      this.isLoading.set(false);
      return;
    }

    this.loadCompany();
    this.loadTimeline();
    this.loadSummary();
  }

  /** Load summary data for the Summary tab. */
  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryDirty.set(false);
    this.summaryService.getCompanySummary(this.companyId).subscribe({
      next: (data) => {
        this.summaryData.set(data);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
  }

  /** Mark summary data as stale so it refreshes when the Summary tab is re-selected. */
  markSummaryDirty(): void {
    this.summaryDirty.set(true);
  }

  /** Load company detail data. Handles merged-record redirects. */
  private loadCompany(): void {
    this.isLoading.set(true);
    this.companyService.getById(this.companyId).subscribe({
      next: (response: any) => {
        // Check if the response is a merged-record redirect
        if (response?.isMerged && response?.mergedIntoId) {
          this.snackBar.open(
            'This company was merged into another record. Redirecting...',
            'Close',
            { duration: 3000 }
          );
          this.router.navigate(['/companies', response.mergedIntoId], {
            replaceUrl: true,
          });
          return;
        }
        this.company.set(response);
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
    this.companyService.getTimeline(this.companyId).subscribe({
      next: (entries) => {
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
      },
    });
  }

  /** Load contacts for the Contacts tab (lazy on tab switch). */
  private loadContacts(): void {
    if (this.contacts().length > 0 || this.contactsLoading()) return;

    this.contactsLoading.set(true);
    this.companyService.getCompanyContacts(this.companyId).subscribe({
      next: (contacts) => {
        this.contacts.set(contacts);
        this.contactsLoading.set(false);
      },
      error: () => {
        this.contactsLoading.set(false);
      },
    });
  }

  /** Handle tab change -- lazy load contacts/activities/quotes/requests/emails when tab is selected. */
  onTabChanged(label: string): void {
    if (label === 'Summary') {
      if (!this.summaryData() || this.summaryDirty()) {
        this.loadSummary();
      }
      return;
    }
    if (label === 'Contacts') {
      this.loadContacts();
    }
    if (label === 'Activities') {
      this.loadLinkedActivities();
    }
    if (label === 'Quotes') {
      this.loadLinkedQuotes();
    }
    if (label === 'Requests') {
      this.loadLinkedRequests();
    }
    if (label === 'Emails') {
      this.loadCompanyEmails();
    }
    if (label === 'Notes') {
      this.loadCompanyNotes();
    }
  }

  /** Load activities linked to this company (lazy on tab switch). */
  private loadLinkedActivities(): void {
    if (this.activitiesLoaded() || this.activitiesLoading()) return;

    this.activitiesLoading.set(true);
    this.activityService
      .getList({ linkedEntityType: 'Company', linkedEntityId: this.companyId, page: 1, pageSize: 50 })
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
    return ACTIVITY_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get priority color for activity chip. */
  getPriorityColor(priority: string): string {
    return ACTIVITY_PRIORITIES.find(p => p.value === priority)?.color ?? 'var(--color-text-muted)';
  }

  /** Get quote status color. */
  getQuoteStatusColor(status: string): string {
    return QUOTE_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get request status color. */
  getRequestStatusColor(status: string): string {
    return REQUEST_STATUSES.find(s => s.value === status)?.color ?? 'var(--color-text-muted)';
  }

  /** Get request priority color. */
  getRequestPriorityColor(priority: string): string {
    return REQUEST_PRIORITIES.find(p => p.value === priority)?.color ?? 'var(--color-text-muted)';
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

  /** Load quotes linked to this company (lazy on tab switch). */
  private loadLinkedQuotes(): void {
    if (this.quotesLoaded() || this.quotesLoading()) return;

    this.quotesLoading.set(true);
    this.quoteService
      .getList({ filters: [{ fieldId: 'companyId', operator: 'eq', value: this.companyId }], page: 1, pageSize: 50 })
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

  /** Load requests linked to this company (lazy on tab switch). */
  private loadLinkedRequests(): void {
    if (this.requestsLoaded() || this.requestsLoading()) return;

    this.requestsLoading.set(true);
    this.requestService
      .getList({ filters: [{ fieldId: 'companyId', operator: 'eq', value: this.companyId }], page: 1, pageSize: 50 })
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

  /** Load emails linked to this company (lazy on tab switch). */
  private loadCompanyEmails(): void {
    if (this.emailsLoaded() || this.emailsLoading()) return;

    this.emailsLoading.set(true);
    this.emailService
      .getByCompany(this.companyId, { pageSize: 20, sortField: 'sentAt', sortDirection: 'desc' })
      .subscribe({
        next: (result) => {
          this.companyEmails.set(result.items);
          this.emailsLoading.set(false);
          this.emailsLoaded.set(true);
        },
        error: () => {
          this.emailsLoading.set(false);
        },
      });
  }

  /** Load notes linked to this company (lazy on tab switch). */
  private loadCompanyNotes(): void {
    if (this.notesLoaded() || this.notesLoading()) return;

    this.notesLoading.set(true);
    this.noteService
      .getEntityNotes('Company', this.companyId)
      .subscribe({
        next: (notes) => {
          this.companyNotes.set(notes);
          this.notesLoading.set(false);
          this.notesLoaded.set(true);
        },
        error: () => {
          this.notesLoading.set(false);
        },
      });
  }

  /** Format note date for display. */
  formatNoteDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
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

  /** Get 2-letter initials from company name. */
  getInitials(): string {
    const name = this.company()?.name ?? '';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /** Handle association chip click -- switch to the corresponding tab. */
  onAssociationClicked(label: string): void {
    const index = COMPANY_TABS.findIndex(t => t.label === label);
    if (index >= 0) {
      this.activeTabIndex.set(index);
    }
  }

  /** Quick action: Add Note via dialog. */
  onSummaryAddNote(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      width: '700px',
      data: {
        entityType: 'Note',
        prefill: {
          entityType: 'Company',
          entityId: this.companyId,
          entityName: this.company()?.name,
        },
      } as EntityFormDialogData,
    });
    dialogRef.afterClosed().subscribe((result: EntityFormDialogResult | undefined) => {
      if (result?.entity) {
        this.loadSummary();
      }
    });
  }

  /** Quick action: Log Activity via dialog. */
  onSummaryLogActivity(): void {
    const dialogRef = this.dialog.open(EntityFormDialogComponent, {
      width: '700px',
      data: {
        entityType: 'Activity',
        prefill: {
          entityType: 'Company',
          entityId: this.companyId,
          entityName: this.company()?.name,
        },
      } as EntityFormDialogData,
    });
    dialogRef.afterClosed().subscribe((result: EntityFormDialogResult | undefined) => {
      if (result?.entity) {
        this.loadSummary();
      }
    });
  }

  /** Quick action: Send Email (not applicable for Company). */
  onSummarySendEmail(): void {
    // Company does not have a direct email target; no-op
  }

  /** Handle delete with confirmation dialog. */
  onDelete(): void {
    const company = this.company();
    if (!company) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: company.name, type: 'company' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.companyService.delete(this.companyId).subscribe({
          next: () => {
            this.router.navigate(['/companies']);
          },
          error: () => {
            // Error is handled by ApiService interceptor
          },
        });
      }
    });
  }
}
