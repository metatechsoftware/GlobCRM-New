import { Component, ChangeDetectionStrategy, input, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { NoteService } from '../../../features/notes/note.service';

@Component({
  selector: 'app-preview-notes-tab',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <div class="tab-loading">
        <mat-spinner diameter="32"></mat-spinner>
      </div>
    } @else if (notes().length === 0) {
      <div class="tab-empty">
        <mat-icon>note</mat-icon>
        <span>{{ 'common.preview.noNotes' | transloco }}</span>
      </div>
    } @else {
      <div class="notes-list">
        @for (note of notes(); track note.id) {
          <div class="note-card">
            <div class="note-title">{{ note.title }}</div>
            @if (note.plainTextBody) {
              <div class="note-body">{{ truncate(note.plainTextBody) }}</div>
            }
            <div class="note-meta">
              @if (note.authorName) {
                <span>{{ note.authorName }}</span>
                <span class="meta-dot"></span>
              }
              <span>{{ note.createdAt | date:'MMM d, y' }}</span>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .tab-loading {
      display: flex;
      justify-content: center;
      padding: 24px;
    }

    .tab-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      color: var(--color-text-secondary);
      text-align: center;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.5;
      }
    }

    .notes-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .note-card {
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
    }

    .note-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text);
      margin-bottom: 4px;
    }

    .note-body {
      font-size: 13px;
      color: var(--color-text-secondary);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 6px;
    }

    .note-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .meta-dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background-color: var(--color-text-muted);
    }
  `],
})
export class PreviewNotesTabComponent implements OnInit {
  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();

  private readonly noteService = inject(NoteService);

  readonly isLoading = signal(true);
  readonly notes = signal<any[]>([]);

  ngOnInit(): void {
    this.noteService.getEntityNotes(this.entityType(), this.entityId()).subscribe({
      next: (data) => {
        this.notes.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  truncate(text: string, maxLength = 150): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
