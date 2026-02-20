import { Component, ChangeDetectionStrategy, inject, computed, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { PreviewSidebarStore } from '../../shared/stores/preview-sidebar.store';
import { MyDayStore } from './my-day.store';
import { MyDayService } from './my-day.service';
import { SlideInPanelService } from './slide-in-panel/slide-in-panel.service';
import { SlideInEntityType, FollowUpStep } from './slide-in-panel/slide-in-panel.models';
import { GreetingBannerComponent } from './widgets/greeting-banner/greeting-banner.component';
import { TasksWidgetComponent } from './widgets/tasks-widget/tasks-widget.component';
import { UpcomingEventsWidgetComponent } from './widgets/upcoming-events-widget/upcoming-events-widget.component';
import { PipelineWidgetComponent } from './widgets/pipeline-widget/pipeline-widget.component';
import { EmailSummaryWidgetComponent } from './widgets/email-summary-widget/email-summary-widget.component';
import { FeedPreviewWidgetComponent } from './widgets/feed-preview-widget/feed-preview-widget.component';
import { NotificationDigestWidgetComponent } from './widgets/notification-digest-widget/notification-digest-widget.component';
import { RecentRecordsWidgetComponent } from './widgets/recent-records-widget/recent-records-widget.component';

@Component({
  selector: 'app-my-day',
  standalone: true,
  imports: [
    GreetingBannerComponent,
    TasksWidgetComponent,
    UpcomingEventsWidgetComponent,
    PipelineWidgetComponent,
    EmailSummaryWidgetComponent,
    FeedPreviewWidgetComponent,
    NotificationDigestWidgetComponent,
    RecentRecordsWidgetComponent,
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
  private readonly slideInPanelService = inject(SlideInPanelService);
  private readonly router = inject(Router);

  /** Follow-up steps per entity type (single-step form first, then optional follow-up). */
  private readonly followUpStepMap: Record<string, FollowUpStep[]> = {
    Contact: [
      { label: 'Link to a company', icon: 'business', action: 'link-to-company' },
      { label: 'Schedule a follow-up', icon: 'event', action: 'schedule-follow-up' },
    ],
    Deal: [
      { label: 'Add a note', icon: 'note_add', action: 'add-note' },
      { label: 'Schedule a follow-up', icon: 'event', action: 'schedule-follow-up' },
    ],
    Activity: [], // No follow-up for activities
    Note: [], // No follow-up for notes
  };

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

  onEmailClicked(emailId: string): void {
    this.router.navigate([`/emails/${emailId}`]);
  }

  onEventClicked(eventId: string): void {
    this.router.navigate([`/activities/${eventId}`]);
  }

  onQuickAction(type: string): void {
    // Email is special — route to email feature instead of slide-in
    if (type === 'Email') {
      this.router.navigate(['/emails'], { queryParams: { compose: true } });
      return;
    }

    const entityType = type as SlideInEntityType;
    const title = `New ${type}`;
    const followUpSteps = this.followUpStepMap[type] ?? [];

    const panelRef = this.slideInPanelService.open({
      entityType,
      title,
      followUpSteps: followUpSteps.length > 0 ? followUpSteps : undefined,
    });

    panelRef.afterClosed.subscribe((result) => {
      if (result) {
        // Entity was created — refresh all widget data
        this.store.refreshData();

        // Set highlight on the new entity so user sees where it landed
        if (result.entity?.id) {
          this.store.setHighlight(result.entity.id);
        }

        // Handle follow-up action if user chose one
        if (result.followUpAction === 'schedule-follow-up') {
          // Open slide-in again with Activity type for follow-up scheduling
          this.slideInPanelService.open({ entityType: 'Activity', title: 'Schedule Follow-up' });
        } else if (result.followUpAction === 'add-note') {
          this.slideInPanelService.open({ entityType: 'Note', title: 'Add Note' });
        }
        // 'link-to-company' — TODO: Open company linking UI in a future iteration
      }
    });
  }
}
