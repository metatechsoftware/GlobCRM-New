import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  viewChild,
  ElementRef,
  output,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { AttachmentService } from '../../../shared/services/attachment.service';
import { MentionTypeaheadComponent } from '../mention-typeahead/mention-typeahead.component';
import { EmojiPickerComponent } from '../emoji-picker/emoji-picker.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { CreateFeedPostPayload } from '../feed.models';

/**
 * Social post creation form with toolbar for attachments, @mentions, and emoji.
 * Emits postCreated event with content and pending files on submit.
 */
@Component({
  selector: 'app-feed-post-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatTooltipModule,
    MentionTypeaheadComponent,
    EmojiPickerComponent,
    AvatarComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @keyframes fileChipIn {
      from {
        opacity: 0;
        transform: scale(0.85);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .post-form-card {
      display: flex;
      gap: 14px;
      padding: 20px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
      border-radius: var(--radius-lg, 12px);
      margin-bottom: 20px;
      transition:
        border-color var(--duration-normal, 200ms) var(--ease-default),
        box-shadow var(--duration-normal, 200ms) var(--ease-default);
    }

    .post-form-card--focused {
      border-color: var(--color-border-focus, #F97316);
      box-shadow: var(--shadow-focus), var(--shadow-glow);
    }

    .post-form-avatar {
      flex-shrink: 0;
      display: inline-flex;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--color-primary, #F97316);
      overflow: hidden;
    }

    .post-form-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* ── Textarea ── */
    .textarea-wrap {
      width: 100%;
    }

    .post-textarea {
      display: block;
      width: 100%;
      min-height: 64px;
      padding: 12px 14px;
      border: 1px solid var(--color-border, #E8E8E6);
      border-radius: var(--radius-md, 8px);
      background: var(--color-bg-input, var(--color-surface, #fff));
      font-family: inherit;
      font-size: var(--text-base, 0.875rem);
      color: var(--color-text, #1a1a1a);
      resize: vertical;
      outline: none;
      transition:
        border-color var(--duration-fast, 100ms),
        box-shadow var(--duration-fast, 100ms),
        background var(--duration-fast, 100ms);

      &::placeholder {
        color: var(--color-text-faint, #B0ACA7);
      }

      &:focus {
        border-color: var(--color-border-focus, #F97316);
        box-shadow: var(--shadow-focus), inset 0 0 20px var(--orange-glow, rgba(249,115,22,0.12));
        background: var(--color-surface, #fff);
      }
    }

    /* ── Pending Files ── */
    .pending-files {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .file-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: var(--color-primary-soft, #FFF7ED);
      color: var(--color-primary-text, #C2410C);
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-xs, 0.75rem);
      font-weight: var(--font-medium, 500);
      animation: fileChipIn var(--duration-normal, 200ms) var(--ease-spring) both;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .remove-file {
        cursor: pointer;
        color: var(--color-text-muted, #9CA3AF);
        transition: color var(--duration-fast, 100ms);
        &:hover {
          color: var(--color-danger, #EF4444);
        }
      }
    }

    /* ── Actions Row ── */
    .post-form-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .post-form-toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .toolbar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: none;
      background: none;
      border-radius: var(--radius-md, 8px);
      color: var(--color-text-muted, #9CA3AF);
      cursor: pointer;
      transition:
        background var(--duration-fast, 100ms),
        color var(--duration-fast, 100ms),
        box-shadow var(--duration-fast, 100ms),
        transform var(--duration-fast, 100ms) var(--ease-spring);

      &:hover {
        background: var(--color-primary-soft, #FFF7ED);
        color: var(--color-primary, #F97316);
        box-shadow: var(--shadow-xs);
        transform: scale(1.08);
      }

      &:active {
        transform: scale(0.94);
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    /* ── Submit Button ── */
    .post-submit-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 20px;
      border-radius: var(--radius-full, 9999px);
      border: none;
      background: linear-gradient(135deg, var(--color-primary, #F97316), var(--color-primary-hover, #EA580C));
      color: var(--color-primary-fg, #fff);
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-semibold, 600);
      letter-spacing: var(--tracking-snug, -0.01em);
      cursor: pointer;
      transition:
        transform var(--duration-fast, 100ms) var(--ease-spring),
        box-shadow var(--duration-fast, 100ms);

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(249, 115, 22, 0.4), var(--shadow-glow, 0 0 24px rgba(249,115,22,0.12));
      }

      &:active:not(:disabled) {
        transform: translateY(0) scale(0.97);
      }

      &:disabled {
        background: var(--color-text-faint, #B0ACA7);
        opacity: 1;
        cursor: default;
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .typeahead-container {
      position: relative;
    }

    .emoji-container {
      position: relative;
    }

    @media (prefers-reduced-motion: reduce) {
      .file-chip {
        animation: none;
      }
    }
  `,
  template: `
    <div class="post-form-card" [class.post-form-card--focused]="isFocused()">
      <div class="post-form-avatar">
        <app-avatar
          [firstName]="userFirstName"
          [lastName]="userLastName"
          size="sm" />
      </div>
      <div class="post-form-body">
        <div class="textarea-wrap">
          <textarea class="post-textarea"
                    #textareaRef
                    [(ngModel)]="postContent"
                    rows="2"
                    [placeholder]="'feed.post.placeholder' | transloco"
                    (focus)="isFocused.set(true)"
                    (blur)="isFocused.set(false)"
                    (input)="onTextareaInput()"
                    (keydown.enter)="onSubmit($event)"></textarea>
        </div>

        @if (pendingFiles().length) {
          <div class="pending-files">
            @for (file of pendingFiles(); track $index) {
              <span class="file-chip">
                <mat-icon>attach_file</mat-icon>
                {{ file.name }}
                <mat-icon class="remove-file" (click)="removeFile($index)">close</mat-icon>
              </span>
            }
          </div>
        }

        <div class="post-form-actions">
          <div class="post-form-toolbar">
            <button class="toolbar-btn" [matTooltip]="'feed.post.attachFile' | transloco" type="button" (click)="fileInput.click()">
              <mat-icon>attach_file</mat-icon>
            </button>
            <input #fileInput type="file" hidden multiple (change)="onFileSelected($event)" />
            <button class="toolbar-btn" [matTooltip]="'feed.post.mention' | transloco" type="button" (click)="insertAtSymbol()">
              <mat-icon>alternate_email</mat-icon>
            </button>
            <div class="emoji-container">
              <button class="toolbar-btn" [matTooltip]="'feed.post.emoji' | transloco" type="button" (click)="toggleEmojiPicker($event)">
                <mat-icon>sentiment_satisfied_alt</mat-icon>
              </button>
              @if (showEmojiPicker()) {
                <app-emoji-picker (emojiSelected)="onEmojiSelected($event)" />
              }
            </div>
          </div>
          <button class="post-submit-btn"
                  [disabled]="!postContent.trim() && !pendingFiles().length"
                  (click)="onSubmit()">
            <mat-icon>send</mat-icon>
            {{ 'feed.post.submit' | transloco }}
          </button>
        </div>

        <div class="typeahead-container">
          <app-mention-typeahead
            [textareaEl]="textareaElement()"
            (mentionSelected)="onMentionSelected($event)" />
        </div>
      </div>
    </div>
  `,
})
export class FeedPostFormComponent {
  readonly postCreated = output<CreateFeedPostPayload>();

  private readonly authStore = inject(AuthStore);
  private readonly attachmentService = inject(AttachmentService);

  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textareaRef');
  private readonly mentionTypeahead = viewChild(MentionTypeaheadComponent);

  postContent = '';
  readonly pendingFiles = signal<File[]>([]);
  readonly showEmojiPicker = signal(false);
  readonly isFocused = signal(false);

  textareaElement(): HTMLTextAreaElement | undefined {
    return this.textareaRef()?.nativeElement;
  }

  get userFirstName(): string {
    return this.authStore.user()?.firstName ?? '';
  }

  get userLastName(): string {
    return this.authStore.user()?.lastName ?? '';
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showEmojiPicker.set(false);
  }

  onTextareaInput(): void {
    this.mentionTypeahead()?.onTextInput();
  }

  onSubmit(event?: Event): void {
    if (event) {
      const keyEvent = event as KeyboardEvent;
      if (!keyEvent.shiftKey) {
        event.preventDefault();
      } else {
        return;
      }
    }

    const content = this.postContent.trim();
    if (!content && !this.pendingFiles().length) return;

    this.postCreated.emit({ content, files: [...this.pendingFiles()] });
    this.postContent = '';
    this.pendingFiles.set([]);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const newFiles: File[] = [];
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const validation = this.attachmentService.validateFile(file);
      if (validation.valid) {
        newFiles.push(file);
      }
    }

    if (newFiles.length) {
      this.pendingFiles.set([...this.pendingFiles(), ...newFiles]);
    }

    // Reset input so the same file can be re-selected
    input.value = '';
  }

  removeFile(index: number): void {
    const files = [...this.pendingFiles()];
    files.splice(index, 1);
    this.pendingFiles.set(files);
  }

  insertAtSymbol(): void {
    const textarea = this.textareaElement();
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = this.postContent.substring(0, start);
    const after = this.postContent.substring(end);

    this.postContent = before + '@' + after;
    textarea.focus();

    // Set cursor after the @
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 1;
    });
  }

  toggleEmojiPicker(event: Event): void {
    event.stopPropagation();
    this.showEmojiPicker.update((v) => !v);
  }

  onEmojiSelected(emoji: string): void {
    const textarea = this.textareaElement();
    if (!textarea) {
      this.postContent += emoji;
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = this.postContent.substring(0, start);
    const after = this.postContent.substring(end);

    this.postContent = before + emoji + after;
    this.showEmojiPicker.set(false);

    textarea.focus();
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    });
  }

  onMentionSelected(mention: { id: string; name: string; type: string }): void {
    const textarea = this.textareaElement();
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const text = this.postContent;

    // Find the @ that triggered this mention (search backward from cursor)
    let atIndex = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '@') {
        atIndex = i;
        break;
      }
      if (text[i] === ' ' || text[i] === '\n') break;
    }

    if (atIndex === -1) return;

    const before = text.substring(0, atIndex);
    const after = text.substring(cursorPos);
    const mentionText = `@[${mention.name}](${mention.type}:${mention.id}) `;

    this.postContent = before + mentionText + after;

    textarea.focus();
    const newPos = before.length + mentionText.length;
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = newPos;
    });
  }
}
