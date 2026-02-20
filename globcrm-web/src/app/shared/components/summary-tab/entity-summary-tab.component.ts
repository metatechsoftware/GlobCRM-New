import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QuickActionBarComponent } from '../quick-action-bar/quick-action-bar.component';
import { MiniStageBarComponent } from '../entity-preview/mini-stage-bar.component';
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
    PercentPipe,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    QuickActionBarComponent,
    MiniStageBarComponent,
    HasPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entity-summary-tab.component.html',
  styleUrl: './entity-summary-tab.component.scss',
})
export class EntitySummaryTabComponent {
  readonly entityType = input.required<string>();
  readonly data = input.required<EntitySummaryData>();
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
    this.entityType() === 'Company' ? this.data() as CompanySummaryDto : null
  );

  readonly contactData = computed(() =>
    this.entityType() === 'Contact' ? this.data() as ContactSummaryDto : null
  );

  readonly dealData = computed(() =>
    this.entityType() === 'Deal' ? this.data() as DealSummaryDto : null
  );

  readonly leadData = computed(() =>
    this.entityType() === 'Lead' ? this.data() as LeadSummaryDto : null
  );

  readonly quoteData = computed(() =>
    this.entityType() === 'Quote' ? this.data() as QuoteSummaryDto : null
  );

  readonly requestData = computed(() =>
    this.entityType() === 'Request' ? this.data() as RequestSummaryDto : null
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
}
