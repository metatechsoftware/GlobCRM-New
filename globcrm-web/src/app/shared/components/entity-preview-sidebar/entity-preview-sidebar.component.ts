import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PreviewSidebarStore } from '../../stores/preview-sidebar.store';
import { getEntityConfig, EntityTypeConfig } from '../../services/entity-type-registry';
import { PreviewEntry } from '../../models/entity-preview.models';
import { PreviewSkeletonComponent } from './preview-skeleton.component';
import { ContactPreviewComponent } from '../entity-preview/contact-preview.component';
import { CompanyPreviewComponent } from '../entity-preview/company-preview.component';
import { DealPreviewComponent } from '../entity-preview/deal-preview.component';
import { LeadPreviewComponent } from '../entity-preview/lead-preview.component';
import { ActivityPreviewComponent } from '../entity-preview/activity-preview.component';
import { ProductPreviewComponent } from '../entity-preview/product-preview.component';
import { AssociationChipsComponent } from '../entity-preview/association-chips.component';
import { MiniTimelineComponent } from '../entity-preview/mini-timeline.component';

@Component({
  selector: 'app-entity-preview-sidebar',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    PreviewSkeletonComponent,
    ContactPreviewComponent,
    CompanyPreviewComponent,
    DealPreviewComponent,
    LeadPreviewComponent,
    ActivityPreviewComponent,
    ProductPreviewComponent,
    AssociationChipsComponent,
    MiniTimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entity-preview-sidebar.component.html',
  styleUrls: ['./entity-preview-sidebar.component.scss'],
})
export class EntityPreviewSidebarComponent {
  readonly store = inject(PreviewSidebarStore);

  readonly entityConfig = computed<EntityTypeConfig | null>(() => {
    const entry = this.store.currentEntry();
    return entry ? getEntityConfig(entry.entityType) : null;
  });

  onAssociationClick(entry: PreviewEntry): void {
    if (entry.entityId) {
      this.store.pushPreview(entry);
    }
  }

  onViewAllActivities(): void {
    this.store.openFullRecord();
  }
}
