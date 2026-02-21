import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { LabelDto, CardFilter } from '../boards.models';

/** Assignee option for the filter */
export interface AssigneeOption {
  id: string | null;
  name: string;
}

/**
 * Board filter panel — collapsible filter bar below board header.
 * Filters cards client-side by label, assignee, and due date range.
 */
@Component({
  selector: 'app-board-filter-panel',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule, TranslocoPipe],
  templateUrl: './board-filter-panel.component.html',
  styleUrl: './board-filter-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardFilterPanelComponent {
  /** Whether the filter panel is open */
  readonly isOpen = input<boolean>(false);

  /** Available board labels */
  readonly labels = input<LabelDto[]>([]);

  /** Available assignees (extracted from board cards) */
  readonly assignees = input<AssigneeOption[]>([]);

  /** Current filter state */
  readonly filter = input<CardFilter>({
    labels: [],
    assigneeId: null,
    dueDateRange: null,
  });

  /** Emitted when filter changes */
  readonly filterChanged = output<CardFilter>();

  /** Emitted when clear all is clicked */
  readonly clearAll = output<void>();

  /** Currently selected label IDs (local state synced from input) */
  readonly selectedLabels = computed(() => this.filter().labels);

  /** Currently selected assignee */
  readonly selectedAssigneeId = computed(() => this.filter().assigneeId);

  /** Currently selected due date range */
  readonly selectedDueDateRange = computed(() => this.filter().dueDateRange);

  /** Count of active filters */
  readonly activeFilterCount = computed(() => {
    const f = this.filter();
    let count = 0;
    if (f.labels.length > 0) count++;
    if (f.assigneeId !== null) count++;
    if (f.dueDateRange !== null && f.dueDateRange !== 'all') count++;
    return count;
  });

  /** Due date filter options */
  readonly dueDateOptions: Array<{
    value: CardFilter['dueDateRange'];
    labelKey: string;
  }> = [
    { value: 'overdue', labelKey: 'boards.cardDetail.filterOverdue' },
    { value: 'today', labelKey: 'boards.cardDetail.filterDueToday' },
    { value: 'week', labelKey: 'boards.cardDetail.filterDueWeek' },
    { value: null, labelKey: 'boards.cardDetail.filterAll' },
  ];

  toggleLabel(labelId: string): void {
    const current = this.filter();
    const labels = current.labels.includes(labelId)
      ? current.labels.filter((id) => id !== labelId)
      : [...current.labels, labelId];
    this.filterChanged.emit({ ...current, labels });
  }

  isLabelSelected(labelId: string): boolean {
    return this.filter().labels.includes(labelId);
  }

  selectAssignee(assigneeId: string | null): void {
    const current = this.filter();
    // Toggle off if clicking the same assignee
    const newId = current.assigneeId === assigneeId ? null : assigneeId;
    this.filterChanged.emit({ ...current, assigneeId: newId });
  }

  isAssigneeSelected(assigneeId: string | null): boolean {
    return this.filter().assigneeId === assigneeId;
  }

  selectDueDateRange(range: CardFilter['dueDateRange']): void {
    const current = this.filter();
    // Toggle off if clicking the same range (or null for "All")
    const newRange = current.dueDateRange === range ? null : range;
    this.filterChanged.emit({ ...current, dueDateRange: newRange });
  }

  isDueDateSelected(range: CardFilter['dueDateRange']): boolean {
    return this.filter().dueDateRange === range;
  }

  onClearAll(): void {
    this.clearAll.emit();
  }
}
