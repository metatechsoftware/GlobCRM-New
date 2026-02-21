import {
  Component,
  ChangeDetectionStrategy,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

interface EmojiCategory {
  name: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Reactions',
    emojis: ['👍', '👏', '🎉', '🔥', '❤️', '😊', '😂', '🤔', '👀', '💯', '✅', '⭐', '🚀', '💪'],
  },
  {
    name: 'Hands',
    emojis: ['🤝', '👋', '✋', '🙌', '👆', '👇', '👉', '🤞', '✌️', '🫡'],
  },
  {
    name: 'Objects',
    emojis: ['📊', '📈', '📅', '💼', '📧', '💡', '🎯', '📝', '📌', '🏆', '💰', '⏰', '🔔', '📎', '🗂️', '☕'],
  },
];

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @keyframes pickerEnter {
      from {
        opacity: 0;
        transform: translateY(6px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .emoji-picker {
      position: absolute;
      bottom: 100%;
      left: 0;
      z-index: var(--z-popover, 1060);
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-lg);
      width: 320px;
      overflow: hidden;
      animation: pickerEnter var(--duration-normal, 200ms) var(--ease-spring) both;
    }

    /* ── Category Tabs ── */
    .emoji-tabs {
      display: flex;
      border-bottom: 1px solid var(--color-border-subtle, #F0F0EE);
      padding: 0 4px;
    }

    .emoji-tab {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 0;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 18px;
      border-bottom: 2px solid transparent;
      transition:
        border-color var(--duration-fast, 100ms),
        background var(--duration-fast, 100ms);
      border-radius: 0;

      &:hover {
        background: var(--color-highlight, rgba(249, 115, 22, 0.06));
      }
    }

    .emoji-tab--active {
      border-bottom-color: var(--color-primary, #F97316);
    }

    /* ── Category Content ── */
    .emoji-category-content {
      padding: 10px 12px 12px;
    }

    .emoji-category-label {
      font-size: 11px;
      font-weight: var(--font-semibold, 600);
      color: var(--color-text-muted, #9CA3AF);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 6px;
    }

    .emoji-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }

    .emoji-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      background: none;
      border-radius: var(--radius-md, 8px);
      cursor: pointer;
      font-size: 20px;
      transition:
        background var(--duration-fast, 100ms),
        transform var(--duration-fast, 100ms) var(--ease-spring);
    }

    .emoji-btn:hover {
      background: var(--color-highlight, rgba(249, 115, 22, 0.06));
      transform: scale(1.2);
    }

    .emoji-btn:active {
      transform: scale(0.95);
    }

    @media (prefers-reduced-motion: reduce) {
      .emoji-picker {
        animation: none;
      }
      .emoji-btn:hover {
        transform: none;
      }
    }
  `,
  template: `
    <div class="emoji-picker" (click)="$event.stopPropagation()">
      <div class="emoji-tabs">
        @for (category of categories; track category.name; let i = $index) {
          <button class="emoji-tab"
                  [class.emoji-tab--active]="activeCategory() === i"
                  type="button"
                  (click)="setCategory(i)">
            {{ category.emojis[0] }}
          </button>
        }
      </div>
      <div class="emoji-category-content">
        <div class="emoji-category-label">{{ getCategoryLabel(activeCategory()) }}</div>
        <div class="emoji-grid">
          @for (emoji of categories[activeCategory()].emojis; track emoji) {
            <button class="emoji-btn" type="button" (click)="selectEmoji(emoji)">{{ emoji }}</button>
          }
        </div>
      </div>
    </div>
  `,
})
export class EmojiPickerComponent {
  readonly emojiSelected = output<string>();
  readonly categories = EMOJI_CATEGORIES;
  readonly activeCategory = signal(0);
  private readonly translocoService = inject(TranslocoService);

  /** Map category names to transloco keys. */
  private readonly categoryTranslocoKeys: Record<string, string> = {
    Reactions: 'feed.emoji.reactions',
    Hands: 'feed.emoji.hands',
    Objects: 'feed.emoji.objects',
  };

  getCategoryLabel(index: number): string {
    const name = this.categories[index].name;
    const key = this.categoryTranslocoKeys[name];
    return key ? this.translocoService.translate(key) : name;
  }

  setCategory(index: number): void {
    this.activeCategory.set(index);
  }

  selectEmoji(emoji: string): void {
    this.emojiSelected.emit(emoji);
  }
}
