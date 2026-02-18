/**
 * DTO for attachment list/detail responses.
 * Matches backend AttachmentDto record from AttachmentsController.
 */
export interface AttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedByName: string | null;
  uploadedAt: string;
}

/** File extensions blocked on the frontend before upload. */
export const BLOCKED_EXTENSIONS: readonly string[] = [
  '.exe',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
] as const;

/** Maximum file size in bytes (25MB). */
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
