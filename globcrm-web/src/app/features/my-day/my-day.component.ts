import { Component, ChangeDetectionStrategy, inject, computed, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { PreviewSidebarStore } from '../../shared/stores/preview-sidebar.store';
import { MyDayStore } from './my-day.store';
import { MyDayService } from './my-day.service';
import { GreetingBannerComponent } from './widgets/greeting-banner/greeting-banner.component';
import { TasksWidgetComponent } from './widgets/tasks-widget/tasks-widget.component';
import { UpcomingEventsWidgetComponent } from './widgets/upcoming-events-widget/upcoming-events-widget.component';

@Component({
  selector: 'app-my-day',
  standalone: true,
  imports: [
    GreetingBannerComponent,
    TasksWidgetComponent,
    UpcomingEventsWidgetComponent,
  ],
  providers: [MyDayStore, MyDayService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-day.component.html',
  styleUrl: './my-day.component.scss',
})
export class MyDayComponent {
  readonly store = inject(MyDayStore);
  private readonly authStore = inject(AuthStore);
  private readonly previewSidebarStore = inject(PreviewSidebarStore);
  private readonly router = inject(Router);

  /** Extract first name from full user name. */
  readonly firstName = computed(() => {
    const name = this.authStore.userName();
    return name?.split(' ')[0] ?? '';
  });

  constructor() {
    afterNextRender(() => {
      this.store.loadMyDay();
    });
  }

  onTaskCompleted(taskId: string): void {
    this.store.completeTask(taskId);
  }

  onEntityClicked(event: { type: string; id: string }): void {
    this.previewSidebarStore.open({
      entityType: event.type,
      entityId: event.id,
    });
  }

  onEventClicked(eventId: string): void {
    this.router.navigate([`/activities/${eventId}`]);
  }

  onQuickAction(type: string): void {
    // Placeholder: will be wired in 24-05
    console.log('Quick action:', type);
  }
}
