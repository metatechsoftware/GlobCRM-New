import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgClass, PercentPipe } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QuickActionBarComponent } from '../quick-action-bar/quick-action-bar.component';
import { MiniStageBarComponent } from '../entity-preview/mini-stage-bar.component';
import { DealPipelineChartComponent } from './deal-pipeline-chart.component';
import { EmailEngagementCardComponent } from './email-engagement-card.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { StageInfoDto } from '../../models/entity-preview.models';
import {
  EntitySummaryData,
  CompanySummaryDto,
  ContactSummaryDto,
  DealSummaryDto,
  LeadSummaryDto,
  QuoteSummaryDto,
  RequestSummaryDto,
  SummaryAssociationDto,
  DealStageInfoDto,
  LeadStageInfoDto,
} from './summary.models';

@Component({
  selector: 'app-entity-summary-tab',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    NgClass,
    PercentPipe,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    QuickActionBarComponent,
    MiniStageBarComponent,
    DealPipelineChartComponent,
    EmailEngagementCardComponent,
    TranslocoPipe,
    HasPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entity-summary-tab.component.html',
  styleUrl: './entity-summary-tab.component.scss',
})
export class EntitySummaryTabComponent {
  readonly entityType = input.required<string>();
  readonly data = input.required<EntitySummaryData | null>();
  readonly loading = input(false);

  readonly associationClicked = output<string>();
  readonly addNote = output<void>();
  readonly logActivity = output<void>();
  readonly sendEmail = output<void>();

  readonly isCompanyOrContact = computed(() =>
    ['Company', 'Contact'].includes(this.entityType())
  );

  readonly isDealOrLead = computed(() =>
    ['Deal', 'Lead'].includes(this.entityType())
  );

  readonly isContact = computed(() => this.entityType() === 'Contact');

  readonly showSendEmail = computed(() =>
    ['Contact', 'Lead'].includes(this.entityType())
  );

  /** Type-narrowed accessors for template use */
  readonly companyData = computed(() =>
    this.entityType() === 'Company' && this.data() ? this.data() as CompanySummaryDto : null
  );

  readonly contactData = computed(() =>
    this.entityType() === 'Contact' && this.data() ? this.data() as ContactSummaryDto : null
  );

  readonly dealData = computed(() =>
    this.entityType() === 'Deal' && this.data() ? this.data() as DealSummaryDto : null
  );

  readonly leadData = computed(() =>
    this.entityType() === 'Lead' && this.data() ? this.data() as LeadSummaryDto : null
  );

  readonly quoteData = computed(() =>
    this.entityType() === 'Quote' && this.data() ? this.data() as QuoteSummaryDto : null
  );

  readonly requestData = computed(() =>
    this.entityType() === 'Request' && this.data() ? this.data() as RequestSummaryDto : null
  );

  /** Deal pipeline data for Company and Contact summary tabs */
  readonly dealPipeline = computed(() =>
    this.companyData()?.dealPipeline ?? this.contactData()?.dealPipeline ?? null
  );

  /** Email engagement data for Contact summary tab */
  readonly emailEngagement = computed(() =>
    this.contactData()?.emailEngagement ?? null
  );

  /** Convert DealStageInfoDto[] to StageInfoDto[] for MiniStageBarComponent */
  readonly dealStages = computed((): StageInfoDto[] => {
    const deal = this.dealData();
    if (!deal) return [];
    return deal.stages.map(s => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      color: s.color,
    }));
  });

  readonly dealCurrentStage = computed(() => {
    const deal = this.dealData();
    if (!deal) return { id: '', sortOrder: 0 };
    const current = deal.stages.find(s => s.isCurrent);
    return current ? { id: current.id, sortOrder: current.sortOrder } : { id: '', sortOrder: 0 };
  });

  /** Convert LeadStageInfoDto[] to StageInfoDto[] for MiniStageBarComponent */
  readonly leadStages = computed((): StageInfoDto[] => {
    const lead = this.leadData();
    if (!lead) return [];
    return lead.stages.map(s => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      color: s.color,
    }));
  });

  readonly leadCurrentStage = computed(() => {
    const lead = this.leadData();
    if (!lead) return { id: '', sortOrder: 0 };
    const current = lead.stages.find(s => s.isCurrent);
    return current ? { id: current.id, sortOrder: current.sortOrder } : { id: '', sortOrder: 0 };
  });

  readonly leadTerminalStage = computed(() => {
    const lead = this.leadData();
    if (!lead) return null;
    return lead.stages.find(s => s.isTerminal && s.isCurrent) ?? null;
  });

  onAssociationClick(association: SummaryAssociationDto): void {
    this.associationClicked.emit(association.label);
  }

  getActivityTypeClass(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('call')) return 'call';
    if (t.includes('email')) return 'email';
    if (t.includes('meeting')) return 'meeting';
    if (t.includes('task')) return 'task';
    return 'default';
  }

  getRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return date.toLocaleDateString();
  }
}
