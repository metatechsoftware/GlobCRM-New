import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { CardDto } from '../boards.models';
import { PreviewSidebarStore } from '../../../shared/stores/preview-sidebar.store';

/**
 * Board card component — renders a single Trello-style compact card in a kanban column.
 * Displays label color bars, title, entity link badge, due date urgency,
 * stacked assignee avatars, checklist progress, comment count, and hover action buttons.
 */
@Component({
  selector: 'app-board-card',
  standalone: true,
  imports: [DatePipe, SlicePipe, MatIconModule, MatTooltipModule, TranslocoPipe],
  templateUrl: './board-card.component.html',
  styleUrl: './board-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardCardComponent {
  private readonly previewSidebarStore = inject(PreviewSidebarStore);

  /** Required card data */
  readonly card = input.required<CardDto>();

  /** Board ID for API calls */
  readonly boardId = input.required<string>();

  /** Emits card ID when user clicks the card (opens card detail panel) */
  readonly cardClicked = output<string>();

  /** Emits card ID when user archives via hover action */
  readonly cardArchived = output<string>();

  /** Entity type icon mapping */
  private readonly entityTypeIcons: Record<string, string> = {
    Contact: 'people',
    Company: 'business',
    Deal: 'handshake',
    Lead: 'person_search',
    Activity: 'task_alt',
    Note: 'sticky_note_2',
    Quote: 'request_quote',
  };

  /** Due date urgency classification */
  readonly dueDateUrgency = computed(() => {
    const dueDate = this.card().dueDate;
    if (!dueDate) return null;

    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue' as const;
    if (diffDays === 0) return 'today' as const;
    if (diffDays <= 3) return 'approaching' as const;
    return 'normal' as const;
  });

  /** Whether checklist is complete */
  readonly checklistComplete = computed(() => {
    const c = this.card();
    return c.checklistTotal > 0 && c.checklistChecked === c.checklistTotal;
  });

  /** Get icon for entity type */
  getEntityIcon(entityType: string | null): string {
    if (!entityType) return 'link';
    return this.entityTypeIcons[entityType] ?? 'link';
  }

  /** Get 2-letter initials from name */
  getInitials(name: string | null): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts
      .map((p) => p.charAt(0))
      .join('')
      .substring(0, 2)
      .toLocaleUpperCase();
  }

  /** Get tooltip showing all assignee names */
  getAssigneeTooltip(): string {
    return this.card().assignees.map((a) => a.name).join(', ');
  }

  /** Click handler for the card body */
  onCardClick(): void {
    this.cardClicked.emit(this.card().id);
  }

  /** Click handler for entity badge — opens preview sidebar instead of card detail */
  onEntityClick(event: Event): void {
    event.stopPropagation();
    const card = this.card();
    if (card.linkedEntityType && card.linkedEntityId) {
      this.previewSidebarStore.open({
        entityType: card.linkedEntityType,
        entityId: card.linkedEntityId,
        entityName: card.linkedEntityName ?? undefined,
      });
    }
  }

  /** Hover action: edit */
  onEdit(event: Event): void {
    event.stopPropagation();
    this.cardClicked.emit(this.card().id);
  }

  /** Hover action: archive */
  onArchive(event: Event): void {
    event.stopPropagation();
    this.cardArchived.emit(this.card().id);
  }

  /** Hover action: label (emits event for Plan 05) */
  onLabel(event: Event): void {
    event.stopPropagation();
    // Opens quick label picker — wired in Plan 05
    this.cardClicked.emit(this.card().id);
  }
}
