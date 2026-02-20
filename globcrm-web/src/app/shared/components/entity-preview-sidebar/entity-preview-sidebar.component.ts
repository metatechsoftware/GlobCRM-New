import { Component, ChangeDetectionStrategy, inject, computed, signal, effect } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { PreviewSidebarStore } from '../../stores/preview-sidebar.store';
import { getEntityConfig, EntityTypeConfig } from '../../services/entity-type-registry';
import { SlideInPanelService } from '../../services/slide-in-panel/slide-in-panel.service';
import { SlideInEntityType } from '../../services/slide-in-panel/slide-in-panel.models';
import { PreviewEntry } from '../../models/entity-preview.models';
import { PreviewSkeletonComponent } from './preview-skeleton.component';
import { PreviewBreadcrumbsComponent } from './preview-breadcrumbs.component';
import { ContactPreviewComponent } from '../entity-preview/contact-preview.component';
import { CompanyPreviewComponent } from '../entity-preview/company-preview.component';
import { DealPreviewComponent } from '../entity-preview/deal-preview.component';
import { LeadPreviewComponent } from '../entity-preview/lead-preview.component';
import { ActivityPreviewComponent } from '../entity-preview/activity-preview.component';
import { ProductPreviewComponent } from '../entity-preview/product-preview.component';
import { AssociationChipsComponent } from '../entity-preview/association-chips.component';
import { MiniTimelineComponent } from '../entity-preview/mini-timeline.component';
import { PreviewNotesTabComponent } from '../entity-preview/preview-notes-tab.component';
import { PreviewActivitiesTabComponent } from '../entity-preview/preview-activities-tab.component';
import { PreviewTimelineTabComponent } from '../entity-preview/preview-timeline-tab.component';
import { QuickActionBarComponent } from '../quick-action-bar/quick-action-bar.component';

interface TabDef {
  label: string;
  icon: string;
  key: string;
}

const ALL_TABS: Record<string, TabDef> = {
  overview: { label: 'Overview', icon: 'info', key: 'overview' },
  notes: { label: 'Notes', icon: 'note', key: 'notes' },
  activities: { label: 'Activities', icon: 'task_alt', key: 'activities' },
  timeline: { label: 'Timeline', icon: 'timeline', key: 'timeline' },
};

const ENTITY_TABS: Record<string, string[]> = {
  Contact: ['overview', 'notes', 'activities', 'timeline'],
  Company: ['overview', 'notes', 'activities', 'timeline'],
  Deal: ['overview', 'notes', 'activities', 'timeline'],
  Lead: ['overview', 'activities', 'timeline'],
  Activity: ['overview', 'notes', 'timeline'],
  Product: ['overview'],
};

@Component({
  selector: 'app-entity-preview-sidebar',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTabsModule,
    PreviewSkeletonComponent,
    PreviewBreadcrumbsComponent,
    ContactPreviewComponent,
    CompanyPreviewComponent,
    DealPreviewComponent,
    LeadPreviewComponent,
    ActivityPreviewComponent,
    ProductPreviewComponent,
    AssociationChipsComponent,
    MiniTimelineComponent,
    PreviewNotesTabComponent,
    PreviewActivitiesTabComponent,
    PreviewTimelineTabComponent,
    QuickActionBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entity-preview-sidebar.component.html',
  styleUrls: ['./entity-preview-sidebar.component.scss'],
})
export class EntityPreviewSidebarComponent {
  readonly store = inject(PreviewSidebarStore);
  private readonly slideInPanelService = inject(SlideInPanelService);
  private readonly router = inject(Router);

  readonly activeTabIndex = signal(0);

  readonly entityConfig = computed<EntityTypeConfig | null>(() => {
    const entry = this.store.currentEntry();
    return entry ? getEntityConfig(entry.entityType) : null;
  });

  readonly availableTabs = computed<TabDef[]>(() => {
    const entry = this.store.currentEntry();
    if (!entry) return [ALL_TABS['overview']];
    const tabKeys = ENTITY_TABS[entry.entityType] ?? ['overview'];
    return tabKeys.map((key) => ALL_TABS[key]);
  });

  /** Quick actions shown for all entity types except Product */
  readonly showQuickActions = computed(() => {
    const entry = this.store.currentEntry();
    return entry != null && entry.entityType !== 'Product';
  });

  /** Send Email shown only for Contact and Lead (entities with direct email) */
  readonly showSendEmail = computed(() => {
    const entry = this.store.currentEntry();
    return entry?.entityType === 'Contact' || entry?.entityType === 'Lead';
  });

  constructor() {
    // Reset tab to Overview when entity changes
    effect(() => {
      this.store.currentEntry(); // track
      this.activeTabIndex.set(0);
    });
  }

  onAssociationClick(entry: PreviewEntry): void {
    if (entry.entityId) {
      this.store.pushPreview(entry);
    }
  }

  onViewAllActivities(): void {
    this.store.openFullRecord();
  }

  onBreadcrumbNavigate(index: number): void {
    this.store.navigateTo(index);
  }

  onQuickAction(type: 'Note' | 'Activity'): void {
    const entry = this.store.currentEntry();
    if (!entry) return;

    const panelRef = this.slideInPanelService.open({
      entityType: type as SlideInEntityType,
      title: `New ${type}`,
      context: 'preview-sidebar',
      parentEntityType: entry.entityType,
      parentEntityId: entry.entityId,
    });

    panelRef.afterClosed.subscribe((result) => {
      if (result) {
        // Silent refresh to show the new note/activity in the sidebar
        this.store.refreshCurrent();
      }
    });
  }

  onSendEmail(): void {
    // Navigate to email compose (per Phase 24 decision: email is too complex for slide-in)
    this.router.navigate(['/emails'], { queryParams: { compose: 'true' } });
  }
}
