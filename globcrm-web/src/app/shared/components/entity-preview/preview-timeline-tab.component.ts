import { Component, ChangeDetectionStrategy, input, inject, signal, OnInit } from '@angular/core';
import { ApiService } from '../../../core/api/api.service';
import { EntityTimelineComponent, TimelineEntry } from '../entity-timeline/entity-timeline.component';

const ENTITY_PLURAL_MAP: Record<string, string> = {
  Contact: 'contacts',
  Company: 'companies',
  Deal: 'deals',
  Lead: 'leads',
  Activity: 'activities',
  Product: 'products',
};

@Component({
  selector: 'app-preview-timeline-tab',
  standalone: true,
  imports: [EntityTimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-entity-timeline [entries]="entries()" [isLoading]="isLoading()" />
  `,
})
export class PreviewTimelineTabComponent implements OnInit {
  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();

  private readonly api = inject(ApiService);

  readonly isLoading = signal(true);
  readonly entries = signal<TimelineEntry[]>([]);

  ngOnInit(): void {
    const plural = ENTITY_PLURAL_MAP[this.entityType()] ?? this.entityType().toLowerCase() + 's';
    this.api.get<TimelineEntry[]>(`/api/${plural}/${this.entityId()}/timeline`).subscribe({
      next: (data) => {
        this.entries.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}
