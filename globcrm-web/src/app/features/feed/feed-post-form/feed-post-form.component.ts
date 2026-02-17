import {
  Component,
  ChangeDetectionStrategy,
  EventEmitter,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthStore } from '../../../core/auth/auth.store';

/**
 * Social post creation form.
 * Displays user avatar initials on the left, textarea on the right, and a Post button.
 * Emits postCreated event with the content text on submit.
 */
@Component({
  selector: 'app-feed-post-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .post-form-card {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border-subtle, #e0e0e0);
      border-radius: 12px;
      margin-bottom: 16px;
    }

    .author-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      min-width: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-primary-soft, #fff3e0) 0%, var(--color-secondary-soft, #e8f5e9) 100%);
      color: var(--color-primary-text, #e65100);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .post-form-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .post-form-body mat-form-field {
      width: 100%;
    }

    .post-form-actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
  template: `
    <div class="post-form-card">
      <div class="author-avatar">{{ userInitials }}</div>
      <div class="post-form-body">
        <mat-form-field appearance="outline">
          <mat-label>Share something with your team...</mat-label>
          <textarea matInput
                    [(ngModel)]="postContent"
                    rows="2"
                    (keydown.enter)="onSubmit($event)"></textarea>
        </mat-form-field>
        <div class="post-form-actions">
          <button mat-raised-button
                  color="primary"
                  [disabled]="!postContent.trim()"
                  (click)="onSubmit()">
            <mat-icon>send</mat-icon>
            Post
          </button>
        </div>
      </div>
    </div>
  `,
})
export class FeedPostFormComponent {
  @Output() postCreated = new EventEmitter<string>();

  private readonly authStore = inject(AuthStore);

  postContent = '';

  get userInitials(): string {
    const user = this.authStore.user();
    if (!user) return '';
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }

  onSubmit(event?: Event): void {
    if (event) {
      // Prevent Enter from adding newline; use Shift+Enter for newline
      const keyEvent = event as KeyboardEvent;
      if (!keyEvent.shiftKey) {
        event.preventDefault();
      } else {
        return;
      }
    }

    const content = this.postContent.trim();
    if (!content) return;

    this.postCreated.emit(content);
    this.postContent = '';
  }
}
