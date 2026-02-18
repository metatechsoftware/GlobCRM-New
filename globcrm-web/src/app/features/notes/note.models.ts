/**
 * Note entity models matching backend DTOs (NotesController).
 * Used by NoteService and NoteStore.
 */

// ─── List DTO (lightweight for table) ──────────────────────────────────────

export interface NoteListDto {
  id: string;
  title: string;
  plainTextBody: string | null;
  entityType: string;
  entityName: string | null;
  authorName: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Detail DTO (full load for detail page with HTML body) ─────────────────

export interface NoteDetailDto {
  id: string;
  title: string;
  body: string;
  plainTextBody: string | null;
  entityType: string;
  entityId: string;
  entityName: string | null;
  authorName: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Request DTOs ──────────────────────────────────────────────────────────

export interface CreateNoteRequest {
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  entityName?: string | null;
}

export interface UpdateNoteRequest {
  title: string;
  body: string;
}

// ─── Entity Types for notes ────────────────────────────────────────────────

export const NOTE_ENTITY_TYPES = [
  { value: 'Company', label: 'Company' },
  { value: 'Contact', label: 'Contact' },
  { value: 'Deal', label: 'Deal' },
  { value: 'Quote', label: 'Quote' },
  { value: 'Request', label: 'Request' },
] as const;
