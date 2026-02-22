import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../core/api/api.service';
import { BoardsService } from '../boards.service';
import { BoardStore } from '../boards.store';
import {
  CardDto,
  CardCommentDto,
  ChecklistItemDto,
  LabelDto,
  CardAssigneeDto,
} from '../boards.models';
import { BOARD_COLOR_PRESETS } from '../boards.models';
import { PreviewSidebarStore } from '../../../shared/stores/preview-sidebar.store';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor/rich-text-editor.component';
import { ProfileService, TeamMemberDto } from '../../profile/profile.service';

/** Entity types available for linking */
const ENTITY_TYPES = [
  'Contact',
  'Company',
  'Deal',
  'Lead',
  'Product',
  'Activity',
] as const;

/** Entity type icon mapping */
const ENTITY_TYPE_ICONS: Record<string, string> = {
  Contact: 'people',
  Company: 'business',
  Deal: 'handshake',
  Lead: 'person_search',
  Activity: 'task_alt',
  Product: 'inventory_2',
  Quote: 'request_quote',
  Request: 'support_agent',
};

/**
 * Card detail slide panel — right-side panel for editing card details.
 * Features: inline title editing, rich text description, multi-assignee picker,
 * due date, label management, checklists with progress, threaded comments,
 * and entity linking with preview sidebar integration.
 */
@Component({
  selector: 'app-card-detail-panel',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatTooltipModule,
    TranslocoPipe,
    RichTextEditorComponent,
  ],
  templateUrl: './card-detail-panel.component.html',
  styleUrl: './card-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailPanelComponent {
  private readonly api = inject(ApiService);
  private readonly boardsService = inject(BoardsService);
  readonly boardStore = inject(BoardStore);
  private readonly previewSidebarStore = inject(PreviewSidebarStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly profileService = inject(ProfileService);

  /** Whether panel is open */
  readonly isOpen = input<boolean>(false);

  /** ID of the card to display */
  readonly cardId = input<string | null>(null);

  /** Board ID for API calls */
  readonly boardId = input<string>('');

  /** Emitted when panel should close */
  readonly closed = output<void>();

  /** Card data loaded from the board store */
  readonly card = computed(() => {
    const id = this.cardId();
    const board = this.boardStore.board();
    if (!id || !board) return null;
    for (const col of board.columns) {
      const found = col.cards.find((c) => c.id === id);
      if (found) return found;
    }
    return null;
  });

  /** Board labels for label picker */
  readonly boardLabels = computed(() => {
    return this.boardStore.board()?.labels ?? [];
  });

  // ---- Title editing ----
  readonly editingTitle = signal(false);
  readonly editTitleValue = signal('');

  // ---- Description editing ----
  readonly editingDescription = signal(false);
  readonly descriptionValue = signal('');

  // ---- Due date ----
  readonly dueDateValue = signal<Date | null>(null);

  // ---- Assignee picker ----
  readonly assigneePickerOpen = signal(false);
  readonly teamMembers = signal<TeamMemberDto[]>([]);
  readonly assigneeSearchQuery = signal('');

  /** Filtered team members: excludes already-assigned and matches search query */
  readonly filteredTeamMembers = computed(() => {
    const members = this.teamMembers();
    const card = this.card();
    const query = this.assigneeSearchQuery().toLowerCase().trim();
    const assignedIds = new Set(card?.assignees.map((a) => a.userId) ?? []);

    return members.filter((m) => {
      if (assignedIds.has(m.id)) return false;
      if (!query) return true;
      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
      return fullName.includes(query) || m.email.toLowerCase().includes(query);
    });
  });

  // ---- Label picker ----
  readonly labelPickerOpen = signal(false);
  readonly creatingLabel = signal(false);
  readonly newLabelName = signal('');
  readonly newLabelColor = signal('#F97316');

  // ---- Entity linking ----
  readonly entityLinkOpen = signal(false);
  readonly entityLinkType = signal<string>('Contact');
  readonly entityLinkSearch = signal('');
  readonly entitySearchResults = signal<Array<{ id: string; name: string }>>([]);
  readonly entitySearching = signal(false);

  // ---- Checklists ----
  readonly checklistItems = signal<ChecklistItemDto[]>([]);
  readonly newChecklistText = signal('');
  readonly editingChecklistItemId = signal<string | null>(null);
  readonly editChecklistItemText = signal('');

  // ---- Comments ----
  readonly comments = signal<CardCommentDto[]>([]);
  readonly newCommentText = signal('');
  readonly replyingToId = signal<string | null>(null);
  readonly replyText = signal('');
  readonly editingCommentId = signal<string | null>(null);
  readonly editCommentText = signal('');
  readonly commentsLoading = signal(false);

  // ---- Color presets for labels ----
  readonly colorPresets = BOARD_COLOR_PRESETS;

  // ---- Entity types for linking ----
  readonly entityTypes = ENTITY_TYPES;

  /** Checklist progress percentage */
  readonly checklistProgress = computed(() => {
    const items = this.checklistItems();
    if (items.length === 0) return 0;
    const checked = items.filter((i) => i.isChecked).length;
    return Math.round((checked / items.length) * 100);
  });

  /** Checklist checked count */
  readonly checklistCheckedCount = computed(() => {
    return this.checklistItems().filter((i) => i.isChecked).length;
  });

  constructor() {
    // When cardId changes, load card data (comments, checklist)
    effect(() => {
      const id = this.cardId();
      const boardId = this.boardId();
      const card = this.card();
      if (id && boardId && card) {
        // Sync local state from card
        this.dueDateValue.set(card.dueDate ? new Date(card.dueDate) : null);
        this.descriptionValue.set(card.description ?? '');

        // Load comments
        this.loadComments(boardId, id);
        // Load checklist items from the card API
        this.loadChecklistItems(boardId, id);
      }
    });

    // Load team members once for assignee picker
    this.profileService.getTeamDirectory({ pageSize: 200 }).subscribe({
      next: (result) => this.teamMembers.set(result.items),
      error: () => this.teamMembers.set([]),
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.closed.emit();
    }
  }

  // ---- Title ----

  startEditTitle(): void {
    const card = this.card();
    if (!card) return;
    this.editTitleValue.set(card.title);
    this.editingTitle.set(true);
  }

  saveTitle(): void {
    const card = this.card();
    const title = this.editTitleValue().trim();
    if (!card || !title || title === card.title) {
      this.editingTitle.set(false);
      return;
    }
    this.boardsService
      .updateCard(this.boardId(), card.id, {
        title,
        description: card.description,
        dueDate: card.dueDate,
        linkedEntityType: card.linkedEntityType,
        linkedEntityId: card.linkedEntityId,
      })
      .subscribe({
        next: () => {
          this.editingTitle.set(false);
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  cancelEditTitle(): void {
    this.editingTitle.set(false);
  }

  // ---- Description ----

  startEditDescription(): void {
    const card = this.card();
    this.descriptionValue.set(card?.description ?? '');
    this.editingDescription.set(true);
  }

  saveDescription(): void {
    const card = this.card();
    if (!card) return;
    const description = this.descriptionValue();
    this.boardsService
      .updateCard(this.boardId(), card.id, {
        title: card.title,
        description,
        dueDate: card.dueDate,
        linkedEntityType: card.linkedEntityType,
        linkedEntityId: card.linkedEntityId,
      })
      .subscribe({
        next: () => {
          this.editingDescription.set(false);
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  cancelEditDescription(): void {
    this.editingDescription.set(false);
  }

  onDescriptionChange(value: string): void {
    this.descriptionValue.set(value);
  }

  // ---- Due Date ----

  onDueDateChange(event: any): void {
    const card = this.card();
    if (!card) return;
    const date = event.value as Date | null;
    this.dueDateValue.set(date);
    const dueDate = date ? date.toISOString() : null;
    this.boardsService
      .updateCard(this.boardId(), card.id, {
        title: card.title,
        description: card.description,
        dueDate,
        linkedEntityType: card.linkedEntityType,
        linkedEntityId: card.linkedEntityId,
      })
      .subscribe({
        next: () => this.refreshBoard(),
        error: () => this.showError(),
      });
  }

  clearDueDate(): void {
    const card = this.card();
    if (!card) return;
    this.dueDateValue.set(null);
    this.boardsService
      .updateCard(this.boardId(), card.id, {
        title: card.title,
        description: card.description,
        dueDate: null,
        linkedEntityType: card.linkedEntityType,
        linkedEntityId: card.linkedEntityId,
      })
      .subscribe({
        next: () => this.refreshBoard(),
        error: () => this.showError(),
      });
  }

  /** Due date urgency for styling */
  getDueDateUrgency(): string | null {
    const date = this.dueDateValue();
    if (!date) return null;
    const due = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 3) return 'approaching';
    return 'normal';
  }

  // ---- Assignees ----

  toggleAssigneePicker(): void {
    this.assigneePickerOpen.update((v) => !v);
    this.assigneeSearchQuery.set('');
  }

  addAssignee(member: TeamMemberDto): void {
    const card = this.card();
    if (!card) return;
    this.boardsService
      .addAssigneeToCard(this.boardId(), card.id, member.id)
      .subscribe({
        next: () => {
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  removeAssignee(userId: string): void {
    const card = this.card();
    if (!card) return;
    this.boardsService
      .removeAssigneeFromCard(this.boardId(), card.id, userId)
      .subscribe({
        next: () => this.refreshBoard(),
        error: () => this.showError(),
      });
  }

  // ---- Labels ----

  toggleLabelPicker(): void {
    this.labelPickerOpen.update((v) => !v);
    this.creatingLabel.set(false);
  }

  isLabelOnCard(labelId: string): boolean {
    return (this.card()?.labels ?? []).some((l) => l.labelId === labelId);
  }

  toggleLabel(label: LabelDto): void {
    const card = this.card();
    if (!card) return;
    if (this.isLabelOnCard(label.id)) {
      this.boardsService
        .removeLabelFromCard(this.boardId(), card.id, label.id)
        .subscribe({
          next: () => this.refreshBoard(),
          error: () => this.showError(),
        });
    } else {
      this.boardsService
        .addLabelToCard(this.boardId(), card.id, label.id)
        .subscribe({
          next: () => this.refreshBoard(),
          error: () => this.showError(),
        });
    }
  }

  startCreateLabel(): void {
    this.creatingLabel.set(true);
    this.newLabelName.set('');
    this.newLabelColor.set('#F97316');
  }

  cancelCreateLabel(): void {
    this.creatingLabel.set(false);
  }

  selectLabelColor(color: string): void {
    this.newLabelColor.set(color);
  }

  saveNewLabel(): void {
    const name = this.newLabelName().trim();
    const color = this.newLabelColor();
    if (!name) return;
    this.boardsService
      .createLabel(this.boardId(), { name, color })
      .subscribe({
        next: (label) => {
          this.creatingLabel.set(false);
          this.refreshBoard();
          // Also add to card
          const card = this.card();
          if (card) {
            this.boardsService
              .addLabelToCard(this.boardId(), card.id, label.id)
              .subscribe({
                next: () => this.refreshBoard(),
              });
          }
        },
        error: () => this.showError(),
      });
  }

  // ---- Entity Linking ----

  toggleEntityLink(): void {
    this.entityLinkOpen.update((v) => !v);
    this.entitySearchResults.set([]);
    this.entityLinkSearch.set('');
  }

  selectEntityType(type: string): void {
    this.entityLinkType.set(type);
    this.entitySearchResults.set([]);
    this.entityLinkSearch.set('');
  }

  searchEntities(): void {
    const query = this.entityLinkSearch().trim();
    if (query.length < 2) {
      this.entitySearchResults.set([]);
      return;
    }
    this.entitySearching.set(true);
    const type = this.entityLinkType();
    const apiPath = this.getEntityApiPath(type);
    // Use a simple search API call
    this.api
      .get<any>(`${apiPath}?search=${encodeURIComponent(query)}&pageSize=10`)
      .subscribe({
        next: (response: any) => {
          // Extract items from paginated response
          const items = response.items ?? response.data ?? response ?? [];
          const results = (Array.isArray(items) ? items : []).map(
            (item: any) => ({
              id: item.id,
              name:
                item.name ??
                item.subject ??
                (item.firstName
                  ? `${item.firstName} ${item.lastName ?? ''}`
                  : item.title ?? 'Unknown'),
            })
          );
          this.entitySearchResults.set(results);
          this.entitySearching.set(false);
        },
        error: () => {
          this.entitySearchResults.set([]);
          this.entitySearching.set(false);
        },
      });
  }

  linkEntity(entity: { id: string; name: string }): void {
    const card = this.card();
    if (!card) return;
    this.boardsService
      .updateCard(this.boardId(), card.id, {
        title: card.title,
        description: card.description,
        dueDate: card.dueDate,
        linkedEntityType: this.entityLinkType(),
        linkedEntityId: entity.id,
        linkedEntityName: entity.name,
      })
      .subscribe({
        next: () => {
          this.entityLinkOpen.set(false);
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  unlinkEntity(): void {
    const card = this.card();
    if (!card) return;
    this.boardsService
      .updateCard(this.boardId(), card.id, {
        title: card.title,
        description: card.description,
        dueDate: card.dueDate,
        linkedEntityType: null,
        linkedEntityId: null,
        linkedEntityName: null,
      })
      .subscribe({
        next: () => this.refreshBoard(),
        error: () => this.showError(),
      });
  }

  openEntityPreview(): void {
    const card = this.card();
    if (!card?.linkedEntityType || !card?.linkedEntityId) return;
    this.previewSidebarStore.open({
      entityType: card.linkedEntityType,
      entityId: card.linkedEntityId,
      entityName: card.linkedEntityName ?? undefined,
    });
  }

  getEntityIcon(type: string | null): string {
    if (!type) return 'link';
    return ENTITY_TYPE_ICONS[type] ?? 'link';
  }

  // ---- Checklists ----

  private loadChecklistItems(boardId: string, cardId: string): void {
    // Load full checklist items from the dedicated GET endpoint.
    // CardDto only includes checklistTotal/checklistChecked counts.
    this.api
      .get<ChecklistItemDto[]>(
        `/api/boards/${boardId}/cards/${cardId}/checklist`
      )
      .subscribe({
        next: (items) => this.checklistItems.set(items ?? []),
        error: () => this.checklistItems.set([]),
      });
  }

  addChecklistItem(): void {
    const text = this.newChecklistText().trim();
    const card = this.card();
    if (!text || !card) return;
    this.boardsService
      .createChecklistItem(this.boardId(), card.id, { text })
      .subscribe({
        next: (item) => {
          this.checklistItems.update((items) => [...items, item]);
          this.newChecklistText.set('');
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  toggleChecklistItem(item: ChecklistItemDto): void {
    const card = this.card();
    if (!card) return;
    this.boardsService
      .toggleChecklistItem(this.boardId(), card.id, item.id)
      .subscribe({
        next: (updated) => {
          this.checklistItems.update((items) =>
            items.map((i) => (i.id === updated.id ? updated : i))
          );
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  startEditChecklistItem(item: ChecklistItemDto): void {
    this.editingChecklistItemId.set(item.id);
    this.editChecklistItemText.set(item.text);
  }

  saveChecklistItem(item: ChecklistItemDto): void {
    const text = this.editChecklistItemText().trim();
    const card = this.card();
    if (!text || !card) {
      this.editingChecklistItemId.set(null);
      return;
    }
    this.boardsService
      .updateChecklistItem(this.boardId(), card.id, item.id, {
        text,
        isChecked: item.isChecked,
      })
      .subscribe({
        next: (updated) => {
          this.checklistItems.update((items) =>
            items.map((i) => (i.id === updated.id ? updated : i))
          );
          this.editingChecklistItemId.set(null);
        },
        error: () => this.showError(),
      });
  }

  cancelEditChecklistItem(): void {
    this.editingChecklistItemId.set(null);
  }

  deleteChecklistItem(item: ChecklistItemDto): void {
    const card = this.card();
    if (!card) return;
    this.boardsService
      .deleteChecklistItem(this.boardId(), card.id, item.id)
      .subscribe({
        next: () => {
          this.checklistItems.update((items) =>
            items.filter((i) => i.id !== item.id)
          );
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  // ---- Comments ----

  private loadComments(boardId: string, cardId: string): void {
    this.commentsLoading.set(true);
    this.boardsService.getComments(boardId, cardId).subscribe({
      next: (comments) => {
        this.comments.set(comments);
        this.commentsLoading.set(false);
      },
      error: () => {
        this.comments.set([]);
        this.commentsLoading.set(false);
      },
    });
  }

  addComment(): void {
    const content = this.newCommentText().trim();
    const card = this.card();
    if (!content || !card) return;
    this.boardsService
      .createComment(this.boardId(), card.id, { content })
      .subscribe({
        next: () => {
          this.newCommentText.set('');
          this.loadComments(this.boardId(), card.id);
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  startReply(commentId: string): void {
    this.replyingToId.set(commentId);
    this.replyText.set('');
  }

  cancelReply(): void {
    this.replyingToId.set(null);
    this.replyText.set('');
  }

  submitReply(parentCommentId: string): void {
    const content = this.replyText().trim();
    const card = this.card();
    if (!content || !card) return;
    this.boardsService
      .createComment(this.boardId(), card.id, {
        content,
        parentCommentId,
      })
      .subscribe({
        next: () => {
          this.replyingToId.set(null);
          this.replyText.set('');
          this.loadComments(this.boardId(), card.id);
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  startEditComment(comment: CardCommentDto): void {
    this.editingCommentId.set(comment.id);
    this.editCommentText.set(comment.content);
  }

  saveEditComment(comment: CardCommentDto): void {
    const content = this.editCommentText().trim();
    const card = this.card();
    if (!content || !card) {
      this.editingCommentId.set(null);
      return;
    }
    this.boardsService
      .updateComment(this.boardId(), card.id, comment.id, { content })
      .subscribe({
        next: () => {
          this.editingCommentId.set(null);
          this.loadComments(this.boardId(), card.id);
        },
        error: () => this.showError(),
      });
  }

  cancelEditComment(): void {
    this.editingCommentId.set(null);
  }

  deleteComment(comment: CardCommentDto): void {
    const card = this.card();
    if (!card) return;
    this.boardsService
      .deleteComment(this.boardId(), card.id, comment.id)
      .subscribe({
        next: () => {
          this.loadComments(this.boardId(), card.id);
          this.refreshBoard();
        },
        error: () => this.showError(),
      });
  }

  /** Get initials from a name */
  getInitials(name: string | null): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts
      .map((p) => p.charAt(0))
      .join('')
      .substring(0, 2)
      .toLocaleUpperCase();
  }

  /** Get relative time string for a date */
  getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return this.transloco.translate('boards.cardDetail.justNow');
    if (diffMins < 60)
      return this.transloco.translate('boards.cardDetail.minutesAgo', {
        count: diffMins,
      });
    if (diffHours < 24)
      return this.transloco.translate('boards.cardDetail.hoursAgo', {
        count: diffHours,
      });
    if (diffDays < 7)
      return this.transloco.translate('boards.cardDetail.daysAgo', {
        count: diffDays,
      });
    return date.toLocaleDateString();
  }

  /** Archive card */
  archiveCard(): void {
    const card = this.card();
    if (!card) return;
    this.boardStore.archiveCard(
      this.boardId(),
      card.id,
      () => {
        this.closed.emit();
      },
      () => this.showError()
    );
  }

  // ---- Helpers ----

  private refreshBoard(): void {
    const boardId = this.boardId();
    if (boardId) {
      this.boardStore.loadBoard(boardId);
    }
  }

  private showError(): void {
    this.snackBar.open(
      this.transloco.translate('boards.snackbar.error'),
      '',
      { duration: 3000 }
    );
  }

  private getEntityApiPath(type: string): string {
    const paths: Record<string, string> = {
      Contact: '/api/contacts',
      Company: '/api/companies',
      Deal: '/api/deals',
      Lead: '/api/leads',
      Product: '/api/products',
      Activity: '/api/activities',
      Quote: '/api/quotes',
      Request: '/api/requests',
    };
    return paths[type] ?? '/api/contacts';
  }

  onBackdropClick(): void {
    this.closed.emit();
  }
}
