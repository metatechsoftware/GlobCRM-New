// ---- Enums & Type Unions ----

export type BoardVisibility = 'private' | 'team' | 'public';

// ---- DTOs (match API response shapes) ----

export interface BoardListDto {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  visibility: BoardVisibility;
  creatorId: string | null;
  creatorName: string | null;
  columnCount: number;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardDetailDto {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  visibility: BoardVisibility;
  creatorId: string | null;
  creatorName: string | null;
  teamId: string | null;
  columns: ColumnDto[];
  labels: LabelDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ColumnDto {
  id: string;
  name: string;
  sortOrder: number;
  wipLimit: number | null;
  color: string | null;
  isCollapsed: boolean;
  cards: CardDto[];
}

export interface CardDto {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  sortOrder: number;
  isArchived: boolean;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  linkedEntityName: string | null;
  labels: CardLabelDto[];
  checklistTotal: number;
  checklistChecked: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardLabelDto {
  labelId: string;
  name: string;
  color: string;
}

export interface LabelDto {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItemDto {
  id: string;
  text: string;
  isChecked: boolean;
  sortOrder: number;
}

export interface CardCommentDto {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  replies: CardCommentDto[];
}

// ---- Request Types ----

export interface CreateBoardRequest {
  name: string;
  description?: string | null;
  color?: string | null;
  visibility: BoardVisibility;
  teamId?: string | null;
  templateKey?: string | null;
}

export interface UpdateBoardRequest {
  name: string;
  description?: string | null;
  color?: string | null;
  visibility: BoardVisibility;
  teamId?: string | null;
}

export interface CreateColumnRequest {
  name: string;
  wipLimit?: number | null;
  color?: string | null;
}

export interface UpdateColumnRequest {
  name: string;
  wipLimit?: number | null;
  color?: string | null;
}

export interface ReorderColumnsRequest {
  columnIds: string[];
}

export interface CreateCardRequest {
  columnId: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}

export interface UpdateCardRequest {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}

export interface MoveCardRequest {
  targetColumnId: string;
  sortOrder: number;
}

export interface CreateLabelRequest {
  name: string;
  color: string;
}

export interface UpdateLabelRequest {
  name: string;
  color: string;
}

export interface CreateChecklistItemRequest {
  text: string;
}

export interface UpdateChecklistItemRequest {
  text: string;
  isChecked: boolean;
}

export interface CreateCardCommentRequest {
  content: string;
  parentCommentId?: string | null;
}

export interface UpdateCardCommentRequest {
  content: string;
}

// ---- Board Templates ----

export interface BoardTemplate {
  key: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  columns: string[];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    key: 'sprint',
    nameKey: 'boards.templates.sprint.name',
    descriptionKey: 'boards.templates.sprint.description',
    icon: 'sprint',
    columns: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
  },
  {
    key: 'content',
    nameKey: 'boards.templates.content.name',
    descriptionKey: 'boards.templates.content.description',
    icon: 'edit_note',
    columns: ['Ideas', 'Writing', 'Editing', 'Scheduled', 'Published'],
  },
  {
    key: 'sales',
    nameKey: 'boards.templates.sales.name',
    descriptionKey: 'boards.templates.sales.description',
    icon: 'trending_up',
    columns: ['To Contact', 'Contacted', 'Follow Up', 'Meeting Set', 'Closed'],
  },
];

// ---- Card Filter ----

export interface CardFilter {
  labels: string[];
  assigneeId: string | null;
  dueDateRange: 'overdue' | 'today' | 'week' | 'all' | null;
}

// ---- Color Presets ----

export const BOARD_COLOR_PRESETS: string[] = [
  '#F97316', // orange
  '#3B82F6', // blue
  '#22C55E', // green
  '#A855F7', // purple
  '#EF4444', // red
  '#14B8A6', // teal
  '#EC4899', // pink
  '#EAB308', // yellow
];
