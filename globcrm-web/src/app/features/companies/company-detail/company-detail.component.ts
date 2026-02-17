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
import { TimelineEntry } from '../../../shared/models/query.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';

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
    HasPermissionDirective,
    RelatedEntityTabsComponent,
    EntityTimelineComponent,
    CustomFieldFormComponent,
  ],
  templateUrl: './company-detail.component.html',
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

    .section-title {
      margin: 24px 0 12px;
      font-size: 16px;
      font-weight: 500;
    }

    .contacts-tab {
      min-height: 100px;
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

      .details-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CompanyDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly companyService = inject(CompanyService);
  private readonly activityService = inject(ActivityService);
  private readonly permissionStore = inject(PermissionStore);
  private readonly dialog = inject(MatDialog);

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

  /** Timeline entries. */
  timelineEntries = signal<TimelineEntry[]>([]);
  timelineLoading = signal(false);

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
  }

  /** Load company detail data. */
  private loadCompany(): void {
    this.isLoading.set(true);
    this.companyService.getById(this.companyId).subscribe({
      next: (company) => {
        this.company.set(company);
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

  /** Handle tab change -- lazy load contacts/activities when tab is selected. */
  onTabChanged(index: number): void {
    if (index === 1) {
      this.loadContacts();
    }
    if (index === 3) {
      this.loadLinkedActivities();
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
    return ACTIVITY_STATUSES.find(s => s.value === status)?.color ?? '#757575';
  }

  /** Get priority color for activity chip. */
  getPriorityColor(priority: string): string {
    return ACTIVITY_PRIORITIES.find(p => p.value === priority)?.color ?? '#757575';
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
