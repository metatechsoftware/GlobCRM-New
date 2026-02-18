import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';
import {
  AttachmentDto,
  BLOCKED_EXTENSIONS,
  MAX_FILE_SIZE,
} from '../models/attachment.models';

/**
 * Shared attachment service for uploading, listing, downloading, and deleting
 * file attachments on any CRM entity. Uses HttpClient directly for FormData
 * upload and blob download (matching ActivityService attachment pattern).
 *
 * API routes:
 * - POST   /api/{entityType}/{entityId}/attachments  (FormData upload)
 * - GET    /api/{entityType}/{entityId}/attachments  (list)
 * - GET    /api/attachments/{attachmentId}/download   (blob download)
 * - DELETE /api/attachments/{attachmentId}            (delete)
 */
@Injectable({ providedIn: 'root' })
export class AttachmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Uploads a file as an attachment to the given entity.
   * Creates FormData with the file and POSTs to the polymorphic attachment route.
   */
  upload(entityType: string, entityId: string, file: File): Observable<AttachmentDto> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<AttachmentDto>(
      `${this.baseUrl}/api/${entityType}/${entityId}/attachments`,
      formData,
    );
  }

  /**
   * Lists all attachments for the given entity, ordered by upload date descending.
   */
  list(entityType: string, entityId: string): Observable<AttachmentDto[]> {
    return this.http.get<AttachmentDto[]>(
      `${this.baseUrl}/api/${entityType}/${entityId}/attachments`,
    );
  }

  /**
   * Downloads an attachment as a blob by its ID.
   * The caller is responsible for creating a blob URL and triggering browser download.
   */
  download(attachmentId: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/api/attachments/${attachmentId}/download`,
      { responseType: 'blob' },
    );
  }

  /**
   * Deletes an attachment by its ID. Author-only or admin on the backend.
   */
  delete(attachmentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/api/attachments/${attachmentId}`,
    );
  }

  // ---- Utility Methods ----

  /**
   * Validates a file before upload.
   * Checks file size <= MAX_FILE_SIZE and extension not in BLOCKED_EXTENSIONS.
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds the 25MB limit (${this.formatFileSize(file.size)}).`,
      };
    }

    // Check extension
    const lastDot = file.name.lastIndexOf('.');
    if (lastDot !== -1) {
      const ext = file.name.substring(lastDot).toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        return {
          valid: false,
          error: `File type '${ext}' is not allowed for security reasons.`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Returns true if the content type starts with 'image/'.
   * Used by EntityAttachmentsComponent to show the preview button.
   */
  isImageContentType(contentType: string): boolean {
    return contentType.startsWith('image/');
  }

  /**
   * Formats file size bytes into human-readable KB/MB string.
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
